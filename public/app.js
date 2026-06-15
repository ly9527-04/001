/* ═══════════════════════════════════════════════════════
   ly的提问箱 - 前端逻辑
   ═══════════════════════════════════════════════════════ */

// ── State ───────────────────────────────────────────────
let selectedCategory = '学习';
let currentPage = 1;
let submitting = false;

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadQuestions(1);
  setupCharCounter();
});

// ── Category Selection ──────────────────────────────────
function selectCat(cat, el) {
  selectedCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

// ── Character Counter ───────────────────────────────────
function setupCharCounter() {
  const textarea = document.getElementById('content');
  const counter = document.getElementById('charCount');
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 500`;
    counter.className = 'char-count';
    if (len > 450) counter.classList.add('danger');
    else if (len > 350) counter.classList.add('warn');
  });
}

// ── Toast ───────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Submit Question ─────────────────────────────────────
async function submitQuestion() {
  if (submitting) return;

  const content = document.getElementById('content').value.trim();
  const nickname = document.getElementById('nickname').value.trim();
  const password = document.getElementById('submitPwd').value;

  // Validation
  if (!content) return showToast('内容不能为空哦~', 'error');
  if (content.length > 500) return showToast('内容太长啦，最多500字~', 'error');
  if (!password) return showToast('请输入验证码~', 'error');
  if (password !== '9527') return showToast('验证码错误，再想想？💡提示：四位数字', 'error');

  submitting = true;
  const btn = document.querySelector('#submitCard .btn');
  btn.textContent = '⏳ TRANSMITTING...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        category: selectedCategory,
        nickname: nickname || undefined,
        password,
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast('✅ ' + data.message, 'success');
      // Reset form
      document.getElementById('content').value = '';
      document.getElementById('nickname').value = '';
      document.getElementById('submitPwd').value = '';
      document.getElementById('charCount').textContent = '0 / 500';
      document.getElementById('charCount').className = 'char-count';
      // Refresh list
      await loadQuestions(1);
    } else {
      showToast('❌ ' + (data.error || '提交失败'), 'error');
    }
  } catch (err) {
    showToast('❌ 网络错误，请稍后再试', 'error');
  } finally {
    submitting = false;
    btn.textContent = '⚡ SEND_MESSAGE';
    btn.disabled = false;
  }
}

// ── Load Questions ──────────────────────────────────────
async function loadQuestions(page = 1) {
  currentPage = page;
  const listEl = document.getElementById('questionList');
  const pagEl = document.getElementById('pagination');

  const category = document.getElementById('filterCat').value;
  const sort = document.getElementById('filterSort').value;

  listEl.innerHTML = '<div style="text-align:center;padding:40px;color:#b2bec3;">⏳ 加载中...</div>';

  try {
    const params = new URLSearchParams({ page, pageSize: 10, category, sort });
    const res = await fetch(`/api/questions?${params}`);
    const data = await res.json();

    if (!data.questions || data.questions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>还没有人提问，来做第一个勇敢的人吧！</p>
        </div>`;
      pagEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = data.questions.map(q => renderQuestion(q)).join('');
    renderPagination(data.pagination, pagEl);
  } catch (err) {
    listEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">😵</span>
        <p>加载失败，请刷新重试</p>
      </div>`;
    pagEl.innerHTML = '';
  }
}

// ── Render Single Question ──────────────────────────────
function renderQuestion(q) {
  const catEmojis = { '学习': '📚', '生活': '🌟', '情感': '💕', '工作': '💼', '游戏': '🎮', '吐槽': '💢', '其他': '📌' };
  const emoji = catEmojis[q.category] || '📌';

  const replyHTML = q.reply ? `
    <div class="reply-bubble">
      ${escapeHTML(q.reply)}
      <div class="reply-time">${q.replied_at || ''}</div>
    </div>
  ` : '';

  return `
    <div class="question-item">
      <div class="q-meta">
        <span class="q-cat" data-cat="${q.category}">${emoji} ${q.category}</span>
        <span class="q-nickname">🕶️ ${escapeHTML(q.nickname || '匿名')}</span>
        <span class="q-time">${q.created_at}</span>
        ${q.reply ? '<span class="badge badge-replied">✅ 已回复</span>' : '<span class="badge badge-new">🆕 待回复</span>'}
      </div>
      <div class="q-content">${escapeHTML(q.content)}</div>
      ${replyHTML}
    </div>
  `;
}

// ── Render Pagination ───────────────────────────────────
function renderPagination(p, container) {
  if (p.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="btn btn-outline btn-sm" onclick="loadQuestions(${p.page - 1})" ${p.page <= 1 ? 'disabled' : ''}>◀ 上一页</button>`;
  html += `<span class="page-info">第 ${p.page} / ${p.totalPages} 页（共 ${p.total} 条）</span>`;
  html += `<button class="btn btn-outline btn-sm" onclick="loadQuestions(${p.page + 1})" ${p.page >= p.totalPages ? 'disabled' : ''}>下一页 ▶</button>`;
  container.innerHTML = html;
}

// ── HTML Escape ─────────────────────────────────────────
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Enter key submit ────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    submitQuestion();
  }
});
