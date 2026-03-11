import json
import math
import os
import requests
import logging
from config import Config
from utils.api_helper import safe_get, build_overpass_query, parse_overpass_response

logger = logging.getLogger(__name__)

def geocode_city(city_name):
    """
    Convert a city name into latitude and longitude using OSM Nominatim.
    """
    url = Config.NOMINATIM_BASE_URL
    params = {
        'q': city_name,
        'format': 'json',
        'limit': 1
    }
    
    try:
        response = safe_get(url, params=params)
        if response and response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        logger.error(f"Error geocoding city '{city_name}': {e}")
        
    return None, None

def fetch_nearby_places(lat, lon, service_type, radius=5000):
    """
    Query the Overpass API for healthcare facilities around coordinates.
    """
    url = Config.OVERPASS_BASE_URL
    query = build_overpass_query(lat, lon, service_type, radius)
    
    try:
        # Overpass usually recommends POST for complex/long queries
        headers = {'User-Agent': 'LocalCareFinder/1.0'}
        response = requests.post(url, data={'data': query}, headers=headers, timeout=15)
        
        response.raise_for_status()
        data = response.json()
        return parse_overpass_response(data)
        
    except requests.RequestException as e:
        logger.error(f"Error fetching nearby places from Overpass: {e}")
    except ValueError as e:
        logger.error(f"Invalid JSON returned from Overpass: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in fetch_nearby_places: {e}")
        
    return []

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth using the Haversine formula.
    """
    R = 6371.0  # Earth radius in kilometers

    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    
    a = (math.sin(dLat / 2) ** 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dLon / 2) ** 2)
        
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def sort_by_distance(places, user_lat, user_lon):
    """
    Calculate distance to each place and sort the array from closest to farthest.
    """
    for place in places:
        dist = haversine_distance(user_lat, user_lon, place['lat'], place['lon'])
        place['distance_km'] = round(dist, 2)
        
    # Sort Ascending by distance
    return sorted(places, key=lambda x: x['distance_km'])

def get_emergency_contacts(city_name):
    """
    Search local JSON data for city-specific emergency contacts.
    Falls back to generic/standard numbers if the city is not found.
    """
    file_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'emergency_contacts.json')
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            # Exact or partial match
            target_city = city_name.lower().strip()
            for city_data in data.get('cities', []):
                if city_data['name'].lower() == target_city:
                    return city_data
                    
    except Exception as e:
        logger.error(f"Error loading emergency_contacts.json: {e}")
    
    # Generic fallback format if exact city not mapped
    return {
        "name": city_name if city_name and city_name != "Unknown" else "Your Area",
        "ambulance": "911",
        "police": "911",
        "fire_brigade": "911",
        "poison_control": "1-800-222-1222",
        "nearest_hospital": "Nearest General Hospital"
    }
