import json
import math
import os
import requests
import logging
import hashlib
from config import Config
from utils.api_helper import safe_get, build_overpass_query, parse_overpass_response

logger = logging.getLogger('search_logger')

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'search_cache.json')
CITIES_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'india_cities.json')

def load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading cache: {e}")
    return {}

def save_cache(cache_data):
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f)
    except Exception as e:
        logger.error(f"Error saving cache: {e}")

def get_cached_result(query_hash):
    cache = load_cache()
    return cache.get(query_hash)

def set_cached_result(query_hash, data):
    cache = load_cache()
    if len(cache) > 200:
        cache.pop(next(iter(cache)))
    cache[query_hash] = data
    save_cache(cache)

def geocode_with_photon(query_string):
    """Helper to geocode a specific string using Photon API"""
    url = "https://photon.komoot.io/api/"
    params = {'q': query_string, 'limit': 1}
    try:
        response = safe_get(url, params=params)
        if response and response.status_code == 200:
            data = response.json()
            if data and 'features' in data and len(data['features']) > 0:
                coords = data['features'][0]['geometry']['coordinates']
                return float(coords[1]), float(coords[0])
    except Exception as e:
        logger.error(f"Photon geocode error for '{query_string}': {e}")
    return None, None

def get_fallback_city_coords(city_name):
    """Fallback to local JSON if external geocoding fails."""
    if not city_name: return None, None
    try:
        with open(CITIES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            target = city_name.lower().strip()
            for c in data.get('cities', []):
                if c['name'].lower() == target:
                    return c['lat'], c['lon']
    except Exception as e:
        logger.error(f"Error reading india_cities.json fallback: {e}")
    return None, None

def geocode_location(locality, city):
    """
    Multi-layer geocoding strategy for high precision:
    1. locality + city + India
    2. city + India
    3. locality + India
    4. Fallback local JSON db
    """
    lat, lon = None, None
    
    locality = (locality or "").strip()
    city = (city or "").strip()
    
    # Strategy 1
    if locality and city:
        query = f"{locality}, {city}, India"
        lat, lon = geocode_with_photon(query)
        if lat and lon:
            logger.info(f"Geocoded S1 '{query}' -> lat:{lat}, lon:{lon}")
            return lat, lon

    # Strategy 2
    if city:
        query = f"{city}, India"
        lat, lon = geocode_with_photon(query)
        if lat and lon:
            logger.info(f"Geocoded S2 '{query}' -> lat:{lat}, lon:{lon}")
            return lat, lon
            
    # Strategy 3
    if locality:
        query = f"{locality}, India"
        lat, lon = geocode_with_photon(query)
        if lat and lon:
            logger.info(f"Geocoded S3 '{query}' -> lat:{lat}, lon:{lon}")
            return lat, lon
            
    # Strategy 4: Local Fallback database
    if city:
        lat, lon = get_fallback_city_coords(city)
        if lat and lon:
            logger.info(f"Geocoded S4 (Fallback) '{city}' -> lat:{lat}, lon:{lon}")
            return lat, lon

    logger.warning(f"All geocoding layers failed for locality:'{locality}', city:'{city}'")
    return None, None

def deduplicate_places(places):
    """
    Deduplicate facilities returned multiple times (e.g., as Node and Way overlap).
    Uses a combination of name and rough coordinate rounding.
    """
    seen = set()
    unique = []
    
    for p in places:
        # Round 4 decimal places approx 11m
        r_lat = round(p['lat'], 4)
        r_lon = round(p['lon'], 4)
        footprint = f"{str(p['name']).lower().strip()}_{r_lat}_{r_lon}"
        
        if footprint not in seen:
            seen.add(footprint)
            unique.append(p)
    return unique

def fetch_nearby_places(lat, lon, service_type):
    """
    Query the Overpass API for healthcare facilities.
    Multi-layer fallback: 300m -> 500m -> 1km -> 2km -> 3km -> 5km -> 10km
    Stops when it finds at least 3 valid locations.
    """
    radii = [300, 500, 1000, 2000, 3000, 5000, 10000]
    
    accumulated_places = []
    
    for radius in radii:
        logger.info(f"Trying radius: {radius}m for {service_type} at {lat},{lon}")
        query = build_overpass_query(lat, lon, service_type, radius)
        
        try:
            # Alternate endpoints internally just in case main is ratelimited
            endpoints = [
                Config.OVERPASS_BASE_URL,
                'https://lz4.overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter'
            ]
            
            response = None
            for ep in endpoints:
                headers = {'User-Agent': 'LocalCareFinder/3.0'}
                temp_res = requests.post(ep, data={'data': query}, headers=headers, timeout=20)
                if temp_res.status_code == 429:
                    import time
                    time.sleep(1.5) # Throttle gracefully if one node rejects us
                    continue
                temp_res.raise_for_status()
                response = temp_res
                break
                
            if not response:
                logger.error(f"Failed all endpoints for {radius}m, likely due to 429 rate limits.")
                # We are fully rate limited, return what we have so far
                return accumulated_places, radius
                
            data = response.json()
            
            places = parse_overpass_response(data)
            unique_places = deduplicate_places(places)
            
            if len(unique_places) >= 3:
                logger.info(f"Found {len(unique_places)} places at {radius}m. Satisfied threshold.")
                return unique_places, radius
            elif len(unique_places) > len(accumulated_places):
                accumulated_places = unique_places
                
        except Exception as e:
            logger.error(f"Error fetching Overpass radius {radius}m: {e}")
            
    logger.warning(f"Exhausted radii. Returning {len(accumulated_places)} items found across all bounds.")
    return accumulated_places, 10000

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat / 2) ** 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dLon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def sort_by_distance(places, user_lat, user_lon):
    """
    Calculate distance to each place and rank by Distance > Namedness > Address completeness.
    """
    for place in places:
        dist_km = haversine_distance(user_lat, user_lon, place['lat'], place['lon'])
        place['distance_km'] = round(dist_km, 2)
        
        # Human readable distance display logic
        if dist_km < 1.0:
            place['distance_display'] = f"{int(dist_km * 1000)}m away"
        elif dist_km < 10.0:
            place['distance_display'] = f"{round(dist_km, 1)}km away"
        else:
            place['distance_display'] = f"{round(dist_km)}km away"
            
    # Sort Ascending by distance
    return sorted(places, key=lambda x: (x.get('distance_km', 999), -x.get('has_name', 0), -x.get('address_completeness', 0)))

def get_emergency_contacts(city_name):
    file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'emergency_contacts.json')
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            target = city_name.lower().strip()
            for c in data.get('cities', []):
                if c['name'].lower() == target:
                    return c
    except Exception as e:
        logger.error(f"Error loading emergency_contacts.json: {e}")
        
    return {
        "name": city_name if city_name and city_name != "Unknown" else "Your Area",
        "ambulance": "108",
        "police": "100",
        "fire_brigade": "101",
        "poison_control": "1066",
        "nearest_hospital": "Nearest General Hospital"
    }
