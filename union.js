/* ═══════════════════════════════════════════════════════════
   🤝 union.js — 연합 (두 기관 함께 보기)
   · 평소엔 잠김: 모든 화면이 «주 소속» 한 기관만 본다 (org-core 관문)
   · 로고를 3번 누르면 코드 창이 열리고, 권한자가 코드를 맞히면 이 탭에서만 열린다
   · 탭을 닫으면 자동 잠김 (sessionStorage)
   저장: systemConfig/union { salt, hash, uids[] }  ·  기록: unionLogs
   ═══════════════════════════════════════════════════════════ */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, collection, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const CFG = {
  apiKey: "AIzaSyCtgr79jKqkec6HwqkxYNxSubWAhfEkM7g",
  authDomain: "daniel-amatz.firebaseapp.com",
  projectId: "daniel-amatz",
  storageBucket: "daniel-amatz.firebasestorage.app",
  messagingSenderId: "455744290312",
  appId: "1:455744290312:web:3ce7e7d3e58f6f1d185bbd"
};
const app = getApps().length ? getApps()[0] : initializeApp(CFG);
const db = getFirestore(app);
const auth = getAuth(app);

const esc = s => String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const me = () => (window.CU && window.CU.uid) ? window.CU : (auth.currentUser ? { uid:auth.currentUser.uid, name:'' } : null);

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
  try{ const s = await getDoc(doc(db,'systemConfig','union'));
    _cfg = s.exists() ? s.data() : null;
  }catch(e){ _cfg = null; }        // 권한이 없으면 읽히지 않는다 = 열 수 없는 사람
  return _cfg;
}
/* 권한자인가 — 설정 문서를 읽을 수 있고 목록에 들어 있으면 */
async function canUnion(){
  const u = me(); if(!u) return false;
  if(window.CU && window.CU.role === 'super') return true;
  const c = await loadCfg();
  return !!(c && Array.isArray(c.uids) && c.uids.includes(u.uid));
}
async function logUnion(result, extra){
  const u = me(); if(!u) return;
  try{ await addDoc(collection(db,'unionLogs'), {
    uid: u.uid, name: (window.CU && window.CU.name) || '', result,
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
      ${(window.CU&&window.CU.role==='super')?`<button onclick="unionSettings()" style="margin-right:auto;font-size:11px;font-weight:800;color:#5A6560;background:#fff;border:1.5px solid #E3E1DA;border-radius:9px;padding:7px 11px;cursor:pointer">⚙ 설정</button>`:''}
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
  if(!(window.CU && window.CU.role==='super')) return;
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
  const data = { uids, updatedAt: Timestamp.now(), byName: (window.CU&&window.CU.name)||'' };
  if(code){
    if(code.length < 4){ if(msg) msg.textContent = '코드는 4자리 이상이어야 합니다'; return; }
    const salt = Math.random().toString(36).slice(2,10);
    data.salt = salt; data.hash = await hash(code, salt);
  } else if(!cur || !cur.hash){
    if(msg) msg.textContent = '처음 설정할 때는 코드를 입력해야 합니다'; return;
  }
  try{
    await setDoc(doc(db,'systemConfig','union'), data, { merge:true });
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

/* ── 숨은 문: 로고 3번 ── */
let _taps = 0, _tapAt = 0;
function armDoor(){
  const logo = document.querySelector('.sb-logo') || document.querySelector('.sb-brand');
  if(!logo || logo.dataset.unionArmed) return;
  logo.dataset.unionArmed = '1';
  logo.style.cursor = 'pointer';
  logo.addEventListener('click', ()=>{
    const now = Date.now();
    _taps = (now - _tapAt < 1500) ? _taps + 1 : 1;
    _tapAt = now;
    if(_taps >= 3){ _taps = 0; openDialog(); }
  });
}

function boot(){
  paintBanner();
  armDoor();
  // 사이드바가 나중에 그려지는 화면을 위해 잠깐 지켜본다
  let n = 0;
  const t = setInterval(()=>{ armDoor(); if(++n > 20) clearInterval(t); }, 300);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
window.addEventListener('unionchange', paintBanner);
window.Union = { open: openDialog, close: ()=>window.unionClose(), isOpen: ()=> !!(window.orgCore && orgCore.unionOpen()) };
