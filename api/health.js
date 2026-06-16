/* ═══════════════════════════════════════════════════════
   GET /api/health → 检查数据库连接状态
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../lib/db.js');

module.exports = async function handler(req, res) {
  const info = {
    status: 'checking',
    database: 'unknown',
    env: 'unknown',
  };

  // 检查环境变量
  info.env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
  };

  // 检查数据库
  try {
    await ensureTables();
    const rows = await sql`SELECT COUNT(*) as count FROM questions`;
    info.status = 'ok';
    info.database = 'connected';
    info.questionCount = rows[0]?.count || 0;
  } catch (err) {
    info.status = 'error';
    info.database = 'disconnected';
    info.error = err.message;
  }

  return res.json(info);
};
