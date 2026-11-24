/* ═══════════════════════════════════════════════════════════
   🎉 nhp-acts.js — 특별활동 한 곳에서 · 출석부와 맞추기 · v201
   · 활동(이름 · 날짜 · 활동 사항 · 대상 반)은 한 사람이 한 번만 — nhpLists/<학기>.activities (예전과 같은 자리 · from · to 날짜가 더해짐)
   · 반마다 칸(nhpEntries/<특별활동 칸>)에는 «빠진 학생»만 — rows.<학생>.no.<활동> (고른 학생만 활동은 yes)
   · 출석부: 활동 날짜에 정상 출석이 아닌 학생(결석 · 병결 · 체험학습 · 지각 · 조퇴 · 휴학)을 사유와 함께 보여 줌
       수업일 모두 자리에 없었으면(결석 · 병결 · 체험학습 · 휴학) 자동으로 뺌 — rows.<학생>.au.<활동> = 'att' (출석부가 바뀌면 다시 넣음)
       며칠만 빠졌으면 빼지 않고 «확인» 표시만 · 손으로 바꾼 학생(rows.<학생>.mn.<활동>)은 그대로 둠
   · 저장되는 새 자리는 nhpEntries 안쪽뿐 — 보안 규칙은 그대로 (v55)
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null;
const bind = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const md = ds => `${+ds.slice(5, 7)}/${+ds.slice(8, 10)}`;

/* 출력에 보일 일시 — 10월 21일 · 10월 21일 ~ 23일 · 10월 30일 ~ 11월 1일 */
export function whenText(from, to){
  if(!isDate(from)) return '';
  const f = `${+from.slice(5, 7)}월 ${+from.slice(8, 10)}일`;
  if(!isDate(to) || to <= from) return f;
  return from.slice(0, 7) === to.slice(0, 7) ? `${f} ~ ${+to.slice(8, 10)}일` : `${f} ~ ${+to.slice(5, 7)}월 ${+to.slice(8, 10)}일`;
}
export const hasDates = a => !!a && isDate(a.from);
const rangeOf = a => { const f = a.from, t = isDate(a.to) && a.to >= a.from ? a.to : a.from; return [f, t]; };

/* ── 출석부 읽기 (학기 한 번 · 5분 동안 다시 읽지 않음) ── */
const ATT = {};
export const attReady = () => !!(A && A.TERM && ATT[A.TERM.id] && ATT[A.TERM.id].ok);
export const attFailed = () => !!(A && A.TERM && ATT[A.TERM.id] && ATT[A.TERM.id].err);
export async function loadAtt(a, fresh){
  bind(a);
  const id = A.TERM.id; const cur = ATT[id];
  if(cur && cur.p && !fresh) return cur.p;
  if(cur && cur.ok && !fresh && Date.now() - cur.at < 300000) return cur;
  const T = ATT[id] = { ok: false, err: false, at: Date.now() };
  T.p = (async () => {
    try{
      const term = { start: A.TERM.start, end: A.TERM.end, org: C.ORG };
      const [ty, hs, wp, q] = await Promise.all([
        FS.getDocs(FS.collection(A.db, 'attendTypes')), FS.getDocs(FS.collection(A.db, 'holidays')), FS.getDocs(FS.collection(A.db, 'workPeriods')),
        FS.getDocs(FS.query(FS.collection(A.db, 'studentAttendance'), FS.where('date', '>=', term.start), FS.where('date', '<=', term.end)))]);
      const types = {}; ty.forEach(d => { types[d.id] = d.data(); });
      const hol = []; hs.forEach(d => hol.push(d.data()));
      const wps = []; wp.forEach(d => wps.push(d.data()));
      T.days = new Set(C.schoolDays(term, hol, wps));
      T.by = {};
      q.forEach(d => { const x = d.data(); if(x.org !== C.ORG || !x.studentId || !x.date) return;
        const tid = (Array.isArray(x.typeIds) && x.typeIds.length) ? x.typeIds[0] : x.typeId; const ty1 = types[tid];
        if(!ty1 || /^출석/.test(String(ty1.name || ''))) return;      // «출석»만 정상 — 지각 · 조퇴 · 체험학습을 «출석 인정»으로 둔 학교도 사유는 보여 줌
        (T.by[x.studentId] = T.by[x.studentId] || {})[x.date] = { name: ty1.name || '기타', reason: x.reason || '', memo: x.memo || x.note || '' }; });
      T.ok = true;
    }catch(e){ T.err = true; console.warn('출석부 읽기', e); }
    T.p = null; T.at = Date.now();
    return T;
  })();
  return T.p;
}
/* 활동 날짜 가운데 수업일 (수업일이 하나도 없으면 — 주말 캠프 등 — 그 날짜 모두 · 62일까지) */
function daysOf(a){
  const T = ATT[A.TERM.id]; const [f, t] = rangeOf(a); const all = [];
  const d = new Date(f + 'T00:00:00'), end = new Date(t + 'T00:00:00');
  for(let i = 0; d <= end && i < 62; i++){ all.push(ymd(d)); d.setDate(d.getDate() + 1); }
  const sch = all.filter(x => T && T.days && T.days.has(x));
  return sch.length ? sch : all;
}
const AWAY = n => /결석|병결|체험/.test(n) || n === '결';      // 출결 항목 이름으로만 판단 (사유 글은 보지 않음)
/* 한 학생의 그 활동 날짜 출결 — 정상이면 null
   { all: 수업일 모두 자리에 없음 · part: 며칠만 없음 · away · days · text: «결석(질병) 10/21, 10/22 · 조퇴 10/23» · short: «결석» } */
