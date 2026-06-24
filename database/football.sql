CREATE DATABASE IF NOT EXISTS football_booking
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE football_booking;

-- ================================================
-- 建表
-- ================================================

-- 用户表
CREATE TABLE user (
    id       INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50)  UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role     ENUM('admin','user') DEFAULT 'user'
);

-- 场地表（version字段用于乐观锁并发控制）
CREATE TABLE venue (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    venue_name VARCHAR(100) NOT NULL,
    location   VARCHAR(100),
    status     TINYINT DEFAULT 1,   -- 1=可用 0=关闭
    version    INT     DEFAULT 0    -- 乐观锁版本号
);

-- 预约表
CREATE TABLE reservation (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    user_id      INT      NOT NULL,
    venue_id     INT      NOT NULL,
    reserve_date DATE     NOT NULL,
    start_time   TIME     NOT NULL,
    end_time     TIME     NOT NULL,
    status       ENUM('pending','approved','rejected') DEFAULT 'pending',
    create_time  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)  REFERENCES user(id),
    FOREIGN KEY (venue_id) REFERENCES venue(id)
);

-- ================================================
-- 加分项①：视图
-- 作用：将三张表关联查询封装成视图，管理员直接查视图
--       不需要每次写复杂的 JOIN 语句
-- ================================================
CREATE VIEW reservation_info AS
SELECT
    r.id,
    r.user_id,
    r.venue_id,
    u.username,
    v.venue_name,
    r.reserve_date,
    r.start_time,
    r.end_time,
    r.status,
    r.create_time
FROM reservation r
JOIN user  u ON r.user_id  = u.id
JOIN venue v ON r.venue_id = v.id;

-- ================================================
-- 加分项②：索引
-- 作用：用户查询某天哪些时间段已被预约时，
--       MySQL 直接走索引定位，不用全表扫描
-- ================================================
CREATE INDEX idx_reservation_date ON reservation(reserve_date);
CREATE INDEX idx_reservation_venue ON reservation(venue_id);

-- ================================================
-- 加分项③：触发器（第一层并发防护）
-- 作用：在数据库层面拦截时间冲突
--       即使程序层出现漏洞，数据库也会兜底
-- 注意：这是防护的第二道门，第一道门在程序里（FOR UPDATE）
-- ================================================
DELIMITER $$
CREATE TRIGGER before_reservation_insert
BEFORE INSERT ON reservation
FOR EACH ROW
BEGIN
    DECLARE cnt INT;
    -- 只检查 approved 的预约，确保 pending 不占坑
    SELECT COUNT(*) INTO cnt
    FROM reservation
    WHERE venue_id     = NEW.venue_id
      AND reserve_date = NEW.reserve_date
      AND start_time   < NEW.end_time    -- 已有预约的开始时间 早于 新预约的结束时间
      AND end_time     > NEW.start_time  -- 已有预约的结束时间 晚于 新预约的开始时间
      AND status       = 'approved';
    IF cnt > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '该时间段已被预约，请选择其他时间';
    END IF;
END$$
DELIMITER ;

-- ================================================
-- 示例数据
-- ================================================
INSERT INTO user (username, password, role) VALUES
    ('admin', 'adminSELECT * FROM user;123', 'admin'),
    ('alice', 'alice123', 'user'),
    ('bob',   'bob123',   'user');

INSERT INTO venue (venue_name, location, status) VALUES
    ('南湖足球场', '南湖南', 1),
    ('鉴湖足球场', '鉴湖', 1),
    ('西苑足球场', '西苑', 1);

-- ================================================
-- 验证脚本（建完后可手动执行这段验证）
-- ================================================

-- 验证视图
-- SELECT * FROM reservation_info;

-- 验证触发器（第二条会被触发器拦截报错）
-- INSERT INTO reservation(user_id,venue_id,reserve_date,start_time,end_time)
--     VALUES (2,1,'2026-07-01','10:00:00','12:00:00');
-- INSERT INTO reservation(user_id,venue_id,reserve_date,start_time,end_time)
--     VALUES (3,1,'2026-07-01','11:00:00','13:00:00'); -- 时间重叠，触发器报错

-- 验证索引
-- EXPLAIN SELECT * FROM reservation WHERE reserve_date = '2026-07-01';
-- key 列显示 idx_reservation_date 说明索引生效