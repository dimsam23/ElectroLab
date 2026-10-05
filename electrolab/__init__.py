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
    static_folder = os.path.join(BASE_DIR, 'public')
    template_folder = os.path.join(BASE_DIR, 'electrolab', 'templates')
    app = Flask(__name__, static_folder=static_folder, static_url_path='', template_folder=template_folder)

    # Konfigurasi Database
    db_url = os.environ.get('DATABASE_URL', 'sqlite:///local.db')
    
    # Transform postgres:// ke postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    # Hapus +pg8000 jika ada (gunakan driver default psycopg2)
    if '+pg8000' in db_url:
        db_url = db_url.replace('+pg8000', '')

    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")

    # Set a writable instance path for serverless environments (Vercel)
    app.instance_path = os.path.join('/tmp', 'instance')
    os.makedirs(app.instance_path, exist_ok=True)
    db.init_app(app)

    # Serve static files directly from /public route
    @app.route('/css/<path:filename>')
    def serve_css(filename):
        from flask import send_from_directory
        return send_from_directory(os.path.join(static_folder, 'css'), filename)
    
    @app.route('/js/<path:filename>')
    def serve_js(filename):
        from flask import send_from_directory
        return send_from_directory(os.path.join(static_folder, 'js'), filename)
    
    @app.route('/images/<path:filename>')
    def serve_images(filename):
        from flask import send_from_directory
        return send_from_directory(os.path.join(static_folder, 'images'), filename)

    # Daftarkan blueprint
    from .routes.api_calculators import api_calculators_bp
    from .routes.pages import pages_bp
    from .routes.projects_api import projects_bp # Import route baru

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_calculators_bp)
    app.register_blueprint(projects_bp)

    # Buat tabel (skip on serverless cold start if unnecessary/risky to avoid 500)
    try:
        with app.app_context():
            db.create_all()
    except Exception as e:
        print("Warning: Could not create tables automatically:", e)

    return app