(() => {
    const THEME_STORAGE_KEY = 'anime_world_theme';
    const templateSelector = document.getElementById('template-selector');
    const animeListContainer = document.getElementById('anime-list-container');

    function setTemplate(templateName) {
        document.body.className = templateName;
        templateSelector.value = templateName;
        try { localStorage.setItem(THEME_STORAGE_KEY, templateName); } catch (_) { /* storage unavailable */ }
    }

    function loadSavedTheme() {
        try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (_) { return null; }
    }

    // --- MY LIST RENDERING ---
    const MY_LIST_KEY = 'anime_world_my_list';
    const myListContainer = document.getElementById('my-list-container');

    function loadMyList() {
        try { return JSON.parse(localStorage.getItem(MY_LIST_KEY)) || []; }
        catch (_) { return []; }
    }

    function renderMyList() {
        const list = loadMyList();
        myListContainer.innerHTML = '';

        if (list.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'loading-text';
            empty.textContent = 'No anime saved yet. Visit the Anime Library to add some!';
            myListContainer.appendChild(empty);
            return;
        }

        list.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).forEach(entry => {
            const item = document.createElement('a');
            item.href = `Anime_Library/anime-cards.html?anime=${encodeURIComponent(entry.malId)}`;
            item.className = 'my-list-item';

            const img = document.createElement('img');
            img.src = entry.imageUrl || '';
            img.alt = entry.title || '';
            img.loading = 'lazy';

            const details = document.createElement('div');
            details.className = 'my-list-details';

            const titleEl = document.createElement('h4');
            titleEl.textContent = entry.title || 'Unknown';

            const meta = document.createElement('div');
            meta.className = 'my-list-meta';

            const status = entry.status || 'planned';
            const badge = document.createElement('span');
            badge.className = `status-badge status-${status}`;
            badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            meta.appendChild(badge);

            if (entry.totalEpisodes) {
                const eps = document.createElement('span');
                eps.className = 'eps-info';
                eps.textContent = `${entry.episodesWatched || 0} / ${entry.totalEpisodes} eps`;
                meta.appendChild(eps);
            }

            details.appendChild(titleEl);
            details.appendChild(meta);

            item.appendChild(img);
            item.appendChild(details);
            myListContainer.appendChild(item);
        });
    }

    // --- TABS ---
    function setupTabs() {
        const tabs = document.querySelectorAll('.right-panel-tabs .tab');
        const panels = document.querySelectorAll('.tab-panel');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                panels.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                const target = document.getElementById(`tab-${tab.dataset.tab}`);
                if (target) target.classList.add('active');
                if (tab.dataset.tab === 'mylist') renderMyList();
            });
        });
    }

    // --- 2. JIKAN API FETCHING ---
    const animeListContainer = document.getElementById('anime-list-container');

    async function fetchTopAnime() {
        try {
            const response = await fetch('https://api.jikan.moe/v4/top/anime');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();

            animeListContainer.innerHTML = '';

            data.data.forEach(anime => {
                const title = anime.title_english || anime.title || 'Unknown';

                const animeItem = document.createElement('div');
                animeItem.className = 'anime-item';

                const rank = document.createElement('span');
                rank.className = 'anime-rank';
                rank.textContent = anime.rank ? `#${anime.rank}` : '—';

                const img = document.createElement('img');
                img.src = anime.images?.jpg?.image_url || '';
                img.alt = title;
                img.loading = 'lazy';

                const details = document.createElement('div');
                details.className = 'anime-details';

                const h4 = document.createElement('h4');
                h4.textContent = title;

                const score = document.createElement('span');
                score.className = 'anime-score';
                score.textContent = `⭐ ${anime.score ?? 'N/A'}`;

                details.appendChild(h4);
                details.appendChild(score);
                animeItem.appendChild(rank);
                animeItem.appendChild(img);
                animeItem.appendChild(details);
                animeListContainer.appendChild(animeItem);
            });

        } catch (error) {
            console.error("Failed to fetch top anime:", error);
            animeListContainer.innerHTML = '';
            const errorEl = document.createElement('p');
            errorEl.className = 'error-text';
            errorEl.textContent = 'Could not load top anime. Please try again later.';
            animeListContainer.appendChild(errorEl);
        }
    }

    function init() {
        setTemplate(templateSelector.value);
        setupTabs();
        renderMyList();
        fetchTopAnime();
    }

    init();
})();
