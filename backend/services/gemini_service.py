"""
gemini_service.py — Facade để các router/service khác không phải đổi import.
Phần triển khai thực tế nằm trong services/itinerary/.
"""

from services.itinerary import generate_itinerary, generate_itinerary_resilient

__all__ = ["generate_itinerary", "generate_itinerary_resilient"]