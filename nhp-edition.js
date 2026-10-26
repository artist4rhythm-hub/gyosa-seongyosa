/* ═══════════════════════════════════════════════════════════
   🖍 nhp-edition.js — 나학평 출력본 (가리기 · 부분 수정 · 용어 바꾸기 · 영문판) · v141 · v144 고른 속지 모양으로 보기
   · 원본(확정한 원본 · 옮겨 온 지난 나학평 · 지금 입력)은 그대로 — 출력본에는 «바꾼 것»만 따로 저장한다
   · 문서의 글을 누르면: 고치기 · 원래대로 · 이 줄 가리기 · (영문) 번역 표에 저장
   · 영문판: 고정 문구 · 날짜 · 반 이름은 저절로, 내용은 번역 표(같은 글은 한 번 번역하면 모두)
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null;
let SRC = null, SRCDOC = null, ED = null, EDS = [], GL = {}, GLT = {}, GLC = {}, EL = null, OUT = null, DIRTY = false, CANGL = false, KEY = '';
const bind = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

/* key: «live:반id:학생id» 또는 «past:원본id» · edId: 열 출력본 */
export async function render(a, el, key, edId){
  bind(a);
  EL = el; KEY = key; DIRTY = false;
  el.innerHTML = '<div class="nh-desc">원본을 여는 중…</div>';
  try{ await loadSource(key); }
  catch(e){ el.innerHTML = `<div class="nh-warn">원본을 열지 못했어요 — ${esc(A.errText(e))}</div>`; return; }
  CANGL = A.isMgr || ((A.CFG && A.CFG.translators) || []).includes(A.CU.uid);
  await loadGloss();
  await loadEditions();
  ED = EDS.find(x => x.id === edId) || null;
  draw();
}
async function loadSource(key){
  const [kind, x, y] = key.split(':');
  if(kind === 'past'){
    const d = await FS.getDoc(FS.doc(A.db, 'nhpReports', x));
    if(!d.exists()) throw new Error('원본이 없어요');
    const r = d.data();
    SRC = { type: 'report', reportId: x, termId: r.termId, sid: r.sid || '', secId: r.secId || '', label: `🔒 원본${r.ver > 1 ? ' v' + r.ver : ''}${r.src === 'import' ? ' · 예전 나학평에서 옮김' : ''}`, stuName: r.stuName || '' };
    SRCDOC = r.doc;
    return;
  }
  // 지금 학기 — 확정한 원본이 있으면 그것, 없으면 지금 입력
  const secId = x, sid = y;
  let rep = null;
  try{
    const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpReports'), FS.where('termId', '==', A.TERM.id), FS.where('sid', '==', sid)));
    q.forEach(d => { const r = d.data(); if(!r.superseded && (!rep || (r.ver || 1) > (rep.ver || 1))) rep = Object.assign({ id: d.id }, r); });
  }catch(e){}
  if(rep){ SRC = { type: 'report', reportId: rep.id, termId: rep.termId, sid, secId, label: `🔒 확정한 원본${rep.ver > 1 ? ' v' + rep.ver : ''}`, stuName: rep.stuName || '' }; SRCDOC = rep.doc; return; }
  SRC = { type: 'live', termId: A.TERM.id, sid, secId, label: '✏️ 지금 입력 (원본 확정 전)', stuName: A.stuName(sid) };
  SRCDOC = await A.liveDoc(secId, sid);
}
async function loadGloss(){
  GLT = {}; GLC = {};
  try{ const d = await FS.getDoc(FS.doc(A.db, 'nhpGlossary', SRC.termId)); GLT = d.exists() ? (d.data().map || {}) : {}; }catch(e){}
  try{ const d = await FS.getDoc(FS.doc(A.db, 'nhpGlossary', '_common')); GLC = d.exists() ? (d.data().map || {}) : {}; }catch(e){}
  GL = Object.assign({}, GLC, GLT);
}
async function loadEditions(){
  EDS = [];
  try{
    const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpEditions'), FS.where('termId', '==', SRC.termId), FS.where('sid', '==', SRC.sid || ('?' + (SRC.reportId || '')))));
    q.forEach(d => EDS.push(Object.assign({ id: d.id }, d.data())));
  }catch(e){}
  // 원본에 매단 출력본도 (학생 잇기를 나중에 고쳐도 그대로 보이게)
  if(SRC.reportId){
    try{ const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpEditions'), FS.where('reportId', '==', SRC.reportId))); q.forEach(d => { if(!EDS.find(x => x.id === d.id)) EDS.push(Object.assign({ id: d.id }, d.data())); }); }catch(e){}
  }
  EDS.sort((a, b) => ((b.updatedAt && b.updatedAt.seconds) || 0) - ((a.updatedAt && a.updatedAt.seconds) || 0));
}
function translator(){
  const names = {};
  Object.values(GL).forEach(g => { if(g && g.k && g.e) names[C.norm(g.k)] = g.e; });
  return C.makeTranslator({ gloss: GL, names, classes: (A.CFG && A.CFG.classEn) || {} });
}
function compute(){
  // 출력본을 고르지 않았으면 원본 그대로 (기본 용어 바꾸기도 쓰지 않음)
  const ed = ED || { lang: 'ko', ov: {}, hide: {}, rep: [], useRep: false };
  const stu = A.STU[SRC.sid] || {};
  OUT = C.applyEdition(SRCDOC, Object.assign({}, ed, { nameEn: ed.nameEn || stu.nameEn || '' }), { tr: translator(), rep: (A.CFG && A.CFG.rep) || [], levelEn: (A.CFG && A.CFG.levelEn) || {} });
  return OUT;
}

/* ── 화면 ── */
function draw(){
  const doc = compute();
  const ed = ED;
  const nOv = ed ? Object.keys(ed.ov || {}).length : 0, nHide = ed ? Object.keys(ed.hide || {}).length : 0;
  EL.innerHTML = `<div style="margin-bottom:10px"><button class="nh-btn sm ghost" data-ed="back">← 돌아가기</button></div>
    <div class="ed-grid"><div>
      <div class="pv-bar"><b style="font-size:15px">${esc(SRCDOC.cover && SRCDOC.cover.name || SRC.stuName || '')}</b><span class="ch gray">${esc(SRCDOC.cover && SRCDOC.cover.term || '')}</span><span class="ch mint">${esc(SRC.label)}</span>
        <span class="nh-sp"></span>${ed ? `<span class="ch ${ed.lang === 'en' ? 'info' : 'gray'}">${ed.lang === 'en' ? '🌐 English' : '한글'}</span>` : '<span class="ch warn">원본 그대로 보는 중</span>'}
        <button class="nh-btn sm g" data-ed="pages">👀 쪽 보기 · PDF</button></div>
      ${ed ? `<div class="nh-desc">글을 누르면 고치거나 가릴 수 있어요. <span class="ch ovr" style="background:#E9F7EF">고친 글</span> ${ed.lang === 'en' ? '<span class="ch" style="background:#FFF4C2;color:#7A5A00">번역 안 된 글</span>' : ''} — 원본은 바뀌지 않아요.</div>` : '<div class="nh-info">오른쪽에서 <b>«＋ 새 출력본»</b>을 만들면 원본을 그대로 둔 채 가리기 · 고치기 · 영문판을 할 수 있어요.</div>'}
      <div class="nr-wrap" id="ed-doc">${coverMini(doc)}${C.docHTML(doc, { edit: !!ed, theme: A.design().inner, shade: A.design().shade })}</div>
    </div>
    <aside class="ed-side">${sideHTML(doc, nOv, nHide)}</aside></div>`;
  EL.onclick = onClick; EL.onchange = onChange;
}
function coverMini(doc){
  const cv = doc.cover || {};
  return `<div style="border:1px dashed #C9CFCB;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
    <b>${doc.lang === 'en' ? 'Cover' : '표지'}</b><span ${ED ? 'data-cv="cv.term" style="cursor:pointer"' : ''}>${esc(cv.term || '')}</span><span ${ED ? 'data-cv="cv.cls" style="cursor:pointer"' : ''}>${esc(cv.cls || '')}</span><span ${ED ? 'data-cv="cv.grade" style="cursor:pointer"' : ''}>${esc(cv.grade || '')}</span><b ${ED ? 'data-cv="cv.name" style="cursor:pointer"' : ''}>${esc(cv.name || '')}</b></div>`;
}
function sideHTML(doc, nOv, nHide){
  const ed = ED;
  let h = `<div class="fl"><label>출력본</label><select class="nh-sel" data-edsel><option value="">— 원본 그대로 —</option>${EDS.map(x => `<option value="${esc(x.id)}"${ed && ed.id === x.id ? ' selected' : ''}>${x.lang === 'en' ? '🌐 ' : ''}${esc(x.name || '이름 없음')} · ${esc(x.ownerName || '')}</option>`).join('')}</select></div>
    <div class="frow"><button class="nh-btn sm g" data-ed="new" data-lang="ko">＋ 새 출력본 (한글)</button><button class="nh-btn sm" data-ed="new" data-lang="en">＋ 영문판</button></div>`;
  if(!ed) return h + `<div class="nh-desc" style="margin-top:12px">· 한글 출력본: 용어 바꾸기(예: 휴교 → 휴업) · 일부 줄 가리기 · 몇 글자 고치기<br>· 영문판: 해외 학교 제출용 — 고정 문구는 저절로 영어, 내용은 번역 표에서</div>`;
  const mine = ed.ownerUid === A.CU.uid || A.isMgr;
  h += `<hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
    <div class="fl"><label>출력본 이름</label><input class="nh-in" data-ef="name" value="${esc(ed.name || '')}"${mine ? '' : ' disabled'}></div>
    <label class="ck"><input type="checkbox" data-ef="useRep"${ed.useRep !== false ? ' checked' : ''}${mine ? '' : ' disabled'}>기본 용어 바꾸기 쓰기 <small style="color:var(--ink-3)">(${((A.CFG && A.CFG.rep) || []).map(r => esc(r.f) + '→' + esc(r.t)).join(', ') || '설정 없음'})</small></label>
    <div class="nh-sec" style="margin:10px 0 4px">🔁 <b>이 출력본만 용어 바꾸기</b></div>
    ${(ed.rep || []).map((r, i) => `<div class="frow" style="align-items:center"><b>${esc(r.f)}</b> → <b>${esc(r.t)}</b>${mine ? `<button class="nh-btn xs r" data-erepdel="${i}">✕</button>` : ''}</div>`).join('') || '<div class="nh-desc">없음</div>'}
    ${mine ? `<div class="frow" style="align-items:flex-end"><div class="fl" style="flex:1;min-width:90px"><input class="nh-in" data-erf placeholder="바꿀 말"></div><div class="fl" style="flex:1;min-width:90px"><input class="nh-in" data-ert placeholder="새 말"></div><button class="nh-btn xs" data-ed="repadd" style="margin-bottom:10px">＋</button></div>` : ''}`;
  if(ed.lang === 'en'){
    const stu = A.STU[SRC.sid] || {};
    h += `<div class="nh-sec" style="margin:10px 0 4px">👤 <b>영문 이름</b></div>
      <div class="frow" style="align-items:center"><input class="nh-in" style="flex:1" data-ef="nameEn" value="${esc(ed.nameEn || stu.nameEn || '')}" placeholder="${esc(C.romanName(SRCDOC.cover && SRCDOC.cover.name || ''))}"${mine ? '' : ' disabled'}>${SRC.sid ? `<button class="nh-btn xs" data-ed="saveNameEn" title="학생 정보에 저장 — 다음 영문판에도">학생에 저장</button>` : ''}</div>
      <div class="nh-sec" style="margin:12px 0 4px">🌐 <b>번역</b> <span class="ch ${doc.untranslated ? 'warn' : 'ok'}">${doc.untranslated ? `번역 안 된 글 ${doc.untranslated}칸` : '모두 번역됨'}</span></div>
      <div class="nh-desc">같은 글은 한 번 번역하면 모두에 들어가요${CANGL ? ' (번역 표에 저장)' : ' — 번역 표는 번역 담당 · 나학평 담당만 고칠 수 있어서, 이 출력본에만 저장돼요'}.</div>
      <button class="nh-btn sm p" data-ed="trtable">📝 번역 표 열기</button>`;
  }
  h += `<div class="nh-sec" style="margin:14px 0 4px">✏️ <b>고친 글</b> ${nOv}개 · 🙈 <b>가린 것</b> ${nHide}개</div>
    ${Object.keys(ed.hide || {}).map(k => `<div class="frow" style="align-items:center;font-size:12px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🙈 ${esc(hideLabel(k))}</span>${mine ? `<button class="nh-btn xs" data-unhide="${esc(k)}">보이기</button>` : ''}</div>`).join('')}
    ${Object.keys(ed.ov || {}).map(k => `<div class="frow" style="align-items:center;font-size:12px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">✏️ ${esc(String(ed.ov[k]).slice(0, 40))}</span>${mine ? `<button class="nh-btn xs" data-unov="${esc(k)}">원래대로</button>` : ''}</div>`).join('')}
    <div class="frow" style="margin-top:12px">${mine ? `<button class="nh-btn p" data-ed="save"${DIRTY ? '' : ' disabled'}>💾 저장</button><button class="nh-btn sm r" data-ed="del">출력본 지우기</button>` : '<span class="nh-desc">다른 분의 출력본이에요 (보기만)</span>'}</div>
    <div class="nh-desc" style="margin-top:8px">${esc(ed.ownerName || '')} · ${ed.updatedAt && ed.updatedAt.toDate ? esc(ed.updatedAt.toDate().toLocaleString('ko-KR')) : ''}</div>`;
  return h;
}
function hideLabel(k){
  const b = (SRCDOC.blocks || []).find(x => x.id === k);
  if(b) return '칸 통째로 — ' + C.headText(b, 'ko', '');
  for(const bb of (SRCDOC.blocks || [])) for(const t of (bb.tables || [])) for(const r of (t.rows || [])){
    if(r.id === k || r.gid === k) return '줄 — ' + (r.cells || []).map(c => c.x).filter(Boolean).join(' ').slice(0, 40);
    const c = (r.cells || []).find(c2 => c2.id === k); if(c) return '칸 — ' + String(c.x).slice(0, 40);
  }
  return k;
}
/* 원본에서 자리 찾기 */
function findSrc(id){
  for(const b of (SRCDOC.blocks || [])){
    for(const t of (b.tables || [])) for(const r of (t.rows || [])) for(const c of (r.cells || [])) if(c.id === id) return { b, t, r, c };
    for(const n of (b.notes || [])) if(n.id === id) return { b, n };
  }
  return null;
}
function findOut(id){
  for(const b of (OUT.blocks || [])){
    for(const t of (b.tables || [])) for(const r of (t.rows || [])) for(const c of (r.cells || [])) if(c.id === id) return { b, t, r, c };
    for(const n of (b.notes || [])) if(n.id === id) return { b, n };
  }
  return null;
}
function mark(){ DIRTY = true; draw(); }
function popAt(anchor, html){
  document.querySelectorAll('.ed-pop').forEach(p => p.remove());
  const r = anchor.getBoundingClientRect();
  const p = document.createElement('div'); p.className = 'ed-pop'; p.innerHTML = html;
  document.body.appendChild(p);
  const w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left)) + 'px';
  p.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(10, r.top - h - 6) : r.bottom + 6) + 'px';
  const off = e => { if(!p.contains(e.target) && !anchor.contains(e.target)){ p.remove(); document.removeEventListener('mousedown', off, true); } };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  return p;
}
function editCell(anchor, id, kind){
  if(!ED) return;
  const mine = ED.ownerUid === A.CU.uid || A.isMgr;
  if(!mine) return A.toast('다른 분의 출력본이에요 — 새 출력본을 만들어 고치세요.', 'err');
  let orig = '', cur = '', rowId = '', blockId = '';
  if(kind === 'cv'){ const k = id.slice(3); orig = (SRCDOC.cover || {})[k] || ''; cur = (OUT.cover || {})[k] || ''; }
  else if(kind === 'h'){ const b = (SRCDOC.blocks || []).find(x => x.id === id); orig = b ? C.headText(b, 'ko', '') : ''; const ob = (OUT.blocks || []).find(x => x.id === id); cur = ob ? C.headText(ob, OUT.lang, C.numberSubjects(OUT)[id]) : ''; blockId = id; }
  else { const s = findSrc(id), o = findOut(id); orig = s ? (s.c ? s.c.x : s.n.p) : ''; cur = o ? (o.c ? o.c.x : o.n.p) : ''; rowId = s && s.r ? (s.r.gid && s.c && s.c.rs > 1 ? s.r.gid : s.r.id) : ''; blockId = s ? s.b.id : ''; }
  const key = kind === 'h' ? id + ':h' : id;
  const en = ED.lang === 'en';
  const p = popAt(anchor, `<div class="orig"><b style="font-size:11px">원본</b><br>${esc(orig).replace(/\n/g, '<br>')}</div>
    <textarea class="nh-ta" rows="${Math.min(8, Math.max(2, Math.ceil(String(cur).length / 40)))}" data-v>${esc(cur)}</textarea>
    <div class="frow" style="margin-top:8px">
      <button class="nh-btn sm p" data-p="ov">이 출력본에 쓰기</button>
      ${en && CANGL && kind !== 'cv' && kind !== 'h' ? '<button class="nh-btn sm g" data-p="gl" title="같은 한글 글 모두에 이 번역">번역 표에 (같은 글 모두)</button>' : ''}
      ${ED.ov && ED.ov[key] != null ? '<button class="nh-btn sm" data-p="reset">원래대로</button>' : ''}</div>
    <div class="frow" style="margin-top:6px">${rowId ? '<button class="nh-btn xs" data-p="hrow">🙈 이 줄 가리기</button>' : ''}${kind === 'c' ? '<button class="nh-btn xs" data-p="hcell">이 칸만 비우기</button>' : ''}${blockId ? '<button class="nh-btn xs r" data-p="hblock">이 칸 통째로 빼기</button>' : ''}</div>`);
  const ta = p.querySelector('[data-v]'); setTimeout(() => ta.focus(), 20);
  p.onclick = async e => {
    const b = e.target.closest('[data-p]'); if(!b) return;
    const act = b.dataset.p;
    ED.ov = Object.assign({}, ED.ov || {}); ED.hide = Object.assign({}, ED.hide || {});
    if(act === 'ov'){ ED.ov[key] = ta.value; }
    else if(act === 'reset'){ delete ED.ov[key]; }
    else if(act === 'hrow'){ ED.hide[rowId] = 1; }
    else if(act === 'hcell'){ ED.hide[id] = 1; }
    else if(act === 'hblock'){ ED.hide[blockId] = 1; }
    else if(act === 'gl'){
      const k = C.hashKey(orig);
      try{
        await FS.setDoc(FS.doc(A.db, 'nhpGlossary', SRC.termId), { map: { [k]: { k: C.norm(orig), e: ta.value.trim() } }, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }, { merge: true });
        GLT[k] = { k: C.norm(orig), e: ta.value.trim() }; GL = Object.assign({}, GLC, GLT);
        delete ED.ov[key];
        A.toast('번역 표에 저장했어요 — 같은 글 모두에 들어가요 ✓');
      }catch(err){ A.toast('번역 표에 저장하지 못했어요 — ' + A.errText(err), 'err'); return; }
    }
    p.remove(); mark();
  };
}
async function saveEd(){
  if(!ED) return;
  const data = { termId: SRC.termId, sid: SRC.sid || '', srcType: SRC.type, reportId: SRC.reportId || '', secId: SRC.secId || '', lang: ED.lang || 'ko', name: ED.name || '',
    ov: ED.ov || {}, hide: ED.hide || {}, names: ED.names || {}, rep: ED.rep || [], useRep: ED.useRep !== false, nameEn: ED.nameEn || '', ownerUid: ED.ownerUid, ownerName: ED.ownerName || '', updatedAt: FS.serverTimestamp() };
  try{
    // 있는 출력본은 칸을 통째로 바꿔 쓴다 (merge 는 «보이기 · 원래대로»로 지운 것이 남음)
    if(ED.id){ await FS.updateDoc(FS.doc(A.db, 'nhpEditions', ED.id), data); }
    else { data.createdAt = FS.serverTimestamp(); const ref = await FS.addDoc(FS.collection(A.db, 'nhpEditions'), data); ED.id = ref.id; EDS.unshift(ED); history.replaceState(null, '', `#edit/${encodeURIComponent(KEY)}/${ED.id}`); }
    DIRTY = false; A.toast('출력본을 저장했어요 ✓ (원본은 그대로)'); draw();
  }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
}
/* 번역 표 — 이 문서에서 번역이 필요한 글 (같은 글은 한 줄) */
function trRows(){
  const tr = translator();
  const seen = new Map();
  const add = (id, x, kd) => {
    const t = C.norm(x); if(!t) return;
    const r = tr.tx(t, kd);
    if(r.ok && !r.g) return;              // 고정 문구 · 날짜 · 숫자 — 저절로
    const k = C.hashKey(t);
    if(!seen.has(k)) seen.set(k, { k, ko: t, ids: [], en: r.g ? r.x : '' });
    seen.get(k).ids.push(id);
  };
  (SRCDOC.blocks || []).forEach(b => {
    const h = b.h || {};
    if(h.t === 'subj' || h.t === 'hr'){ add(b.id + ':hn', h.name, 'tx'); String(h.teacher || '').split(/\s*,\s*/).filter(Boolean).forEach(n => add('nm:' + n, n, 'nm')); }
    if(h.t === 'text') add(b.id + ':h', h.x, 'lab');
    (b.tables || []).forEach(t => (t.rows || []).forEach(r => (r.cells || []).forEach(c => { if(c.kd !== 'lvl' && !c.mk) add(c.id, c.x, c.kd); })));
    (b.notes || []).forEach(n => { add(n.id + ':h', n.h, 'lab'); add(n.id, n.p, 'tx'); });
  });
  return Array.from(seen.values());
}
function openTrTable(){
  const rows = trRows();
  const ov = (ED && ED.ov) || {};
  const nm = (ED && ED.names) || {};
  rows.forEach(r => { const o = r.ids.map(id => id.startsWith('nm:') ? nm[id.slice(3)] : ov[id]).find(v => v != null); if(o != null) r.en = o; });
  const m = A.modal('📝 번역 표', `<div class="nh-desc">한글 글마다 영어를 넣어요. <b>«한글 모두 복사»</b> → 번역 도구(파파고 · 구글 번역 · ChatGPT 등)에 붙여넣기 → 번역 결과를 <b>«번역 붙여넣기»</b>에 넣으면 번호대로 채워져요. 사람 이름 · 반 이름은 예시가 들어 있어요 (고칠 수 있음).</div>
    <div class="frow" style="margin-bottom:8px"><button class="nh-btn sm" data-t="copy">📋 한글 모두 복사 (번호 붙여)</button><button class="nh-btn sm" data-t="paste">📥 번역 붙여넣기</button><span class="nh-sp"></span><span class="ch ${rows.filter(r => !r.en).length ? 'warn' : 'ok'}">${rows.filter(r => !r.en).length}개 남음 / ${rows.length}</span></div>
    <div data-list>${rows.map((r, i) => `<div class="tr-row"><div class="ko"><b>${i + 1})</b>${esc(r.ko)}</div><textarea class="nh-ta" rows="${Math.min(5, Math.max(1, Math.ceil(r.ko.length / 60)))}" data-i="${i}" placeholder="${esc(r.ids.some(id => id.startsWith('nm:')) || /^[가-힣]{2,4}$/.test(r.ko) ? C.romanName(r.ko) : 'English')}">${esc(r.en || '')}</textarea></div>`).join('') || '<div class="nh-desc">번역할 글이 없어요 👏</div>'}</div>`,
    `<button class="nh-btn" data-c>닫기</button>${CANGL ? '<button class="nh-btn g" data-t="gl">번역 표에 저장 (같은 글 모두)</button>' : ''}<button class="nh-btn p" data-t="ov">이 출력본에 저장</button>`, 'wide');
  const get = () => Array.from(m.box.querySelectorAll('textarea[data-i]')).map(t => t.value);
  m.box.querySelector('[data-c]').onclick = () => m.close();
  m.box.onclick = async e => {
    const b = e.target.closest('[data-t]'); if(!b) return;
    if(b.dataset.t === 'copy'){
      const txt = rows.map((r, i) => `${i + 1}) ${r.ko.replace(/\n/g, ' / ')}`).join('\n');
      try{ await navigator.clipboard.writeText('다음 한국어 학교 생활 평가서 문장을 자연스러운 영어로 번역해 주세요. 번호를 그대로 붙여 주세요.\n\n' + txt); A.toast('복사했어요 — 번역 도구에 붙여넣으세요.'); }
      catch(err){ A.prompt('한글 모두', '아래 글을 복사하세요', txt, { multi: true }); }
      return;
    }
    if(b.dataset.t === 'paste'){
      const v = await A.prompt('📥 번역 붙여넣기', '번역 결과를 그대로 붙여넣으세요 (「1) …」처럼 번호가 있는 줄)', '', { multi: true });
      if(!v) return;
      let n = 0;
      v.replace(/\r/g, '').split('\n').forEach(l => { const mm = /^\s*(\d+)\s*[).:\]]\s*(.+)$/.exec(l); if(!mm) return; const i = Number(mm[1]) - 1; const ta = m.box.querySelector(`textarea[data-i="${i}"]`); if(ta){ ta.value = mm[2].replace(/\s+\/\s+/g, '\n').trim(); n++; } });
      A.toast(`${n}줄을 넣었어요 — 확인하고 저장하세요.`);
      return;
    }
    const vals = get();
    if(b.dataset.t === 'gl'){
      const map = {};
      rows.forEach((r, i) => { const v = (vals[i] || '').trim(); if(v) map[r.k] = { k: r.ko, e: v }; });
      if(!Object.keys(map).length) return A.toast('넣은 번역이 없어요.', 'err');
      try{
        await FS.setDoc(FS.doc(A.db, 'nhpGlossary', SRC.termId), { map, updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }, { merge: true });
        Object.assign(GLT, map); GL = Object.assign({}, GLC, GLT);
        // 출력본에만 있던 같은 번역은 지운다 (번역 표가 대신)
        if(ED) rows.forEach((r, i) => { if((vals[i] || '').trim()) r.ids.forEach(id => { if(id.startsWith('nm:')) delete (ED.names || {})[id.slice(3)]; else delete (ED.ov || {})[id]; }); });
        m.close(); A.toast(`번역 표에 ${Object.keys(map).length}개 저장했어요 ✓`); mark();
      }catch(err){ A.toast('번역 표에 저장하지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    if(b.dataset.t === 'ov'){
      if(!ED) return;
      ED.ov = Object.assign({}, ED.ov || {}); ED.names = Object.assign({}, ED.names || {});
      let n = 0;
      rows.forEach((r, i) => { const v = (vals[i] || '').trim(); if(!v) return; r.ids.forEach(id => {
        if(id.startsWith('nm:')) ED.names[id.slice(3)] = v; else ED.ov[id] = v; n++; }); });
      m.close(); A.toast(`${n}칸에 넣었어요 — «💾 저장»을 눌러 주세요.`); mark();
    }
  };
}
async function showPagesNow(){
  const doc = compute();
  window.showLoading && showLoading('쪽을 만드는 중…');
  try{
    const pages = await A.pagesOf(doc);
    window.hideLoading && hideLoading();
    A.showPages(pages, `${esc(doc.cover.name)} — ${ED ? esc(ED.name || '출력본') : '원본'}`, doc, { suffix: ED ? (ED.lang === 'en' ? 'English' : (ED.name || '출력본')) : '원본', pageOpt: {} });
  }catch(e){ window.hideLoading && hideLoading(); A.toast('만들지 못했어요 — ' + (e.message || e), 'err'); }
}
async function onClick(e){
  const c = e.target.closest('[data-c],[data-h],[data-nt],[data-cv]');
  if(c && ED && EL.querySelector('#ed-doc').contains(c)){
    if(c.dataset.c) return editCell(c, c.dataset.c, 'c');
    if(c.dataset.h) return editCell(c, c.dataset.h, 'h');
    if(c.dataset.nt) return editCell(c, c.dataset.nt, 'n');
    if(c.dataset.cv) return editCell(c, c.dataset.cv, 'cv');
  }
  const b = e.target.closest('button'); if(!b) return;
  const d = b.dataset;
  if(d.ed === 'back'){ if(DIRTY && !(await A.confirm('저장하지 않았어요', '고친 것을 저장하지 않고 나갈까요?', '나가기', true))) return; history.back(); return; }
  if(d.ed === 'pages') return showPagesNow();
  if(d.ed === 'new'){
    if(DIRTY && !(await A.confirm('저장하지 않았어요', '지금 출력본을 저장하지 않고 새로 만들까요?', '새로 만들기', true))) return;
    const en = d.lang === 'en';
    const nm = await A.prompt(en ? '＋ 영문판' : '＋ 새 출력본', '출력본 이름 (어디에 내는지 — 예: 미국 학교 제출용 · 용어 바꿈)', en ? 'English version' : '용어 바꿈', { required: '이름을 넣어 주세요' });
    if(nm == null) return;
    ED = { lang: en ? 'en' : 'ko', name: nm.trim(), ov: {}, hide: {}, rep: [], useRep: !en, nameEn: (A.STU[SRC.sid] || {}).nameEn || '', ownerUid: A.CU.uid, ownerName: A.CU.name || '' };
    DIRTY = true; draw(); return;
  }
  if(d.ed === 'save') return saveEd();
  if(d.ed === 'del'){
    if(!ED || !ED.id){ ED = null; DIRTY = false; draw(); return; }
    if(!(await A.confirm('출력본 지우기', `«${esc(ED.name || '')}» 출력본을 지울까요? (원본은 그대로)`, '지우기', true))) return;
    try{ await FS.deleteDoc(FS.doc(A.db, 'nhpEditions', ED.id)); EDS = EDS.filter(x => x.id !== ED.id); ED = null; DIRTY = false; A.toast('지웠어요.'); draw(); }catch(err){ A.toast('지우지 못했어요 — ' + A.errText(err), 'err'); }
    return;
  }
  if(d.ed === 'repadd'){ const f = EL.querySelector('[data-erf]').value.trim(), t = EL.querySelector('[data-ert]').value.trim(); if(!f) return; ED.rep = (ED.rep || []).filter(r => r.f !== f).concat([{ f, t }]); mark(); return; }
  if(d.erepdel != null && b.hasAttribute('data-erepdel')){ ED.rep = (ED.rep || []).filter((r, i) => i !== +d.erepdel); mark(); return; }
  if(d.unhide){ ED.hide = Object.assign({}, ED.hide); delete ED.hide[d.unhide]; mark(); return; }
  if(d.unov){ ED.ov = Object.assign({}, ED.ov); delete ED.ov[d.unov]; mark(); return; }
  if(d.ed === 'trtable') return openTrTable();
  if(d.ed === 'saveNameEn'){
    const v = EL.querySelector('[data-ef="nameEn"]').value.trim(); if(!v || !SRC.sid) return;
    try{ await FS.updateDoc(FS.doc(A.db, 'students', SRC.sid), { nameEn: v }); if(A.STU[SRC.sid]) A.STU[SRC.sid].nameEn = v; A.toast('학생 정보에 영문 이름을 저장했어요 ✓'); }catch(err){ A.toast('저장하지 못했어요 — ' + A.errText(err), 'err'); }
  }
}
function onChange(e){
  const x = e.target;
  if(x.hasAttribute('data-edsel')){
    const go = () => { ED = EDS.find(y => y.id === x.value) || null; DIRTY = false; draw(); };
    if(DIRTY){ A.confirm('저장하지 않았어요', '고친 것을 저장하지 않고 다른 출력본을 열까요?', '열기', true).then(ok => { if(ok) go(); else x.value = ED && ED.id || ''; }); return; }
    go(); return;
  }
  if(x.dataset.ef && ED){ ED[x.dataset.ef] = x.type === 'checkbox' ? x.checked : x.value; mark(); }
}
