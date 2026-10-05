"""Entrypoint untuk Vercel dan server lokal.

Vercel mencari variabel bernama `app` di file ini.
"""
from electrolab import create_app

app = create_app()