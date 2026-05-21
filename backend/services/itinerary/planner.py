from services.route_optimizer import optimize_itinerary_routes

from .agents import run_agent_langchain, run_agent_new_sdk, run_agent_old_sdk
from .fallbacks import augment_accommodation_suggestions, augment_schedule_coordinates, build_fallback_itinerary, fallback_schedule_item
from .runtime import DB_CONTEXT, USE_LANGCHAIN, USE_NEW_SDK
from .style_profiles import summarize_travel_styles


def is_rate_limit_error(error: Exception) -> bool:
    text = repr(error).lower()
    return any(token in text for token in (
        "429",
        "403",
        "quota",
        "forbidden",
        "permission_denied",
        "permission denied",
        "rate limit",
        "rate_limit",
        "resource_exhausted",
        "too many requests",
    ))


def finalize_itinerary(itinerary: dict, destination: str, budget: str) -> dict:
    try:
        itinerary = augment_schedule_coordinates(itinerary, destination)
    except Exception as coordinate_err:
        print("coordinate augmentation skipped:", repr(coordinate_err))

    try:
        itinerary = optimize_itinerary_routes(itinerary)
    except Exception as route_err:
        print("route optimization skipped:", repr(route_err))

    try:
        itinerary = augment_accommodation_suggestions(itinerary, destination, budget)
    except Exception as accommodation_err:
        print("accommodation augmentation skipped:", repr(accommodation_err))

    return itinerary


