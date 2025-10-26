(() => {
    // --- 1. THEME SWITCHING ---
    const templateSelector = document.getElementById('template-selector');

    /**
     * Applies the selected theme class to the body.
     * @param {string} templateName - The class name of the theme to apply.
     */
    function setTemplate(templateName) {
        document.body.className = templateName;
    }

    templateSelector.addEventListener('change', (e) => {
        setTemplate(e.target.value);
    });

    // --- 2. JIKAN API FETCHING ---
    const animeListContainer = document.getElementById('anime-list-container');

    /**
     * Fetches top anime from Jikan and populates the list.
     */
    async function fetchTopAnime() {
        try {
            const response = await fetch('https://api.jikan.moe/v4/top/anime');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();

            animeListContainer.innerHTML = '';

            data.data.forEach(anime => {
                // UPDATED: Use English title, fall back to default title
                const title = anime.title_english || anime.title;

                const animeItem = document.createElement('div');
                animeItem.className = 'anime-item';
                
                animeItem.innerHTML = `
                    <span class="anime-rank">#${anime.rank}</span>
                    <img src="${anime.images.jpg.image_url}" alt="${title}">
                    <div class="anime-details">
                        <h4>${title}</h4>
                        <span class="anime-score">⭐ ${anime.score}</span>
                    </div>
                `;
                
                animeListContainer.appendChild(animeItem);
            });

        } catch (error) {
            console.error("Failed to fetch top anime:", error);
            animeListContainer.innerHTML = '<p class="error-text">Could not load top anime. Please try again later.</p>';
        }
    }

    /**
     * Initializes the homescreen
     */
    function init() {
        setTemplate(templateSelector.value);
        fetchTopAnime();
    }

    init();

})();