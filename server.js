const express = require('express');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'anon-qa-box-secret-key-2024';
const SUBMIT_PASSWORD = '9527';

// ── Database setup ──────────────────────────────────────────
const db = new Database('qa-box.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT '其他',
    nickname TEXT DEFAULT '匿名',
    created_at DATETIME DEFAULT (datetime('now','localtime')),
    reply TEXT DEFAULT NULL,
    replied_at DATETIME DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// Seed default admin (admin / admin123)
const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('✓ Default admin created: admin / admin123');
}

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rate limiting ────────────────────────────────────────────
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 3,                // max 3 submissions per minute per IP
  message: { error: '发送太频繁了，请稍后再试~ (每分钟最多3条)' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: '操作太频繁，请稍后再试' },
});

// ── JWT auth middleware ──────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// ── API Routes ───────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toLocaleString() });
});

// Submit a question
app.post('/api/questions', submitLimiter, (req, res) => {
  const { content, category, nickname, password } = req.body;

  // Validate password
  if (password !== SUBMIT_PASSWORD) {
    return res.status(403).json({ error: '验证密码错误，无法提交~' });
  }

  // Validate content
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '内容不能为空哦~' });
  }
  if (content.trim().length > 500) {
    return res.status(400).json({ error: '内容太长啦，最多500字~' });
  }

  const validCategories = ['学习', '生活', '情感', '工作', '游戏', '吐槽', '其他'];
  const finalCategory = validCategories.includes(category) ? category : '其他';
  const finalNickname = (nickname && nickname.trim()) ? nickname.trim().slice(0, 20) : '匿名';

  const stmt = db.prepare('INSERT INTO questions (content, category, nickname) VALUES (?, ?, ?)');
  const result = stmt.run(content.trim(), finalCategory, finalNickname);

  res.json({
    success: true,
    id: result.lastInsertRowid,
    message: '提问成功！等待回复中...',
  });
});

// Get public question list
app.get('/api/questions', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(20, Math.max(1, parseInt(req.query.pageSize) || 10));
  const category = req.query.category || 'all';
  const sort = req.query.sort || 'newest'; // newest | replied

  let where = '';
  const params = [];
  if (category !== 'all') {
    where = 'WHERE category = ?';
    params.push(category);
  }

  let orderBy = 'ORDER BY created_at DESC';
  if (sort === 'replied') {
    orderBy = 'ORDER BY CASE WHEN reply IS NULL THEN 1 ELSE 0 END, created_at DESC';
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM questions ${where}`).get(...params);
  const total = countRow.total;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (page - 1) * pageSize;

  const questions = db.prepare(
    `SELECT id, content, category, nickname, created_at, reply, replied_at
     FROM questions ${where} ${orderBy} LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  res.json({
    questions,
    pagination: { page, pageSize, total, totalPages },
  });
});

// Get categories count
app.get('/api/categories', (req, res) => {
  const counts = db.prepare(
    'SELECT category, COUNT(*) as count FROM questions GROUP BY category ORDER BY count DESC'
  ).all();
  res.json(counts);
});

// ── Admin routes ────────────────────────────────────────────

// Admin login
app.post('/api/admin/login', adminLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token, username: admin.username });
});

// Admin: verify token
app.get('/api/admin/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.admin.username });
});

// Admin: reply to a question
app.post('/api/admin/reply/:id', authMiddleware, adminLimiter, (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply || !reply.trim()) {
    return res.status(400).json({ error: '回复内容不能为空' });
  }
  if (reply.trim().length > 500) {
    return res.status(400).json({ error: '回复内容太长啦，最多500字~' });
  }

  const question = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!question) {
    return res.status(404).json({ error: '问题不存在' });
  }

  db.prepare(
    "UPDATE questions SET reply = ?, replied_at = datetime('now','localtime') WHERE id = ?"
  ).run(reply.trim(), id);

  res.json({ success: true, message: '回复成功！' });
});

// Admin: delete a question
app.delete('/api/admin/questions/:id', authMiddleware, adminLimiter, (req, res) => {
  const { id } = req.params;

  const question = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!question) {
    return res.status(404).json({ error: '问题不存在' });
  }

  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  res.json({ success: true, message: '删除成功' });
});

// Admin: get all questions (with pagination)
app.get('/api/admin/questions', authMiddleware, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
  const category = req.query.category || 'all';
  const status = req.query.status || 'all'; // all | replied | unreplied

  let conditions = [];
  const params = [];

  if (category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }
  if (status === 'replied') {
    conditions.push('reply IS NOT NULL');
  } else if (status === 'unreplied') {
    conditions.push('reply IS NULL');
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM questions ${where}`).get(...params);
  const total = countRow.total;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const offset = (page - 1) * pageSize;

  const questions = db.prepare(
    `SELECT * FROM questions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset);

  res.json({
    questions,
    pagination: { page, pageSize, total, totalPages },
  });
});

// ── Serve frontend ────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n◆ ly的提问箱已启动`);
  console.log(`  LOCAL   : http://localhost:${PORT}`);
  console.log(`  ADMIN   : http://localhost:${PORT}/admin`);
  console.log(`  AUTH    : admin / admin123`);
  console.log(`  PASSKEY : ${SUBMIT_PASSWORD}\n`);
});
