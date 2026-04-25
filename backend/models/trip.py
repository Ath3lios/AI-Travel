from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class TripCreate(BaseModel):
    destination: str
    departure_city: str
    days: int
    budget: str
    travel_style: List[str]
    people: int


class TripRegenerate(BaseModel):
    destination: str
    departure_city: str
    days: int
    budget: str
    travel_style: List[str]
    people: int

class TripUpdate(BaseModel):
    itinerary: Optional[dict] = None
    days: Optional[int] = None
    budget: Optional[str] = None 

class TripResponse(BaseModel):
    id: str
    user_id: str
    destination: str
    days: int
    budget: str
    itinerary: Optional[dict] = None
    created_at: datetime
