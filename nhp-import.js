/* ═══════════════════════════════════════════════════════════
   🗂 nhp-import.js — 예전 나학평(DA학사관리시스템) 자료 가져오기 · v141 (v142: 출생연도로 잇기 · 잇기 점검)
   · 옮김 파일(nhp-import-….json — 7_보관 폴더 · 깃허브에 올리지 않음)을 이 기기에서 읽어 원본으로 저장
   · 학생은 이름 + 출생연도(예전 학번에서 짐작)로 교사 선교사 학생과 잇는다 · 못 이은 학생은 직접 고른다 · 가져온 뒤에도 «🔗 잇기»로 고친다 (v142)
   · 원본(nhpReports)은 한 번 만들면 바뀌지 않는다 — 다시 가져와도 이미 있는 원본은 건너뛴다
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null;
let DATA = null, MAP = {}, PICK = {};
const bindA = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

export function cardHTML(a){
  bindA(a);
  const had = (A.TERMS || []).some(t => t.src === 'import');
  return `${had ? `<div class="nh-card" style="margin-bottom:12px;background:var(--mint-bg,#EEF7F2)"><h3>🔎 가져온 원본 — 학생 잇기 점검 <small>이미 가져왔다면 여기서 한꺼번에 확인 · 고치기</small></h3>
      <div class="nh-desc">가져온 원본을 모두 읽어(조금 걸려요) 예전 학생마다 «어느 학생과 이어졌는지 · 출생연도가 맞는지»를 보여 줘요. 원본 내용은 그대로 두고 잇기만 고쳐요 (보안 규칙 v36).</div>
      <button class="nh-btn sm p" data-imaudit>🔎 점검 시작</button><div data-ima style="margin-top:10px"></div></div>` : ''}
    <div class="nh-desc">예전 나학평 프로그램에서 읽어 만든 <b>옮김 파일</b>(교사 선교사.zip › <b>7_보관</b> › nhp-import-….json)을 고르세요. 파일은 이 기기에서만 읽고, 학생별 나학평이 <b>원본</b>으로 저장돼요.
      <br>· 원본은 한 번 저장하면 바뀌지 않아요 (고쳐서 내보낼 때는 «출력본») · 다시 가져와도 이미 있는 원본은 건너뛰어요 · 2026 1학기 평가 틀은 2학기 «이어받기»에 쓰여요</div>
    <input type="file" accept=".json,application/json" data-imf style="margin:6px 0 10px">
    <div data-imv></div>`;
}
export function bind(a, box){
  bindA(a);
  const au = box.querySelector('[data-imaudit]'); if(au) au.onclick = () => audit(box);
  const f = box.querySelector('[data-imf]');
  if(!f) return;
  f.onchange = async () => {
    const file = f.files && f.files[0]; if(!file) return;
    const v = box.querySelector('[data-imv]');
    v.innerHTML = '<div class="nh-desc">파일을 읽는 중…</div>';
    try{
      const txt = await file.text();
      const d = JSON.parse(txt);
      if(!d || d.kind !== 'nhp-import' || !Array.isArray(d.terms)) throw new Error('나학평 옮김 파일이 아니에요');
      if(d.org && d.org !== C.ORG) throw new Error('다니엘 아마츠 파일이 아니에요');
      DATA = d; PICK = {}; MAP = {};
      d.terms.forEach(t => { PICK[t.id] = true; });
      try{ await A.loadClasses(); }catch(e){}       // 학생 옆에 «올해 반»을 보여 주려고
      match();
      draw(box);
    }catch(e){ v.innerHTML = `<div class="nh-warn">읽지 못했어요 — ${esc(e.message || e)}</div>`; }
  };
}
/* 학생 잇기 — 이름 + 출생연도 (v142)
   · 예전 나학평 학번(8자리)의 앞 4자리 = 1학년이 된 해 → 출생연도는 그 해 − 7 (빠른 생일 ±1 년)
   · 교사 선교사 학번(2017-03 모양)은 예전 학번과 모양이 달라 비교하지 않는다
   · 한 학생(예전 학번)의 여러 학기 원본은 한 번 정하면 모두 같은 학생으로 */
