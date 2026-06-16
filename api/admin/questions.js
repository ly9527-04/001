/* ═══════════════════════════════════════════════════════
   GET /api/admin/questions → 管理员查看所有提问
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../../lib/db.js');
const { authRequired } = require('../../lib/auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = authRequired(req, res);
  if (!admin) return;

  try {
    await ensureTables();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const questions = await sql`
      SELECT id, content, category, nickname,
             to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at,
             reply,
             to_char(replied_at, 'YYYY-MM-DD HH24:MI') as replied_at
      FROM questions
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countRows = await sql`SELECT COUNT(*)::int as total FROM questions`;
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return res.json({ questions, pagination: { page, pageSize, total, totalPages } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
