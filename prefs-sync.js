/* 🎚 내 설정 따라다니기 (prefs-sync.js · v215)
   화면마다 켜고 끈 것 · 고른 보기 · 접어 둔 것(이 기기에만 남던 설정)을 «내 계정»에 함께 적어 두었다가,
   다른 기기에서 로그인해도 · 같은 컴퓨터를 다른 선생님이 쓴 뒤에도 내가 정해 둔 대로 열리게 한다.
   · 어디에: userMemos/<내 uid>.ui (본인만 읽고 씀 — 보안 규칙 그대로)
   · 무엇을: 아래 KEYS 로 시작하는 «보기 설정»만. 로그인 정보 · 알림 토큰 · 쓰던 글 · 인쇄용으로 적어 둔 글 · 캐시는 옮기지도 지우지도 않는다
   · 쓰기: «바뀐 설정만» 하나씩 합쳐 적는다 (다른 기기에서 바꾼 다른 설정을 덮지 않게) · 값이 그대로면 쓰지 않음 · 바꾸고 2.5초 뒤 한 번
   · 읽기: 화면을 열 때 한 번 (같은 탭에서는 10분에 한 번)
   · 다른 선생님이 쓰던 컴퓨터: 그분의 보기 설정을 지우고 내 것을 불러온다 (그분 것은 그분 계정에 있음). 너무 긴 값(3000자 넘음)은 옮기지 않으므로 지우지도 않는다
   sidebar.js 의 renderShell 이 로그인한 사람을 알게 되면 start(uid) 를 부른다 */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, deleteField } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const KEYS = ['tf_', 'sa_', 'tt_', 'stf_', 'ac_', 'pr_', 'ex_', 'act_', 'acc_', 'pq_', 'hm_layout', 'hm_world', 'hm_wx_place', 'gyosa_widgets', 'gyosa_quick', 'gyosa_ttw', 'gyosa_tt_open',
  'gyosa_curorg', 'gyosa_cal_sel', 'gyosa_fold_', 'gyosa_home:', 'gyosa_worder', 'gyosa_mxopen', 'gyosa_theme', 'gyosa_fs', 'famFolderOpen', 'clubadm_w2',
  'attendSticky', 'attend_scope', 'attend_org', 'attend_mscope', 'mtg_org', 'cs_org', 'nhp_pvw', 'nhp_pane', 'nhp_live_open', 'nhp_cv', 'nhp_pc', 'nhp_vmode', 'academic_cal'];
