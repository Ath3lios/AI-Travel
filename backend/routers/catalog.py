from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db, Destination, Hotel, Activity
from models.catalog import (
    DestinationCreate, DestinationUpdate, DestinationResponse,
    HotelCreate, HotelUpdate, HotelResponse,
    ActivityCreate, ActivityUpdate, ActivityResponse,
)
from routers.auth import get_current_user, require_admin
from services.admin_audit import log_admin_action
from datetime import datetime

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _validate_rating(value: float | None):
    if value is not None and (value < 0 or value > 5):
        raise HTTPException(status_code=400, detail="Rating phai nam trong khoang 0 den 5")


def _validate_coordinates(lat: float | None, lng: float | None):
    if lat is not None and (lat < -90 or lat > 90):
        raise HTTPException(status_code=400, detail="Latitude khong hop le")
    if lng is not None and (lng < -180 or lng > 180):
        raise HTTPException(status_code=400, detail="Longitude khong hop le")


def _ensure_destination_exists(db: Session, destination_id: int | None):
    if destination_id is None:
        return
    exists = db.query(Destination.id).filter(Destination.id == destination_id).first()
    if not exists:
        raise HTTPException(status_code=400, detail="Destination ID khong ton tai")


def _validate_destination_payload(db: Session, payload: DestinationCreate | DestinationUpdate):
    _validate_rating(payload.rating)
    _validate_coordinates(payload.lat, payload.lng)


def _validate_hotel_payload(db: Session, payload: HotelCreate | HotelUpdate):
    _validate_rating(payload.rating)
    _validate_coordinates(payload.lat, payload.lng)
    _ensure_destination_exists(db, payload.destination_id)


def _validate_activity_payload(db: Session, payload: ActivityCreate | ActivityUpdate):
    _validate_rating(payload.rating)
    _validate_coordinates(payload.lat, payload.lng)
    _ensure_destination_exists(db, payload.destination_id)


def _destination_to_dict(row: Destination) -> dict:
    return {
        "id": str(row.id),
        "name": row.name,
        "city": row.city,
        "lat": row.lat,
        "lng": row.lng,
        "tags": row.tags,
        "description": row.description,
        "rating": row.rating,
        "created_at": row.created_at,
    }


def _hotel_to_dict(row: Hotel) -> dict:
    return {
        "id": str(row.id),
        "destination_id": row.destination_id,
        "name": row.name,
        "price_range": row.price_range,
        "address": row.address,
        "lat": row.lat,
        "lng": row.lng,
        "rating": row.rating,
        "created_at": row.created_at,
    }


def _activity_to_dict(row: Activity) -> dict:
    return {
        "id": str(row.id),
        "destination_id": row.destination_id,
        "name": row.name,
        "category": row.category,
        "price_range": row.price_range,
        "address": row.address,
        "lat": row.lat,
        "lng": row.lng,
        "rating": row.rating,
        "created_at": row.created_at,
    }


# ──────────────────────────────────────────────────────────────
# DESTINATIONS
# ──────────────────────────────────────────────────────────────

