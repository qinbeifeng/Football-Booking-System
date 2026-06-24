# 武汉理工大学 — 足球场地预约管理系统

数据库课程设计项目，基于 **FastAPI + MySQL + 原生 JavaScript** 的足球场地预约系统。

## 技术栈

| 层 | 技术 |
|---|------|
| 后端框架 | FastAPI 0.111 |
| ORM | SQLAlchemy 2.0 |
| 数据库 | MySQL 8.0 |
| 认证 | JWT (python-jose) |
| 前端 | 原生 HTML / CSS / JavaScript (SPA) |
| 部署 | Uvicorn |

## 功能概览

### 普通用户
- **账号注册 / 登录** — 用户名 + 密码即可注册
- **场地浏览** — 查看所有场地信息及开放状态
- **场地预约** — 选择场地、日期、时间段提交预约
- **我的预约** — 查看预约记录，取消待审核的预约
- **首页概览** — 查看今日预约统计和热门场地

### 管理员
- **场地管理** — 增删改场地（含乐观锁并发控制）
- **预约审核** — 通过 / 驳回预约申请，冲突检测
- **数据统计** — 各场地预约分布、使用率分析

## 项目结构

```
football-booking-system/
├── backend/
│   ├── main.py                 # FastAPI 入口，应用初始化
│   ├── database.py             # 数据库连接（MySQL）
│   ├── models.py               # SQLAlchemy 模型定义
│   ├── schemas.py              # Pydantic 请求/响应模型
│   ├── requirements.txt        # Python 依赖
│   └── routers/
│       ├── __init__.py
│       ├── auth.py             # 登录 / 注册 / JWT 认证
│       ├── venues.py           # 场地 CRUD（含乐观锁）
│       └── reservations.py     # 预约管理（含悲观锁 + 冲突检测）
├── fronted/
│   ├── whut_football_booking_system.html   # 主页面
│   ├── styles.css                          # 样式
│   └── app.js                              # 前端逻辑 (SPA)
└── database/
    └── football.sql            # 建库建表 SQL + 触发器 + 索引 + 视图
```

## 快速开始

### 1. 准备 MySQL 数据库

```bash
# 登录 MySQL
mysql -u root -p

# 执行建库脚本
source database/football.sql
```

### 2. 配置数据库连接

编辑 `backend/database.py`，修改为你的 MySQL 密码：

```python
DATABASE_URL = "mysql+pymysql://root:你的密码@localhost:3306/football_booking"
```

### 3. 安装 Python 依赖

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4. 启动后端

```bash
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

### 5. 打开前端

浏览器打开 `fronted/whut_football_booking_system.html` 即可。

或者用任意 HTTP 服务器托管：

```bash
cd fronted
python3 -m http.server 8080
# 访问 http://localhost:8080
```

### 6. 访问 API 文档

启动后端后访问：
- Swagger UI: [http://localhost:9000/docs](http://localhost:9000/docs)
- ReDoc: [http://localhost:9000/redoc](http://localhost:9000/redoc)

## 默认账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 普通用户 | alice | alice123 |
| 普通用户 | bob | bob123 |

> 也可直接在前端点击「没有账号？立即注册」创建新账户。

## API 接口

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/register` | 用户注册 |
| POST | `/auth/login` | 用户登录 |

### 场地
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/venues/` | 查询所有场地 |
| GET | `/venues/{id}` | 查询单个场地 |
| POST | `/venues/` | 新增场地（管理员） |
| PUT | `/venues/{id}` | 修改场地（管理员，乐观锁） |
| DELETE | `/venues/{id}` | 删除场地（管理员） |

### 预约
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reservations/mine` | 我的预约 |
| GET | `/reservations/info` | 全部预约（管理员，走视图） |
| POST | `/reservations/` | 提交预约 |
| DELETE | `/reservations/{id}` | 取消预约 |
| PUT | `/reservations/{id}/approve` | 审核通过（管理员） |
| PUT | `/reservations/{id}/reject` | 驳回预约（管理员） |

## 数据库设计亮点

- **视图** `reservation_info` — 封装三表 JOIN，简化查询
- **索引** — 对 `reserve_date` 和 `venue_id` 建立索引，加速时间段查询
- **触发器** `before_reservation_insert` — 数据库层面拦截时间冲突，双重防护
- **乐观锁** — 场地表的 `version` 字段保证并发更新安全
- **悲观锁** — 预约时使用 `SELECT ... FOR UPDATE` 防止时间冲突

## 安全设计

- 预约时 `user_id` 从 JWT Token 中提取，不可伪造
- 非管理员只能操作自己的预约（后端校验）
- 注册自动分配 `user` 角色，无法注册为管理员
- 双重时间校验：前端拦截 + 后端校验过去的时间段
