/* ═══════════════════════════════════════════════════════════
   ⏱ nhp-keep.js — 나학평 «설정» 타임머신 (보기 · 되살리기) · v211
   · 보관(nhpKeep)은 nhp.html 의 A.keep 이 «바뀌기 직전 값»만 남김 — 여기는 그것을 보여 주고 되살리는 화면
       term  학기 정보 · 마감 · 반 · 담임 · 학생 명단 · 뺀 학생 · 부서 · 검토 순서 · 담임평가 항목 · 목록 담당
       lists 특별활동 · 부모교육 · 비전트립 · 캠프 … 공통 목록
       cells 칸의 이름 · 맡은 선생님 · 순서 · 듣는 학생 · 함께 쓰기 · 빼기 (평가 틀 · 평가 방식 · 검토관 · 조 편성은 여기서 다루지 않음)
       cfg   출력 모양 · 영문 이름  /  forms 기관 양식 모음
   · 되살리기는 «고른 것만» — 통째로 덮지 않음. 저장은 학기 설정의 평소 저장 길(H.saveTerm · H.updateSections · H.saveReview · H.saveLists · A.saveSub)로 가서
     되살리기 직전 모습도 다시 보관됨 (되살린 것을 또 되돌릴 수 있음)
   · 보관 기간: 최근 30일 모두 · 그보다 오래된 것은 «같은 것을 바꾼» 보관끼리 하루에 하나
   · 그때 없던 값(null)을 되살릴 때는 칸을 지움(deleteField) — null 을 적지 않음
   · 학생 입력 · 평가 틀은 칸마다의 ⏱ 타임머신(nhp-entry.js)이 맡음
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null, H = null;
const bind = (a, h) => { A = a; C = a.C; esc = a.esc; FS = a.FS; if(h) H = h; };
const DAYS = 30;
const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0);
const at = t => { const m = ms(t); if(!m) return '방금'; const d = new Date(m); const p = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const SJ = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
const same = (a, b) => SJ(a == null ? null : a) === SJ(b == null ? null : b);
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const KIND = { term: '학기 설정', lists: '공통 목록', cells: '칸', cfg: '출력 · 영문', forms: '기관 양식' };
const TERM_L = { start: '학기 시작', end: '학기 끝', due: '마감 날짜', days: '총 수업 일수', sections: '반 · 담임 · 학생', review: '검토 순서 · 검토관', depts: '부서 묶음', listEditors: '공통 목록 담당', hr: '담임평가 항목', status: '학기 상태', year: '학년도', term: '학기', name: '학기 이름', mgrs: '나학평 담당' };
const LIST_L = { activities: '특별활동', parentEdu: '부모교육', visions: '비전트립', camps: '캠프', serve: '봉사 · 수상', books: '도서', setups: '옮겨 온 틀' };
const CELL_L = { name: '이름', teacherUids: '맡은 선생님', order: '순서', studentIds: '듣는 학생', share: '함께 쓰기', grp: '조', secId: '반', removed: '빼기(휴지통)', rv: '검토관', rvL: '검토 단계 이름', printName: '출력 이름', printTeacher: '출력 선생님 이름', hide: '출력에서 빼기', type: '평가 방식', setup: '평가 틀', kind: '종류', cat: '갈래', dept: '부서' };
const CFG_L = { print: '출력 모양 (표지 · 속지 · 확인 칸)', rep: '영문판 대표', levelEn: '단계 영문 이름', classEn: '반 영문 이름', translators: '번역 담당', list: '기관 양식 모음' };
const SKIP = { finAll: 1, updatedAt: 1, updatedBy: 1 };
const CELL_OK = { name: 1, printName: 1, printTeacher: 1, teacherUids: 1, order: 1, studentIds: 1, share: 1, secId: 1, removed: 1, hide: 1 };
const names = L => (L || []).map(u => A.staffName(u) || (A.STU[u] ? A.stuName(u) : u)).join(', ') || '(없음)';
/* 값을 사람이 읽을 글로 */
function show(v, k){
  if(v == null || v === '') return '<i>(비어 있음)</i>';
  if(typeof v === 'boolean') return v ? '예' : '아니오';
  if(typeof v !== 'object') return esc(String(v));
  if(Array.isArray(v)){
    if(!v.length) return '<i>(없음)</i>';
    if(v.every(x => typeof x === 'string')) return esc(names(v));
    return esc(v.map(x => (x && (x.t || x.name || x.title || x.ko)) || '').filter(Boolean).join(' · ') || `${v.length}개`);
  }
  if(k === 'due') return esc(['entry', 'review', 'final'].map(x => v[x] ? `${{ entry: '입력', review: '검토', final: '최종' }[x]} ${v[x]}` : '').filter(Boolean).join(' · ') || '(없음)');
  const j = JSON.stringify(v); return esc(j.length > 260 ? j.slice(0, 260) + ' …' : j);
}
const rowHTML = (label, was, now, btn) => `<div class="kp-ch"><div class="k">${esc(label)}${btn || ''}</div><div class="was"><small>그때</small>${was}</div><div class="now"><small>지금</small>${now}</div></div>`;
/* 번호(id)가 있는 목록의 차이 */
function listDiff(was, now){
  was = Array.isArray(was) ? was : []; now = Array.isArray(now) ? now : [];
  const id = x => x && (x.id || x.t || x.name);
  return { gone: was.filter(x => !now.some(y => id(y) === id(x))), neu: now.filter(y => !was.some(x => id(x) === id(y))),
    chg: was.filter(x => { const y = now.find(z => id(z) === id(x)); return y && !same(x, y); }), order: was.map(id).join() !== now.map(id).join() };
}
const ttl = x => (x && (x.t || x.name || x.title)) || '(이름 없음)';

