(() => {
  'use strict';

  // ---------- Supabase 연결 정보 ----------
  // publishable 키는 공개용 키라서 코드에 넣어도 괜찮아요.
  // (secret / service_role 키는 절대 여기에 넣지 마세요.)
  const SUPABASE_URL = 'https://znsvaelbahbxktwyxjnd.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_2fr5YSlFRZ25AqdDBB2v5Q_mfNRwIIC';

  const THEME_KEY = 'sotttukkeong-forum:theme';
  const AUTHOR_KEY = 'sotttukkeong-forum:author';

  // ---------- 솥뚜껑 저녁 모임 데이터 ----------
  // 새 회차가 끝나면 rounds에 한 회차씩 추가하면 돼요.
  const DINNER = {
    firstYear: 2026,
    firstMonth: 10, // 1회차: 2026년 10월
    // bio: 이름을 누르면 나오는 간단 소개 (공개된 자료를 바탕으로 쓴 초안이에요)
    hosts: [
      {
        name: '이동호', role: '성북구 구의원', photo: 'images/member-leedongho.webp',
        bio: '성북구의회 의원으로 길음2동·월곡1동·월곡2동 지역을 맡고 있어요. '
          + '국민대학교 경영정보학부를 졸업했고, 서울시 지속가능발전위원회와 녹색서울시민위원회 위원으로도 활동하고 있어요.',
      },
      {
        name: '김덕원', role: '환경을 생각하는 사람들 공동대표', photo: 'images/member-kimdeokwon.webp',
        bio: '\'앨지닥터\'로 활동하는 환경 연구자이자 과학 커뮤니케이터예요. '
          + '환경정보 종합 플랫폼 \'앨지닥터\'를 운영하며, 환경을 생각하는 사람들 공동대표로도 활동하고 있어요.',
      },
      {
        name: '김익수', role: '환경일보 대표', photo: 'images/member-kimiksu.webp',
        bio: '환경 전문 언론사 환경일보의 대표이사이자 편집대표예요. '
          + '탄소중립과 지속가능한 삶을 주제로 여러 기관과 협력하고, 칼럼으로도 꾸준히 목소리를 내고 있어요.',
      },
    ],
    rounds: {
      1: {
        date: '2026-10-30',
        guests: [{
          name: '김소윤', role: '쿨라이밋 대표',
          bio: '청년 기후단체 쿨라이밋(COOLIMATE)의 대표예요. '
            + '청(소)년 기후변화 컨퍼런스 LCOY Korea를 열고, 청년들이 함께 쓴 기후성명서를 국회에 전달해 왔어요.',
        }],
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

  // ---------- local storage (테마, 닉네임만 저장) ----------
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
    listReviews: () =>
      request('dinner_reviews?select=id,round_no,author,body,created_at&order=created_at.asc&limit=1000'),
    addReview: (round, author, body, code) => rpc('add_dinner_review', {
      p_round: round, p_author: author, p_body: body, p_code: code,
    }),
  };

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

  const fromTemplate = (id) => document.getElementById(id).content.cloneNode(true);

  const loaderHtml = (text = '불러오는 중…') => `
    <div class="pot-loader" role="status">
      <div class="mini-pot" aria-hidden="true">
        <span class="steam s1"></span><span class="steam s2"></span><span class="steam s3"></span>
        <span class="lid"></span><span class="pot"></span>
      </div>
      ${escapeHtml(text)}
    </div>`;

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
  let introPlayed = false;

  function renderHome() {
    ++viewToken;
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
  }

  // ---------- 솥뚜껑 저녁 모임 ----------
  const people = [];
  const personId = (p) => { let i = people.indexOf(p); if (i < 0) { people.push(p); i = people.length - 1; } return i; };

  const personChip = (p, guest) => `<li class="${guest ? 'guest' : ''}">
      <button type="button" class="person-btn" data-person="${personId(p)}" aria-expanded="false">
        <b>${escapeHtml(p.name)}</b> · ${escapeHtml(p.role)}
      </button></li>`;

  const avatarHtml = (p) => (p.photo
    ? `<div class="avatar has-photo" aria-hidden="true"><img src="${escapeHtml(p.photo)}" alt="" loading="lazy"></div>`
    : `<div class="avatar" aria-hidden="true">${escapeHtml(p.name.slice(1, 2))}</div>`);

  const bioHtml = (p) => `
      <div class="bio-head">
        ${avatarHtml(p)}
        <div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.role)}</span></div>
        <button type="button" class="bio-close" aria-label="소개 닫기">×</button>
      </div>
      <p>${escapeHtml(p.bio || '소개를 준비하고 있어요.')}</p>`;

  // 이름을 누르면 바로 아래에 간단 소개가 열려요
  function setupBios(root) {
    root.addEventListener('click', (e) => {
      const close = e.target.closest('.bio-close');
      if (close) {
        const panel = close.closest('.bio-panel');
        root.querySelectorAll(`[data-person][aria-expanded="true"]`).forEach((b) => b.setAttribute('aria-expanded', 'false'));
        panel.remove();
        return;
      }
      const btn = e.target.closest('[data-person]');
      if (!btn) return;
      const host = btn.closest('.people, .member-grid');
      const open = btn.getAttribute('aria-expanded') === 'true';
      host.parentElement.querySelectorAll(':scope > .bio-panel').forEach((x) => x.remove());
      host.querySelectorAll('[data-person]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (open) return;
      btn.setAttribute('aria-expanded', 'true');
      const panel = document.createElement('div');
      panel.className = 'bio-panel';
      panel.setAttribute('role', 'region');
      panel.innerHTML = bioHtml(people[Number(btn.dataset.person)]);
      host.after(panel);
    });
  }

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
      <li>
        <button type="button" class="member" data-person="${personId(h)}" aria-expanded="false">
          ${avatarHtml(h)}
          <strong>${escapeHtml(h.name)}</strong>
          <span>${escapeHtml(h.role)}</span>
          <em class="member-more">소개 보기</em>
        </button>
      </li>`).join('');
    setupBios(app);

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
            <p class="people-label">함께한 사람 <small>· 이름을 누르면 소개가 나와요</small></p>
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
    let section = 'home';
    if (hash === '#/dinner') { renderDinner(); section = 'dinner'; }
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
