/* ═══════════════════════════════════════════════════════
   Neon Serverless Postgres 数据库连接层
   ═══════════════════════════════════════════════════════ */

const { neon } = require('@neondatabase/serverless');

let sql = null;
let initialized = false;

function getConnection() {
  if (sql) return sql;

  // Vercel Neon 集成可能用不同的环境变量名
  const url =
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';

  if (!url) {
    throw new Error(
      'DATABASE_URL not found. Available env vars: ' +
      Object.keys(process.env).filter(k => k.includes('URL') || k.includes('POSTGRES') || k.includes('DATABASE')).join(', ')
    );
  }

  sql = neon(url);
  return sql;
}

async function ensureTables() {
  if (initialized) return;
  const db = getConnection();

  try {
    await db`
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
    await db`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `;

    const rows = await db`SELECT id FROM admins LIMIT 1`;
    if (rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      await db`INSERT INTO admins (username, password_hash) VALUES ('admin', ${hash})`;
      console.log('Default admin created');
    }
    initialized = true;
  } catch (err) {
    console.error('DB init error:', err.message);
    throw err;
  }
}

module.exports = {
  get sql() {
    return getConnection();
  },
  ensureTables,
};
