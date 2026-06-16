/* ═══════════════════════════════════════════════════════
   Neon Serverless Postgres 数据库连接层
   ═══════════════════════════════════════════════════════ */

const { neon } = require('@neondatabase/serverless');

let sql = null;

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
  const db = getConnection();

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

  // 确保默认管理员存在
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    await db`
      INSERT INTO admins (username, password_hash)
      VALUES ('admin', ${hash})
      ON CONFLICT (username) DO NOTHING
    `;
  } catch (err) {
    // 忽略重复插入错误
    if (!err.message.includes('duplicate') && !err.message.includes('unique')) {
      console.error('Admin insert error:', err.message);
    }
  }
}

module.exports = {
  get sql() {
    return getConnection();
  },
  ensureTables,
};
