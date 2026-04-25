from .providers import get_top_places, get_weather_forecast


def estimate_price_range_from_budget(budget: str) -> str:
    try:
        amount = int(str(budget).replace(",", "").strip())
    except Exception:
        amount = 0
    if amount <= 2000000:
        return "400k-900k/đêm"
    if amount <= 4500000:
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


def pick_place(places: list[dict], index: int, city: str, label: str) -> dict:
    if places:
        place = places[index % len(places)]
        return {
            "name": str(place.get("name") or f"{label} {index + 1}").strip(),
            "address": str(place.get("address") or city).strip(),
            "lat": float(place.get("lat") or 0),
            "lng": float(place.get("lng") or 0),
        }
    return {"name": f"{label} {index + 1}", "address": city, "lat": 0.0, "lng": 0.0}


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
        "transport_to_next": "",
    }


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

    weather_data = get_weather_forecast(destination, min(safe_days, 7))
    weather_list = weather_data.get("forecast") or []
    weather_label = weather_list[0].get("condition", "Thời tiết ổn định") if weather_list else "Thời tiết ổn định"

    attractions = (get_top_places(destination, "attraction", max(10, safe_days * 4)) or {}).get("places") or []
    restaurants = (get_top_places(destination, "restaurant", max(8, safe_days * 3)) or {}).get("places") or []
    hotels = (get_top_places(destination, "hotel", 5) or {}).get("places") or []

    itinerary_days = []
    for day_idx in range(safe_days):
        day_no = day_idx + 1
        day_weather = weather_list[day_idx].get("condition", weather_label) if day_idx < len(weather_list) else weather_label

        breakfast = pick_place(restaurants, day_idx * 3 + 0, destination, "Quán ăn sáng")
        lunch = pick_place(restaurants, day_idx * 3 + 1, destination, "Quán ăn trưa")
        dinner = pick_place(restaurants, day_idx * 3 + 2, destination, "Quán ăn tối")
        spot1 = pick_place(attractions, day_idx * 4 + 0, destination, "Điểm tham quan")
        spot2 = pick_place(attractions, day_idx * 4 + 1, destination, "Điểm tham quan")
        spot3 = pick_place(attractions, day_idx * 4 + 2, destination, "Điểm tham quan")

        schedule = []
        if day_no == 1:
            schedule.append(fallback_schedule_item(
                time="06:30",
                period="Sáng",
                place=f"Di chuyển từ {departure_city or 'Nơi xuất phát'} đến {destination}",
                address=departure_city or "Điểm xuất phát",
                estimated_cost=fmt_vnd(max(150_000, per_day // 5)),
                duration="2-4 giờ",
                description="Di chuyển đầu chuyến đi, ưu tiên phương án phù hợp ngân sách.",
                tips="Kiểm tra vé trước ngày đi, đến sớm 30-45 phút để tránh trễ chuyến.",
                highlights=["Chủ động thời gian", "Giảm rủi ro lỡ chuyến"],
            ))

        schedule.extend([
            fallback_schedule_item(
                time="08:00", period="Sáng", place=breakfast["name"], address=breakfast["address"],
                lat=breakfast["lat"], lng=breakfast["lng"], estimated_cost=fmt_vnd(max(40_000, per_day // 15)),
                duration="45 phút", description="Bữa sáng nhẹ để bắt đầu ngày tham quan.",
                tips="Nên đi trước 8h để tranh thủ thời gian tham quan buổi sáng.",
                highlights=["Đồ ăn địa phương", "Phục vụ nhanh"],
            ),
            fallback_schedule_item(
                time="09:30", period="Sáng", place=spot1["name"], address=spot1["address"],
                lat=spot1["lat"], lng=spot1["lng"], estimated_cost=fmt_vnd(max(0, per_day // 12)),
                duration="1.5 giờ", description=f"Khám phá điểm nổi bật tại {destination}.",
                tips="Nên mang nước uống, pin dự phòng và kiểm tra giờ mở cửa trước khi đi.",
                highlights=["Khung cảnh đặc trưng", "Phù hợp chụp ảnh"],
            ),
            fallback_schedule_item(
                time="11:30", period="Trưa", place=lunch["name"], address=lunch["address"],
                lat=lunch["lat"], lng=lunch["lng"], estimated_cost=fmt_vnd(max(70_000, per_day // 10)),
                duration="1 giờ", description="Ăn trưa và nghỉ ngơi ngắn.",
                tips="Nên chọn quán có niêm yết giá rõ ràng để tránh chặt chém.",
                highlights=["Bổ sung năng lượng", "Trải nghiệm ẩm thực địa phương"],
            ),
            fallback_schedule_item(
                time="14:00", period="Chiều", place=spot2["name"], address=spot2["address"],
                lat=spot2["lat"], lng=spot2["lng"], estimated_cost=fmt_vnd(max(0, per_day // 12)),
                duration="1.5 giờ", description="Tiếp tục tham quan theo cung đường gợi ý.",
                tips="Tránh khung 15h-16h nếu thời tiết nắng gắt, ưu tiên di chuyển có mái che.",
                highlights=["Đa dạng trải nghiệm", "Linh hoạt theo thời tiết"],
            ),
            fallback_schedule_item(
                time="16:30", period="Chiều", place=spot3["name"], address=spot3["address"],
                lat=spot3["lat"], lng=spot3["lng"], estimated_cost=fmt_vnd(max(0, per_day // 14)),
                duration="1 giờ", description="Điểm kết hợp tham quan/relax trước buổi tối.",
                tips="Nên chụp ảnh vào cuối chiều để ánh sáng đẹp hơn.",
                highlights=["Tiết kiệm thời gian di chuyển", "Dễ kết hợp ăn tối gần đó"],
            ),
            fallback_schedule_item(
                time="18:30", period="Tối", place=dinner["name"], address=dinner["address"],
                lat=dinner["lat"], lng=dinner["lng"], estimated_cost=fmt_vnd(max(90_000, per_day // 8)),
                duration="1.5 giờ", description="Ăn tối và tự do khám phá khu vực trung tâm.",
                tips="Nên đặt bàn trước với nhóm đông người để có chỗ ngồi tốt.",
                highlights=["Trải nghiệm buổi tối", "Phù hợp gia đình/nhóm bạn"],
            ),
        ])

        if day_no == safe_days:
            schedule.append(fallback_schedule_item(
                time="20:30",
                period="Tối",
                place=f"Di chuyển từ {destination} về {departure_city or 'Nơi xuất phát'}",
                address=destination,
                estimated_cost=fmt_vnd(max(150_000, per_day // 5)),
                duration="2-4 giờ",
                description="Kết thúc chuyến đi và quay về.",
                tips="Sắp xếp thời gian check-out và phương tiện về sớm để tránh kẹt xe.",
                highlights=["Kết thúc hợp lý", "Dễ quản lý hành lý"],
            ))

        itinerary_days.append({"day": day_no, "title": f"Ngày {day_no} tại {destination}", "weather": day_weather, "schedule": schedule})

    accommodation = []
    for idx in range(min(3, len(hotels))):
        hotel = hotels[idx]
        accommodation.append({
            "name": str(hotel.get("name") or f"Khách sạn {destination} {idx + 1}"),
            "area": str(hotel.get("address") or destination),
            "price_range": estimate_price_range_from_budget(str(budget_int)),
            "why": "Gần khu trung tâm và thuận tiện di chuyển.",
            "lat": float(hotel.get("lat") or 0),
            "lng": float(hotel.get("lng") or 0),
        })

    total_cost = budget_int * safe_people
    style_note = ", ".join(travel_style or []) if travel_style else "cân bằng"
    notes = "Fallback itinerary due to AI provider failure."
    if fail_reason:
        notes += f" Reason: {fail_reason[:220]}"

    return {
        "trip_summary": {
            "destination": destination,
            "total_days": safe_days,
            "estimated_cost": f"Khoảng {fmt_vnd(total_cost)} / {safe_people} người",
            "best_time": "Mùa khô, tránh ngày mưa lớn",
            "weather_note": f"Điều kiện tham khảo: {weather_label}",
        },
        "days": itinerary_days,
        "accommodation": accommodation,
        "packing_list": ["Giày đi bộ", "Áo khoác mỏng", "Kem chống nắng", "Tiền mặt dự phòng", "Giấy tờ tùy thân"],
        "budget_breakdown": {
            "luu_tru": fmt_vnd(max(0, int(total_cost * 0.35))),
            "an_uong": fmt_vnd(max(0, int(total_cost * 0.25))),
            "di_chuyen": fmt_vnd(max(0, int(total_cost * 0.20))),
            "hoat_dong": fmt_vnd(max(0, int(total_cost * 0.15))),
            "mua_sam_phat_sinh": fmt_vnd(max(0, int(total_cost * 0.05))),
        },
        "agent_notes": f"{notes} Planning style: {style_note}.",
        "generation_source": "fallback_rule_based",
    }


def augment_accommodation_suggestions(itinerary: dict, destination: str, budget: str) -> dict:
    accommodation = itinerary.get("accommodation")
    if not isinstance(accommodation, list):
        accommodation = []
    existing_names = {str((hotel or {}).get("name", "")).strip().lower() for hotel in accommodation}
    need = max(0, 5 - len(accommodation))
    if need == 0:
        itinerary["accommodation"] = accommodation
        return itinerary

    hotel_candidates = get_top_places(destination, "hotel", max(need + 2, 6))
    places = (hotel_candidates or {}).get("places") or []
    added = 0
    for place in places:
        name = str(place.get("name", "")).strip()
        if not name or name.lower() in existing_names:
            continue
        accommodation.append({
            "name": name,
            "area": place.get("address") or destination,
            "price_range": estimate_price_range_from_budget(budget),
            "why": "Vi tri thuan tien, danh gia tot tu du lieu dia diem.",
            "lat": place.get("lat"),
            "lng": place.get("lng"),
        })
        existing_names.add(name.lower())
        added += 1
        if added >= need:
            break

    itinerary["accommodation"] = accommodation
    return itinerary
