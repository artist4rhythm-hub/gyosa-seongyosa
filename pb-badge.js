/* ═══════════════════════════════════════════════
   pb-badge.js — 사이드바 «우리 반 학부모» 숫자 (v124)
   · 내가 담임 · 부담임인 반(올해 · 없으면 작년)의 학부모 반 게시판에
     «우리 반 학부모 화면을 마지막으로 연 뒤» 늘어난 글 · 댓글 수
   · 셈은 Firestore «개수 세기»(반 하나에 글 · 댓글 두 번 = 읽기 2건) — 글을 하나하나 읽지 않는다
   · 반 목록은 30분, 숫자는 5분 동안 기억 (페이지를 옮겨 다녀도 다시 세지 않음)
   · «본 것»은 이 기기(브라우저)에 적어 둔다 — 다른 기기에서는 처음 한 번 지금까지 것을 «본 것»으로
   ═══════════════════════════════════════════════ */
import { collection, query, where, getDocs, getCountFromServer, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const CNT_KEY = uid => 'gs_pb_cnt_' + uid;
const BADGE_KEY = 'gs_pb_badge';
const readJ = (st, k, d) => { try{ return JSON.parse(st.getItem(k) || 'null') || d; }catch(e){ return d; } };
const writeJ = (st, k, v) => { try{ st.setItem(k, JSON.stringify(v)); }catch(e){} };

// 이 반 게시판의 글 · 댓글 수
export async function countKey(db, key){
  const [p, c] = await Promise.all([
    getCountFromServer(query(collection(db, 'parentPosts'), where('classKey', '==', key))).then(s => s.data().count).catch(() => null),
    getCountFromServer(query(collection(db, 'parentComments'), where('classKey', '==', key))).then(s => s.data().count).catch(() => null),
  ]);
  return { p, c };
}
// 내가 담임 · 부담임인 반의 게시판 열쇠
export async function myClassKeys(db, uid){
  const K = 'gs_pb_keys_' + uid;
  const c = readJ(sessionStorage, K, null);
  if(c && Date.now() - c.at < 30 * 60e3) return c.keys;
  const y = new Date().getFullYear();
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'classes'), where('teacherUid', '==', uid))).catch(() => null),
    getDocs(query(collection(db, 'classes'), where('deputies', 'array-contains', uid))).catch(() => null),
  ]);
  const list = [...(a ? a.docs : []), ...(b ? b.docs : [])].map(d => Object.assign({ id: d.id }, d.data())).filter(x => !x.deleted);
  const yr = list.some(x => Number(x.year) === y) ? y : y - 1;
  const keys = [...new Set(list.filter(x => Number(x.year) === yr).map(x => 'c:' + x.id))].slice(0, 10);
  writeJ(sessionStorage, K, { at: Date.now(), keys });
  return keys;
}
// 지금 수를 «본 것»으로 (우리 반 학부모 화면을 열었을 때 · 내가 쓰고 지운 뒤)
export async function rebase(db, uid, key){
  const n = await countKey(db, key);
  if(n.p == null || n.c == null) return;
  const all = readJ(localStorage, CNT_KEY(uid), {});
  all[key] = { p: n.p, c: n.c, at: Date.now() };
  writeJ(localStorage, CNT_KEY(uid), all);
  try{ sessionStorage.removeItem(BADGE_KEY); }catch(e){}
}
// 학교가 옛 반 게시글을 반편성 반으로 옮긴 때 — 그 전에 적어 둔 «본 수»는 버린다 (옮긴 글이 «새 글»로 잡히지 않게 · 30분 기억)
async function movedAt(db){
  const c = readJ(sessionStorage, 'gs_pb_mig', null);
  if(c && Date.now() - c.at < 30 * 60e3) return c.first;
  let first = 0;
  try{ const m = await getDoc(doc(db, 'parentConfig', 'mig124')); const f = m.exists() && m.data().first; first = f ? (typeof f.toMillis === 'function' ? f.toMillis() : (f.seconds || 0) * 1000) : 0; }catch(e){}
  writeJ(sessionStorage, 'gs_pb_mig', { at: Date.now(), first });
  return first;
}
export async function badgeFor(db, uid, fresh){
  if(!fresh){ const c = readJ(sessionStorage, BADGE_KEY, null); if(c && c.uid === uid && Date.now() - c.at < 5 * 60e3) return c.n; }
  const keys = await myClassKeys(db, uid);
  let n = 0;
  if(keys.length){
    const base = readJ(localStorage, CNT_KEY(uid), {});
    const moved = await movedAt(db);
    let changed = false;
    for(const k of keys){
      const cur = await countKey(db, k);
      if(cur.p == null || cur.c == null) continue;
      const b = base[k];
      if(!b || (moved && (b.at || 0) < moved)){ base[k] = { p: cur.p, c: cur.c, at: Date.now() }; changed = true; continue; }   // 처음 — 지금까지 것은 «본 것»으로
      n += Math.max(0, cur.p - b.p) + Math.max(0, cur.c - b.c);
    }
    if(changed) writeJ(localStorage, CNT_KEY(uid), base);
  }
  writeJ(sessionStorage, BADGE_KEY, { uid, at: Date.now(), n });
  return n;
}
