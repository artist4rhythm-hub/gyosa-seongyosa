/* ═══════════════════════════════════════════════════════════
   ✏️ nhp-entry.js — 나학평 칸 하나 (입력 · 평가 틀 · 학기 중 기록 · 미리보기 · 기록) · v141
   · v144 평가 틀: ① 양식 ② 표 모양(범위 · 세부 칸 · 폭) ③ 평가 항목 ④ 서술 칸 + 오른쪽 출력 미리보기 · 📥 가져오기 · 🔗 함께 쓰기 · 👥 조별 칸
   · 맡은 선생님: 작성 중에 입력 → «작성완료»로 검토에 보냄
   · 검토관: 지금 단계면 오타를 바로 고치고 «검토완료» 또는 «수정 요청»
   · 최종 검토관: «최종 승인»(잠김) · «다시 열기»
   · 입력은 칸 하나씩 바로 저장 (0.5초 모아서) — 함께 맡은 선생님이 같은 칸을 써도 서로 덮어쓰지 않게 «바뀐 칸만» 저장
   · v153 🔎 빈 곳 · 이름 점검 — 덜 채운 학생과 빈 곳 · 다른 학생 이름이 들어간 서술 (화면에서만 · 저장되는 것 없음) · 작성완료 창에도 요약
   · v198 안전: ↩ 되돌리기 · 다시 하기 / 저장 못 한 입력은 이 기기에 보관 → 되살리기 / ⏱ 타임머신(지난 모습 — nhpEntries/칸/vers · 규칙 v54)
          평가 틀을 두 사람이 함께 고쳐도 합쳐서 저장 · 학기 중 기록은 바뀐 칸만 저장 · 상태를 바꾸기 전에 남은 입력부터 저장
   · v200 📜 고친 기록: 누가 · 언제 · 어느 학생 어느 칸을 · 무엇에서 무엇으로 (nhpEntries/칸/chg · 규칙 v55) — «이것만 되돌리기» · 내가 고친 것만 · 학기 전체(담당)
   · v202 🗄 가져오기 서랍: 내 다른 반 · 다른 선생님 · 지난 학기의 «내용»(모든 학생 같은 글 · 학생별 글 · 5단계)을 같은 학생끼리 · 문장 모음(나만 — userMemos.nhpPhrases)
   · v201 🎉 특별활동: 활동 날짜의 출결(결석 · 지각 · 조퇴 · 체험학습 · 휴학)을 학생 칸에 보여 줌 · 수업일 모두 빠진 학생은 출석부대로 자동으로 뺌 · «한 곳에서» 화면(nhp-acts.js)
   ═══════════════════════════════════════════════════════════ */
import * as SETUP from './nhp-setup.js?v=199';
import * as ACTS from './nhp-acts.js?v=201';

let A = null, C = null, esc = null, FS = null;
let SUB = null, ENT = null, TAB = 'in', EL = null, CAN = null, SEC = null, SIDS = [];
let VIEWMODE = '', CUR = 0, unEnt = null, MARKS = null;
/* 저장 대기 — 칸마다 따로 (칸을 옮겨 다녀도 고친 것이 다른 칸에 섞이지 않게) · META 는 그 칸 문서를 처음 만들 때 쓰는 값 */
const PENDS = {}, META = {}; let PT = null, INFLIGHT = null, LAST_OK = 0, SAVE_ERR = '';
const pendOf = id => (PENDS[id] = PENDS[id] || {});
const bind = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

