from sqlalchemy import Column, Integer, String, Enum, Date, Time, DateTime, ForeignKey, SmallInteger
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "user"

    id       = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(100), nullable=False)
    role     = Column(Enum("admin", "user"), default="user")


class Venue(Base):
    __tablename__ = "venue"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    venue_name = Column(String(100), nullable=False)
    location   = Column(String(100))
    status     = Column(SmallInteger, default=1)
    version    = Column(Integer, default=0)   # 乐观锁版本号


class Reservation(Base):
    __tablename__ = "reservation"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("user.id"), nullable=False)
    venue_id     = Column(Integer, ForeignKey("venue.id"), nullable=False)
    reserve_date = Column(Date, nullable=False)
    start_time   = Column(Time, nullable=False)
    end_time     = Column(Time, nullable=False)
    status       = Column(Enum("pending", "approved", "rejected"), default="pending")
    create_time  = Column(DateTime, server_default=func.now())