async function load(){
  const out = [];
  const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpKeep'), FS.where('termId', 'in', [A.TERM.id, '_cfg'])));
  q.forEach(d => { let x; try{ x = d.data({ serverTimestamps: 'estimate' }); }catch(e){ x = d.data(); } out.push(Object.assign({ id: d.id }, x)); });
  out.forEach(x => { if(!ms(x.at)) x.at = FS.Timestamp.fromMillis(Date.now()); });
  out.sort((a, b) => ms(b.at) - ms(a.at));
  return out;
}
/* 30일이 지난 것 — «같은 것을 바꾼» 보관끼리 하루에 하나(그날의 마지막)만 남김. 담당만 · 사흘에 한 번. 지운 id 목록을 돌려줌 */
const sigOf = x => { const d = x.data || {}; return x.kind === 'cells' ? Object.keys(d.cells || {}).sort().map(id => id + ':' + Object.keys((d.cells[id] || {}).before || {}).sort().join('+')).join(',') : Object.keys(d).sort().join(','); };
async function prune(L){
  if(!A.isMgr) return [];
  const k = 'nhp_kp_' + A.TERM.id; try{ if(Date.now() - (Number(localStorage.getItem(k)) || 0) < 3 * 864e5) return []; }catch(e){}
  const cut = Date.now() - DAYS * 864e5; const seen = {}; const del = [], done = [];
  L.forEach(x => { const m = ms(x.at); if(!m || m >= cut) return; const d = new Date(m); const dk = `${x.termId}|${x.kind}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${sigOf(x)}`; if(!seen[dk]){ seen[dk] = 1; return; } del.push(x.id); });
  for(const id of del){ try{ await FS.deleteDoc(FS.doc(A.db, 'nhpKeep', id)); done.push(id); }catch(e){ break; } }
  try{ localStorage.setItem(k, String(Date.now())); }catch(e){}
  return done;
}
/* 되살리기 전에 «지금»을 서버에서 다시 읽음 — 다른 분이 막 고친 것 위에 옛 화면 값으로 덮지 않게 */
async function fresh(){
  try{ await A.reloadLists(); }catch(e){}
  try{ const c = await FS.getDoc(FS.doc(A.db, 'nhpConfig', 'main')); if(c.exists()) A.CFG = c.data(); }catch(e){}
  try{ const f = await FS.getDoc(FS.doc(A.db, 'nhpConfig', 'forms')); if(f.exists()) A.FORMS = f.data(); }catch(e){}
}