export function attOf(a, sid){
  const T = A && A.TERM && ATT[A.TERM.id];
  if(!T || !T.ok || !hasDates(a)) return null;
  const days = daysOf(a); const st = A.STU[sid] || {}; const rec = T.by[sid] || {};
  const g = {}; let away = 0;
  days.forEach(ds => {
    let lab = '', gone = false;
    if(window.StuStatus && StuStatus.onLeave(st, ds)){ lab = '휴학'; gone = true; }
    else if(rec[ds]){ const r = rec[ds]; lab = r.name === '병결' ? '결석(질병)' : r.name + (r.reason ? `(${r.reason})` : ''); gone = AWAY(String(r.name || '')); }
    if(!lab) return;
    if(gone) away++;
    (g[lab] = g[lab] || []).push(ds);
  });
  const labs = Object.keys(g); if(!labs.length) return null;
  const one = days.length === 1;
  const text = labs.map(l => one ? l : `${l} ${g[l].length === days.length ? `${g[l].length}일 모두` : g[l].map(md).join(', ')}`).join(' · ');
  return { all: away === days.length, part: away > 0 && away < days.length, away, days: days.length, text, short: labs[0].replace(/\(.*$/, '') + (labs.length > 1 ? ' 외' : '') };
}
/* 출석부대로 맞추려면 — off: 뺄 학생 · on: 다시 넣을 학생 (출석부로 뺐는데 출석부가 바뀜) · check: 며칠만 빠져 확인할 학생 */
export function plan(a, sids, rows){
  const out = { off: [], on: [], check: [] };
  if(!attReady() || !hasDates(a) || a.def === 'none') return out;
  (sids || []).forEach(sid => {
    const r = (rows || {})[sid] || {}; const no = !!(r.no || {})[a.id], au = !!(r.au || {})[a.id], mn = !!(r.mn || {})[a.id];
    const t = attOf(a, sid);
    if(t && t.all && !no && !mn && !au) out.off.push(sid);      // au 인데 참여 = 되돌리기 · 기록에서 되돌린 학생 — 손으로 바꾼 것으로 보고 다시 빼지 않음
    else if((!t || !t.all) && no && au && !mn) out.on.push(sid);
    if(t && t.part && !no && !mn) out.check.push(sid);
  });
  return out;
}

/* ═══════════ 특별활동 한 곳에서 (나학평 담당 · 목록 담당) ═══════════ */
export const canLists = a => !!(a && a.TERM && (a.isMgr || (a.TERM.listEditors || []).includes(a.CU.uid)));
const deptsOf = t => (Array.isArray(t.depts) && t.depts.length ? t.depts : [{ id: 'd1', name: '초등부', from: 1, to: 5 }, { id: 'd2', name: '중등부', from: 6, to: 9 }, { id: 'd3', name: '고등부', from: 10, to: 12 }]);
const secsSorted = () => (A.TERM.sections || []).slice().sort((x, y) => (x.gradeNo || 99) - (y.gradeNo || 99) || String(C.secLabel(x)).localeCompare(String(C.secLabel(y)), 'ko'));
const actCell = secId => A.SUBS.find(s => s.kind === 'act' && s.secId === secId && !s.removed) || null;
const sortActs = L => L.slice().sort((x, y) => String(x.from || '9999').localeCompare(String(y.from || '9999')) || (x.o || 0) - (y.o || 0));
let M = null, SEL = '', DRAFT = null, DIRTY = false, OPENSEC = '', BUSY = false;

export async function openActs(a, pick){
  bind(a);
  if(document.querySelector('.mm-ov [data-acts-box]')) return;
  SEL = pick || ''; DRAFT = null; DIRTY = false; OPENSEC = '';
  M = A.modal('🎉 특별활동 — ' + esc(C.termLabel(A.TERM)), '<div data-acts-box><div class="nh-desc">여는 중…</div></div>', '', 'wide xl');
  M.onClose = () => { M = null; if(A.afterActs) A.afterActs(); };
  const box = M.body.querySelector('[data-acts-box]');
  box.addEventListener('click', onClick); box.addEventListener('input', onInput); box.addEventListener('change', onInput);
  await A.reloadLists();
  loadAtt(A).then(() => { if(M) draw(); });
  draw();
}
const acts = () => sortActs((A.LISTS.activities || []).filter(x => x && x.id));
const blank = () => ({ id: C.rid('l'), t: '', d: '', c: '', from: '', to: '', secs: [], def: 'all', _new: true });
function pickDraft(){
  const L = acts();
  if(DRAFT && DRAFT.id === SEL) return;
  const it = L.find(x => x.id === SEL) || L[0] || null;
  if(!it){ DRAFT = canLists(A) ? blank() : null; SEL = DRAFT ? DRAFT.id : ''; }
  else { DRAFT = JSON.parse(JSON.stringify(it)); SEL = it.id; }
  DIRTY = false;
}
const targetSecs = a => secsSorted().filter(s => !a.secs || !a.secs.length || a.secs.includes(s.id));

function draw(){
  if(!M) return;
  const box = M.body.querySelector('[data-acts-box]'); if(!box) return;
  pickDraft();
  const ed = canLists(A); const L = acts(); const x = DRAFT;
  const dis = ed ? '' : ' disabled';
  const left = `<div class="ac-l"><div class="ac-h">활동 ${L.length} · 날짜 순</div>
    ${L.map(a => `<button class="ac-it${a.id === SEL ? ' on' : ''}" data-acsel="${esc(a.id)}"><b>${esc(a.t || '(이름 없음)')}</b><small>${esc(a.d || whenText(a.from, a.to) || '날짜 없음')}${hasDates(a) ? '' : ' · 출석부와 못 맞춤'}${a.def === 'none' ? ' · 고른 학생만' : ''}</small></button>`).join('')}
    ${x && x._new ? `<button class="ac-it on"><b>${esc(x.t || '새 활동')}</b><small>아직 저장 전</small></button>` : ''}
    ${ed ? `<div class="frow" style="padding:8px"><button class="nh-btn sm g" data-acnew>＋ 활동</button><button class="nh-btn sm" data-acpast>지난 학기에서</button></div>` : ''}</div>`;
  let mid = '<div class="ac-m"><div class="nh-empty">활동이 아직 없어요.</div></div>', right = '<div class="ac-r"></div>';
  if(x){
    const secs = secsSorted(); const allOn = !x.secs || !x.secs.length;
    const dOn = d => !allOn && secs.filter(s => Number(s.gradeNo) >= Number(d.from) && Number(s.gradeNo) <= Number(d.to)).every(s => x.secs.includes(s.id)) && secs.some(s => Number(s.gradeNo) >= Number(d.from) && Number(s.gradeNo) <= Number(d.to));
    mid = `<div class="ac-m"><div class="frow" style="align-items:center"><span class="ch mint">① 한 사람이 한 번만</span><span class="nh-sp"></span><span class="nh-desc" style="margin:0" data-acstate>${DIRTY ? '고친 것이 있어요 — 저장을 누르세요' : (x._new ? '새 활동' : '저장됨')}</span></div>
      <div class="fl"><label>활동 이름</label><input class="nh-in" data-acf="t" value="${esc(x.t || '')}" placeholder="예: 가을 감사 캠프"${dis}></div>
      <div class="frow"><div class="fl"><label>시작 날짜 (출석부와 맞춰 봐요)</label><input type="date" class="nh-in" data-acf="from" value="${esc(x.from || '')}" min="${esc(A.TERM.start || '')}" max="${esc(A.TERM.end || '')}"${dis}></div>
        <div class="fl"><label>끝 날짜 (하루면 비워 두세요)</label><input type="date" class="nh-in" data-acf="to" value="${esc(x.to || '')}"${dis}></div></div>
      <div class="fl"><label>출력에 보일 일시 (비우면 날짜대로)</label><input class="nh-in" data-acf="d" value="${esc(x.d || '')}" placeholder="${esc(whenText(x.from, x.to) || '예: 10월 21일 ~ 23일')}"${dis}></div>
      <div class="fl"><label>활동 사항 (참여한 학생 출력에 같은 글)</label><textarea class="nh-ta" rows="6" data-acf="c"${dis}>${esc(x.c || '')}</textarea></div>
      <div class="fl"><label>대상</label><div class="frow" style="gap:6px"><button class="nh-btn sm${allOn ? ' p' : ''}" data-actg="all"${dis}>전체</button>${deptsOf(A.TERM).map(d => `<button class="nh-btn sm${dOn(d) ? ' p' : ''}" data-actg="${esc(d.id)}"${dis}>${esc(d.name)} ${esc(d.from)}~${esc(d.to)}</button>`).join('')}</div>
        <div class="pk" style="margin-top:6px">${secs.map(s => `<label class="ck" style="margin-right:12px"><input type="checkbox" data-acsec="${esc(s.id)}"${!allOn && x.secs.includes(s.id) ? ' checked' : ''}${dis}>${esc(C.secLabel(s))}</label>`).join('')}</div></div>
      <div class="fl"><label>기본 참여</label><div class="frow" style="gap:6px"><button class="nh-btn sm${x.def !== 'none' ? ' p' : ''}" data-acdef="all"${dis}>모두 참여 (빠진 학생만 뺌)</button><button class="nh-btn sm${x.def === 'none' ? ' p' : ''}" data-acdef="none"${dis}>고른 학생만 (예: 강연회 발표자)</button></div></div>
      ${ed ? `<div class="frow" style="margin-top:4px">${x._new ? '' : '<button class="nh-btn sm r" data-acdel>이 활동 지우기</button>'}<span class="nh-sp"></span><button class="nh-btn p" data-acsave>저장</button></div>` : '<div class="nh-desc">활동은 나학평 담당 · 목록 담당이 고쳐요.</div>'}</div>`;
    right = `<div class="ac-r">${rightHTML(x)}</div>`;
  }
  box.innerHTML = `<div class="ac-wrap">${left}${mid}${right}</div>`;
  fillRight();
}
function rightHTML(x){
  if(x._new) return '<div class="nh-desc">저장하면 해당하는 반마다 자동으로 들어가요.</div>';
  const st = !hasDates(x) ? '<div class="nh-warn">날짜가 없어 출석부와 맞춰 볼 수 없어요 — 시작 날짜를 넣어 주세요.</div>' : attFailed() ? '<div class="nh-warn">출석부를 읽지 못했어요.</div>' : !attReady() ? '<div class="nh-desc">출석부를 읽는 중…</div>' : '';
  return `<div class="frow" style="align-items:center"><span class="ch mint">② 반마다 자동으로</span><span class="nh-desc" style="margin:0" data-acsum></span><span class="nh-sp"></span>${hasDates(x) && x.def !== 'none' ? '<button class="nh-btn sm" data-acsync title="출석부를 다시 읽고, 고칠 수 있는 반에서 수업일 모두 빠진 학생을 빼요 (손으로 바꾼 학생은 그대로)">출석부 다시 맞추기</button>' : ''}</div>${st}
    <div data-acsecs><div class="nh-desc">반마다 읽는 중…</div></div>`;
}
/* 오른쪽 — 반마다 참여 · 빠짐 · 출결 사유 · 담임 확인 */
async function fillRight(){
  const x = DRAFT; if(!M || !x || x._new) return;
  const host = M.body.querySelector('[data-acsecs]'); if(!host) return;
  const secs = targetSecs(x);
  const ents = await Promise.all(secs.map(s => { const c = actCell(s.id); return c ? A.getEntry(c.id) : null; }));
  if(!M || DRAFT !== x || !document.body.contains(host)) return;
  let join = 0, out = 0;
  const html = secs.map((s, i) => {
    const cell = actCell(s.id);
    if(!cell) return `<div class="ac-sec"><div class="ac-sh"><b>${esc(C.secLabel(s))}</b><span class="nh-desc" style="margin:0">특별활동 칸이 없는 반</span></div></div>`;
    const sids = A.subStudents(cell); const rows = (ents[i] || {}).rows || {};
    const can = C.canDo(cell, A.CU.uid, A.isMgr).edit;
    const J = sids.filter(sid => C.joined(x, rows[sid])); join += J.length; out += sids.length - J.length;
    const notes = sids.map(sid => ({ sid, t: attOf(x, sid) })).filter(o => o.t);
    const p = plan(x, sids, rows);
    const ack = !!(((ents[i] || {}).meta || {}).ack || {})[x.id];
    const open = OPENSEC === s.id;
    return `<div class="ac-sec${open ? ' on' : ''}"><button class="ac-sh" data-acopen="${esc(s.id)}"><b>${esc(C.secLabel(s))}</b><span>${J.length} / ${sids.length}</span>
        <span class="ac-out">${notes.length ? esc(notes.slice(0, 3).map(o => `${A.stuName(o.sid)} ${o.t.short}`).join(' · ')) + (notes.length > 3 ? ` 외 ${notes.length - 3}` : '') : '<i>출결 특이 없음</i>'}</span>
        ${p.off.length + p.on.length ? `<span class="ch warn">맞출 것 ${p.off.length + p.on.length}</span>` : ''}${p.check.length ? `<span class="ch warn">확인 ${p.check.length}</span>` : ''}<span class="ch ${ack ? 'ok' : 'gray'}">${ack ? '담임 확인' : '확인 전'}</span></button>
      ${open ? `<div class="ac-kids">${sids.map(sid => { const on = C.joined(x, rows[sid]); const t = attOf(x, sid); return `<button class="ac-kid${on ? ' on' : ''}${t ? ' att' : ''}" data-ackid="${esc(sid)}" data-sec="${esc(s.id)}"${can ? '' : ' disabled'} title="${esc(t ? t.text : '')}">${esc(A.stuName(sid))}${t ? ` · ${esc(t.short)}` : ''}</button>`; }).join('')}</div>
        ${notes.length ? `<div class="ac-note">${notes.map(o => `<div><b>${esc(A.stuName(o.sid))}</b> ${esc(o.t.text)}${o.t.all ? (C.joined(x, rows[o.sid]) ? ' — <b>참여로 되어 있어요</b>' : ' — 뺌') : o.t.part ? ' — 며칠만 빠짐 · 확인해 주세요' : ''}</div>`).join('')}</div>` : ''}
        <div class="nh-desc" style="margin:6px 0 0">${can ? '이름을 누르면 참여 · 빠짐이 바뀌어요.' : '이 반은 담임(작성 중) · 나학평 담당이 바꿀 수 있어요.'} <a href="#" data-go="s/${esc(cell.id)}">이 반 칸 열기</a></div>` : ''}</div>`;
  }).join('');
  host.innerHTML = html || '<div class="nh-desc">해당하는 반이 없어요.</div>';
  const sum = M.body.querySelector('[data-acsum]'); if(sum) sum.textContent = `참여 ${join} · 빠짐 ${out}`;
}

function readForm(){
  const x = DRAFT; if(!M || !x) return;
  M.body.querySelectorAll('[data-acf]').forEach(i => { x[i.dataset.acf] = i.value; });
}
function onInput(e){
  const t = e.target; if(!DRAFT || !M) return;
  if(t.dataset.acf){ DRAFT[t.dataset.acf] = t.value; DIRTY = true; const s = M.body.querySelector('[data-acstate]'); if(s) s.textContent = '고친 것이 있어요 — 저장을 누르세요';
    if(t.dataset.acf === 'from' || t.dataset.acf === 'to'){ const d = M.body.querySelector('[data-acf="d"]'); if(d) d.placeholder = whenText(DRAFT.from, DRAFT.to) || ''; } return; }
  if(t.dataset.acsec && e.type === 'change'){ readForm(); const s = new Set(DRAFT.secs || []); if(t.checked) s.add(t.dataset.acsec); else s.delete(t.dataset.acsec); DRAFT.secs = [...s]; DIRTY = true; draw(); }
}
async function leaveOk(){
  if(!DIRTY) return true;
  return await A.confirm('저장하지 않은 것이 있어요', '고친 내용을 버리고 넘어갈까요?', '버리고 넘어가기', true);
}
async function onClick(e){
  const t = e.target.closest('[data-acsel],[data-acnew],[data-acpast],[data-actg],[data-acdef],[data-acsave],[data-acdel],[data-acsync],[data-acopen],[data-ackid],[data-go]');
  if(t && t.dataset.go) e.preventDefault();
  if(!t || !M || BUSY) return;
  const d = t.dataset;
  if(d.go){ if(!(await leaveOk())) return; const m = M; A.go(d.go); m.close(); return; }
  if(d.acsel){ if(d.acsel === SEL || !(await leaveOk())) return; SEL = d.acsel; DRAFT = null; OPENSEC = ''; draw(); return; }
  if('acnew' in d){ if(!(await leaveOk())) return; DRAFT = blank(); SEL = DRAFT.id; DIRTY = false; draw(); const i = M.body.querySelector('[data-acf="t"]'); if(i) i.focus(); return; }
  if('acpast' in d){ if(!(await leaveOk())) return; fromPast(); return; }
  if(d.actg){ readForm(); const secs = secsSorted();
    if(d.actg === 'all') DRAFT.secs = [];
    else { const dp = deptsOf(A.TERM).find(x => x.id === d.actg); const ids = secs.filter(s => dp && Number(s.gradeNo) >= Number(dp.from) && Number(s.gradeNo) <= Number(dp.to)).map(s => s.id);
      const cur = new Set(DRAFT.secs || []); const has = ids.length && ids.every(i => cur.has(i)); ids.forEach(i => has ? cur.delete(i) : cur.add(i)); DRAFT.secs = [...cur]; }
    DIRTY = true; draw(); return; }
  if(d.acdef){ readForm(); DRAFT.def = d.acdef; DIRTY = true; draw(); return; }
  if('acsave' in d){ save(); return; }
  if('acdel' in d){ del(); return; }
  if('acsync' in d){ syncAll(true); return; }
  if(d.acopen){ OPENSEC = OPENSEC === d.acopen ? '' : d.acopen; fillRight(); return; }
  if(d.ackid){ toggleKid(d.sec, d.ackid); return; }
}
async function save(){
  const x = DRAFT; if(!x || !canLists(A)) return;
  readForm();
  x.t = String(x.t || '').trim(); x.d = String(x.d || '').trim(); x.c = String(x.c || '').replace(/\s+$/, '');
  if(!x.t) return A.toast('활동 이름을 넣어 주세요.', 'err');
  if(x.from && !isDate(x.from)) x.from = '';
  if(!x.from) x.to = '';
  if(x.to && x.to < x.from) return A.toast('끝 날짜가 시작 날짜보다 앞이에요.', 'err');
  if(x.to === x.from) x.to = '';
  BUSY = true;
  try{
    await A.reloadLists();                                   // 다른 분이 막 고친 목록 위에 이 활동만 바꿔 넣는다
    const arr = (A.LISTS.activities || []).slice();
    const it = Object.assign({}, x); delete it._new;
    const i = arr.findIndex(y => y && y.id === it.id);
    // 출력 일시 — 비었거나, 예전 날짜에서 자동으로 만든 글 그대로면 새 날짜로 다시 만든다 (날짜만 바꿨는데 출력이 옛 날짜로 남지 않게)
    if(!it.d || (i >= 0 && it.d === whenText(arr[i].from, arr[i].to))) it.d = whenText(it.from, it.to);
    if(i >= 0) arr[i] = Object.assign({}, arr[i], it); else { it.o = arr.length; arr.push(it); }
    if(A.markMine) A.markMine();
    await FS.setDoc(FS.doc(A.db, 'nhpLists', A.TERM.id), { termId: A.TERM.id, activities: arr }, { merge: true });
    A.LISTS.activities = arr; DRAFT = null; SEL = it.id; DIRTY = false;
    A.toast('활동을 저장했어요 ✓');
  }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); BUSY = false; return; }
  BUSY = false; draw();
  if(attReady()) syncAll(false);
}
async function del(){
  const x = DRAFT; if(!x || x._new || !canLists(A)) return;
  if(!(await A.confirm('이 활동 지우기', `<b>${esc(x.t)}</b>을(를) 목록에서 지워요. 모든 반 출력에서 이 활동이 빠져요. <b>되돌릴 수 없어요.</b>`, '지우기', true))) return;
  BUSY = true;
  try{ await A.reloadLists(); const arr = (A.LISTS.activities || []).filter(y => y && y.id !== x.id);
    if(A.markMine) A.markMine();
    await FS.setDoc(FS.doc(A.db, 'nhpLists', A.TERM.id), { termId: A.TERM.id, activities: arr }, { merge: true });
    A.LISTS.activities = arr; DRAFT = null; SEL = ''; DIRTY = false; A.toast('지웠어요.'); }
  catch(e){ A.toast('지우지 못했어요 — ' + A.errText(e), 'err'); }
  BUSY = false; draw();
}
/* 지난 학기 목록에서 이름 · 활동 사항만 가져오기 (날짜 · 대상 반은 비움) */
async function fromPast(){
  const terms = (A.TERMS || []).filter(t => t.id !== A.TERM.id && t.src !== 'import');
  if(!terms.length) return A.toast('나학평에서 연 지난 학기가 없어요.', 'err');
  let got = [];
  for(const t of terms){ try{ const l = await FS.getDoc(FS.doc(A.db, 'nhpLists', t.id)); ((l.exists() && l.data().activities) || []).forEach(a => { if(a && String(a.t || '').trim()) got.push({ a, term: C.termLabel(t) }); }); }catch(e){} }
  if(!got.length) return A.toast('지난 학기 특별활동 목록이 비어 있어요.', 'err');
  const have = new Set(acts().map(a => C.normKey(a.t)));
  const m = A.modal('지난 학기에서 가져오기', `<div class="nh-desc">이름 · 활동 사항만 가져와요 — 날짜와 대상 반은 이번 학기에 맞게 넣어 주세요.</div>
    <div style="max-height:56vh;overflow:auto">${got.map((o, i) => `<label class="ck" style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><input type="checkbox" data-pi="${i}"${have.has(C.normKey(o.a.t)) ? ' disabled' : ''}><span><b>${esc(o.a.t)}</b> <small style="color:var(--ink-3)">${esc(o.term)} · ${esc(o.a.d || '')}${have.has(C.normKey(o.a.t)) ? ' · 이미 있음' : ''}</small><br><small style="color:var(--ink-2);white-space:pre-line">${esc(String(o.a.c || '').slice(0, 160))}</small></span></label>`).join('')}</div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>고른 활동 가져오기</button>', 'mid');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const pick = Array.from(m.box.querySelectorAll('[data-pi]:checked')).map(i => got[+i.dataset.pi].a);
    if(!pick.length) return A.toast('가져올 활동을 골라 주세요.', 'err');
    const okb = m.box.querySelector('[data-ok]'); if(okb.disabled) return; okb.disabled = true;
    try{ await A.reloadLists(); const arr = (A.LISTS.activities || []).slice();
      pick.forEach(a => arr.push({ id: C.rid('l'), t: a.t, d: '', c: a.c || '', from: '', to: '', secs: [], def: a.def === 'none' ? 'none' : 'all', o: arr.length }));
      if(A.markMine) A.markMine();
      await FS.setDoc(FS.doc(A.db, 'nhpLists', A.TERM.id), { termId: A.TERM.id, activities: arr }, { merge: true });
      A.LISTS.activities = arr; m.close(); DRAFT = null; SEL = arr[arr.length - 1].id; A.toast(`${pick.length}개 가져왔어요 ✓ 날짜를 넣어 주세요.`); draw(); }
    catch(e){ okb.disabled = false; A.toast('가져오지 못했어요 — ' + A.errText(e), 'err'); }
  };
}

/* ── 한 반 칸에 바로 쓰기 (한 곳에서 화면 — 칸 화면이 열려 있지 않을 때) · 고친 기록도 남김 ── */
async function writeCell(cell, patch, via){
  const ref = FS.doc(A.db, 'nhpEntries', cell.id);
  const ent = await A.getEntry(cell.id); const ch = [];
  const data = { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid };
  Object.keys(patch).forEach(k => {
    const was = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), ent); const v = patch[k];
    if((was === undefined || was === null) && v === null) return;
    if(was === v) return;
    data[k] = v === null ? FS.deleteField() : v;
    const o = { k }; if(was !== undefined && was !== null) o.w = was; if(v !== null) o.n = v; if(via) o.v = via; ch.push(o);
  });
  if(!ch.length) return 0;
  try{ await FS.updateDoc(ref, data); }
  catch(e){
    let missing = !!(e && e.code === 'not-found');
    if(!missing && e && /permission/.test(e.code || '')){ try{ missing = !(await FS.getDoc(ref)).exists(); }catch(e2){} }
    if(!missing) throw e;
    await FS.setDoc(ref, { termId: cell.termId, subjectId: cell.id, secId: cell.secId || '', kind: cell.kind || '', createdAt: FS.serverTimestamp() }, { merge: true });
    await FS.updateDoc(ref, data);
  }
  ch.forEach(c => { const ps = c.k.split('.'); let o = ent; ps.slice(0, -1).forEach(p => { o = (o[p] = (o[p] && typeof o[p] === 'object') ? o[p] : {}); }); if(c.n === undefined) delete o[ps[ps.length - 1]]; else o[ps[ps.length - 1]] = c.n; });
  try{ await FS.addDoc(FS.collection(A.db, 'nhpEntries', cell.id, 'chg'), { termId: cell.termId, subjectId: cell.id, at: FS.serverTimestamp(), by: A.CU.uid, byName: (A.me().name || ''), cnt: ch.length, ch }); }catch(e){ /* 규칙 v55 게시 전이면 기록만 남지 않음 */ }
  return ch.length;
}
async function toggleKid(secId, sid){
  const x = DRAFT; const cell = actCell(secId); if(!x || !cell || x._new) return;
  if(!C.canDo(cell, A.CU.uid, A.isMgr).edit) return;
  const ent = await A.getEntry(cell.id, true); const on = C.joined(x, (ent.rows || {})[sid]);      // 담임이 막 고친 것 위에 쓰지 않게 새로 읽음
  const patch = {};
  if(x.def === 'none') patch[`rows.${sid}.yes.${x.id}`] = on ? null : true; else patch[`rows.${sid}.no.${x.id}`] = on ? true : null;
  patch[`rows.${sid}.au.${x.id}`] = null;
  if(hasDates(x) && x.def !== 'none' && ((((ent.rows || {})[sid] || {}).au || {})[x.id] || attOf(x, sid))) patch[`rows.${sid}.mn.${x.id}`] = true;      // 손으로 바꿈 — 출석부를 다시 맞춰도 그대로
  BUSY = true;
  try{ await writeCell(cell, patch, 'acts'); }catch(e){ A.toast('바꾸지 못했어요 — ' + A.errText(e), 'err'); }
  BUSY = false; fillRight();
}
/* 출석부대로 — 고칠 수 있는 반 모두 (말없이: 활동 저장 뒤 / 누름: 출석부를 다시 읽고) */
async function syncAll(loud){
  const x = DRAFT || acts().find(a => a.id === SEL); if(!x || x._new || !hasDates(x) || x.def === 'none') return;
  BUSY = true;
  try{
    if(loud) await loadAtt(A, true);
    if(!attReady()){ if(loud) A.toast('출석부를 읽지 못했어요.', 'err'); BUSY = false; return; }
    let n = 0, skip = 0;
    for(const s of targetSecs(x)){
      const cell = actCell(s.id); if(!cell) continue;
      const ent = await A.getEntry(cell.id, true); const p = plan(x, A.subStudents(cell), ent.rows || {});
      if(!p.off.length && !p.on.length) continue;
      if(!C.canDo(cell, A.CU.uid, A.isMgr).edit){ skip++; continue; }
      const patch = {};
      p.off.forEach(sid => { patch[`rows.${sid}.no.${x.id}`] = true; patch[`rows.${sid}.au.${x.id}`] = 'att'; });
      p.on.forEach(sid => { patch[`rows.${sid}.no.${x.id}`] = null; patch[`rows.${sid}.au.${x.id}`] = null; });
      try{ await writeCell(cell, patch, 'att'); n += p.off.length + p.on.length; }catch(e){ skip++; }
    }
    if(loud || n) A.toast(n ? `출석부대로 ${n}명을 맞췄어요 ✓${skip ? ` (고칠 수 없는 반 ${skip} — 담임이 칸을 열면 맞춰져요)` : ''}` : (skip ? `맞출 반 ${skip}곳은 담임이 칸을 열면 맞춰져요.` : '출석부와 모두 맞아요 ✓'));
  }catch(e){ if(loud) A.toast('맞추지 못했어요 — ' + A.errText(e), 'err'); }
  BUSY = false; if(M) draw();
}
