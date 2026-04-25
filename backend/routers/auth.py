from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from config import settings
from database import User, get_db
from models.user import TokenResponse, UserCreate, UserLogin, UserResponse
from services.auth_service import create_access_token, decode_token, hash_password, verify_password

router = APIRouter(prefix='/auth', tags=['auth'])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/login')


def _get_admin_emails() -> set[str]:
    return {
        email.strip().lower()
        for email in settings.admin_emails.split(',')
        if email.strip()
    }


def _sync_user_role(db: Session, user: User) -> User:
    admin_emails = _get_admin_emails()
    expected_role = 'admin' if user.email.lower() in admin_emails else 'user'
    if user.role != expected_role:
        user.role = expected_role
        db.commit()
        db.refresh(user)
    return user


def _to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        is_active=bool(user.is_active),
        created_at=user.created_at,
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail='Token khong hop le')
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail='Khong tim thay user')
    if not user.is_active:
        raise HTTPException(status_code=403, detail='Tai khoan da bi khoa')
    return _sync_user_role(db, user)


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='Chi admin moi co quyen truy cap')
    return current_user


@router.post('/register', response_model=TokenResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail='Email da duoc su dung')
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password=hash_password(user_data.password),
        role='user',
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    new_user = _sync_user_role(db, new_user)

    token = create_access_token({'sub': str(new_user.id)})
    return TokenResponse(
        access_token=token,
        user=_to_user_response(new_user),
    )


@router.post('/login', response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(status_code=401, detail='Email hoac mat khau sai')
    if not user.is_active:
        raise HTTPException(status_code=403, detail='Tai khoan da bi khoa')
    user = _sync_user_role(db, user)

    token = create_access_token({'sub': str(user.id)})
    return TokenResponse(
        access_token=token,
        user=_to_user_response(user),
    )


@router.get('/me', response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return _to_user_response(current_user)
