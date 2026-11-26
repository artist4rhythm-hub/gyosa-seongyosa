/* ═══════════════════════════════════════════════════════════
   📅 nhp-acts-cal.js — 특별활동: 학사일정에서 가져오기 · 한 표에서 고치기 · v209
   · 학사일정(academicEvents)은 **읽기만** — 나학평은 학사일정에 아무것도 쓰지 않음
   · 가져오면 nhpLists/<학기>.activities 에 **새 활동만 더함** (번호는 새로) — 이미 있는 활동 · 학생 체크 · 담임 확인은 건드리지 않음
       더해지는 칸: src(학사일정 행사 번호) · srcSig(가져올 때의 제목|시작|끝) — 연결 표시일 뿐, 나중에 학사일정이 바뀌어도 저절로 바뀌지 않음
   · 같은 행사는 두 번 들어가지 않음 (src 가 같거나 · 이름과 시작 날짜가 같으면 «이미 있음»)
   · 활동 사항: 같은 이름의 글이 지난 학기 목록 · 옮겨 온 지난 나학평에 있으면 불러와 채움 (고쳐 쓰기)
   · 한 표에서 고치기: 내가 고친 칸만 서버의 지금 목록 위에 얹음 (다른 분이 고친 다른 칸 · 새 활동은 그대로)
   · 보안 규칙은 그대로 (v55) — academicEvents 는 교직원이 읽을 수 있고, nhpLists 는 예전과 같은 자리
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null, H = null;
const bind = (a, h) => { A = a; C = a.C; esc = a.esc; FS = a.FS; if(h) H = h; };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const one = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const key = s => C.normKey(one(s)).replace(/[\s·∙.,'"‘’“”()[\]~-]/g, '');

/* 종류 — 학생 행사만. 교사 · 행정 · 방학 · 휴교는 가져올 것이 아님 */
const HIDE = { teacher: 1, admin: 1, break: 1, closed: 1 };
const GROUPS = [['main', '행사 · 프로그램'], ['worship', '예배 · 기도회'], ['exam', '시험']];
const groupOf = e => e.category === 'worship' ? 'worship' : e.category === 'exam' ? 'exam' : 'main';
export const sigOf = e => [one(e.title), e.startDate || '', (e.endDate && e.endDate > e.startDate) ? e.endDate : ''].join('|');

/* 이 학기 · 이 기관의 학생 행사 (학기 한 번 · 5분) */
const EV = {};
export async function loadEvents(a, fresh){
  bind(a);
  const id = A.TERM.id; const cur = EV[id];
  if(cur && cur.p && !fresh) return cur.p;
  if(cur && cur.ok && !fresh && Date.now() - cur.at < 300000) return cur;
  const T = EV[id] = { ok: false, err: false, at: Date.now(), list: [], by: {} };
  T.p = (async () => {
    try{
      const s = String(A.TERM.start || ''), e = String(A.TERM.end || '');
      if(!isDate(s) || !isDate(e)) throw new Error('학기 날짜 없음');
      const q = await FS.getDocs(FS.query(FS.collection(A.db, 'academicEvents'), FS.where('startDate', '>=', s), FS.where('startDate', '<=', e)));
      q.forEach(d => { const x = Object.assign({ id: d.id }, d.data());
        const orgs = ((Array.isArray(x.orgs) && x.orgs.length) ? x.orgs : [x.org]).map(o => o === 'both' ? 'all' : (o || 'daniel'));      // 학사일정과 같은 기준 — 옛 both = 전체 · 기관이 없으면 daniel
        if(!(orgs.includes(C.ORG) || orgs.includes('all')) || !one(x.title) || !isDate(x.startDate) || x.startDate < s || x.startDate > e) return;
        if(x.kind === 'staff' || (!x.kind && x.audience === 'teacher') || HIDE[x.category]) return;
        T.list.push(x); T.by[x.id] = x; });
      T.list.sort((x, y) => String(x.startDate).localeCompare(String(y.startDate)) || one(x.title).localeCompare(one(y.title), 'ko'));
      T.ok = true;
    }catch(err){ T.err = true; console.warn('학사일정 읽기', err); }
    T.p = null; T.at = Date.now();
    return T;
  })();
  return T.p;
}
const evInfo = () => (A && A.TERM && EV[A.TERM.id]) || null;