const NM = x => String(x || '').replace(/\s+/g, '');
export const oldKey = r => (r.stuNo ? 'n:' + r.stuNo : 'x:' + NM(r.stuName));
export const birthYearOf = no => (/^\d{8}$/.test(String(no || '')) ? Number(String(no).slice(0, 4)) - 7 : 0);
const byOf = s => Number(String((s && s.birth) || '').slice(0, 4)) || 0;
export function linkOne(r, students){
  const nm = NM(r.stuName), eb = birthYearOf(r.stuNo);
  const all = Object.values(students || {}).filter(s => s.org === C.ORG && !s.deleted);
  const same = all.filter(s => NM(s.name) === nm);
  if(!same.length) return { sid: '', how: 'none', cand: [] };
  const cand = same.map(s => s.id);
  if(eb){
    const exact = same.filter(s => byOf(s) === eb), near = same.filter(s => byOf(s) && Math.abs(byOf(s) - eb) <= 1);
    if(exact.length === 1) return { sid: exact[0].id, how: 'by', cand };
    if(!exact.length && near.length === 1) return { sid: near[0].id, how: 'by', cand };
    if(same.length === 1 && !byOf(same[0])) return { sid: same[0].id, how: 'name', cand };            // 생일이 없어 출생연도로 확인 못 함
    if(same.length === 1) return { sid: '', how: 'name*', cand, sug: same[0].id };                    // 이름만 같고 출생연도가 다름 — 다른 학생일 수 있음
    return { sid: '', how: 'many', cand };
  }
  if(same.length === 1) return { sid: same[0].id, how: 'name', cand };
  return { sid: '', how: 'many', cand };
}
export function matchStudents(reports, students){
  const out = {}, memo = {};
  reports.forEach((r, i) => { const k = oldKey(r); if(!memo[k]) memo[k] = linkOne(r, students); out[i] = memo[k]; });
  return out;
}
let LINK = {};          // 예전 학생(학번) → { sid, how } — 학기를 가로질러 하나
function match(){
  LINK = {};
  DATA.terms.forEach(t => t.reports.forEach(r => { const k = oldKey(r); if(!LINK[k]) LINK[k] = Object.assign({ r, terms: [] }, linkOne(r, A.STU)); if(!LINK[k].terms.includes(t.label)) LINK[k].terms.push(t.label); }));
  syncMap();
}
function syncMap(){
  DATA.terms.forEach(t => { MAP[t.id] = {}; t.reports.forEach((r, i) => { MAP[t.id][i] = LINK[oldKey(r)]; }); });
}
const HOW = { by: '이름 · 출생연도', name: '이름만 (생일 없음)', 'name*': '이름 같음 · 출생연도 다름', many: '같은 이름 여럿', none: '이름 같은 학생 없음', hand: '직접 고름', no: '직접 고름' };
function rowHTML(k){
  const L = LINK[k], r = L.r, eb = birthYearOf(r.stuNo);
  const who = L.sid ? `<b>${esc(A.stuName(L.sid))}</b> <small style="color:var(--ink-2)">${esc(A.stuInfo(L.sid))}</small>` : '<span class="nh-desc" style="margin:0">잇지 않음 (이름으로만 보관)</span>';
  return `<div class="frow" style="align-items:center;margin-bottom:6px;padding:6px 0;border-bottom:1px solid var(--line-soft)">
      <span style="min-width:230px;font-size:12.5px"><b>${esc(r.stuName)}</b> <small>예전 학번 ${esc(r.stuNo || '-')}${eb ? ` · ${eb}년생쯤` : ''}</small><br><small style="color:var(--ink-3)">${esc(L.terms.join(', '))}</small></span>
      <span class="ch ${L.sid ? (L.how === 'hand' ? 'mint' : 'warn') : 'red'}">${esc(HOW[L.how] || '')}</span>
      <span style="flex:1;min-width:200px;font-size:12.5px">→ ${who}</span>
      <button class="nh-btn xs" data-impick="${esc(k)}">고르기</button></div>`;
}
function draw(box){
  const v = box.querySelector('[data-imv]');
  const rows = DATA.terms.map(t => {
    const m = MAP[t.id]; const vals = Object.values(m);
    const nBy = vals.filter(x => x.sid && x.how === 'by').length, nOther = vals.filter(x => x.sid && x.how !== 'by').length;
    const ex = A.TERMS.find(x => x.id === t.id);
    const clash = ex && ex.src !== 'import';
    const unl = vals.filter(x => !x.sid).length;
    return `<tr><td class="c"><input type="checkbox" data-imt="${esc(t.id)}"${PICK[t.id] && !clash ? ' checked' : ''}${clash ? ' disabled' : ''}></td><td><b>${esc(t.label || C.termLabel(t))}</b>${clash ? '<br><span class="ch red">이미 나학평에서 연 학기 — 건너뜀</span>' : ex ? '<br><span class="ch gray">가져온 적 있음 — 새 원본만 더함</span>' : ''}</td>
      <td class="c">${t.sections.length}</td><td class="c">${t.reports.length}</td><td class="c">${nBy}</td><td class="c">${nOther}</td><td class="c">${unl ? `<span class="ch red">${unl}</span>` : 0}</td><td class="c">${(t.setups || []).length || ''}</td></tr>`;
  }).join('');
  const keys = Object.keys(LINK);
  const need = keys.filter(k => ['name*', 'many'].includes(LINK[k].how) || (LINK[k].how === 'hand' && LINK[k].was && ['name*', 'many'].includes(LINK[k].was)));
  const none = keys.filter(k => LINK[k].how === 'none' || (LINK[k].how === 'hand' && LINK[k].was === 'none'));
  const auto = keys.filter(k => ['by', 'name'].includes(LINK[k].how) || (LINK[k].how === 'hand' && ['by', 'name'].includes(LINK[k].was)));
  const byName = (a, b) => String(LINK[a].r.stuName).localeCompare(String(LINK[b].r.stuName), 'ko');
  v.innerHTML = `<div class="nh-info">파일: ${esc(DATA.src || '')} · 만든 날 ${esc(DATA.made || '')} · 학기 ${DATA.terms.length}개 · 원본 ${DATA.terms.reduce((n, t) => n + t.reports.length, 0)}명분 · 예전 학생 ${keys.length}명</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th class="c">가져오기</th><th>학기</th><th class="c">반</th><th class="c">원본</th><th class="c">이름 · 출생연도로 이음</th><th class="c">이름만 · 직접</th><th class="c">잇지 않음</th><th class="c">평가 틀</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="nh-desc" style="margin-top:8px">예전 학번 앞 4자리(1학년이 된 해)로 출생연도를 짐작해, <b>이름과 출생연도가 맞는 학생</b>과 이어요. 한 학생의 여러 학기는 한 번에 같이 정해져요. 가져온 뒤에도 «🗂 지난 나학평»에서 학생마다 «🔗 잇기»로 고칠 수 있어요.</div>
    ${need.length ? `<details class="dr" open style="margin-top:10px"><summary>⚠️ 확인 필요 <small>${need.length}명 — 같은 이름이 여럿이거나 출생연도가 달라요</small></summary><div class="db">${need.sort(byName).map(rowHTML).join('')}</div></details>` : ''}
    ${none.length ? `<details class="dr" style="margin-top:10px"><summary>🎓 이름 같은 학생 없음 <small>${none.length}명 — 졸업 · 전학한 학생은 그대로 두면 이름으로 보관돼요</small></summary><div class="db">${none.sort(byName).map(rowHTML).join('')}</div></details>` : ''}
    ${auto.length ? `<details class="dr" style="margin-top:10px"><summary>✅ 저절로 이은 학생 <small>${auto.length}명 — 맞는지 훑어보세요</small></summary><div class="db">${auto.sort(byName).map(rowHTML).join('')}</div></details>` : ''}
    <div class="frow" style="margin-top:12px"><button class="nh-btn p" data-imgo>🗂 가져오기</button><span class="nh-desc" style="margin:0">학기마다 «마감된 지난 학기»로 들어가요 (선생님 «내 할 일»에는 나오지 않음).</span></div>`;
  v.querySelectorAll('[data-imt]').forEach(i => i.onchange = () => { PICK[i.dataset.imt] = i.checked; });
  v.querySelectorAll('[data-impick]').forEach(b => b.onclick = async () => {
    const k = b.dataset.impick, L = LINK[k];
    const sid = await A.pickStudent(`🔗 ${L.r.stuName} (예전 학번 ${L.r.stuNo || '-'}) — 어느 학생인가요?`, { name: L.r.stuName, birthYear: birthYearOf(L.r.stuNo), current: L.sid || L.sug || '',
      help: `${esc(L.terms.join(', '))} 원본이 모두 이 학생으로 이어져요. 졸업 · 전학해 교사 선교사에 없는 학생이면 «잇지 않음».` });
    if(sid == null) return;
    LINK[k] = Object.assign({}, L, { sid, how: 'hand', was: L.was || L.how });
    syncMap();
    const open = Array.from(v.querySelectorAll('details')).map(d => d.open);
    draw(box);
    Array.from(v.querySelectorAll('details')).forEach((d, i) => { if(open[i] != null) d.open = open[i]; });
  });
  v.querySelector('[data-imgo]').onclick = () => run(box);
}
async function run(box){
  const terms = DATA.terms.filter(t => PICK[t.id] && !(A.TERMS.find(x => x.id === t.id && x.src !== 'import')));
  if(!terms.length) return A.toast('가져올 학기를 골라 주세요.', 'err');
  const nRep = terms.reduce((n, t) => n + t.reports.length, 0);
  if(!(await A.confirm('🗂 지난 나학평 가져오기', `학기 ${terms.length}개 · 원본 ${nRep}명분을 가져와요.<br>원본은 저장한 뒤 바꿀 수 없어요 (지우기는 수퍼관리자만).`, '가져오기'))) return;
  window.showLoading && showLoading('지난 나학평을 가져오는 중…');
  let done = 0, skip = 0, fail = 0;
  try{
    for(const t of terms){
      const ex = A.TERMS.find(x => x.id === t.id);
      const have = new Set((ex && ex.impIds) || []);
      const m = MAP[t.id];
      // 원본 문서 이름 — 학기 · 학번 (같은 학번이 또 있으면 반 · 순번을 붙임 · '/' 같은 글자는 뺌) · 다시 가져와도 같은 이름
      const clean = x => String(x || '').replace(/[^0-9A-Za-z가-힣_-]/g, '');
      const used = new Set(); const ids = [];
      const secs = t.sections.map(s => Object.assign({}, s, { students: [] }));
      t.reports.forEach((r, i) => {
        let id = `${t.id}__imp__${clean(r.stuNo) || (clean(r.secId) + '_' + i)}`;
        if(used.has(id)) id = `${t.id}__imp__${clean(r.stuNo)}_${clean(r.secId)}_${i}`;
        used.add(id); ids.push(id);
        const sid = (m[i] || {}).sid || '';
        const sec = secs.find(s => s.id === r.secId); if(sec && sid && !sec.students.includes(sid)) sec.students.push(sid);
      });
      // 학기 문서 — «가져온 원본» 목록(impIds)은 원본을 저장한 뒤에만 늘린다 (중간에 실패하면 다시 가져올 때 이어서)
      const termDoc = { org: C.ORG, year: t.year, term: t.term, name: t.name, start: t.start || '', end: t.end || '', status: 'closed', src: 'import', sections: secs,
        review: C.DEFAULT_REVIEW(), finAll: [], listEditors: [], impIds: Array.from(have), importedAt: FS.serverTimestamp(), importedBy: A.CU.uid, importedByName: A.CU.name || '' };
      await FS.setDoc(FS.doc(A.db, 'nhpTerms', t.id), termDoc, { merge: true });
      if((t.setups || []).length) await FS.setDoc(FS.doc(A.db, 'nhpLists', t.id), { termId: t.id, setups: t.setups }, { merge: true });
      const todo = t.reports.map((r, i) => ({ r, i, id: ids[i] })).filter(x => !have.has(x.id));
      skip += t.reports.length - todo.length;
      for(let k = 0; k < todo.length; k += 30){
        const part = todo.slice(k, k + 30);
        const bt = FS.writeBatch(A.db);
        part.forEach(({ r, i, id }) => {
          bt.set(FS.doc(A.db, 'nhpReports', id), { termId: t.id, org: C.ORG, secId: r.secId, secName: r.secName || '', sid: (m[i] || {}).sid || '', linkHow: (m[i] || {}).how || '', stuNo: r.stuNo || '', stuName: r.stuName || '',
            ver: 1, src: 'import', doc: r.doc, issuedBy: A.CU.uid, issuedByName: A.CU.name || '', issuedAt: FS.serverTimestamp() });
        });
        try{
          await bt.commit(); done += part.length;
          part.forEach(x => have.add(x.id));
          await FS.updateDoc(FS.doc(A.db, 'nhpTerms', t.id), { impIds: Array.from(have) });
        }
        catch(e){ fail += part.length; console.error(e); }
        window.setLoadStep && setLoadStep(`${t.label} · 원본 ${done}/${nRep}`, Math.round((done + skip + fail) / nRep * 100));
      }
    }
    await A.loadTerms();
    A.toast(fail ? `가져왔어요 — 새 원본 ${done} · 건너뜀 ${skip} · 실패 ${fail}` : `가져왔어요 ✓ 새 원본 ${done}명분${skip ? ` · 이미 있던 ${skip}개는 건너뜀` : ''}`, fail ? 'err' : '');
  }catch(e){ A.toast('가져오지 못했어요 — ' + A.errText(e), 'err'); console.error(e); }
  window.hideLoading && hideLoading();
  const v = box.querySelector('[data-imv]'); if(v) v.innerHTML = `<div class="nh-info">✅ 끝났어요. «🗂 지난 나학평»에서 학기를 골라 보세요.</div>`;
}

