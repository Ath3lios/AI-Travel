from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DestinationCreate(BaseModel):
    name: str
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[float] = None


class DestinationUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[float] = None


class DestinationResponse(BaseModel):
    id: str
    name: str
    city: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[float] = None
    created_at: datetime


class HotelCreate(BaseModel):
    destination_id: Optional[int] = None
    name: str
    price_range: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None


class HotelUpdate(BaseModel):
    destination_id: Optional[int] = None
    name: Optional[str] = None
    price_range: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None


class HotelResponse(BaseModel):
    id: str
    destination_id: Optional[int] = None
    name: str
    price_range: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None
    created_at: datetime


class ActivityCreate(BaseModel):
    destination_id: Optional[int] = None
    name: str
    category: Optional[str] = None
    price_range: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None


class ActivityUpdate(BaseModel):
    destination_id: Optional[int] = None
    name: Optional[str] = None
    category: Optional[str] = None
    price_range: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None


class ActivityResponse(BaseModel):
    id: str
    destination_id: Optional[int] = None
    name: str
    category: Optional[str] = None
    price_range: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = None
    created_at: datetime
