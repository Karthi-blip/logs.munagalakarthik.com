/* ── Boot Screen ──────────────────────────────────── */
(function () {
  const bootScreen = document.getElementById('boot-screen');
  const bootText   = document.getElementById('boot-text');
  if (!bootScreen || !bootText) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alreadyBooted = sessionStorage.getItem('logs-booted') === '1';

  if (prefersReduced || alreadyBooted) {
    bootScreen.style.display = 'none';
    return;
  }

  document.body.style.overflow = 'hidden';

  const lines = [
    "INIT: logs.munagalakarthik.com booting...",
    "[ <span style='color:#3fb950'>OK</span> ] Mounting filesystem...",
    "Loading security modules... <span style='color:#8b949e'>[proxy]</span>",
    "[ <span style='color:#3fb950'>OK</span> ] System ready. Loading posts..."
  ];

  let idx = 0;
  function addLine() {
    if (idx < lines.length) {
      bootText.innerHTML += lines[idx] + '<br>';
      idx++;
      setTimeout(addLine, Math.random() * 150 + 80);
    } else {
      setTimeout(() => {
        bootScreen.style.opacity = '0';
        setTimeout(() => {
          bootScreen.style.display = 'none';
          document.body.style.overflow = '';
          sessionStorage.setItem('logs-booted', '1');
        }, 600);
      }, 450);
    }
  }
  setTimeout(addLine, 200);
})();

/* ── Custom Cursor ─────────────────────────────── */
(function () {
  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

  const cursor = document.getElementById('cursor');
  const dot    = document.getElementById('cursor-dot');
  if (!cursor || !dot) return;

  let mx = innerWidth / 2, my = innerHeight / 2;
  let cx = mx, cy = my;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  });

  (function lagCursor() {
    cx += (mx - cx) * 0.1;
    cy += (my - cy) * 0.1;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
    requestAnimationFrame(lagCursor);
  })();

  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform    = 'translate(-50%,-50%) scale(2.2)';
      cursor.style.borderColor  = '#aa66ff';
      cursor.style.background   = 'rgba(170,102,255,0.08)';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform    = 'translate(-50%,-50%) scale(1)';
      cursor.style.borderColor  = '#00d4ff';
      cursor.style.background   = 'transparent';
    });
  });
})();

/* ── Clock ────────────────────────────────────────── */
function startClock() {
  function tick() {
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const timeStr = ist.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    // Sidebar clock
    const el = document.getElementById('clock');
    if (el) el.textContent = timeStr;
    // Status bar clock
    const sb = document.getElementById('status-clock');
    if (sb) sb.textContent = timeStr + ' IST';
  }
  tick();
  setInterval(tick, 1000);
}

