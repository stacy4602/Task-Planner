(() => {
    // --- 1. DOM ELEMENTS ---
    const animeGrid = document.getElementById('anime-card-grid');
    const modalOverlay = document.getElementById('anime-modal-overlay');
    const modalContent = document.getElementById('modal-content-inner');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const pageHeading = document.getElementById('page-heading');
    const genreSelect = document.getElementById('genre-select');

    // --- MY LIST + TASK INTEGRATION ---
    const MY_LIST_KEY = 'anime_world_my_list';
    const TASKS_KEY = 'anime_task_planner_tasks';

    function loadMyList() {
        try { return JSON.parse(localStorage.getItem(MY_LIST_KEY)) || []; }
        catch (_) { return []; }
    }
    function saveMyList(list) {
        try { localStorage.setItem(MY_LIST_KEY, JSON.stringify(list)); }
        catch (e) { console.error('Failed to save My List:', e); }
    }
    function findInMyList(malId) {
        return loadMyList().find(e => String(e.malId) === String(malId));
    }
    function upsertInMyList(entry) {
        const list = loadMyList();
        const idx = list.findIndex(e => String(e.malId) === String(entry.malId));
        if (idx >= 0) list[idx] = { ...list[idx], ...entry };
        else list.push(entry);
        saveMyList(list);
    }
    function removeFromMyList(malId) {
        saveMyList(loadMyList().filter(e => String(e.malId) !== String(malId)));
    }

    function addAnimeAsTask(title) {
        let tasks = [];
        try { tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || []; }
        catch (_) { tasks = []; }
        tasks.push({
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            desc: `Watch ${title}`,
            time: null,
            category: 'Anime World',
            completed: false,
            repeatDaily: false
        });
        try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); }
        catch (e) { console.error('Failed to save task:', e); }
    }

    // --- TOAST ---
    let toastTimer = null;
    function showToast(message) {
        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('visible');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // --- MY LIST MODAL CONTROLS ---
    function buildMyListControls(anime) {
        const container = document.createElement('div');
        container.className = 'my-list-controls';
        refreshMyListControls(container, anime);
        return container;
    }

    function refreshMyListControls(container, anime) {
        const malId = anime.mal_id;
        const title = anime.title_english || anime.title;
        const imageUrl = (anime.images && anime.images.jpg && anime.images.jpg.image_url) || '';
        const totalEpisodes = anime.episodes || null;
        const entry = findInMyList(malId);
        container.innerHTML = '';

        if (!entry) {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-to-list-btn';
            addBtn.textContent = '+ Add to My List';
            addBtn.addEventListener('click', () => {
                upsertInMyList({
                    malId,
                    title,
                    imageUrl,
                    totalEpisodes,
                    episodesWatched: 0,
                    status: 'planned',
                    addedAt: Date.now()
                });
                showToast(`Added "${title}" to My List`);
                refreshMyListControls(container, anime);
            });
            container.appendChild(addBtn);
        } else {
            // Status select
            const statusRow = document.createElement('div');
            statusRow.className = 'my-list-row my-list-status-row';
            const statusLabel = document.createElement('label');
            statusLabel.textContent = 'Status';
            const statusSelect = document.createElement('select');
            ['planned', 'watching', 'completed'].forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
                if (entry.status === s) opt.selected = true;
                statusSelect.appendChild(opt);
            });
            statusSelect.addEventListener('change', () => {
                entry.status = statusSelect.value;
                upsertInMyList(entry);
            });
            statusRow.appendChild(statusLabel);
            statusRow.appendChild(statusSelect);
            container.appendChild(statusRow);

            // Episode counter (only when total is known)
            if (totalEpisodes) {
                const epsRow = document.createElement('div');
                epsRow.className = 'my-list-row my-list-eps-row';
                const epsLabel = document.createElement('label');
                epsLabel.textContent = 'Episodes';
                const epsControls = document.createElement('div');
                epsControls.className = 'eps-controls';

                const minus = document.createElement('button');
                minus.type = 'button';
                minus.textContent = '−';
                const count = document.createElement('span');
                count.className = 'eps-count';
                count.textContent = `${entry.episodesWatched} / ${totalEpisodes}`;
                const plus = document.createElement('button');
                plus.type = 'button';
                plus.textContent = '+';

                const updateCount = (delta) => {
                    const next = Math.max(0, Math.min(totalEpisodes, (entry.episodesWatched || 0) + delta));
                    entry.episodesWatched = next;
                    if (next >= totalEpisodes) {
                        entry.status = 'completed';
                        statusSelect.value = 'completed';
                    } else if (next > 0 && entry.status === 'planned') {
                        entry.status = 'watching';
                        statusSelect.value = 'watching';
                    }
                    upsertInMyList(entry);
                    count.textContent = `${entry.episodesWatched} / ${totalEpisodes}`;
                };
                minus.addEventListener('click', () => updateCount(-1));
                plus.addEventListener('click', () => updateCount(1));

                epsControls.appendChild(minus);
                epsControls.appendChild(count);
                epsControls.appendChild(plus);
                epsRow.appendChild(epsLabel);
                epsRow.appendChild(epsControls);
                container.appendChild(epsRow);
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-from-list-btn';
            removeBtn.textContent = '✕ Remove from List';
            removeBtn.addEventListener('click', () => {
                removeFromMyList(malId);
                showToast(`Removed "${title}" from My List`);
                refreshMyListControls(container, anime);
            });
            container.appendChild(removeBtn);
        }

        // Always available: Add as Task
        const taskBtn = document.createElement('button');
        taskBtn.className = 'add-as-task-btn';
        taskBtn.textContent = '+ Add as Task';
        taskBtn.addEventListener('click', () => {
            addAnimeAsTask(title);
            showToast(`Added "Watch ${title}" to Task Planner`);
        });
        container.appendChild(taskBtn);
    }

    // --- 2. JIKAN API LOGIC ---

    // (fetchPopularAnime, fetchSearchedAnime, fetchAnimeByGenre, displayCards are unchanged)
    async function fetchPopularAnime() {
        animeGrid.innerHTML = '<p class="loading-text">Loading popular anime...</p>';
        pageHeading.textContent = 'Most Popular Anime';
        searchInput.value = ''; 
        try {
            const response = await fetch(`https://api.jikan.moe/v4/top/anime?filter=bypopularity&limit=25`);
            if (!response.ok) throw new Error(`Failed to fetch popular anime (Status: ${response.status})`);
            const data = await response.json();
            if (data.data && data.data.length > 0) {
               displayCards(data.data);
            } else {
               animeGrid.innerHTML = '<p class="loading-text">No popular anime found.</p>';
            }
        } catch (error) {
            console.error(error);
            animeGrid.innerHTML = '<p class="loading-text" style="color: #ff8a80;">Could not load popular anime. Please try again later.</p>';
        }
    }
    async function fetchSearchedAnime(query) {
        animeGrid.innerHTML = `<p class="loading-text">Searching for "${query}"...</p>`;
        pageHeading.textContent = `Search Results for "${query}"`;
        genreSelect.value = 'all'; 
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&sfw&limit=25`);
            if (!response.ok) throw new Error(`Failed to search (Status: ${response.status})`);
            const data = await response.json();
            displayCards(data.data);
        } catch (error) {
            console.error(error);
            animeGrid.innerHTML = `<p class="loading-text" style="color: #ff8a80;">Could not find results for "${query}".</p>`;
        }
    }
    async function fetchAnimeByGenre(genreId, genreName) {
        animeGrid.innerHTML = `<p class="loading-text">Loading popular anime in ${genreName}...</p>`;
        pageHeading.textContent = `Popular ${genreName} Anime`;
        searchInput.value = ''; 
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime?genres=${genreId}&order_by=popularity&sfw&limit=25`);
            if (!response.ok) throw new Error(`Failed to fetch genre (Status: ${response.status})`);
            const data = await response.json();
            displayCards(data.data);
        } catch (error) {
            console.error(error);
            animeGrid.innerHTML = `<p class="loading-text" style="color: #ff8a80;">Could not load anime for ${genreName}.</p>`;
        }
    }
    function displayCards(animeList) {
        animeGrid.innerHTML = ''; 
        if (!animeList || animeList.length === 0) {
            animeGrid.innerHTML = '<p class="loading-text">No anime found.</p>';
            return;
        }
        animeList.forEach(animeEntry => { 
            const title = animeEntry.title_english || animeEntry.title; 
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.dataset.id = animeEntry.mal_id;
            card.innerHTML = `
                <img src="${animeEntry.images.jpg.image_url}" alt="${title}">
                <div class="anime-card-title">${title}</div>
            `;
            card.addEventListener('click', () => openAnimeModal(animeEntry.mal_id));
            animeGrid.appendChild(card);
        });
    }

    // (openAnimeModal is unchanged)
    async function openAnimeModal(animeId) {
        modalOverlay.style.display = 'flex';
        modalContent.innerHTML = '<p class="loading-text">Loading details...</p>';
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/full`);
            if (!response.ok) throw new Error(`Failed to fetch details (Status: ${response.status})`);
            const fullData = await response.json();
            populateModal(fullData.data);
            fetchAndDisplayTrailer(animeId, fullData.data);
            fetchAndDisplayRecommendations(animeId);
        } catch (error) {
            console.error("Critical Error:", error);
            modalContent.innerHTML = `<p class="loading-text" style="color: #ff8a80;">Could not load details. <br> (Error: ${error.message})</p>`;
        }
    }
    
    // (capitalizeFirstLetter, getTrailerData, findBestTrailerEmbedUrl are unchanged)
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    function getTrailerData(embedUrl) {
        if (!embedUrl) return null;
        try {
            const url = new URL(embedUrl);
            const videoId = url.pathname.split('/')[2];
            if (videoId) {
                return {
                    watchUrl: `https://www.youtube.com/watch?v=${videoId}&cc_load_policy=1&cc_lang_pref=en&hl=en`,
                    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                };
            }
            return null;
        } catch (error) {
            console.error("Invalid embed URL:", error);
            return null;
        }
    }
    function findBestTrailerEmbedUrl(anime, videos) {
        if (anime.trailer && anime.trailer.embed_url) {
            return anime.trailer.embed_url;
        }
        if (videos && videos.promo && videos.promo.length > 0) {
            const anyPromo = videos.promo.find(pv => pv.trailer.embed_url);
            if (anyPromo) {
                return anyPromo.trailer.embed_url;
            }
        }
        if (videos && videos.music_videos && videos.music_videos.length > 0) {
            const anyMV = videos.music_videos.find(mv => mv.video.embed_url);
             if (anyMV) {
                return anyMV.video.embed_url;
            }
        }
        return null; 
    }

    // (fetchAndDisplayTrailer is unchanged)
    async function fetchAndDisplayTrailer(animeId, anime) {
        const placeholder = document.getElementById('trailer-placeholder');
        try {
            const videosResponse = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/videos`);
            if (!videosResponse.ok) throw new Error('Videos not found');
            const videosData = await videosResponse.json();
            const bestEmbedUrl = findBestTrailerEmbedUrl(anime, videosData.data);
            const trailerData = getTrailerData(bestEmbedUrl);
            let trailerHtml = '<p class="no-trailer">No trailer available.</p>';
            if (trailerData) {
                trailerHtml = `
                    <a href="${trailerData.watchUrl}" target="_blank" rel="noopener noreferrer" class="trailer-thumbnail">
                        <img src="${trailerData.thumbnailUrl}" alt="Anime Trailer Thumbnail">
                        <div class="play-icon">►</div>
                    </a>
                `;
            }
            if (placeholder) placeholder.innerHTML = trailerHtml;
        } catch (error) {
            console.log("Could not load trailer:", error.message);
            if (placeholder) placeholder.innerHTML = '<p class="no-trailer">No trailer available.</p>';
        }
    }

    /**
     * NEW: Card builder for "Collection".
     * Uses 'entry.name' and no image.
     */
    function createCollectionCardHtml(animeEntry, typeInfo = '') {
        const title = animeEntry.name; // <-- FIX for "undefined"
        const imageHtml = `<div class="mini-card-no-image">?</div>`; // No images available

        return `
            <div class="mini-card collection-card" data-id="${animeEntry.mal_id}">
                ${imageHtml}
                <div class="mini-card-overlay">
                    ${typeInfo ? `<span class="mini-card-type-info">${typeInfo}</span>` : ''}
                    <p class="mini-card-title">${title}</p>
                </div>
            </div>
        `;
    }

    /**
     * NEW: Card builder for "Recommendations".
     * Uses 'entry.title' and has an image.
     */
    function createRecommendationCardHtml(animeEntry, typeInfo = '') {
        const title = animeEntry.title_english || animeEntry.title;
        let imageHtml = '';
        if (animeEntry.images && animeEntry.images.jpg) {
            imageHtml = `<img src="${animeEntry.images.jpg.image_url}" alt="${title}">`;
        } else {
            imageHtml = `<div class="mini-card-no-image">?</div>`;
        }

        return `
            <div class="mini-card recommendation-card" data-id="${animeEntry.mal_id}">
                ${imageHtml}
                <div class="mini-card-overlay">
                    ${typeInfo ? `<span class="mini-card-type-info">${typeInfo}</span>` : ''}
                    <p class="mini-card-title">${title}</p>
                </div>
            </div>
        `;
    }
    
    // (buildCollectionHtml is updated to use the new card builder)
    function buildCollectionHtml(relations) {
        if (!relations || relations.length === 0) return '';
        let cardsHtml = '';
        relations.forEach(relation => {
            const relevantRelations = ["Sequel", "Prequel", "Side story", "Parent story", "Adaptation", "Alternative version"];
            if (relevantRelations.includes(relation.relation)) {
                relation.entry.forEach(entry => {
                    let typeInfo = entry.type === 'TV' ? 'TV' : (entry.type === 'Movie' ? 'Movie' : relation.relation);
                    cardsHtml += createCollectionCardHtml(entry, typeInfo);
                });
            }
        });
        if (cardsHtml === '') return '';
        return `
            <div class="modal-section" id="collection-section">
                <h3>Collection</h3> 
                <div class="mini-card-grid">${cardsHtml}</div>
            </div>
        `;
    }
    
    // (buildRecommendationsHtml is updated to use the new card builder)
    function buildRecommendationsHtml(recommendations) {
        if (!recommendations || recommendations.length === 0) return '';
        let cardsHtml = '';
        recommendations.slice(0, 10).forEach(rec => {
            const entry = rec.entry;
            const typeInfo = entry.type || '';
            cardsHtml += createRecommendationCardHtml(entry, typeInfo);
        });
        return `
            <div class="modal-section" id="recommendations-section">
                <h3>More Like This</h3>
                <div class="recommendations-grid-scroll">${cardsHtml}</div>
            </div>
        `;
    }
    
    // (fetchAndDisplayRecommendations is unchanged)
    async function fetchAndDisplayRecommendations(animeId) {
        const placeholder = document.getElementById('recommendations-placeholder');
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/recommendations`);
            if (!response.ok) throw new Error('No recommendations found');
            const recommendationsData = await response.json();
            const recommendationsHtml = buildRecommendationsHtml(recommendationsData.data);
            if (placeholder && recommendationsHtml) {
                placeholder.innerHTML = recommendationsHtml;
                // Add event listeners
                placeholder.querySelectorAll('.recommendation-card').forEach(card => {
                    card.addEventListener('click', (event) => {
                        event.stopPropagation();
                        openAnimeModal(card.dataset.id);
                    });
                });
            }
        } catch (error) {
            console.log("Could not load recommendations:", error.message);
        }
    }

    /**
     * UPDATED: The HTML structure is now correct.
     * Trailer, Related, and Recommendations are placed *outside* the details div.
     */
    function populateModal(anime) {
        const title = anime.title_english || anime.title;
        const genres = anime.genres.map(g => g.name).join(', ');
        const rating = anime.rating || 'N/A';
        const status = anime.status || 'N/A';
        const score = anime.score ? `⭐ ${anime.score}` : 'N/A';
        const rank = anime.rank ? `#${anime.rank}` : 'N/A';
        const popularity = anime.popularity ? `#${anime.popularity}` : 'N/A';
        const episodes = anime.episodes ? `${anime.episodes}` : 'N/A';
        const type = anime.type || 'N/A';
        const airedDate = anime.aired.string || 'N/A';
        const studios = anime.studios.map(s => s.name).join(', ') || 'N/A';
        
        // This data is in the /full endpoint, so we can build it now.
        const relatedHtml = buildCollectionHtml(anime.relations);

        modalContent.innerHTML = `
            <div id="modal-image-container">
                <img src="${anime.images.jpg.large_image_url}" alt="${title}" id="modal-image">
                <div id="my-list-controls-mount"></div>
            </div>

            <div id="modal-details">
                <h3 id="modal-title">${title}</h3>
                <div class="modal-info-bar">
                    <span class="modal-score">${score}</span>
                    <span>${status}</span>
                    <span class="modal-rating">${rating}</span>
                </div>
                <div class="modal-stats-bar">
                    <div class="stats-item">
                        <h4>${rank}</h4>
                        <p>Rank</p>
                    </div>
                    <div class="stats-item">
                        <h4>${popularity}</h4>
                        <p>Popularity</p>
                    </div>
                    <div class="stats-item">
                        <h4>${episodes}</h4>
                        <p>Episodes</p>
                    </div>
                </div>

                <p id="modal-genres"><strong>Genres:</strong> ${genres || 'N/A'}</p>
                <p id="modal-synopsis">${anime.synopsis || 'No synopsis available.'}</p>

                <ul class="modal-info-list">
                    <li>Type: <span>${type}</span></li>
                    <li>Aired: <span>${airedDate}</span></li>
                    <li>Studios: <span>${studios}</span></li>
                </ul>
            </div>
            
            <div id="trailer-placeholder" class="modal-section-full-width">
                <p class="no-trailer">Loading trailer...</p>
            </div>
            
            ${relatedHtml} 
            
            <div id="recommendations-placeholder" class="modal-section-full-width">
                </div>
        `;
        
        // Mount the My List / Task controls
        const controlsMount = modalContent.querySelector('#my-list-controls-mount');
        if (controlsMount) {
            controlsMount.replaceWith(buildMyListControls(anime));
        }

        // Add listeners for the COLLECTION cards we just added
        modalContent.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (event) => {
                event.stopPropagation();
                openAnimeModal(card.dataset.id);
            });
        });
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
        modalContent.innerHTML = '';
    }

    // --- 4. INITIALIZATION ---
    // (This entire section is unchanged)
    function populateGenres() {
        const curatedGenres = [
            { id: 1, name: "Action" }, { id: 2, name: "Adventure" }, { id: 46, name: "Award Winning" },
            { id: 4, name: "Comedy" }, { id: 8, name: "Drama" }, { id: 10, name: "Fantasy" },
            { id: 22, name: "Romance" }, { id: 36, name: "Slice of Life" }, { id: 37, name: "Supernatural" },
            { id: 24, name: "Sci-Fi" }, { id: 7, name: "Mystery" }, { id: 14, name: "Horror" },
            { id: 41, name: "Thriller" }, { id: 40, name: "Psychological" }, { id: 27, name: "Shounen" },
            { id: 25, name: "Shoujo" }, { id: 42, name: "Seinen" }, { id: 43, name: "Josei" }, { id: 15, name: "Kids" }
        ];
        curatedGenres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.id;
            option.textContent = genre.name;
            genreSelect.appendChild(option);
        });
    }
    function init() {
        populateGenres();
        fetchPopularAnime();

        const animeIdFromUrl = new URLSearchParams(window.location.search).get('anime');
        if (animeIdFromUrl) openAnimeModal(animeIdFromUrl);

        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const searchTerm = searchInput.value.trim();
            if (searchTerm) {
                fetchSearchedAnime(searchTerm);
            } else {
                fetchPopularAnime();
                genreSelect.value = 'all'; 
            }
        });
        genreSelect.addEventListener('change', (e) => {
            const genreId = e.target.value;
            if (genreId === 'all') {
                fetchPopularAnime();
            } else {
                const genreName = e.target.options[e.target.selectedIndex].text;
                fetchAnimeByGenre(genreId, genreName);
            }
        });
        modalCloseBtn.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    init();
})();