/* ═══════════════════════════════════════════════════════════
   👥 groups.js — 반편성 › 조 편성 (v144)
   · 학기마다 «편성»(지혜의 계단 조 · 특별활동 활동조 …)을 만들고, 학년 · 반과 상관없이 학생을 조로 나눈다
   · 조마다: 조 이름 · 조장(★) · 조원 · 담당 선생님(여럿 가능)
   · 끌어 옮기기(컴퓨터) · 눌러 고르고 «여기로»(휴대폰) · «조 없는 학생» · 1학기 편성 가져오기 · 학년 · 남녀 고르게 나누기 · 회의용 인쇄
   · 나학평: 학기 설정 › 칸 › 👥 조별 과목에서 이 편성을 고르면 조마다 칸이 생긴다 (맡은 선생님 = 조 담당)
   · 저장: groupSets/{id} — 고칠 때마다 «지금 서버 값»에 그 동작만 다시 해서 저장 (두 분이 함께 고쳐도 앞의 것이 사라지지 않게)
   ═══════════════════════════════════════════════════════════ */
import { doc, getDoc, setDoc, collection, getDocs, query, where, onSnapshot, runTransaction, serverTimestamp, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = p => (p || '') + Math.random().toString(36).slice(2, 9);
const KINDS = [
  { k: 'wisdom', ko: '지혜의 계단 조', n: 6 },
  { k: 'act', ko: '특별활동 활동조', n: 6 },
  { k: 'custom', ko: '다른 편성', n: 4 },
];
const gradeNo = g => { const m = /(\d+)/.exec(String(g || '')); return m ? +m[1] : 99; };

let X = null;            // class.html 이 넘겨준 것 { db, me(), students(), staff(), classes(), year(), canEdit(), toast() }
let EL = null, ORG = 'daniel', TERM = 0, SETS = [], CUR = null, unSet = null, unList = null, PICK = null, MGRS = [];
const lsGet = (k, d) => { try{ const v = localStorage.getItem(k); return v == null ? d : v; }catch(e){ return d; } };
const lsSet = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };

export async function render(el, ctx){
  X = ctx; EL = el;
  const orgs = X.orgs();
  ORG = orgs.includes(lsGet('grp_org', 'daniel')) ? lsGet('grp_org', 'daniel') : (orgs.includes('daniel') ? 'daniel' : orgs[0]);
  if(!TERM){ const m = new Date().getMonth(); TERM = Number(lsGet('grp_term', '')) || ((m >= 7 || m < 2) ? 2 : 1); }
  try{ const m = await getDoc(doc(X.db, 'config', 'nhpManagers')); MGRS = m.exists() ? (m.data().uids || []) : []; }catch(e){ MGRS = []; }
  el.innerHTML = `<div class="acard"><div class="g-desc">불러오는 중…</div></div>`;
  watchList();
}
export function stop(){ if(unSet){ unSet(); unSet = null; } if(unList){ unList(); unList = null; } }
const canEdit = () => X.canEdit() || MGRS.includes((X.me() || {}).uid);

/* ── 읽기 ── */
function watchList(){
  if(unList) unList();
  const y = X.year();
  unList = onSnapshot(query(collection(X.db, 'groupSets'), where('org', '==', ORG), where('year', '==', y)), snap => {
    SETS = []; snap.forEach(d => SETS.push(Object.assign({ id: d.id }, d.data())));
    SETS.sort((a, b) => (a.term - b.term) || String(a.name).localeCompare(String(b.name), 'ko'));
    const want = lsGet('grp_set_' + y + '_' + TERM, '');
    const here = SETS.filter(s => Number(s.term) === Number(TERM));
    const pick = here.find(s => s.id === want) || (CUR && here.find(s => s.id === CUR.id)) || here[0] || null;
    if(!pick){ if(unSet){ unSet(); unSet = null; } CUR = null; draw(); return; }
    if(!CUR || CUR.id !== pick.id) watchSet(pick.id); else draw();
  }, err => { EL.innerHTML = `<div class="acard"><div class="g-warn">조 편성을 읽지 못했어요 — ${esc(err.code || err.message || '')}. ${/permission/.test(err.code || '') ? '보안 규칙 v38이 게시되었는지 확인해 주세요.' : ''}</div></div>`; });
}
function watchSet(id){
  if(unSet) unSet();
  unSet = onSnapshot(doc(X.db, 'groupSets', id), d => {
    CUR = d.exists() ? Object.assign({ id: d.id }, d.data()) : null;
    lsSet('grp_set_' + X.year() + '_' + TERM, id);
    draw();
  }, () => {});
}

