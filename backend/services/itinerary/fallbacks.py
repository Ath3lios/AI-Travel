import math
import unicodedata

from .providers import get_top_places_from_db, get_top_places_from_goong, get_weather_forecast
from .runtime import DB_CONTEXT
from .style_profiles import summarize_travel_styles


DESTINATION_CENTERS = {
    "ha noi": (21.0285, 105.8542),
    "hanoi": (21.0285, 105.8542),
    "ho chi minh": (10.7769, 106.7009),
    "sai gon": (10.7769, 106.7009),
    "da nang": (16.0471, 108.2068),
    "hoi an": (15.8801, 108.3380),
    "hue": (16.4637, 107.5909),
    "sapa": (22.3364, 103.8438),
    "sa pa": (22.3364, 103.8438),
    "phu quoc": (10.2899, 103.9840),
    "da lat": (11.9404, 108.4583),
    "dalat": (11.9404, 108.4583),
    "nha trang": (12.2388, 109.1967),
    "ha long": (20.9101, 107.1839),
    "vinh ha long": (20.9101, 107.1839),
    "ninh binh": (20.2506, 105.9745),
    "moc chau": (20.8297, 104.7280),
    "mui ne": (10.9333, 108.2833),
    "quy nhon": (13.7820, 109.2190),
    "can tho": (10.0452, 105.7469),
    "vung tau": (10.4114, 107.1362),
}

VIETNAM_BOUNDS = {
    "lat_min": 8.4,
    "lat_max": 23.4,
    "lng_min": 102.1,
    "lng_max": 109.5,
}

PLACE_LABELS = {
    "restaurant": ["Quán ăn sáng", "Nhà hàng địa phương", "Quán ăn tối", "Quán đặc sản"],
    "attraction": ["Điểm tham quan trung tâm", "Khu check-in nổi bật", "Không gian văn hóa", "Điểm ngắm cảnh"],
    "hotel": ["Khách sạn trung tâm", "Homestay thuận tiện", "Khách sạn gần khu tham quan", "Nhà nghỉ sạch sẽ"],
    "route_stop": ["Điểm dừng chân", "Trạm nghỉ", "Khu nghỉ ngắn"],
}


def normalize_key(value: str) -> str:
    return (
        unicodedata.normalize("NFD", str(value or ""))
        .lower()
        .replace("đ", "d")
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
    )


def stable_ratio(value: str, salt: str) -> float:
    text = f"{value}|{salt}"
    total = 0
    for idx, char in enumerate(text):
        total = (total * 131 + ord(char) + idx) % 1_000_003
    return total / 1_000_003


def generated_center(city: str) -> tuple[float, float]:
    key = normalize_key(city) or "unknown"
    lat = VIETNAM_BOUNDS["lat_min"] + stable_ratio(key, "lat") * (VIETNAM_BOUNDS["lat_max"] - VIETNAM_BOUNDS["lat_min"])
    lng = VIETNAM_BOUNDS["lng_min"] + stable_ratio(key, "lng") * (VIETNAM_BOUNDS["lng_max"] - VIETNAM_BOUNDS["lng_min"])
    return round(lat, 6), round(lng, 6)


def destination_center(city: str) -> tuple[float, float]:
    key = normalize_key(str(city or "").split(",")[0])
    if not key:
        return generated_center("diem xuat phat")
    for name, coords in DESTINATION_CENTERS.items():
        if name in key or key in name:
            return coords
    return generated_center(key)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lng1 = a
    lat2, lng2 = b
    radius = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    x = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(x))


def interpolate_coords(start: tuple[float, float], end: tuple[float, float], ratio: float) -> tuple[float, float]:
    ratio = min(1, max(0, ratio))
    lat = start[0] + (end[0] - start[0]) * ratio
    lng = start[1] + (end[1] - start[1]) * ratio
    return round(lat, 6), round(lng, 6)


def offset_coords(center: tuple[float, float], index: int) -> tuple[float, float]:
    angle = math.radians((index * 137.5) % 360)
    radius = 0.004 + (index % 6) * 0.0018
    lat = center[0] + math.cos(angle) * radius
    lng = center[1] + math.sin(angle) * radius
    return round(lat, 6), round(lng, 6)


def transport_label(distance_km: float) -> str:
    if distance_km >= 300:
        return "Máy bay hoặc tàu/xe khách liên tỉnh"
    if distance_km >= 120:
        return "Tàu hỏa hoặc xe khách liên tỉnh"
    if distance_km >= 30:
        return "Xe khách, ô tô riêng hoặc taxi liên tỉnh"
    return "Taxi/GrabCar hoặc xe máy"


