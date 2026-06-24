from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional


# ────────────────────────────────────────
# 认证
# ────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int


# ────────────────────────────────────────
# 场地
# ────────────────────────────────────────
class VenueCreate(BaseModel):
    venue_name: str
    location: Optional[str] = None

class VenueUpdate(BaseModel):
    venue_name: Optional[str] = None
    location:   Optional[str] = None
    status:     Optional[int] = None

class VenueOut(BaseModel):
    id:         int
    venue_name: str
    location:   Optional[str]
    status:     int
    version:    int

    class Config:
        from_attributes = True


# ────────────────────────────────────────
# 预约
# ────────────────────────────────────────
class ReservationCreate(BaseModel):
    venue_id:     int
    reserve_date: date
    start_time:   time
    end_time:     time

class ReservationOut(BaseModel):
    id:           int
    user_id:      int
    venue_id:     int
    reserve_date: date
    start_time:   time
    end_time:     time
    status:       str = "pending"
    create_time:  Optional[datetime]

    class Config:
        from_attributes = True

class ReservationInfoOut(BaseModel):
    """预约信息（含用户名和场地名），用于前端表格展示"""
    id:           int
    user_id:      int
    venue_id:     int
    username:     str
    venue_name:   str
    reserve_date: date
    start_time:   time
    end_time:     time
    status:       str = "pending"
    create_time:  Optional[datetime]