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
  // expired or no session — force auth
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

  await typeLine(out, '$ sudo admin --login', 'var(--accent)', 14);
  await sleep(200);
  await typeLine(out, '> Verifying PIN...',  '#c9d1d9', 12);
  await sleep(250);

  const match = (await sha256(pin)) === localStorage.getItem('admin_pin_hash');

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
  if ((await sha256(current)) !== localStorage.getItem('admin_pin_hash')) {
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
      marked.parse(document.getElementById('post-content').value || '');
    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    btn.textContent = '✕ Close preview';
  }
}

/* ── Publish (no GitHub PAT required) ───────────── */
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

  const tags     = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const excerpt  = makeExcerpt(content);
  const readTime = estimateReadTime(content);
  const postData = { slug, title, date, tags, excerpt, readTime, content };

  const btn = document.getElementById('publish-btn');
  btn.disabled = true;
  btn.innerHTML = `<span style="opacity:0.7">Publishing...</span>`;

  try {
    // ── 1. Save individual post file ──────────────────
    saveFile(`posts/${slug}.json`, JSON.stringify(postData, null, 2));
    await sleep(300);

    // ── 2. Read existing posts index from localStorage ─
    let existingPosts = [];
    try {
      const stored = localStorage.getItem('posts_index');
      existingPosts = stored ? JSON.parse(stored) : [];
    } catch (_) { existingPosts = []; }

    const updated = [
      { slug, title, date, tags, excerpt, readTime },
      ...existingPosts.filter(p => p.slug !== slug)
    ];
    localStorage.setItem('posts_index', JSON.stringify(updated));

    // ── 3. Download updated posts.json for deployment ──
    await sleep(200);
    saveFile('posts.json', JSON.stringify({ posts: updated }, null, 2));

    showToast('Published ✓ — replace posts.json on server', 'success');
    setTimeout(() => {
      if (confirm('Post files downloaded. Go to homepage?')) location.href = 'index.html';
    }, 1200);

  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg> Publish`;
  }
}

/* ── File download helper ────────────────────────── */
function saveFile(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  setTimeout(() => { t.className = 'toast'; }, 3000);
}
