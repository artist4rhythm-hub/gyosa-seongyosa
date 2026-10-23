/* ═══════════════════════════════════════════════════════════
   ⚙️ nhp-setup.js — 나학평 학기 열기 · 학기 설정 (나학평 담당만) · v141
   · 학기 열기: 반편성 → 반(반 × 학년) · 시간표 «수업 정의» → 과목 칸 · 지난 학기에서 평가 틀 이어받기 · 검토 순서
   · 학기 설정: 학기 정보 · 반과 담임 · 칸(과목 · 출결 · 담임평가 …) · 검토 순서와 검토관 · 담임평가 · 공통 목록 · 영문 · 용어 · 지난 나학평 가져오기
   ═══════════════════════════════════════════════════════════ */
import * as IMP from './nhp-import.js?v=142';
import * as GRP from './nhp-groups.js?v=144';

let A = null, C = null, esc = null, FS = null;
const bind = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

/* ── 사람 고르기 ── */
// 🔐 v143 다니엘 아마츠에 접근하지 않는 분(열어 준 지혜빛 선생님) — 이름 옆에 «지혜빛»
const otherOrg = s => s && s.role !== 'super' && !((Array.isArray(s.orgs) && s.orgs.length) ? s.orgs : [s.org]).includes(C.ORG);
export function pickPeople(a, title, selected, opt){
  bind(a); opt = opt || {};
  return new Promise(res => {
    const sel = new Set(selected || []);
    // 🔐 v143 나학평을 열 수 있는 분만 · 이미 고른 분 중 나학평이 닫힌 분은 ⚠ 로 보여 빼기 쉽게
    const list = A.staffPick().concat((selected || []).filter(u => A.SMAP[u] && !A.nhpOk(u)).map(u => A.SMAP[u]));
    const m = A.modal(esc(title), `<input class="nh-in" data-q placeholder="이름 찾기" style="width:100%;margin-bottom:10px">
      ${opt.help ? `<div class="nh-desc">${opt.help}</div>` : ''}
      <div class="nh-desc" style="margin-top:-2px">나학평을 열 수 있는 선생님만 나와요. 다른 분이 필요하면 수퍼관리자가 <b>관리자 › 접근 권한 › 🗂 화면별 › 나학평</b>에서 열어 주세요.</div>
      <div data-list style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px 12px;max-height:52vh;overflow:auto"></div>`,
      `<span class="nh-desc" data-n style="margin:0 auto 0 0"></span><button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>고르기</button>`, 'mid');
    const box = m.box.querySelector('[data-list]');
    const draw = () => {
      const q = m.box.querySelector('[data-q]').value.trim();
      box.innerHTML = list.filter(s => !q || String(s.name || '').includes(q)).map(s => { const off = !A.nhpOk(s.uid);
        return `<label class="ck"${off ? ' title="나학평이 닫힌 분이에요 — 이 칸을 볼 수 없어요"' : ''}><input type="checkbox" value="${esc(s.uid)}"${sel.has(s.uid) ? ' checked' : ''}>${off ? '⚠ ' : ''}${esc(s.name || '')}<small style="color:var(--ink-3)">${s.role === 'partner' ? '협력' : ''}${s.position ? ' ' + esc(s.position) : ''}${otherOrg(s) ? ' 지혜빛' : ''}${off ? ' 나학평 닫힘' : ''}</small></label>`; }).join('');
      m.box.querySelector('[data-n]').textContent = `${sel.size}명 고름`;
    };
    box.addEventListener('change', e => { const v = e.target.value; if(e.target.checked){ if(opt.single) sel.clear(); sel.add(v); } else sel.delete(v); if(opt.single) draw(); else m.box.querySelector('[data-n]').textContent = `${sel.size}명 고름`; });
    m.box.querySelector('[data-q]').addEventListener('input', draw);
    let done = false;
    m.onClose = () => { if(!done) res(null); };
    m.box.querySelector('[data-c]').onclick = () => m.close();
    m.box.querySelector('[data-ok]').onclick = () => { done = true; m.close(); res(Array.from(sel)); };
    draw();
  });
}
const names = uids => (uids || []).map(u => A.staffName(u)).filter(Boolean);
/* 담임 고르기 — 나학평이 열린 분만 · 지금 담임이 닫힌 분이면 ⚠ 로 남겨 보임 (학기 열기 · 학기 설정 같은 모양) */
const hrOpts = cur => `<option value="">— 없음 —</option>` + A.staffPick().concat(cur && A.SMAP[cur] && !A.nhpOk(cur) ? [A.SMAP[cur]] : []).map(s => `<option value="${esc(s.uid)}"${s.uid === cur ? ' selected' : ''}>${A.nhpOk(s.uid) ? '' : '⚠ '}${esc(s.name)}${A.nhpOk(s.uid) ? '' : ' (나학평 닫힘)'}${otherOrg(s) ? ' · 지혜빛' : ''}</option>`).join('');
const peopleChips = (uids, key) => `<span class="pk">${(uids || []).map(u => { const off = !A.nhpOk(u);
  return `<span class="p${off ? ' off' : ''}"${off ? ' title="나학평이 닫힌 분이에요 — 관리자 › 접근 권한에서 열어 주거나 다른 분으로 바꿔 주세요"' : ''}>${off ? '⚠ ' : ''}${esc(A.staffName(u) || '(퇴직?)')}${key ? `<button data-rmp="${esc(key)}" data-uid="${esc(u)}" title="빼기">✕</button>` : ''}</span>`; }).join('') || '<span class="nh-desc" style="margin:0">없음</span>'}</span>`;
/* 🔐 v143 나학평이 닫힌 분이 맡은 자리 (칸 · 담임 · 검토관 · 목록 담당) — 학기 설정 맨 위에 알림 */
function closedSeats(t){
  const seat = new Map();
  const add = (u, what) => { if(!u || A.nhpOk(u)) return; if(!seat.has(u)) seat.set(u, new Set()); seat.get(u).add(what); };
  (t.sections || []).forEach(sec => add(sec.hrUid, '담임'));
  A.SUBS.filter(s => !s.removed).forEach(s => {
    (s.teacherUids || []).forEach(u => add(u, '맡은 칸'));
    Object.values(s.rv || {}).forEach(l => (l || []).forEach(u => add(u, '검토관')));
  });
  (t.listEditors || []).forEach(u => add(u, '목록 담당'));
  return [...seat.entries()].map(([u, w]) => `${esc(A.staffName(u) || '(퇴직?)')} <small>(${[...w].join(' · ')})</small>`);
}

/* ── 칸 기본 모양 ── */
function specialCell(kind, sec, termId, hrItems){
  const K = C.KINDS[kind];
  const setup = kind === 'hr' ? { label: '담임 평가', narr: (hrItems && hrItems.length ? hrItems : [{ id: C.rid('n'), t: '품성 및 학교생활' }]).map(x => ({ id: x.id || C.rid('n'), t: x.t, each: true, fixed: '' })) }
    : kind === 'parent' ? { pick: [], note: '' } : kind === 'book' ? { books: [] } : (kind === 'vision' || kind === 'camp') ? { pick: '', narr: [{ id: C.rid('n'), t: '교사 서술 평가', each: true, fixed: '' }] } : {};
  return { kind, name: kind === 'book' ? '도서' : kind === 'serve' ? '교내 봉사 · 수상' : K.ko.split(' (')[0], order: K.order, type: '', setup,
    teacherUids: [sec.hrUid].filter(Boolean), secId: sec.id, termId, org: C.ORG, studentIds: [] };
}
function finalizeCell(cell, term, sec){
  const r = C.rvForSub(term, sec, cell);
  const d = Object.assign({ state: 'draft', stage: 0, log: [], removed: false, printName: '', printTeacher: '' }, cell, { rv: r.rv, rvL: r.rvL, finL: r.finL });
  d.turn = C.turnOf(d);
  d.cnt = { done: 0, total: (cell.studentIds && cell.studentIds.length) ? cell.studentIds.length : (sec.students || []).length };
  return d;
}
async function commitMany(ops, onStep){
  mine();
  for(let i = 0; i < ops.length; i += 400){
    const bt = FS.writeBatch(A.db);
    ops.slice(i, i + 400).forEach(o => { if(o.del) bt.delete(o.ref); else if(o.upd) bt.update(o.ref, o.data); else bt.set(o.ref, o.data); });
    await bt.commit();
    if(onStep) onStep(Math.min(ops.length, i + 400), ops.length);
  }
}
/* 지난 학기 평가 틀 — 나학평에서 연 학기는 칸 · 옮겨 온 학기는 목록(nhpLists.setups) */
async function prevSetups(termId){
  const t = A.TERMS.find(x => x.id === termId);
  if(!t) return [];
  if(t.src === 'import'){
    try{ const d = await FS.getDoc(FS.doc(A.db, 'nhpLists', termId)); return d.exists() ? (d.data().setups || []) : []; }catch(e){ return []; }
  }
  const snap = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpSubjects'), FS.where('termId', '==', termId)));
  const secs = t.sections || [];
  const out = [];
  snap.forEach(d => { const s = d.data(); if(s.kind !== 'subj' || s.removed) return; const sec = secs.find(x => x.id === s.secId); out.push({ kind: 'subj', name: s.name, gradeNo: sec ? sec.gradeNo : 0, type: s.type, setup: s.setup || {}, printName: s.printName || '' }); });
  return out;
}

