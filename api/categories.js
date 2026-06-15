/* ═══════════════════════════════════════════════════════
   GET /api/categories → 各分类问题数量统计
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../lib/db.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  await ensureTables();

  const { rows } = await sql`
    SELECT category, COUNT(*)::int as count
    FROM questions
    GROUP BY category
    ORDER BY count DESC
  `;

  return res.json(rows);
};
