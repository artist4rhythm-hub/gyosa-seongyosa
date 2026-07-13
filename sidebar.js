/* ═══════════════════════════════════════════════
   사이드바 + 모바일 하단탭
   사용법: 각 페이지에서
     <script src="menu.js"></script>
     <script src="sidebar.js"></script>
     renderShell('payreq', CU);   // 페이지 키, 현재 사용자
   구조: <div id="app"><aside id="sb">…</aside><main id="mn">…</main></div>
   기존 콘텐츠는 #mn 안으로 들어갑니다.
   ═══════════════════════════════════════════════ */

const SB_PIN_KEY = 'gyosa_pins';
let SB_ACTIVE = '';
let SB_USER = null;
let SB_BADGES = {};      // {payreq:3, approval:0, message:2}
let SB_COLLAPSED = false;

/* ── 핀(자주 쓰는) 저장 — 메모리 + 세션 ── */
let _pins = null;
function getPins(){
  if(_pins) return _pins;
  try { _pins = JSON.parse(sessionStorage.getItem(SB_PIN_KEY) || '[]'); }
  catch(e){ _pins = []; }
  return _pins;
}
function savePins(p){
  _pins = p;
  try { sessionStorage.setItem(SB_PIN_KEY, JSON.stringify(p)); } catch(e){}
}
function togglePin(key){
  const p = getPins();
  const i = p.indexOf(key);
  if(i >= 0) p.splice(i, 1); else p.push(key);
  savePins(p);
  renderSidebar();
}
window.togglePin = togglePin;

/* ── 뱃지 설정 (각 페이지에서 계산해 넘김) ── */
function setBadges(obj){
  SB_BADGES = { ...SB_BADGES, ...obj };
  renderSidebar();
  renderMobileTabs();
}
window.setBadges = setBadges;

/* ── 관리자 여부 ── */
function sbIsAdmin(){
  const r = SB_USER && SB_USER.role;
  return r === 'super' || r === 'org_admin' || r === 'tab_admin';
}

/* ── 아이템 필터 (권한) ── */
function sbVisibleGroups(){
  const admin = sbIsAdmin();
  return MENU
    .filter(g => !g.admin || admin)
    .map(g => ({ ...g, items: g.items.filter(it => !it.admin || admin) }))
    .filter(g => g.items.length);
}

/* ═══ 셸(사이드바+본문) 생성 ═══ */
function renderShell(activeKey, user){
  SB_ACTIVE = activeKey;
  SB_USER = user || null;

  if(!document.getElementById('sb-style')) injectSidebarCSS();

  // 기존 body의 콘텐츠를 main으로 이동
  let app = document.getElementById('app');
  if(!app){
    const existing = document.getElementById('ms');   // 기존 메인 섹션
    app = document.createElement('div');
    app.id = 'app';
    app.innerHTML = `
      <aside id="sb"></aside>
      <div id="sb-scrim" onclick="closeDrawer()"></div>
      <div id="mn-wrap">
        <header id="tb"></header>
        <main id="mn"></main>
      </div>
      <nav id="mtab"></nav>`;
    document.body.insertBefore(app, document.body.firstChild);
    if(existing){
      document.getElementById('mn').appendChild(existing);
      existing.style.display = 'flex';
      existing.style.flexDirection = 'column';
      existing.style.width = '100%';
    }
  }
  renderSidebar();
  renderTopbar();
  renderMobileTabs();
}
window.renderShell = renderShell;

