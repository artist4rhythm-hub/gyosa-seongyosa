/* ═══════════════════════════════════════════════
   badges.js — 사이드바 뱃지 공통 계산
   ⚠️ Firebase를 직접 초기화하지 않습니다.
   각 페이지가 만든 Firebase 앱을 기다렸다가 사용합니다. (초기화 충돌 방지)
   ═══════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* 페이지가 Firebase를 초기화할 때까지 대기 */
function waitForApp(){
  return new Promise(resolve => {
    let tries = 0;
    const tick = () => {
      if(getApps().length) return resolve(getApp());
      if(++tries > 60) return resolve(null);   // 최대 ~9초
      setTimeout(tick, 150);
    };
    tick();
  });
}

/* sidebar.js의 setBadges가 준비될 때까지 대기 */
function applyBadges(b){
  let tries = 0;
  const tick = () => {
    if(window.setBadges){ window.setBadges(b); return; }
    if(++tries < 40) setTimeout(tick, 150);
  };
  tick();
}

async function computeBadges(db, uid){
  const b = { message: 0, approval: 0, payreq: 0 };

  let me = null;
  try {
    const s = await getDoc(doc(db, 'staff', uid));
    if(s.exists()) me = s.data();
  } catch(e){}
  const isSuper = me && me.role === 'super';

  // 안 읽은 쪽지
  try {
    const snap = await getDocs(collection(db, 'messages'));
    snap.forEach(d => {
      const m = d.data();
      if((m.toUids || []).includes(uid) && !(m.readBy || []).includes(uid)) b.message++;
    });
  } catch(e){}

  // 전자결재: 내 차례
  try {
    const snap = await getDocs(collection(db, 'approvals'));
    snap.forEach(d => {
      const a = d.data();
      if(a.status !== 'progress') return;
      const line = a.line || [];
      const idx = (a.currentStep != null) ? a.currentStep
                : (a.currentIdx != null) ? a.currentIdx : 0;
      const step = line[idx];
      if(step && step.uid === uid) b.approval++;
    });
  } catch(e){}

  // 경비 지급 요청서: 내 결재 차례 + (회계면) 지급 대기
  try {
    let isPayMgr = isSuper;
    if(!isPayMgr){
      try {
        const mgr = await getDoc(doc(db, 'payConfig', 'managers'));
        if(mgr.exists()) isPayMgr = (mgr.data().list || []).includes(uid);
      } catch(e){}
    }
    const snap = await getDocs(collection(db, 'payRequests'));
    snap.forEach(d => {
      const r = d.data();
      if(r.status === 'approving' && r.chain && r.chain[r.chainIndex] && r.chain[r.chainIndex].uid === uid) b.payreq++;
      if(isPayMgr && !r.paid && r.status === 'submitted') b.payreq++;
    });
  } catch(e){}

  return b;
}

(async () => {
  const app = await waitForApp();
  if(!app) return;                       // 페이지에 Firebase가 없으면 조용히 종료
  let auth, db;
  try { auth = getAuth(app); db = getFirestore(app); } catch(e){ return; }

  onAuthStateChanged(auth, async (user) => {
    if(!user) return;
    try {
      const b = await computeBadges(db, user.uid);
      window.__badges = b;
      applyBadges(b);
    } catch(e){ /* 조용히 무시 */ }
  });

  window.refreshBadges = async function(){
    const u = auth.currentUser;
    if(!u) return;
    const b = await computeBadges(db, u.uid);
    window.__badges = b;
    applyBadges(b);
  };
})();
