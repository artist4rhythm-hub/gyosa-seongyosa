/* ═══════════════════════════════════════════════════════════
   👥 nhp-groups.js — 나학평 조별 칸 (v144 · 학기 설정 › 🧩 칸 › 👥 조별 과목)
   · 반편성 › 조 편성(groupSets)에서 짠 조마다 칸 하나 — 지혜의 계단 · 예배처럼 학년 · 반이 섞인 수업
   · 맡은 선생님 = 조 담당 · 학생 = 조원 (이 학기 나학평 반에 있는 학생만)
   · «조별 과목으로 바꾸기»: 반마다 있던 칸(작성 중인 것만)의 평가 틀 · 학생 입력을 조 칸으로 옮기고, 반마다 칸은 «빠진 칸»으로 보관
   · «조 편성에서 다시 맞추기»: 조원 · 담당이 바뀌면 칸도 따라감 (다른 조로 옮긴 학생의 입력은 학생을 따라감)
   · 검토 순서: 담임 검토 단계는 건너뛰고 검토관 → 최종 승인 (검토 순서 › «반마다 다른 분»의 «👥 조별 칸»으로 따로 정할 수 있음)
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null;
const bind0 = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

const termStudents = () => { const s = new Set(); ((A.TERM && A.TERM.sections) || []).forEach(x => (x.students || []).forEach(id => s.add(id))); return s; };
const secOfStudent = sid => ((A.TERM && A.TERM.sections) || []).find(x => (x.students || []).includes(sid)) || null;
export const grpCells = () => A.SUBS.filter(s => s.grp && !s.removed);
function finalize(cell){
  const r = C.rvForSub(A.TERM, C.GRP_SEC, cell);
  const d = Object.assign({ state: 'draft', stage: 0, log: [], removed: false, printName: '', printTeacher: '' }, cell, { rv: r.rv, rvL: r.rvL, finL: r.finL });
  d.turn = C.turnOf(d);
  d.cnt = { done: 0, total: (cell.studentIds || []).length };
  return d;
}
async function commit(ops){
  for(let i = 0; i < ops.length; i += 400){
    const bt = FS.writeBatch(A.db);
    ops.slice(i, i + 400).forEach(o => { if(o.del) bt.delete(o.ref); else if(o.upd) bt.update(o.ref, o.data); else if(o.merge) bt.set(o.ref, o.data, { merge: true }); else bt.set(o.ref, o.data); });
    await bt.commit();
  }
}

/* ── 학기 설정 › 칸 안의 묶음 ── */
export function paneHTML(a){
  bind0(a);
  const cells = grpCells();
  const sets = A.GSETS || [];
  const by = {};
  cells.forEach(s => { const k = `${s.grp.set}|${C.normKey(s.name)}`; (by[k] = by[k] || { set: s.grp.set, setName: s.grp.setName, name: s.name, cells: [] }).cells.push(s); });
  const rows = Object.values(by);
  const setOf = id => sets.find(x => x.id === id);
  let h = `<div class="nh-sec" style="margin-top:18px">👥 <b>조별 과목</b> <small>학년 · 반이 섞인 수업 — 반편성 › 조 편성의 조마다 칸 하나 (맡은 선생님 = 조 담당)</small><span class="nh-sp"></span>
      <button class="nh-btn xs g" data-gp="make">＋ 조별 과목으로 만들기</button>${rows.length ? '<button class="nh-btn xs" data-gp="sync">🔄 조 편성에서 다시 맞추기</button>' : ''}<a class="nh-btn xs ghost" href="class.html#groups" target="_blank" rel="noopener">반편성 › 조 편성 열기 ↗</a></div>`;
  if(!sets.length) h += `<div class="nh-desc">이 학기(${esc(C.termLabel(A.TERM))}) 조 편성이 아직 없어요 — 반편성 › 👥 조 편성에서 «지혜의 계단 조»를 먼저 만들어 주세요.</div>`;
  if(!rows.length) return h + (sets.length ? `<div class="nh-desc">아직 조별 과목이 없어요. «＋ 조별 과목으로 만들기»로 «지혜의 계단» · «예배»를 조마다 칸으로 바꿀 수 있어요 (반마다 칸에 이미 쓴 내용은 학생을 따라 옮겨져요).</div>` : '');
  h += rows.map(r => {
    const st = setOf(r.set);
    const diff = st ? syncPlan(r, st) : null;
    return `<div class="stg" style="margin-top:6px"><div class="h"><b style="font-size:13.5px">${esc(r.name)}</b><span class="ch gray">${esc(r.setName || (st && st.name) || '조 편성')}</span>
        ${!st ? '<span class="ch red">조 편성이 지워졌어요</span>' : diff && diff.n ? `<span class="ch warn" title="조 편성이 바뀌었어요">맞출 것 ${diff.n}</span>` : '<span class="ch ok">조 편성과 같음</span>'}</div>
      <div class="pk">${r.cells.sort((a, b) => String(a.grp.name).localeCompare(String(b.grp.name), 'ko', { numeric: true })).map(s => `<span class="p" style="padding-right:11px"><b style="cursor:pointer" data-open="${esc(s.id)}">${esc(s.grp.name)}</b> <small style="color:var(--ink-3)">${(s.studentIds || []).length}명 · ${esc((s.teacherUids || []).map(A.staffName).filter(Boolean).join(', ') || '담당 없음')}</small> ${A.stateChip(s)}</span>`).join('')}</div></div>`;
  }).join('');
  return h;
}
export function bindPane(a, el, rerender){
  bind0(a);
  el.querySelectorAll('[data-gp]').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    if(b.dataset.gp === 'make') await makeDialog(rerender);
    if(b.dataset.gp === 'sync') await syncAll(rerender);
  });
}

