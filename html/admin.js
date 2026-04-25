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

/* ── Slug / Preview ──────────────────────────────── */
function updateSlug() {
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

async function ghPut(path, content, message, sha) {
  const body = { message, content: btoa(String.fromCharCode(...new TextEncoder().encode(content))), branch: GH_BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${getToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `GitHub PUT failed: ${r.status}`);
  }
  return r.json();
}

/* ── Publish via GitHub API ──────────────────────── */
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
    // ── 1. Commit post file ───────────────────────────
    const postPath    = `html/posts/${slug}.json`;
    const existingPost = await ghGet(postPath);
    await ghPut(postPath, JSON.stringify(postData, null, 2), `post: ${title}`, existingPost?.sha);

    // ── 2. Update posts.json index ────────────────────
    const indexPath    = 'html/posts.json';
    const existingIndex = await ghGet(indexPath);
    let existingPosts   = [];
    if (existingIndex) {
      try { existingPosts = JSON.parse(atob(existingIndex.content.replace(/\n/g, ''))).posts || []; }
      catch (_) {}
    }
    const updatedPosts = [
      { slug, title, date, tags, excerpt, readTime },
      ...existingPosts.filter(p => p.slug !== slug)
    ];
    await ghPut(indexPath, JSON.stringify({ posts: updatedPosts }, null, 2), `post: ${title}`, existingIndex?.sha);

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

function b64encode(str) { return btoa(String.fromCharCode(...new TextEncoder().encode(str))); }

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} visible`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}