def travel_duration(distance_km: float) -> str:
    if distance_km >= 300:
        return "1.5-3 giờ bay hoặc 8-14 giờ đi tàu/xe"
    if distance_km >= 120:
        return "3-6 giờ"
    if distance_km >= 30:
        return "1-2.5 giờ"
    return "30-60 phút"


def estimate_price_range_from_budget(budget: str) -> str:
    try:
        amount = int(str(budget).replace(",", "").strip())
    except Exception:
        amount = 0
    if amount <= 2_000_000:
        return "400k-900k/đêm"
    if amount <= 4_500_000:
        return "800k-1.8tr/đêm"
    return "1.5-4tr/đêm"


def safe_int(value, default: int = 0) -> int:
    try:
        return int(str(value).replace(",", "").strip())
    except Exception:
        return default


def fmt_vnd(value: int) -> str:
    value = max(0, int(value))
    return f"{value:,}".replace(",", ".") + "đ"


def synthetic_places(city: str, category: str, limit: int, *, center: tuple[float, float] | None = None) -> list[dict]:
    center = center or destination_center(city)
    labels = PLACE_LABELS.get(category, ["Địa điểm gợi ý"])
    places = []
    for idx in range(max(1, limit)):
        lat, lng = offset_coords(center, idx + 1)
        places.append({
            "name": f"{labels[idx % len(labels)]} {city} #{idx + 1}",
            "address": city,
            "lat": lat,
            "lng": lng,
            "source": "offline_fallback",
        })
    return places


def route_stop_places(departure_city: str, destination: str, limit: int) -> list[dict]:
    start = destination_center(departure_city)
    end = destination_center(destination)
    labels = PLACE_LABELS["route_stop"]
    places = []
    for idx in range(max(1, limit)):
        ratio = (idx + 1) / (limit + 1)
        lat, lng = interpolate_coords(start, end, ratio)
        places.append({
            "name": f"{labels[idx % len(labels)]} trên tuyến {departure_city or 'điểm xuất phát'} - {destination} #{idx + 1}",
            "address": f"Tuyến {departure_city or 'điểm xuất phát'} - {destination}",
            "lat": lat,
            "lng": lng,
            "source": "offline_route_fallback",
        })
    return places


def safe_weather_forecast(destination: str, days: int) -> dict:
    try:
        return get_weather_forecast(destination, min(days, 7)) or {}
    except Exception as exc:
        return {"city": destination, "forecast": [], "source": "offline_fallback", "error": str(exc)}


def safe_top_places(destination: str, category: str, limit: int) -> list[dict]:
    """
    Lấy địa điểm cho fallback theo thứ tự ưu tiên:
      1. Catalog DB (lọc theo destination/city) — tận dụng dữ liệu đã sync từ itinerary.
      2. Goong API / nominatim mock — nếu DB không đủ.
      3. Synthetic offline — nếu cả hai đều thất bại hoặc trả về rỗng.

    Kết quả được gộp và dedup theo tên để đảm bảo đủ `limit` item.
    """
    places: list[dict] = []
    seen_names: set[str] = set()

    def _add(items: list[dict]) -> None:
        for p in items:
            name = str(p.get("name") or "").strip().lower()
            if name and name not in seen_names:
                seen_names.add(name)
                places.append(p)

    # ── Bước 1: Catalog DB ──────────────────────────────────
    db = DB_CONTEXT.get()
    if db is not None:
        try:
            db_places = get_top_places_from_db(db, destination, category, limit)
            _add(db_places)
        except Exception:
            pass

    if len(places) >= limit:
        return places[:limit]

    # ── Bước 2: Goong / mock ────────────────────────────────
    try:
        data = get_top_places_from_goong(destination, category, limit) or {}
        _add(data.get("places") or [])
    except Exception:
        pass

    if len(places) >= limit:
        return places[:limit]

    # ── Bước 3: Synthetic offline ───────────────────────────
    _add(synthetic_places(destination, category, limit))

    return places[:limit]


