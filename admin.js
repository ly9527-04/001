/* ═══════════════════════════════════════════════════════
   ly的提问箱 - 管理后台逻辑
   ═══════════════════════════════════════════════════════ */

// ── State ───────────────────────────────────────────────
let token = localStorage.getItem('admin_token');
let currentPage = 1;

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    verifyToken();
  }
});

// ── Toast ───────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Login ───────────────────────────────────────────────
async function adminLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    return showToast('请输入用户名和密码', 'error');
  }

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      token = data.token;
      localStorage.setItem('admin_token', token);
      showToast('[ OK ] ACCESS_GRANTED — ' + data.username, 'success');
      showAdminPanel(data.username);
      loadAdminQuestions(1);
    } else {
      showToast('❌ ' + (data.error || '登录失败'), 'error');
    }
  } catch (err) {
    showToast('❌ 网络错误', 'error');
  }
}

// ── Verify Token ────────────────────────────────────────
async function verifyToken() {
  try {
    const res = await fetch('/api/admin/verify', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      showAdminPanel(data.username);
      loadAdminQuestions(1);
    } else {
      logout();
    }
  } catch {
    logout();
  }
}

// ── Show/Hide Panels ────────────────────────────────────
function showAdminPanel(username) {
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  document.getElementById('adminTitle').textContent = `// CONSOLE : ${username.toUpperCase()}`;
}

function logout() {
  localStorage.removeItem('admin_token');
  token = null;
  document.getElementById('loginCard').style.display = 'block';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminTitle').textContent = '// ADMIN_CONSOLE';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
}

function adminLogout() {
  if (confirm('确定要退出登录吗？')) {
    logout();
    showToast('已退出登录', 'info');
  }
}