/* ═══════════ 학기 열기 (마법사) ═══════════ */
export async function openWizard(a){
  bind(a);
  const now = new Date();
  const sy = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
  const st = { step: 1, year: sy, term: now.getMonth() >= 7 || now.getMonth() < 2 ? 2 : 1, name: '', start: '', end: '', due: { entry: '', review: '', final: '' },
    secs: [], useSec: {}, lessons: null, cells: {}, special: { hr: true, att: true, parent: true, act: true, book: true, serve: true, vision: false, camp: false },
    hrItems: [{ id: C.rid('n'), t: '품성 및 학교생활' }], inheritFrom: '', prev: [], keepOverview: false, review: C.DEFAULT_REVIEW() };
  let ledger = [];
  try{ const ts = await FS.getDocs(FS.collection(A.db, 'terms')); ts.forEach(d => { const x = d.data(); if(x.org === C.ORG) ledger.push(x); }); }catch(e){}
  const fillDates = () => { const L = ledger.find(x => Number(x.year) === Number(st.year) && Number(x.term) === Number(st.term)); if(L){ st.start = L.start || ''; st.end = L.end || ''; } };
  fillDates();
  const m = A.modal('📒 학기 열기', '<div data-w></div>', `<button class="nh-btn" data-prev>← 앞으로</button><span class="nh-sp"></span><button class="nh-btn" data-c>닫기</button><button class="nh-btn p" data-next>다음 →</button>`, 'wide');
  const W = m.box.querySelector('[data-w]');
  const steps = ['① 학기', '② 반 · 담임', '③ 칸 (과목 · 출결 …)', '④ 검토 순서', '⑤ 확인'];
  const head = () => `<div class="wz-steps">${steps.map((s, i) => `<span class="${i + 1 === st.step ? 'on' : i + 1 < st.step ? 'dn' : ''}">${s}</span>`).join('')}</div>`;
  const tid = () => C.termIdOf(st.year, st.term);
  const draw = async () => {
    m.box.querySelector('[data-prev]').style.visibility = st.step > 1 ? 'visible' : 'hidden';
    m.box.querySelector('[data-next]').textContent = st.step === 5 ? '✅ 학기 열기' : '다음 →';
    if(st.step === 1){
      const exists = A.TERMS.find(t => t.id === tid());
      W.innerHTML = head() + `<div class="frow">
        <div class="fl" style="max-width:140px"><label>학년도</label><input class="nh-in" type="number" data-f="year" value="${st.year}"></div>
        <div class="fl" style="max-width:140px"><label>학기</label><select class="nh-sel" data-f="term"><option value="1"${st.term == 1 ? ' selected' : ''}>1학기</option><option value="2"${st.term == 2 ? ' selected' : ''}>2학기</option></select></div>
        <div class="fl" style="max-width:200px"><label>학기 이름 (표지에 나오는 글)</label><input class="nh-in" data-f="name" value="${esc(st.name || st.term + '학기')}"></div>
        <div class="fl" style="max-width:170px"><label>시작</label><input class="nh-in" type="date" data-f="start" value="${esc(st.start)}"></div>
        <div class="fl" style="max-width:170px"><label>끝</label><input class="nh-in" type="date" data-f="end" value="${esc(st.end)}"></div></div>
        <div class="nh-desc">시작 · 끝은 학사일정 «학기 원장»에서 가져왔어요 (출결 제목 «정상 수업 기간»과 출석부 셈에 씁니다). 없으면 직접 넣어 주세요.</div>
        <div class="frow">
          <div class="fl" style="max-width:190px"><label>입력 마감 (선생님)</label><input class="nh-in" type="date" data-d="entry" value="${esc(st.due.entry)}"></div>
          <div class="fl" style="max-width:190px"><label>검토 마감</label><input class="nh-in" type="date" data-d="review" value="${esc(st.due.review)}"></div>
          <div class="fl" style="max-width:190px"><label>최종 승인 마감</label><input class="nh-in" type="date" data-d="final" value="${esc(st.due.final)}"></div></div>
        <div class="nh-desc">마감은 «내 할 일»에 D-day로 보여요 (나중에 학기 설정에서 바꿀 수 있어요).</div>
        ${exists ? `<div class="nh-warn">이 학기(${esc(C.termLabel(exists))})는 이미 열려 있어요. 반 · 칸을 고치려면 «⚙️ 학기 설정»에서 하세요.</div>` : ''}`;
      W.querySelectorAll('[data-f]').forEach(i => i.onchange = () => { const k = i.dataset.f; st[k] = (k === 'year' || k === 'term') ? Number(i.value) : i.value; if(k === 'year' || k === 'term'){ fillDates(); if(!st.nameTouched) st.name = st.term + '학기'; draw(); } if(k === 'name') st.nameTouched = true; });
      W.querySelectorAll('[data-d]').forEach(i => i.onchange = () => { st.due[i.dataset.d] = i.value; });
      return;
    }
    if(st.step === 2){
      W.innerHTML = head() + '<div class="nh-desc">반편성을 읽는 중…</div>';
      A.CLASSES = null;
      const cls = (await A.loadClasses()).filter(c => Number(c.year) === Number(st.year) && c.org === C.ORG);
      if(!st.secs.length){
        st.secs = C.sectionsFromClasses(cls, A.STU, s => (window.StuStatus ? StuStatus.enrolled(s) : (s.status || 'active') !== 'quit'));
        st.secs.forEach(s => { st.useSec[s.id] = true; });
      }
      W.innerHTML = head() + (cls.length ? '' : `<div class="nh-warn">${st.year}학년도 다니엘 아마츠 반편성이 없어요. 반편성에서 반을 먼저 만들어 주세요.</div>`) +
        `<div class="nh-desc">반편성 ${st.year}학년도 반을 그대로 가져와요. <b>한 반에 학년이 여럿이면(합반) 학년마다 따로</b> 나학평을 써요 (예전 나학평처럼). 담임은 반편성 담임이 기본 — 나학평에서만 다른 분으로 바꿀 수 있어요.</div>
        <div class="nh-tw"><table class="nh-t"><thead><tr><th class="c">쓰기</th><th>반</th><th>학생</th><th>나학평 담임</th><th>확인할 것</th></tr></thead><tbody>${st.secs.map(s => `<tr>
          <td class="c"><input type="checkbox" data-use="${esc(s.id)}"${st.useSec[s.id] ? ' checked' : ''}></td><td><b>${esc(C.secLabel(s))}</b></td><td>${s.students.length}명</td>
          <td><select class="nh-sel" style="height:32px" data-hr="${esc(s.id)}">${hrOpts(s.hrUid)}</select></td>
          <td>${s.unassigned.length ? `<span class="ch warn">학년 미지정 ${s.unassigned.length}명</span> <span class="nh-desc" style="margin:0">반편성 «학년 지정»에서 정하면 다시 맞출 수 있어요 (지금은 이 반에 넣지 않음)</span>` : (s.students.length ? '' : '<span class="ch gray">학생 없음</span>')}</td></tr>`).join('')}</tbody></table></div>`;
      W.querySelectorAll('[data-use]').forEach(i => i.onchange = () => { st.useSec[i.dataset.use] = i.checked; });
      W.querySelectorAll('[data-hr]').forEach(i => i.onchange = () => { const s = st.secs.find(x => x.id === i.dataset.hr); if(s) s.hrUid = i.value; });
      return;
    }
    if(st.step === 3){
      W.innerHTML = head() + '<div class="nh-desc">시간표 «수업 정의»를 읽는 중…</div>';
      if(!st.lessons){
        try{ const d = await FS.getDoc(FS.doc(A.db, 'timetableLessons', 'main')); st.lessons = d.exists() ? (d.data().lessons || []) : []; }catch(e){ st.lessons = []; }
      }
      const secs = st.secs.filter(s => st.useSec[s.id]);
      secs.forEach(s => { if(!st.cells[s.id]) st.cells[s.id] = C.subjectsForSection(s, st.lessons).map(x => Object.assign(x, { use: true })); });
      const others = A.TERMS.filter(t => t.id !== tid());
      if(st.inheritFrom === '' && others.length){
        const cand = others.find(t => t.year === st.year && t.term === st.term - 1) || others.find(t => t.year === st.year - 1 && t.term === st.term) || others[0];
        st.inheritFrom = cand ? cand.id : '';
        st.prev = st.inheritFrom ? await prevSetups(st.inheritFrom) : [];
      }
      const spec = ['hr', 'att', 'parent', 'vision', 'camp', 'act', 'book', 'serve'];
      W.innerHTML = head() + `<div class="nh-card" style="margin-bottom:10px"><h3>반마다 만드는 칸 <small>담임이 기본 담당</small></h3>
          <div class="pk">${spec.map(k => `<label class="ck" style="margin-right:12px"><input type="checkbox" data-sp="${k}"${st.special[k] ? ' checked' : ''}>${esc(C.KINDS[k].icon)} ${esc(C.KINDS[k].ko.split(' (')[0])}</label>`).join('')}</div>
          <div class="frow" style="margin-top:8px"><div class="fl"><label>담임평가 항목 (쉼표로 여러 개)</label><input class="nh-in" data-hritems value="${esc(st.hrItems.map(x => x.t).join(', '))}"></div></div>
          <div class="nh-desc">담임평가는 반마다 · 학생마다 «출력에서 빼기»를 따로 할 수 있어요 (학기 설정 › 담임평가).</div></div>
        <div class="nh-card" style="margin-bottom:10px"><h3>지난 학기에서 평가 틀 이어받기</h3>
          <div class="frow"><div class="fl" style="max-width:340px"><select class="nh-sel" data-inh><option value="">이어받지 않음 (새로 만들기)</option>${others.map(t => `<option value="${esc(t.id)}"${t.id === st.inheritFrom ? ' selected' : ''}>${esc(C.termLabel(t))}${t.src === 'import' ? ' · 옮겨 온 자료' : ''}</option>`).join('')}</select></div>
          <label class="ck"><input type="checkbox" data-kov${st.keepOverview ? ' checked' : ''}>«수업 내용 개관» 글도 가져오기</label></div>
          <div class="nh-desc">같은 이름 · 같은 학년 과목의 <b>평가 방식 · 평가 항목 · 서술 칸 제목 · 시험 항목</b>을 가져와요. 선생님이 입력 전에 고칠 수 있어요.</div></div>
        <div class="nh-desc">시간표 «수업 정의»에서 그 반 학년을 듣는 수업을 과목 칸으로 만들어요. 빼고 싶은 과목은 체크를 끄세요 (나중에 더하거나 뺄 수 있어요).</div>
        ${secs.map(s => `<details class="dr" open><summary>${esc(C.secLabel(s))} <small>과목 ${st.cells[s.id].filter(x => x.use).length}개</small></summary><div class="db">
          ${st.cells[s.id].length ? st.cells[s.id].map((x, i) => { const p = C.findPrev(st.prev, x.name, s.gradeNo); return `<label class="ck" style="display:flex;margin-right:0"><input type="checkbox" data-cell="${esc(s.id)}" data-i="${i}"${x.use ? ' checked' : ''}><b>${esc(x.name)}</b> <span class="nh-desc" style="margin:0">${esc(names(x.teacherUids).join(', ') || '담당 없음')}</span> ${p ? `<span class="ch mint">이어받음 · ${esc((C.TYPES[p.type] || {}).short || p.type)}${(p.setup && p.setup.items && p.setup.items.length) ? ` · 항목 ${p.setup.items.length}개` : ''}</span>` : '<span class="ch gray">새로</span>'}</label>`; }).join('')
            : '<div class="nh-desc">이 학년을 듣는 수업이 시간표에 없어요. 학기를 연 뒤 «학기 설정 › 칸»에서 과목을 더할 수 있어요.</div>'}</div></details>`).join('')}`;
      W.querySelectorAll('[data-sp]').forEach(i => i.onchange = () => { st.special[i.dataset.sp] = i.checked; });
      W.querySelector('[data-hritems]').onchange = e => { st.hrItems = e.target.value.split(',').map(x => x.trim()).filter(Boolean).map(t => ({ id: C.rid('n'), t })); };
      W.querySelector('[data-kov]').onchange = e => { st.keepOverview = e.target.checked; };
      W.querySelector('[data-inh]').onchange = async e => { st.inheritFrom = e.target.value; st.prev = st.inheritFrom ? await prevSetups(st.inheritFrom) : []; draw(); };
      W.querySelectorAll('[data-cell]').forEach(i => i.onchange = () => { st.cells[i.dataset.cell][+i.dataset.i].use = i.checked; });
      return;
    }
    if(st.step === 4){
      W.innerHTML = head() + reviewEditorHTML(st.review, st.secs.filter(s => st.useSec[s.id]), true);
      bindReviewEditor(W, st.review, st.secs.filter(s => st.useSec[s.id]), () => draw());
      return;
    }
    if(st.step === 5){
      const secs = st.secs.filter(s => st.useSec[s.id]);
      const nSub = secs.reduce((n, s) => n + (st.cells[s.id] || []).filter(x => x.use).length, 0);
      const nSp = secs.length * Object.keys(st.special).filter(k => st.special[k]).length;
      const R = st.review;
      W.innerHTML = head() + `<div class="nh-card"><h3>${esc(st.year)}학년도 ${esc(st.name || st.term + '학기')} <small>${esc(st.start)} ~ ${esc(st.end)}</small></h3>
        <div class="nh-desc">· 반 ${secs.length}개 · 과목 칸 ${nSub}개 · 반마다 칸 ${nSp}개 (모두 ${nSub + nSp}칸)<br>
        · 검토 순서: ${R.stages.map(s => `${esc(s.label)}(${s.mode === 'homeroom' ? '그 반 담임' : esc(names(s.uids).join(', ') || '아직 없음')})`).join(' → ') || '검토 단계 없음'} → ${esc(R.final.label)}(${esc(names(R.final.uids).join(', ') || '아직 없음')})<br>
        · 이어받기: ${st.inheritFrom ? esc(C.termLabel(A.TERMS.find(t => t.id === st.inheritFrom))) : '없음'}</div>
        ${!R.final.uids.length ? '<div class="nh-warn">최종 검토관이 아직 없어요 — 지금은 나학평 담당만 최종 승인할 수 있어요. 학기 설정에서 언제든 정할 수 있어요.</div>' : ''}
        <div class="nh-info">«✅ 학기 열기»를 누르면 칸이 만들어지고, 맡은 선생님들의 «내 할 일»에 바로 나와요. 반편성 · 시간표 원본은 바뀌지 않아요.</div></div>`;
      return;
    }
  };
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-prev]').onclick = () => { if(st.step > 1){ st.step--; draw(); } };
  m.box.querySelector('[data-next]').onclick = async () => {
    if(st.step === 1){
      if(!st.year || !st.term) return A.toast('학년도와 학기를 정해 주세요.', 'err');
      if(!st.start || !st.end || st.start > st.end) return A.toast('시작 · 끝 날짜를 확인해 주세요.', 'err');
      if(A.TERMS.find(t => t.id === tid())) return A.toast('이미 열린 학기예요 — 학기 설정에서 고쳐 주세요.', 'err');
      if(!st.name) st.name = st.term + '학기';
    }
    if(st.step === 2 && !st.secs.some(s => st.useSec[s.id])) return A.toast('쓸 반을 하나 이상 골라 주세요.', 'err');
    if(st.step < 5){ st.step++; draw(); return; }
    await createTerm(st, m);
  };
  draw();
}
async function createTerm(st, m){
  const id = C.termIdOf(st.year, st.term);
  const secs = st.secs.filter(s => st.useSec[s.id]).map(s => ({ id: s.id, classId: s.classId, name: s.name, grade: s.grade, gradeNo: s.gradeNo, hrUid: s.hrUid || '', students: s.students.slice() }));
  const term = { id, org: C.ORG, year: st.year, term: st.term, name: st.name || st.term + '학기', start: st.start, end: st.end, status: 'open', src: 'new',
    due: st.due, sections: secs, review: st.review, hr: { on: !!st.special.hr, items: st.hrItems, off: {} }, listEditors: [] };
  term.finAll = C.finAllOf(term, secs);
  const ops = [];
  const ref = FS.doc(A.db, 'nhpTerms', id);
  ops.push({ ref, data: Object.assign({}, term, { createdAt: FS.serverTimestamp(), createdBy: A.CU.uid, createdByName: A.CU.name || '' }) });
  ops.push({ ref: FS.doc(A.db, 'nhpLists', id), data: { termId: id, activities: [], parentEdu: [], visions: [], camps: [] } });
  secs.forEach(sec => {
    const S = st.secs.find(x => x.id === sec.id);
    ['hr', 'att', 'parent'].forEach(k => { if(st.special[k]) ops.push({ ref: FS.doc(FS.collection(A.db, 'nhpSubjects')), data: finalizeCell(specialCell(k, sec, id, st.hrItems), term, sec) }); });
    (st.cells[sec.id] || []).filter(x => x.use).forEach((x, i) => {
      const p = C.findPrev(st.prev, x.name, sec.gradeNo);
      const inh = C.inheritSetup(p, { keepOverview: st.keepOverview });
      const type = inh ? inh.type : 'E';
      const cell = { kind: 'subj', name: x.name, order: 100 + i, type, setup: inh ? C.setupForType(inh.setup, type) : C.emptySetup(type), teacherUids: x.teacherUids, lessonIds: x.lessonIds,
        printName: inh ? inh.printName : '', secId: sec.id, termId: id, org: C.ORG, studentIds: [], inheritedFrom: inh ? st.inheritFrom : '' };
      ops.push({ ref: FS.doc(FS.collection(A.db, 'nhpSubjects')), data: finalizeCell(cell, term, sec) });
    });
    ['vision', 'camp', 'act', 'book', 'serve'].forEach(k => { if(st.special[k]) ops.push({ ref: FS.doc(FS.collection(A.db, 'nhpSubjects')), data: finalizeCell(specialCell(k, sec, id), term, sec) }); });
    void S;
  });
  window.showLoading && showLoading('학기를 여는 중…');
  try{
    await commitMany(ops, (n, all) => window.setLoadStep && setLoadStep(`칸 만드는 중… ${n}/${all}`, Math.round(n / all * 100)));
    m.close();
    await A.loadTerms();
    await A.useTerm(id);
    A.toast(`${C.termLabel(term)}를 열었어요 ✓ (칸 ${ops.length - 2}개)`);
    A.go('setup');
  }catch(e){ A.toast('학기를 열지 못했어요 — ' + A.errText(e), 'err'); console.error(e); }
  window.hideLoading && hideLoading();
}