@router.post("/destinations", response_model=DestinationResponse)
def create_destination(
    payload: DestinationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    _validate_destination_payload(db, payload)
    row = Destination(
        name=payload.name,
        city=payload.city,
        lat=payload.lat,
        lng=payload.lng,
        tags=payload.tags,
        description=payload.description,
        rating=payload.rating,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_DESTINATION_CREATE",
        target_type="destination",
        target_id=str(row.id),
    )
    return _destination_to_dict(row)


@router.get("/destinations")
def list_destinations(
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Destination)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((Destination.name.ilike(like)) | (Destination.city.ilike(like)))
    total = query.count()
    rows = query.order_by(Destination.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [_destination_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/destinations/{destination_id}", response_model=DestinationResponse)
def get_destination(
    destination_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(Destination).filter(Destination.id == destination_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay destination")
    return _destination_to_dict(row)


@router.put("/destinations/{destination_id}", response_model=DestinationResponse)
def update_destination(
    destination_id: int,
    payload: DestinationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    row = db.query(Destination).filter(Destination.id == destination_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay destination")
    _validate_destination_payload(db, payload)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(row, key, val)
    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_DESTINATION_UPDATE",
        target_type="destination",
        target_id=str(row.id),
        detail=payload.dict(exclude_unset=True),
    )
    return _destination_to_dict(row)


@router.delete("/destinations/{destination_id}")
def delete_destination(
    destination_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    row = db.query(Destination).filter(Destination.id == destination_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay destination")
    deleted_id = str(row.id)
    db.delete(row)
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_DESTINATION_DELETE",
        target_type="destination",
        target_id=deleted_id,
    )
    return {"message": "Da xoa thanh cong"}


# ──────────────────────────────────────────────────────────────
# HOTELS
# ──────────────────────────────────────────────────────────────

@router.post("/hotels", response_model=HotelResponse)
def create_hotel(
    payload: HotelCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    _validate_hotel_payload(db, payload)
    row = Hotel(
        destination_id=payload.destination_id,
        name=payload.name,
        price_range=payload.price_range,
        address=payload.address,
        lat=payload.lat,
        lng=payload.lng,
        rating=payload.rating,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_HOTEL_CREATE",
        target_type="hotel",
        target_id=str(row.id),
    )
    return _hotel_to_dict(row)


@router.get("/hotels")
def list_hotels(
    destination_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Hotel)
    if destination_id is not None:
        query = query.filter(Hotel.destination_id == destination_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(Hotel.name.ilike(like))
    total = query.count()
    rows = query.order_by(Hotel.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [_hotel_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/hotels/{hotel_id}", response_model=HotelResponse)
def get_hotel(
    hotel_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay hotel")
    return _hotel_to_dict(row)


@router.put("/hotels/{hotel_id}", response_model=HotelResponse)
def update_hotel(
    hotel_id: int,
    payload: HotelUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    row = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay hotel")
    _validate_hotel_payload(db, payload)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(row, key, val)
    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_HOTEL_UPDATE",
        target_type="hotel",
        target_id=str(row.id),
        detail=payload.dict(exclude_unset=True),
    )
    return _hotel_to_dict(row)


@router.delete("/hotels/{hotel_id}")
def delete_hotel(
    hotel_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    row = db.query(Hotel).filter(Hotel.id == hotel_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay hotel")
    deleted_id = str(row.id)
    db.delete(row)
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_HOTEL_DELETE",
        target_type="hotel",
        target_id=deleted_id,
    )
    return {"message": "Da xoa thanh cong"}


# ──────────────────────────────────────────────────────────────
# ACTIVITIES
# ──────────────────────────────────────────────────────────────

@router.post("/activities", response_model=ActivityResponse)
def create_activity(
    payload: ActivityCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    _validate_activity_payload(db, payload)
    row = Activity(
        destination_id=payload.destination_id,
        name=payload.name,
        category=payload.category,
        price_range=payload.price_range,
        address=payload.address,
        lat=payload.lat,
        lng=payload.lng,
        rating=payload.rating,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_ACTIVITY_CREATE",
        target_type="activity",
        target_id=str(row.id),
    )
    return _activity_to_dict(row)


@router.get("/activities")
def list_activities(
    destination_id: int | None = Query(default=None),
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Activity)
    if destination_id is not None:
        query = query.filter(Activity.destination_id == destination_id)
    if category:
        query = query.filter(Activity.category == category)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(Activity.name.ilike(like))
    total = query.count()
    rows = query.order_by(Activity.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [_activity_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/activities/{activity_id}", response_model=ActivityResponse)
def get_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay activity")
    return _activity_to_dict(row)


@router.put("/activities/{activity_id}", response_model=ActivityResponse)
def update_activity(
    activity_id: int,
    payload: ActivityUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay activity")
    _validate_activity_payload(db, payload)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(row, key, val)
    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_ACTIVITY_UPDATE",
        target_type="activity",
        target_id=str(row.id),
        detail=payload.dict(exclude_unset=True),
    )
    return _activity_to_dict(row)


@router.delete("/activities/{activity_id}")
def delete_activity(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    row = db.query(Activity).filter(Activity.id == activity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Khong tim thay activity")
    deleted_id = str(row.id)
    db.delete(row)
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="CATALOG_ACTIVITY_DELETE",
        target_type="activity",
        target_id=deleted_id,
    )
    return {"message": "Da xoa thanh cong"}
