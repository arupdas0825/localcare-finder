/**
 * LocalCare Finder V3 - Pan-India Advanced Frontend
 * Upgraded for dual inputs, reverse geocoding, and progressive radius mapping.
 */

// State globals
let mapInstance = null;
let currentMarkers = [];
let searchRadiusCircle = null;
let allFetchedResults = [];
const USER_PREF_THEME = 'localcare-theme-v2';
const FAVORITES_KEY = 'localcare-favorites';

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    attachGlobalListeners();

    if (document.getElementById('map')) {
        initResultsPage();
    } else if (document.getElementById('totalSearchesCount')) {
        initDashboard(); 
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
            if (mapInstance) mapInstance.invalidateSize();
        });
    }
}

function attachGlobalListeners() {
    const modal = document.getElementById('emergencyModal');
    const closeBtns = document.querySelectorAll('.modal-close');
    
    document.querySelectorAll('[id^="emergencyBtn"]').forEach(btn => {
        btn.addEventListener('click', showEmergencyModal);
    });

    closeBtns.forEach(b => {
        b.addEventListener('click', () => {
            if(modal) modal.classList.add('hidden');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });
}

function showEmergencyModal() {
    const modal = document.getElementById('emergencyModal');
    if(!modal) return;
    modal.classList.remove('hidden');
    
    const board = modal.querySelector('.emergency-board');
    if(board) {
        board.style.animation = 'none';
        board.offsetHeight; 
        board.style.animation = null; 
    }

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
        if(grid) grid.innerHTML = html;

        if (document.getElementById('emergencyContext')) {
            document.getElementById('emergencyContext').innerHTML = `📍 Dispatching protocols for region: <strong>${c.name}</strong>`;
        }
    } catch (e) {
        console.error("Emergency API Error:", e);
    }
}

/* ========================================================
   2. HOME PAGE LOGIC (DUAL INPUTS & REVERSE GEOCODING)
   ======================================================== */
function initHomePage() {
    const geoBtn = document.getElementById('geoBtn');
    if (geoBtn) {
        geoBtn.addEventListener('click', async () => {
            if (!navigator.geolocation) {
                alert('Your browser does not support Geolocation.');
                return;
            }
            
            geoBtn.innerHTML = `<span class="spinner-small" style="border-top-color:var(--primary)"></span> Locating...`;
            
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    
                    try {
                        const res = await fetch(`https://photon.komoot.io/api/?q=${latitude},${longitude}&limit=1`);
                        const data = await res.json();
                        
                        if (data && data.features && data.features.length > 0) {
                            const props = data.features[0].properties;
                            const localityStr = props.district || props.suburb || props.neighbourhood || '';
                            const cityStr = props.city || props.town || props.county || '';
                            
                            const locInput = document.getElementById('localityInput');
                            const cityInput = document.getElementById('cityInput');
                            if(locInput && localityStr) locInput.value = localityStr;
                            if(cityInput && cityStr) cityInput.value = cityStr;
                            
                            // Immediately trigger search
                            setTimeout(doHomeSearch, 500);
                        } else {
                            // Fallback to coordinates
                            const type = document.getElementById('typeSelect').value;
                            window.location.href = `/results?lat=${latitude}&lon=${longitude}&type=${type}`;
                        }
                    } catch (e) {
                        const type = document.getElementById('typeSelect').value;
                        window.location.href = `/results?lat=${latitude}&lon=${longitude}&type=${type}`;
                    }
                },
                () => {
                    geoBtn.innerHTML = `<span>Use My Location</span>`;
                    alert('Location access denied. Please manually type your city.');
                }
            );
        });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', doHomeSearch);
    }

    // Attach Autocompletes
    setupAutocomplete('localityInput', 'autocompleteLocality');
    setupAutocomplete('cityInput', 'autocompleteCity');

    const cityInput = document.getElementById('cityInput');
    if (cityInput) {
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doHomeSearch();
        });
    }
    const locInput = document.getElementById('localityInput');
    if (locInput) {
        locInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doHomeSearch();
        });
    }

    function doHomeSearch() {
        const localityNode = document.getElementById('localityInput');
        const cityNode = document.getElementById('cityInput');
        
        let locality = "";
        let city = "";
        
        if (localityNode) locality = localityNode.value.trim();
        if (cityNode) city = cityNode.value.trim();
        
        const typeNode = document.getElementById('typeSelect');
        const type = typeNode ? typeNode.value : 'hospital';
        
        if (city !== "" || locality !== "") {
            if(searchBtn) searchBtn.innerHTML = `<span class="spinner-small" style="border-top-color: white"></span> Routing...`;
            let url = `/results?type=${type}`;
            if (locality) url += `&locality=${encodeURIComponent(locality)}`;
            if (city) url += `&city=${encodeURIComponent(city)}`;
            window.location.href = url;
        } else {
            const inputGroup = document.querySelector('.search-box');
            if(inputGroup) {
                inputGroup.classList.add('error-shake');
                setTimeout(() => inputGroup.classList.remove('error-shake'), 500);
            }
            if(cityNode) cityNode.focus();
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

            if (suggestion) {
                suggestionBox.innerHTML = suggestion;
                suggestionBox.classList.remove('hidden');
                if(matchedType && typeSelect) typeSelect.value = matchedType;
            } else {
                suggestionBox.classList.add('hidden');
            }
        });
    }

    renderHomeFavorites();
}

