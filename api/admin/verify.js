/* ═══════════════════════════════════════════════════════
   GET /api/admin/verify → 验证 token 是否有效
   ═══════════════════════════════════════════════════════ */

const { authRequired } = require('../../lib/auth.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = authRequired(req, res);
  if (!admin) return; // response already sent
  return res.json({ valid: true, username: admin.username });
};
