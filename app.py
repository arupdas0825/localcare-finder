import os
import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
from config import Config, DevelopmentConfig, ProductionConfig
from services.location_service import geocode_city, fetch_nearby_places, sort_by_distance, get_emergency_contacts

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
    city = request.form.get('city')
    service_type = request.form.get('type')
    return redirect(url_for('results', city=city, type=service_type))

@app.route('/api/nearby', methods=['GET'])
def api_nearby():
    """
    Main API endpoint to fetch nearby healthcare facilities.
    Accepts: ?city=Name OR ?lat=x&lon=y, ?type=hospital|pharmacy|blood_bank, ?radius=5000
    """
    city = request.args.get('city')
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    service_type = request.args.get('type', 'hospital')
    radius = int(request.args.get('radius', 5000))

    # Log analytics
    record_analytics(city, service_type)

    if not lat or not lon:
        if not city:
            return jsonify({'error': 'Please provide a city name or latitude and longitude.'}), 400
        
        # Geocode city to coordinates
        lat, lon = geocode_city(city)
        if not lat or not lon:
            return jsonify({'error': 'City not found or could not be geocoded.'}), 404

    try:
        lat, lon = float(lat), float(lon)
    except ValueError:
        return jsonify({'error': 'Invalid latitude or longitude format.'}), 400

    # Map the service type to OSM tags
    osm_type = service_type
    if service_type == 'blood_bank':
        osm_type = 'blood_bank'

    # Fetch and process places
    places = fetch_nearby_places(lat, lon, osm_type, radius)
    sorted_places = sort_by_distance(places, lat, lon)

    return jsonify({
        'center': {'lat': lat, 'lon': lon},
        'results': sorted_places
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