function setupAutocomplete(inputId, dropdownId) {
    const inputEl = document.getElementById(inputId);
    const dropdownEl = document.getElementById(dropdownId);
    let debounceTimer;

    if (!inputEl || !dropdownEl) return;

    inputEl.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length < 3) {
            dropdownEl.classList.add('hidden');
            return;
        }
        
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query + ', India')}&limit=4`);
                const data = await res.json();
                
                if (data.features && data.features.length > 0) {
                    dropdownEl.innerHTML = '';
                    data.features.forEach(f => {
                        const name = f.properties.name;
                        const state = f.properties.state || '';
                        const city = f.properties.city || '';
                        const desc = [city, state].filter(Boolean).join(', ');
                        
                        const div = document.createElement('div');
                        div.className = 'autocomplete-item';
                        div.innerHTML = `<div class="autocomplete-title">${name}</div><div class="autocomplete-desc">${desc}</div>`;
                        div.addEventListener('click', () => {
                            inputEl.value = name;
                            dropdownEl.classList.add('hidden');
                        });
                        dropdownEl.appendChild(div);
                    });
                    dropdownEl.classList.remove('hidden');
                } else {
                    dropdownEl.classList.add('hidden');
                }
            } catch(err) {
                console.error("Autocomplete error:", err);
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if(!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.classList.add('hidden');
        }
    });
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
function getMarkerIcon(typeString) {
    let wrapperClass = "marker-hospital";
    let innerIcon = "🏥";

    if (typeString.toLowerCase().includes('pharmacy') || typeString.toLowerCase().includes('chemist')) {
        wrapperClass = "marker-pharmacy";
        innerIcon = "💊";
    } else if (typeString.toLowerCase().includes('blood')) {
        wrapperClass = "marker-blood_bank";
        innerIcon = "🩸";
    } else if (typeString.toLowerCase().includes('clinic')) {
        innerIcon = "🩺";
    }

    return L.divIcon({
        className: `custom-map-marker ${wrapperClass}`,
        html: `<div style="width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display:flex; align-items:center; justify-content:center; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <span class="marker-icon" style="transform: rotate(45deg);">${innerIcon}</span>
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });
}

function getDistanceBadgeClass(dist_km) {
    if (dist_km < 1.0) return 'badge-green';
    if (dist_km <= 5.0) return 'badge-yellow';
    return 'badge-red';
}

