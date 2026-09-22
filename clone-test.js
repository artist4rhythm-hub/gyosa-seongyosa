/* ═══════════════════════════════════════════════════════════
   🧪 clone-test.js — 권한 테스트 계정 (관리자 → 🧪 권한 테스트)
   · 테스트 계정 하나를 두고, 선생님을 고르면 그분의 «권한»을 통째로 복제한다
   · 복제하는 것: ① 계정의 권한 필드  ② 담당자 명단(권한용 설정)  ③ 장부별 담당 · 담임 반
   · 복제하지 않는 것: 결재선·결재 규칙·근무 설정(실제 업무 흐름이 바뀌므로),
                       그 선생님의 개인 항목(쪽지함·결재함·본인 신청)
   · 담임 반은 반 문서의 보이지 않는 칸(shadowUids)에만 넣어, 반편성 화면에 드러나지 않는다
   공용 모듈 원칙: 페이지 초기화 대기 · 전체 안전망 · 버전표(clone-test.js?v=)
   ═══════════════════════════════════════════════════════════ */
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  arrayUnion, arrayRemove, deleteField, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function waitForApp(){
  return new Promise(resolve=>{ let n=0; const t=()=>{ if(getApps().length) return resolve(getApp()); if(++n>60) return resolve(null); setTimeout(t,150); }; t(); });
}
let _fb = null;
async function fb(){ if(_fb) return _fb; const app = await waitForApp(); if(!app) return null;
  try{ _fb = { db:getFirestore(app), auth:getAuth(app) }; }catch(e){ return null; } return _fb; }
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ── 권한 지도 ── */
const PERM_DOCS = [                       // 담당자 명단(권한용) — 여기만 복제한다
  ['academicConfig','editors','학사일정 편집'], ['actConfig','editors','활동 경비 총괄'],
  ['attendConfig','editors','출석부 편집'],   ['attendConfig','gradeAssign','출석 학년 담당'],
  ['bldConfig','editors','공사 경비 총괄'],   ['classConfig','editors','반편성 편집'],
  ['expenseConfig','managers','수행성 경비 관리자'], ['famConfig','editors','가정통신문 편집'],
  ['payConfig','managers','경비 지급 요청서 담당'], ['timetableConfig','editors','시간표 편집'],
  ['systemConfig','union','연합 열쇠'],       ['clubConfig','managers','동아리 관리자'],
];
/* 결재선·결재 규칙·근무 설정은 절대 건드리지 않는다 — 넣는 순간 실제 결재가 테스트 계정으로 흘러간다 */
const COPY_FIELDS = ['role','org','orgs','primaryOrg','dept','position','duty','pageDeny','pageAllow','acStatus'];
const ROLE_L = { super:'슈퍼관리자', org_admin:'기관관리자', teacher:'교사', partner:'협력' };

const isPlain = v => v && typeof v==='object' && Object.getPrototypeOf(v)===Object.prototype;
/* 대상 uid가 있는 자리마다 테스트 uid를 더한다 (배열엔 추가 · uid 키엔 같은 값 복사) */
function mirror(v, from, to, hits, path){
  if(Array.isArray(v)){
    const out = v.map((x,i)=>mirror(x, from, to, hits, `${path}[${i}]`));
    if(v.includes(from) && !v.includes(to)){ out.push(to); hits.push(path||'(목록)'); }
    return out;
  }
  if(isPlain(v)){
    const out = {};
    for(const [k,x] of Object.entries(v)) out[k] = mirror(x, from, to, hits, path?`${path}.${k}`:k);
    if(Object.prototype.hasOwnProperty.call(v, from) && !Object.prototype.hasOwnProperty.call(v, to)){ out[to] = v[from]; hits.push((path||'')+'{선생님}'); }
    return out;
  }
  return v;                                // Timestamp·문자열 등은 그대로 (단일 지정 칸은 복제하지 않음)
}
/* 테스트 uid를 모든 자리에서 걷어낸다 */
function scrub(v, uid, cnt){
  if(Array.isArray(v)){ const out = v.filter(x=>x!==uid).map(x=>scrub(x, uid, cnt)); if(out.length!==v.length) cnt.n++; return out; }
  if(isPlain(v)){ const out={}; for(const [k,x] of Object.entries(v)){ if(k===uid){ cnt.n++; continue; } out[k]=scrub(x, uid, cnt); } return out; }
  return v;
}