def fresh_top_places(destination: str, category: str, limit: int) -> list[dict]:
    """
    Lấy địa điểm cho luồng AI bình thường theo hướng dữ liệu mới:
      1. Goong API / mock.
      2. Catalog DB nếu Goong không có kết quả.

    Không dùng synthetic offline ở đây vì synthetic chỉ phù hợp fallback itinerary.
    """
    try:
        data = get_top_places_from_goong(destination, category, limit) or {}
        places = data.get("places") or []
        if places:
            return places[:limit]
    except Exception:
        pass

    db = DB_CONTEXT.get()
    if db is not None:
        try:
            return get_top_places_from_db(db, destination, category, limit)[:limit]
        except Exception:
            pass

    return []


def pick_place(places: list[dict], index: int, city: str, label: str) -> dict:
    if places:
        place = places[min(index, len(places) - 1)]
        return {
            "name": str(place.get("name") or f"{label} {index + 1}").strip(),
            "address": str(place.get("address") or city).strip(),
            "lat": float(place.get("lat") or 0),
            "lng": float(place.get("lng") or 0),
        }
    place = synthetic_places(city, "attraction", index + 1)[index]
    return {
        "name": str(place.get("name") or f"{label} {index + 1}").strip(),
        "address": str(place.get("address") or city).strip(),
        "lat": float(place.get("lat") or 0),
        "lng": float(place.get("lng") or 0),
    }


def fallback_schedule_item(
    *,
    time: str,
    period: str,
    place: str,
    address: str,
    lat: float = 0.0,
    lng: float = 0.0,
    estimated_cost: str = "",
    duration: str = "",
    description: str = "",
    tips: str = "",
    highlights: list[str] | None = None,
    transport_to_next: str = "",
) -> dict:
    return {
        "time": time,
        "period": period,
        "place": place,
        "address": address,
        "lat": lat,
        "lng": lng,
        "description": description,
        "estimated_cost": estimated_cost,
        "duration": duration,
        "tips": tips,
        "highlights": highlights or [],
        "best_for": "",
        "nearby": "",
        "opening_hours": "",
        "entrance_fee": "",
        "website": "",
        "transport_to_next": transport_to_next,
    }


def _first_matching_style(style_canonicals: list[str], candidates: list[str]) -> str | None:
    for candidate in candidates:
        if candidate in style_canonicals:
            return candidate
    return None


def _preferred_attraction_label(style_canonicals: list[str], slot: str) -> str:
    slot_preferences = {
        "morning": {
            "history": "Di tích lịch sử",
            "culture": "Không gian văn hóa",
            "mountain_nature": "Điểm ngắm cảnh thiên nhiên",
            "beach": "Bãi biển / cung ven biển",
            "adventure": "Điểm khám phá ngoài trời",
            "family": "Điểm vui chơi gia đình",
            "checkin": "Landmark check-in",
            "romantic": "Điểm hẹn cảnh đẹp",
            "relaxation": "Không gian thư giãn",
        },
        "afternoon": {
            "mountain_nature": "Cung cảnh quan / đồi núi",
            "beach": "Điểm ngắm biển / đảo",
            "checkin": "Điểm chụp ảnh nổi bật",
            "culture": "Làng nghề / không gian bản địa",
            "history": "Công trình lịch sử",
            "adventure": "Hoạt động khám phá",
            "family": "Điểm trải nghiệm nhẹ nhàng",
            "shopping": "Khu mua sắm / đặc sản",
            "relaxation": "Cafe / spa / điểm chill",
            "romantic": "View đẹp buổi chiều",
        },
        "late": {
            "nightlife": "Khu phố đêm / điểm giải trí tối",
            "shopping": "Chợ đêm / phố mua sắm",
            "romantic": "Điểm ngắm hoàng hôn",
            "beach": "Bờ biển chiều muộn",
            "checkin": "Spot ánh sáng đẹp cuối ngày",
            "relaxation": "Không gian thư giãn cuối ngày",
            "family": "Điểm đi dạo dễ chịu",
        },
    }
    selected = _first_matching_style(style_canonicals, list(slot_preferences[slot].keys()))
    return slot_preferences[slot].get(selected, "Điểm tham quan")