async function initResultsPage() {
    mapInstance = L.map('map', {zoomControl: false}).setView([0, 0], 2);
    L.control.zoom({ position: 'bottomleft' }).addTo(mapInstance);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(mapInstance);

    const params = new URLSearchParams(window.location.search);
    let fetchUrl = '/api/nearby?';
    
    const lat = params.get('lat');
    const lon = params.get('lon');
    const locality = params.get('locality');
    const city = params.get('city');
    const type = params.get('type') || 'hospital';
    
    if (lat && lon) {
        fetchUrl += `lat=${lat}&lon=${lon}&type=${type}`;
    } else {
        if(locality) fetchUrl += `locality=${encodeURIComponent(locality)}&`;
        if(city) fetchUrl += `city=${encodeURIComponent(city)}&`;
        fetchUrl += `type=${type}`;
    }

    const filterDistanceNode = document.getElementById('filterDistance');
    const filterOpenNode = document.getElementById('filterOpen');
    
    if(filterDistanceNode) filterDistanceNode.addEventListener('change', runLocalFilters);
    if(filterOpenNode) filterOpenNode.addEventListener('change', runLocalFilters);
    
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    if(resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            if(filterDistanceNode) filterDistanceNode.value = "50";
            if(filterOpenNode) filterOpenNode.checked = false;
            runLocalFilters();
        });
    }

    try {
        const res = await fetch(fetchUrl);
        const data = await res.json();

        const loadSpinner = document.getElementById('loadingSpinner');
        if(loadSpinner) loadSpinner.classList.add('hidden');

        // Always center map if coordinates returned (even if results are 0)
        let mapCenter = null;
        if (data.center) {
            mapCenter = [data.center.lat, data.center.lon];
            mapInstance.setView(mapCenter, 14);
            
            // Add user location pulsing marker
            const userIcon = L.divIcon({
                className: 'user-pulse-marker',
                html: `<div style="width: 20px; height: 20px; background: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 rgba(59, 130, 246, 0.4); animation: pulse-red 2s infinite;"></div>`,
                iconSize: [20, 20]
            });

            const centerMarker = L.marker(mapCenter, {icon: userIcon})
                .addTo(mapInstance)
                .bindPopup("<div class='popup-inner'><h4>📍 Search Origin</h4><p>Your lookup location</p></div>", {className: 'custom-leaflet-popup'});
                
            const recenterBtn = document.getElementById('recenterBtn');
            if(recenterBtn) {
                recenterBtn.addEventListener('click', () => {
                    mapInstance.setView(mapCenter, 14);
                    centerMarker.openPopup();
                });
            }
        }
        
        // Render Radius UI & Circle overlay
        if (data.radius_used && mapCenter) {
            const rSum = document.getElementById('radiusSummary');
            if(rSum) rSum.innerHTML = `Search Radius: ${data.radius_used}m`;
            
            searchRadiusCircle = L.circle(mapCenter, {
                color: 'var(--primary)',
                fillColor: 'var(--primary)',
                fillOpacity: 0.05,
                weight: 1,
                radius: data.radius_used
            }).addTo(mapInstance);
        }

        if (!data.results || data.results.length === 0) {
            const noResults = document.getElementById('noResults');
            if(noResults) noResults.classList.remove('hidden');
            
            const rSum = document.getElementById('resultSummary');
            if(rSum) rSum.innerHTML = `<span>0 Locations Found</span>`;
            
            // Inject dynamic message context
            const msgNode = document.getElementById('emptyStateMessage');
            if(msgNode) {
                 const locCtx = [locality, city].filter(Boolean).join(', ');
                 msgNode.innerHTML = `We couldn't find any <strong>${type.replace('_', ' ')}</strong> locations near <strong>${locCtx ? locCtx : 'your location'}</strong> mapped on OpenStreetMap. You can help the community by adding this missing data.`;
            }
            return;
        }

        allFetchedResults = data.results;
        runLocalFilters();
        
        // Auto fit bounds to markers (plus the geometric center)
        setTimeout(() => {
            mapInstance.invalidateSize();
            if (currentMarkers.length > 0) {
               const group = new L.featureGroup([searchRadiusCircle, ...currentMarkers]);
               mapInstance.fitBounds(group.getBounds(), {padding: [50, 50], maxZoom: 16});
            }
        }, 500);

    } catch (e) {
        console.error("Error fetching results", e);
        const loadSpinner = document.getElementById('loadingSpinner');
        if(loadSpinner) loadSpinner.innerHTML = `<div class="empty-state-large"><h3>Network Error</h4><p>Could not retrieve data from server. Please try again.</p></div>`;
    }
}

