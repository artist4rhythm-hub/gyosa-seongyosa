/* ⏱ v219 출결 기록 타임머신 — «고친 기록» 서랍
   · 출결을 저장 · 고치기 · 지우기 할 때마다 «바뀌기 직전 값(b)»과 «바뀐 값(a)»을 attendLog 에 한 묶음으로 남김
     (출결 저장 자체는 그대로 — 여기 기록이 실패해도 출결 저장에는 영향 없음 · 하루치 저장 한 번에 쓰기 +1 · 여러 날에 걸치면 날마다 +1)
   · 서랍: 지금 보는 반 · 날(또는 달)의 바뀐 내역, 줄마다 «이것만 되돌리기», 묶음은 «이 묶음 모두 되돌리기»
   · 되돌린 것도 한 줄로 남아 다시 되돌릴 수 있음 · 잠긴 달은 보안 규칙이 막음(볼 수만 있음)
   · 읽기는 서랍을 열 때만 (그 기관 · 그 날 또는 그 달 묶음만) */
let X = null;                 // attend.html 이 넘겨 주는 것들
let BUF = [], TMR = 0, T0 = 0, OFF = 0;      // OFF = 규칙이 막은 시각 (5분 뒤 다시 시도)
const off = () => OFF && Date.now() - OFF < 300000;
const wait = ms => new Promise(r => setTimeout(r, ms));
let ST = null;                // 서랍 상태
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const types = r => (r && Array.isArray(r.typeIds) && r.typeIds.length) ? r.typeIds : ((r && r.typeId) ? [r.typeId] : []);
const sig = r => r ? types(r).slice().sort().join('+') + '|' + (r.reason || '') + '|' + String(r.memo || '').trim() : '';
const clean = o => { if(!o) return null; const x = {}; Object.keys(o).forEach(k => { if(o[k] !== undefined) x[k] = o[k]; }); return x; };
const ms = t => !t ? 0 : (typeof t.toMillis === 'function' ? t.toMillis() : (t.seconds ? t.seconds * 1000 : +new Date(t) || 0));

export function init(ctx){ X = ctx; }

/* 한 건 남기기 — kind: 'save' 저장 · 'edit' 고침 · 'del' 지움 · 'trip' 체험학습 한꺼번에 · 'undo' 되돌림
   r: { sid, name, cid, cname, org, date, id, b, a }  (b = 바뀌기 전 기록 전체 또는 null · a = 바뀐 뒤 또는 null) */
export function note(kind, r){
  try{
    if(!X || off() || !r || !r.sid || !r.date || !r.org) return;
    const b = clean(r.b), a = clean(r.a);
    if(sig(b) === sig(a) && !!b === !!a) return;                       // 달라진 것이 없으면 남기지 않음
    BUF.push({ kind, org: r.org, date: r.date, row: { sid: r.sid, name: r.name || '', cid: r.cid || '', cname: r.cname || '', id: r.id || '', b, a } });
    if(!T0) T0 = Date.now();
    clearTimeout(TMR);
    if(Date.now() - T0 > 3000) flush(); else TMR = setTimeout(flush, 1200);          // 길게 이어지는 한꺼번에 입력도 3초마다는 남김
  }catch(e){ console.warn('[attend-log] note', e); }
}
let PEND = Promise.resolve();      // 지금 쓰는 중인 묶음 (서랍이 목록을 받기 전에 잠깐 기다림)
export function flush(){ const p = flush1(); PEND = Promise.all([PEND.catch(() => {}), p.catch(() => {})]); return p; }
async function flush1(){
  clearTimeout(TMR); T0 = 0;
  const buf = BUF; BUF = []; if(!buf.length || !X || off()) return;
  const g = {};
  buf.forEach(x => { const k = x.org + '|' + x.date + '|' + x.kind; (g[k] = g[k] || { org: x.org, date: x.date, kind: x.kind, rows: [] }).rows.push(x.row); });
  const { addDoc, collection, Timestamp } = X.fs, cu = X.CU();
  for(const k of Object.keys(g)){
    const G = g[k];
    for(let i = 0; i < G.rows.length; i += 40){
      const ch = G.rows.slice(i, i + 40), month = G.date.slice(0, 7);
      try{
        await addDoc(collection(X.db, 'attendLog'), { org: G.org, date: G.date, month, dk: G.org + '_' + G.date, mk: G.org + '_' + month,
          classIds: Array.from(new Set(ch.map(c => c.cid).filter(Boolean))).slice(0, 40), kind: G.kind, n: ch.length, ch, at: Timestamp.now(), by: cu.name || '', byUid: cu.uid });
      }catch(e){
        console.warn('[attend-log] 기록을 남기지 못했어요 (출결 저장은 됐어요)', e && e.message);
        if(/permission|insufficient/i.test((e && e.message) || '')){ OFF = Date.now(); return; }      // 규칙이 아직이면 이번에는 더 시도하지 않음
      }
    }
  }
}
if(typeof window !== 'undefined'){ window.addEventListener('pagehide', () => { try{ flush(); }catch(e){} }); document.addEventListener('visibilitychange', () => { if(document.hidden){ try{ flush(); }catch(e){} } }); }

