from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Trip, Destination, Hotel, Activity
from models.trip import TripCreate, TripRegenerate, TripUpdate
from routers.auth import get_current_user
from services.gemini_service import generate_itinerary_resilient
from services.itinerary.fallbacks import augment_schedule_coordinates
from datetime import datetime
import json

router = APIRouter(prefix='/trips', tags=['trips'])


def _parse_trip_id(trip_id: str) -> int:
    try:
        return int(trip_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail='Trip ID khong hop le')


def _get_trip_or_404(db: Session, trip_id: int):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail='Khong tim thay')
    return trip


def _get_owned_trip_or_403(db: Session, trip_id: int, current_user):
    trip = _get_trip_or_404(db, trip_id)
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail='Khong co quyen')
    return trip


def _delete_trip_catalog_rows(db: Session, trip_id: int) -> None:
    db.query(Activity).filter(Activity.trip_id == trip_id).delete(synchronize_session=False)
    db.query(Hotel).filter(Hotel.trip_id == trip_id).delete(synchronize_session=False)
    db.query(Destination).filter(Destination.trip_id == trip_id).delete(synchronize_session=False)


def _delete_legacy_catalog_rows_for_trip(db: Session, trip) -> None:
    destination_name = (trip.destination or "").strip()
    if not destination_name:
        return
    same_destination_trip_count = (
        db.query(Trip)
        .filter(Trip.destination.ilike(destination_name))
        .count()
    )
    if same_destination_trip_count != 1:
        return
    legacy_destination_ids = [
        destination_id
        for (destination_id,) in db.query(Destination.id)
        .filter(
            Destination.trip_id.is_(None),
            (Destination.city.ilike(destination_name) | Destination.name.ilike(destination_name)),
        )
        .all()
    ]
    if not legacy_destination_ids:
        return
    db.query(Activity).filter(
        Activity.trip_id.is_(None),
        Activity.destination_id.in_(legacy_destination_ids),
    ).delete(synchronize_session=False)
    db.query(Hotel).filter(
        Hotel.trip_id.is_(None),
        Hotel.destination_id.in_(legacy_destination_ids),
    ).delete(synchronize_session=False)
    db.query(Destination).filter(Destination.id.in_(legacy_destination_ids)).delete(synchronize_session=False)


def trip_to_dict(trip) -> dict:
    itinerary = json.loads(trip.itinerary) if trip.itinerary else None
    if itinerary:
        itinerary = augment_schedule_coordinates(itinerary, trip.destination)
    return {
        'id': str(trip.id),
        'user_id': str(trip.user_id),
        'destination': trip.destination,
        'days': trip.days,
        'budget': trip.budget,
        'itinerary': itinerary,
        'created_at': trip.created_at,
    }


# ──────────────────────────────────────────────────────────────
# CATALOG SYNC
# ──────────────────────────────────────────────────────────────

def _upsert_destination(db: Session, city: str, trip_id: int) -> int | None:
    """Trả về destination.id cho city, tạo mới nếu chưa có."""
    if not city:
        return None
    existing = db.query(Destination).filter(
        Destination.trip_id == trip_id,
        Destination.city.ilike(city.strip())
    ).first()
    if existing:
        return existing.id
    dest = Destination(
        trip_id=trip_id,
        name=city.strip(),
        city=city.strip(),
        created_at=datetime.utcnow(),
    )
    db.add(dest)
    db.flush()  # lấy id mà chưa commit
    return dest.id


def _sync_itinerary_to_catalog(db: Session, itinerary: dict, destination_city: str, trip_id: int) -> None:
    """
    Đọc itinerary JSON vừa sinh ra và upsert các place vào catalog DB.

    Logic:
    - accommodation → Hotel (upsert theo name + destination_id)
    - schedule items trong days → Activity (upsert theo name + destination_id)
    - Bỏ qua các item thiếu lat/lng hoặc tên rỗng/placeholder.
    """
    if not itinerary or not isinstance(itinerary, dict):
        return

    try:
        destination_id = _upsert_destination(db, destination_city, trip_id)

        # ── Hotels từ accommodation ──────────────────────────
        for hotel in itinerary.get("accommodation") or []:
            name = str(hotel.get("name") or "").strip()
            lat = hotel.get("lat")
            lng = hotel.get("lng")
            if not name or lat is None or lng is None:
                continue
            # Bỏ qua nếu tên kiểu "Khách sạn X #1" (synthetic)
            if "#" in name and "fallback" in str(hotel.get("source", "")).lower():
                continue
            exists = db.query(Hotel).filter(
                Hotel.trip_id == trip_id,
                Hotel.destination_id == destination_id,
                Hotel.name.ilike(name),
            ).first()
            if not exists:
                db.add(Hotel(
                    trip_id=trip_id,
                    destination_id=destination_id,
                    name=name,
                    address=str(hotel.get("area") or destination_city),
                    price_range=str(hotel.get("price_range") or ""),
                    lat=float(lat),
                    lng=float(lng),
                    created_at=datetime.utcnow(),
                ))

        # ── Activities từ schedule của mỗi ngày ─────────────
        seen_names: set[str] = set()
        for day in itinerary.get("days") or []:
            for item in day.get("schedule") or []:
                name = str(item.get("place") or "").strip()
                lat = item.get("lat")
                lng = item.get("lng")
                address = str(item.get("address") or destination_city).strip()

                if not name or lat is None or lng is None:
                    continue
                # Lọc bỏ placeholder chỉ-di-chuyển
                lower = name.lower()
                if any(kw in lower for kw in ("di chuyển từ", "khởi hành", "trở về", "về điểm", "fallback")):
                    continue
                # Chỉ upsert mỗi tên một lần trong batch này
                key = lower
                if key in seen_names:
                    continue
                seen_names.add(key)

                # Đoán category từ period/tên
                period = str(item.get("period") or "").lower()
                if "sáng" in period or "breakfast" in name.lower() or "ăn sáng" in lower:
                    category = "restaurant"
                elif "trưa" in period or "lunch" in name.lower() or "ăn trưa" in lower:
                    category = "restaurant"
                elif "tối" in period or "dinner" in name.lower() or "ăn tối" in lower:
                    category = "restaurant"
                elif any(kw in lower for kw in ("nhà hàng", "quán ăn", "quán cà phê", "cafe", "coffee")):
                    category = "restaurant"
                elif any(kw in lower for kw in ("khách sạn", "homestay", "resort", "hotel", "nhà nghỉ")):
                    # Đây là hotel — đã được xử lý bên trên từ accommodation
                    continue
                else:
                    category = "attraction"

                exists = db.query(Activity).filter(
                    Activity.trip_id == trip_id,
                    Activity.destination_id == destination_id,
                    Activity.name.ilike(name),
                ).first()
                if not exists:
                    db.add(Activity(
                        trip_id=trip_id,
                        destination_id=destination_id,
                        name=name,
                        category=category,
                        address=address,
                        lat=float(lat),
                        lng=float(lng),
                        created_at=datetime.utcnow(),
                    ))

        db.commit()
    except Exception:
        # Sync thất bại không được phá vỡ luồng tạo trip
        db.rollback()


