/* ═══════════════════════════════════════════════
   listcache.js — 📉 v137 «명단»을 같은 탭에서 잠깐 기억
   예전: 화면을 옮길 때마다 교직원 명단(약 40) · 휴일(해마다 60쯤 늘어남)을 처음부터 다시 받았다
   이제: 한 번 받은 명단을 이 탭(sessionStorage)에 몇 분만 기억 — 그사이 다른 화면은 서버에 묻지 않는다

   지키는 것
   · 처음 받을 때는 예전과 똑같이 서버에서 받은 결과를 그대로 돌려준다 (화면 코드는 바뀌는 것 없음)
   · 로그인한 사람이 바뀌면 쓰지 않음 · 탭을 닫으면 사라짐 · 로그아웃하면 지움
   · 고치는 곳(명단을 바꾸는 저장)은 저장 직후 dropLists('staff') 처럼 버린다 → 다음 화면은 새로 받음
   · 서버에 닿지 못한 결과(빈 목록 · 기기에 남은 것)는 기억하지 않는다
   · Firestore 시각(Timestamp)은 그대로 되살린다 — 모르는 모양의 칸이 있으면 아예 기억하지 않는다
   ═══════════════════════════════════════════════ */
import { collection, doc, getDocs, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
/* 이름 규칙: 컬렉션 전체 = 'staff' · 'holidays' / 조건이 붙은 목록 = 'students@daniel' 처럼 «컬렉션@구분»
   dropLists('students') 는 'students' 와 'students@…' 를 함께 버린다 */

const PFX = 'lc137:';
const MAX_CHARS = 1500000;          // 1.5MB 넘는 명단은 기억하지 않음 (탭 저장 공간 보호)
/* 🔒 탭에 남기지 않는 칸 — 기억에서 돌려줄 때는 이 칸이 없다 (이런 칸이 필요한 화면은 cachedCol 을 쓰지 않고 늘 새로 받는다)
   · 교직원: 서명 · 계좌 · 연락처 · 주소 · 알림 토큰 · 알림 설정 (v133 «가벼운 사본»과 같은 생각)
   · 학생: 정해 둔 칸만 남긴다 (홈 «오늘의 출결»에 쓰는 이름 · 반 · 학년 · 재학/휴학) — 보호자 연락처 · 주소 · 메모 · 가입 코드는 남기지 않음 */
const OMIT = {
  staff: ['signature', 'bankName', 'bankAccount', 'bankHolder', 'payBank', 'phone', 'email', 'address', 'fcmTokens', 'fcmDevices', 'notifyPrefs', 'notifyPrefsV'],
};
const KEEP = {
  students: ['name', 'org', 'status', 'leaves', 'deleted', 'grade', 'className', 'classId', 'gender', 'studentNo', 'isTest'],
};
function slim(col, d){
  const keep = KEEP[col], omit = OMIT[col];
  if(keep){ const o = {}; keep.forEach(k => { if(k in d) o[k] = d[k]; }); return o; }
  if(omit){ const o = Object.assign({}, d); omit.forEach(k => { delete o[k]; }); return o; }
  return d;
}

/* 칸 하나를 글자로 담을 수 있는 모양으로 — 시각은 {__ts:[초, 나노초]} · 모르는 물건이 있으면 throw */
function enc(v){
  if(v === null || typeof v !== 'object') return v;
  if(v instanceof Timestamp) return { __ts: [v.seconds, v.nanoseconds] };
  if(Array.isArray(v)) return v.map(enc);
  const p = Object.getPrototypeOf(v);
  if(p !== Object.prototype && p !== null) throw new Error('lc:unknown');   // 문서 참조 · 좌표 · 바이트 등 — 기억하지 않음
  const o = {};
  for(const k of Object.keys(v)) o[k] = enc(v[k]);
  return o;
}
function dec(v){
  if(v === null || typeof v !== 'object') return v;
  if(Array.isArray(v)) return v.map(dec);
  if(Array.isArray(v.__ts) && Object.keys(v).length === 1) return new Timestamp(v.__ts[0], v.__ts[1]);
  const o = {};
  for(const k of Object.keys(v)) o[k] = dec(v[k]);
  return o;
}

function readHit(name, uid, ms){
  try{
    const c = JSON.parse(sessionStorage.getItem(PFX + name) || 'null');
    if(!c || !uid || c.uid !== uid || !Array.isArray(c.rows) || !c.rows.length) return null;
    if(Date.now() - (c.at || 0) > ms || (c.at || 0) > Date.now() + 60000) return null;
    return c;
  }catch(e){ return null; }
}
function putHit(name, uid, snap){
  try{
    if(!uid || !snap || !snap.docs || !snap.docs.length) return;
    if(snap.metadata && snap.metadata.fromCache) return;            // 서버에 닿지 못해 이 기기 것만 돌려준 결과
    const col = String(name).split('@')[0];
    const rows = snap.docs.map(d => [d.id, enc(slim(col, d.data() || {}))]);
    const s = JSON.stringify({ uid, at: Date.now(), rows });
    if(s.length > MAX_CHARS){ sessionStorage.removeItem(PFX + name); return; }
    sessionStorage.setItem(PFX + name, s);
  }catch(e){ try{ sessionStorage.removeItem(PFX + name); }catch(_){} }
}
/* 기억해 둔 명단 → Firestore 결과처럼 (docs · forEach · size · empty · d.id · d.data() · d.ref) */
function snapOf(db, name, c){
  const docs = c.rows.map(([id, raw]) => ({
    id, ref: doc(db, name, id), exists: () => true,
    data: () => dec(raw),                                            // 부를 때마다 새것 (화면이 고쳐 써도 기억은 그대로)
    get: f => { const d = dec(raw); return String(f).split('.').reduce((o, k) => (o == null ? undefined : o[k]), d); },
  }));
  return { docs, size: docs.length, empty: !docs.length, forEach: (fn, t) => docs.forEach(fn, t),
           metadata: { fromCache: true, hasPendingWrites: false, fromListCache: true }, __lc: c.at };
}

/* 컬렉션 전체 (기억이 있으면 그것 · 없으면 서버에서 받아 기억)
   opts: { uid: 지금 로그인한 사람 (없으면 기억하지 않음) · ms: 얼마나 기억할지 (기본 5분) · fresh: true면 늘 서버에서 } */
export async function cachedCol(db, name, opts = {}){
  const uid = opts.uid || '', ms = opts.ms || 5 * 60000;
  if(!opts.fresh){
    const hit = readHit(name, uid, ms);
    if(hit){ try{ return snapOf(db, name, hit); }catch(e){} }
  }
  const snap = await getDocs(collection(db, name));
  putHit(name, uid, snap);
  return snap;
}

/* 조건이 붙은 목록 (예: 한 기관의 학생) — key: 'students@daniel' · makeQuery: () => query(...) */
export async function cachedQuery(db, key, makeQuery, opts = {}){
  const uid = opts.uid || '', ms = opts.ms || 5 * 60000, col = String(key).split('@')[0];
  if(!opts.fresh){
    const hit = readHit(key, uid, ms);
    if(hit){ try{ return snapOf(db, col, hit); }catch(e){} }
  }
  const snap = await getDocs(makeQuery());
  putHit(key, uid, snap);
  return snap;
}

/* 기억 버리기 — dropLists('staff') · dropLists('staff','holidays') · dropLists() = 모두
   ('students' 는 'students@…' 까지 함께) */
const EXTRA = { holidays: ['hw120:sd'] };   // 홈 «오늘 수업일» 기억(v120)도 휴일이 바뀌면 함께
export function dropLists(...names){
  try{
    (names.length ? names : Object.keys(EXTRA)).forEach(n => (EXTRA[n] || []).forEach(k => sessionStorage.removeItem(k)));
    const ks = []; for(let i = 0; i < sessionStorage.length; i++){ const k = sessionStorage.key(i); if(k && k.startsWith(PFX)) ks.push(k); }
    ks.forEach(k => {
      const n = k.slice(PFX.length);
      if(!names.length || names.some(x => n === x || n.startsWith(x + '@'))) sessionStorage.removeItem(k);
    });
  }catch(e){}
}
try{ window.dropLists = dropLists; }catch(e){}
