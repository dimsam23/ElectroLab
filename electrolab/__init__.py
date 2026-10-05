"""Application factory untuk ElectroLab."""
import os
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv() # Pastikan load_dotenv di sini

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, static_folder='../public', static_url_path='')

    # Konfigurasi Database
    db_url = os.environ.get('DATABASE_URL', 'sqlite:///local.db')
    
    # Transform postgres:// ke postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    # Add pg8000 driver jika belum ada
    if 'postgresql' in db_url and '+pg8000' not in db_url:
        db_url = db_url.replace('postgresql://', 'postgresql+pg8000://', 1)
    
    # Hapus query params (sslmode, etc) karena pg8000 tidak support kwarg tersebut
    if '?' in db_url:
        db_url = db_url.split('?')[0]

    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")

    # Set a writable instance path for serverless environments (Vercel)
    import os
    app.instance_path = os.path.join('/tmp', 'instance')
    os.makedirs(app.instance_path, exist_ok=True)
    db.init_app(app)

    # Daftarkan blueprint
    from .routes.api_calculators import api_calculators_bp
    from .routes.pages import pages_bp
    from .routes.projects_api import projects_bp # Import route baru

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_calculators_bp)
    app.register_blueprint(projects_bp)

    # Buat tabel
    with app.app_context():
        db.create_all()

    return app