/* ── Post listing (index.html) ──────────────────────── */
async function loadPosts() {
  const container = document.getElementById('posts-container');
  if (!container) return;

  try {
    const res = await fetch('posts.json');
    if (!res.ok) throw new Error('posts.json not found');
    const data = await res.json();
    const params = new URLSearchParams(location.search);
    const activeTag = params.get('tag') || '';
    const query = (params.get('q') || '').trim().toLowerCase();
    const allPosts = (data.posts || [])
      .filter(p => !p.draft)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const allTags = [...new Set(allPosts.flatMap(p => p.tags || []))].sort((a, b) => a.localeCompare(b));
    const posts = allPosts.filter(post => {
      const tagMatch = !activeTag || (post.tags || []).includes(activeTag);
      const haystack = [post.title, post.excerpt, ...(post.tags || [])].join(' ').toLowerCase();
      const queryMatch = !query || haystack.includes(query);
      return tagMatch && queryMatch;
    });

    if (allPosts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">✍</div>
          <h3>No posts yet</h3>
          <p>Check back soon.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <section class="posts-toolbar" aria-label="Post filters">
        <form class="posts-search" action="index.html" method="get">
          ${activeTag ? `<input type="hidden" name="tag" value="${esc(activeTag)}">` : ''}
          <label class="sr-only" for="post-search">Search posts</label>
          <input id="post-search" name="q" type="search" placeholder="Search posts, tags, topics..." value="${esc(query)}">
          <button class="btn btn-secondary" type="submit">Search</button>
          ${(activeTag || query) ? `<a class="clear-filter" href="index.html">Clear</a>` : ''}
        </form>
        <div class="tag-filter" aria-label="Filter by tag">
          <a class="tag tag-link${activeTag ? '' : ' active'}" href="index.html">all</a>
          ${allTags.map(tag => `<a class="tag tag-link${tag === activeTag ? ' active' : ''}" href="index.html?tag=${encodeURIComponent(tag)}${query ? `&q=${encodeURIComponent(query)}` : ''}">${esc(tag)}</a>`).join('')}
        </div>
      </section>
      <div class="posts-results">${posts.length} ${posts.length === 1 ? 'post' : 'posts'}${activeTag ? ` tagged ${esc(activeTag)}` : ''}${query ? ` matching "${esc(query)}"` : ''}</div>
      <div class="posts-list-inner">
        ${posts.length ? posts.map(renderPostCard).join('') : `
          <div class="empty-state">
            <div class="icon">⌕</div>
            <h3>No matching posts</h3>
            <p>Try clearing the search or picking another tag.</p>
          </div>`}
      </div>`;

  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠</div>
        <h3>Could not load posts</h3>
        <p>${esc(e.message)}</p>
      </div>`;
  }
}

function renderPostCard(post) {
  const postHref = `post.html?slug=${encodeURIComponent(post.slug)}`;
  return `
    <article class="post-card">
      <a class="post-card-main" href="${postHref}" aria-label="Read ${esc(post.title)}">
        <span class="post-card-title">${esc(post.title)}</span>
        <span class="post-card-meta">
          <span>${formatDate(post.date)}</span>
          ${post.readTime ? `<span class="dot">${post.readTime} min read</span>` : ''}
        </span>
        ${post.excerpt ? `<span class="post-card-excerpt">${esc(post.excerpt)}</span>` : ''}
        <span class="read-more">Read more →</span>
      </a>
      <div class="tags" aria-label="Tags for ${esc(post.title)}">
        ${(post.tags || []).map(t => `<a class="tag tag-link" href="index.html?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
      </div>
    </article>`;
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
    const [postRes, indexRes] = await Promise.all([
      fetch(`posts/${encodeURIComponent(slug)}.json`),
      fetch('posts.json')
    ]);
    if (!postRes.ok) throw new Error('Post not found');
    const post = await postRes.json();
    const postsIndex = indexRes.ok ? await indexRes.json() : { posts: [] };
    const posts = (postsIndex.posts || [])
      .filter(p => !p.draft)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    document.title = `${post.title} — logs`;

    const postUrl = `https://logs.munagalakarthik.com/post.html?slug=${encodeURIComponent(slug)}`;
    const desc = post.excerpt || post.content?.slice(0, 160).replace(/[#*`\n]/g, ' ').trim() || '';
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', `${post.title} — logs`);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:url"]', 'property', 'og:url', postUrl);
    setMeta('meta[property="article:published_time"]', 'property', 'article:published_time', post.date);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', `${post.title} — logs`);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', postUrl);
    renderPostJsonLd(post, postUrl, desc);

    marked.setOptions({ breaks: true, gfm: true });

    container.innerHTML = `
      <article>
        <div class="post-header">
          <h1 class="post-title">${esc(post.title)}</h1>
          <div class="post-meta">
            <span>${formatDate(post.date)}</span>
            ${post.readTime ? `<span>· ${post.readTime} min read</span>` : ''}
            <div class="tags">
              ${(post.tags || []).map(t => `<a class="tag tag-link" href="index.html?tag=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
            </div>
          </div>
        </div>
        <div class="post-content">${DOMPurify.sanitize(marked.parse(post.content || ''))}</div>
      </article>
      ${renderPostNav(posts, slug)}`;

    enhanceRenderedCode(container);
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

function setMeta(selector, attrName, attrValue, content) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}

function renderPostJsonLd(post, postUrl, desc) {
  let el = document.getElementById('post-json-ld');
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'post-json-ld';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: desc,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: {
      '@type': 'Person',
      name: 'Munagala Karthik',
      url: 'https://munagalakarthik.com'
    },
    publisher: {
      '@type': 'Person',
      name: 'Munagala Karthik'
    },
    mainEntityOfPage: postUrl,
    url: postUrl,
    image: 'https://logs.munagalakarthik.com/og-card.png',
    keywords: (post.tags || []).join(', ')
  });
}

function renderPostNav(posts, slug) {
  if (!posts.length) return '';
  const currentIndex = posts.findIndex(post => post.slug === slug);
  if (currentIndex === -1) return '';

  const newer = posts[currentIndex - 1];
  const older = posts[currentIndex + 1];
  const more = posts.filter(post => post.slug !== slug).slice(0, 3);

  return `
    <nav class="post-nav" aria-label="More posts">
      <div class="post-nav-pair">
        ${newer ? navCard('Newer post', newer) : '<span></span>'}
        ${older ? navCard('Older post', older) : '<span></span>'}
      </div>
      ${more.length ? `
        <section class="related-posts">
          <h2>More posts</h2>
          <div class="related-grid">
            ${more.map(post => navCard('Read next', post)).join('')}
          </div>
        </section>` : ''}
    </nav>`;
}

function navCard(label, post) {
  return `
    <a class="post-nav-card" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <span>${label}</span>
      <strong>${esc(post.title)}</strong>
      <small>${formatDate(post.date)}</small>
    </a>`;
}

function enhanceRenderedCode(root) {
  root.querySelectorAll('pre code').forEach(code => {
    if (window.hljs) hljs.highlightElement(code);
    const pre = code.closest('pre');
    if (!pre || pre.querySelector('.copy-code')) return;
    const button = document.createElement('button');
    button.className = 'copy-code';
    button.type = 'button';
    button.textContent = 'Copy';
    button.addEventListener('click', () => {
      navigator.clipboard?.writeText(code.innerText).then(() => {
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = 'Copy'; }, 1600);
      });
    });
    pre.appendChild(button);
  });
}

function estimateReadTime(content) {
  const words = (content || '').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/* ── Visitor tracking (global, cross-device) ───────── */
function trackAndShowVisitors() {
  const footerEl  = document.getElementById('footer-visit-count');
  if (!footerEl) return;

  const cachedCount = sessionStorage.getItem('logs-visit-count');
  if (cachedCount) footerEl.textContent = cachedCount;

  if (sessionStorage.getItem('logs-counted-visit') === '1') return;

  const ctrl    = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4000);

  fetch('https://api.counterapi.dev/v1/logs.munagalakarthik.com/visitors/up', { signal: ctrl.signal })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      clearTimeout(timeout);
      if (d && typeof d.count === 'number') {
        const n = Number(d.count).toLocaleString();
        footerEl.textContent = n;
        sessionStorage.setItem('logs-visit-count', n);
        sessionStorage.setItem('logs-counted-visit', '1');
      }
    })
    .catch(() => {});
}

/* ── Theme Toggle ─────────────────────────────────── */
(function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const syncLabel = () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  };
  syncLabel();
  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('logs-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('logs-theme', 'light');
    }
    syncLabel();
  });
})();
