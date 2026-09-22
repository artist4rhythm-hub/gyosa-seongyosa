/* ═══════════════════════════════════════════════════════════
   🤝 union.js — 연합 (두 기관 함께 보기)
   · 평소엔 잠김: 모든 화면이 «주 소속» 한 기관만 본다 (org-core 관문)
   · 로고를 3번 누르면 코드 창이 열리고, 권한자가 코드를 맞히면 이 탭에서만 열린다
   · 탭을 닫으면 자동 잠김 (sessionStorage)
   저장: systemConfig/union { salt, hash, uids[] }  ·  기록: unionLogs
   ═══════════════════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ⛑ 페이지가 Firebase를 «먼저» 켜도록 기다린다.
   이 모듈이 먼저 Firestore를 켜면 페이지의 initializeFirestore(...)가 예외를 던지고
   부트 안전망(🛠 화면)이 떠버린다 — badges.js와 같은 대기 방식으로 맞춘다. */
function waitForApp(){
  return new Promise(resolve => {
    let tries = 0;
    const tick = () => {
      if(getApps().length) return resolve(getApp());
      if(++tries > 60) return resolve(null);      // 최대 ~9초
      setTimeout(tick, 150);
    };
    tick();
  });
}
let _fb = null;
async function fb(){
  if(_fb) return _fb;
  const app = await waitForApp();
  if(!app) return null;
  try{ _fb = { db: getFirestore(app), auth: getAuth(app) }; }catch(e){ return null; }
  return _fb;
}

const esc = s => String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
/* 🙋 로그인 계정 — 화면마다 CU가 전역에 없을 수 있으므로 직접 확인한다 */
let _me = null, _meTried = false;
function waitUser(auth){
  return new Promise(res=>{
    if(auth.currentUser) return res(auth.currentUser);
    let done = false;
    const un = onAuthStateChanged(auth, u=>{ if(u && !done){ done = true; try{ un(); }catch(e){} res(u); } });
    setTimeout(()=>{ if(!done){ done = true; res(auth.currentUser || null); } }, 7000);
  });
}
async function whoami(){
  if(_me) return _me;
  if(_meTried && !_me) _meTried = false;              // 로그인이 늦어지면 다시 시도
  const F = await fb(); if(!F) return null;
  const u = await waitUser(F.auth); if(!u) return null;
  _meTried = true;
  try{
    const s = await getDoc(doc(F.db,'staff',u.uid));
    const d = s.exists() ? s.data() : {};
    _me = { uid:u.uid, name: d.name || '', role: d.role || '', isTest: !!d.isTest, cloneOf: d.cloneOf || null };
  }catch(e){ _me = { uid:u.uid, name:'', role:'' }; }
  return _me;
}
const me = () => _me;

