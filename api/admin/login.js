/* ═══════════════════════════════════════════════════════
   POST /api/admin/login → 管理员登录
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../../lib/db.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'anon-qa-box-secret-2024';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  await ensureTables();

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const rows = await sql('SELECT * FROM admins WHERE username = $1', [username]);
  const admin = rows[0];

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({ success: true, token, username: admin.username });
};
