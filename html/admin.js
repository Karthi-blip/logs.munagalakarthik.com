const REPO   = 'Karthi-blip/logs.munagalakarthik.com';
const BRANCH = 'main';
const API    = 'https://api.github.com';

/* ── Init ────────────────────────────────────────── */
function initAdmin() {
  // already authenticated this browser session
  if (sessionStorage.getItem('admin_auth') === '1') {
    hideOverlay();
    return;
  }
  const hash = localStorage.getItem('admin_pin_hash');
  if (hash) {
    // returning user — show login
    document.getElementById('login-screen').style.display = 'block';
    const input = document.getElementById('pin-input');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') verifyPin(); });
  } else {
    // first time — show setup
    document.getElementById('setup-screen').style.display = 'block';
    const c = document.getElementById('setup-pin-confirm');
    if (c) c.addEventListener('keydown', e => { if (e.key === 'Enter') setupPin(); });
  }
}

/* ── First-time PIN setup ────────────────────────── */
async function setupPin() {
  const pin    = document.getElementById('setup-pin').value;
  const confirm = document.getElementById('setup-pin-confirm').value;
  const err    = document.getElementById('setup-error');
  err.style.display = 'none';
  if (!pin)            { showErr(err, 'Please enter a PIN.'); return; }
  if (pin !== confirm) { showErr(err, 'PINs do not match.'); return; }
  localStorage.setItem('admin_pin_hash', await sha256(pin));
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
  showToast('PIN set. Please log in.', 'success');
  document.getElementById('pin-input').focus();
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

  await typeLine(out, '$ sudo admin --login',      'var(--accent)');
  await sleep(350);
  await typeLine(out, '> Verifying PIN...',         '#c9d1d9');
  await sleep(450);
  await typeLine(out, '> Checking credentials...',  '#c9d1d9');
  await sleep(350);

  const match = (await sha256(pin)) === localStorage.getItem('admin_pin_hash');

  if (match) {
    await typeLine(out, '✓ PIN accepted',     'var(--accent)');
    await sleep(200);
    await typeLine(out, '✓ Welcome, Karthik', 'var(--accent)');
    await sleep(650);
    sessionStorage.setItem('admin_auth', '1');
    hideOverlay();
    showToast('Welcome back ✓', 'success');
  } else {
    await typeLine(out, '✗ Incorrect PIN — access denied', 'var(--danger)');
    await sleep(1400);
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
  if ((await sha256(current)) !== localStorage.getItem('admin_pin_hash')) {
    showErr(err, 'Current PIN is incorrect.'); return;
  }

  localStorage.setItem('admin_pin_hash', await sha256(newPin));
  closeChangePin();
  showToast('PIN updated ✓', 'success');
}

/* ── Logout ──────────────────────────────────────── */
function logout() {
  sessionStorage.removeItem('admin_auth');
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
      marked.parse(document.getElementById('post-content').value || '');
    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.textContent = '✕ Close preview';
  }
}

/* ── Publish ─────────────────────────────────────── */
async function publishPost() {
  const token = localStorage.getItem('gh_token');
  if (!token) {
    showToast('GitHub token not set. Add it in Settings.', 'error');
    return;
  }

  const title   = document.getElementById('post-title').value.trim();
  const slug    = document.getElementById('post-slug').value.trim();
  const date    = document.getElementById('post-date').value;
  const tagsRaw = document.getElementById('post-tags').value;
  const content = document.getElementById('post-content').value.trim();

  if (!title)   { showToast('Title is required.', 'error'); return; }
  if (!slug)    { showToast('Slug is required.', 'error'); return; }
  if (!date)    { showToast('Date is required.', 'error'); return; }
  if (!content) { showToast('Content is required.', 'error'); return; }

  const tags     = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const excerpt  = makeExcerpt(content);
  const readTime = estimateReadTime(content);
  const postData = { slug, title, date, tags, excerpt, readTime, content };

  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.textContent = 'Publishing...';

  try {
    await githubPut(`html/posts/${slug}.json`, JSON.stringify(postData, null, 2), `add post: ${title}`);

    const existing = await githubGetJson('html/posts.json');
    const updated  = [
      { slug, title, date, tags, excerpt, readTime },
      ...(existing.posts || []).filter(p => p.slug !== slug)
    ];
    await githubPut('html/posts.json', JSON.stringify({ posts: updated }, null, 2), `update index: ${title}`);

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

/* ── GitHub API helpers ──────────────────────────── */
async function githubPut(path, content, message) {
  const token = localStorage.getItem('gh_token');
  const sha   = await githubFileSha(path);
  const body  = { message, content: b64encode(content), branch: BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(`${API}/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.message || `GitHub API ${res.status}`); }
  return res.json();
}

async function githubFileSha(path) {
  const token = localStorage.getItem('gh_token');
  const res   = await fetch(`${API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (res.status === 404) return null;
  return (await res.json()).sha || null;
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

function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }

function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} visible`;
  setTimeout(() => { t.className = 'toast'; }, 4000);
}
