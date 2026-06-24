// ── 공통 상단 메뉴 (모든 페이지 공유) ──
// 사용법: 각 페이지에서 renderTopNav('현재페이지키', 사용자권한role) 호출
// 페이지 키: att(출근부) notice(공지) students attend calendar work message approval adm

const TOPNAV_ITEMS = [
  { key:'att',      label:'출근부',   icon:'📋', href:'index.html' },
  { key:'notice',   label:'공지',     icon:'📢', href:'index.html#notice' },
  { key:'students', label:'학생관리', icon:'🎓', href:'students.html' },
  { key:'attend',   label:'출석부',   icon:'✅', href:'attend.html' },
  { key:'calendar', label:'학사일정', icon:'📅', href:'calendar.html' },
  { key:'work',     label:'근무시간', icon:'⏱️', href:'work.html' },
  { key:'message',  label:'쪽지함',   icon:'✉️', href:'message.html' },
  { key:'approval', label:'전자결재', icon:'🗂️', href:'approval.html' },
  { key:'adm',      label:'관리자',   icon:'⚙️', href:'index.html#adm', adminOnly:true },
];

// 공통 메뉴 HTML 문자열 생성
// current: 현재 페이지 키, role: 사용자 권한 (관리자 항목 표시용)
// 같은 페이지 내 탭(att/notice/adm)은 onclick으로 showTab 호출 (index에서만 동작)
function buildTopNav(current, role){
  const isAdmin = ['super','org_admin','tab_admin'].includes(role);
  const items = TOPNAV_ITEMS.filter(it => !it.adminOnly || isAdmin);
  // 현재 페이지가 index인지 (att/notice/adm 탭이 내부에 있는지)
  const onIndex = typeof window.showTab === 'function' && document.getElementById('t-att');
  const innerKeys = ['att','notice','adm'];
  return `<nav class="topnav">${items.map(it=>{
    const on = it.key===current ? ' on' : '';
    // index 내부 탭이고, 현재 index에 있으면 onclick으로
    if(onIndex && innerKeys.includes(it.key)){
      return `<a class="topnav-btn${on}" onclick="showTab('${it.key}');return false;" style="cursor:pointer">${it.icon} ${it.label}</a>`;
    }
    return `<a class="topnav-btn${on}" href="${it.href}">${it.icon} ${it.label}</a>`;
  }).join('')}</nav>`;
}

// 공통 메뉴 CSS (한 번만 주입)
function injectTopNavStyle(){
  if(document.getElementById('topnav-style')) return;
  const css = `
    .topnav{display:flex;gap:2px;background:#16204a;padding:6px 12px;overflow-x:auto;position:sticky;top:0;z-index:20;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
    .topnav-btn{padding:9px 14px;border-radius:8px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.7);cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:all .15s;}
    .topnav-btn:hover{background:rgba(255,255,255,0.1);color:#fff;}
    .topnav-btn.on{background:#c9a84c;color:#1e2e5c;font-weight:800;}
    .topnav::-webkit-scrollbar{height:4px;}
    .topnav::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.25);border-radius:2px;}
  `;
  const st = document.createElement('style');
  st.id = 'topnav-style';
  st.textContent = css;
  document.head.appendChild(st);
}

// 페이지 최상단(헤더 바로 아래)에 메뉴 삽입
// containerId: 메뉴를 넣을 요소 id (없으면 body 최상단)
function renderTopNav(current, role, containerId){
  injectTopNavStyle();
  const html = buildTopNav(current, role);
  if(containerId && document.getElementById(containerId)){
    document.getElementById(containerId).innerHTML = html;
  } else {
    // 헤더(.ah) 바로 다음에 삽입
    const header = document.querySelector('.ah');
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const navEl = wrap.firstElementChild;
    if(header && header.parentNode){
      header.parentNode.insertBefore(navEl, header.nextSibling);
    } else {
      document.body.insertBefore(navEl, document.body.firstChild);
    }
  }
}

window.renderTopNav = renderTopNav;
