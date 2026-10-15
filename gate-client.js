/* ═══════════════════════════════════════════════
   gate-client.js — 🎫 학부모 «출입 서버» 부르기 (교사 선교사 v122)
   · 학생관리에서 졸업 · 자퇴 · 휴학을 저장하거나, 반편성을 바꾸면
     그 학생 보호자들의 출입증을 바로 다시 계산해 달라고 서버에 알린다 (gateRecalc)
   · 서버 주소: parentConfig/gate 의 url — 학부모 관리 › 연결 현황에서 넣는다
   · 서버가 없거나 잠시 안 돼도 화면은 그대로 — 학부모가 다음에 들어올 때 다시 계산된다
   ═══════════════════════════════════════════════ */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let _url = null;
export async function gateUrl(fresh){
  if(_url !== null && !fresh) return _url;
  try{
    const db = getFirestore(getApp());
    const c = await getDoc(doc(db, 'parentConfig', 'gate'));
    _url = (c.exists() && typeof c.data().url === 'string') ? c.data().url.trim().replace(/\/+$/, '') : '';
  }catch(e){ _url = ''; }
  return _url;
}
export function setGateUrl(u){ _url = String(u || '').trim().replace(/\/+$/, ''); }

/* 서버 부르기 — 늘 { ok, error? , … } 를 돌려준다 (던지지 않음) */
export async function gateCall(action, body){
  const url = await gateUrl();
  if(!url) return { ok:false, error:'no-gate' };
  const user = getAuth(getApp()).currentUser; if(!user) return { ok:false, error:'auth' };
  try{
    const tok = await user.getIdToken();
    const r = await fetch(url + '/?action=' + encodeURIComponent(action), { method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + tok }, body: JSON.stringify(body || {}) });
    let j = null; try{ j = await r.json(); }catch(e){}
    return j || { ok:false, error: r.status === 401 ? 'auth' : 'server', status: r.status };
  }catch(e){ return { ok:false, error:'network' }; }
}
export async function gateHealth(u){
  const url = String(u || await gateUrl() || '').trim().replace(/\/+$/, ''); if(!url) return { ok:false, error:'no-gate' };
  try{ const r = await fetch(url + '/?action=health', { method:'GET' }); return await r.json(); }catch(e){ return { ok:false, error:'network' }; }
}

/* 학생이 바뀌었다 — 그 보호자들 출입증 다시 계산 (조용히 · 잠깐 모아서 한 번에) */
let _q = new Set(), _t = null;
export function gateRecalc(ids){
  (Array.isArray(ids) ? ids : [ids]).forEach(id => { if(id) _q.add(String(id)); });
  if(!_q.size) return;
  clearTimeout(_t);
  _t = setTimeout(async () => {
    const all = [..._q]; _q = new Set();
    for(let i = 0; i < all.length; i += 200){
      const j = await gateCall('recalc', { studentIds: all.slice(i, i + 200) });
      if(!j.ok && j.error !== 'no-gate'){
        try{ window.reportAppIssue && window.reportAppIssue('gate', '출입증 다시 계산 실패: ' + (j.error || '') + (j.status ? ' ' + j.status : ''), ''); }catch(e){}
      }
    }
  }, 300);
}
window.gateRecalc = gateRecalc;
