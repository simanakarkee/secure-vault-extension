chrome.runtime.onInstalled.addListener(() => {
  console.log("SecureVault background ready!");
});

// Function to get passwords from storage
const getStoredPasswords = async () => {
  try {
    const data = await chrome.storage.local.get(['isLoggedIn', 'autofillPasswords']);
    if (data.isLoggedIn && data.autofillPasswords) {
      return data.autofillPasswords;
    }
  } catch (error) {
    console.error("Error getting stored passwords:", error);
  }
  return null;
};

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REQUEST_PASSWORDS") {
    // Handle password requests from content scripts
    getStoredPasswords().then(passwords => {
      sendResponse({ passwords: passwords });
    });
    return true; // Required for async response
  }
  
  if (message.type === "SEND_PASSWORDS_TO_CONTENT") {
    // Store passwords in local storage
    chrome.storage.local.set({ autofillPasswords: message.data }, () => {
      // Send to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "RECEIVE_PASSWORDS",
              data: message.data
            });
          }
        });
      });
    });
  }
  
  if (message.type === "CLEAR_AUTOFILL_DATA") {
    // Clear data in storage and all tabs
    chrome.storage.local.remove("autofillPasswords", () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: "CLEAR_AUTOFILL_DATA" });
          }
        });
      });
    });
  }
});
