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
