-- ═══════════════════════════════════════════════════════
-- 匿名提问箱 - 数据库建表语句
-- Vercel Postgres 版本
-- 在 Vercel Dashboard → Storage → Query 中执行
-- 或者：应用首次请求时自动建表（lib/db.js）
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT DEFAULT '其他',
  nickname TEXT DEFAULT '匿名',
  created_at TIMESTAMP DEFAULT NOW(),
  reply TEXT,
  replied_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

-- 默认管理员: admin / admin123
-- 密码哈希由 bcryptjs 生成，应用首次启动时自动插入
