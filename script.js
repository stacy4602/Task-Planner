// Using an IIFE (Immediately Invoked Function Expression) to avoid polluting the global scope
(() => {
    // --- DOM Element References ---
    const form = document.getElementById('add-task-form');
    const descInput = document.getElementById('add-task-desc');
    const timeInput = document.getElementById('add-task-time');
    const categorySelect = document.getElementById('add-task-category');
    const repeatCheckbox = document.getElementById('repeat-daily');
    const templateSelector = document.getElementById('template-selector');
  
    const notificationOverlay = document.getElementById('notification-overlay');
    const notificationTaskDesc = document.getElementById('notification-task-desc');
    const notificationSticker = document.getElementById('notification-sticker');
    const notificationQuote = document.getElementById('notification-quote');
    const notificationSnoozeBtn = document.getElementById('notification-snooze');
    const notificationDismissBtn = document.getElementById('notification-dismiss');
    const alertSound = document.getElementById('alert-sound');
  
    // --- Data & State Management ---
    const STORAGE_KEY = 'anime_task_planner_tasks';
    let tasks = []; // Main array holding all task objects
    
    // Notification queue management
    let notificationQueue = [];
    let notificationVisible = false;
    let currentNotificationTaskId = null;
    let alertTimeoutIds = new Map(); // Stores scheduled timeouts: { taskId -> timeoutId }

    // --- Data for Notifications ---
    const animeCharacters = [
      {
        name: 'Gojo Satoru',
        quotes: ["Throughout heaven and earth, I alone am the honored one."],
        sticker: 'assets/characters/satoru-gojo---correndo.gif'
      },
      {
        name: 'Dazai',
        quotes: ["A good book is always good, no matter how many times you've already read it."],
        sticker: 'assets/characters/dazai.gif'
      },
      {
        name: 'Luffy',
        quotes: ["If you don’t take risks, you can’t create a future."],
        sticker: 'assets/characters/giphy.gif'
      },
      {
        name: 'Sailor Moon',
        quotes: ["In the name of the moon, I’ll punish you!"],
        sticker: 'assets/characters/giphy (1).gif'
      }
    ];
  
    // --- Core Functions ---
  
    /**
     * Saves the current tasks array to localStorage.
     */
    function saveTasks() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  
    /**
     * Loads tasks from localStorage into the tasks array.
     */
    function loadTasks() {
      const data = localStorage.getItem(STORAGE_KEY);
      tasks = data ? JSON.parse(data) : [];
    }
    
    /**
     * Renders all tasks from the `tasks` array into the DOM.
     */
    function renderTasks() {
      const categories = ['Study', 'Work', 'Anime', 'Misc'];
      categories.forEach(category => {
        const container = document.getElementById('list-' + category);
        container.innerHTML = ''; // Clear previous tasks
  
        const filteredTasks = tasks
          .filter(t => t.category === category)
          .sort((a, b) => (a.time || Infinity) - (b.time || Infinity)); // Sort by time, tasks with no time go to the bottom
  
        filteredTasks.forEach(task => {
          const taskEl = document.createElement('div');
          taskEl.className = 'task';
          taskEl.classList.toggle('completed', task.completed);
          taskEl.setAttribute('data-id', task.id);
          taskEl.setAttribute('role', 'listitem');
  
          // Task description and time
          const timeString = task.time ? new Date(task.time).toLocaleString() : '';
          taskEl.innerHTML = `
            <span class="task-desc">${task.desc}</span>
            <span class="task-time">${timeString}</span>
            <div class="task-actions">
              <button title="${task.completed ? 'Mark as Incomplete' : 'Mark as Completed'}">${task.completed ? '↻' : '✔'}</button>
              <button title="Delete task">✕</button>
            </div>
          `;
  
          // Add event listeners to the action buttons
          taskEl.querySelector('.task-actions button:first-child').addEventListener('click', () => toggleComplete(task.id));
          taskEl.querySelector('.task-actions button:last-child').addEventListener('click', () => deleteTask(task.id));
  
          container.appendChild(taskEl);
        });
      });
    }

    /**
     * Adds a new task to the list.
     * @param {string} desc - The task description.
     * @param {string} time - The ISO string for the task's date and time.
     * @param {string} category - The task category.
     * @param {boolean} repeatDaily - Whether the task alert should repeat daily.
     */
    function addTask(desc, time, category, repeatDaily) {
        const id = 'task-' + Date.now() + Math.random().toString(16).slice(2);
        const timeVal = time ? new Date(time).getTime() : null;
    
        if (timeVal && timeVal < Date.now()) {
            alert('Task time cannot be in the past.');
            return; // Stop the function
        }
    
        const newTask = { id, desc, time: timeVal, category, completed: false, repeatDaily };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        scheduleAlert(newTask); // Schedule notification for the new task
    }
    
    /**
     * Toggles the 'completed' status of a task.
     * @param {string} id - The ID of the task to toggle.
     */
    function toggleComplete(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
            updateAlertScheduling(); // Re-evaluate alerts
        }
    }
  
    /**
     * Deletes a task after user confirmation.
     * @param {string} id - The ID of the task to delete.
     */
    function deleteTask(id) {
        // REFINED: Added a confirmation dialog to prevent accidental deletion.
        if (confirm("Are you sure you want to delete this task?")) {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
            clearScheduledAlert(id); // Cancel any pending notification
        }
    }

    // --- Notification & Scheduling Functions ---

    /**
     * Schedules a notification for a given task.
     * @param {object} task - The task object to schedule an alert for.
     * @param {number} [customTime] - An optional custom time (timestamp) for snoozed alerts.
     */
    function scheduleAlert(task, customTime) {
        clearScheduledAlert(task.id); // Always clear previous alert for this task

        if (task.completed || (!task.time && !customTime)) return;

        const alertTime = customTime || task.time;
        let nextAlertTime = alertTime;
        const now = Date.now();

        if (task.repeatDaily && !customTime) {
            const alertDate = new Date(alertTime);
            const today = new Date();
            // Set the alert to trigger today at the specified time
            alertDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
            nextAlertTime = alertDate.getTime();
            
            // If that time has already passed today, schedule it for tomorrow
            if (nextAlertTime < now) {
                nextAlertTime += 24 * 60 * 60 * 1000; // Add 24 hours
            }
        }

        const delay = nextAlertTime - now;

        if (delay > 0) {
            const timeoutId = setTimeout(() => {
                queueAlert(task);
                // If it's a repeating task, schedule the next one
                if (task.repeatDaily) {
                    scheduleAlert(task, nextAlertTime + 24 * 60 * 60 * 1000);
                }
            }, delay);
            alertTimeoutIds.set(task.id, timeoutId);
        } else if (!customTime) {
            // If the task time is in the past and it's not a snooze, queue it immediately
            queueAlert(task);
            if (task.repeatDaily) {
                 scheduleAlert(task, nextAlertTime + 24 * 60 * 60 * 1000);
            }
        }
    }
    
    /**
     * Adds a task to the notification queue and attempts to show it.
     * @param {object} task - The task to add to the queue.
     */
    function queueAlert(task) {
        if (!notificationQueue.some(t => t.id === task.id)) {
            notificationQueue.push(task);
            showNextNotification();
        }
    }

    /**
     * Displays the next notification from the queue if one isn't already visible.
     */
    function showNextNotification() {
        if (notificationVisible || notificationQueue.length === 0) return;

        notificationVisible = true;
        const task = notificationQueue.shift(); // Get the next task from the queue
        currentNotificationTaskId = task.id;

        // Populate notification with random character data
        const character = animeCharacters[Math.floor(Math.random() * animeCharacters.length)];
        notificationTaskDesc.textContent = `Alert: ${task.desc}`;
        notificationSticker.src = character.sticker;
        notificationSticker.alt = `${character.name} sticker`;
        notificationQuote.textContent = `"${character.quotes[Math.floor(Math.random() * character.quotes.length)]}"`;
        
        notificationOverlay.style.display = 'flex';
        notificationOverlay.setAttribute('aria-hidden', 'false');
        playSound();
    }
    
    /**
     * Hides the currently visible notification.
     */
    function hideNotification() {
        notificationOverlay.style.display = 'none';
        notificationOverlay.setAttribute('aria-hidden', 'true');
        notificationVisible = false;
        currentNotificationTaskId = null;
        // Show the next notification in the queue after a short delay
        setTimeout(showNextNotification, 500);
    }

    function snoozeNotification() {
        const task = tasks.find(t => t.id === currentNotificationTaskId);
        if (task) {
            // Reschedule the alert for 5 minutes from now
            scheduleAlert(task, Date.now() + 5 * 60 * 1000);
        }
        hideNotification();
    }

    /**
     * Clears any scheduled timeout for a specific task.
     * @param {string} taskId - The ID of the task whose alert should be cleared.
     */
    function clearScheduledAlert(taskId) {
        if (alertTimeoutIds.has(taskId)) {
            clearTimeout(alertTimeoutIds.get(taskId));
            alertTimeoutIds.delete(taskId);
        }
    }

    /**
     * Re-evaluates all alerts. Useful after toggling completion status.
     */
    function updateAlertScheduling() {
        tasks.forEach(task => {
            if (task.completed) {
                clearScheduledAlert(task.id);
            } else {
                scheduleAlert(task);
            }
        });
    }
    
    // --- Utility & UI Functions ---
    
    /**
     * Applies the selected theme class to the body.
     * @param {string} templateName - The class name of the theme to apply.
     */
    function setTemplate(templateName) {
        document.body.className = ''; // Clear previous theme
        if (templateName) {
            document.body.classList.add(templateName);
        }
    }

    function playSound() {
        // Only play if the notification is still meant to be visible
        if(notificationVisible) {
            alertSound.currentTime = 0;
            alertSound.play().catch(error => console.log("Autoplay blocked by browser."));
        }
    }
    
    // --- Event Listeners ---
    
    form.addEventListener('submit', e => {
        e.preventDefault();
        const desc = descInput.value.trim();
        const timeVal = timeInput.value;
        const category = categorySelect.value;
        const repeatDaily = repeatCheckbox.checked;

        if (!desc || !category) {
            alert('Please provide a task description and select a category.');
            return;
        }

        addTask(desc, timeVal, category, repeatDaily);
        form.reset(); // A simpler way to clear the form
        descInput.focus();
    });

    templateSelector.addEventListener('change', e => setTemplate(e.target.value));
    notificationSnoozeBtn.addEventListener('click', snoozeNotification);
    notificationDismissBtn.addEventListener('click', hideNotification);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && notificationVisible) {
            hideNotification();
        }
    });

    // --- Initialization ---
    
    /**
     * Initial function to set up the application on page load.
     */
    function init() {
        loadTasks();
        renderTasks();
        updateAlertScheduling(); // Schedule all initial alerts
        setTemplate(templateSelector.value);
    }
  
    init();
})();
  