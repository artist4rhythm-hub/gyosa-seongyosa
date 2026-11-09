/* ⚡ v171 완성 시간표 기억 — 이 기기 · 계정마다 마지막으로 받은 게시본(본문 포함)을 IndexedDB 에 둔다
   · 홈(«오늘 내 시간표»)이 게시본을 받을 때 함께 담아 두면, «시간표»를 처음 열 때 기다리지 않고 바로 그린다
   · 게시본 본문은 게시한 뒤로 바뀌지 않는다 (새로 게시하면 새 문서) → 같은 id 면 다시 받을 필요가 없다
   · 계정마다 따로(u:<uid>) · 기관마다 하나씩 · 최대 3개 · 로그아웃하면 모두 지움
   · 교직원 정보는 화면을 여는 데 필요한 칸만 (연락처 · 주소 · 서명 같은 것은 담지 않는다)
   · IndexedDB 를 못 쓰거나 대답이 없는 기기(사생활 보호 창 · 오래 둔 사파리 등)에서는 이 화면 동안 꺼 두고 예전처럼 서버에서 받는다 */
const DB_NAME = 'gyosa-tt', STORE = 'kv', KEEP = 3, WAIT_MS = 1200;
const CU_KEYS = ['uid','name','role','org','orgs','primaryOrg','pageDeny','pageAllow','position','dept','acStatus','avatar','photo'];
let _open = null, OFF = false, SLOW = 0;   // 두 번 잇달아 대답이 늦으면 이 화면 동안 꺼 둔다

function openDb(){
  if(OFF) return Promise.reject(new Error('tt-cache-off'));
  if(_open) return _open;
  _open = new Promise((res, rej) => {
    try {
      if(!('indexedDB' in self)) return rej(new Error('no-idb'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { try{ r.result.createObjectStore(STORE); }catch(e){} };
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => { try{ db.close(); }catch(e){} _open = null; };
        db.onclose = () => { _open = null; };
        res(db);
      };
      r.onerror = () => rej(r.error || new Error('idb-open'));
      r.onblocked = () => rej(new Error('idb-blocked'));
    } catch(e){ rej(e); }
  });
  _open.catch(() => { _open = null; OFF = true; });
  return _open;
}
// 대답이 늦으면 기다리지 않고 서버로 · 두 번 잇달아 늦으면 이 화면 동안은 꺼 둔다 (한 번 늦은 것은 바쁜 순간일 수 있어서)
function timed(p, ms, dflt){
  let done = false;
  return Promise.race([
    p.then(v => { done = true; SLOW = 0; return v; }),
    new Promise(r => setTimeout(() => { if(!done && ++SLOW >= 2){ OFF = true; _open = null; } r(dflt); }, ms))
  ]).catch(e => { if(e && (e.name === 'InvalidStateError' || e.name === 'UnknownError')){ OFF = true; _open = null; } return dflt; });
}
const plain = v => JSON.parse(JSON.stringify(v == null ? null : v));   // Timestamp 같은 것은 {seconds, nanoseconds} 로
const orgOf = p => (p && p.org) || 'daniel';
const valid = v => (v && v.v === 1 && Array.isArray(v.pubs)) ? v : null;
const cuLite = cu => { if(!cu) return null; const o = {}; CU_KEYS.forEach(k => { if(cu[k] !== undefined) o[k] = cu[k]; }); return plain(o); };
const key = uid => 'u:' + uid;

function readRec(uid){
  return openDb().then(db => new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key(uid));
    r.onsuccess = () => res(valid(r.result));
    r.onerror = () => rej(r.error);
  }));
}
// 읽고 고쳐 쓰기를 한 번에 (두 곳에서 동시에 써도 서로 지우지 않게) — fn 이 undefined 를 돌려주면 쓰지 않는다
function update(uid, fn){
  return openDb().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite'), st = t.objectStore(STORE);
    const g = st.get(key(uid));
    g.onsuccess = () => { try { const next = fn(valid(g.result)); if(next !== undefined) st.put(next, key(uid)); } catch(e){ try{ t.abort(); }catch(_){} } };
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

/* 기억한 것 통째로 — { cu, pubs:[{…메타, snapshot}], at } | null */
export function ttGet(uid){
  if(!uid) return Promise.resolve(null);
  return timed(readRec(uid), WAIT_MS, null);
}
/* 이 게시본의 본문을 기억하고 있으면 돌려준다 (없으면 null) */
export async function ttFind(uid, pubId){
  const rec = await ttGet(uid);
  const hit = rec && rec.pubs.find(p => p.id === pubId && p.snapshot);
  return hit ? hit.snapshot : null;
}
/* 게시본(본문 포함)을 기억 — 같은 기관의 예전 것은 밀어낸다 · keepIds 를 주면 그 밖의 것은 지운다
   이미 같은 것을 기억하고 있으면 쓰지 않는다 (홈을 열 때마다 큰 본문을 다시 쓰지 않게) */
export function ttPutPub(uid, cu, pub, keepIds){
  if(!uid || !pub || !pub.id || !pub.snapshot) return Promise.resolve();
  const lite = cuLite(cu);
  let item = null;     // 본문을 JSON 으로 바꾸는 일은 정말 쓸 때만
  return timed(update(uid, rec => {
    const old = rec ? rec.pubs : [];
    const kept = Array.isArray(keepIds) ? old.filter(p => keepIds.includes(p.id)) : old;
    const same = kept.find(p => p.id === pub.id);
    const cuSame = rec && JSON.stringify(rec.cu) === JSON.stringify(lite || rec.cu);
    if(same && cuSame && kept.length === old.length && !!same.active === !!pub.active && !!same.archived === !!pub.archived) return undefined;
    if(!same) item = plain({ ...pub, __loading: undefined });
    else item = { ...same, active: !!pub.active, archived: !!pub.archived, name: pub.name || same.name };
    const pubs = [item, ...kept.filter(p => p.id !== item.id && orgOf(p) !== orgOf(item))].slice(0, KEEP);
    return { v:1, cu: lite || (rec && rec.cu) || null, pubs, at: Date.now() };
  }), 2500, null).catch(() => null);
}
/* 지금 살아 있는 게시본만 남긴다 (내려진 · 바뀐 게시본은 지움) */
export function ttKeep(uid, ids){
  if(!uid || !Array.isArray(ids)) return Promise.resolve();
  return timed(update(uid, rec => {
    if(!rec) return undefined;
    const pubs = rec.pubs.filter(p => ids.includes(p.id));
    return pubs.length === rec.pubs.length ? undefined : { ...rec, pubs };
  }), 2500, null).catch(() => null);
}
/* 로그아웃 — 이 기기에 기억한 시간표를 모두 지운다 */
export function ttClear(){
  return timed(openDb().then(db => new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).clear();
    t.oncomplete = () => res(true); t.onerror = () => rej(t.error);
  })), 2000, null).catch(() => null);
}
