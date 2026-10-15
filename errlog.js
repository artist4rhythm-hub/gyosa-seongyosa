/* ═══════════════════════════════════════════════
   errlog.js — 🩺 오류 알림판 (v121)
   선생님 화면에서 난 오류를 모아 수퍼관리자에게 보여 줍니다 (관리자 › 보안·기록 › 오류 알림판).
   · 같은 오류는 한 줄로 묶어 «몇 번 · 몇 명»만 셉니다 (문서 하나 = 오류 하나)
   · 한 기기에서 같은 오류는 하루 한 번만 올립니다 · 한 화면에서 최대 5가지
   · 오류 내용과 화면 이름 · 버전만 보냅니다 (입력한 자료는 보내지 않음)
   sidebar.js 가 화면을 열자마자 오류를 모아 두고(__ERRQ), 이 파일이 로그인 뒤에 올립니다.
   ═══════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, increment, arrayUnion, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const MAX_PER_PAGE = 5;
const IGNORE = [
  /ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i,
  /Failed to fetch|NetworkError|Load failed|network-request-failed|ERR_INTERNET|ERR_NETWORK|net::/i,   // 인터넷 끊김은 오류가 아님
  /The operation was aborted|AbortError/i, /Service Worker|serviceWorker/i, /QuotaExceededError/i,
  /could not reach Cloud Firestore backend|client is offline|code=unavailable/i,
];
const page = (location.pathname.split('/').pop() || 'index.html').replace(/\?.*$/, '');
let sent = 0, ready = null;
const pendingQ = [];

function hash(str){ let h = 5381; for(let i = 0; i < str.length; i++){ h = ((h << 5) + h + str.charCodeAt(i)) | 0; } return (h >>> 0).toString(36); }
const norm = m => String(m || '').replace(/\b[0-9a-f]{12,}\b/gi, '#').replace(/\d+/g, '0').replace(/\s+/g, ' ').trim().slice(0, 200);
function firstFrame(stack){
  const ln = String(stack || '').split('\n').map(s => s.trim()).find(s => /\.(js|html)/.test(s)) || '';
  return ln.replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '').slice(0, 160);
}
function today(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

async function waitApp(){
  for(let i = 0; i < 80; i++){ if(getApps().length) return getApp(); await new Promise(r => setTimeout(r, 150)); }
  return null;
}
function boot(){
  if(ready) return ready;
  ready = (async () => {
    const app = await waitApp(); if(!app) return null;
    const auth = getAuth(app), db = getFirestore(app);
    const user = await new Promise(res => { if(auth.currentUser) return res(auth.currentUser); const un = onAuthStateChanged(auth, u => { if(u){ try{ un && un(); }catch(_){} res(u); } }); setTimeout(() => res(auth.currentUser || null), 15000); });
    return user ? { db, user } : null;
  })();
  return ready;
}

async function report(item){
  try {
    const kind = item.k || 'error';
    const msg = String(item.m || '').slice(0, 380);
    if(!msg || IGNORE.some(r => r.test(msg) || r.test(String(item.s || '')))) return;
    if(sent >= MAX_PER_PAGE) return;
    const fp = hash(kind + '|' + page + '|' + norm(msg) + '|' + firstFrame(item.s));
    const dayKey = 'errlog:' + fp, tday = today();
    try { if(localStorage.getItem(dayKey) === tday) return; } catch(_){}
    sent++;
    const ctx = await boot(); if(!ctx) return;
    const me = (typeof SB_USER !== 'undefined' && SB_USER) || null;   // sidebar.js 의 로그인한 사람
    try { localStorage.setItem(dayKey, tday); } catch(_){}
    await setDoc(doc(ctx.db, 'appErrors', 'e_' + fp), {
      kind, msg, page,
      stack: String(item.s || '').split('\n').slice(0, 8).join('\n').slice(0, 1500),
      ver: String(window.__APPVER || ''),
      ua: (navigator.userAgent || '').replace(/\s*\(KHTML, like Gecko\)\s*/g, ' ').slice(0, 160),
      count: increment(1), lastAt: Timestamp.now(),
      lastUid: ctx.user.uid, lastName: String((me && me.name) || ctx.user.displayName || '').slice(0, 40),
      uids: arrayUnion(ctx.user.uid),
    }, { merge: true });
  } catch(e){ /* 오류 알림판 자체의 실패는 조용히 넘어간다 (무한 반복 방지) */ }
}

/* sidebar.js 가 모아 둔 것부터 올리고, 그 뒤로는 바로 */
function take(item){ pendingQ.push(item); setTimeout(flush, 0); }
let flushing = false;
async function flush(){
  if(flushing) return; flushing = true;
  while(pendingQ.length){ await report(pendingQ.shift()); }
  flushing = false;
}
const Q = window.__ERRQ || [];
Q.forEach(take);
window.__ERRQ = { push: take };
window.reportAppIssue = (k, m, s) => take({ k, m, s });

/* 화면에 뜬 «…실패» 알림(빨간 토스트)도 모은다 — 저장이 막힌 것을 선생님이 말하기 전에 알 수 있게 */
const seenToast = new WeakSet();
function watchToasts(){
  document.querySelectorAll('[id$="toast"], [id^="toast"], .toast').forEach(el => {
    if(seenToast.has(el)) return; seenToast.add(el);
    let last = '';
    new MutationObserver(() => {
      const t = (el.textContent || '').trim();
      const bad = /(^|\s)err(\s|$)|error|danger/.test(el.className || '') && /실패|권한|오류|insufficient|permission|denied|failed/i.test(t);
      if(bad && t !== last){ last = t; take({ k: 'toast', m: t.slice(0, 300) }); }
      if(!t) last = '';
    }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}
setInterval(watchToasts, 2500); setTimeout(watchToasts, 600);
