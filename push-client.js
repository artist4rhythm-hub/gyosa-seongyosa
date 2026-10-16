/* 🔔 발송 도우미 — 페이지에서 한 줄로 푸시를 보낸다. 설정(config/push.url)이 없으면 조용히 건너뜀.
   실패해도 본 작업(쪽지·결재·게시)에는 절대 지장을 주지 않는다. */
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _url = null;
async function serverUrl(db){
  if(_url !== null) return _url;
  try { const pc = await getDoc(doc(db,'config','push')); _url = (pc.exists() && pc.data().url) ? pc.data().url.replace(/\/$/,'') : ''; }
  catch(e){ _url = ''; }
  return _url;
}
async function post(auth, db, path, payload){
  try {
    const url = await serverUrl(db); if(!url || !auth.currentUser) return null;
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch(url + path, { method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+idToken },
      body: JSON.stringify(payload) });
    return await r.json().catch(()=>null);
  } catch(e){ return null; }
}
/* 교사에게: { uids:[…], kind:'msg'|'approval'|'approval_result'|'pay'|'board', title, body, link } */
export function notifyStaff(auth, db, p){ return post(auth, db, '/notify-staff', p); }
/* 학부모에게: { org, classKeys:[…]|null, title, body, link } */
export function notifyParents(auth, db, p){ return post(auth, db, '/notify', p); }

/* 🔔 v135 — 새 알림 서버(gyosa-daily) — 아침 브리핑 · 출결 · 내일 안내 · 수업 전 · 게시판 · 시간표 · 회의록 · 학부모 글
   화면은 «무슨 일이 있었는지»(글 번호 · 반 · 날짜)만 알리고, 받는 사람과 내용은 서버가 학교 자료를 읽어 정한다
   (다른 사람 이름으로 꾸민 알림을 막기 위해). 주소는 config/pushDaily.url — 없으면 기본 주소.
   실패해도 본 작업(글 · 출결 · 게시)에는 절대 지장을 주지 않는다. */
export const DAILY_DEFAULT = 'https://gyosa-daily-455744290312.asia-northeast3.run.app';
const RUN_APP = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.run\.app$/i;   // 로그인 열쇠를 다른 곳으로 보내지 않게
let _durl = null;
export async function dailyUrl(db){
  if(_durl !== null) return _durl;
  let u = '';
  try { const c = await getDoc(doc(db,'config','pushDaily')); u = (c.exists() && typeof c.data().url === 'string') ? c.data().url.trim().replace(/\/+$/,'') : ''; } catch(e){}
  _durl = RUN_APP.test(u) ? u : DAILY_DEFAULT;
  return _durl;
}
export function dailyUrlReset(){ _durl = null; }
export async function dailyCall(auth, db, action, payload){
  try {
    if(!auth || !auth.currentUser) return null;
    const url = await dailyUrl(db);
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch(url + '/?action=' + encodeURIComponent(action), { method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+idToken },
      body: JSON.stringify(payload || {}) });
    const j = await r.json().catch(()=>null);
    return j || { ok:false, error:'http-' + r.status };
  } catch(e){ return { ok:false, error:'network' }; }
}
/* 그 순간 알림: ev = 'board-post' {postId} · 'board-comment' {commentId} · 'timetable' {pubId} · 'mtg' {meetingId} · 'attend' {classId, date} */
export function notifyEvent(auth, db, ev, payload){ return dailyCall(auth, db, 'event', Object.assign({ ev }, payload || {})); }
