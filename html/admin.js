const REPO  = 'Karthi-blip/logs.munagalakarthik.com';
const BRANCH = 'main';
const API    = 'https://api.github.com';

/* ── Auth ─────────────────────────────────────────── */
function initAdmin() {
  const token = localStorage.getItem('gh_token');
  if (token) {
    hideOverlay();
  }
  // allow Enter key on token input
  const input = document.getElementById('token-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') verifyToken(); });
}

async function verifyToken() {
  const input = document.getElementById('token-input');
  const btn   = document.getElementById('auth-btn');
  const err   = document.getElementById('auth-error');
  const token = input.value.trim();

  if (!token) { showErr(err, 'Please enter a token.'); return; }

  btn.textContent = 'Verifying...';
  btn.disabled = true;
  err.style.display = 'none';

  try {
    const res = await fetch(`${API}/repos/${REPO}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (!res.ok) throw new Error('Invalid token or no access to repo.');

    localStorage.setItem('gh_token', token);
    hideOverlay();
    showToast('Authenticated ✓', 'success');
  } catch (e) {
    showErr(err, e.message);
    btn.textContent = 'Verify & Enter';
    btn.disabled = false;
  }
}

function hideOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

function logout() {
  localStorage.removeItem('gh_token');
  location.reload();
}

/* ── Slug / Preview ─────────────────────────────────── */
function updateSlug() {
  const title = document.getElementById('post-title').value;
  document.getElementById('post-slug').value = slugify(title);
}

function togglePreview() {
  const panel   = document.getElementById('preview-panel');
  const content = document.getElementById('post-content').value;
  const btn     = document.getElementById('preview-btn');

  if (panel.classList.contains('visible')) {
    panel.classList.remove('visible');
    btn.textContent = '👁 Preview';
  } else {
    marked.setOptions({ breaks: true, gfm: true });
    document.getElementById('preview-content').innerHTML = marked.parse(content || '');
    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.textContent = '✕ Close preview';
  }
}

/* ── Publish ─────────────────────────────────────────── */
async function publishPost() {
  const token   = localStorage.getItem('gh_token');
  if (!token) { location.reload(); return; }

  const title   = document.getElementById('post-title').value.trim();
  const slug    = document.getElementById('post-slug').value.trim();
  const date    = document.getElementById('post-date').value;
  const tagsRaw = document.getElementById('post-tags').value;
  const content = document.getElementById('post-content').value.trim();

  // Validate
  if (!title) { showToast('Title is required.', 'error'); return; }
  if (!slug)  { showToast('Slug is required.', 'error'); return; }
  if (!date)  { showToast('Date is required.', 'error'); return; }
  if (!content) { showToast('Content is required.', 'error'); return; }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const excerpt = makeExcerpt(content);
  const readTime = estimateReadTime(content);

  const postData = { slug, title, date, tags, excerpt, readTime, content };

  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';

  try {
    // 1 — Create posts/slug.json
    await githubPut(
      `html/posts/${slug}.json`,
      JSON.stringify(postData, null, 2),
      `add post: ${title}`
    );

    // 2 — Update posts.json (prepend new post to list)
    const existing = await githubGetJson('html/posts.json');
    const updatedPosts = [
      { slug, title, date, tags, excerpt, readTime },
      ...(existing.posts || []).filter(p => p.slug !== slug)
    ];
    await githubPut(
      'html/posts.json',
      JSON.stringify({ posts: updatedPosts }, null, 2),
      `update posts index: ${title}`
    );

    showToast('Published! Deploying in ~60s ✓', 'success');
    setTimeout(() => {
      if (confirm('Post published. Go to homepage?')) location.href = 'index.html';
    }, 1500);

  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg> Publish`;
  }
}

/* ── GitHub API helpers ─────────────────────────────── */
async function githubPut(path, content, message) {
  const token = localStorage.getItem('gh_token');
  const sha   = await githubFileSha(path);

  const body = {
    message,
    content: b64encode(content),
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${API}/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `GitHub API error (${res.status})`);
  }
  return res.json();
}

async function githubFileSha(path) {
  const token = localStorage.getItem('gh_token');
  const res   = await fetch(`${API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (res.status === 404) return null;
  const data = await res.json();
  return data.sha || null;
}

async function githubGetJson(path) {
  const token = localStorage.getItem('gh_token');
  const res   = await fetch(`${API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (res.status === 404) return { posts: [] };
  const data = await res.json();
  return JSON.parse(atob(data.content.replace(/\n/g, '')));
}

/* ── Utilities ───────────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeExcerpt(content, len = 160) {
  const stripped = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*_>~\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > len ? stripped.slice(0, len).trimEnd() + '...' : stripped;
}

function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function showErr(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} visible`;
  setTimeout(() => { t.className = 'toast'; }, 4000);
}
