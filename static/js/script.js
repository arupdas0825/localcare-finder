/**
 * LocalCare Finder V2 - Frontend Interactions
 * Refactored for new UI elements, custom markers, and smooth UX states.
 */

// State globals
let mapInstance = null;
let currentMarkers = [];
let allFetchedResults = [];
const USER_PREF_THEME = 'localcare-theme-v2';
const FAVORITES_KEY = 'localcare-favorites';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    attachGlobalListeners();

    if (document.getElementById('map')) {
        initResultsPage();
    } else if (document.getElementById('totalSearchesCount')) {
        initDashboard(); // Legacy bindings kept intact for dashboard if needed
    } else {
        initHomePage();
    }
});

/* ========================================================
   1. GLOBAL FUNCTIONS & THEME
   ======================================================== */
function initTheme() {
    const isDark = localStorage.getItem(USER_PREF_THEME) === 'dark';
    if (isDark) {
        document.body.classList.add('dark');
    }
    
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            const newTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
            localStorage.setItem(USER_PREF_THEME, newTheme);
            
            // Re-render map tiles contextually if map exists
            if (mapInstance) {
                // Leaflet light/dark tile hack: CSS filter inversion is usually best,
                // but for a true app, we could swap tileLayer URLs. We'll stick to CSS context handled in style.css.
                mapInstance.invalidateSize();
            }
        });
    }
}

function attachGlobalListeners() {
    const modal = document.getElementById('emergencyModal');
    const closeBtns = document.querySelectorAll('.modal-close');
    
    // Bind all buttons with ID starting with emergencyBtn
    document.querySelectorAll('[id^="emergencyBtn"]').forEach(btn => {
        btn.addEventListener('click', showEmergencyModal);
    });

    closeBtns.forEach(b => {
        b.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

function showEmergencyModal() {
    const modal = document.getElementById('emergencyModal');
    modal.classList.remove('hidden');
    
    // Trigger entrance animation reflow
    const board = modal.querySelector('.emergency-board');
    board.style.animation = 'none';
    board.offsetHeight; /* trigger reflow */
    board.style.animation = null; 

    const contextHtml = document.getElementById('emergencyContext');
    if (contextHtml) contextHtml.innerHTML = `<span class="spinner-small"></span> Locating local dispatch...`;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            () => { fetchAndRenderEmergency('Unknown (Auto-detected)'); },
            () => { fetchAndRenderEmergency('Unknown'); }
        );
    } else {
        fetchAndRenderEmergency('Unknown');
    }
}

async function fetchAndRenderEmergency(cityName) {
    try {
        const response = await fetch(`/api/emergency?city=${encodeURIComponent(cityName)}`);
        const data = await response.json();
        
        const grid = document.getElementById('emergencyData');
        const c = data.contacts;
        
        // V2 Design Template Structure
        let html = `
            <div class="contact-item highlight">
                <h3>🚑 Ambulance / Medic</h3>
                <h2>${c.ambulance}</h2>
            </div>
            <div class="contact-item">
                <h3>🚓 Police / Security</h3>
                <h2>${c.police}</h2>
            </div>
            <div class="contact-item">
                <h3>🚒 Fire / Rescue</h3>
                <h2>${c.fire_brigade}</h2>
            </div>
            <div class="contact-item">
                <h3>🏥 Nearest Major Hub</h3>
                <h2 style="font-size: 1.5rem; padding-top: 0.5rem">${c.nearest_hospital}</h2>
            </div>
        `;
        grid.innerHTML = html;

        if (document.getElementById('emergencyContext')) {
            document.getElementById('emergencyContext').innerHTML = `📍 Dispatching protocols for region: <strong>${c.name}</strong>`;
        }
    } catch (e) {
        console.error("Emergency API Error:", e);
    }
}

/* ========================================================
   2. HOME PAGE LOGIC
   ======================================================== */
function initHomePage() {
    const geoBtn = document.getElementById('geoBtn');
    if (geoBtn) {
        geoBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Your browser does not support Geolocation.');
                return;
            }
            
            document.getElementById('globalSpinner').classList.remove('hidden');
            
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const type = document.getElementById('typeSelect').value;
                    window.location.href = `/results?lat=${latitude}&lon=${longitude}&type=${type}`;
                },
                () => {
                    document.getElementById('globalSpinner').classList.add('hidden');
                    alert('Location access denied. Please click the search button with a city name.');
                }
            );
        });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', doHomeSearch);
    }

    const cityInput = document.getElementById('cityInput');
    if (cityInput) {
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doHomeSearch();
        });
    }

    function doHomeSearch() {
        const city = document.getElementById('cityInput').value.trim();
        const type = document.getElementById('typeSelect').value;
        if (city !== "") {
            document.getElementById('searchBtn').innerHTML = `<span class="spinner-small" style="border-top-color: white"></span> Routing...`;
            window.location.href = `/results?city=${encodeURIComponent(city)}&type=${type}`;
        } else {
            // Add error shake animation to input in V2
            const inputGroup = document.querySelector('.search-box');
            inputGroup.classList.add('error-shake');
            setTimeout(() => inputGroup.classList.remove('error-shake'), 500);
            cityInput.focus();
        }
    }

    // AI Assitant interaction
    const symptomInput = document.getElementById('symptomInput');
    if (symptomInput) {
        symptomInput.addEventListener('input', (e) => {
            const text = e.target.value.toLowerCase();
            const suggestionBox = document.getElementById('aiSuggestion');
            const typeSelect = document.getElementById('typeSelect');
            
            let suggestion = "";
            let matchedType = "";
            
            if (text.match(/(chest pain|bleeding|injury|stroke|attack|accident|broken|unconscious)/)) {
                suggestion = "🚨 CRITICAL ROUTING: Symptoms indicate severe trauma. Routing priority set to <strong>HOSPITAL</strong>.";
                matchedType = "hospital";
            } else if (text.match(/(fever|cough|cold|headache|pain|stomach ache|nausea|rash|medication|pill)/)) {
                suggestion = "💡 TRIAGE ADVICE: For non-emergencies, routing preference updated to <strong>PHARMACY</strong>.";
                matchedType = "pharmacy";
            } else if (text.match(/(blood|donate|plasma|transfusion)/)) {
                suggestion = "🩸 RESOURCE TARGETING: Automatically switching search parameters to nearby <strong>BLOOD BANK</strong> facilities.";
                matchedType = "blood_bank";
            } else if (text.trim().length > 10) {
                 suggestion = "Analyzing symptoms... Defaulting to Hospital check for complete care.";
            }

            if (text.trim() === "") suggestion = "";

            if (suggestion) {
                suggestionBox.innerHTML = suggestion;
                suggestionBox.classList.remove('hidden');
                if(matchedType) typeSelect.value = matchedType;
            } else {
                suggestionBox.classList.add('hidden');
            }
        });
    }

    renderHomeFavorites();
}