/* ── 학생 · 선생님 ── */
function pool(){
  const cls = X.classes().filter(c => c.org === ORG && Number(c.year) === Number(X.year()));
  const out = [];
  cls.forEach(c => (c.students || []).forEach(sid => {
    const s = X.students().find(x => x.id === sid); if(!s) return;
    const st = window.StuStatus ? StuStatus.status(s) : (s.status || 'active');
    if(['quit', 'grad', 'egrad'].includes(st) || s.status === 'quit') return;
    const g = (c.grades || {})[sid] || ((Array.isArray(c.gradeList) && c.gradeList.length === 1) ? c.gradeList[0] : (c.grade || ''));
    if(!out.find(x => x.id === sid)) out.push({ id: sid, name: s.name || '', gender: s.gender || '', grade: g, gno: gradeNo(g), cls: c.name || '', leave: st === 'leave' });
  }));
  return out.sort((a, b) => a.gno - b.gno || a.name.localeCompare(b.name, 'ko'));
}
const staffName = uid => { const s = X.staff().find(x => x.uid === uid); return s ? (s.name || '') : '(퇴직?)'; };

/* ── 저장 — 동작 하나를 «지금 서버 값»에 다시 해서 ── */
async function apply(op, msg){
  if(!CUR || !canEdit()) return false;
  const ref = doc(X.db, 'groupSets', CUR.id);
  try{
    await runTransaction(X.db, async tx => {
      const snap = await tx.get(ref);
      if(!snap.exists()) throw new Error('편성이 지워졌어요');
      const d = snap.data();
      const groups = JSON.parse(JSON.stringify(d.groups || []));
      const meta = {};
      op(groups, meta, d);
      tx.update(ref, Object.assign({ groups, updatedAt: serverTimestamp(), updatedBy: X.me().uid, updatedByName: X.me().name || '' }, meta));
    });
    if(msg) X.toast(msg, 'ok');
    return true;
  }catch(e){ X.toast('저장하지 못했어요 — ' + (e.message || e.code || e), 'err'); return false; }
}
const take = (groups, sid) => groups.forEach(g => { g.members = (g.members || []).filter(x => x !== sid); if(g.leader === sid) g.leader = ''; });
const moveTo = (sid, gid) => apply(groups => { take(groups, sid); if(gid){ const g = groups.find(x => x.id === gid); if(g) g.members = (g.members || []).concat([sid]); } });

