/* ═══════════════════════════════════════════════════════
   JWT 认证中间件（Vercel serverless 版本）
   ═══════════════════════════════════════════════════════ */

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'anon-qa-box-secret-2024';

function authRequired(req, res) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: '请先登录' });
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
    return null;
  }
}

module.exports = { authRequired, JWT_SECRET };
