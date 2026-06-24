from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ⚠️ 修改成你自己的 MySQL 密码
DATABASE_URL = "mysql+pymysql://root:zzJ3266140065@localhost:3306/football_booking"

engine = create_engine(
    DATABASE_URL,
    # 连接池配置，防止连接超时断开
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：每个请求创建一个数据库会话，请求结束后关闭"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()