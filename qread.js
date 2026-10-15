/* ═══════════════════════════════════════════════
   qread.js — 📉 v120 «필요한 것만 읽기» 공통 도구
   예전: 출근부·출석부 화면이 열릴 때마다 기록을 «통째로» 받아 화면에서 걸렀다
         (1년이면 학생 출결 2만 건 넘게 · 하루 무료 읽기 5만 건을 금방 넘김)
   이제: 그 사람·그 반·그 날짜(그 달)만 서버에 묻는다.

   · 같음(==) 조건 여러 개는 Firestore 기본 색인으로 된다 (따로 색인을 만들 필요 없음)
   · 혹시 «색인이 필요하다»는 답이 오면, 조금 더 넓게(하나의 조건으로) 다시 묻는다
     → 어떤 경우에도 화면은 그대로 동작하고, 통째로 받는 일은 없다
   ═══════════════════════════════════════════════ */
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* 색인이 없어서 거절된 것인지 */
export function isIndexErr(e){
  return !!e && (e.code === 'failed-precondition' || /requires an index|index/i.test(String(e.message || '')));
}

/* 여러 번 받은 결과를 하나로 (같은 문서는 한 번만) — 예전 snap 처럼 forEach · docs · size 를 쓸 수 있다 */
export function mergeSnaps(snaps){
  const seen = new Map();
  (snaps || []).forEach(sn => { if(sn) sn.forEach(d => { if(!seen.has(d.id)) seen.set(d.id, d); }); });
  const docs = [...seen.values()];
  return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) };
}

/* sd ~ ed (YYYY-MM-DD) 날짜 목록 */
export function dayList(sd, ed){
  const out = [];
  const d = new Date(sd + 'T00:00:00'), e = new Date(ed + 'T00:00:00');
  for(; d <= e && out.length < 400; d.setDate(d.getDate() + 1)) out.push(ymd(d));
  return out;
}

/* 색인 없이 돌린 적이 있으면 기억 (같은 화면에서 다시 거절당하지 않게) */
const NOIDX = new Set();
function noteFallback(tag, e){
  NOIDX.add(tag);
  try { console.warn('[qread] 넓게 다시 읽기:', tag, e && e.message); } catch(_){}
  try { window.reportAppIssue && window.reportAppIssue('index', tag + ' · ' + String(e && e.message || '').slice(0, 300)); } catch(_){}
}

/* field == value 이면서 날짜(dateField)가 sd~ed 인 문서
   1순위: field== + date in [그 기간 날짜들] (30일씩 나눠 묻기 — 기본 색인으로 됨)
   2순위(색인 없음): field== 만으로 묻고 날짜는 화면에서 거름 */
export async function eqInDays(db, colName, field, value, sd, ed, dateField = 'date'){
  const col = collection(db, colName);
  const days = dayList(sd, ed);
  const tag = colName + ':' + field + '+' + dateField;
  if(days.length <= 62 && !NOIDX.has(tag)){
    try {
      const parts = [];
      for(let i = 0; i < days.length; i += 30)
        parts.push(getDocs(query(col, where(field, '==', value), where(dateField, 'in', days.slice(i, i + 30)))));
      return mergeSnaps(await Promise.all(parts));
    } catch(e){
      if(!isIndexErr(e)) throw e;
      noteFallback(tag, e);
    }
  }
  const snap = await getDocs(query(col, where(field, '==', value)));
  return mergeSnaps([{ forEach: fn => snap.forEach(d => { const v = d.data()[dateField] || ''; if(v >= sd && v <= ed) fn(d); }) }]);
}

/* 날짜(dateField)가 sd~ed 인 모든 문서 (하나의 칸 범위 조건 — 기본 색인으로 됨) */
export async function inRange(db, colName, sd, ed, dateField = 'date'){
  return getDocs(query(collection(db, colName), where(dateField, '>=', sd), where(dateField, '<=', ed)));
}

/* 👤 출근부 — 한 사람의 sd~ed 기록 */
export function attOf(db, uid, sd, ed){ return eqInDays(db, 'attendance', 'uid', uid, sd, ed); }
/* 👥 출근부 — 모든 사람의 sd~ed 기록 */
export function attRange(db, sd, ed){ return inRange(db, 'attendance', sd, ed); }

/* 같은 화면 안에서 같은 컬렉션을 여러 번 통째로 읽을 때 — 잠깐(기본 60초) 한 번만 읽고 나눠 쓴다.
   쓰기를 한 뒤에는 colDrop(이름) 으로 버린다 */
const CC = {};
export function colOnce(db, name, ms = 60000){
  const c = CC[name];
  if(c && Date.now() - c.t < ms) return c.p;
  const p = getDocs(collection(db, name)).catch(e => { delete CC[name]; throw e; });
  CC[name] = { t: Date.now(), p };
  return p;
}
export function colDrop(name){ delete CC[name]; }
/* 질의 결과를 잠깐 나눠 쓰기 — key 로 구분 (colDrop(key) 로 버림) */
export function qOnce(key, run, ms = 60000){
  const c = CC[key];
  if(c && Date.now() - c.t < ms) return c.p;
  const p = run().catch(e => { delete CC[key]; throw e; });
  CC[key] = { t: Date.now(), p };
  return p;
}