/* LocalStorage Favorites */
function getFavorites() {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
}

function saveFavorites(arr) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(arr));
}

function toggleFavorite(placeObj) {
    let favs = getFavorites();
    const existingIndex = favs.findIndex(f => f.id == placeObj.id);
    
    if (existingIndex > -1) {
        favs.splice(existingIndex, 1);
    } else {
        favs.push(placeObj);
    }
    saveFavorites(favs);
    return existingIndex === -1; 
}

function isFavorite(id) {
    return getFavorites().some(f => f.id == id);
}

function renderHomeFavorites() {
    const list = document.getElementById('favoritesList');
    if (!list) return;

    const favs = getFavorites();
    if (favs.length === 0) {
        list.innerHTML = `
            <li class="empty-state pulse-soft">
                <div class="empty-icon">📍</div>
                <p>No favorites yet.</p>
                <span class="text-secondary" style="font-size:0.85rem">Star places in your search results to keep them handy here!</span>
            </li>`;
        return;
    }

    list.innerHTML = favs.map(f => `
        <li>
            <div>
                <strong>${f.name}</strong>
                <small>📍 ${f.address}</small>
            </div>
            <span class="fav-li-remove tooltip" data-tooltip="Remove" onclick="removeHomeFavorite('${f.id}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </span>
        </li>
    `).join('');
}

window.removeHomeFavorite = function(id) {
    let favs = getFavorites().filter(f => f.id != id);
    saveFavorites(favs);
    renderHomeFavorites();
}

/* ========================================================
   3. RESULTS PAGE LOGIC
   ======================================================== */
async function initResultsPage() {
    // V2 Custom SVG Marker Pin Icon
    const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="background-color: var(--primary); width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display:flex; align-items:center; justify-content:center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <div style="width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30], // point of the icon which will correspond to marker's location
        popupAnchor: [0, -30] // point from which the popup should open relative to the iconAnchor
    });
    
    // Store it globally so render loop can use it
    window.appCustomMarker = customIcon;

    mapInstance = L.map('map', {zoomControl: false}).setView([0, 0], 2);
    
    // Position zoom control down out of the way of the overlay button
    L.control.zoom({ position: 'bottomleft' }).addTo(mapInstance);
    
    // CartoDB Voyager tiles (cleaner UI than standard OSM)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(mapInstance);

    const params = new URLSearchParams(window.location.search);
    let fetchUrl = '';
    
    const lat = params.get('lat');
    const lon = params.get('lon');
    const city = params.get('city');
    const type = params.get('type') || 'hospital';
    
    if (lat && lon) {
        fetchUrl = `/api/nearby?lat=${lat}&lon=${lon}&type=${type}`;
    } else if (city) {
        fetchUrl = `/api/nearby?city=${encodeURIComponent(city)}&type=${type}`;
    }

    document.getElementById('filterDistance').addEventListener('change', runLocalFilters);
    document.getElementById('filterOpen').addEventListener('change', runLocalFilters);
    
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('filterDistance').value = "50";
        document.getElementById('filterOpen').checked = false;
        runLocalFilters();
    });

    try {
        const res = await fetch(fetchUrl);
        const data = await res.json();

        // Remove Skeletons
        document.getElementById('loadingSpinner').classList.add('hidden');

        if (!res.ok || !data.results || data.results.length === 0) {
            document.getElementById('noResults').classList.remove('hidden');
            document.getElementById('resultSummary').innerHTML = `<span>0 Locations Found</span>`;
            
            // Still center map on the city if geocoding worked but overpass didn't output
            if(data.center) {
                 mapInstance.setView([data.center.lat, data.center.lon], 12);
            }
            return;
        }

        allFetchedResults = data.results;
        
        const center = data.center;
        mapInstance.setView([center.lat, center.lon], 13);
        
        // Add a pulsing marker for user center
        const userIcon = L.divIcon({
            className: 'user-pulse-marker',
            html: `<div style="width: 20px; height: 20px; background: var(--danger); border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 rgba(239, 68, 68, 0.4); animation: pulse-red 2s infinite;"></div>`,
            iconSize: [20, 20]
        });

        const centerMarker = L.marker([center.lat, center.lon], {icon: userIcon})
            .addTo(mapInstance)
            .bindPopup("<div class='popup-inner'><h4>📍 Search Origin</h4><p>Your lookup location</p></div>", {className: 'custom-leaflet-popup'})
            .openPopup();
            
        // Setup recenter button
        document.getElementById('recenterBtn').addEventListener('click', () => {
            mapInstance.setView([center.lat, center.lon], 13);
            centerMarker.openPopup();
        });

        runLocalFilters();
        
        setTimeout(() => mapInstance.invalidateSize(), 500);

    } catch (e) {
        console.error("Error fetching results", e);
        document.getElementById('loadingSpinner').innerHTML = `<div class="empty-state-large"><h3>Network Error</h4><p>Could not retrieve data from server. Please try again.</p></div>`;
    }
}