/* ═══ 사이드바 ═══ */
function renderSidebar(){
  const sb = document.getElementById('sb');
  if(!sb) return;
  const pins = getPins();
  const all = menuAllItems();
  const pinned = pins.map(k => all.find(i => i.key === k)).filter(Boolean);

  const itemHTML = (it, isPinned) => {
    const on = it.key === SB_ACTIVE;
    const b = SB_BADGES[it.badge] || 0;
    return `<a class="sb-i${on ? ' on' : ''}" href="${it.href}" title="${it.label}">
      <span class="material-symbols-rounded">${it.icon}</span>
      <span class="sb-l">${it.label}</span>
      ${b > 0 ? `<span class="sb-b">${b > 99 ? '99+' : b}</span>` : ''}
      <button class="sb-pin${isPinned ? ' on' : ''}" onclick="event.preventDefault();event.stopPropagation();togglePin('${it.key}')" title="${isPinned ? '고정 해제' : '자주 쓰는 항목에 고정'}">
        <span class="material-symbols-rounded">keep</span>
      </button>
    </a>`;
  };

  sb.innerHTML = `
    <div class="sb-top">
      <a class="sb-brand" href="index.html">
        <div class="sb-logo"><span class="material-symbols-rounded">school</span></div>
        <span class="sb-bt">교사 선교사</span>
      </a>
      <button class="sb-close" onclick="closeDrawer()" aria-label="닫기">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>

    <div class="sb-search">
      <span class="material-symbols-rounded">search</span>
      <input id="sb-q" placeholder="검색  (⌘K)" oninput="onSearch(this.value)" onkeydown="onSearchKey(event)" autocomplete="off">
    </div>
    <div id="sb-res" class="sb-res"></div>

    <nav class="sb-nav" id="sb-nav">
      <a class="sb-i sb-home${SB_ACTIVE==='home' ? ' on' : ''}" href="index.html">
        <span class="material-symbols-rounded">home</span>
        <span class="sb-l">홈</span>
      </a>
      ${pinned.length ? `
        <div class="sb-g">
          <div class="sb-gt"><span class="material-symbols-rounded">keep</span>자주 쓰는</div>
          ${pinned.map(it => itemHTML(it, true)).join('')}
        </div>` : ''}
      ${sbVisibleGroups().map(g => `
        <div class="sb-g">
          <div class="sb-gt">${g.group}</div>
          ${g.items.map(it => itemHTML(it, pins.includes(it.key))).join('')}
        </div>`).join('')}
    </nav>

    <div class="sb-foot">
      <div class="sb-me">
        <div class="sb-av">${(SB_USER?.name || '?').slice(0, 1)}</div>
        <div class="sb-mi">
          <div class="sb-mn">${SB_USER?.name || ''}</div>
          <div class="sb-mr">${sbOrgLabel()}</div>
        </div>
      </div>
    </div>`;
}

function sbOrgLabel(){
  const ORGS = window.ORGS || { daniel: '다니엘 아마츠', jihyebit: '지혜빛' };
  const o = SB_USER?.org;
  const role = SB_USER?.role === 'super' ? '슈퍼관리자'
    : SB_USER?.role === 'org_admin' ? '기관관리자'
    : SB_USER?.position && SB_USER.position !== '교사' ? SB_USER.position : '교사';
  return `${ORGS[o] || o || ''} · ${role}`;
}

/* ═══ 검색 ═══ */
function onSearch(q){
  const box = document.getElementById('sb-res');
  const nav = document.getElementById('sb-nav');
  if(!box) return;
  const rs = menuSearch(q);
  if(!q.trim()){
    box.innerHTML = ''; box.classList.remove('show');
    if(nav) nav.style.display = '';
    return;
  }
  if(nav) nav.style.display = 'none';
  box.classList.add('show');
  box.innerHTML = rs.length ? rs.map(r => `
    <a class="sb-r" href="${r.href}">
      <span class="material-symbols-rounded">${r.icon}</span>
      <div class="sb-rt">
        <div class="sb-rl">${r.matchTab ? r.matchTab : r.label}</div>
        <div class="sb-rd">${r.matchTab ? r.label : r.group}</div>
      </div>
    </a>`).join('') : '<div class="sb-none">결과가 없습니다</div>';
}
window.onSearch = onSearch;

function onSearchKey(e){
  if(e.key === 'Escape'){ e.target.value = ''; onSearch(''); e.target.blur(); }
  if(e.key === 'Enter'){
    const first = document.querySelector('#sb-res .sb-r');
    if(first) location.href = first.getAttribute('href');
  }
}
window.onSearchKey = onSearchKey;

document.addEventListener('keydown', e => {
  if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    openDrawer();
    const q = document.getElementById('sb-q');
    if(q){ q.focus(); q.select(); }
  }
});

/* ═══ 상단바 (빵부스러기) ═══ */
function renderTopbar(){
  const tb = document.getElementById('tb');
  if(!tb) return;
  const it = menuFind(SB_ACTIVE);
  const totalBadge = Object.values(SB_BADGES).reduce((s, v) => s + (v || 0), 0);
  tb.innerHTML = `
    <button class="tb-menu" onclick="openDrawer()" aria-label="메뉴">
      <span class="material-symbols-rounded">menu</span>
    </button>
    <div class="tb-crumb">
      ${it ? `<span class="tb-g">${it.group}</span>
        <span class="material-symbols-rounded tb-sep">chevron_right</span>
        <span class="tb-p">${it.label}</span>` : '<span class="tb-p">홈</span>'}
    </div>
    <div class="tb-right">
      <a class="tb-ic" href="message.html" aria-label="쪽지">
        <span class="material-symbols-rounded">notifications</span>
        ${totalBadge > 0 ? `<span class="tb-dot">${totalBadge > 9 ? '9+' : totalBadge}</span>` : ''}
      </a>
    </div>`;
}

