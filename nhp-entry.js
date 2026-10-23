/* ═══════════════════════════════════════════════════════════
   ✏️ nhp-entry.js — 나학평 칸 하나 (입력 · 평가 틀 · 학기 중 기록 · 미리보기 · 기록) · v141
   · 맡은 선생님: 작성 중에 입력 → «작성완료»로 검토에 보냄
   · 검토관: 지금 단계면 오타를 바로 고치고 «검토완료» 또는 «수정 요청»
   · 최종 검토관: «최종 승인»(잠김) · «다시 열기»
   · 입력은 칸 하나씩 바로 저장 (0.5초 모아서) — 함께 맡은 선생님이 같은 칸을 써도 서로 덮어쓰지 않게 «바뀐 칸만» 저장
   ═══════════════════════════════════════════════════════════ */
import * as SETUP from './nhp-setup.js?v=143';

let A = null, C = null, esc = null, FS = null;
let SUB = null, ENT = null, TAB = 'in', EL = null, CAN = null, SEC = null, SIDS = [];
let VIEWMODE = '', CUR = 0, unEnt = null, MARKS = null;
/* 저장 대기 — 칸마다 따로 (칸을 옮겨 다녀도 고친 것이 다른 칸에 섞이지 않게) · META 는 그 칸 문서를 처음 만들 때 쓰는 값 */
const PENDS = {}, META = {}; let PT = null, INFLIGHT = null, LAST_OK = 0, SAVE_ERR = '';
const pendOf = id => (PENDS[id] = PENDS[id] || {});
const bind = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

export async function render(a, el, id, tab){
  bind(a);
  flush(); flushSetup();          // 기다리지 않는다 — 칸마다 따로 저장되니 다른 칸으로 옮겨도 섞이지 않음 (연결이 끊겨도 화면은 넘어감)
  if(unEnt){ unEnt(); unEnt = null; }
  EL = el; SUB = A.subOf(id); MARKS = null;
  if(!SUB){ el.innerHTML = `<div class="nh-empty">칸을 찾을 수 없어요. (다른 학기의 칸이거나 빠진 칸이에요) <br><button class="nh-btn sm" data-go="home">← 내 할 일</button></div>`; return; }
  TAB = tab || (A.lsGet('nhp_tab_' + id, 'in'));
  if(!['in', 'set', 'mk', 'pv', 'log'].includes(TAB)) TAB = 'in';
  SEC = A.secOf(SUB.secId);
  SIDS = A.subStudents(SUB);
  ENT = await A.getEntry(id, true);
  if(!ENT.rows) ENT.rows = {};
  VIEWMODE = VIEWMODE || (innerWidth < 900 ? 'one' : 'grid');
  CUR = Math.min(CUR, Math.max(0, SIDS.length - 1));
  draw();
  // 함께 맡은 선생님 · 검토관이 고친 것 — 쓰는 칸이 아니면 바로 반영
  unEnt = FS.onSnapshot(FS.doc(A.db, 'nhpEntries', id), d => {
    if(!d.exists() || d.metadata.hasPendingWrites) return;
    const x = d.data(); if(!x || !x.rows) return;
    if(!SUB || SUB.id !== id) return;
    const before = JSON.stringify(ENT.rows);
    ENT = Object.assign({}, x, { rows: x.rows });
    const P = PENDS[id] || {};
    Object.keys(P).forEach(p => setPath(ENT, p, P[p] === DEL ? undefined : P[p]));
    A.ENT[id] = ENT;
    if(before !== JSON.stringify(ENT.rows)){
      const f = document.activeElement;
      if(f && EL.contains(f) && (f.tagName === 'TEXTAREA' || f.tagName === 'INPUT')){ const n = document.getElementById('ej-remote'); if(n) n.style.display = ''; }
      else if(TAB === 'in') drawBody();
    }
  }, () => {});
}
export function onLive(a){
  bind(a);
  if(!SUB) return;
  const s = A.subOf(SUB.id);
  if(!s) return;
  if(SPEND[s.id]) s.setup = SPEND[s.id];      // 아직 저장 중인 평가 틀은 내 화면 것을 그대로
  const changed = s.state !== SUB.state || s.stage !== SUB.stage || JSON.stringify(s.teacherUids) !== JSON.stringify(SUB.teacherUids) || JSON.stringify(s.rv) !== JSON.stringify(SUB.rv) || s.removed !== SUB.removed;
  const setupChanged = JSON.stringify(s.setup) !== JSON.stringify(SUB.setup) || s.type !== SUB.type || JSON.stringify(s.studentIds) !== JSON.stringify(SUB.studentIds);
  SUB = s;
  if(changed){ const y = window.scrollY; draw(); window.scrollTo(0, y); A.toast('이 칸의 상태가 바뀌었어요 — ' + C.stateOf(s).ko); return; }
  if(setupChanged && TAB !== 'set'){ SIDS = A.subStudents(SUB); const y = window.scrollY; drawBody(); window.scrollTo(0, y); }
}

