/* ═══════════════════════════════════════════════
   parent-conn.js — 👨‍👩‍👧 학부모 «연결 현황판» (v122 · v123 · 학부모 관리 › 연결 현황)
   · 반편성의 반마다 서랍 한 줄: «3학년 샬롬반 · 12명 · 연결 10 · 코드 안 씀 2 · 살펴볼 것 1»
   · 서랍을 열면 학생마다 보호자 칸 두 개 — 그 자리에서 끊기 · 새 코드 · 코드표 인쇄 · 담임에게 알림
   · «살펴볼 것»은 저절로 찾아 준다: 새 코드(30일)가 안 쓰이고 만료 · 60일 넘게 접속 없음 · 보호자 칸 다 참(요청)
     (v123: 기한 없는 옛 코드는 언제 나눠 줬는지 몰라 «살펴볼 것»에 넣지 않고 «코드 안 씀»으로만 센다)
     · 졸업 · 자퇴인데 출입이 남음 · 반편성에 없음 · 한 계정에 세 가정 이상 · 코드 잠김
   · 🎫 코드 발급(30일짜리) · QR 코드표 인쇄도 여기서 (가입 코드 탭도 같은 함수를 씀)
   · 읽기: 열 때 한 번 모아 읽고 5분 동안은 다시 읽지 않는다 (↻ 새로 불러오기로 바로)
   · v124 «우리 반 학부모»(class-parents.html) — 담임 · 부담임이 자기 반 한 칸만 (loadClass · renderClassCard)
     · 그 반 학생 · 연결 · 코드만 읽는다 · 새 코드는 출입 서버가 만든다(teacherCode — 코드 문서 쓰기는 관리자뿐)
     · 연결 끊기 · 세 번째 보호자 승인은 지금처럼 관리자 화면에서
   ═══════════════════════════════════════════════ */
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, query, where, getDocs, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { gateCall, gateUrl, setGateUrl, gateHealth, gateRecalc } from './gate-client.js?v=122';