// ── Load Admin Questions ────────────────────────────────
async function loadAdminQuestions(page = 1) {
  if (!token) return;
  currentPage = page;

  const listEl = document.getElementById('adminQuestionList');
  const pagEl = document.getElementById('adminPagination');
  const category = document.getElementById('adminFilterCat').value;
  const status = document.getElementById('adminFilterStatus').value;

  listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#b2bec3;">⏳ 加载中...</div>';

  try {
    const params = new URLSearchParams({ page, pageSize: 20, category, status });
    const res = await fetch(`/api/admin/questions?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 401) {
      logout();
      showToast('登录已过期，请重新登录', 'error');
      return;
    }

    const data = await res.json();

    if (!data.questions || data.questions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>没有匹配的问题</p>
        </div>`;
      pagEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = data.questions.map(q => renderAdminQuestion(q)).join('');
    renderAdminPagination(data.pagination, pagEl);
  } catch (err) {
    listEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">😵</span>
        <p>加载失败，请刷新重试</p>
      </div>`;
    pagEl.innerHTML = '';
  }
}

// ── Render Admin Question ───────────────────────────────
function renderAdminQuestion(q) {
  const catEmojis = { '学习': '📚', '生活': '🌟', '情感': '💕', '工作': '💼', '游戏': '🎮', '吐槽': '💢', '其他': '📌' };
  const emoji = catEmojis[q.category] || '📌';

  const replySection = q.reply ? `
    <div class="reply-bubble">
      ${escapeHTML(q.reply)}
      <div class="reply-time">回复于 ${q.replied_at || ''}</div>
    </div>
  ` : `
    <div class="reply-form" id="replyForm-${q.id}">
      <input type="text" id="replyInput-${q.id}" placeholder="输入回复内容..." maxlength="500">
      <button class="btn btn-success btn-sm" onclick="doReply(${q.id})">💬 回复</button>
    </div>
  `;

  return `
    <div class="question-item" style="border-left-color: ${q.reply ? 'var(--green)' : 'var(--orange)'};">
      <div class="q-meta">
        <span class="q-cat" data-cat="${q.category}">${emoji} ${q.category}</span>
        <span class="q-nickname">🕶️ ${escapeHTML(q.nickname || '匿名')}</span>
        <span class="q-time">${q.created_at}</span>
        ${q.reply ? '<span class="badge badge-replied">✅ 已回复</span>' : '<span class="badge badge-new">🆕 待回复</span>'}
        <span style="font-size:0.7rem;color:var(--text-muted)">ID:${q.id}</span>
      </div>
      <div class="q-content">${escapeHTML(q.content)}</div>
      ${replySection}
      <div class="q-actions">
        ${q.reply ? `<button class="btn btn-outline btn-sm" onclick="toggleEditReply(${q.id})">✏️ 修改回复</button>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteQuestion(${q.id})">🗑️ 删除</button>
      </div>
      ${q.reply ? `<div class="reply-form" id="editReplyForm-${q.id}" style="display:none;margin-top:8px;">
        <input type="text" id="editReplyInput-${q.id}" value="${escapeHTMLAttr(q.reply)}" maxlength="500">
        <button class="btn btn-success btn-sm" onclick="doReply(${q.id})">💾 保存修改</button>
        <button class="btn btn-outline btn-sm" onclick="toggleEditReply(${q.id})">取消</button>
      </div>` : ''}
    </div>
  `;
}

// ── Toggle Edit Reply ───────────────────────────────────
function toggleEditReply(id) {
  const form = document.getElementById('editReplyForm-' + id);
  if (form) {
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  }
}

// ── Do Reply ────────────────────────────────────────────
async function doReply(id) {
  if (!token) return;

  // Try edit input first, then new reply input
  let inputEl = document.getElementById('editReplyInput-' + id);
  if (!inputEl || inputEl.closest('[style*="display: none"]') || !inputEl.closest('[style*="display: flex"]')) {
    inputEl = document.getElementById('replyInput-' + id);
  }
  // Fallback: check if edit form is visible
  const editForm = document.getElementById('editReplyForm-' + id);
  if (editForm && editForm.style.display !== 'none') {
    inputEl = document.getElementById('editReplyInput-' + id);
  }

  const reply = inputEl ? inputEl.value.trim() : '';

  if (!reply) return showToast('回复内容不能为空', 'error');
  if (reply.length > 500) return showToast('回复太长啦，最多500字', 'error');

  try {
    const res = await fetch(`/api/admin/reply/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reply }),
    });

    if (res.status === 401) { logout(); return showToast('请重新登录', 'error'); }

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('✅ 回复成功！', 'success');
      loadAdminQuestions(currentPage);
    } else {
      showToast('❌ ' + (data.error || '操作失败'), 'error');
    }
  } catch {
    showToast('❌ 网络错误', 'error');
  }
}

// ── Delete Question ─────────────────────────────────────
async function deleteQuestion(id) {
  if (!token) return;
  if (!confirm(`确定要删除 #${id} 这个问题吗？此操作不可撤销！`)) return;

  try {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 401) { logout(); return showToast('请重新登录', 'error'); }

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('🗑️ 删除成功', 'success');
      loadAdminQuestions(currentPage);
    } else {
      showToast('❌ ' + (data.error || '操作失败'), 'error');
    }
  } catch {
    showToast('❌ 网络错误', 'error');
  }
}

// ── Admin Pagination ────────────────────────────────────
function renderAdminPagination(p, container) {
  if (p.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  let html = '';
  html += `<button class="btn btn-outline btn-sm" onclick="loadAdminQuestions(${p.page - 1})" ${p.page <= 1 ? 'disabled' : ''}>◀ 上一页</button>`;
  html += `<span class="page-info">第 ${p.page} / ${p.totalPages} 页（共 ${p.total} 条）</span>`;
  html += `<button class="btn btn-outline btn-sm" onclick="loadAdminQuestions(${p.page + 1})" ${p.page >= p.totalPages ? 'disabled' : ''}>下一页 ▶</button>`;
  container.innerHTML = html;
}

// ── HTML Escape ─────────────────────────────────────────
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeHTMLAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Enter key login ─────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('loginCard').style.display !== 'none') {
    adminLogin();
  }
});