/* ═══════════ 검토 순서 편집 (마법사 · 설정 같이 씀) ═══════════ */
function reviewEditorHTML(R, secs, wizard){
  const stg = (s, i) => `<div class="stg"><div class="h"><span class="no">${i + 1}</span>
      <input class="nh-in" data-sl="${i}" value="${esc(s.label)}" style="max-width:220px" aria-label="단계 이름">
      <select class="nh-sel" data-sm="${i}" style="height:34px"><option value="homeroom"${s.mode === 'homeroom' ? ' selected' : ''}>그 반 담임</option><option value="people"${s.mode === 'people' ? ' selected' : ''}>정한 분 (검토관)</option></select>
      <span class="nh-sp"></span><button class="nh-btn xs" data-sup="${i}" ${i ? '' : 'disabled'}>↑</button><button class="nh-btn xs" data-sdn="${i}" ${i < R.stages.length - 1 ? '' : 'disabled'}>↓</button><button class="nh-btn xs r" data-sdel="${i}">빼기</button></div>
      ${s.mode === 'people' ? `<div class="frow" style="align-items:center"><span class="nh-desc" style="margin:0">모든 반:</span>${peopleChips(s.uids, 's' + i)}<button class="nh-btn xs" data-spick="${i}">＋ 고르기</button></div>
        <details style="margin-top:6px"><summary class="nh-desc" style="cursor:pointer;margin:0">반마다 다른 분으로 정하기 ${Object.keys(s.per || {}).filter(k => (s.per[k] || []).length).length ? `(${Object.keys(s.per).filter(k => (s.per[k] || []).length).length}반)` : ''}</summary>
          ${secs.map(sec => `<div class="frow" style="align-items:center;margin-top:6px"><b style="min-width:130px;font-size:12.5px">${esc(C.secLabel(sec))}</b>${(s.per && s.per[sec.id] && s.per[sec.id].length) ? peopleChips(s.per[sec.id], 's' + i + ':' + sec.id) : '<span class="nh-desc" style="margin:0">모든 반과 같음</span>'}<button class="nh-btn xs" data-spick="${i}" data-sec="${esc(sec.id)}">고르기</button></div>`).join('')}</details>`
        : `<div class="nh-desc" style="margin:0">반마다 그 반 나학평 담임이 검토해요. 담임이 직접 쓴 칸(출결 · 담임평가 …)은 이 단계를 건너뛰고 다음 검토관에게 가요.</div>`}</div>`;
  const F = R.final;
  return `${wizard ? `<div class="nh-desc">나학평만의 검토 순서예요 — <b>기존 직책 · 권한과 상관없이</b> 학기마다 정해요. 기본은 <b>담임 → 검토관 → 최종 검토관</b>. 단계를 더하거나 빼고 순서를 바꿀 수 있어요. (본인이 쓴 칸은 본인 검토 단계를 건너뛰어요)</div>` : ''}
    ${R.stages.map(stg).join('')}
    <button class="nh-btn sm" data-sadd>＋ 검토 단계 더하기</button>
    <div class="stg fin" style="margin-top:10px"><div class="h"><span class="no">✓</span><input class="nh-in" data-fl value="${esc(F.label)}" style="max-width:220px" aria-label="최종 단계 이름"><span class="nh-desc" style="margin:0">승인하면 그 칸은 잠겨요</span></div>
      <div class="frow" style="align-items:center"><span class="nh-desc" style="margin:0">최종 검토관:</span>${peopleChips(F.uids, 'f')}<button class="nh-btn xs" data-fpick>＋ 고르기</button></div>
      <details style="margin-top:6px"><summary class="nh-desc" style="cursor:pointer;margin:0">반마다 다른 분으로 정하기</summary>
        ${secs.map(sec => `<div class="frow" style="align-items:center;margin-top:6px"><b style="min-width:130px;font-size:12.5px">${esc(C.secLabel(sec))}</b>${(F.per && F.per[sec.id] && F.per[sec.id].length) ? peopleChips(F.per[sec.id], 'f:' + sec.id) : '<span class="nh-desc" style="margin:0">위와 같음</span>'}<button class="nh-btn xs" data-fpick data-sec="${esc(sec.id)}">고르기</button></div>`).join('')}</details></div>`;
}
function bindReviewEditor(W, R, secs, redraw){
  W.querySelectorAll('[data-sl]').forEach(i => i.onchange = () => { R.stages[+i.dataset.sl].label = i.value.trim() || '검토'; });
  W.querySelectorAll('[data-sm]').forEach(i => i.onchange = () => { R.stages[+i.dataset.sm].mode = i.value; redraw(); });
  W.querySelectorAll('[data-sup]').forEach(b => b.onclick = () => { const i = +b.dataset.sup; [R.stages[i - 1], R.stages[i]] = [R.stages[i], R.stages[i - 1]]; redraw(); });
  W.querySelectorAll('[data-sdn]').forEach(b => b.onclick = () => { const i = +b.dataset.sdn; [R.stages[i + 1], R.stages[i]] = [R.stages[i], R.stages[i + 1]]; redraw(); });
  W.querySelectorAll('[data-sdel]').forEach(b => b.onclick = () => { R.stages.splice(+b.dataset.sdel, 1); redraw(); });
  const add = W.querySelector('[data-sadd]'); if(add) add.onclick = () => { R.stages.push({ id: C.rid('st'), label: '검토관 검토', mode: 'people', uids: [], per: {} }); redraw(); };
  const fl = W.querySelector('[data-fl]'); if(fl) fl.onchange = () => { R.final.label = fl.value.trim() || '최종 승인'; };
  W.querySelectorAll('[data-spick]').forEach(b => b.onclick = async () => {
    const s = R.stages[+b.dataset.spick]; const sec = b.dataset.sec;
    const cur = sec ? ((s.per || {})[sec] || []) : s.uids;
    const r = await pickPeople(A, sec ? `${C.secLabel(A.secOf(sec) || secs.find(x => x.id === sec))} 검토관` : `${s.label} — 검토관`, cur, { help: sec ? '비워 두면 «모든 반» 검토관이 봐요.' : '' });
    if(r == null) return;
    if(sec){ s.per = s.per || {}; s.per[sec] = r; } else s.uids = r;
    redraw();
  });
  W.querySelectorAll('[data-fpick]').forEach(b => b.onclick = async () => {
    const sec = b.dataset.sec; const F = R.final;
    const cur = sec ? ((F.per || {})[sec] || []) : F.uids;
    const r = await pickPeople(A, sec ? `${C.secLabel(A.secOf(sec) || secs.find(x => x.id === sec))} 최종 검토관` : '최종 검토관', cur);
    if(r == null) return;
    if(sec){ F.per = F.per || {}; F.per[sec] = r; } else F.uids = r;
    redraw();
  });
  W.querySelectorAll('[data-rmp]').forEach(b => b.onclick = () => {
    const k = b.dataset.rmp, u = b.dataset.uid;
    const [a, sec] = k.split(':');
    const rm = arr => (arr || []).filter(x => x !== u);
    if(a === 'f'){ if(sec) R.final.per[sec] = rm(R.final.per[sec]); else R.final.uids = rm(R.final.uids); }
    else { const s = R.stages[+a.slice(1)]; if(sec) s.per[sec] = rm(s.per[sec]); else s.uids = rm(s.uids); }
    redraw();
  });
}
/* 검토관 명단을 모든 칸에 다시 적기 (단계 · 사람이 바뀌었을 때) */
/*   칸마다 «지금 서버 값»을 읽고 고친다 (거래) — 그 사이 다른 분이 승인 · 검토완료한 것을 되돌리지 않게 */
function rvPatch(term, sec, cur){
  const r = C.rvForSub(term, sec, cur);
  const d = Object.assign({}, cur, { rv: r.rv, rvL: r.rvL, finL: r.finL });
  // 단계 수가 줄었으면 마지막 단계로 (없으면 최종)
  if(d.state === 'review' && !(('r' + ((d.stage || 0) + 1)) in r.rv)){ const n = r.rvL.length; if(n) d.stage = n - 1; else { d.state = 'final'; d.stage = 0; } }
  const turn = C.turnOf(d);
  if(JSON.stringify([cur.rv, cur.rvL, cur.finL, cur.turn, cur.state, cur.stage || 0]) === JSON.stringify([r.rv, r.rvL, r.finL, turn, d.state, d.stage || 0])) return null;
  const p = { rv: r.rv, rvL: r.rvL, finL: r.finL, turn };
  if(d.state !== cur.state) p.state = d.state;
  if((d.stage || 0) !== (cur.stage || 0)) p.stage = d.stage || 0;
  return p;
}
async function applyReview(term){
  mine();
  // v144 조별 칸은 «조별 칸» 자리(GRP_SEC)로 — 담임 검토는 건너뛰고 검토관 → 최종
  const todo = A.SUBS.map(s => ({ s, sec: s.grp ? C.GRP_SEC : (A.secOf(s.secId) || (term.sections || []).find(x => x.id === s.secId)) })).filter(x => x.sec && rvPatch(term, x.sec, x.s));
  let n = 0;
  const one = async ({ s, sec }) => {
    const ref = FS.doc(A.db, 'nhpSubjects', s.id);
    const did = await FS.runTransaction(A.db, async tx => {
      const snap = await tx.get(ref); if(!snap.exists()) return false;
      const p = rvPatch(term, sec, snap.data()); if(!p) return false;
      tx.update(ref, Object.assign(p, { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid })); return true;
    });
    if(did) n++;
  };
  for(let i = 0; i < todo.length; i += 8){ mine(); await Promise.all(todo.slice(i, i + 8).map(one)); }
  return n;
}
/* 반 목록 고치기 — 지금 서버 값을 읽어 그 반만 바꾼다 (거래 · 빠르게 두 번 바꿔도 앞의 것이 사라지지 않게) */
async function updateSections(mut){
  mine();
  const ref = FS.doc(A.db, 'nhpTerms', A.TERM.id);
  let secs = null, finAll = null;
  try{
    await FS.runTransaction(A.db, async tx => {
      const snap = await tx.get(ref);
      const t = snap.data() || {};
      secs = mut((t.sections || []).map(x => Object.assign({}, x)));
      finAll = C.finAllOf(Object.assign({}, t, { sections: secs }), secs);
      tx.update(ref, { sections: secs, finAll, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid });
    });
  }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); return null; }
  A.TERM.sections = secs; A.TERM.finAll = finAll;
  return secs;
}

