"""Route untuk halaman HTML."""
from flask import Blueprint, jsonify, render_template

pages_bp = Blueprint("pages", __name__)


@pages_bp.route("/")
def index():
    """Dashboard."""
    return render_template("index.html")


@pages_bp.route("/simulator")
def simulator():
    """Halaman Circuit Simulator."""
    return render_template("simulator.html")


@pages_bp.route("/calculators")
def calculators():
    """Halaman kalkulator elektronika."""
    return render_template("calculators.html")


@pages_bp.route("/projects")
def projects():
    """Halaman Projects."""
    return render_template("projects.html")


@pages_bp.route("/history")
def history():
    """Halaman History."""
    return render_template("history.html")


@pages_bp.route("/health")
def health():
    """Endpoint sederhana untuk mengecek server hidup."""
    return jsonify(status="ok", app="ElectroLab")