export async function render(a, el, id, tab){
  bind(a);
  chgFlushAll();
  flush(); flushSetup();          // 기다리지 않는다 — 칸마다 따로 저장되니 다른 칸으로 옮겨도 섞이지 않음 (연결이 끊겨도 화면은 넘어감)
  if(unEnt){ unEnt(); unEnt = null; }
  LOADING = true;                 // 새 칸의 입력을 읽는 동안에는 되돌리기를 받지 않음 (앞 칸 자료에 섞이지 않게)
  if(DW.el && (!SUB || SUB.id !== id)) dwClose();
  EL = el; SUB = A.subOf(id); MARKS = null; ACT_KICK = ''; ACT_AUTO = '';
  if(!SUB){ LOADING = false; el.innerHTML = `<div class="nh-empty">칸을 찾을 수 없어요. (다른 학기의 칸이거나 빠진 칸이에요) <br><button class="nh-btn sm" data-go="home">← 내 할 일</button></div>`; return; }
  TAB = tab || (A.lsGet('nhp_tab_' + id, 'in'));
  if(!['in', 'set', 'mk', 'pv', 'log'].includes(TAB)) TAB = 'in';
  SEC = A.secOf(SUB.secId);
  SIDS = A.subStudents(SUB);
  ENT = await A.getEntry(id, true);
  if(!ENT.rows) ENT.rows = {};
  LOADING = false;
  if(!SPEND[id]){ SRV[id] = SJ(SUB.setup || {}); delete THEIRS[id]; HOLD[id] = false; }
  CHG_N = 300; CHG_SID = ''; CHG_CACHE[id] = null; CHGOFF[id] = false; chgResume(id);
  STALE = false;
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
  { // v198 다른 분이 저장한 틀인지 — 내가 보낸 것 · 이미 아는 것이 아니면 «그분 것»
    const inc = SJ(s.setup || {});
    if(FLY[s.id] || HOLD[s.id]){ /* 저장 중 · 합친 뒤 다음 저장을 기다리는 중 — 저장할 때 서버에서 다시 읽어 견줌 */ }
    else if(inc !== SRV[s.id] && inc !== SENT[s.id]){ if(SPEND[s.id]) THEIRS[s.id] = JSON.parse(inc); else SRV[s.id] = inc; }
    else if(inc === SENT[s.id] && !THEIRS[s.id]) SRV[s.id] = inc;
  }
  if(SPEND[s.id]) s.setup = SPEND[s.id];      // 아직 저장 중인 평가 틀은 내 화면 것을 그대로
  const changed = s.state !== SUB.state || s.stage !== SUB.stage || JSON.stringify(s.teacherUids) !== JSON.stringify(SUB.teacherUids) || JSON.stringify(s.rv) !== JSON.stringify(SUB.rv) || s.removed !== SUB.removed;
  const setupChanged = JSON.stringify(s.setup) !== JSON.stringify(SUB.setup) || s.type !== SUB.type || JSON.stringify(s.studentIds) !== JSON.stringify(SUB.studentIds);
  SUB = s;
  if(changed){ CHGOFF[s.id] = false; if(Object.keys(CHGR[s.id] || {}).length){ clearTimeout(CHGT[s.id]); CHGT[s.id] = setTimeout(() => chgFlush(s.id), 1500); }
    const y = window.scrollY; draw(); window.scrollTo(0, y); A.toast('이 칸의 상태가 바뀌었어요 — ' + C.stateOf(s).ko); return; }
  if(setupChanged && TAB !== 'set'){ SIDS = A.subStudents(SUB); const y = window.scrollY; drawBody(); window.scrollTo(0, y); }
  else if(setupChanged){ SIDS = A.subStudents(SUB); staleDraw(); pvRefresh(); }     // v198 틀 탭에서도 — 옛 화면 위에 고쳐서 덮어쓰지 않게
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
  putRaw(path, empty ? undefined : v);
}
/* v === undefined → 그 칸을 지움 */
function putRaw(path, v){
  const prev0 = cloneV(getPath(ENT, path));
  if(!NOHIST) histAdd(SUB.id, path, prev0);
  chgNote(SUB.id, path, prev0, v);
  tmAuto();                       // ⏱ 고치기 «직전» 모습을 가끔(20분에 한 번) 보관
  setPath(ENT, path, v);
  pendOf(SUB.id)[path] = v === undefined ? DEL : v;
  META[SUB.id] = { termId: SUB.termId, secId: SUB.secId, kind: SUB.kind };
  A.ENT[SUB.id] = ENT;
  stashSave(SUB.id);
  histUI();
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
  INFL[id] = raw;                  // 보내는 중 — 끝나기 전에 창이 닫혀도 기기 보관에 남게
  const batch = {}; Object.keys(raw).forEach(k => { batch[k] = raw[k] === DEL ? FS.deleteField() : raw[k]; });
  const ref = FS.doc(A.db, 'nhpEntries', id);
  const here = () => SUB && SUB.id === id;
  try{
    batch.updatedAt = FS.serverTimestamp(); batch.updatedBy = A.CU.uid;
    try{ await FS.updateDoc(ref, batch); }
    catch(e){
      // 처음 저장 — 문서가 아직 없으면 보안 규칙은 «없음»이 아니라 «권한 없음»으로 답한다 (없는 문서를 고치는 요청에는 학기(termId)가 없어서)
      //   → 권한 오류면 문서가 정말 없는지 먼저 본다 (v197: 처음 쓰는 칸에서 «권한이 없어요»로 저장이 안 되던 것)
      let missing = !!(e && e.code === 'not-found');
      if(!missing && e && /permission/.test(e.code || '')){ try{ missing = !(await FS.getDoc(ref)).exists(); }catch(e2){} }
      if(missing){
        // 문서만 만들고(rows 는 건드리지 않음: 함께 맡은 선생님이 막 저장한 것을 지우지 않게) 고친 칸을 넣는다
        const m = META[id] || {};
        await FS.setDoc(ref, { termId: m.termId, subjectId: id, secId: m.secId || '', kind: m.kind || '', createdAt: FS.serverTimestamp() }, { merge: true });
        await FS.updateDoc(ref, batch);
      } else throw e;
    }
    LAST_OK = Date.now(); SAVE_ERR = '';
    if(INFL[id] === raw) delete INFL[id];
    stashSave(id);
    chgReady(id, raw);          // 저장된 것만 «고친 기록»으로
    if(here()){ showSave('ok'); scheduleCnt(); }
    return true;
  }catch(e){
    SAVE_ERR = A.errText(e);
    if(INFL[id] === raw) delete INFL[id];
    const perm = /permission/.test(e.code || '');
    // 못 저장한 것은 다시 넣어 둔다 (그 사이 새로 고친 칸은 새 값 그대로) · 권한이 없으면 버린다 (상태가 바뀜)
    if(!perm){ const Q = pendOf(id); Object.keys(raw).forEach(k => { if(!(k in Q)) Q[k] = raw[k]; }); }
    else { const F = (FAILED[id] = FAILED[id] || {}); Object.keys(raw).forEach(k => { F[k] = raw[k]; if(CHGQ[id]) delete CHGQ[id][k]; }); }   // v198 버리지 않고 이 기기에 보관 (저장되지 않았으니 고친 기록에는 안 남김)
    stashSave(id);
    if(here()) showSave('err');
    A.toast('저장하지 못했어요 — ' + SAVE_ERR + (perm ? ' · 넣은 값은 이 기기에 보관해 두었어요' : ''), 'err');

    if(perm && here()){ setTimeout(async () => {
      // 저장되지 않은 값이 화면에 남아 «저장된 것처럼» 보이지 않게 — 서버에 있는 모습으로 다시 읽음 (기다리는 입력은 그대로 얹음)
      try{ const f = await A.getEntry(id, true); if(here()){ ENT = f; if(!ENT.rows) ENT.rows = {}; const P = PENDS[id] || {}; Object.keys(P).forEach(k => setPath(ENT, k, P[k] === DEL ? undefined : P[k])); A.ENT[id] = ENT; } }catch(e2){}
      const s = A.subOf(id); if(s && here()){ SUB = s; draw(); }
    }, 400); }
    return perm;      // 권한 문제면 다음 칸으로 · 연결 문제면 멈추고 «다시 저장»을 기다림
  }
}
window.addEventListener('pagehide', () => { chgFlushAll(); });
window.addEventListener('beforeunload', e => { chgFlushAll(); if(hasPend() || Object.keys(SPEND).length){ flush(); flushSetup(); e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', () => { flush(); flushSetup(); if(DW.el && !(SUB && location.hash.startsWith('#s/' + SUB.id))) dwClose(); });
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

/* ═══════════ v198 ↩ 되돌리기 · ↪ 다시 하기 (이 화면에 있는 동안 · 칸마다 200번) ═══════════
   · 한 번에 넣은 여러 칸(붙여넣기 · 줄 전체 · 되살리기)은 한 묶음 · 같은 글 칸을 이어서 친 것도 한 묶음 */
const UNDO = {}, REDO = {}; let LOADING = false, NOHIST = false, UG_TICK = 0, UG_SET = false;
const cloneV = v => (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
function histAdd(id, path, prev){
  if(!UG_SET){ UG_SET = true; setTimeout(() => { UG_TICK++; UG_SET = false; }, 0); }
  const U = (UNDO[id] = UNDO[id] || []); const now = Date.now();
  const g = U[U.length - 1];
  if(g && g.tick === UG_TICK){ if(!g.ops.some(o => o.path === path)) g.ops.push({ path, prev }); g.t = now; }
  else if(g && g.ops.length === 1 && g.ops[0].path === path && now - g.t < 4000){ g.t = now; }
  else { U.push({ tick: UG_TICK, t: now, ops: [{ path, prev }] }); if(U.length > 200) U.shift(); }
  REDO[id] = [];
}
function undoRedo(again){
  if(!SUB || !CAN || !CAN.edit || LOADING) return;
  const from = (again ? REDO : UNDO)[SUB.id] || [];
  const g = from.pop();
  if(!g){ A.toast(again ? '다시 할 것이 없어요' : '되돌릴 것이 없어요'); return; }
  const back = { tick: -1, t: 0, ops: [] };
  NOHIST = true; VIA = again ? 'again' : 'undo';
  try{ g.ops.slice().reverse().forEach(o => { back.ops.push({ path: o.path, prev: cloneV(getPath(ENT, o.path)) }); putRaw(o.path, cloneV(o.prev)); }); }
  finally{ NOHIST = false; VIA = ''; }
  const to = again ? (UNDO[SUB.id] = UNDO[SUB.id] || []) : (REDO[SUB.id] = REDO[SUB.id] || []);
  to.push(back);
  histUI();
  if(TAB === 'in'){ const y = window.scrollY; drawBody(); window.scrollTo(0, y); }
  A.toast(again ? `다시 했어요 (${g.ops.length}칸)` : `되돌렸어요 (${g.ops.length}칸)`);
}
function histUI(){
  const u = document.getElementById('ej-undo'), r = document.getElementById('ej-again');
  if(u) u.disabled = !(SUB && CAN && CAN.edit && (UNDO[SUB.id] || []).length);
  if(r) r.disabled = !(SUB && CAN && CAN.edit && (REDO[SUB.id] || []).length);
}
document.addEventListener('keydown', e => {
  if(!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = (e.key || '').toLowerCase(); if(k !== 'z' && k !== 'y') return;
  if(!SUB || !EL || !EL.isConnected || TAB !== 'in' || document.querySelector('.mm-ov')) return;
  const t = e.target;
  if(t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(checkbox|radio|button)$/.test(t.type)))) return;   // 글 칸 안에서는 브라우저의 되돌리기
  e.preventDefault(); undoRedo(k === 'y' || e.shiftKey);
});

/* ═══════════ v198 💾 저장하지 못한 입력 — 이 기기에 보관 (창이 닫히거나 저장이 거절돼도 남음) ═══════════ */
const FAILED = {}, INFL = {};
const stashKey = id => 'nhp_un_' + ((A && A.CU && A.CU.uid) || '') + '_' + id;
function stashSave(id){
  try{
    const all = Object.assign({}, FAILED[id] || {}, INFL[id] || {}, PENDS[id] || {});      // 거절된 것 · 지금 보내는 중인 것 · 기다리는 것
    if(Object.keys(all).length) localStorage.setItem(stashKey(id), JSON.stringify({ at: Date.now(), p: all }));
    else localStorage.removeItem(stashKey(id));
  }catch(e){}
}
function stashRead(id){
  try{ const x = JSON.parse(localStorage.getItem(stashKey(id)) || 'null'); return x && x.p && typeof x.p === 'object' ? x : null; }catch(e){ return null; }
}
/* 남아 있는 보관분 가운데 «지금 저장된 것과 다른 칸»만 */
function stashDiff(id){
  const x = stashRead(id); if(!x) return null;
  const P = Object.assign({}, INFL[id] || {}, PENDS[id] || {}); const out = {};
  const F = FAILED[id] || {};      // 방금 거절된 것은 화면(ENT)에 아직 내 값이 남아 있을 수 있어 — 견주지 않고 «저장 안 됨»으로
  Object.keys(x.p).forEach(k => { if(k in P) return; const v = x.p[k] === DEL ? undefined : x.p[k]; if((k in F) || JSON.stringify(getPath(ENT, k)) !== JSON.stringify(v)) out[k] = x.p[k]; });
  return Object.keys(out).length ? { at: x.at, p: out } : null;
}
function stashCheck(){
  if(!SUB || !EL || !EL.isConnected) return;
  const id = SUB.id; const box = document.getElementById('ej-stash'); if(!box) return;
  if(Object.keys(PENDS[id] || {}).length || INFL[id]){ setTimeout(stashCheck, 1500); return; }      // 아직 저장 중 — 끝난 뒤 다시
  const d = stashDiff(id);
  if(!d){ if(!Object.keys(FAILED[id] || {}).length){ try{ localStorage.removeItem(stashKey(id)); }catch(e){} } box.style.display = 'none'; box.innerHTML = ''; return; }
  const n = Object.keys(d.p).length; const min = Math.max(0, Math.round((Date.now() - d.at) / 60000));
  box.style.display = '';
  box.innerHTML = `💾 <b>저장되지 않은 입력 ${n}칸</b>이 이 기기에 남아 있어요 (${min < 1 ? '방금' : min < 90 ? min + '분 전' : Math.round(min / 60) + '시간 전'}). ${CAN.edit ? '<button class="nh-btn xs g" data-ej="stashok">되살리기</button> ' : '<small>지금은 이 칸을 고칠 수 없어요 — 고칠 수 있게 되면 되살릴 수 있어요.</small> '}<button class="nh-btn xs" data-ej="stashno">버리기</button>`;
}
async function stashRestore(){
  const d = stashDiff(SUB.id); if(!d || !CAN.edit) return;
  const ks = Object.keys(d.p);
  // 무엇이 무엇으로 바뀌는지 — 다른 기기에서 더 나중에 넣은 값을 모르고 덮지 않게
  const line = k => { const m = /^rows\.([^.]+)\.(.+)$/.exec(k); const v = d.p[k] === DEL ? undefined : d.p[k];
    return `<div class="tm-ch"><div class="k">${m ? esc(A.stuName(m[1])) + ' · ' + esc(tmLabel(m[2])) : esc(k)}</div><div class="was"><small>이 기기에 남은 값</small>${tmVal(v)}</div><div class="now"><small>지금 저장된 값</small>${tmVal(getPath(ENT, k))}</div></div>`; };
  if(!(await A.confirm('💾 저장되지 않은 입력 되살리기', `<div style="max-height:46vh;overflow:auto">${ks.slice(0, 30).map(line).join('')}${ks.length > 30 ? `<small>외 ${ks.length - 30}칸</small>` : ''}</div>«지금 저장된 값»이 «이 기기에 남은 값»으로 바뀌어요. (↩ 되돌리기로 취소할 수 있어요)`, `${ks.length}칸 되살리기`))) return;
  FAILED[SUB.id] = {};
  VIA = 'stash'; try{ ks.forEach(k => putRaw(k, d.p[k] === DEL ? undefined : d.p[k])); } finally{ VIA = ''; }
  drawBody(); stashCheck();
  A.toast(`${ks.length}칸을 되살렸어요 ✓`);
}
async function stashDrop(){
  if(!(await A.confirm('보관한 입력 버리기', '이 기기에 남아 있는 저장되지 않은 입력을 버릴까요? (되돌릴 수 없어요)', '버리기', true))) return;
  FAILED[SUB.id] = {}; try{ localStorage.removeItem(stashKey(SUB.id)); }catch(e){}
  stashCheck();
}

/* ═══════════ v198 ⏱ 타임머신 — 이 칸의 지난 모습 (nhpEntries/<칸>/vers · 보안 규칙 v54) ═══════════
   · 보관하는 때: 작성완료 · 검토완료 · 수정 요청 직전 / 붙여넣기 · 한꺼번에 넣기 직전 / 되살리기 직전 / 쓰는 동안 20분에 한 번(고치기 직전 모습)
   · 규칙 v54 가 아직 없으면 조용히 쉰다 (입력 · 저장은 그대로) */
const TM = { at: {}, off: {}, last: {} };
const TM_GAP = 20 * 60000, TM_KEEP = 30;
const TM_WHY = { submit: '작성완료 직전', ok: '검토완료 직전', redo: '수정 요청 직전', approve: '최종 승인 직전', paste: '붙여넣기 직전', bulk: '한꺼번에 넣기 직전', auto: '쓰는 중 자동 보관', restore: '되살리기 직전', frame: '평가 틀 바꾸기 직전' };
async function tmSnap(why, rows, id){
  id = id || (SUB && SUB.id); if(!id || TM.off[id]) return false;
  rows = rows || (ENT && ENT.rows) || {};
  const js = JSON.stringify(rows);
  if(js === '{}' || js.length > 900000 || TM.last[id] === js) return false;
  const sub = A.subOf(id) || SUB;
  TM.at[id] = Date.now();
  try{
    await FS.addDoc(FS.collection(A.db, 'nhpEntries', id, 'vers'), { termId: sub.termId, subjectId: id, why, at: FS.serverTimestamp(), by: A.CU.uid, byName: (A.me().name || ''), n: Object.keys(rows).length, rows: JSON.parse(js) });
    TM.last[id] = js; try{ localStorage.setItem('nhp_tm_' + id, String(TM.at[id])); }catch(e){}
    return true;
  }catch(e){
    if(/permission/.test((e && e.code) || '')) TM.off[id] = true;     // 규칙 v54 게시 전 · 이 칸에 쓸 수 없는 때 — 이 칸만 쉼
    else TM.at[id] = Date.now() - TM_GAP + 120000;                    // 잠깐 안 된 것이면 2분 뒤 다시
    console.warn('타임머신 보관', e); return false;
  }
}
function tmAuto(){
  if(!SUB || TM.off[SUB.id]) return;
  const id = SUB.id;
  if(TM.at[id] == null){ let t = 0; try{ t = Number(localStorage.getItem('nhp_tm_' + id)) || 0; }catch(e){} TM.at[id] = t; }
  if(Date.now() - TM.at[id] < TM_GAP) return;
  TM.at[id] = Date.now();
  tmSnap('auto', cloneV(ENT.rows || {}), id);
}
/* 학생 한 명의 입력을 «저장되는 칸» 단위로 펼침 (출결 a · 봉사 목록 list 는 통째로 한 칸) */
function tmLeaves(o, pre, out){
  Object.keys(o || {}).forEach(k => { const v = o[k]; const p = pre ? pre + '.' + k : k;
    if(v && typeof v === 'object' && !Array.isArray(v) && k !== 'a') tmLeaves(v, p, out); else out[p] = v; });
  return out;
}
function tmDiff(was, now){
  const a = tmLeaves(was || {}, '', {}), b = tmLeaves(now || {}, '', {}); const out = [];
  new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => { if(JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ k, was: a[k], now: b[k] }); });
  return out;
}
const actLabel = (sub, k) => { const h = String(k || '').split('.'); if(sub && sub.kind === 'act' && /^(no|yes|au|mn)$/.test(h[0])){ const a = (A.LISTS.activities || []).find(x => x.id === h[1]); return (h[0] === 'au' ? '출석부로 자동 뺌 · ' : h[0] === 'mn' ? '손으로 바꿈 표시 · ' : '참여 · ') + ((a && a.t) || '활동'); } return null; };
const tmLabel = k => { const h = String(k || '').split('.'); if(SUB && SUB.kind === 'act' && /^(no|yes|au|mn)$/.test(h[0])){ const a = (A.LISTS.activities || []).find(x => x.id === h[1]); return (h[0] === 'au' ? '출석부로 자동 뺌 · ' : h[0] === 'mn' ? '손으로 바꿈 표시 · ' : '참여 · ') + ((a && a.t) || '활동'); } return C.leafLabel(SUB, k, (A.TERM.hr || {}).items); };
function tmVal(v){
  if(v === undefined || v === null || v === '') return '<i style="color:var(--ink-3)">(비어 있음)</i>';
  if(typeof v === 'object') return esc(JSON.stringify(v).slice(0, 120));
  const t = String(v); return esc(t.length > 260 ? t.slice(0, 260) + ' …' : t);
}
const tmAt = x => { try{ const d = x && x.toDate ? x.toDate() : new Date((x && x.seconds ? x.seconds * 1000 : x) || Date.now()); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }catch(e){ return ''; } };
const tmMs = x => { try{ return x && x.toMillis ? x.toMillis() : (x && x.seconds ? x.seconds * 1000 : 0); }catch(e){ return 0; } };
async function tmOpen(){
  await Promise.race([flush(), new Promise(r => setTimeout(r, 4000))]);
  const m = A.modal('⏱ 타임머신 — ' + esc(A.subLabel(SUB)), '<div class="nh-desc">지난 모습을 여는 중…</div>', '', 'wide');
  let L = [];
  try{ const snap = await FS.getDocs(FS.collection(A.db, 'nhpEntries', SUB.id, 'vers')); snap.forEach(d => L.push(Object.assign({ id: d.id }, d.data()))); }
  catch(e){
    m.body.innerHTML = /permission/.test((e && e.code) || '')
      ? '<div class="nh-warn">타임머신 보관함이 아직 열리지 않았어요 — 보안 규칙 <b>v54</b>가 게시되면 켜져요. (입력과 자동 저장, ↩ 되돌리기는 지금도 돼요)</div>'
      : `<div class="nh-warn">지난 모습을 읽지 못했어요 — ${esc(A.errText(e))}</div>`;
    return;
  }
  L.sort((a, b) => tmMs(b.at) - tmMs(a.at));
  // 오래된 것 정리 — 30개 넘으면 (맡은 선생님 · 담당만 지울 수 있음)
  if(L.length > TM_KEEP && (CAN.teacher || A.isMgr)){ const old = L.splice(TM_KEEP); old.forEach(v => FS.deleteDoc(FS.doc(A.db, 'nhpEntries', SUB.id, 'vers', v.id)).catch(() => {})); }
  if(!L.length){ m.body.innerHTML = '<div class="nh-empty">아직 보관된 지난 모습이 없어요.<br><small>작성완료 · 수정 요청 · 붙여넣기 직전, 그리고 쓰는 동안 20분에 한 번씩 저절로 보관돼요.</small></div>'; return; }
  let cur = L[0].id;
  const drawTM = () => {
    const v = L.find(x => x.id === cur) || L[0];
    const sids = SIDS.filter(sid => (v.rows || {})[sid] || (ENT.rows || {})[sid]);
    const D = sids.map(sid => ({ sid, d: tmDiff((v.rows || {})[sid], (ENT.rows || {})[sid]) })).filter(x => x.d.length);
    m.body.innerHTML = `<div class="tm-wrap"><div class="tm-list">${L.map(x => `<button class="tm-v${x.id === cur ? ' on' : ''}" data-tmv="${esc(x.id)}"><b>${esc(tmAt(x.at))}</b><span>${esc(TM_WHY[x.why] || x.why || '')}</span><small>${esc(x.byName || '')} · 학생 ${Number(x.n) || 0}명</small></button>`).join('')}</div>
      <div class="tm-det"><div class="frow" style="align-items:center;margin-bottom:8px"><b style="font-size:14px">${esc(tmAt(v.at))} 모습과 지금의 차이</b><span class="nh-sp"></span>${D.length && CAN.edit ? `<button class="nh-btn sm g" data-tmall>달라진 ${D.length}명 모두 그때로 되살리기</button>` : ''}</div>
      ${!CAN.edit ? '<div class="nh-info">지금은 이 칸을 고칠 수 없어 보기만 돼요.</div>' : ''}
      ${D.length ? D.map(x => `<div class="tm-stu"><div class="frow" style="align-items:center"><b>${esc(A.stuName(x.sid))}</b><small style="color:var(--ink-3)">${x.d.length}곳 다름</small><span class="nh-sp"></span>${CAN.edit ? `<button class="nh-btn xs" data-tmone="${esc(x.sid)}">이 학생만 되살리기</button>` : ''}</div>
        ${x.d.map(c => `<div class="tm-ch"><div class="k">${esc(tmLabel(c.k))}${CAN.edit && x.d.length > 1 ? `<br><button class="nh-btn xs" data-tmleaf="${esc(x.sid)}" data-k="${esc(c.k)}">이 칸만 되살리기</button>` : ''}</div><div class="was"><small>그때</small>${tmVal(c.was)}</div><div class="now"><small>지금</small>${tmVal(c.now)}</div></div>`).join('')}</div>`).join('') : '<div class="nh-empty">이때 모습과 지금이 같아요.</div>'}</div></div>`;
    m.body.querySelectorAll('[data-tmv]').forEach(b => { b.onclick = () => { cur = b.dataset.tmv; drawTM(); }; });
    const go = async (only, one) => {
      const list = only ? D.filter(x => x.sid === only) : D; if(!list.length) return;
      if(!(await A.confirm('⏱ 그때 모습으로 되살리기', `${only ? esc(A.stuName(only)) : `학생 ${list.length}명`}의 ${one ? `<b>${esc(tmLabel(one))}</b> 칸만` : '입력을'} <b>${esc(tmAt(v.at))}</b> 모습으로 바꿔요. 지금 모습도 타임머신에 보관되고, ↩ 되돌리기로 바로 취소할 수 있어요.`, '되살리기'))) return;
      await tmSnap('restore', cloneV(ENT.rows || {}));
      VIA = 'tm'; try{ list.forEach(x => x.d.filter(c => !one || c.k === one).forEach(c => putRaw(`rows.${x.sid}.${c.k}`, cloneV(c.was)))); } finally{ VIA = ''; }
      m.close(); drawBody(); A.toast(one ? '그 칸만 그때 모습으로 되살렸어요 ✓' : `${list.length}명을 그때 모습으로 되살렸어요 ✓`);
    };
    const all = m.body.querySelector('[data-tmall]'); if(all) all.onclick = () => go('');
    m.body.querySelectorAll('[data-tmone]').forEach(b => { b.onclick = () => go(b.dataset.tmone); });
    m.body.querySelectorAll('[data-tmleaf]').forEach(b => { b.onclick = () => go(b.dataset.tmleaf, b.dataset.k); });
  };
  drawTM();
}

/* ═══════════ v200 📜 고친 기록 — 누가 · 언제 · 어느 학생 어느 칸을 · 무엇에서 무엇으로 (nhpEntries/<칸>/chg · 보안 규칙 v55) ═══════════
   · 저장에 성공한 것만 · 같은 칸을 이어 고친 것은 한 줄로(처음 값 → 마지막 값) · 6초 쉬면(길어도 45초마다) 한 묶음으로 씀
   · 한 줄씩 «이것만 되돌리기» — 되돌린 것도 기록에 남음 · 규칙 v55 전이면 조용히 쉼 */
const CHGQ = {}, CHGR = {}, CHGT = {}, CHG0 = {}, CHGOFF = {}; let VIA = '';
const CHG_VIA = { undo: '되돌리기', again: '다시 하기', tm: '타임머신 되살리기', stash: '저장 안 된 입력 되살리기', revert: '기록에서 되돌리기', bulk: '한꺼번에 넣기', paste: '붙여넣기', att: '출석부대로 맞춤', acts: '특별활동 화면에서', import: '가져옴 (서랍)' };
function chgNote(id, path, prev, v){
  if(CHGOFF[id]) return;
  const Q = (CHGQ[id] = CHGQ[id] || {}); const x = Q[path];
  if(x){ x.now = cloneV(v); if(VIA) x.v = VIA; else delete x.v; } else Q[path] = Object.assign({ was: prev, now: cloneV(v) }, VIA ? { v: VIA } : {});
}
function chgReady(id, raw){
  const Q = CHGQ[id] || {}; const R = (CHGR[id] = CHGR[id] || {}); let any = false;
  Object.keys(raw).forEach(k => { const q = Q[k]; if(!q) return;
    const saved = raw[k] === DEL ? undefined : raw[k];
    let done;
    if(k in (PENDS[id] || {})){ done = Object.assign({}, q, { now: cloneV(saved) }); q.was = cloneV(saved); delete q.v; }     // 그새 또 고쳐 기다리는 중 — 지금 저장된 데까지만 기록하고, 다음 것은 여기서부터
    else { done = q; delete Q[k]; }
    R[k] = R[k] ? Object.assign({}, done, { was: R[k].was }) : done; any = true; });
  if(!any) return;
  chgKeep(id);
  if(!CHG0[id]) CHG0[id] = Date.now();
  clearTimeout(CHGT[id]);
  CHGT[id] = setTimeout(() => chgFlush(id), Date.now() - CHG0[id] > 45000 ? 0 : 3000);
}
/* 아직 못 쓴 기록은 이 기기에 적어 둔다 — 쓰기 전에 창이 닫혀도 다음에 그 칸을 열 때 이어서 씀 */
const chgKey = id => 'nhp_cg_' + ((A && A.CU && A.CU.uid) || '') + '_' + id;
function chgKeep(id){ try{ const R = CHGR[id] || {}; if(Object.keys(R).length) localStorage.setItem(chgKey(id), JSON.stringify(R)); else localStorage.removeItem(chgKey(id)); }catch(e){} }
function chgResume(id){
  try{ const R0 = JSON.parse(localStorage.getItem(chgKey(id)) || 'null'); if(!R0 || typeof R0 !== 'object') return;
    const R = (CHGR[id] = CHGR[id] || {}); Object.keys(R0).forEach(k => { if(!R[k]) R[k] = R0[k]; else R[k].was = R0[k].was; });
    if(Object.keys(R).length){ clearTimeout(CHGT[id]); CHGT[id] = setTimeout(() => chgFlush(id), 1500); } }catch(e){}
}
async function chgFlush(id){
  clearTimeout(CHGT[id]); CHG0[id] = 0;
  const R = CHGR[id]; if(!R || CHGOFF[id] || !Object.keys(R).length) return;
  CHGR[id] = {};
  const ch = Object.keys(R).filter(k => JSON.stringify(R[k].was) !== JSON.stringify(R[k].now)).map(k => {
    const o = { k }; if(R[k].was !== undefined && R[k].was !== null) o.w = R[k].was; if(R[k].now !== undefined && R[k].now !== null) o.n = R[k].now; if(R[k].v) o.v = R[k].v; return o; });
  const sub = A.subOf(id) || SUB;
  if(!ch.length || !sub){ chgKeep(id); return; }
  // 한 묶음이 너무 크면(글이 긴 여러 칸) 나눠 씀
  const parts = []; let cur = [], sz = 0;
  ch.forEach(c => { const n = JSON.stringify(c).length; if(cur.length && (sz + n > 300000 || cur.length >= 200)){ parts.push(cur); cur = []; sz = 0; } cur.push(c); sz += n; });
  if(cur.length) parts.push(cur);
  const back = list => { const R2 = (CHGR[id] = CHGR[id] || {}); list.forEach(c => { if(R2[c.k]) R2[c.k].was = c.w; else R2[c.k] = { was: c.w, now: c.n, v: c.v }; }); };
  for(let pi = 0; pi < parts.length; pi++){
    try{ await FS.addDoc(FS.collection(A.db, 'nhpEntries', id, 'chg'), { termId: sub.termId, subjectId: id, at: FS.serverTimestamp(), by: A.CU.uid, byName: (A.me().name || ''), cnt: parts[pi].length, ch: parts[pi] }); CHG_CACHE[id] = null; }
    catch(e){
      const rest = parts.slice(pi).reduce((a, b) => a.concat(b), []);
      back(rest);                                                              // 못 쓴 것은 모두 되돌려 놓고
      if(/permission/.test((e && e.code) || '')) CHGOFF[id] = true;            // 규칙 v55 게시 전 · 이 칸에 쓸 수 없는 때 — 상태가 바뀌면 다시 해 봄
      else { clearTimeout(CHGT[id]); CHGT[id] = setTimeout(() => chgFlush(id), 30000); }      // 잠깐 안 된 것이면 30초 뒤 다시
      chgKeep(id); console.warn('고친 기록', e); return;
    }
  }
  chgKeep(id);
}
function chgFlushAll(){ Object.keys(CHGR).forEach(id => { if(Object.keys(CHGR[id] || {}).length) chgFlush(id); }); }
/* 읽기 — 칸 하나의 기록 (최근 것부터) */
const CHG_CACHE = {}; let CHG_MINE = false, CHG_SID = '', CHG_N = 300;
async function chgLoad(id, n){
  const q = FS.query(FS.collection(A.db, 'nhpEntries', id, 'chg'), FS.orderBy('at', 'desc'), FS.limit(n || 300));
  const snap = await FS.getDocs(q); const L = [];
  snap.forEach(d => L.push(Object.assign({ id: d.id }, d.data())));
  L.sort((a, b) => tmMs(b.at) - tmMs(a.at));
  return L.slice(0, n || 300);
}
/* 기록 묶음 → 한 줄씩 (학생 · 칸) */
function chgLines(L, sub){
  const out = [];
  L.forEach(g => (Array.isArray(g.ch) ? g.ch : []).forEach((c, i) => { if(!c || typeof c.k !== 'string') return; const m = /^rows\.([^.]+)\.(.+)$/.exec(c.k);
    out.push({ gid: g.id, i, at: g.at, by: g.by, byName: A.staffName(g.by) || g.byName || '', sid: m ? m[1] : '', leaf: m ? m[2] : (c.k || ''), k: c.k, w: c.w, n: c.n, v: c.v, sub }); }));
  return out;
}
function chgLineHTML(x, opt){
  const sub = x.sub || SUB; const mine = x.by === A.CU.uid;
  const lab = x.sid ? (actLabel(sub, x.leaf) || C.leafLabel(sub, x.leaf, (A.TERM.hr || {}).items)) : (x.leaf === 'meta.days' ? '총 수업일수' : /^meta\.ack\./.test(x.leaf || '') ? '담임 확인 · ' + ((((A.LISTS.activities || []).find(a => a.id === String(x.leaf).split('.')[2]) || {}).t) || '활동') : x.leaf);
  const cur = opt && opt.cur ? getPath(ENT, x.k) : undefined;
  const moved = opt && opt.cur && JSON.stringify(cur === undefined ? null : cur) !== JSON.stringify(x.n === undefined ? null : x.n);
  const same = opt && opt.cur && JSON.stringify(cur === undefined ? null : cur) === JSON.stringify(x.w === undefined ? null : x.w);
  return `<div class="cg-row${mine ? ' me' : ''}"><div class="cg-h"><b>${esc(x.byName || '')}</b><small>${esc(tmAt(x.at))}</small>${x.v ? `<span class="ch gray">${esc(CHG_VIA[x.v] || x.v)}</span>` : ''}${opt && opt.where ? `<small class="w">${esc(opt.where)}</small>` : ''}</div>
    <div class="cg-b"><div class="k"><b>${esc(x.sid ? A.stuName(x.sid) : '이 칸 공통')}</b><span>${esc(lab)}</span></div>
      <div class="was"><small>바꾸기 전</small>${tmVal(x.w)}</div><div class="now"><small>바꾼 뒤</small>${tmVal(x.n)}</div></div>
    ${opt && opt.cur ? `<div class="cg-f">${moved ? `<small>그 뒤에 또 바뀌었어요 — 지금: ${tmVal(cur)}</small>` : ''}<span class="nh-sp"></span>${same ? '<small>지금 값이 «바꾸기 전»과 같아요</small>' : (CAN.edit ? `<button class="nh-btn xs" data-cgrev="${esc(x.gid)}" data-ci="${x.i}">↩ 이것만 되돌리기</button>` : '')}</div>` : (opt && opt.go ? `<div class="cg-f"><span class="nh-sp"></span><button class="nh-btn xs" data-cggo="${esc(opt.go)}">그 칸 기록 열기 →</button></div>` : '')}</div>`;
}
function chgPaneHTML(){
  const L = CHG_CACHE[SUB.id];
  if(L === undefined || L === null || L.loading){
    if(!(L && L.loading)){
      const id = SUB.id; CHG_CACHE[id] = { loading: true };       // 이 칸 것으로만 받음 (받는 사이 다른 칸으로 옮겨도 섞이지 않게) · 여는 중에는 또 묻지 않음
      chgLoad(id, CHG_N).then(r => { CHG_CACHE[id] = r; }, e => { CHG_CACHE[id] = { err: e }; }).then(() => { if(TAB === 'log' && SUB && SUB.id === id){ const b = document.getElementById('cg-pane'); if(b) b.outerHTML = chgPaneHTML(); } });
    }
    return '<div class="st-card" id="cg-pane"><div class="nh-desc">고친 기록을 여는 중…</div></div>';
  }
  if(L.err) return `<div class="st-card" id="cg-pane"><b style="font-size:14px">📜 고친 기록</b><div class="nh-warn" style="margin-top:8px">${/permission/.test((L.err && L.err.code) || '') ? '고친 기록 보관함이 아직 열리지 않았어요 — 보안 규칙 <b>v55</b>가 게시되면 켜져요.' : '기록을 읽지 못했어요 — ' + esc(A.errText(L.err))}</div></div>`;
  let lines = chgLines(L, SUB);
  const sids = [...new Set(lines.map(x => x.sid).filter(Boolean))];
  if(CHG_SID && !sids.includes(CHG_SID)) CHG_SID = '';
  const nMine = lines.filter(x => x.by === A.CU.uid).length;
  if(CHG_MINE) lines = lines.filter(x => x.by === A.CU.uid);
  if(CHG_SID) lines = lines.filter(x => x.sid === CHG_SID);
  return `<div class="st-card" id="cg-pane"><div class="frow" style="align-items:center;margin-bottom:8px"><b style="font-size:14px">📜 고친 기록</b><span class="nh-desc" style="margin:0">누가 · 언제 · 어느 학생 어느 칸을 · 무엇에서 무엇으로 — 한 줄씩 되돌릴 수 있어요 (되돌린 것도 기록에 남아요)</span><span class="nh-sp"></span><button class="nh-btn xs" data-ej="cgreload">새로 고침</button></div>
    <div class="frow" style="align-items:center;margin-bottom:8px"><div class="nh-tabs" style="border:0;padding:0;margin:0"><button data-cgf="all" class="${CHG_MINE ? '' : 'on'}">모두</button><button data-cgf="mine" class="${CHG_MINE ? 'on' : ''}">내가 고친 것만 ${nMine}</button></div>
      <select class="nh-sel" style="max-width:190px;height:34px" data-cgsid><option value="">학생 모두</option>${sids.map(sid => `<option value="${esc(sid)}"${sid === CHG_SID ? ' selected' : ''}>${esc(A.stuName(sid))}</option>`).join('')}</select></div>
    ${lines.length ? lines.slice(0, 400).map(x => chgLineHTML(x, { cur: true })).join('') : `<div class="nh-empty">${L.length ? '여기에 해당하는 기록이 없어요.' : '아직 고친 기록이 없어요. <small>(입력을 고치면 몇 초 뒤부터 여기에 쌓여요)</small>'}</div>`}
    ${L.length >= CHG_N ? `<div style="text-align:center;margin-top:8px"><button class="nh-btn sm" data-ej="cgmore">더 오래된 기록 보기</button></div>` : ''}</div>`;
}
async function chgRevert(gid, i){
  const L0 = CHG_CACHE[SUB.id]; const g = Array.isArray(L0) && L0.find(x => x.id === gid && x.subjectId === SUB.id); const c = g && (g.ch || [])[+i]; if(!c || !CAN.edit) return;
  const m = /^rows\.([^.]+)\.(.+)$/.exec(c.k || '');
  // 이 칸 학생의 한 칸(또는 이 칸 공통 값)일 때만 — 다른 칸 기록 · 잘못된 기록으로 엉뚱한 곳을 바꾸지 않게
  if(!((m && SIDS.includes(m[1])) || /^meta\.[A-Za-z0-9_]+(\.[A-Za-z0-9_-]+)?$/.test(c.k || ''))) return A.toast('이 기록은 여기서 되돌릴 수 없어요.', 'err');
  const cur = getPath(ENT, c.k);
  const moved = JSON.stringify(cur === undefined ? null : cur) !== JSON.stringify(c.n === undefined ? null : c.n);
  if(!(await A.confirm('↩ 이것만 되돌리기', `<div class="tm-ch" style="border:0;margin:0"><div class="k">${m ? esc(A.stuName(m[1])) + '<br>' + esc(tmLabel(m[2])) : esc(c.k)}</div><div class="now"><small>지금</small>${tmVal(cur)}</div><div class="was"><small>되돌리면</small>${tmVal(c.w)}</div></div>${moved ? '<div class="nh-warn">이 기록 뒤에 이 칸이 <b>또 바뀌었어요</b> — 되돌리면 그 뒤에 고친 것도 함께 사라져요.</div>' : ''}이 한 칸만 «바꾸기 전» 값으로 돌려요. (↩ 되돌리기로 바로 취소할 수 있고, 기록에도 남아요)`, '되돌리기'))) return;
  VIA = 'revert'; try{ putRaw(c.k, c.w === undefined ? undefined : cloneV(c.w)); } finally{ VIA = ''; }
  await Promise.race([flush().then(() => chgFlush(SUB.id)), new Promise(r => setTimeout(r, 5000))]);
  CHG_CACHE[SUB.id] = null; drawBody(); A.toast('그 칸만 되돌렸어요 ✓');
}
/* 📜 학기 전체 기록 (나학평 담당) — 칸마다 최근 기록을 모아 선생님 · 반 · 과목으로 걸러 봄 */
export async function openTermLog(a){
  bind(a);
  if(!A.isMgr || !A.TERM || document.querySelector('.mm-ov [data-termlog-box]')) return;
  const m = A.modal('📜 고친 기록 — ' + esc(C.termLabel(A.TERM)), '<div data-termlog-box><div class="nh-desc" data-pg>칸마다 기록을 모으는 중…</div></div>', '', 'wide');
  const subs = A.SUBS.filter(s => !s.removed); let lines = [], done = 0, denied = false, bad = 0;
  for(let i = 0; i < subs.length && document.body.contains(m.el); i += 12){
    await Promise.all(subs.slice(i, i + 12).map(async s => { try{ const got = chgLines(await chgLoad(s.id, 40), s); got.forEach(x => lines.push(x)); }catch(e){ if(/permission/.test((e && e.code) || '')) denied = true; else bad++; } done++; }));
    const pg = m.body.querySelector('[data-pg]'); if(pg) pg.textContent = `칸마다 기록을 모으는 중… ${done} / ${subs.length}`;
  }
  if(!document.body.contains(m.el)) return;
  if(denied && !lines.length){ m.body.innerHTML = '<div class="nh-warn">고친 기록 보관함이 아직 열리지 않았어요 — 보안 규칙 <b>v55</b>가 게시되면 켜져요.</div>'; return; }
  lines.sort((x, y) => tmMs(y.at) - tmMs(x.at));
  const F = { who: '', sec: '', subj: '', day: '' };
  const whos = [...new Map(lines.map(x => [x.by, x.byName])).entries()].sort((x, y) => String(x[1]).localeCompare(String(y[1]), 'ko'));
  const secs = (A.TERM.sections || []).slice().sort((x, y) => (x.gradeNo || 99) - (y.gradeNo || 99));
  const subjN = [...new Set(lines.map(x => A.subLabel(x.sub)))].sort((x, y) => x.localeCompare(y, 'ko'));
  const dayOf = x => { const t = tmMs(x.at); if(!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const days = [...new Set(lines.map(dayOf).filter(Boolean))].sort().reverse();
  const draw = () => {
    const L = lines.filter(x => (!F.who || x.by === F.who) && (!F.sec || x.sub.secId === F.sec) && (!F.subj || A.subLabel(x.sub) === F.subj) && (!F.day || dayOf(x) === F.day));
    const sel = (k, first, opts) => `<select class="nh-sel" style="max-width:190px;height:34px" data-tf="${k}"><option value="">${first}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${F[k] === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    m.body.innerHTML = `<div class="frow" style="align-items:center;margin-bottom:10px">${sel('who', '선생님 모두', whos)}${sel('sec', '반 모두', secs.map(s => [s.id, C.secLabel(s)]))}${sel('subj', '과목 · 칸 모두', subjN.map(n => [n, n]))}${sel('day', '날짜 모두', days.map(d => [d, d]))}<span class="nh-sp"></span><span class="nh-desc" style="margin:0">${L.length}줄${bad ? ` · 못 읽은 칸 ${bad}` : ''} · 칸마다 최근 40묶음까지</span></div>
      <div style="max-height:62vh;overflow:auto">${L.slice(0, 500).map(x => chgLineHTML(x, { where: `${A.whereOf(x.sub)} · ${A.subLabel(x.sub)}`, go: `s/${x.sub.id}/log` })).join('') || '<div class="nh-empty">해당하는 기록이 없어요.</div>'}${L.length > 500 ? '<div class="nh-desc">최근 500줄만 보여요 — 위에서 걸러 보세요.</div>' : ''}</div>`;
    m.body.querySelectorAll('[data-tf]').forEach(x => { x.onchange = () => { F[x.dataset.tf] = x.value; draw(); }; });
    m.body.querySelectorAll('[data-cggo]').forEach(x => { x.onclick = () => { m.close(); A.go(x.dataset.cggo); }; });
  };
  draw();
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
  NM_IX = null;
  CAN = C.canDo(SUB, A.CU.uid, A.isMgr);
  const p = C.progressOf(SUB, ENT, SIDS);
  const kind = C.KINDS[SUB.kind] || {};
  const isSubj = SUB.kind === 'subj';
  const tabs = [['in', '✏️ 입력'], ['set', isSubj ? '🧩 평가 틀' : '🧩 설정'], ...((isSubj && SUB.type !== 'A' && SUB.type !== 'R') ? [['mk', '📈 학기 중 기록']] : []), ['pv', '👀 미리보기'], ['log', `🗒 기록 · 코멘트${(SUB.log || []).filter(l => l.msg).length ? ' ' + (SUB.log || []).filter(l => l.msg).length : ''}`]];
  if(!tabs.some(t => t[0] === TAB)) TAB = 'in';
  const last = (SUB.log || []).slice().reverse().find(l => l.act === 'redo');
  EL.innerHTML = `<div style="margin-bottom:10px"><button class="nh-btn sm ghost" data-go="home">← 내 할 일</button> <button class="nh-btn sm ghost" data-go="board">📊 진행 현황</button></div>
    ${SUB.removed ? '<div class="nh-warn">이 칸은 학기 설정에서 «빠진 칸»이에요 (보관 중). 출력에 나오지 않아요.</div>' : ''}
    <div class="sj-top"><div class="tt"><div class="k">${esc(A.whereOf(SUB))} · ${esc(kind.icon || '')} ${esc(isSubj ? (SUB.grp ? '조별 과목' : '교과') : (kind.ko || '').split(' (')[0])}</div>
      <h2>${esc(A.subLabel(SUB))} ${A.typeChip(SUB)} ${A.stateChip(SUB)}</h2>
      <div class="m">${stageChain()}</div>
      <div class="m" style="margin-top:6px"><span>학생 ${SIDS.length}명 · <b style="color:var(--ink)">${p.done}명 채움</b></span><span class="sv-dot" id="ej-save">${LAST_OK ? '' : ''}</span>
        <span id="ej-remote" class="ch warn" style="display:none;cursor:pointer" data-ej="reload">다른 분이 고쳤어요 · 새로 보기</span></div></div>
      <div class="sj-acts">${actsHTML(p)}</div></div>
    ${SUB.state === 'draft' && last && last.msg ? `<div class="nh-note" style="cursor:default"><div style="font-size:18px">↩️</div><div><b>수정 요청</b> — ${esc(last.msg)}<small>${esc(last.name || '')} · ${esc(fmtAt(last.at))}</small></div></div>` : ''}
    ${lockNote()}
    <div class="nh-warn" id="ej-stash" style="display:none"></div>
    <div class="sj-bar"><div class="sj-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${TAB === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="sj-hist"><button class="nh-btn sm" id="ej-undo" data-ej="undo" title="방금 넣은 것 되돌리기 (Ctrl+Z)" disabled>↩ 되돌리기</button><button class="nh-btn sm" id="ej-again" data-ej="again" title="되돌린 것 다시 하기 (Ctrl+Y)" disabled>↪ 다시</button><button class="nh-btn sm" data-ej="tm" title="이 칸의 지난 모습 보기 · 되살리기">⏱ 타임머신</button>${dwCan() ? '<button class="nh-btn sm g" data-ej="drawer" title="내 다른 반 · 다른 선생님 · 지난 학기에 쓴 것 가져오기 · 자주 쓰는 문장 모음">🗄 가져오기 서랍</button>' : ''}</div></div>
    <div id="ej-body"></div>`;
  EL.onclick = onClick; EL.onchange = onChange; EL.oninput = onInput; EL.onkeydown = onKey;
  EL.onpointerdown = onGrip;
  EL.addEventListener('focusout', staleSoon);
  drawBody();
  histUI(); setTimeout(stashCheck, 1200);
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
  else if(TAB === 'set'){ B.innerHTML = setupHTML(); setTimeout(pvFit, 0); }
  else if(TAB === 'mk'){ B.innerHTML = '<div class="nh-desc">학기 중 기록을 여는 중…</div>'; loadMarks().then(() => { if(TAB === 'mk') B.innerHTML = marksHTML(); }); }
  else if(TAB === 'pv'){ B.innerHTML = previewHTML(); }
  else if(TAB === 'log') B.innerHTML = logHTML();
}
const ro = () => CAN.edit ? '' : ' disabled';
const row = sid => (ENT.rows || {})[sid] || {};

/* ═══════════ v153 🔎 빈 곳 · 이름 점검 (화면에서만 — 저장되는 것 없음) ═══════════ */
//  빈 곳: C.rowFilled 와 같은 기준으로 «무엇이» 비었는지 · 이름: 서술을 복사해 붙이다 못 고친 다른 학생 이름
let NM_IX = null;
const hasJong = ch => { const c = ch.charCodeAt(0) - 0xAC00; return c >= 0 && c < 11172 && c % 28 !== 0; };
function nameIx(){
  if(NM_IX) return NM_IX;
  const clean = sid => String(A.stuName(sid) || '').replace(/\s+/g, '');
  const near = new Set(SIDS.concat((SEC && SEC.students) || []));
  const all = new Set(near); ((A.TERM || {}).sections || []).forEach(x => (x.students || []).forEach(id => all.add(id)));
  const full = [], given = [];
  all.forEach(sid => { const n = clean(sid); if(n.length >= 2 && /[가-힣]/.test(n)) full.push({ sid, n }); });
  // 같은 반 · 조 학생은 «하늘이는 · 하늘이가 · 지우는 …»처럼 성 없이 쓴 것도 (받침 있는 이름은 «이»가 붙은 것만 — «하늘을 보며» 같은 말은 빼려고)
  near.forEach(sid => { const n = clean(sid); if(!/^[가-힣]{3,4}$/.test(n)) return; const g = n.slice(1);
    const tail = '(는|가|의|를|도|와|랑|에게|한테|만)';
    given.push({ sid, g, re: new RegExp('(^|[^가-힣])' + g + (hasJong(g.slice(-1)) ? '이' + tail : tail)) }); });
  return (NM_IX = { full, given });
}
function otherNames(sid, text){
  text = String(text || ''); if(!text.trim()) return [];
  const ix = nameIx();
  const me = String(A.stuName(sid) || '').replace(/\s+/g, '');
  const myG = /^[가-힣]{3,4}$/.test(me) ? me.slice(1) : '';
  const t = me ? text.split(me).join(' ') : text;
  const hit = [];
  const add = n => { if(n && !hit.includes(n)) hit.push(n); };
  ix.full.forEach(x => { if(x.sid !== sid && x.n !== me && t.includes(x.n)) add(A.stuName(x.sid)); });
  ix.given.forEach(x => { if(x.sid !== sid && x.g !== myG && x.re.test(t)) add(A.stuName(x.sid)); });
  return hit;
}
function cntHTML(sid, nid, v){
  v = String(v || '');
  const h = otherNames(sid, v);
  return `${v.length}자${h.length ? ` <b class="nm-warn">⚠ 다른 학생 이름 «${h.map(esc).join('» «')}» — 확인해 주세요</b>` : ''}`;
}
/* 이 칸에서 학생마다 쓰는 서술 칸 (출력에 나오는 것만) */
function narrSlots(){
  const st = SUB.setup || {};
  if(SUB.kind === 'subj' && SUB.type === 'R'){ const n = Math.max(1, Math.min(3, Number((st.r || {}).n) || 1)); return [1, 2, 3].slice(0, n).map(i => ({ id: 'c' + i, t: `${(st.r || {}).it || '내용'}${n > 1 ? ' ' + i : ''}` })); }
  if(!['subj', 'hr', 'vision', 'camp'].includes(SUB.kind)) return [];
  return (st.narr || []).filter(C.isEach).map(n => ({ id: n.id, t: n.t || '서술' }));      // 입력 화면 · C.rowFilled 와 같은 칸
}
/* 한 학생의 빈 곳 — C.rowFilled 와 같은 기준 (출력에서 뺀 학생은 없음) */
function missingOf(sid){
  const r = row(sid); if(r.off) return [];
  const st = SUB.setup || {}; const out = [];
  if(SUB.kind === 'subj'){
    const t = SUB.type || 'E';
    if(t === 'R'){ narrSlots().forEach(x => { if(!String((r.n || {})[x.id] || '').trim()) out.push(x.t); }); return out; }
    if(t === 'E' || t === 'M'){
      const items = st.items || [];
      const no = items.map((it, i) => C.levelOf((r.e || {})[it.id]) ? 0 : i + 1).filter(Boolean);
      if(no.length) out.push(no.length === items.length ? `5단계 ${items.length}칸 모두` : `5단계 ${no.length}칸 (${no.slice(0, 6).join('·')}${no.length > 6 ? '…' : ''}번)`);
    }
    if(t === 'S' || t === 'M'){
      const no = C.scoreCols(st.score).filter(c => String((r.s || {})[c.id] ?? '').trim() === '');
      if(no.length) out.push('점수 ' + no.map(c => c.t || '항목').join('·'));
    }
  }
  if(['subj', 'hr', 'vision', 'camp'].includes(SUB.kind)) narrSlots().forEach(x => { if(!String((r.n || {})[x.id] || '').trim()) out.push(x.t); });
  return out;
}
function checkList(){
  const miss = [], names = [];
  const slots = narrSlots();
  SIDS.forEach((sid, i) => {
    const m = missingOf(sid); if(m.length) miss.push({ sid, i, m });
    const r = row(sid); if(r.off) return;
    slots.forEach(x => { const h = otherNames(sid, (r.n || {})[x.id]); if(h.length) names.push({ sid, i, t: x.t, h }); });
  });
  return { miss, names };
}
const canCheck = () => ['subj', 'hr', 'vision', 'camp'].includes(SUB.kind);
function openCheck(){
  const { miss, names } = checkList();
  const go = i => `<button class="nh-btn xs" data-ckgo="${i}">고치러 가기</button>`;
  const body = `<div class="nh-desc" style="margin-top:0">작성완료 전에 한 번 훑어보는 곳이에요. 여기서는 아무것도 바뀌지 않아요.</div>
    <div class="ck-h">📝 덜 채운 학생 <b>${miss.length}명</b> <small>/ ${SIDS.length}명</small></div>
    ${miss.length ? miss.map(x => `<div class="ck-row"><b>${esc(A.stuName(x.sid))}</b><span>${x.m.map(esc).join(' · ')}</span>${go(x.i)}</div>`).join('') : '<div class="nh-desc">모두 채웠어요 👏</div>'}
    <div class="ck-h">⚠ 다른 학생 이름이 들어간 글 <b>${names.length}곳</b></div>
    ${names.length ? names.map(x => `<div class="ck-row"><b>${esc(A.stuName(x.sid))}</b><span>${esc(x.t)} — «${x.h.map(esc).join('» «')}»</span>${go(x.i)}</div>`).join('') : '<div class="nh-desc">없어요 👍</div>'}
    <div class="nh-desc" style="margin-top:10px">이름 점검은 이번 학기 학생 이름(성까지)과, 같은 반 · 조 학생의 «하늘이는 · 하늘이가»처럼 성 없이 쓴 이름을 찾아요. 일부러 쓴 이름(예: 짝 활동)이면 그대로 두셔도 돼요.</div>`;
  const m = A.modal('🔎 빈 곳 · 이름 점검', body, '<button class="nh-btn" data-c>닫기</button>', 'wide');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelectorAll('[data-ckgo]').forEach(b => b.onclick = () => { m.close(); TAB = 'in'; VIEWMODE = 'one'; CUR = Math.max(0, Math.min(SIDS.length - 1, Number(b.dataset.ckgo) || 0)); draw(); });
}

/* ═══════════ 입력 ═══════════ */
function inputHTML(){
  if(!SIDS.length) return `<div class="nh-empty">이 칸을 듣는 학생이 없어요. ${CAN.setup ? '«평가 틀 › 듣는 학생»에서 고를 수 있어요.' : ''}</div>`;
  const k = SUB.kind;
  if(k === 'subj'){
    const t = SUB.type || 'E';
    const st = SUB.setup || {};
    let h = modeBar();
    if((t === 'E' || t === 'M') && !(st.items || []).length) h += `<div class="nh-warn">평가 항목이 아직 없어요. «🧩 평가 틀»에서 항목을 먼저 넣어 주세요.${CAN.setup ? ' <button class="nh-btn xs" data-tab="set">평가 틀로</button>' : ''}</div>`;
    if((t === 'S' || t === 'M') && !C.scoreCols(st.score).length) h += `<div class="nh-warn">시험 항목이 아직 없어요. «🧩 평가 틀»에서 시험 항목을 넣어 주세요.</div>`;
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
    <span class="nh-sp"></span>${canCheck() ? '<button class="nh-btn sm" data-ej="check" title="덜 채운 학생 · 빈 곳 · 다른 학생 이름이 들어간 글">🔎 빈 곳 · 이름 점검</button>' : ''}${CAN.edit && SUB.kind === 'subj' && (SUB.type === 'E' || SUB.type === 'M') ? `<button class="nh-btn sm" data-ej="paste">📋 엑셀에서 붙여넣기</button>` : ''}</div>`;
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
  if(!sc || !C.scoreCols(sc, ENT.rows, SIDS).length) return '';
  const tot = sc.tot && sc.tot.on, weighted = C.scoreCols(sc).every(c => Number(c.w) > 0);
  const cols = C.scoreCols(sc, ENT.rows, SIDS);   // v198 이름도 비율도 점수도 없는 빈 항목은 숨김
  const avgRow = sc.avgOn !== false ? `<tr class="grp"><td class="fc">${esc(sc.r2 || '반 평균')} <small style="font-weight:400;color:var(--ink-3)">자동</small></td>${cols.map(c => `<td class="c" data-avg="${esc(c.id)}">${esc(C.scoreAvg(sc, ENT.rows, SIDS, c.id))}</td>`).join('')}${tot ? `<td class="c" data-avg="__tot">${esc(C.scoreAvg(sc, ENT.rows, SIDS, '__tot'))}</td>` : ''}</tr>` : '';
  return `<div class="st-card"><div class="frow" style="align-items:center;margin-bottom:8px"><b style="font-size:14px">${esc(sc.title || '성적')}${sc.sub ? ' · ' + esc(sc.sub) : ''}</b><span class="nh-desc" style="margin:0">${tot ? (weighted ? '총 점수는 비율대로 저절로 계산돼요.' : '비율이 없는 항목이 있어 총 점수를 직접 넣어요.') : ''} 학생 점수를 넣으면 <b>반 평균</b>은 맨 아래 줄에 저절로 계산돼요.</span></div>
    <div class="nh-tw"><table class="nh-t" data-grid="s"><thead><tr><th class="fc">학생</th>${cols.map(c => `<th class="c">${esc(c.t)}${Number(c.w) > 0 ? ` <small>(${esc(c.w)}%)</small>` : ''}</th>`).join('')}${tot ? `<th class="c">${esc(sc.tot.t || '총 점수')}</th>` : ''}</tr></thead>
    <tbody>${SIDS.map(sid => { const v = row(sid).s || {}; return `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${cols.map(c => `<td class="c"><input class="nh-in num" inputmode="decimal" data-sc="${esc(sid)}" data-col="${esc(c.id)}" value="${esc(v[c.id] ?? '')}"${ro()}></td>`).join('')}${tot ? `<td class="c">${weighted ? `<b data-tot="${esc(sid)}">${esc(C.scoreTotal(sc, v))}</b>` : `<input class="nh-in num" data-sc="${esc(sid)}" data-col="__tot" value="${esc(v.__tot ?? '')}"${ro()}>`}</td>` : ''}</tr>`; }).join('')}${avgRow}</tbody></table></div></div>`;
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
      <div>${need.map(n => `<div class="fl" style="margin-bottom:6px">${need.length > 1 || n.t ? `<span class="l" style="font-size:11.5px;font-weight:800;color:var(--ink-2)">${esc(n.t || '')}</span>` : ''}<textarea class="nh-ta" rows="3" data-nr="${esc(sid)}" data-ni="${esc(n.id)}"${ro()}${row(sid).off ? ' style="opacity:.5"' : ''}>${esc((row(sid).n || {})[n.id] || '')}</textarea><small class="nh-desc" style="margin:0" data-cnt="${esc(sid)}:${esc(n.id)}">${cntHTML(sid, n.id, (row(sid).n || {})[n.id])}</small></div>`).join('') || '<span class="nh-desc">쓸 글이 없어요 (모두 같은 글)</span>'}</div></div>`).join('')}</div>`;
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
    h += `<div class="nh-sec" style="margin:12px 0 4px">${esc(sc.title || '성적')}</div><div class="frow">${C.scoreCols(sc, ENT.rows, SIDS).map(c => `<div class="fl" style="max-width:150px"><label>${esc(c.t)}${Number(c.w) > 0 ? ` (${esc(c.w)}%)` : ''}</label><input class="nh-in" inputmode="decimal" data-sc="${esc(sid)}" data-col="${esc(c.id)}" value="${esc(v[c.id] ?? '')}"${ro()}></div>`).join('')}
      ${sc.tot && sc.tot.on ? `<div class="fl" style="max-width:150px"><label>${esc(sc.tot.t || '총 점수')}</label>${C.scoreCols(sc).every(c => Number(c.w) > 0) ? `<b style="font-size:16px;padding:6px 0" data-tot="${esc(sid)}">${esc(C.scoreTotal(sc, v)) || '—'}</b>` : `<input class="nh-in" data-sc="${esc(sid)}" data-col="__tot" value="${esc(v.__tot ?? '')}"${ro()}>`}</div>` : ''}</div>`;
  }
  if(SUB.kind === 'subj' && t === 'R'){
    const rr = st.r || {}; const n = Math.max(1, Math.min(3, Number(rr.n) || 1));
    h += [1, 2, 3].slice(0, n).map(i => `<div class="fl"><label>${esc(rr.it || '내용')} ${n > 1 ? i : ''}</label><textarea class="nh-ta" rows="3" data-nr="${esc(sid)}" data-ni="c${i}"${ro()}>${esc((r.n || {})['c' + i] || '')}</textarea></div>`).join('');
  }
  (st.narr || []).forEach(n => {
    if(!C.isEach(n)){ if(String(n.fixed || '').trim()) h += `<div class="it-row"><div class="tx"><small>${esc(n.t)} · 모든 학생 같은 글</small>${esc(n.fixed).replace(/\n/g, '<br>')}</div></div>`; }
    else h += `<div class="fl" style="margin-top:8px"><label>${esc(n.t || '서술')}</label><textarea class="nh-ta" rows="4" data-nr="${esc(sid)}" data-ni="${esc(n.id)}"${ro()}>${esc((r.n || {})[n.id] || '')}</textarea><small class="nh-desc" style="margin:0" data-cnt="${esc(sid)}:${esc(n.id)}">${cntHTML(sid, n.id, (r.n || {})[n.id])}</small></div>`;
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
/* ── 특별활동 ── v201: 활동 날짜의 출결을 학생 칸에 · 수업일 모두 빠진 학생은 출석부대로 자동으로 뺌 */
let ACT_AUTO = '';
let ACT_KICK = '';
function actAttKick(){
  if(ACT_KICK === SUB.id) return;          // 칸을 열 때마다 한 번 — 읽은 지 5분이 넘었거나 지난번에 못 읽었으면 다시 읽음
  ACT_KICK = SUB.id;
  const id = SUB.id;
  ACTS.loadAtt(A).then(() => { if(SUB && SUB.id === id && TAB === 'in'){ actAuto(); drawBody(); } });
}
/* 출석부대로 맞추기 — 칸을 열 때 한 번 말없이(고칠 수 있는 사람만) · 단추를 누르면 출석부를 다시 읽고 */
function actAuto(force){
  if(!CAN.edit || !ACTS.attReady() || LOADING) return 0;
  if(!force && ACT_AUTO === SUB.id) return 0;
  ACT_AUTO = SUB.id;
  let n = 0;
  VIA = 'att';
  try{ C.actsFor(A.LISTS, SUB.secId).forEach(a => { const p = ACTS.plan(a, SIDS, ENT.rows || {});
    p.off.forEach(sid => { putRaw(`rows.${sid}.no.${a.id}`, true); putRaw(`rows.${sid}.au.${a.id}`, 'att'); n++; });
    p.on.forEach(sid => { putRaw(`rows.${sid}.no.${a.id}`, undefined); putRaw(`rows.${sid}.au.${a.id}`, undefined); n++; }); }); }
  finally{ VIA = ''; }
  if(n) A.toast(`출석부대로 ${n}곳을 맞췄어요 ✓ (↩ 되돌리기로 취소할 수 있어요)`);
  return n;
}
function actHTML(){
  const acts = C.actsFor(A.LISTS, SUB.secId);
  const ed = ACTS.canLists(A);
  const top = ed ? `<div class="frow" style="align-items:center;margin-bottom:8px"><span class="nh-desc" style="margin:0">활동(이름 · 날짜 · 활동 사항)은 한 곳에서 한 번만 써요.</span><span class="nh-sp"></span><button class="nh-btn sm g" data-ej="actlist">🎉 활동 목록 고치기</button></div>` : '';
  if(!acts.length) return top + `<div class="nh-warn">이 반에 해당하는 특별활동이 학기 공통 목록에 없어요. 나학평 담당 · 목록 담당이 «🎉 특별활동»에서 넣어요.</div>`;
  const dated = acts.some(ACTS.hasDates);
  if(dated) actAttKick();
  const ready = ACTS.attReady();
  if(ready && CAN.edit && ACT_AUTO !== SUB.id){ const id = SUB.id; setTimeout(() => { if(SUB && SUB.id === id && TAB === 'in' && actAuto()) drawBody(); }, 0); }
  const ack = ((ENT.meta || {}).ack) || {};
  const notes = [];
  const cell = (a, sid) => {
    const on = C.joined(a, row(sid)); const t = ready ? ACTS.attOf(a, sid) : null; const r = row(sid);
    if(t) notes.push({ a, sid, t, on });
    const tag = t ? `<span class="act-att${t.all ? ' all' : ''}" title="${esc(A.stuName(sid) + ' — ' + t.text)}">${esc(t.short)}</span>` : '';
    return `<td class="c${t ? ' act-tc' : ''}"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--sb-green)" data-act="${esc(sid)}" data-a="${esc(a.id)}"${on ? ' checked' : ''}${ro()}>${tag}${(r.au || {})[a.id] && !on ? '<small class="act-au" title="출석부대로 자동으로 뺀 학생">자동</small>' : ''}</td>`;
  };
  const body = acts.map(a => `<tr><td class="fc" style="min-width:200px"><b>${esc(a.t)}</b> <small style="color:var(--ink-3)">${esc(a.d || ACTS.whenText(a.from, a.to) || '')}</small>${a.def === 'none' ? ' <span class="ch warn">고른 학생만</span>' : ''}${ACTS.hasDates(a) ? '' : ' <span class="ch gray" title="활동 목록에서 시작 날짜를 넣으면 그날 출결이 여기에 보여요">날짜 없음</span>'}${CAN.edit ? `<br><button class="nh-btn xs ghost" data-actall="${esc(a.id)}" data-on="1">모두 켜기</button><button class="nh-btn xs ghost" data-actall="${esc(a.id)}" data-on="0">모두 끄기</button><button class="nh-btn xs${ack[a.id] ? ' p' : ''}" data-actack="${esc(a.id)}" title="이 활동의 참여 학생을 확인했다는 표시 (담당자 화면에 보여요)">${ack[a.id] ? '✓ 확인함' : '확인'}</button>` : (ack[a.id] ? ' <span class="ch ok">확인함</span>' : '')}</td>
      ${SIDS.map(sid => cell(a, sid)).join('')}</tr>`).join('');
  const noteHTML = notes.length ? `<div class="st-card" style="margin-top:10px"><div class="frow" style="align-items:center"><b style="font-size:14px">활동 날짜의 출결</b><span class="nh-desc" style="margin:0">출석부에서 읽어 왔어요 — 정상 출석이 아닌 학생만</span><span class="nh-sp"></span>${CAN.edit ? '<button class="nh-btn xs" data-ej="actsync" title="출석부를 다시 읽고, 수업일 모두 빠진 학생을 빼요 (손으로 바꾼 학생은 그대로)">출석부 다시 맞추기</button>' : ''}</div>
      ${acts.filter(a => notes.some(o => o.a === a)).map(a => `<div class="act-nl"><b>${esc(a.t)}</b> <small>${esc(a.d || ACTS.whenText(a.from, a.to))}</small>${notes.filter(o => o.a === a).map(o => `<div class="act-n${o.t.all && o.on ? ' bad' : o.t.part && o.on ? ' chk' : ''}"><b>${esc(A.stuName(o.sid))}</b> ${esc(o.t.text)} <span>— ${o.t.all ? (o.on ? '모두 빠졌는데 «참여»예요' : '참여에서 뺌') : o.t.part ? (o.on ? '며칠만 빠짐 · 참여로 둠 (확인해 주세요)' : '며칠만 빠짐 · 손으로 뺌') : (o.on ? '참여' : '손으로 뺌')}</span></div>`).join('')}</div>`).join('')}</div>`
    : (dated ? `<div class="nh-desc" style="margin-top:8px">${ready ? '활동 날짜에 결석 · 지각 · 조퇴 · 체험학습 · 휴학인 학생이 없어요.' : ACTS.attFailed() ? '출석부를 읽지 못했어요 — 화면을 다시 열어 보세요.' : '출석부를 읽는 중…'}</div>` : '');
  return top + `<div class="nh-desc">기본은 «모두 참여»예요 — <b>빠진 학생만 끄세요.</b> 활동 날짜에 정상 출석이 아닌 학생은 칸에 사유가 보이고, 수업일 모두 빠진 학생은 출석부대로 자동으로 빠져요. «고른 학생만» 활동(예: 강연회 발표)은 한 학생을 켜야 나와요.</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th class="fc">활동</th>${SIDS.map(sid => `<th class="c sv" title="${esc(A.stuLabel(sid))}">${esc(shortName(sid))}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody></table></div>${noteHTML}`;
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
    // v144 평가 틀 — 왼쪽 «고치기» (① 양식 ② 표 모양 ③ 평가 항목 ④ 서술 칸) + 오른쪽 «출력 미리보기» (고치는 즉시 바뀜)
    const t = SUB.type;
    let L = shareStripHTML();
    L += formsHTML(dis);
    if(t === 'E' || t === 'M') L += layoutHTML(st, dis) + itemsEditorHTML(st, dis);
    if(t === 'S' || t === 'M') L += scoreEditorHTML(st, dis);
    if(t === 'A') L += `<div class="st-card"><b style="font-size:14px">활동 서술 모양</b><div class="frow" style="margin-top:8px"><div class="fl"><label>상단 제목 (선택)</label><input class="nh-in" data-sa="t1" value="${esc((st.a || {}).t1 || '')}"${dis}></div><div class="fl"><label>상단 제목 2 (선택)</label><input class="nh-in" data-sa="t2" value="${esc((st.a || {}).t2 || '')}"${dis}></div></div>
      <label class="ck"><input type="checkbox" data-sa="noTitle"${(st.a || {}).noTitle ? ' checked' : ''}${dis}>항목 제목 없이 글만 (예전 «서술항목 타이틀 사용 안 함»)</label></div>`;
    if(t === 'R') L += `<div class="st-card"><b style="font-size:14px">암송 · 읽기 모양</b><div class="frow" style="margin-top:8px"><div class="fl"><label>전체 제목</label><input class="nh-in" data-sr="title" value="${esc((st.r || {}).title || '')}"${dis}></div><div class="fl"><label>항목 제목</label><input class="nh-in" data-sr="it" value="${esc((st.r || {}).it || '')}"${dis}></div>
      <div class="fl" style="max-width:120px"><label>내용 칸 수</label><select class="nh-sel" data-sr="n"${dis}>${[1, 2, 3].map(n => `<option${Number((st.r || {}).n || 1) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div></div></div>`;
    if(t !== 'R') L += narrEditorHTML(st, dis);
    L += `<div class="st-card"><div class="frow" style="align-items:center"><span class="nh-desc" style="margin:0">듣는 학생: ${(SUB.studentIds || []).length ? `<b>${SUB.studentIds.length}명</b>${SUB.grp ? ' (조원)' : '만'}` : '반 모두'}</span>${(!SUB.grp && (A.isMgr || (SUB.state === 'draft' && CAN.teacher))) ? '<button class="nh-btn xs" data-ej="students">학생 고르기</button>' : ''}
        <span class="nh-desc" style="margin:0 0 0 12px">출력 이름: <b>${esc(SUB.printName || SUB.name)}</b> · ${SUB.grp ? '조 담당' : '교사'} <b>${esc(SUB.printTeacher || (SUB.teacherUids || []).map(A.staffName).join(', ') || '—')}</b></span>
        ${SUB.inheritedFrom ? '<span class="ch gray">지난 학기에서 이어받은 틀</span>' : ''}<span class="nh-sp"></span>${A.isMgr && CAN.setup ? '<button class="nh-btn xs" data-ej="saveform">⭐ 기관 양식으로 저장</button>' : ''}</div></div>`;
    return h + `<div class="ed2" style="--pvw:${PVW}px"><div class="ed2-l">${L}</div><aside class="ed2-r" id="ej-pv"><span class="pv-grip" title="끌어서 미리보기 폭 바꾸기" aria-label="미리보기 폭"></span>${pvPaneHTML()}</aside></div>`;
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
/* ① 양식 — 고르면 방식 · 표 모양이 바뀜 (이미 쓴 항목 · 입력은 그대로) */
function formsHTML(dis){
  const cur = C.formOf(SUB);
  const nForms = ((A.FORMS || {}).list || []).length;
  return `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">① 양식</b><span class="nh-desc" style="margin:0">골라서 시작 — 고른 뒤에도 칸 · 항목은 자유롭게</span><span class="nh-sp"></span>
      ${STRUCT() ? `<button class="nh-btn xs g" data-ej="import">📥 가져오기 <small>다른 반 · 지난 학기 · 기관 양식${nForms ? ' ' + nForms : ''}</small></button>` : ''}</div>
    ${CAN.setup && !STRUCT() ? '<div class="nh-desc" style="margin:4px 0 0">검토 중에는 항목 글 · 오타만 고칠 수 있어요 — 양식 · 가져오기 · 함께 쓰기는 맡은 선생님(작성 중)과 나학평 담당이 바꿔요.</div>' : ''}
    <div class="fm-tiles">${C.FORMS.map(f => `<button class="fm-tile${f.k === cur ? ' on' : ''}" data-form="${esc(f.k)}"${STRUCT() ? '' : ' disabled'} title="${esc(f.d)}"><b>${esc(f.ko)}</b><small>${esc(f.d)}</small></button>`).join('')}</div></div>`;
}
/* ② 표 모양 — 5단계 표 왼쪽 칸 (범위 · 세부 · 내용) · 12칸 격자에 붙는 너비 */
function layoutHTML(st, dis){
  const lay = st.lay || {};
  const sOn = C.hasSub(st);
  const gw = C.LAY_W.g[lay.g] || 92, sw = C.LAY_W.s[lay.s] || 98, lv = 245;
  const tw = 680 - gw - (sOn ? sw : 0) - lv;
  const seg = (lab, w, k, sub) => `<div class="lw-c${k ? ' k' : ''}" style="flex:0 0 ${(w / 680 * 100).toFixed(2)}%"><b>${esc(lab)}</b><small>${sub}</small></div>`;
  const wbtn = (k, cur) => ['n', 'm', 'w'].map(v => `<button class="nh-btn xs${(cur || 'n') === v ? ' p' : ''}" data-lay="${k}" data-v="${v}"${dis}>${C.LAY_NAME[v]}</button>`).join('');
  return `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">② 표 모양</b><span class="nh-desc" style="margin:0">칸을 나누고 넓혀요 — 출력에 그대로 · 다섯 단계 칸은 늘 같은 자리</span></div>
    <div class="lw-strip">${seg('범위', gw, 1, '묶음')}${sOn ? seg('세부', sw, 1, '예: 수업 준비') : ''}${seg('평가 내용', tw, 0, '')}<div class="lw-c lvz" style="flex:0 0 ${(lv / 680 * 100).toFixed(2)}%"><b>매우 잘함 ~ 노력 요함</b><small>5칸</small></div></div>
    <div class="frow" style="align-items:center;margin-top:8px;gap:14px">
      <span class="lw-g"><span>범위 너비</span>${wbtn('g', lay.g)}</span>
      <label class="ck"><input type="checkbox" data-lay="sOn"${sOn ? ' checked' : ''}${dis}${((st.items || []).some(it => String(it.s || '').trim())) ? ' disabled title="세부가 적힌 항목이 있어 켜져 있어요"' : ''}>＋ 세부 칸 나누기</label>
      ${sOn ? `<span class="lw-g"><span>세부 너비</span>${wbtn('s', lay.s)}</span>` : ''}
      ${CAN.setup && (lay.g || lay.s) ? '<button class="nh-btn xs ghost" data-lay="reset">폭 처음대로</button>' : ''}</div></div>`;
}
/* ③ 평가 항목 — 입력 칸이 출력 표와 같은 줄 맞춤 (범위 · 세부 · 내용) */
function itemsEditorHTML(st, dis){
  const items = st.items || [];
  const sOn = C.hasSub(st);
  const pre = items.filter(it => /^\s*[\[［【(（][^\]］】)）]{1,20}[\]］】)）]\s*\S/.test(it.t || '')).length;
  const span = i => { const g = String(items[i].g || '').trim(); if(!g || (i > 0 && String(items[i - 1].g || '').trim() === g)) return 0; let n = 1; while(i + n < items.length && String(items[i + n].g || '').trim() === g) n++; return n; };
  return `<div class="st-card"><div class="frow" style="align-items:center"><b style="font-size:14px">③ 평가 항목</b><span class="ch gray">${items.length}개</span><span class="nh-desc" style="margin:0">같은 범위는 출력에서 한 칸으로 묶여요</span><span class="nh-sp"></span>
      ${CAN.setup ? `${pre ? `<button class="nh-btn xs" data-ej="splitpre" title="«[수업 준비성] …» 같은 머리말을 세부 칸으로">✂ [머리말] ${pre}개 → 세부</button>` : ''}<button class="nh-btn xs" data-ej="itempaste">📋 여러 줄 붙여넣기</button><button class="nh-btn xs g" data-ej="itemadd">＋ 항목</button>` : ''}</div>
    <div class="it-grid${sOn ? ' s' : ''}"><div class="it-h"><span></span><span>범위</span>${sOn ? '<span>세부</span>' : ''}<span>평가 내용</span><span></span></div>
    ${items.map((it, i) => { const g = String(it.g || '').trim(); const cont = g && i > 0 && String(items[i - 1].g || '').trim() === g; const n = span(i);
      return `<div class="it-r${cont ? ' cont' : ''}${g ? ' gp' : ''}"><b class="no">${i + 1}</b>
      <span class="gcell"><input class="nh-in" placeholder="범위 (선택)" data-itf="${i}" data-f="g" value="${esc(it.g || '')}"${dis}>${n > 1 ? `<small class="gn">${n}줄 묶음</small>` : ''}</span>
      ${sOn ? `<input class="nh-in" placeholder="세부" data-itf="${i}" data-f="s" value="${esc(it.s || '')}"${dis}>` : ''}
      <input class="nh-in" placeholder="평가 내용" data-itf="${i}" data-f="t" value="${esc(it.t || '')}"${dis}>
      <span class="it-b">${CAN.setup ? `<button class="nh-btn xs" data-itup="${i}" ${i ? '' : 'disabled'} aria-label="위로">↑</button><button class="nh-btn xs" data-itdn="${i}" ${i < items.length - 1 ? '' : 'disabled'} aria-label="아래로">↓</button><button class="nh-btn xs r" data-itdel="${i}" aria-label="빼기">✕</button>` : ''}</span></div>`; }).join('')}</div>
    ${items.length ? '' : '<div class="nh-desc" style="margin-top:8px">아직 없어요. «＋ 항목» · «📋 여러 줄 붙여넣기»(엑셀 칸: 범위 · 세부 · 내용) · «📥 가져오기»(다른 반 · 지난 학기 · 기관 양식).</div>'}</div>`;
}
/* 🔗 함께 쓰기 띠 — 같은 평가 틀을 쓰는 칸들 */
function shareKey(){ return C.shareOf(SUB, A.SUBS); }
/* 평가 방식(양식) · 가져오기 · 함께 쓰기 묶기/풀기 — 맡은 선생님(작성 중) · 나학평 담당만 (검토관은 글 고치기만 — 규칙 v38 과 같은 기준) */
const STRUCT = () => !!SUB && SUB.state !== 'done' && (A.isMgr || (SUB.state === 'draft' && !!(CAN && CAN.teacher)));
function shareStripHTML(){
  const key = shareKey(); if(!key) return '';
  const mem = C.shareMembers(key, A.SUBS).filter(x => x.id !== SUB.id);
  if(!mem.length) return '';
  const me = A.CU.uid;
  const same = x => JSON.stringify(x.setup || {}) === JSON.stringify(SUB.setup || {}) && (x.type || 'E') === (SUB.type || 'E');
  const why = x => x.state !== 'draft' ? C.stateOf(x).ko : (!A.isMgr && !(x.teacherUids || []).includes(me)) ? '다른 선생님 칸' : '';
  const diff = mem.filter(x => !same(x));
  return `<div class="nh-info sh-strip">🔗 <b>함께 쓰기</b> — 이 평가 틀을 ${mem.length}칸이 함께 써요. 여기서 고치면 함께 바뀌어요 (학생 입력 · 점수는 칸마다).
    <div class="pk" style="margin-top:6px">${mem.map(x => `<span class="p" style="padding-right:11px" title="${esc(why(x))}">${esc(A.whereOf(x))} ${same(x) ? '<span class="ch ok">같음</span>' : `<span class="ch warn">다름${why(x) ? ' · ' + esc(why(x)) : ''}</span>`}</span>`).join('')}</div>
    ${STRUCT() ? `<div class="frow" style="margin-top:6px">${diff.length ? '<button class="nh-btn xs" data-ej="sharesync" title="다른 칸의 틀을 이 칸 틀로 (그 칸 입력은 같은 글끼리 이어짐)">다른 칸을 이 틀로 맞추기</button><button class="nh-btn xs" data-ej="sharepull" title="이 칸을 함께 쓰는 틀로 (이 칸 입력은 같은 글끼리 이어짐)">↙ 함께 쓰는 틀로 이 칸 바꾸기</button>' : ''}<button class="nh-btn xs ghost" data-ej="unshare">이 칸만 함께 쓰기 풀기</button></div>` : ''}</div>`;
}
/* v148 미리보기 손잡이 끌기 — 왼쪽으로 끌면 넓어짐 */
function onGrip(e){
  const g = e.target.closest && e.target.closest('.pv-grip'); if(!g) return;
  e.preventDefault();
  const ed = g.closest('.ed2'); if(!ed) return;
  const right = ed.getBoundingClientRect().right;
  const maxW = Math.min(PVW_MAX, ed.clientWidth - 360);
  g.classList.add('on'); try{ g.setPointerCapture(e.pointerId); }catch(x){}
  const mv = ev => setPvw(Math.min(maxW, right - ev.clientX), false);
  const up = () => { g.classList.remove('on'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); setPvw(PVW, true); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
}
/* 오른쪽 출력 미리보기 — 실제 A4 쪽 폭 그대로 · 예시 학생 · 속지 모양 */
let PV_SID = '', PV_T = null;
/* v148 미리보기 폭 — 좁게 · 보통 · 넓게 · 크게(실제 크기) + 가운데 손잡이로 끌기 (이 기기에서 기억) */
const PVW_SET = [['좁게', 360], ['보통', 460], ['넓게', 600], ['크게', 760]];
const PVW_MIN = 320, PVW_MAX = 980;
let PVW = (() => { try{ const v = Number(localStorage.getItem('nhp_pvw')); return v >= PVW_MIN && v <= PVW_MAX ? v : 460; }catch(e){ return 460; } })();
function setPvw(v, save){
  PVW = Math.max(PVW_MIN, Math.min(PVW_MAX, Math.round(v)));
  const ed = document.querySelector('.ed2'); if(ed) ed.style.setProperty('--pvw', PVW + 'px');
  document.querySelectorAll('[data-pvw]').forEach(b => b.classList.toggle('on', Math.abs(Number(b.dataset.pvw) - PVW) < 2));
  if(save){ try{ localStorage.setItem('nhp_pvw', String(PVW)); }catch(e){} }
  pvFit();
}
function pvPaneHTML(){
  const sids = SIDS; if(!sids.length) return '<div class="nh-desc">학생이 없어요.</div>';
  if(!PV_SID || !sids.includes(PV_SID)) PV_SID = sids.find(x => (ENT.rows || {})[x]) || sids[0];
  const d = A.design();
  return `<div class="pv2-h"><b>출력 미리보기</b><select class="nh-sel" data-pvs style="height:30px;font-size:12px">${sids.map(x => `<option value="${esc(x)}"${x === PV_SID ? ' selected' : ''}>${esc(A.stuName(x))} (예시)</option>`).join('')}</select>
      <select class="nh-sel" data-pvth style="height:30px;font-size:12px" title="속지">${C.TH.listOptionsHTML(C.TH.INNERS, d.inner)}</select>
      <span class="pv-wb" title="미리보기 폭 — 가운데 손잡이(⋮)를 끌어도 돼요">${PVW_SET.map(([l, w]) => `<button type="button" data-pvw="${w}" class="${Math.abs(w - PVW) < 2 ? 'on' : ''}">${l}</button>`).join('')}</span></div>
    <div class="pv2-pg"><div class="pv2-fit"><div class="pv2-sc" id="ej-pv-sc">${pvPageHTML(d.inner)}</div></div></div>
    <div class="nh-desc" style="margin:6px 0 0">고치면 바로 바뀌어요 · 실제 A4 종이(여백 15mm) 그대로 · 이 칸만 맨 위에 놓고 보여 줘요 — 쪽 나눔은 «👀 미리보기 › 전체»에서</div>`;
}
/* v153 종이 한 장 — 실제 출력(👀 미리보기 › 전체)과 같은 A4 쪽: 794×1123 · 여백 57px(15mm) · 속지 A · C 는 쪽 머리 · 바닥 줄
   이 칸을 본문 맨 위에 놓는다 · 칸이 한 쪽보다 길면 종이가 아래로 길어짐 (쪽 나눔은 전체 미리보기에서) */
function pvPageHTML(theme){
  const TH = C.TH;
  const th = (theme === 'a' || theme === 'c') ? theme : 'old';
  const G = (TH.CHROME || {})[th] || { top: 57, innerH: 1123 - 57 * 2 - 22 };
  const sec = ((A.TERM || {}).sections || []).find(x => (x.students || []).includes(PV_SID)) || SEC || {};
  const name = A.stuName(PV_SID);
  const doc = { lang: 'ko', cover: { term: C.termLabel(A.TERM), cls: sec.name || '', grade: sec.grade || '', name } };
  const pad = `padding:${G.top}px 57px ${Math.max(57, 1123 - G.top - G.innerH)}px`;
  const head = th === 'old' ? '' : TH.runHeadHTML(th, doc);
  const foot = th === 'old' ? `<div class="np-ft"><span></span><span>${esc(name)}  ·  ·· / ··</span></div>` : TH.footHTML(th, doc, '··', '··');
  return `<div class="np pv2-np${th === 'old' ? '' : ' np-th'}">${head}<div class="pv2-in" style="${pad}">${pvBlockHTML(theme)}</div>${foot}</div>`;
}
function pvBlockHTML(theme){
  const b = C.blockFor(SUB, { stu: { id: PV_SID, name: A.stuName(PV_SID) }, sec: SEC, entry: ENT, lists: A.LISTS, staffName: A.staffName, term: A.TERM, actGroup: A.actGroupOf });
  if(!b) return `<div class="nh-desc" style="padding:20px">이 학생은 이 칸이 출력되지 않아요 (비었거나 «출력에서 빼기»).</div>`;
  const peers = A.SUBS.filter(s => !s.removed && (SUB.grp ? s.secId === (((A.TERM.sections || []).find(x => (x.students || []).includes(PV_SID)) || {}).id) || (s.grp && (s.studentIds || []).includes(PV_SID)) : (s.secId === SUB.secId || (s.grp && (s.studentIds || []).includes(PV_SID)))));
  const ord = peers.sort((x, y) => (x.order || 0) - (y.order || 0));
  const no = (theme && theme !== 'old') ? Math.max(1, ord.findIndex(x => x.id === SUB.id) + 1) : ord.filter(x => x.kind === 'subj' && (x.order || 0) <= (SUB.order || 0)).length;
  const p = C.blockParts(b, 'ko', no, false, theme);
  return `<div class="nr${C.themeClass(theme, A.design().shade)}" style="width:680px"><section class="nb nsub">${p.head}${p.tables.map(t => C.tableHTML(t, false, theme)).join('')}${p.notes.join('')}</section></div>`;
}
function pvRefresh(){
  clearTimeout(PV_T);
  PV_T = setTimeout(() => {
    const sc = document.getElementById('ej-pv-sc'); if(!sc || TAB !== 'set') return;
    const th = (document.querySelector('[data-pvth]') || {}).value || A.design().inner;
    sc.innerHTML = pvPageHTML(th);
    pvFit();
  }, 220);
}
function pvFit(){
  const sc = document.getElementById('ej-pv-sc'); if(!sc) return;
  const fit = sc.parentElement, box = fit.parentElement;
  const cs = getComputedStyle(box);
  const w = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  const k = Math.max(0.2, Math.min(1, w / 794));
  sc.style.transform = `scale(${k})`;
  fit.style.width = Math.floor(794 * k) + 'px'; fit.style.height = Math.ceil(sc.offsetHeight * k) + 'px';
}
let AVG_OPEN = false;
function scoreEditorHTML(st, dis){
  const sc = st.score || { cols: [] };
  const tot = sc.tot || { on: false, t: '총 점수' };
  const avgManual = AVG_OPEN || Object.keys(sc.avg || {}).some(k => String(sc.avg[k] || '').trim());   // v198 «평균 직접»은 쓰는 칸에서만 보임 (점수 칸으로 헷갈려서)
  return `<div class="st-card"><div class="nh-info" style="margin-bottom:10px">여기는 <b>시험 항목 이름과 비율</b>만 정하는 곳이에요. <b>학생 점수는 «✏️ 입력» 탭</b>에서 넣고, 반 평균은 저절로 계산돼요. <button class="nh-btn xs" data-tab="in">입력 탭으로</button></div>
    <div class="frow" style="align-items:center"><b style="font-size:14px">시험 성적</b><span class="nh-sp"></span>${CAN.setup ? '<button class="nh-btn xs g" data-ej="coladd">＋ 시험 항목</button>' : ''}</div>
    <div class="frow" style="margin-top:6px"><div class="fl" style="max-width:160px"><label>표 왼쪽 제목</label><input class="nh-in" data-ss="title" value="${esc(sc.title || '성적')}"${dis}></div>
      <div class="fl" style="max-width:160px"><label>소제목</label><input class="nh-in" data-ss="sub" value="${esc(sc.sub || '')}" placeholder="예: 시험"${dis}></div>
      <div class="fl" style="max-width:160px"><label>학생 줄 이름</label><input class="nh-in" data-ss="r1" value="${esc(sc.r1 || '개인점수')}"${dis}></div>
      <div class="fl" style="max-width:160px"><label>평균 줄 이름</label><input class="nh-in" data-ss="r2" value="${esc(sc.r2 || '반 평균')}"${dis}></div></div>
    ${(sc.cols || []).map((c, i) => `<div class="frow" style="align-items:center;margin-top:6px;flex-wrap:nowrap"><b style="color:var(--ink-3);width:22px;text-align:right">${i + 1}</b>
      <input class="nh-in" style="flex:1;min-width:0" placeholder="항목 이름 (예: 기말고사)" data-scf="${i}" data-f="t" value="${esc(c.t || '')}"${dis}>
      <input class="nh-in" style="width:80px;flex:none" type="number" placeholder="비율%" data-scf="${i}" data-f="w" value="${esc(c.w ?? '')}"${dis}>
      ${avgManual ? `<input class="nh-in" style="width:120px;flex:none" placeholder="반 평균 직접" title="비워 두면 학생 점수로 저절로 계산돼요" data-scavg="${esc(c.id)}" value="${esc((sc.avg || {})[c.id] || '')}"${dis}>` : ''}
      ${CAN.setup ? `<button class="nh-btn xs r" data-scdel="${i}">✕</button>` : ''}</div>`).join('')}
    <div class="frow" style="align-items:center;margin-top:8px"><label class="ck"><input type="checkbox" data-ss="tot.on"${tot.on ? ' checked' : ''}${dis}>총 점수 칸</label><input class="nh-in" style="max-width:150px" data-ss="tot.t" value="${esc(tot.t || '총 점수')}"${dis}>
      <label class="ck"><input type="checkbox" data-ss="avgOn"${sc.avgOn !== false ? ' checked' : ''}${dis}>평균 줄 보이기</label>
      ${!avgManual && CAN.setup ? '<button class="nh-btn xs ghost" data-ej="avgopen" title="다른 반과 합친 평균처럼, 저절로 계산한 값 대신 정한 값을 내보낼 때만">반 평균을 직접 넣기…</button>' : ''}</div>
    <div class="nh-desc">모든 항목에 비율(%)이 있으면 총 점수가 비율대로 계산돼요 (예: 기말 60 · 어휘력 30 · 태도 10).${avgManual ? ' «반 평균 직접» 칸을 채운 항목은 저절로 계산한 평균 대신 그 값이 나가요 — 비우면 다시 자동이에요.' : ''}</div></div>`;
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
/* v198 두 사람이 같은 평가 틀을 함께 고칠 때 — 통째로 덮어쓰지 않고 «처음 모습 · 내 것 · 그분 것»을 견주어 합친다
   SRV = 서로 같다고 아는 마지막 모습 · SENT = 내가 마지막으로 보낸 것 · THEIRS = 내가 고치는 사이 다른 분이 저장한 것 */
const SRV = {}, SENT = {}, THEIRS = {}, FLY = {}, HOLD = {}; let STALE = false;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
/* 키 순서와 상관없는 견줌 (서버에서 온 것은 키가 정렬돼 올 수 있음) */
const SJ = v => JSON.stringify(v === undefined ? null : v, (k, x) => isObj(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
function mergeList(base, mine, theirs){
  const J = SJ, B = {}, T = {}, M = {};
  (base || []).forEach(x => { B[x.id] = x; }); theirs.forEach(x => { T[x.id] = x; }); mine.forEach(x => { M[x.id] = x; });
  const out = [];
  mine.forEach(x => {
    const t = T[x.id], b = B[x.id];
    if(!t){ if(b && J(x) === J(b)) return; out.push(x); }            // 그분이 뺀 줄 — 내가 안 고쳤으면 빠짐
    else out.push(b && J(x) === J(b) ? t : x);                        // 내가 안 고친 줄은 그분 것
  });
  theirs.forEach(x => { if(!M[x.id] && !B[x.id]) out.push(x); });      // 그분이 새로 넣은 줄
  return out;
}
function merge3(base, mine, theirs){
  const J = SJ; const out = {}; let both = false;
  new Set(Object.keys(mine || {}).concat(Object.keys(theirs || {}))).forEach(k => {
    const bv = (base || {})[k], mv = (mine || {})[k], tv = (theirs || {})[k];
    const b = J(bv), m = J(mv), t = J(tv);
    let v;
    if(m === t || t === b) v = mv;
    else if(m === b) v = tv;
    else if(Array.isArray(mv) && Array.isArray(tv) && mv.concat(tv).every(x => x && x.id)) v = mergeList(Array.isArray(bv) ? bv : [], mv, tv);
    else if(isObj(mv) && isObj(tv)){ const r = merge3(isObj(bv) ? bv : {}, mv, tv); v = r.setup; both = both || r.both; }
    else { v = mv; both = true; }
    if(v !== undefined) out[k] = v;
  });
  return { setup: out, both };
}
const typingIn = () => { const f = document.activeElement; return !!(f && EL && EL.contains(f) && (f.tagName === 'TEXTAREA' || (f.tagName === 'INPUT' && !/^(checkbox|radio|button)$/.test(f.type)))); };
/* 다른 분이 고친 틀을 화면에 — 글을 치는 중이면 그 칸을 떠난 뒤에 */
function staleDraw(){
  if(TAB !== 'set'){ STALE = false; return; }
  if(typingIn()){ STALE = true; return; }
  STALE = false; const y = window.scrollY; drawBody(); window.scrollTo(0, y);
}
function staleSoon(){ if(STALE) setTimeout(() => { if(STALE) staleDraw(); }, 200); }
function saveSetup(now){
  SPEND[SUB.id] = SUB.setup;
  clearTimeout(ST);
  showSave('ing');
  pvRefresh();
  if(now) return flushSetup();
  ST = setTimeout(flushSetup, 600);
}
async function flushSetup(){
  clearTimeout(ST); ST = null;
  for(const id of Object.keys(SPEND)){
    const mine = SPEND[id]; const base = SRV[id]; let setup = mine, merged = null;
    HOLD[id] = false; FLY[id] = true;
    try{
      let viaTx = false;
      if(base !== undefined){
        // 서버의 지금 틀을 읽어 → 내가 아는 모습과 다르면(다른 분이 저장) 합쳐서 → 쓴다 (사이에 또 바뀌면 다시 읽음)
        try{
          await FS.runTransaction(A.db, async tx => {
            const ref = FS.doc(A.db, 'nhpSubjects', id); const d = await tx.get(ref);
            if(!d.exists()) throw Object.assign(new Error('칸이 없어요'), { code: 'not-found' });
            const cur = d.data().setup || {};
            merged = null; setup = mine;
            if(SJ(cur) !== base && SJ(cur) !== SJ(mine)){ merged = merge3(JSON.parse(base), mine, cur); setup = merged.setup; }
            tx.update(ref, { setup, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid });
          });
          viaTx = true; { const s0 = A.subOf(id); if(s0) s0.setup = setup; }
        }catch(e){
          if(/permission|not-found/.test((e && e.code) || '')) throw e;
          merged = null; setup = mine;       // 연결이 끊긴 때 등 — 아래 예전 길로 (연결되면 저장)
        }
      }
      if(!viaTx){
        if(THEIRS[id]){ merged = merge3(JSON.parse(base || '{}'), mine, THEIRS[id]); setup = merged.setup; }
        await A.saveSub(id, { setup });
      }
      delete THEIRS[id]; SENT[id] = SJ(setup || {});
      if(SPEND[id] === mine) delete SPEND[id]; if(SUB && SUB.id === id) showSave('ok');
      if(merged && SPEND[id]){ SRV[id] = base; HOLD[id] = true; }    // 저장하는 사이 내가 더 고침(합치기 전 모습 위에) — 다음 저장 때 합친 것과 다시 견주도록 «아는 모습»은 그대로 둠
      else SRV[id] = SENT[id];
      if(merged && SUB && SUB.id === id){
        if(!SPEND[id]){ SUB.setup = setup; staleDraw(); pvRefresh(); }
        A.toast('다른 분이 방금 고친 평가 틀과 합쳐서 저장했어요' + (merged.both ? ' — 같은 곳을 함께 고친 부분은 내 것으로 남겼어요' : ' ✓'));
      }
      await propagate(id, setup);
    }
    catch(e){
      if(/permission/.test((e && e.code) || '')) delete SPEND[id];
      A.toast('평가 틀을 저장하지 못했어요 — ' + A.errText(e), 'err'); if(SUB && SUB.id === id) showSave('err');
    }
    finally{ FLY[id] = false; }
  }
}
/* 🔗 함께 쓰는 칸에 같은 틀 — 작성 중이고 내가 고칠 수 있는 칸만 (검토 중 · 다른 선생님 칸은 그대로 «다름»으로 보임) */
async function propagate(id, setup){
  const me = A.subOf(id); if(!me) return 0;
  const key = C.shareOf(me, A.SUBS); if(!key) return 0;
  const uid = A.CU.uid; let n = 0;
  for(const x of C.shareMembers(key, A.SUBS)){
    if(x.id === id || x.state !== 'draft' || !(A.isMgr || (x.teacherUids || []).includes(uid))) continue;
    if(JSON.stringify(x.setup || {}) === JSON.stringify(setup) && (x.type || 'E') === (me.type || 'E')) continue;
    try{ await applySetupTo(x, setup, me.type || 'E'); n++; }catch(e){ console.warn('함께 쓰기 맞추기', x.id, e); }
  }
  return n;
}
/* 다른 칸의 평가 틀을 바꿀 때 — 그 칸 학생 입력을 먼저 같은 글끼리 이어 둔 뒤(예전 값은 남김) 틀을 바꾼다
   · 입력을 못 읽으면 틀도 바꾸지 않음 (빈 입력으로 잘못 판단해 값이 안 보이게 되는 일 막기) */
async function applySetupTo(x, setup, type){
  const ref = FS.doc(A.db, 'nhpEntries', x.id);
  const snap = await FS.getDoc(ref);   // 실패하면 그대로 던짐
  const rows = (snap.exists() && snap.data().rows) || {};
  const nu = JSON.parse(JSON.stringify(setup || {}));
  const up = C.remapPatch(rows, x.setup || {}, nu);
  if(Object.keys(up).length) await FS.updateDoc(ref, Object.assign(up, { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }));
  await A.saveSub(x.id, Object.assign({ setup: nu }, (x.type || 'E') !== (type || 'E') ? { type: type || 'E' } : {}));
}
/* ↙ 함께 쓰는 틀로 이 칸 바꾸기 — 묶음의 기준 칸(sh_<id>) 틀, 없으면 가장 많은 칸이 쓰는 틀 */
async function pullShared(){
  const key = shareKey(); if(!key) return;
  const mem = C.shareMembers(key, A.SUBS).filter(x => x.id !== SUB.id);
  if(!mem.length) return;
  const owner = mem.find(x => 'sh_' + x.id === key);
  let src = owner;
  if(!src){ const cnt = {}; mem.forEach(x => { const k = JSON.stringify([x.type || 'E', x.setup || {}]); cnt[k] = (cnt[k] || 0) + 1; }); const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; src = mem.find(x => JSON.stringify([x.type || 'E', x.setup || {}]) === top); }
  if(!src) return;
  if(!(await A.confirm('함께 쓰는 틀로 바꾸기', `이 칸의 평가 틀을 <b>${esc(A.whereOf(src))}</b> 칸의 틀로 바꿔요. 이미 넣은 5단계 · 글 · 점수는 <b>같은 글의 항목끼리</b> 이어지고, 맞는 짝이 없는 값은 지우지 않고 남겨 둬요.`, '바꾸기'))) return;
  await flush(); await flushSetup();
  try{
    window.showLoading && showLoading('바꾸는 중…');
    await applySetupTo(SUB, src.setup || {}, src.type || 'E');
    SUB = A.subOf(SUB.id) || SUB; ENT = await A.getEntry(SUB.id, true);
    A.toast('함께 쓰는 틀로 바꿨어요 🔗');
  }catch(e){ A.toast('바꾸지 못했어요 — ' + A.errText(e), 'err'); }
  window.hideLoading && hideLoading();
  draw();
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
/* v198 한 칸만 — 함께 맡은 선생님이 동시에 넣어도 서로 덮어쓰지 않게 (v === undefined → 지움) */
async function saveMarkAt(path, v){
  const ref = FS.doc(A.db, 'nhpMarks', SUB.id);
  const up = { termId: SUB.termId, subjectId: SUB.id, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid };
  up[path] = v === undefined ? FS.deleteField() : v;
  try{
    try{ await FS.updateDoc(ref, up); }
    catch(e){ if(e && e.code === 'not-found') await FS.setDoc(ref, { termId: SUB.termId, subjectId: SUB.id, sessions: MARKS.sessions, m: MARKS.m, sc: MARKS.sc, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }); else throw e; }
    showSave('ok');
  }catch(e){ A.toast('학기 중 기록을 저장하지 못했어요 — ' + A.errText(e), 'err'); }
}
const canMark = () => SUB.state !== 'done' && (CAN.teacher || A.isMgr);
function marksHTML(){
  const st = SUB.setup || {}; const items = st.items || []; const cols = C.scoreCols(st.score);
  const S = MARKS.sessions;
  if(!MK_SES || !S.find(s => s.id === MK_SES)) MK_SES = S.length ? S[S.length - 1].id : '';
  const ses = S.find(s => s.id === MK_SES);
  const dis = canMark() ? '' : ' disabled';
  let h = `<div class="nh-info">📈 <b>학기 중 기록</b> — 수업 계획서의 평가 항목으로 회차마다 5단계(또는 점수)를 적어 두면, 학기 말에 <b>평균으로 단계를 제안</b>해요. 제안을 «학기 말 평가»에 채워 넣은 뒤 선생님이 고칠 수 있어요. (기록은 출력에 나오지 않아요)</div>
    <div class="mk-how"><div><b>1️⃣ 한 번만 넣어도 돼요</b><span>회차마다 평가하지 못했으면 <b>1회만</b> 넣어도 그 값이 학기 말 제안이 돼요.</span></div>
      <div><b>🔁 여러 번 넣으면 평균</b><span>여러 회차에 넣으면 <b>넣은 회차들만의 평균</b>이에요 (빈 회차는 세지 않음).</span></div>
      <div><b>👤 학생마다 따로</b><span>평균은 학생마다 따로 내요 — <b>몇 명만</b> 평가해도 그 학생들만 제안돼요.</span></div></div>
    <div class="frow" style="align-items:center;margin-bottom:8px"><b>회차</b>${S.map(s => `<button class="nh-btn xs ${s.id === MK_SES ? 'p' : ''}" data-mks="${esc(s.id)}">${esc(s.date ? s.date.slice(5).replace('-', '/') : '')} ${esc(s.title || '')}</button>`).join('') || '<span class="nh-desc" style="margin:0">아직 없어요</span>'}
      ${canMark() ? '<button class="nh-btn xs g" data-ej="mkadd">＋ 회차</button>' : ''}<span class="nh-sp"></span>${S.length ? '<button class="nh-btn sm" data-ej="mkavg">🧮 평균 보기 · 채우기</button>' : ''}</div>`;
  if(!ses) return h;
  h += `<div class="st-card"><div class="frow" style="align-items:center"><b>${esc(ses.date || '')} ${esc(ses.title || '')}</b>${canMark() ? `<button class="nh-btn xs" data-ej="mkedit">이름 · 날짜</button><button class="nh-btn xs r" data-ej="mkdel">회차 빼기</button>` : ''}</div>`;
  if(items.length && (SUB.type === 'E' || SUB.type === 'M')){
    const on = ses.items && ses.items.length ? items.filter(it => ses.items.includes(it.id)) : items;
    // v148 범위(묶음) · 세부도 보이게 — 범위가 비면 위 항목과 같은 범위 (평가 틀과 같은 규칙)
    let prevG = '', shownG = null; const rowsH = [];
    items.forEach(it => { const g = String(it.g || '').trim() || prevG; prevG = g; if(!on.includes(it) || !String(it.t || '').trim()) return;
      if(g && g !== shownG){ rowsH.push(`<tr class="grp mk-g"><td class="fc"><b>${esc(g)}</b></td><td colspan="${SIDS.length}"></td></tr>`); shownG = g; }
      rowsH.push(`<tr><td class="fc mk-t${g ? ' in' : ''}">${String(it.s || '').trim() ? `<b class="mk-s">${esc(it.s)}</b>` : ''}<span>${esc(it.t)}</span></td>${SIDS.map(sid => { const v = Number((((MARKS.m[sid] || {})[ses.id]) || {})[it.id]) || 0; return `<td class="c"><button class="lv${v ? ' v' + v : ''}" data-mk="${esc(sid)}" data-it="${esc(it.id)}"${dis}>${v || '·'}</button></td>`; }).join('')}</tr>`); });
    h += `<div class="nh-tw" style="margin-top:8px;max-height:60vh"><table class="nh-t mk-tb" data-grid="mk"><thead><tr><th class="fc">평가 항목</th>${SIDS.map(sid => `<th class="c sv">${esc(shortName(sid))}</th>`).join('')}</tr></thead><tbody>${rowsH.join('')}</tbody></table></div>
      ${canMark() ? `<div class="nh-desc" style="margin-top:6px">이 회차에 볼 항목만 고를 수도 있어요: <button class="nh-btn xs" data-ej="mkitems">항목 고르기</button></div>` : ''}`;
  }
  if(cols.length && (SUB.type === 'S' || SUB.type === 'M')){
    h += `<div class="nh-tw" style="margin-top:10px"><table class="nh-t"><thead><tr><th class="fc">학생</th>${cols.map(c => `<th class="c">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>${SIDS.map(sid => `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${cols.map(c => `<td class="c"><input class="nh-in num" inputmode="decimal" data-mksc="${esc(sid)}" data-col="${esc(c.id)}" value="${esc((((MARKS.sc[sid] || {})[ses.id]) || {})[c.id] ?? '')}"${dis}></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return h + '</div>';
}
function marksAverage(){
  const st = SUB.setup || {}; const items = st.items || []; const cols = C.scoreCols(st.score);
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
  const st = SUB.setup || {}; const items = st.items || []; const cols = C.scoreCols(st.score);
  const m = A.modal('🧮 학기 중 기록 평균', `<div class="nh-desc">학생마다 <b>넣은 회차들만의 평균</b>이에요 (회차 ${MARKS.sessions.length}번 중 · 빈 회차는 세지 않음 · 5단계는 반올림해서 제안). 1회만 넣은 학생은 그 값 그대로, 아무것도 안 넣은 학생 · 항목은 비워 둬요 (·). 학기 말 평가에 채우면 선생님이 하나씩 고칠 수 있어요.</div>
    <div class="nh-tw" style="max-height:55vh"><table class="nh-t"><thead><tr><th class="fc">학생</th>${items.map(it => `<th class="c sv" title="${esc(it.t)}">${esc(it.t.slice(0, 8))}…</th>`).join('')}${cols.map(c => `<th class="c">${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${SIDS.map(sid => `<tr><td class="fc"><b>${esc(A.stuName(sid))}</b></td>${items.map(it => { const r = avg[sid].e[it.id]; return `<td class="c">${r ? `<span class="lv v${r.lv}" style="cursor:default" title="평균 ${r.avg} · ${r.n}회">${r.lv}</span>` : '·'}</td>`; }).join('')}${cols.map(c => `<td class="c">${esc(avg[sid].s[c.id] || '·')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    CAN.edit ? `<button class="nh-btn" data-c>닫기</button><button class="nh-btn" data-fill="empty">빈 칸만 채우기</button><button class="nh-btn p" data-fill="all">모두 덮어 채우기</button>` : `<button class="nh-btn" data-c>닫기</button>`, 'wide');
  const c = m.box.querySelector('[data-c]'); if(c) c.onclick = () => m.close();
  m.box.querySelectorAll('[data-fill]').forEach(b => b.onclick = async () => {
    const all = b.dataset.fill === 'all';
    let n = 0;
    tmSnap('bulk', cloneV(ENT.rows || {}));
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
  const b = C.blockFor(SUB, { stu: { id: sid, name: A.stuName(sid) }, sec: SEC, entry: ENT, lists: A.LISTS, staffName: A.staffName, term: A.TERM, actGroup: A.actGroupOf });
  const nos = {}; if(b && b.k === 'subj') nos[b.id] = A.SUBS.filter(s => s.secId === SUB.secId && s.kind === 'subj' && !s.removed && (s.order || 0) <= (SUB.order || 0)).length || 1;
  const doc = { lang: 'ko', blocks: b ? [b] : [] };
  return `<div class="st-nav"><button class="nh-btn sm" data-pvi="-1" ${PV_I ? '' : 'disabled'}>◀</button><b>${esc(A.stuName(sid))}</b><span class="nh-desc" style="margin:0">${PV_I + 1} / ${SIDS.length}</span><button class="nh-btn sm" data-pvi="1" ${PV_I < SIDS.length - 1 ? '' : 'disabled'}>▶</button>
      <span class="nh-sp"></span><button class="nh-btn sm" data-ej="pvfull">📄 이 학생 나학평 전체 미리보기</button></div>
    <div class="nr-wrap">${b ? docWithNo(doc, nos) : '<div class="nh-desc">이 학생은 이 칸이 출력되지 않아요 (비었거나 «출력에서 빼기»).</div>'}</div>`;
}
function docWithNo(doc, nos){
  const th = A.design().inner;
  const p = C.blockParts(doc.blocks[0], 'ko', nos[doc.blocks[0].id], false, th);
  return `<div class="nr${C.themeClass(th, A.design().shade)}"><section class="nb">${p.head}${p.tables.map(t => C.tableHTML(t, false, th)).join('')}${p.notes.join('')}</section></div>`;
}
function logHTML(){
  const L = (SUB.log || []).slice().reverse();
  const AN = { submit: '📨 작성완료', withdraw: '↩ 되찾기', ok: '✅ 검토완료', redo: '↩️ 수정 요청', approve: '🔒 최종 승인', reopen: '🔓 다시 열기', cmt: '💬 코멘트', edit: '✏️ 고침' };
  const canCmt = A.isMgr || (SUB.state === 'draft' && CAN.teacher) || CAN.now;
  return `${canCmt ? `<div class="st-card"><div class="fl"><label>한 줄 코멘트 (이 칸 기록에 남아요 — 학과 개관 · 평가 항목 · 학생 평가에 대한 의견)</label><textarea class="nh-ta" rows="2" id="ej-cmt" placeholder="예: 3번 항목 표현을 다듬어 주세요"></textarea></div><button class="nh-btn sm p" data-ej="cmt">남기기</button></div>` : ''}
    <div class="st-card">${L.map(l => `<div class="lg-row"><div style="min-width:110px"><b>${esc(AN[l.act] || l.act)}</b><br><small>${esc(fmtAt(l.at))}</small></div><div style="flex:1"><b>${esc(l.name || A.staffName(l.uid))}</b>${l.st ? ` <span class="ch gray">${esc(l.st)}</span>` : ''}${l.msg ? `<div style="white-space:pre-wrap;margin-top:2px">${esc(l.msg)}</div>` : ''}</div></div>`).join('') || '<div class="nh-desc">아직 기록이 없어요.</div>'}</div>
    ${chgPaneHTML()}`;
}

/* ═══════════ 누르기 · 바꾸기 ═══════════ */
async function doAct(act){
  await flush(); await flushSetup();     // 입력 · 평가 틀을 먼저 다 저장 (작성완료 뒤에는 맡은 선생님이 못 고침)
  let msg = '';
  if(act === 'submit'){
    const p = C.progressOf(SUB, ENT, SIDS);
    const next = 'r1' in (SUB.rv || {}) ? (SUB.rvL || [])[0] : (SUB.finL || '최종 승인');
    // v153 무엇이 비었는지 · 다른 학생 이름 — 요약 (고치러 가려면 «🔎 빈 곳 · 이름 점검»)
    const ck = canCheck() ? checkList() : { miss: [], names: [] };
    const sum = (L, f, n) => `<div class="ck-sum">${L.slice(0, n).map(f).join('<br>')}${L.length > n ? `<br><small>외 ${L.length - n}</small>` : ''}</div>`;
    const missH = p.done < p.total ? `<b style="color:var(--danger)">아직 ${p.total - p.done}명이 덜 채워졌어요.</b>${ck.miss.length ? sum(ck.miss, x => `${esc(A.stuName(x.sid))} <small>${x.m.map(esc).join(' · ')}</small>`, 8) : '<br>'}` : '모든 학생을 채웠어요 👏<br>';
    const nameH = ck.names.length ? `<b style="color:#9A5B00">⚠ 다른 학생 이름이 들어간 글 ${ck.names.length}곳</b>${sum(ck.names, x => `${esc(A.stuName(x.sid))} <small>${esc(x.t)} — «${x.h.map(esc).join('» «')}»</small>`, 6)}` : '';
    const tip = (ck.miss.length || ck.names.length) ? '<small style="color:var(--ink-2)">«✏️ 입력 › 🔎 빈 곳 · 이름 점검»에서 바로 고치러 갈 수 있어요.</small><br>' : '';
    const ok = await A.confirm('📨 작성완료 · 검토로 보내기', `${missH}${nameH}${tip}보내면 <b>${esc(next || '')}</b> 단계로 넘어가고 입력이 잠겨요. (첫 단계 검토가 시작되기 전이면 «되찾기»로 다시 고칠 수 있어요)`, '보내기');
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
    // v198 상태가 바뀌면 입력이 잠기므로 — 아직 저장 대기 중인 입력 · 평가 틀부터 저장하고, 그 모습을 타임머신에 보관
    if(act !== 'cmt'){
      await Promise.race([Promise.all([flush(), flushSetup()]), new Promise(r => setTimeout(r, 6000))]);     // 연결이 끊겨 있으면 끝없이 기다리지 않음
      const left = Object.keys(PENDS[SUB.id] || {}).length || INFL[SUB.id] || SPEND[SUB.id];
      // 넘기는 일(작성완료 · 검토완료 · 승인)은 내가 넣은 것이 다 저장된 뒤에만 — 되찾기 · 수정 요청 · 다시 열기는 막지 않음
      if(left || (CAN.edit && ['submit', 'ok', 'approve'].includes(act) && stashDiff(SUB.id))){ stashCheck(); return A.toast('아직 저장되지 않은 입력이 있어요 — 연결을 확인하고 위쪽 «다시 저장» 또는 «되살리기» 뒤에 해 주세요.', 'err'); }
      await Promise.race([chgFlush(SUB.id), new Promise(r => setTimeout(r, 4000))]);      // 상태가 바뀌면 기록도 못 쓰므로 먼저
      if(['submit', 'ok', 'redo', 'approve'].includes(act)) await tmSnap(act);
    }
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
  if(d.pvw){ setPvw(Number(d.pvw), true); return; }
  if(d.cgf){ CHG_MINE = d.cgf === 'mine'; drawBody(); return; }
  if(d.cgrev){ await chgRevert(d.cgrev, d.ci); return; }
  if(d.tab){ await flush(); TAB = d.tab; draw(); return; }
  if(d.mode){ VIEWMODE = d.mode; drawBody(); return; }
  if(d.one){ CUR = Math.max(0, Math.min(SIDS.length - 1, CUR + Number(d.one))); drawBody(); return; }
  if(d.pick != null && t.closest('.stu-chips')){ CUR = Number(d.pick); drawBody(); return; }
  if(d.pvi){ PV_I = Math.max(0, Math.min(SIDS.length - 1, PV_I + Number(d.pvi))); drawBody(); return; }
  if(d.lv){ if(!CAN.edit) return; levelPop(t, v => setLevel(d.lv, d.it, v)); return; }
  if(d.lv1){ if(!CAN.edit) return; const cur = Number(((row(d.lv1).e) || {})[d.it]) || 0; const v = Number(d.v); put(`rows.${d.lv1}.e.${d.it}`, cur === v ? null : v); drawBody(); return; }
  if(d.rowall){ levelPop(t, v => { tmSnap('bulk', cloneV(ENT.rows || {})); VIA = 'bulk'; setTimeout(() => { VIA = ''; }, 0); SIDS.forEach(sid => setLevel(sid, d.rowall, v)); }); return; }
  if(d.colall){ levelPop(t, v => { tmSnap('bulk', cloneV(ENT.rows || {})); VIA = 'bulk'; setTimeout(() => { VIA = ''; }, 0); ((SUB.setup || {}).items || []).forEach(it => setLevel(d.colall, it.id, v)); }); return; }
  if(d.mk){ if(!canMark()) return; levelPop(t, async v => { MARKS.m[d.mk] = MARKS.m[d.mk] || {}; MARKS.m[d.mk][MK_SES] = MARKS.m[d.mk][MK_SES] || {}; if(v) MARKS.m[d.mk][MK_SES][d.it] = v; else delete MARKS.m[d.mk][MK_SES][d.it]; t.className = 'lv' + (v ? ' v' + v : ''); t.textContent = v || '·'; await saveMarkAt(`m.${d.mk}.${MK_SES}.${d.it}`, v || undefined); }); return; }
  if(d.mks){ MK_SES = d.mks; drawBody(); return; }
  if(d.peall){ const v = await A.prompt('모두 같은 값', '모든 학생에게 넣을 결과', '', { ph: '예: 수료' }); if(v == null) return; SIDS.forEach(sid => put(`rows.${sid}.p.${d.peall}.${d.w}`, v.trim())); drawBody(); return; }
  if(d.actack){ if(!CAN.edit) return; const on = !!(((ENT.meta || {}).ack || {})[d.actack]); putRaw(`meta.ack.${d.actack}`, on ? undefined : true); drawBody(); return; }
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
  if(d.form){ if(!STRUCT()) return; await pickForm(d.form); return; }
  if(d.lay && t.tagName === 'BUTTON'){ if(!CAN.setup) return; const lay = Object.assign({}, SUB.setup.lay || {});
    if(d.lay === 'reset'){ delete lay.g; delete lay.s; } else lay[d.lay] = d.v === 'n' ? undefined : d.v;
    Object.keys(lay).forEach(k => { if(lay[k] === undefined) delete lay[k]; });
    SUB.setup = Object.assign({}, SUB.setup, { lay }); saveSetup(true); drawBody(); return; }
  const a = d.ej; if(!a) return;
  if(['submit', 'withdraw', 'ok', 'redo', 'approve', 'reopen', 'cmt'].includes(a)) return doAct(a);
  if(a === 'retry') return flush();
  if(a === 'undo') return undoRedo(false);
  if(a === 'again') return undoRedo(true);
  if(a === 'tm') return tmOpen();
  if(a === 'drawer') return dwOpen();
  if(a === 'avgopen'){ AVG_OPEN = true; drawBody(); return; }
  if(a === 'cgreload'){ await Promise.race([chgFlush(SUB.id), new Promise(r => setTimeout(r, 4000))]); CHG_CACHE[SUB.id] = null; drawBody(); return; }
  if(a === 'cgmore'){ CHG_N = Math.min(3000, CHG_N * 4); CHG_CACHE[SUB.id] = null; drawBody(); return; }
  if(a === 'stashok') return stashRestore();
  if(a === 'stashno') return stashDrop();
  if(a === 'check') return openCheck();
  if(a === 'reload'){ ENT = await A.getEntry(SUB.id, true); drawBody(); const n = document.getElementById('ej-remote'); if(n) n.style.display = 'none'; return; }
  if(a === 'paste') return pasteGrid();
  if(a === 'attpull') return pullAttendance();
  if(a === 'actlist'){ await flush(); A.afterActs = () => { A.afterActs = null; if(SUB && SUB.kind === 'act'){ ACT_AUTO = ''; actAuto(); drawBody(); } }; return ACTS.openActs(A); }
  if(a === 'actsync'){ window.showLoading && showLoading('출석부를 읽는 중…'); try{ await ACTS.loadAtt(A, true); }finally{ window.hideLoading && hideLoading(); } if(!ACTS.attReady()) return A.toast('출석부를 읽지 못했어요.', 'err'); if(!actAuto(true)) A.toast('출석부와 모두 맞아요 ✓'); drawBody(); return; }
  if(a === 'servebulk') return serveBulk();
  if(a === 'students'){ await SETUP.editCellStudents(SUB.id, A); SUB = A.subOf(SUB.id); SIDS = A.subStudents(SUB); draw(); return; }
  if(a === 'itemadd'){ const it = (SUB.setup.items || []).concat([{ id: C.rid('i'), g: '', t: '' }]); SUB.setup = Object.assign({}, SUB.setup, { items: it }); saveSetup(true); drawBody(); setTimeout(() => { const ins = EL.querySelectorAll('[data-itf][data-f="t"]'); if(ins.length) ins[ins.length - 1].focus(); }, 30); return; }
  if(a === 'itempaste') return pasteItems();
  if(a === 'import'){ if(!STRUCT()) return; return importDialog(); }
  if(a === 'splitpre'){ const it = (SUB.setup.items || []).map(x => { const m = /^\s*[\[［【(（]([^\]］】)）]{1,20})[\]］】)）]\s*(\S[\s\S]*)$/.exec(x.t || ''); return m && !String(x.s || '').trim() ? Object.assign({}, x, { s: m[1].trim(), t: m[2].trim() }) : x; });
    SUB.setup = Object.assign({}, SUB.setup, { items: it, lay: Object.assign({}, SUB.setup.lay || {}, { sOn: true }) }); saveSetup(true); drawBody(); A.toast('머리말을 «세부» 칸으로 옮겼어요 ✓'); return; }
  if(a === 'saveform') return saveAsForm();
  if(a === 'sharesync'){ if(!STRUCT()) return; await flushSetup(); window.showLoading && showLoading('맞추는 중…'); const n = await propagate(SUB.id, SUB.setup); window.hideLoading && hideLoading(); A.toast(n ? `${n}칸을 이 틀로 맞췄어요 ✓ (그 칸 입력은 같은 글끼리 이어짐)` : '맞출 수 있는 칸이 없어요 (검토 중이거나 다른 선생님 칸 — 나학평 담당에게)'); drawBody(); return; }
  if(a === 'sharepull'){ if(!STRUCT()) return; return pullShared(); }
  if(a === 'unshare'){ if(!STRUCT()) return; if(!(await A.confirm('함께 쓰기 풀기', '이 칸만 함께 쓰기에서 빠져요. 지금 평가 틀은 그대로 남아요.', '풀기'))) return;
    // 묶음의 기준 칸(다른 칸이 «sh_이 칸»으로 가리킴)이어도 이 칸만 빠지게 — «x_» 표시
    try{ await A.saveSub(SUB.id, { share: 'x_' + SUB.id }); SUB = A.subOf(SUB.id) || SUB; A.toast('이 칸만 함께 쓰기에서 뺐어요'); drawBody(); }catch(err){ A.toast('풀지 못했어요 — ' + A.errText(err), 'err'); } return; }
  if(a === 'coladd'){ const sc = Object.assign({ title: '성적', cols: [], tot: { on: false, t: '총 점수' }, r1: '개인점수', r2: '반 평균', avgOn: true, avg: {} }, SUB.setup.score || {}); sc.cols = (sc.cols || []).concat([{ id: C.rid('c'), t: '', w: '' }]); SUB.setup = Object.assign({}, SUB.setup, { score: sc }); saveSetup(true); drawBody(); return; }
  if(a === 'narradd'){ const N = (SUB.setup.narr || []).concat([{ id: C.rid('n'), t: d.t || '', each: d.each === '1', fixed: '' }]); SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(true); drawBody(); return; }
  if(a === 'bookadd'){ const B = (SUB.setup.books || []); if(B.length >= 25) return A.toast('25권까지예요.', 'err'); SUB.setup = Object.assign({}, SUB.setup, { books: B.concat([{ id: C.rid('b'), t: '', p: '' }]) }); saveSetup(true); drawBody(); return; }
  if(a === 'bookpaste'){ const v = await A.prompt('도서 붙여넣기', '엑셀에서 «도서명 | 출판사» 두 칸을 복사해 붙여넣으세요', '', { multi: true });
    if(!v) return; const B = (SUB.setup.books || []).slice(); v.split(/\r?\n/).map(l => l.split('\t')).filter(c => c[0] && c[0].trim()).forEach(c => { if(B.length < 25) B.push({ id: C.rid('b'), t: c[0].trim(), p: (c[1] || '').trim() }); });
    SUB.setup = Object.assign({}, SUB.setup, { books: B }); saveSetup(true); drawBody(); return; }
  if(a === 'pvfull'){ const sid = SIDS[PV_I]; window.showLoading && showLoading('문서를 만드는 중…');
    const secId = SUB.grp ? (((A.TERM.sections || []).find(x => (x.students || []).includes(sid))) || {}).id : SUB.secId;
    try{ if(!secId) throw new Error('이 학생이 든 반이 이 학기 나학평에 없어요'); const doc = await A.liveDoc(secId, sid); const pages = await A.pagesOf(doc, { draft: true }); window.hideLoading && hideLoading(); A.showPages(pages, `${esc(doc.cover.name)} — 미리보기`, doc, { draft: true, pageOpt: { draft: true } }); }
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
  else {
    put(`rows.${sid}.no.${a.id}`, on ? null : true);
    // v201 손으로 바꾼 학생 — 출석부로 자동으로 뺀 표시는 지우고, 그날 출결이 정상이 아니면 «손으로 바꿈»을 남겨 다시 맞출 때 건드리지 않게
    const r = row(sid); const wasAu = !!(r.au || {})[a.id];
    if(wasAu) putRaw(`rows.${sid}.au.${a.id}`, undefined);
    if(ACTS.hasDates(a) && (wasAu || (ACTS.attReady() && ACTS.attOf(a, sid))) && !(r.mn || {})[a.id]) putRaw(`rows.${sid}.mn.${a.id}`, true);
  }
}
function onChange(e){
  const x = e.target; const d = x.dataset;
  if(d.off){ put(`rows.${d.off}.off`, x.checked ? true : null); if(VIEWMODE === 'grid') drawBody(); return; }
  if(d.act){ const a = C.actsFor(A.LISTS, SUB.secId).find(y => y.id === d.a); if(a){ setAct(d.act, a, x.checked); if(ACTS.hasDates(a)){ const w = EL.querySelector('.nh-tw'); const sl = w ? w.scrollLeft : 0; drawBody(); const w2 = EL.querySelector('.nh-tw'); if(w2) w2.scrollLeft = sl; const f = EL.querySelector(`[data-act="${CSS.escape(d.act)}"][data-a="${CSS.escape(d.a)}"]`); if(f) f.focus(); } } return; }
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
  if(x.hasAttribute('data-pvs')){ PV_SID = x.value; pvRefresh(); return; }
  if(x.hasAttribute('data-cgsid')){ CHG_SID = x.value; drawBody(); return; }
  if(d.itf != null && x.hasAttribute('data-itf') && (d.f === 'g' || (d.f === 't' && /^\s*[\[［【(（]/.test(x.value)))){ drawBody(); return; }   // 범위 묶음 · [머리말] 단추를 다시 그림 (칸을 떠날 때)
  if(x.hasAttribute('data-pvth')){ pvRefresh(); return; }
  if(d.lay === 'sOn'){ const lay = Object.assign({}, SUB.setup.lay || {}, { sOn: x.checked }); SUB.setup = Object.assign({}, SUB.setup, { lay }); saveSetup(true); drawBody(); return; }
  if(x.hasAttribute('data-nreach')){ const N = (SUB.setup.narr || []).map(y => Object.assign({}, y)); N[+d.nreach].each = x.value === '1'; SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(true); drawBody(); return; }
}
function onInput(e){
  const x = e.target; const d = x.dataset;
  if(d.nr){ put(`rows.${d.nr}.n.${d.ni}`, x.value); const c = EL.querySelector(`[data-cnt="${CSS.escape(d.nr + ':' + d.ni)}"]`); if(c) c.innerHTML = cntHTML(d.nr, d.ni, x.value); return; }
  if(d.sc){ put(`rows.${d.sc}.s.${d.col}`, x.value.trim()); const tt = EL.querySelector(`[data-tot="${CSS.escape(d.sc)}"]`); if(tt) tt.textContent = C.scoreTotal(SUB.setup.score, row(d.sc).s || {}) || '—';
    EL.querySelectorAll('[data-avg]').forEach(c => { c.textContent = C.scoreAvg(SUB.setup.score, ENT.rows, SIDS, c.dataset.avg); });   // v198 반 평균 바로
    return; }
  if(d.pe){ put(`rows.${d.pe}.p.${d.p}.${d.w}`, x.value.trim()); return; }
  if(d.mksc){ MARKS.sc[d.mksc] = MARKS.sc[d.mksc] || {}; MARKS.sc[d.mksc][MK_SES] = MARKS.sc[d.mksc][MK_SES] || {}; MARKS.sc[d.mksc][MK_SES][d.col] = x.value.trim(); clearTimeout(x._t); { const ses = MK_SES, sid = d.mksc, col = d.col; x._t = setTimeout(() => saveMarkAt(`sc.${sid}.${ses}.${col}`, (((MARKS.sc[sid] || {})[ses] || {})[col]) || undefined), 600); } return; }
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
    tmSnap('paste', cloneV(ENT.rows || {})); VIA = 'paste'; setTimeout(() => { VIA = ''; }, 0);
    g.forEach((r, i) => { const it = items[i]; if(!it) return; r.forEach((v, j) => { const sid = SIDS[s0 + j]; if(!sid) return; if(/^[1-5]$/.test(v)){ put(`rows.${sid}.e.${it.id}`, Number(v)); n++; } else if(v) bad++; }); });
    m.close(); drawBody(); A.toast(`${n}칸을 넣었어요${bad ? ` · 숫자가 아닌 ${bad}칸은 건너뜀` : ''} ✓`);
  };
}
async function pasteItems(){
  const v = await A.prompt('📋 평가 항목 여러 줄 붙여넣기', '한 줄에 하나씩 — 엑셀 칸 그대로: «내용» 한 칸 · «범위 | 내용» 두 칸 · «범위 | 세부 | 내용» 세 칸', '', { multi: true, ph: '태도\t수업 준비\t수업에 필요한 준비를 갖추고 참여한다.\n태도\t경청\t설명을 조용히 듣고 집중한다.' });
  if(!v) return;
  // v144 세 칸(범위 · 세부 · 내용)이면 세부 칸도 켠다
  const add = v.replace(/\r/g, '').split('\n').filter(l => l.trim()).map(l => { const c = l.split('\t').map(x => x.trim());
    if(c.length >= 3) return { id: C.rid('i'), g: c[0], s: c[1], t: c.slice(2).join(' ').trim() };
    return c.length > 1 ? { id: C.rid('i'), g: c[0], t: c.slice(1).join(' ').trim() } : { id: C.rid('i'), g: '', t: c[0] }; }).filter(x => x.t);
  const lay = Object.assign({}, SUB.setup.lay || {}); if(add.some(x => String(x.s || '').trim())) lay.sOn = true;
  SUB.setup = Object.assign({}, SUB.setup, { lay, items: (SUB.setup.items || []).filter(x => String(x.t || '').trim()).concat(add) });
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
    tmSnap('bulk', cloneV(ENT.rows || {}));
    sel.forEach(sid => { const L = (row(sid).list || []).slice(); L.push(Object.assign({ id: C.rid('v') }, x)); put(`rows.${sid}.list`, L); });
    m.close(); drawBody(); A.toast(`${sel.size}명에게 넣었어요 ✓`);
  };
}

/* ═══════════ v144 ① 양식 고르기 ═══════════ */
async function pickForm(k){
  const f = C.FORMS.find(x => x.k === k); if(!f) return;
  const cur = SUB.type || 'E';
  let setup = SUB.setup || {};
  if(f.type !== cur){
    const ok = await A.confirm('양식 바꾸기', `«${esc(A.subLabel(SUB))}»을(를) <b>${esc(f.ko)}</b>(으)로 바꿀까요?<br>이미 만든 항목 · 입력은 지우지 않고 남겨 둬요 (양식을 되돌리면 다시 보여요).`, '바꾸기');
    if(!ok) return;
    setup = C.setupForType(setup, f.type);
  }
  if(f.lay){ const lay = Object.assign({}, setup.lay || {}); lay.sOn = !!f.lay.sOn; if(!lay.sOn) delete lay.s; setup = Object.assign({}, setup, { lay }); }
  try{
    await flush(); await flushSetup();
    if(f.type !== cur){ await A.saveSub(SUB.id, { type: f.type, setup }); SUB.type = f.type; }
    SUB.setup = setup; await saveSetup(true);
    draw();
  }catch(e){ A.toast('바꾸지 못했어요 — ' + A.errText(e) + (/permission/.test((e && e.code) || '') ? ' (보안 규칙 v38이 필요해요)' : ''), 'err'); }
}

/* ═══════════ v144 📥 가져오기 — 다른 반 · 지난 학기 · 기관 양식 · 다른 과목 ═══════════ */
let IMPSRC = null;
async function loadImportSources(){
  const out = [];
  const nameK = C.normKey(SUB.name);
  // 이번 학기 — 모든 과목 칸 (같은 이름이 위에)
  A.SUBS.filter(s => s.kind === 'subj' && !s.removed && s.id !== SUB.id).forEach(s => out.push({ g: C.normKey(s.name) === nameK ? 'same' : 'other', key: 's:' + s.id, sub: s, name: s.name, where: A.whereOf(s), term: C.termLabel(A.TERM), type: s.type || 'E', setup: s.setup || {}, teacher: (s.teacherUids || []).map(A.staffName).filter(Boolean).join(', '), share: true }));
  // 기관 양식 모음
  ((A.FORMS || {}).list || []).forEach(f => out.push({ g: 'forms', key: 'f:' + f.id, name: f.name, where: f.d || '', term: '기관 양식', type: f.type || 'E', setup: f.setup || {}, teacher: f.byName || '' }));
  // 지난 학기 — 나학평에서 연 학기는 칸 · 옮겨 온 학기는 목록
  for(const t of A.TERMS.filter(x => x.id !== A.TERM.id)){
    try{
      if(t.src === 'import'){
        const d = await FS.getDoc(FS.doc(A.db, 'nhpLists', t.id));
        ((d.exists() && d.data().setups) || []).forEach((p, i) => out.push({ g: C.normKey(p.name) === nameK ? 'prev' : 'old', key: `p:${t.id}:${i}`, name: p.name, where: p.gradeNo ? `${p.gradeNo}학년` : '', term: C.termLabel(t) + ' · 옮겨 온 자료', type: p.type || 'E', setup: p.setup || {}, teacher: '' }));
      } else {
        const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpSubjects'), FS.where('termId', '==', t.id)));
        q.forEach(d => { const s = d.data(); if(s.kind !== 'subj' || s.removed) return; const sec = (t.sections || []).find(x => x.id === s.secId);
          out.push({ g: C.normKey(s.name) === nameK ? 'prev' : 'old', key: 'q:' + d.id, name: s.name, where: s.grp ? `${s.grp.setName || ''} ${s.grp.name || ''}` : (sec ? C.secLabel(sec) : ''), term: C.termLabel(t), type: s.type || 'E', setup: s.setup || {}, teacher: '' }); });
      }
    }catch(e){}
  }
  return out;
}
function srcShape(x){
  const st = x.setup || {}; const n = (st.items || []).length;
  const shape = (x.type === 'E' || x.type === 'M') ? (C.hasSub(st) ? '범위 + 세부' : (st.items || []).some(i => String(i.g || '').trim()) ? '범위 + 5단계' : '5단계') : (C.TYPES[x.type] || {}).short || x.type;
  return `${shape}${n ? ` · 항목 ${n}` : ''}${x.type === 'S' || x.type === 'M' ? ` · 시험 ${((st.score || {}).cols || []).length}` : ''}`;
}
async function importDialog(){
  window.showLoading && showLoading('가져올 곳을 찾는 중…');
  try{ IMPSRC = await loadImportSources(); }catch(e){ IMPSRC = []; }
  window.hideLoading && hideLoading();
  const G = [['same', '같은 과목 · 이번 학기'], ['prev', '지난 학기 · 같은 과목'], ['forms', '기관 양식 모음'], ['other', '다른 과목 · 이번 학기'], ['old', '다른 과목 · 지난 학기']];
  let cur = (IMPSRC.find(x => x.g === 'same') || IMPSRC.find(x => x.g === 'prev') || IMPSRC[0] || {}).key || '';
  let pick = null;
  const m = A.modal(`📥 평가 틀 가져오기 <small style="font-weight:700;color:var(--ink-2)">${esc(A.subLabel(SUB))} · ${esc(A.whereOf(SUB))}에 넣어요</small>`, `<div class="imp2"><div class="imp2-l"><input class="nh-in" data-q placeholder="찾기 (예: 생각나무 · 이레)" style="width:100%;margin-bottom:8px"><div data-list></div></div><div class="imp2-r" data-r></div></div>`,
    `<span class="nh-desc" data-cnt style="margin:0 auto 0 0"></span><button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>가져오기</button>`, 'wide');
  const list = m.box.querySelector('[data-list]'), R = m.box.querySelector('[data-r]');
  const drawList = () => {
    const q = m.box.querySelector('[data-q]').value.trim();
    const hit = x => !q || `${x.name} ${x.where} ${x.term} ${x.teacher}`.includes(q);
    list.innerHTML = G.map(([g, lab]) => { const xs = IMPSRC.filter(x => x.g === g && hit(x)); if(!xs.length) return '';
      return `<div class="imp2-g">${esc(lab)}</div>` + xs.slice(0, g === 'other' || g === 'old' ? (q ? 60 : 8) : 60).map(x => `<button class="imp2-s${x.key === cur ? ' on' : ''}" data-k="${esc(x.key)}"><b>${esc(x.name)}${x.where ? ` <span>· ${esc(x.where)}</span>` : ''}</b><small>${esc(x.term)} · ${esc(srcShape(x))}${x.teacher ? ' · ' + esc(x.teacher) : ''}</small></button>`).join(''); }).join('') || '<div class="nh-desc">가져올 곳이 없어요.</div>';
  };
  const drawRight = () => {
    const x = IMPSRC.find(y => y.key === cur);
    if(!x){ R.innerHTML = '<div class="nh-desc">왼쪽에서 고르세요.</div>'; return; }
    const st = x.setup || {}; const items = st.items || []; const sOn = C.hasSub(st);
    pick = pick && pick.key === cur ? pick : { key: cur, items: new Set(items.map(i => i.id)) };
    const canShare = x.g === 'same' && x.sub && (x.type || 'E') !== 'R';
    R.innerHTML = `<div class="frow" style="align-items:center"><b style="font-size:14px">${esc(x.name)}</b><span class="ch gray">${esc(x.where || x.term)}</span><span class="nh-desc" style="margin:0">표 모양: ${esc(srcShape(x))}</span></div>
      ${items.length ? `<div class="nh-tw" style="max-height:38vh;margin-top:8px"><table class="nh-t"><thead><tr><th class="c"><input type="checkbox" data-all checked></th><th>범위</th>${sOn ? '<th>세부</th>' : ''}<th>평가 내용</th></tr></thead><tbody>${items.map(i => `<tr><td class="c"><input type="checkbox" data-it="${esc(i.id)}"${pick.items.has(i.id) ? ' checked' : ''}></td><td>${esc(i.g || '')}</td>${sOn ? `<td>${esc(i.s || '')}</td>` : ''}<td>${esc(i.t || '')}</td></tr>`).join('')}</tbody></table></div>` : `<div class="nh-desc" style="margin-top:8px">평가 항목이 없는 틀이에요 (${esc((C.TYPES[x.type] || {}).ko || '')}).</div>`}
      <div class="frow" style="margin-top:10px;gap:18px;align-items:flex-start">
        <div><div class="nh-desc" style="margin:0 0 4px"><b>넣는 방법</b></div><label class="ck" style="display:flex"><input type="radio" name="im-how" value="rep" checked>지금 틀을 바꾸기</label><label class="ck" style="display:flex"><input type="radio" name="im-how" value="add">지금 틀 뒤에 붙이기 (항목만)</label></div>
        <div><div class="nh-desc" style="margin:0 0 4px"><b>함께 가져올 것</b></div><label class="ck" style="display:flex"><input type="checkbox" data-o="lay" checked>표 모양 (칸 · 폭)</label><label class="ck" style="display:flex"><input type="checkbox" data-o="narr" checked>서술 칸 · 시험 항목</label><label class="ck" style="display:flex"><input type="checkbox" data-o="ov">«수업 내용 개관» 글</label></div></div>
      ${canShare ? `<label class="ck sh-opt"><input type="checkbox" data-o="share"><span><b>🔗 앞으로 함께 쓰기</b> — ${esc(A.whereOf(SUB))}와(과) ${esc(x.where)}이(가) 같은 평가 틀을 써요. 한 곳에서 고치면 모두 바뀌어요 (학생 입력 · 점수는 칸마다 따로).</span></label>` : ''}
      ${(SUB.type || 'E') !== (x.type || 'E') ? `<div class="nh-warn" style="margin-top:8px">평가 방식이 달라요 (지금 ${esc((C.TYPES[SUB.type] || C.TYPES.E).short)} → ${esc((C.TYPES[x.type] || C.TYPES.E).short)}). «바꾸기»로 가져오면 방식도 바뀌어요 (이미 쓴 입력은 남아 있어요).</div>` : ''}`;
    m.box.querySelector('[data-cnt]').textContent = items.length ? `${items.length}개 중 ${pick.items.size}개 고름` : '';
    const sh = R.querySelector('[data-o="share"]');
    if(sh) sh.onchange = () => { if(sh.checked){ R.querySelector('input[name="im-how"][value="rep"]').checked = true; R.querySelectorAll('[data-it],[data-all]').forEach(c => { c.checked = true; c.disabled = true; }); x.setup && (pick.items = new Set(items.map(i => i.id))); } else R.querySelectorAll('[data-it],[data-all]').forEach(c => { c.disabled = false; }); };
  };
  m.box.querySelector('[data-q]').oninput = drawList;
  list.onclick = e => { const b = e.target.closest('[data-k]'); if(!b) return; cur = b.dataset.k; pick = null; drawList(); drawRight(); };
  R.onchange = e => {
    const c = e.target;
    if(c.dataset.it){ if(c.checked) pick.items.add(c.dataset.it); else pick.items.delete(c.dataset.it); }
    if(c.hasAttribute('data-all')){ const x = IMPSRC.find(y => y.key === cur); pick.items = new Set(c.checked ? ((x.setup || {}).items || []).map(i => i.id) : []); R.querySelectorAll('[data-it]').forEach(i => { i.checked = c.checked; }); }
    const x = IMPSRC.find(y => y.key === cur); const n = ((x && x.setup || {}).items || []).length;
    m.box.querySelector('[data-cnt]').textContent = n ? `${n}개 중 ${pick.items.size}개 고름` : '';
  };
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const x = IMPSRC.find(y => y.key === cur); if(!x) return;
    const how = (R.querySelector('input[name="im-how"]:checked') || {}).value || 'rep';
    const o = k => { const c = R.querySelector(`[data-o="${k}"]`); return !!(c && c.checked); };
    m.close();
    await applyImport(x, { how, items: pick ? pick.items : null, lay: o('lay'), narr: o('narr'), ov: o('ov'), share: o('share') });
  };
  drawList(); drawRight();
}
async function applyImport(x, o){
  await flush(); await flushSetup();
  const src = JSON.parse(JSON.stringify(x.setup || {}));
  const old = SUB.setup || {};
  const items0 = (src.items || []).filter(i => !o.items || o.items.has(i.id));
  let setup, type = SUB.type || 'E';
  if(o.share && x.sub){
    // 함께 쓰기 — 틀을 그대로 (같은 id) · 이 칸의 학생 입력은 같은 글 항목으로 이어 준다
    setup = src; type = x.type || 'E';
  } else if(o.how === 'add'){
    const have = new Set((old.items || []).map(i => C.normKey(i.t)));
    const add = items0.filter(i => !have.has(C.normKey(i.t))).map(i => Object.assign({}, i, { id: C.rid('i') }));
    setup = Object.assign({}, old, { items: (old.items || []).filter(i => String(i.t || '').trim()).concat(add) });
    if(o.lay && src.lay) setup.lay = Object.assign({}, src.lay, { sOn: !!(src.lay.sOn || (setup.lay || {}).sOn) });
    if(add.some(i => String(i.s || '').trim())) setup.lay = Object.assign({}, setup.lay || {}, { sOn: true });
  } else {
    type = x.type || type;
    const base = C.setupForType(old, type);
    setup = Object.assign({}, base, { items: items0 });
    if(o.lay) setup.lay = src.lay ? Object.assign({}, src.lay) : {}; 
    if(o.narr){ setup.narr = (src.narr || []).map(n => Object.assign({}, n, { fixed: (!C.isEach(n) && o.ov) ? (n.fixed || '') : (C.isEach(n) ? '' : ((old.narr || []).find(y => C.normKey(y.t) === C.normKey(n.t)) || {}).fixed || '') })); if(src.score) setup.score = src.score; if(src.a) setup.a = src.a; if(src.r) setup.r = src.r; }
    setup = C.reuseIds(old, setup);        // 같은 글 항목은 지금 id 그대로 (이미 넣은 5단계가 끊기지 않게)
  }
  try{
    // 학생 입력 이어 주기 — 5단계 · 서술 · 점수 모두 같은 글끼리 (예전 id 값은 그대로 남김 — 되돌리면 다시 보임)
    //   입력을 다시 읽어서(다른 기기에서 넣은 것까지) 먼저 이어 둔 뒤 틀을 바꾼다
    const ref = FS.doc(A.db, 'nhpEntries', SUB.id);
    const snap = await FS.getDoc(ref);
    const rows = (snap.exists() && snap.data().rows) || {};
    const up = C.remapPatch(rows, old, setup);
    if(Object.keys(up).length) await FS.updateDoc(ref, Object.assign(up, { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }));
    const patch = { setup };
    if(type !== (SUB.type || 'E')) patch.type = type;
    let shareNote = '';
    if(o.share && x.sub){
      const k0 = C.shareOf(x.sub, A.SUBS);
      if(k0) patch.share = k0;
      else {
        // 가져온 칸이 아직 아무와도 안 묶였거나 «이 칸만 빠짐»이면 그 칸도 같은 열쇠로 (고칠 수 있을 때만)
        const key = 'sh_' + x.sub.id;
        const canW = x.sub.state === 'draft' && (A.isMgr || (x.sub.teacherUids || []).includes(A.CU.uid)) || (A.isMgr && x.sub.state !== 'done');
        if(!x.sub.share){ patch.share = key; }
        else if(canW){ await A.saveSub(x.sub.id, { share: key }); patch.share = key; }
        else shareNote = ' (그 칸은 함께 쓰기를 풀어 둔 칸이라 묶지는 못했어요 — 틀만 가져왔어요)';
      }
    }
    await A.saveSub(SUB.id, patch);
    Object.assign(SUB, patch);
    ENT = await A.getEntry(SUB.id, true);
    A.toast(o.share && patch.share ? '가져와서 «함께 쓰기»로 묶었어요 🔗' : '가져왔어요 ✓ — 오른쪽 미리보기에서 확인하세요' + shareNote);
    draw();
  }catch(e){ A.toast('가져오지 못했어요 — ' + A.errText(e) + (/permission/.test((e && e.code) || '') ? ' (보안 규칙 v38이 필요해요)' : ''), 'err'); }
}
/* ⭐ 기관 양식으로 저장 (나학평 담당) — nhpConfig/forms */
async function saveAsForm(){
  const nm = await A.prompt('⭐ 기관 양식으로 저장', '양식 이름 (선생님들이 «가져오기 › 기관 양식 모음»에서 골라요)', `${SUB.name} 기본`, { required: '이름을 넣어 주세요' });
  if(!nm) return;
  const d0 = await A.prompt('설명 (선택)', '예: 수업 태도 기본 · 모든 과목에 쓰기 좋음', '', {});
  const st = JSON.parse(JSON.stringify(SUB.setup || {}));
  (st.narr || []).forEach(n => { if(!C.isEach(n)) n.fixed = ''; });   // 개관 글은 학기마다 바뀜
  try{
    const ref = FS.doc(A.db, 'nhpConfig', 'forms');
    const snap = await FS.getDoc(ref);
    const list = (snap.exists() && snap.data().list) || [];
    list.push({ id: C.rid('f'), name: nm.trim(), d: (d0 || '').trim(), type: SUB.type || 'E', setup: st, by: A.CU.uid, byName: A.CU.name || '', at: new Date().toISOString() });
    await FS.setDoc(ref, { list, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }, { merge: true });
    A.FORMS = { list };
    A.toast('기관 양식 모음에 넣었어요 ⭐');
  }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
}
window.addEventListener('resize', () => { if(TAB === 'set') pvFit(); });

/* ═══════════ v202 🗄 가져오기 서랍 — 내 다른 반 · 다른 선생님 · 지난 학기 · 문장 모음 ═══════════
   · 평가 틀은 예전 «📥 가져오기» 창으로 · 여기서는 «내용»: 모든 학생 같은 글(수업 내용 개관) · 학생별 글 · 5단계 평가
   · 학생별 내용은 «같은 학생»끼리만 · 넣기 전에 몇 칸이 들어가는지 보여 줌 · 기본은 «빈 칸에만» · 한 번의 되돌리기로 취소 · 고친 기록에 «가져옴»
   · 문장 모음은 나만 봄 — userMemos/<내 uid>.nhpPhrases (보안 규칙 그대로) */
const DW = { el: null, tab: 'mine', q: '', key: '', mode: 'empty', parts: { ov: true, narr: true, lv: true }, src: null, ent: {}, focus: null, ph: null, phG: '', phQ: '', phT: '', phGi: '', phErr: false, past: 0, busy: false };
const dwCan = () => !!SUB && (SUB.kind === 'subj' || SUB.kind === 'hr');
function dwClose(){ if(DW.el){ DW.el.remove(); DW.el = null; } document.body.classList.remove('dw-open'); }
/* 마지막으로 쓰던 글 칸 · 커서 자리 (칸이 다시 그려져도 그 자리에 넣게 · 다른 칸의 것은 쓰지 않음) */
const dwMark = e => { const t = e.target; if(t && t.matches && t.matches('textarea[data-nr]') && SUB) DW.focus = { sub: SUB.id, sid: t.dataset.nr, ni: t.dataset.ni, a: t.selectionStart, b: t.selectionEnd }; };
['focusin', 'keyup', 'mouseup', 'select', 'input'].forEach(ev => document.addEventListener(ev, dwMark, true));
async function dwOpen(){
  if(!dwCan()) return;
  if(DW.el){ dwClose(); return; }
  DW.src = null; DW.ent = {}; DW.key = ''; DW.q = ''; DW.ph = null; DW.phErr = false; DW.past = 0;
  if(DW.focus && DW.focus.sub !== SUB.id) DW.focus = null;
  if(SUB.kind !== 'subj') DW.tab = 'ph';
  const el = DW.el = document.createElement('aside'); el.id = 'nh-dw'; el.className = 'dw'; el.setAttribute('aria-label', '가져오기 서랍');
  document.body.appendChild(el); document.body.classList.add('dw-open');
  el.addEventListener('click', dwClick); el.addEventListener('input', dwInput); el.addEventListener('change', dwInput);
  el.addEventListener('mousedown', e => { if(e.target.closest('[data-dwph],[data-dwsel]')) e.preventDefault(); });     // 글 칸의 커서 · 고른 글을 잃지 않게
  dwDraw();
  if(SUB.kind === 'subj') dwSources().then(() => { if(DW.el && DW.tab !== 'ph') dwDraw(); });
  dwPhLoad().then(() => { if(DW.el && DW.tab === 'ph') dwDraw(); });
}
const dwStu = (s, term) => { const sec = ((term || A.TERM).sections || []).find(x => x.id === s.secId); return (Array.isArray(s.studentIds) && s.studentIds.length) ? s.studentIds : ((sec && sec.students) || []); };
async function dwSources(){
  const id = SUB.id; const out = []; const nameK = C.normKey(SUB.name); const me = A.CU.uid;
  const mk = (s, sid, t, cur) => { const st = dwStu(s, t); const sec = (t.sections || []).find(x => x.id === s.secId);
    return { key: sid, id: sid, sub: s, name: s.name, type: s.type || 'E', setup: s.setup || {}, cur, term: C.termLabel(t),
      where: s.grp ? `${s.grp.setName || ''} ${s.grp.name || ''}`.trim() : (sec ? C.secLabel(sec) : ''), teacher: (s.teacherUids || []).map(A.staffName).filter(Boolean).join(', '),
      mine: (s.teacherUids || []).includes(me), sameName: C.normKey(s.name) === nameK, same: st.filter(x => SIDS.includes(x)).length }; };
  A.SUBS.filter(s => s.kind === 'subj' && !s.removed && s.id !== SUB.id).forEach(s => out.push(mk(s, s.id, A.TERM, true)));
  DW.mk = mk; DW.sort = L => L.sort((a, b) => (b.sameName - a.sameName) || (b.same - a.same) || String(a.name).localeCompare(String(b.name), 'ko') || String(a.where).localeCompare(String(b.where), 'ko'));
  DW.src = DW.sort(out);
}
/* 지난 학기 칸 — «지난 학기» 탭을 처음 열 때만 읽음 */
async function dwPast(){
  if(DW.past || !DW.src) return; DW.past = 1;
  const id = SUB.id; const out = []; let bad = 0;
  for(const t of (A.TERMS || []).filter(x => x.id !== A.TERM.id && x.src !== 'import')){
    try{ const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpSubjects'), FS.where('termId', '==', t.id)));
      q.forEach(d => { const s = d.data(); if(s.kind === 'subj' && !s.removed) out.push(DW.mk(s, d.id, t, false)); }); }catch(e){ bad++; }
  }
  if(!SUB || SUB.id !== id || !DW.el || !DW.src) return;
  DW.src = DW.sort(DW.src.filter(x => x.cur).concat(out)); DW.past = bad ? 3 : 2;
  if(DW.tab === 'past') dwDraw();
}
const dwList = () => (DW.src || []).filter(x => DW.tab === 'mine' ? (x.cur && x.mine) : DW.tab === 'oth' ? (x.cur && !x.mine) : !x.cur)
  .filter(x => !DW.q || `${x.name} ${x.where} ${x.term} ${x.teacher}`.includes(DW.q));
const dwPick = () => (DW.src || []).find(x => x.key === DW.key) || null;
/* 무엇이 몇 칸 들어가는지 — ov: 모든 학생 같은 글 · narr: 학생별 글 · lv: 5단계 평가 */
function dwPlan(x, ent){
  const st = SUB.setup || {}, ss = x.setup || {}; const rows = (ent && ent.rows) || {}; const all = DW.mode === 'all';
  // 이름(글)이 같은 것끼리만 (서술 칸은 이름 없는 칸끼리 차례대로) — 이름이 다른 칸에는 넣지 않음
  const pair = (S, T, blankOk) => { const out = [], used = new Set(); S.forEach(s => { const k = C.normKey(s.t); if(!k && !blankOk) return; const t = T.find(y => !used.has(y.id) && C.normKey(y.t) === k); if(t){ used.add(t.id); out.push([s, t]); } }); return out; };
  const P = { ov: [], narr: [], lv: [], skip: { ov: 0, narr: 0, lv: 0 }, why: {} };
  const common = SIDS.filter(sid => rows[sid] && !row(sid).off);
  // 모든 학생 같은 글
  pair((ss.narr || []).filter(n => !C.isEach(n) && String(n.fixed || '').trim()), (st.narr || []).filter(n => !C.isEach(n)), true)
    .forEach(([s, t]) => { if(!all && String(t.fixed || '').trim()){ P.skip.ov++; return; } if(String(t.fixed || '') !== String(s.fixed)) P.ov.push({ id: t.id, t: t.t, v: s.fixed }); });
  if(!(ss.narr || []).some(n => !C.isEach(n) && String(n.fixed || '').trim())) P.why.ov = '가져올 글이 없어요'; else if(!CAN.setup) P.why.ov = '평가 틀을 고칠 수 있을 때만 가져와요';
  // 학생별 글
  const np = pair((ss.narr || []).filter(C.isEach), (st.narr || []).filter(C.isEach), true);
  common.forEach(sid => np.forEach(([s, t]) => { const v = String(((rows[sid].n || {})[s.id]) || ''); if(!v.trim()) return; const cur = String((row(sid).n || {})[t.id] || '');
    if(cur === v) return; if(!all && cur.trim()){ P.skip.narr++; return; } P.narr.push({ sid, k: `rows.${sid}.n.${t.id}`, v }); }));
  if(!x.same) P.why.narr = P.why.lv = '같은 학생이 없어요 (다른 반)'; else if(ent.__err) P.why.narr = P.why.lv = '그 칸을 읽지 못했어요 — 다시 골라 주세요'; else if(!common.length) P.why.narr = P.why.lv = '그 칸에 쓴 것이 아직 없어요'; else if(!CAN.edit) P.why.narr = P.why.lv = '지금은 입력할 수 없는 칸이에요';
  if(!P.why.narr && !np.length) P.why.narr = (SUB.type === 'R' || x.type === 'R') ? '암송 · 읽기 칸의 내용은 아직 가져오지 못해요' : '이름이 같은 서술 칸이 없어요';
  // 5단계 평가
  const E = t => t === 'E' || t === 'M'; const ip = (E(SUB.type || 'E') && E(x.type)) ? pair(ss.items || [], st.items || []).filter(([s, t]) => C.normKey(s.t) === C.normKey(t.t)) : [];
  common.forEach(sid => ip.forEach(([s, t]) => { const v = Number((rows[sid].e || {})[s.id]) || 0; if(!v) return; const cur = Number((row(sid).e || {})[t.id]) || 0;
    if(cur === v) return; if(!all && cur){ P.skip.lv++; return; } P.lv.push({ sid, k: `rows.${sid}.e.${t.id}`, v }); }));
  if(!P.why.lv && !ip.length) P.why.lv = '글이 같은 평가 항목이 없어요';
  if(!CAN.edit){ P.narr = []; P.lv = []; }
  if(!CAN.setup) P.ov = [];
  return P;
}
function dwDraw(){
  const el = DW.el; if(!el || !SUB) return;
  const subj = SUB.kind === 'subj';
  const tabs = (subj ? [['mine', '내 다른 반'], ['oth', '다른 선생님'], ['past', '지난 학기']] : []).concat([['ph', '문장 모음']]);
  let h = `<div class="dw-h"><b>🗄 가져오기 서랍</b><small>${esc(A.whereOf(SUB))} · ${esc(A.subLabel(SUB))}에 넣어요</small><span class="nh-sp"></span><button class="nh-btn sm" data-dwx aria-label="서랍 닫기">닫기</button></div>
    <div class="dw-tabs">${tabs.map(([k, l]) => `<button data-dwtab="${k}" class="${DW.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if(DW.tab === 'ph') h += dwPhHTML();
  else if(!DW.src || (DW.tab === 'past' && DW.past < 2)){ h += '<div class="nh-desc">가져올 곳을 찾는 중…</div>'; if(DW.src && DW.tab === 'past') dwPast(); }
  else {
    const x = dwPick();
    h += `<input class="nh-in" data-dwq placeholder="찾기 — 과목 · 반 · 선생님" value="${esc(DW.q)}" style="width:100%">
      ${DW.tab === 'past' && DW.past === 3 ? '<div class="nh-warn">읽지 못한 학기가 있어요.</div>' : ''}<div class="dw-list">${dwListHTML()}</div>`;
    if(x){
      const ent = DW.ent[x.key];
      if(!ent) h += '<div class="nh-desc">그 칸을 읽는 중…</div>';
      else {
        const P = dwPlan(x, ent); const n = k => P[k].length;
        const line = (k, lab, unit) => { const off = !n(k); return `<label class="dw-part${off ? ' off' : ''}"><input type="checkbox" data-dwpart="${k}"${DW.parts[k] && !off && !(k === 'ov' && !CAN.setup) ? ' checked' : ''}${off || (k === 'ov' && !CAN.setup) ? ' disabled' : ''}><b>${lab}</b><span>${off ? esc(P.why[k] || (P.skip[k] ? '이미 채워져 있어요 («있는 것도 바꾸기»로 바꿀 수 있어요)' : '넣을 것이 없어요 (이미 같아요)')) : `${n(k)}${unit}${k !== 'ov' ? ` · 학생 ${new Set(P[k].map(o => o.sid)).size}명` : ''}`}</span></label>`; };
        const pv = n('ov') ? P.ov[0].v : n('narr') ? `${A.stuName(P.narr[0].sid)} — ${P.narr[0].v}` : '';
        const tot = ['ov', 'narr', 'lv'].filter(k => DW.parts[k] && !(k === 'ov' && !CAN.setup)).reduce((a, k) => a + n(k), 0);
        h += `<div class="dw-sec">무엇을 가져올까요</div><div class="dw-parts">${line('ov', '모든 학생 같은 글', '칸')}${line('narr', '학생별 글', '칸')}${line('lv', '5단계 평가', '칸')}</div>
          ${pv ? `<div class="dw-sec">넣기 전에 보기</div><div class="dw-pv">${esc(pv.length > 300 ? pv.slice(0, 300) + ' …' : pv)}</div>` : ''}
          <div class="frow" style="align-items:center;gap:6px;margin-top:10px"><button class="nh-btn sm${DW.mode === 'empty' ? ' p' : ''}" data-dwmode="empty">빈 칸에만</button><button class="nh-btn sm${DW.mode === 'all' ? ' p' : ''}" data-dwmode="all">있는 것도 바꾸기</button><span class="nh-sp"></span><button class="nh-btn p" data-dwgo${tot ? '' : ' disabled'}>${tot ? `${tot}칸 넣기` : '넣을 것이 없어요'}</button></div>
          <div class="nh-desc" style="margin-top:6px">학생별 글 · 평가는 넣은 뒤 «↩ 되돌리기» 한 번이면 취소돼요 («모든 학생 같은 글»은 평가 틀에서 고쳐요) · «📜 고친 기록»에 «가져옴»으로 남아요.${STRUCT() ? ' 평가 항목(틀)은 <a href="#" data-dwframe>평가 틀 가져오기</a>에서.' : ''}</div>`;
      }
    }
  }
  const sc = el.querySelector('.dw-list'); const top = sc ? sc.scrollTop : 0;
  el.innerHTML = h;
  const sc2 = el.querySelector('.dw-list'); if(sc2) sc2.scrollTop = top;
}
function dwListHTML(){
  const L = dwList();
  return (L.slice(0, 60).map(s => `<button class="dw-src${s.key === DW.key ? ' on' : ''}" data-dwsrc="${esc(s.key)}"><b>${esc(s.name)} · ${esc(s.where)}</b><small>${esc(s.cur ? (s.teacher || '선생님 없음') : s.term)}${s.mine && s.cur ? ' (나)' : ''}</small>
    <span>${s.sameName ? '<i class="ch mint">같은 과목</i>' : ''}${s.same ? `<i class="ch type">같은 학생 ${s.same}</i>` : ''}</span></button>`).join('') || '<div class="nh-desc">해당하는 칸이 없어요.</div>') + (L.length > 60 ? '<div class="nh-desc">위에서 찾아 좁혀 주세요.</div>' : '');
}
async function dwLoadEnt(x){
  if(DW.ent[x.key]) return;
  let ent = { rows: {} }, ok = true;
  try{ const d = await FS.getDoc(FS.doc(A.db, 'nhpEntries', x.id)); if(d.exists()) ent = d.data(); }catch(e){ ok = false; ent.__err = true; }
  DW.ent[x.key] = ent; if(DW.el && DW.key === x.key) dwDraw();
  if(!ok) delete DW.ent[x.key];          // 못 읽은 것은 담아 두지 않음 — 다시 고르면 다시 읽음
}
function dwInput(e){
  const t = e.target, d = t.dataset;
  if('dwq' in d){ DW.q = t.value.trim(); const l = DW.el.querySelector('.dw-list'); if(l) l.innerHTML = dwListHTML(); return; }      // 찾기 칸은 그대로 두고 목록만 (한글 입력이 끊기지 않게)
  if('dwpht' in d){ DW.phT = t.value; return; }
  if('dwphgi' in d){ DW.phGi = t.value; return; }
  if(d.dwpart && e.type === 'change'){ DW.parts[d.dwpart] = t.checked; dwDraw(); return; }
  if('dwphq' in d){ DW.phQ = t.value.trim(); const l = DW.el.querySelector('.dw-list.ph'); if(l) l.innerHTML = dwPhListHTML(); return; }
}
async function dwClick(e){
  const t = e.target.closest('[data-dwx],[data-dwtab],[data-dwsrc],[data-dwmode],[data-dwgo],[data-dwframe],[data-dwph],[data-dwphdel],[data-dwphadd],[data-dwsel],[data-dwphg]');
  if(!t) return; const d = t.dataset;
  if('dwframe' in d){ e.preventDefault(); if(STRUCT()) importDialog(); return; }
  if('dwx' in d){ dwClose(); return; }
  if(d.dwtab){ DW.tab = d.dwtab; DW.key = ''; DW.q = ''; dwDraw(); return; }
  if(d.dwsrc){ DW.key = d.dwsrc; dwDraw(); const x = dwPick(); if(x) dwLoadEnt(x); return; }
  if(d.dwmode){ DW.mode = d.dwmode; dwDraw(); return; }
  if('dwgo' in d){ dwApply(); return; }
  if(d.dwph){ dwPhInsert(d.dwph); return; }
  if(d.dwphdel){ dwPhDel(d.dwphdel); return; }
  if('dwphadd' in d){ dwPhAdd(); return; }
  if('dwsel' in d){ dwPhFromSel(); return; }
  if('dwphg' in d){ DW.phG = d.dwphg; dwDraw(); return; }
}
async function dwApply(){
  const x = dwPick(); const ent = x && DW.ent[x.key]; if(!x || !ent || DW.busy) return;
  const P = dwPlan(x, ent); const on = k => DW.parts[k] && P[k].length && !(k === 'ov' && !CAN.setup);
  const n = ['ov', 'narr', 'lv'].filter(on).reduce((a, k) => a + P[k].length, 0); if(!n) return;
  const nOv = on('ov') ? P.ov.length : 0; const shared = nOv && SUB.share ? ' 함께 쓰는 반의 틀에도 들어가요.' : '';
  if(DW.mode === 'all' && !(await A.confirm('있는 것도 바꾸기', `이미 써 둔 글 · 평가도 가져온 것으로 <b>바꿔요</b> (${n}칸). 학생별 글 · 평가는 «↩ 되돌리기»로 취소할 수 있어요.${nOv ? ` «모든 학생 같은 글» ${nOv}칸은 되돌리기가 안 되니 평가 틀에서 다시 고쳐요.${shared}` : ''}`, '바꿔 넣기'))) return;
  if(!SUB || !DW.el || dwPick() !== x) return;
  if(!SUB || !DW.el) return;
  DW.busy = true;
  try{
    if(on('narr') || on('lv')){
      if(!CAN.edit){ DW.busy = false; return A.toast('지금은 입력할 수 없는 칸이에요.', 'err'); }
      tmSnap('bulk', cloneV(ENT.rows || {}));
      const U = UNDO[SUB.id]; if(U && U.length) U[U.length - 1].t = 0;      // 방금 쓰던 글의 되돌리기 묶음에 섞이지 않게 — 가져온 것은 한 묶음으로
      VIA = 'import'; try{ ['narr', 'lv'].filter(on).forEach(k => P[k].forEach(o => putRaw(o.k, o.v))); } finally{ VIA = ''; }
    }
    if(on('ov')){ const N = (SUB.setup.narr || []).map(nn => { const o = P.ov.find(y => y.id === nn.id); return o ? Object.assign({}, nn, { each: false, fixed: o.v }) : nn; }); SUB.setup = Object.assign({}, SUB.setup, { narr: N }); saveSetup(true); }
    // 가져온 글에 다른 학생 이름이 있으면 알림 («🔎 이름 점검»과 같은 기준)
    const bad = on('narr') ? P.narr.filter(o => otherNames(o.sid, o.v).length) : [];
    A.toast(`${n}칸 넣었어요 ✓${n - nOv ? ' 학생별 글 · 평가는 «↩ 되돌리기»로 취소돼요.' : ''}${nOv ? ` «모든 학생 같은 글»은 평가 틀에서 고쳐요.${shared}` : ''}${bad.length ? ` — 다른 학생 이름이 들어간 글 ${bad.length}곳: «🔎 빈 곳 · 이름 점검»에서 확인해 주세요` : ''}`, bad.length ? 'err' : undefined);
  }catch(e){ A.toast('넣지 못했어요 — ' + A.errText(e), 'err'); }
  DW.busy = false; drawBody(); dwDraw();
}
/* ── 문장 모음 (나만 봄) ── */
const dwPhRead = async () => { const d = await FS.getDoc(FS.doc(A.db, 'userMemos', A.CU.uid)); const a = d.exists() ? d.data().nhpPhrases : null; return Array.isArray(a) ? a.filter(p => p && p.id && p.t) : []; };
async function dwPhLoad(){
  try{ DW.ph = await dwPhRead(); DW.phErr = false; }
  catch(e){ DW.ph = null; DW.phErr = true; }          // 못 읽었으면 빈 목록으로 두지 않음 (그 위에 저장하면 담아 둔 문장이 지워지니까)
}
/* 저장 — 방금 저장된 목록을 다시 읽어 그 위에 고친다 (다른 창 · 다른 기기에서 담은 문장을 지우지 않게) */
async function dwPhMut(fn){
  try{ const cur = await dwPhRead(); const next = fn(cur); if(!next) return false;
    await FS.setDoc(FS.doc(A.db, 'userMemos', A.CU.uid), { nhpPhrases: next.slice(0, 300) }, { merge: true }); DW.ph = next.slice(0, 300); DW.phErr = false; return true; }
  catch(e){ A.toast('문장 모음을 저장하지 못했어요 — ' + A.errText(e), 'err'); return false; }
}
function dwPhHTML(){
  if(!DW.ph) return DW.phErr ? '<div class="nh-warn">문장 모음을 읽지 못했어요 — 서랍을 닫았다 다시 열어 주세요.</div>' : '<div class="nh-desc">문장 모음을 여는 중…</div>';
  const gs = [...new Set(DW.ph.map(p => p.g || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  if(DW.phG && !gs.includes(DW.phG)) DW.phG = '';
  return `<div class="nh-desc" style="margin-top:0">자주 쓰는 문장을 담아 두고, 글 칸에 커서를 둔 뒤 문장을 누르면 그 자리에 들어가요. <b>○○</b>은 그 학생 이름으로 바뀌어요. 나만 봐요.</div>
    <div class="dw-add"><textarea class="nh-ta" rows="2" data-dwpht placeholder="담을 문장 (예: ○○이는 문제를 끝까지 읽고 스스로 풀어 보려는 태도가 좋아졌습니다.)">${esc(DW.phT)}</textarea>
      <div class="frow" style="gap:6px;align-items:center"><input class="nh-in" data-dwphgi list="dw-gs" placeholder="묶음 (예: 태도)" value="${esc(DW.phGi)}" style="flex:1;min-width:90px"><datalist id="dw-gs">${gs.map(g => `<option value="${esc(g)}">`).join('')}</datalist><button class="nh-btn sm" data-dwsel title="글 칸에서 끌어서 고른 글을 위 칸으로 가져와요">고른 글 가져오기</button><button class="nh-btn sm p" data-dwphadd>담기</button></div></div>
    ${DW.ph.length ? `<div class="frow" style="gap:6px;align-items:center;margin-top:10px"><input class="nh-in" data-dwphq placeholder="문장 찾기" value="${esc(DW.phQ)}" style="flex:1;min-width:100px">${gs.length ? `<button class="nh-btn xs${DW.phG ? '' : ' p'}" data-dwphg="">모두</button>${gs.map(g => `<button class="nh-btn xs${DW.phG === g ? ' p' : ''}" data-dwphg="${esc(g)}">${esc(g)}</button>`).join('')}` : ''}</div>` : ''}
    <div class="dw-list ph">${dwPhListHTML()}</div>`;
}
function dwPhListHTML(){
  const L = (DW.ph || []).filter(p => (!DW.phG || p.g === DW.phG) && (!DW.phQ || p.t.includes(DW.phQ)));
  return L.map(p => `<div class="dw-ph"><button class="dw-pht" data-dwph="${esc(p.id)}" title="글 칸의 커서 자리에 넣기">${p.g ? `<i class="ch gray">${esc(p.g)}</i> ` : ''}${esc(p.t)}</button><button class="nh-btn xs" data-dwphdel="${esc(p.id)}" aria-label="이 문장 지우기">지우기</button></div>`).join('') || `<div class="nh-desc">${(DW.ph || []).length ? '해당하는 문장이 없어요.' : '아직 담은 문장이 없어요.'}</div>`;
}
/* ○○ → 학생 이름(세 글자 이름은 성을 뺌) · «○○이는/이가…»는 받침 없는 이름이면 «이»를 뺌 (지호이는 → 지호는) */
const dwGiven = sid => { const nm = A.stuName(sid); return nm.length === 3 ? nm.slice(1) : nm; };
function dwFill(t, sid){
  const g = dwGiven(sid); const bat = /[가-힣]$/.test(g) ? hasJong(g.slice(-1)) : true; const E = '(?=[^가-힣]|$)';
  return t.replace(/○○이?(?=(는|가|를|와|의|도|에게|랑|만|한테)([^가-힣]|$))/g, g + (bat ? '이' : ''))      // ○○이는 · ○○는 → 민준이는 · 지호는
    .replace(new RegExp('○○(은|을|과|아)' + E, 'g'), (m, p) => g + (bat ? p : { '은': '는', '을': '를', '과': '와', '아': '야' }[p]))
    .replace(/○○/g, g);
}
const dwTa = () => { const f = DW.focus; return (f && EL && SUB && f.sub === SUB.id) ? EL.querySelector(`textarea[data-nr="${CSS.escape(f.sid)}"][data-ni="${CSS.escape(f.ni)}"]`) : null; };
function dwPhInsert(id){
  const p = (DW.ph || []).find(x => x.id === id); const ta = dwTa();
  if(!p) return;
  if(!ta || ta.readOnly || ta.disabled) return A.toast('넣을 글 칸을 먼저 눌러 커서를 두세요.', 'err');
  const txt = dwFill(p.t, ta.dataset.nr);
  const v = ta.value; const live = document.activeElement === ta; const f = DW.focus;
  const a = Math.min(v.length, live ? ta.selectionStart : (f.a ?? v.length)), b = Math.max(a, Math.min(v.length, live ? ta.selectionEnd : (f.b ?? a)));
  const sp = a > 0 && !/\s$/.test(v.slice(0, a)) ? ' ' : '';
  ta.value = v.slice(0, a) + sp + txt + v.slice(b);
  const at = a + sp.length + txt.length; ta.focus(); try{ ta.setSelectionRange(at, at); }catch(e){}
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}
function dwPhFromSel(){
  const ta = dwTa(); const i = DW.el.querySelector('[data-dwpht]'); if(!i) return;
  const f = DW.focus; const live = ta && document.activeElement === ta;
  const s = ta ? ta.value.slice(live ? ta.selectionStart : (f.a || 0), live ? ta.selectionEnd : (f.b || 0)).trim() : '';
  if(!s) return A.toast('글 칸에서 담을 문장을 끌어서 고른 뒤 눌러 주세요.', 'err');
  const g = dwGiven(ta.dataset.nr);
  // 학생 이름 → ○○ (앞이 한글이 아니고 뒤가 조사이거나 한글이 아닐 때만 — «하나님 · 지혜롭게» 같은 말은 그대로)
  i.value = (g.length >= 2 && /^[가-힣]+$/.test(g)) ? s.replace(new RegExp('(^|[^가-힣])' + g + '(?=이?(는|가|의|를|도|와|랑|에게|한테|만|은|을|과|아|야)([^가-힣]|$)|[^가-힣]|$)', 'g'), '$1○○') : s;
  DW.phT = i.value; i.focus();
}
async function dwPhAdd(){
  const i = DW.el.querySelector('[data-dwpht]'), gi = DW.el.querySelector('[data-dwphgi]'); const t = (i.value || '').trim(); if(!t) return A.toast('담을 문장을 써 주세요.', 'err');
  if(!DW.ph || DW.busy) return;
  const it = { id: C.rid('p'), t: t.slice(0, 600), g: (gi.value || '').trim().slice(0, 20) };
  DW.busy = true;
  const ok = await dwPhMut(cur => { if(cur.some(p => p.t === it.t)){ A.toast('이미 담겨 있는 문장이에요.', 'err'); return null; } if(cur.length >= 300){ A.toast('문장은 300개까지 담을 수 있어요 — 안 쓰는 것을 지워 주세요.', 'err'); return null; } return [it].concat(cur); });
  DW.busy = false;
  if(ok){ DW.phT = ''; A.toast('담았어요 ✓'); }
  if(DW.el) dwDraw();
}
async function dwPhDel(id){
  const p = (DW.ph || []).find(x => x.id === id); if(!p || DW.busy) return;
  if(!(await A.confirm('문장 지우기', `<div class="dw-pv">${esc(p.t)}</div>이 문장을 모음에서 지워요.`, '지우기', true))) return;
  DW.busy = true; await dwPhMut(cur => cur.filter(x => x.id !== id)); DW.busy = false;
  if(DW.el) dwDraw();
}