/* ═══════════ 학기 설정 화면 ═══════════ */
let PANE = '', SEC = '';
const paneLoad = () => { try{ return localStorage.getItem('nhp_pane') || ''; }catch(e){ return ''; } };
const paneSave = v => { try{ localStorage.setItem('nhp_pane', v || ''); }catch(e){} };
/* 내가 방금 고친 것이 돌아오면 바로 다시 그리고, 다른 분이 고친 것은 «다시 그리기» 단추로 (쓰던 글이 날아가지 않게) */
let SELF = 0, LIVE_T = null;
const mine = () => { SELF = Date.now() + 6000; };
export function onLive(a){
  bind(a);
  if(Date.now() < SELF){ clearTimeout(LIVE_T); LIVE_T = setTimeout(rerender, 150); return; }
  const b = document.getElementById('st-live'); if(b) b.style.display = '';
}
const save = (id, patch) => { mine(); return A.saveSub(id, patch); };
/* 승인(잠김)된 칸 — 평가 방식 · 이름 · 학생 · 맡은 선생님은 «다시 열기» 뒤에 (보안 규칙도 같음) */
function isLocked(s){
  if(!s || s.state !== 'done') return false;
  A.toast('승인되어 잠긴 칸이에요 — 최종 검토관이 «🔓 다시 열기»를 한 뒤 바꿀 수 있어요.', 'err');
  return true;
}
/* 새로 그린 화면에 단추가 생길 때까지 기다렸다가 누르기 */
function clickWhenReady(sel, ms){ const t0 = Date.now(); const go = () => { const b = document.querySelector(sel); if(b) return b.click(); if(Date.now() - t0 < (ms || 4000)) setTimeout(go, 120); }; setTimeout(go, 120); }
export async function render(a, el, pane){
  bind(a);
  if(!A.isMgr){ el.innerHTML = `<div class="nh-empty">학기 설정은 나학평 담당 선생님만 할 수 있어요.</div>`; return; }
  PANE = pane || PANE || paneLoad();
  const t = A.TERM;
  if(!t){
    el.innerHTML = `<div class="nh-empty">열린 학기가 없어요. 위의 <b>«＋ 학기 열기»</b>로 시작하세요.</div>` + importCardHTML();
    bindImport(el); return;
  }
  const secs = t.sections || [];
  if(!SEC || !secs.find(s => s.id === SEC)) SEC = (secs[0] || {}).id || '';
  const live = A.SUBS.filter(s => !s.removed);
  const open = k => PANE === k ? ' open' : '';
  const closed = t.src === 'import' ? [] : closedSeats(t);
  el.innerHTML = `<div id="st-live" class="nh-info" style="display:none">다른 분이 칸을 고쳤어요. <button class="nh-btn xs" data-st="redraw">다시 그리기</button></div>
    ${closed.length ? `<div class="nh-warn" data-closed>⚠ <b>나학평이 닫힌 선생님 ${closed.length}분</b>이 맡은 자리가 있어요 — ${closed.join(', ')}<br><span>이분들은 나학평을 열 수 없어 입력 · 검토를 못 해요. 수퍼관리자가 <b>관리자 › 접근 권한 › 🗂 화면별 › 나학평</b>에서 열어 주거나, 아래에서 다른 분으로 바꿔 주세요.</span></div>` : ''}
    <div class="nh-desc">${esc(C.termLabel(t))} · ${t.src === 'import' ? '옮겨 온 지난 자료' : `반 ${secs.length}개 · 칸 ${live.length}개`} · 열린 서랍은 이 기기에서 기억해요.</div>
    ${t.src === 'import' ? '' : `
    <details class="dr" data-pane="info"${open('info')}><summary>🗓 학기 정보 · 마감 <small>${esc(t.start || '')} ~ ${esc(t.end || '')}${t.status === 'closed' ? ' · 마감됨' : ''}</small></summary><div class="db">${infoHTML(t)}</div></details>
    <details class="dr" data-pane="secs"${open('secs')}><summary>🏫 반 · 나학평 담임 <small>${secs.length}반 · ${secs.reduce((n, s) => n + (s.students || []).length, 0)}명</small></summary><div class="db">${secsHTML(t)}</div></details>
    <details class="dr" data-pane="cells"${open('cells')}><summary>🧩 칸 (과목 · 출결 · 담임평가 …) <small>맡은 선생님 · 평가 방식 · 순서</small></summary><div class="db">${cellsHTML(t)}</div></details>
    <details class="dr" data-pane="review"${open('review')}><summary>🧐 검토 순서 · 검토관 <small>${esc((t.review && t.review.stages || []).map(s => s.label).concat([(t.review && t.review.final && t.review.final.label) || '최종 승인']).join(' → '))}</small></summary><div class="db" data-rv></div></details>
    <details class="dr" data-pane="hr"${open('hr')}><summary>💬 담임평가 <small>${t.hr && t.hr.on ? '쓰는 중' : '안 씀'}</small></summary><div class="db">${hrHTML(t)}</div></details>
    <details class="dr" data-pane="lists"${open('lists')}><summary>📋 공통 목록 <small>특별활동 ${(A.LISTS.activities || []).length} · 부모교육 ${(A.LISTS.parentEdu || []).length} · 비전트립 ${(A.LISTS.visions || []).length} · 캠프 ${(A.LISTS.camps || []).length}</small></summary><div class="db">${listsHTML(t)}</div></details>`}
    <details class="dr" data-pane="print"${open('print')}><summary>🖨 출력 모양 <small>${esc(printSummary())}</small></summary><div class="db" data-prt>${printPaneHTML()}</div></details>
    <details class="dr" data-pane="lang"${open('lang')}><summary>🌐 영문판 · 용어 바꾸기 · 번역 담당</summary><div class="db">${langHTML()}</div></details>
    ${importCardHTML()}`;
  const rv = el.querySelector('[data-rv]');
  if(rv){
    const R = JSON.parse(JSON.stringify(t.review || C.DEFAULT_REVIEW()));
    const secs2 = secs.concat(A.SUBS.some(x => x.grp && !x.removed) ? [C.GRP_SEC] : []);
    const draw = () => { rv.innerHTML = reviewEditorHTML(R, secs2, false) + `<div class="frow" style="margin-top:12px"><button class="nh-btn p" data-st="saverv">💾 검토 순서 저장 · 모든 칸에 적용</button><span class="nh-desc" style="margin:0">이미 검토 중인 칸은 지금 단계를 그대로 두고 사람만 바뀌어요. «👥 조별 칸»(반이 섞인 칸)은 담임 검토를 건너뛰어요.</span></div>`;
      bindReviewEditor(rv, R, secs2, draw); rv.querySelector('[data-st="saverv"]').onclick = () => saveReview(R); };
    draw();
  }
  el.querySelectorAll('details[data-pane]').forEach(d => d.addEventListener('toggle', () => { if(d.open){ PANE = d.dataset.pane; paneSave(PANE); } else if(PANE === d.dataset.pane){ PANE = ''; paneSave(''); } }));
  bindSetup(el);
  bindImport(el);
  bindPrint(el);
  { const g = el.querySelector('[data-grp]'); if(g) GRP.bindPane(A, g, () => { PANE = 'cells'; rerender(); }); }
}

