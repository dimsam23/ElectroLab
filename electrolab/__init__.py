"""Application factory untuk ElectroLab."""
import os
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv()

db = SQLAlchemy()

def create_app():
    static_folder = os.path.join(BASE_DIR, 'static')
    template_folder = os.path.join(BASE_DIR, 'electrolab', 'templates')
    app = Flask(__name__, static_folder=static_folder, static_url_path='/static', template_folder=template_folder)

    # Paksa SQLite untuk Vercel (lebih stabil di serverless)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local.db'

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-change-me")

    # Writable instance path untuk Vercel
    app.instance_path = os.path.join('/tmp', 'instance')
    os.makedirs(app.instance_path, exist_ok=True)
    db.init_app(app)

    # Daftarkan blueprint
    from .routes.api_calculators import api_calculators_bp
    from .routes.pages import pages_bp
    from .routes.projects_api import projects_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_calculators_bp)
    app.register_blueprint(projects_bp)

    try:
        with app.app_context():
            db.create_all()
    except Exception as e:
        print("Warning: Could not create tables automatically:", e)

    return app
