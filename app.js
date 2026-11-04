(() => {
  'use strict';

  // ---------- Supabase 연결 정보 ----------
  // publishable 키는 공개용 키라서 코드에 넣어도 괜찮아요.
  // (secret / service_role 키는 절대 여기에 넣지 마세요.)
  const SUPABASE_URL = 'https://znsvaelbahbxktwyxjnd.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_2fr5YSlFRZ25AqdDBB2v5Q_mfNRwIIC';

  const THEME_KEY = 'sotttukkeong-forum:theme';
  const LIKED_KEY = 'sotttukkeong-forum:liked';
  const AUTHOR_KEY = 'sotttukkeong-forum:author';
  const CATEGORIES = ['잡담', '질문', '정보', '자랑'];
  const DEFAULT_AUTHOR = '익명의 솥뚜껑';
  const POST_FIELDS = 'id,category,title,body,author,likes,created_at';

  const app = document.getElementById('app');

  // ---------- local storage (테마, 좋아요 표시, 닉네임만 저장) ----------
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  let liked = new Set(storage.get(LIKED_KEY, []));
  const saveLiked = () => storage.set(LIKED_KEY, [...liked]);

  // ---------- Supabase API ----------
  async function request(path, { method = 'GET', body, prefer } = {}) {
    const headers = { apikey: SUPABASE_KEY };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const msg = data && (data.message || data.hint);
      throw new Error(msg && /[가-힣]/.test(msg) ? msg : '잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.');
    }
    return data;
  }

  const rpc = (name, args) => request(`rpc/${name}`, { method: 'POST', body: args });

  const api = {
    listPosts: () =>
      request(`posts?select=${POST_FIELDS},comments(count)&order=created_at.desc&limit=500`),
    getPost: async (id) => {
      const rows = await request(
        `posts?id=eq.${encodeURIComponent(id)}` +
        `&select=${POST_FIELDS},comments(id,author,body,created_at)` +
        '&comments.order=created_at.asc');
      return rows[0] || null;
    },
    createPost: (p) => rpc('create_post', {
      p_category: p.category, p_title: p.title, p_body: p.body,
      p_author: p.author, p_password: p.password,
    }),
    deletePost: (id, password) => rpc('delete_post', { p_id: id, p_password: password }),
    likePost: (id, delta) => rpc('like_post', { p_id: id, p_delta: delta }),
    addComment: (postId, author, body) => request('comments', {
      method: 'POST', body: { post_id: postId, author, body }, prefer: 'return=minimal',
    }),
  };

  const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  // ---------- helpers ----------
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const ts = (iso) => new Date(iso).getTime();

  const timeAgo = (iso) => {
    const t = ts(iso);
    const diff = Math.max(0, Date.now() - t);
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(t).toLocaleDateString('ko-KR');
  };

  const commentCount = (p) => (p.comments && p.comments[0] ? p.comments[0].count : 0);

  const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true);

  const showLoading = () => {
    app.innerHTML = '<p class="empty">불러오는 중…</p>';
  };

  const showError = (err, retry) => {
    app.innerHTML = `<div class="card"><p>${escapeHtml(err.message)}</p>
      <button type="button" class="btn" id="retryBtn">다시 시도</button></div>`;
    document.getElementById('retryBtn').addEventListener('click', retry);
  };

  // 화면이 바뀐 뒤 늦게 도착한 응답이 화면을 덮어쓰지 않도록 하는 장치
  let viewToken = 0;

  // ---------- theme ----------
  const themeToggle = document.getElementById('themeToggle');
  const applyTheme = (t) => {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
  };
  applyTheme(storage.get(THEME_KEY, null));
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    storage.set(THEME_KEY, next);
  });

  // ---------- views ----------
  const homeState = { category: '전체', query: '', sort: 'new' };
  let posts = [];

  async function renderHome() {
    const token = ++viewToken;
    document.title = '솥뚜껑 포럼';
    showLoading();
    try {
      posts = await api.listPosts();
    } catch (err) {
      if (token === viewToken) showError(err, renderHome);
      return;
    }
    if (token !== viewToken) return;

    app.replaceChildren(fromTemplate('tpl-home'));

    const tabs = document.getElementById('categoryTabs');
    ['전체', ...CATEGORIES].forEach((cat) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-ghost' + (cat === homeState.category ? ' active' : '');
      b.textContent = cat;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(cat === homeState.category));
      b.addEventListener('click', () => {
        homeState.category = cat;
        tabs.querySelectorAll('button').forEach((x) => {
          const on = x.textContent === cat;
          x.classList.toggle('active', on);
          x.setAttribute('aria-selected', String(on));
        });
        renderList();
      });
      tabs.appendChild(b);
    });

    const search = document.getElementById('searchInput');
    search.value = homeState.query;
    search.addEventListener('input', () => { homeState.query = search.value; renderList(); });

    const sort = document.getElementById('sortSelect');
    sort.value = homeState.sort;
    sort.addEventListener('change', () => { homeState.sort = sort.value; renderList(); });

    renderList();
  }

  function renderList() {
    const list = document.getElementById('postList');
    const empty = document.getElementById('emptyState');
    const q = homeState.query.trim().toLowerCase();

    let items = posts.filter((p) =>
      (homeState.category === '전체' || p.category === homeState.category) &&
      (!q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)));

    const sorters = {
      new: (a, b) => ts(b.created_at) - ts(a.created_at),
      hot: (a, b) => b.likes - a.likes || ts(b.created_at) - ts(a.created_at),
      comments: (a, b) => commentCount(b) - commentCount(a) || ts(b.created_at) - ts(a.created_at),
    };
    items = items.slice().sort(sorters[homeState.sort]);

    list.innerHTML = items.map((p) => `
      <li class="post-item">
        <a href="#/post/${encodeURIComponent(p.id)}">
          <div class="meta"><span class="badge">${escapeHtml(p.category)}</span></div>
          <h2>${escapeHtml(p.title)}</h2>
          <p class="excerpt">${escapeHtml(p.body)}</p>
          <div class="meta" style="margin-top:8px">
            <span>${escapeHtml(p.author)}</span>
            <span>${timeAgo(p.created_at)}</span>
            <span>♥ ${p.likes}</span>
            <span>💬 ${commentCount(p)}</span>
          </div>
        </a>
      </li>`).join('');

    empty.hidden = items.length > 0;
    if (!items.length) empty.textContent = q ? '검색 결과가 없어요.' : '아직 글이 없어요. 첫 글을 올려보세요!';
  }

  function renderWrite() {
    ++viewToken;
    app.replaceChildren(fromTemplate('tpl-write'));
    document.title = '글쓰기 · 솥뚜껑 포럼';

    const form = document.getElementById('writeForm');
    const select = form.elements.category;
    select.innerHTML = CATEGORIES.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
    if (homeState.category !== '전체') select.value = homeState.category;

    form.elements.author.value = storage.get(AUTHOR_KEY, '');
    form.elements.title.focus();

    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = form.elements.title.value.trim();
      const body = form.elements.body.value.trim();
      const password = form.elements.password.value;
      const author = form.elements.author.value.trim() || DEFAULT_AUTHOR;
      const err = document.getElementById('formError');

      if (!title) { err.textContent = '제목을 입력해주세요.'; form.elements.title.focus(); return; }
      if (!body) { err.textContent = '내용을 입력해주세요.'; form.elements.body.focus(); return; }
      if (password.length < 4) {
        err.textContent = '삭제 비밀번호를 4자 이상 입력해주세요.';
        form.elements.password.focus();
        return;
      }

      err.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = '올리는 중…';
      try {
        const id = await api.createPost({ category: select.value, title, body, author, password });
        storage.set(AUTHOR_KEY, form.elements.author.value.trim());
        location.hash = `#/post/${id}`;
      } catch (ex) {
        err.textContent = ex.message;
        submitBtn.disabled = false;
        submitBtn.textContent = '올리기';
      }
    });
  }

  async function renderPost(id) {
    const token = ++viewToken;
    showLoading();

    let post = null;
    if (isUuid(id)) {
      try {
        post = await api.getPost(id);
      } catch (err) {
        if (token === viewToken) showError(err, () => renderPost(id));
        return;
      }
    }
    if (token !== viewToken) return;

    if (!post) {
      app.innerHTML = `<a class="back" href="#/">← 목록으로</a>
        <div class="card"><p>글을 찾을 수 없어요. 삭제되었을 수도 있어요.</p></div>`;
      return;
    }
    document.title = `${post.title} · 솥뚜껑 포럼`;
    const isLiked = liked.has(post.id);
    const comments = post.comments || [];

    app.innerHTML = `
      <a class="back" href="#/">← 목록으로</a>
      <article class="card post-detail">
        <span class="badge">${escapeHtml(post.category)}</span>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="meta">
          <span>${escapeHtml(post.author)}</span>
          <span title="${new Date(post.created_at).toLocaleString('ko-KR')}">${timeAgo(post.created_at)}</span>
        </div>
        <div class="post-body">${escapeHtml(post.body)}</div>
        <div class="post-actions">
          <button type="button" class="btn like-btn ${isLiked ? 'liked' : ''}" id="likeBtn" aria-pressed="${isLiked}">
            ♥ <span id="likeCount">${post.likes}</span>
          </button>
          <button type="button" class="btn" id="deleteBtn">삭제</button>
        </div>
      </article>

      <section class="comments">
        <h2>댓글 ${comments.length}</h2>
        <ul class="comment-list">
          ${comments.map((c) => `
            <li class="comment">
              <div class="meta"><strong>${escapeHtml(c.author)}</strong><span>${timeAgo(c.created_at)}</span></div>
              <p>${escapeHtml(c.body)}</p>
            </li>`).join('')}
        </ul>
        <form class="comment-form" id="commentForm">
          <div class="row">
            <input name="author" maxlength="20" placeholder="닉네임" aria-label="닉네임">
            <textarea name="body" maxlength="1000" placeholder="댓글을 남겨주세요" aria-label="댓글" required></textarea>
            <button class="btn btn-primary" type="submit">등록</button>
          </div>
          <p class="form-error" id="commentError" role="alert"></p>
        </form>
      </section>`;

    const likeBtn = document.getElementById('likeBtn');
    likeBtn.addEventListener('click', async () => {
      const wasLiked = liked.has(post.id);
      likeBtn.disabled = true;
      try {
        const count = await api.likePost(post.id, wasLiked ? -1 : 1);
        if (wasLiked) liked.delete(post.id); else liked.add(post.id);
        saveLiked();
        likeBtn.classList.toggle('liked', !wasLiked);
        likeBtn.setAttribute('aria-pressed', String(!wasLiked));
        document.getElementById('likeCount').textContent = count ?? post.likes;
      } catch (ex) {
        alert(ex.message);
      } finally {
        likeBtn.disabled = false;
      }
    });

    document.getElementById('deleteBtn').addEventListener('click', async () => {
      const password = prompt('글을 쓸 때 정한 삭제 비밀번호를 입력해주세요.');
      if (password === null) return;
      try {
        const ok = await api.deletePost(post.id, password);
        if (!ok) { alert('비밀번호가 맞지 않아요.'); return; }
        liked.delete(post.id);
        saveLiked();
        location.hash = '#/';
      } catch (ex) {
        alert(ex.message);
      }
    });

    const cform = document.getElementById('commentForm');
    const cbtn = cform.querySelector('button[type="submit"]');
    cform.elements.author.value = storage.get(AUTHOR_KEY, '');
    cform.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = cform.elements.body.value.trim();
      if (!body) { cform.elements.body.focus(); return; }
      const author = cform.elements.author.value.trim();
      cbtn.disabled = true;
      try {
        await api.addComment(post.id, author || DEFAULT_AUTHOR, body);
        storage.set(AUTHOR_KEY, author);
        renderPost(id);
      } catch (ex) {
        document.getElementById('commentError').textContent = ex.message;
        cbtn.disabled = false;
      }
    });
  }

  // ---------- router ----------
  function route() {
    const hash = location.hash || '#/';
    const postMatch = hash.match(/^#\/post\/(.+)$/);
    if (hash === '#/write') renderWrite();
    else if (postMatch) renderPost(decodeURIComponent(postMatch[1]));
    else renderHome();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();
})();