/* ── 학기 정보 ── */
function infoHTML(t){
  return `<div class="frow">
      <div class="fl" style="max-width:200px"><label>학기 이름</label><input class="nh-in" data-ti="name" value="${esc(t.name || '')}"></div>
      <div class="fl" style="max-width:170px"><label>시작</label><input class="nh-in" type="date" data-ti="start" value="${esc(t.start || '')}"></div>
      <div class="fl" style="max-width:170px"><label>끝</label><input class="nh-in" type="date" data-ti="end" value="${esc(t.end || '')}"></div>
      <div class="fl" style="max-width:170px"><label>상태</label><select class="nh-sel" data-ti="status"><option value="open"${t.status !== 'closed' ? ' selected' : ''}>진행 중</option><option value="closed"${t.status === 'closed' ? ' selected' : ''}>마감 (지난 학기)</option></select></div></div>
    <div class="frow">
      <div class="fl" style="max-width:190px"><label>입력 마감</label><input class="nh-in" type="date" data-td="entry" value="${esc((t.due || {}).entry || '')}"></div>
      <div class="fl" style="max-width:190px"><label>검토 마감</label><input class="nh-in" type="date" data-td="review" value="${esc((t.due || {}).review || '')}"></div>
      <div class="fl" style="max-width:190px"><label>최종 승인 마감</label><input class="nh-in" type="date" data-td="final" value="${esc((t.due || {}).final || '')}"></div></div>
    <button class="nh-btn p sm" data-st="saveinfo">💾 저장</button>`;
}
/* ── 반 · 담임 ── */
function secsHTML(t){
  return `<div class="nh-desc">나학평 담임을 바꾸면 그 반의 «담임 검토» 단계와 담임이 맡은 칸(출결 · 특별활동 …)의 담당도 함께 바뀔지 물어봐요.</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th>반</th><th>학생</th><th>나학평 담임</th><th></th></tr></thead><tbody>${(t.sections || []).map(s => `<tr>
      <td><b>${esc(C.secLabel(s))}</b></td><td>${(s.students || []).length}명</td>
      <td><select class="nh-sel" style="height:32px" data-shr="${esc(s.id)}">${hrOpts(s.hrUid)}</select></td>
      <td><button class="nh-btn xs" data-sstu="${esc(s.id)}">학생 보기 · 고치기</button></td></tr>`).join('')}</tbody></table></div>
    <div class="frow" style="margin-top:10px"><button class="nh-btn sm" data-st="resync">🔄 반편성에서 학생 다시 맞추기</button><button class="nh-btn sm" data-st="addsec">＋ 반 더하기</button></div>`;
}
/* ── 칸 ── */
function cellsHTML(t){
  const secs = t.sections || [];
  const ss = A.SUBS.filter(s => s.secId === SEC && !s.removed);
  const kinds = ['hr', 'att', 'parent', 'vision', 'camp', 'act', 'book', 'serve'];
  const has = k => ss.some(s => s.kind === k);
  return `<div class="frow" style="align-items:center;margin-bottom:8px"><div class="fl" style="max-width:300px;margin:0"><select class="nh-sel" data-csec>${secs.map(s => `<option value="${esc(s.id)}"${s.id === SEC ? ' selected' : ''}>${esc(C.secLabel(s))}</option>`).join('')}</select></div>
      <span class="nh-sp"></span><button class="nh-btn sm g" data-st="addsubj">＋ 과목 더하기</button>
      <button class="nh-btn sm" data-st="fromtt">📅 시간표에서 새 과목</button><button class="nh-btn sm" data-st="inherit">↩ 지난 학기 평가 틀</button></div>
    <div class="pk" style="margin-bottom:8px">${kinds.filter(k => !has(k)).map(k => `<button class="nh-btn xs" data-addk="${k}">＋ ${esc(C.KINDS[k].icon)} ${esc(C.KINDS[k].ko.split(' (')[0])}</button>`).join('')}</div>
    <div>${ss.map((s, i) => `<div class="cell-row">
        <div class="ord"><button data-up="${esc(s.id)}" ${i ? '' : 'disabled'} aria-label="위로">▲</button><button data-dn="${esc(s.id)}" ${i < ss.length - 1 ? '' : 'disabled'} aria-label="아래로">▼</button></div>
        <div><b style="cursor:pointer" data-open="${esc(s.id)}">${esc(A.subLabel(s))}</b>${s.printName ? ` <small style="color:var(--ink-3)">출력: ${esc(s.printName)}</small>` : ''}<div>${A.stateChip(s)}</div></div>
        <div class="hide-m">${s.kind === 'subj' ? `<select class="nh-sel" style="height:30px;font-size:12px" data-type="${esc(s.id)}">${C.TYPE_ORDER.map(k => `<option value="${k}"${s.type === k ? ' selected' : ''}>${esc(C.TYPES[k].ko)}</option>`).join('')}</select>` : A.typeChip(s)}</div>
        <div class="hide-m">${peopleChips(s.teacherUids)} <button class="nh-btn xs" data-tch="${esc(s.id)}">바꾸기</button></div>
        <div class="hide-m">${(s.studentIds || []).length ? `<span class="ch warn" title="일부 학생만 듣는 칸">${s.studentIds.length}명</span>` : '<span class="ch gray">반 모두</span>'}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end"><button class="nh-btn xs" data-cedit="${esc(s.id)}">이름 · 출력</button><button class="nh-btn xs" data-cstu="${esc(s.id)}">학생</button><button class="nh-btn xs r" data-cdel="${esc(s.id)}">빼기</button></div>
      </div>`).join('') || '<div class="nh-desc">이 반에 칸이 없어요.</div>'}</div>
    <div data-grp>${GRP.paneHTML(A)}</div>
    <div class="nh-desc" style="margin-top:12px">💡 같은 과목을 여러 반이 같은 평가 틀로 쓰면 <b>«🔗 함께 쓰기»</b>로 묶어 두세요 — 한 곳에서 고치면 묶인 반 모두 바뀌어요 (학생 입력 · 점수는 반마다). <button class="nh-btn xs" data-st="shareall">🔗 같은 과목 모든 반 함께 쓰기…</button></div>`;
}
/* ── 담임평가 ── */
function hrHTML(t){
  const hr = t.hr || { on: false, items: [] };
  const secs = t.sections || [];
  const hasHr = sid => A.SUBS.some(s => s.secId === sid && s.kind === 'hr' && !s.removed);
  return `<div class="nh-desc">담임평가(품성 및 학교생활)는 표지 다음 첫 장에 나와요. <b>반마다 넣고 뺄 수 있고</b>, 담임 선생님은 입력 화면에서 학생마다 «이 학생은 출력에서 빼기»를 할 수 있어요.</div>
    <div class="frow"><div class="fl"><label>항목 이름 (쉼표로 여러 개 — 새로 만드는 담임평가 칸에 쓰여요)</label><input class="nh-in" data-hri value="${esc((hr.items || []).map(x => x.t).join(', ') || '품성 및 학교생활')}"></div></div>
    <div class="pk" style="margin-bottom:10px">${secs.map(s => `<label class="ck" style="margin-right:12px"><input type="checkbox" data-hrsec="${esc(s.id)}"${hasHr(s.id) ? ' checked' : ''}>${esc(C.secLabel(s))}</label>`).join('')}</div>
    <div class="frow"><button class="nh-btn p sm" data-st="savehr">💾 담임평가 반 저장</button><span class="nh-desc" style="margin:0">체크를 끄면 그 반 담임평가 칸이 빠져요 (이미 쓴 글은 보관돼요 — 다시 켜면 돌아와요).</span></div>`;
}
/* ── 공통 목록 ── */
function listsHTML(t){
  const L = A.LISTS || {};
  const secs = t.sections || [];
  const act = (L.activities || []).slice().sort((a, b) => (a.o || 0) - (b.o || 0));
  const secName = ids => (ids || []).length ? ids.map(id => { const s = secs.find(x => x.id === id); return s ? C.secLabel(s) : ''; }).filter(Boolean).join(', ') : '모든 반';
  return `<div class="nh-desc">학기 공통 목록이에요. 반마다 칸(특별활동 · 부모교육 · 비전트립 · 캠프)에서 이 목록을 써요. <b>목록 담당</b>으로 고른 분도 고칠 수 있어요: ${peopleChips(t.listEditors || [])} <button class="nh-btn xs" data-st="listeds">고르기</button></div>
    <div class="nh-sec">🎉 <b>특별활동</b> ${act.length}개 <span class="nh-sp"></span><button class="nh-btn xs g" data-ladd="activities">＋ 활동</button><button class="nh-btn xs" data-lpaste="activities">여러 줄 붙여넣기</button></div>
    <div class="tlist">${act.map((a, i) => `<div class="tl-row"><b style="color:var(--ink-3)">${i + 1}</b><div><b>${esc(a.t)}</b> <span class="ch gray">${esc(a.d || '날짜 없음')}</span> <span class="ch ${a.def === 'none' ? 'warn' : 'mint'}">${a.def === 'none' ? '고른 학생만' : '모두 참여'}</span> <span class="ch gray">${esc(secName(a.secs))}</span><div class="nh-desc" style="margin:4px 0 0;white-space:pre-wrap">${esc(a.c || '')}</div></div>
      <div style="display:flex;gap:4px"><button class="nh-btn xs" data-ledit="activities" data-i="${esc(a.id)}">고치기</button><button class="nh-btn xs r" data-ldel="activities" data-i="${esc(a.id)}">빼기</button></div></div>`).join('') || '<div class="nh-desc">아직 없어요.</div>'}</div>
    <div class="nh-sec">👪 <b>부모교육 및 과제</b> <span class="nh-sp"></span><button class="nh-btn xs g" data-ladd="parentEdu">＋ 항목</button></div>
    <div class="tlist">${(L.parentEdu || []).map((a, i) => `<div class="tl-row"><b style="color:var(--ink-3)">${i + 1}</b><div><b>${esc(a.t)}</b> <span class="ch gray">${esc(a.d || '')}</span> <span class="ch mint">${esc(C.PE_TARGET[a.target] || '부모')}</span></div>
      <div style="display:flex;gap:4px"><button class="nh-btn xs" data-ledit="parentEdu" data-i="${esc(a.id)}">고치기</button><button class="nh-btn xs r" data-ldel="parentEdu" data-i="${esc(a.id)}">빼기</button></div></div>`).join('') || '<div class="nh-desc">아직 없어요. 반마다 부모교육 칸의 «평가 틀»에서 그 반에 해당하는 항목을 골라요.</div>'}</div>
    <div class="nh-sec">🧭 <b>비전트립</b> <span class="nh-sp"></span><button class="nh-btn xs g" data-ladd="visions">＋ 비전트립</button></div>
    <div class="tlist">${(L.visions || []).map((a, i) => `<div class="tl-row"><b style="color:var(--ink-3)">${i + 1}</b><div><b>${esc(a.ref || a.theme || '비전트립')}</b> <span class="ch gray">${esc(a.period || '')}</span><div class="nh-desc" style="margin:4px 0 0">${esc(a.theme || '')}</div></div>
      <div style="display:flex;gap:4px"><button class="nh-btn xs" data-ledit="visions" data-i="${esc(a.id)}">고치기</button><button class="nh-btn xs r" data-ldel="visions" data-i="${esc(a.id)}">빼기</button></div></div>`).join('') || '<div class="nh-desc">아직 없어요.</div>'}</div>
    <div class="nh-sec">🏕 <b>캠프</b> <span class="nh-sp"></span><button class="nh-btn xs g" data-ladd="camps">＋ 캠프</button></div>
    <div class="tlist">${(L.camps || []).map((a, i) => `<div class="tl-row"><b style="color:var(--ink-3)">${i + 1}</b><div><b>${esc(a.ref || a.theme || '캠프')}</b> <span class="ch gray">${esc(a.period || '')}</span><div class="nh-desc" style="margin:4px 0 0">${esc(a.theme || '')}</div></div>
      <div style="display:flex;gap:4px"><button class="nh-btn xs" data-ledit="camps" data-i="${esc(a.id)}">고치기</button><button class="nh-btn xs r" data-ldel="camps" data-i="${esc(a.id)}">빼기</button></div></div>`).join('') || '<div class="nh-desc">아직 없어요.</div>'}</div>`;
}
/* ── 영문 · 용어 ── */
function langHTML(){
  const cfg = A.CFG || {};
  const rep = cfg.rep || [];
  const lv = cfg.levelEn || {};
  const cls = cfg.classEn || {};
  const names0 = Object.keys(C.EN_CLASS).filter(k => k !== '삼마');
  return `<div class="nh-sec">🔁 <b>기본 용어 바꾸기</b> <small>출력본에서 «기본 용어 바꾸기»를 켜면 적용 (원본은 그대로)</small></div>
    <div class="tlist" data-replist>${rep.map((r, i) => `<div class="tl-row"><b style="color:var(--ink-3)">${i + 1}</b><div><b>${esc(r.f)}</b> → <b>${esc(r.t)}</b></div><button class="nh-btn xs r" data-repdel="${i}">빼기</button></div>`).join('') || '<div class="nh-desc">아직 없어요.</div>'}</div>
    <div class="frow" style="align-items:flex-end;margin-top:6px"><div class="fl" style="max-width:200px"><label>바꿀 말</label><input class="nh-in" data-repf placeholder="예: 휴교"></div><div class="fl" style="max-width:200px"><label>새 말</label><input class="nh-in" data-rept placeholder="예: 휴업"></div><button class="nh-btn sm" data-st="repadd">＋ 더하기</button></div>
    <div class="pk" style="margin-bottom:10px">${C.REP_SUGGEST.map(r => `<button class="nh-btn xs" data-repsug="${esc(r.f)}|${esc(r.t)}">${esc(r.f)} → ${esc(r.t)}</button>`).join('')}</div>
    <div class="nh-sec">🌐 <b>영문 5단계 이름</b></div>
    <div class="frow">${C.LEVELS.map(l => `<div class="fl" style="max-width:170px"><label>${esc(l.ko)} (${l.v})</label><input class="nh-in" data-lven="${l.v}" value="${esc(lv[l.v] || l.en)}"></div>`).join('')}</div>
    <div class="nh-sec">🌐 <b>반 영문 이름</b></div>
    <div class="frow">${names0.map(k => `<div class="fl" style="max-width:170px"><label>${esc(k)}반</label><input class="nh-in" data-clsen="${esc(k)}" value="${esc(cls[k] || C.EN_CLASS[k])}"></div>`).join('')}</div>
    <div class="nh-sec">👤 <b>번역 담당</b> <small>번역 표(같은 글은 한 번 번역하면 모두에)를 고칠 수 있는 분 — 나학평 담당은 늘 됨</small></div>
    <div class="frow" style="align-items:center">${peopleChips(cfg.translators || [])}<button class="nh-btn xs" data-st="translators">고르기</button></div>
    <button class="nh-btn p sm" data-st="savelang" style="margin-top:10px">💾 영문 · 용어 저장</button>`;
}
/* ── 🖨 출력 모양 (v144) — 표지 · 속지 · 마지막 확인 칸 (nhpConfig/main.print · 모든 학기 기본) ── */
let PRT = null;
function printSummary(){ const d = C.TH.pick(A.CFG); return `${C.TH.coverOf(d.cover).ko} · 속지 ${C.TH.innerOf(d.inner).ko}${d.sign && d.sign.on ? ' · 확인 칸' : ''}`; }
function sampleDoc(){
  const t = A.TERM || {}; const sec = (t.sections || [])[0] || {};
  return { lang: 'ko', cover: { term: C.termLabel(t) || '2026학년도 2학기', cls: sec.name || '이레반', grade: sec.grade || '1학년', name: '예시 학생', hr: A.staffName(sec.hrUid) || '담임' },
    blocks: [{ id: 'x1', k: 'hr', h: { t: 'hr', name: '담임평가' } }, { id: 'x2', k: 'att', h: { t: 'text', x: '출결' } }, { id: 'x3', k: 'sec', h: { t: 'fixed', key: 'subjects' } }, { id: 'x4', k: 'subj', h: { t: 'subj', name: '교과 1' } }, { id: 'x5', k: 'subj', h: { t: 'subj', name: '교과 2' } }, { id: 'x6', k: 'act', h: { t: 'fixed', key: 'act' } }] };
}
function printPaneHTML(){
  const cur = C.TH.pick(A.CFG);
  PRT = PRT || { cover: cur.cover, inner: ((A.CFG.print || {}).inner) || '', sign: Object.assign({ on: false, title: '학교장', principal: '', dateText: '' }, (A.CFG.print || {}).sign || {}) };
  const doc = sampleDoc();
  const tile = c => `<label class="cv-tile${PRT.cover === c.k ? ' on' : ''}" title="${esc(c.d)}"><input type="radio" name="prt-cover" value="${esc(c.k)}"${PRT.cover === c.k ? ' checked' : ''}>
      <span class="cv-mini">${c.k === 'old' ? `<span class="cv-old"><img src="${esc(A.COVER)}" alt=""><b>${esc(doc.cover.term)}</b><small>${esc(doc.cover.cls)} ${esc(doc.cover.grade)} 이름 : ${esc(doc.cover.name)}</small></span>` : `<span class="np cv-np">${C.TH.coverHTML(doc, c.k, { emblem: A.LOGO, contents: C.TH.contentsOf(doc, C.KEY_HEAD) })}</span>`}</span>
      <b>${esc(c.ko)}</b><small>${esc(c.d)}</small></label>`;
  const autoInner = C.TH.innerForCover(PRT.cover);
  return `<div class="nh-desc">표지와 속지 모양을 골라요 — <b>모든 학기 · 원본 · 출력본</b>에 기본으로 쓰여요 (원본은 «내용»만 보관하므로 모양을 바꿔도 내용은 그대로). 출력 화면과 미리보기에서 이번에만 다른 모양으로 뽑을 수도 있어요.</div>
    <div class="nh-sec">📕 <b>표지</b></div>
    <div class="cv-tiles">${C.TH.COVERS.map(tile).join('')}</div>
    <div class="nh-sec">📄 <b>속지</b> <small>표지를 고르면 어울리는 속지가 저절로 — 따로 고를 수도 있어요</small></div>
    <div class="pk">${[{ k: '', ko: `표지에 맞춤 (지금: ${C.TH.innerOf(autoInner).ko})`, d: '' }].concat(C.TH.INNERS).map(x => `<label class="ck" style="margin-right:14px" title="${esc(x.d || '')}"><input type="radio" name="prt-inner" value="${esc(x.k)}"${(PRT.inner || '') === x.k ? ' checked' : ''}><b>${esc(x.ko)}</b>${x.d ? ` <small style="color:var(--ink-3)">${esc(x.d)}</small>` : ''}</label>`).join('')}</div>
    <div class="nh-sec">✍️ <b>마지막 «확인» 칸</b> <small>«위와 같이 … 학교생활을 평가합니다» · 날짜 · 담임 / 학교장 이름과 도장 자리</small></div>
    <label class="ck"><input type="checkbox" data-prs="on"${PRT.sign.on ? ' checked' : ''}>넣기</label>
    <div class="frow" style="margin-top:6px"><div class="fl" style="max-width:160px"><label>두 번째 이름 칸</label><input class="nh-in" data-prs="title" value="${esc(PRT.sign.title || '학교장')}"></div>
      <div class="fl" style="max-width:200px"><label>이름</label><input class="nh-in" data-prs="principal" value="${esc(PRT.sign.principal || '')}" placeholder="비우면 담임만"></div>
      <div class="fl" style="max-width:240px"><label>날짜 글 (비우면 학기 끝 날짜)</label><input class="nh-in" data-prs="dateText" value="${esc(PRT.sign.dateText || '')}" placeholder="예: 2026년 12월 18일"></div></div>
    <div class="frow" style="margin-top:4px"><button class="nh-btn p sm" data-st="saveprint">💾 출력 모양 저장</button><button class="nh-btn sm" data-st="prtsample">👀 첫 반 첫 학생으로 미리보기</button>
      <span class="nh-desc" style="margin:0">흰 종이 · 선과 글자만 · 가장자리 12mm 안 (최초 C 표지의 띠만 종이 끝까지)</span></div>`;
}
function bindPrint(el){
  const box = el.querySelector('[data-prt]'); if(!box) return;
  box.onchange = e => {
    const x = e.target;
    if(x.name === 'prt-cover'){ PRT.cover = x.value; box.innerHTML = printPaneHTML(); return; }
    if(x.name === 'prt-inner'){ PRT.inner = x.value; return; }
    if(x.dataset.prs){ PRT.sign[x.dataset.prs] = x.type === 'checkbox' ? x.checked : x.value.trim(); }
  };
}
async function savePrint(){
  const patch = { print: { cover: PRT.cover, inner: PRT.inner || '', sign: PRT.sign }, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid };
  try{ await FS.setDoc(FS.doc(A.db, 'nhpConfig', 'main'), patch, { merge: true }); A.CFG.print = patch.print; A.SEL = null; A.toast('출력 모양을 저장했어요 ✓'); PANE = 'print'; rerender(); }
  catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
}
async function printSample(){
  const t = A.TERM; const sec = (t.sections || [])[0]; const sid = sec && (sec.students || [])[0];
  if(!sid) return A.toast('미리볼 학생이 없어요.', 'err');
  window.showLoading && showLoading('예시를 만드는 중…');
  try{
    const doc = await A.liveDoc(sec.id, sid);
    const over = { cover: PRT.cover, inner: PRT.inner || C.TH.innerForCover(PRT.cover) };
    const keep = A.SEL; A.SEL = over;
    const cfg0 = A.CFG.print; A.CFG.print = { cover: PRT.cover, inner: PRT.inner || '', sign: PRT.sign };
    const pages = await A.pagesOf(doc, { draft: true });
    A.CFG.print = cfg0;
    window.hideLoading && hideLoading();
    A.showPages(pages, `예시 — ${esc(doc.cover.name)} (저장 전 모양)`, doc, { draft: true, pageOpt: { draft: true } });
    A.SEL = keep;
  }catch(e){ window.hideLoading && hideLoading(); A.toast('만들지 못했어요 — ' + A.errText(e), 'err'); }
}
function importCardHTML(){
  if(!(A.CU.role === 'super' || A.isMgr)) return '';
  return `<details class="dr" data-pane="import"${PANE === 'import' ? ' open' : ''}><summary>🗂 지난 나학평 가져오기 <small>예전 프로그램에서 옮긴 파일 (7_보관)</small></summary><div class="db" data-imp>${IMP.cardHTML(A)}</div></details>`;
}
function bindImport(el){ const box = el.querySelector('[data-imp]'); if(box) IMP.bind(A, box); }

