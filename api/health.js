/* ═══════════════════════════════════════════════════════
   GET /api/health → 调试信息
   ═══════════════════════════════════════════════════════ */

const { ensureTables } = require('../lib/db.js');

module.exports = async function handler(req, res) {
  const info = {
    runtime: 'Node.js ' + process.version,
    envKeys: Object.keys(process.env)
      .filter(k => k.includes('URL') || k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('NEON') || k.includes('VERCEL'))
      .map(k => ({ key: k, value: process.env[k] ? '***set***' : 'empty' })),
    db: 'unknown',
  };

  try {
    await ensureTables();
    const { sql } = require('../lib/db.js');
    const rows = await sql`SELECT COUNT(*) as count FROM questions`;
    info.db = 'connected';
    info.questionCount = rows[0]?.count || 0;
    info.status = 'ok';
  } catch (err) {
    info.db = 'error: ' + err.message;
    info.status = 'error';
  }

  return res.json(info);
};