function runLocalFilters() {
    const maxDist = parseFloat(document.getElementById('filterDistance').value);
    const requireOpen = document.getElementById('filterOpen').checked;
    
    let filtered = allFetchedResults;
    
    if (maxDist < 50) {
        filtered = filtered.filter(p => p.distance_km <= maxDist);
    }
    
    if (requireOpen) {
        filtered = filtered.filter(p => p.opening_hours && p.opening_hours !== 'Unknown');
    }

    renderCardsAndMarkers(filtered);
    
    document.getElementById('resultSummary').innerHTML = `<span class="pulse-dot"></span> Found ${filtered.length} locations`;
    
    if (filtered.length === 0) {
        document.getElementById('noResults').classList.remove('hidden');
        document.getElementById('resultsGrid').classList.add('hidden');
    } else {
        document.getElementById('noResults').classList.add('hidden');
        document.getElementById('resultsGrid').classList.remove('hidden');
    }
}

function renderCardsAndMarkers(places) {
    const grid = document.getElementById('resultsGrid');
    grid.innerHTML = '';
    
    currentMarkers.forEach(m => mapInstance.removeLayer(m));
    currentMarkers = [];

    places.forEach((place, index) => {
        const isFav = isFavorite(place.id);
        const starClass = isFav ? 'active' : '';
        
        const placeStr = JSON.stringify({id: place.id, name: place.name, address: place.address}).replace(/"/g, '&quot;');
        
        const cardNode = document.createElement('div');
        cardNode.className = 'f-card fade-in-up';
        // Add dynamic staggering via inline style override
        cardNode.style.animationDelay = `${(index % 10) * 0.1}s`; 
        
        cardNode.innerHTML = `
            <div class="f-card-header">
                <div class="f-title">
                    <h4>${place.name}</h4>
                    <span class="f-type">${place.type.replace('_', ' ')}</span>
                </div>
                <span class="f-star ${starClass} tooltip" data-tooltip="Save" data-place="${placeStr}" onclick="handleStarClick(this)">★</span>
            </div>
            
            <div class="f-address">
                <span class="f-address-icon">📍</span> 
                <span>${place.address}</span>
            </div>
            
            <div class="f-actions">
                <span class="dist-badge">
                    ${place.distance_km} <span>km away</span>
                </span>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank" class="btn-sm btn-sm-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg> Directions
                </a>
            </div>
        `;
        
        cardNode.addEventListener('mouseenter', () => {
             mapInstance.flyTo([place.lat, place.lon], 15, {duration: 0.5});
        });
        
        grid.appendChild(cardNode);

        // Map Marker Injection
        const marker = L.marker([place.lat, place.lon], {icon: window.appCustomMarker}).addTo(mapInstance);
        
        marker.bindPopup(`
            <div class="popup-inner">
                <h4>${place.name}</h4>
                <p>${place.distance_km}km away</p>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank">Start Navigation</a>
            </div>
        `, {className: 'custom-leaflet-popup'});
        
        currentMarkers.push(marker);
    });
}

window.handleStarClick = function(elem) {
    const targetPlace = JSON.parse(elem.getAttribute('data-place'));
    const wasAdded = toggleFavorite(targetPlace);
    
    if (wasAdded) {
        elem.classList.add('active');
        // Visual satisfying pop
        elem.style.transform = 'scale(1.4)';
        setTimeout(()=> elem.style.transform = '', 200);
    } else {
        elem.classList.remove('active');
    }
};
