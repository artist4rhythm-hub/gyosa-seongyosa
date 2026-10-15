/* ═══════════════════════════════════════════════
   presence.js — 접속 현황 · IP 기록 · 자동 로그아웃
   모든 페이지에 <script type="module" src="presence.js"></script>
   (sidebar.js 다음에 로드)

   Firestore
     sessions/{uid}       : 현재 접속 정보 (하트비트)
     securityConfig/main  : { idleMinutes, allowedCountries, countryMode }
     loginLogs            : 로그인·로그아웃 기록
   ═══════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, addDoc, collection, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const HEARTBEAT_MS = 60 * 1000;   // 1분마다 살아있음 표시
const IP_CACHE_KEY = 'gyosa_netinfo';

let db = null, auth = null, me = null;
let hbTimer = null, idleTimer = null, warnTimer = null;
let idleMinutes = 0;              // 0이면 자동 로그아웃 없음
let warned = false;

/* ── 페이지의 Firebase 앱을 기다림 (직접 초기화하지 않음) ── */
function waitForApp(){
  return new Promise(resolve => {
    let n = 0;
    const tick = () => {
      if(getApps().length) return resolve(getApp());
      if(++n > 60) return resolve(null);
      setTimeout(tick, 150);
    };
    tick();
  });
}

/* ── 접속 IP · 국가 조회 (세션당 1회, 캐시) ── */
async function netInfo(){
  try {
    const c = sessionStorage.getItem(IP_CACHE_KEY);
    if(c) return JSON.parse(c);
  } catch(e){}
  const info = { ip:'', country:'', countryName:'', city:'', org:'' };
  try {
    const r = await fetch('https://ipapi.co/json/', { cache:'no-store' });
    if(r.ok){
      const j = await r.json();
      info.ip = j.ip || '';
      info.country = j.country_code || j.country || '';
      info.countryName = j.country_name || '';
      info.city = j.city || '';
      info.org = j.org || '';
    }
  } catch(e){}
  // 1차 실패 시 IP만이라도
  if(!info.ip){
    try {
      const r2 = await fetch('https://api.ipify.org?format=json', { cache:'no-store' });
      if(r2.ok){ const j2 = await r2.json(); info.ip = j2.ip || ''; }
    } catch(e){}
  }
  try { sessionStorage.setItem(IP_CACHE_KEY, JSON.stringify(info)); } catch(e){}
  return info;
}

/* ── 기기 종류 ── */
function deviceLabel(){
  const ua = navigator.userAgent || '';
  const mobile = /iPhone|Android.*Mobile/i.test(ua);
  const tablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
           : /Android/i.test(ua) ? 'Android'
           : /Mac OS X/i.test(ua) ? 'Mac'
           : /Windows/i.test(ua) ? 'Windows' : '기타';
  const kind = tablet ? '태블릿' : mobile ? '휴대폰' : '컴퓨터';
  return `${os} · ${kind}`;
}

/* 현재 보고 있는 페이지 이름 */
function pageLabel(){
  const file = (location.pathname.split('/').pop() || 'index.html');
  if(window.menuAllItems){
    const hit = window.menuAllItems().find(i => (i.href||'').split('#')[0] === file);
    if(hit) return hit.label;
  }
  return file.replace('.html','') || '홈';
}

/* ── 보안 설정 로드 ── */
async function loadSecurityConfig(){
  try {
    const s = await getDoc(doc(db, 'securityConfig', 'main'));
    if(s.exists()){
      const d = s.data();
      idleMinutes = Number(d.idleMinutes || 0);
      return d;
    }
  } catch(e){}
  return {};
}

/* ── 하트비트: 내가 지금 접속 중임을 기록 ── */
async function beat(){
  if(!me) return;
  try {
    const net = await netInfo();
    await setDoc(doc(db, 'sessions', me.uid), {
      uid: me.uid,
      name: me.name || '',
      org: me.org || '',
      role: me.role || '',
      page: pageLabel(),
      device: deviceLabel(),
      ip: net.ip || '',
      country: net.country || '',
      countryName: net.countryName || '',
      city: net.city || '',
      isp: net.org || '',
      lastSeen: Timestamp.now()
    }, { merge: true });
  } catch(e){}
}

/* ── 자동 로그아웃 ── */
function resetIdle(){
  warned = false;
  const banner = document.getElementById('idle-warn');
  if(banner) banner.remove();
  clearTimeout(idleTimer); clearTimeout(warnTimer);
  if(!idleMinutes || idleMinutes <= 0) return;

  const total = idleMinutes * 60 * 1000;
  const warnAt = Math.max(total - 60 * 1000, total * 0.85);   // 1분 전 경고

  warnTimer = setTimeout(showIdleWarning, warnAt);
  idleTimer = setTimeout(() => doAutoLogout(), total);
}