/* ═══ 화면 ═══ */
function draw(){
  if(!EL) return;
  const y = X.year(), ed = canEdit();
  const here = SETS.filter(s => Number(s.term) === Number(TERM));
  const orgs = X.orgs();
  let h = `<div class="acard"><div class="g-top">
      <div><h3 class="actitle" style="margin:0">👥 조 편성 <small style="font-size:12px;color:var(--ts);font-weight:700">${y}학년도</small></h3>
        <div class="g-desc">학년 · 반과 상관없이 학기마다 조를 짜요 (지혜의 계단 · 예배 · 특별활동 활동조 …). 나학평은 이 편성을 가져다 «조마다 칸»을 만들어요.</div></div>
      <span class="g-sp"></span>
      ${orgs.length > 1 ? `<select class="g-sel" data-g="org">${orgs.map(o => `<option value="${o}"${o === ORG ? ' selected' : ''}>${o === 'daniel' ? '다니엘 아마츠' : '지혜빛'}</option>`).join('')}</select>` : ''}
      <select class="g-sel" data-g="term"><option value="1"${TERM === 1 ? ' selected' : ''}>1학기</option><option value="2"${TERM === 2 ? ' selected' : ''}>2학기</option></select>
      <select class="g-sel" data-g="set">${here.map(s => `<option value="${esc(s.id)}"${CUR && CUR.id === s.id ? ' selected' : ''}>${esc(s.name)} · ${(s.groups || []).length}조</option>`).join('') || '<option value="">편성 없음</option>'}</select>
      ${ed ? `<button class="bp g-b" data-g="new">＋ 새 편성</button>` : ''}
    </div></div>`;
  if(!CUR){
    h += `<div class="acard"><p class="empty">${TERM}학기 편성이 아직 없어요.${ed ? '<br>«＋ 새 편성»으로 «지혜의 계단 조»를 만들어 보세요.' : ' (반편성 담당 · 나학평 담당이 만들어요)'}</p></div>`;
    EL.innerHTML = h; bind(); return;
  }
  const P = pool();
  const inG = new Map(); (CUR.groups || []).forEach(g => (g.members || []).forEach(sid => inG.set(sid, g.id)));
  const none = P.filter(s => !inG.has(s.id));
  const gone = [...inG.keys()].filter(sid => !P.find(s => s.id === sid));    // 반편성에서 빠진 학생 (자퇴 · 졸업 · 다른 해)
  const info = sid => P.find(s => s.id === sid) || { id: sid, name: (X.students().find(x => x.id === sid) || {}).name || '(학생 정보 없음)', grade: '', gno: 99, gender: '' };
  const chip = (s, g) => `<span class="g-st${PICK === s.id ? ' on' : ''}${s.leave ? ' lv' : ''}" draggable="${ed}" data-sid="${esc(s.id)}" title="${esc(s.cls || '')} ${esc(s.grade || '')}">${ed ? '<i class="g-hd">⠿</i>' : ''}${g && g.leader === s.id ? '<b class="g-star" title="조장">★</b>' : ''}${esc(s.name)}<small>${esc(String(s.grade || '').replace('학년', ''))}${s.gender ? ' ' + esc(s.gender) : ''}</small>${s.leave ? '<em>휴학</em>' : ''}</span>`;
  const mix = g => { const ms = (g.members || []).map(info); if(!ms.length) return ''; const gs = ms.map(m => m.gno).filter(n => n < 99); const m = ms.filter(x => x.gender === '남').length, f = ms.filter(x => x.gender === '여').length;
    return `${gs.length ? `${Math.min(...gs)}~${Math.max(...gs)}학년` : ''}${m || f ? ` · 남${m} 여${f}` : ''}`; };
  h += `<div class="acard g-bar">
      <b style="font-size:15px;color:var(--gd)">${esc(CUR.name)}</b><span class="g-tag">${esc((KINDS.find(k => k.k === CUR.kind) || KINDS[2]).ko)}</span>
      ${CUR.useAct ? '<span class="g-tag mint">특별활동 활동조로도 씀</span>' : ''}
      <span class="g-sp"></span>
      ${ed ? `${TERM === 2 ? '<button class="bs g-b" data-g="copy1">↩ 1학기 편성 가져오기</button>' : ''}<button class="bs g-b" data-g="auto">⚖ 학년 · 남녀 고르게 나누기</button>` : ''}
      <button class="bs g-b" data-g="print">🖨 회의용 인쇄</button>
      ${ed ? `<button class="bs g-b" data-g="edit">편성 이름 · 조 수</button>` : ''}
    </div>
    ${gone.length ? `<div class="g-warn">반편성에서 빠진 학생 ${gone.length}명이 조에 남아 있어요 (자퇴 · 졸업 · 반 바뀜) — ${gone.map(sid => esc(info(sid).name)).join(', ')}${ed ? ' <button class="bm" data-g="dropgone">조에서 빼기</button>' : ''}</div>` : ''}
    <div class="g-wrap">
      <div class="acard g-pool" data-drop="">
        <div class="g-ph"><b>조 없는 학생</b><span class="g-num">${none.length}</span><span class="g-sp"></span>${ed && PICK && inG.has(PICK) ? '<button class="bm" data-g="here" data-gid="">조에서 빼기</button>' : ''}</div>
        <div class="g-desc" style="margin:2px 0 8px">${ed ? '끌어서 조에 넣어요 · 휴대폰은 학생을 누른 뒤 조의 «＋ 여기로» · 조원을 누르면 «★ 조장으로»' : '보기만 할 수 있어요'} · 새로 온 학생 · 편입생도 여기 나와요</div>
        <div class="g-chips">${none.map(s => chip(s)).join('') || '<span class="g-desc">모두 조에 들어갔어요 👏</span>'}</div>
        <div class="g-desc" style="margin-top:10px">전체 ${P.length}명 · 조에 ${P.length - none.length}명 · 휴학 · 자퇴 · 졸업 학생은 빠져요</div>
      </div>
      <div class="g-grid">${(CUR.groups || []).map(g => `<div class="acard g-card" data-drop="${esc(g.id)}">
          <div class="g-ch"><b${ed ? ` data-g="rename" data-gid="${esc(g.id)}" style="cursor:pointer" title="이름 바꾸기"` : ''}>${esc(g.name)}</b><span class="g-num">${(g.members || []).length}명</span><span class="g-mix">${esc(mix(g))}</span>
            <span class="g-sp"></span>${ed && PICK && (g.members || []).includes(PICK) ? `<button class="bm" data-g="lead" data-gid="${esc(g.id)}">${g.leader === PICK ? '★ 조장 풀기' : '★ 조장으로'}</button>` : ''}${ed && PICK && !(g.members || []).includes(PICK) ? `<button class="bm" data-g="here" data-gid="${esc(g.id)}">＋ 여기로</button>` : ''}${ed && !(g.members || []).length ? `<button class="bm" style="background:var(--danger-bg);color:var(--danger)" data-g="delgrp" data-gid="${esc(g.id)}">빼기</button>` : ''}</div>
          <div class="g-tch"><span>담당</span>${(g.teachers || []).map(u => `<span class="g-t">${esc(staffName(u))}${ed ? `<i data-g="untch" data-gid="${esc(g.id)}" data-uid="${esc(u)}" title="빼기">✕</i>` : ''}</span>`).join('') || '<span class="g-desc" style="margin:0">아직 없음</span>'}${ed ? `<button class="bm" data-g="tch" data-gid="${esc(g.id)}">＋</button>` : ''}</div>
          <div class="g-chips">${(g.members || []).map(info).sort((a, b) => (g.leader === b.id) - (g.leader === a.id) || a.gno - b.gno || a.name.localeCompare(b.name, 'ko')).map(s => chip(s, g)).join('') || '<span class="g-desc">끌어 넣어요</span>'}</div>
        </div>`).join('')}
        ${ed ? `<button class="g-add" data-g="addgrp">＋ 조 더하기</button>` : ''}</div>
    </div>
    <div class="acard g-link"><b>📒 나학평 연결</b><div class="g-desc" style="margin:4px 0 0">나학평 › ⚙️ 학기 설정 › 🧩 칸 › <b>👥 조별 과목</b>에서 이 편성을 고르면 «지혜의 계단» · «예배» 칸이 <b>조마다 하나씩</b> 생겨요 (맡은 선생님 = 조 담당). 조를 바꾼 뒤에는 나학평에서 <b>«🔄 조 편성에서 다시 맞추기»</b>를 눌러 주세요 — 이미 쓴 내용은 학생을 따라 옮겨져요.</div></div>`;
  EL.innerHTML = h;
  bind();
}
function bind(){
  EL.onchange = e => {
    const d = e.target.dataset;
    if(d.g === 'org'){ ORG = e.target.value; lsSet('grp_org', ORG); CUR = null; watchList(); }
    if(d.g === 'term'){ TERM = Number(e.target.value); lsSet('grp_term', TERM); CUR = null; watchList(); }
    if(d.g === 'set'){ if(e.target.value) watchSet(e.target.value); }
  };
  EL.onclick = async e => {
    const t = e.target.closest('[data-g],[data-sid]'); if(!t) return;
    const d = t.dataset, ed = canEdit();
    if(d.sid && !d.g){ if(!ed) return; PICK = PICK === d.sid ? null : d.sid; draw(); return; }
    if(d.g === 'new') return newSet();
    if(d.g === 'edit') return editSet();
    if(d.g === 'print') return printSet();
    if(d.g === 'auto') return autoSplit();
    if(d.g === 'copy1') return copyFirst();
    if(d.g === 'here'){ const sid = PICK; PICK = null; await moveTo(sid, d.gid || null); return; }
    if(d.g === 'lead'){ const sid = PICK; PICK = null; await apply(groups => { const g = groups.find(x => x.id === d.gid); if(g) g.leader = g.leader === sid ? '' : sid; }, '조장을 바꿨어요 ★'); return; }
    if(d.g === 'addgrp'){ await apply(groups => groups.push({ id: rid('g'), name: `${groups.length + 1}조`, leader: '', members: [], teachers: [] })); return; }
    if(d.g === 'delgrp'){ await apply(groups => { const i = groups.findIndex(g => g.id === d.gid); if(i >= 0 && !(groups[i].members || []).length) groups.splice(i, 1); }); return; }
    if(d.g === 'rename'){ const g = (CUR.groups || []).find(x => x.id === d.gid); const v = prompt('조 이름', g ? g.name : ''); if(v && v.trim()) await apply(groups => { const x = groups.find(y => y.id === d.gid); if(x) x.name = v.trim(); }); return; }
    if(d.g === 'tch') return pickTeachers(d.gid);
    if(d.g === 'untch'){ await apply(groups => { const x = groups.find(y => y.id === d.gid); if(x) x.teachers = (x.teachers || []).filter(u => u !== d.uid); }); return; }
    if(d.g === 'dropgone'){ const P = new Set(pool().map(s => s.id)); await apply(groups => groups.forEach(g => { g.members = (g.members || []).filter(x => P.has(x)); if(g.leader && !P.has(g.leader)) g.leader = ''; }), '빠진 학생을 조에서 뺐어요'); return; }
  };
  // 끌어 옮기기
  EL.ondragstart = e => { const c = e.target.closest('[data-sid]'); if(!c || !canEdit()) return; e.dataTransfer.setData('text/plain', c.dataset.sid); e.dataTransfer.effectAllowed = 'move'; };
  EL.ondragover = e => { const z = e.target.closest('[data-drop]'); if(!z || !canEdit()) return; e.preventDefault(); z.classList.add('ov'); };
  EL.ondragleave = e => { const z = e.target.closest('[data-drop]'); if(z) z.classList.remove('ov'); };
  EL.ondrop = async e => { const z = e.target.closest('[data-drop]'); if(!z || !canEdit()) return; e.preventDefault(); z.classList.remove('ov'); const sid = e.dataTransfer.getData('text/plain'); if(sid) await moveTo(sid, z.dataset.drop || null); };
}

