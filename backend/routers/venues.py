from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Venue
from schemas import VenueCreate, VenueUpdate, VenueOut
from typing import List

router = APIRouter(prefix="/venues", tags=["场地"])


@router.get("/", response_model=List[VenueOut])
def list_venues(db: Session = Depends(get_db)):
    """查询所有场地（含暂停使用的）"""
    return db.query(Venue).order_by(Venue.id).all()


@router.get("/{venue_id}", response_model=VenueOut)
def get_venue(venue_id: int, db: Session = Depends(get_db)):
    """查询单个场地"""
    v = db.query(Venue).filter(Venue.id == venue_id).first()
    if not v:
        raise HTTPException(404, "场地不存在")
    return v


@router.post("/", response_model=VenueOut)
def create_venue(body: VenueCreate, db: Session = Depends(get_db)):
    """管理员：新增场地"""
    v = Venue(**body.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put("/{venue_id}", response_model=VenueOut)
def update_venue(venue_id: int, body: VenueUpdate, db: Session = Depends(get_db)):
    """
    管理员：修改场地信息
    使用乐观锁：通过 version 字段判断数据是否被别人改过
    """
    v = db.query(Venue).filter(Venue.id == venue_id).first()
    if not v:
        raise HTTPException(404, "场地不存在")

    current_version = v.version

    # 更新字段
    for k, val in body.model_dump(exclude_none=True).items():
        setattr(v, k, val)

    # 乐观锁：version + 1，若其他人已修改过（version变了）则更新行数为0
    result = db.execute(
        __import__("sqlalchemy").text(
            "UPDATE venue SET venue_name=:name, location=:loc, status=:st, version=version+1 "
            "WHERE id=:id AND version=:ver"
        ),
        {
            "name": v.venue_name,
            "loc":  v.location,
            "st":   v.status,
            "id":   venue_id,
            "ver":  current_version,
        }
    )
    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(409, "数据已被其他人修改，请刷新后重试")

    db.commit()
    db.refresh(v)
    return v


@router.delete("/{venue_id}")
def delete_venue(venue_id: int, db: Session = Depends(get_db)):
    """管理员：删除场地"""
    v = db.query(Venue).filter(Venue.id == venue_id).first()
    if not v:
        raise HTTPException(404, "场地不存在")
    db.delete(v)
    db.commit()
    return {"message": "删除成功"}