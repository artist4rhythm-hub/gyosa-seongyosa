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
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
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
const idOf = e => String(e||'').split('@')[0];
const ORG_L = o => o==='daniel'?'다니엘':o==='jihyebit'?'지혜빛':(o||'');
const orgsTxt = s => ((s.orgs&&s.orgs.length?s.orgs:[s.org]).filter(Boolean).map(ORG_L).join('·')) || '—';
const looksTest = s => s.isTest || /테스트|test/i.test(String(s.name||'')+' '+String(s.email||''));
async function homeCount(F, uid, field){
  try{
    if(field==='shadow'){ const q = await getDocs(query(collection(F.db,'classes'), where('shadowUids','array-contains',uid))); return q.docs.map(d=>`${d.data().grade||''} ${d.data().name||''}`.trim()); }
    const a = await getDocs(query(collection(F.db,'classes'), where('teacherUid','==',uid)));
    const b = await getDocs(query(collection(F.db,'classes'), where('deputies','array-contains',uid)));
    const m = new Map(); [...a.docs,...b.docs].forEach(d=>m.set(d.id, `${d.data().grade||''} ${d.data().name||''}`.trim())); return [...m.values()];
  }catch(e){ return []; }
}
async function permCount(F, uid){
  let n = 0; const labels = [];
  for(const [c,d,label] of PERM_DOCS){
    try{ const x = await getDoc(doc(F.db,c,d)); if(!x.exists()) continue;
      if(JSON.stringify(x.data()).includes(`"${uid}"`)){ n++; labels.push(label); } }catch(e){}
  }
  return { n, labels };
}
const cell = (a,b) => { const A = JSON.stringify(a??''), B = JSON.stringify(b??''); return A===B ? '<b style="color:#166534">✓</b>' : '<b style="color:#B91C1C">✗</b>'; };

