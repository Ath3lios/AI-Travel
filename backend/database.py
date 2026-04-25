from datetime import datetime
from pathlib import Path

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./travel_planner.db"
SQLITE_FILE_PATH = Path(__file__).resolve().parent / "travel_planner.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String, default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer)
    destination = Column(String)
    days = Column(Integer)
    budget = Column(String)
    travel_style = Column(String)
    people = Column(Integer)
    itinerary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Destination(Base):
    __tablename__ = "destinations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    city = Column(String, index=True, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    tags = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Hotel(Base):
    __tablename__ = "hotels"
    id = Column(Integer, primary_key=True, index=True)
    destination_id = Column(Integer, ForeignKey("destinations.id"), index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    price_range = Column(String, nullable=True)
    address = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    destination_id = Column(Integer, ForeignKey("destinations.id"), index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    category = Column(String, index=True, nullable=True)
    price_range = Column(String, nullable=True)
    address = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, index=True, nullable=False)
    action = Column(String, index=True, nullable=False)
    target_type = Column(String, index=True, nullable=False)
    target_id = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        user_columns = conn.execute(text("PRAGMA table_info(users)")).fetchall()
        user_column_names = {col[1] for col in user_columns}
        if "role" not in user_column_names:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'"))
            conn.execute(text("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''"))
        if "is_active" not in user_column_names:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            conn.execute(text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
