/* ═══════════════════════════════════════════════════════════
   ✏️ minutes-editor.js — 회의록 쓰기 (v-93)
   ① 회의(기관 · 종류 · 날짜 · 시각 · 장소) ② 참석(명부에서 · 불참 사유) ③ 주제(번호 개요 · 결정 · 임무 · 첨부)
   · Tab 들여쓰기 / Shift+Tab 내어쓰기 → 번호 (1) → 1) → I. → (I) 저절로
   · Pages · 한글 · 워드에서 복사해 붙이면 번호를 읽어 단계로, 엑셀 · Numbers 칸은 표로
   · 저장할 때마다 수정 이력 한 벌 · 임무는 담당 선생님 홈으로
   ═══════════════════════════════════════════════════════════ */
import { sanitizeInline, sanitizeTableHTML, cleanEditedTable, pdfPages, xlsxTable, FILE_MAX, readAsDataURL, cleanInlineCached, cleanTableCached } from './minutes-files.js';

let X = null;          // 바깥 문맥 (db · FS · C · STORE · CU · STAFF …)
let ED = null;         // 지금 쓰는 회의록
let R = null;          // 편집기 뿌리 (#mt)
const uid6 = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const esc = s => X.C.esc(s);

const CSS = `
.ed{max-width:980px;margin:0 auto}
.ed-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:20;background:var(--bg);padding:8px 0 10px}
.ed-top .tt{display:flex;flex-direction:column}
.ed-top .tt b{font-size:20px;font-weight:900}
.ed-top .tt span{font-size:11.5px;color:var(--ink-3);font-weight:700}
.ed-sec{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:14px}
.ed-sh{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;margin-bottom:12px;flex-wrap:wrap}
.ed-sh i{font-style:normal;width:24px;height:24px;border-radius:50%;background:var(--sb-house);color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}
.ed-sh span{font-size:12px;font-weight:600;color:var(--ink-2)}
.ed-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.ed-f{display:flex;flex-direction:column;gap:5px;min-width:0}
.ed-f>label{font-size:12px;font-weight:800;color:var(--ink-2)}
.ed-f input,.ed-f select{font-family:inherit;font-size:14px;font-weight:600;height:40px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--surface);color:var(--ink);min-width:0}
.ed-f.w2{grid-column:span 2}.ed-f.w4{grid-column:1/-1}
.ed-chips{display:flex;flex-wrap:wrap;gap:6px}
.ed-cont{margin-top:12px;display:flex;align-items:center;gap:10px;background:#F3F8FF;border:1px solid #C9DCF5;border-radius:12px;padding:10px 14px;font-size:13px;color:#1E3A5F}
html[data-theme="dark"] .ed-cont{background:var(--info-bg);border-color:#2B4A72;color:var(--info)}
.ed-cont b{font-weight:900}
.at-g{font-size:11.5px;font-weight:800;color:var(--ink-3);margin:8px 0 4px}
.at-list{display:flex;flex-wrap:wrap;gap:6px}
.at{font-family:inherit;font-size:13px;font-weight:700;border:1px solid var(--line);background:var(--surface);color:var(--ink-3);border-radius:10px;padding:6px 11px;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
.at.o{background:#E8F3EF;border-color:#9CCBB6;color:#00704A}
.at.x{background:#FDECEA;border-color:#F3B4AC;color:#B42318}
.at small{font-weight:800;font-size:11px}
html[data-theme="dark"] .at.o{background:#123326;border-color:#2BAE7E;color:#3FCB96}
html[data-theme="dark"] .at.x{background:#3A1B1B;border-color:#7F2A2A;color:#F87171}
.ab{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px}
.ab b{min-width:64px}
.ab button{font-family:inherit;font-size:12px;font-weight:700;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:100px;padding:4px 11px;cursor:pointer}
.ab button.on{background:#FDECEA;border-color:#F3B4AC;color:#B42318}
.ab input{font-family:inherit;font-size:12.5px;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 9px;width:160px;background:var(--surface);color:var(--ink)}
.et{border:1px solid var(--line);border-radius:14px;margin-bottom:12px;background:var(--surface)}
.et.focus{border-color:#9CCBB6;box-shadow:0 0 0 3px rgba(0,112,74,.07)}
.et-h{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line-soft)}
.et-no{font-weight:900;font-size:15px;min-width:24px}
.et-title{flex:1;min-width:0;font-family:inherit;font-size:15px;font-weight:800;border:0;outline:none;background:#FFF9C4;color:#1F2320;border-radius:6px;padding:6px 9px}
.et-title::placeholder{color:#B8A960;font-weight:600}
.et-thr{font-size:11px;font-weight:800;color:#2B6CB0;background:#E6F0FB;border-radius:100px;padding:2px 8px;white-space:nowrap}
.et-h .ib{font-family:inherit;border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:13px;padding:4px 6px;border-radius:6px}
.et-h .ib:hover{background:var(--sb-mint-2);color:var(--ink)}
.et-sum{font-size:12px;color:var(--ink-3);display:none}
.et.fold .et-in{display:none}.et.fold .et-sum{display:inline}
.et-in{padding:8px 12px 12px}
.et-bar{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.et-bar button{font-family:inherit;font-size:12px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:8px;height:28px;padding:0 9px;cursor:pointer}
.et-bar button:hover{border-color:var(--sb-green);color:var(--sb-green)}
.et-bar .sep{width:1px;height:18px;background:var(--line);margin:0 4px}
.et-bar .tip{font-size:11.5px;color:var(--ink-3);margin-left:6px}
.et-body{min-height:34px;border-radius:8px;padding:2px 0}
.et-body.drop{outline:2px dashed var(--sb-green);outline-offset:2px}
.ol{display:flex;gap:6px;align-items:flex-start;font-size:14px;line-height:1.75}
.ol[data-lv="1"]{padding-left:22px}.ol[data-lv="2"]{padding-left:48px}.ol[data-lv="3"]{padding-left:74px}.ol[data-lv="4"]{padding-left:100px}
.ol-n{flex:none;min-width:26px;color:var(--ink-2);font-weight:600;user-select:none}
.ol-t{flex:1;min-width:0;outline:none;padding:1px 4px;border-radius:5px;white-space:pre-wrap;word-break:break-word}
.ol-t:focus{background:var(--sb-mint-2)}
.ol-t:empty::before{content:attr(data-ph);color:var(--ink-3)}
.ol-t mark,.dl-t mark,.kr-t mark{background:#FFF59D;color:inherit}
.ob{margin:6px 0 6px 22px;border:1px solid var(--line);border-radius:10px;background:var(--bg);overflow:hidden}
.ob-bar{display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:6px 8px;border-bottom:1px solid var(--line);font-size:12px;font-weight:800;color:var(--ink-2)}
.ob-bar button{font-family:inherit;font-size:11.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:7px;height:26px;padding:0 8px;cursor:pointer}
.ob-bar .ob-cap{flex:1;min-width:120px;font-family:inherit;font-size:12px;height:26px;border:1px solid var(--line);border-radius:7px;padding:0 8px;background:var(--surface);color:var(--ink)}
.ob-c{padding:8px;overflow-x:auto;background:#fff}
.ob-c table{border-collapse:collapse;font-size:12.5px;color:#1F2320}
.ob-c td,.ob-c th{border:1px solid #C9C5B9;padding:5px 8px;min-width:40px;outline:none;vertical-align:top}
.ob-c th{background:#EEECE6}
.ob-c td:focus,.ob-c th:focus{box-shadow:inset 0 0 0 2px #00704A}
.ob-c img{display:block;max-width:100%;max-height:320px;border-radius:6px}
.ob-pg{display:flex;gap:6px;overflow-x:auto}.ob-pg img{height:150px;border:1px solid #E3E1DA}
.ob-ld{padding:16px;font-size:12.5px;color:var(--ink-2)}
.ob-lk{display:flex;gap:6px;padding:8px;flex-wrap:wrap}.ob-lk input{font-family:inherit;font-size:12.5px;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 9px;flex:1;min-width:160px}
.et-sub{margin-top:10px;padding-top:8px;border-top:1px dashed var(--line)}
.et-sub>b{font-size:12.5px;font-weight:900}
.et-sub>span{font-size:11.5px;color:var(--ink-3);margin-left:6px}
.dl,.kr{display:flex;gap:8px;align-items:center;margin-top:6px;border-radius:10px;padding:5px 8px}
.dl{background:#EEF6F2}.kr{background:#FBF6E6;flex-wrap:wrap}
html[data-theme="dark"] .dl{background:#123326}html[data-theme="dark"] .kr{background:#2A2416}
.dl-b{font-size:11.5px;font-weight:900;color:#00704A;flex:none}.kr-b{font-size:11.5px;font-weight:900;color:#8A6D00;flex:none}
.dl-t,.kr-t{flex:1;min-width:160px;outline:none;font-size:13.5px;line-height:1.6;padding:2px 4px;border-radius:5px}
.dl-t:empty::before,.kr-t:empty::before{content:attr(data-ph);color:var(--ink-3)}
.kr-w{font-family:inherit;font-size:12px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;height:30px;padding:0 10px;cursor:pointer;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kr-w.none{color:var(--ink-3)}
.kr-d{font-family:inherit;font-size:12.5px;height:30px;border:1px solid var(--line);border-radius:8px;padding:0 6px;background:var(--surface);color:var(--ink)}
.xb{font-family:inherit;border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:13px;padding:2px 6px;border-radius:6px}
.xb:hover{background:#FDECEA;color:#B42318}
.addb{font-family:inherit;font-size:12.5px;font-weight:800;border:1px dashed var(--line);background:transparent;color:var(--sb-green);border-radius:10px;padding:6px 12px;cursor:pointer;margin-top:8px}
.ed-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 16px;font-size:12.5px;color:var(--ink-2)}
.ed-foot b{color:var(--ink)}
.ed-rs{display:flex;align-items:center;gap:10px;background:#FFFBEA;border:1px solid #EADBA8;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#5C4A00;flex-wrap:wrap}
html[data-theme="dark"] .ed-rs{background:var(--gold-bg);border-color:var(--gold-line);color:var(--gold)}
.wp{position:fixed;z-index:500;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-md);width:280px;max-height:380px;display:flex;flex-direction:column}
.wp input[type=search]{font-family:inherit;font-size:13px;height:36px;border:0;border-bottom:1px solid var(--line);padding:0 12px;background:transparent;color:var(--ink);outline:none}
.wp .ls{overflow:auto;padding:4px}
.wp label{display:flex;gap:8px;align-items:center;font-size:13px;padding:6px 8px;border-radius:8px;cursor:pointer}
.wp label:hover{background:var(--sb-mint-2)}
.wp label small{color:var(--ink-3);font-size:11px;margin-left:auto}
.wp .gh{font-size:11px;font-weight:800;color:var(--ink-3);padding:6px 8px 2px}
.wp .ft{border-top:1px solid var(--line);padding:6px;display:flex;justify-content:flex-end}
@media (max-width:760px){ .ed-grid{grid-template-columns:1fr 1fr} .ed-f.w2{grid-column:1/-1} .ed-sec{padding:14px} .et-bar .tip{display:none}
  .et-h{flex-wrap:wrap} .et-title{flex-basis:calc(100% - 34px)} .et-thr{order:5} .ol[data-lv="1"]{padding-left:8px} .ol[data-lv="2"]{padding-left:26px} .ol[data-lv="3"]{padding-left:44px} .ol[data-lv="4"]{padding-left:62px} .ob{margin-left:6px} }
`;