/* ── 서랍 ── */
const KIND = { save: ['저장', 'k-save'], edit: ['고침', 'k-edit'], del: ['지움', 'k-del'], trip: ['체험학습', 'k-save'], undo: ['되돌림', 'k-undo'] };
const lab = r => r ? (X.label(r) || '(항목 없음)') : null;
function css(){
  if(document.getElementById('alg-css')) return;
  const s = document.createElement('style'); s.id = 'alg-css';
  s.textContent = `
#alg{position:fixed;top:0;right:0;bottom:0;width:min(480px,100vw);z-index:9000;background:var(--surface,#fff);border-left:2px solid #1E3932;box-shadow:-10px 0 28px rgba(30,57,50,.18);display:flex;flex-direction:column;font-size:14px;color:var(--ink,#1E3932)}
#alg .alg-h{display:flex;align-items:center;gap:8px;padding:13px 16px;background:#1E3932;color:#fff;flex:none}
#alg .alg-h b{font-size:15.5px}#alg .alg-h small{font-size:12.5px;color:#CFE3DA;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#alg .alg-x{margin-left:auto;font:inherit;font-size:12.5px;font-weight:700;min-height:36px;padding:0 12px;border-radius:8px;border:1px solid #5B7A70;background:transparent;color:#fff;cursor:pointer}
#alg .alg-f{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--line,#E3E8E5);flex:none}
#alg .alg-c{font:inherit;font-size:12.5px;font-weight:700;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line,#C9D3CE);background:var(--surface,#fff);color:inherit;cursor:pointer}
#alg .alg-c.on{background:#1E3932;border-color:#1E3932;color:#fff}
#alg .alg-b{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}
#alg .alg-g{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line,#E3E8E5)}
#alg .alg-gh{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap}#alg .alg-gh b{font-size:13.5px}#alg .alg-gh small{font-size:12px;color:var(--ts,#5B6B64)}
#alg .alg-k{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px}
#alg .k-save{background:#EEF0EE;color:#44524C}#alg .k-edit{background:#DBEAFE;color:#1D4ED8}#alg .k-del{background:#FDE7DC;color:#9A3412}#alg .k-undo{background:#EDE4FA;color:#5B21B6}
#alg .alg-r{display:grid;grid-template-columns:minmax(56px,84px) minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--bg,#FBFAF6);border:1px solid var(--line,#EEF1EF);border-radius:10px;padding:8px 10px}
#alg .alg-r>b{font-size:13px;overflow-wrap:anywhere}#alg .alg-r>b small{display:block;font-size:11px;font-weight:500;color:var(--ts,#5B6B64)}
#alg .alg-v{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
#alg .alg-p{font-size:12.5px;padding:2px 9px;border-radius:999px;background:#EEF0EE;color:#44524C;overflow-wrap:anywhere}
#alg .alg-p.to{font-weight:700;background:#E8F3EF;color:#00704A}#alg .alg-p.gone{background:#FDE7DC;color:#9A3412}
#alg .alg-u{font:inherit;font-size:12px;font-weight:700;min-height:38px;padding:0 10px;border-radius:8px;border:1.5px solid #1E3932;background:var(--surface,#fff);color:inherit;cursor:pointer;white-space:nowrap}
#alg .alg-u:disabled{opacity:.45;cursor:default}
#alg .alg-ga{margin-left:auto;font:inherit;font-size:12px;font-weight:700;min-height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--line,#C9D3CE);background:var(--surface,#fff);color:inherit;cursor:pointer}
#alg .alg-more{font:inherit;font-size:12.5px;font-weight:600;min-height:36px;border:1px dashed var(--line,#C9D3CE);border-radius:10px;background:transparent;color:var(--ts,#5B6B64);cursor:pointer;text-align:left;padding:0 10px}
#alg .alg-e{padding:26px 18px;text-align:center;color:var(--ts,#5B6B64);font-size:13px;line-height:1.7}
#alg .alg-t{padding:10px 14px;border-top:1px solid var(--line,#E3E8E5);font-size:12px;color:var(--ts,#5B6B64);line-height:1.6;flex:none}
html[data-theme="dark"] #alg .alg-p{background:#2B322F;color:#C9D3CE}html[data-theme="dark"] #alg .alg-p.to{background:#17352B;color:#8FD3B5}html[data-theme="dark"] #alg .alg-u{border-color:#6FA892}
@media(max-width:560px){#alg .alg-r{grid-template-columns:minmax(0,1fr) auto}#alg .alg-r>b{grid-column:1 / -1}}
.alg-open{font:inherit;font-size:13px;font-weight:700;min-height:40px;padding:0 13px;border-radius:10px;border:1.5px solid #1E3932;background:#1E3932;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}`;
  document.head.appendChild(s);
}
/* sc: { org, classIds:[…], label, date('YYYY-MM-DD' 또는 ''), month('YYYY-MM') } */
export async function open(sc){
  if(!X || !sc || !sc.org) return;
  css(); close();
  ST = { sc, span: sc.date ? 'day' : 'month', mine: false, del: false, docs: null, err: '', openNew: {}, busy: false };
  const el = document.createElement('aside'); el.id = 'alg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '출결 고친 기록');
  document.body.appendChild(el);
  el.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  draw(); await load();
  const x = el.querySelector('.alg-x'); if(x) x.focus();
}
export function close(){ const el = document.getElementById('alg'); if(el) el.remove(); document.removeEventListener('keydown', onKey); ST = null; }
export const isOpen = () => !!ST;
function onKey(e){ if(e.key === 'Escape' && ST) close(); }
async function load(){
  const st = ST; if(!st) return;
  st.docs = null; st.err = ''; draw();
  flush(); await Promise.race([PEND, wait(2500)]);      // 방금 남긴 줄이 보이게 — 통신이 느려도 서랍은 멈추지 않음
  try{
    const { getDocs, query, where, collection } = X.fs, sc = st.sc;
    const q = st.span === 'day' ? query(collection(X.db, 'attendLog'), where('dk', '==', sc.org + '_' + sc.date)) : query(collection(X.db, 'attendLog'), where('mk', '==', sc.org + '_' + sc.month));
    const snap = await getDocs(q); if(ST !== st) return;
    const docs = []; snap.forEach(d => docs.push(Object.assign({ _id: d.id }, d.data())));
    docs.sort((a, b) => ms(b.at) - ms(a.at));
    st.docs = docs;
  }catch(e){ if(ST !== st) return; st.docs = []; st.err = /permission|insufficient/i.test(e.message || '') ? 'rule' : (e.message || '읽지 못했어요'); }
  draw();
}
const when = t => { const d = new Date(ms(t)); if(!ms(t)) return ''; const p = n => String(n).padStart(2, '0'); const today = new Date(); const same = d.toDateString() === today.toDateString(); return (same ? '오늘 ' : `${d.getMonth() + 1}/${d.getDate()} `) + `${p(d.getHours())}:${p(d.getMinutes())}`; };
/* 접어 둔 «새로 넣음» 요약 — 가장 많은 값 + 나머지 수 */
function top(rows){ const c = {}; rows.forEach(r => { const k = lab(r.a); c[k] = (c[k] || 0) + 1; }); const e = Object.entries(c).sort((a, b) => b[1] - a[1]); return e[0][0] + ' ' + e[0][1] + '명' + (e.length > 1 ? ` · 그 밖 ${rows.length - e[0][1]}명` : ''); }
function rowsOf(d){
  const st = ST, set = new Set(st.sc.classIds || []);
  return (d.ch || []).map((r, i) => Object.assign({ i }, r)).filter(r => (!set.size || set.has(r.cid)) && (!st.del || !r.a));
}
function draw(){
  const el = document.getElementById('alg'), st = ST; if(!el || !st) return;
  const sc = st.sc, chip = (k, t, on) => `<button type="button" class="alg-c${on ? ' on' : ''}" data-alg="${k}" aria-pressed="${on}">${t}</button>`;
  const dlab = sc.date ? `${+sc.date.slice(5, 7)}월 ${+sc.date.slice(8, 10)}일` : '';
  let body = '';
  if(st.docs === null) body = '<div class="alg-e">불러오는 중…</div>';
  else if(st.err === 'rule') body = '<div class="alg-e">아직 고친 기록을 볼 수 없어요.<br>보안 규칙 v59가 게시되면 그때부터 기록이 남고 여기에 보여요.</div>';
  else if(st.err) body = `<div class="alg-e">읽지 못했어요 — ${esc(st.err)}</div>`;
  else {
    const gs = st.docs.filter(d => !st.mine || d.byUid === X.CU().uid).map(d => ({ d, rows: rowsOf(d) })).filter(g => g.rows.length);
    if(!gs.length) body = `<div class="alg-e">${st.del ? '지운 기록이 없어요.' : '이 범위에서 바뀐 기록이 없어요.'}<br><small>기록은 v219부터 남아요 — 그 전에 저장한 것은 보이지 않아요.</small></div>`;
    else body = gs.map(({ d, rows }) => {
      const k = KIND[d.kind] || KIND.save;
      const fresh = rows.filter(r => !r.b && r.a), rest = rows.filter(r => r.b || !r.a);
      const fold = fresh.length > 4 && !st.openNew[d._id];                       // «새로 넣음»이 많으면 한 줄로 접어 둠
      const shown = fold ? rest : rows;
      const row = r => { const can = X.canEdit(r.cid);
        return `<div class="alg-r"><b>${esc(r.name)}${st.sc.classIds.length !== 1 && r.cname ? `<small>${esc(r.cname)}</small>` : ''}${st.span === 'month' ? `<small>${+d.date.slice(5, 7)}/${+d.date.slice(8, 10)}</small>` : ''}</b>
          <div class="alg-v"><span class="alg-p">${r.b ? esc(lab(r.b)) : '(없음)'}</span><span aria-hidden="true">→</span><span class="alg-p ${r.a ? 'to' : 'gone'}">${r.a ? esc(lab(r.a)) : '(지움)'}</span></div>
          <button type="button" class="alg-u" data-alg="undo" data-d="${esc(d._id)}" data-i="${r.i}"${can ? '' : ' disabled title="이 반 출결을 고칠 수 있는 선생님만 되돌릴 수 있어요"'}>${r.b ? '이것만 되돌리기' : '넣은 것 취소'}</button></div>`; };
      return `<div class="alg-g"><div class="alg-gh"><b>${esc(d.by || '')}</b><small>${esc(when(d.at))}</small><span class="alg-k ${k[1]}">${k[0]}${rows.length > 1 ? ` ${rows.length}명` : ''}</span>
          ${rows.length > 1 && rows.some(r => X.canEdit(r.cid)) ? `<button type="button" class="alg-ga" data-alg="undoall" data-d="${esc(d._id)}">이 묶음 모두 되돌리기</button>` : ''}</div>
        ${shown.map(row).join('')}
        ${fold ? `<button type="button" class="alg-more" data-alg="more" data-d="${esc(d._id)}">그 밖에 새로 넣은 ${fresh.length}명 (${esc(top(fresh))}) — 펼치기</button>` : ''}</div>`;
    }).join('');
  }
  el.innerHTML = `<div class="alg-h"><b>⏱ 고친 기록</b><small>${esc(sc.label || '')}</small><button type="button" class="alg-x" data-alg="close">닫기</button></div>
    <div class="alg-f">${sc.date ? chip('day', `이 날 (${dlab})`, st.span === 'day') : ''}${chip('month', `${+sc.month.slice(5, 7)}월 전체`, st.span === 'month')}${chip('mine', '내가 고친 것만', st.mine)}${chip('del', '지운 기록만', st.del)}</div>
    <div class="alg-b">${body}</div>
    <div class="alg-t">되돌린 것도 여기에 한 줄로 남아 다시 되돌릴 수 있어요. 🔒 잠긴 달은 볼 수만 있어요.</div>`;
}
async function onClick(e){
  const b = e.target.closest('[data-alg]'), st = ST; if(!b || !st) return;
  const a = b.dataset.alg;
  if(a === 'close') return close();
  if(st.busy) return;
  if(a === 'day' || a === 'month'){ if(st.span !== a){ st.span = a; await load(); } return; }
  if(a === 'mine'){ st.mine = !st.mine; return draw(); }
  if(a === 'del'){ st.del = !st.del; return draw(); }
  if(a === 'more'){ st.openNew[b.dataset.d] = true; return draw(); }
  const d = (st.docs || []).find(x => x._id === b.dataset.d); if(!d) return;
  { const why = X.unsaved && X.unsaved(); if(why){ X.toast(why, 'err'); return; } }
  st.busy = true;
  try{
    if(a === 'undo') await undoRows(d, [d.ch[+b.dataset.i]], false);
    if(a === 'undoall') await undoRows(d, rowsOf(d).filter(r => X.canEdit(r.cid)), true);
  }catch(err){ X.toast(/permission|insufficient/i.test(err.message || '') ? '🔒 잠긴 달이라 되돌릴 수 없어요 — 잠금을 푼 뒤 다시 해 주세요.' : '되돌리지 못했어요: ' + (err.message || ''), 'err'); }
  if(ST === st){ st.busy = false; await load(); }
}
/* 지금 서버에 있는 그 학생 · 그 날 기록 — 같은 문서가 있으면 그것, 없으면 같은 반의 다른 문서 */
async function current(d, r){
  const { doc, getDoc } = X.fs;
  if(r.id){ const s = await getDoc(doc(X.db, 'studentAttendance', r.id)); if(s.exists()) return { id: r.id, data: s.data() }; }
  const snap = await X.byStudentDay(r.sid, d.date); let hit = null;
  snap.forEach(x => { const v = x.data(); if(!hit && (!r.cid || v.classId === r.cid)) hit = { id: x.id, data: v }; });
  return hit;
}
async function undoRows(d, rows, group){
  const { doc } = X.fs;
  rows = rows.filter(Boolean); if(!rows.length) return;
  const plan = [];
  for(const r of rows){
    if(!X.canEdit(r.cid)) continue;
    const cur = await current(d, r);
    plan.push({ r, cur, moved: sig(cur && cur.data) !== sig(r.a) || !!cur !== !!r.a });      // 그 뒤에 또 바뀌었는지
  }
  if(!plan.length){ X.toast('이 반 출결을 고칠 수 있는 선생님만 되돌릴 수 있어요.', 'err'); return; }
  const day = `${+d.date.slice(5, 7)}월 ${+d.date.slice(8, 10)}일`;
  let todo = plan;
  if(group){
    const moved = plan.filter(p => p.moved); todo = plan.filter(p => !p.moved);
    if(!todo.length){ X.toast('이 묶음의 기록이 그 뒤에 모두 다시 바뀌었어요 — 줄마다 «이것만 되돌리기»로 확인하며 되돌려 주세요.', 'err'); return; }
    if(!confirm(`${day} — ${d.by || ''} 님이 ${when(d.at)}에 ${(KIND[d.kind] || KIND.save)[0]}한 ${todo.length}명을 그 전으로 되돌릴까요?` + (todo.filter(p => !p.r.b).length ? `\n\n그중 ${todo.filter(p => !p.r.b).length}명은 그때 새로 넣은 기록이라 지워져요.` : '') + (moved.length ? `\n\n그 뒤에 다시 바뀐 ${moved.length}명은 건너뛰어요 (줄마다 따로 되돌릴 수 있어요).` : '') + `\n\n되돌린 것도 «고친 기록»에 남아 다시 되돌릴 수 있어요.`)) return;
  } else {
    const p = plan[0], r = p.r;
    if(sig(p.cur && p.cur.data) === sig(r.b) && !!p.cur === !!r.b){ X.toast('이미 그때 값과 같아요.'); return; }
    if(!confirm(`${r.name} · ${day}\n\n지금: ${p.cur ? lab(p.cur.data) : '(기록 없음)'}\n되돌리면: ${r.b ? lab(r.b) : '(기록 없음 — 지워져요)'}` + (p.moved ? `\n\n⚠ 이 기록은 그 뒤에 또 바뀌었어요. 그래도 그때 값으로 되돌릴까요?` : '') + `\n\n되돌린 것도 «고친 기록»에 남아 다시 되돌릴 수 있어요.`)) return;
  }
  /* 줄마다: 확인 창을 본 사이에 다른 분이 또 바꿨는지 서버에서 다시 읽고(트랜잭션), 그대로일 때만 되돌림 */
  let n = 0, skip = 0, fail = 0, lock = false;
  try{
    for(const p of todo){
      const r = p.r, id = (p.cur && p.cur.id) || r.id;
      if(!id){ skip++; continue; }
      const ref = doc(X.db, 'studentAttendance', id);
      try{
        const out = await X.fs.runTransaction(X.db, async tx => {
          const s = await tx.get(ref), now = s.exists() ? s.data() : null;
          if(!!now !== !!p.cur || sig(now) !== sig(p.cur && p.cur.data)) return 'moved';
          if(r.b){ tx.set(ref, r.b); return 'ok'; }
          if(now){ tx.delete(ref); return 'ok'; }
          return 'same';
        });
        if(out === 'ok'){ note('undo', { sid: r.sid, name: r.name, cid: r.cid, cname: r.cname, org: d.org, date: d.date, id, b: p.cur ? p.cur.data : null, a: r.b }); n++; }
        else if(out === 'moved') skip++;
      }catch(e){ fail++; if(/permission|insufficient/i.test((e && e.message) || '')) lock = true; else console.warn('[attend-log] undo', e); }
    }
  } finally {
    flush();                                                       // 기다리지 않음 (통신이 끊겨도 서랍이 멈추지 않게)
    if(n && X.after){ try{ X.after(n, d); }catch(e){} }             // 하나라도 바뀌었으면 뒤 화면을 꼭 새로 받음
  }
  const tail = (skip ? ` · 그 사이 또 바뀐 ${skip}건은 그대로 뒀어요` : '') + (fail ? ` · ${fail}건은 되돌리지 못했어요${lock ? ' (🔒 잠긴 달은 잠금을 푼 뒤에)' : ''}` : '');
  if(n) X.toast(`${n}건을 되돌렸어요` + tail, (skip || fail) ? 'err' : 'ok');
  else X.toast(fail ? (lock ? '🔒 잠긴 달이라 되돌릴 수 없어요 — 잠금을 푼 뒤 다시 해 주세요.' : '되돌리지 못했어요 — 잠시 뒤 다시 해 주세요.') : '그 사이에 기록이 또 바뀌어 되돌리지 않았어요 — 목록을 다시 확인해 주세요.', 'err');
}
