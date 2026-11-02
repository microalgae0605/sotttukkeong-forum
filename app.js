(() => {
  'use strict';

  const STORAGE_KEY = 'sotttukkeong-forum:v1';
  const THEME_KEY = 'sotttukkeong-forum:theme';
  const LIKED_KEY = 'sotttukkeong-forum:liked';
  const CATEGORIES = ['잡담', '질문', '정보', '자랑'];
  const DEFAULT_AUTHOR = '익명의 솥뚜껑';

  const app = document.getElementById('app');

  // ---------- storage ----------
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

  const now = Date.now();
  const HOUR = 3600 * 1000;
  const seedPosts = [
    {
      id: 'seed-1',
      category: '잡담',
      title: '솥뚜껑 포럼 오픈했습니다 🎉',
      author: '운영자',
      body: '어서 오세요! 여기는 솥뚜껑 포럼입니다.\n\n뜨거운 이야기도, 소소한 이야기도 다 환영해요.\n서로 존중하면서 즐겁게 이야기 나눠요.',
      createdAt: now - 26 * HOUR,
      likes: 12,
      comments: [
        { id: 'c1', author: '첫손님', body: '오픈 축하드려요!', createdAt: now - 25 * HOUR },
        { id: 'c2', author: '지글지글', body: '이름 너무 좋네요 ㅋㅋ', createdAt: now - 20 * HOUR },
      ],
    },
    {
      id: 'seed-2',
      category: '정보',
      title: '솥뚜껑 삼겹살 맛있게 굽는 법',
      author: '고기장인',
      body: '1. 솥뚜껑을 충분히 달군다\n2. 기름이 가운데로 모이도록 고기를 바깥쪽에 올린다\n3. 모인 기름에 김치와 콩나물을 볶는다\n\n이게 진리입니다.',
      createdAt: now - 8 * HOUR,
      likes: 27,
      comments: [
        { id: 'c3', author: '배고픈사람', body: '새벽에 보면 안 되는 글…', createdAt: now - 6 * HOUR },
      ],
    },
    {
      id: 'seed-3',
      category: '질문',
      title: '포럼 글은 어디에 저장되나요?',
      author: '궁금이',
      body: '글을 써봤는데 다른 기기에서는 안 보이네요. 원래 그런가요?',
      createdAt: now - 2 * HOUR,
      likes: 3,
      comments: [
        { id: 'c4', author: '운영자', body: '지금은 브라우저(localStorage)에만 저장돼요. 나중에 서버를 붙이면 모두와 공유할 수 있어요!', createdAt: now - 1 * HOUR },
      ],
    },
  ];

  let posts = storage.get(STORAGE_KEY, null);
  if (!Array.isArray(posts)) {
    posts = seedPosts;
    storage.set(STORAGE_KEY, posts);
  }
  let liked = new Set(storage.get(LIKED_KEY, []));

  const save = () => storage.set(STORAGE_KEY, posts);
  const saveLiked = () => storage.set(LIKED_KEY, [...liked]);

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- helpers ----------
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const timeAgo = (ts) => {
    const diff = Math.max(0, Date.now() - ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(ts).toLocaleDateString('ko-KR');
  };

  const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true);

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

  function renderHome() {
    app.replaceChildren(fromTemplate('tpl-home'));
    document.title = '솥뚜껑 포럼';

    const tabs = document.getElementById('categoryTabs');
    ['전체', ...CATEGORIES].forEach((cat) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-ghost' + (cat === homeState.category ? ' active' : '');
      b.textContent = cat;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(cat === homeState.category));
      b.addEventListener('click', () => { homeState.category = cat; renderHome(); });
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
      new: (a, b) => b.createdAt - a.createdAt,
      hot: (a, b) => b.likes - a.likes || b.createdAt - a.createdAt,
      comments: (a, b) => b.comments.length - a.comments.length || b.createdAt - a.createdAt,
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
            <span>${timeAgo(p.createdAt)}</span>
            <span>♥ ${p.likes}</span>
            <span>💬 ${p.comments.length}</span>
          </div>
        </a>
      </li>`).join('');

    empty.hidden = items.length > 0;
    if (!items.length) empty.textContent = q ? '검색 결과가 없어요.' : '아직 글이 없어요. 첫 글을 올려보세요!';
  }

  function renderWrite() {
    app.replaceChildren(fromTemplate('tpl-write'));
    document.title = '글쓰기 · 솥뚜껑 포럼';

    const form = document.getElementById('writeForm');
    const select = form.elements.category;
    select.innerHTML = CATEGORIES.map((c) => `<option>${escapeHtml(c)}</option>`).join('');
    if (homeState.category !== '전체') select.value = homeState.category;

    const lastAuthor = storage.get('sotttukkeong-forum:author', '');
    form.elements.author.value = lastAuthor;
    form.elements.title.focus();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = form.elements.title.value.trim();
      const body = form.elements.body.value.trim();
      const author = form.elements.author.value.trim() || DEFAULT_AUTHOR;
      const err = document.getElementById('formError');

      if (!title) { err.textContent = '제목을 입력해주세요.'; form.elements.title.focus(); return; }
      if (!body) { err.textContent = '내용을 입력해주세요.'; form.elements.body.focus(); return; }

      const post = {
        id: uid(),
        category: select.value,
        title,
        author,
        body,
        createdAt: Date.now(),
        likes: 0,
        comments: [],
      };
      posts.push(post);
      save();
      storage.set('sotttukkeong-forum:author', form.elements.author.value.trim());
      location.hash = `#/post/${post.id}`;
    });
  }

  function renderPost(id) {
    const post = posts.find((p) => p.id === id);
    if (!post) {
      app.innerHTML = `<a class="back" href="#/">← 목록으로</a>
        <div class="card"><p>글을 찾을 수 없어요. 삭제되었을 수도 있어요.</p></div>`;
      return;
    }
    document.title = `${post.title} · 솥뚜껑 포럼`;
    const isLiked = liked.has(post.id);

    app.innerHTML = `
      <a class="back" href="#/">← 목록으로</a>
      <article class="card post-detail">
        <span class="badge">${escapeHtml(post.category)}</span>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="meta">
          <span>${escapeHtml(post.author)}</span>
          <span title="${new Date(post.createdAt).toLocaleString('ko-KR')}">${timeAgo(post.createdAt)}</span>
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
        <h2>댓글 ${post.comments.length}</h2>
        <ul class="comment-list">
          ${post.comments.map((c) => `
            <li class="comment">
              <div class="meta"><strong>${escapeHtml(c.author)}</strong><span>${timeAgo(c.createdAt)}</span></div>
              <p>${escapeHtml(c.body)}</p>
            </li>`).join('')}
        </ul>
        <form class="comment-form" id="commentForm">
          <div class="row">
            <input name="author" maxlength="20" placeholder="닉네임" aria-label="닉네임">
            <textarea name="body" maxlength="1000" placeholder="댓글을 남겨주세요" aria-label="댓글" required></textarea>
            <button class="btn btn-primary" type="submit">등록</button>
          </div>
        </form>
      </section>`;

    document.getElementById('likeBtn').addEventListener('click', () => {
      if (liked.has(post.id)) { liked.delete(post.id); post.likes = Math.max(0, post.likes - 1); }
      else { liked.add(post.id); post.likes += 1; }
      save(); saveLiked(); renderPost(id);
    });

    document.getElementById('deleteBtn').addEventListener('click', () => {
      if (!confirm('이 글을 삭제할까요?')) return;
      posts = posts.filter((p) => p.id !== post.id);
      liked.delete(post.id);
      save(); saveLiked();
      location.hash = '#/';
    });

    const cform = document.getElementById('commentForm');
    cform.elements.author.value = storage.get('sotttukkeong-forum:author', '');
    cform.addEventListener('submit', (e) => {
      e.preventDefault();
      const body = cform.elements.body.value.trim();
      if (!body) { cform.elements.body.focus(); return; }
      const author = cform.elements.author.value.trim();
      post.comments.push({ id: uid(), author: author || DEFAULT_AUTHOR, body, createdAt: Date.now() });
      save();
      storage.set('sotttukkeong-forum:author', author);
      renderPost(id);
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
