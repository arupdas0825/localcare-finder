import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Base Configuration class."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-unsafe-dev-key')
    NOMINATIM_BASE_URL = os.environ.get('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org/search')
    OVERPASS_BASE_URL = os.environ.get('OVERPASS_BASE_URL', 'https://overpass-api.de/api/interpreter')
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    """Configuration used for local development."""
    DEBUG = os.environ.get('FLASK_DEBUG', 'True') == 'True'

class ProductionConfig(Config):
    """Configuration used for production environments."""
    DEBUG = False
    # Ensure production has a strong override for secret keys, etc.
