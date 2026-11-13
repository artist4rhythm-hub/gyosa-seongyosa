/* ═══════════════════════════════════════════════════════════
   📊 usage.js — 사용 현황 기록 (v182)
   sidebar.js 가 교직원 화면을 만들 때 한 번 부른다 (화면 파일마다 넣지 않음).

   무엇을: 화면을 열 때마다 «어느 화면 · 무슨 기기(폰 · 패드 · 컴퓨터) · 몇 시 · 홈 화면 앱인지»,
          탭을 누르면 «화면 › 탭» 을 이 기기에 세어 두었다가
   언제:   10분에 한 번(또는 날짜가 바뀌면) 모아서 한 번에 보낸다 → 쓰기 횟수가 거의 늘지 않음
           보낼 몫은 먼저 이 기기에서 꺼낸 뒤 보냄 → 탭이 여러 개거나 화면을 옮겨도 두 번 세지 않음 (확실히 실패한 달만 다시 넣어 둠)
           화면을 떠날 때는 보내지 않음 — 남은 수는 다음에 열 때 그날 칸으로
   어디:   usage/{uid}_{YYYY-MM}
             { uid, ym, d: { '13': { n, p:{화면:수}, t:{'화면›탭':수}, dv:{phone,pad,pc}, h:{'09':수}, a } }, updatedAt }
   보기:   수퍼관리자만 (관리자 › 보안 · 기록 › 사용 현황) — 글 내용 · 입력 값은 하나도 남기지 않음
   ═══════════════════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const EVERY = 10 * 60 * 1000;          // 모아 보내는 간격
const LOCK_MS = 20 * 1000;             // 탭 여러 개가 동시에 보내지 않게
const TAB_SEL = '.tabs-sub > .tab-sub, .subtb > .subtbtn, .subtabs > .subtbtn, .tabs-main > .tab-main, .g-tabs > button, .wrap > .tabs > .tab, [role=tablist] > [role=tab], .nh-tabs > button, .cs-tabs > button';

let UID = '', DB = null, busy = false;
const bufKey = () => 'gyosa_use:' + UID;
const lockKey = () => 'gyosa_use_lock:' + UID;
const pad = n => String(n).padStart(2, '0');
function today(){ const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
/* 보관 칸 이름 — 점 · 슬래시 같은 글자는 빼고 짧게 (보관함 칸 이름으로 안전하게) */
function clean(s, n){ return String(s || '').replace(/[\u{1F300}-\u{1FAFF}←-⯿️‍]/gu, '').replace(/[.\/\[\]*`~#$]/g, '').replace(/\s+/g, ' ').trim().slice(0, n || 24); }

/* ── 기기 — 폰 · 패드 · 컴퓨터 ── */
function devOf(){
  const ua = navigator.userAgent || '';
  const touch = (navigator.maxTouchPoints || 0) > 1;
  if(/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return 'pad';
  if(/Android/.test(ua) && !/Mobile/.test(ua)) return 'pad';
  if(/iPhone|iPod|Mobile|Android/.test(ua)) return 'phone';
  const short = Math.min(screen.width || 9999, screen.height || 9999);
  if(touch && short < 600) return 'phone';
  if(touch && short < 1100 && !/Windows|Macintosh|Linux x86/.test(ua)) return 'pad';
  return 'pc';
}
function standalone(){ try{ return !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches); }catch(e){ return false; } }

/* ── 이 기기에 세어 두기 ── { days: { 'YYYY-MM-DD': { n, p, t, dv, h, a } }, last } ── */
function load(){ try{ const v = JSON.parse(localStorage.getItem(bufKey()) || 'null'); if(v && typeof v === 'object' && v.days) return v; }catch(e){} return { days:{}, last:0 }; }
function save(b){ try{ localStorage.setItem(bufKey(), JSON.stringify(b)); }catch(e){} }
function bump(fn){
  if(!UID) return;
  const b = load(); const k = today();
  const d = b.days[k] || (b.days[k] = {});
  d.n = +d.n || 0; d.a = +d.a || 0;                     // 보낸 뒤 빠진 칸은 0 · 빈 묶음으로 다시
  for(const f of ['p', 't', 'dv', 'h']) if(!d[f] || typeof d[f] !== 'object') d[f] = {};
  fn(d); save(b);
}
function addTo(map, key, by){ if(!key) return; map[key] = (map[key] || 0) + (by || 1); }

function countView(){
  const page = clean(window.__PAGEKEY || '', 20) || 'etc';
  const hr = pad(new Date().getHours());
  bump(d => { d.n++; addTo(d.p, page); addTo(d.dv, devOf()); addTo(d.h, hr); if(standalone()) d.a++; });
}
/* 탭 이름 — 탭 위 숫자(알림 · 진행률 · «새 N»)는 빼고 이름만 (숫자가 바뀔 때마다 다른 탭으로 세지 않게) */
const BADGE = '.gxe,.gxe-o,.material-symbols-rounded,[class*="badge"],[class*="cnt"],[class*="count"],.tb-n,.n,.num,.dot,small,sup,sub,em,i,b.n';
function tabLabel(el){
  let t = '';
  try{ const c = el.cloneNode(true); c.querySelectorAll(BADGE).forEach(x => x.remove()); t = c.textContent || ''; }catch(e){ t = el.textContent || ''; }
  t = clean(t, 30).replace(/\s*(새\s*)?[\d,]+\s*(%|건|명|개)?\s*$/, '').replace(/\s*\(\s*[\d,]*\s*\)\s*$/, '').trim();
  return t.slice(0, 18);
}
function countTab(el){
  const page = clean(window.__PAGEKEY || '', 20); if(!page) return;
  const lb = tabLabel(el); if(!lb) return;
  bump(d => { addTo(d.t, page + '›' + lb); });
}

/* ── 모아 보내기 ──
   · 보낼 몫을 먼저 이 기기에서 꺼낸 뒤 보낸다 → 보내는 사이 다른 탭 · 다음 화면이 같은 수를 또 보내지 않음 (두 번 세지 않음)
   · 확실히 실패한 달(권한 없음 등)만 다시 넣어 둔다. 보내는 도중 화면이 닫히면 그 몇 분 몫은 빠질 수 있음 (두 번 세는 것보다 나음)
   · 권한이 없으면(규칙 v51 게시 전) 6시간 동안은 다시 보내지 않음 */
const DENY_WAIT = 6 * 3600 * 1000;
function plus(a, b){ for(const k of Object.keys(b || {})){ const v = b[k]; if(typeof v === 'number'){ a[k] = (+a[k] || 0) + v; } else if(v && typeof v === 'object'){ if(!a[k] || typeof a[k] !== 'object') a[k] = {}; plus(a[k], v); } } return a; }
function emptyDay(d){ return !d || (!(+d.n > 0) && !(+d.a > 0) && !Object.keys(d.t || {}).length); }
function incMap(m){ const o = {}; for(const [k, v] of Object.entries(m || {})) if(+v > 0) o[k] = increment(+v); return o; }
function trim40(b){ const ks = Object.keys(b.days).sort(); while(ks.length > 40) delete b.days[ks.shift()]; }
async function flush(force){
  if(!UID || !DB || busy) return;
  const b = load();
  const keys = Object.keys(b.days).filter(k => /^\d{4}-\d\d-\d\d$/.test(k) && !emptyDay(b.days[k])).sort();
  if(!keys.length) return;
  if(!force && b.deny && Date.now() - b.deny < DENY_WAIT) return;
  const old = keys.some(k => k !== today());
  if(!force && !old && Date.now() - (b.last || 0) < EVERY) return;
  const me = Date.now() + ':' + Math.random().toString(36).slice(2, 8);
  try{
    const l = String(localStorage.getItem(lockKey()) || '');
    if(Date.now() - (+l.split(':')[0] || 0) < LOCK_MS) return;
    localStorage.setItem(lockKey(), me);
    if(localStorage.getItem(lockKey()) !== me) return;
  }catch(e){}
  busy = true;
  const snap = {};
  for(const k of keys){ snap[k] = b.days[k]; delete b.days[k]; }
  for(const k of Object.keys(b.days)) if(k < today() && emptyDay(b.days[k])) delete b.days[k];
  b.last = Date.now();
  save(b);                                               // ① 먼저 꺼내 두고
  const byYm = {};
  for(const k of keys){ const ym = k.slice(0, 7), dd = k.slice(8, 10); (byYm[ym] = byYm[ym] || {})[dd] = snap[k]; }
  const yms = Object.keys(byYm).sort();
  let i = 0;
  try{
    for(; i < yms.length; i++){
      const ym = yms[i], d = {};
      for(const [dd, x] of Object.entries(byYm[ym])){
        const o = {};
        if(+x.n > 0) o.n = increment(+x.n);
        if(+x.a > 0) o.a = increment(+x.a);
        for(const f of ['p', 't', 'dv', 'h']){ const m = incMap(x[f]); if(Object.keys(m).length) o[f] = m; }
        if(Object.keys(o).length) d[dd] = o;
      }
      if(!Object.keys(d).length) continue;
      await setDoc(doc(DB, 'usage', `${UID}_${ym}`), { uid: UID, ym, d, updatedAt: serverTimestamp() }, { merge: true });   // ② 달마다 보냄
    }
    const now = load(); if(now.deny){ delete now.deny; save(now); }
  }catch(e){
    // ③ 못 보낸 달(이번 달 포함 그 뒤)만 다시 넣어 둠 — 다음에 다시
    const now = load();
    for(let j = i; j < yms.length; j++) for(const [dd, x] of Object.entries(byYm[yms[j]])){ const k = yms[j] + '-' + dd; now.days[k] = plus(now.days[k] || {}, x); }
    if(String((e && (e.code || e.message)) || '').indexOf('permission') >= 0) now.deny = Date.now();
    trim40(now); save(now);
  }finally{
    busy = false;
    try{ if(localStorage.getItem(lockKey()) === me) localStorage.removeItem(lockKey()); }catch(e){}
  }
}

function waitApp(){
  return new Promise(res => { let n = 0; const tick = () => { if(getApps().length) return res(getApp()); if(++n > 80) return res(null); setTimeout(tick, 150); }; tick(); });
}
(async function boot(){
  if(window.__useOn) return; window.__useOn = true;
  const app = await waitApp(); if(!app) return;
  let auth; try{ auth = getAuth(app); DB = getFirestore(app); }catch(e){ return; }
  onAuthStateChanged(auth, u => {
    const was = UID;
    UID = (u && u.uid) || '';
    if(!UID || was === UID) return;
    countView();
    setTimeout(() => flush(false), 4000);
  });
  document.addEventListener('click', e => { const t = e.target && e.target.closest && e.target.closest(TAB_SEL); if(t) countTab(t); }, true);
  setInterval(() => flush(false), EVERY + 5000);
})();
window.__useFlush = force => flush(force !== false);   // 시험용