def generate_itinerary(
    destination: str,
    days: int,
    budget: str,
    travel_style: list,
    people: int,
    departure_city: str = "",
    planner_context: str = "",
    db=None,
) -> dict:
    style_profile = summarize_travel_styles(travel_style)
    style_labels = ", ".join(style_profile["labels"]) if style_profile["labels"] else "cân bằng"
    style_semantics = style_profile["prompt_semantics"]
    style_guidance = style_profile["prompt_guidance"]

    system_prompt = """Bạn là AI Travel Agent chuyên nghiệp.
PHẢI dùng tools trước khi tạo lịch trình:
  - get_weather_forecast: thời tiết thực tế tại điểm đến
  - get_top_places: địa điểm thực từ Goong Maps (có tọa độ lat/lng)
  - get_exchange_rate: nếu điểm đến dùng ngoại tệ

Mỗi schedule item PHẢI có lat/lng lấy từ kết quả get_top_places.
QUAN TRỌNG: Mỗi ngày phải có địa điểm KHÁC NHAU, không được lặp lại địa điểm giữa các ngày.

MỖI NGÀY PHẢI CÓ 6-7 HOẠT ĐỘNG theo ĐÚNG THỨ TỰ THỜI GIAN sau, KHÔNG được đảo lộn:
  1. 06:00-08:00 — Di chuyển đến điểm đến (CHỈ ngày đầu tiên)
  2. 08:00-09:00 — Ăn sáng        (period: "Sáng")
  3. 09:30-11:00 — Tham quan #1   (period: "Sáng")
  4. 11:30-13:00 — Ăn trưa        (period: "Trưa")   ← BẮT BUỘC trước 13:00
  5. 14:00-15:30 — Tham quan #2   (period: "Chiều")
  6. 16:30-17:30 — Tham quan #3   (period: "Chiều")
  7. 18:30-20:00 — Ăn tối         (period: "Tối")    ← BẮT BUỘC sau 18:00
  8. 20:30+      — Di chuyển về   (CHỈ ngày cuối cùng)

LUẬT BẮT BUỘC về thứ tự:
  - Field "time" trong schedule PHẢI tăng dần từ trên xuống dưới trong cùng một ngày
  - Ăn sáng → Tham quan sáng → Ăn trưa → Tham quan chiều → Ăn tối, không được đảo
  - Ăn trưa LUÔN xếp TRƯỚC ăn tối, không ngoại lệ
  - Không được xếp "Ăn tối" ở giữa các hoạt động ban ngày

Mỗi hoạt động phải có mô tả cụ thể, tips hữu ích và chi phí ước tính rõ ràng.

YÊU CẦU VỀ FIELD "tips" — RẤT QUAN TRỌNG:
Với mỗi địa điểm, "tips" phải là các lưu ý THỰC TẾ và CÓ THỂ HÀNH ĐỘNG NGAY:
  - Thời điểm tốt nhất để đến (giờ nào, tránh ngày nào)
  - Cần chuẩn bị gì (đặt vé trước, mang tiền mặt, dress code...)
  - Mẹo tiết kiệm hoặc trải nghiệm tốt hơn (combo vé, đường tắt, món phải thử...)
  - Cảnh báo thực tế (đông vào cuối tuần, đóng cửa thứ 2, giá chặt khách...)
TUYỆT ĐỐI KHÔNG viết tips chung chung như "địa điểm đẹp nên ghé thăm" hay "trải nghiệm thú vị"
"""

    places_needed = max(10, days * 4)

    context_block = ""
    if planner_context and planner_context.strip():
        context_block = f"""
ADDITIONAL MEMORY + KNOWLEDGE CONTEXT:
{planner_context.strip()}

Apply this context as soft constraints:
- Reuse user preferences when possible.
- If memory conflicts with live tool data, prioritize live tool data.
"""

    user_prompt = f"""Lên kế hoạch du lịch:
- Xuất phát: {departure_city or 'Hà Nội'}
- Điểm đến: {destination}
- Số ngày: {days}
- Ngân sách: {budget} VND/người
- Phong cách người dùng chọn: {style_labels}
- Số người: {people}
{context_block}

DIỄN GIẢI SỞ THÍCH ĐÃ CHUẨN HÓA:
{style_semantics}

HƯỚNG DẪN CÁ THỂ HÓA THEO SỞ THÍCH:
{style_guidance}

Thực hiện theo thứ tự:
1. get_weather_forecast({destination}, {min(days, 7)})
2. get_top_places({destination}, attraction, {places_needed}) — lấy NHIỀU để phân bổ đều cho {days} ngày
3. get_top_places({destination}, restaurant, {places_needed})
4. get_top_places({destination}, hotel, 3)
5. Nếu nước ngoài: get_exchange_rate
6. Tạo JSON theo format sau (CHỈ trả JSON, không text khác):

YÊU CẦU QUAN TRỌNG khi tạo lịch trình:
- Mỗi ngày phải dùng các địa điểm KHÁC NHAU từ danh sách tool trả về
- Phân bổ đều: ngày 1 dùng địa điểm 1-3, ngày 2 dùng địa điểm 4-6, ngày 3 dùng 7-9...
- Nhà hàng mỗi bữa phải khác nhau giữa các ngày
- Nếu hết địa điểm từ tool thì tự sáng tạo thêm địa điểm phù hợp với {destination}

YÊU CẦU NGÀY ĐI VÀ NGÀY VỀ:
- Ngày 1 (ngày đầu): Hoạt động ĐẦU TIÊN phải là di chuyển từ "{departure_city or 'Hà Nội'}" đến "{destination}"
- Ngày {days} (ngày cuối): Hoạt động CUỐI CÙNG phải là di chuyển từ "{destination}" về "{departure_city or 'Hà Nội'}"

YÊU CẦU VỀ PHƯƠNG TIỆN DI CHUYỂN GIỮA CÁC ĐỊA ĐIỂM:
Với mỗi địa điểm trong schedule, thêm field "transport_to_next" gợi ý phương tiện tối ưu:
- Dưới 1km: "🚶 Đi bộ ~X phút"
- 1-5km: "🛵 Xe máy ~X phút" hoặc "🚌 Xe buýt ~X phút"
- 5-15km: "🚌 Xe buýt ~X phút" hoặc "🚗 Taxi/GrabCar ~X phút"
- 15-100km: "🚌 Xe khách ~X tiếng"
- 100-300km: "🚌 Xe khách ~X tiếng" hoặc "🚂 Tàu hỏa ~X tiếng"
- Trên 300km hoặc ra đảo: "✈️ Máy bay ~X tiếng"
Địa điểm cuối cùng trong ngày thì để "transport_to_next": ""
Nếu hoạt động BẢN THÂN ĐÃ LÀ di chuyển liên tỉnh thì để "transport_to_next": ""

YÊU CẦU VỀ TRƯỜNG "address":
Điền địa chỉ đầy đủ để người dùng có thể copy paste lên Google Maps:
- Địa điểm cụ thể: "Hồ Núi Cốc, xã Tức Tranh, Thái Nguyên"
- Di chuyển xe/tàu: chỉ ghi địa chỉ điểm XUẤT PHÁT
- Di chuyển máy bay: chỉ ghi tên sân bay xuất phát
KHÔNG ghi chung chung như "Thái Nguyên" hay "địa phương"

{{
  "trip_summary": {{
    "destination": "...", "total_days": {days},
    "estimated_cost": "...", "best_time": "...", "weather_note": "..."
  }},
  "days": [
    {{
      "day": 1, "title": "...", "weather": "...",
      "schedule": [
        {{
          "time": "07:00", "period": "Sáng",
          "place": "...", "address": "...",
          "lat": 0.0, "lng": 0.0,
          "description": "...", "estimated_cost": "...",
          "duration": "... tiếng", "tips": "...",
          "highlights": ["..."],
          "best_for": "...", "nearby": "...",
          "opening_hours": "...", "entrance_fee": "...",
          "website": "...", "transport_to_next": "..."
        }}
      ]
    }}
  ],
  "accommodation": [{{"name": "...", "area": "...", "price_range": "...", "why": "...", "lat": 0.0, "lng": 0.0}}],
  "packing_list": ["..."],
  "budget_breakdown": {{
    "luu_tru": "...", "an_uong": "...", "di_chuyen": "...",
    "hoat_dong": "...", "mua_sam_phat_sinh": "..."
  }},
  "agent_notes": "..."
}}"""

    token     = None
    itinerary = None
    agent_failure = None

    try:
        if db is not None:
            token = DB_CONTEXT.set(db)

        if USE_LANGCHAIN:
            try:
                itinerary = run_agent_langchain(system_prompt, user_prompt)
            except Exception as lc_err:
                print("LangChain fallback:", repr(lc_err))
                if is_rate_limit_error(lc_err):
                    raise lc_err
                itinerary = run_agent_new_sdk(system_prompt, user_prompt) if USE_NEW_SDK \
                    else run_agent_old_sdk(system_prompt, user_prompt)
        else:
            itinerary = run_agent_new_sdk(system_prompt, user_prompt) if USE_NEW_SDK \
                else run_agent_old_sdk(system_prompt, user_prompt)

    except Exception as agent_err:
        agent_failure = agent_err
        print("AI generation fallback:", repr(agent_err))
        itinerary = build_fallback_itinerary(
            destination=destination, days=days, budget=budget,
            travel_style=travel_style, people=people,
            departure_city=departure_city, fail_reason=str(agent_err),
        )
    finally:
        if token is not None:
            DB_CONTEXT.reset(token)

    if not isinstance(itinerary, dict) or not isinstance(itinerary.get("days"), list) or not itinerary.get("days"):
        itinerary = build_fallback_itinerary(
            destination=destination, days=days, budget=budget,
            travel_style=travel_style, people=people,
            departure_city=departure_city,
            fail_reason=str(agent_failure or "Invalid itinerary payload"),
        )

    return finalize_itinerary(itinerary, destination, budget)


