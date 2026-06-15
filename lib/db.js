/* ═══════════════════════════════════════════════════════
   Neon Serverless Postgres 数据库连接层
   Vercel 部署时通过 Storage 集成自动注入 DATABASE_URL
   本地开发时在 .env.local 中配置 DATABASE_URL
   ═══════════════════════════════════════════════════════ */

const { neon } = require('@neondatabase/serverless');

// 从环境变量获取连接字符串
// Vercel 中集成 Neon 后自动设置
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

if (!DATABASE_URL) {
  console.warn('⚠ DATABASE_URL 未设置，数据库功能不可用。请在 Vercel 中集成 Neon。');
}

const sql = neon(DATABASE_URL);

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  if (!DATABASE_URL) throw new Error('DATABASE_URL not configured');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT DEFAULT '其他',
        nickname TEXT DEFAULT '匿名',
        created_at TIMESTAMP DEFAULT NOW(),
        reply TEXT,
        replied_at TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `;

    const rows = await sql`SELECT id FROM admins LIMIT 1`;
    if (rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      await sql`INSERT INTO admins (username, password_hash) VALUES ('admin', ${hash})`;
      console.log('✓ Default admin created: admin / admin123');
    }
    initialized = true;
  } catch (err) {
    console.error('DB init error:', err);
    throw err;
  }
}

module.exports = { sql, ensureTables };