/* 되풀이 일정(요일이 정해진 긴 기간)은 날짜를 넣지 않음 — 출석부와 맞춰 볼 수 없으므로 */
const span = e => (isDate(e.endDate) && e.endDate > e.startDate) ? Math.round((new Date(e.endDate + 'T00:00:00') - new Date(e.startDate + 'T00:00:00')) / 864e5) + 1 : 1;
const repeats = e => (Array.isArray(e.weekdays) && e.weekdays.length && e.endDate && e.endDate > e.startDate) || span(e) > 14;      // 요일 되풀이 · 2주를 넘는 긴 기간
const rangeOf = e => repeats(e) ? ['', ''] : [e.startDate, (isDate(e.endDate) && e.endDate > e.startDate) ? e.endDate : ''];

/* 행사 대상 → 반 — 전체면 [] · 학년 글(«3학년») · 부서 이름(초등부)을 반으로. 알 수 없는 대상이 섞이면 unsure */
function secsOf(e){
  const secs = H.secsSorted(); const tg = Array.isArray(e.targets) ? e.targets : [];
  if(e.scope === 'all' || !tg.length) return { ids: [], text: '전체', unsure: false };
  const gs = new Set(); let unsure = false;
  tg.forEach(v => { const sv = String(v); const m = sv.match(/(\d+)\s*학년/);
    if(m){ gs.add(Number(m[1])); return; }
    const d = H.deptsOf(A.TERM).find(x => one(x.name) === one(sv) || (key(sv).length >= 2 && (key(x.name).startsWith(key(sv)) || key(sv).startsWith(key(x.name)))));
    if(d){ for(let g = Number(d.from); g <= Number(d.to); g++) gs.add(g); } else unsure = true; });
  const ids = secs.filter(s => gs.has(Number(s.gradeNo))).map(s => s.id);
  if(!ids.length) return { ids: [], text: tg.map(one).join(' · '), unsure: true };
  if(ids.length === secs.length && !unsure) return { ids: [], text: '전체', unsure: false };
  const G = [...gs].filter(g => secs.some(s => Number(s.gradeNo) === g)).sort((x, y) => x - y);
  return { ids, text: G.map(g => g + '학년').join(' · '), unsure };
}

/* ── 지난 글 — 같은 이름의 활동 사항 (나학평에서 연 지난 학기 목록 → 옮겨 온 지난 나학평 순) ── */
let PAST = null;
async function loadPast(){
  if(PAST && PAST.term === A.TERM.id) return PAST.p || PAST;
  const T = PAST = { ok: false, map: {}, term: A.TERM.id };
  const put = (t, c, from) => { const k = key(t); c = String(c || '').replace(/\u2028/g, '\n').replace(/\s+$/, ''); if(!k || !c.trim()) return; (T.map[k] = T.map[k] || { t: one(t), n: {}, from }); T.map[k].n[c] = (T.map[k].n[c] || 0) + 1; };
  T.p = (async () => {
    try{
      const terms = (A.TERMS || []).filter(t => t.id !== A.TERM.id).sort((x, y) => String(y.start || y.id).localeCompare(String(x.start || x.id)));
      for(const t of terms.filter(t => t.src !== 'import').slice(0, 4)){
        try{ const l = await FS.getDoc(FS.doc(A.db, 'nhpLists', t.id)); ((l.exists() && l.data().activities) || []).forEach(a => { if(a && !T.map[key(a.t)]) put(a.t, a.c, C.termLabel(t)); }); }catch(e){}
      }
      for(const t of terms.filter(t => t.src === 'import').slice(0, 3)){      // 옮겨 온 지난 나학평 — 학기마다 몇 명만 읽어 가장 많이 쓰인 글
        try{
          const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpReports'), FS.where('termId', '==', t.id), FS.limit(24)));
          const seen = {}, tmp = {};
          q.forEach(d => { const doc = (d.data() || {}).doc || {};
            (doc.blocks || []).filter(b => b && b.k === 'act').forEach(b => (b.tables || []).forEach(tb => (tb.rows || []).forEach(r => {
              const cs = (r && r.cells) || []; if(r.hd || cs.length < 3) return;
              const nm = one(cs[0].x); if(!nm || nm === '특별활동' || /동아리|조이\s*클래스/.test(nm)) return;
              const k = key(nm); if(T.map[k] && !seen[k]) return;      // 더 새 학기에 이미 있는 이름
              seen[k] = 1; const c = String(cs[cs.length - 1].x || '').replace(/\u2028/g, '\n').replace(/\s+$/, ''); if(!c.trim()) return;
              (tmp[k] = tmp[k] || { nm, n: {} }).n[c] = (tmp[k].n[c] || 0) + 1; }))); });
          // 여러 학생에게 똑같이 쓰인 글만 (2명 이상) — 한 학생만의 글 · 학생 이름이 든 글이 모두의 글로 들어가지 않게
          Object.keys(tmp).forEach(k => { const best = Object.keys(tmp[k].n).sort((x, y) => tmp[k].n[y] - tmp[k].n[x])[0]; if(tmp[k].n[best] >= 2) put(tmp[k].nm, best, C.termLabel(t)); });
        }catch(e){}
      }
      Object.values(T.map).forEach(o => { o.c = Object.keys(o.n).sort((x, y) => o.n[y] - o.n[x])[0]; });
      T.ok = true;
    }catch(e){ console.warn('지난 글', e); }
    T.p = null; return T;
  })();
  return T.p;
}
/* 이름이 같거나 · 한쪽이 다른 쪽을 품으면(«가을 체육대회» ↔ «체육대회») 지난 글 */
function pastFor(title, near){
  if(!PAST || !PAST.ok) return null;
  const k = key(title); if(k.length < 2) return null;
  if(PAST.map[k]) return PAST.map[k];
  if(!near) return null;      // 저절로 채우는 것은 이름이 꼭 같을 때만 — 비슷한 이름은 «불러오기»를 눌렀을 때만
  let best = null;
  Object.keys(PAST.map).forEach(p => { if(p.length >= 3 && k.length >= 3 && (k.includes(p) || p.includes(k)) && (!best || p.length > best.k.length)) best = { k: p, o: PAST.map[p] }; });
  return best ? best.o : null;
}

