/* ── PIN hash (SHA-256 of the admin PIN) ────────── */
// This is the source-of-truth hash. Change PIN stores an override in
// localStorage; that override takes priority so you can update without
// editing this file. In incognito / any browser with no localStorage,
// this hardcoded hash is used — the setup screen is never shown.
const HARDCODED_PIN_HASH = '21f261270b80b9143303dd301b1cc4ac0a7dcd62cf3bf0288e5e0e4f0c0940f6';

function getPinHash() {
  return localStorage.getItem('admin_pin_hash') || HARDCODED_PIN_HASH;
}

/* ── Session helpers (24-hour expiry) ───────────── */
const SESSION_KEY    = 'admin_auth_ts';
const SESSION_HOURS  = 24;

function isSessionValid() {
  const ts = localStorage.getItem(SESSION_KEY);
  if (!ts) return false;
  return (Date.now() - parseInt(ts, 10)) < (SESSION_HOURS * 60 * 60 * 1000);
}

function startSession() {
  localStorage.setItem(SESSION_KEY, Date.now().toString());
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ── Init ────────────────────────────────────────── */
function initAdmin() {
  // valid 24-hour session — let them in directly
  if (isSessionValid()) {
    hideOverlay();
    return;
  }
  // always show login — setup screen is gone
  document.getElementById('login-screen').style.display = 'block';
  const input = document.getElementById('pin-input');
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') verifyPin(); });
}

/* ── PIN login ───────────────────────────────────── */


async function verifyPin() {
  const pin = document.getElementById('pin-input').value;
  const err = document.getElementById('auth-error');
  err.style.display = 'none';
  if (!pin) { showErr(err, 'Please enter your PIN.'); return; }

  // switch to terminal
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('auth-terminal').style.display = 'block';

  const out = document.getElementById('terminal-output');
  out.innerHTML = '';

  await typeLine(out, '$ sudo admin --login', 'var(--accent)', 14);
  await sleep(200);
  await typeLine(out, '> Verifying PIN...',  '#c9d1d9', 12);
  await sleep(250);

  const match = (await sha256(pin)) === getPinHash();

  if (match) {
    await typeLine(out, '✓ Access granted', 'var(--accent)', 12);
    await sleep(150);
    await typeLine(out, '✓ Welcome, Karthik', 'var(--accent)', 12);
    await sleep(400);
    startSession();
    hideOverlay();
    showToast('Welcome back ✓', 'success');
  } else {
    await typeLine(out, '✗ Incorrect PIN — access denied', 'var(--danger)', 12);
    await sleep(900);
    document.getElementById('auth-terminal').style.display = 'none';
    document.getElementById('login-screen').style.display  = 'block';
    document.getElementById('pin-input').value = '';
    showErr(err, 'Incorrect PIN. Try again.');
  }
}

/* ── Change PIN ──────────────────────────────────── */
function openChangePin() {
  document.getElementById('change-pin-modal').style.display = 'flex';
  document.getElementById('current-pin').focus();
}

function closeChangePin() {
  document.getElementById('change-pin-modal').style.display = 'none';
  ['current-pin', 'new-pin', 'confirm-new-pin'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('pin-change-error').style.display = 'none';
}

async function changePinSubmit() {
  const current = document.getElementById('current-pin').value;
  const newPin  = document.getElementById('new-pin').value;
  const confirm = document.getElementById('confirm-new-pin').value;
  const err     = document.getElementById('pin-change-error');
  err.style.display = 'none';

  if (!current || !newPin || !confirm) { showErr(err, 'All fields are required.'); return; }
  if (newPin !== confirm)              { showErr(err, 'New PINs do not match.'); return; }
  if ((await sha256(current)) !== getPinHash()) {
    showErr(err, 'Current PIN is incorrect.'); return;
  }

  localStorage.setItem('admin_pin_hash', await sha256(newPin));
  closeChangePin();
  showToast('PIN updated ✓', 'success');
}

/* ── Logout ──────────────────────────────────────── */
function logout() {
  clearSession();
  location.reload();
}

/* ── SHA-256 via Web Crypto ──────────────────────── */
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Terminal helpers ────────────────────────────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function typeLine(container, text, color = '#c9d1d9', speed = 18) {
  const div = document.createElement('div');
  div.style.color = color;
  container.appendChild(div);
  for (const ch of text) { div.textContent += ch; await sleep(speed); }
  await sleep(60);
}

function hideOverlay() {
  const el = document.getElementById('auth-overlay');
  if (el) el.style.display = 'none';
  // Restore main visibility in case it was hidden by guard
  const main = document.querySelector('main');
  if (main) main.style.visibility = 'visible';
}

/* ── Tab switching ───────────────────────────────── */
let _editingSlug = null;

function switchTab(tab, resetEdit = false) {
  const isNew = tab === 'new';
  if (resetEdit && isNew) {
    _editingSlug = null;
    const slugField = document.getElementById('post-slug');
    slugField.readOnly = false;
    slugField.style.opacity = '';
    const h1  = document.getElementById('admin-h1');
    const lbl = document.getElementById('publish-btn-label');
    if (h1)  h1.textContent  = 'New Post';
    if (lbl) lbl.textContent = 'Publish';
  }
  document.getElementById('new-post-panel').style.display  = isNew ? '' : 'none';
  document.getElementById('manage-panel').style.display    = isNew ? 'none' : '';
  document.getElementById('post-toolbar').style.display    = isNew ? '' : 'none';
  document.getElementById('tab-new').classList.toggle('active', isNew);
  document.getElementById('tab-manage').classList.toggle('active', !isNew);
  if (!isNew) loadManagedPosts();
}

/* ── Manage Posts ────────────────────────────────── */
async function loadManagedPosts() {
  const container = document.getElementById('manage-posts-list');
  container.innerHTML = `<div class="empty-state"><div class="icon">⏳</div><h3>Loading...</h3></div>`;
  try {
    const indexFile = await ghGet('html/posts.json');
    if (!indexFile) {
      container.innerHTML = `<div class="empty-state"><div class="icon">✍️</div><h3>No posts yet.</h3></div>`;
      return;
    }
    const posts = JSON.parse(atob(indexFile.content.replace(/\n/g, ''))).posts || [];
    if (posts.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="icon">✍️</div><h3>No posts yet.</h3></div>`;
      return;
    }
    container.innerHTML = posts.map((p, i) => `
      <div class="manage-post-row">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.95rem;color:var(--text);margin-bottom:0.3rem;">${esc(p.title)}</div>
          <div style="font-size:0.8rem;color:var(--muted);display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span>${formatDate(p.date)}</span>
            ${p.readTime ? `<span>· ${p.readTime} min read</span>` : ''}
          </div>
          ${p.tags?.length ? `<div class="tags" style="margin-top:0.4rem;">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="manage-post-actions">
          <button class="btn btn-secondary manage-edit-btn" data-idx="${i}" style="padding:0.35rem 0.7rem;font-size:0.78rem;">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Edit
          </button>
          <button class="btn btn-danger manage-delete-btn" data-idx="${i}" style="padding:0.35rem 0.7rem;font-size:0.78rem;">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete
          </button>
        </div>
      </div>`).join('');

    container.querySelectorAll('.manage-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editPost(posts[+btn.dataset.idx].slug));
    });
    container.querySelectorAll('.manage-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = posts[+btn.dataset.idx];
        confirmDelete(p.slug, p.title);
      });
    });
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Failed to load posts</h3><p style="font-size:0.85rem;color:var(--muted);">${esc(e.message)}</p></div>`;
  }
}

/* ── Edit post ───────────────────────────────────── */
async function editPost(slug) {
  try {
    showToast('Loading post...', 'success');
    const file = await ghGet(`html/posts/${slug}.json`);
    if (!file) { showToast('Post file not found.', 'error'); return; }
    const post = JSON.parse(atob(file.content.replace(/\n/g, '')));
    document.getElementById('post-title').value          = post.title   || '';
    document.getElementById('post-slug').value           = post.slug    || slug;
    document.getElementById('post-date').value           = post.date    || '';
    document.getElementById('post-tags').value           = (post.tags   || []).join(', ');
    document.getElementById('post-content').value        = post.content || '';
    _editingSlug = post.slug || slug;
    const slugField = document.getElementById('post-slug');
    slugField.readOnly = true;
    slugField.style.opacity = '0.55';
    const _h1  = document.getElementById('admin-h1');
    const _lbl = document.getElementById('publish-btn-label');
    if (_h1)  _h1.textContent  = 'Edit Post';
    if (_lbl) _lbl.textContent = 'Update';
    switchTab('new');
    showToast('Post loaded — edit and republish ✓', 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

/* ── Delete post ─────────────────────────────────── */
let _deleteSlug = null;

function confirmDelete(slug, title) {
  _deleteSlug = slug;
  document.getElementById('delete-modal-msg').textContent = `"${title}" will be permanently removed.`;
  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  _deleteSlug = null;
  document.getElementById('delete-modal').style.display = 'none';
}

async function deletePost() {
  const slug = _deleteSlug;
  if (!slug) return;
  closeDeleteModal();

  const confirmBtn = document.getElementById('delete-confirm-btn');
  confirmBtn.disabled = true;

  try {
    showToast('Deleting...', 'success');

    // read both files in parallel before touching anything
    const [existingIndex, postFile] = await Promise.all([
      ghGet('html/posts.json'),
      ghGet(`html/posts/${slug}.json`)
    ]);

    // 1. remove from posts.json index (creates commit 1)
    let existingPosts = [];
    if (existingIndex) {
      try { existingPosts = JSON.parse(atob(existingIndex.content.replace(/\n/g, ''))).posts || []; }
      catch (_) {}
    }
    const updatedPosts = existingPosts.filter(p => p.slug !== slug);
    await ghApi('contents/html/posts.json', 'PUT', {
      message: `delete: ${slug}`,
      content: b64utf8(JSON.stringify({ posts: updatedPosts }, null, 2)),
      sha: existingIndex?.sha,
      branch: GH_BRANCH
    });

    // 2. delete the post file (creates commit 2)
    if (postFile) {
      await ghApi(`contents/html/posts/${slug}.json`, 'DELETE', {
        message: `delete: ${slug}`,
        sha: postFile.sha,
        branch: GH_BRANCH
      });
    }

    showToast('Deleted ✓ — deploying (~1 min)', 'success');
    loadManagedPosts();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    confirmBtn.disabled = false;
  }
}

/* ── Slug / Preview ──────────────────────────────── */
function updateSlug() {
  if (_editingSlug !== null) return; // slug is locked in edit mode
  document.getElementById('post-slug').value = slugify(
    document.getElementById('post-title').value
  );
}

function togglePreview() {
  const panel = document.getElementById('preview-panel');
  const btn   = document.getElementById('preview-btn');
  if (panel.classList.contains('visible')) {
    panel.classList.remove('visible');
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg> Preview`;
  } else {
    marked.setOptions({ breaks: true, gfm: true });
    document.getElementById('preview-content').innerHTML =
      DOMPurify.sanitize(marked.parse(document.getElementById('post-content').value || ''));
    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.textContent = '✕ Close preview';
  }
}

