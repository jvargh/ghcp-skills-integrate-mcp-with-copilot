document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // Authentication UI elements
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const authMessage = document.getElementById("auth-message");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginMessageDiv = document.getElementById("login-message");
  const closeBtn = document.querySelector(".close");
  // Authentication state
  let currentSessionId = localStorage.getItem("teacher_session_id");
  let isAuthenticated = false;
  let teacherName = localStorage.getItem("teacher_name");

  // Authentication functions
  async function checkAuthStatus() {
    if (currentSessionId) {
      try {
        const response = await fetch(`/auth/status?session_id=${encodeURIComponent(currentSessionId)}`);
        const result = await response.json();
        isAuthenticated = result.authenticated;
        
        if (!isAuthenticated) {
          // Session expired, clear local storage
          localStorage.removeItem("teacher_session_id");
          localStorage.removeItem("teacher_name");
          currentSessionId = null;
          teacherName = null;
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        isAuthenticated = false;
      }
    }
    updateAuthUI();
  }

  function updateAuthUI() {
    if (isAuthenticated && teacherName) {
      authMessage.textContent = `Teacher: ${teacherName}`;
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
    } else {
      authMessage.textContent = "Student View";
      loginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
    }
  }

  async function handleLogin(username, password) {
    try {
      const response = await fetch(`/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
        method: "POST"
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        currentSessionId = result.session_id;
        teacherName = result.teacher_name;
        isAuthenticated = true;
        
        // Store in localStorage
        localStorage.setItem("teacher_session_id", currentSessionId);
        localStorage.setItem("teacher_name", teacherName);
        
        updateAuthUI();
        loginModal.style.display = "none";
        loginForm.reset();
        
        // Refresh activities to show/hide delete buttons
        fetchActivities();
        
        showMessage(`${result.message} You can now register and unregister students.`, "success");
      } else {
        showLoginMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      showLoginMessage("Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  }

  async function handleLogout() {
    if (currentSessionId) {
      try {
        await fetch(`/logout?session_id=${encodeURIComponent(currentSessionId)}`, {
          method: "POST"
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
    
    // Clear local state
    currentSessionId = null;
    teacherName = null;
    isAuthenticated = false;
    
    // Clear localStorage
    localStorage.removeItem("teacher_session_id");
    localStorage.removeItem("teacher_name");
    
    updateAuthUI();
    fetchActivities(); // Refresh to hide delete buttons
    showMessage("Logged out successfully", "success");
  }

  function showLoginMessage(message, type) {
    loginMessageDiv.textContent = message;
    loginMessageDiv.className = type;
    loginMessageDiv.classList.remove("hidden");
    
    setTimeout(() => {
      loginMessageDiv.classList.add("hidden");
    }, 5000);
  }

  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons only for authenticated teachers
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${isAuthenticated ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ''}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isAuthenticated) {
      showMessage("Authentication required. Please login as a teacher.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}&session_id=${encodeURIComponent(currentSessionId)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      showMessage("Authentication required. Please login as a teacher to register students.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}&session_id=${encodeURIComponent(currentSessionId)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Authentication event listeners
  loginBtn.addEventListener("click", () => {
    loginModal.style.display = "block";
  });

  logoutBtn.addEventListener("click", handleLogout);

  closeBtn.addEventListener("click", () => {
    loginModal.style.display = "none";
  });

  window.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      loginModal.style.display = "none";
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    await handleLogin(username, password);
  });

  // Initialize app
  checkAuthStatus().then(() => {
    fetchActivities();
  });
});
