/* ═══════════════════════════════════════════════════════
   POST   /api/admin/questions/[id] → 回复问题
   DELETE /api/admin/questions/[id] → 删除问题
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../../../lib/db.js');
const { authRequired } = require('../../../lib/auth.js');

module.exports = async function handler(req, res) {
  const admin = authRequired(req, res);
  if (!admin) return;

  const { id } = req.query;
  await ensureTables();

  // ── POST: 回复 ──
  if (req.method === 'POST') {
    const { reply } = req.body || {};
    if (!reply || !reply.trim()) {
      return res.status(400).json({ error: '回复内容不能为空' });
    }
    if (reply.trim().length > 500) {
      return res.status(400).json({ error: '回复内容太长啦，最多500字~' });
    }

    const check = await sql('SELECT id FROM questions WHERE id = $1', [id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '问题不存在' });
    }

    await sql('UPDATE questions SET reply = $1, replied_at = NOW() WHERE id = $2', [reply.trim(), id]);

    return res.json({ success: true, message: '回复成功！' });
  }

  // ── DELETE: 删除 ──
  if (req.method === 'DELETE') {
    const check = await sql('SELECT id FROM questions WHERE id = $1', [id]);
    if (check.length === 0) {
      return res.status(404).json({ error: '问题不存在' });
    }

    await sql('DELETE FROM questions WHERE id = $1', [id]);

    return res.json({ success: true, message: '删除成功' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