async function readCfg(F){ try{ const s = await getDoc(doc(F.db,'systemConfig','testClone')); return s.exists()? s.data() : null; }catch(e){ return null; } }
async function allStaff(F){
  const s = await getDocs(query(collection(F.db,'staff')));      // 테스트 계정도 보여야 하므로 숨김 없이
  return s.docs.map(d=>({ uid:d.id, ...d.data() })).filter(x=>!x.deleted)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ko'));
}

/* ── 이전 복제 걷어내기 ── */
async function wipe(F, testUid){
  const out = [];
  for(const [c,d] of PERM_DOCS){
    try{ const r = doc(F.db,c,d); const s = await getDoc(r); if(!s.exists()) continue;
      const cnt = {n:0}; const nv = scrub(s.data(), testUid, cnt);
      if(cnt.n){ await setDoc(r, nv); out.push(`${c}/${d}`); } }catch(e){}
  }
  for(const col of ['actLedgers','bldLedgers']){
    try{ const s = await getDocs(query(collection(F.db,col), where('managers','array-contains',testUid)));
      for(const d of s.docs){ await updateDoc(d.ref, { managers: arrayRemove(testUid) }); out.push(`${col}/${d.id}`); } }catch(e){}
  }
  try{ const s = await getDocs(query(collection(F.db,'classes'), where('shadowUids','array-contains',testUid)));
    for(const d of s.docs){ await updateDoc(d.ref, { shadowUids: arrayRemove(testUid) }); out.push(`classes/${d.id}`); } }catch(e){}
  return out;
}

/* ── 복제 ── */
async function cloneFrom(F, test, target, me){
  const items = [];
  await wipe(F, test.uid);
  // ① 계정의 권한 필드
  const upd = { isTest:true, cloneOf:{ uid:target.uid, name:target.name||'', position:target.position||'', role:target.role||'', at:Timestamp.now() } };
  COPY_FIELDS.forEach(f=>{ upd[f] = (target[f]===undefined || target[f]===null) ? deleteField() : target[f]; });
  await updateDoc(doc(F.db,'staff',test.uid), upd);
  const orgs = (target.orgs&&target.orgs.length?target.orgs:[target.org]).filter(Boolean).map(o=>o==='daniel'?'다니엘':o==='jihyebit'?'지혜빛':o).join(', ');
  items.push({ ic:'👤', t:`역할 · ${ROLE_L[target.role]||target.role||'—'} / 소속 · ${orgs||'—'}${target.primaryOrg?` (주: ${target.primaryOrg==='daniel'?'다니엘':'지혜빛'})`:''}${target.position?` / 직위 · ${target.position}`:''}${target.dept?` / 부서 · ${target.dept}`:''}`, w:'계정' });
  items.push({ ic:'🚫', t:`페이지 차단 · ${(target.pageDeny||[]).length?(target.pageDeny||[]).join(', '):'없음'}${(target.pageAllow||[]).length?` · 허용 ${(target.pageAllow||[]).join(', ')}`:''}`, w:'계정' });
  // ② 담당자 명단
  for(const [c,d,label] of PERM_DOCS){
    try{ const r = doc(F.db,c,d); const s = await getDoc(r); if(!s.exists()) continue;
      const hits = []; const nv = mirror(s.data(), target.uid, test.uid, hits, '');
      if(hits.length){ await setDoc(r, nv); items.push({ ic:'✅', t:label, w:`${c}/${d}` }); }
    }catch(e){ items.push({ ic:'⚠️', t:`${label} — 저장 권한이 없어 건너뜀`, w:`${c}/${d}` }); }
  }
  // ③ 장부별 담당 (이름 목록은 건드리지 않아 화면에 드러나지 않는다)
  for(const [col,label] of [['actLedgers','활동 경비 담당'],['bldLedgers','공사 경비 담당']]){
    try{ const s = await getDocs(query(collection(F.db,col), where('managers','array-contains',target.uid)));
      if(s.size){ for(const d of s.docs) await updateDoc(d.ref, { managers: arrayUnion(test.uid) });
        items.push({ ic:col==='actLedgers'?'🏕':'🏗', t:`${label} · ${s.docs.slice(0,2).map(d=>d.data().name||'').join(', ')}${s.size>2?` 외 ${s.size-2}건`:''}`, w:`장부 ${s.size}건` }); }
    }catch(e){}
  }
  // ④ 담임 반 — 보이지 않는 칸에만
  try{
    const a = await getDocs(query(collection(F.db,'classes'), where('teacherUid','==',target.uid)));
    const b = await getDocs(query(collection(F.db,'classes'), where('deputies','array-contains',target.uid)));
    const seen = new Map(); [...a.docs, ...b.docs].forEach(d=>seen.set(d.id, d));
    for(const d of seen.values()) await updateDoc(d.ref, { shadowUids: arrayUnion(test.uid) });
    if(seen.size) items.push({ ic:'🏫', t:`담임 반 · ${[...seen.values()].slice(0,3).map(d=>`${d.data().grade||''} ${d.data().name||''}`.trim()).join(', ')}${seen.size>3?` 외 ${seen.size-3}개`:''}`, w:'보이지 않게' });
  }catch(e){}
  await setDoc(doc(F.db,'systemConfig','testClone'), { uid:test.uid, name:test.name||'', email:test.email||'',
    cloneOf:{ uid:target.uid, name:target.name||'', position:target.position||'', role:target.role||'', at:Timestamp.now(), byName:me.name||'' },
    items }, { merge:true });
  try{ window.logActivity && window.logActivity('권한', '권한 테스트', `테스트 계정에 ${target.name} 선생님 권한 복제`, `${items.length}개 항목`); }catch(e){}
  return items;
}

