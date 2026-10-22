/* ═══════════════════════════════════════════════════════════
   🗂 nhp-import.js — 예전 나학평(DA학사관리시스템) 자료 가져오기 · v141
   · 옮김 파일(nhp-import-….json — 7_보관 폴더 · 깃허브에 올리지 않음)을 이 기기에서 읽어 원본으로 저장
   · 학생은 학번(같으면) → 이름(한 명뿐이면)으로 교사 선교사 학생과 잇는다 · 못 이은 학생은 직접 고른다
   · 원본(nhpReports)은 한 번 만들면 바뀌지 않는다 — 다시 가져와도 이미 있는 원본은 건너뛴다
   ═══════════════════════════════════════════════════════════ */
let A = null, C = null, esc = null, FS = null;
let DATA = null, MAP = {}, PICK = {};
const bindA = a => { A = a; C = a.C; esc = a.esc; FS = a.FS; };

export function cardHTML(a){
  bindA(a);
  return `<div class="nh-desc">예전 나학평 프로그램에서 읽어 만든 <b>옮김 파일</b>(교사 선교사.zip › <b>7_보관</b> › nhp-import-….json)을 고르세요. 파일은 이 기기에서만 읽고, 학생별 나학평이 <b>원본</b>으로 저장돼요.
      <br>· 원본은 한 번 저장하면 바뀌지 않아요 (고쳐서 내보낼 때는 «출력본») · 다시 가져와도 이미 있는 원본은 건너뛰어요 · 2026 1학기 평가 틀은 2학기 «이어받기»에 쓰여요</div>
    <input type="file" accept=".json,application/json" data-imf style="margin:6px 0 10px">
    <div data-imv></div>`;
}
export function bind(a, box){
  bindA(a);
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
      match();
      draw(box);
    }catch(e){ v.innerHTML = `<div class="nh-warn">읽지 못했어요 — ${esc(e.message || e)}</div>`; }
  };
}
/* 학생 잇기 — 학번 → 이름 */
export function matchStudents(reports, students){
  const byNo = {}, byName = {};
  Object.values(students || {}).filter(s => s.org === C.ORG).forEach(s => {
    if(s.studentNo) byNo[String(s.studentNo)] = s;
    const n = String(s.name || '').replace(/\s+/g, ''); (byName[n] = byName[n] || []).push(s);
  });
  const out = {};
  reports.forEach((r, i) => {
    const nm = String(r.stuName || '').replace(/\s+/g, '');
    const a = r.stuNo && byNo[String(r.stuNo)];
    if(a && String(a.name || '').replace(/\s+/g, '') === nm){ out[i] = { sid: a.id, how: 'no' }; return; }
    const c = byName[nm] || [];
    // 이름이 같은 학생이 한 명 — 학번이 서로 있는데 다르면 «확인 필요» (졸업생과 재학생 이름이 같을 수 있음)
    if(c.length === 1){ const diffNo = a || (r.stuNo && c[0].studentNo && String(c[0].studentNo) !== String(r.stuNo)); out[i] = { sid: c[0].id, how: diffNo ? 'name*' : 'name' }; return; }
    if(a){ out[i] = { sid: a.id, how: 'no*' }; return; }      // 학번은 같은데 이름이 다름 (개명 · 오타) — 확인 필요
    out[i] = { sid: '', how: c.length > 1 ? 'many' : 'none' };
  });
  return out;
}
function match(){
  DATA.terms.forEach(t => { MAP[t.id] = matchStudents(t.reports, A.STU); });
}
function draw(box){
  const v = box.querySelector('[data-imv]');
  const rows = DATA.terms.map(t => {
    const m = MAP[t.id]; const vals = Object.values(m);
    const c = k => vals.filter(x => x.how === k).length;
    const ex = A.TERMS.find(x => x.id === t.id);
    const clash = ex && ex.src !== 'import';
    return `<tr><td class="c"><input type="checkbox" data-imt="${esc(t.id)}"${PICK[t.id] && !clash ? ' checked' : ''}${clash ? ' disabled' : ''}></td><td><b>${esc(t.label || C.termLabel(t))}</b>${clash ? '<br><span class="ch red">이미 나학평에서 연 학기 — 건너뜀</span>' : ex ? '<br><span class="ch gray">가져온 적 있음 — 새 원본만 더함</span>' : ''}</td>
      <td class="c">${t.sections.length}</td><td class="c">${t.reports.length}</td><td class="c">${c('no')}</td><td class="c">${c('name') + c('name*')}</td><td class="c">${c('no*') ? `<span class="ch warn">${c('no*')}</span>` : 0}</td><td class="c">${(c('none') + c('many')) ? `<span class="ch red">${c('none') + c('many')}</span>` : 0}</td><td class="c">${(t.setups || []).length || ''}</td></tr>`;
  }).join('');
  const un = [];
  DATA.terms.forEach(t => Object.entries(MAP[t.id]).forEach(([i, x]) => { if(!x.sid || x.how === 'no*' || x.how === 'name*') un.push({ t, i: +i, x, r: t.reports[+i] }); }));
  const opts = Object.values(A.STU).filter(s => s.org === C.ORG).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  v.innerHTML = `<div class="nh-info">파일: ${esc(DATA.src || '')} · 만든 날 ${esc(DATA.made || '')} · 학기 ${DATA.terms.length}개 · 원본 ${DATA.terms.reduce((n, t) => n + t.reports.length, 0)}명분</div>
    <div class="nh-tw"><table class="nh-t"><thead><tr><th class="c">가져오기</th><th>학기</th><th class="c">반</th><th class="c">원본</th><th class="c">학번으로 이음</th><th class="c">이름으로 이음</th><th class="c">확인 필요</th><th class="c">못 이음</th><th class="c">평가 틀</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${un.length ? `<details class="dr" style="margin-top:10px"><summary>🔗 학생 잇기 확인 <small>${un.length}명 — 졸업 · 전학한 학생은 이을 학생이 없어도 괜찮아요 (이름으로 보관)</small></summary><div class="db">
      ${un.map(u => `<div class="frow" style="align-items:center;margin-bottom:6px"><span style="min-width:220px;font-size:12.5px"><b>${esc(u.r.stuName)}</b> ${esc(u.r.stuNo || '')} · ${esc(u.t.label)} · ${esc(u.r.secName || '')}</span>
        <span class="ch ${u.x.how === 'none' || u.x.how === 'many' ? 'red' : 'warn'}">${{ none: '없음', many: '같은 이름 여럿', 'no*': '학번 같음 · 이름 다름', 'name*': '이름 같음 · 학번 다름' }[u.x.how] || ''}</span>
        <select class="nh-sel" style="height:32px" data-imap="${esc(u.t.id)}" data-i="${u.i}"><option value="">— 잇지 않음 (이름으로만 보관) —</option>${opts.map(s => `<option value="${esc(s.id)}"${u.x.sid === s.id ? ' selected' : ''}>${esc(s.name)} ${esc(s.studentNo || '')}${s.birth ? ' · ' + esc(s.birth.slice(0, 4)) : ''}</option>`).join('')}</select></div>`).join('')}
      </div></details>` : ''}
    <div class="frow" style="margin-top:12px"><button class="nh-btn p" data-imgo>🗂 가져오기</button><span class="nh-desc" style="margin:0">학기마다 «마감된 지난 학기»로 들어가요 (선생님 «내 할 일»에는 나오지 않음).</span></div>`;
  v.querySelectorAll('[data-imt]').forEach(i => i.onchange = () => { PICK[i.dataset.imt] = i.checked; });
  v.querySelectorAll('[data-imap]').forEach(s => s.onchange = () => { MAP[s.dataset.imap][+s.dataset.i] = { sid: s.value, how: s.value ? 'hand' : 'none' }; });
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
          bt.set(FS.doc(A.db, 'nhpReports', id), { termId: t.id, org: C.ORG, secId: r.secId, secName: r.secName || '', sid: (m[i] || {}).sid || '', stuNo: r.stuNo || '', stuName: r.stuName || '',
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
