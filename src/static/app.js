document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  
  // View toggle elements
  const listViewBtn = document.getElementById("list-view-btn");
  const calendarViewBtn = document.getElementById("calendar-view-btn");
  const listView = document.getElementById("list-view");
  const calendarView = document.getElementById("calendar-view");
  const calendarGrid = document.getElementById("calendar-grid");
  const scheduleEmailInput = document.getElementById("schedule-email");
  const loadScheduleBtn = document.getElementById("load-schedule-btn");
  const studentScheduleDiv = document.getElementById("student-schedule");
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

  // View toggle functionality
  listViewBtn.addEventListener("click", () => {
    listViewBtn.classList.add("active");
    calendarViewBtn.classList.remove("active");
    listView.classList.remove("hidden");
    calendarView.classList.add("hidden");
  });

  calendarViewBtn.addEventListener("click", () => {
    calendarViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");
    calendarView.classList.remove("hidden");
    listView.classList.add("hidden");
    fetchCalendar(); // Load calendar when switching to calendar view
  });

  // Fetch and display calendar data
  async function fetchCalendar() {
    try {
      const response = await fetch("/calendar");
      const calendarData = await response.json();

      // Define time slots to display
      const timeSlots = [
        { label: "2:00 PM", time: "14:00" },
        { label: "3:30 PM", time: "15:30" },
        { label: "4:00 PM", time: "16:00" }
      ];

      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      // Build calendar table
      let tableHTML = '<table class="calendar-table"><thead><tr><th>Time</th>';
      days.forEach(day => {
        tableHTML += `<th>${day}</th>`;
      });
      tableHTML += '</tr></thead><tbody>';

      // Create rows for each time slot
      timeSlots.forEach(slot => {
        tableHTML += `<tr><td class="time-column">${slot.label}</td>`;
        
        days.forEach(day => {
          const dayActivities = calendarData[day] || [];
          const activitiesAtTime = dayActivities.filter(activity => 
            activity.start_time === slot.time
          );

          tableHTML += '<td>';
          activitiesAtTime.forEach(activity => {
            const capacityPercent = (activity.participants_count / activity.max_participants) * 100;
            const capacityClass = capacityPercent >= 90 ? 'full' : capacityPercent >= 70 ? 'filling' : 'available';
            
            tableHTML += `
              <div class="calendar-activity ${activity.category}" 
                   data-activity="${activity.name}"
                   title="Click for details">
                <div class="activity-name">${activity.name}</div>
                <div class="activity-time">${slot.label} - ${formatTime(activity.end_time)}</div>
                <div class="activity-capacity">
                  <span class="capacity-badge">${activity.spots_left} spots left</span>
                </div>
              </div>
            `;
          });
          tableHTML += '</td>';
        });
        
        tableHTML += '</tr>';
      });

      tableHTML += '</tbody></table>';
      calendarGrid.innerHTML = tableHTML;

      // Add click handlers for activities
      document.querySelectorAll('.calendar-activity').forEach(element => {
        element.addEventListener('click', (e) => {
          const activityName = e.currentTarget.getAttribute('data-activity');
          showActivityDetails(activityName);
        });
      });

    } catch (error) {
      calendarGrid.innerHTML = "<p>Failed to load calendar. Please try again later.</p>";
      console.error("Error fetching calendar:", error);
    }
  }

  // Format time from 24-hour to 12-hour format
  function formatTime(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  }

  // Show activity details (could be expanded to a modal)
  function showActivityDetails(activityName) {
    // Switch to list view and scroll to the activity
    listViewBtn.click();
    
    // Find the activity card
    const activityCards = document.querySelectorAll('.activity-card h4');
    for (let card of activityCards) {
      if (card.textContent === activityName) {
        card.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.parentElement.style.backgroundColor = '#fff3cd';
        setTimeout(() => {
          card.parentElement.style.backgroundColor = '#f9f9f9';
        }, 2000);
        break;
      }
    }
  }

  // Load student schedule
  loadScheduleBtn.addEventListener("click", async () => {
    const email = scheduleEmailInput.value.trim();
    
    if (!email) {
      studentScheduleDiv.innerHTML = '<p class="schedule-hint" style="color: #c62828;">Please enter your email address</p>';
      return;
    }

    try {
      const response = await fetch(`/student/${encodeURIComponent(email)}/schedule`);
      const scheduleData = await response.json();

      if (scheduleData.activities.length === 0) {
        studentScheduleDiv.innerHTML = `
          <div class="empty-schedule">
            <p>No activities found</p>
            <p style="font-size: 14px;">You haven't signed up for any activities yet.</p>
          </div>
        `;
        return;
      }

      // Group activities by day
      const dayGroups = {};
      scheduleData.activities.forEach(activity => {
        if (!dayGroups[activity.day]) {
          dayGroups[activity.day] = [];
        }
        dayGroups[activity.day].push(activity);
      });

      // Build schedule HTML
      let scheduleHTML = '';
      const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      
      dayOrder.forEach(day => {
        if (dayGroups[day]) {
          dayGroups[day].forEach(activity => {
            scheduleHTML += `
              <div class="schedule-item ${activity.category}">
                <div class="day-label">${day} - ${activity.name}</div>
                <div class="time-label">${formatTime(activity.start_time)} - ${formatTime(activity.end_time)}</div>
              </div>
            `;
          });
        }
      });

      // Add summary
      scheduleHTML += `
        <div class="schedule-summary">
          <h4>📊 Schedule Summary</h4>
          <p><strong>Total Activities:</strong> ${scheduleData.total_activities}</p>
          <p><strong>Total Sessions:</strong> ${scheduleData.activities.length}</p>
        </div>
      `;

      studentScheduleDiv.innerHTML = scheduleHTML;

    } catch (error) {
      studentScheduleDiv.innerHTML = '<p class="schedule-hint" style="color: #c62828;">Failed to load schedule. Please try again.</p>';
      console.error("Error fetching schedule:", error);
    }
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
