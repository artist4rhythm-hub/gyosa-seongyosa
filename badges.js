/* ═══════════════════════════════════════════════
   badges.js — 사이드바 뱃지 공통 계산
   ⚠️ Firebase를 직접 초기화하지 않습니다.
   각 페이지가 만든 Firebase 앱을 기다렸다가 사용합니다. (초기화 충돌 방지)

   ⚡ v74 성능 개선
   ① 컬렉션 통째로 읽기 → «나에게 해당하는 문서만» 걸러서 읽기 (where 조건)
   ② 60초 세션 캐시 — 페이지를 옮겨 다닐 때 같은 계산을 다시 하지 않음
   ※ 세는 기준(무엇을 뱃지로 치는가)은 예전과 한 글자도 다르지 않습니다.

   📉 v120 읽기 줄이기 (보안 규칙 v28과 짝)
   · 쪽지     — «내가 받은 쪽지 전부» 대신 «아직 안 읽은 쪽지만» (unread 칸)
               예전 쪽지는 처음 한 번만 전부 훑어 unread 칸을 채운다 (사람마다 한 번)
   · 전자결재 — «진행 중인 모든 문서» 대신 «지금 내 차례인 문서만» (turnUid 칸)
   · 지급 요청서 — 내 차례(turnUid) + 회계 담당자면 «지급 대기»만
   · 회의록 알림 — 안 읽은 것만
   👨‍👩‍👧 v124 우리 반 학부모 — 내 반 학부모 게시판에 «본 뒤» 늘어난 글 · 댓글 (pb-badge.js · 개수 세기 · 5분 기억)
   📒 v141 나학평 — 내 차례인 검토 칸(turn 칸) + 안 읽은 나학평 알림 (nhp-badge.js)
   ═══════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs, query, where, writeBatch, arrayUnion, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

/* 📉 v120 — 예전 쪽지(unread 칸이 없는 것)에 «안 읽음» 표시를 채운다. 사람마다 한 번만.
   받은 쪽지를 한 번 훑고, 내가 아직 안 읽은 것에만 내 이름을 넣는다 (규칙 v28: 받는 사람은 자기 이름만 넣고 뺄 수 있음) */
async function fillUnreadOnce(db, uid){
  const KEY = 'gs_unread_v120_' + uid;
  try { if(localStorage.getItem(KEY)) return; } catch(e){ return; }
  try {
    const snap = await getDocs(query(collection(db, 'messages'), where('toUids', 'array-contains', uid)));
    const need = snap.docs.filter(d => { const m = d.data(); return !Array.isArray(m.unread) && !(m.readBy || []).includes(uid); });
    for(let i = 0; i < need.length; i += 400){
      const bt = writeBatch(db);
      need.slice(i, i + 400).forEach(d => bt.update(d.ref, { unread: arrayUnion(uid) }));
      await bt.commit();
    }
    try { localStorage.setItem(KEY, String(Date.now())); } catch(e){}
  } catch(e){ /* 다음에 다시 */ }
}
window.__fillUnreadOnce = fillUnreadOnce;

async function computeBadges(db, uid){
  const b = { message: 0, approval: 0, payreq: 0, minutes: 0, err: 0, myparents: 0, nhp: 0 };

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

  await fillUnreadOnce(db, uid);

  /* 여러 가지를 «동시에» 묻는다 — 모두 «나에게 해당하는 문서만» */
  const [msgR, apvR, payR, payW, mtR, mnR] = await Promise.allSettled([
    // 안 읽은 쪽지 — 내 이름이 unread 에 있는 것만
    getDocs(query(collection(db, 'messages'), where('unread', 'array-contains', uid))),
    // 전자결재 — 지금 내 차례인 것만
    getDocs(query(collection(db, 'approvals'), where('turnUid', '==', uid))),
    // 경비 지급 요청서 — 지금 내 차례인 것만
    getDocs(query(collection(db, 'payRequests'), where('turnUid', '==', uid))),
    // (회계 담당자) 지급 대기
    isPayMgr ? getDocs(query(collection(db, 'payRequests'), where('status', '==', 'submitted'))) : Promise.resolve(null),
    // 📝 회의록 — 내가 담당인 임무 · 나에게 온 «안 읽은» 회의록 알림
    getDocs(query(collection(db, 'meetingTasks'), where('uids', 'array-contains', uid))),
    getDocs(query(collection(db, 'mtgNotifs'), where('toUid', '==', uid), where('read', '==', false)))
  ]);
  if(mtR.status === 'fulfilled') mtR.value.forEach(d => { const t = d.data(); if(!t.deleted && (t.status || 'todo') !== 'done') b.minutes++; });
  if(mnR.status === 'fulfilled') mnR.value.forEach(d => { const n = d.data(); if(!n.read && n.kind !== 'task') b.minutes++; });

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

  const seenPay = new Set();
  if(payR.status === 'fulfilled'){
    payR.value.forEach(d => {
      const r = d.data();
      if(r.status === 'approving' && r.chain && r.chain[r.chainIndex] && r.chain[r.chainIndex].uid === uid){ b.payreq++; seenPay.add(d.id); }
    });
  }
  if(payW.status === 'fulfilled' && payW.value){
    payW.value.forEach(d => {
      const r = d.data();
      if(isPayMgr && !r.paid && r.status === 'submitted' && !seenPay.has(d.id)) b.payreq++;
    });
  }

  /* 👨‍👩‍👧 v124 우리 반 학부모 — 담임 · 부담임 반 게시판의 새 글 · 댓글 */
  //    (따로 불러와서 — 그 파일이 없거나 실패해도 다른 숫자는 그대로)
  try { const m = await import('./pb-badge.js?v=124'); b.myparents = await m.badgeFor(db, uid); } catch(e){}

  /* 📒 v141 나학평 — 지금 내 차례인 검토 칸 + 안 읽은 나학평 알림 (다니엘 아마츠 선생님만 · 따로 불러와서) */
  try { const m = await import('./nhp-badge.js?v=143'); b.nhp = await m.badgeFor(db, uid, me); } catch(e){}

  /* 🩺 v121 수퍼관리자 — 오류 알림판에 새로 들어온 오류 (마지막으로 알림판을 본 뒤 · 최근 7일) */
  if(me && me.role === 'super'){
    try {
      let seen = 0; try { seen = Number(localStorage.getItem('gs_err_seen_' + uid)) || 0; } catch(e){}
      const since = Math.max(seen, Date.now() - 7*86400000);
      const es = await getDocs(query(collection(db, 'appErrors'), where('lastAt', '>', Timestamp.fromMillis(since))));
      b.err = es.size || 0;
    } catch(e){}
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
