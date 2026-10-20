/* ═══════════════════════════════════════════════
   mysign.js — ✍️ v137 결재 서명을 «본인만 읽는 곳»으로
   예전: 서명 그림(수십~100KB)이 교직원 문서(staff/{uid}.signature)에 들어 있어
         명단을 받는 화면마다 모든 분의 서명을 내려받았고, 교직원이면 남의 서명도 볼 수 있었다.
   이제: staffSign/{uid} = { signature, at } — 보안 규칙 v32: 본인만 읽고 씀
         (결재할 때 결재란에 들어가는 것은 «내 서명»뿐이라 남의 서명을 읽을 일이 없다)

   옮기기 (본인이 홈 · 전자결재를 열 때 한 번)
   · 새 곳에 먼저 쓰고 → 써진 것을 확인한 뒤에만 예전 칸을 비운다 (어느 단계에서 멈춰도 서명은 남아 있음)
   · 보안 규칙 v32 를 아직 게시하지 않았으면 새 곳에 쓰지 못함 → 예전 칸을 그대로 쓴다 (아무것도 지우지 않음)
   ═══════════════════════════════════════════════ */
import { doc, getDoc, setDoc, updateDoc, deleteField, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* 내 서명 읽기 — { sig, where } · where: 'new' (새 곳) · 'old' (예전 칸) · 'none'
   staffData: 방금 받은 내 교직원 문서 (예전 칸 확인용) */
export async function loadMySign(db, uid, staffData){
  const old = (staffData && typeof staffData.signature === 'string') ? staffData.signature : '';
  let snap = null, ok = true;
  try{ snap = await getDoc(doc(db, 'staffSign', uid)); }catch(e){ ok = false; }     // 규칙 v32 전 — 읽기 막힘
  if(ok && snap && snap.exists()){
    const sig = String((snap.data() || {}).signature || '');
    if(old && old !== sig){                                                         // 예전 화면(옛 탭)에서 그 뒤에 새로 등록한 것 — 그쪽이 최신
      const moved = await moveMySign(db, uid, old);
      return { sig: old, where: moved ? 'new' : 'old' };
    }
    if(old) clearOld(db, uid);                                                      // 옮긴 뒤 예전 칸이 남아 있으면 비움
    return { sig, where: 'new' };
  }
  if(!ok) return { sig: old, where: old ? 'old' : 'none', rulesOld: true };
  if(old){
    const moved = await moveMySign(db, uid, old);
    return { sig: old, where: moved ? 'new' : 'old' };
  }
  return { sig: '', where: 'none' };
}

/* 예전 칸 → 새 곳 (새 곳에 써지면 예전 칸 비움) · 성공하면 true */
export async function moveMySign(db, uid, sig){
  if(!uid || !sig) return false;
  try{
    await setDoc(doc(db, 'staffSign', uid), { signature: sig, at: Timestamp.now() });
    const chk = await getDoc(doc(db, 'staffSign', uid));
    if(!chk.exists() || String((chk.data() || {}).signature || '') !== sig) return false;
  }catch(e){ return false; }
  await clearOld(db, uid);
  return true;
}
async function clearOld(db, uid){
  for(let i = 0; i < 2; i++){
    try{ await updateDoc(doc(db, 'staff', uid), { signature: deleteField() }); try{ window.dropLists && window.dropLists('staff'); }catch(e){} return true; }catch(e){}
  }
  return false;
}

/* 서명 저장 · 지우기 (sig = '' 이면 지움) — 새 곳이 막혀 있으면(규칙 v32 전) 예전 칸에 */
export async function saveMySign(db, uid, sig){
  try{
    await setDoc(doc(db, 'staffSign', uid), { signature: sig || '', at: Timestamp.now() });
    if(!(await clearOld(db, uid))){
      // 예전 칸을 비우지 못했으면 같은 값으로라도 맞춰 둔다 (다음에 열 때 «예전 칸이 더 새것»으로 잘못 보지 않게)
      try{ await updateDoc(doc(db, 'staff', uid), { signature: sig || '' }); }catch(e){}
    }
    return 'new';
  }catch(e){
    if(!/permission|insufficient/i.test(String(e && (e.code || e.message) || ''))) throw e;
    await updateDoc(doc(db, 'staff', uid), { signature: sig || '' });
    return 'old';
  }
}