/* ── 저장 ── */
const DEL = '__del__';
function setPath(o, path, v){
  const ks = path.split('.'); let x = o;
  for(let i = 0; i < ks.length - 1; i++){ if(x[ks[i]] == null || typeof x[ks[i]] !== 'object') x[ks[i]] = {}; x = x[ks[i]]; }
  if(v === undefined) delete x[ks[ks.length - 1]]; else x[ks[ks.length - 1]] = v;
}
function getPath(o, path){ return path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o); }
function put(path, v){
  const empty = (v === '' || v == null || v === false) && !/\.list$/.test(path) && !/^meta\./.test(path);
  setPath(ENT, path, empty ? undefined : v);
  pendOf(SUB.id)[path] = empty ? DEL : v;
  META[SUB.id] = { termId: SUB.termId, secId: SUB.secId, kind: SUB.kind };
  A.ENT[SUB.id] = ENT;
  showSave('ing');
  clearTimeout(PT); PT = setTimeout(flush, 550);
}
const hasPend = () => Object.keys(PENDS).some(id => Object.keys(PENDS[id]).length);
/* 모든 칸의 대기 중인 입력을 저장 — 저장 중이면 그 저장이 끝난 뒤 이어서 (한 번에 하나씩) */
function flush(){
  clearTimeout(PT);
  const run = async () => { while(hasPend()){ const id = Object.keys(PENDS).find(k => Object.keys(PENDS[k]).length); if(!(await flushOne(id))) break; } };
  INFLIGHT = (INFLIGHT || Promise.resolve()).then(run, run);
  return INFLIGHT;
}
async function flushOne(id){
  const P = PENDS[id] || {};
  const raw = {}; Object.keys(P).forEach(k => { raw[k] = P[k]; delete P[k]; });
  if(!Object.keys(raw).length) return true;
  const batch = {}; Object.keys(raw).forEach(k => { batch[k] = raw[k] === DEL ? FS.deleteField() : raw[k]; });
  const ref = FS.doc(A.db, 'nhpEntries', id);
  const here = () => SUB && SUB.id === id;
  try{
    batch.updatedAt = FS.serverTimestamp(); batch.updatedBy = A.CU.uid;
    try{ await FS.updateDoc(ref, batch); }
    catch(e){
      if(e && e.code === 'not-found'){
        // 처음 저장 — 문서만 만들고(rows 는 건드리지 않음: 함께 맡은 선생님이 막 저장한 것을 지우지 않게) 고친 칸을 넣는다
        const m = META[id] || {};
        await FS.setDoc(ref, { termId: m.termId, subjectId: id, secId: m.secId || '', kind: m.kind || '', createdAt: FS.serverTimestamp() }, { merge: true });
        await FS.updateDoc(ref, batch);
      } else throw e;
    }
    LAST_OK = Date.now(); SAVE_ERR = '';
    if(here()){ showSave('ok'); scheduleCnt(); }
    return true;
  }catch(e){
    SAVE_ERR = A.errText(e);
    const perm = /permission/.test(e.code || '');
    // 못 저장한 것은 다시 넣어 둔다 (그 사이 새로 고친 칸은 새 값 그대로) · 권한이 없으면 버린다 (상태가 바뀜)
    if(!perm){ const Q = pendOf(id); Object.keys(raw).forEach(k => { if(!(k in Q)) Q[k] = raw[k]; }); }
    if(here()) showSave('err');
    A.toast('저장하지 못했어요 — ' + SAVE_ERR, 'err');
    if(perm && here()){ setTimeout(() => { const s = A.subOf(id); if(s && here()){ SUB = s; draw(); } }, 400); }
    return perm;      // 권한 문제면 다음 칸으로 · 연결 문제면 멈추고 «다시 저장»을 기다림
  }
}
window.addEventListener('beforeunload', e => { if(hasPend() || Object.keys(SPEND).length){ flush(); flushSetup(); e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', () => { flush(); flushSetup(); });
function showSave(st){
  const el = document.getElementById('ej-save'); if(!el) return;
  if(st === 'ing'){ el.className = 'sv-dot'; el.textContent = '저장 중…'; }
  else if(st === 'ok'){ const d = new Date(); el.className = 'sv-dot on'; el.textContent = `저장됨 ✓ ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  else { el.className = 'sv-dot err'; el.innerHTML = `저장 안 됨 — <button class="nh-btn xs" data-ej="retry">다시 저장</button>`; }
}
/* 진행(몇 명 채움) — 맡은 선생님이 작성 중일 때만 칸 문서에 적는다 (진행 현황 · 내 할 일 막대) */
let CT = null;
function scheduleCnt(){
  clearTimeout(CT);
  CT = setTimeout(async () => {
    if(!SUB || SUB.state !== 'draft' || !(CAN.teacher || A.isMgr)) return;
    const p = C.progressOf(SUB, ENT, SIDS);
    if(SUB.cnt && SUB.cnt.done === p.done && SUB.cnt.total === p.total) return;
    try{ await A.saveSub(SUB.id, { cnt: p }); }catch(e){}
  }, 1800);
}

/* ── 화면 ── */
function stageChain(){
  const labels = (SUB.rvL || []).slice();
  const cur = SUB.state === 'review' ? (SUB.stage || 0) : SUB.state === 'final' ? labels.length : SUB.state === 'done' ? labels.length + 1 : -1;
  const steps = ['작성'].concat(labels).concat([SUB.finL || '최종 승인']);
  return steps.map((l, i) => {
    const k = i - 1;
    const on = (SUB.state === 'draft' && i === 0) || (k === cur && SUB.state !== 'draft') || (SUB.state === 'done' && i === steps.length - 1);
    const done = SUB.state === 'done' || (SUB.state !== 'draft' && k < cur);
    const who = i === 0 ? (SUB.teacherUids || []) : i <= labels.length ? ((SUB.rv || {})['r' + i] || []) : ((SUB.rv || {}).fin || []);
    return `<span class="ch ${on ? 'info' : done ? 'ok' : 'gray'}" title="${esc(who.map(A.staffName).join(', '))}">${done && !on ? '✓ ' : ''}${esc(l)}${who.length ? ` · ${esc(who.map(A.staffName).filter(Boolean).slice(0, 2).join(', '))}${who.length > 2 ? '…' : ''}` : ''}</span>`;
  }).join('<span style="color:var(--ink-3)">→</span>');
}
function draw(){
  CAN = C.canDo(SUB, A.CU.uid, A.isMgr);
  const p = C.progressOf(SUB, ENT, SIDS);
  const kind = C.KINDS[SUB.kind] || {};
  const isSubj = SUB.kind === 'subj';
  const tabs = [['in', '✏️ 입력'], ['set', isSubj ? '🧩 평가 틀' : '🧩 설정'], ...((isSubj && SUB.type !== 'A' && SUB.type !== 'R') ? [['mk', '📈 학기 중 기록']] : []), ['pv', '👀 미리보기'], ['log', `🗒 기록 · 코멘트${(SUB.log || []).filter(l => l.msg).length ? ' ' + (SUB.log || []).filter(l => l.msg).length : ''}`]];
  if(!tabs.some(t => t[0] === TAB)) TAB = 'in';
  const last = (SUB.log || []).slice().reverse().find(l => l.act === 'redo');
  EL.innerHTML = `<div style="margin-bottom:10px"><button class="nh-btn sm ghost" data-go="home">← 내 할 일</button> <button class="nh-btn sm ghost" data-go="board">📊 진행 현황</button></div>
    ${SUB.removed ? '<div class="nh-warn">이 칸은 학기 설정에서 «빠진 칸»이에요 (보관 중). 출력에 나오지 않아요.</div>' : ''}
    <div class="sj-top"><div class="tt"><div class="k">${esc(C.secLabel(SEC))} · ${esc(kind.icon || '')} ${esc(isSubj ? '교과' : (kind.ko || '').split(' (')[0])}</div>
      <h2>${esc(A.subLabel(SUB))} ${A.typeChip(SUB)} ${A.stateChip(SUB)}</h2>
      <div class="m">${stageChain()}</div>
      <div class="m" style="margin-top:6px"><span>학생 ${SIDS.length}명 · <b style="color:var(--ink)">${p.done}명 채움</b></span><span class="sv-dot" id="ej-save">${LAST_OK ? '' : ''}</span>
        <span id="ej-remote" class="ch warn" style="display:none;cursor:pointer" data-ej="reload">다른 분이 고쳤어요 · 새로 보기</span></div></div>
      <div class="sj-acts">${actsHTML(p)}</div></div>
    ${SUB.state === 'draft' && last && last.msg ? `<div class="nh-note" style="cursor:default"><div style="font-size:18px">↩️</div><div><b>수정 요청</b> — ${esc(last.msg)}<small>${esc(last.name || '')} · ${esc(fmtAt(last.at))}</small></div></div>` : ''}
    ${lockNote()}
    <div class="sj-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${TAB === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="ej-body"></div>`;
  EL.onclick = onClick; EL.onchange = onChange; EL.oninput = onInput; EL.onkeydown = onKey;
  drawBody();
}
function lockNote(){
  if(CAN.edit) return (SUB.state === 'review' || SUB.state === 'final') && CAN.now && !CAN.teacher ? `<div class="nh-info">🧐 지금 <b>내가 검토할 차례</b>예요. 오타는 바로 고칠 수 있어요 (고친 기록이 남아요). 맡은 선생님이 다시 봐야 하면 «수정 요청»을 눌러 주세요.</div>` : '';
  if(SUB.state === 'done') return `<div class="nh-info">🔒 <b>승인되어 잠겼어요.</b> 고쳐야 하면 최종 검토관이 «다시 열기»를 해야 해요. (출력용으로만 고치려면 출력 › «출력본»을 쓰세요 — 원본은 그대로)</div>`;
  if(SUB.state === 'review' || SUB.state === 'final') return `<div class="nh-info">📨 검토 중이라 입력이 잠겨 있어요 (${esc(C.stateOf(SUB).ko)}). ${CAN.withdraw ? '첫 단계 검토가 시작되기 전이면 «되찾기»로 다시 고칠 수 있어요.' : '고칠 것이 있으면 지금 검토관에게 «수정 요청»을 부탁하세요.'}</div>`;
  if(!CAN.teacher && !A.isMgr) return `<div class="nh-info">👀 보기만 할 수 있어요 — 이 칸을 맡은 분은 ${esc((SUB.teacherUids || []).map(A.staffName).join(', ') || '아직 없음')}이에요.</div>`;
  return '';
}
function actsHTML(p){
  const b = [];
  if(CAN.submit) b.push(`<button class="nh-btn g" data-ej="submit">📨 작성완료 · 검토로</button>`);
  if(CAN.withdraw) b.push(`<button class="nh-btn sm" data-ej="withdraw">↩ 되찾기</button>`);
  if(CAN.review) b.push(`<button class="nh-btn g" data-ej="ok">✅ 검토완료</button>`);
  if(CAN.approve) b.push(`<button class="nh-btn pu" data-ej="approve">🔒 최종 승인</button>`);
  if(CAN.redo) b.push(`<button class="nh-btn w" data-ej="redo">↩️ 수정 요청</button>`);
  if(CAN.reopen) b.push(`<button class="nh-btn sm" data-ej="reopen">🔓 다시 열기</button>`);
  void p;
  return b.join('');
}
const fmtAt = s => { try{ const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }catch(e){ return ''; } };
function drawBody(){
  const B = document.getElementById('ej-body'); if(!B) return;
  A.lsSet('nhp_tab_' + SUB.id, TAB);
  if(TAB === 'in') B.innerHTML = inputHTML();
  else if(TAB === 'set') B.innerHTML = setupHTML();
  else if(TAB === 'mk'){ B.innerHTML = '<div class="nh-desc">학기 중 기록을 여는 중…</div>'; loadMarks().then(() => { if(TAB === 'mk') B.innerHTML = marksHTML(); }); }
  else if(TAB === 'pv'){ B.innerHTML = previewHTML(); }
  else if(TAB === 'log') B.innerHTML = logHTML();
}
const ro = () => CAN.edit ? '' : ' disabled';
const row = sid => (ENT.rows || {})[sid] || {};

/* ═══════════ 입력 ═══════════ */
function inputHTML(){
  if(!SIDS.length) return `<div class="nh-empty">이 칸을 듣는 학생이 없어요. ${CAN.setup ? '«평가 틀 › 듣는 학생»에서 고를 수 있어요.' : ''}</div>`;
  const k = SUB.kind;
  if(k === 'subj'){
    const t = SUB.type || 'E';
    const st = SUB.setup || {};
    let h = modeBar();
    if((t === 'E' || t === 'M') && !(st.items || []).length) h += `<div class="nh-warn">평가 항목이 아직 없어요. «🧩 평가 틀»에서 항목을 먼저 넣어 주세요.${CAN.setup ? ' <button class="nh-btn xs" data-tab="set">평가 틀로</button>' : ''}</div>`;
    if((t === 'S' || t === 'M') && !((st.score || {}).cols || []).length) h += `<div class="nh-warn">시험 항목이 아직 없어요. «🧩 평가 틀»에서 시험 항목을 넣어 주세요.</div>`;
    if(VIEWMODE === 'one') return h + oneHTML();
    if(t === 'E' || t === 'M') h += evalGridHTML();
    if(t === 'S' || t === 'M') h += scoreGridHTML();
    if(t === 'R') h += rGridHTML();
    h += narrGridHTML();
    return h;
  }
  if(k === 'hr' || k === 'vision' || k === 'camp') return modeBar() + (VIEWMODE === 'one' ? oneHTML() : narrGridHTML(true));
  if(k === 'att') return attHTML();
  if(k === 'parent') return parentHTML();
  if(k === 'act') return actHTML();
  if(k === 'book') return bookHTML();
  if(k === 'serve') return serveHTML();
  return '<div class="nh-desc">알 수 없는 칸이에요.</div>';
}
function modeBar(){
  return `<div class="frow" style="align-items:center;margin-bottom:10px">
    <div class="nh-tabs" style="border:0;padding:0;margin:0"><button data-mode="grid" class="${VIEWMODE === 'grid' ? 'on' : ''}">▦ 표로 한꺼번에</button><button data-mode="one" class="${VIEWMODE === 'one' ? 'on' : ''}">👤 한 명씩</button></div>
    <span class="nh-sp"></span>${CAN.edit && SUB.kind === 'subj' && (SUB.type === 'E' || SUB.type === 'M') ? `<button class="nh-btn sm" data-ej="paste">📋 엑셀에서 붙여넣기</button>` : ''}</div>`;
}
const lvBtn = (sid, it, v) => `<button class="lv${v ? ' v' + v : ''}" data-lv="${esc(sid)}" data-it="${esc(it)}" title="${esc(v ? C.levelOf(v).ko : '비어 있음')}"${ro()}>${v || '·'}</button>`;
function shortName(sid){ const n = A.stuName(sid); return n.length > 4 ? n.slice(0, 4) : n; }
function evalGridHTML(){
  const items = (SUB.setup || {}).items || [];
  if(!items.length) return '';
  let lastG = null;
  const rows = items.map(it => {
    const g = String(it.g || '').trim();
    const gh = g && g !== lastG ? `<tr class="grp"><td class="fc" colspan="${SIDS.length + 1}">${esc(g)}</td></tr>` : '';
    lastG = g || null;
    return gh + `<tr><td class="fc" style="min-width:230px;max-width:340px;font-size:12px;line-height:1.45">${esc(it.t)}${CAN.edit ? ` <button class="nh-btn xs ghost" data-rowall="${esc(it.id)}" title="이 항목 모든 학생 같은 값">⋯</button>` : ''}</td>${SIDS.map(sid => `<td class="c">${lvBtn(sid, it.id, Number((row(sid).e || {})[it.id]) || 0)}</td>`).join('')}</tr>`;
  }).join('');
  return `<div class="st-card"><div class="frow" style="align-items:center;margin-bottom:8px"><b style="font-size:14px">5단계 평가</b><span class="nh-desc" style="margin:0">칸을 누르고 숫자 <b>5 · 4 · 3 · 2 · 1</b>을 치면 넣고 아래로 가요 (← → ↑ ↓ 이동 · 지우기 Delete). 5 = 매우 잘함 … 1 = 노력 요함</span></div>
    <div class="nh-tw" style="max-height:70vh"><table class="nh-t" data-grid="e"><thead><tr><th class="fc">평가 항목</th>${SIDS.map(sid => `<th class="c sv" title="${esc(A.stuLabel(sid))}">${esc(shortName(sid))}${C.rowFilled(SUB, row(sid)) ? ' ✓' : ''}${CAN.edit ? `<br><button class="nh-btn xs ghost" data-colall="${esc(sid)}" title="이 학생 모든 항목 같은 값">⋯</button>` : ''}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function scoreGridHTML(){
  const sc = (SUB.setup || {}).score;
  if(!sc || !(sc.cols || []).length) return '';
  const tot = sc.tot && sc.tot.on, weighted = (sc.cols || []).every(c => Number(c.w) > 0);
  const avgRow = sc.avgOn !== false ? `<tr class="grp"><td class="fc">${esc(sc.r2 || '반 평균')}</td>${sc.cols.map(c => `<td class="c">${esc(C.scoreAvg(sc, ENT.rows, SIDS, c.id))}</td>`).join('')}${tot ? `<td class="c">${esc(C.scoreAvg(sc, ENT.rows, SIDS, '__tot'))}</td>` : ''}</tr>` : '';
  return `<div class="st-card"><div class="frow" style="align-items:center;margin-bottom:8px"><b style="font-size:14px">${esc(sc.title || '성적')}${sc.sub ? ' · ' + esc(sc.sub) : ''}</b><span class="nh-desc" style="margin:0">${tot ? (weighted ? '총 점수는 비율대로 저절로 계산돼요.' : '비율이 없는 항목이 있어 총 점수를 직접 넣어요.') : ''} 반 평균은 이 과목 학생들 점수로 저절로 (평가 틀에서 직접 넣을 수도 있어요).</span></div>
    <div class="nh-tw"><table class="nh-t" data-grid="s"><thead><tr><th class="fc">학생</th>${sc.cols.map(c => `<th class="c">${esc(c.t)}${Number(c.w) > 0 ? ` <small>(${esc(c.w)}%)</small>` : ''}</th>`).join('')}${tot ? `<th class="c">${esc(sc.tot.t || '총 점수')}</th>` : ''}</tr></thead>
    <tbody>${SIDS.map(sid => { const v = row(sid).s || {}; return `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${sc.cols.map(c => `<td class="c"><input class="nh-in num" inputmode="decimal" data-sc="${esc(sid)}" data-col="${esc(c.id)}" value="${esc(v[c.id] ?? '')}"${ro()}></td>`).join('')}${tot ? `<td class="c">${weighted ? `<b data-tot="${esc(sid)}">${esc(C.scoreTotal(sc, v))}</b>` : `<input class="nh-in num" data-sc="${esc(sid)}" data-col="__tot" value="${esc(v.__tot ?? '')}"${ro()}>`}</td>` : ''}</tr>`; }).join('')}${avgRow}</tbody></table></div></div>`;
}
function rGridHTML(){
  const r = (SUB.setup || {}).r || {}; const n = Math.max(1, Math.min(3, Number(r.n) || 1));
  return `<div class="st-card"><b style="font-size:14px">${esc(r.title || '암송 · 읽기')}</b> <span class="nh-desc">${esc(r.it || '')} — 학생마다 ${n}칸</span>
    <div class="nh-tw" style="margin-top:8px"><table class="nh-t"><thead><tr><th class="fc">학생</th>${[1, 2, 3].slice(0, n).map(i => `<th>내용 ${i}</th>`).join('')}</tr></thead><tbody>${SIDS.map(sid => `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${[1, 2, 3].slice(0, n).map(i => `<td><textarea class="nh-ta" rows="2" data-nr="${esc(sid)}" data-ni="c${i}"${ro()}>${esc((row(sid).n || {})['c' + i] || '')}</textarea></td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function narrNeed(){ return ((SUB.setup || {}).narr || []).filter(C.isEach); }
function narrGridHTML(withOff){
  const st = SUB.setup || {};
  const fixed = (st.narr || []).filter(n => !C.isEach(n) && String(n.fixed || '').trim());
  const need = narrNeed();
  let h = '';
  if(fixed.length) h += `<div class="st-card"><b style="font-size:13.5px">모든 학생에게 같은 글</b> <span class="nh-desc">평가 틀에서 고쳐요</span>${fixed.map(n => `<div class="it-row"><div class="tx"><small>${esc(n.t)}</small>${esc(n.fixed).replace(/\n/g, '<br>')}</div></div>`).join('')}</div>`;
  const blank = (st.narr || []).filter(n => !C.isEach(n) && !String(n.fixed || '').trim());
  if(blank.length) h += `<div class="nh-warn">«${blank.map(n => esc(n.t || '서술')).join('» · «')}»(모든 학생 같은 글)이 비어 있어요 — 비우면 출력에 나오지 않아요.${CAN.setup ? ' <button class="nh-btn xs" data-tab="set">평가 틀에서 쓰기</button>' : ''}</div>`;
  if(!need.length && !withOff) return h;
  h += `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">학생별 글</b><span class="nh-desc" style="margin:0">쓰는 대로 저장돼요 · 글자 수는 출력 쪽수에 영향을 줘요</span></div>
    ${SIDS.map(sid => `<div class="it-row" style="grid-template-columns:150px minmax(0,1fr)"><div><b>${esc(A.stuName(sid))}</b>${C.rowFilled(SUB, row(sid)) ? ' <span class="ch ok">✓</span>' : ''}${(withOff || SUB.kind === 'hr') ? `<br><label class="ck" style="font-size:11.5px"><input type="checkbox" data-off="${esc(sid)}"${row(sid).off ? ' checked' : ''}${ro()}>출력에서 빼기</label>` : ''}</div>
      <div>${need.map(n => `<div class="fl" style="margin-bottom:6px">${need.length > 1 || n.t ? `<span class="l" style="font-size:11.5px;font-weight:800;color:var(--ink-2)">${esc(n.t || '')}</span>` : ''}<textarea class="nh-ta" rows="3" data-nr="${esc(sid)}" data-ni="${esc(n.id)}"${ro()}${row(sid).off ? ' style="opacity:.5"' : ''}>${esc((row(sid).n || {})[n.id] || '')}</textarea><small class="nh-desc" style="margin:0" data-cnt="${esc(sid)}:${esc(n.id)}">${String((row(sid).n || {})[n.id] || '').length}자</small></div>`).join('') || '<span class="nh-desc">쓸 글이 없어요 (모두 같은 글)</span>'}</div></div>`).join('')}</div>`;
  return h;
}
function oneHTML(){
  const sid = SIDS[CUR]; const r = row(sid); const st = SUB.setup || {}; const t = SUB.type;
  let h = `<div class="st-card"><div class="st-nav"><button class="nh-btn sm" data-one="-1" ${CUR ? '' : 'disabled'}>◀</button><b>${esc(A.stuName(sid))}</b><span class="nh-desc" style="margin:0">${CUR + 1} / ${SIDS.length}</span>${C.rowFilled(SUB, r) ? '<span class="ch ok">✓ 다 채움</span>' : ''}<span class="nh-sp"></span><button class="nh-btn sm" data-one="1" ${CUR < SIDS.length - 1 ? '' : 'disabled'}>다음 ▶</button></div>
    <div class="stu-chips" style="margin-bottom:10px">${SIDS.map((x, i) => `<button class="${i === CUR ? 'on' : ''}${C.rowFilled(SUB, row(x)) ? ' dn' : ''}" data-pick="${i}">${esc(A.stuName(x))}</button>`).join('')}</div>`;
  if(SUB.kind === 'subj' && (t === 'E' || t === 'M')){
    let lastG = null;
    h += (st.items || []).map(it => {
      const g = String(it.g || '').trim(); const gh = g && g !== lastG ? `<div class="nh-sec" style="margin:10px 0 2px">${esc(g)}</div>` : ''; lastG = g || null;
      const v = Number((r.e || {})[it.id]) || 0;
      return gh + `<div class="it-row"><div class="tx">${esc(it.t)}</div><div class="lvs">${C.LEVELS.map(l => `<button class="${v === l.v ? 'on v' + l.v : ''}" data-lv1="${esc(sid)}" data-it="${esc(it.id)}" data-v="${l.v}"${ro()}>${esc(l.ko)}</button>`).join('')}</div></div>`;
    }).join('');
  }
  if(SUB.kind === 'subj' && (t === 'S' || t === 'M') && st.score){
    const sc = st.score; const v = r.s || {};
    h += `<div class="nh-sec" style="margin:12px 0 4px">${esc(sc.title || '성적')}</div><div class="frow">${(sc.cols || []).map(c => `<div class="fl" style="max-width:150px"><label>${esc(c.t)}${Number(c.w) > 0 ? ` (${esc(c.w)}%)` : ''}</label><input class="nh-in" inputmode="decimal" data-sc="${esc(sid)}" data-col="${esc(c.id)}" value="${esc(v[c.id] ?? '')}"${ro()}></div>`).join('')}
      ${sc.tot && sc.tot.on ? `<div class="fl" style="max-width:150px"><label>${esc(sc.tot.t || '총 점수')}</label>${(sc.cols || []).every(c => Number(c.w) > 0) ? `<b style="font-size:16px;padding:6px 0" data-tot="${esc(sid)}">${esc(C.scoreTotal(sc, v)) || '—'}</b>` : `<input class="nh-in" data-sc="${esc(sid)}" data-col="__tot" value="${esc(v.__tot ?? '')}"${ro()}>`}</div>` : ''}</div>`;
  }
  if(SUB.kind === 'subj' && t === 'R'){
    const rr = st.r || {}; const n = Math.max(1, Math.min(3, Number(rr.n) || 1));
    h += [1, 2, 3].slice(0, n).map(i => `<div class="fl"><label>${esc(rr.it || '내용')} ${n > 1 ? i : ''}</label><textarea class="nh-ta" rows="3" data-nr="${esc(sid)}" data-ni="c${i}"${ro()}>${esc((r.n || {})['c' + i] || '')}</textarea></div>`).join('');
  }
  (st.narr || []).forEach(n => {
    if(!C.isEach(n)){ if(String(n.fixed || '').trim()) h += `<div class="it-row"><div class="tx"><small>${esc(n.t)} · 모든 학생 같은 글</small>${esc(n.fixed).replace(/\n/g, '<br>')}</div></div>`; }
    else h += `<div class="fl" style="margin-top:8px"><label>${esc(n.t || '서술')}</label><textarea class="nh-ta" rows="4" data-nr="${esc(sid)}" data-ni="${esc(n.id)}"${ro()}>${esc((r.n || {})[n.id] || '')}</textarea><small class="nh-desc" style="margin:0" data-cnt="${esc(sid)}:${esc(n.id)}">${String((r.n || {})[n.id] || '').length}자</small></div>`;
  });
  h += `<label class="ck" style="margin-top:8px"><input type="checkbox" data-off="${esc(sid)}"${r.off ? ' checked' : ''}${ro()}>이 학생은 이 칸을 출력에서 빼기 (예: 이 과목을 듣지 않음 · 담임평가 쓰지 않음)</label></div>`;
  return h;
}
/* ── 출결 ── */
function attHTML(){
  const m = ENT.meta || {};
  const days = m.days != null ? m.days : '';
  const G = C.ATT_GROUPS;
  return `<div class="st-card"><div class="frow">
      <div class="fl"><label>제목</label><input class="nh-in" data-meta="title" value="${esc(m.title || '')}" placeholder="${esc(`출결 (정상 수업 기간 : ${C.shortRange(A.TERM.start, A.TERM.end)})`)}"${ro()}></div>
      <div class="fl" style="max-width:150px"><label>총 수업 일수</label><input class="nh-in" type="number" data-meta="days" value="${esc(days)}"${ro()}></div>
      <div class="fl" style="max-width:200px"><label>아래 설명 제목</label><input class="nh-in" data-meta="noteTitle" value="${esc(m.noteTitle || '')}" placeholder="*휴교 사유"${ro()}></div></div>
    <div class="fl"><label>아래 설명 (휴교 사유 등)</label><textarea class="nh-ta" rows="2" data-meta="note"${ro()}>${esc(m.note || '')}</textarea></div>
    ${CAN.edit ? `<div class="frow"><button class="nh-btn g sm" data-ej="attpull">📥 출석부에서 가져오기</button><span class="nh-desc" style="margin:0">출석부 «학기말 출결표»와 같은 셈 (결석 · 지각 · 조퇴 × 질병 · 무단 · 기타 · 체험학습 × 가족 대소사 · 가족 여행 · 기타) · 수업일수 · 휴교 사유도 학사일정에서</span></div>` : ''}</div>
    <div class="nh-tw"><table class="nh-t" data-grid="a"><thead><tr><th class="fc" rowspan="2">학생</th><th class="c" rowspan="2">수업일수<br><small>(비우면 위)</small></th><th class="c" rowspan="2">출석</th>${G.map(g => `<th class="c" colspan="3">${esc(g.ko)}</th>`).join('')}</tr>
      <tr>${G.map(g => g.subs.map(s => `<th class="c" style="top:31px;font-size:11px">${esc(s)}</th>`).join('')).join('')}</tr></thead>
    <tbody>${SIDS.map(sid => { const a = row(sid).a || {}; const d = a.days != null ? a.days : ''; const dd = Number(d !== '' ? d : days) || 0; const pr = Math.max(0, dd - C.sum3(a.ab));
      return `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b>${Number(a.lv) ? `<br><small style="color:var(--warn)">휴학 ${Number(a.lv)}일 제외</small>` : ''}</td>
      <td class="c"><input class="nh-in num" type="number" data-at="${esc(sid)}" data-g="days" value="${esc(d)}"${ro()}></td><td class="c"><b>${pr}</b></td>
      ${G.map(g => [0, 1, 2].map(i => `<td class="c"><input class="nh-in num" type="number" min="0" style="width:46px" data-at="${esc(sid)}" data-g="${g.k}" data-i="${i}" value="${Number((a[g.k] || [])[i]) || ''}"${ro()}></td>`).join('')).join('')}</tr>`; }).join('')}</tbody></table></div>
    <div class="nh-desc" style="margin-top:6px">출석 = 수업일수 − 결석 (지각 · 조퇴 · 체험학습은 출석 인정). 휴학 기간의 수업일은 그 학생 수업일수에서 빠져요 (가져오기 할 때).</div>`;
}
async function pullAttendance(){
  const ok = await A.confirm('📥 출석부에서 가져오기', '지금 표의 숫자를 출석부 기록으로 <b>모두 바꿔</b> 넣어요 (수업일수 · 휴교 사유 포함). 출석부를 고친 뒤 다시 가져와도 돼요.', '가져오기');
  if(!ok) return;
  window.showLoading && showLoading('출석부를 읽는 중…');
  try{
    const term = { start: A.TERM.start, end: A.TERM.end, org: C.ORG };
    const [ty, hs, wp] = await Promise.all([
      FS.getDocs(FS.collection(A.db, 'attendTypes')),
      FS.getDocs(FS.collection(A.db, 'holidays')),
      FS.getDocs(FS.collection(A.db, 'workPeriods')),
    ]);
    const types = []; ty.forEach(d => types.push(Object.assign({ id: d.id }, d.data())));
    const hol = []; hs.forEach(d => hol.push(d.data()));
    const wps = []; wp.forEach(d => wps.push(d.data()));
    const recs = [];
    const q = await FS.getDocs(FS.query(FS.collection(A.db, 'studentAttendance'), FS.where('date', '>=', term.start), FS.where('date', '<=', term.end)));
    q.forEach(d => { const x = d.data(); if(x.org === C.ORG && SIDS.includes(x.studentId)) recs.push(x); });
    const dayList = C.schoolDays(term, hol, wps);
    const by = {}; recs.forEach(r => { (by[r.studentId] = by[r.studentId] || []).push(r); });
    put('meta.days', dayList.length);
    const note = C.closureNote(hol, term);
    put('meta.note', note || '');   // 학사일정에 휴교가 없어졌으면 설명도 비운다
    SIDS.forEach(sid => {
      const st = A.STU[sid] || {};
      const lv = window.StuStatus ? StuStatus.leaveDays(st, dayList) : 0;
      const mine = (by[sid] || []).filter(r => !(window.StuStatus && StuStatus.onLeave(st, r.date)));
      const t = C.tallyAttendance(types, mine, term);
      const a = Object.assign({}, t, { lv: lv || 0 });
      if(lv) a.days = Math.max(0, dayList.length - lv);
      put(`rows.${sid}.a`, a);
    });
    await flush();
    A.toast(`가져왔어요 ✓ 수업일 ${dayList.length}일 · 기록 ${recs.length}개`);
  }catch(e){ A.toast('가져오지 못했어요 — ' + A.errText(e), 'err'); console.error(e); }
  window.hideLoading && hideLoading();
  drawBody();
}
/* ── 부모교육 ── */
const PE_SUG = ['수료', '미수료', '제출', '미제출', '등록', '미등록', '참석', '교사교육으로 대체'];
function parentHTML(){
  const pick = (SUB.setup || {}).pick || [];
  const items = (A.LISTS.parentEdu || []).filter(p => pick.includes(p.id));
  if(!items.length) return `<div class="nh-warn">이 반에 해당하는 부모교육 · 과제를 아직 고르지 않았어요. «🧩 설정»에서 고르세요.${(A.LISTS.parentEdu || []).length ? '' : ' (학기 공통 목록이 비어 있으면 나학평 담당이 «학기 설정 › 공통 목록»에서 먼저 넣어요)'}</div>`;
  const cols = []; items.forEach(p => { (p.target === 'F' ? ['f'] : p.target === 'M' ? ['m'] : ['f', 'm']).forEach(w => cols.push({ p, w })); });
  return `<datalist id="pe-sug">${PE_SUG.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="nh-desc">결과를 쓰면 그 줄이 출력돼요 (비우면 안 나옴). 예: 수료 · 미수료 · 5/5 · 교사교육으로 대체</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th class="fc">학생</th>${cols.map(c => `<th>${esc(c.p.t)}${c.p.d ? ` <small>${esc(c.p.d)}</small>` : ''}<br><small>${c.w === 'f' ? '아버지' : '어머니'}</small>${CAN.edit ? ` <button class="nh-btn xs ghost" data-peall="${esc(c.p.id)}" data-w="${c.w}" title="모두 같은 값">⋯</button>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${SIDS.map(sid => `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${cols.map(c => `<td><input class="nh-in" list="pe-sug" style="min-width:110px" data-pe="${esc(sid)}" data-p="${esc(c.p.id)}" data-w="${c.w}" value="${esc(((row(sid).p || {})[c.p.id] || {})[c.w] || '')}"${ro()}></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* ── 특별활동 ── */
function actHTML(){
  const acts = C.actsFor(A.LISTS, SUB.secId);
  if(!acts.length) return `<div class="nh-warn">이 반에 해당하는 특별활동이 학기 공통 목록에 없어요. 나학평 담당 · 목록 담당이 «학기 설정 › 공통 목록»에서 넣어요.</div>`;
  return `<div class="nh-desc">기본은 «모두 참여»예요 — <b>빠진 학생만 끄세요.</b> «고른 학생만» 활동(예: 강연회 발표)은 한 학생을 켜야 나와요.</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th class="fc">활동</th>${SIDS.map(sid => `<th class="c sv" title="${esc(A.stuLabel(sid))}">${esc(shortName(sid))}</th>`).join('')}</tr></thead>
    <tbody>${acts.map(a => `<tr><td class="fc" style="min-width:200px"><b>${esc(a.t)}</b> <small style="color:var(--ink-3)">${esc(a.d || '')}</small>${a.def === 'none' ? ' <span class="ch warn">고른 학생만</span>' : ''}${CAN.edit ? `<br><button class="nh-btn xs ghost" data-actall="${esc(a.id)}" data-on="1">모두 켜기</button><button class="nh-btn xs ghost" data-actall="${esc(a.id)}" data-on="0">모두 끄기</button>` : ''}</td>
      ${SIDS.map(sid => `<td class="c"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--sb-green)" data-act="${esc(sid)}" data-a="${esc(a.id)}"${C.joined(a, row(sid)) ? ' checked' : ''}${ro()}></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* ── 도서 ── */
function bookHTML(){
  const books = ((SUB.setup || {}).books || []).filter(b => String(b.t || '').trim());
  if(!books.length) return `<div class="nh-warn">도서 목록이 비어 있어요. «🧩 설정»에서 이 반이 학기 중 수업 시간에 읽은 책을 넣어 주세요 (25권까지).${CAN.setup ? ' <button class="nh-btn xs" data-tab="set">설정으로</button>' : ''}</div>`;
  return `<div class="nh-desc">기본은 «모두 읽음» — 읽지 않은 학생만 끄세요.</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th class="fc">도서</th>${SIDS.map(sid => `<th class="c sv" title="${esc(A.stuLabel(sid))}">${esc(shortName(sid))}</th>`).join('')}</tr></thead>
    <tbody>${books.map(b => `<tr><td class="fc"><b>${esc(b.t)}</b> <small style="color:var(--ink-3)">${esc(b.p || '')}</small></td>${SIDS.map(sid => `<td class="c"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--sb-green)" data-bk="${esc(sid)}" data-b="${esc(b.id)}"${(row(sid).no || {})[b.id] ? '' : ' checked'}${ro()}></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/* ── 봉사 · 수상 ── */
function serveHTML(){
  return `<div class="frow" style="align-items:center;margin-bottom:8px"><span class="nh-desc" style="margin:0">학생마다 봉사 · 수상을 줄로 넣어요 (7줄까지 권장). 같은 상을 여러 학생에게 넣으려면 →</span>${CAN.edit ? '<button class="nh-btn sm" data-ej="servebulk">＋ 여러 학생에게 같은 줄</button>' : ''}</div>
    ${SIDS.map(sid => { const L = row(sid).list || []; return `<div class="st-card"><div class="frow" style="align-items:center"><b>${esc(A.stuName(sid))}</b><span class="ch gray">${L.length}줄</span><span class="nh-sp"></span>${CAN.edit ? `<button class="nh-btn xs" data-svadd="${esc(sid)}">＋ 줄</button>` : ''}</div>
      ${L.map((x, i) => `<div class="frow" style="align-items:flex-start;margin-top:6px">
        <select class="nh-sel" style="height:34px;width:84px" data-sv="${esc(sid)}" data-i="${i}" data-f="k"${ro()}><option value="S"${x.k !== 'P' ? ' selected' : ''}>봉사</option><option value="P"${x.k === 'P' ? ' selected' : ''}>수상</option></select>
        <input class="nh-in" style="flex:1;min-width:150px" placeholder="제목 (예: 6단계 말씀암송상)" data-sv="${esc(sid)}" data-i="${i}" data-f="t" value="${esc(x.t || '')}"${ro()}>
        <input class="nh-in" style="width:130px" placeholder="날짜 (예: 4월 22일)" data-sv="${esc(sid)}" data-i="${i}" data-f="d" value="${esc(x.d || '')}"${ro()}>
        <textarea class="nh-ta" rows="1" style="flex:2;min-width:200px;min-height:36px" placeholder="활동 사항" data-sv="${esc(sid)}" data-i="${i}" data-f="c"${ro()}>${esc(x.c || '')}</textarea>
        ${CAN.edit ? `<button class="nh-btn xs r" data-svdel="${esc(sid)}" data-i="${i}">✕</button>` : ''}</div>`).join('')}</div>`; }).join('')}`;
}

/* ═══════════ 평가 틀 · 설정 ═══════════ */
function setupHTML(){
  const st = SUB.setup || {};
  const dis = CAN.setup ? '' : ' disabled';
  const k = SUB.kind;
  let h = '';
  if(!CAN.setup) h += `<div class="nh-info">평가 틀은 맡은 선생님이 «작성 중»일 때 고칠 수 있어요.</div>`;
  if(k === 'subj'){
    h += `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">평가 방식</b><span class="nh-sp"></span>${A.isMgr ? '' : `<span class="nh-desc" style="margin:0">방식 바꾸기는 나학평 담당이 «학기 설정 › 칸»에서 해요</span>`}</div>
      <div class="pk" style="margin-top:6px">${C.TYPE_ORDER.map(t => `<span class="ch ${SUB.type === t ? 'mint' : 'gray'}" title="${esc(C.TYPES[t].d)}">${esc(C.TYPES[t].ko)}</span>`).join('')}</div>
      <div class="nh-desc" style="margin-top:6px">${esc((C.TYPES[SUB.type] || {}).d || '')}${SUB.inheritedFrom ? ` · 지난 학기에서 이어받은 틀이에요` : ''}</div>
      <div class="frow" style="align-items:center;margin-top:4px"><span class="nh-desc" style="margin:0">듣는 학생: ${(SUB.studentIds || []).length ? `<b>${SUB.studentIds.length}명</b>만` : '반 모두'}</span>${(A.isMgr || (SUB.state === 'draft' && CAN.teacher)) ? '<button class="nh-btn xs" data-ej="students">학생 고르기</button>' : ''}
        <span class="nh-desc" style="margin:0 0 0 12px">출력 이름: <b>${esc(SUB.printName || SUB.name)}</b> · 교사 <b>${esc(SUB.printTeacher || (SUB.teacherUids || []).map(A.staffName).join(', ') || '—')}</b></span></div></div>`;
    const t = SUB.type;
    if(t === 'E' || t === 'M') h += itemsEditorHTML(st, dis);
    if(t === 'S' || t === 'M') h += scoreEditorHTML(st, dis);
    if(t === 'A') h += `<div class="st-card"><b style="font-size:14px">활동 서술 모양</b><div class="frow" style="margin-top:8px"><div class="fl"><label>상단 제목 (선택)</label><input class="nh-in" data-sa="t1" value="${esc((st.a || {}).t1 || '')}"${dis}></div><div class="fl"><label>상단 제목 2 (선택)</label><input class="nh-in" data-sa="t2" value="${esc((st.a || {}).t2 || '')}"${dis}></div></div>
      <label class="ck"><input type="checkbox" data-sa="noTitle"${(st.a || {}).noTitle ? ' checked' : ''}${dis}>항목 제목 없이 글만 (예전 «서술항목 타이틀 사용 안 함»)</label></div>`;
    if(t === 'R') h += `<div class="st-card"><b style="font-size:14px">암송 · 읽기 모양</b><div class="frow" style="margin-top:8px"><div class="fl"><label>전체 제목</label><input class="nh-in" data-sr="title" value="${esc((st.r || {}).title || '')}"${dis}></div><div class="fl"><label>항목 제목</label><input class="nh-in" data-sr="it" value="${esc((st.r || {}).it || '')}"${dis}></div>
      <div class="fl" style="max-width:120px"><label>내용 칸 수</label><select class="nh-sel" data-sr="n"${dis}>${[1, 2, 3].map(n => `<option${Number((st.r || {}).n || 1) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div></div>`;
    if(t !== 'R') h += narrEditorHTML(st, dis);
    return h;
  }
  if(k === 'hr') return h + `<div class="st-card"><div class="fl"><label>표 왼쪽 이름</label><input class="nh-in" data-hrl value="${esc(st.label || '담임 평가')}"${dis}></div></div>` + narrEditorHTML(st, dis, true);
  if(k === 'parent'){
    const L = A.LISTS.parentEdu || [];
    return h + `<div class="st-card"><b style="font-size:14px">이 반에 해당하는 부모교육 · 과제</b><div class="nh-desc">학기 공통 목록에서 골라요.</div>
      ${L.map(p => `<label class="ck" style="display:flex"><input type="checkbox" data-pep="${esc(p.id)}"${(st.pick || []).includes(p.id) ? ' checked' : ''}${dis}>${esc(p.t)} <small style="color:var(--ink-3)">${esc(p.d || '')} · ${esc(C.PE_TARGET[p.target] || '부모')}</small></label>`).join('') || '<div class="nh-desc">공통 목록이 비어 있어요.</div>'}
      <div class="fl" style="margin-top:8px"><label>표 아래 설명 (선택 — 예: ★[가정교육] 책 9월~10월 (모: 참석횟수/총수업일))</label><textarea class="nh-ta" rows="2" data-pen${dis}>${esc(st.note || '')}</textarea></div></div>`;
  }
  if(k === 'book'){
    const B = st.books || [];
    return h + `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">도서 목록</b><span class="ch gray">${B.length} / 25권</span><span class="nh-sp"></span>${CAN.setup ? '<button class="nh-btn xs" data-ej="bookpaste">엑셀에서 붙여넣기</button><button class="nh-btn xs g" data-ej="bookadd">＋ 책</button>' : ''}</div>
      ${B.map((b, i) => `<div class="frow" style="margin-top:6px"><input class="nh-in" style="flex:2" placeholder="도서명" data-bkf="${i}" data-f="t" value="${esc(b.t || '')}"${dis}><input class="nh-in" style="flex:1" placeholder="출판사" data-bkf="${i}" data-f="p" value="${esc(b.p || '')}"${dis}>${CAN.setup ? `<button class="nh-btn xs r" data-bkdel="${i}">✕</button>` : ''}</div>`).join('') || '<div class="nh-desc">아직 없어요.</div>'}</div>`;
  }
  if(k === 'vision' || k === 'camp'){
    const L = (k === 'vision' ? A.LISTS.visions : A.LISTS.camps) || [];
    return h + `<div class="st-card"><b style="font-size:14px">${k === 'vision' ? '비전트립' : '캠프'} 고르기</b><div class="nh-desc">학기 공통 목록(주제 · 기간 · 활동 …)에서 이 반에 해당하는 것을 골라요.</div>
      <select class="nh-sel" data-vcp${dis}><option value="">— 고르세요 —</option>${L.map(v => `<option value="${esc(v.id)}"${st.pick === v.id ? ' selected' : ''}>${esc(v.ref || v.theme || v.id)} ${esc(v.period || '')}</option>`).join('')}</select></div>` + narrEditorHTML(st, dis);
  }
  if(k === 'att') return h + `<div class="nh-desc">출결은 «✏️ 입력»에서 제목 · 수업일수 · 휴교 사유와 함께 넣어요.</div>`;
  if(k === 'act') return h + `<div class="nh-desc">특별활동 목록은 학기 공통이에요 (나학평 담당 · 목록 담당이 «학기 설정 › 공통 목록»에서 넣어요). 이 반 학생 체크는 «✏️ 입력»에서.</div>`;
  if(k === 'serve') return h + `<div class="nh-desc">따로 설정할 것이 없어요 — «✏️ 입력»에서 학생마다 넣어요.</div>`;
  return h;
}
function itemsEditorHTML(st, dis){
  const items = st.items || [];
  return `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">평가 항목</b><span class="ch gray">${items.length}개</span><span class="nh-sp"></span>
      ${CAN.setup ? '<button class="nh-btn xs" data-ej="itempaste">📋 여러 줄 붙여넣기</button><button class="nh-btn xs g" data-ej="itemadd">＋ 항목</button>' : ''}</div>
    <div class="nh-desc">«범위»(묶음)는 선택이에요 — 같은 범위를 이어서 쓰면 출력에서 한 칸으로 묶여요 (예: 경청 · 성실 · 개념이해).</div>
    ${items.map((it, i) => `<div class="frow" style="align-items:center;margin-top:6px;flex-wrap:nowrap"><b style="color:var(--ink-3);width:22px;text-align:right">${i + 1}</b>
      <input class="nh-in" style="width:130px;flex:none" placeholder="범위 (선택)" data-itf="${i}" data-f="g" value="${esc(it.g || '')}"${dis}>
      <input class="nh-in" style="flex:1;min-width:0" placeholder="평가 내용" data-itf="${i}" data-f="t" value="${esc(it.t || '')}"${dis}>
      ${CAN.setup ? `<button class="nh-btn xs" data-itup="${i}" ${i ? '' : 'disabled'}>↑</button><button class="nh-btn xs" data-itdn="${i}" ${i < items.length - 1 ? '' : 'disabled'}>↓</button><button class="nh-btn xs r" data-itdel="${i}">✕</button>` : ''}</div>`).join('') || '<div class="nh-desc" style="margin-top:8px">아직 없어요. «＋ 항목» 또는 엑셀 · 수업 계획서에서 «여러 줄 붙여넣기».</div>'}</div>`;
}
function scoreEditorHTML(st, dis){
  const sc = st.score || { cols: [] };
  const tot = sc.tot || { on: false, t: '총 점수' };
  return `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">시험 성적</b><span class="nh-sp"></span>${CAN.setup ? '<button class="nh-btn xs g" data-ej="coladd">＋ 시험 항목</button>' : ''}</div>
    <div class="frow" style="margin-top:6px"><div class="fl" style="max-width:160px"><label>표 왼쪽 제목</label><input class="nh-in" data-ss="title" value="${esc(sc.title || '성적')}"${dis}></div>
      <div class="fl" style="max-width:160px"><label>소제목</label><input class="nh-in" data-ss="sub" value="${esc(sc.sub || '')}" placeholder="예: 시험"${dis}></div>
      <div class="fl" style="max-width:160px"><label>학생 줄 이름</label><input class="nh-in" data-ss="r1" value="${esc(sc.r1 || '개인점수')}"${dis}></div>
      <div class="fl" style="max-width:160px"><label>평균 줄 이름</label><input class="nh-in" data-ss="r2" value="${esc(sc.r2 || '반 평균')}"${dis}></div></div>
    ${(sc.cols || []).map((c, i) => `<div class="frow" style="align-items:center;margin-top:6px;flex-wrap:nowrap"><b style="color:var(--ink-3);width:22px;text-align:right">${i + 1}</b>
      <input class="nh-in" style="flex:1;min-width:0" placeholder="항목 이름 (예: 기말고사)" data-scf="${i}" data-f="t" value="${esc(c.t || '')}"${dis}>
      <input class="nh-in" style="width:80px;flex:none" type="number" placeholder="비율%" data-scf="${i}" data-f="w" value="${esc(c.w ?? '')}"${dis}>
      <input class="nh-in" style="width:110px;flex:none" placeholder="평균 직접 (선택)" data-scavg="${esc(c.id)}" value="${esc((sc.avg || {})[c.id] || '')}"${dis}>
      ${CAN.setup ? `<button class="nh-btn xs r" data-scdel="${i}">✕</button>` : ''}</div>`).join('')}
    <div class="frow" style="align-items:center;margin-top:8px"><label class="ck"><input type="checkbox" data-ss="tot.on"${tot.on ? ' checked' : ''}${dis}>총 점수 칸</label><input class="nh-in" style="max-width:150px" data-ss="tot.t" value="${esc(tot.t || '총 점수')}"${dis}>
      <label class="ck"><input type="checkbox" data-ss="avgOn"${sc.avgOn !== false ? ' checked' : ''}${dis}>평균 줄 보이기</label></div>
    <div class="nh-desc">모든 항목에 비율(%)이 있으면 총 점수가 비율대로 계산돼요 (예: 기말 60 · 어휘력 30 · 태도 10). 평균을 직접 넣은 항목은 그 값이 나가요.</div></div>`;
}
function narrEditorHTML(st, dis, hr){
  const N = st.narr || [];
  return `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">${hr ? '담임평가 항목' : '서술 칸'}</b><span class="nh-sp"></span>${CAN.setup ? (hr ? `<button class="nh-btn xs g" data-ej="narradd" data-each="1">＋ 항목</button>` : `<button class="nh-btn xs" data-ej="narradd" data-each="0" data-t="수업 내용 개관">＋ 수업 내용 개관 (같은 글)</button><button class="nh-btn xs g" data-ej="narradd" data-each="1" data-t="교사 서술 평가">＋ 교사 서술 평가 (학생마다)</button>`) : ''}</div>
    <div class="nh-desc">${hr ? '항목마다 학생별 글을 써요.' : '«모든 학생 같은 글»은 여기서 한 번 쓰면 모두에게 나가요 (예: 수업 내용 개관). «학생마다 따로»는 입력 화면에서 학생마다 써요 (예: 교사 서술 평가).'}</div>
    ${N.map((n, i) => { const each = hr ? true : C.isEach(n); return `<div class="stg" style="margin-top:6px"><div class="h"><input class="nh-in" list="narr-pre" style="max-width:240px" data-nrf="${i}" data-f="t" value="${esc(n.t || '')}" placeholder="칸 제목"${dis}>
      ${hr ? '' : `<select class="nh-sel" style="height:34px" data-nreach="${i}"${dis}><option value="0"${each ? '' : ' selected'}>모든 학생 같은 글</option><option value="1"${each ? ' selected' : ''}>학생마다 따로</option></select>`}
      <span class="nh-sp"></span>${CAN.setup ? `<button class="nh-btn xs" data-nrup="${i}" ${i ? '' : 'disabled'}>↑</button><button class="nh-btn xs r" data-nrdel="${i}">✕</button>` : ''}</div>
      ${each ? '' : `<textarea class="nh-ta" rows="3" placeholder="모든 학생에게 나갈 글 (비워 두면 출력에 안 나와요)" data-nrf="${i}" data-f="fixed"${dis}>${esc(n.fixed || '')}</textarea>`}</div>`; }).join('') || '<div class="nh-desc">서술 칸이 없어요.</div>'}
    <datalist id="narr-pre">${C.NARR_PRESETS.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>`;
}
/* 평가 틀 저장 (0.6초 모아서) — 칸마다 따로 · 저장 전에 다른 분의 변경이 와도 내 화면 것을 지키고 저장 */
let ST = null;
const SPEND = {};
function saveSetup(now){
  SPEND[SUB.id] = SUB.setup;
  clearTimeout(ST);
  showSave('ing');
  if(now) return flushSetup();
  ST = setTimeout(flushSetup, 600);
}
async function flushSetup(){
  clearTimeout(ST); ST = null;
  for(const id of Object.keys(SPEND)){
    const setup = SPEND[id];
    try{ await A.saveSub(id, { setup }); if(SPEND[id] === setup) delete SPEND[id]; if(SUB && SUB.id === id) showSave('ok'); }
    catch(e){
      if(/permission/.test((e && e.code) || '')) delete SPEND[id];
      A.toast('평가 틀을 저장하지 못했어요 — ' + A.errText(e), 'err'); if(SUB && SUB.id === id) showSave('err');
    }
  }
}

/* ═══════════ 학기 중 기록 (수업 계획서 · 회차 점수 → 평균) ═══════════ */
let MK_SES = '';
async function loadMarks(){
  if(MARKS && MARKS.__id === SUB.id) return;
  try{ const d = await FS.getDoc(FS.doc(A.db, 'nhpMarks', SUB.id)); MARKS = d.exists() ? d.data() : { sessions: [], m: {}, sc: {} }; }
  catch(e){ MARKS = { sessions: [], m: {}, sc: {} }; }
  MARKS.__id = SUB.id; MARKS.sessions = MARKS.sessions || []; MARKS.m = MARKS.m || {}; MARKS.sc = MARKS.sc || {};
}
async function saveMarks(patch){
  const ref = FS.doc(A.db, 'nhpMarks', SUB.id);
  const data = Object.assign({ termId: SUB.termId, subjectId: SUB.id, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }, patch);
  // 통째로 바꿔 쓴다 (merge 는 지운 회차 · 점수가 남음)
  try{
    try{ await FS.updateDoc(ref, data); }
    catch(e){ if(e && e.code === 'not-found') await FS.setDoc(ref, data); else throw e; }
    showSave('ok');
  }catch(e){ A.toast('학기 중 기록을 저장하지 못했어요 — ' + A.errText(e), 'err'); }
}
const canMark = () => SUB.state !== 'done' && (CAN.teacher || A.isMgr);
function marksHTML(){
  const st = SUB.setup || {}; const items = st.items || []; const cols = ((st.score || {}).cols) || [];
  const S = MARKS.sessions;
  if(!MK_SES || !S.find(s => s.id === MK_SES)) MK_SES = S.length ? S[S.length - 1].id : '';
  const ses = S.find(s => s.id === MK_SES);
  const dis = canMark() ? '' : ' disabled';
  let h = `<div class="nh-info">📈 <b>학기 중 기록</b> — 수업 계획서의 평가 항목으로 회차마다 5단계(또는 점수)를 적어 두면, 학기 말에 <b>평균으로 단계를 제안</b>해요. 제안을 «학기 말 평가»에 채워 넣은 뒤 선생님이 고칠 수 있어요. (기록은 출력에 나오지 않아요)</div>
    <div class="frow" style="align-items:center;margin-bottom:8px"><b>회차</b>${S.map(s => `<button class="nh-btn xs ${s.id === MK_SES ? 'p' : ''}" data-mks="${esc(s.id)}">${esc(s.date ? s.date.slice(5).replace('-', '/') : '')} ${esc(s.title || '')}</button>`).join('') || '<span class="nh-desc" style="margin:0">아직 없어요</span>'}
      ${canMark() ? '<button class="nh-btn xs g" data-ej="mkadd">＋ 회차</button>' : ''}<span class="nh-sp"></span>${S.length ? '<button class="nh-btn sm" data-ej="mkavg">🧮 평균 보기 · 채우기</button>' : ''}</div>`;
  if(!ses) return h;
  h += `<div class="st-card"><div class="frow" style="align-items:center"><b>${esc(ses.date || '')} ${esc(ses.title || '')}</b>${canMark() ? `<button class="nh-btn xs" data-ej="mkedit">이름 · 날짜</button><button class="nh-btn xs r" data-ej="mkdel">회차 빼기</button>` : ''}</div>`;
  if(items.length && (SUB.type === 'E' || SUB.type === 'M')){
    const on = ses.items && ses.items.length ? items.filter(it => ses.items.includes(it.id)) : items;
    h += `<div class="nh-tw" style="margin-top:8px;max-height:60vh"><table class="nh-t" data-grid="mk"><thead><tr><th class="fc">평가 항목</th>${SIDS.map(sid => `<th class="c sv">${esc(shortName(sid))}</th>`).join('')}</tr></thead><tbody>${on.map(it => `<tr><td class="fc" style="min-width:220px;font-size:12px">${esc(it.t)}</td>${SIDS.map(sid => { const v = Number((((MARKS.m[sid] || {})[ses.id]) || {})[it.id]) || 0; return `<td class="c"><button class="lv${v ? ' v' + v : ''}" data-mk="${esc(sid)}" data-it="${esc(it.id)}"${dis}>${v || '·'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      ${canMark() ? `<div class="nh-desc" style="margin-top:6px">이 회차에 볼 항목만 고를 수도 있어요: <button class="nh-btn xs" data-ej="mkitems">항목 고르기</button></div>` : ''}`;
  }
  if(cols.length && (SUB.type === 'S' || SUB.type === 'M')){
    h += `<div class="nh-tw" style="margin-top:10px"><table class="nh-t"><thead><tr><th class="fc">학생</th>${cols.map(c => `<th class="c">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${SIDS.map(sid => `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${cols.map(c => `<td class="c"><input class="nh-in num" inputmode="decimal" data-mksc="${esc(sid)}" data-col="${esc(c.id)}" value="${esc((((MARKS.sc[sid] || {})[ses.id]) || {})[c.id] ?? '')}"${dis}></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return h + '</div>';
}
function marksAverage(){
  const st = SUB.setup || {}; const items = st.items || []; const cols = ((st.score || {}).cols) || [];
  const out = {};
  SIDS.forEach(sid => {
    const e = {}, s = {};
    items.forEach(it => { const vals = MARKS.sessions.map(ses => (((MARKS.m[sid] || {})[ses.id]) || {})[it.id]).filter(v => v); const r = C.suggestLevel(vals); if(r) e[it.id] = r; });
    cols.forEach(c => { const vals = MARKS.sessions.map(ses => (((MARKS.sc[sid] || {})[ses.id]) || {})[c.id]).filter(C.isNum).map(C.toNum); if(vals.length) s[c.id] = C.fmt1(vals.reduce((a, b) => a + b, 0) / vals.length); });
    out[sid] = { e, s };
  });
  return out;
}
async function marksFill(){
  const avg = marksAverage();
  const st = SUB.setup || {}; const items = st.items || []; const cols = ((st.score || {}).cols) || [];
  const m = A.modal('🧮 학기 중 기록 평균', `<div class="nh-desc">회차 ${MARKS.sessions.length}번의 평균이에요 (5단계는 반올림해서 제안). 학기 말 평가에 채우면 선생님이 하나씩 고칠 수 있어요.</div>
    <div class="nh-tw" style="max-height:55vh"><table class="nh-t"><thead><tr><th class="fc">학생</th>${items.map(it => `<th class="c sv" title="${esc(it.t)}">${esc(it.t.slice(0, 8))}…</th>`).join('')}${cols.map(c => `<th class="c">${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${SIDS.map(sid => `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${items.map(it => { const r = avg[sid].e[it.id]; return `<td class="c">${r ? `<span class="lv v${r.lv}" style="cursor:default" title="평균 ${r.avg} · ${r.n}회">${r.lv}</span>` : '·'}</td>`; }).join('')}${cols.map(c => `<td class="c">${esc(avg[sid].s[c.id] || '·')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    CAN.edit ? `<button class="nh-btn" data-c>닫기</button><button class="nh-btn" data-fill="empty">빈 칸만 채우기</button><button class="nh-btn p" data-fill="all">모두 덮어 채우기</button>` : `<button class="nh-btn" data-c>닫기</button>`, 'wide');
  const c = m.box.querySelector('[data-c]'); if(c) c.onclick = () => m.close();
  m.box.querySelectorAll('[data-fill]').forEach(b => b.onclick = async () => {
    const all = b.dataset.fill === 'all';
    let n = 0;
    SIDS.forEach(sid => {
      Object.entries(avg[sid].e).forEach(([it, r]) => { if(all || !(row(sid).e || {})[it]){ put(`rows.${sid}.e.${it}`, r.lv); n++; } });
      Object.entries(avg[sid].s).forEach(([col, v]) => { if(all || !String((row(sid).s || {})[col] ?? '').trim()){ put(`rows.${sid}.s.${col}`, v); n++; } });
    });
    await flush(); m.close(); A.toast(`${n}칸을 채웠어요 ✓ — «✏️ 입력»에서 확인하세요`); TAB = 'in'; draw();
  });
}

/* ═══════════ 미리보기 · 기록 ═══════════ */
let PV_I = 0;
function previewHTML(){
  if(!SIDS.length) return '<div class="nh-empty">학생이 없어요.</div>';
  PV_I = Math.min(PV_I, SIDS.length - 1);
  const sid = SIDS[PV_I];
  const b = C.blockFor(SUB, { stu: { id: sid, name: A.stuName(sid) }, sec: SEC, entry: ENT, lists: A.LISTS, staffName: A.staffName, term: A.TERM });
  const nos = {}; if(b && b.k === 'subj') nos[b.id] = A.SUBS.filter(s => s.secId === SUB.secId && s.kind === 'subj' && !s.removed && (s.order || 0) <= (SUB.order || 0)).length;
  const doc = { lang: 'ko', blocks: b ? [b] : [] };
  return `<div class="st-nav"><button class="nh-btn sm" data-pvi="-1" ${PV_I ? '' : 'disabled'}>◀</button><b>${esc(A.stuName(sid))}</b><span class="nh-desc" style="margin:0">${PV_I + 1} / ${SIDS.length}</span><button class="nh-btn sm" data-pvi="1" ${PV_I < SIDS.length - 1 ? '' : 'disabled'}>▶</button>
      <span class="nh-sp"></span><button class="nh-btn sm" data-ej="pvfull">📄 이 학생 나학평 전체 미리보기</button></div>
    <div class="nr-wrap">${b ? docWithNo(doc, nos) : '<div class="nh-desc">이 학생은 이 칸이 출력되지 않아요 (비었거나 «출력에서 빼기»).</div>'}</div>`;
}
function docWithNo(doc, nos){
  const p = C.blockParts(doc.blocks[0], 'ko', nos[doc.blocks[0].id], false);
  return `<div class="nr"><section class="nb">${p.head}${p.tables.map(t => C.tableHTML(t, false)).join('')}${p.notes.join('')}</section></div>`;
}
function logHTML(){
  const L = (SUB.log || []).slice().reverse();
  const AN = { submit: '📨 작성완료', withdraw: '↩ 되찾기', ok: '✅ 검토완료', redo: '↩️ 수정 요청', approve: '🔒 최종 승인', reopen: '🔓 다시 열기', cmt: '💬 코멘트', edit: '✏️ 고침' };
  const canCmt = A.isMgr || (SUB.state === 'draft' && CAN.teacher) || CAN.now;
  return `${canCmt ? `<div class="st-card"><div class="fl"><label>한 줄 코멘트 (이 칸 기록에 남아요 — 학과 개관 · 평가 항목 · 학생 평가에 대한 의견)</label><textarea class="nh-ta" rows="2" id="ej-cmt" placeholder="예: 3번 항목 표현을 다듬어 주세요"></textarea></div><button class="nh-btn sm p" data-ej="cmt">남기기</button></div>` : ''}
    <div class="st-card">${L.map(l => `<div class="lg-row"><div style="min-width:110px"><b>${esc(AN[l.act] || l.act)}</b><br><small>${esc(fmtAt(l.at))}</small></div><div style="flex:1"><b>${esc(l.name || A.staffName(l.uid))}</b>${l.st ? ` <span class="ch gray">${esc(l.st)}</span>` : ''}${l.msg ? `<div style="white-space:pre-wrap;margin-top:2px">${esc(l.msg)}</div>` : ''}</div></div>`).join('') || '<div class="nh-desc">아직 기록이 없어요.</div>'}</div>`;
}

/* ═══════════ 누르기 · 바꾸기 ═══════════ */
async function doAct(act){
  await flush(); await flushSetup();     // 입력 · 평가 틀을 먼저 다 저장 (작성완료 뒤에는 맡은 선생님이 못 고침)
  let msg = '';
  if(act === 'submit'){
    const p = C.progressOf(SUB, ENT, SIDS);
    const next = 'r1' in (SUB.rv || {}) ? (SUB.rvL || [])[0] : (SUB.finL || '최종 승인');
    const ok = await A.confirm('📨 작성완료 · 검토로 보내기', `${p.done < p.total ? `<b style="color:var(--danger)">아직 ${p.total - p.done}명이 덜 채워졌어요.</b><br>` : '모든 학생을 채웠어요 👏<br>'}보내면 <b>${esc(next || '')}</b> 단계로 넘어가고 입력이 잠겨요. (첫 단계 검토가 시작되기 전이면 «되찾기»로 다시 고칠 수 있어요)`, '보내기');
    if(!ok) return;
  }
  if(act === 'redo'){
    msg = await A.prompt('↩️ 수정 요청', '무엇을 고쳐야 하는지 적어 주세요 (맡은 선생님에게 알림이 가요)', '', { multi: true, required: '고칠 내용을 적어 주세요', ok: '수정 요청' });
    if(msg == null) return;
  }
  if(act === 'reopen'){
    msg = await A.prompt('🔓 다시 열기', '왜 다시 여는지 적어 주세요 (기록에 남아요)', '', { multi: true, required: '이유를 적어 주세요', ok: '다시 열기' });
    if(msg == null) return;
  }
  if(act === 'approve'){
    const ok = await A.confirm('🔒 최종 승인', '승인하면 이 칸은 <b>잠겨요</b> (아무도 입력을 고칠 수 없음 · 다시 열면 고칠 수 있음).', '승인');
    if(!ok) return;
  }
  if(act === 'cmt'){ msg = (document.getElementById('ej-cmt') || {}).value || ''; if(!msg.trim()) return A.toast('코멘트를 적어 주세요.', 'err'); }
  try{
    await A.act(SUB, act, msg);
    SUB = A.subOf(SUB.id);
    A.toast({ submit: '검토로 보냈어요 ✓', withdraw: '되찾았어요 — 다시 고칠 수 있어요', ok: '검토완료 ✓ 다음 단계로', redo: '수정 요청을 보냈어요', approve: '최종 승인했어요 🔒', reopen: '다시 열었어요', cmt: '코멘트를 남겼어요' }[act] || '됐어요');
    draw();
  }catch(e){ A.toast('하지 못했어요 — ' + A.errText(e), 'err'); }
}
function levelPop(btn, onPick){
  A.popMenu(btn, C.LEVELS.map(l => ({ l: `<span class="lv v${l.v}" style="cursor:inherit">${l.v}</span> ${esc(l.ko)}`, f: () => onPick(l.v) })).concat([{ l: '<span class="lv">·</span> 지우기', f: () => onPick(0) }]));
}
function setLevel(sid, it, v){
  put(`rows.${sid}.e.${it}`, v || null);
  const b = EL.querySelector(`[data-lv="${CSS.escape(sid)}"][data-it="${CSS.escape(it)}"]`);
  if(b){ b.className = 'lv' + (v ? ' v' + v : ''); b.textContent = v || '·'; b.title = v ? C.levelOf(v).ko : '비어 있음'; }
}
async function onClick(e){
  const t = e.target.closest('button,[data-ej],[data-tab],[data-mode]');
  if(!t) return;
  const d = t.dataset;
  if(d.tab){ await flush(); TAB = d.tab; draw(); return; }
  if(d.mode){ VIEWMODE = d.mode; drawBody(); return; }
  if(d.one){ CUR = Math.max(0, Math.min(SIDS.length - 1, CUR + Number(d.one))); drawBody(); return; }
  if(d.pick != null && t.closest('.stu-chips')){ CUR = Number(d.pick); drawBody(); return; }
  if(d.pvi){ PV_I = Math.max(0, Math.min(SIDS.length - 1, PV_I + Number(d.pvi))); drawBody(); return; }
  if(d.lv){ if(!CAN.edit) return; levelPop(t, v => setLevel(d.lv, d.it, v)); return; }
  if(d.lv1){ if(!CAN.edit) return; const cur = Number(((row(d.lv1).e) || {})[d.it]) || 0; const v = Number(d.v); put(`rows.${d.lv1}.e.${d.it}`, cur === v ? null : v); drawBody(); return; }
  if(d.rowall){ levelPop(t, v => { SIDS.forEach(sid => setLevel(sid, d.rowall, v)); }); return; }
  if(d.colall){ levelPop(t, v => { ((SUB.setup || {}).items || []).forEach(it => setLevel(d.colall, it.id, v)); }); return; }
  if(d.mk){ if(!canMark()) return; levelPop(t, async v => { MARKS.m[d.mk] = MARKS.m[d.mk] || {}; MARKS.m[d.mk][MK_SES] = MARKS.m[d.mk][MK_SES] || {}; if(v) MARKS.m[d.mk][MK_SES][d.it] = v; else delete MARKS.m[d.mk][MK_SES][d.it]; t.className = 'lv' + (v ? ' v' + v : ''); t.textContent = v || '·'; await saveMarks({ m: MARKS.m }); }); return; }
  if(d.mks){ MK_SES = d.mks; drawBody(); return; }
  if(d.peall){ const v = await A.prompt('모두 같은 값', '모든 학생에게 넣을 결과', '', { ph: '예: 수료' }); if(v == null) return; SIDS.forEach(sid => put(`rows.${sid}.p.${d.peall}.${d.w}`, v.trim())); drawBody(); return; }
  if(d.actall){ const a = C.actsFor(A.LISTS, SUB.secId).find(x => x.id === d.actall); if(!a) return; SIDS.forEach(sid => setAct(sid, a, d.on === '1')); drawBody(); return; }
  if(d.svadd){ const L = (row(d.svadd).list || []).slice(); L.push({ id: C.rid('v'), k: 'P', t: '', d: '', c: '' }); put(`rows.${d.svadd}.list`, L); drawBody(); return; }
  if(d.svdel){ const L = (row(d.svdel).list || []).slice(); L.splice(+d.i, 1); put(`rows.${d.svdel}.list`, L); drawBody(); return; }
  if(d.itup || d.itdn || d.itdel){ const it = (SUB.setup.items || []).slice(); const i = +(d.itup || d.itdn || d.itdel);
    if(d.itdel){ if(!(await A.confirm('항목 빼기', `«${esc(it[i].t)}» 항목을 뺄까요? (학생들에게 넣은 이 항목의 단계도 출력에서 빠져요)`, '빼기', true))) return; it.splice(i, 1); }
    else { const j = d.itup ? i - 1 : i + 1; [it[i], it[j]] = [it[j], it[i]]; }
    SUB.setup = Object.assign({}, SUB.setup, { items: it }); saveSetup(true); drawBody(); return; }
  if(d.scdel){ const sc = Object.assign({}, SUB.setup.score); sc.cols = sc.cols.slice(); sc.cols.splice(+d.scdel, 1); SUB.setup = Object.assign({}, SUB.setup, { score: sc }); saveSetup(true); drawBody(); return; }
  if(d.nrup || d.nrdel){ const N = (SUB.setup.narr || []).slice(); const i = +(d.nrup || d.nrdel);
    if(d.nrdel){ if(!(await A.confirm('서술 칸 빼기', `«${esc(N[i].t || '서술')}» 칸을 뺄까요? (학생들이 쓴 글은 보관돼요)`, '빼기', true))) return; N.splice(i, 1); } else { [N[i - 1], N[i]] = [N[i], N[i - 1]]; }
    SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(true); drawBody(); return; }
  if(d.bkdel){ const B = (SUB.setup.books || []).slice(); B.splice(+d.bkdel, 1); SUB.setup = Object.assign({}, SUB.setup, { books: B }); saveSetup(true); drawBody(); return; }
  const a = d.ej; if(!a) return;
  if(['submit', 'withdraw', 'ok', 'redo', 'approve', 'reopen', 'cmt'].includes(a)) return doAct(a);
  if(a === 'retry') return flush();
  if(a === 'reload'){ ENT = await A.getEntry(SUB.id, true); drawBody(); const n = document.getElementById('ej-remote'); if(n) n.style.display = 'none'; return; }
  if(a === 'paste') return pasteGrid();
  if(a === 'attpull') return pullAttendance();
  if(a === 'servebulk') return serveBulk();
  if(a === 'students'){ await SETUP.editCellStudents(SUB.id, A); SUB = A.subOf(SUB.id); SIDS = A.subStudents(SUB); draw(); return; }
  if(a === 'itemadd'){ const it = (SUB.setup.items || []).concat([{ id: C.rid('i'), g: '', t: '' }]); SUB.setup = Object.assign({}, SUB.setup, { items: it }); saveSetup(true); drawBody(); setTimeout(() => { const ins = EL.querySelectorAll('[data-itf][data-f="t"]'); if(ins.length) ins[ins.length - 1].focus(); }, 30); return; }
  if(a === 'itempaste') return pasteItems();
  if(a === 'coladd'){ const sc = Object.assign({ title: '성적', cols: [], tot: { on: false, t: '총 점수' }, r1: '개인점수', r2: '반 평균', avgOn: true, avg: {} }, SUB.setup.score || {}); sc.cols = (sc.cols || []).concat([{ id: C.rid('c'), t: '', w: '' }]); SUB.setup = Object.assign({}, SUB.setup, { score: sc }); saveSetup(true); drawBody(); return; }
  if(a === 'narradd'){ const N = (SUB.setup.narr || []).concat([{ id: C.rid('n'), t: d.t || '', each: d.each === '1', fixed: '' }]); SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(true); drawBody(); return; }
  if(a === 'bookadd'){ const B = (SUB.setup.books || []); if(B.length >= 25) return A.toast('25권까지예요.', 'err'); SUB.setup = Object.assign({}, SUB.setup, { books: B.concat([{ id: C.rid('b'), t: '', p: '' }]) }); saveSetup(true); drawBody(); return; }
  if(a === 'bookpaste'){ const v = await A.prompt('도서 붙여넣기', '엑셀에서 «도서명 | 출판사» 두 칸을 복사해 붙여넣으세요', '', { multi: true });
    if(!v) return; const B = (SUB.setup.books || []).slice(); v.split(/\r?\n/).map(l => l.split('\t')).filter(c => c[0] && c[0].trim()).forEach(c => { if(B.length < 25) B.push({ id: C.rid('b'), t: c[0].trim(), p: (c[1] || '').trim() }); });
    SUB.setup = Object.assign({}, SUB.setup, { books: B }); saveSetup(true); drawBody(); return; }
  if(a === 'pvfull'){ const sid = SIDS[PV_I]; window.showLoading && showLoading('문서를 만드는 중…');
    try{ const doc = await A.liveDoc(SUB.secId, sid); const pages = await A.pagesOf(doc); window.hideLoading && hideLoading(); A.showPages(pages, `${esc(doc.cover.name)} — 미리보기`, doc, { draft: true }); }
    catch(err){ window.hideLoading && hideLoading(); A.toast('만들지 못했어요 — ' + A.errText(err), 'err'); } return; }
  if(a === 'mkadd' || a === 'mkedit'){
    const ses = a === 'mkedit' ? MARKS.sessions.find(s => s.id === MK_SES) : null;
    const m = A.modal(ses ? '회차 고치기' : '＋ 회차', `<div class="frow"><div class="fl" style="max-width:180px"><label>날짜</label><input class="nh-in" type="date" data-k="date" value="${esc(ses ? ses.date : C.todayStr())}"></div><div class="fl"><label>이름 (예: 3주차 · 단원평가)</label><input class="nh-in" data-k="title" value="${esc(ses ? ses.title : (MARKS.sessions.length + 1) + '회차')}"></div></div>`, '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>저장</button>');
    m.box.querySelector('[data-c]').onclick = () => m.close();
    m.box.querySelector('[data-ok]').onclick = async () => { const x = ses || { id: C.rid('m'), items: [] }; m.box.querySelectorAll('[data-k]').forEach(i => { x[i.dataset.k] = i.value; }); if(!ses) MARKS.sessions.push(x); MARKS.sessions.sort((p, q) => String(p.date).localeCompare(String(q.date))); MK_SES = x.id; await saveMarks({ sessions: MARKS.sessions }); m.close(); drawBody(); };
    return;
  }
  if(a === 'mkdel'){ if(!(await A.confirm('회차 빼기', '이 회차와 그 기록을 뺄까요?', '빼기', true))) return; MARKS.sessions = MARKS.sessions.filter(s => s.id !== MK_SES); Object.values(MARKS.m).forEach(x => { delete x[MK_SES]; }); Object.values(MARKS.sc).forEach(x => { delete x[MK_SES]; }); await saveMarks({ sessions: MARKS.sessions, m: MARKS.m, sc: MARKS.sc }); MK_SES = ''; drawBody(); return; }
  if(a === 'mkitems'){ const ses = MARKS.sessions.find(s => s.id === MK_SES); if(!ses) return; const items = SUB.setup.items || [];
    const m = A.modal('이 회차에 볼 항목', items.map(it => `<label class="ck" style="display:flex"><input type="checkbox" value="${esc(it.id)}"${!(ses.items || []).length || ses.items.includes(it.id) ? ' checked' : ''}>${esc(it.t)}</label>`).join(''), '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>저장</button>', 'mid');
    m.box.querySelector('[data-c]').onclick = () => m.close();
    m.box.querySelector('[data-ok]').onclick = async () => { const on = Array.from(m.box.querySelectorAll('input:checked')).map(i => i.value); ses.items = on.length === items.length ? [] : on; await saveMarks({ sessions: MARKS.sessions }); m.close(); drawBody(); };
    return; }
  if(a === 'mkavg') return marksFill();
}
function setAct(sid, a, on){
  if(a.def === 'none') put(`rows.${sid}.yes.${a.id}`, on ? true : null);
  else put(`rows.${sid}.no.${a.id}`, on ? null : true);
}
function onChange(e){
  const x = e.target; const d = x.dataset;
  if(d.off){ put(`rows.${d.off}.off`, x.checked ? true : null); if(VIEWMODE === 'grid') drawBody(); return; }
  if(d.act){ const a = C.actsFor(A.LISTS, SUB.secId).find(y => y.id === d.a); if(a) setAct(d.act, a, x.checked); return; }
  if(d.bk){ put(`rows.${d.bk}.no.${d.b}`, x.checked ? null : true); return; }
  if(d.sv){ const L = (row(d.sv).list || []).map(y => Object.assign({}, y)); if(!L[+d.i]) return; L[+d.i][d.f] = x.value; put(`rows.${d.sv}.list`, L); return; }
  if(d.meta){ put(`meta.${d.meta}`, d.meta === 'days' ? (x.value === '' ? null : Number(x.value)) : x.value); if(d.meta === 'days') drawBody(); return; }
  if(d.at){ const a = Object.assign({ ab: [0, 0, 0], la: [0, 0, 0], eo: [0, 0, 0], ex: [0, 0, 0] }, JSON.parse(JSON.stringify(row(d.at).a || {})));
    if(d.g === 'days'){ if(x.value === '') delete a.days; else a.days = Number(x.value); } else { a[d.g] = (a[d.g] || [0, 0, 0]).slice(); a[d.g][+d.i] = Math.max(0, Number(x.value) || 0); }
    put(`rows.${d.at}.a`, a); drawBody(); return; }
  // 평가 틀
  if(d.sa){ const a = Object.assign({}, SUB.setup.a || {}); a[d.sa] = x.type === 'checkbox' ? x.checked : x.value; SUB.setup = Object.assign({}, SUB.setup, { a }); saveSetup(); return; }
  if(d.sr){ const r = Object.assign({}, SUB.setup.r || {}); r[d.sr] = d.sr === 'n' ? Number(x.value) : x.value; SUB.setup = Object.assign({}, SUB.setup, { r }); saveSetup(); return; }
  if(d.ss){ const sc = JSON.parse(JSON.stringify(SUB.setup.score || {})); if(d.ss.startsWith('tot.')){ sc.tot = sc.tot || {}; sc.tot[d.ss.slice(4)] = x.type === 'checkbox' ? x.checked : x.value; } else sc[d.ss] = x.type === 'checkbox' ? x.checked : x.value; SUB.setup = Object.assign({}, SUB.setup, { score: sc }); saveSetup(); return; }
  if(d.hrl != null && x.hasAttribute('data-hrl')){ SUB.setup = Object.assign({}, SUB.setup, { label: x.value }); saveSetup(); return; }
  if(d.pep){ const pick = new Set(SUB.setup.pick || []); if(x.checked) pick.add(d.pep); else pick.delete(d.pep); SUB.setup = Object.assign({}, SUB.setup, { pick: Array.from(pick) }); saveSetup(); return; }
  if(x.hasAttribute('data-pen')){ SUB.setup = Object.assign({}, SUB.setup, { note: x.value }); saveSetup(); return; }
  if(x.hasAttribute('data-vcp')){ SUB.setup = Object.assign({}, SUB.setup, { pick: x.value }); saveSetup(); return; }
  if(x.hasAttribute('data-nreach')){ const N = (SUB.setup.narr || []).map(y => Object.assign({}, y)); N[+d.nreach].each = x.value === '1'; SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(true); drawBody(); return; }
}
function onInput(e){
  const x = e.target; const d = x.dataset;
  if(d.nr){ put(`rows.${d.nr}.n.${d.ni}`, x.value); const c = EL.querySelector(`[data-cnt="${CSS.escape(d.nr + ':' + d.ni)}"]`); if(c) c.textContent = x.value.length + '자'; return; }
  if(d.sc){ put(`rows.${d.sc}.s.${d.col}`, x.value.trim()); const tt = EL.querySelector(`[data-tot="${CSS.escape(d.sc)}"]`); if(tt) tt.textContent = C.scoreTotal(SUB.setup.score, row(d.sc).s || {}) || '—'; return; }
  if(d.pe){ put(`rows.${d.pe}.p.${d.p}.${d.w}`, x.value.trim()); return; }
  if(d.mksc){ MARKS.sc[d.mksc] = MARKS.sc[d.mksc] || {}; MARKS.sc[d.mksc][MK_SES] = MARKS.sc[d.mksc][MK_SES] || {}; MARKS.sc[d.mksc][MK_SES][d.col] = x.value.trim(); clearTimeout(x._t); x._t = setTimeout(() => saveMarks({ sc: MARKS.sc }), 600); return; }
  if(d.itf != null && x.hasAttribute('data-itf')){ const it = (SUB.setup.items || []).map(y => Object.assign({}, y)); it[+d.itf][d.f] = x.value; SUB.setup = Object.assign({}, SUB.setup, { items: it }); saveSetup(); return; }
  if(d.scf != null && x.hasAttribute('data-scf')){ const sc = JSON.parse(JSON.stringify(SUB.setup.score || {})); sc.cols[+d.scf][d.f] = d.f === 'w' ? (x.value === '' ? '' : Number(x.value)) : x.value; SUB.setup = Object.assign({}, SUB.setup, { score: sc }); saveSetup(); return; }
  if(d.scavg){ const sc = JSON.parse(JSON.stringify(SUB.setup.score || {})); sc.avg = sc.avg || {}; if(x.value.trim()) sc.avg[d.scavg] = x.value.trim(); else delete sc.avg[d.scavg]; SUB.setup = Object.assign({}, SUB.setup, { score: sc }); saveSetup(); return; }
  if(d.nrf != null && x.hasAttribute('data-nrf')){ const N = (SUB.setup.narr || []).map(y => Object.assign({}, y)); N[+d.nrf][d.f] = x.value; SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(); return; }
  if(d.bkf != null && x.hasAttribute('data-bkf')){ const B = (SUB.setup.books || []).map(y => Object.assign({}, y)); B[+d.bkf][d.f] = x.value; SUB.setup = Object.assign({}, SUB.setup, { books: B }); saveSetup(); return; }
}
/* 표에서 숫자로 바로 넣기 · 화살표로 옮기기 */
function onKey(e){
  const b = e.target.closest && e.target.closest('[data-lv]');
  if(!b || !CAN.edit) return;
  document.querySelectorAll('.pop').forEach(p => p.remove());
  const td = b.closest('td'), tr = td.closest('tr');
  const cells = Array.from(tr.children), ci = cells.indexOf(td);
  const rows = Array.from(tr.closest('tbody').querySelectorAll('tr')).filter(r => r.querySelector('[data-lv]'));
  const ri = rows.indexOf(tr);
  const move = (dr, dc) => { const r2 = rows[ri + dr]; if(!r2) return; const c2 = r2.children[ci + dc]; const nb = c2 && c2.querySelector('[data-lv]'); if(nb) nb.focus(); };
  if(/^[1-5]$/.test(e.key)){ e.preventDefault(); setLevel(b.dataset.lv, b.dataset.it, Number(e.key)); move(1, 0); return; }
  if(e.key === 'Delete' || e.key === 'Backspace' || e.key === '0'){ e.preventDefault(); setLevel(b.dataset.lv, b.dataset.it, 0); return; }
  if(e.key === 'ArrowDown'){ e.preventDefault(); move(1, 0); } else if(e.key === 'ArrowUp'){ e.preventDefault(); move(-1, 0); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); const nb = cells[ci + 1] && cells[ci + 1].querySelector('[data-lv]'); if(nb) nb.focus(); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); const nb = cells[ci - 1] && cells[ci - 1].querySelector('[data-lv]'); if(nb) nb.focus(); }
}
/* 엑셀에서 5단계 붙여넣기 — 줄 = 항목 · 칸 = 학생 (화면 표와 같은 모양) */
async function pasteGrid(){
  const items = (SUB.setup || {}).items || [];
  const m = A.modal('📋 엑셀에서 붙여넣기', `<div class="nh-desc">엑셀에서 숫자(5~1)를 복사해 붙여넣으세요. <b>줄 = 평가 항목 (위에서부터)</b> · <b>칸 = 학생 (아래 순서)</b> — 학생 한 명만이면 한 칸(세로로 숫자)만.</div>
    <div class="fl"><label>시작 학생</label><select class="nh-sel" data-st>${SIDS.map((sid, i) => `<option value="${i}">${i + 1}. ${esc(A.stuName(sid))}</option>`).join('')}</select></div>
    <textarea class="nh-ta" rows="8" data-v placeholder="5\t4\t5\n4\t4\t3\n…"></textarea><div class="nh-desc" data-pv></div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>넣기</button>', 'mid');
  const ta = m.box.querySelector('[data-v]'), pv = m.box.querySelector('[data-pv]');
  const parse = () => ta.value.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').map(l => l.split(/\t|,| {2,}/).map(x => x.trim()));
  ta.oninput = () => { const g = parse(); pv.textContent = g.length ? `항목 ${Math.min(g.length, items.length)}줄 × 학생 ${Math.max(...g.map(r => r.length))}명` : ''; };
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = () => {
    const g = parse(); const s0 = Number(m.box.querySelector('[data-st]').value) || 0;
    let n = 0, bad = 0;
    g.forEach((r, i) => { const it = items[i]; if(!it) return; r.forEach((v, j) => { const sid = SIDS[s0 + j]; if(!sid) return; if(/^[1-5]$/.test(v)){ put(`rows.${sid}.e.${it.id}`, Number(v)); n++; } else if(v) bad++; }); });
    m.close(); drawBody(); A.toast(`${n}칸을 넣었어요${bad ? ` · 숫자가 아닌 ${bad}칸은 건너뜀` : ''} ✓`);
  };
}
async function pasteItems(){
  const v = await A.prompt('📋 평가 항목 여러 줄 붙여넣기', '한 줄에 하나씩 — 범위가 있으면 «범위[탭]평가 내용» (엑셀 두 칸)', '', { multi: true, ph: '경청\t선생님의 말씀과 친구들의 말을 경청한다.\n성실\t매시간 꾸준히 학습 분량을 완수한다.' });
  if(!v) return;
  const add = v.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const c = l.split('\t'); return c.length > 1 ? { id: C.rid('i'), g: c[0].trim(), t: c.slice(1).join(' ').trim() } : { id: C.rid('i'), g: '', t: c[0].trim() }; });
  SUB.setup = Object.assign({}, SUB.setup, { items: (SUB.setup.items || []).filter(x => String(x.t || '').trim()).concat(add) });
  await saveSetup(true); drawBody(); A.toast(`${add.length}개 더했어요 ✓`);
}
async function serveBulk(){
  const m = A.modal('＋ 여러 학생에게 같은 줄', `<div class="frow"><div class="fl" style="max-width:110px"><label>구분</label><select class="nh-sel" data-k="k"><option value="P">수상</option><option value="S">봉사</option></select></div>
      <div class="fl"><label>제목</label><input class="nh-in" data-k="t" placeholder="예: 6단계 말씀암송상"></div><div class="fl" style="max-width:160px"><label>날짜</label><input class="nh-in" data-k="d" placeholder="예: 4월 22일"></div></div>
    <div class="fl"><label>활동 사항</label><textarea class="nh-ta" rows="2" data-k="c"></textarea></div>
    <div class="stu-chips" data-l>${SIDS.map(sid => `<button data-sid="${esc(sid)}">${esc(A.stuName(sid))}</button>`).join('')}</div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>넣기</button>', 'mid');
  const sel = new Set();
  m.box.querySelector('[data-l]').onclick = e => { const b = e.target.closest('[data-sid]'); if(!b) return; b.classList.toggle('on'); if(b.classList.contains('on')) sel.add(b.dataset.sid); else sel.delete(b.dataset.sid); };
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = () => {
    const x = {}; m.box.querySelectorAll('[data-k]').forEach(i => { x[i.dataset.k] = i.value.trim(); });
    if(!x.t) return A.toast('제목을 넣어 주세요.', 'err');
    if(!sel.size) return A.toast('학생을 골라 주세요.', 'err');
    sel.forEach(sid => { const L = (row(sid).list || []).slice(); L.push(Object.assign({ id: C.rid('v') }, x)); put(`rows.${sid}.list`, L); });
    m.close(); drawBody(); A.toast(`${sel.size}명에게 넣었어요 ✓`);
  };
}
