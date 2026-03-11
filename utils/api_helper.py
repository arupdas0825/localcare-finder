import requests
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('api_helper')

def safe_get(url, params=None, timeout=10, retries=3):
    """
    Wrapper for requests.get with automatic retries, timeouts, and logging.
    Crucial for interacting with external APIs securely.
    """
    headers = {
        'User-Agent': 'LocalCareFinder/3.0 (admin@localcarefinder.com)'
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
    Massively expanded to cover all common tagging conventions in India.
    """
    if amenity_type == 'blood_bank':
        query = f"""
        [out:json][timeout:25];
        (
          node["healthcare"="blood_donation"](around:{radius},{lat},{lon});
          way["healthcare"="blood_donation"](around:{radius},{lat},{lon});
          
          node["amenity"="blood_bank"](around:{radius},{lat},{lon});
          way["amenity"="blood_bank"](around:{radius},{lat},{lon});
          
          node["healthcare"="blood_bank"](around:{radius},{lat},{lon});
          node["amenity"="blood_donation"](around:{radius},{lat},{lon});
          
          node["amenity"]["name"~"Blood Bank|Rakta|Blood Centre",i](around:{radius},{lat},{lon});
          node["healthcare"]["name"~"Blood Bank|Rakta|Blood Centre",i](around:{radius},{lat},{lon});
        );
        out center;
        """
    elif amenity_type == 'pharmacy':
        # Pharmacy / Medical Stores logic for India
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="pharmacy"](around:{radius},{lat},{lon});
          way["amenity"="pharmacy"](around:{radius},{lat},{lon});
          
          node["amenity"="chemist"](around:{radius},{lat},{lon});
          
          node["shop"="chemist"](around:{radius},{lat},{lon});
          way["shop"="chemist"](around:{radius},{lat},{lon});
          
          node["shop"="pharmacy"](around:{radius},{lat},{lon});
          
          node["shop"="medical_supply"](around:{radius},{lat},{lon});
          way["shop"="medical_supply"](around:{radius},{lat},{lon});
          
          node["amenity"="medical_store"](around:{radius},{lat},{lon});
          
          node["healthcare"="pharmacy"](around:{radius},{lat},{lon});
          way["healthcare"="pharmacy"](around:{radius},{lat},{lon});
          
          node["shop"]["name"~"Medical|Pharma|Chemist|Medicals|Drug",i](around:{radius},{lat},{lon});
          node["amenity"]["name"~"Medical|Pharma|Chemist|Medicals|Drug",i](around:{radius},{lat},{lon});
        );
        out center;
        """
    else:  # Hospital or default fallback
        query = f"""
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:{radius},{lat},{lon});
          way["amenity"="hospital"](around:{radius},{lat},{lon});
          
          node["amenity"="clinic"](around:{radius},{lat},{lon});
          way["amenity"="clinic"](around:{radius},{lat},{lon});
          
          node["amenity"="doctors"](around:{radius},{lat},{lon});
          node["amenity"="health_centre"](around:{radius},{lat},{lon});
          
          node["healthcare"="hospital"](around:{radius},{lat},{lon});
          way["healthcare"="hospital"](around:{radius},{lat},{lon});
          
          node["healthcare"="clinic"](around:{radius},{lat},{lon});
          way["healthcare"="clinic"](around:{radius},{lat},{lon});
          
          node["building"="hospital"](around:{radius},{lat},{lon});
        );
        out center;
        """
    return query

def parse_overpass_response(response_json):
    """
    Extract useful and normalized structure from complex OSM data output.
    Adds metadata for ranking algorithms (has_name, address_completeness).
    Extracts phone and opening_hours if available.
    """
    places = []
    if not response_json or 'elements' not in response_json:
        return places
    
    for element in response_json['elements']:
        # Point/Node has lat/lon, Way/Polygon has 'center' lat/lon due to `out center;`
        lat = element.get('lat') or (element.get('center', {}).get('lat'))
        lon = element.get('lon') or (element.get('center', {}).get('lon'))
        tags = element.get('tags', {})
        
        type_str = tags.get('amenity', tags.get('healthcare', tags.get('shop', 'Facility'))).title()
        type_str = type_str.replace('_', ' ')
        
        name = tags.get('name', tags.get('name:en', ''))
        has_name = 1
        if not name:
            name = f"Unnamed {type_str}"
            has_name = 0
            
        # Address concatenation
        addr_housenumber = tags.get('addr:housenumber', '')
        addr_street = tags.get('addr:street', '')
        addr_city = tags.get('addr:city', '')
        addr_postcode = tags.get('addr:postcode', '')
        
        address_parts = [p for p in [addr_housenumber, addr_street, addr_city, addr_postcode] if p]
        address = ", ".join(address_parts) if address_parts else "Address not available"
        address_completeness = len(address_parts)
        
        opening_hours = tags.get('opening_hours', '')
        phone = tags.get('phone', tags.get('contact:phone', ''))
        
        if lat and lon:
            places.append({
                'id': element['id'],
                'name': name,
                'address': address,
                'lat': lat,
                'lon': lon,
                'type': type_str,
                'opening_hours': opening_hours,
                'phone': phone,
                'has_name': has_name,
                'address_completeness': address_completeness
            })
            
    return places
