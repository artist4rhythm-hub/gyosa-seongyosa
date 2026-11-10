/* ═══════════════════════════════════════════════
   🔒 v175 lead-badge.js — 주임 회의록 (badges.js 가 불러 씀)
   · 사이드바에 «주임 회의록»(멤버) · «공유받은 주제»(주제만 공유받음)를 보일지 확인해 이 기기에 기억 (gyosa_lead)
     — 멤버 명단(leadConfig/main)은 멤버와 수퍼관리자만 읽을 수 있어서, 못 읽으면 멤버가 아님
     — 확인은 10분에 한 번 · 주임 회의록 알림(멤버로 정함 · 공유받음)이 새로 오면 바로 다시
   · 뱃지 = 내가 담당인 주임 회의록 임무(안 끝난 것 · 멤버만) + 안 읽은 주임 회의록 알림(임무 알림 빼고)
   ═══════════════════════════════════════════════ */
import { doc, getDoc, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const KEY = 'gyosa_lead', EVERY = 10 * 60 * 1000;
function readState(uid){
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && j.uid === uid ? j : null; } catch(e){ return null; }
}
function writeState(uid, s){
  try { localStorage.setItem(KEY, JSON.stringify({ uid, s, at: Date.now() })); } catch(e){}
}
async function check(db, uid){
  try { const c = await getDoc(doc(db, 'leadConfig', 'main')); if(c.exists() && (c.data().uids || []).includes(uid)) return 'm'; } catch(e){}
  try { const q = await getDocs(query(collection(db, 'leadShares'), where('uids', 'array-contains', uid), limit(1))); if(q.size) return 's'; } catch(e){}
  return '';
}
export async function badgeFor(db, uid, me, leadNotifs){
  leadNotifs = leadNotifs || [];
  const st = readState(uid);
  let s = st ? (st.s || '') : '';
  if(me && me.role === 'super') s = 'm';
  else if(!st || Date.now() - (st.at || 0) > EVERY || leadNotifs.some(n => n.kind === 'member' || n.kind === 'share') && s !== 'm') s = await check(db, uid);
  if(!st || st.s !== s || Date.now() - (st.at || 0) > EVERY) writeState(uid, s);
  if(!s) return 0;
  let n = leadNotifs.filter(x => x.kind !== 'task').length;
  if(s !== 'm') return n;                                      // 임무는 멤버만 (규칙 v45)
  try {
    const t = await getDocs(query(collection(db, 'leadTasks'), where('uids', 'array-contains', uid)));
    t.forEach(d => { const k = d.data(); if(!k.deleted && (k.status || 'todo') !== 'done') n++; });
  } catch(e){}
  return n;
}
