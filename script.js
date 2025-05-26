(() => {
    const form = document.getElementById('add-task-form');
    const descInput = document.getElementById('add-task-desc');
    const timeInput = document.getElementById('add-task-time');
    const categorySelect = document.getElementById('add-task-category');
    const repeatCheckbox = document.getElementById('repeat-daily');
    const categoryContainer = document.getElementById('category-container');
    const templateSelector = document.getElementById('template-selector');
  
    const notificationOverlay = document.getElementById('notification-overlay');
    const notificationTaskDesc = document.getElementById('notification-task-desc');
    const notificationSticker = document.getElementById('notification-sticker');
    const notificationQuote = document.getElementById('notification-quote');
    const notificationSnoozeBtn = document.getElementById('notification-snooze');
    const notificationDismissBtn = document.getElementById('notification-dismiss');
    const alertSound = document.getElementById('alert-sound');
  
    // Anime Characters with quotes and sticker URLs
    const animeCharacters = [
      {
        name: 'Gojo Satoru',
        quotes: [
          "I’m the strongest there is.",
          "Don’t worry, I’m the honored one.",
          "Dying to win and risking death to win are completely different.",
          "When you die, you’ll be alone."
        ],
        sticker: 'assets/characters/satoru-gojo---correndo.gif'
      },
      {
        name: 'Dazai',
        quotes: [
          "As long as I can make them laugh, it doesn't matter how, I'll be alright.",
          "Doing your best is important, but relaxing is just as necessary.",
          "Now, now, don’t be so gloomy. Smile!",
          "Ah, what a beautiful day to be alive… if only temporarily"
        ],
        sticker: 'assets/characters/dazai.gif'
      },
      {
        name: 'Luffy',
        quotes: [
          "I’m gonna be King of the Pirates!",
          "Fighting for your friends is the best kind of fight!",
          "If you don’t take risks, you can’t create a future.",
          "I don’t want to conquer anything. I just think the guy with the most freedom in this whole ocean... is the Pirate King!"
        ],
        sticker: 'assets/characters/giphy.gif'
      },
      {
        name: 'Sailor Moon',
        quotes: [
          "In the name of the moon, I’ll punish you!",
          "The moon will be your guiding light in the darkness.",
          "Love and justice will win.",
          "Even when you feel lonely, you are never alone."
        ],
        sticker: 'assets/characters/giphy (1).gif'
      }
    ];
  
    const STORAGE_KEY = 'anime_task_planner_tasks';
  
    let tasks = [];
  
    // Notification queue management
    let notificationQueue = [];
    let notificationVisible = false;
    let currentNotificationTaskId = null;
    let alertTimeoutIds = new Map(); // taskId -> timeoutId
  
    function formatDateTime(timestamp) {
      if (!timestamp) return '';
      const d = new Date(timestamp);
      return d.toLocaleString([], {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  
    function generateId() {
      return 'task-' + Math.random().toString(36).substr(2, 9);
    }
  
    function saveTasks() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }
  
    function loadTasks() {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        try {
          tasks = JSON.parse(data);
          if (!Array.isArray(tasks)) tasks = [];
        } catch {
          tasks = [];
        }
      } else {
        tasks = [];
      }
    }
  
    function renderTasks() {
      const categories = ['Study', 'Work', 'Anime', 'Misc'];
      for (const category of categories) {
        const container = document.getElementById('list-' + category);
        container.innerHTML = '';
        const filtered = tasks.filter(t => t.category === category);
        if (filtered.length === 0) {
          const emptyMsg = document.createElement('p');
          emptyMsg.textContent = 'No tasks.';
          emptyMsg.style.opacity = '0.7';
          emptyMsg.style.fontStyle = 'italic';
          container.appendChild(emptyMsg);
          continue;
        }
        filtered.sort((a, b) => {
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time - b.time;
        });
        for (const task of filtered) {
          const taskEl = document.createElement('div');
          taskEl.className = 'task';
          if (task.completed) taskEl.classList.add('completed');
          taskEl.setAttribute('data-id', task.id);
          taskEl.setAttribute('role', 'listitem');
  
          const descSpan = document.createElement('span');
          descSpan.className = 'task-desc';
          descSpan.textContent = task.desc;
          taskEl.appendChild(descSpan);
  
          if (task.time) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'task-time';
            timeSpan.textContent = formatDateTime(task.time);
            taskEl.appendChild(timeSpan);
          } else {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'task-time';
            timeSpan.textContent = '';
            taskEl.appendChild(timeSpan);
          }
  
          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'task-actions';
  
          const completeBtn = document.createElement('button');
          completeBtn.setAttribute(
            'title',
            task.completed ? 'Mark as Incomplete' : 'Mark as Completed'
          );
          completeBtn.textContent = task.completed ? '↻' : '✔';
          completeBtn.addEventListener('click', () => toggleComplete(task.id));
          actionsDiv.appendChild(completeBtn);
  
          const deleteBtn = document.createElement('button');
          deleteBtn.setAttribute('title', 'Delete task');
          deleteBtn.textContent = '✕';
          deleteBtn.addEventListener('click', () => deleteTask(task.id));
          actionsDiv.appendChild(deleteBtn);
  
          taskEl.appendChild(actionsDiv);
          container.appendChild(taskEl);
        }
      }
    }
  
    function toggleComplete(id) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.completed = !task.completed;
        saveTasks();
        renderTasks();
        updateAlertScheduling();
      }
    }
  
    function deleteTask(id) {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderTasks();
      clearScheduledAlert(id);
    }
  
    function addTask(desc, time, category, repeatDaily) {
      const id = generateId();
      const timeVal = time ? new Date(time).getTime() : null;
      if (timeVal && timeVal < Date.now()) {
        alert('Please choose a future date and time for the task.');
        return false;
      }
      tasks.push({ id, desc, time: timeVal, category, completed: false, repeatDaily });
      saveTasks();
      renderTasks();
      scheduleAlert(tasks[tasks.length - 1]);
      return true;
    }
  
    function setTemplate(templateName) {
      // Remove any previous template classes with prefix template-
      document.body.className = '';
      if (templateName) {
        document.body.classList.add(templateName);
      }
    }
  
    function playSound() {
      alertSound.currentTime = 0;
      alertSound.play().catch(()=>{});
    }
  
    // Show next notification from queue if not already showing
    function showNextNotification() {
      if (notificationVisible) return; // Already showing
      if (notificationQueue.length === 0) return;
      notificationVisible = true;
      const task = notificationQueue.shift();
      currentNotificationTaskId = task.id;
      notificationTaskDesc.textContent = 'Task Alert: ' + task.desc;
      const character = animeCharacters[Math.floor(Math.random() * animeCharacters.length)];
      notificationSticker.src = character.sticker;
      notificationSticker.alt = character.name + ' sticker';
      notificationQuote.textContent = '"' + character.quotes[Math.floor(Math.random() * character.quotes.length)] + '"';
      notificationOverlay.style.display = 'flex';
      notificationOverlay.setAttribute('aria-hidden', 'false');
      notificationOverlay.focus();
      playSound();
    }
  
    function hideNotification() {
      notificationOverlay.style.display = 'none';
      notificationOverlay.setAttribute('aria-hidden', 'true');
      notificationVisible = false;
      currentNotificationTaskId = null;
    }
  
    // Snooze current notification by 5 minutes
    function snoozeNotification() {
      if (!currentNotificationTaskId) return;
      const task = tasks.find(t => t.id === currentNotificationTaskId);
      if (!task) return;
      hideNotification();
      // Reschedule in 5 minutes
      const snoozeTime = Date.now() + 5 * 60 * 1000;
      scheduleAlert(task, snoozeTime);
      // Show next notifications if any
      setTimeout(() => {
        showNextNotification();
      }, 300);
    }
  
    // Dismiss current notification
    function dismissNotification() {
      if (!currentNotificationTaskId) return;
      hideNotification();
      // Show next notifications if any
      setTimeout(() => {
        showNextNotification();
      }, 300);
    }
  
    // Schedule alert for a task at specified time (or use task.time)
    function scheduleAlert(task, customTime) {
      // Clear existing schedule for task
      clearScheduledAlert(task.id);
  
      const alertTime = customTime || task.time;
      if (!alertTime) return;
      if (task.completed) return;
  
      const now = Date.now();
  
      // For repeat daily, calculate next alert for today or next day if time passed
      let nextAlertTime = alertTime;
      if (task.repeatDaily) {
        // Use today's date with alert time
        const alertDate = new Date(alertTime);
        const nowDate = new Date();
        alertDate.setFullYear(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
  
        nextAlertTime = alertDate.getTime();
        if (nextAlertTime < now) {
          // Alert time today passed, schedule for tomorrow
          nextAlertTime += 86400000; // +1 day in ms
        }
      }
  
      const delay = nextAlertTime - now;
      if (delay <= 0) {
        // If time passed, alert immediately
        queueAlert(task);
  
        // For repeatDaily, schedule for next day
        if (task.repeatDaily) {
          scheduleAlert(task, nextAlertTime + 86400000);
        }
        return;
      }
  
      const timeoutId = setTimeout(() => {
        queueAlert(task);
        if (task.repeatDaily) {
          scheduleAlert(task, nextAlertTime + 86400000);
        }
      }, delay);
  
      alertTimeoutIds.set(task.id, timeoutId);
    }
  
    // Queue a task alert in notification queue
    function queueAlert(task) {
      // Avoid duplicated task alerts in queue
      if (notificationQueue.some(t => t.id === task.id) || (currentNotificationTaskId === task.id && notificationVisible)) return;
      notificationQueue.push(task);
      showNextNotification();
    }
  
    // Clear scheduled alert timeout for a taskId
    function clearScheduledAlert(taskId) {
      if (alertTimeoutIds.has(taskId)) {
        clearTimeout(alertTimeoutIds.get(taskId));
        alertTimeoutIds.delete(taskId);
      }
      // Also remove from any queued notifications (if any)
      notificationQueue = notificationQueue.filter(t => t.id !== taskId);
      if (currentNotificationTaskId === taskId) {
        dismissNotification();
      }
    }
  
    // Schedule alerts for all tasks date-time and not completed
    function scheduleAllAlerts() {
      alertTimeoutIds.forEach((id) => clearTimeout(id));
      alertTimeoutIds.clear();
      notificationQueue = [];
      notificationVisible = false;
      tasks.forEach(task => {
        if (task.time && !task.completed) {
          scheduleAlert(task);
        }
      });
    }
  
    // Update scheduling when tasks updated (complete/delete)
    function updateAlertScheduling() {
      alertTimeoutIds.forEach((timeoutId, taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task || task.completed) {
          clearScheduledAlert(taskId);
        }
      });
      tasks.forEach(task => {
        if (task.time && !task.completed && !alertTimeoutIds.has(task.id)) {
          scheduleAlert(task);
        }
      });
    }
  
    // Bind form submit event
    form.addEventListener('submit', e => {
      e.preventDefault();
      const desc = descInput.value.trim();
      const timeVal = timeInput.value;
      const category = categorySelect.value;
      const repeatDaily = repeatCheckbox.checked;
  
      if (!desc) {
        alert('Please enter a task description.');
        return;
      }
      if (!category) {
        alert('Please select a category.');
        return;
      }
      const success = addTask(desc, timeVal, category, repeatDaily);
      if (success) {
        descInput.value = '';
        timeInput.value = '';
        categorySelect.selectedIndex = 0;
        repeatCheckbox.checked = false;
        descInput.focus();
        updateAlertScheduling();
      }
    });
  
    // Template selector change
    templateSelector.addEventListener('change', e => {
      setTemplate(e.target.value);
    });
    function setTemplate(templateName) {
      document.body.className = '';
      if(templateName) {
        document.body.classList.add(templateName);
      }
    }
    
  
    // Notification control buttons
    notificationSnoozeBtn.addEventListener('click', snoozeNotification);
    notificationDismissBtn.addEventListener('click', dismissNotification);
  
    // Close notification on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && notificationOverlay.style.display === 'flex') {
        dismissNotification();
      }
    });
  
    // Initialization on page load
    function init() {
      loadTasks();
      renderTasks();
      scheduleAllAlerts();
      setTemplate(templateSelector.value || 'template-sakura-pink');
    }
  
    init();
  
  })();
  