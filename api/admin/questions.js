/* ═══════════════════════════════════════════════════════
   GET /api/admin/questions → 管理员查看所有提问
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../../lib/db.js');
const { authRequired } = require('../../lib/auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = authRequired(req, res);
  if (!admin) return;

  await ensureTables();

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
  const category = req.query.category || 'all';
  const status = req.query.status || 'all';
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const params = [];

  if (category !== 'all') {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (status === 'replied') {
    conditions.push('reply IS NOT NULL');
  } else if (status === 'unreplied') {
    conditions.push('reply IS NULL');
  }

  const whereSQL = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRows = await sql(`SELECT COUNT(*) as total FROM questions ${whereSQL}`, params);
  const total = parseInt(countRows[0].total);
  const totalPages = Math.ceil(total / pageSize) || 1;

  const pIdx = params.length;
  const questions = await sql(
    `SELECT id, content, category, nickname,
            to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at,
            reply,
            to_char(replied_at, 'YYYY-MM-DD HH24:MI') as replied_at
     FROM questions ${whereSQL}
     ORDER BY created_at DESC
     LIMIT $${pIdx + 1} OFFSET $${pIdx + 2}`,
    [...params, pageSize, offset]
  );

  return res.json({ questions, pagination: { page, pageSize, total, totalPages } });
};
