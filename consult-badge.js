/* 📅 consult-badge.js — 사이드바 «학부모 상담» 숫자 (v149)
   · 안 읽은 상담 알림 (확인 부탁 · 변경 요청 · 답글 · 처리됨 · 확정 · 자녀 연결)
   · 학부모 상담을 열 수 있는 선생님만 묻는다 (규칙 v39 csReader 와 같은 기준) · 실패하면 0 */
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
export async function badgeFor(db, uid, me){
  if(!me || (me.acStatus || 'active') === 'quit') return 0;
  const orgs = (Array.isArray(me.orgs) && me.orgs.length) ? me.orgs : [me.org];
  const has = (k, v) => Array.isArray(me[k]) && me[k].includes(v);
  if(!(me.role === 'super' || (!has('pageDeny', 'consult') && (orgs.includes('daniel') || has('pageAllow', 'consult'))))) return 0;
  try{
    const s = await getDocs(query(collection(db, 'consultNotifs'), where('toUid', '==', uid), where('read', '==', false)));
    return s.size || 0;
  }catch(e){ return 0; }
}