const SKIP = ['academic_cal_share', 'ac_print_', 'tt_draft'];      // 이름은 비슷하지만 설정이 아닌 것 (인쇄용으로 적어 둔 글 등)
const OWN = 'gyosa_prefs_uid', AT = 'gyosa_prefs_at', DIRTY = 'gyosa_prefs_dirty', MAXV = 3000, MAXN = 300;
const mine = k => typeof k === 'string' && /^[A-Za-z0-9_:\-]{2,80}$/.test(k) && !SKIP.some(s => k.indexOf(s) === 0) && KEYS.some(p => k.indexOf(p) === 0);
const HAD_QUERY = (() => { try{ return !!location.search; }catch(e){ return true; } })();      // 주소에 붙은 것으로 여는 화면은 새로 열지 않음
let UID = '', db = null, applying = false, pushT = 0, started = false, touched = false;
try{ ['keydown', 'pointerdown'].forEach(ev => window.addEventListener(ev, () => { touched = true; }, { capture: true, passive: true, once: true })); }catch(e){}
const P = Storage.prototype, get0 = P.getItem, set0 = P.setItem, rm0 = P.removeItem;
const LS = () => { try{ return window.localStorage; }catch(e){ return null; } };
const dirtyGet = () => { try{ const a = JSON.parse(LS().getItem(DIRTY) || '[]'); return Array.isArray(a) ? a.filter(mine) : []; }catch(e){ return []; } };
const dirtySet = a => { try{ if(a.length) set0.call(LS(), DIRTY, JSON.stringify(a.slice(0, MAXN))); else rm0.call(LS(), DIRTY); }catch(e){} };
async function push(){
  clearTimeout(pushT); pushT = 0;
  if(!UID || !db || applying) return;
  const ls = LS(); if(!ls || ls.getItem(OWN) !== UID) return;      // 이 기기의 설정이 내 것일 때만 올림
  const keys = dirtyGet(); if(!keys.length) return;
  const ui = {}; keys.forEach(k => { const v = ls.getItem(k); if(v === null) ui[k] = deleteField(); else if(typeof v === 'string' && v.length <= MAXV) ui[k] = v; });
  if(!Object.keys(ui).length){ dirtySet([]); return; }
  const at = Date.now();
  try{ await setDoc(doc(db, 'userMemos', UID), { ui, uiAt: at }, { merge: true });      // 바뀐 설정만 합쳐 적음
    dirtySet(dirtyGet().filter(k => !keys.includes(k))); set0.call(ls, AT, String(at)); }
  catch(e){ console.warn('내 설정 저장', e); }
}
function mark(k){ if(applying || !UID) return; const a = dirtyGet(); if(!a.includes(k)){ a.push(k); dirtySet(a); } clearTimeout(pushT); pushT = setTimeout(push, 2500); }
/* 서버의 내 설정을 이 기기에 — 아직 올리지 못한 내 변경은 그대로 둠. wipe: 다른 분이 쓰던 기기라 서버에 없는 보기 설정은 지움 */
function apply(ui, wipe){
  const ls = LS(); if(!ls) return false; let changed = false; applying = true; const keep = dirtyGet();
  try{
    if(wipe){ const del = []; for(let i = 0; i < ls.length; i++){ const k = ls.key(i); if(mine(k) && !(k in ui) && (ls.getItem(k) || '').length <= MAXV) del.push(k); } del.forEach(k => { rm0.call(ls, k); changed = true; }); }
    Object.keys(ui).forEach(k => { if(!mine(k) || keep.includes(k) || typeof ui[k] !== 'string' || ui[k].length > MAXV) return; if(ls.getItem(k) !== ui[k]){ set0.call(ls, k, ui[k]); changed = true; } });
  }catch(e){} finally{ applying = false; }
  return changed;
}
function hook(){
  if(window.__prefsHook) return; window.__prefsHook = 1;
  P.setItem = function(k, v){
    let was; const me = (() => { try{ return this === window.localStorage && mine(k); }catch(e){ return false; } })();
    if(me){ try{ was = get0.call(this, k); }catch(e){} }
    const r = set0.apply(this, arguments);
    if(me){ try{ if(was !== String(v)) mark(k); }catch(e){} }      // 값이 그대로면 쓰지 않음 (화면을 열 때마다 같은 값을 다시 적는 곳이 있음)
    return r; };
  P.removeItem = function(k){
    let had = false; const me = (() => { try{ return this === window.localStorage && mine(k); }catch(e){ return false; } })();
    if(me){ try{ had = get0.call(this, k) !== null; }catch(e){} }
    const r = rm0.apply(this, arguments);
    if(me && had){ try{ mark(k); }catch(e){} }
    return r; };
  window.addEventListener('pagehide', () => { if(pushT) push(); });      // 못 보냈으면 다음 화면에서 이어서 (DIRTY 가 남아 있음)
}
export async function start(uid){
  if(started || !uid) return; started = true; UID = uid;
  const ls = LS(); if(!ls) return;
  try{ db = getFirestore(getApp()); }catch(e){ return; }
  const owner = ls.getItem(OWN) || '';
  if(owner && owner !== uid) dirtySet([]);      // 다른 분이 못 올린 변경은 내 계정으로 올리지 않음
  hook();
  let fresh = false; try{ const c = JSON.parse(sessionStorage.getItem('gyosa_prefs_ck') || 'null'); fresh = !!c && c.u === uid && Date.now() - c.t < 600000; }catch(e){}
  if(owner === uid && fresh){ if(dirtyGet().length) push(); return; }      // 같은 탭에서 방금 맞춰 봄 — 지난 화면에서 못 보낸 것만 이어서
  let srv = null;
  try{ const d = await getDoc(doc(db, 'userMemos', uid)); srv = d.exists() ? d.data() : {}; }catch(e){ console.warn('내 설정 읽기', e); return; }
  try{ sessionStorage.setItem('gyosa_prefs_ck', JSON.stringify({ u: uid, t: Date.now() })); }catch(e){}
  const ui = (srv && srv.ui && typeof srv.ui === 'object') ? srv.ui : null; const sAt = Number(srv && srv.uiAt) || 0;
  let changed = false;
  if(owner !== uid){
    // 처음 쓰는 기기 · 다른 선생님이 쓰던 기기
    if(ui) changed = apply(ui, !!owner);                    // 내 설정이 있으면 그것으로 (다른 분이 쓰던 기기면 그분 보기 설정은 지움)
    else if(owner){ apply({}, true); changed = true; }      // 다른 분 설정이 남아 있는데 내 것은 아직 없음 → 기본으로
    set0.call(ls, OWN, uid); set0.call(ls, AT, String(sAt || Date.now()));
    if(!ui && !owner){                                      // 내 계정에 처음 올림 — 이 기기의 지금 설정 (짧은 값만)
      const a = []; for(let i = 0; i < ls.length && a.length < MAXN; i++){ const k = ls.key(i); if(mine(k) && (ls.getItem(k) || '').length <= MAXV) a.push(k); }
      if(a.length){ dirtySet(a); clearTimeout(pushT); pushT = setTimeout(push, 2500); }
    }
  } else {
    if(ui && sAt > (Number(ls.getItem(AT)) || 0)){ changed = apply(ui, false); set0.call(ls, AT, String(sAt)); }      // 다른 기기에서 바꾼 것이 더 새로움
    if(dirtyGet().length) push();
  }
  if(changed){
    // 이 화면은 옛 설정으로 이미 그려졌을 수 있음 → 아직 아무것도 누르지 않았으면 한 번만 새로 열고, 아니면 알려만 줌
    let once = true; try{ once = sessionStorage.getItem('gyosa_prefs_rl') === '1'; }catch(e){}
    if(!touched && !once && !HAD_QUERY && performance.now() < 9000 && !document.querySelector('input:focus,textarea:focus')){ try{ sessionStorage.setItem('gyosa_prefs_rl', '1'); location.reload(); return; }catch(e){} }
    try{ if(typeof window.toast === 'function') window.toast('내 계정의 화면 설정을 불러왔어요 — 다음 화면부터 그대로 열려요.'); }catch(e){}
  }
}
