/* ═══════════════════════════════════════════════
   badges.js — 사이드바 뱃지 공통 계산
   모든 페이지에서 동일한 기준으로 뱃지를 계산합니다.
   사용법: <script type="module" src="badges.js"></script>
   (menu.js · sidebar.js 다음에 로드)
   ═══════════════════════════════════════════════ */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCtgr79jKqkec6HwqkxYNxSubWAhfEkM7g",
  authDomain: "daniel-amatz.firebaseapp.com",
  projectId: "daniel-amatz",
  storageBucket: "daniel-amatz.firebasestorage.app",
  messagingSenderId: "455744290312",
  appId: "1:455744290312:web:9d0ad0e8b3f3b0e0b8a0d5"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* sidebar.js의 setBadges가 준비될 때까지 기다렸다 적용 */
function applyBadges(b){
  let tries = 0;
  const tick = () => {
    if(window.setBadges){ window.setBadges(b); return; }
    if(++tries < 40) setTimeout(tick, 150);   // 최대 6초
  };
  tick();
}

async function computeBadges(uid){
  const b = { message: 0, approval: 0, payreq: 0 };

  // 내 staff 문서 (역할 확인)
  let me = null;
  try {
    const s = await getDoc(doc(db, 'staff', uid));
    if(s.exists()) me = s.data();
  } catch(e){}
  const isSuper = me && me.role === 'super';

  // ── 안 읽은 쪽지 ──
  try {
    const snap = await getDocs(collection(db, 'messages'));
    snap.forEach(d => {
      const m = d.data();
      if((m.toUids || []).includes(uid) && !(m.readBy || []).includes(uid)) b.message++;
    });
  } catch(e){}

  // ── 전자결재: 내 차례인 문서 ──
  try {
    const snap = await getDocs(collection(db, 'approvals'));
    snap.forEach(d => {
      const a = d.data();
      if(a.status !== 'progress') return;
      const line = a.line || [];
      // 필드명이 버전에 따라 다름 (currentStep / currentIdx)
      const idx = (a.currentStep != null) ? a.currentStep
                : (a.currentIdx != null) ? a.currentIdx : 0;
      const step = line[idx];
      if(step && step.uid === uid) b.approval++;
    });
  } catch(e){}

  // ── 경비 지급 요청서: 내 결재 차례 + (회계면) 지급 대기 ──
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

onAuthStateChanged(auth, async (user) => {
  if(!user) return;
  try {
    const b = await computeBadges(user.uid);
    window.__badges = b;                 // 다른 스크립트에서 참조 가능
    applyBadges(b);
  } catch(e){ /* 조용히 무시 */ }
});

/* 다른 화면에서 갱신이 필요할 때 (예: 결재 처리 후) */
window.refreshBadges = async function(){
  const u = auth.currentUser;
  if(!u) return;
  const b = await computeBadges(u.uid);
  window.__badges = b;
  applyBadges(b);
};