const DAY = 864e5;
const CODE_DAYS = 30, UNUSED_DAYS = 30, IDLE_DAYS = 60;
export const PARENT_URL = 'https://artist4rhythm-hub.github.io/daniel-parents';
let C = null;    // { db, CU, getOrg(), esc, ORG_L, $I }
export function init(ctx){ C = ctx; }
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msOf = t => !t ? 0 : typeof t === 'number' ? t : typeof t.toMillis === 'function' ? t.toMillis() : (t.seconds != null ? t.seconds * 1000 : 0);
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
const daysAgo = t => Math.floor((Date.now() - t) / DAY);
const rel = t => { if(!t) return '접속 기록 없음'; const d = daysAgo(t); return d <= 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`; };
const maskEmail = e => { const s = String(e || ''); const i = s.indexOf('@'); return i < 1 ? s : s.slice(0, Math.min(2, i)) + '***' + s.slice(i); };
const nat = (a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true });
// 반 이름이 같은 반(예: 부서마다 닛시반)을 가려 주는 꼬리표 — «초등부 · 1학년·2학년»
export const classSub = c => [c && c.dept && c.dept !== '전체' ? c.dept : '', (c && c.grade) || ''].filter(Boolean).join(' · ');
const cLabel = c => (c.name || '') + (classSub(c) ? ` (${classSub(c)})` : '');
const stOf = s => (window.StuStatus && window.StuStatus.status) ? window.StuStatus.status(s) : (s.status || 'active');

/* ═══ 데이터 ═══ */
export const S = { org: null, at: 0, year: 0, students: new Map(), classes: [], links: [], codes: new Map(), passes: new Map(),
  requests: [], locks: [], staff: new Map(), sweep: null, gate: '', open: new Set(), loaded: false, teacher: false };
async function classesNow(db, org){
  const y = new Date().getFullYear();
  for(const yy of [y, y - 1]){
    const q = await getDocs(query(collection(db, 'classes'), where('year', '==', yy)));
    const list = q.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(c => (c.org || 'daniel') === org && !c.deleted);
    if(list.length) return { year: yy, list: list.sort((a, b) => nat(a.name || '', b.name || '') || nat(a.grade || '', b.grade || '') || nat(a.dept || '', b.dept || '')) };
  }
  return { year: y, list: [] };
}
export async function load(force){
  const db = C.db, ORG = C.getOrg();
  if(!force && S.loaded && !S.teacher && S.org === ORG && Date.now() - S.at < 5 * 60e3) return S;
  S.teacher = false;
  const safe = p => p.catch(e => { console.warn('[연결 현황]', e && e.message); return null; });
  const [stu, cls, lk, jc, pa, rq, gl, st, sw, gt] = await Promise.all([
    getDocs(query(collection(db, 'students'), where('org', '==', ORG))),
    classesNow(db, ORG),
    getDocs(query(collection(db, 'parentLinks'), where('org', '==', ORG))),
    safe(getDocs(query(collection(db, 'joinCodes'), where('org', '==', ORG)))),
    safe(getDocs(query(collection(db, 'parentAccess'), where('orgs', 'array-contains', ORG)))),
    safe(getDocs(query(collection(db, 'parentRequests'), where('org', '==', ORG), where('status', '==', 'pending')))),
    safe(getDocs(collection(db, 'parentGate'))),
    safe(getDocs(collection(db, 'staff'))),
    safe(getDoc(doc(db, 'parentConfig', 'sweep'))),
    gateUrl(true),
  ]);
  S.org = ORG; S.at = Date.now(); S.loaded = true; S.gate = gt || '';
  S.students = new Map(); stu.docs.forEach(d => { const v = d.data(); if(!v.deleted) S.students.set(d.id, Object.assign({ id: d.id }, v)); });
  S.year = cls.year; S.classes = cls.list;
  S.links = lk.docs.map(d => Object.assign({ id: d.id }, d.data()));
  S.codes = new Map(); if(jc) jc.docs.forEach(d => S.codes.set(d.id, d.data()));
  S.passes = new Map(); if(pa) pa.docs.forEach(d => S.passes.set(d.id, d.data()));
  S.requests = rq ? rq.docs.map(d => Object.assign({ id: d.id }, d.data())) : [];
  S.locks = gl ? gl.docs.map(d => Object.assign({ uid: d.id }, d.data())).filter(g => msOf(g.lockUntil) > Date.now()) : [];
  S.staff = new Map(); if(st) st.docs.forEach(d => S.staff.set(d.id, d.data()));
  S.sweep = sw && sw.exists() ? sw.data() : null;
  return S;
}
export function invalidate(){ S.at = 0; }

/* 👩‍🏫 v124 담임 모드 — 반 한 칸만 (그 반 학생 · 연결 · 코드 · 출입증) */
export async function loadClass(cls){
  const db = C.db, ids = [...new Set((cls && cls.students) || [])];
  S.teacher = true; S.loaded = true; S.at = Date.now(); S.org = (cls && cls.org) || 'daniel';
  S.year = Number((cls && cls.year) || 0); S.classes = cls ? [cls] : []; S.open = new Set(cls ? [cls.id] : []);
  const safe = p => p.catch(e => { console.warn('[우리 반 학부모]', e && e.message); return null; });
  const stu = await Promise.all(ids.map(id => safe(getDoc(doc(db, 'students', id)))));
  S.students = new Map(); stu.forEach(d => { if(d && d.exists()){ const v = d.data(); if(!v.deleted) S.students.set(d.id, Object.assign({ id: d.id }, v)); } });
  S.links = [];
  for(let i = 0; i < ids.length; i += 30){
    const q = await safe(getDocs(query(collection(db, 'parentLinks'), where('studentId', 'in', ids.slice(i, i + 30)))));
    if(q) q.docs.forEach(d => S.links.push(Object.assign({ id: d.id }, d.data())));
  }
  const codes = [...new Set([...S.students.values()].map(s => s.joinCode).filter(Boolean))];
  S.codes = new Map();
  (await Promise.all(codes.map(c => safe(getDoc(doc(db, 'joinCodes', c)))))).forEach(d => { if(d && d.exists()) S.codes.set(d.id, d.data()); });
  const uids = [...new Set(S.links.filter(l => l.status === 'active').map(l => l.parentUid).filter(Boolean))];
  S.passes = new Map();
  (await Promise.all(uids.map(u => safe(getDoc(doc(db, 'parentAccess', u)))))).forEach(d => { if(d && d.exists()) S.passes.set(d.id, d.data()); });
  S.requests = []; S.locks = []; S.sweep = null;
  S.staff = new Map();
  const tids = [...new Set([cls && cls.teacherUid, ...((cls && cls.deputies) || [])].filter(Boolean))];
  (await Promise.all(tids.map(u => safe(getDoc(doc(db, 'staff', u)))))).forEach(d => { if(d && d.exists()) S.staff.set(d.id, d.data()); });
  S.gate = (await gateUrl(true)) || '';
  return S;
}
// 반 단톡방에 붙여 넣을 안내 문구
export function guideText(cls){
  const org = (cls && cls.org) || C.getOrg(), page = `login-${org === 'jihyebit' ? 'jihyebit' : 'daniel'}.html`;
  const label = cls ? [classSub(cls).replace(' · ', ' '), cls.name].filter(Boolean).join(' ') : '';
  return `[${(C.ORG_L || {})[org] || ''} 학부모 서비스 연결 안내]
${label} 학부모님, 학교 소식과 우리 반 게시판을 휴대폰으로 보실 수 있어요.
① 가정통신문에 붙은 QR을 휴대폰 카메라로 찍어 주세요
② «구글로 계속하기»로 로그인해요 (구글 계정이 없으면 이메일)
③ 자녀 이름을 확인하고 «연결하기»
QR 코드표를 못 받으셨거나 잃어버리셨으면 담임에게 말씀해 주세요.
${PARENT_URL}/${page}`;
}
window.pcCopyGuide = async () => {
  const t = guideText(S.classes[0]);
  try{ await navigator.clipboard.writeText(t); say(true, '📋 안내 문구를 복사했어요 — 반 단톡방에 붙여 넣으세요.'); }
  catch(e){ window.prompt('아래 문구를 복사해 주세요', t); }
};
/* 담임 화면 «학부모 연결» 카드 — 학생 한 줄마다 보호자 칸 두 개 · 그 자리에서 코드표 · 새 코드 */
export function renderClassCard(el){
  const c = S.classes[0]; if(!el) return;
  if(!c){ el.innerHTML = '<div class="pc-empty">반을 골라 주세요.</div>'; return; }
  const t = classStats(c.students || [], true);
  const pct = t.n ? Math.round(t.con / t.n * 100) : 0;
  const unused = unusedOf(c.students || []);
  const rows = t.stu.sort((a, b) => (flagsOf(b, true).length ? 1 : 0) - (flagsOf(a, true).length ? 1 : 0) || nat(a.name || '', b.name || '')).map(s => {
    const L = activeLinks(s.id), ci = codeInfo(s), f = flagsOf(s, true), st = stOf(s);
    const slots = L.map(slotHTML);
    if(!L.length) slots.push(`<span class="pc-sl no">${!ci ? '코드 없음' : ci.expired ? '코드 만료' : '코드 안 씀'}</span>`);
    while(slots.length < 2) slots.push('<span class="pc-sl em">빈 칸</span>');
    const badge = st === 'leave' ? '<span class="pc-b lv">휴학</span>' : (st === 'grad' || st === 'egrad') ? '<span class="pc-b gd">졸업</span>' : st === 'quit' ? '<span class="pc-b qt">자퇴</span>' : '';
    const acts = [];
    if(!L.length && (st === 'active' || st === 'leave')) acts.push(`<button class="pc-x" onclick="pcPrint(['${s.id}'])">🖨 코드표</button>`);
    if((st === 'active' || st === 'leave') && (!ci || ci.expired || !ci.active || L.length)) acts.push(`<button class="pc-x" onclick="pcNewCode('${s.id}')">${ci ? '새 코드' : '＋ 코드'}</button>`);
    if(f.some(x => x.k === 'ended')) acts.push(`<button class="pc-x dg" onclick="pcClose('${s.id}')">지금 닫기</button>`);
    return `<div class="cp-r ${f.length ? 'fl' : ''}"><div class="cp-n"><b>${esc(s.name || '')}</b>${badge}${f.length ? `<div class="pc-why">${f.map(x => `<span>${esc(x.t)}</span>`).join('')}</div>` : ''}</div>
      <div class="cp-s">${slots.slice(0, 2).join('')}${slots.length > 2 ? slots.slice(2).join('') : ''}</div>
      <div class="cp-a">${ci ? `<span class="cp-code" title="${ci.exp ? (ci.expired ? '만료됨' : md(ci.exp) + '까지') : '옛 코드 · 기한 없음'}">${esc(ci.code)}</span>` : ''}${acts.join('')}</div></div>`;
  }).join('');
  el.innerHTML = `<div class="cp-ch"><b>👨‍👩‍👧 학부모 연결</b><span class="cp-sp"></span><span class="cp-mut">보호자 한 분 이상</span></div>
    <div class="cp-big">${t.con} <small>/ ${t.n}가정</small></div><div class="cp-pg"><i style="width:${pct}%"></i></div>
    ${rows || '<div class="pc-empty">이 반에 학생이 없어요.</div>'}
    <div class="cp-ft">${unused.length ? `<button class="pc-b2" onclick="pcPrintClass('${c.id}')">🖨 안 쓴 ${unused.length}가정 코드표 인쇄</button>` : '<span class="cp-ok">🎉 모든 가정이 연결됐어요</span>'}
      <button class="pc-b2" onclick="pcPrintClass('${c.id}', true)">🖨 반 전체 코드표</button>
      <button class="pc-b2" onclick="pcCopyGuide()">📋 안내 문구 복사</button>
      <button class="pc-b2" onclick="pcReload()">↻ 새로 불러오기</button></div>
    <div class="msg" id="pc-msg"></div>
    <div class="cp-note">코드는 30일 동안 쓸 수 있어요. 연결 끊기 · 세 번째 보호자 승인은 관리자(학부모 관리)가 해요 — 필요하면 관리자에게 알려 주세요.</div>`;
}

/* ── 학생 하나의 그림 ── */
const activeLinks = sid => S.links.filter(l => l.studentId === sid && l.status === 'active')
  .sort((a, b) => msOf(a.linkedAt) - msOf(b.linkedAt));
function codeInfo(s){
  const c = s.joinCode ? S.codes.get(s.joinCode) : null;
  if(!s.joinCode) return null;
  const created = msOf(c && c.createdAt), exp = msOf(c && c.expiresAt);
  return { code: s.joinCode, created, exp, expired: !!exp && exp < Date.now(), active: !c || c.active !== false };
}
// 한 계정에 «세 가정 이상» — 형제자매(학생관리의 형제 연결)는 한 가정으로 센다
function familyCount(uid){
  const sids = [...new Set(S.links.filter(l => l.parentUid === uid && l.status === 'active').map(l => l.studentId))];
  const parent = new Map(sids.map(x => [x, x]));
  const find = x => { while(parent.get(x) !== x) x = parent.get(x); return x; };
  sids.forEach(a => { const s = S.students.get(a); (s && s.siblings || []).forEach(b => { if(parent.has(b)) parent.set(find(a), find(b)); }); });
  return new Set(sids.map(find)).size;
}
function lastSeenOf(uid){ const p = S.passes.get(uid); return msOf(p && p.lastSeenAt); }
function flagsOf(s, inRoster){
  const f = [];
  const L = activeLinks(s.id), st = stOf(s), ci = codeInfo(s);
  if(!L.length && ci && ci.active && ci.exp && (ci.expired || (ci.created && daysAgo(ci.created) >= UNUSED_DAYS)))   // 옛 코드(기한 없음)는 세지 않음
    f.push({ k: 'unused', t: ci.expired ? '코드 만료 · 아직 연결 안 됨' : `코드 받고 ${daysAgo(ci.created)}일째 안 씀` });
  L.forEach(l => {
    const seen = Math.max(lastSeenOf(l.parentUid), msOf(l.linkedAt));
    if(seen && daysAgo(seen) >= IDLE_DAYS) f.push({ k: 'idle', t: `${maskEmail(l.parentEmail)} ${daysAgo(seen)}일 접속 없음`, uid: l.parentUid });
    if((st === 'grad' || st === 'egrad' || st === 'quit') && !l.end) f.push({ k: 'ended', t: `${st === 'quit' ? '자퇴' : '졸업'}인데 출입이 남음`, lid: l.id });
    if(l.end && msOf(l.end.viewUntil) < Date.now()) f.push({ k: 'ended', t: '연결 기간이 끝났는데 남음', lid: l.id });
    if(familyCount(l.parentUid) >= 3) f.push({ k: 'multi', t: `${maskEmail(l.parentEmail)} 한 계정에 ${familyCount(l.parentUid)}가정`, uid: l.parentUid });
  });
  if(S.requests.some(r => r.studentId === s.id)) f.push({ k: 'full', t: '보호자 «한 칸 더» 요청' });
  if(!inRoster && L.length && (st === 'active' || st === 'leave')) f.push({ k: 'roster', t: `${S.year}년 반편성에 없음 — 반 게시판이 안 열려요` });
  return f;
}

/* ═══ 그리기 ═══ */
function slotHTML(l){
  const seen = Math.max(lastSeenOf(l.parentUid), 0);
  const idle = Math.max(seen, msOf(l.linkedAt)) && daysAgo(Math.max(seen, msOf(l.linkedAt))) >= IDLE_DAYS;
  const grace = l.end && l.end.why === 'grad';
  const who = (S.passes.get(l.parentUid) || {}).relation || '';
  return `<span class="pc-sl ${idle ? 'wt' : ''} ${grace ? 'gr' : ''}" title="${esc(l.parentEmail || '')} · 연결 ${md(msOf(l.linkedAt))}${l.linkedVia === 'approval' ? ' · 승인' : ''}">
    ${esc(maskEmail(l.parentEmail || '(메일 없음)'))}${who ? ' <i>' + esc(who) + '</i>' : ''}
    <small>· ${grace ? '졸업 · ' + md(msOf(l.end.viewUntil)) + '까지 보기만' : (seen ? rel(seen) : '연결 ' + md(msOf(l.linkedAt)))}</small>
    ${S.teacher ? '' : `<button class="pc-xx" title="이 보호자 연결 끊기" onclick="pcUnlink('${esc(l.id)}')">✕</button>`}</span>`;
}
function rowHTML(s, inRoster){
  const L = activeLinks(s.id), ci = codeInfo(s), f = flagsOf(s, inRoster), st = stOf(s);
  const slots = [];
  L.forEach(l => slots.push(slotHTML(l)));
  if(!L.length && ci) slots.push(`<span class="pc-sl no">${ci.expired ? '코드 만료' : '코드 안 씀'}${ci.exp && ci.created ? ` · ${daysAgo(ci.created)}일째` : ''}</span>`);
  if(!L.length && !ci) slots.push('<span class="pc-sl no">코드 없음</span>');
  while(slots.length < 2) slots.push('<span class="pc-sl em">빈 칸</span>');
  const badge = st === 'leave' ? '<span class="pc-b lv">휴학</span>' : (st === 'grad' || st === 'egrad') ? '<span class="pc-b gd">졸업</span>' : st === 'quit' ? '<span class="pc-b qt">자퇴</span>' : '';
  const acts = [];
  if(f.some(x => x.k === 'unused') || (!L.length && ci)) acts.push(`<button class="pc-x" onclick="pcPrint(['${s.id}'])">🖨 코드 인쇄</button>`);
  if(!ci || ci.expired || !ci.active) acts.push(`<button class="pc-x" onclick="pcNewCode('${s.id}')">${ci ? '새 코드' : '＋ 코드'}</button>`);
  else if(L.length) acts.push(`<button class="pc-x" onclick="pcNewCode('${s.id}')">새 코드</button>`);
  if(f.some(x => x.k === 'ended')) acts.push(`<button class="pc-x dg" onclick="pcClose('${s.id}')">지금 닫기</button>`);
  if(f.some(x => x.k === 'idle' || x.k === 'unused')) acts.push(`<button class="pc-x" onclick="pcTell('${s.id}')">담임에게 알림</button>`);
  return `<tr class="${f.length ? 'fl' : ''}"><td class="pc-nm"><b>${esc(s.name || '')}</b>${badge}
      ${f.length ? `<div class="pc-why">${f.map(x => `<span>${esc(x.t)}</span>`).join('')}</div>` : ''}</td>
    <td>${slots.slice(0, 1).join('')}</td><td>${slots.slice(1).join(' ')}</td>
    <td class="pc-code">${ci ? `${esc(ci.code)}<small>${ci.exp ? (ci.expired ? '만료됨' : md(ci.exp) + '까지') : '옛 코드 · 기한 없음'}</small>` : '—'}</td>
    <td class="pc-acts">${acts.join('')}</td></tr>`;
}
function classStats(ids, inRoster){
  const stu = ids.map(id => S.students.get(id)).filter(Boolean);
  const con = stu.filter(s => activeLinks(s.id).length).length;
  const unused = stu.filter(s => !activeLinks(s.id).length && s.joinCode).length;
  const flagged = stu.filter(s => flagsOf(s, inRoster).length).length;
  return { n: stu.length, con, unused, flagged, stu };
}
function drawerHTML(key, title, sub, ids, inRoster, footer){
  const t = classStats(ids, inRoster);
  if(!t.n) return '';
  const open = S.open.has(key);
  const pct = t.n ? Math.round(t.con / t.n * 100) : 0;
  const flag = t.flagged ? `<span class="pc-flag">살펴볼 것 ${t.flagged}</span>` : t.unused ? `<span class="pc-flag n">코드 안 씀 ${t.unused}</span>` : '<span class="pc-flag g">문제 없음</span>';
  const rows = t.stu.sort((a, b) => (flagsOf(b, inRoster).length ? 1 : 0) - (flagsOf(a, inRoster).length ? 1 : 0) || nat(a.name || '', b.name || ''))
    .map(s => rowHTML(s, inRoster)).join('');
  return `<div class="pc-dr ${open ? 'open' : ''}" id="pcd-${esc(key)}">
    <div class="pc-dh" onclick="pcToggle('${esc(key)}')"><span class="pc-ar">${open ? '▾' : '▸'}</span><span class="pc-cn">${esc(title)}</span><span class="pc-tc" title="${esc(sub)}">${esc(sub)}</span>
      <span class="pc-prog"><i style="width:${pct}%"></i></span><span class="pc-nums"><b>${t.n}명</b> · 연결 <b>${t.con}</b> · 코드 안 씀 <b>${t.unused}</b></span>${flag}</div>
    ${open ? `<div class="pc-db"><div style="overflow-x:auto"><table class="pc-t"><tr><th style="width:150px">학생</th><th>보호자 1</th><th>보호자 2</th><th style="width:150px">코드</th><th style="width:190px"></th></tr>${rows}</table></div>
      <div class="pc-ft">${footer}</div></div>` : ''}
  </div>`;
}
function staffName(uid){ const s = S.staff.get(uid); return s ? (s.name || '') : ''; }
export function renderBoard(pane){
  const ORG = C.getOrg(), ORG_L = C.ORG_L;
  const enrolled = [...S.students.values()].filter(s => { const st = stOf(s); return st === 'active' || st === 'leave'; });
  const inRosterIds = new Set(S.classes.flatMap(c => c.students || []));
  const conStu = enrolled.filter(s => activeLinks(s.id).length);
  const unusedStu = enrolled.filter(s => !activeLinks(s.id).length && s.joinCode);
  const monthStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); })();
  const newThisMonth = S.links.filter(l => l.status === 'active' && msOf(l.linkedAt) >= monthStart).length;
  const outIds = [...S.students.values()].filter(s => !inRosterIds.has(s.id) && (activeLinks(s.id).length || ((stOf(s) === 'active' || stOf(s) === 'leave') && s.joinCode))).map(s => s.id);
  const allFlagged = [...S.students.values()].filter(s => flagsOf(s, inRosterIds.has(s.id)).length).length;
  const todo = allFlagged + S.requests.length + S.locks.length;
  const sweepAt = S.sweep ? msOf(S.sweep.at) : 0;
  const isSuper = C.CU.role === 'super';
  const gateCard = `<div class="pc-gate">
    <div class="pc-gh">🎫 출입 서버 <span class="pc-gs" id="pc-gs">${S.gate ? '주소 있음 · 확인 중…' : '<b class="no">아직 주소가 없어요</b>'}</span></div>
    <div class="cd" style="margin:4px 0 8px">학부모가 자녀를 연결하고 «출입증»을 받는 서버입니다 (Cloud Shell 로 배포 · 배포 안내 5번).
      주소를 넣고 «↻ 지금 점검»을 한 번 누르면 지금 연결된 학부모 모두에게 출입증이 생겨요.</div>
    <div class="row"><input type="url" id="pc-gate-url" value="${esc(S.gate)}" placeholder="https://parent-gate-….run.app" ${isSuper ? '' : 'disabled'} style="max-width:460px">
      ${isSuper ? '<button class="btn" onclick="pcSaveGate()">저장</button>' : ''}<button class="btn sub" onclick="pcCheckGate()">연결 확인</button></div>
    <div class="msg" id="pc-gate-msg"></div></div>`;
  const top = (S.requests.length || S.locks.length) ? `<div class="pc-top"><div class="pc-th">지금 처리할 것</div>
    ${S.requests.map(r => `<div class="pc-ti"><span class="pc-ic">👨‍👩‍👧</span><div class="pc-tt"><b>${esc(r.studentName || '')}</b> ${esc([r.grade, r.className].filter(Boolean).join(' '))} — 세 번째 보호자 요청
      <small>${esc(r.parentName || '')}${r.relation ? ' (' + esc(r.relation) + ')' : ''} · ${esc(r.email || '')} · ${md(msOf(r.at))}</small></div>
      <button class="btn" style="padding:7px 13px" onclick="pcApprove('${esc(r.id)}',true)">한 칸 더 열기</button><button class="btn sub" style="padding:7px 13px" onclick="pcApprove('${esc(r.id)}',false)">거절</button></div>`).join('')}
    ${S.locks.map(g => `<div class="pc-ti"><span class="pc-ic">🔒</span><div class="pc-tt"><b>${esc(g.email || g.uid)}</b> — 코드를 여러 번 틀려 잠김
      <small>${new Date(msOf(g.lockUntil)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}에 저절로 풀려요</small></div>
      <button class="btn sub" style="padding:7px 13px" onclick="pcUnlock('${esc(g.uid)}')">잠금 풀기</button></div>`).join('')}</div>` : '';
  const drawers = S.classes.map(c => {
    const t = staffName(c.teacherUid);
    return drawerHTML(c.id, c.name || '(이름 없음)', [classSub(c), t ? '담임 ' + t : ''].filter(Boolean).join(' · '), c.students || [], true,
      `<button class="pc-b2" onclick="pcPrintClass('${c.id}')">🖨 이 반 안 쓴 코드만 인쇄</button>
       <button class="pc-b2" onclick="pcTellClass('${c.id}')">✉️ 담임에게 연결 안 된 명단 보내기</button>
       <button class="pc-b2" onclick="pcReissueClass('${c.id}')">↻ 이 반 전체 새 코드</button>`);
  }).join('') + drawerHTML('__out', `${S.year}년 반편성에 없는 학생`, '반 게시판 대신 기관 전체 게시판만', outIds, false,
      `<button class="pc-b2" onclick="pcPrint(${esc(JSON.stringify(outIds))})">🖨 안 쓴 코드 인쇄</button>`);
  pane.innerHTML = `<div class="card">
    <div class="ct">👨‍👩‍👧 연결 현황 — ${esc(ORG_L[ORG])} <span class="pc-yr">${S.year}년 반편성 기준</span></div>
    <div class="pc-tiles">
      <div class="pc-tile g"><div class="l">연결된 학생</div><div class="n">${conStu.length} <small>/ ${enrolled.length}명</small></div><div class="s">보호자 한 분 이상</div></div>
      <div class="pc-tile"><div class="l">코드 안 씀</div><div class="n">${unusedStu.length}</div><div class="s">코드를 받고 아직 연결 안 함</div></div>
      <div class="pc-tile ${todo ? 'o' : ''}"><div class="l">살펴볼 것</div><div class="n">${todo}</div><div class="s">${todo ? '아래 서랍에 주황색 표시' : '오늘은 없어요'}</div></div>
      <div class="pc-tile"><div class="l">이번 달 새 연결</div><div class="n">${newThisMonth}</div><div class="s">${sweepAt ? '마지막 전체 점검 ' + md(sweepAt) + ' ' + new Date(sweepAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '전체 점검 기록 없음'}</div></div>
    </div>
    ${top}
    <div class="pc-bar"><button class="pc-b2" onclick="pcAll(true)">모두 펼치기</button><button class="pc-b2" onclick="pcAll(false)">모두 접기</button>
      <button class="pc-b2" onclick="pcPrintAll()">🖨 안 쓴 코드 모아 인쇄</button><span style="flex:1"></span>
      <button class="pc-b2" onclick="pcReload()">↻ 새로 불러오기</button>
      <button class="btn" onclick="pcSweep()" title="모든 학부모의 출입증을 지금 학생 상태 · 반편성으로 다시 계산">↻ 지금 점검</button></div>
    <div class="msg" id="pc-msg"></div>
    ${drawers || `<div class="empty">${S.year}년 반편성이 아직 없어요.<br>반편성에서 반을 만들고 학생을 넣으면 여기에 반별로 보입니다.</div>`}
    ${gateCard}
  </div>`;
  // 서버 상태 표시
  if(S.gate) gateHealth(S.gate).then(j => { const el = C.$I('pc-gs'); if(!el) return;
    el.innerHTML = j && j.ok ? `<b class="ok">연결됨</b> · v${esc(j.version || '')}` : '<b class="no">닿지 않음</b> — 주소를 확인해 주세요'; });
}

/* ═══ 동작 ═══ */
const say = (ok, t) => { const m = C.$I('pc-msg'); if(!m) return; m.className = 'msg ' + (ok ? 'ok' : 'err'); m.innerHTML = t; };
// 연결 현황판이 화면에 있을 때만 다시 그린다 (가입 코드 탭에서 부르면 그 탭이 알아서 고침)
async function rerender(force){
  if(S.teacher){ if(force) await loadClass(S.classes[0]); if(C.onChange) C.onChange(); return; }
  if(!C.$I('pc-msg')){ if(force) await load(true); if(C.onChange) C.onChange(); return; }
  const pane = C.$I('pane'); if(force) await load(true); renderBoard(pane);
}
window.pcToggle = key => { if(S.open.has(key)) S.open.delete(key); else S.open.add(key); rerender(); };
window.pcAll = on => { S.open = on ? new Set([...S.classes.map(c => c.id), '__out']) : new Set(); rerender(); };
window.pcReload = async () => { await rerender(true); };
window.pcUnlink = async lid => {
  const l = S.links.find(x => x.id === lid); if(!l) return;
  if(!confirm(`${l.studentName || ''} 학생의 보호자 연결(${l.parentEmail || ''})을 끊을까요?\n학부모는 그 자녀 게시판에 바로 들어올 수 없게 됩니다.`)) return;
  try{
    await updateDoc(doc(C.db, 'parentLinks', lid), { status: 'revoked', revokedAt: Timestamp.now(), revokedBy: C.CU.name || '' });
    l.status = 'revoked';
    // 출입증을 바로 다시 계산 (기다렸다가 결과를 알려 드린다)
    const j = await gateCall('recalc', { studentIds: [l.studentId] });
    const s = S.students.get(l.studentId);
    // 같은 코드로 다른 계정이 다시 연결하지 못하게 — 코드도 새로 (이미 연결된 다른 보호자는 그대로)
    let codeTip = '';
    if(s && s.joinCode){
      if(confirm(`이 학생 코드(${s.joinCode})도 새로 바꿀까요?\n같은 코드로 다른 계정이 다시 연결하지 못하게 합니다 (권장).\n이미 연결된 다른 보호자는 그대로예요.`)){
        try{ const nc = await issueCode(s); codeTip = ` · 새 코드 <b>${esc(nc)}</b> — <a href="#" onclick="pcPrint(['${l.studentId}']);return false">🖨 인쇄</a>`; }catch(e){ codeTip = ' · 코드는 바꾸지 못했어요'; }
      } else codeTip = ` · 코드(${esc(s.joinCode)})는 그대로 — <a href="#" onclick="pcNewCode('${l.studentId}');return false">🔄 코드도 바꾸기</a>`;
    }
    await rerender();
    if(j.ok || j.error === 'no-gate') say(true, `✅ 연결을 끊었어요 — ${esc(l.studentName || '')} · ${esc(l.parentEmail || '')}${j.ok ? ' (출입증도 바로 닫힘)' : ''}${codeTip}`);
    else say(false, `연결은 끊었지만 출입증을 바로 닫지 못했어요 (${esc(j.error || '')}) — 잠시 뒤 «↻ 지금 점검»을 눌러 주세요.${codeTip}`);
  }catch(e){ say(false, '끊지 못했어요: ' + esc(e.message || '')); }
};
window.pcClose = async sid => { gateRecalc([sid]); say(true, '⏳ 출입증을 다시 계산하고 있어요 — 잠시 뒤 «↻ 새로 불러오기»'); setTimeout(() => rerender(true), 2500); };

/* 🎫 코드 — 30일짜리 · 반편성의 반 · 학년을 함께 싣는다 */
function genJoinCode(org){
  const prefix = org === 'daniel' ? 'DA' : org === 'jihyebit' ? 'JH' : 'ST';
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const pick = n => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${pick(2)}-${pick(4)}`;
}
async function genUnique(org){
  for(let i = 0; i < 8; i++){ const c = genJoinCode(org);
    try{ const ex = await getDoc(doc(C.db, 'joinCodes', c)); if(!ex.exists()) return c; }catch(e){ return c; } }
  return genJoinCode(org) + Math.floor(Math.random() * 9);
}
export function classOf(sid){ return S.classes.find(c => (c.students || []).includes(sid)) || null; }
const CODE_ERR = { 'not-your-class':'우리 반 학생이 아니에요', ended:'졸업 · 자퇴한 학생이에요', 'no-gate':'출입 서버 주소가 없어요 (관리자에게 알려 주세요)', network:'출입 서버에 닿지 않아요', 'staff-only':'교직원만 만들 수 있어요' };
export async function issueCode(s, opt = {}){
  const org = s.org || C.getOrg();
  if(S.teacher){
    const j = await gateCall('teacherCode', { studentId: s.id });
    if(j && j.ok && j.newCode){
      const data = { code: j.newCode, studentId: s.id, org, studentName: s.name || '', grade: j.grade || '', className: j.className || '', classId: j.classId || '',
        active: true, createdAt: Timestamp.fromMillis(j.createdAt), expiresAt: Timestamp.fromMillis(j.expiresAt), createdBy: C.CU.name || '' };
      if(s.joinCode && S.codes.get(s.joinCode)) S.codes.get(s.joinCode).active = false;
      s.joinCode = j.newCode; const st = S.students.get(s.id); if(st) st.joinCode = j.newCode;
      S.codes.set(j.newCode, data);
      return j.newCode;
    }
    const adminRole = C.CU && (C.CU.role === 'super' || C.CU.role === 'org_admin');
    if(!(adminRole && j && j.error === 'no-gate')) throw new Error(CODE_ERR[(j && j.error) || ''] || ((j && j.error) || '서버 오류'));
  }
  if(s.joinCode && opt.revokeOld !== false){
    try{ await updateDoc(doc(C.db, 'joinCodes', s.joinCode), { active: false, revokedAt: Timestamp.now(), revokedBy: C.CU.name || '' }); }catch(e){}
  }
  const c = classOf(s.id);
  const code = await genUnique(org), now = Date.now();
  const data = { code, studentId: s.id, org, studentName: s.name || '',
    grade: c ? String((c.grades && c.grades[s.id]) || c.grade || '') : (s.grade || ''), className: c ? String(c.name || '') : (s.className || ''), classId: c ? c.id : '',
    active: true, createdAt: Timestamp.fromMillis(now), expiresAt: Timestamp.fromMillis(now + CODE_DAYS * DAY), createdBy: C.CU.name || '' };
  await setDoc(doc(C.db, 'joinCodes', code), data);
  await updateDoc(doc(C.db, 'students', s.id), { joinCode: code });
  s.joinCode = code;
  const st = S.students.get(s.id); if(st) st.joinCode = code;
  S.codes.set(code, data);
  return code;
}
window.pcNewCode = async sid => {
  const s = S.students.get(sid); if(!s) return;
  if(s.joinCode && !confirm(`${s.name} 학생에게 새 코드를 만들까요?\n지금 코드(${s.joinCode})는 쓸 수 없게 됩니다 — 이미 연결된 보호자는 그대로예요.`)) return;
  try{ const code = await issueCode(s); rerender(); say(true, `✅ ${esc(s.name)} — 새 코드 <b>${esc(code)}</b> (30일 동안) · <a href="#" onclick="pcPrint(['${sid}']);return false">🖨 바로 인쇄</a>`); }
  catch(e){ say(false, '만들지 못했어요: ' + esc(e.message || '')); }
};
window.pcReissueClass = async cid => {
  const c = S.classes.find(x => x.id === cid); if(!c) return;
  const list = (c.students || []).map(id => S.students.get(id)).filter(s => s && ['active', 'leave'].includes(stOf(s)));
  if(!list.length) return;
  if(!confirm(`${cLabel(c)} ${list.length}명 모두 새 코드를 만들까요?\n지금 코드는 쓸 수 없게 됩니다 — 이미 연결된 보호자는 그대로예요.`)) return;
  window.showLoading && window.showLoading('새 코드를 만드는 중…');
  let ok = 0;
  for(const s of list){ try{ await issueCode(s); ok++; window.setLoadDetail && window.setLoadDetail(`${ok} / ${list.length}명`); }catch(e){} }
  window.hideLoading && window.hideLoading();
  rerender(); say(true, `✅ ${ok}명에게 새 코드를 만들었어요 — <a href="#" onclick="pcPrintClass('${cid}', true);return false">🖨 이 반 코드표 인쇄</a>`);
};

/* 🖨 코드표 — 학생마다 한 장 (QR · 코드 · 하는 법) · 오려서 가정통신문에 붙이기 좋게 */
export async function printSlips(list, title){
  const ORG = C.getOrg(), ORG_L = C.ORG_L;
  list = list.filter(Boolean);
  const noCode = list.filter(s => !s.joinCode || (codeInfo(s) || {}).expired);
  if(noCode.length && confirm(`${noCode.length}명은 쓸 수 있는 코드가 없어요 (없음 · 만료).\n지금 새 코드를 만들어 함께 인쇄할까요?`)){
    window.showLoading && window.showLoading('코드를 만드는 중…');
    for(const s of noCode){ try{ await issueCode(s); }catch(e){} }
    window.hideLoading && window.hideLoading();
  }
  const ready = list.filter(s => s.joinCode && !(codeInfo(s) || {}).expired);
  if(!ready.length){ alert('인쇄할 코드가 없어요.'); return; }
  const page = `login-${ORG === 'jihyebit' ? 'jihyebit' : 'daniel'}.html`;
  const slip = s => {
    const ci = codeInfo(s) || {}; const c = classOf(s.id);
    const url = `${PARENT_URL}/${page}?code=${encodeURIComponent(s.joinCode)}`;
    const q = window.QR ? window.QR.svg(url, { px: 118, margin: 2 }) : '';
    const cls = c ? [String((c.grades && c.grades[s.id]) || c.grade || ''), c.name].filter(Boolean).join(' ') : '';
    return `<div class="slip"><div class="slip-h">${esc(ORG_L[ORG])} 학부모 서비스 · 자녀 연결 안내</div>
      <div class="slip-b"><div class="slip-qr">${q}</div><div class="slip-r">
        <div class="slip-n">${esc(s.name || '')} <small>${esc(cls)}</small></div>
        <div class="slip-c">${esc(s.joinCode)}</div>
        <ol><li>휴대폰 <b>카메라로 QR</b>을 찍어요</li><li><b>«구글로 계속하기»</b>로 로그인해요 <span>(구글 계정이 없으면 이메일)</span></li><li>자녀 이름을 확인하고 <b>«연결하기»</b></li></ol>
        <div class="slip-f">QR이 안 되면: ${esc(PARENT_URL.replace(/^https:\/\//, ''))}/${page} 에서 코드 입력${ci.exp ? ` · <b>${md(ci.exp)}까지</b> 사용` : ''}<br>코드는 우리 자녀 연결에만 쓰여요 — 다른 가정과 나누지 마세요.</div>
      </div></div></div>`;
  };
  const pa = C.$I('print-area');
  pa.style.display = 'block';
  pa.innerHTML = `<style>
    #print-area .slips{display:grid;grid-template-columns:1fr 1fr;gap:10px;font-family:inherit;padding:8px}
    #print-area .slip{border:1.5px dashed #999;border-radius:12px;padding:12px 13px;break-inside:avoid;page-break-inside:avoid;color:#111}
    #print-area .slip-h{font-size:11px;font-weight:800;color:#444;margin-bottom:6px}
    #print-area .slip-b{display:flex;gap:12px;align-items:flex-start}
    #print-area .slip-qr svg{display:block;width:118px;height:118px}
    #print-area .slip-n{font-size:17px;font-weight:900}#print-area .slip-n small{font-size:12px;font-weight:600;color:#555;margin-left:4px}
    #print-area .slip-c{font-family:ui-monospace,Menlo,monospace;font-size:19px;font-weight:900;letter-spacing:2px;margin:4px 0 6px}
    #print-area ol{margin:0;padding-left:18px;font-size:11.5px;line-height:1.6}#print-area ol span{color:#666}
    #print-area .slip-f{font-size:10px;color:#555;margin-top:6px;line-height:1.5}
  </style><div class="slips">${ready.map(slip).join('')}</div>`;
  const nm = ['학부모연결코드', ORG_L[ORG] || '', title || ''];
  if(window.FN) window.FN.printAs(nm); else window.print();
  setTimeout(() => { pa.style.display = 'none'; }, 400);
  rerender();
}
const unusedOf = ids => ids.map(id => S.students.get(id)).filter(s => s && ['active', 'leave'].includes(stOf(s)) && !activeLinks(s.id).length);
window.pcPrint = ids => printSlips(ids.map(id => S.students.get(id)), '');
window.pcPrintClass = (cid, all) => { const c = S.classes.find(x => x.id === cid); if(!c) return;
  const list = all ? (c.students || []).map(id => S.students.get(id)).filter(s => s && ['active', 'leave'].includes(stOf(s))) : unusedOf(c.students || []);
  if(!list.length) return alert('이 반은 모두 연결되어 있어요 🎉');
  printSlips(list, cLabel(c)); };
window.pcPrintAll = () => { const list = unusedOf([...S.students.keys()]); if(!list.length) return alert('모두 연결되어 있어요 🎉'); printSlips(list, '안 쓴 코드'); };

/* ✉️ 담임에게 쪽지 */
async function sendMsg(toUids, subject, body){
  toUids = [...new Set(toUids.filter(Boolean))];
  if(!toUids.length){ say(false, '이 반에 담임 선생님이 지정되어 있지 않아요 (반편성에서 담임을 넣어 주세요).'); return false; }
  try{
    await addDoc(collection(C.db, 'messages'), { category: 'general', fromUid: C.CU.uid, fromName: C.CU.name || '', fromOrg: C.CU.org || '',
      toUids, toNames: toUids.map(staffName), unread: [...toUids], subject, body, readBy: [], createdAt: Timestamp.now() });
    say(true, `✅ ${esc(toUids.map(staffName).join(', '))} 선생님께 쪽지를 보냈어요.`); return true;
  }catch(e){ say(false, '쪽지를 보내지 못했어요: ' + esc(e.message || '')); return false; }
}
window.pcTellClass = cid => { const c = S.classes.find(x => x.id === cid); if(!c) return;
  const list = unusedOf(c.students || []);
  if(!list.length) return alert('이 반은 모두 연결되어 있어요 🎉');
  const lines = list.map(s => { const ci = codeInfo(s); return `· ${s.name}${ci ? ` — 코드 ${ci.code}${ci.expired ? ' (만료 · 새 코드 필요)' : ''}` : ' — 코드 없음'}`; }).join('\n');
  sendMsg([c.teacherUid, ...(c.deputies || [])], `[학부모 연결] ${c.name} — 아직 연결 안 된 가정 ${list.length}곳`,
    `${c.name}에서 아직 학부모 사이트에 연결하지 않은 가정입니다.\n\n${lines}\n\n가정통신문의 QR을 휴대폰 카메라로 찍고 «구글로 계속하기» → «연결하기»만 하면 됩니다.\n코드표가 다시 필요하면 학부모 관리 › 연결 현황에서 인쇄할 수 있어요.`); };
window.pcTell = sid => { const s = S.students.get(sid); if(!s) return; const c = classOf(sid);
  const f = flagsOf(s, !!c).map(x => '· ' + x.t).join('\n');
  sendMsg(c ? [c.teacherUid, ...(c.deputies || [])] : [], `[학부모 연결] ${s.name} 가정 확인 부탁드려요`,
    `${c ? c.name + ' ' : ''}${s.name} 가정의 학부모 사이트 연결을 한 번 확인해 주세요.\n\n${f}\n\n다른 계정으로 로그인하고 계신 경우가 많아요 — 학부모 화면 맨 위에 «지금 로그인한 계정»이 보입니다.`); };

/* 요청 · 잠금 · 점검 · 서버 주소 */
window.pcApprove = async (id, ok) => {
  const r = S.requests.find(x => x.id === id);
  if(ok && !confirm(`${r ? r.studentName : ''} 학생에 보호자 한 분(${r ? r.email : ''})을 더 연결할까요?`)) return;
  const j = await gateCall('approve', { id, ok: !!ok });
  if(j.ok){ S.requests = S.requests.filter(x => x.id !== id); await rerender(true); say(true, ok ? '✅ 연결했어요 — 학부모가 다음에 들어오면 바로 열려요.' : '거절했어요.'); }
  else say(false, '처리하지 못했어요: ' + esc(j.error || ''));
};
window.pcUnlock = async uid => {
  try{ await deleteDoc(doc(C.db, 'parentGate', uid)); S.locks = S.locks.filter(g => g.uid !== uid); rerender(); say(true, '✅ 잠금을 풀었어요.'); }
  catch(e){ say(false, '풀지 못했어요: ' + esc(e.message || '')); }
};
window.pcSweep = async () => {
  if(!S.gate){ say(false, '먼저 아래 «출입 서버» 주소를 넣어 주세요.'); return; }
  window.showLoading && window.showLoading('모든 학부모의 출입증을 다시 계산하는 중…');
  const j = await gateCall('sweep', { full: true });
  window.hideLoading && window.hideLoading();
  if(j.ok){
    await rerender(true);
    const old = (j.oldKeys || []).filter(k => k.org === C.getOrg());
    say(!j.errors, `${j.errors ? '⚠️' : '✅'} 점검 끝 — 학부모 ${j.parents}명 · 출입증 새로 쓴 것 ${j.wrote}장 · 연결 정리 ${j.linkFix}건${j.cmFix ? ` · 옛 댓글 ${j.cmFix}개에 반 정보 붙임` : ''}${j.postFix ? ` · 반 게시글 ${j.postFix}개를 반편성 반으로 옮김` : ''} · 실패 ${j.errors || 0}`
      + (j.postAmb ? `<br>🔀 어느 반 글인지 알 수 없는 옛 글 <b>${j.postAmb}개</b> — <a href="#" onclick="pick('board');return false">💬 게시판 관리</a> 맨 위 «반을 골라 주세요»에서 반을 골라 주세요 (그 전까지 학부모에게 안 보여요)` : '')
      + (old.length ? `<br>📝 반편성에 없는 반 이름으로 남은 반 게시글: ${old.map(k => `«${esc(k.key)}» ${k.n}개`).join(' · ')} — 이 반 학부모에게는 보이지 않아요 (반편성의 반 이름과 맞추면 다시 보여요)` : ''));
  }
  else say(false, '점검하지 못했어요: ' + esc(j.error || '') + (j.error === 'network' ? ' — 서버 주소를 확인해 주세요' : ''));
};
/* 하루 한 번은 저절로 — 현황판을 열었는데 마지막 전체 점검이 24시간 넘었으면 뒤에서 조용히 (날짜로 바뀌는 휴학 · 서버가 놓친 저장까지 맞춤) */
export async function autoSweep(){
  if(!S.gate || !C.$I('pc-msg')) return;
  const last = S.sweep ? msOf(S.sweep.at) : 0;
  if(last && Date.now() - last < DAY) return;
  if(!last) return;                         // 처음 한 번은 관리자가 직접 «지금 점검» (배포 순서)
  const j = await gateCall('sweep', {});
  if(j.ok){ await load(true); if(C.$I('pc-msg')){ renderBoard(C.$I('pane')); say(true, `↻ 하루 한 번 저절로 점검했어요 — 학부모 ${j.parents}명 · 바뀐 출입증 ${j.wrote}장`); } }
}
window.pcSaveGate = async () => {
  const v = (C.$I('pc-gate-url').value || '').trim().replace(/\/+$/, '');
  const m = C.$I('pc-gate-msg'); m.className = 'msg';
  if(v && !/^https:\/\/[^\s]+$/.test(v)){ m.className = 'msg err'; m.textContent = '주소는 https:// 로 시작해야 해요.'; return; }
  try{
    await setDoc(doc(C.db, 'parentConfig', 'gate'), { url: v, updatedAt: Timestamp.now(), updatedBy: C.CU.name || '' });
    setGateUrl(v); S.gate = v;
    const j = v ? await gateHealth(v) : null;
    m.className = 'msg ' + (!v || (j && j.ok) ? 'ok' : 'err');
    m.innerHTML = !v ? '주소를 지웠어요.' : (j && j.ok) ? `✅ 저장했어요 — 서버 v${esc(j.version || '')} 연결됨. 이제 위의 <b>«↻ 지금 점검»</b>을 한 번 눌러 주세요.` : '저장했지만 서버에 닿지 않아요 — 주소를 다시 확인해 주세요.';
  }catch(e){ m.className = 'msg err'; m.textContent = '저장 실패: ' + (e.message || ''); }
};
window.pcCheckGate = async () => {
  const v = (C.$I('pc-gate-url').value || S.gate || '').trim();
  const m = C.$I('pc-gate-msg'); m.className = 'msg';
  const j = await gateHealth(v);
  m.className = 'msg ' + (j && j.ok ? 'ok' : 'err');
  m.textContent = j && j.ok ? `✅ 연결됨 — 출입 서버 v${j.version}` : '서버에 닿지 않아요 — 주소 · 배포 상태를 확인해 주세요.';
};