/* ── 코드 변환 (원문을 저장하지 않는다) ── */
async function hash(code, salt){
  const buf = new TextEncoder().encode(String(salt||'') + '::' + String(code||''));
  const out = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(out)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

let _cfg = null, _cfgTried = false;
async function loadCfg(){
  if(_cfgTried) return _cfg;
  _cfgTried = true;
  const F = await fb(); if(!F){ _cfgTried = false; return null; }
  try{ const s = await getDoc(doc(F.db,'systemConfig','union'));
    _cfg = s.exists() ? s.data() : null;
  }catch(e){ _cfg = null; }        // 권한이 없으면 읽히지 않는다 = 열 수 없는 사람
  return _cfg;
}
/* 권한자인가 — 설정 문서를 읽을 수 있고 목록에 들어 있으면 */
async function canUnion(){
  const u = await whoami(); if(!u) return false;
  const pre = await loadCfg();
  const isSuper = (u.role === 'super');
  if(pre && pre.enabled === false && !isSuper) return false;
  if(isSuper) return true;
  const c = pre;
  if(c && c.enabled === false) return false;             // 관리자 화면에서 «사용 안 함»으로 꺼둔 상태
  return !!(c && Array.isArray(c.uids) && c.uids.includes(u.uid));
}
async function logUnion(result, extra){
  const u = await whoami(); if(!u) return;
  const F = await fb(); if(!F) return;
  try{ await addDoc(collection(F.db,'unionLogs'), {
    uid: u.uid, name: u.name || '', result,
    page: (location.pathname.split('/').pop()||''), at: Timestamp.now(), ...(extra||{}) }); }catch(e){}
}

/* ── 잠금 실패 지연 (같은 탭 기준) ── */
let _fails = 0, _until = 0;

/* ── 코드 창 ── */
function modal(html){
  document.querySelector('.union-ov')?.remove();
  const ov = document.createElement('div');
  ov.className = 'union-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(16,22,26,.5);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.innerHTML = `<div style="background:#fff;border-radius:16px;padding:20px;max-width:340px;width:100%;
    box-shadow:0 12px 40px rgba(16,22,26,.24);font-family:'Noto Sans KR',-apple-system,sans-serif">${html}</div>`;
  document.body.appendChild(ov);
  return ov;
}
function closeModal(){ document.querySelector('.union-ov')?.remove(); }
window.unionCloseModal = closeModal;

async function openDialog(){
  if(!(await canUnion())) return;                 // 권한 없으면 조용히 아무 일도 없음
  const wait = Math.max(0, Math.ceil((_until - Date.now())/1000));
  modal(`
    <div style="font-size:15px;font-weight:900;color:#0F241F;display:flex;align-items:center;gap:7px">🤝 연합 열기</div>
    <div style="font-size:11.8px;color:#5A6560;margin:6px 0 13px;line-height:1.75">
      코드를 입력하면 <b>이 탭에서만</b> 두 기관을 함께 볼 수 있습니다.<br>탭을 닫으면 자동으로 잠깁니다.</div>
    <input id="union-code" type="password" inputmode="numeric" autocomplete="off" placeholder="코드"
      style="width:100%;height:46px;text-align:center;letter-spacing:8px;font-size:19px;font-weight:900;
      border:1.5px solid #E3E1DA;border-radius:11px;background:#F3F1EA;font-family:inherit;color:#0F241F">
    <div id="union-msg" style="font-size:11px;color:#C0392B;font-weight:700;text-align:center;height:16px;margin-top:7px">
      ${wait?`잠시 후 다시 시도해 주세요 (${wait}초)`:''}</div>
    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:8px">
      ${(_me && _me.role==='super')?`<button onclick="unionSettings()" style="margin-right:auto;font-size:11px;font-weight:800;color:#5A6560;background:#fff;border:1.5px solid #E3E1DA;border-radius:9px;padding:7px 11px;cursor:pointer">⚙ 설정</button>`:''}
      <button onclick="unionCloseModal()" style="font-size:11.5px;font-weight:800;color:#5A6560;background:#fff;border:1.5px solid #E3E1DA;border-radius:9px;padding:8px 14px;cursor:pointer">취소</button>
      <button onclick="unionTry()" style="font-size:11.5px;font-weight:800;color:#fff;background:#6D28D9;border:0;border-radius:9px;padding:8px 16px;cursor:pointer">열기</button>
    </div>`);
  const inp = document.getElementById('union-code');
  inp?.focus();
  inp?.addEventListener('keydown', e=>{ if(e.key==='Enter') window.unionTry(); });
}
window.unionTry = async ()=>{
  const msg = document.getElementById('union-msg');
  if(Date.now() < _until){ if(msg) msg.textContent = '잠시 후 다시 시도해 주세요'; return; }
  const code = (document.getElementById('union-code')?.value||'').trim();
  if(!code){ if(msg) msg.textContent = '코드를 입력해 주세요'; return; }
  const c = await loadCfg();
  if(!c || !c.hash){ if(msg) msg.textContent = '연합 코드가 아직 설정되지 않았습니다'; return; }
  const h = await hash(code, c.salt);
  if(h !== c.hash){
    _fails++;
    if(_fails >= 3){ _until = Date.now() + 60000; _fails = 0; }
    await logUnion('fail');
    if(msg) msg.textContent = (Date.now()<_until) ? '3회 틀렸습니다 — 1분 후 다시 시도하세요' : '코드가 맞지 않습니다';
    const inp = document.getElementById('union-code'); if(inp){ inp.value=''; inp.focus(); }
    return;
  }
  _fails = 0;
  window.orgCore && orgCore.setUnion(true);
  await logUnion('open');
  closeModal();
  paintBanner();
  location.reload();                               // 모든 화면이 양기관 범위로 다시 그려진다
};
window.unionClose = async ()=>{
  window.orgCore && orgCore.setUnion(false);
  await logUnion('close');
  location.reload();
};

/* ── ⚙ 설정 (슈퍼관리자) ── */
window.unionSettings = async ()=>{
  const my = await whoami();
  if(!my || my.role!=='super') return;
  const c = await loadCfg();
  modal(`
    <div style="font-size:15px;font-weight:900;color:#0F241F">⚙ 연합 설정</div>
    <div style="font-size:11.8px;color:#5A6560;margin:6px 0 13px;line-height:1.75">
      코드는 <b>변환해서 저장</b>되며 원문은 남지 않습니다. 목록에 넣은 분만 코드 창을 열 수 있습니다.</div>
    <label style="font-size:11.5px;font-weight:800;color:#5A6560">새 코드 (4자리 이상)</label>
    <input id="us-code" type="text" inputmode="numeric" autocomplete="off" placeholder="비우면 그대로 둠"
      style="width:100%;height:40px;padding:0 11px;border:1.5px solid #E3E1DA;border-radius:9px;background:#F3F1EA;font-family:inherit;font-size:13px;margin:5px 0 11px">
    <label style="font-size:11.5px;font-weight:800;color:#5A6560">열 수 있는 사람 (uid, 줄바꿈으로 구분)</label>
    <textarea id="us-uids" rows="4" placeholder="슈퍼관리자는 항상 열 수 있습니다"
      style="width:100%;padding:9px 11px;border:1.5px solid #E3E1DA;border-radius:9px;background:#F3F1EA;font-family:inherit;font-size:12px;margin-top:5px">${esc((c&&c.uids||[]).join('\n'))}</textarea>
    <div id="us-msg" style="font-size:11px;color:#C0392B;font-weight:700;height:16px;margin-top:6px"></div>
    <div style="display:flex;gap:6px;justify-content:flex-end">
      <button onclick="unionCloseModal()" style="font-size:11.5px;font-weight:800;color:#5A6560;background:#fff;border:1.5px solid #E3E1DA;border-radius:9px;padding:8px 14px;cursor:pointer">닫기</button>
      <button onclick="unionSave()" style="font-size:11.5px;font-weight:800;color:#fff;background:#1E3932;border:0;border-radius:9px;padding:8px 16px;cursor:pointer">저장</button>
    </div>`);
};
window.unionSave = async ()=>{
  const msg = document.getElementById('us-msg');
  const code = (document.getElementById('us-code')?.value||'').trim();
  const uids = (document.getElementById('us-uids')?.value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const cur = await loadCfg();
  const data = { uids, updatedAt: Timestamp.now(), byName: (_me && _me.name) || '' };
  if(code){
    if(code.length < 4){ if(msg) msg.textContent = '코드는 4자리 이상이어야 합니다'; return; }
    const salt = Math.random().toString(36).slice(2,10);
    data.salt = salt; data.hash = await hash(code, salt);
  } else if(!cur || !cur.hash){
    if(msg) msg.textContent = '처음 설정할 때는 코드를 입력해야 합니다'; return;
  }
  try{
    const F = await fb(); if(!F) throw new Error('firebase');
    await setDoc(doc(F.db,'systemConfig','union'), data, { merge:true });
    _cfgTried = false; _cfg = null;
    closeModal();
    alert('연합 설정을 저장했습니다.');
  }catch(e){ if(msg) msg.textContent = '저장 실패 — 보안 규칙(systemConfig/union) 게시가 필요합니다'; }
};

/* ── 열린 상태 띠 ── */
function paintBanner(){
  document.getElementById('union-band')?.remove();
  if(!(window.orgCore && orgCore.unionOpen())) return;
  const b = document.createElement('div');
  b.id = 'union-band';
  b.style.cssText = `position:fixed;left:0;right:0;bottom:0;z-index:2500;
    background:linear-gradient(90deg,#4C2C86,#6D28D9);color:#fff;padding:7px 14px;
    font-family:'Noto Sans KR',sans-serif;font-size:12px;font-weight:800;
    display:flex;align-items:center;gap:9px;box-shadow:0 -2px 14px rgba(76,44,134,.3)`;
  b.innerHTML = `<span>🤝 연합 — 두 기관을 함께 보는 중</span>
    <button onclick="unionClose()" style="margin-left:auto;background:rgba(255,255,255,.22);color:#fff;
      border:0;border-radius:8px;padding:4px 12px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">잠그기</button>`;
  document.body.appendChild(b);
  document.body.style.paddingBottom = '40px';
}

/* ── 숨은 문: «교사 선교사» 글자를 3번 ──
   로고는 홈으로 가는 길이니 건드리지 않는다.
   누를 때마다 글자 배경이 한 단계씩 짙어져, 세 번째에 문이 열린다. */
let _taps = 0, _tapAt = 0, _fade = null;
/* ═══ 🗝 천국 열쇠 — 상단 바 종 옆에 사는 문 ═══
   · 로고와 «교사 선교사» 글자는 건드리지 않는다 (원래대로 홈으로 간다)
   · 세 번 누르면 열리고, 누를 때마다 열쇠가 한 단계씩 또렷해진다
   · 상단 바가 다시 그려져도 스스로 다시 붙는다 */
const KEY_ID = 'union-key';
function keyTint(el, n){
  const lv = [
    { o:'.42', bg:'transparent',               sc:'1'    },
    { o:'.75', bg:'rgba(109,40,217,.14)',      sc:'1.08' },
    { o:'1',   bg:'rgba(109,40,217,.34)',      sc:'1.16' },
  ][Math.min(n, 2)];
  el.style.opacity = lv.o;
  el.style.background = lv.bg;
  el.style.transform = `scale(${lv.sc})`;
}
function makeKey(){
  const b = document.createElement('button');
  b.id = KEY_ID;
  b.type = 'button';
  b.title = '';                                    // 이름표를 두지 않는다 (숨은 문)
  b.setAttribute('aria-label', '연합');
  b.textContent = '🗝️';
  b.style.cssText = `border:0;background:transparent;cursor:pointer;font-size:17px;line-height:1;
    padding:6px;border-radius:8px;opacity:.42;transition:opacity .18s, background .18s, transform .18s;
    display:flex;align-items:center;justify-content:center`;
  b.addEventListener('click', (ev)=>{
    ev.preventDefault(); ev.stopPropagation();
    const now = Date.now();
    _taps = (now - _tapAt < 1800) ? _taps + 1 : 1;
    _tapAt = now;
    keyTint(b, _taps);
    clearTimeout(_fade);
    if(_taps >= 3){
      _taps = 0;
      setTimeout(()=>keyTint(b, 0), 320);
      openDialog();
      return;
    }
    _fade = setTimeout(()=>{ _taps = 0; keyTint(b, 0); }, 1800);
  });
  return b;
}
function placeKey(){
  const host = document.querySelector('.tb-right');
  if(!host) return;
  const old = document.getElementById(KEY_ID);
  if(old && old.parentElement === host) return;    // 이미 제자리에 있다
  const k = makeKey();
  host.appendChild(k);                              // 종 오른쪽에 붙는다
  if(window.orgCore && orgCore.unionOpen()) keyTint(k, 2);
}
let _keyWatch = false;
function armDoor(){
  placeKey();
  if(_keyWatch) return;
  _keyWatch = true;
  // 상단 바는 배지 갱신 등으로 다시 그려진다 — 사라지면 곧바로 다시 붙인다
  try{
    new MutationObserver(()=>placeKey()).observe(document.body, { childList:true, subtree:true });
  }catch(e){
    setInterval(placeKey, 1000);
  }
}

/* 🧪 테스트 계정 표식 — 실제 선생님 화면과 절대 헷갈리지 않게 */
function paintTestBadge(me){
  document.getElementById('clone-badge')?.remove();
  if(!me || !me.isTest) return;
  const c = me.cloneOf || {};
  const b = document.createElement('div');
  b.id = 'clone-badge';
  b.style.cssText = `position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2600;
    background:linear-gradient(90deg,#C2410C,#EA580C);color:#fff;border-radius:100px;padding:5px 14px;
    font-family:'Noto Sans KR',sans-serif;font-size:12px;font-weight:800;box-shadow:0 3px 14px rgba(194,65,12,.35);
    white-space:nowrap;pointer-events:auto;cursor:default`;
  b.title = '권한 테스트용 계정입니다 — 저장·체크 같은 동작은 실제 자료에 반영되니 조심하세요';
  b.textContent = c.name ? `🧪 테스트 계정 · 지금 ${c.name}${c.position?` (${c.position})`:''} 권한으로 보는 중`
                         : '🧪 테스트 계정 · 아직 복제된 권한이 없습니다';
  document.body.appendChild(b);
}

function boot(){
  try{ paintBanner(); armDoor(); }catch(e){ console.warn('[연합] 초기화 건너뜀', e); return; }
  whoami().then(paintTestBadge).catch(()=>{});
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.addEventListener('unionchange', paintBanner);
window.Union = { open: openDialog, close: ()=>window.unionClose(), isOpen: ()=> !!(window.orgCore && orgCore.unionOpen()) };


/* ═══ 🤝 관리자 화면 패널 — admin.html 의 «연합» 탭이 여기에 붙는다 ═══ */
window.unionAdminMount = async (elId)=>{
  const el = document.getElementById(elId); if(!el) return;
  el.innerHTML = '<div style="padding:18px;color:#7C837E;font-size:13px">확인하는 중…</div>';
  const my = await whoami();
  if(!my || my.role !== 'super'){
    el.innerHTML = `<div style="padding:18px;color:#7C837E;font-size:13px">슈퍼관리자만 볼 수 있습니다.${my?'':' (로그인 확인 실패 — 새로고침해 주세요)'}</div>`; return;
  }
  el.innerHTML = '<div style="padding:18px;color:#7C837E;font-size:13px">불러오는 중…</div>';
  _cfgTried = false; _cfg = null;
  const c = await loadCfg();
  const F = await fb();
  let staff = [];
  try{ const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDocs(collection(F.db,'staff'));
    staff = snap.docs.map(d=>({uid:d.id, ...d.data()})).filter(x=>!x.deleted && x.status!=='퇴직' && !x.isTest)
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ko'));
  }catch(e){}
  let logs = [];
  try{ const { getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDocs(query(collection(F.db,'unionLogs'), orderBy('at','desc'), limit(30)));
    logs = snap.docs.map(d=>d.data());
  }catch(e){}
  const on = !(c && c.enabled === false);
  const picked = new Set((c && c.uids) || []);
  const RES = { open:['열림','#166534','#DCFCE7'], close:['잠금','#5A6560','#F2F0EB'], fail:['코드 오류','#C0392B','#FDECEA'] };
  const when = t => { try{ const d = t.toDate ? t.toDate() : new Date(t);
    const p=n=>String(n).padStart(2,'0');
    return `${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }catch(e){ return ''; } };

  el.innerHTML = `
  <div class="asc">
    <div class="acard">
      <h3 class="actitle">🤝 연합 — 두 기관 함께 보기</h3>
      <p class="adesc">평소에는 모든 화면이 <b>주 소속 기관 하나만</b> 보여줍니다.
        아래에서 켠 분이 화면 오른쪽 위 <b>🗝 열쇠를 세 번</b> 누르고 코드를 넣으면,
        <b>그 탭에서만</b> 잠금이 풀립니다. 탭을 닫으면 자동으로 잠깁니다.</p>
      <div style="display:flex;gap:9px;align-items:flex-start;background:#F7F3FE;border:1.5px solid #D6C2F7;
        border-radius:11px;padding:11px 13px;margin:10px 0 2px">
        <span style="font-size:17px;line-height:1.2">🔑</span>
        <div style="font-size:11.8px;color:#4C1D95;line-height:1.8">
          <b>열쇠는 «권한»을 주지 않습니다.</b> 두 가지가 모두 있어야 다른 기관이 보입니다 —
          ① <b>접근 권한</b>(교직원 명부의 «접근 기관», 페이지별 접근 권한)으로 <b>볼 자격</b>을 먼저 주고,
          ② <b>열쇠</b>로 그 자격을 <b>지금 드러냅니다</b>.
          그래서 다른 기관 권한이 없는 화면은 열쇠를 열어도 그대로입니다.<br>
          <span style="opacity:.85">· <b>🗝 보라</b> = 계정 소속이 두 기관 → 모든 화면에서 작동 &nbsp;·&nbsp;
          <b>⚠️ 주황</b> = 계정 소속 한 곳 → 두 기관 권한을 준 기능(예: 경비 지급 요청서 담당)에서만 작동</span></div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;background:var(--iv);border-radius:11px;padding:12px 14px;margin:12px 0">
        <div style="flex:1">
          <div style="font-size:13.5px;font-weight:900;color:var(--gd)">${on?'🔓 연합 기능 사용 중':'🔒 연합 기능 꺼둠'}</div>
          <div style="font-size:11.5px;color:var(--ts);margin-top:2px">
            ${on?'허락한 분들이 코드로 열 수 있습니다.':'아무도 열 수 없습니다 (슈퍼관리자는 예외).'}</div>
        </div>
        <button onclick="unionToggleEnabled(${on?'false':'true'})"
          style="font-size:12px;font-weight:800;border-radius:9px;padding:9px 16px;cursor:pointer;border:0;
          background:${on?'#fff':'#1E3932'};color:${on?'#5A6560':'#fff'};border:1.5px solid ${on?'#E3E1DA':'#1E3932'}">
          ${on?'끄기':'켜기'}</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <div style="font-size:12.5px;font-weight:900;color:var(--gd);margin-bottom:6px">🗝 코드</div>
          <div style="font-size:11.3px;color:var(--tl);line-height:1.7;margin-bottom:6px">
            ${c&&c.hash?`설정되어 있습니다${c.byName?` · 마지막 변경 ${esc(c.byName)}`:''}`:'<b style="color:#C0392B">아직 설정되지 않았습니다</b>'}</div>
          <input id="ua-code" type="text" inputmode="numeric" autocomplete="off" placeholder="새 코드 (4자리 이상)"
            style="width:100%;height:40px;padding:0 11px;border:1.5px solid var(--ivd);border-radius:9px;background:var(--iv);font-family:inherit;font-size:13px">
          <button onclick="unionAdminSaveCode()" style="margin-top:7px;width:100%;padding:9px;border:0;border-radius:9px;
            background:#6D28D9;color:#fff;font-weight:800;font-size:12.5px;font-family:inherit;cursor:pointer">코드 저장</button>
          <div style="font-size:10.8px;color:var(--tl);margin-top:6px;line-height:1.7">
            코드는 변환해서 저장되며 원문은 남지 않습니다. 3회 틀리면 1분간 잠깁니다.</div>
        </div>
        <div>
          <div style="font-size:12.5px;font-weight:900;color:var(--gd);margin-bottom:6px">👤 열 수 있는 사람
            <span id="ua-count" style="font-size:11px;font-weight:800;color:#6D28D9;background:#F1EBFD;border-radius:100px;padding:1px 9px;margin-left:5px"></span>
            <span id="ua-saved" style="font-size:10.8px;font-weight:700;color:#166534;margin-left:6px"></span></div>
          <div id="ua-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px"></div>
          <input id="ua-q" placeholder="이름 검색 — 눌러서 켜고 끕니다" oninput="unionFilterStaff(this.value)"
            style="width:100%;height:36px;padding:0 11px;border:1.5px solid var(--ivd);border-radius:9px;background:var(--iv);font-family:inherit;font-size:12.5px;margin-bottom:6px">
          <div id="ua-list" style="max-height:230px;overflow:auto;border:1.5px solid var(--ivd);border-radius:9px;padding:6px;background:#fff"></div>
          <div style="font-size:10.8px;color:var(--tl);margin-top:6px;line-height:1.7">
            누르면 <b>바로 저장</b>됩니다. 켜진 분은 상단 🗝 열쇠를 세 번 눌러 코드를 넣으면 두 기관을 함께 볼 수 있어요.</div>
        </div>
    </div>

    <div class="acard">
      <h3 class="actitle">📜 열람 기록 <span style="font-size:11.5px;font-weight:600;color:var(--tl)">· 최근 30건</span></h3>
      ${logs.length ? `<table class="otable" style="margin-top:8px"><tr><th>시각</th><th>사람</th><th>결과</th><th>화면</th></tr>
        ${logs.map(l=>{ const r = RES[l.result] || [l.result||'', '#5A6560', '#F2F0EB'];
          return `<tr><td>${when(l.at)}</td><td><b>${esc(l.name||'')}</b></td>
            <td><span class="sbadge" style="background:${r[2]};color:${r[1]}">${r[0]}</span></td>
            <td style="color:var(--tl);font-size:11.5px">${esc(l.page||'')}</td></tr>`; }).join('')}
        </table>` : '<p class="empty">아직 기록이 없습니다.</p>'}
    </div>
  </div>`;

  window.__uaStaff = staff; window.__uaPicked = picked;

  const nameOf = uid => (window.__uaStaff||[]).find(s=>s.uid===uid)?.name || uid.slice(0,6)+'…';
  const ORGL = { daniel:'다니엘', jihyebit:'지혜빛' };
  /* 그 사람이 «볼 자격»을 가진 기관 — 명부의 접근 기관(orgs)이 진실 */
  const orgsOfStaff = st => (st && st.role==='super') ? ['jihyebit','daniel']
    : ((st && st.orgs && st.orgs.length) ? st.orgs.slice() : (st && st.org ? [st.org] : []));
  const staffOf = uid => (window.__uaStaff||[]).find(s=>s.uid===uid);
  const orgBadges = st => orgsOfStaff(st).map(o=>
    `<span style="font-size:10px;font-weight:800;background:#E9F2EE;color:#2F5D4C;border-radius:6px;padding:1px 6px">${ORGL[o]||o}</span>`).join(' ');
  const needsPerm = st => orgsOfStaff(st).length < 2;
  const paintChips = ()=>{
    const arr = [...window.__uaPicked].filter(u=>staffOf(u));   // 명단에 없는(테스트) 계정은 칩으로 드러내지 않는다
    const cnt = document.getElementById('ua-count');
    const live = arr.filter(u=>!needsPerm(staffOf(u))).length;
    if(cnt) cnt.textContent = (arr.length && live < arr.length)
      ? `${arr.length}명 켜짐 · ${arr.length-live}명은 기능별 권한에서만`
      : `${arr.length}명 켜짐`;
    const box = document.getElementById('ua-chips'); if(!box) return;
    box.innerHTML = arr.length ? arr.map(u=>`
      <span style="display:inline-flex;align-items:center;gap:5px;background:${needsPerm(staffOf(u))?'#FFF4E5':'#F1EBFD'};
        border:1.5px solid ${needsPerm(staffOf(u))?'#F0D9A8':'#D6C2F7'};
        color:${needsPerm(staffOf(u))?'#7C4A03':'#5B21B6'};border-radius:100px;padding:3px 6px 3px 10px;font-size:11.5px;font-weight:800"
        title="${needsPerm(staffOf(u))?'계정 소속이 한 곳 — 두 기관 권한을 준 기능(예: 경비 담당)에서만 열쇠가 작동합니다':'접근 기관 두 곳 — 모든 화면에서 열쇠가 작동합니다'}">
        ${needsPerm(staffOf(u))?'⚠️':'🗝'} ${esc(nameOf(u))}
        <button onclick="unionToggleUid('${u}')" title="끄기"
          style="border:0;background:#fff;color:#7C3AED;border-radius:100px;width:17px;height:17px;
          line-height:1;cursor:pointer;font-weight:900;font-size:11px">×</button></span>`).join('')
      : '<span style="font-size:11.5px;color:#93A09A;font-weight:700">아직 아무도 켜지 않았습니다 — 아래에서 고르세요</span>';
  };
  let _saveT = null;
  window.__uaSave = ()=>{
    clearTimeout(_saveT);
    const tag = document.getElementById('ua-saved');
    if(tag) tag.textContent = '저장 중…';
    _saveT = setTimeout(async ()=>{
      const F = await fb(); if(!F) return;
      try{
        await setDoc(doc(F.db,'systemConfig','union'),
          { uids: [...window.__uaPicked], updatedAt: Timestamp.now() }, { merge:true });
        _cfgTried = false; _cfg = null;
        if(tag){ tag.textContent = '✓ 저장됨'; setTimeout(()=>{ if(tag) tag.textContent=''; }, 2200); }
      }catch(e){
        if(tag) tag.textContent = '';
        alert('저장 실패 — 보안 규칙(systemConfig/union) 게시가 필요합니다');
      }
    }, 350);
  };
  window.unionToggleUid = (uid)=>{
    window.__uaPicked.has(uid) ? window.__uaPicked.delete(uid) : window.__uaPicked.add(uid);
    paintChips(); window.unionFilterStaff(document.getElementById('ua-q')?.value || '');
    window.__uaSave();
  };
  window.unionFilterStaff = (q)=>{
    const all = window.__uaStaff || [];
    const list = all.filter(s=>!q || String(s.name||'').includes(q))
      .sort((a,b)=>(window.__uaPicked.has(b.uid)?1:0)-(window.__uaPicked.has(a.uid)?1:0)
        || String(a.name||'').localeCompare(String(b.name||''),'ko'))
      .slice(0,80);
    const box = document.getElementById('ua-list'); if(!box) return;
    box.innerHTML = list.map(s=>{
      const on = window.__uaPicked.has(s.uid);
      return `<button onclick="unionToggleUid('${s.uid}')"
        style="display:flex;width:100%;align-items:center;gap:8px;padding:7px 8px;margin-bottom:3px;cursor:pointer;
        border:1.5px solid ${on?'#D6C2F7':'transparent'};background:${on?'#F7F3FE':'transparent'};
        border-radius:9px;font-family:inherit;font-size:12.5px;font-weight:700;text-align:left">
        <span style="width:34px;height:19px;border-radius:100px;flex:none;position:relative;
          background:${on?'#6D28D9':'#D7DBD7'};transition:background .18s">
          <i style="position:absolute;top:2px;left:${on?'17px':'2px'};width:15px;height:15px;border-radius:50%;
            background:#fff;transition:left .18s;display:block"></i></span>
        <b style="color:${on?'#4C1D95':'#2A2E2B'}">${esc(s.name||'')}</b>
        <span style="color:#93A09A;font-size:10.8px;font-weight:700">${esc(s.position||s.role||'')}</span>
        <span style="display:inline-flex;gap:3px;margin-left:4px">${orgBadges(s)}</span>
        ${on && needsPerm(s) ? '<span style="margin-left:auto;font-size:10.2px;font-weight:900;color:#B45309;background:#FFF4E5;border-radius:6px;padding:1px 7px" title="계정 소속이 한 곳 — 두 기관 권한을 준 기능에서만 열쇠가 작동합니다">기능별 권한만</span>'
          : (on?'<span style="margin-left:auto;font-size:10.5px;font-weight:900;color:#6D28D9">켜짐</span>':'')}
      </button>`;
    }).join('') || '<div style="font-size:11.5px;color:#93A09A;padding:6px">검색 결과 없음</div>';
  };
  paintChips();
  window.unionFilterStaff('');
};
window.unionToggleEnabled = async (on)=>{
  const F = await fb(); if(!F) return;
  try{ await setDoc(doc(F.db,'systemConfig','union'), { enabled: !!on }, { merge:true });
    _cfgTried = false; _cfg = null;
    if(window.toast) toast(on?'연합 기능을 켰습니다':'연합 기능을 껐습니다','ok');
    window.unionAdminMount('ca-union');
  }catch(e){ alert('저장 실패 — 보안 규칙(systemConfig/union) 게시가 필요합니다'); }
};
window.unionAdminSaveCode = async ()=>{
  const code = (document.getElementById('ua-code')?.value||'').trim();
  if(code.length < 4){ alert('코드는 4자리 이상이어야 합니다'); return; }
  const F = await fb(); if(!F) return;
  const salt = Math.random().toString(36).slice(2,10);
  try{ await setDoc(doc(F.db,'systemConfig','union'),
      { salt, hash: await hash(code, salt), updatedAt: Timestamp.now(), byName: (_me && _me.name) || '' }, { merge:true });
    _cfgTried = false; _cfg = null;
    if(window.toast) toast('코드를 저장했습니다','ok'); else alert('코드를 저장했습니다');
    window.unionAdminMount('ca-union');
  }catch(e){ alert('저장 실패 — 보안 규칙(systemConfig/union) 게시가 필요합니다'); }
};

