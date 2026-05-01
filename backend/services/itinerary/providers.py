import json
import math
import random

from database import Activity, Destination, Hotel
from sqlalchemy.orm import Session

from .runtime import DB_CONTEXT, DEFAULT_TIMEOUT, GOONG_KEY, GOONG_TIMEOUT, HTTP, OPENWEATHER_KEY


def http_get(url: str, *, params=None, headers=None, timeout: int = DEFAULT_TIMEOUT):
    return HTTP.get(url, params=params, headers=headers, timeout=timeout)


def json_response(payload: dict, ensure_ascii: bool = True) -> str:
    return json.dumps(payload, ensure_ascii=ensure_ascii)


# ══════════════════════════════════════════════════════════════════════════════
# WEATHER
# ══════════════════════════════════════════════════════════════════════════════

def get_weather_forecast(city: str, days: int) -> dict:
    if not OPENWEATHER_KEY:
        return {
            "city": city,
            "forecast": [
                {"day": i + 1, "condition": "Nắng nhẹ", "temp_high": 32,
                 "temp_low": 24, "humidity": 70}
                for i in range(min(days, 7))
            ],
            "source": "mock_data",
        }
    try:
        resp = http_get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={"q": city, "appid": OPENWEATHER_KEY, "units": "metric",
                    "cnt": min(days * 8, 40), "lang": "vi"},
        )
        resp.raise_for_status()
        data = resp.json()
        daily: dict = {}
        for item in data.get("list", []):
            date = item["dt_txt"][:10]
            if date not in daily:
                daily[date] = {"temps": [], "descs": []}
            daily[date]["temps"].append(item["main"]["temp"])
            daily[date]["descs"].append(item["weather"][0]["description"])
        forecast = []
        for i, (date, info) in enumerate(list(daily.items())[:days]):
            mid = len(info["descs"]) // 2
            forecast.append({
                "day": i + 1, "date": date,
                "condition": info["descs"][mid],
                "temp_high": round(max(info["temps"])),
                "temp_low": round(min(info["temps"])),
            })
        return {"city": city, "forecast": forecast, "source": "openweathermap"}
    except Exception as e:
        return {"city": city, "error": str(e), "forecast": [], "source": "error"}


# ══════════════════════════════════════════════════════════════════════════════
# PLACES
# ══════════════════════════════════════════════════════════════════════════════

def geocode_city(city: str) -> tuple:
    """Lấy tọa độ trung tâm thành phố qua Nominatim (OpenStreetMap, miễn phí)."""
    try:
        resp = http_get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": city + ", Vietnam", "format": "json", "limit": 1},
            headers={"User-Agent": "AI-Travel-Planner/1.0"},
        )
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return 21.0285, 105.8542  # fallback: Hà Nội