# ──────────────────────────────────────────────────────────────
# ROUTES
# ──────────────────────────────────────────────────────────────

@router.post('/')
def create_trip(
    trip_data: TripCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    itinerary = generate_itinerary_resilient(
        trip_data.destination, trip_data.days,
        trip_data.budget, trip_data.travel_style, trip_data.people,
        trip_data.departure_city, "", db,
    )
    new_trip = Trip(
        user_id=current_user.id,
        destination=trip_data.destination,
        days=trip_data.days,
        budget=trip_data.budget,
        travel_style=','.join(trip_data.travel_style),
        people=trip_data.people,
        itinerary=json.dumps(itinerary, ensure_ascii=False),
        created_at=datetime.utcnow(),
    )
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)

    # ── Đồng bộ catalog sau khi commit trip ──
    _sync_itinerary_to_catalog(db, itinerary, trip_data.destination, new_trip.id)

    return trip_to_dict(new_trip)


@router.get('/my-trips')
def get_my_trips(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    trips = (
        db.query(Trip)
        .filter(Trip.user_id == current_user.id)
        .order_by(Trip.created_at.desc())
        .all()
    )
    return [trip_to_dict(t) for t in trips]


@router.get('/{trip_id}')
def get_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    parsed_trip_id = _parse_trip_id(trip_id)
    trip = _get_owned_trip_or_403(db, parsed_trip_id, current_user)
    return trip_to_dict(trip)


@router.post('/{trip_id}/regenerate')
def regenerate_trip(
    trip_id: str,
    trip_data: TripRegenerate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    parsed_trip_id = _parse_trip_id(trip_id)
    trip = _get_owned_trip_or_403(db, parsed_trip_id, current_user)
    itinerary = generate_itinerary_resilient(
        trip_data.destination, trip_data.days,
        trip_data.budget, trip_data.travel_style, trip_data.people,
        trip_data.departure_city, "", db,
    )

    trip.destination = trip_data.destination
    trip.days = trip_data.days
    trip.budget = trip_data.budget
    trip.travel_style = ','.join(trip_data.travel_style)
    trip.people = trip_data.people
    trip.itinerary = json.dumps(itinerary, ensure_ascii=False)
    db.commit()
    db.refresh(trip)

    # ── Đồng bộ catalog sau khi regenerate ──
    _delete_trip_catalog_rows(db, trip.id)
    _sync_itinerary_to_catalog(db, itinerary, trip_data.destination, trip.id)

    return trip_to_dict(trip)


@router.put('/{trip_id}')
def update_trip(
    trip_id: str,
    update_data: TripUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    parsed_trip_id = _parse_trip_id(trip_id)
    trip = _get_owned_trip_or_403(db, parsed_trip_id, current_user)
    if update_data.itinerary:
        trip.itinerary = json.dumps(update_data.itinerary, ensure_ascii=False)
    if update_data.days is not None:
        trip.days = update_data.days
    if update_data.budget is not None:
        trip.budget = update_data.budget
    db.commit()
    db.refresh(trip)
    return trip_to_dict(trip)


@router.delete('/{trip_id}')
def delete_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    parsed_trip_id = _parse_trip_id(trip_id)
    trip = _get_owned_trip_or_403(db, parsed_trip_id, current_user)
    _delete_trip_catalog_rows(db, trip.id)
    _delete_legacy_catalog_rows_for_trip(db, trip)
    db.delete(trip)
    db.commit()
    return {'message': 'Da xoa thanh cong'}