/* ═══ 열기 ═══ */
export async function openEditor(ctx, m, opts){
  X = ctx; opts = opts || {};
  R = document.getElementById('mt');
  if(!document.getElementById('ed-css')){ const s = document.createElement('style'); s.id = 'ed-css'; s.textContent = CSS; document.head.appendChild(s); }
  const C = X.C;
  const isNew = !m;
  let from = null;
  if(opts.from){
    try{ const s = await X.FS.getDoc(X.FS.doc(X.db, 'meetings', opts.from)); if(s.exists()) from = { id: s.id, ...s.data() }; }catch(e){}
  }
  const org = m ? m.org : (from ? from.org : (opts.org && X.WRITE.includes(opts.org) ? opts.org : X.defaultOrg));
  const prev = !m ? (from || lastOf(org, '')) : null;
  ED = {
    id: m ? m.id : X.FS.doc(X.FS.collection(X.db, 'meetings')).id,
    isNew, baseRev: m ? (m.rev || 0) : 0, base: m ? JSON.parse(JSON.stringify(m)) : null,
    org,
    type: m ? (m.type || '') : (prev ? prev.type || '' : (X.typesOf(org)[0] || '')),
    title: m ? (m.title || '') : '',
    date: m ? m.date : C.todayStr(),
    time: m ? (m.time || '') : (prev ? prev.time || '' : ''),
    place: m ? (m.place || '') : (prev ? prev.place || '' : ''),
    att: m ? JSON.parse(JSON.stringify(m.att || {})) : rosterFrom(prev),
    attNames: m ? { ...(m.attNames || {}) } : { ...((prev && prev.attNames) || {}) },
    guests: m ? (m.guests || '') : '',
    writerUid: m ? (m.writerUid || '') : X.CU.uid,
    writerName: m ? (m.writerName || '') : (X.CU.name || ''),
    imported: m ? !!m.imported : false,
    topics: m ? JSON.parse(JSON.stringify(m.topics || [])) : [],
    dirty: false, saving: false, from,
  };
  if(from) ED.topics = carryTopics(from, from.topics || [], false);
  if(!ED.topics.length) ED.topics = [blankTopic()];
  window.__mtDirty = false;
  paint();
  checkDraft();
  if(!isNew) X.FS.updateDoc(X.FS.doc(X.db, 'meetings', ED.id), { editing: { uid: X.CU.uid, name: X.CU.name || '', at: Date.now() } }).catch(()=>{});
}
function lastOf(org, type){
  const L = X.LIST.filter(x => x.org === org && !x.deleted && (!type || x.type === type)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return L[0] || null;
}
function rosterFrom(prev){
  const att = {};
  if(prev && !prev.imported) for(const [u, a] of Object.entries(prev.att || {})) if(a && (a.s === 'o' || a.s === 'x')) att[u] = { s: 'o' };
  return att;
}
const blankTopic = () => ({ id: uid6('t'), title: '', body: [{ k: 'l', lv: 1, h: '' }], dec: [], tasks: [] });
/* 지난 회의 주제를 «이어 쓰는 주제»로 — 못 끝낸 임무는 첫 줄로 적어 둔다 */
function carryTopics(pm, topics, withTasks){
  const C = X.C;
  return topics.map(t => {
    const body = [];
    if(withTasks !== false) (t.tasks || []).forEach(k => {
      const d = X.TASKS[C.taskKey(pm.id, k.id)] || {};
      if(d.status === 'done') return;
      const who = (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean).join(', ');
      body.push({ k: 'l', lv: 1, h: esc(`지난 임무: ${C.textOf(k.h)}${who ? ' · ' + who : ''} (${(C.STATUS[d.status] || C.STATUS.todo).l})`) });
    });
    if(!body.length) body.push({ k: 'l', lv: 1, h: '' });
    return { id: uid6('t'), title: t.title || '', thr: t.thr || `${pm.id}:${t.id}`, thrFrom: pm.date, body, dec: [], tasks: [] };
  });
}

/* ═══ 그리기 ═══ */
function paint(){
  const C = X.C;
  const types = X.typesOf(ED.org);
  if(ED.type && !types.includes(ED.type)) types.push(ED.type);
  const orgSeg = ED.isNew
    ? `<div class="mt-seg">${X.WRITE.map(o => `<button type="button" class="${o === 'da' ? 'da ' : ''}${ED.org === o ? 'on' : ''}" data-e="org" data-v="${o}">${esc(C.MORG[o])}</button>`).join('')}</div>`
    : `<div style="font-size:14px;font-weight:800;padding:9px 0">${esc(C.MORG[ED.org])} <span style="font-size:11.5px;color:var(--ink-3);font-weight:600">(만든 뒤엔 바꿀 수 없어요)</span></div>`;
  R.innerHTML = `<div class="ed">
    <div class="ed-top"><button class="mt-btn" data-e="cancel">‹ 취소</button>
      <div class="tt"><b>${ED.isNew ? '새 회의록' : '회의록 고치기'}</b><span id="ed-saved">${ED.isNew ? '쓰는 동안 이 기기에 임시 저장돼요' : `${esc(C.fmtMD(ED.date))} ${esc(C.titleOf(ED))} · ${ED.baseRev}번째 모습에서 고치는 중`}</span></div>
      <div class="mt-sp"></div>
      <button class="mt-btn" data-e="preview">문서로 미리보기</button>
      <button class="mt-btn p" data-e="save">저장</button></div>
    <div id="ed-rs"></div>
    <section class="ed-sec"><div class="ed-sh"><i>1</i>회의</div>
      <div class="ed-grid">
        <div class="ed-f w4"><label>기관</label>${orgSeg}</div>
        <div class="ed-f w4"><label>회의 종류</label><div class="ed-chips" id="ed-types">${types.map(t => `<button type="button" class="mt-chip${ED.type === t ? ' on' : ''}" data-e="type" data-v="${esc(t)}">${esc(t)}</button>`).join('')}
          <button type="button" class="mt-chip" data-e="newtype">＋ 새 종류</button></div></div>
        <div class="ed-f w2"><label>제목 <span style="font-weight:600;color:var(--ink-3)">(비우면 «${esc(C.titleOf({ type: ED.type }))}»)</span></label><input id="ed-title" value="${esc(ED.title)}" placeholder="${esc(C.titleOf({ type: ED.type }))}"></div>
        <div class="ed-f"><label>날짜</label><input type="date" id="ed-date" value="${esc(ED.date)}"></div>
        <div class="ed-f"><label>시각</label><input type="time" id="ed-time" value="${esc(ED.time)}"></div>
        <div class="ed-f w2"><label>장소</label><input id="ed-place" value="${esc(ED.place)}" placeholder="예: 2층 회의실"></div>
        <div class="ed-f w2"><label>쓴 사람</label><input value="${esc(ED.writerName || X.CU.name || '')}" disabled></div>
      </div>
      <div id="ed-cont"></div></section>
    <section class="ed-sec"><div class="ed-sh"><i>2</i>참석 <span>누르면 참석 → 불참 → 빼기 · 교직원 명부에서 불러와요</span><div class="mt-sp"></div>
      <button type="button" class="mt-btn sm" data-e="allin">모두 참석</button><button type="button" class="mt-btn sm" data-e="addppl">＋ 다른 사람</button></div>
      <div id="ed-att"></div><div id="ed-abs"></div>
      <div class="ed-f" style="margin-top:12px"><label>그 외 참석 (손님 · 외부 강사 등)</label><input id="ed-guests" value="${esc(ED.guests)}" placeholder="예: 김○○ 대표님"></div></section>
    <section class="ed-sec"><div class="ed-sh"><i>3</i>주제 <span>Tab 들여쓰기 · Shift+Tab 내어쓰기 — 번호는 (1) → 1) → I. → (I) 로 저절로 · Pages · 한글에서 복사해 붙여도 번호를 알아봐요</span></div>
      <div id="ed-topics">${ED.topics.map(topicHTML).join('')}</div>
      <button type="button" class="addb" data-e="addtopic">＋ 주제 추가</button></section>
    <div class="ed-foot"><span id="ed-note" style="flex:1"></span><button class="mt-btn p" data-e="save">저장</button></div>
  </div>`;
  ED.topics.forEach(t => { const el = R.querySelector(`.et[data-tid="${t.id}"]`); if(el) hydrate(el, t); });
  paintAtt(); paintCont(); renumAll(); note();
  bind();
}
function topicHTML(t){
  return `<div class="et" data-tid="${esc(t.id)}">
    <div class="et-h"><span class="et-no"></span><input class="et-title" value="${esc(t.title || '')}" placeholder="주제 제목">
      ${t.thrFrom ? `<span class="et-thr">↩ ${esc(X.C.fmtMD(t.thrFrom))} 회의에서 이어짐</span>` : ''}<span class="et-sum"></span>
      <button type="button" class="ib" data-e="tup" title="위로">↑</button><button type="button" class="ib" data-e="tdown" title="아래로">↓</button>
      <button type="button" class="ib" data-e="tfold" title="접기">접기</button><button type="button" class="ib" data-e="tdel" title="주제 빼기">✕</button></div>
    <div class="et-in">
      <div class="et-bar"><button type="button" data-e="bold" title="굵게 (⌘B)"><b>B</b></button><button type="button" data-e="mark" title="형광펜" style="background:#FFF59D;color:#1F2320">가</button>
        <button type="button" data-e="indent" title="들여쓰기 (Tab)">→</button><button type="button" data-e="outdent" title="내어쓰기 (Shift+Tab)">←</button><span class="sep"></span>
        <button type="button" data-e="addimg">＋ 사진</button><button type="button" data-e="addtbl">＋ 표</button><button type="button" data-e="adddoc">＋ 문서 · PDF</button><button type="button" data-e="addlink">＋ 링크</button>
        <span class="tip">표는 Numbers · 엑셀에서 칸을 복사해 그대로 붙여 넣어도 돼요 · 사진은 끌어다 놓기</span></div>
      <div class="et-body"></div>
      <div class="et-sub"><b>결정 사항</b><div class="et-decs"></div><button type="button" class="addb" data-e="adddec">＋ 결정 추가</button></div>
      <div class="et-sub"><b>임무</b><span>저장하면 담당 선생님 홈과 알림에 떠요</span><div class="et-tasks"></div><button type="button" class="addb" data-e="addtask">＋ 임무 추가 (담당은 여러 명도)</button></div>
    </div></div>`;
}
function hydrate(el, t){
  el._thr = t.thr || ''; el._thrFrom = t.thrFrom || ''; el._ed = t.ed || null;
  const body = el.querySelector('.et-body');
  (t.body && t.body.length ? t.body : [{ k: 'l', lv: 1, h: '' }]).forEach(b => body.appendChild(b.k === 'l' ? lineEl(b.lv, b.h) : blockEl(b)));
  const decs = el.querySelector('.et-decs');
  (t.dec || []).forEach(d => decs.appendChild(decEl(d)));
  const tasks = el.querySelector('.et-tasks');
  (t.tasks || []).forEach(k => tasks.appendChild(taskEl(k)));
}
function lineEl(lv, h){
  const d = document.createElement('div'); d.className = 'ol'; d.dataset.lv = X.C.clampLv(lv);
  d.innerHTML = `<span class="ol-n"></span><div class="ol-t" contenteditable="true" spellcheck="false" data-ph="내용을 적어 주세요"></div>`;
  d.querySelector('.ol-t').innerHTML = cleanInlineCached(h || '');
  return d;
}
function decEl(d){
  const el = document.createElement('div'); el.className = 'dl'; el.dataset.did = (d && d.id) || uid6('d');
  el.innerHTML = `<span class="dl-b">결정</span><div class="dl-t" contenteditable="true" data-ph="결정한 것을 한 줄로"></div><button type="button" class="xb" data-e="ddel" aria-label="빼기">✕</button>`;
  el.querySelector('.dl-t').innerHTML = cleanInlineCached((d && d.h) || '');
  return el;
}
function taskEl(k){
  const el = document.createElement('div'); el.className = 'kr'; el.dataset.kid = (k && k.id) || uid6('k');
  el._uids = (k && k.uids || []).slice(); el._names = { ...((k && k.names) || {}) };
  el.innerHTML = `<span class="kr-b">임무</span><div class="kr-t" contenteditable="true" data-ph="할 일"></div>
    <button type="button" class="kr-w" data-e="who"></button><input type="date" class="kr-d" value="${esc((k && k.due) || '')}" title="기한"><button type="button" class="xb" data-e="kdel" aria-label="빼기">✕</button>`;
  el.querySelector('.kr-t').innerHTML = cleanInlineCached((k && k.h) || '');
  whoLabel(el);
  return el;
}
function whoLabel(el){
  const b = el.querySelector('.kr-w'); const u = el._uids || [];
  const nm = x => X.nameOf(x) || (el._names || {})[x] || '?';
  b.textContent = u.length ? (u.length > 1 ? `${nm(u[0])} 외 ${u.length - 1}명` : nm(u[0])) : '담당 고르기';
  b.classList.toggle('none', !u.length);
}
function blockEl(b){
  const el = document.createElement('div'); el.className = 'ob'; el.dataset.k = b.k; el._b = { ...b };
  const bar = (label, extra) => `<div class="ob-bar"><span>${label}</span>${extra || ''}<input class="ob-cap" placeholder="설명 (선택)" value="${esc(b.cap || '')}">
    <button type="button" data-e="bup" title="위로">↑</button><button type="button" data-e="bdown" title="아래로">↓</button><button type="button" data-e="bdel" title="빼기">✕</button></div>`;
  if(b.k === 'tbl'){
    el.innerHTML = bar('표', `<button type="button" data-e="trow">＋ 줄</button><button type="button" data-e="tcol">＋ 칸</button><button type="button" data-e="trowd">− 줄</button><button type="button" data-e="tcold">− 칸</button>
      <button type="button" data-e="thead">머리 줄</button><button type="button" data-e="tcolor">칸 색</button><button type="button" data-e="tcenter">가운데</button>`) + `<div class="ob-c">${cleanTableCached(b.h || '')}</div>`;
    el.querySelectorAll('td,th').forEach(c => c.setAttribute('contenteditable', 'true'));
  } else if(b.k === 'img'){
    el.innerHTML = bar('사진') + `<div class="ob-c"><div class="ob-ld">사진 불러오는 중…</div></div>`;
    X.STORE.getImage(b.fid).then(src => { const c = el.querySelector('.ob-c'); if(c) c.innerHTML = X.C.okSrc(src) ? `<img src="${src}" alt="">` : '<div class="ob-ld">사진을 찾지 못했어요</div>'; });
  } else if(b.k === 'pdf'){
    el.innerHTML = bar(`📕 ${esc(b.name || 'PDF')} · ${(b.fids || []).length}쪽${b.fid ? ' · 원본 보관' : ''}`) + `<div class="ob-c"><div class="ob-pg"></div></div>`;
    const pg = el.querySelector('.ob-pg');
    (b.fids || []).slice(0, 6).forEach(f => X.STORE.getImage(f).then(src => { if(X.C.okSrc(src)){ const im = document.createElement('img'); im.src = src; pg.appendChild(im); } }));
  } else if(b.k === 'file'){
    el.innerHTML = bar(`📎 ${esc(b.name || '문서')}${b.size ? ' · ' + X.C.fmtSize(b.size) : ''}${b.link ? ' · 링크' : ' · 보관'}`) + (b.link ? `<div class="ob-lk"><input class="ob-url" value="${esc(b.link)}" placeholder="드라이브 링크"></div>` : '');
  } else if(b.k === 'link'){
    el.innerHTML = bar('🔗 링크') + `<div class="ob-lk"><input class="ob-url" value="${esc(b.url || '')}" placeholder="https://"><input class="ob-ttl" value="${esc(b.title || '')}" placeholder="보이는 이름 (예: 화재대피 시나리오)"></div>`;
  } else if(b.k === 'wait'){
    el.innerHTML = `<div class="ob-ld">${esc(b.msg || '올리는 중…')}</div>`;
  }
  return el;
}
function paintCont(){
  const box = R.querySelector('#ed-cont'); if(!box) return;
  if(!ED.isNew || ED.from){ box.innerHTML = ED.from ? `<div class="ed-cont">📋 <span><b>${esc(X.C.fmtMD(ED.from.date))} ${esc(X.C.titleOf(ED.from))}</b>의 주제 ${(ED.from.topics || []).length}개를 이어 쓰는 주제로 불러왔어요.</span></div>` : ''; return; }
  const pm = X.LIST.filter(x => x.org === ED.org && x.type === ED.type && !x.deleted && x.date <= ED.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if(!pm){ box.innerHTML = ''; return; }
  let open = 0;
  (pm.topics || []).forEach(t => (t.tasks || []).forEach(k => { if((X.TASKS[X.C.taskKey(pm.id, k.id)] || {}).status !== 'done') open++; }));
  box.innerHTML = `<div class="ed-cont">↩ <span>지난 회의(<b>${esc(X.C.fmtMD(pm.date))}</b>)에서 이어오기 — 주제 ${(pm.topics || []).length}개${open ? ` · 못 끝낸 임무 <b>${open}</b>` : ''}</span>
    <div class="mt-sp"></div><button type="button" class="mt-btn sm" data-e="cont" data-mid="${esc(pm.id)}">골라서 불러오기</button></div>`;
}
function poolOf(org){
  const C = X.C;
  const inOrg = s => { const b = new Set([...(s.orgs || []), s.org]); return org === 'da' || b.has(org); };
  return X.STAFF.filter(s => s.role !== 'partner' && inOrg(s));
}
function paintAtt(){
  const box = R.querySelector('#ed-att'); if(!box) return;
  const pool = poolOf(ED.org);
  const ids = new Set(pool.map(s => s.uid));
  const extra = Object.keys(ED.att).filter(u => !ids.has(u));
  const chip = (uid, nm) => {
    const a = ED.att[uid]; const s = a ? a.s : '';
    return `<button type="button" class="at ${s}" data-e="att" data-u="${esc(uid)}">${s === 'o' ? '✓ ' : s === 'x' ? '<small>불참</small> ' : ''}${esc(nm)}</button>`;
  };
  const nm = u => X.nameOf(u) || ED.attNames[u] || '?';
  let h = '';
  if(ED.org === 'da'){
    for(const o of ['daniel', 'jihyebit']){
      const g = pool.filter(s => (s.org || (s.orgs || [])[0]) === o);
      if(g.length) h += `<div class="at-g">${esc(X.C.MORG[o])}</div><div class="at-list">${g.map(s => chip(s.uid, s.name || '')).join('')}</div>`;
    }
    const rest = pool.filter(s => !['daniel', 'jihyebit'].includes(s.org || (s.orgs || [])[0]));
    if(rest.length) h += `<div class="at-list" style="margin-top:6px">${rest.map(s => chip(s.uid, s.name || '')).join('')}</div>`;
  } else h += `<div class="at-list">${pool.map(s => chip(s.uid, s.name || '')).join('')}</div>`;
  if(extra.length) h += `<div class="at-g">다른 사람</div><div class="at-list">${extra.map(u => chip(u, nm(u))).join('')}</div>`;
  const on = Object.values(ED.att).filter(a => a.s === 'o').length, off = Object.values(ED.att).filter(a => a.s === 'x').length;
  box.innerHTML = `<div style="font-size:12.5px;color:var(--ink-2);margin-bottom:6px">참석 <b style="color:#00704A">${on}</b> · 불참 <b style="color:#B42318">${off}</b></div>` + h;
  const ab = R.querySelector('#ed-abs');
  const offs = Object.entries(ED.att).filter(([, a]) => a.s === 'x');
  ab.innerHTML = offs.length ? `<div style="margin-top:12px;font-size:12.5px;font-weight:900">불참 사유</div>` + offs.map(([u, a]) => {
    const rs = X.CFG.absence || [];
    const custom = a.r && !rs.includes(a.r);
    return `<div class="ab" data-u="${esc(u)}"><b>${esc(nm(u))}</b>${rs.map(r => `<button type="button" class="${a.r === r ? 'on' : ''}" data-e="absr" data-r="${esc(r)}">${esc(r)}</button>`).join('')}
      <input type="text" data-e="absc" placeholder="직접 쓰기" value="${custom ? esc(a.r) : ''}"></div>`;
  }).join('') : '';
}
function renum(el){
  const C = X.C;
  const rows = [...el.querySelector('.et-body').children];
  const body = rows.map(r => r.classList.contains('ol') ? { k: 'l', lv: +r.dataset.lv, h: r.querySelector('.ol-t').innerHTML } : { k: 'x' });
  const labels = C.numberBody(body);
  rows.forEach((r, i) => { if(r.classList.contains('ol')) r.querySelector('.ol-n').textContent = labels[i]; });
  const nl = rows.filter(r => r.classList.contains('ol') && r.querySelector('.ol-t').textContent.trim()).length;
  el.querySelector('.et-sum').textContent = `내용 ${nl}줄 · 결정 ${el.querySelectorAll('.dl').length} · 임무 ${el.querySelectorAll('.kr').length}`;
}
function renumAll(){
  R.querySelectorAll('.et').forEach((el, i) => { el.querySelector('.et-no').textContent = (i + 1) + '.'; renum(el); });
}
function note(){
  const n = R.querySelector('#ed-note'); if(!n) return;
  const who = new Set();
  const base = new Map();
  ((ED.base && ED.base.topics) || []).forEach(t => (t.tasks || []).forEach(k => base.set(k.id, new Set(k.uids || []))));
  R.querySelectorAll('.kr').forEach(k => { const old = base.get(k.dataset.kid) || new Set(); (k._uids || []).forEach(u => { if(!old.has(u) && u !== X.CU.uid) who.add(u); }); });
  const vis = ED.org === 'da' ? '모든 기관 교직원이' : `${X.C.MORG[ED.org]} 교직원과 열람 허락을 받은 선생님이`;
  n.innerHTML = `${who.size ? `저장하면 임무 알림이 <b>${who.size}명</b>에게 가요 · ` : ''}이 회의록은 ${esc(vis)} 볼 수 있어요`;
  R.querySelectorAll('[data-e="save"]').forEach(b => b.textContent = who.size ? '저장하고 알리기' : '저장');
}

/* ═══ 커서 도우미 ═══ */
function caretAt(el, end){
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(!end);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function atStart(el){
  const s = getSelection(); if(!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0); const pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length === 0;
}
function atEnd(el){
  const s = getSelection(); if(!s.rangeCount || !s.isCollapsed) return false;
  const r = s.getRangeAt(0); const post = document.createRange(); post.selectNodeContents(el); post.setStart(r.endContainer, r.endOffset);
  return post.toString().length === 0;
}
function splitTail(el){
  const s = getSelection(); if(!s.rangeCount) return '';
  const r = s.getRangeAt(0); r.deleteContents();
  const post = document.createRange(); post.selectNodeContents(el); post.setStart(r.endContainer, r.endOffset);
  const frag = post.extractContents(); const d = document.createElement('div'); d.appendChild(frag);
  return d.textContent.trim() || d.querySelector('img') ? d.innerHTML : '';
}
function lineRect(){
  const s = getSelection(); if(!s.rangeCount) return null;
  const r = s.getRangeAt(0).cloneRange(); r.collapse(true);
  return r.getClientRects()[0] || null;
}
function dirty(){
  ED.dirty = true; window.__mtDirty = true;
  clearTimeout(ED._dt); ED._dt = setTimeout(saveDraft, 1200);
}

/* ═══ 묶기 ═══ */
function bind(){
  const root = R.querySelector('.ed');
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  root.addEventListener('beforeinput', onBeforeInput);
  root.addEventListener('input', e => {
    if(e.target.closest('.ol-t,.dl-t,.kr-t,.et-title,td,th,.ob-cap,.ob-url,.ob-ttl,#ed-title,#ed-place,#ed-guests,.ab input,.kr-d')){
      const et = e.target.closest('.et'); if(et && e.target.closest('.ol-t')) renum(et);
      if(e.target.matches('.ab input')){ const u = e.target.closest('.ab').dataset.u; ED.att[u].r = e.target.value.trim(); e.target.closest('.ab').querySelectorAll('button').forEach(b => b.classList.remove('on')); }
      dirty();
    }
  });
  root.addEventListener('change', e => {
    if(e.target.id === 'ed-date'){ ED.date = e.target.value; paintCont(); dirty(); }
    if(e.target.id === 'ed-time' || e.target.matches('.kr-d')) dirty();
  });
  root.addEventListener('paste', onPaste);
  root.addEventListener('focusin', e => {
    R.querySelectorAll('.et.focus').forEach(x => x.classList.remove('focus'));
    const et = e.target.closest('.et'); if(et) et.classList.add('focus');
    const cell = e.target.closest('.ob-c td, .ob-c th'); if(cell) ED.cell = cell;
    if(e.target.closest('.ol-t')) ED.line = e.target.closest('.ol');
  });
  root.addEventListener('dragover', e => { const b = e.target.closest('.et'); if(b && e.dataTransfer && [...e.dataTransfer.types].includes('Files')){ e.preventDefault(); b.querySelector('.et-body').classList.add('drop'); } });
  root.addEventListener('dragleave', e => { const b = e.target.closest('.et-body'); if(b) b.classList.remove('drop'); });
  root.addEventListener('drop', e => {
    const et = e.target.closest('.et'); if(!et || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); et.querySelector('.et-body').classList.remove('drop');
    const row = e.target.closest('.ol, .ob');
    addFiles(et, [...e.dataTransfer.files], row && row.parentElement && row.parentElement.classList.contains('et-body') ? row : null);
  });
  window.onbeforeunload = e => { if(ED && ED.dirty){ saveDraft(); e.preventDefault(); e.returnValue = ''; } };
}
function topicOfEvent(e){ return e.target.closest('.et'); }
function curLine(et){ const l = ED.line && ED.line.isConnected && et.contains(ED.line) ? ED.line : null; return l || [...et.querySelectorAll('.et-body > .ol')].pop() || null; }
async function onClick(e){
  const b = e.target.closest('[data-e]'); if(!b) return;
  const act = b.dataset.e, et = topicOfEvent(e), C = X.C;
  switch(act){
    case 'cancel': return cancel();
    case 'save': return save();
    case 'preview': return preview();
    case 'org': if(!ED.isNew) return; ED.org = b.dataset.v; if(!X.typesOf(ED.org).includes(ED.type)) ED.type = X.typesOf(ED.org)[0] || '';
      { const keep = collect(); ED.topics = keep.topics.length ? keep.topics : [blankTopic()]; ED.title = keep.title; ED.place = keep.place; ED.time = keep.time; ED.guests = keep.guests; ED.date = keep.date; }
      ED.att = {}; paint(); dirty(); return;
    case 'type': ED.type = b.dataset.v; R.querySelectorAll('#ed-types .mt-chip').forEach(x => x.classList.toggle('on', x === b));
      { const t = R.querySelector('#ed-title'); t.placeholder = C.titleOf({ type: ED.type }); t.previousElementSibling.innerHTML = `제목 <span style="font-weight:600;color:var(--ink-3)">(비우면 «${esc(C.titleOf({ type: ED.type }))}»)</span>`; }
      if(ED.isNew){ const pm = lastOf(ED.org, ED.type); if(pm){ const p = R.querySelector('#ed-place'), tm = R.querySelector('#ed-time'); if(!p.value) p.value = pm.place || ''; if(!tm.value) tm.value = pm.time || ''; if(!Object.keys(ED.att).length){ ED.att = rosterFrom(pm); ED.attNames = { ...(pm.attNames || {}) }; paintAtt(); } } }
      paintCont(); dirty(); return;
    case 'newtype': { const v = prompt('새 회의 종류 이름 (예: 교사 연수 회의)'); if(!v || !v.trim()) return; ED.type = v.trim();
      const box = R.querySelector('#ed-types'); box.querySelectorAll('.mt-chip').forEach(x => x.classList.remove('on'));
      b.insertAdjacentHTML('beforebegin', `<button type="button" class="mt-chip on" data-e="type" data-v="${esc(ED.type)}">${esc(ED.type)}</button>`);
      const t = R.querySelector('#ed-title'); t.placeholder = C.titleOf({ type: ED.type }); paintCont(); dirty(); return; }
    case 'cont': return openCont(b.dataset.mid);
    case 'att': { const u = b.dataset.u; const a = ED.att[u]; const s = a ? a.s : '';
      if(!s) ED.att[u] = { s: 'o' }; else if(s === 'o') ED.att[u] = { s: 'x', r: '' }; else delete ED.att[u];
      const nm = X.nameOf(u); if(nm) ED.attNames[u] = nm;
      paintAtt(); dirty(); return; }
    case 'allin': poolOf(ED.org).forEach(s => { if(!ED.att[s.uid]) { ED.att[s.uid] = { s: 'o' }; ED.attNames[s.uid] = s.name || ''; } }); paintAtt(); dirty(); return;
    case 'addppl': return pickPeople(b, { title: '다른 사람 추가', pool: X.STAFF, picked: Object.keys(ED.att), onDone: list => { list.forEach(u => { if(!ED.att[u]) ED.att[u] = { s: 'o' }; ED.attNames[u] = X.nameOf(u); }); paintAtt(); dirty(); } });
    case 'absr': { const u = b.closest('.ab').dataset.u; ED.att[u].r = b.dataset.r; paintAtt(); dirty(); return; }
    case 'addtopic': { const t = blankTopic(); R.querySelector('#ed-topics').insertAdjacentHTML('beforeend', topicHTML(t)); const el = R.querySelector(`.et[data-tid="${t.id}"]`); hydrate(el, t); renumAll(); el.querySelector('.et-title').focus(); dirty(); return; }
    case 'tup': { const p = et.previousElementSibling; if(p) et.parentElement.insertBefore(et, p); renumAll(); dirty(); return; }
    case 'tdown': { const n = et.nextElementSibling; if(n) et.parentElement.insertBefore(n, et); renumAll(); dirty(); return; }
    case 'tfold': et.classList.toggle('fold'); b.textContent = et.classList.contains('fold') ? '펼치기' : '접기'; renum(et); return;
    case 'tdel': { const has = et.querySelector('.et-title').value.trim() || [...et.querySelectorAll('.ol-t')].some(x => x.textContent.trim()) || et.querySelector('.ob,.dl,.kr');
      if(has && !confirm('이 주제를 뺄까요? (저장 전이면 되돌릴 수 있어요 — 취소하고 나가기)')) return; et.remove(); renumAll(); note(); dirty(); return; }
    case 'bold': document.execCommand('bold'); dirty(); return;
    case 'mark': return toggleMark();
    case 'indent': case 'outdent': { const l = curLine(et); if(l){ setLv(l, +l.dataset.lv + (act === 'indent' ? 1 : -1)); renum(et); dirty(); } return; }
    case 'addimg': return pickFiles('image/*', true, fs => addFiles(et, fs, curLine(et)));
    case 'adddoc': return pickFiles('.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.numbers,.pages,.key,.zip,.txt', true, fs => addFiles(et, fs, curLine(et)));
    case 'addtbl': insertBlock(et, curLine(et), { k: 'tbl', h: '<table><tr><th>제목</th><th>제목</th><th>제목</th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table>' }); dirty(); return;
    case 'addlink': { const u = prompt('링크 주소 (구글 드라이브 · 웹 페이지)', 'https://'); if(!u || !/^https?:\/\//.test(u.trim())) return;
      if(!C.safeUrl(u)){ X.toast('http:// 또는 https://로 시작하는 주소만 넣을 수 있어요', 'err'); return; }
      const t = prompt('보이는 이름 (비우면 주소 그대로)', '') || ''; insertBlock(et, curLine(et), { k: 'link', url: C.safeUrl(u), title: t.trim() }); dirty(); return; }
    case 'bup': { const o = b.closest('.ob'); const p = o.previousElementSibling; if(p) o.parentElement.insertBefore(o, p); renum(et); dirty(); return; }
    case 'bdown': { const o = b.closest('.ob'); const n = o.nextElementSibling; if(n) o.parentElement.insertBefore(n, o); renum(et); dirty(); return; }
    case 'bdel': { if(!confirm('이 첨부를 뺄까요?')) return; b.closest('.ob').remove(); ensureLine(et); renum(et); dirty(); return; }
    case 'trow': case 'tcol': case 'trowd': case 'tcold': case 'thead': case 'tcenter': return tableOp(b.closest('.ob'), act);
    case 'tcolor': return X.popMenu(b, [['#FFF59D', '노랑'], ['#FDE2C4', '주황'], ['#D4E9E2', '초록'], ['#DBEAFE', '파랑'], ['#FCE7F3', '분홍'], ['#E5E7EB', '회색'], ['', '색 없음']]
      .map(([c, l]) => ({ l: `<span style="display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid #ccc;background:${c || '#fff'}"></span> ${l}`, f: () => tableOp(b.closest('.ob'), 'color', c) })));
    case 'adddec': { const el = decEl(null); et.querySelector('.et-decs').appendChild(el); el.querySelector('.dl-t').focus(); renum(et); dirty(); return; }
    case 'ddel': { b.closest('.dl').remove(); renum(et); dirty(); return; }
    case 'addtask': { const el = taskEl(null); et.querySelector('.et-tasks').appendChild(el); el.querySelector('.kr-t').focus(); renum(et); dirty(); return; }
    case 'kdel': { b.closest('.kr').remove(); renum(et); note(); dirty(); return; }
    case 'who': { const kr = b.closest('.kr');
      const pool = ED.org === 'da' ? X.STAFF : poolOf(ED.org).concat(X.STAFF.filter(s => !poolOf(ED.org).includes(s) && ED.att[s.uid]));
      return pickPeople(b, { title: '담당 선생님', pool, picked: kr._uids, first: Object.keys(ED.att).filter(u => ED.att[u].s === 'o'), live: true,
        onDone: list => { kr._uids = list; list.forEach(u => kr._names[u] = X.nameOf(u)); whoLabel(kr); note(); dirty(); } }); }
  }
}
function onKey(e){
  if(e.isComposing || e.keyCode === 229) return;                  // 한글 조합 중에는 손대지 않는다
  const t = e.target;
  if((e.metaKey || e.ctrlKey) && e.key === 's'){ e.preventDefault(); save(); return; }
  if(t.closest('.ob-c td, .ob-c th')){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); document.execCommand('insertLineBreak'); }
    if(e.key === 'Tab'){ e.preventDefault(); const cells = [...t.closest('table').querySelectorAll('td,th')]; const i = cells.indexOf(t.closest('td,th')); const n = cells[i + (e.shiftKey ? -1 : 1)]; if(n) caretAt(n, true); }
    return;
  }
  if(t.classList.contains('et-title')){
    if(e.key === 'Enter'){ e.preventDefault(); const et = t.closest('.et'); const l = et.querySelector('.et-body > .ol .ol-t') || (ensureLine(et), et.querySelector('.et-body > .ol .ol-t')); caretAt(l, true); }
    return;
  }
  if(t.classList.contains('dl-t') || t.classList.contains('kr-t')){
    if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); rowEnter(t); }
    else if(e.key === 'Backspace' && rowBack(t)) e.preventDefault();
    return;
  }
  if(!t.classList.contains('ol-t')) return;
  const row = t.parentElement, et = t.closest('.et');
  if(e.key === 'Tab'){ e.preventDefault(); setLv(row, +row.dataset.lv + (e.shiftKey ? -1 : 1)); renum(et); dirty(); return; }
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); lineEnter(t); return; }
  if(e.key === 'Enter' && e.shiftKey){ e.preventDefault(); document.execCommand('insertLineBreak'); dirty(); return; }
  if(e.key === 'Backspace'){ if(lineBack(t)) e.preventDefault(); return; }
  if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
    const up = e.key === 'ArrowUp';
    const cr = lineRect(), er = t.getBoundingClientRect(), lh = parseFloat(getComputedStyle(t).lineHeight) || 24;
    const edge = !cr ? true : up ? (cr.top - er.top < lh * 0.8) : (er.bottom - cr.bottom < lh * 0.8);
    if(!edge) return;
    const all = [...R.querySelectorAll('.et-body > .ol .ol-t')];
    const n = all[all.indexOf(t) + (up ? -1 : 1)];
    if(n){ e.preventDefault(); caretAt(n, up); }
  }
}
/* Enter · Backspace — 키보드(keydown)와 폰·사파리 한글 입력(beforeinput) 양쪽에서 같은 동작 */
function rowEnter(t){
  const row = t.parentElement, et = t.closest('.et');
  const el = row.classList.contains('dl') ? decEl(null) : taskEl(null); row.after(el); caretAt(el.querySelector('.dl-t,.kr-t')); renum(et); dirty();
}
function rowBack(t){
  if(t.textContent || t.querySelector('img')) return false;
  const row = t.parentElement, et = t.closest('.et');
  const p = row.previousElementSibling; row.remove(); if(p) caretAt(p.querySelector('.dl-t,.kr-t'), true); renum(et); note(); dirty();
  return true;
}
function lineEnter(t){
  const row = t.parentElement, et = t.closest('.et');
  if(!t.textContent.trim() && +row.dataset.lv > 1){ setLv(row, +row.dataset.lv - 1); renum(et); dirty(); return; }
  const tail = splitTail(t);
  const nl = lineEl(+row.dataset.lv, tail); row.after(nl); caretAt(nl.querySelector('.ol-t')); renum(et); dirty();
}
function lineBack(t){
  if(!atStart(t)) return false;
  const sel = getSelection(); if(sel.rangeCount && !sel.isCollapsed) return false;
  const row = t.parentElement, et = t.closest('.et');
  if(+row.dataset.lv > 1 && t.textContent.trim()){ setLv(row, +row.dataset.lv - 1); renum(et); dirty(); return true; }
  const prev = row.previousElementSibling;
  if(!prev){ if(!t.textContent.trim() && +row.dataset.lv > 1){ setLv(row, 1); renum(et); return true; } return false; }
  if(prev.classList.contains('ob')){ if(!t.textContent.trim()){ row.remove(); ensureLine(et); } renum(et); dirty(); return true; }
  const pt = prev.querySelector('.ol-t');
  if(!t.textContent.trim() && !t.querySelector('img')){ row.remove(); caretAt(pt, true); }
  else { const mark = document.createElement('span'); mark.id = 'ed-mk'; pt.appendChild(mark); pt.insertAdjacentHTML('beforeend', t.innerHTML); row.remove();
    const m = pt.querySelector('#ed-mk'); pt.focus(); const r = document.createRange(); r.setStartBefore(m); r.collapse(true); m.remove(); const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(r); }
  renum(et); dirty(); return true;
}
function onBeforeInput(e){
  const t = e.target && e.target.closest && e.target.closest('.ol-t, .dl-t, .kr-t'); if(!t || e.isComposing) return;
  if(e.inputType === 'insertParagraph'){ e.preventDefault(); t.classList.contains('ol-t') ? lineEnter(t) : rowEnter(t); }
  else if(e.inputType === 'deleteContentBackward'){ if(t.classList.contains('ol-t') ? lineBack(t) : (!t.textContent && rowBack(t))) e.preventDefault(); }
}
function setLv(row, lv){ row.dataset.lv = X.C.clampLv(lv); }
function ensureLine(et){ const body = et.querySelector('.et-body'); if(!body.querySelector('.ol')) body.appendChild(lineEl(1, '')); }
function toggleMark(){
  const s = getSelection(); if(!s.rangeCount || s.isCollapsed){ X.toast('형광펜을 칠할 글자를 먼저 고르세요'); return; }
  const n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
  const mk = n && n.closest('mark');
  if(mk){ const p = mk.parentNode; while(mk.firstChild) p.insertBefore(mk.firstChild, mk); mk.remove(); }
  else { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, '#FFF59D'); }
  dirty();
}
function insertBlock(et, afterRow, b){
  const el = blockEl(b);
  const body = et.querySelector('.et-body');
  if(afterRow && afterRow.parentElement === body){
    const t = afterRow.querySelector && afterRow.querySelector('.ol-t');
    if(t && !t.textContent.trim() && !t.querySelector('img') && afterRow.previousElementSibling){ afterRow.replaceWith(el); }
    else afterRow.after(el);
  } else body.appendChild(el);
  /* 첨부 뒤에는 늘 빈 줄 하나 — 다음 첨부·글이 그 뒤로 이어지게 (빈 줄은 저장할 때 빠진다) */
  if(!el.nextElementSibling || !el.nextElementSibling.classList.contains('ol')) el.after(lineEl(afterRow && afterRow.dataset ? +afterRow.dataset.lv || 1 : 1, ''));
  ED.line = el.nextElementSibling;
  renum(et);
  return el;
}
function tableOp(ob, op, color){
  const tbl = ob.querySelector('table'); if(!tbl) return;
  let cell = ED.cell && tbl.contains(ED.cell) ? ED.cell : tbl.querySelector('td,th');
  const tr = cell.parentElement, rows = [...tbl.rows];
  const ci = cell.cellIndex;
  const width = Math.max(...rows.map(r => [...r.cells].reduce((s, c) => s + (c.colSpan || 1), 0)));
  const mk = (tag) => { const c = document.createElement(tag); c.setAttribute('contenteditable', 'true'); return c; };
  if(op === 'trow'){ const nr = document.createElement('tr'); for(let i = 0; i < width; i++) nr.appendChild(mk('td')); tr.after(nr); caretAt(nr.cells[0]); }
  if(op === 'tcol'){ rows.forEach(r => { const ref = r.cells[Math.min(ci, r.cells.length - 1)]; const c = mk(r.cells[0] && r.cells[0].tagName === 'TH' ? 'th' : 'td'); ref ? ref.after(c) : r.appendChild(c); }); }
  if(op === 'trowd'){ if(rows.length > 1){ tr.remove(); ED.cell = null; } }
  if(op === 'tcold'){ if(width > 1) rows.forEach(r => { const c = r.cells[Math.min(ci, r.cells.length - 1)]; if(c && r.cells.length > 1) c.remove(); }); ED.cell = null; }
  if(op === 'thead'){ const r0 = rows[0]; const isH = r0.cells[0] && r0.cells[0].tagName === 'TH';
    [...r0.cells].forEach(c => { const n = mk(isH ? 'td' : 'th'); n.innerHTML = c.innerHTML; if(c.colSpan > 1) n.colSpan = c.colSpan; if(c.rowSpan > 1) n.rowSpan = c.rowSpan; const st = c.getAttribute('style'); if(st) n.setAttribute('style', st); c.replaceWith(n); }); }
  if(op === 'tcenter'){ cell.style.textAlign = cell.style.textAlign === 'center' ? '' : 'center'; }
  if(op === 'color'){ cell.style.backgroundColor = color || ''; }
  dirty();
}
function pickFiles(accept, multi, cb){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multi;
  inp.onchange = () => { if(inp.files.length) cb([...inp.files]); };
  inp.click();
}
async function addFiles(et, files, afterRow){
  for(const f of files){
    const name = f.name || '';
    const ext = name.toLowerCase().split('.').pop();
    const wait = insertBlock(et, afterRow, { k: 'wait', msg: `${name || '파일'} 올리는 중…` });
    afterRow = wait.nextElementSibling;                      // 여러 개면 고른 순서대로 이어 붙는다
    const setMsg = t => { const d = wait.querySelector('.ob-ld'); if(d) d.textContent = t; };
    try{
      if((f.type || '').startsWith('image/') && !/heic|heif/i.test(f.type + ext)){
        setMsg(`${name} — 줄이는 중…`);
        const src = await readAsDataURL(f);
        const r = await X.STORE.putImage(ED.org, ED.id, src, 'img', name);
        wait.replaceWith(blockEl({ k: 'img', fid: r.fid, w: r.w, ht: r.ht, cap: '' }));
        X.toast(`${name} · ${X.C.fmtSize(f.size)} → ${X.C.fmtSize(r.size)}로 줄였어요`);
      } else if(/heic|heif/i.test(f.type + ext)){
        wait.remove(); X.toast('아이폰 HEIC 사진은 이 브라우저에서 열 수 없어요 — 사진 앱에서 JPG로 내보내거나 사파리에서 올려 주세요', 'err');
      } else if(ext === 'pdf'){
        const { pages, total } = await pdfPages(f, (i, n, all) => setMsg(`${name} — ${i}/${n}쪽 펼치는 중…${all > n ? ` (앞 ${n}쪽만)` : ''}`));
        const fids = [];
        for(let i = 0; i < pages.length; i++){ setMsg(`${name} — ${i + 1}/${pages.length}쪽 저장 중…`); fids.push(await X.STORE.putShrunk(ED.org, ED.id, pages[i], 'pdfpage', `${name} ${i + 1}쪽`)); }
        let fid = '';
        if(f.size <= FILE_MAX){ setMsg(`${name} — 원본 보관 중…`); fid = (await X.STORE.putFile(ED.org, ED.id, f)).fid; }
        wait.replaceWith(blockEl({ k: 'pdf', id: uid6('b'), name, fids, pages: total, fid, size: f.size, link: '' }));
        if(!fid) X.toast('원본이 5MB보다 커서 쪽 그림만 넣었어요 — 원본은 드라이브 링크로 붙여 주세요');
      } else if(['xlsx', 'xls', 'csv'].includes(ext) && confirm(`${name}\n\n표로 넣을까요? (취소: 파일 그대로 첨부)`)){
        setMsg(`${name} — 표로 바꾸는 중…`);
        const h = await xlsxTable(f);
        if(!h) throw new Error('표를 찾지 못했어요');
        wait.replaceWith(blockEl({ k: 'tbl', h, cap: name }));
      } else if(f.size <= FILE_MAX){
        setMsg(`${name} — 보관 중…`);
        const r = await X.STORE.putFile(ED.org, ED.id, f);
        wait.replaceWith(blockEl({ k: 'file', fid: r.fid, name, size: f.size, mime: f.type || '' }));
      } else {
        const link = prompt(`${name} (${X.C.fmtSize(f.size)})는 5MB보다 커서 바로 보관할 수 없어요.\n구글 드라이브에 올린 뒤 링크를 붙여 주세요:`, 'https://');
        if(X.C.safeUrl(link)) wait.replaceWith(blockEl({ k: 'file', name, size: f.size, link: X.C.safeUrl(link) }));
        else wait.remove();
      }
    }catch(err){
      console.error(err); wait.remove();
      X.toast(`${name}을(를) 넣지 못했어요 — ${err.message || err}`, 'err');
    }
    if(!ED || !et.isConnected) return;               // 그 사이 편집기를 닫았으면 멈춘다
    renum(et); dirty();
  }
}
async function onPaste(e){
  const t = e.target.closest('.ol-t, .dl-t, .kr-t, .ob-c td, .ob-c th'); if(!t) return;
  const cd = e.clipboardData; if(!cd) return;
  const et = t.closest('.et');
  const imgs = [...(cd.files || [])].filter(f => (f.type || '').startsWith('image/'));
  const html = cd.getData('text/html') || '', text = cd.getData('text/plain') || '';
  if(imgs.length && et && !text.trim()){ e.preventDefault(); addFiles(et, imgs, t.closest('.ol')); return; }
  if(t.matches('td,th,.dl-t,.kr-t')){ e.preventDefault(); document.execCommand('insertText', false, t.matches('td,th') ? text : text.replace(/\s*\n\s*/g, ' ')); dirty(); return; }
  const row = t.closest('.ol');
  if(/<table/i.test(html)){
    const cells = (html.match(/<t[dh][\s>]/gi) || []).length;
    if(cells > 1){
      e.preventDefault();
      const tb = await sanitizeTableHTML(html);
      if(tb){ insertBlock(et, row, { k: 'tbl', h: tb }); X.toast('표로 넣었어요 — 칸을 눌러 바로 고칠 수 있어요'); dirty(); return; }
    }
  }
  if(looksTsv(text)){ e.preventDefault(); insertBlock(et, row, { k: 'tbl', h: X.C.tsvToTable(text) }); dirty(); return; }
  if(text.trim().includes('\n')){ e.preventDefault(); pasteOutline(et, row, text); return; }
  e.preventDefault();
  if(html) document.execCommand('insertHTML', false, sanitizeInline(html));
  else document.execCommand('insertText', false, text);
  renum(et); dirty();
}
/* 엑셀 칸 복사처럼 보이는가 — 글 «사이»에 탭이 있는 줄이 둘 이상, 칸 수가 같고, 번호 개요 줄이 아님 */
function looksTsv(text){
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').filter(l => l.trim());
  if(lines.length < 2) return false;
  const inner = lines.filter(l => /\S\t|\t\S/.test(l.replace(/^\t+/, '')) && /\S/.test(l.replace(/^\t+/, '').split('\t')[0]));
  if(inner.length < 2) return false;
  if(lines.some(l => /^\s*(\(?\d{1,2}[.)]|\(?[IVX]{1,5}[.)])\s/.test(l))) return false;
  const cols = new Set(inner.map(l => l.split('\t').length));
  return cols.size <= 2 && Math.min(...cols) >= 2;
}
function pasteOutline(et, row, text){
  const C = X.C;
  const parsed = C.parseOutline(text);
  if(!parsed.length) return;
  const esc2 = s => C.esc(s);
  if(parsed.length > 1 && confirm(`붙여 넣은 글에서 주제 ${parsed.length}개를 찾았어요.\n주제로 나눠 넣을까요? (취소: 이 주제 안에 줄로만)`)){
    let at = et;
    const empty = !et.querySelector('.et-title').value.trim() && ![...et.querySelectorAll('.ol-t')].some(x => x.textContent.trim()) && !et.querySelector('.ob,.dl,.kr');
    parsed.forEach((p, i) => {
      const t = { id: uid6('t'), title: p.title, body: p.lines.length ? p.lines.map(l => ({ k: 'l', lv: l.lv, h: esc2(l.t) })) : [{ k: 'l', lv: 1, h: '' }], dec: [], tasks: [] };
      at.insertAdjacentHTML('afterend', topicHTML(t));
      const el = at.nextElementSibling; hydrate(el, t); at = el;
    });
    if(empty) et.remove();
    renumAll(); dirty(); X.toast(`주제 ${parsed.length}개로 나눠 넣었어요`); return;
  }
  const lines = [];
  parsed.forEach(p => { if(p.title) lines.push({ lv: 1, t: p.title }); p.lines.forEach(l => lines.push(l)); });
  if(parsed.length === 1 && parsed[0].title && !et.querySelector('.et-title').value.trim()){
    et.querySelector('.et-title').value = parsed[0].title; lines.shift();
  }
  let cur = row;
  const rt = row && row.querySelector('.ol-t');
  if(rt && !rt.textContent.trim() && lines.length){ const f = lines.shift(); row.dataset.lv = C.clampLv(f.lv); rt.innerHTML = esc2(f.t); }
  for(const l of lines){ const nl = lineEl(l.lv, esc2(l.t)); if(cur) cur.after(nl); else et.querySelector('.et-body').appendChild(nl); cur = nl; }
  if(cur) caretAt(cur.querySelector('.ol-t'), true);
  renum(et); dirty();
}
/* 사람 고르기 (담당 · 다른 참석자) */
function pickPeople(anchor, o){
  document.querySelectorAll('.wp').forEach(p => p.remove());
  const picked = new Set(o.picked || []);
  const first = new Set(o.first || []);
  const p = document.createElement('div'); p.className = 'wp';
  const C = X.C;
  const orgL = s => C.MORG_SHORT[s.org] || '';
  const draw = (q) => {
    const L = o.pool.filter(s => !q || (s.name || '').includes(q));
    const a = L.filter(s => first.has(s.uid)), b = L.filter(s => !first.has(s.uid));
    const row = s => `<label><input type="checkbox" value="${esc(s.uid)}"${picked.has(s.uid) ? ' checked' : ''}>${esc(s.name || '')}<small>${esc(s.position || '')} ${esc(orgL(s))}</small></label>`;
    p.querySelector('.ls').innerHTML = (a.length ? `<div class="gh">참석한 사람</div>${a.map(row).join('')}` : '') + (b.length ? `${a.length ? '<div class="gh">그 밖의 선생님</div>' : ''}${b.map(row).join('')}` : '') || '<div class="gh">찾는 이름이 없어요</div>';
  };
  p.innerHTML = `<input type="search" placeholder="${esc(o.title)} — 이름 찾기"><div class="ls"></div><div class="ft"><button type="button" class="mt-btn sm g">고르기 끝</button></div>`;
  document.body.appendChild(p);
  const r = anchor.getBoundingClientRect();
  p.style.left = Math.max(8, Math.min(innerWidth - 290, r.left)) + 'px';
  p.style.top = (r.bottom + 390 > innerHeight ? Math.max(8, r.top - 390) : r.bottom + 4) + 'px';
  draw('');
  const inp = p.querySelector('input[type=search]'); inp.focus();
  inp.oninput = () => draw(inp.value.trim());
  const done = () => { p.remove(); document.removeEventListener('mousedown', off, true); o.onDone([...picked]); };
  p.addEventListener('change', e => { const c = e.target; if(c.type !== 'checkbox') return; c.checked ? picked.add(c.value) : picked.delete(c.value); if(o.live) o.onDone([...picked]); });
  p.querySelector('.ft button').onclick = done;
  const off = e => { if(!p.contains(e.target)) done(); };
  setTimeout(() => document.addEventListener('mousedown', off, true), 0);
}
/* 지난 회의에서 이어오기 */
function openCont(mid){
  const pm = X.LIST.find(x => x.id === mid); if(!pm) return;
  const C = X.C;
  const md = X.modal(`↩ ${esc(C.fmtMD(pm.date))} ${esc(C.titleOf(pm))}에서 이어오기`, `<div class="dv-hint" style="margin-bottom:8px">고른 주제가 «이어 쓰는 주제»로 들어가요. 못 끝낸 임무는 첫 줄에 적어 둬요 (임무 자체는 원래 회의록에 그대로).</div>
    ${(pm.topics || []).map((t, i) => { const open = (t.tasks || []).filter(k => (X.TASKS[C.taskKey(pm.id, k.id)] || {}).status !== 'done').length;
      return `<label class="ck"><input type="checkbox" value="${esc(t.id)}"${open ? ' checked' : ''}>${i + 1}. ${esc(t.title || '')}${open ? ` <span style="color:#B45309;font-size:12px;font-weight:800">못 끝낸 임무 ${open}</span>` : ''}</label>`; }).join('')}
    <label class="ck" style="margin-top:8px;border-top:1px solid var(--line);padding-top:10px"><input type="checkbox" id="ct-att" checked>참석 명단도 같은 사람들로</label>`,
    `<button class="mt-btn" data-c="x">닫기</button><button class="mt-btn p" data-c="ok">불러오기</button>`);
  md.box.querySelector('[data-c="x"]').onclick = md.close;
  md.box.querySelector('[data-c="ok"]').onclick = () => {
    const ids = new Set([...md.box.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value));
    const tps = carryTopics(pm, (pm.topics || []).filter(t => ids.has(t.id)), true);
    if(md.box.querySelector('#ct-att').checked){ const r = rosterFrom(pm); for(const u in r) if(!ED.att[u]) ED.att[u] = r[u]; Object.assign(ED.attNames, pm.attNames || {}); paintAtt(); }
    const box = R.querySelector('#ed-topics');
    const ets = [...box.querySelectorAll('.et')];
    if(ets.length === 1 && !ets[0].querySelector('.et-title').value.trim() && ![...ets[0].querySelectorAll('.ol-t')].some(x => x.textContent.trim())) ets[0].remove();
    tps.forEach(t => { box.insertAdjacentHTML('beforeend', topicHTML(t)); hydrate(box.lastElementChild, t); });
    renumAll(); dirty(); md.close(); X.toast(`주제 ${tps.length}개를 불러왔어요`);
  };
}

