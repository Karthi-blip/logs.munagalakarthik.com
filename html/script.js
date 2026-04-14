/* ── Clock ──────────────────────────────────────────── */
function startClock() {
  function tick() {
    const el = document.getElementById('clock');
    if (!el) return;
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    el.textContent = ist.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Post listing (index.html) ──────────────────────── */
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  try {
    const res = await fetch('posts.json?v=' + Date.now());
    if (!res.ok) throw new Error('posts.json not found');
    const data = await res.json();
    const posts = (data.posts || []).filter(p => !p.draft);

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">✍️</div>
          <h3>No posts yet</h3>
          <p>Check back soon.</p>
        </div>`;
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="post-card" onclick="location.href='post.html?slug=${encodeURIComponent(post.slug)}'">
        <div class="post-card-title">${esc(post.title)}</div>
        <div class="post-card-meta">
          <span>${formatDate(post.date)}</span>
          ${post.readTime ? `<span class="dot">${post.readTime} min read</span>` : ''}
        </div>
        ${post.excerpt ? `<div class="post-card-excerpt">${esc(post.excerpt)}</div>` : ''}
        <div class="tags">
          ${(post.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
        </div>
        <span class="read-more">Read more →</span>
      </div>`
    ).join('');

  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Could not load posts</h3>
        <p>${esc(e.message)}</p>
      </div>`;
  }
}

/* ── Single post (post.html) ────────────────────────── */
async function loadPost() {
  const container = document.getElementById('post-container');
  if (!container) return;

  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    container.innerHTML = `<div class="empty-state"><h3>No post specified.</h3></div>`;
    return;
  }

  try {
    const res = await fetch(`posts/${encodeURIComponent(slug)}.json?v=` + Date.now());
    if (!res.ok) throw new Error('Post not found');
    const post = await res.json();

    document.title = `${post.title} — logs`;

    // marked config for security
    marked.setOptions({ breaks: true, gfm: true });

    container.innerHTML = `
      <div class="post-header">
        <h1 class="post-title">${esc(post.title)}</h1>
        <div class="post-meta">
          <span>${formatDate(post.date)}</span>
          ${post.readTime ? `<span>· ${post.readTime} min read</span>` : ''}
          <div class="tags">
            ${(post.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="post-content">${marked.parse(post.content || '')}</div>`;

  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <h3>Post not found</h3>
        <p><a href="index.html">← Back to all posts</a></p>
      </div>`;
  }
}

/* ── Utilities ───────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function estimateReadTime(content) {
  const words = (content || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/* ── Visitor tracking ──────────────────────────────── */
function trackAndShowVisitors() {
  const storageKey = 'site_visit_count';
  const sessionKey = 'site_visit_counted';

  // Only increment once per browser session (fresh tab/window open)
  // Refreshing the page will NOT increment again
  if (!sessionStorage.getItem(sessionKey)) {
    let count = parseInt(localStorage.getItem(storageKey) || '0', 10) + 1;
    localStorage.setItem(storageKey, count.toString());
    sessionStorage.setItem(sessionKey, '1');
  }

  const count = parseInt(localStorage.getItem(storageKey) || '0', 10);
  const fmt = count.toLocaleString('en-IN');

  const sidebarEl = document.getElementById('visitor-count');
  if (sidebarEl) sidebarEl.textContent = fmt;

  const footerEl = document.getElementById('footer-visit-count');
  if (footerEl) footerEl.textContent = fmt;
}
