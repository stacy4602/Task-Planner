(() => {
    // --- DOM Element References ---
    const form = document.getElementById('add-task-form');
    const descInput = document.getElementById('add-task-desc');
    const timeInput = document.getElementById('add-task-time');
    const categorySelect = document.getElementById('add-task-category');
    const repeatCheckbox = document.getElementById('repeat-daily');
    const templateSelector = document.getElementById('template-selector');
    
    // Notification elements
    const notificationOverlay = document.getElementById('notification-overlay');
    const notificationTaskDesc = document.getElementById('notification-task-desc');
    const notificationSticker = document.getElementById('notification-sticker');
    const notificationQuote = document.getElementById('notification-quote');
    const notificationSnoozeBtn = document.getElementById('notification-snooze');
    const notificationDismissBtn = document.getElementById('notification-dismiss');

    // Edit Modal elements
    const editModalOverlay = document.getElementById('edit-modal-overlay');
    const editForm = document.getElementById('edit-task-form');
    const editDescInput = document.getElementById('edit-task-desc');
    const editCancelBtn = document.getElementById('edit-modal-cancel');

    // Audio elements
    let currentAlertSound = document.getElementById('alert-sound-default');

    // --- Data & State Management ---
    const STORAGE_KEY = 'anime_task_planner_tasks';
    let tasks = [];
    let currentEditingTaskId = null;
    
    // RESTORED: Notification Queue & State
    let notificationQueue = [];
    let notificationVisible = false;
    let currentNotificationTaskId = null;
    let alertTimeoutIds = new Map(); // Stores { taskId -> timeoutId }
    
    // --- Theme-aligned Notification Data ---
    const themedCharacters = {
        'template-one-piece': [
            { name: 'Luffy', quotes: ["I'm gonna be King of the Pirates!"], sticker: 'assets/characters/luffy1.gif' },
            { name: 'Zoro', quotes: ["Nothing happened."], sticker: 'assets/characters/luffy2.gif' }
        ],
        'template-jujutsu-kaisen': [
            { name: 'Gojo Satoru', quotes: ["Throughout Heaven and Earth, I alone am the honored one."], sticker: 'assets/characters/gojo.gif' },
            { name: 'Sukuna', quotes: ["Know your place, fool."], sticker: 'assets/characters/gojo.gif' }
        ],
        'template-demon-slayer': [
            { name: 'Tanjiro', quotes: ["I can do it. I know I can do it."], sticker: 'assets/characters/dazai.gif' },
            { name: 'Inosuke', quotes: ["Pig Assault!"], sticker: 'assets/characters/dazai.gif' }
        ],
        'default': [
            { name: 'Sailor Moon', quotes: ["In the name of the moon, I’ll punish you!"], sticker: 'assets/characters/sailormoon1.gif' },
            { name: 'Dazai', quotes: ["A good book is always good."], sticker: 'assets/characters/dazai.gif' }
        ]
    };
    
    // --- Core Task Functions ---
    function saveTasks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
    function loadTasks() { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }

    function renderTasks() {
        const categories = ['Anime World', 'Real Life'];
        categories.forEach(category => {
            const container = document.getElementById(`list-${category}`);
            container.innerHTML = '';
            
            tasks.filter(t => t.category === category).forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.className = 'task';
                taskEl.classList.toggle('completed', task.completed);
                taskEl.dataset.id = task.id;

                taskEl.innerHTML = `
                    <span class="task-desc">${task.desc}</span>
                    <div class="task-actions">
                        <button title="Edit task">✎</button>
                        <button title="Complete task">${task.completed ? '↻' : '✔'}</button>
                        <button title="Delete task">✕</button>
                    </div>
                `;

                taskEl.querySelector('button[title="Edit task"]').addEventListener('click', () => openEditModal(task.id));
                taskEl.querySelector('button[title="Complete task"]').addEventListener('click', () => toggleComplete(task.id));
                taskEl.querySelector('button[title="Delete task"]').addEventListener('click', () => deleteTask(task.id));

                container.appendChild(taskEl);
            });
        });
    }

    function addTask(desc, time, category, repeatDaily) {
        const newTask = {
            id: 'task-' + Date.now(),
            desc,
            time: time ? new Date(time).getTime() : null,
            category,
            completed: false,
            repeatDaily
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        scheduleAlert(newTask); // FIXED: Schedule alert for the new task
    }

    function toggleComplete(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
            scheduleAllAlerts(); // FIXED: Re-evaluate all alerts
        }
    }

    function deleteTask(id) {
        if (confirm("Are you sure you want to delete this task?")) {
            clearScheduledAlert(id); // FIXED: Clear any pending alert before deleting
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
        }
    }

    // --- Edit Modal Functions ---
    function openEditModal(id) {
        currentEditingTaskId = id;
        const task = tasks.find(t => t.id === id);
        if (task) {
            editDescInput.value = task.desc;
            editModalOverlay.style.display = 'flex';
            editDescInput.focus();
        }
    }

    function closeEditModal() {
        editModalOverlay.style.display = 'none';
        currentEditingTaskId = null;
    }

    function saveTaskChanges(e) {
        e.preventDefault();
        const task = tasks.find(t => t.id === currentEditingTaskId);
        if (task) {
            task.desc = editDescInput.value.trim();
            saveTasks();
            renderTasks();
        }
        closeEditModal();
    }

    // --- RESTORED: Notification & Scheduling Functions ---
    function scheduleAlert(task, customTime) {
        clearScheduledAlert(task.id);
        if (task.completed || (!task.time && !customTime)) return;

        const alertTime = customTime || task.time;
        const now = Date.now();
        let nextAlertTime = alertTime;

        if (task.repeatDaily && !customTime) {
            const alertDate = new Date(alertTime);
            const today = new Date();
            alertDate.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
            nextAlertTime = alertDate.getTime();
            if (nextAlertTime < now) nextAlertTime += 24 * 60 * 60 * 1000;
        }

        const delay = nextAlertTime - now;
        if (delay > 0) {
            const timeoutId = setTimeout(() => {
                queueAlert(task);
                if (task.repeatDaily) {
                    scheduleAlert(task); // Reschedule for the next day
                }
            }, delay);
            alertTimeoutIds.set(task.id, timeoutId);
        }
    }

    function scheduleAllAlerts() {
        // Clear all existing timeouts before rescheduling
        alertTimeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        alertTimeoutIds.clear();
        tasks.forEach(task => scheduleAlert(task));
    }
    
    function clearScheduledAlert(taskId) {
        if (alertTimeoutIds.has(taskId)) {
            clearTimeout(alertTimeoutIds.get(taskId));
            alertTimeoutIds.delete(taskId);
        }
    }
    
    function queueAlert(task) {
        if (!notificationQueue.some(t => t.id === task.id)) {
            notificationQueue.push(task);
            showNextNotification();
        }
    }

    function showNextNotification() {
        if (notificationVisible || notificationQueue.length === 0) return;

        notificationVisible = true;
        const task = notificationQueue.shift();
        currentNotificationTaskId = task.id;
        
        const currentTheme = document.body.className;
        const characterSet = themedCharacters[currentTheme] || themedCharacters['default'];
        const character = characterSet[Math.floor(Math.random() * characterSet.length)];
        
        notificationTaskDesc.textContent = `Alert: ${task.desc}`;
        notificationSticker.src = character.sticker;
        notificationQuote.textContent = `"${character.quotes[0]}"`;
        
        notificationOverlay.style.display = 'flex';
        playSound();
    }

    function hideNotification() {
        notificationOverlay.style.display = 'none';
        notificationVisible = false;
        currentNotificationTaskId = null;
        setTimeout(showNextNotification, 500);
    }
    
    function snoozeNotification() {
        const task = tasks.find(t => t.id === currentNotificationTaskId);
        if (task) {
            scheduleAlert(task, Date.now() + 5 * 60 * 1000); // Snooze for 5 mins
        }
        hideNotification();
    }

    // --- UI & Utility Functions ---
    function setTemplate(templateName) {
        document.body.className = templateName;
        switch (templateName) {
            case 'template-one-piece':
                currentAlertSound = document.getElementById('alert-sound-one-piece');
                break;
            case 'template-jujutsu-kaisen':
                currentAlertSound = document.getElementById('alert-sound-jujutsu-kaisen');
                break;
            case 'template-demon-slayer':
                currentAlertSound = document.getElementById('alert-sound-demon-slayer');
                break;
            default:
                currentAlertSound = document.getElementById('alert-sound-default');
        }
    }
    
    function playSound() {
        if (currentAlertSound) {
            currentAlertSound.currentTime = 0;
            currentAlertSound.play().catch(e => console.error("Sound play failed:", e));
        }
    }

    // --- Event Listeners ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask(descInput.value, timeInput.value, categorySelect.value, repeatCheckbox.checked);
        form.reset();
    });

    templateSelector.addEventListener('change', (e) => setTemplate(e.target.value));
    
    editForm.addEventListener('submit', saveTaskChanges);
    editCancelBtn.addEventListener('click', closeEditModal);

    notificationSnoozeBtn.addEventListener('click', snoozeNotification);
    notificationDismissBtn.addEventListener('click', hideNotification);
    
    // --- Initialization ---
    function init() {
        loadTasks();
        renderTasks();
        setTemplate(templateSelector.value);
        scheduleAllAlerts(); // FIXED: Schedule alerts for all existing tasks on load
    }
    
    init();
})();