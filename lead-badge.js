/* ═══════════════════════════════════════════════
   🔒 v175 lead-badge.js — 주임 회의록 (badges.js 가 불러 씀)
   · 사이드바에 «주임 회의록»(멤버) · «공유받은 주제»(주제만 공유받음)를 보일지 확인해 이 기기에 기억 (gyosa_lead)
     — 멤버 명단(leadConfig/main)은 멤버와 수퍼관리자만 읽을 수 있어서, 못 읽으면 멤버가 아님
     — 확인은 10분에 한 번 · 주임 회의록 알림(멤버로 정함 · 공유받음)이 새로 오면 바로 다시
   · 뱃지 = 내가 담당인 주임 회의록 임무(안 끝난 것 · 멤버만) + 안 읽은 주임 회의록 알림(임무 알림 빼고)
   · 🔑 v177 멤버의 역할(r: adm 관리 · wr 작성 · mem 보기)도 함께 기억 — 도우미가 «작성자 정하기»를 관리자에게만 보여 줌
     — 역할이 바뀌었다는 알림(role)이 기억한 때보다 새로 오면 · 예전 기억에 역할이 없으면 바로 다시 확인
   ═══════════════════════════════════════════════ */
import { doc, getDoc, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const KEY = 'gyosa_lead', EVERY = 10 * 60 * 1000;
function readState(uid){
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && j.uid === uid ? j : null; } catch(e){ return null; }
}
function writeState(uid, s, r){
  try { localStorage.setItem(KEY, JSON.stringify({ uid, s, r: s === 'm' ? (r || 'mem') : '', at: Date.now() })); } catch(e){}
}
const msOf = t => { try { return t && t.toMillis ? t.toMillis() : +t || 0; } catch(e){ return 0; } };
async function check(db, uid){
  try { const c = await getDoc(doc(db, 'leadConfig', 'main')); const d = c.exists() ? c.data() : null;
    if(d && (d.uids || []).includes(uid)) return { s: 'm', r: (d.admins || []).includes(uid) ? 'adm' : (d.writers || []).includes(uid) ? 'wr' : 'mem' }; } catch(e){}
  try { const q = await getDocs(query(collection(db, 'leadShares'), where('uids', 'array-contains', uid), limit(1))); if(q.size) return { s: 's' }; } catch(e){}
  return { s: '' };
}
export async function badgeFor(db, uid, me, leadNotifs){
  leadNotifs = leadNotifs || [];
  const st = readState(uid);
  let s = st ? (st.s || '') : '', r = st ? (st.r || '') : '';
  if(me && me.role === 'super'){ s = 'm'; r = 'adm'; }
  else if(!st || Date.now() - (st.at || 0) > EVERY || (s === 'm' && !st.r) || leadNotifs.some(n => (n.kind === 'member' || n.kind === 'share') && s !== 'm' || n.kind === 'role' && msOf(n.at) > (st.at || 0))){ const c = await check(db, uid); s = c.s; r = c.r || ''; }
  if(!st || st.s !== s || (st.r || '') !== (s === 'm' ? r || 'mem' : '') || Date.now() - (st.at || 0) > EVERY) writeState(uid, s, r);
  if(!s) return 0;
  let n = leadNotifs.filter(x => x.kind !== 'task').length;
  if(s !== 'm') return n;                                      // 임무는 멤버만 (규칙 v45)
  try {
    const t = await getDocs(query(collection(db, 'leadTasks'), where('uids', 'array-contains', uid)));
    t.forEach(d => { const k = d.data(); if(!k.deleted && (k.status || 'todo') !== 'done') n++; });
  } catch(e){}
  return n;
}
