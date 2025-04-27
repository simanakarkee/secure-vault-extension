console.log("SecureVault script loaded.");
let savedPasswords = [];

// Function to request passwords from background
const requestPasswords = () => {
  chrome.runtime.sendMessage({ type: "REQUEST_PASSWORDS" }, (response) => {
    if (response && response.passwords) {
      savedPasswords = response.passwords;
      console.log("Received passwords from background.");
    }
  });
};

// Request passwords when script loads
requestPasswords();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.autofillPasswords) {
      savedPasswords = changes.autofillPasswords.newValue || [];
      console.log("Updated passwords from storage changes.");
    }
    // If user logs out, clear passwords
    if (changes.isLoggedIn && !changes.isLoggedIn.newValue) {
      savedPasswords = [];
      console.log("Cleared passwords due to logout.");
    }
  }
});

// Listen for messages from popup.js or background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SEND_PASSWORDS_TO_CONTENT" || message.type === "RECEIVE_PASSWORDS") {
    savedPasswords = message.data;
    console.log("Passwords received in content script:", savedPasswords);
  }

  if (message.type === "CLEAR_AUTOFILL_DATA") {
    savedPasswords = [];
    console.log("Autofill data cleared after logout.");
  }
});

// Comprehensive input field detection
const getInputs = (root = document) => {
  // Helper function to check if element is visible
  const isVisible = (element) => {
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  };

  // Helper function to get inputs from shadow DOM
  const getInputsFromShadowDOM = (element) => {
    const shadowRoot = element.shadowRoot;
    if (!shadowRoot) return [];
    
    return [
      ...shadowRoot.querySelectorAll('input'),
      ...Array.from(shadowRoot.querySelectorAll('*'))
        .filter(el => el.shadowRoot)
        .flatMap(el => getInputsFromShadowDOM(el))
    ];
  };

  // Get all potential username/email fields
  const usernameSelectors = [
    // Primary login selectors
    'input[name="username"][autocomplete="username"]',
    'input[type="email"][autocomplete="email"]',
    'input[type="text"][autocomplete="username"]',
    'input[type="text"][autocomplete="email"]',
    
    // Secondary selectors with login context
    'input[name="username"]:not([placeholder*="search" i])',
    'input[type="text"][name*="login" i]:not([placeholder*="search" i])',
    'input[type="text"][id*="login" i]:not([placeholder*="search" i])',
    
    // Email selectors
    'input[type="email"]:not([placeholder*="search" i])',
    'input[name*="email" i]:not([placeholder*="search" i])',
    
    // Fallback selectors (only if near password field)
    'input[type="text"]:not([placeholder*="search" i])',
  ].join(',');

  // Get all potential password fields
  const passwordSelectors = [
    'input[type="password"]',
    'input[autocomplete="current-password"]',
    'input[name="password"]',
    'input[id*="password" i]',
    'input[name*="password" i]'
  ].join(',');

  // Get all inputs including those in shadow DOM
  const allInputs = [
    ...Array.from(root.querySelectorAll('*'))
      .filter(el => el.shadowRoot)
      .flatMap(el => getInputsFromShadowDOM(el)),
    ...Array.from(root.querySelectorAll('input'))
  ];

  // Helper function to check if an input is near a password field
  const isNearPasswordField = (input) => {
    const form = input.form || input.closest('form');
    if (form) {
      return !!form.querySelector(passwordSelectors);
    }
    
    // Check nearby siblings if not in a form
    const parent = input.parentElement;
    if (parent) {
      return !!parent.querySelector(passwordSelectors);
    }
    return false;
  };

  // Find username input
  const usernameInput = allInputs.find(input => {
    // Exclude search fields explicitly
    if (
      input.placeholder?.toLowerCase().includes('search') ||
      input.name?.toLowerCase().includes('search') ||
      input.id?.toLowerCase().includes('search') ||
      input.getAttribute('enterkeyhint') === 'search' ||
      input.getAttribute('type') === 'search'
    ) {
      return false;
    }

    // Check if input matches our selectors
    const matchesSelector = input.matches(usernameSelectors);
    
    // For generic text inputs, ensure they're near a password field
    if (input.type === 'text' && !input.name?.includes('username')) {
      return matchesSelector && isNearPasswordField(input);
    }

    return matchesSelector && isVisible(input);
  });

  // Find password input
  const passwordInput = allInputs.find(input => {
    return input.matches(passwordSelectors) && isVisible(input);
  });

  return { usernameInput, passwordInput };
};

