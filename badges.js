/* ═══════════════════════════════════════════════
   badges.js — 사이드바 뱃지 공통 계산
   ⚠️ Firebase를 직접 초기화하지 않습니다.
   각 페이지가 만든 Firebase 앱을 기다렸다가 사용합니다. (초기화 충돌 방지)

   ⚡ v74 성능 개선
   ① 컬렉션 통째로 읽기 → «나에게 해당하는 문서만» 걸러서 읽기 (where 조건)
   ② 60초 세션 캐시 — 페이지를 옮겨 다닐 때 같은 계산을 다시 하지 않음
   ※ 세는 기준(무엇을 뱃지로 치는가)은 예전과 한 글자도 다르지 않습니다.
   ═══════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

/* ── 60초 세션 캐시 ──
   페이지를 옮길 때마다 같은 질문을 서버에 다시 하지 않는다.
   쪽지를 읽거나 결재를 처리하면 refreshBadges()가 캐시를 건너뛰고 새로 센다. */
const CACHE_KEY = 'gs_badges_v1';
const CACHE_MS  = 60 * 1000;
function readCache(uid){
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if(!raw) return null;
    const c = JSON.parse(raw);
    if(!c || c.uid !== uid) return null;
    if(Date.now() - (c.at || 0) > CACHE_MS) return null;
    return c.b || null;
  } catch(e){ return null; }
}
function writeCache(uid, b){
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ uid, at: Date.now(), b })); } catch(e){}
}
function clearCache(){ try { sessionStorage.removeItem(CACHE_KEY); } catch(e){} }
window.clearBadgeCache = clearCache;

async function computeBadges(db, uid){
  const b = { message: 0, approval: 0, payreq: 0 };

  /* 내 계정 + 회계 담당자 여부를 먼저 확인 (지급 대기 집계에 필요) */
  let me = null, isPayMgr = false;
  try {
    const [s, mgr] = await Promise.all([
      getDoc(doc(db, 'staff', uid)),
      getDoc(doc(db, 'payConfig', 'managers')).catch(()=>null)
    ]);
    if(s.exists()) me = s.data();
    if(mgr && mgr.exists()) isPayMgr = (mgr.data().list || []).includes(uid);
  } catch(e){}
  if(me && me.role === 'super') isPayMgr = true;

  /* 세 가지를 «동시에» 묻는다 (예전: 하나씩 차례로) */
  const [msgR, apvR, payR] = await Promise.allSettled([
    // 안 읽은 쪽지 — 받는 사람이 나인 것만
    getDocs(query(collection(db, 'messages'), where('toUids', 'array-contains', uid))),
    // 전자결재 — 진행 중인 것만
    getDocs(query(collection(db, 'approvals'), where('status', '==', 'progress'))),
    // 경비 지급 요청서 — 결재중·지급대기인 것만
    getDocs(query(collection(db, 'payRequests'), where('status', 'in', ['approving', 'submitted'])))
  ]);

  if(msgR.status === 'fulfilled'){
    msgR.value.forEach(d => {
      const m = d.data();
      if((m.toUids || []).includes(uid) && !(m.readBy || []).includes(uid)) b.message++;
    });
  }

  if(apvR.status === 'fulfilled'){
    apvR.value.forEach(d => {
      const a = d.data();
      if(a.status !== 'progress') return;
      const line = a.line || [];
      const idx = (a.currentStep != null) ? a.currentStep
                : (a.currentIdx != null) ? a.currentIdx : 0;
      const step = line[idx];
      if(step && step.uid === uid) b.approval++;
    });
  }

  if(payR.status === 'fulfilled'){
    payR.value.forEach(d => {
      const r = d.data();
      if(r.status === 'approving' && r.chain && r.chain[r.chainIndex] && r.chain[r.chainIndex].uid === uid) b.payreq++;
      if(isPayMgr && !r.paid && r.status === 'submitted') b.payreq++;
    });
  }

  return b;
}

(async () => {
  const app = await waitForApp();
  if(!app) return;                       // 페이지에 Firebase가 없으면 조용히 종료
  let auth, db;
  try { auth = getAuth(app); db = getFirestore(app); } catch(e){ return; }

  onAuthStateChanged(auth, async (user) => {
    if(!user) return;
    // ① 캐시가 살아 있으면 곧바로 그려주고 서버에 묻지 않는다
    const cached = readCache(user.uid);
    if(cached){ window.__badges = cached; applyBadges(cached); return; }
    try {
      const b = await computeBadges(db, user.uid);
      window.__badges = b;
      writeCache(user.uid, b);
      applyBadges(b);
    } catch(e){ /* 조용히 무시 */ }
  });

  // 쪽지를 읽거나 결재를 처리한 뒤 호출 — 캐시를 버리고 새로 센다
  window.refreshBadges = async function(){
    const u = auth.currentUser;
    if(!u) return;
    clearCache();
    const b = await computeBadges(db, u.uid);
    window.__badges = b;
    writeCache(u.uid, b);
    applyBadges(b);
  };
})();
