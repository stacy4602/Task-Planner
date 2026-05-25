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

    templateSelector.addEventListener('change', (e) => setTemplate(e.target.value));

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
        const saved = loadSavedTheme();
        setTemplate(saved || templateSelector.value);
        fetchTopAnime();
    }

    init();
})();
