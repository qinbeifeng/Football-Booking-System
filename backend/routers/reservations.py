from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import Reservation, User
from schemas import ReservationCreate, ReservationOut, ReservationInfoOut
from routers.auth import get_current_user, require_admin
from typing import List
from datetime import datetime, time, timedelta

router = APIRouter(prefix="/reservations", tags=["预约"])


@router.get("/info", response_model=List[ReservationInfoOut])
def list_all_info(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    管理员：查询所有预约（使用数据库视图 reservation_info）
    """
    rows = db.execute(
        text("SELECT * FROM reservation_info ORDER BY reserve_date DESC")
    ).mappings().all()
    result = []
    for r in rows:
        d = dict(r)
        for key in ("start_time", "end_time"):
            if isinstance(d.get(key), timedelta):
                total_seconds = int(d[key].total_seconds())
                d[key] = time(hour=total_seconds // 3600,
                              minute=(total_seconds % 3600) // 60,
                              second=total_seconds % 60)
        result.append(d)
    return result


@router.get("/mine", response_model=List[ReservationInfoOut])
def my_reservations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """当前用户：查询自己的预约记录（从 Token 中获取 user_id，不会串号）"""
    rows = db.execute(
        text("""
            SELECT * FROM reservation_info
            WHERE user_id = :uid
            ORDER BY reserve_date DESC
        """),
        {"uid": current_user.id},
    ).mappings().all()
    result = []
    for r in rows:
        d = dict(r)
        for key in ("start_time", "end_time"):
            if isinstance(d.get(key), timedelta):
                total_seconds = int(d[key].total_seconds())
                d[key] = time(hour=total_seconds // 3600,
                              minute=(total_seconds % 3600) // 60,
                              second=total_seconds % 60)
        result.append(d)
    return result


@router.get("/available/{venue_id}", response_model=List[ReservationOut])
def available_slots(venue_id: int, reserve_date: str, db: Session = Depends(get_db)):
    """
    查询某场地某天已被预约的时间段（只查 approved）
    """
    rows = db.query(Reservation).filter(
        Reservation.venue_id     == venue_id,
        Reservation.reserve_date == reserve_date,
        Reservation.status       == "approved",
    ).all()
    return rows


@router.post("/", response_model=ReservationOut)
def create_reservation(
    body: ReservationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    用户：提交预约（user_id 从 JWT Token 中获取，不可伪造）
    """
    try:
        # ── 第〇步：禁止预约过去的时间 ──────────────────────────
        reserve_datetime = datetime.combine(body.reserve_date, body.start_time)
        if reserve_datetime < datetime.now():
            raise HTTPException(400, detail="不能预约过去的时间段")

        # ── 第一步：悲观锁（只检查 approved 的预约）─────────────
        db.execute(
            text("""
                SELECT id FROM reservation
                WHERE venue_id     = :vid
                  AND reserve_date = :d
                  AND start_time   < :et
                  AND end_time     > :st
                  AND status       = 'approved'
                FOR UPDATE
            """),
            {
                "vid": body.venue_id,
                "d":   body.reserve_date,
                "st":  str(body.start_time),
                "et":  str(body.end_time),
            }
        )

        # ── 第二步：写入（user_id 来自 Token，安全可靠）──────────
        r = Reservation(
            user_id=current_user.id,
            venue_id=body.venue_id,
            reserve_date=body.reserve_date,
            start_time=body.start_time,
            end_time=body.end_time,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return r

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
        if "该时间段已被预约" in error_msg:
            raise HTTPException(400, detail="该时间段已被预约，请选择其他时间")
        raise HTTPException(400, detail="预约失败，请稍后重试")


@router.delete("/{reservation_id}")
def delete_reservation(
    reservation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    用户取消自己的预约 / 管理员删除违规预约
    非管理员只能删除自己的预约
    """
    try:
        r = db.query(Reservation).filter(Reservation.id == reservation_id).first()
        if not r:
            raise HTTPException(404, "预约记录不存在")

        # 权限检查：非管理员只能删除自己的预约
        if current_user.role != "admin" and r.user_id != current_user.id:
            raise HTTPException(403, detail="无权操作他人的预约")

        db.delete(r)
        db.commit()
        return {"message": "取消成功"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(400, detail="取消失败，请稍后重试")


@router.put("/{reservation_id}/approve")
def approve_reservation(
    reservation_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员：审核通过预约"""
    r = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not r:
        raise HTTPException(404, "预约记录不存在")
    if r.status == "approved":
        raise HTTPException(400, detail="该预约已是通过状态")
    # 检查冲突
    conflict = db.query(Reservation).filter(
        Reservation.venue_id == r.venue_id,
        Reservation.reserve_date == r.reserve_date,
        Reservation.start_time < r.end_time,
        Reservation.end_time > r.start_time,
        Reservation.status == "approved",
        Reservation.id != reservation_id,
    ).first()
    if conflict:
        raise HTTPException(400, detail="该时间段已被其他预约占用，无法通过")
    r.status = "approved"
    db.commit()
    return {"message": "已审核通过", "status": "approved"}


@router.put("/{reservation_id}/reject")
def reject_reservation(
    reservation_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """管理员：驳回预约"""
    r = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    if not r:
        raise HTTPException(404, "预约记录不存在")
    if r.status == "rejected":
        raise HTTPException(400, detail="该预约已被驳回")
    r.status = "rejected"
    db.commit()
    return {"message": "已驳回", "status": "rejected"}