function runLocalFilters() {
    const filterDistanceNode = document.getElementById('filterDistance');
    const filterOpenNode = document.getElementById('filterOpen');
    
    const maxDist = filterDistanceNode ? parseFloat(filterDistanceNode.value) : 50;
    const requireOpen = filterOpenNode ? filterOpenNode.checked : false;
    
    let filtered = allFetchedResults;
    
    if (maxDist < 50) {
        filtered = filtered.filter(p => p.distance_km <= maxDist);
    }
    
    if (requireOpen) {
        filtered = filtered.filter(p => p.opening_hours && p.opening_hours !== 'Unknown');
    }

    renderCardsAndMarkers(filtered);
    
    const rSum = document.getElementById('resultSummary');
    if(rSum) rSum.innerHTML = `<span class="pulse-dot"></span> Found ${filtered.length} locations`;
    
    const noResults = document.getElementById('noResults');
    const grid = document.getElementById('resultsGrid');
    
    if (filtered.length === 0) {
        if(noResults) noResults.classList.remove('hidden');
        if(grid) grid.classList.add('hidden');
    } else {
        if(noResults) noResults.classList.add('hidden');
        if(grid) grid.classList.remove('hidden');
    }
}

function renderCardsAndMarkers(places) {
    const grid = document.getElementById('resultsGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    currentMarkers.forEach(m => mapInstance.removeLayer(m));
    currentMarkers = [];

    places.forEach((place, index) => {
        const isFav = isFavorite(place.id);
        const starClass = isFav ? 'active' : '';
        
        const placeStr = JSON.stringify({id: place.id, name: place.name, address: place.address}).replace(/"/g, '&quot;');
        const badgeColorClass = getDistanceBadgeClass(place.distance_km);
        
        let extraInfoHtml = '';
        if (place.phone && place.phone !== 'Unknown') {
            extraInfoHtml += `<span style="font-size:0.8rem; color:var(--text-secondary); margin-left:0.5rem">📞 ${place.phone}</span>`;
        }
        
        const cardNode = document.createElement('div');
        cardNode.className = 'f-card fade-in-up';
        cardNode.style.animationDelay = `${(index % 10) * 0.1}s`; 
        
        cardNode.innerHTML = `
            <div class="f-card-header">
                <div class="f-title">
                    <h4>${place.name}</h4>
                    <span class="f-type">${place.type.replace('_', ' ')}</span>
                </div>
                <span class="f-star ${starClass} tooltip" data-tooltip="Save" data-place="${placeStr}" onclick="handleStarClick(this)">★</span>
            </div>
            
            <div class="f-address" style="margin-bottom:0.5rem;">
                <span class="f-address-icon">📍</span> 
                <span>${place.address}</span>
            </div>
            ${extraInfoHtml ? `<div style="margin-bottom: 0.8rem">${extraInfoHtml}</div>` : ''}
            
            <div class="f-actions">
                <span class="dist-badge ${badgeColorClass}">
                    <span>${place.distance_display}</span>
                </span>
                <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank" class="btn-sm btn-sm-primary">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg> Directions
                </a>
            </div>
        `;
        
        cardNode.addEventListener('mouseenter', () => {
             mapInstance.flyTo([place.lat, place.lon], 16, {duration: 0.5});
        });
        
        grid.appendChild(cardNode);

        // Map Marker Injection
        const marker = L.marker([place.lat, place.lon], {icon: getMarkerIcon(place.type)}).addTo(mapInstance);
        
        marker.bindPopup(`
            <div class="popup-inner">
                <h4>${place.name}</h4>
                <p>📍 ${place.address}</p>
                ${place.phone && place.phone !== 'Unknown' ? `<p>📞 ${place.phone}</p>` : ''}
                <p><strong>${place.distance_display}</strong></p>
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
        elem.style.transform = 'scale(1.4)';
        setTimeout(()=> elem.style.transform = '', 200);
    } else {
        elem.classList.remove('active');
    }
};
