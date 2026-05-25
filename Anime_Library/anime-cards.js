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

    // --- UTILITY: HTML escape for safely interpolating values into innerHTML templates ---
    function escapeHtml(value) {
        if (value == null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // --- 2. JIKAN API LOGIC ---

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
        animeGrid.innerHTML = '';
        const loading = document.createElement('p');
        loading.className = 'loading-text';
        loading.textContent = `Searching for "${query}"...`;
        animeGrid.appendChild(loading);
        pageHeading.textContent = `Search Results for "${query}"`;
        genreSelect.value = 'all';
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&sfw&limit=25`);
            if (!response.ok) throw new Error(`Failed to search (Status: ${response.status})`);
            const data = await response.json();
            displayCards(data.data);
        } catch (error) {
            console.error(error);
            animeGrid.innerHTML = '';
            const errEl = document.createElement('p');
            errEl.className = 'loading-text';
            errEl.style.color = '#ff8a80';
            errEl.textContent = `Could not find results for "${query}".`;
            animeGrid.appendChild(errEl);
        }
    }
    async function fetchAnimeByGenre(genreId, genreName) {
        animeGrid.innerHTML = '';
        const loading = document.createElement('p');
        loading.className = 'loading-text';
        loading.textContent = `Loading popular anime in ${genreName}...`;
        animeGrid.appendChild(loading);
        pageHeading.textContent = `Popular ${genreName} Anime`;
        searchInput.value = '';
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime?genres=${genreId}&order_by=popularity&sfw&limit=25`);
            if (!response.ok) throw new Error(`Failed to fetch genre (Status: ${response.status})`);
            const data = await response.json();
            displayCards(data.data);
        } catch (error) {
            console.error(error);
            animeGrid.innerHTML = '';
            const errEl = document.createElement('p');
            errEl.className = 'loading-text';
            errEl.style.color = '#ff8a80';
            errEl.textContent = `Could not load anime for ${genreName}.`;
            animeGrid.appendChild(errEl);
        }
    }
    function displayCards(animeList) {
        animeGrid.innerHTML = '';
        if (!animeList || animeList.length === 0) {
            animeGrid.innerHTML = '<p class="loading-text">No anime found.</p>';
            return;
        }
        animeList.forEach(animeEntry => {
            const title = animeEntry.title_english || animeEntry.title || 'Unknown';
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.dataset.id = animeEntry.mal_id;

            const img = document.createElement('img');
            img.src = animeEntry.images?.jpg?.image_url || '';
            img.alt = title;
            img.loading = 'lazy';

            const titleEl = document.createElement('div');
            titleEl.className = 'anime-card-title';
            titleEl.textContent = title;

            card.appendChild(img);
            card.appendChild(titleEl);
            card.addEventListener('click', () => openAnimeModal(animeEntry.mal_id));
            animeGrid.appendChild(card);
        });
    }

    async function openAnimeModal(animeId) {
        modalOverlay.style.display = 'flex';
        modalOverlay.setAttribute('aria-hidden', 'false');
        modalContent.innerHTML = '<p class="loading-text">Loading details...</p>';
        modalCloseBtn.focus();
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/full`);
            if (!response.ok) throw new Error(`Failed to fetch details (Status: ${response.status})`);
            const fullData = await response.json();
            populateModal(fullData.data);
            fetchAndDisplayTrailer(animeId, fullData.data);
            fetchAndDisplayRecommendations(animeId);
        } catch (error) {
            console.error("Critical Error:", error);
            modalContent.innerHTML = '';
            const errEl = document.createElement('p');
            errEl.className = 'loading-text';
            errEl.style.color = '#ff8a80';
            errEl.textContent = `Could not load details. (Error: ${error.message})`;
            modalContent.appendChild(errEl);
        }
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

    async function fetchAndDisplayTrailer(animeId, anime) {
        const placeholder = document.getElementById('trailer-placeholder');
        if (!placeholder) return;
        try {
            const videosResponse = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/videos`);
            if (!videosResponse.ok) throw new Error('Videos not found');
            const videosData = await videosResponse.json();
            const bestEmbedUrl = findBestTrailerEmbedUrl(anime, videosData.data);
            const trailerData = getTrailerData(bestEmbedUrl);
            placeholder.innerHTML = '';
            if (trailerData) {
                const link = document.createElement('a');
                link.href = trailerData.watchUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'trailer-thumbnail';
                const thumb = document.createElement('img');
                thumb.src = trailerData.thumbnailUrl;
                thumb.alt = 'Anime Trailer Thumbnail';
                thumb.loading = 'lazy';
                const playIcon = document.createElement('div');
                playIcon.className = 'play-icon';
                playIcon.textContent = '►';
                link.appendChild(thumb);
                link.appendChild(playIcon);
                placeholder.appendChild(link);
            } else {
                const msg = document.createElement('p');
                msg.className = 'no-trailer';
                msg.textContent = 'No trailer available.';
                placeholder.appendChild(msg);
            }
        } catch (error) {
            console.log("Could not load trailer:", error.message);
            placeholder.innerHTML = '';
            const msg = document.createElement('p');
            msg.className = 'no-trailer';
            msg.textContent = 'No trailer available.';
            placeholder.appendChild(msg);
        }
    }

    function createCollectionCardHtml(animeEntry, typeInfo = '') {
        const title = escapeHtml(animeEntry.name);
        const malId = escapeHtml(animeEntry.mal_id);
        const typeHtml = typeInfo ? `<span class="mini-card-type-info">${escapeHtml(typeInfo)}</span>` : '';
        return `
            <div class="mini-card collection-card" data-id="${malId}">
                <div class="mini-card-no-image">?</div>
                <div class="mini-card-overlay">
                    ${typeHtml}
                    <p class="mini-card-title">${title}</p>
                </div>
            </div>
        `;
    }

    function createRecommendationCardHtml(animeEntry, typeInfo = '') {
        const title = escapeHtml(animeEntry.title_english || animeEntry.title);
        const malId = escapeHtml(animeEntry.mal_id);
        const typeHtml = typeInfo ? `<span class="mini-card-type-info">${escapeHtml(typeInfo)}</span>` : '';
        let imageHtml;
        if (animeEntry.images && animeEntry.images.jpg) {
            const imgUrl = escapeHtml(animeEntry.images.jpg.image_url);
            imageHtml = `<img src="${imgUrl}" alt="${title}" loading="lazy">`;
        } else {
            imageHtml = `<div class="mini-card-no-image">?</div>`;
        }
        return `
            <div class="mini-card recommendation-card" data-id="${malId}">
                ${imageHtml}
                <div class="mini-card-overlay">
                    ${typeHtml}
                    <p class="mini-card-title">${title}</p>
                </div>
            </div>
        `;
    }

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

    async function fetchAndDisplayRecommendations(animeId) {
        const placeholder = document.getElementById('recommendations-placeholder');
        if (!placeholder) return;
        try {
            const response = await fetch(`https://api.jikan.moe/v4/anime/${animeId}/recommendations`);
            if (!response.ok) throw new Error('No recommendations found');
            const recommendationsData = await response.json();
            const recommendationsHtml = buildRecommendationsHtml(recommendationsData.data);
            if (recommendationsHtml) {
                placeholder.innerHTML = recommendationsHtml;
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

    function populateModal(anime) {
        const title = escapeHtml(anime.title_english || anime.title);
        const genres = escapeHtml((anime.genres || []).map(g => g.name).join(', '));
        const rating = escapeHtml(anime.rating || 'N/A');
        const status = escapeHtml(anime.status || 'N/A');
        const score = anime.score ? `⭐ ${escapeHtml(anime.score)}` : 'N/A';
        const rank = anime.rank ? `#${escapeHtml(anime.rank)}` : 'N/A';
        const popularity = anime.popularity ? `#${escapeHtml(anime.popularity)}` : 'N/A';
        const episodes = anime.episodes ? escapeHtml(anime.episodes) : 'N/A';
        const type = escapeHtml(anime.type || 'N/A');
        const airedDate = escapeHtml((anime.aired && anime.aired.string) || 'N/A');
        const studios = escapeHtml((anime.studios || []).map(s => s.name).join(', ') || 'N/A');
        const imageUrl = escapeHtml(anime.images?.jpg?.large_image_url || '');
        const synopsis = escapeHtml(anime.synopsis || 'No synopsis available.');

        const relatedHtml = buildCollectionHtml(anime.relations);

        modalContent.innerHTML = `
            <div id="modal-image-container">
                <img src="${imageUrl}" alt="${title}" id="modal-image" loading="lazy">
                <button class="add-to-list-btn">+ Add to My List</button>
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
                <p id="modal-synopsis">${synopsis}</p>

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

            <div id="recommendations-placeholder" class="modal-section-full-width"></div>
        `;

        modalContent.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (event) => {
                event.stopPropagation();
                openAnimeModal(card.dataset.id);
            });
        });
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
        modalOverlay.setAttribute('aria-hidden', 'true');
        modalContent.innerHTML = '';
    }

    // --- 4. INITIALIZATION ---
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.style.display === 'flex') {
                closeModal();
            }
        });
    }

    init();
})();
