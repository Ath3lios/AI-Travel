from services.route_optimizer import optimize_itinerary_routes

from .agents import run_agent_langchain, run_agent_new_sdk, run_agent_old_sdk
from .fallbacks import augment_accommodation_suggestions, build_fallback_itinerary, fallback_schedule_item
from .runtime import DB_CONTEXT, USE_LANGCHAIN, USE_NEW_SDK


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
    system_prompt = """Bạn là AI Travel Agent chuyên nghiệp.
PHẢI dùng tools trước khi tạo lịch trình:
  - get_weather_forecast
  - get_top_places
  - get_exchange_rate (nếu cần)

Yêu cầu:
- Mỗi ngày 6-7 hoạt động, hạn chế lặp lại địa điểm giữa các ngày.
- Mỗi schedule item có place, address, lat, lng, description, estimated_cost, duration, tips.
- Ngày đầu tiên có hoạt động di chuyển từ điểm xuất phát đến điểm đến.
- Ngày cuối cùng có hoạt động di chuyển quay về điểm xuất phát.
- Chỉ trả JSON hợp lệ.
"""

    places_needed = max(10, days * 4)
    context_block = ""
    if planner_context and planner_context.strip():
        context_block = f"""
ADDITIONAL MEMORY + KNOWLEDGE CONTEXT:
{planner_context.strip()}

Apply this context as soft constraints:
- Reuse user preferences when possible.
"""

    user_prompt = f"""Lên kế hoạch du lịch:
- Xuất phát: {departure_city or 'Hà Nội'}
- Điểm đến: {destination}
- Số ngày: {days}
- Ngân sách: {budget} VND/người
- Phong cách: {', '.join(travel_style)}
- Số người: {people}
{context_block}

Thực hiện theo thứ tự:
1. get_weather_forecast({destination}, {min(days, 7)})
2. get_top_places({destination}, attraction, {places_needed})
3. get_top_places({destination}, restaurant, {places_needed})
4. get_top_places({destination}, hotel, 3)
5. Tạo JSON theo format:
{{
  "trip_summary": {{"destination": "...", "total_days": {days}, "estimated_cost": "...", "best_time": "...", "weather_note": "..."}},
  "days": [{{"day": 1, "title": "...", "weather": "...", "schedule": [{{"time": "07:00", "period": "Sáng", "place": "...", "address": "...", "lat": 0.0, "lng": 0.0, "description": "...", "estimated_cost": "...", "duration": "...", "tips": "...", "highlights": [], "best_for": "", "nearby": "", "opening_hours": "", "entrance_fee": "", "website": "", "transport_to_next": ""}}]}}],
  "accommodation": [{{"name": "...", "area": "...", "price_range": "...", "why": "...", "lat": 0.0, "lng": 0.0}}],
  "packing_list": ["..."],
  "budget_breakdown": {{"luu_tru": "...", "an_uong": "...", "di_chuyen": "...", "hoat_dong": "...", "mua_sam_phat_sinh": "..."}},
  "agent_notes": "..."
}}
"""

    token = None
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
                itinerary = run_agent_new_sdk(system_prompt, user_prompt) if USE_NEW_SDK else run_agent_old_sdk(system_prompt, user_prompt)
        else:
            itinerary = run_agent_new_sdk(system_prompt, user_prompt) if USE_NEW_SDK else run_agent_old_sdk(system_prompt, user_prompt)
    except Exception as agent_err:
        agent_failure = agent_err
        print("AI generation fallback:", repr(agent_err))
        itinerary = build_fallback_itinerary(
            destination=destination,
            days=days,
            budget=budget,
            travel_style=travel_style,
            people=people,
            departure_city=departure_city,
            fail_reason=str(agent_err),
        )
    finally:
        if token is not None:
            DB_CONTEXT.reset(token)

    if not isinstance(itinerary, dict) or not isinstance(itinerary.get("days"), list) or not itinerary.get("days"):
        itinerary = build_fallback_itinerary(
            destination=destination,
            days=days,
            budget=budget,
            travel_style=travel_style,
            people=people,
            departure_city=departure_city,
            fail_reason=str(agent_failure or "Invalid itinerary payload"),
        )

    itinerary = optimize_itinerary_routes(itinerary)
    itinerary = augment_accommodation_suggestions(itinerary, destination, budget)
    return itinerary


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
            destination=destination,
            days=days,
            budget=budget,
            travel_style=travel_style,
            people=people,
            departure_city=departure_city,
            planner_context=planner_context,
            db=db,
        )
        if not isinstance(itinerary, dict) or not isinstance(itinerary.get("days"), list) or not itinerary.get("days"):
            raise RuntimeError("Empty itinerary payload")
        return itinerary
    except Exception as e:
        print("generate_itinerary_resilient fallback:", repr(e))
        try:
            itinerary = build_fallback_itinerary(
                destination=destination,
                days=days,
                budget=budget,
                travel_style=travel_style,
                people=people,
                departure_city=departure_city,
                fail_reason=str(e),
            )
            itinerary = optimize_itinerary_routes(itinerary)
            itinerary = augment_accommodation_suggestions(itinerary, destination, budget)
            return itinerary
        except Exception as fallback_err:
            print("hard fallback failure:", repr(fallback_err))
            safe_days = max(1, int(days or 1))
            return {
                "trip_summary": {
                    "destination": destination,
                    "total_days": safe_days,
                    "estimated_cost": f"Khoang {budget} VND/nguoi",
                    "best_time": "Thoi diem on dinh",
                    "weather_note": "Khong lay duoc du lieu thoi tiet, dang dung lich trinh toi thieu.",
                },
                "days": [
                    {
                        "day": day_no + 1,
                        "title": f"Ngay {day_no + 1} tai {destination}",
                        "weather": "Thoi tiet on dinh",
                        "schedule": [
                            fallback_schedule_item(
                                time="08:00",
                                period="Sang",
                                place=f"Kham pha trung tam {destination}",
                                address=destination,
                                estimated_cost="Tuy dia diem",
                                duration="2 gio",
                                description="Lich trinh toi thieu duoc tao de dam bao nguoi dung van co noi dung de xem.",
                                tips="Kiem tra lai chi tiet dia diem truoc khi di.",
                                highlights=["Fallback mode"],
                            ),
                            fallback_schedule_item(
                                time="14:00",
                                period="Chieu",
                                place=f"Tham quan diem noi bat tai {destination}",
                                address=destination,
                                estimated_cost="Tuy dia diem",
                                duration="2 gio",
                                description="Goi y tham quan co ban.",
                                tips="Co the thay doi theo dieu kien thuc te.",
                                highlights=["Fallback mode"],
                            ),
                        ],
                    }
                    for day_no in range(safe_days)
                ],
                "accommodation": [],
                "packing_list": ["Giay to tuy than", "Tien mat du phong", "Dien thoai va sac du phong"],
                "budget_breakdown": {
                    "luu_tru": "Dang cap nhat",
                    "an_uong": "Dang cap nhat",
                    "di_chuyen": "Dang cap nhat",
                    "hoat_dong": "Dang cap nhat",
                    "mua_sam_phat_sinh": "Dang cap nhat",
                },
                "agent_notes": f"Hard fallback mode. Original error: {str(e)[:160]}",
                "generation_source": "hard_fallback_minimal",
            }
