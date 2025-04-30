
// Password visibility toggle
document.getElementById("toggle-password").addEventListener("click", function() {
  const passwordInput = document.getElementById("password");
  const eyeIcon = this.querySelector("img");
  
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    eyeIcon.src = "icons/eye-slash.png"; // Change to closed eye icon
  } else {
    passwordInput.type = "password";
    eyeIcon.src = "icons/eye.png"; // Change back to open eye icon
  }
});

// LOGIN
document.getElementById("login-btn").addEventListener("click", async () => {
  const uname = document.getElementById("username").value;
  const password = document.getElementById("password").value;
    // Clear any previous error messages before checking
    document.getElementById("login-error").textContent = "";
  // Check if username (email) is empty
  if (!uname) {
    document.getElementById("login-error").textContent = "Email is required.";
    return; // Stop execution if email is empty
  }

  // Check if password is empty
  if (!password) {
    document.getElementById("login-error").textContent = "Password is required.";
    return; // Stop execution if password is empty
  }
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // important! includes the session cookie
      body: JSON.stringify({ email: uname, password })
    });

    const data = await response.json();
   
    if (response.ok && data.uid) {
      chrome.storage.local.set(
        { isLoggedIn: true, email: data.email, uid: data.uid, autofillPasswords: data.passwords || [] },
        () => {
          chrome.runtime.sendMessage({
            type: "SEND_PASSWORDS_TO_CONTENT",
            data: data.passwords || []
          });
          showPasswords();
        }
      );
    } else {
      document.getElementById("login-error").textContent = data;
    }
  } catch (error) {
    document.getElementById("login-error").textContent = "Server error.";
  }
});

// LOGOUT
document.getElementById("logout-btn").addEventListener("click", async () => {
 
  chrome.storage.local.remove(["isLoggedIn", "uid", "email"], () => {
    document.getElementById("passwords-section").style.display = "none";
    document.getElementById("login-section").style.display = "block";
    // Clear any error messages when logging out
    document.getElementById("login-error").textContent = "";
  });
  chrome.runtime.sendMessage({ type: "LOGOUT" });

});

// FETCH PASSWORDS
async function showPasswords() {
  chrome.storage.local.get(["isLoggedIn", "uid"], async (result) => {
    if (!result.isLoggedIn) {
       // If the user is not logged in, hide password section and show login section
       document.getElementById("passwords-section").style.display = "none";
       document.getElementById("login-section").style.display = "block";
       return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/getAllPasswords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ uid: result.uid})
      });

      const data = await response.json();
     
      if (response.ok) {
        const list = document.getElementById("passwords-list");
        list.innerHTML = ""; // Clear any existing list items

        // Clear any existing "No passwords saved" message
        const noPasswordsMessage = document.querySelector(".no-passwords-message");
        if (noPasswordsMessage) {
          noPasswordsMessage.remove();
        }
        // Always show the reload button
        document.getElementById("reload-btn").style.display = "block";
         // Check if there are any passwords in the response
    if (data && Array.isArray(data) && data.length > 0) {
      document.getElementById("login-section").style.display = "none";
      document.getElementById("passwords-section").style.display = "block";

      // const list = document.getElementById("passwords-list");
      // list.innerHTML = ""; // Clear any existing list items
      chrome.runtime.sendMessage({
        type: "SEND_PASSWORDS_TO_CONTENT",
        data: data // assuming data is the array of passwords
      });
      // Display the passwords
      data.forEach((entry) => {
          const li = document.createElement("li");
          li.innerHTML = `
             <li class="password-item" style="margin-bottom: 16px; padding: 12px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <strong style="font-size: 16px;">${entry.sitename}</strong>
    <a href="${entry.url}" target="_blank" style="font-size: 14px; color: #007bff; text-decoration: none;">Visit Site</a>
  </div>

  <div style="margin-top: 10px; font-size: 14px;">
    <div><strong>Username:</strong> ${entry.username}</div>
    <div style="display: flex; align-items: center; margin-top: 4px;">
      <strong>Password:</strong>
      <span class="password-text" style="margin-left: 6px; letter-spacing: 2px;">${'•'.repeat(entry.password.length)}</span>
      <button class="password-toggle" aria-label="Toggle password visibility" style="background: none; border: none; margin-left: 8px; cursor: pointer;">
        <img src="icons/eye.png" alt="Toggle password" style="width: 18px; height: 18px;" />
      </button>
    </div>
  </div>
</li>


          `;
          
          // Add click handler for password toggle
          const toggleBtn = li.querySelector('.password-toggle');
          const passwordText = li.querySelector('.password-text');
          let isPasswordVisible = false;
          
          toggleBtn.addEventListener('click', () => {
            isPasswordVisible = !isPasswordVisible;
            passwordText.textContent = isPasswordVisible ? entry.password : '•'.repeat(entry.password.length);
            toggleBtn.querySelector('img').src = isPasswordVisible ? 'icons/eye-slash.png' : 'icons/eye.png';
          });
          
          list.appendChild(li);
      });
     
  } else {
      // If there are no passwords in the data
      document.getElementById("login-section").style.display = "none";
      document.getElementById("passwords-section").style.display = "block";

      const message = document.createElement("div");
      message.classList.add("no-passwords-message");
      message.innerHTML = "No passwords saved.";
      document.getElementById("passwords-section").appendChild(message);
     
  }
      } else {
        document.getElementById("login-error").textContent = "Not logged in. Please login again.";
        chrome.storage.local.remove("isLoggedIn");
      }
    } catch (error) {
      document.getElementById("login-error").textContent = "Error fetching passwords.";
    }
  });
}
// Reload button click handler
document.getElementById("reload-btn").addEventListener("click", () => {
  showPasswords();  // Reload passwords
});
// Check session on popup load
document.addEventListener("DOMContentLoaded", showPasswords);