/* ── GitHub config ───────────────────────────────── */
const GH_REPO   = 'Karthi-blip/logs.munagalakarthik.com';
const GH_BRANCH = 'main';

function getToken() { return localStorage.getItem('github_pat') || ''; }

function openTokenModal() {
  document.getElementById('token-modal').style.display = 'flex';
  document.getElementById('token-input').value = getToken();
  document.getElementById('token-input').focus();
}

function closeTokenModal() {
  document.getElementById('token-modal').style.display = 'none';
}

function saveToken() {
  const val = document.getElementById('token-input').value.trim();
  if (!val) { showToast('Token cannot be empty.', 'error'); return; }
  localStorage.setItem('github_pat', val);
  closeTokenModal();
  showToast('GitHub token saved ✓', 'success');
}

/* ── GitHub API helpers ──────────────────────────── */
async function ghGet(path) {
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
    headers: { Authorization: `token ${getToken()}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET failed: ${r.status}`);
  return r.json();
}

async function ghApi(path, method, body) {
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/${path}`, {
    method,
    headers: {
      Authorization: `token ${getToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${method} failed: ${r.status}`);
  }
  return r.json();
}

function b64utf8(str) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}

/* ── Publish via GitHub API (single atomic commit) ── */
async function publishPost() {
  const title   = document.getElementById('post-title').value.trim();
  const slug    = document.getElementById('post-slug').value.trim();
  const date    = document.getElementById('post-date').value;
  const tagsRaw = document.getElementById('post-tags').value;
  const content = document.getElementById('post-content').value.trim();

  if (!title)   { showToast('Title is required.', 'error'); return; }
  if (!slug)    { showToast('Slug is required.', 'error'); return; }
  if (!date)    { showToast('Date is required.', 'error'); return; }
  if (!content) { showToast('Content is required.', 'error'); return; }

  if (!getToken()) {
    showToast('Set your GitHub token first.', 'error');
    openTokenModal();
    return;
  }

  const tags     = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const excerpt  = makeExcerpt(content);
  const readTime = estimateReadTime(content);
  const postData = { slug, title, date, tags, excerpt, readTime, content };

  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.innerHTML = `<span style="opacity:0.7">Publishing...</span>`;

  try {
    // ── 1. Get current branch tip ─────────────────────
    const ref = await ghApi(`git/refs/heads/${GH_BRANCH}`, 'GET');
    const headSha = ref.object.sha;
    const headCommit = await ghApi(`git/commits/${headSha}`, 'GET');
    const baseTreeSha = headCommit.tree.sha;

    // ── 2. Read existing posts.json ───────────────────
    const existingIndex = await ghGet('html/posts.json');
    let existingPosts = [];
    if (existingIndex) {
      try { existingPosts = JSON.parse(atob(existingIndex.content.replace(/\n/g, ''))).posts || []; }
      catch (_) {}
    }
    const updatedPosts = [
      { slug, title, date, tags, excerpt, readTime },
      ...existingPosts.filter(p => p.slug !== slug)
    ];

    // ── 3. Create blobs for both files ────────────────
    const postBlob  = await ghApi('git/blobs', 'POST', { content: b64utf8(JSON.stringify(postData, null, 2)), encoding: 'base64' });
    const indexBlob = await ghApi('git/blobs', 'POST', { content: b64utf8(JSON.stringify({ posts: updatedPosts }, null, 2)), encoding: 'base64' });

    // ── 4. Create new tree with both files ────────────
    const newTree = await ghApi('git/trees', 'POST', {
      base_tree: baseTreeSha,
      tree: [
        { path: `html/posts/${slug}.json`, mode: '100644', type: 'blob', sha: postBlob.sha },
        { path: 'html/posts.json',         mode: '100644', type: 'blob', sha: indexBlob.sha }
      ]
    });

    // ── 5. Create commit and advance branch ──────────
    const newCommit = await ghApi('git/commits', 'POST', {
      message: `post: ${title}`,
      tree: newTree.sha,
      parents: [headSha]
    });
    await ghApi(`git/refs/heads/${GH_BRANCH}`, 'PATCH', { sha: newCommit.sha });

    showToast('Published ✓ — deploying (~1 min)', 'success');
    setTimeout(() => { location.href = 'index.html'; }, 1500);

  } catch (e) {
    showToast('Error: ' + e.message, 'error');
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg> Publish`;
  }
}


/* ── Utilities ───────────────────────────────────── */
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function makeExcerpt(content, len = 160) {
  return content
    .replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*_>~\-]/g, '').replace(/\s+/g, ' ').trim()
    .slice(0, len).trimEnd() + (content.length > len ? '...' : '');
}

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} visible`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}