// Create a popup to show saved passwords
const createPopup = (passwords, inputElement) => {
  const existingPopup = document.getElementById("autofill-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  const popup = document.createElement("div");
  popup.id = "autofill-popup";
  popup.style.position = "absolute";
  popup.style.top = `${inputElement.getBoundingClientRect().bottom + window.scrollY}px`; 
  popup.style.left = `${inputElement.getBoundingClientRect().left + window.scrollX}px`;
  popup.style.backgroundColor = "#ffffff";
  popup.style.border = "1px solid #e0e0e0";
  popup.style.borderRadius = "8px";
  popup.style.padding = "16px";
  popup.style.zIndex = "999999";
  popup.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
  popup.style.width = `${inputElement.offsetWidth}px`;
  popup.style.color = "#000000";
  popup.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif";

  const title = document.createElement("h3");
  title.innerText = "Select Password to Autofill";
  title.style.margin = "0 0 12px 0";
  title.style.fontSize = "14px";
  title.style.fontWeight = "600";
  title.style.color = "#000000";
  popup.appendChild(title);

  const passwordList = document.createElement("ul");
  passwordList.style.margin = "0";
  passwordList.style.padding = "0";
  passwordList.style.listStyle = "none";

  passwords.forEach(passwordEntry => {
    const listItem = document.createElement("li");
    listItem.style.padding = "8px 12px";
    listItem.style.margin = "4px 0";
    listItem.style.cursor = "pointer";
    listItem.style.borderRadius = "4px";
    listItem.style.fontSize = "13px";
    listItem.style.color = "#000000";
    listItem.style.transition = "background-color 0.2s ease";
    listItem.innerText = `${passwordEntry.username}`;
    
    // Hover effect
    listItem.addEventListener('mouseover', () => {
      listItem.style.backgroundColor = "#f5f5f5";
    });
    listItem.addEventListener('mouseout', () => {
      listItem.style.backgroundColor = "transparent";
    });
    
    listItem.addEventListener("click", () => {
      autofill(passwordEntry.username, passwordEntry.password);
      popup.remove();
    });
    passwordList.appendChild(listItem);
  });

  popup.appendChild(passwordList);
  document.body.appendChild(popup);

  // Close popup when clicking outside
  document.addEventListener('click', (event) => {
    if (!popup.contains(event.target) && !inputElement.contains(event.target)) {
      popup.remove();
    }
  }, { once: true });
};

// Fill input safely with retry mechanism
const fillInput = (input, value) => {
  if (!input || !value) return;

  const maxAttempts = 3;
  let attempts = 0;

  const tryFill = () => {
    try {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      input.blur();
    } catch (error) {
      console.error("Error filling input:", error);
      if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryFill, 100);
      }
    }
  };

  tryFill();
};

// Autofill logic
const autofill = (username, password) => {
  const { usernameInput, passwordInput } = getInputs();
  if (usernameInput && passwordInput) {
    fillInput(usernameInput, username);
    fillInput(passwordInput, password);
    console.log("Autofill triggered.");
  } else {
    console.log("No input fields found.");
  }
};

// Set up MutationObserver to watch for dynamically added inputs
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length) {
      const { usernameInput, passwordInput } = getInputs(document);
      if (usernameInput && passwordInput) {
        console.log("Found login inputs after DOM mutation");
      }
    }
  }
});

// Start observing the document with the configured parameters
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// Listen for keyboard shortcut (Ctrl + A or Cmd + A)
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    console.log("Ctrl/Cmd + A detected, showing autofill popup...");
    
    const { usernameInput, passwordInput } = getInputs();
    
    if (usernameInput && passwordInput) {
      createPopup(savedPasswords, usernameInput);
    } else {
      console.log("No input fields found.");
    }
  }
});
