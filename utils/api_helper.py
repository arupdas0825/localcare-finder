import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def safe_get(url, params=None, timeout=10, retries=3):
    """
    Wrapper for requests.get with automatic retries, timeouts, and logging.
    Crucial for interacting with external APIs securely.
    """
    headers = {
        'User-Agent': 'LocalCareFinder/1.0 (admin@localcarefinder.com)'
    }
    
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=timeout)
            response.raise_for_status()
            return response
            
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout on attempt {attempt + 1} for {url}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Request Error on attempt {attempt + 1} for {url}: {e}")
            
        # Give up on the last attempt
        if attempt == retries - 1:
            return None

def build_overpass_query(lat, lon, amenity_type, radius=5000):
    """
    Build the syntax for Overpass QL depending on the requested health facility.
    OpenStreetMap tags its keys distinctly (amenity=hospital vs healthcare=blood_donation).
    """
    if amenity_type == 'blood_bank':
        query = f"""
        [out:json][timeout:25];
        (
          node["healthcare"="blood_donation"](around:{radius},{lat},{lon});
          way["healthcare"="blood_donation"](around:{radius},{lat},{lon});
          relation["healthcare"="blood_donation"](around:{radius},{lat},{lon});
        );
        out center;
        """
    elif amenity_type == 'pharmacy':
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="pharmacy"](around:{radius},{lat},{lon});
          way["amenity"="pharmacy"](around:{radius},{lat},{lon});
          relation["amenity"="pharmacy"](around:{radius},{lat},{lon});
        );
        out center;
        """
    else:  # Hospital or default fallback
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:{radius},{lat},{lon});
          way["amenity"="hospital"](around:{radius},{lat},{lon});
          relation["amenity"="hospital"](around:{radius},{lat},{lon});
          node["amenity"="clinic"](around:{radius},{lat},{lon});
          way["amenity"="clinic"](around:{radius},{lat},{lon});
        );
        out center;
        """
    return query

def parse_overpass_response(response_json):
    """
    Extract useful and normalized structure (lat, lon, name, address) from complex OSM data output.
    """
    places = []
    if not response_json or 'elements' not in response_json:
        return places
    
    for element in response_json['elements']:
        # Point/Node has lat/lon, Way/Polygon has 'center' lat/lon due to `out center;`
        lat = element.get('lat') or (element.get('center', {}).get('lat'))
        lon = element.get('lon') or (element.get('center', {}).get('lon'))
        tags = element.get('tags', {})
        
        # Name
        name = tags.get('name', tags.get('name:en', 'Unknown Facility'))
        
        # Address concatenation
        addr_housenumber = tags.get('addr:housenumber', '')
        addr_street = tags.get('addr:street', '')
        addr_city = tags.get('addr:city', '')
        
        address_parts = [p for p in [addr_housenumber, addr_street, addr_city] if p]
        address = ", ".join(address_parts) if address_parts else "Address not available"
        
        # Check visually open filter potential (opening_hours)
        opening_hours = tags.get('opening_hours', 'Unknown')
        
        if lat and lon:
            places.append({
                'id': element['id'],
                'name': name,
                'address': address,
                'lat': lat,
                'lon': lon,
                'type': tags.get('amenity', tags.get('healthcare', 'facility')),
                'opening_hours': opening_hours
            })
            
    return places