/* ═══ 모으기 · 미리 보기 · 임시 저장 ═══ */
function collect(){
  const C = X.C;
  const q = s => R.querySelector(s);
  const topics = [...R.querySelectorAll('.et')].map(el => {
    const body = [];
    [...el.querySelector('.et-body').children].forEach(r => {
      if(r.classList.contains('ol')){
        const h = sanitizeInline(r.querySelector('.ol-t').innerHTML);
        if(C.textOf(h).trim()) body.push({ k: 'l', lv: C.clampLv(r.dataset.lv), h });
      } else if(r.classList.contains('ob') && r._b && r._b.k !== 'wait'){
        const b = { ...r._b };
        const cap = r.querySelector('.ob-cap'); b.cap = cap ? cap.value.trim() : (b.cap || '');
        if(b.k === 'tbl'){ const t = r.querySelector('table'); b.h = t ? cleanEditedTable(t) : (b.h || ''); }
        if(b.k === 'link'){ b.url = C.safeUrl((r.querySelector('.ob-url') || {}).value || b.url || ''); b.title = ((r.querySelector('.ob-ttl') || {}).value || '').trim(); if(!b.url) return; }
        if(b.k === 'file' && r.querySelector('.ob-url')) b.link = C.safeUrl(r.querySelector('.ob-url').value);
        Object.keys(b).forEach(k => { if(b[k] === undefined) delete b[k]; });
        body.push(b);
      }
    });
    const dec = [...el.querySelectorAll('.dl')].map(d => ({ id: d.dataset.did, h: sanitizeInline(d.querySelector('.dl-t').innerHTML) })).filter(d => C.textOf(d.h).trim());
    const tasks = [...el.querySelectorAll('.kr')].map(k => {
      const uids = (k._uids || []).slice();
      const names = {}; uids.forEach(u => names[u] = X.nameOf(u) || (k._names || {})[u] || '');
      return { id: k.dataset.kid, h: sanitizeInline(k.querySelector('.kr-t').innerHTML), uids, names, due: k.querySelector('.kr-d').value || '' };
    }).filter(k => C.textOf(k.h).trim());
    const t = { id: el.dataset.tid, title: el.querySelector('.et-title').value.trim(), body, dec, tasks };
    if(el._thr){ t.thr = el._thr; t.thrFrom = el._thrFrom || ''; }
    if(el._ed) t.ed = el._ed;
    return t;
  }).filter(t => t.title || t.body.length || t.dec.length || t.tasks.length);
  const attNames = {};
  Object.keys(ED.att).forEach(u => attNames[u] = X.nameOf(u) || ED.attNames[u] || '');
  const att = {};
  for(const [u, a] of Object.entries(ED.att)) att[u] = a.s === 'x' ? { s: 'x', r: a.r || '' } : { s: 'o' };
  return {
    org: ED.org, type: ED.type || '', title: (q('#ed-title') || {}).value ? q('#ed-title').value.trim() : '',
    date: (q('#ed-date') || {}).value || ED.date, time: (q('#ed-time') || {}).value || '', place: (q('#ed-place') || {}).value ? q('#ed-place').value.trim() : '',
    writerUid: ED.writerUid || '', writerName: ED.writerName || '', att, attNames, guests: (q('#ed-guests') || {}).value ? q('#ed-guests').value.trim() : '',
    topics, imported: !!ED.imported,
  };
}
function preview(){
  const d = collect();
  const md = X.modal('문서로 미리보기', `<div class="dv-paper" style="min-height:0">${X.C.renderDoc({ ...d, id: ED.id }, { files: Object.fromEntries(X.STORE.cache) })}</div>`, '', 'wide');
  md.box.querySelectorAll('.md-ph[data-fid]').forEach(async ph => { const s = await X.STORE.getImage(ph.dataset.fid); if(s && ph.isConnected){ const im = document.createElement('img'); im.src = s; ph.replaceWith(im); } });
}
const DKEY = () => ED.isNew ? 'mtg_draft_new' : 'mtg_draft_' + ED.id;
function saveDraft(){
  if(!ED || !ED.dirty || !R || !R.querySelector('.ed')) return;     // 편집 화면이 없으면 (빈 내용으로 덮지 않게)
  try{ localStorage.setItem(DKEY(), JSON.stringify({ at: Date.now(), id: ED.id, baseRev: ED.baseRev, data: collect() })); }catch(e){}
  const s = R.querySelector('#ed-saved'); if(s) s.textContent = '임시 저장됨 · ' + new Date().toTimeString().slice(0, 5);
}
function checkDraft(){
  let d = null; try{ d = JSON.parse(localStorage.getItem(DKEY()) || 'null'); }catch(e){}
  if(!d || !d.data || Date.now() - (d.at || 0) > 14 * 86400000) return;
  const box = R.querySelector('#ed-rs');
  const stale = !ED.isNew && d.baseRev !== ED.baseRev;
  box.innerHTML = `<div class="ed-rs">📝 <span>저장하지 않은 ${ED.isNew ? '새 회의록' : '고친 내용'}이 있어요 (${esc(X.C.fmtStamp(d.at))})${stale ? ' — 그 사이 다른 분이 고쳐 저장했어요. 이어서 쓰면 그분 고친 것은 이력에만 남아요.' : ''}</span>
    <div class="mt-sp"></div><button type="button" class="mt-btn sm p" data-dr="use">이어서 쓰기</button><button type="button" class="mt-btn sm" data-dr="drop">버리기</button></div>`;
  box.onclick = e => {
    const b = e.target.closest('[data-dr]'); if(!b) return;
    if(b.dataset.dr === 'drop'){ try{ localStorage.removeItem(DKEY()); }catch(_){} box.innerHTML = ''; return; }
    const v = d.data;
    if(ED.isNew && d.id) ED.id = d.id;
    Object.assign(ED, { org: v.org || ED.org, type: v.type, title: v.title, date: v.date, time: v.time, place: v.place, att: v.att || {}, attNames: v.attNames || {}, guests: v.guests || '', topics: v.topics && v.topics.length ? v.topics : [blankTopic()] });
    paint(); ED.dirty = true; window.__mtDirty = true; X.toast('임시 저장한 내용을 불러왔어요');
  };
}
/* 뒤로 가기 등으로 편집 화면을 떠날 때 — 임시 저장을 지키고 정리 */
export function closeEditor(){
  if(!ED) return;
  clearTimeout(ED._dt);
  saveDraft();
  if(!ED.isNew) X.FS.updateDoc(X.FS.doc(X.db, 'meetings', ED.id), { editing: null }).catch(()=>{});
  ED.dirty = false; window.onbeforeunload = null;
  document.querySelectorAll('.wp').forEach(p => p.remove());
  ED = null;
}
function cancel(){
  if(uploading() && !confirm('사진 · 문서를 올리는 중이에요. 그래도 나갈까요? (올리던 것은 빠질 수 있어요)')) return;
  if(ED.dirty && !confirm('저장하지 않고 나갈까요? 쓰던 내용은 이 기기의 임시 저장에 남아요.')) return;
  clearTimeout(ED._dt); saveDraft();
  const id = ED.isNew ? '' : ED.id;
  if(!ED.isNew) X.FS.updateDoc(X.FS.doc(X.db, 'meetings', id), { editing: null }).catch(()=>{});
  ED.dirty = false; window.__mtDirty = false; window.onbeforeunload = null;
  ED = null;
  X.onCancel(id);
}

