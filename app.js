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

  // ---------- 솥뚜껑 저녁 모임 데이터 ----------
  // 새 회차가 끝나면 ROUNDS에 한 줄씩 추가하면 돼요.
  const DINNER = {
    firstYear: 2026,
    firstMonth: 10, // 1회차: 2026년 10월
    hosts: [
      { name: '이동호', role: '성북구 구의원' },
      { name: '김덕원', role: '환경을 생각하는 사람들 공동대표' },
      { name: '김익수', role: '환경일보 대표' },
    ],
    rounds: {
      1: {
        date: '2026-10-30',
        guests: [{ name: '김소윤', role: '쿨라이밋 대표' }],
        photo: 'images/dinner-01.webp',
        photoAlt: '1회차 모임에서 참석자들이 솥뚜껑 테이블에 둘러앉아 손을 모으고 웃고 있는 모습',
      },
    },
  };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayYmd = () => ymd(new Date());
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtShort = (s) => { const d = parseYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`; };
  const fmtLong = (s) => { const d = parseYmd(s); return `${d.getFullYear()}년 ${fmtShort(s)}`; };

  // month: 1~12
  const lastFriday = (year, month) => {
    const d = new Date(year, month, 0); // 그 달의 마지막 날
    while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    return ymd(d);
  };
  const roundDate = (no) => {
    const idx = DINNER.firstMonth - 1 + (no - 1);
    return lastFriday(DINNER.firstYear + Math.floor(idx / 12), (idx % 12) + 1);
  };
  const nextRoundNo = () => {
    const today = todayYmd();
    let no = 1;
    while (roundDate(no) < today) no += 1;
    return no;
  };
  const daysUntil = (s) => Math.round((parseYmd(s) - parseYmd(todayYmd())) / 86400000);
  const ddayText = (s) => { const n = daysUntil(s); return n === 0 ? '오늘 저녁!' : `D-${n}`; };

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
    listReviews: () =>
      request('dinner_reviews?select=id,round_no,author,body,created_at&order=created_at.asc&limit=1000'),
    addReview: (round, author, body, code) => rpc('add_dinner_review', {
      p_round: round, p_author: author, p_body: body, p_code: code,
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

  const loaderHtml = (text = '불러오는 중…') => `
    <div class="pot-loader" role="status">
      <div class="mini-pot" aria-hidden="true">
        <span class="steam s1"></span><span class="steam s2"></span><span class="steam s3"></span>
        <span class="lid"></span><span class="pot"></span>
      </div>
      ${escapeHtml(text)}
    </div>`;

  const showLoading = () => { app.innerHTML = loaderHtml(); };

  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupReveal(root) {
    if (reduceMotion() || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    const els = [...root.querySelectorAll('.reveal')];
    els.forEach((el) => { el.classList.add('reveal-init'); io.observe(el); });
    // 빠르게 건너뛰어 지나간 부분도 보이게
    const sweep = () => els.forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in');
    });
    let raf = 0;
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; sweep(); }); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('hashchange', () => removeEventListener('scroll', onScroll), { once: true });
  }

  function leafBurst(el) {
    if (reduceMotion()) return;
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    for (let i = 0; i < 7; i += 1) {
      const s = document.createElement('span');
      s.className = 'burst';
      const a = (Math.PI * 2 * i) / 7 + Math.random() * .5;
      const r = 28 + Math.random() * 18;
      s.style.setProperty('--bx', `${Math.cos(a) * r}px`);
      s.style.setProperty('--by', `${Math.sin(a) * r}px`);
      if (i % 2) s.style.background = 'var(--green)';
      el.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

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

  let introPlayed = false;

  async function renderHome() {
    const token = ++viewToken;
    document.title = '솥뚜껑 포럼';
    app.replaceChildren(fromTemplate('tpl-home'));

    // 첫 화면 인트로 (페이지를 처음 열었을 때만)
    const stage = app.querySelector('.hero-stage');
    if (!introPlayed && !reduceMotion()) stage.classList.add('intro');
    introPlayed = true;

    const logoBtn = document.getElementById('heroLogo');
    logoBtn.addEventListener('click', () => {
      stage.classList.remove('intro');
      logoBtn.classList.remove('rattle'); void logoBtn.offsetWidth; logoBtn.classList.add('rattle');
    });
    logoBtn.addEventListener('animationend', (e) => {
      if (e.animationName === 'rattle') logoBtn.classList.remove('rattle');
    });
    document.getElementById('scrollCue').addEventListener('click', () => {
      document.getElementById('dinnerTeaser').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
    });

    // 다음 저녁 모임
    const no = nextRoundNo();
    const date = roundDate(no);
    app.querySelector('[data-next-date]').textContent = `${no}회차 · ${fmtShort(date)}`;
    app.querySelector('[data-next-dday]').textContent = ddayText(date);

    setupReveal(app);

    // 카테고리, 검색, 정렬
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

    // 글 목록 불러오기
    const status = document.getElementById('listStatus');
    status.innerHTML = loaderHtml('이야기를 불러오는 중…');
    try {
      posts = await api.listPosts();
    } catch (err) {
      if (token !== viewToken) return;
      status.innerHTML = `<div class="card"><p>${escapeHtml(err.message)}</p>
        <button type="button" class="btn" id="retryBtn">다시 시도</button></div>`;
      document.getElementById('retryBtn').addEventListener('click', () => {
        status.innerHTML = loaderHtml('이야기를 불러오는 중…');
        api.listPosts().then((p) => { posts = p; status.innerHTML = ''; renderList(); })
          .catch((e2) => { status.innerHTML = `<div class="card"><p>${escapeHtml(e2.message)}</p></div>`; });
      });
      return;
    }
    if (token !== viewToken) return;
    status.innerHTML = '';
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
        if (!wasLiked) leafBurst(likeBtn);
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

  // ---------- 솥뚜껑 저녁 모임 ----------
  const personChip = (p, guest) =>
    `<li class="${guest ? 'guest' : ''}"><b>${escapeHtml(p.name)}</b> · ${escapeHtml(p.role)}</li>`;

  function renderDinner() {
    const token = ++viewToken;
    document.title = '솥뚜껑 저녁 모임 · 솥뚜껑 포럼';
    app.replaceChildren(fromTemplate('tpl-dinner'));

    const nextNo = nextRoundNo();
    const nextDate = roundDate(nextNo);
    app.querySelector('[data-next-date-long]').textContent = `다음 모임 · ${fmtShort(nextDate)}`;

    // 초대장 애니메이션
    const stage = app.querySelector('.invite-stage');
    const play = () => {
      if (reduceMotion()) return;
      stage.classList.remove('play'); void stage.offsetWidth; stage.classList.add('play');
    };
    play();
    document.getElementById('replayInvite').addEventListener('click', play);

    // 고정 멤버
    document.getElementById('memberGrid').innerHTML = DINNER.hosts.map((h) => `
      <li class="member">
        <div class="avatar" aria-hidden="true">${escapeHtml(h.name.slice(1, 2))}</div>
        <strong>${escapeHtml(h.name)}</strong>
        <span>${escapeHtml(h.role)}</span>
      </li>`).join('');

    // 회차 목록 (1회차부터 아래로)
    const list = document.getElementById('roundList');
    const items = [];
    for (let no = 1; no < nextNo; no += 1) {
      const r = DINNER.rounds[no] || {};
      const date = r.date || roundDate(no);
      const guests = r.guests || [];
      items.push(`
        <li class="round reveal" data-round="${no}">
          <article class="card">
            <header class="round-head">
              <h3>${no}회차</h3>
              <time datetime="${date}">${fmtLong(date)}</time>
              <span class="badge">함께했어요</span>
            </header>
            ${r.photo ? `<figure class="round-photo">
              <img src="${escapeHtml(r.photo)}" alt="${escapeHtml(r.photoAlt || `${no}회차 모임 사진`)}" loading="lazy">
            </figure>` : ''}
            <p class="people-label">함께한 사람</p>
            <ul class="people">
              ${DINNER.hosts.map((h) => personChip(h, false)).join('')}
              ${guests.map((g) => personChip(g, true)).join('')}
            </ul>
            ${guests.length ? '' : '<p class="review-empty" style="margin-top:8px">초대 손님 기록을 준비하고 있어요.</p>'}
            <section class="reviews">
              <h4>💬 참여 후기</h4>
              <ul class="review-list" data-reviews="${no}">${loaderHtml('후기를 불러오는 중…')}</ul>
              <form class="review-form" data-review-form="${no}">
                <div class="row">
                  <input name="author" maxlength="20" placeholder="이름 또는 닉네임" aria-label="이름" required>
                  <input name="code" type="password" maxlength="40" placeholder="참여자 코드" aria-label="참여자 코드" required autocomplete="off">
                </div>
                <textarea name="body" maxlength="2000" placeholder="이날 모임은 어땠나요?" aria-label="후기" required></textarea>
                <div class="actions">
                  <p class="hint">참여자 코드는 모임에서 받은 코드예요.</p>
                  <button class="btn btn-primary" type="submit">후기 남기기</button>
                </div>
                <p class="form-error" role="alert"></p>
              </form>
            </section>
          </article>
        </li>`);
    }

    const nextInfo = DINNER.rounds[nextNo] || {};
    const nextGuests = nextInfo.guests || [];
    items.push(`
      <li class="round upcoming reveal">
        <article class="card">
          <header class="round-head">
            <h3>${nextNo}회차</h3>
            <time datetime="${nextDate}">${fmtLong(nextDate)}</time>
            <span class="badge">준비 중</span>
          </header>
          <div class="upcoming-body">
            <div class="mini-pot" aria-hidden="true">
              <span class="steam s1"></span><span class="steam s2"></span><span class="steam s3"></span>
              <span class="lid"></span><span class="pot"></span>
            </div>
            <div>
              <p class="dday">${ddayText(nextDate)}</p>
              <p>${nextGuests.length
                ? `초대 손님: ${nextGuests.map((g) => `${escapeHtml(g.name)} (${escapeHtml(g.role)})`).join(', ')}`
                : '이번 달 초대 손님을 모시는 중이에요. 솥뚜껑을 데우고 있어요!'}</p>
            </div>
          </div>
        </article>
      </li>`);
    list.innerHTML = items.join('');
    setupReveal(app);

    // 후기
    const renderReviews = (all) => {
      app.querySelectorAll('[data-reviews]').forEach((ul) => {
        const no = Number(ul.dataset.reviews);
        const mine = all.filter((r) => r.round_no === no);
        ul.innerHTML = mine.length
          ? mine.map((r) => `
            <li class="review">
              <div class="meta"><strong>${escapeHtml(r.author)}</strong><span>${timeAgo(r.created_at)}</span></div>
              <p>${escapeHtml(r.body)}</p>
            </li>`).join('')
          : '<li class="review-empty">아직 후기가 없어요. 첫 후기를 남겨 주세요!</li>';
      });
    };

    const loadReviews = () => api.listReviews().then((all) => {
      if (token === viewToken) renderReviews(all);
    });

    loadReviews().catch(() => {
      if (token !== viewToken) return;
      app.querySelectorAll('[data-reviews]').forEach((ul) => {
        ul.innerHTML = '<li class="review-empty">후기 기능을 준비하고 있어요.</li>';
      });
    });

    app.querySelectorAll('[data-review-form]').forEach((form) => {
      const no = Number(form.dataset.reviewForm);
      const btn = form.querySelector('button[type="submit"]');
      const err = form.querySelector('.form-error');
      form.elements.author.value = storage.get(AUTHOR_KEY, '');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const author = form.elements.author.value.trim();
        const body = form.elements.body.value.trim();
        const code = form.elements.code.value.trim();
        if (!author) { err.textContent = '이름을 입력해 주세요.'; form.elements.author.focus(); return; }
        if (!body) { err.textContent = '후기를 입력해 주세요.'; form.elements.body.focus(); return; }
        if (!code) { err.textContent = '참여자 코드를 입력해 주세요.'; form.elements.code.focus(); return; }
        err.textContent = '';
        btn.disabled = true;
        try {
          const ok = await api.addReview(no, author, body, code);
          if (!ok) { err.textContent = '참여자 코드가 맞지 않아요.'; return; }
          storage.set(AUTHOR_KEY, author);
          form.elements.body.value = '';
          await loadReviews();
        } catch (ex) {
          err.textContent = ex.message;
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // ---------- router ----------
  function route() {
    const hash = location.hash || '#/';
    const postMatch = hash.match(/^#\/post\/(.+)$/);
    let section = 'home';
    if (hash === '#/write') { renderWrite(); section = ''; }
    else if (hash === '#/dinner') { renderDinner(); section = 'dinner'; }
    else if (postMatch) renderPost(decodeURIComponent(postMatch[1]));
    else renderHome();

    document.querySelectorAll('.main-nav a').forEach((a) => {
      const on = a.dataset.nav === section;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    app.classList.remove('view-enter'); void app.offsetWidth; app.classList.add('view-enter');
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);
  route();
})();