window.cloneTestMount = async (elId)=>{
  const el = document.getElementById(elId); if(!el) return;
  try{
    el.innerHTML = '<div style="padding:18px;color:#7C837E;font-size:13px">테스트 계정 상태를 확인하는 중…</div>';
    const F = await fb(); if(!F){ el.innerHTML='<div style="padding:18px">연결하지 못했습니다.</div>'; return; }
    const u = F.auth.currentUser; if(!u){ el.innerHTML='<div style="padding:18px">로그인이 필요합니다.</div>'; return; }
    const meSnap = await getDoc(doc(F.db,'staff',u.uid)); const me = { uid:u.uid, ...(meSnap.data()||{}) };
    if(me.role!=='super'){ el.innerHTML='<div style="padding:18px;color:#7C837E;font-size:13px">슈퍼관리자만 볼 수 있습니다.</div>'; return; }
    const cfg = await readCfg(F);
    const staff = await allStaff(F);
    const test = cfg && cfg.uid ? staff.find(s=>s.uid===cfg.uid) : null;
    const pickable = staff.filter(s=>!s.isTest && s.role!=='super' && s.status!=='퇴직');
    const c = (test && test.cloneOf) || (cfg && cfg.cloneOf) || null;
    const target = c && c.uid ? staff.find(s=>s.uid===c.uid) : null;
    const when = t => { try{ const d=t.toDate?t.toDate():new Date(t); return d.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } };
    const candidates = staff.filter(looksTest);

    // 비교표 재료
    let cmp = '';
    if(test && target){
      const [tH, xH, tP, xP] = await Promise.all([homeCount(F,target.uid,'real'), homeCount(F,test.uid,'shadow'), permCount(F,target.uid), permCount(F,test.uid)]);
      const rows = [
        ['역할', ROLE_L[target.role]||target.role||'—', ROLE_L[test.role]||test.role||'—', cell(target.role,test.role)],
        ['접근 기관', orgsTxt(target), orgsTxt(test), cell(orgsTxt(target),orgsTxt(test))],
        ['주 소속', ORG_L(target.primaryOrg||target.org)||'—', ORG_L(test.primaryOrg||test.org)||'—', cell(target.primaryOrg||target.org, test.primaryOrg||test.org)],
        ['직위', target.position||'—', test.position||'—', cell(target.position||'',test.position||'')],
        ['부서', target.dept||'—', test.dept||'—', cell(target.dept||'',test.dept||'')],
        ['페이지 차단', (target.pageDeny||[]).join(', ')||'없음', (test.pageDeny||[]).join(', ')||'없음', cell(target.pageDeny||[], test.pageDeny||[])],
        ['담임 반', tH.join(', ')||'없음', xH.join(', ')||'없음', cell(tH.length, xH.length)],
        ['담당 명단', tP.labels.join(', ')||'없음', xP.labels.join(', ')||'없음', cell(tP.n, xP.n)],
      ];
      cmp = `<div class="acard"><h3 class="actitle">🔍 지금 테스트 계정 = <span style="color:#C2410C">${esc(target.name||'')}</span> 선생님
          <span style="font-size:12px;color:var(--tl);font-weight:500">· 두 칸이 같으면 ✓</span></h3>
        <div style="overflow-x:auto"><table class="otable" style="margin-top:6px">
          <tr><th style="width:15%">항목</th><th>${esc(target.name||'')} 선생님 (원본)</th><th>테스트 계정 (복제본)</th><th style="width:7%;text-align:center">일치</th></tr>
          ${rows.map(r=>`<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td style="text-align:center">${r[3]}</td></tr>`).join('')}
        </table></div>
        <div style="font-size:11.5px;color:var(--tl);margin-top:7px;line-height:1.75">담임 반은 반편성 화면에 드러나지 않는 칸에만 들어가 있어요 ·
          결재선·결재 규칙·근무 설정과 개인 항목(쪽지함·결재함·본인 신청)은 일부러 복제하지 않습니다.</div></div>`;
    }

    el.innerHTML = `<div class="asc">
    <div class="acard">
      <h3 class="actitle">🧪 권한 테스트 — «그 선생님 눈으로 보기»</h3>
      <p class="adesc">테스트 계정에 선생님의 권한을 통째로 복제합니다. <b>시크릿 창(또는 다른 브라우저)</b>에서 테스트 계정으로 들어가면 그 선생님이 보는 화면 그대로예요.
        <b style="color:#B91C1C">같은 창의 다른 탭에서 로그인하면 안 됩니다</b> — 같은 브라우저의 탭들은 로그인을 공유해서, 관리자 탭들까지 테스트 계정으로 바뀌어요.</p>
      ${test ? `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;background:#FFF1E6;border:1.5px solid #F4C7A1;border-radius:12px;padding:12px 14px;margin:10px 0;font-size:12.8px">
        <span style="color:#9A3412;font-weight:800">테스트 계정</span><span><b>${esc(test.name||'')}</b></span>
        <span style="color:#9A3412;font-weight:800">로그인 아이디</span><span><b style="font-family:ui-monospace,Menlo,monospace;background:#fff;border-radius:6px;padding:1px 7px">${esc(idOf(test.email))}</b>
          <button class="bs" style="font-size:11px;padding:2px 8px;margin-left:4px" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(idOf(test.email))}');window.toast&&toast('아이디를 복사했습니다','ok')">복사</button></span>
        <span style="color:#9A3412;font-weight:800">비밀번호</span><span>누구도 볼 수 없게 저장됩니다 (관리자 포함) — 모르면 <button class="bs" style="font-size:11px;padding:2px 9px" onclick="ctResetPw()">🔑 새로 정하기</button></span>
        <span style="color:#9A3412;font-weight:800">상태</span><span>테스트 지정됨 · <b>모든 명단에서 숨김</b>${test.acStatus&&test.acStatus!=='active'?` · 계정 상태 ${esc(test.acStatus)}`:''}</span>
        <span style="color:#9A3412;font-weight:800">지금 권한</span><span>${c?`<b>${esc(c.name)}${c.position?` (${esc(c.position)})`:''}</b> 선생님과 같게 · ${when(c.at)} 복제`:'<b>아직 복제 안 됨</b> — 아래에서 선생님을 고르세요'}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="bs" onclick="cloneWipe()">권한 비우기</button>
        <button class="bs" onclick="cloneDesignate(true)">다른 계정으로 지정</button>
        <button class="bs" style="color:#B91C1C" onclick="cloneRelease()">지정 해제</button>
      </div>` : `
      <div style="background:var(--iv);border-radius:12px;padding:13px 14px;margin-top:10px">
        <div style="font-size:13px;font-weight:900;color:var(--gd);margin-bottom:6px">① 테스트 계정 지정</div>
        <div style="font-size:12px;color:var(--ts);line-height:1.75;margin-bottom:8px">아래 «테스트용 계정» 목록에서 고르거나, «통합관리»에서 새 계정을 만든 뒤 여기서 지정하세요. 지정하는 순간 그 계정은 <b>모든 명단에서 숨겨집니다</b>.</div>
        <button class="bp" onclick="cloneDesignate(false)">테스트 계정 고르기</button>
      </div>`}
    </div>

    ${cmp}

    ${test ? `<div class="acard">
      <h3 class="actitle">👥 누구의 화면으로 볼까요? <span style="font-size:12px;color:var(--tl);font-weight:500">· ${pickable.length}명</span></h3>
      <input id="ct-q" placeholder="이름·직위 검색" oninput="ctFilter(this.value)" style="width:100%;height:38px;border:1.5px solid var(--ivd);border-radius:10px;padding:0 11px;font-family:inherit;font-size:13px;background:var(--iv);margin:6px 0 8px">
      <div id="ct-list" style="max-height:360px;overflow:auto;border:1px solid var(--ivd);border-radius:11px"></div>
      <div id="ct-result" style="margin-top:10px">${cfg && cfg.items && cfg.items.length ? resultHTML(cfg.items, c) : ''}</div>
    </div>

    <div class="acard">
      <h3 class="actitle">🧹 테스트 흔적</h3>
      <div style="font-size:11.8px;color:var(--ts);line-height:1.75;margin-bottom:8px">테스트 계정으로 <b>새로 만든</b> 신청·쪽지·기록을 찾아 지웁니다.
        기존 자료를 <b>고친 것</b>은 되돌리지 못하니, 출석 체크·결재 같은 실제 업무 버튼은 테스트 계정으로 누르지 마세요.</div>
      <button class="bs" onclick="cloneTraces()">흔적 찾기</button> <span id="ct-trace" style="font-size:12px;color:var(--ts)"></span>
    </div>` : ''}

    <div class="acard">
      <h3 class="actitle">🗂 테스트용 계정 <span style="font-size:12px;color:var(--tl);font-weight:500">· 이름이나 아이디에 «테스트/test»가 들어간 계정 · 명단에서 숨겨진 것도 보입니다</span></h3>
      ${candidates.length ? `<table class="otable" style="margin-top:6px"><tr><th>이름</th><th>로그인 아이디</th><th>역할</th><th>상태</th><th></th></tr>
        ${candidates.map(s=>`<tr><td><b>${esc(s.name||'')}</b></td><td style="font-family:ui-monospace,Menlo,monospace">${esc(idOf(s.email))}</td>
          <td>${esc(ROLE_L[s.role]||s.role||'')}</td>
          <td>${s.isTest?'<span class="sbadge" style="background:#FFF1E6;color:#C2410C">🧪 테스트 지정</span>':'<span class="sbadge">일반 (명단에 보임)</span>'}</td>
          <td>${(test&&test.uid===s.uid)?'<span style="font-size:11px;color:var(--tl)">사용 중</span>':(s.role==='super'?'':`<button class="bs" style="font-size:11px;padding:3px 9px" onclick="ctUse('${s.uid}')">이 계정 쓰기</button>`)}</td></tr>`).join('')}
      </table>` : '<p class="empty">아직 없습니다.</p>'}
      <div style="background:var(--iv);border-radius:11px;padding:11px 13px;margin-top:10px;font-size:12px;color:var(--ts);line-height:1.8">
        <b style="color:var(--gd)">«이미 사용 중인 아이디입니다»가 뜰 때</b><br>
        로그인 아이디는 교직원 명단과 별개로 <b>인증 장부</b>에 남습니다. 명단에서 숨긴 테스트 계정이거나, 예전에 만들다 만 계정이 인증 장부에만 남아 있는 경우예요.
        <div style="display:flex;gap:6px;margin-top:7px;align-items:center;flex-wrap:wrap">
          <input id="ct-idq" placeholder="확인할 아이디 (예: 테스트)" style="height:34px;border:1.5px solid var(--ivd);border-radius:9px;padding:0 10px;font-family:inherit;font-size:12.5px;background:#fff">
          <button class="bs" onclick="ctCheckId()">확인</button> <span id="ct-idr" style="font-size:12px"></span></div>
      </div>
    </div>
    </div>`;

    window.__ct = { F, me, staff, test, pickable, cfg };
    if(test) window.ctFilter('');
  }catch(e){
    console.error('[권한 테스트]', e);
    el.innerHTML = `<div style="padding:18px;color:#B91C1C">불러오는 중 문제가 생겼습니다: ${esc(e.message||e)}</div>`;
  }
};
window.ctFilter = (q)=>{
  const X = window.__ct; if(!X) return;
  const cur = X.test && X.test.cloneOf ? X.test.cloneOf.uid : (X.cfg && X.cfg.cloneOf ? X.cfg.cloneOf.uid : '');
  const list = X.pickable.filter(s=>!q || (String(s.name||'')+String(s.position||'')).includes(q));
  const box = document.getElementById('ct-list'); if(!box) return;
  box.innerHTML = list.map(s=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 11px;border-bottom:1px solid #F0EDE6;${s.uid===cur?'background:#FFF1E6':''}">
      <b style="min-width:70px">${esc(s.name||'')}</b>
      <span style="font-size:11.5px;color:var(--ts)">${esc(s.position||'')}${s.position?' · ':''}${esc(ROLE_L[s.role]||s.role||'')} · ${esc(orgsTxt(s))}${s.dept?` · ${esc(s.dept)}`:''}</span>
      ${s.uid===cur?'<span style="margin-left:auto;font-size:11px;font-weight:900;color:#C2410C">🧪 지금 이 권한</span>'
        :`<button class="bs" style="margin-left:auto;font-size:11px;padding:4px 10px;white-space:nowrap" onclick="cloneDo('${s.uid}')">이 선생님으로 복제</button>`}</div>`).join('')
    || '<div style="padding:12px;font-size:12px;color:var(--tl)">검색 결과 없음</div>';
};
window.ctUse = async (uid)=>{
  const X = window.__ct; if(!X) return;
  const s = X.staff.find(x=>x.uid===uid); if(!s) return;
  if(!confirm(`«${s.name}» (아이디 ${idOf(s.email)}) 계정을 테스트 계정으로 쓸까요?\n모든 명단에서 숨겨집니다.`)) return;
  try{
    if(X.test && X.test.uid!==uid){ await wipe(X.F, X.test.uid); await updateDoc(doc(X.F.db,'staff',X.test.uid), { isTest:false, cloneOf:deleteField() }); }
    await updateDoc(doc(X.F.db,'staff',uid), { isTest:true });
    await setDoc(doc(X.F.db,'systemConfig','testClone'), { uid, name:s.name||'', email:s.email||'', cloneOf:null, items:[] });
    await window.cloneTestMount('ca-clone'); window.toast && toast(`«${s.name}» 계정을 테스트 계정으로 지정했습니다`,'ok');
  }catch(e){ alert('지정 실패: '+(e.message||e)); }
};
window.ctCheckId = ()=>{
  const X = window.__ct; if(!X) return;
  const id = (document.getElementById('ct-idq')?.value||'').trim(); const out = document.getElementById('ct-idr'); if(!id||!out) return;
  const hit = X.staff.find(s=>idOf(s.email)===id);
  out.innerHTML = hit
    ? `✓ 교직원 기록이 있습니다 — <b>${esc(hit.name||'')}</b>${hit.isTest?' <span style="color:#C2410C">(🧪 테스트로 지정돼 명단에서 숨김)</span>':''}. 비밀번호를 모르면 이 계정을 쓰고 «🔑 새로 정하기»를 누르세요.${hit.isTest||hit.role==='super'?'':` <button class="bs" style="font-size:11px;padding:2px 8px" onclick="ctUse('${hit.uid}')">이 계정 쓰기</button>`}`
    : `⚠️ 교직원 기록이 없습니다 — <b>인증 장부에만 남은 계정</b>이에요. 다른 아이디(예: ${esc(id)}01)로 만들거나, Firebase 콘솔 → Authentication에서 «${esc(id)}@gyosa-seongyosa.staff»를 지우면 다시 쓸 수 있습니다.`;
};
window.ctResetPw = ()=>{
  const X = window.__ct; if(!X || !X.test) return;
  const sug = 'test' + Math.floor(1000 + Math.random()*9000);
  const bg = document.createElement('div');
  bg.style.cssText='position:fixed;inset:0;background:rgba(16,22,26,.45);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px';
  bg.addEventListener('click', e=>{ if(e.target===bg) bg.remove(); });
  bg.innerHTML = `<div style="background:#fff;border-radius:14px;padding:18px;max-width:380px;width:100%">
    <div style="font-size:15px;font-weight:900;color:#0F241F">🔑 테스트 계정 비밀번호 새로 정하기</div>
    <div style="font-size:12px;color:#5A6560;margin:5px 0 10px">아이디 <b>${esc(idOf(X.test.email))}</b> · 6자 이상 · 저장 후엔 다시 볼 수 없으니 적어두세요.</div>
    <input id="ct-pw" value="${sug}" style="width:100%;height:42px;border:1.5px solid #E3E1DA;border-radius:10px;padding:0 12px;font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:800">
    <div id="ct-pwr" style="font-size:12px;margin-top:8px"></div>
    <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
      <button onclick="this.closest('div[style*=fixed]').remove()" style="font-family:inherit;font-weight:800;border:1.5px solid #E3E1DA;background:#fff;border-radius:9px;padding:8px 14px;cursor:pointer">닫기</button>
      <button id="ct-pw-ok" style="font-family:inherit;font-weight:800;border:0;background:#C2410C;color:#fff;border-radius:9px;padding:8px 16px;cursor:pointer">정하기</button></div></div>`;
  document.body.appendChild(bg);
  document.getElementById('ct-pw-ok').onclick = async ()=>{
    const pw = (document.getElementById('ct-pw')?.value||'').trim(); const r = document.getElementById('ct-pwr');
    if(pw.length < 6){ r.innerHTML = '<span style="color:#B91C1C">6자 이상이어야 합니다</span>'; return; }
    r.textContent = '정하는 중…';
    try{
      const call = httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'adminResetPassword');
      await call({ targetUid: X.test.uid, newPassword: pw });
      r.innerHTML = `<span style="color:#166534;font-weight:800">✓ 완료 — 아이디 ${esc(idOf(X.test.email))} · 비밀번호 ${esc(pw)}</span><br><span style="color:#5A6560">시크릿 창에서 이 정보로 로그인하세요.</span>`;
      try{ window.logActivity && window.logActivity('보안','비밀번호','테스트 계정 비밀번호 재설정'); }catch(e){}
    }catch(e){ r.innerHTML = `<span style="color:#B91C1C">실패: ${esc(e.message||e)}</span>`; }
  };
};
function resultHTML(items, c){
  return `<div style="font-size:12.5px;font-weight:900;color:var(--gd);margin:4px 0 6px">✓ 마지막 복제 결과${c?` — ${esc(c.name)} 선생님 기준`:''}</div>
    <div style="border:1px solid var(--ivd);border-radius:11px;overflow:hidden">${items.map(it=>`
      <div style="display:flex;gap:9px;align-items:center;padding:7px 11px;border-bottom:1px solid #EFECE4;font-size:12px">
        <span style="width:18px;text-align:center">${it.ic}</span><span>${esc(it.t)}</span>
        <span style="margin-left:auto;font-size:10.5px;color:var(--tl);font-weight:700">${esc(it.w)}</span></div>`).join('')}</div>`;
}
window.cloneDo = async (pickedUid)=>{
  const X = window.__ct; if(!X || !X.test) return;
  const uid = pickedUid || document.getElementById('ct-target')?.value;
  if(!uid){ alert('선생님을 골라주세요'); return; }
  const target = X.pickable.find(s=>s.uid===uid); if(!target) return;
  if(target.role==='super'){ alert('슈퍼관리자 권한은 복제할 수 없습니다'); return; }
  if(!confirm(`테스트 계정에 «${target.name}» 선생님의 권한을 복제할까요?\n이전 복제는 먼저 걷어냅니다.`)) return;
  const box = document.getElementById('ct-result'); if(box) box.innerHTML = '<div style="padding:10px;color:#7C837E;font-size:12.5px">복제하는 중… (권한 지도를 훑고 있어요 · 10초쯤 걸립니다)</div>';
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