/* ═══ 모바일 하단탭 ═══ */
function renderMobileTabs(){
  const mt = document.getElementById('mtab');
  if(!mt) return;
  const todo = (SB_BADGES.payreq || 0) + (SB_BADGES.approval || 0);
  const msg = SB_BADGES.message || 0;
  const tab = (icon, label, href, badge, on) => `
    <a class="mt-i${on ? ' on' : ''}" href="${href}">
      <span class="mt-w">
        <span class="material-symbols-rounded">${icon}</span>
        ${badge > 0 ? `<span class="mt-b">${badge > 9 ? '9+' : badge}</span>` : ''}
      </span>
      <span class="mt-l">${label}</span>
    </a>`;
  mt.innerHTML =
    tab('home', '홈', 'index.html', 0, SB_ACTIVE === 'home') +
    tab('approval', '할 일', 'payreq.html', todo, SB_ACTIVE === 'payreq') +
    tab('mail', '쪽지', 'message.html', msg, SB_ACTIVE === 'message') +
    `<button class="mt-i" onclick="openDrawer()">
      <span class="mt-w"><span class="material-symbols-rounded">apps</span></span>
      <span class="mt-l">전체</span>
    </button>`;
}

/* ═══ 드로어(모바일) ═══ */
function openDrawer(){
  document.getElementById('app')?.classList.add('drawer');
}
window.openDrawer = openDrawer;
function closeDrawer(){
  document.getElementById('app')?.classList.remove('drawer');
}
window.closeDrawer = closeDrawer;