/* ── 설정 저장 · 동작 ── */
async function saveTerm(patch, msg){
  mine();
  try{ await FS.updateDoc(FS.doc(A.db, 'nhpTerms', A.TERM.id), Object.assign({}, patch, { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid })); Object.assign(A.TERM, patch); if(msg) A.toast(msg); return true; }
  catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); return false; }
}
async function saveReview(R){
  const t = Object.assign({}, A.TERM, { review: R });
  const finAll = C.finAllOf(t, t.sections || []);
  window.showLoading && showLoading('검토관을 모든 칸에 적는 중…');
  try{
    if(!(await saveTerm({ review: R, finAll }))) return;
    const n = await applyReview(Object.assign({}, A.TERM, { review: R }));
    A.toast(`검토 순서를 저장했어요 ✓ (칸 ${n}개 고침)`);
  }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
  window.hideLoading && hideLoading();
  rerender();
}
async function saveLists(patch){
  mine();
  try{ await FS.setDoc(FS.doc(A.db, 'nhpLists', A.TERM.id), Object.assign({ termId: A.TERM.id }, patch), { merge: true }); Object.assign(A.LISTS, patch); A.toast('목록을 저장했어요 ✓'); return true; }
  catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); return false; }
}
function rerender(){ const el = document.getElementById('nh-body'); if(el) render(A, el, PANE); }
async function newCell(sec, kind, name, extra){
  mine();
  const t = A.TERM;
  const ss = A.SUBS.filter(s => s.secId === sec.id && !s.removed);
  let cell;
  if(kind === 'subj'){
    const maxO = ss.filter(s => s.kind === 'subj').reduce((m, s) => Math.max(m, s.order || 100), 99);
    cell = Object.assign({ kind: 'subj', name, order: maxO + 1, type: 'E', setup: C.emptySetup('E'), teacherUids: [], secId: sec.id, termId: t.id, org: C.ORG, studentIds: [] }, extra || {});
  } else cell = specialCell(kind, sec, t.id, (t.hr && t.hr.items) || []);
  const data = finalizeCell(cell, t, sec);
  const ref = FS.doc(FS.collection(A.db, 'nhpSubjects'));
  await FS.setDoc(ref, Object.assign(data, { createdAt: FS.serverTimestamp(), updatedBy: A.CU.uid }));
  return ref.id;
}
function bindSetup(el){
  const t = A.TERM;
  el.querySelectorAll('[data-csec]').forEach(s => s.onchange = () => { SEC = s.value; PANE = 'cells'; rerender(); });
  el.onclick = async e => {
    const b = e.target.closest('button'); if(!b) return;
    const d = b.dataset;
    if(d.st === 'redraw'){ rerender(); return; }
    if(d.st === 'saveprint'){ await savePrint(); return; }
    if(d.st === 'shareall'){ await shareAll(); return; }
    if(d.st === 'prtsample'){ await printSample(); return; }
    if(d.st === 'saveinfo'){
      const p = { due: {} };
      el.querySelectorAll('[data-ti]').forEach(i => { p[i.dataset.ti] = i.value; });
      el.querySelectorAll('[data-td]').forEach(i => { p.due[i.dataset.td] = i.value; });
      if(p.start && p.end && p.start > p.end) return A.toast('시작이 끝보다 뒤예요.', 'err');
      await saveTerm(p, '학기 정보를 저장했어요 ✓'); return;
    }
    if(d.st === 'resync'){ await resyncStudents(); return; }
    if(d.st === 'addsec'){ await addSection(); return; }
    if(d.sstu){ await editSecStudents(d.sstu); return; }
    if(d.st === 'addsubj'){
      const sec = A.secOf(SEC); if(!sec) return;
      const nm = await A.prompt('＋ 과목 더하기', `${esc(C.secLabel(sec))}에 더할 과목 이름`, '', { required: '이름을 넣어 주세요' });
      if(!nm) return;
      try{ const id = await newCell(sec, 'subj', nm.trim()); A.toast('과목을 더했어요 — 맡은 선생님을 정해 주세요.'); PANE = 'cells'; clickWhenReady(`[data-tch="${id}"]`); }
      catch(err){ A.toast('더하지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(d.addk){
      const sec = A.secOf(SEC); if(!sec) return;
      const old = A.SUBS.find(s => s.secId === sec.id && s.kind === d.addk && s.removed);
      try{
        if(old){ await save(old.id, { removed: false }); A.toast('보관해 둔 칸을 다시 꺼냈어요 ✓'); }
        else { await newCell(sec, d.addk); A.toast('칸을 더했어요 ✓'); }
      }catch(err){ A.toast('더하지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(d.st === 'fromtt'){ await fromTimetable(); return; }
    if(d.st === 'inherit'){ await inheritNow(); return; }
    if(d.up || d.dn){
      const ss = A.SUBS.filter(s => s.secId === SEC && !s.removed);
      const i = ss.findIndex(s => s.id === (d.up || d.dn)); const j = d.up ? i - 1 : i + 1;
      if(i < 0 || j < 0 || j >= ss.length) return;
      const a = ss[i], b2 = ss[j];
      let oa = a.order || 0, ob = b2.order || 0; if(oa === ob){ ob = oa + (d.up ? -1 : 1); }
      try{ mine(); const bt = FS.writeBatch(A.db); bt.update(FS.doc(A.db, 'nhpSubjects', a.id), { order: ob }); bt.update(FS.doc(A.db, 'nhpSubjects', b2.id), { order: oa }); await bt.commit(); a.order = ob; b2.order = oa; A.SUBS.sort((x, y) => (x.order || 0) - (y.order || 0)); PANE = 'cells'; rerender(); }
      catch(err){ A.toast('순서를 바꾸지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(d.tch){
      const s = A.subOf(d.tch); if(!s) return;
      if(isLocked(s)) return;
      const r = await pickPeople(A, `${A.subLabel(s)} — 맡은 선생님`, s.teacherUids || [], { help: '여러 분을 고르면 모두 입력할 수 있어요 (같은 칸을 함께 씀).' });
      if(r == null) return;
      const nd = Object.assign({}, s, { teacherUids: r });
      try{ await save(s.id, { teacherUids: r, turn: C.turnOf(nd) }); await applyReview(A.TERM); A.toast('맡은 선생님을 바꿨어요 ✓'); PANE = 'cells'; rerender(); }
      catch(err){ A.toast('바꾸지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(d.cedit){ if(!isLocked(A.subOf(d.cedit))) await editCellName(d.cedit); return; }
    if(d.cstu){ if(!isLocked(A.subOf(d.cstu))) await editCellStudents(d.cstu); return; }
    if(d.cdel){
      const s = A.subOf(d.cdel); if(!s) return;
      const ent = await A.getEntry(s.id, true);
      const n = Object.keys((ent && ent.rows) || {}).length;
      const ok = await A.confirm('칸 빼기', `«${esc(A.subLabel(s))}» 칸을 뺍니다.${n ? `<br><b>이미 ${n}명 입력이 있어요</b> — 지우지 않고 보관해요 (같은 종류 칸을 다시 더하면 돌아와요 · 과목은 «＋ 과목 더하기»가 아니라 나학평 담당에게 되살리기를 부탁하세요).` : ''}`, '빼기', true);
      if(!ok) return;
      try{ await save(s.id, { removed: true, turn: [] }); A.toast('칸을 뺐어요.'); PANE = 'cells'; rerender(); }
      catch(err){ A.toast('빼지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(d.st === 'savehr'){ await saveHr(el); return; }
    if(d.st === 'listeds'){ const r = await pickPeople(A, '공통 목록 담당', t.listEditors || []); if(r != null){ await saveTerm({ listEditors: r }, '목록 담당을 저장했어요 ✓'); PANE = 'lists'; rerender(); } return; }
    if(d.ladd || d.ledit){ await editListItem(d.ladd || d.ledit, d.i); return; }
    if(d.ldel){
      const k = d.ldel; const arr = (A.LISTS[k] || []).filter(x => x.id !== d.i);
      if(!(await A.confirm('목록에서 빼기', '이 항목을 뺄까요? (반마다 체크한 기록은 남아 있어요)', '빼기', true))) return;
      if(await saveLists({ [k]: arr })){ PANE = 'lists'; rerender(); } return;
    }
    if(d.lpaste){ await pasteActivities(); return; }
    if(d.st === 'repadd' || d.repsug){
      let f, tt;
      if(d.repsug){ [f, tt] = d.repsug.split('|'); } else { f = el.querySelector('[data-repf]').value.trim(); tt = el.querySelector('[data-rept]').value.trim(); }
      if(!f) return A.toast('바꿀 말을 넣어 주세요.', 'err');
      A.CFG.rep = (A.CFG.rep || []).filter(r => r.f !== f).concat([{ f, t: tt }]);
      PANE = 'lang'; rerender(); A.toast('«저장»을 누르면 적용돼요.'); return;
    }
    if(d.repdel != null && d.repdel !== undefined && b.hasAttribute('data-repdel')){ A.CFG.rep = (A.CFG.rep || []).filter((r, i) => i !== +d.repdel); PANE = 'lang'; rerender(); return; }
    if(d.st === 'translators'){ const r = await pickPeople(A, '번역 담당', A.CFG.translators || []); if(r != null){ A.CFG.translators = r; PANE = 'lang'; rerender(); A.toast('«저장»을 누르면 적용돼요.'); } return; }
    if(d.st === 'savelang'){
      const lv = {}; el.querySelectorAll('[data-lven]').forEach(i => { lv[i.dataset.lven] = i.value.trim(); });
      const cls = {}; el.querySelectorAll('[data-clsen]').forEach(i => { cls[i.dataset.clsen] = i.value.trim(); });
      const patch = { rep: A.CFG.rep || [], levelEn: lv, classEn: cls, translators: A.CFG.translators || [], updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid };
      try{ await FS.setDoc(FS.doc(A.db, 'nhpConfig', 'main'), patch, { merge: true }); Object.assign(A.CFG, patch); A.toast('저장했어요 ✓'); }
      catch(err){ A.toast('저장하지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
  };
  el.onchange = async e => {
    const x = e.target;
    if(x.dataset.shr){ await changeHomeroom(x.dataset.shr, x.value); return; }
    if(x.dataset.type){
      const s = A.subOf(x.dataset.type); if(!s) return;
      if(isLocked(s)){ x.value = s.type; return; }
      const ok = await A.confirm('평가 방식 바꾸기', `«${esc(A.subLabel(s))}»을(를) <b>${esc(C.TYPES[x.value].ko)}</b>(으)로 바꿀까요?<br>이미 입력한 내용은 지우지 않고 남겨 둬요 (방식을 되돌리면 다시 보여요).`, '바꾸기');
      if(!ok){ x.value = s.type; return; }
      try{ await save(s.id, { type: x.value, setup: C.setupForType(s.setup, x.value) }); A.toast('바꿨어요 ✓'); }
      catch(err){ A.toast('바꾸지 못했어요 — ' + A.errText(err), 'err'); x.value = s.type; }
    }
  };
}
async function changeHomeroom(secId, uid){
  let oldUid = '';
  const secs = await updateSections(list => list.map(s => { if(s.id !== secId) return s; oldUid = s.hrUid || ''; return Object.assign({}, s, { hrUid: uid }); }));
  if(!secs) return;
  const special = A.SUBS.filter(s => s.secId === secId && s.kind !== 'subj' && !s.removed && s.state !== 'done' && (s.teacherUids || []).includes(oldUid));
  let moveSp = false;
  if(special.length && uid) moveSp = await A.confirm('담임이 맡은 칸도 바꿀까요?', `${esc(C.secLabel(A.secOf(secId)))}의 ${special.map(s => esc(A.subLabel(s))).join(', ')} 칸을 ${esc(A.staffName(oldUid) || '예전 담임')} → <b>${esc(A.staffName(uid))}</b> 선생님께 넘길까요?`, '넘기기');
  window.showLoading && showLoading('검토관을 다시 적는 중…');
  try{
    if(moveSp){
      for(const s of special){ const tu = C.uniq((s.teacherUids || []).filter(u => u !== oldUid).concat([uid])); await save(s.id, { teacherUids: tu, turn: C.turnOf(Object.assign({}, s, { teacherUids: tu })) }); }
    }
    const n = await applyReview(A.TERM);
    A.toast(`담임을 바꿨어요 ✓${n ? ` (검토 칸 ${n}개 고침)` : ''}`);
  }catch(e){ A.toast('일부를 고치지 못했어요 — ' + A.errText(e), 'err'); }
  window.hideLoading && hideLoading();
}
async function resyncStudents(){
  const t = A.TERM;
  A.CLASSES = null;
  const cls = (await A.loadClasses()).filter(c => Number(c.year) === Number(t.year) && c.org === C.ORG);
  const fresh = C.sectionsFromClasses(cls, A.STU, s => (window.StuStatus ? StuStatus.enrolled(s) : (s.status || 'active') !== 'quit'));
  const diffs = [];
  const secs = (t.sections || []).map(s => {
    const f = fresh.find(x => x.id === s.id);
    if(!f) return s;
    const add = f.students.filter(x => !(s.students || []).includes(x)), rm = (s.students || []).filter(x => !f.students.includes(x));
    if(add.length || rm.length) diffs.push({ s, add, rm });
    return Object.assign({}, s, { students: f.students.slice() });
  });
  const newSecs = fresh.filter(f => !(t.sections || []).some(s => s.id === f.id));
  if(!diffs.length && !newSecs.length) return A.toast('반편성과 같아요 — 바꿀 것이 없어요.');
  const ok = await A.confirm('반편성에서 학생 다시 맞추기', diffs.map(x => `<b>${esc(C.secLabel(x.s))}</b> ${x.add.length ? `· 새로 ${x.add.map(A.stuName).map(esc).join(', ')}` : ''} ${x.rm.length ? `· 빠짐 ${x.rm.map(A.stuName).map(esc).join(', ')}` : ''}`).join('<br>') +
    (newSecs.length ? `<br><br>반편성에 새 반이 있어요: ${newSecs.map(s => esc(C.secLabel(s))).join(', ')} — «＋ 반 더하기»로 넣을 수 있어요.` : '') +
    '<br><br><span style="color:var(--ink-2)">빠진 학생이 이미 쓴 입력은 지우지 않고 보관해요.</span>', '맞추기');
  if(!ok) return;
  void secs;
  const ok2 = await updateSections(list => list.map(s => { const f = fresh.find(x => x.id === s.id); return f ? Object.assign({}, s, { students: f.students.slice() }) : s; }));
  if(ok2){ A.toast('학생을 다시 맞췄어요 ✓'); PANE = 'secs'; rerender(); }
}
async function addSection(){
  const t = A.TERM;
  A.CLASSES = null;
  const cls = (await A.loadClasses()).filter(c => Number(c.year) === Number(t.year) && c.org === C.ORG);
  const fresh = C.sectionsFromClasses(cls, A.STU, s => (window.StuStatus ? StuStatus.enrolled(s) : (s.status || 'active') !== 'quit')).filter(f => !(t.sections || []).some(s => s.id === f.id));
  if(!fresh.length) return A.toast('반편성에 더할 반이 없어요.');
  const m = A.modal('＋ 반 더하기', fresh.map(s => `<label class="ck" style="display:flex"><input type="checkbox" value="${esc(s.id)}">${esc(C.secLabel(s))} · ${s.students.length}명</label>`).join(''), '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>더하기</button>');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const ids = Array.from(m.box.querySelectorAll('input:checked')).map(i => i.value);
    if(!ids.length) return;
    const add = fresh.filter(f => ids.includes(f.id)).map(s => ({ id: s.id, classId: s.classId, name: s.name, grade: s.grade, gradeNo: s.gradeNo, hrUid: s.hrUid || '', students: s.students.slice() }));
    m.close();
    const secs = await updateSections(list => list.concat(add.filter(a => !list.some(x => x.id === a.id))).sort((a, b) => (a.gradeNo || 99) - (b.gradeNo || 99)));
    if(!secs) return;
    window.showLoading && showLoading('칸을 만드는 중…');
    try{ for(const s of add){ for(const k of ['att', 'parent', 'act', 'book', 'serve']) await newCell(s, k); if(t.hr && t.hr.on) await newCell(s, 'hr'); } A.toast('반을 더했어요 — 과목은 «칸»에서 더하세요.'); }
    catch(e){ A.toast('칸을 만들지 못했어요 — ' + A.errText(e), 'err'); }
    window.hideLoading && hideLoading();
    PANE = 'cells'; SEC = add[0].id; rerender();
  };
}
async function editSecStudents(secId){
  const sec = A.secOf(secId); if(!sec) return;
  const ids = (sec.students || []);
  const m = A.modal(`${esc(C.secLabel(sec))} 학생`, `<div class="nh-desc">이 반 나학평을 쓰는 학생이에요. 반편성과 다르게 빼거나(예: 이 학기 나학평을 쓰지 않는 학생) 더할 수 있어요.</div>
    <div class="stu-chips" data-l>${ids.map(id => `<button class="on" data-sid="${esc(id)}">${esc(A.stuLabel(id))}</button>`).join('')}</div>
    <div class="fl" style="margin-top:12px"><label>학생 더하기 (이름 찾기)</label><input class="nh-in" data-q placeholder="이름"></div><div class="stu-chips" data-r></div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>저장</button>', 'mid');
  const cur = new Set(ids);
  const L = m.box.querySelector('[data-l]'), Rr = m.box.querySelector('[data-r]');
  L.onclick = e => { const b = e.target.closest('[data-sid]'); if(!b) return; b.classList.toggle('on'); if(b.classList.contains('on')) cur.add(b.dataset.sid); else cur.delete(b.dataset.sid); };
  m.box.querySelector('[data-q]').oninput = e => {
    const q = e.target.value.trim(); if(!q){ Rr.innerHTML = ''; return; }
    Rr.innerHTML = Object.values(A.STU).filter(s => s.org === C.ORG && (s.name || '').includes(q) && !cur.has(s.id)).slice(0, 20).map(s => `<button data-add="${esc(s.id)}">＋ ${esc(A.stuLabel(s.id))}</button>`).join('');
  };
  Rr.onclick = e => { const b = e.target.closest('[data-add]'); if(!b) return; cur.add(b.dataset.add); L.insertAdjacentHTML('beforeend', `<button class="on" data-sid="${esc(b.dataset.add)}">${esc(A.stuLabel(b.dataset.add))}</button>`); b.remove(); };
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const secs = await updateSections(list => list.map(s => s.id === secId ? Object.assign({}, s, { students: Array.from(cur) }) : s));
    if(secs){ A.toast('학생을 저장했어요 ✓'); m.close(); PANE = 'secs'; rerender(); }
  };
}
async function editCellName(id){
  const s = A.subOf(id); if(!s) return;
  const m = A.modal(`${esc(A.subLabel(s))} — 이름 · 출력`, `<div class="frow">
      ${s.kind === 'subj' ? `<div class="fl"><label>과목 이름 (나학평 화면)</label><input class="nh-in" data-k="name" value="${esc(s.name || '')}"></div>` : `<div class="fl"><label>칸 이름</label><input class="nh-in" data-k="name" value="${esc(s.name || '')}"></div>`}
      <div class="fl"><label>출력 과목명 (비우면 위와 같음)</label><input class="nh-in" data-k="printName" value="${esc(s.printName || '')}"></div></div>
    <div class="fl"><label>출력 교사 이름 (비우면 맡은 선생님 · 외부 강사 이름 등)</label><input class="nh-in" data-k="printTeacher" value="${esc(s.printTeacher || '')}" placeholder="${esc(names(s.teacherUids).join(', '))}"></div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>저장</button>');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const p = {}; m.box.querySelectorAll('[data-k]').forEach(i => { p[i.dataset.k] = i.value.trim(); });
    if(!p.name) return A.toast('이름을 넣어 주세요.', 'err');
    try{ await save(id, p); m.close(); A.toast('저장했어요 ✓'); PANE = 'cells'; rerender(); }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
  };
}
export async function editCellStudents(id, a){
  if(a) bind(a);
  const s = A.subOf(id); if(!s || isLocked(s)) return;
  const sec = A.secOf(s.secId); if(!sec) return;
  const all = sec.students || [];
  const cur = new Set((s.studentIds || []).length ? s.studentIds : all);
  const m = A.modal(`${esc(A.subLabel(s))} — 듣는 학생`, `<div class="nh-desc">반 일부만 듣는 과목이면 듣는 학생만 남기세요. 모두 고르면 «반 모두»로 저장돼요 (반에 새 학생이 오면 저절로 들어감).</div>
    <div class="frow" style="margin-bottom:8px"><button class="nh-btn xs" data-all>모두</button><button class="nh-btn xs" data-none>모두 빼기</button></div>
    <div class="stu-chips" data-l>${all.map(x => `<button class="${cur.has(x) ? 'on' : ''}" data-sid="${esc(x)}">${esc(A.stuLabel(x))}</button>`).join('')}</div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>저장</button>', 'mid');
  const L = m.box.querySelector('[data-l]');
  L.onclick = e => { const b = e.target.closest('[data-sid]'); if(!b) return; b.classList.toggle('on'); if(b.classList.contains('on')) cur.add(b.dataset.sid); else cur.delete(b.dataset.sid); };
  m.box.querySelector('[data-all]').onclick = () => { all.forEach(x => cur.add(x)); L.querySelectorAll('button').forEach(b => b.classList.add('on')); };
  m.box.querySelector('[data-none]').onclick = () => { cur.clear(); L.querySelectorAll('button').forEach(b => b.classList.remove('on')); };
  m.box.querySelector('[data-c]').onclick = () => m.close();
  return new Promise(res => {
    m.box.querySelector('[data-ok]').onclick = async () => {
      if(!cur.size) return A.toast('한 명 이상 골라 주세요.', 'err');
      const ids = all.every(x => cur.has(x)) ? [] : all.filter(x => cur.has(x));
      try{ await save(id, { studentIds: ids, cnt: { done: (s.cnt || {}).done || 0, total: ids.length || all.length } }); m.close(); A.toast('저장했어요 ✓'); res(true); if(PANE === 'cells') rerender(); }
      catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
    };
  });
}
async function saveHr(el){
  const t = A.TERM;
  const items = el.querySelector('[data-hri]').value.split(',').map(x => x.trim()).filter(Boolean).map(x => ({ id: C.rid('n'), t: x }));
  const want = new Set(Array.from(el.querySelectorAll('[data-hrsec]:checked')).map(i => i.dataset.hrsec));
  window.showLoading && showLoading('담임평가 칸을 맞추는 중…');
  try{
    await saveTerm({ hr: Object.assign({}, t.hr || {}, { on: want.size > 0, items }) });
    for(const sec of (t.sections || [])){
      const cur = A.SUBS.find(s => s.secId === sec.id && s.kind === 'hr');
      if(want.has(sec.id)){
        if(!cur) await newCell(sec, 'hr');
        else if(cur.removed) await save(cur.id, { removed: false, turn: C.turnOf(cur) });
      } else if(cur && !cur.removed) await save(cur.id, { removed: true, turn: [] });
    }
    A.toast('담임평가를 저장했어요 ✓');
  }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
  window.hideLoading && hideLoading();
  PANE = 'hr'; rerender();
}
async function editListItem(k, id){
  const arr = (A.LISTS[k] || []).slice();
  const it = arr.find(x => x.id === id) || null;
  const secs = A.TERM.sections || [];
  let body = '';
  if(k === 'activities'){
    const x = it || { t: '', d: '', c: '', secs: [], def: 'all' };
    body = `<div class="frow"><div class="fl"><label>활동 이름</label><input class="nh-in" data-k="t" value="${esc(x.t)}"></div><div class="fl" style="max-width:220px"><label>일시 (글 그대로 — 예: 2월 10일 ~ 12일)</label><input class="nh-in" data-k="d" value="${esc(x.d || '')}"></div></div>
      <div class="fl"><label>활동 사항</label><textarea class="nh-ta" data-k="c" rows="4">${esc(x.c || '')}</textarea></div>
      <div class="fl"><label>기본 참여</label><select class="nh-sel" data-k="def"><option value="all"${x.def !== 'none' ? ' selected' : ''}>모두 참여 (빠진 학생만 끄기)</option><option value="none"${x.def === 'none' ? ' selected' : ''}>고른 학생만 (예: 강연회 발표자)</option></select></div>
      <div class="fl"><label>대상 반 (아무것도 안 고르면 모든 반)</label><div class="pk">${secs.map(s => `<label class="ck" style="margin-right:12px"><input type="checkbox" data-sec="${esc(s.id)}"${(x.secs || []).includes(s.id) ? ' checked' : ''}>${esc(C.secLabel(s))}</label>`).join('')}</div></div>`;
  } else if(k === 'parentEdu'){
    const x = it || { t: '', d: '', target: 'P' };
    body = `<div class="frow"><div class="fl"><label>교육 및 과제 이름</label><input class="nh-in" data-k="t" value="${esc(x.t)}" placeholder="예: [가정교육]책"></div><div class="fl" style="max-width:240px"><label>날짜 및 기간 (글 그대로)</label><input class="nh-in" data-k="d" value="${esc(x.d || '')}" placeholder="예: 수료여부 · 9월~10월"></div></div>
      <div class="fl"><label>대상</label><select class="nh-sel" data-k="target"><option value="P"${x.target === 'P' ? ' selected' : ''}>부모 (아버지 · 어머니 따로 결과)</option><option value="F"${x.target === 'F' ? ' selected' : ''}>아버지만</option><option value="M"${x.target === 'M' ? ' selected' : ''}>어머니만</option></select></div>`;
  } else {
    const F = k === 'visions' ? [['ref', '구분용 제목 (출력 안 됨)'], ['period', '기간'], ['theme', '주제'], ['pre', '사전 활동'], ['act', '활동 사항'], ['post', '사후 활동'], ['ov', '비전트립 활동 개관']]
      : [['ref', '구분용 제목 (출력 안 됨)'], ['theme', '주제'], ['period', '기간'], ['act', '활동 사항']];
    const x = it || {};
    body = F.map(([f, l]) => (f === 'ref' || f === 'period' || f === 'theme') ? `<div class="fl"><label>${l}</label><input class="nh-in" data-k="${f}" value="${esc(x[f] || '')}"></div>` : `<div class="fl"><label>${l}</label><textarea class="nh-ta" data-k="${f}" rows="3">${esc(x[f] || '')}</textarea></div>`).join('');
  }
  const m = A.modal(it ? '고치기' : '더하기', body, '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>저장</button>', 'mid');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const x = Object.assign({}, it || { id: C.rid('l') });
    m.box.querySelectorAll('[data-k]').forEach(i => { x[i.dataset.k] = i.value.trim ? i.value.trim() : i.value; });
    if(k === 'activities'){ x.secs = Array.from(m.box.querySelectorAll('[data-sec]:checked')).map(i => i.dataset.sec); if(!x.t) return A.toast('활동 이름을 넣어 주세요.', 'err'); if(x.o == null) x.o = arr.length; }
    if(k === 'parentEdu' && !x.t) return A.toast('이름을 넣어 주세요.', 'err');
    const i = arr.findIndex(y => y.id === x.id); if(i >= 0) arr[i] = x; else arr.push(x);
    if(await saveLists({ [k]: arr })){ m.close(); PANE = 'lists'; rerender(); }
  };
}
async function pasteActivities(){
  const v = await A.prompt('특별활동 여러 줄 붙여넣기', '엑셀에서 «활동 이름 | 일시 | 활동 사항» 세 칸을 복사해 붙여넣으세요 (한 줄에 하나)', '', { multi: true, ph: '신년캠프\t2월 10일 ~ 12일\t* 장소: …' });
  if(!v) return;
  const arr = (A.LISTS.activities || []).slice();
  let n = 0;
  v.split(/\r?\n/).map(l => l.split('\t')).filter(c => c[0] && c[0].trim()).forEach(c => { arr.push({ id: C.rid('l'), t: c[0].trim(), d: (c[1] || '').trim(), c: (c[2] || '').trim().replace(/\\n/g, '\n'), secs: [], def: 'all', o: arr.length }); n++; });
  if(n && await saveLists({ activities: arr })){ A.toast(`${n}개 더했어요 ✓`); PANE = 'lists'; rerender(); }
}
async function fromTimetable(){
  const sec = A.secOf(SEC); if(!sec) return;
  let lessons = [];
  try{ const d = await FS.getDoc(FS.doc(A.db, 'timetableLessons', 'main')); lessons = d.exists() ? (d.data().lessons || []) : []; }catch(e){}
  const have = new Set(A.SUBS.filter(s => s.secId === sec.id && s.kind === 'subj').map(s => C.normKey(s.name)));
  const cand = C.subjectsForSection(sec, lessons).filter(x => !have.has(C.normKey(x.name)));
  if(!cand.length) return A.toast('시간표에 이 반의 새 과목이 없어요.');
  const m = A.modal(`📅 시간표에서 새 과목 — ${esc(C.secLabel(sec))}`, cand.map((x, i) => `<label class="ck" style="display:flex"><input type="checkbox" value="${i}" checked>${esc(x.name)} <span class="nh-desc" style="margin:0">${esc(names(x.teacherUids).join(', '))}</span></label>`).join(''), '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>더하기</button>');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const pick = Array.from(m.box.querySelectorAll('input:checked')).map(i => cand[+i.value]);
    m.close();
    try{
      for(const x of pick) await newCell(sec, 'subj', x.name, { teacherUids: x.teacherUids || [], lessonIds: x.lessonIds || [] });   // 맡은 선생님을 넣고 만들어야 검토 순서에서 본인이 빠짐
      A.toast(`${pick.length}과목을 더했어요 ✓`); PANE = 'cells'; rerender();
    }catch(e){ A.toast('더하지 못했어요 — ' + A.errText(e), 'err'); }
  };
}
/* 🔗 v144 같은 과목 모든 반 함께 쓰기 (나학평 담당) — 고른 반의 평가 틀로 맞추고 묶는다
   · 작성 중인 칸만 틀을 바꿈 (검토 중 칸은 묶기만 — 작성 중이 되면 그 칸에서 «↙ 함께 쓰는 틀로 이 칸 바꾸기» · 승인 칸은 그대로)
   · 이미 넣은 5단계 · 서술 · 점수는 같은 글의 항목끼리 이어 준다 */
async function shareAll(){
  const subj = A.SUBS.filter(s => s.kind === 'subj' && !s.removed && !s.grp);
  const by = {}; subj.forEach(s => { const k = C.normKey(s.name); (by[k] = by[k] || { name: s.name, cells: [] }).cells.push(s); });
  const opts = Object.values(by).filter(o => o.cells.length > 1).sort((a, b) => b.cells.length - a.cells.length || a.name.localeCompare(b.name, 'ko'));
  if(!opts.length) return A.toast('두 반 이상에 있는 과목이 없어요.');
  const m = A.modal('🔗 같은 과목 모든 반 함께 쓰기', `<div class="nh-desc">한 과목을 여러 반이 <b>같은 평가 틀</b>로 쓰게 묶어요. 한 곳에서 고치면 묶인 반 모두 바뀌어요 (학생 입력 · 점수는 반마다).</div>
    <div class="frow"><div class="fl"><label>과목</label><select class="nh-sel" data-k="name">${opts.map(o => `<option value="${esc(C.normKey(o.name))}">${esc(o.name)} · ${o.cells.length}반</option>`).join('')}</select></div></div><div data-pv></div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>묶기</button>', 'mid');
  const pv = m.box.querySelector('[data-pv]');
  const draw = () => {
    const o = by[m.box.querySelector('[data-k="name"]').value];
    const best = o.cells.slice().sort((a, b) => ((b.setup || {}).items || []).length - ((a.setup || {}).items || []).length)[0];
    pv.innerHTML = `<div class="fl"><label>이 반의 평가 틀로 맞추기</label><select class="nh-sel" data-k="base">${o.cells.map(s => `<option value="${esc(s.id)}"${s === best ? ' selected' : ''}>${esc(C.secLabel(A.secOf(s.secId)))} · ${esc((C.TYPES[s.type] || C.TYPES.E).short)} · 항목 ${((s.setup || {}).items || []).length}개 · ${esc((s.teacherUids || []).map(A.staffName).join(', ') || '담당 없음')}</option>`).join('')}</select></div>
      <div class="tlist">${o.cells.map(s => `<label class="tl-row" style="cursor:pointer"><input type="checkbox" data-c2="${esc(s.id)}" checked><div><b>${esc(C.secLabel(A.secOf(s.secId)))}</b> ${A.stateChip(s)} <small style="color:var(--ink-3)">항목 ${((s.setup || {}).items || []).length}개${C.shareOf(s, A.SUBS) ? ' · 이미 함께 쓰는 중' : ''}</small></div><span></span></label>`).join('')}</div>
      <div class="nh-info">작성 중인 칸은 고른 반의 틀로 바뀌고(이미 넣은 5단계 · 글은 같은 글의 항목끼리 이어짐), 검토 중인 칸은 묶기만 해요 (작성 중이 되면 그 칸 평가 틀에서 «↙ 함께 쓰는 틀로 이 칸 바꾸기»). 승인된 칸은 그대로 두어요 (다시 연 뒤 묶을 수 있어요).</div>`;
  };
  m.box.querySelector('[data-k="name"]').onchange = draw; draw();
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const baseId = m.box.querySelector('[data-k="base"]').value;
    const pick = Array.from(m.box.querySelectorAll('[data-c2]:checked')).map(i => i.dataset.c2);
    const base = A.subOf(baseId); if(!base) return;
    if(pick.filter(id => id !== baseId).length < 1) return A.toast('함께 쓸 반을 하나 이상 골라 주세요.', 'err');
    m.close();
    const key = 'sh_' + base.id;
    window.showLoading && showLoading('묶는 중…');
    let n = 0, held = 0, locked = 0;
    try{
      mine();
      if(base.state !== 'done') await A.saveSub(base.id, { share: key });   // 승인된 칸이 기준이면 묶음 이름만 빌려 씀 (sh_<id> 로 자동 인식)
      for(const id of pick){
        if(id === baseId) continue;
        const s = A.subOf(id); if(!s) continue;
        if(s.state === 'done'){ locked++; continue; }   // 승인(잠김) 칸은 규칙상 묶음도 못 바꿈 — 다시 연 뒤에
        const patch = { share: key };
        if(s.state === 'draft'){
          const old = s.setup || {}, nu = JSON.parse(JSON.stringify(base.setup || {}));
          patch.setup = nu; if((s.type || 'E') !== (base.type || 'E')) patch.type = base.type || 'E';
          // 입력을 못 읽으면 여기서 멈춤 (빈 입력으로 잘못 알고 틀만 바꾸지 않게)
          const snap = await FS.getDoc(FS.doc(A.db, 'nhpEntries', s.id)); const rows = (snap.exists() && snap.data().rows) || {};
          // 예전 항목 id 의 값도 지우지 않고 남겨 둔다 (틀을 되돌리면 다시 보이게) — 같은 글 항목 · 서술 · 점수 칸은 새 id 로도 이어 줌
          const up = C.remapPatch(rows, old, nu);
          if(Object.keys(up).length) await FS.updateDoc(FS.doc(A.db, 'nhpEntries', s.id), Object.assign(up, { updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }));
        } else held++;
        await save(s.id, patch); n++;
      }
      A.toast(`«${base.name}» ${n + 1}반을 함께 쓰기로 묶었어요 🔗${held ? ` (검토 중 ${held}칸은 묶기만 — 작성 중이 되면 그 칸에서 «↙ 함께 쓰는 틀로 이 칸 바꾸기»)` : ''}${locked ? ` · 승인된 ${locked}칸은 그대로 (다시 연 뒤 묶을 수 있어요)` : ''}`);
    }catch(e){ A.toast('묶지 못했어요 — ' + A.errText(e), 'err'); }
    window.hideLoading && hideLoading();
    PANE = 'cells'; rerender();
  };
}
async function inheritNow(){
  const others = A.TERMS.filter(t => t.id !== A.TERM.id);
  if(!others.length) return A.toast('이어받을 지난 학기가 없어요.');
  const m = A.modal('↩ 지난 학기 평가 틀 이어받기', `<div class="fl"><label>어느 학기에서</label><select class="nh-sel" data-t>${others.map(t => `<option value="${esc(t.id)}">${esc(C.termLabel(t))}${t.src === 'import' ? ' · 옮겨 온 자료' : ''}</option>`).join('')}</select></div>
    <label class="ck"><input type="checkbox" data-all>모든 반 (끄면 지금 고른 반만)</label><br><label class="ck"><input type="checkbox" data-ov>«수업 내용 개관» 글도 가져오기</label>
    <div class="nh-warn" style="margin-top:10px">아직 <b>입력을 시작하지 않은 과목</b>(평가 항목이 비어 있는 과목)에만 넣어요. 이미 항목을 만든 과목은 그대로 둬요.</div>`,
    '<button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok>이어받기</button>');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.querySelector('[data-ok]').onclick = async () => {
    const src = m.box.querySelector('[data-t]').value, all = m.box.querySelector('[data-all]').checked, ov = m.box.querySelector('[data-ov]').checked;
    m.close();
    window.showLoading && showLoading('이어받는 중…');
    try{
      const prev = await prevSetups(src);
      let n = 0;
      for(const s of A.SUBS.filter(x => x.kind === 'subj' && !x.removed && (all || x.secId === SEC) && x.state === 'draft')){
        const st = s.setup || {};
        if((st.items || []).length || (st.score && (st.score.cols || []).length > 1)) continue;
        const sec = A.secOf(s.secId);
        const p = C.findPrev(prev, s.name, sec ? sec.gradeNo : 0);
        const inh = C.inheritSetup(p, { keepOverview: ov });
        if(!inh) continue;
        await save(s.id, { type: inh.type, setup: C.setupForType(inh.setup, inh.type), inheritedFrom: src, printName: s.printName || inh.printName || '' });
        n++;
      }
      A.toast(n ? `${n}과목에 평가 틀을 넣었어요 ✓` : '이어받을 과목이 없었어요 (이름이 같은 과목이 없거나 이미 항목이 있음)');
    }catch(e){ A.toast('이어받지 못했어요 — ' + A.errText(e), 'err'); }
    window.hideLoading && hideLoading();
    PANE = 'cells'; rerender();
  };
}