def get_top_places_from_goong(city: str, category: str, limit: int = 5) -> dict:
    """
    Gọi thẳng Goong API (hoặc Nominatim mock nếu chưa có key).
    Hàm này KHÔNG check DB — dùng cho fallback khi AI lỗi.
    """
    queries = {
        "restaurant": f"nhà hàng ngon {city}",
        "attraction": f"điểm tham quan nổi tiếng {city}",
        "hotel":      f"khách sạn {city}",
        "cafe":       f"quán cafe {city}",
        "shopping":   f"trung tâm mua sắm {city}",
    }
    query = queries.get(category, f"{category} {city}")

    if not GOONG_KEY:
        base_lat, base_lng = geocode_city(city)
        random.seed(hash(city + category) % 9999)
        offsets = []
        for i in range(max(limit, 20)):
            angle = (i * 137.5) % 360
            radius = 0.002 + (i % 5) * 0.0015
            offsets.append((
                round(radius * math.cos(math.radians(angle)), 6),
                round(radius * math.sin(math.radians(angle)), 6),
            ))
        cat_label = {
            "restaurant": "Nhà hàng", "attraction": "Điểm tham quan",
            "hotel": "Khách sạn",     "cafe": "Quán cafe",
            "shopping": "Khu mua sắm",
        }.get(category, "Địa điểm")
        places = [
            {
                "name":    f"{cat_label} {city} số {i + 1}",
                "address": city,
                "rating":  round(3.8 + (i % 12) * 0.1, 1),
                "lat":     round(base_lat + offsets[i][0], 6),
                "lng":     round(base_lng + offsets[i][1], 6),
            }
            for i in range(limit)
        ]
        return {"city": city, "category": category, "places": places, "source": "nominatim_mock"}

    try:
        resp = http_get(
            "https://rsapi.goong.io/Place/textsearch",
            params={"input": query, "api_key": GOONG_KEY},
            timeout=GOONG_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        places = []
        for row in (data.get("results") or [])[:limit]:
            loc = row.get("geometry", {}).get("location", {})
            places.append({
                "name":     row.get("name", ""),
                "address":  row.get("formatted_address", ""),
                "rating":   row.get("rating"),
                "lat":      loc.get("lat"),
                "lng":      loc.get("lng"),
                "place_id": row.get("place_id", ""),
            })
        return {"city": city, "category": category, "places": places, "source": "goong"}
    except Exception as e:
        return {"city": city, "category": category, "error": str(e),
                "places": [], "source": "error"}


def get_top_places_from_db(db: Session, city: str, category: str, limit: int) -> list[dict]:
    """Lấy địa điểm từ DB nội bộ (catalog)."""
    cat = (category or "").strip().lower()
    results: list[dict] = []

    if cat == "hotel":
        hotels = db.query(Hotel).order_by(
            Hotel.rating.desc().nullslast(), Hotel.created_at.desc()
        ).limit(limit).all()
        for h in hotels:
            results.append({"name": h.name, "address": h.address or "",
                             "rating": h.rating, "lat": h.lat, "lng": h.lng})
        return results

    activities_query = db.query(Activity)
    if cat:
        activities_query = activities_query.filter(Activity.category == cat)
    activities = activities_query.order_by(
        Activity.rating.desc().nullslast(), Activity.created_at.desc()
    ).limit(limit).all()
    for a in activities:
        results.append({"name": a.name, "address": a.address or "",
                        "rating": a.rating, "lat": a.lat, "lng": a.lng})
    if results:
        return results

    if cat in {"attraction", "shopping", "restaurant", "cafe"}:
        destinations = db.query(Destination).order_by(
            Destination.rating.desc().nullslast(), Destination.created_at.desc()
        ).limit(limit).all()
        for d in destinations:
            results.append({"name": d.name, "address": d.city or city,
                             "rating": d.rating, "lat": d.lat, "lng": d.lng})
    return results


def get_top_places(city: str, category: str, limit: int = 5) -> dict:
    """
    Hàm dùng cho AI agent tool: ưu tiên DB → Goong/mock.
    """
    db = DB_CONTEXT.get()
    if db is not None:
        places = get_top_places_from_db(db, city, category, limit)
        if places:
            return {"city": city, "category": category,
                    "places": places, "source": "catalog_db"}

    return get_top_places_from_goong(city, category, limit)


# ══════════════════════════════════════════════════════════════════════════════
# EXCHANGE RATE
# ══════════════════════════════════════════════════════════════════════════════

def get_exchange_rate(from_currency: str, to_currency: str) -> dict:
    try:
        from_lower = from_currency.lower()
        to_lower   = to_currency.lower()
        url = f"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{from_lower}.json"
        resp = http_get(url)
        resp.raise_for_status()
        data = resp.json()
        rate = data.get(from_lower, {}).get(to_lower)
        if rate:
            return {"from": from_currency.upper(), "to": to_currency.upper(),
                    "rate": rate, "source": "fawazahmed0"}
        return {"from": from_currency.upper(), "to": to_currency.upper(),
                "error": "Không tìm thấy cặp tiền tệ", "source": "fawazahmed0"}
    except Exception:
        try:
            url2 = f"https://latest.currency-api.pages.dev/v1/currencies/{from_lower}.json"
            resp2 = http_get(url2)
            resp2.raise_for_status()
            data2 = resp2.json()
            rate2 = data2.get(from_lower, {}).get(to_lower)
            if rate2:
                return {"from": from_currency.upper(), "to": to_currency.upper(),
                        "rate": rate2, "source": "fawazahmed0-fallback"}
        except Exception:
            pass
        mock_rates = {
            ("USD", "VND"): 25400, ("EUR", "VND"): 27500,
            ("JPY", "VND"): 170,   ("KRW", "VND"): 19,
            ("CNY", "VND"): 3500,  ("THB", "VND"): 710,
        }
        rate_mock = mock_rates.get((from_currency.upper(), to_currency.upper()), 1)
        return {"from": from_currency.upper(), "to": to_currency.upper(),
                "rate": rate_mock, "source": "mock_data"}