def _accommodation_why(style_canonicals: list[str]) -> str:
    if "relaxation" in style_canonicals:
        return "Ưu tiên không gian yên tĩnh, nghỉ ngơi tốt và thuận tiện thư giãn cuối ngày."
    if "romantic" in style_canonicals:
        return "Ưu tiên nơi lưu trú có view đẹp, riêng tư và phù hợp trải nghiệm cho cặp đôi."
    if "family" in style_canonicals:
        return "Ưu tiên nơi ở an toàn, dễ di chuyển và phù hợp nhóm gia đình nhiều độ tuổi."
    if "beach" in style_canonicals:
        return "Ưu tiên nơi ở thuận tiện ra biển và dễ đón các hoạt động sáng sớm hoặc hoàng hôn."
    if "nightlife" in style_canonicals:
        return "Ưu tiên nơi ở gần khu trung tâm để thuận tiện cho hoạt động tối nhưng vẫn dễ quay về nghỉ."
    return "Gần khu trung tâm, thuận tiện di chuyển theo lịch trình fallback."


def _packing_list(style_canonicals: list[str]) -> list[str]:
    items = ["Giày đi bộ", "Áo khoác mỏng", "Kem chống nắng", "Tiền mặt dự phòng", "Giấy tờ tùy thân", "Sạc dự phòng"]
    extras = {
        "beach": ["Đồ bơi", "Kính mát"],
        "mountain_nature": ["Giày bám tốt", "Áo chống gió mỏng"],
        "food": ["Thuốc tiêu hóa cơ bản"],
        "checkin": ["Pin dự phòng cho điện thoại"],
        "adventure": ["Bình nước cá nhân"],
        "family": ["Đồ dùng cá nhân cho trẻ em"],
        "romantic": ["Trang phục đẹp cho buổi tối"],
        "shopping": ["Túi gấp gọn để đựng đồ mua sắm"],
        "nightlife": ["Áo khoác nhẹ cho buổi tối"],
        "relaxation": ["Dép thoải mái", "Đồ dùng chăm sóc cá nhân"],
    }
    for style in style_canonicals:
        for item in extras.get(style, []):
            if item not in items:
                items.append(item)
    return items


def _style_day_suffix(style_canonicals: list[str], day_no: int, safe_days: int) -> str:
    if "romantic" in style_canonicals and day_no in {1, safe_days}:
        return " • nhịp đi lãng mạn"
    if "nightlife" in style_canonicals and day_no == safe_days:
        return " • thiên về buổi tối"
    if "relaxation" in style_canonicals:
        return " • nhịp đi thư giãn"
    if "adventure" in style_canonicals:
        return " • nhịp đi khám phá"
    return ""