export async function openKeep(a, h){
  bind(a, h);
  if(document.querySelector('.mm-ov [data-keep-box]')) return;
  const m = A.modal('⏱ 설정 타임머신 — ' + esc(C.termLabel(A.TERM)), '<div data-keep-box><div class="nh-desc">지난 설정을 여는 중…</div></div>', '', 'wide xl');
  const box = m.body.querySelector('[data-keep-box]');
  let L = [];
  try{ L = await load(); await fresh(); }
  catch(e){
    box.innerHTML = /permission/.test((e && e.code) || '')
      ? '<div class="nh-warn">설정 타임머신 보관함이 아직 열리지 않았어요 — 보안 규칙 <b>v57</b>이 게시되면 켜져요. (설정 저장은 지금도 그대로 돼요)</div>'
      : `<div class="nh-warn">지난 설정을 읽지 못했어요 — ${esc(A.errText(e))}</div>`;
    return;
  }
  if(!document.body.contains(box)) return;
  let cur = L.length ? L[0].id : '', filt = 'all', busy = false;
  let solo = {};      // «모두 그때로»에서 빼는 것 — 항목이 늘거나 준 목록의 «목록 전체» (새 항목을 지우지 않게, 순서만 다른 때는 넣음)
  let touched = false;      // 담임 · 맡은 선생님 · 반이 바뀌는 되살리기를 했는가 → 끝난 뒤 검토관을 한 번 다시 맞춤
  prune(L).then(del => { if(del.length){ L = L.filter(x => !del.includes(x.id)); draw(); } }).catch(() => {});
  const can = A.isMgr;
  const secNow = id => (A.TERM.sections || []).find(x => x.id === id);
  /* ── 종류별: 그때와 지금의 차이 → [{ html }] · 되살릴 것 목록(acts[key] = () => Promise) ── */
  const build = v => {
    const acts = {}; const rows = []; const d = v.data || {}; solo = {};
    const btn = (key, label) => can ? `<br><button class="nh-btn xs" data-kpgo="${esc(key)}">${esc(label || '이것만 되살리기')}</button>` : '';
    if(v.kind === 'term'){
      Object.keys(d).filter(k => !SKIP[k]).forEach(k => {
        if(k === 'sections'){
          const was = Array.isArray(d.sections) ? d.sections : []; const now = A.TERM.sections || [];
          was.forEach(ws => { const ns = secNow(ws.id); const lab = C.secLabel(ws);
            if(!ns){ acts['sec+' + ws.id] = () => (touched = true, H.updateSections(list => list.some(x => x.id === ws.id) ? list : list.concat([clone(ws)]))); rows.push(rowHTML(`${lab} (반)`, `학생 ${(ws.students || []).length}명`, '<i>지금은 없는 반</i>', btn('sec+' + ws.id, '이 반을 되살리기'))); return; }
            const add = (ws.students || []).filter(x => !(ns.students || []).includes(x)), rem = (ns.students || []).filter(x => !(ws.students || []).includes(x));
            const parts = [];
            if(add.length || rem.length) parts.push(['students', '학생 명단', `${(ws.students || []).length}명${add.length ? ` — 지금은 없는 학생: ${esc(names(add))}` : ''}`, `${(ns.students || []).length}명${rem.length ? ` — 그 뒤에 들어온 학생: ${esc(names(rem))}` : ''}`]);
            if(!same(ws.out || {}, ns.out || {})) parts.push(['out', '뺀 학생', esc(Object.keys(ws.out || {}).map(i => `${A.stuName(i)}(${ws.out[i]})`).join(', ') || '(없음)'), esc(Object.keys(ns.out || {}).map(i => `${A.stuName(i)}(${ns.out[i]})`).join(', ') || '(없음)')]);
            if((ws.hrUid || '') !== (ns.hrUid || '')) parts.push(['hrUid', '나학평 담임', esc(A.staffName(ws.hrUid) || '(없음)'), esc(A.staffName(ns.hrUid) || '(없음)')]);
            if((ws.name || '') !== (ns.name || '')) parts.push(['name', '반 이름', esc(ws.name || ''), esc(ns.name || '')]);
            parts.forEach(([f, fl, w, n]) => { const key = `sec:${ws.id}:${f}`;
              acts[key] = () => { if(f === 'hrUid') touched = true; return H.updateSections(list => list.map(x => { if(x.id !== ws.id) return x;
                const pick = (o, no) => Object.keys(o || {}).filter(i => !no.includes(i)).reduce((r, i) => { r[i] = o[i]; return r; }, {});
                if(f === 'out') return Object.assign({}, x, { out: pick(ws.out, x.students || []) });      // 지금 명단에 있는 학생은 «뺀 학생»으로 되돌리지 않음 (명단과 뺀 학생이 겹치지 않게)
                if(f === 'students') return Object.assign({}, x, { students: clone(ws.students || []), out: pick(x.out, ws.students || []) });      // 그때 명단 그대로 (한 학생이 여러 반에 있을 수 있는 구조라 다른 반은 건드리지 않음)
                return Object.assign({}, x, { [f]: ws[f] == null ? '' : clone(ws[f]) }); })); };
              rows.push(rowHTML(`${lab} · ${fl}`, w, n, btn(key, f === 'students' ? '이 반 명단을 그때로' : '이것만 되살리기'))); });
          });
          now.filter(ns => !was.some(ws => ws.id === ns.id)).forEach(ns => rows.push(rowHTML(`${C.secLabel(ns)} (반)`, '<i>그때는 없던 반</i>', `학생 ${(ns.students || []).length}명`, '')));
          return;
        }
        if(same(d[k], A.TERM[k])) return;
        if(k === 'hr'){ rows.push(rowHTML(TERM_L[k], show(d[k], k), show(A.TERM[k], k), '<br><small>담임평가 항목은 칸마다의 틀과 묶여 있어 여기서 돌리지 않아요 — «담임평가 서랍»이나 그 칸의 ⏱ 타임머신에서 되살리세요.</small>')); return; }
        acts['t:' + k] = k === 'review' ? () => { if(d[k] == null) return false; return H.saveReview(clone(d[k])); }
          : async () => { const nul = d[k] == null; const r = await H.saveTerm({ [k]: nul ? FS.deleteField() : clone(d[k]) }); if(r && nul) delete A.TERM[k]; return r; };      // 그때 없던 값은 칸을 지움
        rows.push(rowHTML(TERM_L[k] || k, show(d[k], k), show(A.TERM[k], k), d[k] == null && k === 'review' ? '' : btn('t:' + k)));
      });
    } else if(v.kind === 'lists'){
      Object.keys(d).filter(k => !SKIP[k] && k !== 'termId').forEach(k => {
        const was = d[k], now = (A.LISTS || {})[k]; if(same(was, now)) return;
        const lab = LIST_L[k] || k;
        if(Array.isArray(was)){
          const f = listDiff(was, now);
          const putOne = x => async () => H.saveLists({ [k]: await (async () => { await A.reloadLists(); const arr = ((A.LISTS || {})[k] || []).slice(); const i = arr.findIndex(y => (y.id || y.t) === (x.id || x.t)); if(i >= 0) arr[i] = clone(x); else arr.push(clone(x)); return arr; })() });      // 서버의 지금 목록 위에 이 항목만
          f.gone.forEach(x => { const key = `l:${k}:${x.id || x.t}`; acts[key] = putOne(x); rows.push(rowHTML(`${lab} — 지금은 없는 항목`, `<b>${esc(ttl(x))}</b>${x.d ? ' <small>' + esc(x.d) + '</small>' : ''}${x.c ? '<br>' + esc(String(x.c).slice(0, 160)) : ''}`, '<i>(없음)</i>', btn(key, '이 항목만 되살리기'))); });
          f.chg.forEach(x => { const y = (now || []).find(z => (z.id || z.t) === (x.id || x.t)); const key = `l:${k}:${x.id || x.t}`; acts[key] = putOne(x);
            const fs = [...new Set(Object.keys(x).concat(Object.keys(y)))].filter(q => !same(x[q], y[q]));
            rows.push(rowHTML(`${lab} — 바뀐 항목 «${ttl(x)}»`, fs.map(q => `<small>${esc(q === 't' ? '이름' : q === 'd' ? '일시' : q === 'c' ? '활동 사항' : q === 'from' ? '시작' : q === 'to' ? '끝' : q === 'secs' ? '대상 반' : q)}</small> ${show(x[q])}`).join('<br>'), fs.map(q => `<small>&nbsp;</small> ${show(y[q])}`).join('<br>'), btn(key, '이 항목만 그때로'))); });
          f.neu.forEach(y => rows.push(rowHTML(`${lab} — 그 뒤에 생긴 항목`, '<i>(없음)</i>', `<b>${esc(ttl(y))}</b>`, '')));
          if(f.gone.length + f.chg.length + f.neu.length > 1 || (!f.gone.length && !f.chg.length && !f.neu.length && f.order)){ acts['lk:' + k] = () => H.saveLists({ [k]: clone(was) }); if(f.gone.length + f.chg.length + f.neu.length) solo['lk:' + k] = 1; rows.push(rowHTML(`${lab} — 목록 전체`, `${was.length}개`, `${(now || []).length}개`, btn('lk:' + k, '목록 전체를 그때로'))); }
        } else if(was == null){ rows.push(rowHTML(lab, '<i>(그때는 없음)</i>', show(now), '')); }
        else { acts['lk:' + k] = () => H.saveLists({ [k]: clone(was) }); rows.push(rowHTML(lab, show(was), show(now), btn('lk:' + k))); }
      });
    } else if(v.kind === 'cells'){
      Object.keys(d.cells || {}).forEach(id => { const b = d.cells[id]; const s = A.subOf(id); const lab = (b.label || '칸') + (A.secOf(b.secId) ? ' · ' + C.secLabel(A.secOf(b.secId)) : '');
        if(!s){ rows.push(rowHTML(lab, '보관돼 있음', '<i>지금은 없는 칸</i>', '')); return; }
        const fs = Object.keys(b.before || {}).filter(k => CELL_OK[k] && !same(b.before[k], s[k] === undefined ? null : s[k]));      // 틀 · 평가 방식 · 검토관 · 조는 (옛 보관에 있더라도) 다루지 않음
        if(!fs.length) return;
        const why = s.state === 'done' ? '승인(잠김)된 칸이라 되살릴 수 없어요' : (s.grp || s.grpTo) ? '조별 칸은 «조 편성»에서 고쳐요' : '';
        const key = 'c:' + id;
        if(!why) acts[key] = async () => { const cur = A.subOf(id); if(!cur) return false;
          const patch = {}, gone = [];
          fs.forEach(k => { if(b.before[k] == null){ patch[k] = FS.deleteField(); gone.push(k); } else patch[k] = clone(b.before[k]); });      // 그때 없던 값(null)은 칸을 지움 — null 을 적으면 «함께 쓰기» 등이 잠김
          const next = Object.assign({}, cur); fs.forEach(k => { if(b.before[k] == null) delete next[k]; else next[k] = clone(b.before[k]); });
          if('teacherUids' in patch || 'removed' in patch) patch.turn = next.removed ? [] : C.turnOf(next);
          if('studentIds' in patch){ const n = (next.studentIds || []).length || A.subStudents(next).length; patch.cnt = { done: Math.min((cur.cnt || {}).done || 0, n), total: n }; }
          if('teacherUids' in patch || 'secId' in patch) touched = true;
          if(H.mine) H.mine(); await A.saveSub(id, patch); const now2 = A.subOf(id); gone.forEach(k => { delete cur[k]; if(now2) delete now2[k]; }); };
        rows.push(rowHTML(lab, fs.map(k => `<small>${esc(CELL_L[k] || k)}</small> ${show(b.before[k], k)}`).join('<br>'), fs.map(k => `<small>&nbsp;</small> ${show(s[k], k)}`).join('<br>'), why ? `<br><small>${why}</small>` : btn(key, '이 칸만 그때로'))); });
    } else if(v.kind === 'cfg' || v.kind === 'forms'){
      const docId = v.kind === 'forms' ? 'forms' : 'main'; const nowD = v.kind === 'forms' ? (A.FORMS || {}) : (A.CFG || {});
      Object.keys(d).filter(k => !SKIP[k]).forEach(k => { if(same(d[k], nowD[k])) return; const key = 'g:' + k;
        acts[key] = async () => { const tgt = v.kind === 'forms' ? (A.FORMS || {}) : (A.CFG || {}); const nul = d[k] == null; const was = tgt[k] === undefined ? null : clone(tgt[k]);
          await FS.setDoc(FS.doc(A.db, 'nhpConfig', docId), { [k]: nul ? FS.deleteField() : clone(d[k]), updatedAt: FS.serverTimestamp(), updatedBy: A.CU.uid }, { merge: true });
          A.keep(v.kind, { [k]: was }, '되살리기 직전'); if(nul) delete tgt[k]; else tgt[k] = clone(d[k]); };
        rows.push(rowHTML(CFG_L[k] || k, show(d[k], k), show(nowD[k], k), btn(key))); });
    }
    return { rows, acts };
  };
  /* «모두 그때로» — 항목마다 되살리기가 있는 목록은 «목록 전체»를 빼고(그 뒤에 생긴 항목을 지우지 않게) 항목만 */
  const allKeys = acts => Object.keys(acts).filter(k => !solo[k]);
  const draw = () => {
    if(!document.body.contains(box)) return;
    const S = L.filter(x => filt === 'all' || x.kind === filt); const v = S.find(x => x.id === cur) || S[0] || null; if(v) cur = v.id;
    const cnt = k => L.filter(x => x.kind === k).length;
    const side = `<div class="tm-side"><div class="frow" style="gap:5px;margin-bottom:6px;flex-wrap:wrap"><button class="nh-btn xs${filt === 'all' ? ' p' : ''}" data-kpf="all">전체 ${L.length}</button>${Object.keys(KIND).filter(cnt).map(k => `<button class="nh-btn xs${filt === k ? ' p' : ''}" data-kpf="${k}">${KIND[k]} ${cnt(k)}</button>`).join('')}</div>
      <div class="tm-list">${S.map(x => `<button class="tm-v${x.id === cur ? ' on' : ''}" data-kpv="${esc(x.id)}"><b>${esc(at(x.at))}</b><span>${esc(KIND[x.kind] || x.kind)} — ${esc(x.why || '')}</span><small>${esc(x.byName || '')}</small></button>`).join('') || '<div class="nh-empty" style="padding:14px">해당하는 보관이 없어요.</div>'}</div>
      <div class="nh-desc" style="margin:8px 0 0;font-size:11.5px">설정을 저장할 때마다 «바뀌기 직전» 모습이 남아요. 최근 ${DAYS}일은 모두, 그보다 오래된 것은 같은 것을 바꾼 보관끼리 하루에 하나씩 남겨요.</div></div>`;
    if(!v){ box.innerHTML = `<div class="tm-wrap">${side}<div class="tm-det"><div class="nh-empty">아직 보관된 지난 설정이 없어요.<br><small>이제부터 학기 정보 · 반 · 학생 · 검토 순서 · 칸 · 공통 목록 · 출력 모양을 바꿀 때마다 바뀌기 직전 모습이 저절로 남아요.</small></div></div></div>`; hook(null, {}); return; }
    const B = build(v); const keys = allKeys(B.acts);
    box.innerHTML = `<div class="tm-wrap">${side}<div class="tm-det">
      <div class="frow" style="align-items:center;margin-bottom:8px;gap:6px"><b style="font-size:15px">${esc(at(v.at))}</b><span class="ch gray">${esc(KIND[v.kind] || v.kind)}</span><span class="nh-desc" style="margin:0">${esc(v.byName || '')} 님이 바꾸기 직전의 모습 — ${esc(v.why || '')}</span><span class="nh-sp"></span>
        ${can && keys.length > 1 ? `<button class="nh-btn sm g" data-kpall>달라진 ${keys.length}곳 모두 그때로</button>` : ''}</div>
      ${!can ? '<div class="nh-info">되살리기는 나학평 담당만 할 수 있어요 — 보기만 돼요.</div>' : ''}
      ${v.kind === 'term' && Object.keys(v.data || {}).includes('sections') ? '<div class="nh-info" style="margin-bottom:8px">반 · 학생 명단은 통째로 덮지 않아요 — 반마다 · 종류마다 골라 되살리세요. 명단을 그때로 돌리면 <b>그 뒤에 들어온 학생이 빠져요</b>(입력은 지우지 않고 보관). 그 사이 다른 반으로 옮긴 학생이 있으면 그 반 명단도 함께 살펴 주세요. 담임을 되살리면 검토관은 저절로 다시 맞춰요. 칸의 «맡은 선생님»은 따로예요 — «칸» 보관에서 돌리세요.</div>' : ''}
      ${v.kind === 'cells' ? '<div class="nh-info" style="margin-bottom:8px">칸의 설정(이름 · 맡은 선생님 · 순서 · 듣는 학생 …)만 돌려요. 학생 입력 · 평가 틀 · 평가 방식은 그 칸의 ⏱ 타임머신에서, 조별 칸은 «조 편성»에서 봐요.</div>' : ''}
      ${B.rows.length ? B.rows.join('') : '<div class="nh-empty">이 보관의 내용은 지금과 같아요 (이미 되살렸거나 다시 같은 값으로 바뀜).</div>'}</div></div>`;
    hook(v, B.acts);
  };
  const hook = (v, acts) => {
    box.querySelectorAll('[data-kpv]').forEach(b => { b.onclick = () => { cur = b.dataset.kpv; draw(); }; });
    box.querySelectorAll('[data-kpf]').forEach(b => { b.onclick = () => { filt = b.dataset.kpf; draw(); }; });
    if(!v || !can) return;
    const run = async (keys, what) => {
      if(busy || !keys.length) return;
      busy = true;
      if(!(await A.confirm('⏱ 그때 설정으로 되살리기', `${what}을(를) <b>${esc(at(v.at))}</b> 모습으로 바꿔요.<br><br><span style="color:var(--ink-2)">지금 설정도 타임머신에 보관되니 다시 돌아올 수 있어요. 학생 입력은 지우지 않아요.</span>`, '되살리기'))){ busy = false; return; }
      let ok = 0, bad = 0; touched = false;
      window.showLoading && showLoading('되살리는 중…');
      for(const k of keys){ try{ const r = await acts[k](); if(r === false || r === null) bad++; else ok++; }catch(e){ bad++; console.warn('설정 되살리기', k, e); } }
      if(touched && H.applyReview){ try{ await H.applyReview(); }catch(e){ console.warn('검토관 다시 맞추기', e); } }      // 담임 · 맡은 선생님이 바뀌었으면 검토관도 지금 검토 순서대로
      window.hideLoading && hideLoading();
      busy = false;
      A.toast(bad ? `${ok}곳 되살림 · ${bad}곳은 되살리지 못했어요.` : (ok > 1 ? `${ok}곳을 그때로 되살렸어요 ✓` : '그때로 되살렸어요 ✓'), bad ? 'err' : undefined);
      try{ L = await load(); await fresh(); }catch(e){}
      draw(); if(H.after) H.after();
    };
    box.querySelectorAll('[data-kpgo]').forEach(b => { b.onclick = () => run([b.dataset.kpgo], '고른 한 곳'); });
    const allK = allKeys(acts); const all = box.querySelector('[data-kpall]'); if(all) all.onclick = () => run(allK, `달라진 ${allK.length}곳`);
  };
  draw();
}
