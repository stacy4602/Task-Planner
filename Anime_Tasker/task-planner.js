(() => {
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

    const editModalOverlay = document.getElementById('edit-modal-overlay');
    const editForm = document.getElementById('edit-task-form');
    const editDescInput = document.getElementById('edit-task-desc');
    const editTaskTimeInput = document.getElementById('edit-task-time');
    const editTaskCategorySelect = document.getElementById('edit-task-category');
    const editCancelBtn = document.getElementById('edit-modal-cancel');

    const alertSound = document.getElementById('alert-sound');

    const STORAGE_KEY = 'anime_task_planner_tasks';
    const THEME_STORAGE_KEY = 'anime_world_theme';
    let tasks = [];
    let currentEditingTaskId = null;

    let notificationQueue = [];
    let notificationVisible = false;
    let currentNotificationTaskId = null;
    let alertTimeoutIds = new Map();

    // Only contains entries for themes whose sticker assets actually exist.
    // Other themes fall back to `default`.
    const themedCharacters = {
        'template-one-piece': [
            { name: 'Luffy', quotes: ["I'm gonna be King of the Pirates!", "Meat!"], sticker: 'assets/characters/luffy1.gif' },
            { name: 'Zoro', quotes: ["Nothing happened.", "If I can't even protect my captain's dream, then my ambition is just talk!"], sticker: 'assets/characters/luffy2.gif' }
        ],
        'template-jujutsu-kaisen': [
            { name: 'Gojo Satoru', quotes: ["Throughout Heaven and Earth, I alone am the honored one.", "Nah, I'd win."], sticker: 'assets/characters/gojo.gif' }
        ],
        'default': [
            { name: 'Sailor Moon', quotes: ["In the name of the moon, I'll punish you!"], sticker: 'assets/characters/sailormoon1.gif' },
            { name: 'Dazai', quotes: ["A good book is always good.", "I want to die."], sticker: 'assets/characters/dazai.gif' }
        ]
    };

    function formatTaskTime(timestamp) {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    }

    function toDateTimeLocalString(timestamp) {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    function saveTasks() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { console.error('Failed to save tasks:', e); }
    }
    function loadTasks() {
        try { tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { tasks = []; }
    }

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

                const details = document.createElement('div');
                details.className = 'task-details';

                const descEl = document.createElement('span');
                descEl.className = 'task-desc';
                descEl.textContent = task.desc;

                const timeEl = document.createElement('span');
                timeEl.className = 'task-time';
                timeEl.textContent = formatTaskTime(task.time);

                details.appendChild(descEl);
                details.appendChild(timeEl);

                const actions = document.createElement('div');
                actions.className = 'task-actions';

                const editBtn = document.createElement('button');
                editBtn.title = 'Edit task';
                editBtn.textContent = '✎';
                editBtn.addEventListener('click', () => openEditModal(task.id));

                const completeBtn = document.createElement('button');
                completeBtn.title = 'Complete task';
                completeBtn.textContent = task.completed ? '↻' : '✔';
                completeBtn.addEventListener('click', () => toggleComplete(task.id));

                const deleteBtn = document.createElement('button');
                deleteBtn.title = 'Delete task';
                deleteBtn.textContent = '✕';
                deleteBtn.addEventListener('click', () => deleteTask(task.id));

                actions.appendChild(editBtn);
                actions.appendChild(completeBtn);
                actions.appendChild(deleteBtn);

                taskEl.appendChild(details);
                taskEl.appendChild(actions);
                container.appendChild(taskEl);
            });
        });
    }

    function addTask(desc, time, category, repeatDaily) {
        const trimmed = desc.trim();
        if (!trimmed) return;

        const newTask = {
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            desc: trimmed,
            time: time ? new Date(time).getTime() : null,
            category,
            completed: false,
            repeatDaily
        };
        tasks.push(newTask);
        saveTasks();
        renderTasks();
        scheduleAlert(newTask);
    }

    function toggleComplete(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
            scheduleAllAlerts();
        }
    }

    function deleteTask(id) {
        if (confirm("Are you sure you want to delete this task?")) {
            clearScheduledAlert(id);
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
        }
    }

    function openEditModal(id) {
        currentEditingTaskId = id;
        const task = tasks.find(t => t.id === id);
        if (task) {
            editDescInput.value = task.desc;
            editTaskTimeInput.value = toDateTimeLocalString(task.time);
            editTaskCategorySelect.value = task.category;

            editModalOverlay.style.display = 'flex';
            editModalOverlay.setAttribute('aria-hidden', 'false');
            editDescInput.focus();
        }
    }

    function closeEditModal() {
        editModalOverlay.style.display = 'none';
        editModalOverlay.setAttribute('aria-hidden', 'true');
        currentEditingTaskId = null;
    }

    function saveTaskChanges(e) {
        e.preventDefault();
        const task = tasks.find(t => t.id === currentEditingTaskId);
        if (task) {
            const trimmed = editDescInput.value.trim();
            if (!trimmed) return;

            task.desc = trimmed;
            const newTimeVal = editTaskTimeInput.value;
            task.time = newTimeVal ? new Date(newTimeVal).getTime() : null;
            task.category = editTaskCategorySelect.value;

            saveTasks();
            renderTasks();
            scheduleAllAlerts();
        }
        closeEditModal();
    }

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
                if (task.repeatDaily) scheduleAlert(task);
            }, delay);
            alertTimeoutIds.set(task.id, timeoutId);
        }
    }

    function scheduleAllAlerts() {
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
        const quote = character.quotes[Math.floor(Math.random() * character.quotes.length)];

        notificationTaskDesc.textContent = `Alert: ${task.desc}`;
        notificationSticker.src = character.sticker;
        notificationSticker.alt = character.name;
        notificationQuote.textContent = `"${quote}"`;

        notificationOverlay.style.display = 'flex';
        notificationOverlay.setAttribute('aria-hidden', 'false');
        playSound();
    }

    function hideNotification() {
        notificationOverlay.style.display = 'none';
        notificationOverlay.setAttribute('aria-hidden', 'true');
        notificationVisible = false;
        currentNotificationTaskId = null;
        setTimeout(showNextNotification, 500);
    }

    function snoozeNotification() {
        const task = tasks.find(t => t.id === currentNotificationTaskId);
        if (task) {
            scheduleAlert(task, Date.now() + 5 * 60 * 1000);
        }
        hideNotification();
    }

    function setTemplate(templateName) {
        document.body.className = templateName;
        templateSelector.value = templateName;
        try { localStorage.setItem(THEME_STORAGE_KEY, templateName); } catch (_) { /* storage unavailable */ }
    }

    function loadSavedTheme() {
        try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (_) { return null; }
    }

    function playSound() {
        if (alertSound) {
            alertSound.currentTime = 0;
            alertSound.play().catch(e => console.error("Sound play failed:", e));
        }
    }

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

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (editModalOverlay.style.display === 'flex') closeEditModal();
        else if (notificationOverlay.style.display === 'flex') hideNotification();
    });

    function init() {
        loadTasks();
        renderTasks();
        const saved = loadSavedTheme();
        setTemplate(saved || templateSelector.value);
        scheduleAllAlerts();
    }

    init();
})();