/* ═══ CSS ═══ */
function injectSidebarCSS(){
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0,0&display=swap';
  document.head.appendChild(link);

  // 아이콘 폰트가 준비되면 표시 (로딩 중 이름이 글자로 보이는 것 방지)
  const ready = () => document.documentElement.classList.add('fonts-ready');
  if(document.fonts && document.fonts.load){
    document.fonts.load('20px "Material Symbols Rounded"').then(ready).catch(ready);
    document.fonts.ready.then(ready);
  } else { ready(); }
  setTimeout(ready, 4000);   // 안전장치

  const st = document.createElement('style');
  st.id = 'sb-style';
  st.textContent = `
.material-symbols-rounded{font-family:'Material Symbols Rounded';font-weight:400;font-style:normal;font-size:20px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-feature-settings:'liga';-webkit-font-smoothing:antialiased;font-variation-settings:'opsz' 20;}
/* 폰트 로딩 전/실패 시 아이콘 이름이 글자로 노출되지 않게 */
.material-symbols-rounded{color:transparent;transition:color .01s;}
.fonts-ready .material-symbols-rounded{color:inherit;}

#app{display:flex;min-height:100vh;background:var(--sb-cream);}

/* ── 사이드바 ── */
#sb{width:var(--sb-w);flex:none;background:var(--sb-house);color:#fff;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;z-index:60;}
.sb-top{display:flex;align-items:center;padding:14px 12px 10px;}
.sb-brand{display:flex;align-items:center;gap:9px;text-decoration:none;flex:1;min-width:0;}
.sb-logo{width:30px;height:30px;border-radius:8px;background:var(--sb-green);display:flex;align-items:center;justify-content:center;flex:none;}
.sb-logo .material-symbols-rounded{font-size:18px;color:#fff;}
.sb-bt{color:#fff;font-size:14.5px;font-weight:700;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;}
.sb-close{display:none;border:none;background:none;color:rgba(255,255,255,.6);cursor:pointer;padding:4px;}

.sb-search{margin:0 12px 10px;background:rgba(255,255,255,.09);border-radius:9px;display:flex;align-items:center;gap:7px;padding:0 10px;height:36px;}
.sb-search .material-symbols-rounded{font-size:18px;color:rgba(255,255,255,.5);flex:none;}
.sb-search input{flex:1;min-width:0;background:none;border:none;outline:none;color:#fff;font-size:13px;font-family:inherit;}
.sb-search input::placeholder{color:rgba(255,255,255,.42);}

.sb-res{display:none;padding:0 8px;overflow-y:auto;}
.sb-res.show{display:block;flex:1;}
.sb-r{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:8px;text-decoration:none;color:rgba(255,255,255,.85);}
.sb-r:hover{background:rgba(255,255,255,.1);}
.sb-r .material-symbols-rounded{font-size:18px;color:rgba(255,255,255,.55);flex:none;}
.sb-rt{min-width:0;}
.sb-rl{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-rd{font-size:10.5px;color:rgba(255,255,255,.45);}
.sb-none{padding:14px 12px;font-size:12.5px;color:rgba(255,255,255,.4);text-align:center;}

.sb-nav{flex:1;overflow-y:auto;padding:0 8px 8px;}
.sb-nav::-webkit-scrollbar{width:4px;}
.sb-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:4px;}
.sb-home{margin-bottom:10px;}
.sb-g{margin-bottom:12px;}
.sb-gt{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:rgba(255,255,255,.4);padding:5px 9px;letter-spacing:0.4px;}
.sb-gt .material-symbols-rounded{font-size:13px;color:var(--sb-mint);}

.sb-i{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:8px;text-decoration:none;color:rgba(255,255,255,.78);margin-bottom:1px;position:relative;transition:background .12s;}
.sb-i:hover{background:rgba(255,255,255,.09);color:#fff;}
.sb-i.on{background:var(--sb-green);color:#fff;font-weight:600;}
.sb-i .material-symbols-rounded{font-size:19px;flex:none;}
.sb-l{flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-b{background:var(--danger);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:9px;flex:none;min-width:18px;text-align:center;}
.sb-i.on .sb-b{background:var(--sb-mint);color:var(--sb-house);}
.sb-pin{border:none;background:none;padding:0;cursor:pointer;display:none;flex:none;color:rgba(255,255,255,.4);}
.sb-pin .material-symbols-rounded{font-size:15px;}
.sb-i:hover .sb-pin{display:block;}
.sb-pin.on{display:block;color:var(--gold);}
.sb-pin:hover{color:#fff;}

.sb-foot{border-top:1px solid rgba(255,255,255,.1);padding:10px 12px;}
.sb-me{display:flex;align-items:center;gap:8px;}
.sb-av{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;color:#fff;flex:none;}
.sb-mi{min-width:0;}
.sb-mn{font-size:12.5px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sb-mr{font-size:10.5px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

#sb-scrim{display:none;}

/* ── 본문 ── */
#mn-wrap{flex:1;min-width:0;display:flex;flex-direction:column;}
#tb{height:var(--hd-h);background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:0 18px;position:sticky;top:0;z-index:40;}
.tb-menu{display:none;border:none;background:none;cursor:pointer;color:var(--ink);padding:4px;}
.tb-crumb{display:flex;align-items:center;gap:4px;flex:1;min-width:0;}
.tb-g{font-size:12.5px;color:var(--ink-3);}
.tb-sep{font-size:16px;color:var(--ink-3);}
.tb-p{font-size:14.5px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tb-right{display:flex;align-items:center;gap:6px;}
.tb-ic{position:relative;color:var(--ink-2);text-decoration:none;display:flex;padding:6px;border-radius:8px;}
.tb-ic:hover{background:var(--sb-mint-2);}
.tb-dot{position:absolute;top:1px;right:0;background:var(--danger);color:#fff;font-size:9px;font-weight:700;padding:0 4px;border-radius:8px;min-width:15px;text-align:center;}

#mn{flex:1;padding:20px;}
#mtab{display:none;}

/* ── 태블릿: 사이드바 좁게 ── */
@media(max-width:1100px){
  :root{--sb-w:190px;}
}

/* ── 모바일/세로: 드로어 + 하단탭 ── */
@media(max-width:768px){
  #sb{position:fixed;left:0;top:0;transform:translateX(-100%);transition:transform .22s ease;box-shadow:var(--shadow-md);width:264px;}
  #app.drawer #sb{transform:translateX(0);}
  #app.drawer #sb-scrim{display:block;position:fixed;inset:0;background:rgba(30,57,50,.45);z-index:55;}
  .sb-close{display:block;}
  .tb-menu{display:block;}
  .sb-pin{display:block;}
  #mn{padding:14px 12px calc(var(--tab-h) + 14px);}
  #tb{padding:0 12px;}

  #mtab{display:flex;position:fixed;bottom:0;left:0;right:0;height:var(--tab-h);background:var(--surface);border-top:1px solid var(--line);z-index:50;padding-bottom:env(safe-area-inset-bottom);}
  .mt-i{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-decoration:none;border:none;background:none;cursor:pointer;color:var(--ink-3);font-family:inherit;padding:0;}
  .mt-i.on{color:var(--sb-green);}
  .mt-w{position:relative;display:flex;}
  .mt-w .material-symbols-rounded{font-size:22px;}
  .mt-b{position:absolute;top:-3px;right:-7px;background:var(--danger);color:#fff;font-size:9px;font-weight:700;padding:0 4px;border-radius:8px;min-width:15px;text-align:center;line-height:14px;}
  .mt-l{font-size:10px;font-weight:600;}
}
`;
  document.head.appendChild(st);
}