/* ── 새 편성 · 고치기 ── */
function modal(title, body, onOk, okLabel){
  const w = document.createElement('div');
  w.className = 'mov';
  w.innerHTML = `<div class="mbk"></div><div class="mbox" style="max-width:560px"><div class="mtitle">${title}</div>${body}<div class="mact"><button class="bs" data-x>취소</button><button class="bp" data-ok>${esc(okLabel || '저장')}</button></div></div>`;
  document.body.appendChild(w);
  const close = () => w.remove();
  w.querySelector('.mbk').onclick = close; w.querySelector('[data-x]').onclick = close;
  w.querySelector('[data-ok]').onclick = async () => { if(await onOk(w) !== false) close(); };
  return w;
}
function newSet(){
  modal('＋ 새 편성', `<div class="msub">${X.year()}학년도 ${TERM}학기 · ${ORG === 'daniel' ? '다니엘 아마츠' : '지혜빛'}</div>
    <div class="fgrp" style="margin-bottom:10px"><label>종류</label><select data-k="kind">${KINDS.map(k => `<option value="${k.k}">${k.ko}</option>`).join('')}</select></div>
    <div class="fgrp" style="margin-bottom:10px"><label>편성 이름</label><input data-k="name" value="지혜의 계단 조"></div>
    <div class="fgrp" style="margin-bottom:10px"><label>조 수</label><input data-k="n" type="number" min="1" max="30" value="6"></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" data-k="useAct">특별활동 «활동조»로도 씀 (나학평 특별활동 제목 옆에 «활동조 3조»)</label>`, async w => {
    const name = w.querySelector('[data-k="name"]').value.trim(); const n = Math.max(1, Math.min(30, Number(w.querySelector('[data-k="n"]').value) || 6));
    if(!name){ X.toast('이름을 넣어 주세요', 'err'); return false; }
    const id = `${ORG}_${X.year()}_${TERM}_${rid('')}`;
    const data = { org: ORG, year: X.year(), term: TERM, kind: w.querySelector('[data-k="kind"]').value, name, useAct: w.querySelector('[data-k="useAct"]').checked,
      groups: Array.from({ length: n }, (_, i) => ({ id: rid('g'), name: `${i + 1}조`, leader: '', members: [], teachers: [] })),
      createdAt: serverTimestamp(), createdBy: X.me().uid, updatedAt: serverTimestamp(), updatedBy: X.me().uid };
    try{ await setDoc(doc(X.db, 'groupSets', id), data); lsSet('grp_set_' + X.year() + '_' + TERM, id); X.toast('편성을 만들었어요 ✓', 'ok'); watchSet(id); }
    catch(e){ X.toast('만들지 못했어요 — ' + (e.code || e.message), 'err'); return false; }
  }, '만들기');
  const sel = document.querySelector('.mov [data-k="kind"]'), nm = document.querySelector('.mov [data-k="name"]'), ua = document.querySelector('.mov [data-k="useAct"]');
  if(sel) sel.onchange = () => { const k = KINDS.find(x => x.k === sel.value); if(k && k.k !== 'custom') nm.value = k.ko; ua.checked = sel.value === 'act'; };
}
function editSet(){
  modal('편성 이름 · 조 수', `<div class="fgrp" style="margin-bottom:10px"><label>편성 이름</label><input data-k="name" value="${esc(CUR.name)}"></div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:10px"><input type="checkbox" data-k="useAct"${CUR.useAct ? ' checked' : ''}>특별활동 «활동조»로도 씀</label>
    <div class="g-desc">조를 더하려면 «＋ 조 더하기», 빼려면 조원을 모두 옮긴 뒤 그 조의 «빼기».</div>
    <div style="margin-top:14px;border-top:1px solid var(--ivd);padding-top:10px"><button class="bd" data-del style="padding:8px 14px;font-size:13px">이 편성 지우기</button> <span class="g-desc">나학평 조별 칸이 쓰고 있으면 먼저 나학평에서 정리해 주세요</span></div>`, async w => {
    const name = w.querySelector('[data-k="name"]').value.trim(); if(!name){ X.toast('이름을 넣어 주세요', 'err'); return false; }
    const ua = w.querySelector('[data-k="useAct"]').checked;
    return apply((groups, meta) => { meta.name = name; meta.useAct = ua; }, '저장했어요 ✓');
  });
  const del = document.querySelector('.mov [data-del]');
  if(del) del.onclick = async () => {
    if(!confirm(`«${CUR.name}» 편성을 지울까요? (되돌릴 수 없어요)`)) return;
    try{ await deleteDoc(doc(X.db, 'groupSets', CUR.id)); document.querySelector('.mov').remove(); CUR = null; X.toast('지웠어요', 'ok'); }catch(e){ X.toast('지우지 못했어요 — ' + (e.code || e.message), 'err'); }
  };
}
function pickTeachers(gid){
  const g = (CUR.groups || []).find(x => x.id === gid); if(!g) return;
  const sel = new Set(g.teachers || []);
  const list = X.staff().filter(s => (s.acStatus || 'active') !== 'quit' && !s.noAuth && ((s.orgs && s.orgs.length ? s.orgs : [s.org]).includes(ORG) || s.role === 'super'))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  const w = modal(`${esc(g.name)} — 담당 선생님`, `<div class="msub">여러 분을 고르면 모두 이 조 칸을 입력할 수 있어요</div><input data-q placeholder="이름 찾기" style="width:100%;height:38px;border:1.5px solid var(--ivd);border-radius:8px;padding:0 10px;margin-bottom:8px">
    <div data-l style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 10px;max-height:50vh;overflow:auto"></div>`, async () => {
    const ids = [...sel];
    return apply(groups => { const x = groups.find(y => y.id === gid); if(x) x.teachers = ids; }, '담당을 저장했어요 ✓');
  }, '고르기');
  const L = w.querySelector('[data-l]');
  const drawL = () => { const q = w.querySelector('[data-q]').value.trim();
    L.innerHTML = list.filter(s => !q || String(s.name || '').includes(q)).map(s => `<label style="display:flex;gap:6px;align-items:center;font-size:13px;padding:3px 0"><input type="checkbox" value="${esc(s.uid)}"${sel.has(s.uid) ? ' checked' : ''}>${esc(s.name)}<small style="color:var(--tl)">${s.role === 'partner' ? '협력' : ''}</small></label>`).join(''); };
  L.onchange = e => { if(e.target.checked) sel.add(e.target.value); else sel.delete(e.target.value); };
  w.querySelector('[data-q]').oninput = drawL; drawL();
}
/* ⚖ 학년 · 남녀 고르게 — 학년 → 성별 순으로 줄 세운 뒤 뱀 모양으로 나눠 담는다 (회의 초안) */
export function balance(students, n, keep){
  const groups = Array.from({ length: n }, () => []);
  const cnt = keep ? keep.map(x => x.length) : Array(n).fill(0);
  const order = students.slice().sort((a, b) => a.gno - b.gno || String(a.gender).localeCompare(String(b.gender)) || String(a.name).localeCompare(String(b.name), 'ko'));
  let dir = 1, i = 0;
  // 이미 사람이 든 조가 있으면 적은 조부터
  const start = () => cnt.indexOf(Math.min(...cnt));
  if(keep) i = start();
  order.forEach(s => {
    groups[i].push(s.id); cnt[i]++;
    if(keep){ i = start(); return; }
    i += dir; if(i >= n){ i = n - 1; dir = -1; } else if(i < 0){ i = 0; dir = 1; }
  });
  return groups;
}
function autoSplit(){
  const P = pool(); const G = CUR.groups || [];
  if(!G.length) return X.toast('조를 먼저 더해 주세요', 'err');
  modal('⚖ 학년 · 남녀 고르게 나누기', `<div class="msub">회의 전에 쓰는 초안이에요 — 나눈 뒤 끌어서 고치면 돼요.</div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:6px"><input type="radio" name="am" value="none" checked>조 없는 학생만 나눠 넣기 (지금 조는 그대로)</label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="radio" name="am" value="all">모두 처음부터 다시 나누기 (조장 · 담당은 그대로)</label>`, async w => {
    const all = w.querySelector('input[name="am"]:checked').value === 'all';
    return apply(groups => {
      const n = groups.length; if(!n) return;
      if(all){ const res = balance(P, n); groups.forEach((g, i) => { g.members = res[i]; if(g.leader && !g.members.includes(g.leader)) g.leader = ''; }); }
      else { const inG = new Set(groups.flatMap(g => g.members || [])); const rest = P.filter(s => !inG.has(s.id)); const res = balance(rest, n, groups.map(g => g.members || [])); groups.forEach((g, i) => { g.members = (g.members || []).concat(res[i]); }); }
    }, '나눴어요 — 끌어서 고칠 수 있어요');
  }, '나누기');
}
async function copyFirst(){
  const first = SETS.filter(s => Number(s.term) === 1 && (s.kind === CUR.kind || s.name === CUR.name));
  if(!first.length) return X.toast('1학기에 같은 종류의 편성이 없어요', 'err');
  const src = first[0];
  if((CUR.groups || []).some(g => (g.members || []).length) && !confirm(`지금 조를 «${src.name}» (1학기)와 같게 바꿀까요? 지금 조원은 모두 바뀌어요.`)) return;
  const P = new Set(pool().map(s => s.id));
  await apply(groups => {
    groups.length = 0;
    (src.groups || []).forEach(g => groups.push({ id: rid('g'), name: g.name, leader: '', members: (g.members || []).filter(x => P.has(x)), teachers: (g.teachers || []).slice() }));
  }, '1학기 편성을 가져왔어요 — 조장은 다시 정해 주세요');
}
function printSet(){
  const info = sid => pool().find(s => s.id === sid) || { id: sid, name: (X.students().find(x => x.id === sid) || {}).name || '', grade: '', gender: '' };
  const body = (CUR.groups || []).map(g => `<section><h2>${esc(g.name)} <small>${(g.members || []).length}명</small></h2><p class="t">담당 ${esc((g.teachers || []).map(staffName).join(', ') || '—')}</p>
    <table>${(g.members || []).map(info).sort((a, b) => (g.leader === b.id) - (g.leader === a.id) || gradeNo(a.grade) - gradeNo(b.grade)).map(s => `<tr><td>${g.leader === s.id ? '★ ' : ''}${esc(s.name)}</td><td>${esc(s.grade || '')}</td><td>${esc(s.gender || '')}</td></tr>`).join('')}</table></section>`).join('');
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(CUR.name)}</title><style>
    @page{size:A4;margin:14mm}body{font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#1F2320}h1{font-size:18px;margin:0 0 4px}p.s{margin:0 0 14px;color:#5A6560;font-size:12px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}section{border:1px solid #C9D6D0;border-radius:6px;padding:8px 10px;break-inside:avoid}h2{font-size:14px;margin:0;color:#1E3932}h2 small{font-size:11px;color:#5A6560}
    p.t{font-size:11px;color:#00704A;margin:2px 0 6px}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:3px 2px;border-top:1px solid #E3E1DA}td:nth-child(n+2){color:#5A6560;width:48px}
  </style></head><body><h1>${esc(CUR.name)}</h1><p class="s">${X.year()}학년도 ${TERM}학기 · ★ 조장</p><div class="grid">${body}</div></body></html>`);
  f.contentDocument.close();
  setTimeout(() => { try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(() => f.remove(), 2000); }, 300);
}
export const CSS = `
.g-top{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
.g-sp{flex:1}
.g-desc{font-size:12.5px;color:var(--ts);line-height:1.6;margin-top:4px}
.g-warn{background:var(--warn-bg);color:var(--warn);border-radius:10px;padding:10px 14px;font-size:12.5px;margin-bottom:12px;line-height:1.6}
.g-sel{height:38px;border:1.5px solid var(--ivd);border-radius:8px;padding:0 10px;font-size:13px;background:var(--wh);font-family:inherit}
.g-b{padding:8px 14px!important;font-size:13px!important}
.g-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:14px 18px!important}
.g-tag{font-size:11px;font-weight:700;padding:2px 9px;border-radius:100px;background:var(--goldp);color:var(--goldd)}
.g-tag.mint{background:var(--gp);color:var(--gm)}
.g-wrap{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px;align-items:start}
.g-pool{position:sticky;top:10px}
.g-ph,.g-ch{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.g-ch b{font-size:15px;color:var(--gd)}
.g-num{font-size:11px;font-weight:800;color:var(--gm);background:var(--gp);border-radius:100px;padding:1px 8px}
.g-mix{font-size:11.5px;color:var(--ts)}
.g-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;align-items:start}
.g-card{margin:0!important;padding:14px 16px!important;min-height:150px;border:1.5px solid transparent}
.g-card.ov,.g-pool.ov{border-color:var(--gm);background:var(--gp)}
.g-tch{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:8px 0;padding-bottom:8px;border-bottom:1px solid var(--ivd);font-size:12px}
.g-tch>span:first-child{font-weight:800;color:var(--ts);font-size:11px}
.g-t{display:inline-flex;align-items:center;gap:4px;background:var(--goldp);color:var(--goldd);border-radius:100px;padding:2px 9px;font-weight:700}
.g-t i{font-style:normal;cursor:pointer;opacity:.7}
.g-chips{display:flex;flex-wrap:wrap;gap:6px}
.g-st{display:inline-flex;align-items:center;gap:5px;background:var(--wh);border:1px solid var(--ivd);border-radius:100px;padding:4px 10px;font-size:13px;cursor:pointer;user-select:none}
.g-st small{font-size:10.5px;color:var(--tl)}
.g-st em{font-style:normal;font-size:10px;color:var(--warn);font-weight:700}
.g-st.lv{border-style:dashed}
.g-st.on{border-color:var(--gm);background:var(--gp);box-shadow:0 0 0 2px #9CCBB6}
.g-hd{font-style:normal;color:var(--tl);font-size:11px;cursor:grab}
.g-star{color:#B08D3C}
.g-add{border:1.5px dashed var(--ivd);background:transparent;border-radius:12px;min-height:150px;font-size:14px;font-weight:700;color:var(--gm);cursor:pointer;font-family:inherit}
.g-link{border-left:4px solid var(--gm)}
@media (max-width:820px){ .g-wrap{grid-template-columns:1fr} .g-pool{position:static} }
`;