def build_fallback_itinerary(
    destination: str,
    days: int,
    budget: str,
    travel_style: list,
    people: int,
    departure_city: str,
    *,
    fail_reason: str = "",
) -> dict:
    safe_days = max(1, int(days or 1))
    safe_people = max(1, int(people or 1))
    budget_int = max(1_000_000, safe_int(budget, 3_000_000))
    per_day = max(300_000, budget_int // safe_days)
    style_profile = summarize_travel_styles(travel_style)
    style_labels = style_profile["labels"]
    style_canonicals = style_profile["canonicals"]
    style_note = ", ".join(style_labels) if style_labels else "cân bằng"
    style_agent_note = style_profile["agent_note"]
    start_city = departure_city or "Điểm xuất phát"
    start_center = destination_center(start_city)
    dest_center = destination_center(destination)
    distance_km = haversine_km(start_center, dest_center)
    is_long_trip = distance_km >= 120

    weather_data = safe_weather_forecast(destination, safe_days)
    weather_list = weather_data.get("forecast") or []
    weather_label = weather_list[0].get("condition", "Thời tiết ổn định") if weather_list else "Thời tiết ổn định"

    attractions = safe_top_places(destination, "attraction", max(12, safe_days * 4))
    restaurants = safe_top_places(destination, "restaurant", max(12, safe_days * 3))
    hotels = safe_top_places(destination, "hotel", 5)
    route_stops = route_stop_places(start_city, destination, max(3, safe_days))

    itinerary_days = []
    for day_idx in range(safe_days):
        day_no = day_idx + 1
        day_weather = weather_list[day_idx].get("condition", weather_label) if day_idx < len(weather_list) else weather_label

        breakfast = pick_place(restaurants, day_idx * 3 + 0, destination, "Quán ăn sáng")
        lunch = pick_place(restaurants, day_idx * 3 + 1, destination, "Quán ăn trưa")
        dinner = pick_place(restaurants, day_idx * 3 + 2, destination, "Quán ăn tối")
        spot1 = pick_place(attractions, day_idx * 4 + 0, destination, _preferred_attraction_label(style_canonicals, "morning"))
        spot2 = pick_place(attractions, day_idx * 4 + 1, destination, _preferred_attraction_label(style_canonicals, "afternoon"))
        spot3 = pick_place(attractions, day_idx * 4 + 2, destination, _preferred_attraction_label(style_canonicals, "late"))

        if "nightlife" in style_canonicals:
            dinner["name"] = f"{dinner['name']} - khu vui chơi tối"

        if "food" in style_canonicals:
            breakfast["name"] = f"{breakfast['name']} - món địa phương"
            lunch["name"] = f"{lunch['name']} - đặc sản vùng"
            dinner["name"] = f"{dinner['name']} - trải nghiệm ẩm thực"

        if is_long_trip and day_no == 1:
            route_breakfast = pick_place(route_stops, 0, destination, "Điểm dừng chân")
            route_lunch = pick_place(route_stops, 1, destination, "Điểm dừng chân")
            breakfast = {
                "name": f"Ăn sáng trước khi xuất phát tại {start_city}",
                "address": start_city,
                "lat": start_center[0],
                "lng": start_center[1],
            }
            lunch = {
                "name": route_lunch["name"],
                "address": route_lunch["address"],
                "lat": route_lunch["lat"],
                "lng": route_lunch["lng"],
            }
            spot1 = route_breakfast

        schedule = []
        if day_no == 1:
            schedule.append(fallback_schedule_item(
                time="06:30",
                period="Sáng",
                place=f"Di chuyển từ {start_city} đến {destination}",
                address=start_city,
                lat=start_center[0],
                lng=start_center[1],
                estimated_cost=fmt_vnd(max(150_000, per_day // 5)),
                duration=travel_duration(distance_km),
                description=f"Khởi hành từ {start_city} đến {destination}. Fallback dùng tọa độ offline để vẫn có tuyến khởi hành khi API bản đồ không khả dụng.",
                tips="Kiểm tra vé/xe trước ngày đi, chuẩn bị giấy tờ tùy thân và đến điểm đón sớm 30-45 phút.",
                highlights=["Điểm bắt đầu chuyến đi", transport_label(distance_km)],
            ))

        schedule.extend([
            fallback_schedule_item(
                time="08:00", period="Sáng",
                place=breakfast["name"], address=breakfast["address"],
                lat=breakfast["lat"], lng=breakfast["lng"],
                estimated_cost=fmt_vnd(max(40_000, per_day // 15)),
                duration="45 phút",
                description="Bữa sáng hoặc điểm nghỉ đầu ngày để giữ nhịp lịch trình.",
                tips=(
                    "Ưu tiên quán gần tuyến di chuyển, có chỗ gửi xe/hành lý và phục vụ nhanh."
                    if "family" not in style_canonicals
                    else "Ưu tiên quán sạch sẽ, chỗ ngồi thoải mái và phù hợp đi cùng trẻ nhỏ/người lớn tuổi."
                ),
                highlights=[
                    "Nạp năng lượng",
                    "Khởi động nhẹ nhàng" if "relaxation" in style_canonicals else "Thuận tiện theo tuyến",
                ],
            ),
            fallback_schedule_item(
                time="09:30", period="Sáng",
                place=spot1["name"], address=spot1["address"],
                lat=spot1["lat"], lng=spot1["lng"],
                estimated_cost=fmt_vnd(max(0, per_day // 12)),
                duration="1.5 giờ",
                description=(
                    f"Điểm dừng/tham quan được xếp theo hướng từ {start_city} đến {destination}, ưu tiên phù hợp với nhóm sở thích {style_note}."
                ),
                tips=(
                    "Nếu đây là điểm dừng trên đường, chỉ nghỉ vừa đủ để không trễ lịch nhận phòng hoặc lịch chiều."
                    if "adventure" not in style_canonicals
                    else "Có thể dành thêm thời gian khám phá nếu cung đường và thể lực cho phép, nhưng vẫn giữ mốc giờ trưa."
                ),
                highlights=[
                    "Theo tuyến hành trình",
                    "Có tọa độ hiển thị bản đồ",
                    "Không khí bản địa" if "culture" in style_canonicals else (
                        "Giá trị kể chuyện" if "history" in style_canonicals else (
                            "View thiên nhiên" if "mountain_nature" in style_canonicals else (
                                "Chụp ảnh đẹp" if "checkin" in style_canonicals else "Phù hợp mở đầu ngày"
                            )
                        )
                    ),
                ],
            ),
            fallback_schedule_item(
                time="11:30", period="Trưa",
                place=lunch["name"], address=lunch["address"],
                lat=lunch["lat"], lng=lunch["lng"],
                estimated_cost=fmt_vnd(max(70_000, per_day // 10)),
                duration="1 giờ",
                description="Ăn trưa và nghỉ ngơi ngắn trước lịch chiều.",
                tips=(
                    "Chọn quán có niêm yết giá rõ ràng, nhất là khi dừng ở khu du lịch hoặc trạm nghỉ."
                    if "food" not in style_canonicals
                    else "Ưu tiên món đặc sản đúng vùng và hỏi món signature của quán để bữa trưa có bản sắc hơn."
                ),
                highlights=[
                    "Bổ sung năng lượng",
                    "Giảm mệt khi di chuyển",
                    "Đặc sản địa phương" if "food" in style_canonicals else "Giữ nhịp lịch trình",
                ],
            ),
            fallback_schedule_item(
                time="14:00", period="Chiều",
                place=spot2["name"], address=spot2["address"],
                lat=spot2["lat"], lng=spot2["lng"],
                estimated_cost=fmt_vnd(max(0, per_day // 12)),
                duration="1.5 giờ",
                description=(
                    f"Tham quan điểm nổi bật tại {destination} hoặc gần tuyến đến điểm đến, ưu tiên sát với nhóm sở thích {style_note}."
                ),
                tips=(
                    "Tránh khung nắng gắt, mang nước uống và kiểm tra giờ mở cửa trước khi đi."
                    if "mountain_nature" not in style_canonicals
                    else "Ưu tiên khung giờ thoáng, mang nước uống và giày dễ di chuyển nếu điểm nằm ở đồi núi/cung ngoài trời."
                ),
                highlights=[
                    "Điểm chính trong ngày",
                    "Phù hợp chụp ảnh" if "checkin" in style_canonicals else "Dễ ghé trong lịch chiều",
                    "Không gian riêng tư" if "romantic" in style_canonicals else (
                        "Phù hợp gia đình" if "family" in style_canonicals else "Dễ cá nhân hóa"
                    ),
                ],
            ),
            fallback_schedule_item(
                time="16:30", period="Chiều",
                place=spot3["name"], address=spot3["address"],
                lat=spot3["lat"], lng=spot3["lng"],
                estimated_cost=fmt_vnd(max(0, per_day // 14)),
                duration="1 giờ",
                description=(
                    "Điểm kết hợp tham quan/relax trước buổi tối."
                    if "shopping" not in style_canonicals
                    else "Điểm ghé cuối chiều phù hợp để kết nối sang mua sắm, chợ địa phương hoặc khu trung tâm."
                ),
                tips=(
                    "Cuối chiều thường dễ chụp ảnh hơn; giữ sức cho hoạt động buổi tối."
                    if "romantic" not in style_canonicals
                    else "Đây là khung giờ phù hợp cho sunset, cafe view hoặc một điểm có không khí riêng tư hơn."
                ),
                highlights=[
                    "Dễ kết hợp ăn tối",
                    "Linh hoạt theo thời tiết" if "relaxation" not in style_canonicals else "Nhịp nhẹ, dễ thư giãn",
                    "Mua sắm cuối ngày" if "shopping" in style_canonicals else (
                        "Hoàng hôn đẹp" if "romantic" in style_canonicals else "Chốt lịch chiều"
                    ),
                ],
            ),
            fallback_schedule_item(
                time="18:30", period="Tối",
                place=dinner["name"], address=dinner["address"],
                lat=dinner["lat"], lng=dinner["lng"],
                estimated_cost=fmt_vnd(max(90_000, per_day // 8)),
                duration="1.5 giờ",
                description=(
                    "Ăn tối và tự do khám phá khu vực trung tâm."
                    if "nightlife" not in style_canonicals
                    else "Ăn tối rồi nối mạch sang khu phố đêm, chợ đêm hoặc hoạt động buổi tối phù hợp."
                ),
                tips=(
                    "Nên đặt bàn trước nếu đi nhóm đông; hỏi giá trước khi gọi món hải sản/đặc sản."
                    if "romantic" not in style_canonicals
                    else "Nếu muốn trải nghiệm lãng mạn hơn, nên đặt bàn trước ở quán có view đẹp hoặc không gian riêng tư."
                ),
                highlights=[
                    "Ẩm thực địa phương",
                    "Không khí buổi tối sôi động" if "nightlife" in style_canonicals else "Kết thúc ngày nhẹ nhàng",
                    "Phù hợp hẹn hò" if "romantic" in style_canonicals else (
                        "Đi cùng gia đình ổn định" if "family" in style_canonicals else "Khám phá trung tâm"
                    ),
                ],
            ),
        ])

        if day_no == safe_days:
            schedule.append(fallback_schedule_item(
                time="20:30",
                period="Tối",
                place=f"Di chuyển từ {destination} về {start_city}",
                address=destination,
                lat=dest_center[0],
                lng=dest_center[1],
                estimated_cost=fmt_vnd(max(150_000, per_day // 5)),
                duration=travel_duration(distance_km),
                description="Kết thúc chuyến đi và quay về điểm xuất phát.",
                tips="Sắp xếp check-out, phương tiện về và thời gian ra bến/sân bay sớm để tránh trễ chuyến.",
                highlights=["Điểm kết thúc tại điểm đến", transport_label(distance_km)],
            ))

        itinerary_days.append({
            "day": day_no,
            "title": (
                f"Ngày {day_no}: {start_city} - {destination}{_style_day_suffix(style_canonicals, day_no, safe_days)}"
                if day_no == 1
                else f"Ngày {day_no} tại {destination}{_style_day_suffix(style_canonicals, day_no, safe_days)}"
            ),
            "weather": day_weather,
            "schedule": schedule,
        })

    accommodation = []
    for idx, hotel in enumerate(hotels[:5]):
        accommodation.append({
            "name": str(hotel.get("name") or f"Khách sạn {destination} {idx + 1}"),
            "area": str(hotel.get("address") or destination),
            "price_range": estimate_price_range_from_budget(str(budget_int)),
            "why": _accommodation_why(style_canonicals),
            "lat": float(hotel.get("lat") or 0),
            "lng": float(hotel.get("lng") or 0),
        })

    total_cost = budget_int * safe_people
    notes = "Fallback offline: lịch trình được sinh không phụ thuộc Gemini, weather, Goong, geocoding hoặc routing."
    if fail_reason:
        notes += f" Reason: {fail_reason[:220]}"

    return {
        "trip_summary": {
            "destination": destination,
            "total_days": safe_days,
            "estimated_cost": f"Khoảng {fmt_vnd(total_cost)} / {safe_people} người",
            "best_time": "Mùa khô, tránh ngày mưa lớn",
            "weather_note": f"Điều kiện tham khảo: {weather_label}",
            "route_note": f"Tuyến fallback từ {start_city} đến {destination}, khoảng {round(distance_km)} km.",
        },
        "days": itinerary_days,
        "accommodation": accommodation,
        "packing_list": _packing_list(style_canonicals),
        "budget_breakdown": {
            "luu_tru": fmt_vnd(max(0, int(total_cost * 0.35))),
            "an_uong": fmt_vnd(max(0, int(total_cost * 0.25))),
            "di_chuyen": fmt_vnd(max(0, int(total_cost * 0.20))),
            "hoat_dong": fmt_vnd(max(0, int(total_cost * 0.15))),
            "mua_sam_phat_sinh": fmt_vnd(max(0, int(total_cost * 0.05))),
        },
        "agent_notes": f"{notes} Planning style labels: {style_note}. Canonical styles: {style_agent_note}.",
        "generation_source": "fallback_offline_route",
    }


def augment_accommodation_suggestions(itinerary: dict, destination: str, budget: str) -> dict:
    accommodation = itinerary.get("accommodation")
    if not isinstance(accommodation, list):
        accommodation = []
    existing_names = {str((h or {}).get("name", "")).strip().lower() for h in accommodation}
    need = max(0, 5 - len(accommodation))
    if need == 0:
        itinerary["accommodation"] = accommodation
        return itinerary

    for place in fresh_top_places(destination, "hotel", max(need + 2, 6)):
        name = str(place.get("name", "")).strip()
        if not name or name.lower() in existing_names:
            continue
        accommodation.append({
            "name": name,
            "area": place.get("address") or destination,
            "price_range": estimate_price_range_from_budget(budget),
            "why": "Vị trí thuận tiện, dùng được cả khi API ngoài không khả dụng.",
            "lat": place.get("lat"),
            "lng": place.get("lng"),
        })
        existing_names.add(name.lower())
        if len(accommodation) >= 5:
            break

    itinerary["accommodation"] = accommodation
    return itinerary