/* ── 테스트 흔적 찾기·지우기 (테스트 계정이 «새로 만든» 기록만) ── */
const TRACE_COLS = ['payRequests','expenses','actExpenses','bldExpenses','bldPrepays','messages','approvals','posts','familyNotices','studentAttendance','clubEnrollments'];
const TRACE_FIELDS = ['createdByUid','requesterUid','byUid','authorUid','fromUid','markedByUid'];
async function findTraces(F, uid){
  const jobs = [];
  TRACE_COLS.forEach(c=>TRACE_FIELDS.forEach(f=>jobs.push(
    getDocs(query(collection(F.db,c), where(f,'==',uid))).then(s=>s.docs.map(d=>({ col:c, id:d.id, ref:d.ref, d:d.data() }))).catch(()=>[]))));
  const all = (await Promise.all(jobs)).flat();
  const m = new Map(); all.forEach(x=>m.set(`${x.col}/${x.id}`, x));
  return [...m.values()];
}

/* ═══ 관리자 화면 ═══ */
window.cloneTestMount = async (elId)=>{
  const el = document.getElementById(elId); if(!el) return;
  try{
    el.innerHTML = '<div style="padding:18px;color:#7C837E;font-size:13px">불러오는 중…</div>';
    const F = await fb(); if(!F){ el.innerHTML='<div style="padding:18px">연결하지 못했습니다.</div>'; return; }
    const u = F.auth.currentUser; if(!u){ el.innerHTML='<div style="padding:18px">로그인이 필요합니다.</div>'; return; }
    const meSnap = await getDoc(doc(F.db,'staff',u.uid)); const me = { uid:u.uid, ...(meSnap.data()||{}) };
    if(me.role!=='super'){ el.innerHTML='<div style="padding:18px;color:#7C837E;font-size:13px">슈퍼관리자만 볼 수 있습니다.</div>'; return; }
    const cfg = await readCfg(F);
    const staff = await allStaff(F);
    const test = cfg && cfg.uid ? staff.find(s=>s.uid===cfg.uid) : null;
    const pickable = staff.filter(s=>!s.isTest && s.role!=='super' && s.status!=='퇴직');
    const c = (cfg && cfg.cloneOf) || null;
    const when = t => { try{ const d=t.toDate?t.toDate():new Date(t); return d.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };

    el.innerHTML = `<div class="asc"><div class="acard">
      <h3 class="actitle">🧪 권한 테스트 — «그 선생님 눈으로 보기»</h3>
      <p class="adesc">테스트 계정에 선생님의 권한을 통째로 복제합니다. <b>시크릿 창</b>에서 테스트 계정으로 들어가면 그 선생님이 보는 화면 그대로예요.
        다른 선생님으로 바꾸면 이전 복제는 자동으로 걷어낸 뒤 새로 복제합니다.</p>
      ${test ? `
      <div style="display:flex;align-items:center;gap:10px;background:#FFF1E6;border:1.5px solid #F4C7A1;border-radius:12px;padding:11px 13px;margin:10px 0">
        <span style="font-size:22px">🧪</span>
        <div style="flex:1"><b style="font-size:13px;color:#7C2D12">테스트 계정 · ${esc(test.name||'')} <span style="font-weight:600;font-size:11.5px">${esc(test.email||'')}</span></b>
          <div style="font-size:11.5px;color:#9A3412">${c?`지금 <b>${esc(c.name)}${c.position?` (${esc(c.position)})`:''}</b> 권한으로 복제됨 · ${when(c.at)}`:'아직 복제된 권한이 없습니다'}</div></div>
        <button class="bs" onclick="cloneWipe()" style="white-space:nowrap">권한 비우기</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <select id="ct-target" style="flex:1;min-width:220px;height:40px;border:1.5px solid var(--ivd);border-radius:10px;padding:0 10px;font-family:inherit;font-size:13px;background:var(--iv)">
          <option value="">— 선생님 고르기 —</option>
          ${pickable.map(s=>`<option value="${s.uid}"${c&&c.uid===s.uid?' selected':''}>${esc(s.name||'')} · ${esc(s.position||ROLE_L[s.role]||s.role||'')}${(s.orgs&&s.orgs.length>1)?' · 두 기관':''}</option>`).join('')}
        </select>
        <button class="bp" style="background:#C2410C;border-color:#C2410C;white-space:nowrap" onclick="cloneDo()">이 선생님 권한으로 복제</button>
      </div>
      <div id="ct-result">${cfg && cfg.items && cfg.items.length ? resultHTML(cfg.items, c) : ''}</div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--ivd)">
        <div style="font-size:13px;font-weight:900;color:var(--gd);margin-bottom:4px">🧹 테스트 흔적</div>
        <div style="font-size:11.8px;color:var(--ts);line-height:1.75;margin-bottom:8px">테스트 계정으로 <b>새로 만든</b> 신청·쪽지·기록을 찾아 지웁니다.
          테스트 계정으로 <b>기존 자료를 고친 것</b>은 되돌리지 못하니, 출석 체크·결재 같은 실제 업무 버튼은 테스트 계정으로 누르지 마세요.</div>
        <button class="bs" onclick="cloneTraces()">흔적 찾기</button> <span id="ct-trace" style="font-size:12px;color:var(--ts)"></span>
      </div>
      <div style="margin-top:12px;font-size:11.5px;color:var(--tl)">테스트 계정 바꾸기: <button class="bs" style="font-size:11px;padding:3px 9px" onclick="cloneDesignate(true)">다른 계정으로 지정</button> · <button class="bs" style="font-size:11px;padding:3px 9px;color:#B91C1C" onclick="cloneRelease()">지정 해제</button></div>
      ` : `
      <div style="background:var(--iv);border-radius:12px;padding:13px 14px;margin-top:10px">
        <div style="font-size:13px;font-weight:900;color:var(--gd);margin-bottom:6px">① 테스트 계정 지정</div>
        <div style="font-size:12px;color:var(--ts);line-height:1.75;margin-bottom:8px">«계정·권한 → 통합관리»에서 평소처럼 교직원 계정을 하나 만든 뒤(예: 테스트 · test@…), 여기서 지정하세요.
          이미 만들어 두신 «테스트-…» 계정을 골라도 됩니다. 지정하는 순간 그 계정은 <b>모든 명단에서 숨겨집니다</b>.</div>
        <button class="bp" onclick="cloneDesignate(false)">테스트 계정 고르기</button>
      </div>`}
    </div></div>`;

    window.__ct = { F, me, staff, test, pickable };
  }catch(e){
    console.error('[권한 테스트]', e);
    el.innerHTML = `<div style="padding:18px;color:#B91C1C">불러오는 중 문제가 생겼습니다: ${esc(e.message||e)}</div>`;
  }
};
function resultHTML(items, c){
  return `<div style="font-size:12.5px;font-weight:900;color:var(--gd);margin:4px 0 6px">✓ 복제된 항목${c?` — ${esc(c.name)} 선생님 기준`:''}</div>
    <div style="border:1px solid var(--ivd);border-radius:11px;overflow:hidden">${items.map(it=>`
      <div style="display:flex;gap:9px;align-items:center;padding:7px 11px;border-bottom:1px solid #EFECE4;font-size:12px">
        <span style="width:18px;text-align:center">${it.ic}</span><span>${esc(it.t)}</span>
        <span style="margin-left:auto;font-size:10.5px;color:var(--tl);font-weight:700">${esc(it.w)}</span></div>`).join('')}</div>
    <div style="font-size:11.3px;color:var(--tl);margin-top:7px;line-height:1.75">결재선·결재 규칙·근무 설정은 실제 업무가 바뀌므로 복제하지 않습니다 ·
      그 선생님의 쪽지함·결재함·본인 신청 같은 개인 항목도 따라오지 않아요 · 이제 시크릿 창에서 테스트 계정을 <b>새로고침</b>하세요.</div>`;
}
window.cloneDo = async ()=>{
  const X = window.__ct; if(!X || !X.test) return;
  const uid = document.getElementById('ct-target')?.value;
  if(!uid){ alert('선생님을 골라주세요'); return; }
  const target = X.pickable.find(s=>s.uid===uid); if(!target) return;
  if(target.role==='super'){ alert('슈퍼관리자 권한은 복제할 수 없습니다'); return; }
  if(!confirm(`테스트 계정에 «${target.name}» 선생님의 권한을 복제할까요?\n이전 복제는 먼저 걷어냅니다.`)) return;
  const box = document.getElementById('ct-result'); if(box) box.innerHTML = '<div style="padding:10px;color:#7C837E;font-size:12.5px">복제하는 중… (권한 지도를 훑고 있어요)</div>';
  try{ const items = await cloneFrom(X.F, X.test, target, X.me); await window.cloneTestMount('ca-clone');
    if(window.toast) toast(`«${target.name}» 권한으로 복제했습니다 — 시크릿 창을 새로고침하세요`,'ok'); }
  catch(e){ alert('복제 실패: '+(e.message||e)); await window.cloneTestMount('ca-clone'); }
};
window.cloneWipe = async ()=>{
  const X = window.__ct; if(!X || !X.test) return;
  if(!confirm('테스트 계정의 권한을 모두 비울까요?\n아무 권한 없는 빈 교사 상태가 됩니다.')) return;
  try{ await wipe(X.F, X.test.uid);
    const upd = { cloneOf: deleteField(), role:'teacher', pageDeny:deleteField(), pageAllow:deleteField(), position:deleteField(), duty:deleteField(), dept:deleteField() };
    await updateDoc(doc(X.F.db,'staff',X.test.uid), upd);
    await setDoc(doc(X.F.db,'systemConfig','testClone'), { cloneOf:null, items:[] }, { merge:true });
    await window.cloneTestMount('ca-clone'); if(window.toast) toast('테스트 계정 권한을 비웠습니다','ok'); }
  catch(e){ alert('실패: '+(e.message||e)); }
};
window.cloneDesignate = async (change)=>{
  const X = window.__ct; if(!X) return;
  const cand = X.staff.filter(s=>s.role!=='super');
  const bg = document.createElement('div');
  bg.style.cssText='position:fixed;inset:0;background:rgba(16,22,26,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
  bg.addEventListener('click', e=>{ if(e.target===bg) bg.remove(); });
  bg.innerHTML = `<div style="background:#fff;border-radius:14px;padding:18px;max-width:420px;width:100%">
    <div style="font-size:15px;font-weight:900;color:#0F241F">🧪 테스트 계정 고르기</div>
    <div style="font-size:12px;color:#5A6560;margin:5px 0 10px">슈퍼관리자 계정은 고를 수 없습니다. 고른 계정은 모든 명단에서 숨겨져요.</div>
    <select id="ct-des" style="width:100%;height:40px;border:1.5px solid #E3E1DA;border-radius:10px;padding:0 10px;font-family:inherit;font-size:13px">
      ${cand.map(s=>`<option value="${s.uid}">${esc(s.name||'')} · ${esc(s.email||'')}${s.isTest?' (지금 테스트 계정)':''}</option>`).join('')}</select>
    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px">
      <button onclick="this.closest('div[style*=fixed]').remove()" style="font-family:inherit;font-weight:800;border:1.5px solid #E3E1DA;background:#fff;border-radius:9px;padding:8px 14px;cursor:pointer">취소</button>
      <button id="ct-des-ok" style="font-family:inherit;font-weight:800;border:0;background:#1E3932;color:#fff;border-radius:9px;padding:8px 16px;cursor:pointer">지정</button></div></div>`;
  document.body.appendChild(bg);
  document.getElementById('ct-des-ok').onclick = async ()=>{
    const uid = document.getElementById('ct-des').value; const s = X.staff.find(x=>x.uid===uid); if(!s) return;
    try{
      if(X.test && X.test.uid!==uid){ await wipe(X.F, X.test.uid); await updateDoc(doc(X.F.db,'staff',X.test.uid), { isTest:false, cloneOf:deleteField() }); }
      await updateDoc(doc(X.F.db,'staff',uid), { isTest:true });
      await setDoc(doc(X.F.db,'systemConfig','testClone'), { uid, name:s.name||'', email:s.email||'', cloneOf:null, items:[] });
      bg.remove(); await window.cloneTestMount('ca-clone'); if(window.toast) toast(`«${s.name}» 계정을 테스트 계정으로 지정했습니다`,'ok');
    }catch(e){ alert('지정 실패: '+(e.message||e)); }
  };
};
window.cloneRelease = async ()=>{
  const X = window.__ct; if(!X || !X.test) return;
  if(!confirm(`«${X.test.name}» 계정의 테스트 지정을 해제할까요?\n복제된 권한을 모두 걷어내고, 다시 명단에 나타납니다.`)) return;
  try{ await wipe(X.F, X.test.uid);
    await updateDoc(doc(X.F.db,'staff',X.test.uid), { isTest:false, cloneOf:deleteField() });
    await setDoc(doc(X.F.db,'systemConfig','testClone'), { uid:null, name:'', email:'', cloneOf:null, items:[] });
    await window.cloneTestMount('ca-clone'); }catch(e){ alert('실패: '+(e.message||e)); }
};
window.cloneTraces = async ()=>{
  const X = window.__ct; if(!X || !X.test) return;
  const tag = document.getElementById('ct-trace'); if(tag) tag.textContent = '찾는 중…';
  const list = await findTraces(X.F, X.test.uid);
  if(!list.length){ if(tag) tag.textContent = '✓ 테스트 흔적이 없습니다'; return; }
  const title = x => x.d.subject || x.d.title || x.d.item || x.d.name || x.d.text || x.d.studentName || x.id;
  const bg = document.createElement('div');
  bg.style.cssText='position:fixed;inset:0;background:rgba(16,22,26,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
  bg.addEventListener('click', e=>{ if(e.target===bg) bg.remove(); });
  bg.innerHTML = `<div style="background:#fff;border-radius:14px;padding:18px;max-width:520px;width:100%;max-height:84vh;overflow:auto">
    <div style="font-size:15px;font-weight:900;color:#0F241F">🧹 테스트 흔적 ${list.length}건</div>
    <div style="font-size:12px;color:#5A6560;margin:5px 0 10px">테스트 계정이 새로 만든 기록입니다. 지울 것을 확인하세요.</div>
    ${list.map((x,i)=>`<label style="display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid #F0EDE6;font-size:12.5px">
      <input type="checkbox" checked data-i="${i}" style="width:15px;height:15px"><b>${esc(String(title(x)).slice(0,40))}</b>
      <span style="margin-left:auto;font-size:10.8px;color:#93A09A">${esc(x.col)}</span></label>`).join('')}
    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:12px">
      <button onclick="this.closest('div[style*=fixed]').remove()" style="font-family:inherit;font-weight:800;border:1.5px solid #E3E1DA;background:#fff;border-radius:9px;padding:8px 14px;cursor:pointer">취소</button>
      <button id="ct-tr-ok" style="font-family:inherit;font-weight:800;border:0;background:#B91C1C;color:#fff;border-radius:9px;padding:8px 16px;cursor:pointer">고른 것 지우기</button></div></div>`;
  document.body.appendChild(bg);
  document.getElementById('ct-tr-ok').onclick = async ()=>{
    const idx = [...bg.querySelectorAll('input[type=checkbox]:checked')].map(c=>+c.dataset.i);
    let n=0; for(const i of idx){ try{ await deleteDoc(list[i].ref); n++; }catch(e){} }
    bg.remove(); if(tag) tag.textContent = `✓ ${n}건 지웠습니다`;
  };
};
