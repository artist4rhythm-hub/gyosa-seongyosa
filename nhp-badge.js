/* 📒 nhp-badge.js — 사이드바 «나학평» 숫자 (v141)
   · 지금 내 차례인 검토 칸(검토 · 최종 승인) + 안 읽은 나학평 알림(수정 요청 · 승인 · 다시 열림)
   · 다니엘 아마츠에 접근하는 선생님만 묻는다 (규칙 v35 가 그분들만 읽게 함) · 실패하면 0 */
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
export async function badgeFor(db, uid, me){
  if(!me || (me.acStatus || 'active') === 'quit') return 0;
  const orgs = (Array.isArray(me.orgs) && me.orgs.length) ? me.orgs : [me.org];
  if(!(me.role === 'super' || orgs.includes('daniel'))) return 0;
  let n = 0;
  const [a, b] = await Promise.allSettled([
    getDocs(query(collection(db, 'nhpSubjects'), where('turn', 'array-contains', uid))),
    getDocs(query(collection(db, 'nhpNotifs'), where('toUid', '==', uid), where('read', '==', false))),
  ]);
  if(a.status === 'fulfilled') a.value.forEach(d => { const s = d.data(); if((s.state === 'review' || s.state === 'final') && !s.removed) n++; });
  if(b.status === 'fulfilled') n += b.value.size;
  return n;
}
