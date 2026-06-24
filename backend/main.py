from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, venues, reservations
from database import engine, SessionLocal, Base
from models import User, Venue

app = FastAPI(
    title="足球场地预约系统",
    description="数据库课程设计项目",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # 开发阶段放开，上线后改为前端域名
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(venues.router)
app.include_router(reservations.router)


@app.on_event("startup")
def init_database():
    """应用启动时自动建表，并填充默认用户和场地（如不存在则创建）"""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ---- 默认用户 ----
        default_users = [
            ("admin", "admin123", "admin"),
            ("alice", "alice123", "user"),
            ("bob",   "bob123",   "user"),
        ]
        for uname, pwd, role in default_users:
            if not db.query(User).filter(User.username == uname).first():
                db.add(User(username=uname, password=pwd, role=role))

        # ---- 默认场地 ----
        default_venues = [
            ("南湖足球场", "南湖南"),
            ("鉴湖足球场", "鉴湖"),
            ("西苑足球场", "西苑"),
        ]
        for vname, vloc in default_venues:
            if not db.query(Venue).filter(Venue.venue_name == vname).first():
                db.add(Venue(venue_name=vname, location=vloc))

        db.commit()
        print("✅ 数据库初始化完成")
    except Exception as e:
        db.rollback()
        print(f"⚠️  数据库初始化警告: {e}")
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "足球场地预约系统 API 运行中 🚀"}