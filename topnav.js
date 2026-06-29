// ── 공통 상단 메뉴 (모든 페이지 공유, 그룹 드롭다운) ──
// 사용법: 각 페이지에서 renderTopNav('현재페이지키', 사용자권한role[, containerId]) 호출

const TOPNAV_HOME = { key:'home', label:'홈', icon:'🏠', href:'index.html#home' };

const TOPNAV_GROUPS = [
  { id:'study', label:'학사', icon:'📚', items:[
    { key:'students', label:'학생관리', icon:'🎓', href:'students.html' },
    { key:'attend',   label:'출석부',   icon:'✅', href:'attend.html' },
    { key:'class',    label:'반편성',   icon:'🧩', href:'class.html' },
    { key:'calendar', label:'학사일정', icon:'📅', href:'calendar.html' },
  ]},
  { id:'work', label:'근무·행정', icon:'💼', items:[
    { key:'att',      label:'출근부',   icon:'📋', href:'index.html' },
    { key:'work',     label:'근무시간', icon:'⏱️', href:'work.html' },
    { key:'approval', label:'전자결재', icon:'🗂️', href:'approval.html' },
  ]},
  { id:'talk', label:'소통', icon:'💬', items:[
    { key:'notice',   label:'공지',     icon:'📢', href:'index.html#notice' },
    { key:'message',  label:'쪽지함',   icon:'✉️', href:'message.html' },
    { key:'board',    label:'게시판',   icon:'📌', href:'board.html' },
  ]},
  { id:'manage', label:'관리', icon:'⚙️', adminOnly:true, items:[
    { key:'adm',      label:'관리자',   icon:'⚙️', href:'index.html#adm' },
  ]},
];

const INNER_KEYS = ['home','att','notice','adm'];

function groupOfKey(key){
  for(const g of TOPNAV_GROUPS){ if(g.items.some(it=>it.key===key)) return g.id; }
  return null;
}

function isIndexPage(){
  return typeof window.showTab === 'function' && !!document.getElementById('c-home');
}

function navItemAttr(it){
  if(isIndexPage() && INNER_KEYS.includes(it.key)){
    return `onclick="topnavGo('${it.key}');return false;" style="cursor:pointer"`;
  }
  return `href="${it.href}"`;
}

function buildTopNav(current, role){
  const isAdmin = ['super','org_admin','tab_admin'].includes(role);
  const curGroup = groupOfKey(current);
  const homeOn = current==='home' ? ' on' : '';
  const homeAttr = (isIndexPage())
    ? `onclick="topnavGo('home');return false;" style="cursor:pointer"` : `href="${TOPNAV_HOME.href}"`;
  let html = `<nav class="topnav"><a class="topnav-grp${homeOn}" ${homeAttr}>${TOPNAV_HOME.icon} ${TOPNAV_HOME.label}</a>`;
  TOPNAV_GROUPS.forEach(g=>{
    if(g.adminOnly && !isAdmin) return;
    const items = g.items.filter(it=> it.key!=='adm' || isAdmin);
    if(!items.length) return;
    const on = g.id===curGroup ? ' on' : '';
    const menuItems = items.map(it=>{
      const itOn = it.key===current ? ' style="background:#e8ecf8;color:#2b3990;font-weight:700"' : '';
      return `<a class="topnav-item" ${navItemAttr(it)}${itOn}>${it.icon} ${it.label}</a>`;
    }).join('');
    html += `<div class="topnav-grpwrap">
      <button class="topnav-grp${on}" onclick="topnavToggle('${g.id}',event)">${g.icon} ${g.label} <span style="font-size:10px">▾</span></button>
      <div class="topnav-drop" id="drop-${g.id}">${menuItems}</div>
    </div>`;
  });
  html += `</nav>`;
  return html;
}

function injectTopNavStyle(){
  if(document.getElementById('topnav-style')) return;
  const css = `
    .topnav{display:flex;gap:4px;background:#16204a;padding:8px 12px;position:sticky;top:0;z-index:30;box-shadow:0 2px 8px rgba(0,0,0,0.15);flex-wrap:wrap;align-items:center;}
    .topnav-grp{padding:9px 13px;border-radius:9px;font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.78);cursor:pointer;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:transparent;border:none;font-family:inherit;}
    .topnav-grp:hover{background:rgba(255,255,255,0.1);color:#fff;}
    .topnav-grp.on{background:#c9a84c;color:#1e2e5c;font-weight:800;}
    .topnav-grpwrap{position:relative;display:inline-block;}
    .topnav-drop{display:none;position:absolute;top:calc(100% + 4px);left:0;background:#fff;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:6px;min-width:160px;z-index:40;}
    .topnav-drop.open{display:block;}
    .topnav-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;font-size:14px;color:#374151;text-decoration:none;white-space:nowrap;cursor:pointer;}
    .topnav-item:hover{background:#f3f4f6;}
    @media(max-width:520px){
      .topnav{gap:2px;padding:8px 8px;}
      .topnav-grp{padding:9px 10px;font-size:13px;}
      .topnav-drop{position:fixed;left:8px;right:8px;min-width:0;}
    }
  `;
  const st = document.createElement('style');
  st.id = 'topnav-style'; st.textContent = css;
  document.head.appendChild(st);
}

function topnavToggle(gid, ev){
  if(ev) ev.stopPropagation();
  const drop = document.getElementById('drop-'+gid);
  const isOpen = drop && drop.classList.contains('open');
  document.querySelectorAll('.topnav-drop').forEach(d=>d.classList.remove('open'));
  if(drop && !isOpen) drop.classList.add('open');
}
window.topnavToggle = topnavToggle;

document.addEventListener('click', e=>{
  if(!e.target.closest('.topnav-grpwrap')) {
    document.querySelectorAll('.topnav-drop').forEach(d=>d.classList.remove('open'));
  }
});

function topnavGo(key){
  document.querySelectorAll('.topnav-drop').forEach(d=>d.classList.remove('open'));
  if(typeof window.showTab==='function') window.showTab(key);
}
window.topnavGo = topnavGo;

function renderTopNav(current, role, containerId){
  injectTopNavStyle();
  const html = buildTopNav(current, role);
  if(containerId && document.getElementById(containerId)){
    document.getElementById(containerId).innerHTML = html;
  } else {
    const header = document.querySelector('.ah');
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const navEl = wrap.firstElementChild;
    const old = document.querySelector('.topnav');
    if(old){ old.replaceWith(navEl); }
    else if(header && header.parentNode){ header.parentNode.insertBefore(navEl, header.nextSibling); }
    else { document.body.insertBefore(navEl, document.body.firstChild); }
  }
}
window.renderTopNav = renderTopNav;