const actsNow = () => (A.LISTS.activities || []).filter(x => x && x.id);
const sameSecs = (a, e) => JSON.stringify((a.secs || []).slice().sort()) === JSON.stringify(secsOf(e).ids.slice().sort());
const dupOf = (arr, e) => arr.find(a => a && a.src === e.id) || arr.find(a => a && key(a.t) === key(e.title) && rangeOf(e)[0] && (a.from || '') === rangeOf(e)[0] && sameSecs(a, e)) || null;
const haveOf = e => dupOf(actsNow(), e);
async function writeActs(mut){
  const ref = FS.doc(A.db, 'nhpLists', A.TERM.id); let out, arr;
  if(A.markMine) A.markMine();
  await FS.runTransaction(A.db, async tx => {      // 서버의 지금 목록을 읽어 그 위에 — 두 분이 동시에 저장해도 서로 지우지 않음 · 못 읽으면 쓰지 않음
    const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data() : {};
    arr = (cur.activities || []).slice();
    out = mut(arr);
    tx.set(ref, { termId: A.TERM.id, activities: arr }, { merge: true });
  });
  A.LISTS = Object.assign({}, A.LISTS, { termId: A.TERM.id, activities: arr });
  return out;
}

/* ═══════════ 📅 학사일정에서 가져오기 ═══════════ */
export async function openPicker(a, h, done){
  bind(a, h);
  if(!H.canLists(A) || document.querySelector('.mm-ov [data-cal-box]')) return;
  const pick = new Set(); let grp = 'main', q = '', dept = '';
  const m = A.modal('📅 학사일정에서 가져오기 — ' + esc(C.termLabel(A.TERM)), '<div data-cal-box><div class="nh-desc">학사일정을 읽는 중…</div></div>',
    '<span class="nh-desc" style="margin:0" data-cal-sum></span><span class="nh-sp"></span><button class="nh-btn" data-c>취소</button><button class="nh-btn p" data-ok disabled>가져오기</button>', 'wide');
  const box = m.body.querySelector('[data-cal-box]'), okb = m.box.querySelector('[data-ok]');
  m.box.querySelector('[data-c]').onclick = () => m.close();
  let got = null; m.onClose = () => { if(done) done(got || []); };
  const [T] = await Promise.all([loadEvents(A, true), A.reloadLists()]);
  if(!document.body.contains(box)) return;
  loadPast().then(() => { if(document.body.contains(box)) paint(); });
  const inDept = e => { const dp = H.deptsOf(A.TERM).find(d => d.id === dept); if(!dp) return true; const s = secsOf(e); if(!s.ids.length) return true; return H.secsSorted().some(x => s.ids.includes(x.id) && Number(x.gradeNo) >= Number(dp.from) && Number(x.gradeNo) <= Number(dp.to)); };
  let row = null;
  const listHTML = () => { const L = T.list.filter(e => groupOf(e) === grp && inDept(e) && (!q || key(e.title + ' ' + (e.subtitle || '')).includes(key(q)))); return L.length ? L.map(row).join('') : '<div class="nh-empty">해당하는 행사가 없어요.</div>'; };
  const foot = () => { const sum = m.box.querySelector('[data-cal-sum]'); if(sum) sum.textContent = pick.size ? `고른 행사 ${pick.size}개` : ''; okb.disabled = !pick.size; okb.textContent = pick.size ? `${pick.size}개 가져오기` : '가져오기'; };
  const paint = () => {
    if(!T.ok){ box.innerHTML = '<div class="nh-warn">학사일정을 읽지 못했어요 — 잠시 뒤 다시 열어 보세요.</div>'; return; }
    const depts = H.deptsOf(A.TERM);
    const cnt = g => T.list.filter(e => groupOf(e) === g).length;
    row = e => { const have = haveOf(e); const s = secsOf(e); const [f, t] = rangeOf(e); const p = pastFor(e.title);
      return `<label class="cal-row${have || s.unsure ? ' have' : pick.has(e.id) ? ' on' : ''}"><input type="checkbox" data-ev="${esc(e.id)}"${have ? ' checked disabled' : s.unsure ? ' disabled' : pick.has(e.id) ? ' checked' : ''}>
        <span class="cal-t"><b>${esc(one(e.title))}</b>${e.subtitle ? `<small>${esc(one(e.subtitle))}</small>` : ''}</span>
        <span class="cal-d">${esc(H.whenText(f, t) || (repeats(e) ? '되풀이 일정 — 날짜 없이' : ''))}</span>
        <span class="cal-g">${esc(s.text)}</span>
        <span class="cal-s">${have ? '<span class="ch gray">이미 있음</span>' : s.unsure ? '<span class="ch warn" title="행사의 대상을 반으로 바꾸지 못했어요 — «＋ 활동»으로 직접 넣고 대상 반을 골라 주세요">대상을 알 수 없음</span>' : p ? `<span class="ch mint" title="${esc(p.from || '')} «${esc(p.t)}»의 글을 활동 사항에 불러와요">지난 글 있음</span>` : ''}</span></label>`; };
    box.innerHTML = `<div class="frow" style="gap:6px;align-items:center;margin-bottom:8px">
        ${GROUPS.map(([g, n]) => `<button class="nh-btn sm${grp === g ? ' p' : ''}" data-grp="${g}">${n} ${cnt(g)}</button>`).join('')}
        <span style="width:1px;height:18px;background:var(--line)"></span>
        <button class="nh-btn sm${!dept ? ' p' : ''}" data-dept="">전체 학년</button>${depts.map(d => `<button class="nh-btn sm${dept === d.id ? ' p' : ''}" data-dept="${esc(d.id)}">${esc(d.name)}</button>`).join('')}
        <span class="nh-sp"></span><input class="nh-in" style="max-width:200px;height:34px" data-calq placeholder="행사 이름 찾기" value="${esc(q)}"></div>
      <div class="nh-desc">이 학기(${esc(A.TERM.start || '')} ~ ${esc(A.TERM.end || '')})의 학생 행사예요. 교사 일정 · 행정 · 방학 · 휴일은 보이지 않아요. <b>학사일정은 읽기만 해요.</b></div>
      <div class="cal-list">${listHTML()}</div>
      <div class="nh-desc" style="margin-top:8px">가져오면 이름 · 날짜 · 대상 반이 채워진 <b>새 활동</b>이 더해져요. 이미 있는 활동과 학생 체크는 그대로예요. 같은 이름의 지난 글이 있으면 활동 사항에 불러와요 — 가져온 뒤 «한 표에서 고치기»로 다듬으세요.</div>`;
    foot();
  };
  paint();
  box.addEventListener('click', e => { const b = e.target.closest('[data-grp],[data-dept]'); if(!b) return;
    if(b.dataset.grp) grp = b.dataset.grp; else dept = b.dataset.dept || ''; paint(); });
  box.addEventListener('change', e => { const x = e.target; if(!x.dataset.ev) return; if(x.checked) pick.add(x.dataset.ev); else pick.delete(x.dataset.ev); const r = x.closest('.cal-row'); if(r) r.classList.toggle('on', x.checked); foot(); });
  box.addEventListener('input', e => { const x = e.target; if(!('calq' in x.dataset)) return; q = x.value; const l = box.querySelector('.cal-list'); if(l && row) l.innerHTML = listHTML(); });      // 찾기 칸은 다시 그리지 않음 (한글 조합이 끊기지 않게)
  okb.onclick = async () => {
    if(okb.disabled || !pick.size) return; okb.disabled = true;
    try{
      await loadPast();
      const ids = [];
      const n = await writeActs(arr => {
        let k = 0;
        [...pick].map(id => T.by[id]).filter(Boolean).sort((x, y) => String(x.startDate).localeCompare(String(y.startDate))).forEach(e => {
          if(dupOf(arr, e) || secsOf(e).unsure) return;      // 그 사이 다른 분이 넣었으면 건너뜀
          const [f, t] = rangeOf(e); const p = pastFor(e.title);
          const it = { id: C.rid('l'), t: one(e.title), d: H.whenText(f, t), c: p ? p.c : '', from: f, to: t, secs: secsOf(e).ids, def: 'all', o: arr.length, src: e.id, srcSig: sigOf(e) };
          arr.push(it); ids.push(it.id); k++; });
        return k;
      });
      got = ids; m.close();
      A.toast(n ? `학사일정에서 ${n}개 가져왔어요 ✓ «📋 한 표에서»로 활동 사항을 다듬어 주세요.` : '이미 모두 들어 있어요.');
    }catch(e){ okb.disabled = false; A.toast('가져오지 못했어요 — ' + A.errText(e), 'err'); }
  };
}