/* 학생 입력 읽기 — 못 읽으면 던짐 (빈 입력으로 잘못 알고 옮기거나 칸을 보관하지 않게) */
async function readEnt(id){ const snap = await FS.getDoc(FS.doc(A.db, 'nhpEntries', id)); return { exists: snap.exists(), rows: (snap.exists() && snap.data().rows) || {} }; }
/* 반마다 칸을 듣는데 이 편성의 어느 조에도 없는 학생 */
function orphansOf(cells, set){
  const inG = new Set(); (set.groups || []).forEach(g => (g.members || []).forEach(x => inG.add(x)));
  const out = new Set(); cells.forEach(s => A.subStudents(s).forEach(sid => { if(!inG.has(sid)) out.add(sid); }));
  return [...out];
}
const eqSet = (a, b) => JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort());

/* ═══ ＋ 조별 과목으로 만들기 ═══ */
async function makeDialog(rerender){
  await A.loadGroupSets();
  const sets = A.GSETS || [];
  if(!sets.length){ A.toast('이 학기 조 편성이 없어요 — 반편성 › 👥 조 편성에서 먼저 만들어 주세요.', 'err'); return; }
  const subj = A.SUBS.filter(s => s.kind === 'subj' && !s.removed && !s.grp);
  const names = {}; subj.forEach(s => { const k = C.normKey(s.name); (names[k] = names[k] || { name: s.name, cells: [] }).cells.push(s); });
  const opts = Object.values(names).sort((a, b) => b.cells.length - a.cells.length || a.name.localeCompare(b.name, 'ko'));
  const guess = opts.find(o => /지혜/.test(o.name)) || opts[0];
  const m = A.modal('👥 조별 과목으로 만들기', `<div class="nh-desc">반편성 › 조 편성의 <b>조마다 칸 하나</b>를 만들어요. 맡은 선생님 = 조 담당 · 학생 = 조원(이 학기 나학평 반에 있는 학생만).</div>
    <div class="frow"><div class="fl"><label>조 편성</label><select class="nh-sel" data-k="set">${sets.map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${(x.groups || []).length}조</option>`).join('')}</select></div>
      <div class="fl"><label>과목</label><select class="nh-sel" data-k="name">${opts.map(o => `<option value="${esc(o.name)}"${o === guess ? ' selected' : ''}>${esc(o.name)} · 반마다 칸 ${o.cells.length}개</option>`).join('')}<option value="__new">— 새 과목 (반마다 칸 없음) —</option></select></div>
      <div class="fl" data-newname style="display:none"><label>새 과목 이름</label><input class="nh-in" data-k="newname" placeholder="예: 예배"></div></div>
    <div data-pv></div>`, '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>만들기</button>', 'mid');
  const pv = m.box.querySelector('[data-pv]');
  const cur = () => { const nm = m.box.querySelector('[data-k="name"]').value; const set = sets.find(x => x.id === m.box.querySelector('[data-k="set"]').value); return { nm, set, src: nm === '__new' ? null : names[C.normKey(nm)] }; };
  const draw = async () => {
    const { nm, set, src } = cur();
    m.box.querySelector('[data-newname]').style.display = nm === '__new' ? '' : 'none';
    const TS = termStudents();
    const nIn = (set.groups || []).reduce((n, g) => n + (g.members || []).filter(x => TS.has(x)).length, 0);
    const already = grpCells().some(s => s.grp.set === set.id && C.normKey(s.name) === C.normKey(nm === '__new' ? '' : nm));
    if(!src){ pv.innerHTML = `<div class="nh-info">${(set.groups || []).length}조 · 조원 ${nIn}명 — 빈 평가 틀로 만들어요.</div>`; return; }
    const ents = {}; await Promise.all(src.cells.map(async s => { const e = await A.getEntry(s.id, true); ents[s.id] = Object.keys((e && e.rows) || {}).length; }));
    const busy = src.cells.filter(s => s.state !== 'draft');
    const orph = orphansOf(src.cells, set);
    const base = src.cells.slice().sort((a, b) => (((b.setup || {}).items || []).length - ((a.setup || {}).items || []).length))[0];
    pv.innerHTML = `${already ? '<div class="nh-warn">이 편성으로 만든 같은 과목 조별 칸이 이미 있어요 — «🔄 다시 맞추기»를 쓰세요.</div>' : ''}
      <div class="nh-desc"><b>반마다 칸 ${src.cells.length}개 → 조 칸 ${(set.groups || []).length}개</b> (조원 ${nIn}명)</div>
      <div class="tlist">${src.cells.map(s => `<div class="tl-row"><span>✓</span><div><b>${esc(C.secLabel(A.secOf(s.secId)))}</b> ${A.stateChip(s)} <small style="color:var(--ink-3)">입력 ${ents[s.id]}명 · 항목 ${((s.setup || {}).items || []).length}개</small></div><span></span></div>`).join('')}</div>
      <div class="fl" style="margin-top:8px"><label>조 칸의 평가 틀 (어느 반 것을 쓸까요)</label><select class="nh-sel" data-k="base">${src.cells.map(s => `<option value="${esc(s.id)}"${s === base ? ' selected' : ''}>${esc(C.secLabel(A.secOf(s.secId)))} · ${esc((C.TYPES[s.type] || C.TYPES.E).short)} · 항목 ${((s.setup || {}).items || []).length}개</option>`).join('')}</select></div>
      ${busy.length ? `<div class="nh-info">검토 중 · 승인된 칸 ${busy.length}개(${busy.map(s => esc(C.secLabel(A.secOf(s.secId)))).join(', ')})의 입력도 함께 옮겨요 — 조 칸은 «작성 중»부터 조 담당이 다시 올리고 검토해요. (이미 확정한 원본은 그대로)</div>` : ''}
      ${orph.length ? `<div class="nh-warn">이 편성의 어느 조에도 없는 학생 ${orph.length}명 — ${orph.slice(0, 12).map(x => esc(A.stuName(x))).join(', ')}${orph.length > 12 ? ' …' : ''}<br>만들면 이 학생들은 «${esc(src.name)}»이(가) 나학평에서 빠져요 (쓴 내용은 보관된 반마다 칸에 남음). 먼저 반편성 › 조 편성에서 조에 넣어 주세요.</div>` : ''}
      <div class="nh-info">반마다 칸은 «빠진 칸»으로 <b>보관</b>돼요 (지우지 않음). 이미 쓴 5단계 · 서술 · 점수는 <b>같은 글의 항목끼리</b> 학생을 따라 조 칸으로 옮겨져요.</div>`;
  };
  m.box.querySelectorAll('[data-k="set"],[data-k="name"]').forEach(x => x.onchange = draw);
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const { nm, set, src } = cur();
    const name = nm === '__new' ? m.box.querySelector('[data-k="newname"]').value.trim() : nm;
    if(!name) return A.toast('과목 이름을 넣어 주세요.', 'err');
    if(grpCells().some(s => s.grp.set === set.id && C.normKey(s.name) === C.normKey(name))) return A.toast('이미 있어요 — «🔄 다시 맞추기»를 쓰세요.', 'err');
    const baseId = (m.box.querySelector('[data-k="base"]') || {}).value;
    const orph = src ? orphansOf(src.cells, set) : [];
    m.close();
    if(orph.length && !(await A.confirm('조에 없는 학생', `이 편성의 어느 조에도 없는 학생 ${orph.length}명은 «${esc(name)}»이(가) 나학평에서 빠져요.<br>그래도 만들까요? (먼저 조에 넣으려면 «취소»)`, '그래도 만들기', true))) return;
    await makeGroupSubject(set, name, src ? src.cells : [], baseId);
    rerender();
  };
  draw();
}
/* 반마다 칸(작성 중 · 검토 중 · 승인 모두) → 조마다 칸
   · 보안 규칙상 학생 입력 문서는 «칸이 이미 있어야» 쓸 수 있어서 ① 입력 읽기 ② 조 칸 만들기 ③ 입력 옮기기 ④ 반마다 칸 보관 순서로
   · ②~④ 중 하나라도 안 되면 만든 조 칸 · 입력을 지워 처음으로 되돌림 (반마다 칸은 그대로 — 다시 하면 됨) */
export async function makeGroupSubject(set, name, srcCells, baseId, a){
  if(a) bind0(a);
  const TS = termStudents();
  const src = (srcCells || []).filter(s => !s.removed);
  const base = src.find(s => s.id === baseId) || src[0] || null;
  const type = base ? (base.type || 'E') : 'E';
  const setup = base ? JSON.parse(JSON.stringify(base.setup || {})) : C.emptySetup('E');
  const order = src.length ? Math.min(...src.map(s => s.order || 100)) : 150;
  window.showLoading && showLoading('조 칸을 만드는 중…');
  const made = [], madeEnt = [];
  try{
    // ① 반마다 칸의 학생 입력 (못 읽으면 아무것도 바꾸지 않음)
    const ent = {}; for(const s of src) ent[s.id] = (await readEnt(s.id)).rows;
    // ② 조 칸
    const plan = [], ops1 = [];
    (set.groups || []).forEach(g => {
      const ids = (g.members || []).filter(x => TS.has(x));
      const ref = FS.doc(FS.collection(A.db, 'nhpSubjects'));
      const cell = finalize({ kind: 'subj', name, order, type, setup: JSON.parse(JSON.stringify(setup)), teacherUids: (g.teachers || []).slice(), lessonIds: base ? (base.lessonIds || []) : [],
        printName: base ? (base.printName || '') : '', secId: '__grp', termId: A.TERM.id, org: C.ORG, studentIds: ids,
        grp: { set: set.id, gid: g.id, name: g.name || '', setName: set.name || '' }, inheritedFrom: base ? (base.inheritedFrom || '') : '' });
      ops1.push({ ref, data: Object.assign(cell, { createdAt: FS.serverTimestamp(), updatedBy: A.CU.uid }) });
      plan.push({ ref, ids });
    });
    await commit(ops1); plan.forEach(x => made.push(x.ref.id));
    // ③ 학생 입력 옮기기 (같은 글의 항목 · 서술 · 점수 칸끼리)
    let moved = 0; const ops2 = [];
    plan.forEach(({ ref, ids }) => {
      const rows = {};
      ids.forEach(sid => {
        const from = src.find(s => A.subStudents(s).includes(sid));
        const r = from && (ent[from.id] || {})[sid];
        if(!r) return;
        const mr = C.mapRow(r, from.setup, setup); if(mr && Object.keys(mr).length){ rows[sid] = mr; moved++; }
      });
      if(Object.keys(rows).length) ops2.push({ ref: FS.doc(A.db, 'nhpEntries', ref.id), data: { termId: A.TERM.id, subjectId: ref.id, secId: '__grp', kind: 'subj', rows, createdAt: FS.serverTimestamp(), updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid } });
    });
    await commit(ops2); ops2.forEach(o => madeEnt.push(o.ref.id));
    // ④ 반마다 칸 보관 (승인된 칸은 규칙상 «빠진 칸» 표시만 바꿀 수 있음)
    await commit(src.map(s => ({ ref: FS.doc(A.db, 'nhpSubjects', s.id), upd: 1, data: s.state === 'done'
      ? { removed: true, turn: [], updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }
      : { removed: true, turn: [], grpTo: set.id, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid } })));
    A.toast(`«${name}» 조 칸 ${(set.groups || []).length}개를 만들었어요 ✓${moved ? ` (학생 ${moved}명 입력을 옮김)` : ''}`);
  }catch(e){
    console.error(e);
    let undone = false;
    if(made.length){ try{ await commit(madeEnt.map(id => ({ del: 1, ref: FS.doc(A.db, 'nhpEntries', id) })).concat(made.map(id => ({ del: 1, ref: FS.doc(A.db, 'nhpSubjects', id) })))); undone = true; }catch(e2){ console.error(e2); } }
    A.toast('만들지 못했어요 — ' + A.errText(e) + (made.length ? (undone ? ' (만들던 조 칸은 지워서 처음으로 되돌렸어요 — 다시 해 보세요)' : ' (만들던 조 칸이 남았을 수 있어요 — 칸 목록을 확인해 주세요)') : ''), 'err');
  }
  window.hideLoading && hideLoading();
}

/* ═══ 🔄 조 편성에서 다시 맞추기 ═══
   · 학생마다 «가야 할 조»의 칸으로 · 다른 칸에 있던 입력은 학생을 따라감 (새로 생긴 조 · 1학기 편성 가져오기로 조 id 가 바뀐 경우도)
   · 승인되어 잠긴 칸: 조원을 바꿀 수 없음 → 그 칸에 든 학생은 그대로, 그 칸으로 가야 할 학생은 지금 칸에 그대로
     (어느 쪽이든 학생이 두 칸에 들거나 빠지지 않게 · 잠긴 칸을 «다시 열기» 한 뒤 다시 맞추면 따라감) */
function syncPlan(r, set){
  const TS = termStudents();
  const cells = r.cells;
  const groups = set.groups || [];
  const lk = c => !!c && c.state === 'done';
  const cellOfG = {}; groups.forEach(g => { const c = cells.find(x => x.grp.gid === g.id); if(c) cellOfG[g.id] = c; });
  const keyOfG = g => cellOfG[g.id] ? cellOfG[g.id].id : 'new:' + g.id;
  // 학생마다 가야 할 조 (두 조에 있으면 앞 조)
  const tg = {}; groups.forEach(g => (g.members || []).forEach(sid => { if(TS.has(sid) && !(sid in tg)) tg[sid] = g.id; }));
  const want = new Map();
  groups.forEach(g => want.set(keyOfG(g), new Set()));
  cells.forEach(c => { if(!want.has(c.id)) want.set(c.id, new Set()); });
  cells.filter(lk).forEach(c => (c.studentIds || []).forEach(sid => want.get(c.id).add(sid)));
  const inLocked = new Set(cells.filter(lk).flatMap(c => c.studentIds || []));
  const held = [];
  Object.keys(tg).forEach(sid => {
    const T = cellOfG[tg[sid]];
    if(inLocked.has(sid)){ if(!T || !(T.studentIds || []).includes(sid)) held.push(sid); return; }
    if(lk(T)){ cells.filter(c => !lk(c) && (c.studentIds || []).includes(sid)).forEach(c => want.get(c.id).add(sid)); held.push(sid); return; }
    want.get(keyOfG(groups.find(g => g.id === tg[sid]))).add(sid);
  });
  const out = { n: 0, upd: [], add: [], gone: [], keep: [], moves: [], held, locked: cells.filter(lk) };
  groups.forEach(g => {
    const c = cellOfG[g.id]; const ids = [...want.get(keyOfG(g))];
    if(!c){ out.add.push({ g, ids }); return; }
    if(lk(c)) return;
    if(!(eqSet(ids, c.studentIds) && eqSet(g.teachers, c.teacherUids) && (g.name || '') === (c.grp.name || ''))) out.upd.push({ c, g, ids });
  });
  cells.forEach(c => {
    if(lk(c) || groups.some(g => g.id === c.grp.gid)) return;
    const ids = [...want.get(c.id)];
    if(!ids.length) out.gone.push(c); else if(!eqSet(ids, c.studentIds)) out.keep.push({ c, ids });
  });
  // 입력이 학생을 따라감 — 지금 든 (잠기지 않은) 칸 → 맞춘 뒤 칸
  const finalOf = sid => { for(const [k, st] of want){ if(!st.has(sid)) continue; const c = cells.find(x => x.id === k); if(!lk(c)) return k; } return null; };
  cells.filter(c => !lk(c)).forEach(S => (S.studentIds || []).forEach(sid => { const T = finalOf(sid); if(T && T !== S.id) out.moves.push({ sid, from: S, to: T }); }));
  out.n = out.upd.length + out.add.length + out.gone.length + out.keep.length + out.moves.filter(mo => !out.upd.some(u => u.c.id === mo.to) && !String(mo.to).startsWith('new:')).length;
  return out;
}
async function syncAll(rerender){
  await A.loadGroupSets();
  const cells = grpCells();
  const by = {};
  cells.forEach(s => { const k = `${s.grp.set}|${C.normKey(s.name)}`; (by[k] = by[k] || { set: s.grp.set, name: s.name, cells: [] }).cells.push(s); });
  const plans = Object.values(by).map(r => ({ r, set: (A.GSETS || []).find(x => x.id === r.set) })).filter(x => x.set).map(x => Object.assign(x, { p: syncPlan(x.r, x.set) })).filter(x => x.p.n);
  if(!plans.length){ A.toast('조 편성과 같아요 — 바꿀 것이 없어요.'); return; }
  const held = plans.reduce((n, x) => n + x.p.held.length, 0);
  const ok = await A.confirm('🔄 조 편성에서 다시 맞추기', plans.map(x => `<b>${esc(x.r.name)}</b> (${esc(x.set.name)}) — ${[x.p.upd.length ? `조원 · 담당 바뀐 조 ${x.p.upd.length}` : '', x.p.add.length ? `새 조 ${x.p.add.length}` : '', x.p.gone.length ? `없어진 조 ${x.p.gone.length}` : '', x.p.moves.length ? `다른 조로 옮긴 학생 ${new Set(x.p.moves.map(mo => mo.sid)).size}명 (입력도 따라감)` : ''].filter(Boolean).join(' · ')}`).join('<br>')
    + (held ? `<br><br><span style="color:var(--danger)">승인되어 잠긴 칸 때문에 학생 ${held}명은 지금 칸에 그대로 둬요 — 그 칸을 «다시 열기» 한 뒤 «다시 맞추기»를 한 번 더 하면 따라가요.</span>` : ''), '맞추기');
  if(!ok) return;
  window.showLoading && showLoading('맞추는 중…');
  let n = 0;
  try{
    for(const x of plans){
      const P = x.p; const base = x.r.cells[0];
      // ① 입력 읽기 (못 읽으면 여기서 멈춤 — 아무것도 안 바뀜)
      const E = {};
      for(const id of new Set(P.moves.flatMap(mo => [mo.from.id].concat(String(mo.to).startsWith('new:') ? [] : [mo.to])))) E[id] = await readEnt(id);
      // ② 새 조 칸 (입력 문서보다 먼저 — 보안 규칙)
      const newId = {}, ops1 = [];
      P.add.forEach(({ g, ids }) => {
        const ref = FS.doc(FS.collection(A.db, 'nhpSubjects')); newId['new:' + g.id] = ref.id;
        ops1.push({ ref, data: Object.assign(finalize({ kind: 'subj', name: x.r.name, order: base.order || 150, type: base.type || 'E', setup: JSON.parse(JSON.stringify(base.setup || {})), teacherUids: (g.teachers || []).slice(),
          lessonIds: base.lessonIds || [], printName: base.printName || '', secId: '__grp', termId: A.TERM.id, org: C.ORG, studentIds: ids,
          grp: { set: x.set.id, gid: g.id, name: g.name || '', setName: x.set.name || '' } }), { createdAt: FS.serverTimestamp(), updatedBy: A.CU.uid }) });
        n++;
      });
      if(ops1.length) await commit(ops1);
      // ③ 옮긴 학생 입력 — 지금 든 칸의 것이 가장 새것 → 새 칸의 그 학생 줄을 바꿔 씀 (예전 칸 줄은 지우지 않음)
      const put = {};
      P.moves.forEach(mo => {
        const r = ((E[mo.from.id] || {}).rows || {})[mo.sid]; if(!r) return;
        const toId = newId[mo.to] || mo.to;
        const toSetup = newId[mo.to] ? (base.setup || {}) : ((x.r.cells.find(c => c.id === mo.to) || {}).setup || {});
        const mr = C.mapRow(r, mo.from.setup, toSetup); if(mr) (put[toId] = put[toId] || {})[mo.sid] = mr;
      });
      const ops2 = [];
      Object.keys(put).forEach(id => {
        const ref = FS.doc(A.db, 'nhpEntries', id);
        if(E[id] && E[id].exists){ const d = { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }; Object.keys(put[id]).forEach(sid => { d[`rows.${sid}`] = put[id][sid]; }); ops2.push({ ref, upd: 1, data: d }); }
        else ops2.push({ ref, merge: 1, data: { termId: A.TERM.id, subjectId: id, secId: '__grp', kind: 'subj', rows: put[id], updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid } });
      });
      if(ops2.length) await commit(ops2);
      // ④ 조원 · 담당 · 없어진 조
      const ops3 = [];
      const memb = (c, ids, extra) => { const nd = Object.assign({}, c, { studentIds: ids }, extra || {}); const rv = C.rvForSub(A.TERM, C.GRP_SEC, nd);
        return Object.assign({ studentIds: ids, rv: rv.rv, rvL: rv.rvL, finL: rv.finL, turn: C.turnOf(Object.assign(nd, { rv: rv.rv })), cnt: { done: Math.min((c.cnt || {}).done || 0, ids.length), total: ids.length }, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }, extra || {}); };
      P.upd.forEach(u => { ops3.push({ ref: FS.doc(A.db, 'nhpSubjects', u.c.id), upd: 1, data: memb(u.c, u.ids, { teacherUids: (u.g.teachers || []).slice(), grp: Object.assign({}, u.c.grp, { name: u.g.name || '', setName: x.set.name || '' }) }) }); n++; });
      P.keep.forEach(k => { ops3.push({ ref: FS.doc(A.db, 'nhpSubjects', k.c.id), upd: 1, data: memb(k.c, k.ids) }); n++; });
      P.gone.forEach(c => { ops3.push({ ref: FS.doc(A.db, 'nhpSubjects', c.id), upd: 1, data: { removed: true, turn: [], updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid } }); n++; });
      if(ops3.length) await commit(ops3);
    }
    A.toast(`맞췄어요 ✓ (칸 ${n}개)`);
  }catch(e){ A.toast('일부를 맞추지 못했어요 — ' + A.errText(e) + ' · 다시 «🔄 다시 맞추기»를 누르면 남은 것을 이어서 맞춰요', 'err'); console.error(e); }
  window.hideLoading && hideLoading();
  rerender();
}