/* ═══ 🔎 가져온 원본 — 학생 잇기 점검 (v142) ═══
   · 옮겨 온 학기의 원본을 모두 읽어 예전 학생(학번)마다 묶는다
   · 상태: ✅ 이름 · 출생연도 맞음 / ⚠️ 출생연도 다름 · 이름 다름 · 학기마다 다르게 이어짐 / 🔗 연결 안 됨 (추천이 있으면 보여 줌)
   · «고르기» · «추천대로 모두 잇기»는 그 학생의 모든 학기 원본에 함께 (sid · 누가 · 언제만 — 내용은 그대로) */
let AUD = null, AUD_ALL = false;
async function audit(box){
  const out = box.querySelector('[data-ima]');
  const terms = (A.TERMS || []).filter(t => t.src === 'import');
  out.innerHTML = '<div class="nh-desc">원본을 읽는 중…</div>';
  window.showLoading && showLoading('가져온 원본을 읽는 중…');
  const G = {};
  try{
    try{ await A.loadClasses(); }catch(e){}
    for(let i = 0; i < terms.length; i++){
      const t = terms[i];
      window.setLoadStep && setLoadStep(`${C.termLabel(t)} 읽는 중… (${i + 1}/${terms.length})`, Math.round(i / terms.length * 100));
      const q = await FS.getDocs(FS.query(FS.collection(A.db, 'nhpReports'), FS.where('termId', '==', t.id)));
      q.forEach(d => { const x = d.data(); if(x.src !== 'import' || x.superseded) return; const k = oldKey(x);
        (G[k] = G[k] || { k, r: { stuName: x.stuName, stuNo: x.stuNo }, reps: [] }).reps.push({ id: d.id, termId: x.termId, sid: x.sid || '' }); });
    }
  }catch(e){ window.hideLoading && hideLoading(); out.innerHTML = `<div class="nh-warn">읽지 못했어요 — ${esc(A.errText(e))}</div>`; return; }
  window.hideLoading && hideLoading();
  Object.values(G).forEach(g => judge(g));
  AUD = G; drawAudit(box);
}
function judge(g){
  const sids = Array.from(new Set(g.reps.map(x => x.sid)));
  const eb = birthYearOf(g.r.stuNo);
  g.sid = sids.length === 1 ? sids[0] : null;
  const sug = linkOne(g.r, A.STU);
  g.sug = sug.sid || sug.sug || '';
  g.sugHow = sug.how;
  if(sids.length > 1){ g.st = 'mixed'; return; }
  if(!g.sid){ g.st = 'none'; return; }
  const s = A.STU[g.sid];
  if(!s){ g.st = 'gone'; return; }
  const sameName = NM(s.name) === NM(g.r.stuName);
  const yb = byOf(s);
  if(!sameName){ g.st = 'name'; return; }
  if(eb && yb && Math.abs(yb - eb) > 1){ g.st = 'year'; return; }
  g.st = 'ok';
}
const AST = { ok: ['ok', '✅ 맞음'], year: ['warn', '⚠️ 출생연도 다름'], name: ['warn', '⚠️ 이름 다름'], mixed: ['warn', '⚠️ 학기마다 다르게 이어짐'], gone: ['red', '이은 학생이 없어짐'], none: ['gray', '연결 안 됨'] };
function drawAudit(box){
  const out = box.querySelector('[data-ima]');
  const all = Object.values(AUD).sort((a, b) => String(a.r.stuName).localeCompare(String(b.r.stuName), 'ko'));
  const cnt = k => all.filter(g => g.st === k).length;
  const show = all.filter(g => AUD_ALL || g.st !== 'ok');
  const fixable = all.filter(g => (g.st === 'none' || g.st === 'year' || g.st === 'mixed' || g.st === 'gone') && g.sugHow === 'by' && g.sug && g.sug !== g.sid);
  out.innerHTML = `<div class="frow" style="align-items:center;margin-bottom:8px">
      <span class="ch ok">✅ 맞음 ${cnt('ok')}</span><span class="ch warn">⚠️ 확인 ${cnt('year') + cnt('name') + cnt('mixed')}</span><span class="ch gray">연결 안 됨 ${cnt('none')}</span>${cnt('gone') ? `<span class="ch red">없어진 학생 ${cnt('gone')}</span>` : ''}
      <span class="nh-sp"></span><label class="ck"><input type="checkbox" data-imall${AUD_ALL ? ' checked' : ''}>맞는 학생도 보기</label>
      ${fixable.length ? `<button class="nh-btn sm g" data-imfix>✨ 추천대로 ${fixable.length}명 잇기</button>` : ''}</div>
    <div class="nh-desc" style="margin:0 0 6px">«추천» = 이름이 같고, 예전 학번으로 짐작한 출생연도(±1년)가 맞는 학생이 한 명뿐일 때. 졸업 · 전학으로 교사 선교사에 없는 학생은 «연결 안 됨» 그대로 두면 돼요 (이름으로 보관).</div>
    ${show.map(g => { const eb = birthYearOf(g.r.stuNo); const [tone, lab] = AST[g.st];
      const who = g.sid ? `<b>${esc(A.stuName(g.sid))}</b> <small style="color:var(--ink-2)">${esc(A.stuInfo(g.sid))}</small>` : (g.st === 'mixed' ? '<span class="nh-desc" style="margin:0">학기마다 다른 학생</span>' : '<span class="nh-desc" style="margin:0">—</span>');
      const sug = g.sug && g.sug !== g.sid ? (g.sugHow === 'by' ? `<br><small style="color:var(--sb-green,#00704A)">추천: <b>${esc(A.stuName(g.sug))}</b> ${esc(A.stuInfo(g.sug))}</small>`
        : `<br><small style="color:var(--ink-3)">이름이 같은 학생: ${esc(A.stuName(g.sug))} ${esc(A.stuInfo(g.sug))} — 출생연도가 달라 다른 학생일 수 있어요</small>`) : '';
      return `<div class="frow" style="align-items:center;padding:6px 0;border-bottom:1px solid var(--line-soft);margin:0">
        <span style="min-width:220px;font-size:12.5px"><b>${esc(g.r.stuName)}</b> <small>예전 학번 ${esc(g.r.stuNo || '-')}${eb ? ` · ${eb}년생쯤` : ''} · ${g.reps.length}학기</small></span>
        <span class="ch ${tone}">${esc(lab)}</span>
        <span style="flex:1;min-width:220px;font-size:12.5px">→ ${who}${sug}</span>
        <button class="nh-btn xs" data-imaudpick="${esc(g.k)}">고르기</button></div>`; }).join('') || '<div class="nh-info">모두 맞아요 👏</div>'}`;
  const al = out.querySelector('[data-imall]'); if(al) al.onchange = () => { AUD_ALL = al.checked; drawAudit(box); };
  out.querySelectorAll('[data-imaudpick]').forEach(b => b.onclick = async () => {
    const g = AUD[b.dataset.imaudpick]; if(!g) return;
    const sid = await A.pickStudent(`🔗 ${g.r.stuName} (예전 학번 ${g.r.stuNo || '-'}) — 어느 학생인가요?`, { name: g.r.stuName, birthYear: birthYearOf(g.r.stuNo), current: g.sid || g.sug || '',
      help: `이 학생의 원본 ${g.reps.length}개(${esc(Array.from(new Set(g.reps.map(x => C.termLabel(A.TERMS.find(t => t.id === x.termId) || { id: x.termId })))).join(', '))})가 모두 이 학생으로 이어져요. 원본 내용은 그대로예요.` });
    if(sid == null) return;
    if(await relink([g], () => sid)) drawAudit(box);
  });
  const fx = out.querySelector('[data-imfix]'); if(fx) fx.onclick = async () => {
    if(!(await A.confirm('✨ 추천대로 잇기', `${fixable.length}명(원본 ${fixable.reduce((n, g) => n + g.reps.length, 0)}개)을 추천한 학생과 이어요.<br><span style="color:var(--ink-2)">${fixable.slice(0, 12).map(g => `${esc(g.r.stuName)} → ${esc(A.stuName(g.sug))}`).join(' · ')}${fixable.length > 12 ? ' …' : ''}</span><br>원본 내용은 그대로예요.`, '잇기'))) return;
    if(await relink(fixable, g => g.sug)) drawAudit(box);
  };
}
async function relink(groups, sidOf){
  window.showLoading && showLoading('잇는 중…');
  let n = 0;
  try{
    const ops = [];
    groups.forEach(g => { const sid = sidOf(g) || ''; g.reps.forEach(x => { if(x.sid !== sid) ops.push({ x, sid }); }); });
    for(let i = 0; i < ops.length; i += 400){
      const bt = FS.writeBatch(A.db);
      ops.slice(i, i + 400).forEach(({ x, sid }) => bt.update(FS.doc(A.db, 'nhpReports', x.id), { sid, linkedBy: A.CU.uid, linkedByName: A.CU.name || '', linkedAt: FS.serverTimestamp() }));
      await bt.commit();
      ops.slice(i, i + 400).forEach(({ x, sid }) => { x.sid = sid; n++; });
    }
    groups.forEach(g => judge(g));
    window.hideLoading && hideLoading();
    A.toast(`원본 ${n}개의 잇기를 고쳤어요 ✓ (내용은 그대로)`);
    return true;
  }catch(e){
    window.hideLoading && hideLoading();
    A.toast('고치지 못했어요 — ' + A.errText(e) + (/permission/.test((e && e.code) || '') ? ' (보안 규칙 v36을 게시해 주세요)' : ''), 'err');
    groups.forEach(g => judge(g));
    return n > 0;
  }
}