/* ═══════════ 📋 한 표에서 고치기 ═══════════ */
const TPL = [['* 장소 / * 활동', '* 장소: \n* 활동: '], ['* 장소 / * 주제 / * 활동', '* 장소: \n* 주제: \n* 활동: '], ['* 강사 / * 내용', '* 강사: \n* 내용: '], ['* 주관 / * 내용', '* 주관: \n* 내용: ']];
const F = ['t', 'from', 'to', 'd', 'c'];
const FN = { t: '이름', from: '시작 날짜', to: '끝 날짜', d: '일시 글', c: '활동 사항' };
export async function openSheet(a, h, done){
  bind(a, h);
  if(!H.canLists(A) || document.querySelector('.mm-ov [data-sheet-box]')) return;
  const m = A.modal('📋 특별활동 한 표에서 고치기 — ' + esc(C.termLabel(A.TERM)), '<div data-sheet-box><div class="nh-desc">여는 중…</div></div>',
    '<span class="nh-desc" style="margin:0" data-sh-sum></span><span class="nh-sp"></span><button class="nh-btn" data-c>닫기</button><button class="nh-btn p" data-ok disabled>저장</button>', 'wide xl');
  const box = m.body.querySelector('[data-sheet-box]'), okb = m.box.querySelector('[data-ok]');
  await A.reloadLists();
  const T = await loadEvents(A);
  if(!document.body.contains(box)) return;
  loadPast().then(() => { if(document.body.contains(box) && !SAVING) softPast(); });
  const sortActs = L => L.slice().sort((x, y) => String(x.from || '9999').localeCompare(String(y.from || '9999')) || (x.o || 0) - (y.o || 0));
  const val = (x, f) => String(x[f] == null ? '' : x[f]);
  let BASE = {}, CUR = {}, ORDER = [], LAST = null, SIG = {}, SAVING = false;
  const autoD = c => !c.d || c.d === H.whenText(c.from, c.to);
  const take = () => { BASE = {}; CUR = {}; SIG = {}; ORDER = sortActs(actsNow()).map(x => x.id);
    actsNow().forEach(x => { BASE[x.id] = {}; CUR[x.id] = {}; F.forEach(f => { BASE[x.id][f] = CUR[x.id][f] = val(x, f); }); BASE[x.id]._ = x; }); };
  take();
  const changed = id => F.filter(f => CUR[id][f] !== BASE[id][f]);
  const dirty = () => ORDER.filter(id => changed(id).length || SIG[id]);
  /* 학사일정과 달라졌는지 — 가져올 때의 모습(srcSig)과 지금 행사가 다르면 */
  const drift = id => { const x = BASE[id]._; if(!x.src || !T.ok) return null; const e = T.by[x.src]; if(!e) return null; const sg = SIG[id] || x.srcSig || ''; return sigOf(e) !== sg ? e : null; };
  const secText = x => (!x.secs || !x.secs.length) ? '전체' : H.secsSorted().filter(s => x.secs.includes(s.id)).map(s => C.secLabel(s)).join(', ');
  const foot = () => { const n = dirty().length; okb.disabled = !n; okb.textContent = n ? `바뀐 ${n}개 확인하고 저장` : '저장';
    const s = m.box.querySelector('[data-sh-sum]'); if(s) s.textContent = `활동 ${ORDER.length}개${n ? ` · 고친 것 ${n}` : ''}`; };
  /* 활동 사항이 비어 있고 같은(비슷한) 이름의 지난 글이 있으면 — 눌러서 불러오기 */
  const pastBtn = id => { const c = CUR[id]; if(String(c.c || '').trim()) return ''; const p = pastFor(c.t, true); return p ? `<button class="nh-btn xs ghost" data-pastin="${esc(id)}" title="${esc(p.c)}">지난 글 불러오기 — ${esc(p.from || '')} «${esc(p.t)}»</button>` : ''; };
  const softPast = () => box.querySelectorAll('[data-row]').forEach(tr => { const el = tr.querySelector('[data-past]'); if(el) el.innerHTML = pastBtn(tr.dataset.row); });
  const paint = () => {
    box.innerHTML = `<div class="frow" style="gap:6px;align-items:center;margin-bottom:8px"><b style="font-size:13px">활동 사항 글 모양</b>
        ${TPL.map((t, i) => `<button class="nh-btn xs" data-tpl="${i}" title="지금 쓰는 «활동 사항» 칸에 줄 머리를 넣어요">${esc(t[0])}</button>`).join('')}
        <span class="nh-desc" style="margin:0">지난 나학평에서 쓰던 모양 — 먼저 «활동 사항» 칸을 누른 뒤 고르세요 (한 문장으로 써도 돼요)</span></div>
      ${ORDER.length ? `<div class="nh-tw"><table class="nh-t sh-t"><thead><tr><th style="width:17%">특별활동 (출력 이름)</th><th style="width:150px">날짜</th><th style="width:15%">일시 (출력 글)</th><th>활동 사항</th><th style="width:15%">대상 · 어디서</th></tr></thead><tbody>
        ${ORDER.map(id => { const x = BASE[id]._, c = CUR[id]; const dr = drift(id); const ch = changed(id);
          return `<tr data-row="${esc(id)}" class="${ch.length || SIG[id] ? 'chg' : ''}">
            <td><input class="nh-in" data-sf="t" value="${esc(c.t)}" aria-label="활동 이름"></td>
            <td><input type="date" class="nh-in" data-sf="from" value="${esc(c.from)}" aria-label="시작 날짜"><input type="date" class="nh-in" data-sf="to" value="${esc(c.to)}" aria-label="끝 날짜" style="margin-top:4px"></td>
            <td><input class="nh-in" data-sf="d" value="${esc(c.d)}" placeholder="${esc(H.whenText(c.from, c.to) || '비우면 날짜대로')}" aria-label="일시 글"></td>
            <td><textarea class="nh-ta" rows="3" data-sf="c" aria-label="활동 사항">${esc(c.c)}</textarea><div data-past>${pastBtn(id)}</div></td>
            <td><div class="sh-g">${esc(secText(x))}</div><span class="ch ${x.src ? 'info' : 'gray'}">${x.src ? '학사일정' : '손으로 넣음'}</span>${x.def === 'none' ? ' <span class="ch warn">고른 학생만</span>' : ''}
              ${dr ? `<div class="sh-dr">학사일정이 달라졌어요 — <b>${esc(one(dr.title))}</b> ${esc(H.whenText(...rangeOf(dr)))}<br><button class="nh-btn xs" data-fit="${esc(id)}">학사일정대로 맞추기</button> <button class="nh-btn xs ghost" data-keep="${esc(id)}">그대로 두기</button></div>` : ''}
              <div class="sh-ch" data-shch>${ch.length ? '고침: ' + ch.map(f => FN[f]).join(' · ') : ''}</div></td></tr>`; }).join('')}
        </tbody></table></div>` : '<div class="nh-empty">활동이 아직 없어요 — «📅 학사일정에서» 또는 «＋ 활동»으로 넣어 주세요.</div>'}
      <div class="nh-desc" style="margin-top:8px">출력에서는 «특별활동 | 일시 | 활동 사항» 표의 한 줄이 돼요. 대상 반 · 기본 참여는 활동을 하나씩 열어 고쳐요. 학생 체크(참여 · 빠짐)와 담임 확인은 그대로예요.</div>`;
    foot();
  };
  paint();
  box.addEventListener('focusin', e => { if(e.target.matches && e.target.matches('textarea[data-sf="c"]')) LAST = e.target; });
  box.addEventListener('input', e => { const x = e.target; const tr = x.closest && x.closest('[data-row]'); if(!tr || !x.dataset.sf) return;
    const id = tr.dataset.row; const f = x.dataset.sf;
    if(f === 'from' || f === 'to'){ const was = autoD(CUR[id]); CUR[id][f] = x.value; const d = tr.querySelector('[data-sf="d"]');
      if(was){ CUR[id].d = H.whenText(CUR[id].from, CUR[id].to); if(d) d.value = CUR[id].d; }      // 날짜대로 만든 일시 글이면 새 날짜로 — 화면에도 바로
      if(d) d.placeholder = H.whenText(CUR[id].from, CUR[id].to) || '비우면 날짜대로'; }
    else CUR[id][f] = x.value;
    if(f === 'c' || f === 't'){ const el = tr.querySelector('[data-past]'); if(el && !el.contains(document.activeElement)) el.innerHTML = pastBtn(id); }
    const ch = changed(id); tr.classList.toggle('chg', !!(ch.length || SIG[id])); const el = tr.querySelector('[data-shch]'); if(el) el.textContent = ch.length ? '고침: ' + ch.map(f => FN[f]).join(' · ') : ''; foot(); });
  box.addEventListener('click', e => { const b = e.target.closest('[data-tpl],[data-fit],[data-keep],[data-pastin]'); if(!b || SAVING) return;
    if(b.dataset.pastin){ const id = b.dataset.pastin; const p = pastFor(CUR[id].t, true); const ta = box.querySelector(`[data-row="${CSS.escape(id)}"] textarea`); if(p && ta){ ta.value = p.c; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); } return; }
    if(b.dataset.tpl != null){ const ta = LAST && document.body.contains(LAST) ? LAST : null; if(!ta) return A.toast('먼저 «활동 사항» 칸을 눌러 주세요.', 'err');
      const tpl = TPL[+b.dataset.tpl][1]; const v = ta.value; const at = ta.selectionStart == null ? v.length : ta.selectionStart;
      const pre = v.slice(0, at), sep = pre && !/\n$/.test(pre) ? '\n' : '';
      ta.value = pre + sep + tpl + v.slice(ta.selectionEnd == null ? at : ta.selectionEnd);
      const pos = (pre + sep + tpl).indexOf(': ', pre.length + sep.length) + 2; ta.focus(); try{ ta.setSelectionRange(pos, pos); }catch(er){}
      ta.dispatchEvent(new Event('input', { bubbles: true })); return; }
    const id = b.dataset.fit || b.dataset.keep; const x = BASE[id]._; const ev = T.by[x.src]; if(!ev) return;
    if(b.dataset.fit){ const [f, t] = rangeOf(ev); const wasAuto = !CUR[id].d || CUR[id].d === H.whenText(CUR[id].from, CUR[id].to);
      const old = String(x.srcSig || '').split('|')[0];
      if(!old || key(CUR[id].t) === key(old)) CUR[id].t = one(ev.title);      // 이름을 따로 고쳐 쓴 활동은 이름을 건드리지 않음
      CUR[id].from = f; CUR[id].to = t; if(wasAuto) CUR[id].d = H.whenText(f, t); }
    SIG[id] = sigOf(ev); paint(); });
  let asking = false;
  const tryClose = async () => { if(asking || SAVING) return; asking = true; try{ if(dirty().length && !(await A.confirm('저장하지 않은 것이 있어요', '고친 내용을 버리고 닫을까요?', '버리고 닫기', true))) return; m.close(); }finally{ asking = false; } };
  m.guard = tryClose; m.onClose = () => { if(done) done(); };      // ✕ · Esc · 바깥 누름도 먼저 물어봄 · 어떻게 닫혀도 뒤 화면을 새로 그림
  m.box.querySelector('[data-c]').onclick = tryClose;
  okb.onclick = async () => {
    const ids = dirty(); if(!ids.length || okb.disabled) return;
    for(const id of ids){ const c = CUR[id];
      if(!one(c.t)) return A.toast('활동 이름이 비어 있어요.', 'err');
      if(c.from && !isDate(c.from)) return A.toast(`«${one(c.t)}» 시작 날짜를 확인해 주세요.`, 'err');
      if(c.to && (!c.from || c.to < c.from)) return A.toast(`«${one(c.t)}» 끝 날짜가 시작 날짜보다 앞이에요.`, 'err'); }
    const list = ids.map(id => { const ch = changed(id); return `<b>${esc(one(CUR[id].t) || one(BASE[id].t))}</b> — ${ch.length ? ch.map(f => FN[f]).join(' · ') + ' 고침' : '학사일정 연결만 맞춤'}${ch.includes('from') || ch.includes('to') ? ' <small>(날짜가 바뀌어 출석부와 다시 맞춰요 — 담임이 확인해 둔 활동은 «날짜 바뀌기 전 확인»으로 보여요)</small>' : ''}`; });
    if(!(await A.confirm('바뀌는 것 확인', `${list.join('<br>')}<br><br><span style="color:var(--ink-2)">이 ${ids.length}개 활동의 고친 칸만 저장해요. 학생 체크 · 담임 확인 · 다른 활동은 그대로예요.</span>`, '저장'))) return;
    okb.disabled = true; SAVING = true; box.style.pointerEvents = 'none'; box.style.opacity = '.6';
    const snapC = {}; ids.forEach(id => { snapC[id] = { c: Object.assign({}, CUR[id]), ch: changed(id), sig: SIG[id] || '' }; });      // 저장을 누른 그때의 모습 — 기다리는 동안 친 글이 섞이지 않게
    try{
      let gone = 0; const moved = [];
      await writeActs(arr => { gone = 0; moved.length = 0; ids.forEach(id => { const i = arr.findIndex(y => y && y.id === id); if(i < 0){ gone++; return; }
        const was = arr[i]; const it = Object.assign({}, was); const { c, ch, sig } = snapC[id];
        ch.forEach(f => { it[f] = f === 'c' ? String(c[f]).replace(/\s+$/, '') : one(c[f]); });
        if(!it.from || !isDate(it.from)){ it.from = ''; it.to = ''; }
        if(it.to && (!isDate(it.to) || it.to <= it.from)) it.to = '';
        if(!it.d || (!ch.includes('d') && it.d === H.whenText(was.from, was.to))) it.d = H.whenText(it.from, it.to);      // 날짜만 바꿨으면 일시 글도 새 날짜로
        if(sig) it.srcSig = sig;
        if((it.from || '') !== (was.from || '') || (it.to || '') !== (was.to || '')) moved.push(it);
        arr[i] = it; }); });
      A.toast(`${ids.length - gone}개 활동을 저장했어요 ✓${gone ? ` (그 사이 지워진 활동 ${gone}개는 건너뜀)` : ''}`);
      take(); paint();
      for(const it of moved){ try{ await H.syncAct(it, false); }catch(e){} }      // 날짜가 바뀐 활동 — 고칠 수 있는 반은 출석부대로 바로 다시 맞춤 (손으로 정한 학생은 그대로)
    }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
    SAVING = false; box.style.pointerEvents = ''; box.style.opacity = ''; foot();
  };
}
/* 한 곳에서 화면 왼쪽 목록에 «학사일정과 달라짐» 표시를 붙일 때 */
export function driftOf(a){ const T = evInfo(); if(!a || !a.src || !T || !T.ok) return null; const e = T.by[a.src]; return e && sigOf(e) !== (a.srcSig || '') ? e : null; }
