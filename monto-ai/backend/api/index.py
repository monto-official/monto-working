"""
Vercel serverless entrypoint — imports the FastAPI app from main.py
Vercel looks for a callable named `app` in this file.
"""
import sys
import os

# Add the backend root to the path so imports from main.py work
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app  # noqa: F401 — Vercel needs `app` exported from this module
