import csv
import json
from datetime import datetime, timedelta
from io import StringIO
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from config import settings
from database import (
    SQLITE_FILE_PATH,
    Activity,
    AdminAuditLog,
    Destination,
    Hotel,
    Trip,
    User,
    get_db,
)
from routers.auth import require_admin
from services.admin_audit import log_admin_action
from services.health_metrics import snapshot as health_snapshot

router = APIRouter(prefix='/admin', tags=['admin'])


def _delete_trip_catalog_rows(db: Session, trip_ids: list[int]) -> None:
    if not trip_ids:
        return
    db.query(Activity).filter(Activity.trip_id.in_(trip_ids)).delete(synchronize_session=False)
    db.query(Hotel).filter(Hotel.trip_id.in_(trip_ids)).delete(synchronize_session=False)
    db.query(Destination).filter(Destination.trip_id.in_(trip_ids)).delete(synchronize_session=False)


def _delete_legacy_catalog_rows_for_trip(db: Session, trip: Trip) -> None:
    destination_name = (trip.destination or "").strip()
    if not destination_name:
        return
    same_destination_trip_count = (
        db.query(func.count(Trip.id))
        .filter(Trip.destination.ilike(destination_name))
        .scalar()
        or 0
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


class UpdateUserPayload(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class BulkUserStatusPayload(BaseModel):
    user_ids: list[int]
    is_active: bool


class BulkDeleteTripsPayload(BaseModel):
    trip_ids: list[int]


def _active_admin_count(db: Session, exclude_user_id: int | None = None) -> int:
    query = db.query(func.count(User.id)).filter(User.role == "admin", User.is_active == True)
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.scalar() or 0


def _safe_json_load(value: str | None) -> dict[str, Any] | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    lowered = value.strip().lower()
    if lowered in {"1", "true", "yes"}:
        return True
    if lowered in {"0", "false", "no"}:
        return False
    return None


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


def _build_daily_series(db: Session) -> list[dict[str, Any]]:
    today = datetime.utcnow().date()
    start_day = today - timedelta(days=6)
    rows = (
        db.query(
            func.date(User.created_at).label("day"),
            func.count(User.id).label("users"),
            func.coalesce(func.sum(case((User.is_active == False, 1), else_=0)), 0).label("locked_users"),
        )
        .filter(User.created_at >= datetime.combine(start_day, datetime.min.time()))
        .group_by(func.date(User.created_at))
        .all()
    )
    trips_rows = (
        db.query(
            func.date(Trip.created_at).label("day"),
            func.count(Trip.id).label("trips"),
        )
        .filter(Trip.created_at >= datetime.combine(start_day, datetime.min.time()))
        .group_by(func.date(Trip.created_at))
        .all()
    )
    user_map = {str(r.day): {"users": int(r.users), "locked_users": int(r.locked_users)} for r in rows}
    trip_map = {str(r.day): int(r.trips) for r in trips_rows}
    result: list[dict[str, Any]] = []
    for i in range(7):
        day = start_day + timedelta(days=i)
        key = day.isoformat()
        result.append(
            {
                "date": key,
                "users": user_map.get(key, {}).get("users", 0),
                "locked_users": user_map.get(key, {}).get("locked_users", 0),
                "trips": trip_map.get(key, 0),
            }
        )
    return result


def _compute_alerts(db: Session) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    api_stats = health_snapshot()

    if not settings.gemini_api_key:
        alerts.append(
            {
                "level": "warning",
                "code": "MISSING_GEMINI_KEY",
                "message": "GEMINI_API_KEY is empty. AI itinerary quality can degrade.",
            }
        )
    if not settings.goong_api_key:
        alerts.append(
            {
                "level": "warning",
                "code": "MISSING_GOONG_KEY",
                "message": "GOONG_API_KEY is empty. Map geocoding/routing may be limited.",
            }
        )
    if api_stats["failed_requests"] > 0:
        alerts.append(
            {
                "level": "warning",
                "code": "API_ERRORS_PRESENT",
                "message": f"Detected {api_stats['failed_requests']} server error responses.",
                "meta": {"last_error_at": api_stats["last_error_at"]},
            }
        )

    locked_users = db.query(func.count(User.id)).filter(User.is_active == False).scalar() or 0
    if locked_users > 0:
        alerts.append(
            {
                "level": "info",
                "code": "LOCKED_USERS",
                "message": f"There are {locked_users} locked user accounts.",
            }
        )

    malformed_itinerary = (
        db.query(func.count(Trip.id))
        .filter(and_(Trip.itinerary.isnot(None), Trip.itinerary == ""))
        .scalar()
        or 0
    )
    if malformed_itinerary > 0:
        alerts.append(
            {
                "level": "warning",
                "code": "EMPTY_ITINERARY_TRIPS",
                "message": f"Found {malformed_itinerary} trips with empty itinerary payload.",
            }
        )

    one_day_ago = datetime.utcnow() - timedelta(days=1)
    recent_deletes = (
        db.query(func.count(AdminAuditLog.id))
        .filter(
            AdminAuditLog.created_at >= one_day_ago,
            AdminAuditLog.action.like("%DELETE%"),
        )
        .scalar()
        or 0
    )
    if recent_deletes >= 10:
        alerts.append(
            {
                "level": "warning",
                "code": "HIGH_DELETE_VOLUME",
                "message": f"{recent_deletes} delete actions were recorded in the last 24h.",
            }
        )

    return alerts


@router.get('/overview')
def get_admin_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_trips = db.query(func.count(Trip.id)).scalar() or 0
    total_destinations = db.query(func.count(Destination.id)).scalar() or 0
    total_hotels = db.query(func.count(Hotel.id)).scalar() or 0
    total_activities = db.query(func.count(Activity.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    locked_users = db.query(func.count(User.id)).filter(User.is_active == False).scalar() or 0
    total_admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0

    recent_users = db.query(User).order_by(User.created_at.desc()).limit(6).all()
    recent_trips = (
        db.query(Trip, User.name.label("user_name"), User.email.label("user_email"))
        .outerjoin(User, User.id == Trip.user_id)
        .order_by(Trip.created_at.desc())
        .limit(6)
        .all()
    )
    top_destinations = (
        db.query(Trip.destination, func.count(Trip.id).label("trip_count"))
        .filter(Trip.destination.isnot(None), Trip.destination != "")
        .group_by(Trip.destination)
        .order_by(func.count(Trip.id).desc(), Trip.destination.asc())
        .limit(5)
        .all()
    )

    return {
        "stats": {
            "users": total_users,
            "active_users": active_users,
            "locked_users": locked_users,
            "admins": total_admins,
            "trips": total_trips,
            "destinations": total_destinations,
            "hotels": total_hotels,
            "activities": total_activities,
        },
        "series_last_7_days": _build_daily_series(db),
        "alerts": _compute_alerts(db),
        "api_health": health_snapshot(),
        "recent_users": [
            {
                "id": str(user.id),
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "is_active": bool(user.is_active),
                "created_at": user.created_at,
            }
            for user in recent_users
        ],
        "recent_trips": [
            {
                "id": str(trip.id),
                "user_id": str(trip.user_id),
                "user_name": user_name,
                "user_email": user_email,
                "destination": trip.destination,
                "days": trip.days,
                "budget": trip.budget,
                "created_at": trip.created_at,
            }
            for trip, user_name, user_email in recent_trips
        ],
        "top_destinations": [
            {"destination": destination, "trip_count": int(trip_count)}
            for destination, trip_count in top_destinations
        ],
        "current_admin": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
        },
    }


@router.get('/alerts')
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = current_user
    return {"alerts": _compute_alerts(db), "api_health": health_snapshot()}


@router.get('/users')
def list_users(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    is_active: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = current_user
    query = db.query(User)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((User.name.ilike(like)) | (User.email.ilike(like)))
    if role in {"admin", "user"}:
        query = query.filter(User.role == role)
    parsed_active = _parse_bool(is_active)
    if parsed_active is not None:
        query = query.filter(User.is_active == parsed_active)
    total = query.count()
    rows = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "id": str(row.id),
                "name": row.name,
                "email": row.email,
                "role": row.role,
                "is_active": bool(row.is_active),
                "created_at": row.created_at,
            }
            for row in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.patch('/users/{user_id}')
def update_user(
    user_id: int,
    payload: UpdateUserPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role is not None:
        if payload.role not in {"admin", "user"}:
            raise HTTPException(status_code=400, detail="Invalid role")
        if row.id == current_user.id and payload.role != "admin":
            raise HTTPException(status_code=400, detail="Ban khong the tu ha quyen tai khoan admin hien tai")
        if row.role == "admin" and payload.role != "admin" and _active_admin_count(db, exclude_user_id=row.id) <= 0:
            raise HTTPException(status_code=400, detail="Khong the ha quyen admin dang hoat dong cuoi cung")
        row.role = payload.role
    if payload.is_active is not None:
        if row.id == current_user.id and payload.is_active is False:
            raise HTTPException(status_code=400, detail="Ban khong the tu khoa tai khoan admin hien tai")
        if row.role == "admin" and payload.is_active is False and _active_admin_count(db, exclude_user_id=row.id) <= 0:
            raise HTTPException(status_code=400, detail="Khong the khoa admin dang hoat dong cuoi cung")
        row.is_active = payload.is_active

    db.commit()
    db.refresh(row)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="USER_UPDATE",
        target_type="user",
        target_id=str(row.id),
        detail={"role": row.role, "is_active": bool(row.is_active)},
    )

    return {
        "id": str(row.id),
        "name": row.name,
        "email": row.email,
        "role": row.role,
        "is_active": bool(row.is_active),
        "created_at": row.created_at,
    }


@router.post('/users/bulk-status')
def bulk_update_user_status(
    payload: BulkUserStatusPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not payload.user_ids:
        raise HTTPException(status_code=400, detail="user_ids is required")
    if payload.is_active is False:
        if current_user.id in payload.user_ids:
            raise HTTPException(status_code=400, detail="Ban khong the tu khoa tai khoan admin hien tai")
        active_admin_count = _active_admin_count(db)
        target_active_admin_count = (
            db.query(func.count(User.id))
            .filter(User.id.in_(payload.user_ids), User.role == "admin", User.is_active == True)
            .scalar()
            or 0
        )
        if active_admin_count - target_active_admin_count <= 0:
            raise HTTPException(status_code=400, detail="Khong the khoa admin dang hoat dong cuoi cung")
    updated = (
        db.query(User)
        .filter(User.id.in_(payload.user_ids))
        .update({User.is_active: payload.is_active}, synchronize_session=False)
    )
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="USER_BULK_STATUS",
        target_type="user",
        detail={"user_ids": payload.user_ids, "is_active": payload.is_active},
    )
    return {"updated": updated}


@router.delete('/users/{user_id}')
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = db.query(User).filter(User.id == user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    if row.id == current_user.id:
        raise HTTPException(status_code=400, detail="Ban khong the tu xoa tai khoan admin hien tai")
    if row.role == "admin":
        admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Khong the xoa admin cuoi cung")

    owned_trips = db.query(Trip).filter(Trip.user_id == row.id).all()
    trip_ids = [trip.id for trip in owned_trips]
    for trip in owned_trips:
        _delete_legacy_catalog_rows_for_trip(db, trip)
    _delete_trip_catalog_rows(db, trip_ids)
    deleted_trip_count = db.query(Trip).filter(Trip.user_id == row.id).delete(synchronize_session=False)
    deleted_user_id = str(row.id)
    db.delete(row)
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="USER_DELETE",
        target_type="user",
        target_id=deleted_user_id,
        detail={"deleted_trips": deleted_trip_count},
    )
    return {"message": "Deleted", "deleted_trips": deleted_trip_count}


@router.get('/trips')
def list_trips(
    q: str | None = Query(default=None),
    user_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = current_user
    query = db.query(Trip, User.name.label("user_name"), User.email.label("user_email")).outerjoin(User, User.id == Trip.user_id)
    if user_id is not None:
        query = query.filter(Trip.user_id == user_id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            Trip.destination.ilike(like)
            | User.name.ilike(like)
            | User.email.ilike(like)
        )
    total = query.count()
    rows = query.order_by(Trip.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "id": str(trip.id),
                "user_id": str(trip.user_id),
                "user_name": user_name,
                "user_email": user_email,
                "destination": trip.destination,
                "days": trip.days,
                "budget": trip.budget,
                "created_at": trip.created_at,
            }
            for trip, user_name, user_email in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get('/trips/{trip_id}')
def get_trip_detail(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = current_user
    row = (
        db.query(Trip, User.name.label("user_name"), User.email.label("user_email"))
        .outerjoin(User, User.id == Trip.user_id)
        .filter(Trip.id == trip_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")

    trip, user_name, user_email = row
    itinerary = _safe_json_load(trip.itinerary)
    summary = itinerary.get("trip_summary") if isinstance(itinerary, dict) else None
    days = itinerary.get("days") if isinstance(itinerary, dict) else None
    return {
        "id": str(trip.id),
        "user_id": str(trip.user_id),
        "user_name": user_name,
        "user_email": user_email,
        "destination": trip.destination,
        "days": trip.days,
        "budget": trip.budget,
        "travel_style": trip.travel_style,
        "people": trip.people,
        "created_at": trip.created_at,
        "trip_summary": summary,
        "itinerary_days": days if isinstance(days, list) else [],
        "itinerary": itinerary,
    }


@router.delete('/trips/{trip_id}')
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    row = db.query(Trip).filter(Trip.id == trip_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")
    _delete_trip_catalog_rows(db, [row.id])
    _delete_legacy_catalog_rows_for_trip(db, row)
    db.delete(row)
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="TRIP_DELETE",
        target_type="trip",
        target_id=str(trip_id),
    )
    return {"message": "Deleted"}


@router.post('/trips/bulk-delete')
def bulk_delete_trips(
    payload: BulkDeleteTripsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not payload.trip_ids:
        raise HTTPException(status_code=400, detail="trip_ids is required")
    rows = db.query(Trip).filter(Trip.id.in_(payload.trip_ids)).all()
    for row in rows:
        _delete_legacy_catalog_rows_for_trip(db, row)
    _delete_trip_catalog_rows(db, payload.trip_ids)
    deleted = db.query(Trip).filter(Trip.id.in_(payload.trip_ids)).delete(synchronize_session=False)
    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="TRIP_BULK_DELETE",
        target_type="trip",
        detail={"trip_ids": payload.trip_ids},
    )
    return {"deleted": deleted}


@router.get('/audit-logs')
def list_audit_logs(
    action: str | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = current_user
    query = db.query(AdminAuditLog)
    if action:
        query = query.filter(AdminAuditLog.action == action)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (AdminAuditLog.target_type.ilike(like))
            | (AdminAuditLog.target_id.ilike(like))
            | (AdminAuditLog.detail.ilike(like))
        )
    total = query.count()
    rows = query.order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "items": [
            {
                "id": row.id,
                "actor_user_id": row.actor_user_id,
                "action": row.action,
                "target_type": row.target_type,
                "target_id": row.target_id,
                "detail": _safe_json_load(row.detail),
                "created_at": row.created_at,
            }
            for row in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _rows_to_csv(rows: list[dict[str, Any]], headers: list[str]) -> str:
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def _build_export(entity: str, db: Session) -> tuple[str, str]:
    now = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    if entity == "users":
        rows = db.query(User).order_by(User.id.asc()).all()
        data = _rows_to_csv(
            [
                {
                    "id": row.id,
                    "name": row.name,
                    "email": row.email,
                    "role": row.role,
                    "is_active": int(bool(row.is_active)),
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            ["id", "name", "email", "role", "is_active", "created_at"],
        )
    elif entity == "trips":
        rows = db.query(Trip).order_by(Trip.id.asc()).all()
        data = _rows_to_csv(
            [
                {
                    "id": row.id,
                    "user_id": row.user_id,
                    "destination": row.destination,
                    "days": row.days,
                    "budget": row.budget,
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            ["id", "user_id", "destination", "days", "budget", "created_at"],
        )
    elif entity == "destinations":
        rows = db.query(Destination).order_by(Destination.id.asc()).all()
        data = _rows_to_csv(
            [
                {
                    "id": row.id,
                    "name": row.name,
                    "city": row.city or "",
                    "lat": row.lat if row.lat is not None else "",
                    "lng": row.lng if row.lng is not None else "",
                    "tags": row.tags or "",
                    "description": row.description or "",
                    "rating": row.rating if row.rating is not None else "",
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            ["id", "name", "city", "lat", "lng", "tags", "description", "rating", "created_at"],
        )
    elif entity == "hotels":
        rows = db.query(Hotel).order_by(Hotel.id.asc()).all()
        data = _rows_to_csv(
            [
                {
                    "id": row.id,
                    "destination_id": row.destination_id or "",
                    "name": row.name,
                    "price_range": row.price_range or "",
                    "address": row.address or "",
                    "lat": row.lat if row.lat is not None else "",
                    "lng": row.lng if row.lng is not None else "",
                    "rating": row.rating if row.rating is not None else "",
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            ["id", "destination_id", "name", "price_range", "address", "lat", "lng", "rating", "created_at"],
        )
    elif entity == "activities":
        rows = db.query(Activity).order_by(Activity.id.asc()).all()
        data = _rows_to_csv(
            [
                {
                    "id": row.id,
                    "destination_id": row.destination_id or "",
                    "name": row.name,
                    "category": row.category or "",
                    "price_range": row.price_range or "",
                    "address": row.address or "",
                    "lat": row.lat if row.lat is not None else "",
                    "lng": row.lng if row.lng is not None else "",
                    "rating": row.rating if row.rating is not None else "",
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            ["id", "destination_id", "name", "category", "price_range", "address", "lat", "lng", "rating", "created_at"],
        )
    elif entity == "audit_logs":
        rows = db.query(AdminAuditLog).order_by(AdminAuditLog.id.asc()).all()
        data = _rows_to_csv(
            [
                {
                    "id": row.id,
                    "actor_user_id": row.actor_user_id,
                    "action": row.action,
                    "target_type": row.target_type,
                    "target_id": row.target_id or "",
                    "detail": row.detail or "",
                    "created_at": row.created_at.isoformat(),
                }
                for row in rows
            ],
            ["id", "actor_user_id", "action", "target_type", "target_id", "detail", "created_at"],
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported export entity")
    filename = f"{entity}_{now}.csv"
    return data, filename


@router.get('/tools/export/{entity}.csv')
def export_csv(
    entity: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    data, filename = _build_export(entity, db)
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="TOOLS_EXPORT_CSV",
        target_type=entity,
        detail={"filename": filename},
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get('/tools/backup/sqlite')
def backup_sqlite(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    _ = db
    db_path = SQLITE_FILE_PATH
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Database file not found")
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"travel_planner_backup_{stamp}.db"
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="TOOLS_BACKUP_DB",
        target_type="database",
        detail={"filename": filename},
    )
    return FileResponse(path=str(db_path), filename=filename, media_type="application/octet-stream")


def _as_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _as_int(value: str | None) -> int | None:
    if value is None or value == "":
        return None
    return int(value)


@router.post('/tools/import/{entity}.csv')
async def import_csv(
    entity: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    raw = await file.read()
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc

    reader = csv.DictReader(StringIO(content))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV has no data rows")

    inserted = 0
    now = datetime.utcnow()
    if entity == "destinations":
        for row in rows:
            rating = _as_float(row.get("rating"))
            lat = _as_float(row.get("lat"))
            lng = _as_float(row.get("lng"))
            _validate_rating(rating)
            _validate_coordinates(lat, lng)
            db.add(
                Destination(
                    name=(row.get("name") or "").strip(),
                    city=(row.get("city") or "").strip() or None,
                    lat=lat,
                    lng=lng,
                    tags=(row.get("tags") or "").strip() or None,
                    description=(row.get("description") or "").strip() or None,
                    rating=rating,
                    created_at=now,
                )
            )
            inserted += 1
    elif entity == "hotels":
        for row in rows:
            destination_id = _as_int(row.get("destination_id"))
            rating = _as_float(row.get("rating"))
            lat = _as_float(row.get("lat"))
            lng = _as_float(row.get("lng"))
            _validate_rating(rating)
            _validate_coordinates(lat, lng)
            _ensure_destination_exists(db, destination_id)
            db.add(
                Hotel(
                    destination_id=destination_id,
                    name=(row.get("name") or "").strip(),
                    price_range=(row.get("price_range") or "").strip() or None,
                    address=(row.get("address") or "").strip() or None,
                    lat=lat,
                    lng=lng,
                    rating=rating,
                    created_at=now,
                )
            )
            inserted += 1
    elif entity == "activities":
        for row in rows:
            destination_id = _as_int(row.get("destination_id"))
            rating = _as_float(row.get("rating"))
            lat = _as_float(row.get("lat"))
            lng = _as_float(row.get("lng"))
            _validate_rating(rating)
            _validate_coordinates(lat, lng)
            _ensure_destination_exists(db, destination_id)
            db.add(
                Activity(
                    destination_id=destination_id,
                    name=(row.get("name") or "").strip(),
                    category=(row.get("category") or "").strip() or None,
                    price_range=(row.get("price_range") or "").strip() or None,
                    address=(row.get("address") or "").strip() or None,
                    lat=lat,
                    lng=lng,
                    rating=rating,
                    created_at=now,
                )
            )
            inserted += 1
    else:
        raise HTTPException(status_code=400, detail="Supported import entities: destinations, hotels, activities")

    db.commit()
    log_admin_action(
        db=db,
        actor_user_id=current_user.id,
        action="TOOLS_IMPORT_CSV",
        target_type=entity,
        detail={"rows": inserted, "filename": file.filename},
    )
    return {"inserted": inserted, "entity": entity}