function showIdleWarning(){
  if(warned) return;
  warned = true;
  const b = document.createElement('div');
  b.id = 'idle-warn';
  b.style.cssText = `position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;
    background:#1E3932;color:#fff;border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;
    box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:13.5px;font-family:inherit;max-width:92vw`;
  b.innerHTML = `
    <span>자리를 비우신 것 같아요. <b>1분 뒤 자동 로그아웃</b>됩니다.</span>
    <button id="idle-stay" style="border:none;background:#00704A;color:#fff;padding:8px 16px;border-radius:8px;
      font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">계속 사용하기</button>`;
  document.body.appendChild(b);
  const btn = document.getElementById('idle-stay');
  if(btn) btn.addEventListener('click', resetIdle);
}

async function doAutoLogout(){
  try { await recordLogout('자동 로그아웃 (무활동 ' + idleMinutes + '분)'); } catch(e){}
  try { await deleteDoc(doc(db, 'sessions', me.uid)); } catch(e){}
  try { await signOut(auth); } catch(e){}
  alert(`${idleMinutes}분 동안 사용하지 않아 자동 로그아웃되었습니다.\n다시 로그인해 주세요.`);
  location.href = 'index.html';
}

/* ── 로그아웃 기록 ── */
async function recordLogout(reason){
  if(!me) return;
  const net = await netInfo();
  try {
    await addDoc(collection(db, 'loginLogs'), {
      type: 'logout',
      uid: me.uid, name: me.name || '', org: me.org || '',
      reason: reason || '직접 로그아웃',
      ip: net.ip || '', country: net.country || '', city: net.city || '',
      device: deviceLabel(),
      at: Timestamp.now()
    });
  } catch(e){}
}

/* 다른 스크립트(로그아웃 버튼)에서 부를 수 있게 */
window.endSession = async function(reason){
  try { await recordLogout(reason || '직접 로그아웃'); } catch(e){}
  if(me){ try { await deleteDoc(doc(db, 'sessions', me.uid)); } catch(e){} }
  clearTimeout(idleTimer); clearTimeout(warnTimer); clearInterval(hbTimer);
};

/* ── 시작 ── */
(async () => {
  const app = await waitForApp();
  if(!app) return;
  try { auth = getAuth(app); db = getFirestore(app); } catch(e){ return; }

  onAuthStateChanged(auth, async (user) => {
    if(!user){
      me = null;
      clearInterval(hbTimer); clearTimeout(idleTimer); clearTimeout(warnTimer);
      return;
    }
    // 내 정보
    try {
      const s = await getDoc(doc(db, 'staff', user.uid));
      me = s.exists() ? { uid: user.uid, ...s.data() } : { uid: user.uid };
    } catch(e){ me = { uid: user.uid }; }

    const cfg = await loadSecurityConfig();

    // ── 접속 국가 제한 ──
    if(cfg.countryMode === 'on'){
      const allow = cfg.allowedCountries || [];
      const net = await netInfo();
      const cc = (net.country || '').toUpperCase();
      // 국가를 못 알아낸 경우는 통과시킴 (조회 실패로 업무가 막히면 안 되므로)
      if(cc && allow.length && !allow.includes(cc)){
        try {
          await addDoc(collection(db, 'loginLogs'), {
            type: 'blocked',
            uid: me.uid, name: me.name || '', org: me.org || '',
            reason: `허용되지 않은 국가에서 접속 (${net.countryName || cc})`,
            ip: net.ip || '', country: cc, city: net.city || '',
            device: deviceLabel(), at: Timestamp.now()
          });
        } catch(e){}
        try { await signOut(auth); } catch(e){}
        alert(`허용되지 않은 지역에서의 접속입니다.\n\n접속 국가: ${net.countryName || cc}\nIP: ${net.ip || '-'}\n\n관리자에게 문의하세요.`);
        location.href = 'index.html';
        return;
      }
    }

    // 접속 기록 시작
    beat();
    clearInterval(hbTimer);
    hbTimer = setInterval(beat, HEARTBEAT_MS);

    // 자동 로그아웃 감시
    ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(ev =>
      window.addEventListener(ev, () => { if(!warned) resetIdle(); }, { passive: true })
    );
    resetIdle();

    // 탭을 닫거나 이동할 때 세션 정리 시도
    window.addEventListener('pagehide', () => {
      try { navigator.sendBeacon && null; } catch(e){}
    });
  });
})();
