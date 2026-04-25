"""
Facade cho khối tạo itinerary bằng Gemini.

File này giữ API cũ để các router/service khác không phải đổi import,
nhưng phần triển khai thực tế đã được tách nhỏ vào `services/itinerary/`.
"""

from services.itinerary import generate_itinerary, generate_itinerary_resilient

__all__ = ["generate_itinerary", "generate_itinerary_resilient"]