/* ═══ 저장 — 수정 이력 한 벌 · 임무 맞추기 · 알림 ═══ */
const uploading = () => !!(R && R.querySelector('.ob[data-k="wait"]'));
async function save(force){
  if(!ED || ED.saving) return;
  if(uploading()){ X.toast('사진 · 문서를 올리는 중이에요 — 다 올라간 뒤에 저장해 주세요', 'err'); return; }
  const d = collect();
  if(!d.date){ X.toast('날짜를 골라 주세요', 'err'); return; }
  if(!d.type){ X.toast('회의 종류를 골라 주세요', 'err'); return; }
  if(!d.topics.length){ X.toast('주제를 하나 이상 적어 주세요', 'err'); return; }
  if(JSON.stringify(d).length > 900000){ X.toast('회의록이 너무 커요 — 표를 나누거나 문서로 첨부해 주세요', 'err'); return; }
  ED.saving = true;
  const btns = R.querySelectorAll('[data-e="save"]'); btns.forEach(b => { b.disabled = true; b.textContent = '저장 중…'; });
  try{
    await persist(X, ED.id, d, { baseRev: ED.baseRev, force: !!force, isNew: ED.isNew });
    try{ localStorage.removeItem(DKEY()); }catch(e){}
    ED.dirty = false; window.__mtDirty = false; window.onbeforeunload = null;
    clearTimeout(ED._dt);
    const id = ED.id; ED = null;
    X.toast('저장했어요 ✓');
    X.onSaved(id);
  }catch(e){
    ED.saving = false;
    btns.forEach(b => b.disabled = false); note();
    if(e.message === 'conflict'){
      const c = e.cur || {};
      if(confirm(`${c.updatedByName || '다른 선생님'} 님이 먼저 고쳐 저장했어요 (${X.C.fmtStamp(X.C.tsMs(c.updatedAt))}).\n\n내 것으로 저장할까요? 그분이 고친 모습도 수정 이력에 그대로 남아요.\n(취소: 저장하지 않고 이 화면에 머물기)`)){
        ED.baseRev = c.rev || 0; return save(true);
      }
      return;
    }
    console.error(e);
    X.toast('저장하지 못했어요 — ' + (e.code === 'permission-denied' ? '이 기관 회의록을 쓸 권한이 없어요 (보안 규칙 v23 게시 확인)' : (e.code || e.message)), 'err');
  }
}
async function persist(ctx, id, data, o){
  const { db, FS, C, CU } = ctx;
  const ref = FS.doc(db, 'meetings', id);
  let prevData = null, saved = null;
  await FS.runTransaction(db, async tx => {
    const cur = await tx.get(ref);
    prevData = cur.exists() ? cur.data() : null;
    if(prevData && !o.force && (prevData.rev || 0) !== (o.baseRev || 0)){ const er = new Error('conflict'); er.cur = prevData; throw er; }
    const rev = (prevData ? prevData.rev || 0 : 0) + 1;
    const ch = C.changeSummary(prevData, data);
    const now = Date.now();
    const topics = data.topics.map(t => (prevData && ch.changed.includes(t.id)) ? { ...t, ed: { uid: CU.uid, name: CU.name || '', at: now, rev } } : t);
    saved = { ...data, topics, org: prevData ? prevData.org : data.org, sem: C.semOf(data.date), rev,
      createdBy: prevData ? (prevData.createdBy || CU.uid) : CU.uid, createdAt: prevData && prevData.createdAt ? prevData.createdAt : FS.serverTimestamp(),
      updatedAt: FS.serverTimestamp(), updatedByUid: CU.uid, updatedByName: CU.name || '',
      cmtCount: prevData ? (prevData.cmtCount || 0) : 0, lastCmtAt: prevData && prevData.lastCmtAt ? prevData.lastCmtAt : null,
      deleted: false, editing: null, imported: prevData ? !!prevData.imported : !!data.imported, source: prevData ? (prevData.source || '') : '' };
    tx.set(ref, saved);
    const snap = { type: saved.type, title: saved.title, date: saved.date, time: saved.time, place: saved.place, writerUid: saved.writerUid, writerName: saved.writerName,
      att: saved.att, attNames: saved.attNames, guests: saved.guests, topics: saved.topics, imported: saved.imported };
    tx.set(FS.doc(db, 'meetingVersions', `${id}_${rev}`), { meetingId: id, org: saved.org, rev, at: FS.serverTimestamp(), atMs: now, uid: CU.uid, name: CU.name || '',
      sum: o.sum || ch.sum, data: snap });
  });
  await syncTasks(ctx, id, saved, prevData);
  return saved;
}
async function syncTasks(ctx, id, m, prev){
  const { db, FS, C, CU } = ctx;
  const want = new Map();
  (m.topics || []).forEach((t, ti) => (t.tasks || []).forEach(k => { if(C.textOf(k.h).trim()) want.set(C.taskKey(id, k.id), { t, ti, k }); }));
  const have = new Map();
  try{ const s = await FS.getDocs(FS.query(FS.collection(db, 'meetingTasks'), FS.where('meetingId', '==', id))); s.forEach(d => have.set(d.id, d.data())); }catch(e){}
  const batch = FS.writeBatch(db);
  const mtitle = C.titleOf(m);
  for(const [key, { t, ti, k }] of want){
    const def = { meetingId: id, org: m.org, sem: m.sem, date: m.date, mtitle, topicId: t.id, topicNo: ti + 1, topicTitle: t.title || '', kid: k.id,
      h: C.textOf(k.h).trim(), uids: k.uids || [], names: k.names || {}, due: k.due || '', deleted: false, updatedAt: FS.serverTimestamp() };
    if(have.has(key)) batch.set(FS.doc(db, 'meetingTasks', key), def, { merge: true });
    else batch.set(FS.doc(db, 'meetingTasks', key), { ...def, status: 'todo', cmt: 0, createdAt: FS.serverTimestamp(), createdBy: CU.uid });
  }
  for(const key of have.keys()) if(!want.has(key)) batch.delete(FS.doc(db, 'meetingTasks', key));
  try{ await batch.commit(); }catch(e){ console.warn('tasks', e); X && X.toast && X.toast('임무를 홈에 올리지 못했어요 — ' + (e.code || e.message), 'err'); }
  const old = new Map();
  ((prev && prev.topics) || []).forEach(t => (t.tasks || []).forEach(k => old.set(k.id, new Set(k.uids || []))));
  for(const [key, { t, ti, k }] of want){
    const was = old.get(k.id) || new Set();
    for(const u of k.uids || []){
      if(was.has(u) || u === CU.uid) continue;
      FS.addDoc(FS.collection(db, 'mtgNotifs'), { toUid: u, kind: 'task', meetingId: id, org: m.org, mtitle, date: m.date, tgt: 'k:' + key,
        where: `${ti + 1}. ${t.title || ''}`, text: C.textOf(k.h).trim().slice(0, 140) + (k.due ? ` · ${C.fmtMD(k.due)}까지` : ''),
        fromUid: CU.uid, fromName: CU.name || '', at: FS.serverTimestamp(), read: false }).catch(()=>{});
    }
  }
}
/* 수정 이력에서 «이 모습으로 되돌리기» */
export async function saveRevert(ctx, m, ver){
  X = X || ctx;
  const v = ver.data || {};
  const data = { org: m.org, type: v.type || '', title: v.title || '', date: v.date || m.date, time: v.time || '', place: v.place || '',
    writerUid: v.writerUid || '', writerName: v.writerName || '', att: v.att || {}, attNames: v.attNames || {}, guests: v.guests || '',
    topics: (v.topics || []).map(t => { const { ed, ...rest } = t; return rest; }), imported: !!v.imported };
  return persist(ctx, m.id, data, { baseRev: m.rev || 0, sum: `${ver.rev}번째 모습으로 되돌림` });
}