def generate_itinerary_resilient(
    destination: str,
    days: int,
    budget: str,
    travel_style: list,
    people: int,
    departure_city: str = "",
    planner_context: str = "",
    db=None,
) -> dict:
    try:
        itinerary = generate_itinerary(
            destination=destination, days=days, budget=budget,
            travel_style=travel_style, people=people,
            departure_city=departure_city, planner_context=planner_context, db=db,
        )
        if not isinstance(itinerary, dict) or not isinstance(itinerary.get("days"), list) or not itinerary.get("days"):
            raise RuntimeError("Empty itinerary payload")
        return itinerary

    except Exception as e:
        print("generate_itinerary_resilient fallback:", repr(e))
        try:
            itinerary = build_fallback_itinerary(
                destination=destination, days=days, budget=budget,
                travel_style=travel_style, people=people,
                departure_city=departure_city, fail_reason=str(e),
            )
            return finalize_itinerary(itinerary, destination, budget)
        except Exception as fallback_err:
            print("hard fallback failure:", repr(fallback_err))
            safe_days = max(1, int(days or 1))
            return {
                "trip_summary": {
                    "destination":    destination,
                    "total_days":     safe_days,
                    "estimated_cost": f"Khoảng {budget} VND/người",
                    "best_time":      "Thời điểm ổn định",
                    "weather_note":   "Không lấy được dữ liệu thời tiết.",
                },
                "days": [
                    {
                        "day":     day_no + 1,
                        "title":   f"Ngày {day_no + 1} tại {destination}",
                        "weather": "Thời tiết ổn định",
                        "schedule": [
                            fallback_schedule_item(
                                time="08:00", period="Sáng",
                                place=f"Khám phá trung tâm {destination}",
                                address=destination,
                                estimated_cost="Tùy địa điểm", duration="2 giờ",
                                description="Lịch trình tối thiểu được tạo để đảm bảo người dùng có nội dung xem.",
                                tips="Kiểm tra lại chi tiết địa điểm trước khi đi.",
                                highlights=["Fallback mode"],
                            ),
                            fallback_schedule_item(
                                time="14:00", period="Chiều",
                                place=f"Tham quan điểm nổi bật tại {destination}",
                                address=destination,
                                estimated_cost="Tùy địa điểm", duration="2 giờ",
                                description="Gợi ý tham quan cơ bản.",
                                tips="Có thể thay đổi theo điều kiện thực tế.",
                                highlights=["Fallback mode"],
                            ),
                        ],
                    }
                    for day_no in range(safe_days)
                ],
                "accommodation":   [],
                "packing_list":    ["Giấy tờ tùy thân", "Tiền mặt dự phòng", "Điện thoại và sạc dự phòng"],
                "budget_breakdown": {
                    "luu_tru": "Đang cập nhật", "an_uong": "Đang cập nhật",
                    "di_chuyen": "Đang cập nhật", "hoat_dong": "Đang cập nhật",
                    "mua_sam_phat_sinh": "Đang cập nhật",
                },
                "agent_notes":       f"Hard fallback mode. Original error: {str(e)[:160]}",
                "generation_source": "hard_fallback_minimal",
            }
