import os
import datetime
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from config import Config, DevelopmentConfig, ProductionConfig
from services.location_service import geocode_location, fetch_nearby_places, sort_by_distance, get_emergency_contacts, get_cached_result, set_cached_result
import hashlib

# Setup file logger for geospatial search tracking
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)
search_logger = logging.getLogger('search_logger')
search_logger.setLevel(logging.INFO)
file_handler = RotatingFileHandler(os.path.join(log_dir, 'search.log'), maxBytes=2000000, backupCount=5)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
search_logger.addHandler(file_handler)

app = Flask(__name__)

# Load config based on environment variable (defaults to Development)
if os.environ.get('FLASK_ENV') == 'production':
    app.config.from_object(ProductionConfig)
else:
    app.config.from_object(DevelopmentConfig)

CORS(app)

# In-memory analytics storage for demonstration purposes 
# (In a real app, use SQLite/PostgreSQL/Redis)
analytics_data = {
    'total_searches': 0,
    'cities_searched': {},
    'services_searched': {},
    'recent_searches': []
}

def record_analytics(city, service_type):
    """Helper to track search trends for the dashboard."""
    analytics_data['total_searches'] += 1
    
    if city:
        city_name = city.title()
        analytics_data['cities_searched'][city_name] = analytics_data['cities_searched'].get(city_name, 0) + 1
    
    analytics_data['services_searched'][service_type] = analytics_data['services_searched'].get(service_type, 0) + 1
    
    analytics_data['recent_searches'].insert(0, {
        'timestamp': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'city': city or "Auto-Location",
        'service_type': service_type.replace('_', ' ').title()
    })
    
    # Keep only the last 50 recent searches
    if len(analytics_data['recent_searches']) > 50:
        analytics_data['recent_searches'].pop()

# --- ROUTES ---

@app.route('/')
def index():
    """Renders the modern home page with search and AI assistant."""
    return render_template('index.html')

@app.route('/results')
def results():
    """Renders the map and results grid."""
    return render_template('results.html')

@app.route('/dashboard')
def dashboard():
    """Renders the admin analytics dashboard."""
    return render_template('dashboard.html')

@app.route('/search', methods=['POST'])
def search():
    """Legacy/Form post fallback if needed. Frontend predominantly uses Fetch/AJAX."""
    locality = request.form.get('locality')
    city = request.form.get('city')
    service_type = request.form.get('type')
    return redirect(url_for('results', locality=locality, city=city, type=service_type))

@app.route('/api/nearby', methods=['GET'])
def api_nearby():
    """
    Main API endpoint to fetch nearby healthcare facilities.
    Accepts: ?locality=Name, ?city=Name OR ?lat=x&lon=y, ?type=hospital|pharmacy|blood_bank
    """
    locality = request.args.get('locality', '')
    city = request.args.get('city', '')
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    service_type = request.args.get('type', 'hospital')

    # Log analytics
    record_analytics(city or locality, service_type)

    if not lat or not lon:
        if not locality and not city:
            return jsonify({'error': 'Please provide a location/city name or latitude and longitude.'}), 400
        
        # Geocode location to coordinates (Dual-strategy)
        lat, lon = geocode_location(locality, city)
        if not lat or not lon:
            # Bug 3 constraint: never show error to user, but we can't show a map if we don't know where they are.
            # Assuming client side validation prevents this usually.
            return jsonify({'error': 'Location not found in India database.'}), 404

    try:
        lat, lon = float(lat), float(lon)
    except ValueError:
        return jsonify({'error': 'Invalid latitude or longitude format.'}), 400

    # Feature 5: Check Cache
    query_str = f"{lat}_{lon}_{service_type}"
    query_hash = hashlib.md5(query_str.encode('utf-8')).hexdigest()
    
    cached_data = get_cached_result(query_hash)
    if cached_data:
        return jsonify({
            'center': {'lat': lat, 'lon': lon},
            'results': cached_data['results'],
            'radius_used': cached_data['radius'],
            'cached': True
        }), 200

    # Map the service type to OSM tags
    osm_type = service_type
    if service_type == 'blood_bank':
        osm_type = 'blood_bank'

    # Fetch and process places (with progressive radius)
    places, final_radius = fetch_nearby_places(lat, lon, osm_type)
    
    # Bug 1 constraint: Never throw 404 for zero results. Return 200 with empty array so UI can show the Map empty state.
    sorted_places = sort_by_distance(places, lat, lon)

    # Save to cache
    set_cached_result(query_hash, {'results': sorted_places, 'radius': final_radius})

    return jsonify({
        'center': {'lat': lat, 'lon': lon},
        'results': sorted_places,
        'radius_used': final_radius,
        'cached': False
    }), 200

@app.route('/api/emergency', methods=['GET'])
def api_emergency():
    """Returns emergency contacts for a given city from local data."""
    city = request.args.get('city', 'Unknown')
    contacts = get_emergency_contacts(city)
    return jsonify({'contacts': contacts}), 200

@app.route('/api/stats', methods=['GET'])
def api_stats():
    """Returns the in-memory analytics data for the dashboard UI."""
    return jsonify(analytics_data), 200

# --- ERROR HANDLERS ---

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'error': 'Endpoint or resource not found. Check the URL.'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error occurred while processing the request.'}), 500

if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=app.config.get('DEBUG', True))
