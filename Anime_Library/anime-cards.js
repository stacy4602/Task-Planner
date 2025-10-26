(() => {
    // --- 1. DOM ELEMENTS ---
    const templateSelector = document.getElementById('template-selector');
    const animeGrid = document.getElementById('anime-card-grid');
    const modalOverlay = document.getElementById('anime-modal-overlay');
    const modalContent = document.getElementById('modal-content-inner');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // --- 2. THEME SWITCHING ---
    function setTemplate(templateName) {
        document.body.className = templateName;
    }
    templateSelector.addEventListener('change', (e) => setTemplate(e.target.value));

    // --- 3. JIKAN API LOGIC ---

    /**
     * Fetches the currently airing anime and displays them as cards.
     */
    async function fetchAndDisplayAnime() {
        try {
            const response = await fetch('https://api.jikan.moe/v4/seasons/now');
            if (!response.ok) throw new Error('Failed to fetch seasonal anime');
            
            const data = await response.json();
            animeGrid.innerHTML = ''; 

            data.data.forEach(anime => {
                // UPDATED: Use English title, fall back to default title
                const title = anime.title_english || anime.title;
                
                const card = document.createElement('div');
                card.className = 'anime-card';
                card.dataset.id = anime.mal_id;
                
                card.innerHTML = `
                    <img src="${anime.images.jpg.image_url}" alt="${title}">
                    <div class="anime-card-title">${title}</div>
                `;
                
                card.addEventListener('click', () => openAnimeModal(anime.mal_id));
                animeGrid.appendChild(card);
            });

        } catch (error) {
            console.error(error);
            animeGrid.innerHTML = '<p class="loading-text" style="color: #ff8a80;">Could not load anime. Please try again later.</p>';
        }
    }

    /**
     * Shows the modal and fetches the full details for a specific anime.
     */
    async function openAnimeModal(animeId) {
        modalOverlay.style.display = 'flex';
        modalContent.innerHTML = '<p class="loading-text">Loading details...</p>';

        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/full`);
            if (!response.ok) throw new Error('Failed to fetch anime details');
            
            const data = await response.json();
            populateModal(data.data);
        
        } catch (error) {
            console.error(error);
            modalContent.innerHTML = '<p class="loading-text" style="color: #ff8a80;">Could not load details.</p>';
        }
    }

    /**
     * Fills the modal with the fetched anime details.
     */
    function populateModal(anime) {
        // UPDATED: Use English title, fall back to default title
        const title = anime.title_english || anime.title;
        const genres = anime.genres.map(g => g.name).join(', ');

        modalContent.innerHTML = `
            <img src="${anime.images.jpg.large_image_url}" alt="${title}" id="modal-image">
            <div id="modal-details">
                <h3 id="modal-title">${title}</h3>
                <div class="modal-info-bar">
                    <span>⭐ ${anime.score || 'N/A'}</span>
                    <span>${anime.status || 'N/A'}</span>
                </div>
                <p id="modal-genres"><strong>Genres:</strong> ${genres || 'N/A'}</p>
                <p id="modal-synopsis">${anime.synopsis || 'No synopsis available.'}</p>
            </div>
        `;
    }

    /**
     * Closes the modal.
     */
    function closeModal() {
        modalOverlay.style.display = 'none';
        modalContent.innerHTML = '';
    }

    // --- 4. INITIALIZATION ---
    function init() {
        setTemplate(templateSelector.value);
        fetchAndDisplayAnime();
        
        modalCloseBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    init();
})();