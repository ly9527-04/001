/* ═══════════════════════════════════════════════════════
   GET  /api/questions → 公开提问列表
   POST /api/questions → 提交新提问
   ═══════════════════════════════════════════════════════ */

const { sql, ensureTables } = require('../lib/db.js');

const SUBMIT_PASSWORD = '9527';
const VALID_CATEGORIES = ['学习', '生活', '情感', '工作', '游戏', '吐槽', '其他'];
const rateMap = new Map();

module.exports = async function handler(req, res) {
  await ensureTables();

  // ── GET: 列表 ──────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize) || 10));
      const category = req.query.category || 'all';
      const sort = req.query.sort || 'newest';
      const offset = (page - 1) * pageSize;

      // 统一查询全部，前端可自行筛选
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
      return res.status(500).json({ error: err.message, stack: err.stack });
    }
  }

  // ── POST: 提交 ─────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const ip = req.headers['x-forwarded-for'] || 'unknown';
      const now = Date.now();
      const timestamps = rateMap.get(ip) || [];
      const recent = timestamps.filter(t => now - t < 60000);
      if (recent.length >= 3) {
        rateMap.set(ip, recent);
        return res.status(429).json({ error: '发送太频繁了，请稍后再试~ (每分钟最多3条)' });
      }
      recent.push(now);
      rateMap.set(ip, recent);

      const { content, category, nickname, password } = req.body || {};

      if (password !== SUBMIT_PASSWORD) {
        return res.status(403).json({ error: '验证密码错误，无法提交~' });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ error: '内容不能为空哦~' });
      }
      if (content.trim().length > 500) {
        return res.status(400).json({ error: '内容太长啦，最多500字~' });
      }

      const finalCat = VALID_CATEGORIES.includes(category) ? category : '其他';
      const finalNick = (nickname && nickname.trim()) ? nickname.trim().slice(0, 20) : '匿名';

      const rows = await sql`
        INSERT INTO questions (content, category, nickname)
        VALUES (${content.trim()}, ${finalCat}, ${finalNick})
        RETURNING id
      `;

      return res.json({ success: true, id: rows[0].id, message: '提问成功！等待回复中...' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
