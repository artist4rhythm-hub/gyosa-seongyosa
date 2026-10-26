/* ═══ 📅 consult-board.js — 편성 보드 (v149 · v151 학부모 안내판 · 전화 상담 시간) ═══
   · 보기 셋: 표(3일 한 화면 · 기본) · 날짜별(크게) · 가정별(한 줄 = 한 가정 · 형제를 함께 끌기)
   · 담당: 이름을 끌어 같은 세로줄의 다른 칸에 놓으면 옮기고, 사람이 있으면 서로 바꿈 · «그 외» 줄로 끌면 전화 · 별도
     (휴대폰 · 끌기가 안 될 때: 이름을 누르고 «옮기기» → 칸 누르기)
   · 선생님들: 보낸 판을 보고 · 우리 반 «확인했어요» · 이름을 눌러 «변경 요청» */
let A = null, C = null, esc = null;
const ICON_PIN = '📌';

/* ── 칸 지도 ── */
function occMap(seats){
  const occ = {}, etc = {};
  Object.entries(seats || {}).forEach(([sid, st]) => {
    if(!st) return;
    const col = A.colOf[sid]; if(col == null) return;
    if(st.k === 'phone' || st.k === 'sep'){ (etc[`${col}|${st.k}`] = etc[`${col}|${st.k}`] || []).push(sid); return; }
    const k = `${col}|${st.d}|${st.s}`; (occ[k] = occ[k] || []).push(sid);
  });
  return { occ, etc };
}
const editable = () => A.isMgr && A.R && A.R.state !== 'closed';
const issueOf = sid => { const iss = (A.chk && A.chk.issues) || []; if(iss.some(i => i.lvl === 'err' && i.sids.includes(sid))) return 'err'; if(iss.some(i => i.lvl === 'warn' && i.code !== 'unplaced' && i.sids.includes(sid))) return 'warn'; return ''; };
const kidOf = sid => A.KIDS[sid] || '';
const noteOf = sid => { const st = A.viewSeats()[sid]; return (st && st.note) || ''; };
function subText(sid, big){
  const bits = [];
  const fs = A.styleOf(sid);
  if(fs) bits.push(`${fs.mark}${big ? ' 형제 ' + A.famIds(sid).length : ''}`);
  const k = kidOf(sid); if(k) bits.push(`${A.staffName(k) || '교직원'} 자녀`);
  return bits.join(' · ');
}
/* 형제 다른 칸 (날짜별 보기 · 담임 칸에 한 줄) */
function sibLine(sid){
  const seats = A.viewSeats();
  const ids = A.famIds(sid).filter(x => x !== sid);
  if(!ids.length) return '';
  return '형제 ' + ids.map(o => { const st = seats[o]; const c = A.colByKey(A.colOf[o]); const where = c ? (c.grades || c.name) : ''; if(!st) return `${where} 자리 없음`; if(st.k !== 'face') return `${where} ${C.KINDS[st.k]}`; return `${C.dayLabel(C.dayList(A.R)[st.d].date, true)} ${C.slotTime(A.R, st.d, st.s)} ${where}`; }).join(' · ');
}
function chipHTML(sid, opt){
  opt = opt || {};
  const fs = A.styleOf(sid);
  const st = A.viewSeats()[sid] || {};
  const cls = ['cs-chip'];
  if(kidOf(sid)) cls.push('kid');
  if(A.FAM_SEL && A.famOf(sid) === A.FAM_SEL) cls.push('sel');
  if(A.HL.includes(sid)) cls.push('hl');
  if(A.MOVE && A.MOVE.sid === sid) cls.push('moving');
  const is = A.isMgr ? issueOf(sid) : ''; if(is) cls.push(is);
  if(!editable()) cls.push('ro');
  const style = fs ? `background:${fs.bg};color:${fs.fg};border-color:${fs.bg};--cs-fg:${fs.fg}` : '';
  const sub = subText(sid, opt.big);
  const note = noteOf(sid) || (opt.etc ? '' : '');
  const lines = opt.big ? [sibLine(sid), note ? '📝 ' + note : ''].filter(Boolean) : [];
  const title = [A.stuName(sid), sub, note].filter(Boolean).join(' · ');
  return `<button class="${cls.join(' ')}" data-sid="${esc(sid)}"${editable() ? ' draggable="true"' : ''} style="${style}" title="${esc(title)}" aria-label="${esc(title)}">
    <span class="n">${esc(A.stuName(sid))}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}${st.k === 'phone' ? `<span class="ptm${st.pd && st.pt ? '' : ' no'}">☎ ${esc(C.phoneWhen(st))}</span>` : ''}${opt.etc && note ? `<span class="sub">${esc(note)}</span>` : ''}
    ${lines.map(l => `<span class="ln">${esc(l)}</span>`).join('')}
    ${st.pin ? `<span class="pin" aria-hidden="true">${ICON_PIN}</span>` : ''}${!opt.big && !opt.etc && note ? '<span class="memo" aria-hidden="true">✎</span>' : ''}</button>`;
}

/* ── 단계 띠 ── */
function stepsHTML(){
  const r = A.R; const cur = C.stepNo(r);
  const pubs = C.pubsOf(r).filter(p => p.label !== '확정'), lp = pubs[pubs.length - 1];
  const st = [['준비', 1], ['초안 편성', 2], ['담임 확인', 3], [`학부모 안내 · 변경${lp ? ` <span style="font-weight:600;opacity:.85">(${esc(lp.label)})</span>` : ''}`, 4], ['확정', 5]];
  const at = r.updatedAt && r.updatedAt.seconds ? new Date(r.updatedAt.seconds * 1000) : null;
  const when = at ? `${at.getMonth() + 1}월 ${at.getDate()}일 ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '';
  return `<div class="cs-steps">${st.map(([l, n], i) => `${i ? '<span class="dash">—</span>' : ''}<div class="cs-step${n < cur ? ' dn' : (n === cur ? ' on' : '')}"><span class="no">${n < cur ? '✓' : n}</span><span class="lb">${l}</span>${n === cur && r.ver && n < 4 ? ` <span style="font-weight:500;opacity:.85">· 판 ${r.ver}</span>` : ''}</div>`).join('')}
    <span class="sp"></span><span class="cs-mut">${r.state === 'closed' ? '끝난 상담 · 보기만' : (when ? `저장됨 · ${when}${r.updatedBy ? ' · ' + esc(A.staffName(r.updatedBy)) : ''}` : '')}</span></div>`;
}

/* ── 도구 줄 ── */
function toolsHTML(view){
  const r = A.R;
  const seg = `<div class="cs-seg" role="group" aria-label="보기">${[['', '표 (전체)'], ['day', '날짜별'], ['fam', '가정별']].map(([k, l]) => `<button data-view="${k}" class="${view === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if(!A.isMgr){
    return `<div class="cs-tools">${seg}<label class="ck" style="margin-left:6px"><input type="checkbox" data-mine${A.lsGet('cs_mine', '') === '1' ? ' checked' : ''}> 우리 반만</label><span class="sp"></span>
      <button class="cs-btn sm" data-b="print">🖨 인쇄 · PDF</button></div>`;
  }
  const opt = C.optOf(r);
  const dir = r.dir || C.dirFor(opt, A.prevDir());
  const ordL = opt.order === 'fair' ? '지난 자리로 고르게' : (dir === 'desc' ? 'ㅎ→ㄱ' : 'ㄱ→ㅎ');
  const ordT = { flip: '지난번과 반대', asc: 'ㄱ→ㅎ', desc: 'ㅎ→ㄱ', fair: '지난 자리로 고르게' }[opt.order] + (opt.guardFront ? ' + 앞자리 점검' : '') + ' — 준비 › 순서에서 바꿔요';
  const unsent = r.sentSeats ? C.diffSeats(r.sentSeats, r.seats).length : 0;
  const pins = Object.values(r.seats || {}).filter(s => s && (s.pin || s.k === 'phone' || s.k === 'sep')).length;
  let main = '';
  if(r.state === 'closed') main = A.CU.role === 'super' ? '<button class="cs-btn sm" data-b="reopen">🔓 다시 열기</button>' : '';
  else if(r.state === 'prep' || r.state === 'draft') main = `<button class="cs-btn g" data-b="send"${Object.keys(r.seats || {}).length ? '' : ' disabled'}>담임 확인 보내기 →</button>`;
  else{
    if(unsent) main += `<button class="cs-btn w" data-b="send">고친 것 보내기 (${unsent}명)</button>`;
    if(r.state === 'review') main += `<button class="cs-btn ${C.pubsOf(r).length ? '' : 'g'}" data-b="pub" title="학부모님께 나눠 줄 판으로 기록하고 인쇄 · PDF">📨 학부모께 ${esc(C.nextPubLabel(r))} 보내기</button><button class="cs-btn ${C.pubsOf(r).length ? 'g' : ''}" data-b="final">확정하기 →</button>`;
    if(r.state === 'final') main += `<button class="cs-btn sm" data-b="close">상담 끝내기</button>`;
  }
  return `<div class="cs-tools">${seg}
    ${r.state !== 'closed' ? `<button class="cs-btn sm" data-b="order" title="${esc(ordT)}">↕ 순서 · ${esc(ordL)}</button>
    <button class="cs-btn sm m" data-b="auto" title="📌 고정한 자리 · 전화 상담 · 별도 일정은 그대로 둬요">↻ 자동 배치${Object.keys(r.seats || {}).length ? ' 다시' : ''}${pins ? ` <span style="font-weight:500">(고정 ${pins}명 그대로)</span>` : ''}</button>` : ''}
    <span class="sp"></span>
    <button class="cs-btn sm" data-b="vers">판 비교</button>
    <button class="cs-btn sm" data-b="print">🖨 인쇄 · PDF</button>${main}</div>`;
}
function legendHTML(){
  return `<div class="cs-legend"><span><span class="sw" style="background:#D6E6FF"></span><span class="sw" style="background:#FDE2C8;margin-left:-4px"></span>같은 색 · 같은 번호 = 한 가정 (형제)</span>
    <span><span class="sw" style="border:1.5px dashed var(--sb-green)"></span>교직원 자녀</span><span>${ICON_PIN} 고정 (자동 배치가 안 건드림)</span><span>✎ 메모</span>
    ${A.isMgr ? '<span><span class="sw" style="border:2px solid #D97706"></span>확인 필요</span><span><span class="sw" style="background:repeating-linear-gradient(135deg,#ECEAE3 0 4px,transparent 4px 8px)"></span>못 하는 시간</span>' : ''}
    <span>· ${editable() ? '이름을 끌어 같은 반 줄의 다른 칸에 놓으면 옮기고, 사람이 있으면 서로 바뀌어요 · 이름을 누르면 메뉴' : '이름을 누르면 형제 시간 · 변경 요청'}</span></div>`;
}

/* ── 표 (전체) ── */
function colsShown(){
  const cols = A.R.cols || [];
  if(!A.isMgr && A.lsGet('cs_mine', '') === '1'){ const mine = A.myCols(); const f = cols.filter(c => mine.includes(c.key)); if(f.length) return f; }
  return cols;
}
const roomHTML = t => { const x = String(t || '').trim(); if(!x) return ''; const m = /^(.*[\]\)])\s*(\S.*)$/.exec(x); return (m ? [m[1], m[2]] : x.split(/\s+/)).map(w => `<span class="nw">${esc(w)}</span>`).join(' '); };
function gridVars(n, cw, tc){ return `--cs-n:${n};--cs-cw:${cw}px;--cs-tc:${tc}px;--cs-minw:${tc + n * cw}px`; }
function colHeadHTML(cols, counts){
  const mine = A.myCols();
  return `<div class="cs-row hd"><div>시간</div>${cols.map(c => `<div class="cs-ch${mine.includes(c.key) ? ' me' : ''}"><div class="g">${esc(c.grades || '')} <span>${esc(c.name || '')}</span></div><div class="t">${esc(c.tname || A.staffName(c.uid) || '담임 없음')}</div><div class="r">${roomHTML(c.room) || '교실 미정'} · ${counts[c.key] || 0}명</div></div>`).join('')}</div>`;
}
function gridHTML(dayIdx, big){
  const r = A.R, seats = A.viewSeats();
  const cols = colsShown(), days = C.dayList(r);
  const { occ, etc } = occMap(seats);
  const counts = {}; Object.entries(seats).forEach(([sid, st]) => { if(st && A.inSet.has(sid)) counts[A.colOf[sid]] = (counts[A.colOf[sid]] || 0) + 1; });
  const mine = A.myCols();
  const offSet = {}; cols.forEach(c => (c.off || []).forEach(o => { offSet[`${c.key}|${o.replace('_', '|')}`] = 1; }));
  let h = colHeadHTML(cols, counts);
  const showDays = dayIdx == null ? days.map((x, i) => i) : (dayIdx === 'etc' ? [] : [dayIdx]);
  showDays.forEach(d => {
    const n = C.dayN(r, d);
    let used = 0; cols.forEach(c => { for(let s = 0; s < n; s++){ const ids = (occ[`${c.key}|${d}|${s}`] || []).filter(id => A.inSet.has(id)); if(ids.length) used++; } });
    if(dayIdx == null) h += `<div class="cs-day"><b>${esc(C.dayLabel(days[d].date))}</b><span>${used}명 · 빈 칸 ${cols.length * n - used}</span></div>`;
    for(let s = 0; s < n; s++){
      h += `<div class="cs-row${s % 2 ? ' z' : ''}"><div class="cs-tm"><b>${C.NO_KO[s] || (s + 1) + '번째'}</b><span>${C.slotRange(r, d, s)}</span></div>`;
      cols.forEach(c => {
        const ids = occ[`${c.key}|${d}|${s}`] || [];
        const off = offSet[`${c.key}|${d}|${s}`];
        const cls = ['cs-cell']; if(off) cls.push('off'); if(mine.includes(c.key)) cls.push('me');
        const inner = ids.map(id => A.inSet.has(id) ? chipHTML(id, { big }) : `<div class="cs-vac" title="초안 뒤에 대상에서 빠진 학생 (휴학 등)"><span>비움</span><span>${esc(A.stuName(id))} · 빠짐</span>${editable() ? `<button class="cs-btn xs" data-vclear="${esc(id)}" style="margin-top:2px">자리 지우기</button>` : ''}</div>`).join('');
        h += `<div class="${cls.join(' ')}" data-col="${esc(c.key)}" data-d="${d}" data-s="${s}"${off ? ' title="못 하는 시간"' : ''}>${inner}</div>`;
      });
      h += '</div>';
    }
  });
  // 그 외 (전화 · 별도)
  if(dayIdx == null || dayIdx === 'etc'){
    h += `<div class="cs-day"><b>그 외</b><span>${editable() ? '여기로 끌어 놓으면 전화 상담 · 별도 일정' : '전화 상담 · 별도 일정'}</span></div>`;
    [['phone', '☎ 전화 상담'], ['sep', '🗓 별도 일정']].forEach(([k, l]) => {
      h += `<div class="cs-row"><div class="cs-etc">${l}</div>${cols.map(c => `<div class="cs-cell etc" data-col="${esc(c.key)}" data-k="${k}">${(etc[`${c.key}|${k}`] || []).filter(id => A.inSet.has(id)).map(id => chipHTML(id, { etc: true })).join('')}</div>`).join('')}</div>`;
    });
  }
  const cw = big ? 130 : 92, tc = 104;
  return `<div class="cs-board${big ? ' cs-big' : ''}"><div class="cs-scroll"><div class="cs-grid" style="${gridVars(cols.length, cw, tc)}">${h}</div></div></div>`;
}
/* ── ☎ 전화 상담 · 🗓 별도 일정 목록 (표 아래 · 담당은 여기서 시간을 정함) ── */
function etcListHTML(){
  const r = A.R, seats = A.viewSeats(), mine = A.myCols();
  const list = Object.entries(seats).filter(([sid, st]) => st && st.k !== 'face' && A.inSet.has(sid) && (A.isMgr || A.lsGet('cs_mine', '') !== '1' || mine.includes(A.colOf[sid])));
  const ph = list.filter(([, st]) => st.k === 'phone').sort((a, b) => C.phoneKey(a[1]).localeCompare(C.phoneKey(b[1])) || String(A.stuName(a[0])).localeCompare(String(A.stuName(b[0])), 'ko'));
  const sp = list.filter(([, st]) => st.k === 'sep');
  if(!ph.length && !sp.length && !editable()) return '';
  const who = sid => { const c = A.colByKey(A.colOf[sid]); return `<span><b>${esc(A.stuName(sid))}</b> <span class="cs-mut">${esc(C.colLabel(c))}</span>${kidOf(sid) ? ` <span class="cs-mut" style="color:var(--sb-green)">· ${esc(A.staffName(kidOf(sid)))} 자녀</span>` : ''}</span><span class="cs-mut">${esc(c ? c.tname || '' : '')}</span>`; };
  const iss = sid => ((A.chk && A.chk.issues) || []).find(i => i.code === 'phone' && i.sids[0] === sid);
  const row = (sid, st) => `<div class="er"${mine.includes(A.colOf[sid]) ? ' style="background:var(--sb-mint-2);border-radius:8px"' : ''}><span class="tm${st.k === 'phone' && !(st.pd && st.pt) ? ' no' : ''}">${st.k === 'phone' ? '☎ ' + esc(C.phoneWhen(st)) : '🗓 ' + esc(st.note || '날짜 미정')}</span>${who(sid)}
    <span class="cs-mut">${esc(st.k === 'phone' ? (st.note || '') : '')}${A.isMgr && iss(sid) ? `<br><b style="color:#92400E">${esc(iss(sid).text)}</b>` : ''}</span>
    <span class="bt">${editable() ? `${st.k === 'phone' ? `<button class="cs-btn xs" data-ph="${esc(sid)}">시간 정하기</button>` : `<button class="cs-btn xs" data-spn="${esc(sid)}">날짜 · 시간 고치기</button>`}<button class="cs-btn xs" data-toface="${esc(sid)}">↩ 표로 (대면)</button>` : ''}</span></div>`;
  return `<div class="cs-card cs-etcl"><h3 style="margin:0 0 6px;font-size:14px;font-weight:900;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span>☎ 전화 상담 ${ph.length}명 · 🗓 별도 일정 ${sp.length}명</span>${A.isMgr && A.chk && A.chk.sum.phoneNoTime ? `<span class="ch" style="background:#FFF1E6;color:#C2410C">시간 미정 ${A.chk.sum.phoneNoTime}</span>` : ''}<span style="flex:1"></span>${editable() ? '<button class="cs-btn sm" data-phadd>+ 전화 상담 넣기</button>' : ''}</h3>
    ${ph.length || sp.length ? `<div class="er hd"><span>때</span><span>학생</span><span>담임</span><span>메모</span><span></span></div>${ph.map(([sid, st]) => row(sid, st)).join('')}${sp.map(([sid, st]) => row(sid, st)).join('')}`
      : `<div class="cs-mut" style="line-height:1.7">전화로 상담할 가정은 표에서 이름을 눌러 <b>«☎ 전화 상담으로…»</b> 또는 위 <b>«+ 전화 상담 넣기»</b> — 날짜 · 시각을 정하면 여기에 시간 순으로 모이고, 인쇄본 «그 외»에도 시각이 함께 나가요. 선생님이 «☎ 전화 상담» 요청을 보내면 변경 요청에서 바로 배정해요.</div>`}</div>`;
}
/* ── 날짜별 ── */
function dayViewHTML(sub){
  const r = A.R, seats = A.viewSeats(), days = C.dayList(r), cols = colsShown();
  const di = sub === 'etc' ? 'etc' : Math.max(0, Math.min(days.length - 1, Number(sub) || 0));
  const tabs = days.map((x, d) => {
    const n = C.dayN(r, d); let used = 0;
    Object.entries(seats).forEach(([sid, st]) => { if(st && st.k === 'face' && st.d === d && A.inSet.has(sid) && cols.some(c => c.key === A.colOf[sid])) used++; });
    const cap = cols.length * n;
    return `<button class="cs-dtab${di === d ? ' on' : ''}" data-day="${d}"><b>${esc(C.dayLabel(x.date))}</b><span>${used}명 · 빈 칸 ${cap - used}</span><span class="cs-bar"><i style="width:${cap ? Math.round(used / cap * 100) : 0}%"></i></span></button>`;
  }).join('');
  const nE = Object.entries(seats).filter(([sid, st]) => st && st.k !== 'face' && A.inSet.has(sid)).length;
  return `<div class="cs-days">${tabs}<button class="cs-dtab${di === 'etc' ? ' on' : ''}" data-day="etc"><b>그 외</b><span>전화 · 별도 ${nE}명</span><span class="cs-bar"><i style="width:0"></i></span></button></div>
    ${gridHTML(di, true)}`;
}
/* ── 가정별 ── */
function famViewHTML(){
  const r = A.R, seats = A.viewSeats(), days = C.dayList(r);
  const filt = A.lsGet('cs_ff', 'sib');
  const prev = A.prevRounds();
  const last = prev.length ? C.lastPosFor([...A.inSet], prev) : {};
  let fams = Object.entries(A.members).map(([k, ids]) => ({ k, ids: ids.slice().sort((a, b) => (C.gradeNoOf(A.colByKey(A.colOf[b]) && A.colByKey(A.colOf[b]).grades) - C.gradeNoOf(A.colByKey(A.colOf[a]) && A.colByKey(A.colOf[a]).grades))) }));
  const isKidFam = f => f.ids.some(id => kidOf(id));
  const warnSet = new Set(((A.chk && A.chk.issues) || []).filter(i => i.lvl !== 'info' && i.code !== 'unplaced').flatMap(i => i.sids));
  const nSib = fams.filter(f => f.ids.length > 1 || isKidFam(f)).length, nWarn = fams.filter(f => f.ids.some(id => warnSet.has(id))).length;
  if(filt === 'sib') fams = fams.filter(f => f.ids.length > 1 || isKidFam(f));
  else if(filt === 'warn') fams = fams.filter(f => f.ids.some(id => warnSet.has(id)));
  const firstIdx = f => Math.min(...f.ids.map(id => { const st = seats[id]; return st && st.k === 'face' ? C.slotIdx(r, st.d, st.s) : 9999; }));
  fams.sort((a, b) => firstIdx(a) - firstIdx(b) || String(A.stuName(a.ids[0])).localeCompare(String(A.stuName(b.ids[0])), 'ko'));
  const maxN = Math.max(1, ...days.map((x, d) => C.dayN(r, d)));
  const busyOf = f => { const out = new Set(); f.ids.forEach(id => { const uid = kidOf(id); if(!uid) return; const c = (r.cols || []).find(c => c.uid === uid); if(!c) return; Object.entries(seats).forEach(([o, st]) => { if(st && st.k === 'face' && A.colOf[o] === c.key && A.inSet.has(o)) out.add(`${st.d}|${st.s}`); }); }); return out; };
  const rows = fams.map((f, i) => {
    const fs = A.styleOf(f.ids[0]);
    const busy = busyOf(f);
    const warn = f.ids.some(id => warnSet.has(id));
    const nm = f.ids.length > 1 ? `${String(A.stuName(f.ids[0])).slice(0, 1)} 가정` : A.stuName(f.ids[0]);
    const kidT = f.ids.map(kidOf).filter(Boolean).map(u => A.staffName(u) + ' 자녀')[0];
    const lp = f.ids.map(id => last[id]).filter(Boolean);
    const lastTxt = lp.length ? C.POS_KO[lp.includes('f') ? 'f' : lp.includes('b') ? 'b' : 'm'] : '—';
    const tl = days.map((x, d) => {
      let cells = '';
      for(let s = 0; s < maxN; s++){
        const here = f.ids.filter(id => { const st = seats[id]; return st && st.k === 'face' && st.d === d && st.s === s; });
        const inDay = s < C.dayN(r, d);
        const cls = ['sl']; if(busy.has(`${d}|${s}`)) cls.push('busy');
        cells += `<div class="${cls.join(' ')}" data-fd="${d}" data-fs="${s}" data-fk="${esc(f.k)}"${inDay ? '' : ' style="opacity:.3"'}>${here.map(id => {
          const c = A.colByKey(A.colOf[id]);
          const prevHere = f.ids.some(o => { const st = seats[o]; return st && st.k === 'face' && st.d === d && st.s === s - 1; });
          const nextHere = f.ids.some(o => { const st = seats[o]; return st && st.k === 'face' && st.d === d && st.s === s + 1; });
          const rad = `${prevHere ? 0 : 8}px ${nextHere ? 0 : 8}px ${nextHere ? 0 : 8}px ${prevHere ? 0 : 8}px`;
          const bg = kidOf(id) ? 'var(--surface)' : (fs ? fs.bg : '#F3F2EE'), fg = fs ? fs.fg : 'var(--ink)';
          return `<div class="blk" data-fblk="${esc(id)}"${editable() ? ' draggable="true"' : ''} style="background:${bg};color:${fg};border-radius:${rad};${kidOf(id) ? 'border:1.5px dashed var(--sb-green);' : ''}${warnSet.has(id) ? 'border:2px solid #D97706;' : ''}" title="${esc(A.stuName(id) + ' · ' + C.colLabel(c))}"><span>${esc(A.stuName(id))}</span><small>${esc(c ? (c.grades || '') + ' ' + (c.tname || '') : '')}</small></div>`;
        }).join('')}</div>`;
      }
      return `<div class="tl" style="--cs-sn:${maxN}">${cells}</div>`;
    }).join('');
    const etcs = f.ids.filter(id => { const st = seats[id]; return st && st.k !== 'face'; }).map(id => `${A.stuName(id)} · ${C.KINDS[seats[id].k]}${seats[id].note ? ' ' + seats[id].note : ''}`);
    const none = f.ids.filter(id => !seats[id]).map(id => A.stuName(id) + ' · 자리 없음');
    return `<div class="cs-fam${warn ? ' warn' : ''}" style="--cs-dn:${days.length}"><div style="font-size:13px;font-weight:900;color:var(--ink-2);text-align:center">${i + 1}</div>
      <div style="display:flex;align-items:center;gap:8px">${fs ? `<span style="width:12px;height:12px;border-radius:3px;background:${fs.bg};border:1px solid ${fs.fg};flex:none"></span>` : ''}<div style="display:flex;flex-direction:column;min-width:0"><b style="font-size:13.5px">${esc(nm)} ${fs ? `<span style="color:${fs.fg}">${fs.mark}</span>` : ''}</b><span class="cs-mut">${esc(f.ids.map(id => (A.colByKey(A.colOf[id]) || {}).grades + ' ' + A.stuName(id)).join(' · '))}</span>${kidT ? `<span class="cs-mut" style="color:var(--sb-green);font-weight:800">${esc(kidT)}</span>` : ''}</div></div>
      <div style="display:flex;flex-direction:column;justify-content:center"><span class="cs-mut">지난: ${esc(lastTxt)}</span>${warn ? '<span style="font-size:11px;font-weight:800;color:#92400E">확인 필요</span>' : ''}</div>
      ${tl}<div style="border-left:1px solid var(--line-soft);font-size:11.5px;color:var(--ink-2);display:flex;flex-direction:column;justify-content:center;gap:2px">${etcs.concat(none).map(esc).join('<br>')}</div></div>`;
  }).join('');
  const head = `<div class="cs-fam hd" style="--cs-dn:${days.length}"><div style="text-align:center">#</div><div>가정</div><div>지난 자리</div>${days.map(x => `<div style="border-left:1px solid var(--sb-mint);padding:6px 8px"><div>${esc(C.dayLabel(x.date))}</div><div style="display:grid;grid-template-columns:repeat(${maxN},minmax(0,1fr));font-size:10.5px;font-variant-numeric:tabular-nums;margin-top:2px">${[...Array(maxN).keys()].map(s => `<span>${C.slotTime(r, 0, s)}</span>`).join('')}</div></div>`).join('')}<div style="border-left:1px solid var(--sb-mint)">그 외</div></div>`;
  return `<div class="cs-tools"><button class="cs-btn sm${filt === 'sib' ? ' p' : ''}" data-ff="sib">형제 · 교직원 자녀 가정 ${nSib}</button><button class="cs-btn sm${filt === 'all' ? ' p' : ''}" data-ff="all">모든 가정 ${Object.keys(A.members).length}</button><button class="cs-btn sm${filt === 'warn' ? ' w' : ''}" data-ff="warn">확인 필요 ${nWarn}</button>
    <span class="cs-mut" style="margin-left:6px">한 줄 = 한 가정${editable() ? ' · 색칸을 끌면 형제가 함께 옮겨져요' : ''} · 회색 빗금 = 그 가정 선생님(교직원)이 상담 중인 시간</span></div>
    <div class="cs-board"><div class="cs-scroll"><div style="min-width:${44 + 200 + 140 + days.length * 260 + 120}px">${head}${rows || '<div class="cs-empty">해당하는 가정이 없어요.</div>'}</div></div></div>`;
}

/* ── 옆 칸 ── */
function sideMgrHTML(){
  const r = A.R, ck = A.chk || { issues: [], sum: { n: {} } };
  const s = ck.sum;
  const cnt = code => ck.issues.filter(i => i.code === code).length;
  const sib = ck.issues.filter(i => i.code === 'sibGap' || i.code === 'sibDay');
  const errs = ck.issues.filter(i => i.lvl === 'err');
  const row = (l, v, tone, code) => `<div class="cs-iss${tone === 'w' ? ' warn' : tone === 'e' ? ' err' : ''}"${code ? ` data-iss="${code}"` : ''}><span>${l}</span><b class="${tone === 'w' ? 'w' : tone === 'e' ? 'e' : 'ok'}">${v}</b></div>`;
  let h = `<div class="cs-card"><h3><span>✔ 배치 점검</span></h3>
    ${row('한 가정이 같은 시간에 두 곳', cnt('famClash') ? cnt('famClash') + '곳' : '없음', cnt('famClash') ? 'e' : '', 'famClash')}
    ${row('형제 시간 이어짐', s.famN ? `${s.famOk} / ${s.famN} 가정${sib.length ? ' · ' + sib.length + '곳 확인' : ''}` : '형제 없음', sib.length ? 'w' : '', 'sib')}
    ${sib.slice(0, 3).map(i => `<div class="cs-isl">${esc(i.text)}</div>`).join('')}
    ${row(`교직원 자녀 ${s.kidN || 0}명`, cnt('kid') ? `겹침 ${cnt('kid')}` : (s.kidN ? '선생님 상담과 안 겹침' : '—'), cnt('kid') ? 'e' : '', 'kid')}
    ${row('두 번 연속 맨 앞', s.frontRep || 0, s.frontRep ? 'w' : '', 'front')}
    ${errs.filter(i => ['double', 'off', 'range'].includes(i.code)).length ? row('한 칸 두 명 · 못 하는 시간 · 없는 칸', errs.filter(i => ['double', 'off', 'range'].includes(i.code)).length, 'e', 'err') : ''}
    ${row('대면 · 전화 · 별도', `${s.n.face || 0} · ${s.n.phone || 0} · ${s.n.sep || 0}`, '')}
    ${s.phoneN ? row('☎ 전화 시간', `${s.phoneNoTime ? '미정 ' + s.phoneNoTime : '모두 정함'}${cnt('phone') ? ' · 겹침 ' + cnt('phone') : ''}`, s.phoneNoTime || cnt('phone') ? 'w' : '', 'phone') : ''}
    ${row('대상 학생', `${s.total || 0}명`, '')}
  </div>`;
  // 선택한 가정
  if(A.FAM_SEL && A.members[A.FAM_SEL]){
    const ids = A.members[A.FAM_SEL]; const fs = A.styles[A.FAM_SEL];
    const seats = A.viewSeats();
    h += `<div class="cs-card"><h3><span>👪 선택한 가정</span><button class="cs-btn xs" data-famx>닫기</button></h3>
      <div style="display:flex;align-items:center;gap:8px">${fs ? `<span style="width:14px;height:14px;border-radius:4px;background:${fs.bg}"></span>` : ''}<b>${esc(String(A.stuName(ids[0])).slice(0, 1))} 가정 ${fs ? fs.mark : ''}</b><span class="cs-mut">${ids.length}명</span></div>
      ${ids.map(id => { const st = seats[id]; const c = A.colByKey(A.colOf[id]); return `<div class="cs-fr"><b style="font-variant-numeric:tabular-nums">${st ? (st.k === 'face' ? `${C.dayLabel(C.dayList(r)[st.d].date, true)} ${C.slotTime(r, st.d, st.s)}` : C.KINDS[st.k]) : '자리 없음'}</b><span>${esc(A.stuName(id))} <span class="cs-mut">· ${esc(C.colLabel(c))} ${esc(c ? c.tname || '' : '')}</span></span></div>`; }).join('')}
      ${editable() && ids.length > 1 ? `<div class="cs-mut" style="margin-top:8px">가정 함께 옮기기 (형제 이어서 · 다른 가정은 그대로)</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${C.dayList(r).map((x, d) => `<button class="cs-btn xs" data-fammove="${d}">${esc(C.dayLabel(x.date, true))}로</button>`).join('')}</div>` : ''}</div>`;
  }
  // 넣을 학생
  const seats = r.seats || {};
  const un = A.scope.filter(x => x.in && !seats[x.sid]);
  h += `<div class="cs-card"><h3><span>➕ 넣을 학생</span><span style="font-size:12px;color:${un.length ? '#C2410C' : 'var(--ink-2)'}">${un.length}</span></h3>
    ${un.length ? `<div class="cs-pool" data-pool>${un.map(x => chipHTML(x.sid)).join('')}</div>
      <div class="cs-mut" style="margin-top:8px">끌어서 빈 칸에 놓거나 «추천 자리에 넣기» (형제가 있으면 함께)</div>
      <button class="cs-btn sm m" data-b="fillun" style="margin-top:6px">추천 자리에 넣기</button>` : '<div class="cs-mut">모두 자리가 있어요.</div>'}</div>`;
  // 비움 (빠진 학생)
  const gone = Object.keys(seats).filter(id => !A.inSet.has(id));
  if(gone.length) h += `<div class="cs-card"><h3><span>➖ 빠진 학생</span><span style="font-size:12px;color:var(--ink-2)">${gone.length}</span></h3>
    ${gone.map(id => { const st = seats[id]; const c = A.colByKey(A.colOf[id]); const sc = A.scope.find(x => x.sid === id); return `<div style="font-size:12.5px;line-height:1.6;padding:4px 0;border-top:1px solid var(--line-soft)"><b>${esc(A.stuName(id))}</b> ${esc(c ? c.grades : '')} — ${esc(sc ? (sc.flag || sc.why || '대상에서 뺌') : '반에서 빠짐')}<br><span class="cs-mut">${st.k === 'face' ? `${C.dayLabel(C.dayList(r)[st.d] ? C.dayList(r)[st.d].date : '', true)} ${C.slotTime(r, st.d, st.s)} 칸이 비었어요` : C.KINDS[st.k]}</span> <button class="cs-btn xs" data-vclear="${esc(id)}">자리 지우기</button></div>`; }).join('')}</div>`;
  // 판
  const unsent = r.sentSeats ? C.diffSeats(r.sentSeats, seats).length : 0;
  const acks = A.colTeachers().filter(A.ackOk).length;
  const tN = A.colTeachers().length;
  h += `<div class="cs-card"><h3><span>🗂 판</span><span class="cs-mut">${r.ver ? '판 ' + r.ver : '아직 없음'}</span></h3>
    <div style="font-size:12.5px;line-height:1.7">${r.sentVer ? `보낸 판 <b>${r.sentVer}</b> · 담임 확인 <b>${acks} / ${tN}</b>` : '아직 담임께 보내지 않았어요'}${unsent ? `<br><span style="color:#92400E;font-weight:800">보낸 뒤 고친 학생 ${unsent}명 (아직 안 보냄)</span>` : ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="cs-btn sm" data-b="save">판 저장</button><button class="cs-btn sm" data-b="vers">판 비교</button></div></div>`;
  return h;
}
function sideTeacherHTML(){
  const r = A.R, seats = A.viewSeats();
  const mine = A.myCols();
  let h = '';
  if(['review', 'final'].includes(r.state) && r.sentVer && mine.length){
    const ok = A.ackOk(A.CU.uid);
    h += `<div class="cs-card" style="background:${ok ? 'var(--sb-mint-2)' : '#1E3A2F'};color:${ok ? 'var(--ink)' : '#fff'};border:0"><b style="font-size:14px">${ok ? `✓ 판 ${r.sentVer} 확인했어요` : `판 ${r.sentVer} 확인 부탁드려요`}</b>
      <div style="font-size:12.5px;margin-top:4px;opacity:.9">${r.state === 'final' ? '확정된 일정이에요 · 바꿔야 하면 «변경 요청»' : '우리 반 시간을 보고 «이대로 확인했어요» 또는 이름을 눌러 «변경 요청»'}${(() => { const lp = C.pubsOf(r).slice(-1)[0]; return lp ? `<br>📨 학부모님께 «${esc(lp.label)}» 나감 (${new Date(lp.at || 0).getMonth() + 1}/${new Date(lp.at || 0).getDate()}) — 학부모님 요청은 «변경 요청»으로 (☎ 전화 상담 요청도)` : ''; })()}</div>
      ${ok ? '' : '<button class="cs-btn" data-b="ack" style="margin-top:10px;width:100%;background:#fff;color:#1E3A2F;border:0">이대로 확인했어요</button>'}</div>`;
  }
  if(!mine.length){ h += `<div class="cs-card"><h3>우리 반</h3><div class="cs-mut" style="line-height:1.65">이 상담에 담임 · 부담임으로 맡은 반이 없어요. 전체 표는 볼 수 있어요.<br>«확인»과 «변경 요청»은 그 반 담임 · 부담임 선생님이 해요 — 반이 빠졌으면 편성 담당께 알려 주세요.</div></div>`; return h; }
  // 우리 반 — 날짜마다 묶어서 (시각은 한 줄 · 형제 · 메모는 줄바꿈해서 다 보이게)
  const days = C.dayList(r);
  mine.forEach(k => {
    const c = A.colByKey(k);
    const list = A.scope.filter(x => x.col === k && x.in).map(x => ({ sid: x.sid, st: seats[x.sid] }));
    const grp = {};
    list.forEach(x => { const g = !x.st ? 'none' : x.st.k === 'face' ? 'd' + x.st.d : x.st.k; (grp[g] = grp[g] || []).push(x); });
    const order = days.map((x, d) => 'd' + d).concat(['phone', 'sep', 'none']).filter(g => grp[g]);
    const sibOf = sid => { const ids = A.famIds(sid).filter(o => o !== sid && A.inSet.has(o)); return ids.map(o => { const st = seats[o]; const oc = A.colByKey(A.colOf[o]); const where = !st ? '자리 없음' : st.k === 'face' ? `${C.dayLabel(days[st.d].date, true)} ${C.slotTime(r, st.d, st.s)}` : st.k === 'phone' ? '☎ ' + C.phoneWhen(st) : C.KINDS[st.k]; return `형제 ${A.stuName(o)} (${oc ? oc.grades || oc.name : ''}) · ${where}`; }); };
    const row = ({ sid, st }) => {
      const rq = A.REQS.find(q => (q.sids || []).includes(sid) && q.state === 'new');
      const fs = A.styleOf(sid);
      const tm = !st ? '—' : st.k === 'face' ? C.slotTime(r, st.d, st.s) : st.k === 'phone' ? '☎' : '🗓';
      const sub = [].concat(st && st.k === 'phone' ? ['☎ ' + C.phoneWhen(st)] : [], st && st.k === 'sep' && st.note ? ['🗓 ' + st.note] : [], sibOf(sid), kidOf(sid) ? [A.staffName(kidOf(sid)) + ' 선생님 자녀'] : [], st && st.k !== 'sep' && st.note ? ['📝 ' + st.note] : []);
      return `<div class="cs-me"><span class="t">${esc(tm)}</span><span class="w"><span><b>${esc(A.stuName(sid))}</b>${fs ? ` <span class="mk" style="background:${fs.bg};color:${fs.fg}">${fs.mark}</span>` : ''}</span>${sub.map(t => `<span class="s">${esc(t)}</span>`).join('')}</span>${rq ? '<span class="ch red">요청함</span>' : (['review', 'final'].includes(r.state) ? `<button class="cs-btn xs" data-req="${esc(sid)}">변경 요청</button>` : '<span></span>')}</div>`;
    };
    const gl = g => g[0] === 'd' ? C.dayLabel(days[+g.slice(1)].date) : g === 'phone' ? '☎ 전화 상담' : g === 'sep' ? '🗓 별도 일정' : '자리 없음';
    h += `<div class="cs-card cs-mine"><h3><span>우리 반 · ${esc(C.colLabel(c))}</span><span class="cs-mut">${list.length}명</span></h3><div class="cs-mut" style="margin:-4px 0 6px">${esc(c.tname || '')} · ${roomHTML(c.room) || '교실 미정'}</div>
      <div class="cs-mel">${order.map(g => `<div class="cs-meg"><div class="gh"><b>${esc(gl(g))}</b><span>${grp[g].length}명</span></div>${grp[g].sort((a, b) => (a.st && a.st.k === 'face' ? a.st.s : 99) - (b.st && b.st.k === 'face' ? b.st.s : 99) || C.phoneKey(a.st).localeCompare(C.phoneKey(b.st))).map(row).join('')}</div>`).join('')}</div></div>`;
  });
  return h;
}

/* ═══ 보드 ═══ */
export function boardHTML(a, sub){
  A = a; C = a.C; esc = a.esc;
  const r = A.R;
  if(!A.teacherSees()){
    return `${stepsHTML()}<div class="cs-card cs-empty">편성 담당 선생님이 상담 일정을 만들고 있어요.<br>«담임 확인»으로 보내면 여기에서 우리 반 시간을 보고 확인하거나 변경을 요청할 수 있어요.<br><span class="cs-mut">교직원 자녀가 있으시면 «🧑‍🏫 교직원 자녀»에서 미리 이어 주세요 — 선생님 상담이 끝난 뒤로 잡혀요.</span></div>`;
  }
  if(!C.dayList(r).length || !(r.cols || []).length){
    return `${stepsHTML()}<div class="cs-card cs-empty">상담 날짜나 세로줄(반)이 아직 없어요.${A.isMgr ? '<br><a class="cs-btn g" href="#setup" style="margin-top:10px">⚙️ 준비 · 설정 열기</a>' : ''}</div>`;
  }
  const view = sub && sub.startsWith('day') ? 'day' : (sub === 'fam' ? 'fam' : '');
  const daySub = view === 'day' ? (sub.split('/')[1] || '0') : '';
  const empty = A.isMgr && !Object.keys(r.seats || {}).length;
  const ended = r.state === 'final' && C.dayList(r).length && A.today() > C.dayList(r).slice(-1)[0].date;
  return `${stepsHTML()}${toolsHTML(view)}${legendHTML()}
    ${ended && A.isMgr ? `<div class="cs-card" style="margin-bottom:12px;background:#FFF7E6;border-color:#F3D58A;font-size:13px">상담 날짜가 지났어요 — «상담 끝내기»를 누르면 지난 상담으로 옮겨지고, 다음 학기 순번 점검에 쓰여요.</div>` : ''}
    ${empty ? `<div class="cs-card" style="margin-bottom:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><b>아직 자리가 없어요.</b><span class="cs-mut">대상 ${A.inSet.size}명 · 반 ${(r.cols || []).length}줄 · ${C.dayList(r).length}일 × 하루 ${C.tplOf(r).n}칸</span><span style="flex:1"></span><a class="cs-btn" href="#setup">⚙️ 준비 확인</a><button class="cs-btn g" data-b="auto">↻ 초안 만들기 (자동 배치)</button></div>` : ''}
    <div class="cs-main${A.isMgr ? '' : ' tch'}"><div class="cs-boardw">${view === 'day' ? dayViewHTML(daySub) : view === 'fam' ? famViewHTML() : gridHTML(null, false)}${view === 'fam' ? '' : etcListHTML()}</div>
    ${view === 'fam' ? '' : `<aside class="cs-side">${A.isMgr ? sideMgrHTML() : sideTeacherHTML()}</aside>`}</div>`;
}

/* ═══ 움직이기 ═══ */
async function moveTo(sid, to){
  const r = A.R;
  const cur = (r.seats || {})[sid];
  if(cur && to.k === 'face' && cur.k === 'face' && cur.d === to.d && cur.s === to.s) return;
  if(cur && to.k !== 'face' && to.k !== 'phone' && cur.k === to.k) return;
  let note = null;
  if(to.k === 'phone' && to.pd == null){
    const v = await A.phonePick(sid, cur && cur.k === 'phone' ? cur : { note: (cur && cur.note) || '' }, { ok: cur && cur.k === 'phone' ? '시간 바꾸기' : '전화 상담으로' }); if(!v) return;
    to = Object.assign({}, to, { pd: v.pd, pt: v.pt }); note = v.note;
  }
  if(to.k === 'sep'){ note = await A.prompt('🗓 별도 일정', `${esc(A.stuName(sid))} — 날짜 · 시간`, (cur && cur.note) || '', { ph: '예: 11/12(목) 16:00 · 담임과 따로', ok: '별도 일정으로' }); if(note == null) return; }
  const patch = C.movePatch(r, A.colOf, sid, Object.assign({}, to, note != null ? { note } : {}));
  const other = Object.keys(patch).find(k => k !== sid);
  try{ await A.applySeats(patch, other ? `${A.stuName(sid)} ↔ ${A.stuName(other)} 서로 바꿨어요` : (to.k === 'face' ? `${A.stuName(sid)} 옮겼어요` : `${A.stuName(sid)} → ${C.KINDS[to.k]}${to.k === 'phone' ? ' · ' + C.phoneWhen(patch[sid]) : ''}`)); }
  catch(e){ A.toast('옮기지 못했어요 — ' + A.errText(e), 'err'); return; }
  // 옮긴 뒤 새로 생긴 문제 알려 주기
  const iss = ((A.chk && A.chk.issues) || []).filter(i => i.lvl !== 'info' && i.code !== 'unplaced' && i.sids.includes(sid));
  if(iss.length) setTimeout(() => A.toast('확인: ' + iss[0].text, 'err', { l: '↩ 되돌리기', f: () => A.undo() }), 50);
}
async function moveFamily(ids, d, startS){
  const r = A.R, seats = r.seats || {};
  const face = ids.filter(id => seats[id] && seats[id].k === 'face');
  let plan;
  if(startS == null){
    plan = C.findSpot(r, A.colOf, ids, [{ d }]);
    if(!plan){ A.toast(`${C.dayLabel(C.dayList(r)[d].date, true)}에는 형제가 함께 들어갈 자리가 없어요`, 'err'); return; }
  } else {
    // 끈 칸 기준으로 형제 사이 간격 그대로
    const anchor = A.MOVE_ANCHOR || face[0];
    const a = seats[anchor];
    plan = (face.length ? face : ids).map(id => { const st = seats[id]; const off = st && a && st.k === 'face' && st.d === a.d ? st.s - a.s : 0; return [id, d, startS + off]; });
    const busy = {}; Object.entries(seats).forEach(([o, st]) => { if(st && st.k === 'face' && !ids.includes(o)) busy[`${A.colOf[o]}|${st.d}|${st.s}`] = o; });
    const offS = new Set(); (r.cols || []).forEach(c => (c.off || []).forEach(o => offS.add(`${c.key}|${o.replace('_', '|')}`)));
    for(const [id, dd, ss] of plan){
      if(ss < 0 || ss >= C.dayN(r, dd)){ A.toast('그 날 칸 밖이에요 — 앞쪽 칸으로 끌어 주세요', 'err'); return; }
      const k = `${A.colOf[id]}|${dd}|${ss}`;
      if(busy[k]){ A.toast(`${A.stuName(id)} — 그 시간 ${(A.colByKey(A.colOf[id]) || {}).tname || ''} 칸에 ${A.stuName(busy[k])}이(가) 있어요`, 'err'); return; }
      if(offS.has(k)){ A.toast(`${A.stuName(id)} — 선생님이 못 하는 시간이에요`, 'err'); return; }
    }
  }
  const patch = {}; plan.forEach(([id, dd, ss]) => { patch[id] = Object.assign({}, seats[id] || {}, { k: 'face', d: dd, s: ss }); });
  try{ await A.applySeats(patch, `${String(A.stuName(ids[0])).slice(0, 1)} 가정 ${plan.length}명을 옮겼어요`); }catch(e){ A.toast('옮기지 못했어요 — ' + A.errText(e), 'err'); }
}
export function cancelMove(a){ A = a; A.MOVE = null; document.querySelectorAll('.cs-movebar').forEach(x => x.remove()); A.render(true); }
function startMove(sid){
  A.MOVE = { sid };
  A.render(true);
  document.querySelectorAll('.cs-movebar').forEach(x => x.remove());
  const bar = document.createElement('div'); bar.className = 'cs-movebar';
  bar.innerHTML = `<span>✋ ${esc(A.stuName(sid))} — 같은 반 줄에서 옮길 칸을 누르세요</span><button>취소 (Esc)</button>`;
  bar.querySelector('button').onclick = () => cancelMove(A);
  document.body.appendChild(bar);
  markCan(sid);
}
function markCan(sid){
  const col = A.colOf[sid];
  document.querySelectorAll('.cs-cell[data-col]').forEach(c => { if(c.dataset.col === col && !c.classList.contains('off')) c.classList.add('can'); });
}
function clearMarks(){ document.querySelectorAll('.cs-cell.can,.cs-cell.over,.cs-fam .sl.over').forEach(c => c.classList.remove('can', 'over')); }
const targetOf = cell => cell.dataset.k ? { k: cell.dataset.k } : { k: 'face', d: +cell.dataset.d, s: +cell.dataset.s };

/* 대상 학생 하나 고르기 (이름 찾기) */
function pickScope(title, filt){
  return new Promise(res => {
    const seats = A.R.seats || {};
    const all = A.scope.filter(x => x.in && (!filt || filt(x))).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    const pos = st => !st ? '자리 없음' : st.k !== 'face' ? C.KINDS[st.k] : `${C.dayLabel(C.dayList(A.R)[st.d].date, true)} ${C.slotTime(A.R, st.d, st.s)}`;
    const m = A.modal(esc(title), `<input class="cs-in" data-q placeholder="이름 찾기" style="width:100%;margin-bottom:10px"><div data-l style="max-height:52vh;overflow:auto"></div>`, '<button class="cs-btn" data-n>취소</button>', 'sm');
    const draw = () => { const q = m.box.querySelector('[data-q]').value.trim(); const l = all.filter(x => !q || String(x.name || '').includes(q)).slice(0, 80);
      m.box.querySelector('[data-l]').innerHTML = l.map(x => `<button class="cs-iss" data-p="${esc(x.sid)}" style="width:100%;border:0;background:transparent;font-family:inherit;text-align:left;margin:0"><span><b>${esc(x.name || '')}</b> <span class="cs-mut">${esc(C.colLabel(A.colByKey(x.col)))}</span></span><span class="cs-mut">${esc(pos(seats[x.sid]))}</span></button>`).join('') || '<div class="cs-mut">찾는 학생이 없어요.</div>'; };
    let done = false;
    m.onClose = () => { if(!done) res(null); };
    m.box.querySelector('[data-q]').addEventListener('input', draw);
    m.box.querySelector('[data-l]').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if(!b) return; done = true; m.close(); res(b.dataset.p); });
    m.box.querySelector('[data-n]').onclick = () => m.close();
    draw(); setTimeout(() => m.box.querySelector('[data-q]').focus(), 30);
  });
}
/* 이름 누르기 — 메뉴 */
function chipMenu(btn, sid){
  const r = A.R, seats = r.seats || {}, st = seats[sid];
  const c = A.colByKey(A.colOf[sid]);
  const fam = A.famIds(sid);
  const head = `${esc(A.stuName(sid))} · ${esc(C.colLabel(c))}${fam.length > 1 ? ` · 형제 ${fam.length}` : ''}${kidOf(sid) ? ' · ' + esc(A.staffName(kidOf(sid))) + ' 자녀' : ''}`;
  if(!editable()){
    const items = [];
    if(fam.length > 1) items.push({ l: '👪 가정 시간 보기', f: () => { A.FAM_SEL = A.famOf(sid); A.render(true); } });
    if(A.myCols().includes(A.colOf[sid]) && ['review', 'final'].includes(r.state)) items.push({ l: '💬 변경 요청', f: () => A.REQ_NEW && A.REQ_NEW(sid) });
    if(!items.length) items.push({ l: '닫기', f: () => {} });
    A.popMenu(btn, items, head); return;
  }
  const items = [
    { l: '✋ 옮기기 (칸 누르기)', f: () => startMove(sid) },
    fam.length > 1 ? { l: '👪 가정 보기 · 함께 옮기기', f: () => { A.FAM_SEL = A.famOf(sid); A.render(true); } } : null,
    st ? { l: st.pin ? '📌 고정 풀기' : '📌 고정 (자동 배치가 안 건드림)', f: () => A.applySeats({ [sid]: Object.assign({}, st, { pin: !st.pin }) }, st.pin ? '고정을 풀었어요' : '고정했어요') } : null,
    { l: '📝 메모', f: async () => { const v = await A.prompt('📝 메모', `${esc(A.stuName(sid))} — 학부모 사정 · 오시는 분 등 (선생님들께 보여요)`, (st && st.note) || '', { ph: '예: 4시 이후 가능 · 아버님 오심' }); if(v == null) return; const base = st || null; if(!base){ A.toast('자리를 먼저 잡아 주세요', 'err'); return; } A.applySeats({ [sid]: Object.assign({}, base, { note: v.trim() }) }, '메모를 남겼어요'); } },
    { l: st && st.k === 'phone' ? '☎ 전화 시간 바꾸기…' : '☎ 전화 상담으로…', f: () => moveTo(sid, { k: 'phone' }) },
    !st || st.k !== 'sep' ? { l: '🗓 별도 일정으로…', f: () => moveTo(sid, { k: 'sep' }) } : null,
    { l: '🔎 추천 자리로 (형제 함께)', f: async () => { const ids = A.famIds(sid).filter(id => A.inSet.has(id)); const plan = C.findSpot(r, A.colOf, ids, []); if(!plan){ A.toast('들어갈 빈 자리가 없어요', 'err'); return; } const p = {}; plan.forEach(([id, d, s]) => { p[id] = Object.assign({}, seats[id] || {}, { k: 'face', d, s }); }); A.applySeats(p, '추천 자리로 옮겼어요'); } },
    st ? { l: '↩ 자리 빼기 (넣을 학생으로)', f: () => A.applySeats({ [sid]: null }, `${A.stuName(sid)} 자리를 뺐어요`) } : null,
  ];
  A.popMenu(btn, items, head);
}

/* ═══ 그린 뒤 — 누르기 · 끌기 ═══ */
export function after(a){
  A = a; C = a.C; esc = a.esc;
  const root = document.getElementById('cs');
  if(!root || !A.R) return;
  if(A.MOVE) markCan(A.MOVE.sid);
  root.onclick = async e => {
    const t = e.target;
    if(A.justDropped) return;
    const v = t.closest('[data-view]'); if(v){ A.go('board' + (v.dataset.view ? '/' + v.dataset.view : '')); return; }
    const dy = t.closest('[data-day]'); if(dy){ A.go('board/day/' + dy.dataset.day); return; }
    const ff = t.closest('[data-ff]'); if(ff){ A.lsSet('cs_ff', ff.dataset.ff); A.render(true); return; }
    const fx = t.closest('[data-famx]'); if(fx){ A.FAM_SEL = null; A.render(true); return; }
    const fm = t.closest('[data-fammove]'); if(fm && A.FAM_SEL){ moveFamily(A.members[A.FAM_SEL].filter(id => A.inSet.has(id)), +fm.dataset.fammove, null); return; }
    const vc = t.closest('[data-vclear]'); if(vc){ const id = vc.dataset.vclear; if(await A.confirm('자리 지우기', `${esc(A.stuName(id))}의 자리를 지울까요?<br><span class="cs-mut">대상에서 빠진 학생이에요. 그 칸은 빈 칸이 돼요.</span>`, '지우기')) A.applySeats({ [id]: null }, '자리를 지웠어요'); return; }
    const iss = t.closest('[data-iss]'); if(iss){ const code = iss.dataset.iss; const list = ((A.chk && A.chk.issues) || []).filter(i => code === 'sib' ? /sib/.test(i.code) : code === 'err' ? i.lvl === 'err' : i.code === code); A.HL = C.uniq(list.flatMap(i => i.sids)); A.render(true); if(A.HL.length){ const el = document.querySelector('.cs-chip.hl'); if(el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { A.HL = []; }, 100); } return; }
    const rq = t.closest('[data-req]'); if(rq){ A.REQ_NEW && A.REQ_NEW(rq.dataset.req); return; }
    const ph = t.closest('[data-ph]'); if(ph){ moveTo(ph.dataset.ph, { k: 'phone' }); return; }
    const spn = t.closest('[data-spn]'); if(spn){ const sid = spn.dataset.spn; const cur = (A.R.seats || {})[sid] || {}; const v = await A.prompt('🗓 별도 일정', `${esc(A.stuName(sid))} — 날짜 · 시간`, cur.note || '', { ph: '예: 11/12(목) 16:00 · 담임과 따로', ok: '고치기' }); if(v == null) return; A.applySeats({ [sid]: Object.assign({}, cur, { note: v.trim() }) }, '별도 일정을 고쳤어요'); return; }
    const tf = t.closest('[data-toface]'); if(tf){ const sid = tf.dataset.toface; const plan = C.findSpot(A.R, A.colOf, [sid], []); if(!plan){ A.toast('표에 빈 자리가 없어요 — 칸을 늘리거나 다른 학생과 바꿔 주세요', 'err'); return; } const [[, d, s2]] = plan; const cur = (A.R.seats || {})[sid] || {}; const p = Object.assign({}, cur, { k: 'face', d, s: s2 }); delete p.pd; delete p.pt; A.applySeats({ [sid]: p }, `${A.stuName(sid)} → 표 ${C.dayLabel(C.dayList(A.R)[d].date, true)} ${C.slotTime(A.R, d, s2)} (대면)`); return; }
    if(t.closest('[data-phadd]')){ const sid = await pickScope('☎ 전화 상담 넣기', x => !((A.R.seats || {})[x.sid] && A.R.seats[x.sid].k === 'phone')); if(sid) moveTo(sid, { k: 'phone' }); return; }
    const b = t.closest('[data-b]'); if(b){ act(b.dataset.b); return; }
    // 옮기기 모드 — 칸 누르기
    if(A.MOVE){
      const cell = t.closest('.cs-cell[data-col]');
      if(cell && cell.classList.contains('can')){ const sid = A.MOVE.sid; A.MOVE = null; document.querySelectorAll('.cs-movebar').forEach(x => x.remove()); await moveTo(sid, targetOf(cell)); return; }
      if(cell){ A.toast('같은 반 줄의 칸을 눌러 주세요 (Esc 취소)', 'err'); return; }
    }
    const chip = t.closest('.cs-chip[data-sid]'); if(chip){ chipMenu(chip, chip.dataset.sid); return; }
    const blk = t.closest('[data-fblk]'); if(blk){ chipMenu(blk, blk.dataset.fblk); return; }
  };
  root.onchange = e => { if(e.target.matches('[data-mine]')){ A.lsSet('cs_mine', e.target.checked ? '1' : ''); A.render(true); } };
  if(!editable()) return;
  // 끌기 (컴퓨터)
  root.ondragstart = e => {
    const chip = e.target.closest('.cs-chip[data-sid]');
    const blk = e.target.closest('[data-fblk]');
    if(chip){ A.DRAG = { sid: chip.dataset.sid }; e.dataTransfer.setData('text/plain', chip.dataset.sid); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => markCan(chip.dataset.sid), 0); return; }
    if(blk){ const sid = blk.dataset.fblk; A.DRAG = { fam: A.famOf(sid), sid }; A.MOVE_ANCHOR = sid; e.dataTransfer.setData('text/plain', sid); e.dataTransfer.effectAllowed = 'move'; }
  };
  root.ondragover = e => {
    if(!A.DRAG) return;
    if(A.DRAG.fam){ const sl = e.target.closest('.cs-fam .sl[data-fd]'); if(sl && sl.dataset.fk === A.DRAG.fam){ e.preventDefault(); document.querySelectorAll('.cs-fam .sl.over').forEach(x => x !== sl && x.classList.remove('over')); sl.classList.add('over'); } return; }
    const cell = e.target.closest('.cs-cell[data-col]');
    if(cell && cell.dataset.col === A.colOf[A.DRAG.sid] && !cell.classList.contains('off')){ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.cs-cell.over').forEach(x => x !== cell && x.classList.remove('over')); cell.classList.add('over'); }
  };
  root.ondragleave = e => { const cell = e.target.closest('.cs-cell.over,.sl.over'); if(cell && !cell.contains(e.relatedTarget)) cell.classList.remove('over'); };
  root.ondrop = async e => {
    if(!A.DRAG) return;
    e.preventDefault();
    const d = A.DRAG; A.DRAG = null; clearMarks(); A.justDropped = true; setTimeout(() => { A.justDropped = false; }, 350);
    if(d.fam){ const sl = e.target.closest('.cs-fam .sl[data-fd]'); if(sl) await moveFamily(A.members[d.fam].filter(id => A.inSet.has(id)), +sl.dataset.fd, +sl.dataset.fs); A.MOVE_ANCHOR = null; return; }
    const cell = e.target.closest('.cs-cell[data-col]');
    if(cell && cell.dataset.col === A.colOf[d.sid]) await moveTo(d.sid, targetOf(cell));
  };
  root.ondragend = () => { const had = A.DRAG; A.DRAG = null; clearMarks(); if(had) A.render(true); };
}

/* ═══ 단추 ═══ */
async function act(k){
  const r = A.R;
  if(k === 'order'){ A.go('setup'); setTimeout(() => { const el = document.getElementById('cs-s6'); if(el) el.scrollIntoView({ behavior: 'smooth' }); }, 80); return; }
  if(k === 'print'){ const P = await import('./consult-past.js?v=151'); P.printRound(A, r, A.viewSeats()); return; }
  if(k === 'vers'){ versModal(); return; }
  if(k === 'ack'){
    try{ await A.FS.updateDoc(A.roundRef(), { ['acks.' + A.CU.uid]: r.sentVer }); r.acks = Object.assign({}, r.acks, { [A.CU.uid]: r.sentVer }); A.toast('확인했어요 — 고맙습니다'); A.render(true); }
    catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); }
    return;
  }
  if(!A.isMgr) return;
  if(k === 'auto') return autoRun();
  if(k === 'save') return saveVer(false);
  if(k === 'send') return send();
  if(k === 'pub') return publish();
  if(k === 'final') return finalize();
  if(k === 'close') return closeRound();
  if(k === 'reopen'){ if(await A.confirm('다시 열기', '끝난 상담을 «확정» 상태로 다시 열까요?', '다시 열기')) await A.saveRound({ state: 'final' }); return; }
  if(k === 'fillun'){
    const seats = r.seats || {};
    const un = A.scope.filter(x => x.in && !seats[x.sid]).map(x => x.sid);
    const done = new Set(); const patch = {}; const work = Object.assign({}, r, { seats: Object.assign({}, seats) });
    let miss = 0;
    un.forEach(sid => {
      if(done.has(sid)) return;
      const ids = A.famIds(sid).filter(id => A.inSet.has(id) && !work.seats[id]);
      const plan = C.findSpot(work, A.colOf, ids, []);
      if(!plan){ miss += ids.length; ids.forEach(id => done.add(id)); return; }
      plan.forEach(([id, d, s]) => { patch[id] = { k: 'face', d, s }; work.seats[id] = patch[id]; done.add(id); });
    });
    if(!Object.keys(patch).length){ A.toast('들어갈 빈 자리가 없어요 — 날짜나 하루 칸 수를 늘려 주세요', 'err'); return; }
    await A.applySeats(patch, `${Object.keys(patch).length}명을 추천 자리에 넣었어요${miss ? ` · ${miss}명은 자리 없음` : ''}`);
  }
}
export async function runAuto(a){ A = a; C = a.C; esc = a.esc; return autoRun(); }
async function autoRun(){
  const r = A.R;
  const has = Object.keys(r.seats || {}).length;
  const lp = C.pubsOf(r).slice(-1)[0];
  const warn = lp ? `<br><b style="color:#B42318">학부모님께 «${esc(lp.label)}»이 이미 나갔어요</b> — 다시 배치하면 고정하지 않은 가정의 시간이 대부분 바뀌어요.<br>변경 요청은 «💬 변경 요청 › 요청 모아 반영»으로 그 가정만 옮기는 걸 추천해요.` : (r.sentVer ? '<br><b style="color:#C2410C">담임 선생님들께 이미 보낸 표예요</b> — 다시 배치하면 많은 자리가 바뀌어요. 변경 요청은 «요청 모아 반영»을 추천해요.' : '');
  if(has && !(await A.confirm('↻ 자동 배치 다시', `지금 자리를 지우고 처음부터 다시 배치할까요?${warn}<br><span class="cs-mut">📌 고정한 자리(처리한 변경 요청 포함) · 전화 상담 · 별도 일정은 그대로 둬요. 되돌리기는 «판 비교»에서 지난 판으로.</span>`, '다시 배치', !!(lp || r.sentVer)))) return;
  window.showLoading && showLoading('자리를 잡는 중…');
  try{
    if(has) await saveVer(true, '자동 배치 전');
    const out = C.autoPlace({ r, scope: A.scope, studentsById: A.STU, kids: A.KIDS, rounds: A.prevRounds(), prevDir: A.prevDir() });
    const p = { seats: out.seats, dir: out.dir, opt: C.optOf(r), stu: C.stuSnap(A.scope, A.members, A.KIDS) };
    if(r.state === 'prep') p.state = 'draft';
    await A.saveRound(p);
    window.hideLoading && hideLoading();
    const ck = A.chk;
    A.modal('↻ 자동 배치 끝', `<div style="font-size:13.5px;line-height:1.8">
      · 자리 <b>${Object.keys(out.seats).length}명</b>${out.unplaced.length ? ` · <span style="color:#C2410C">자리 없음 ${out.unplaced.length}명</span> (날짜 · 하루 칸 수를 늘리거나 손으로)` : ''}<br>
      · 순서 <b>${out.dir === 'desc' ? 'ㅎ→ㄱ' : 'ㄱ→ㅎ'}</b> · 형제 이어짐 ${ck.sum.famOk} / ${ck.sum.famN} 가정 · 교직원 자녀 ${ck.sum.kidN}명<br>
      ${out.notes.length ? '· ' + out.notes.slice(0, 8).map(esc).join('<br>· ') : ''}</div>
      <div class="cs-desc" style="margin-top:10px">이제 표에서 이름을 끌어 가정 사정에 맞게 고치고, «담임 확인 보내기»로 선생님들께 보내요.</div>`,
      '<button class="cs-btn p" data-x2>확인</button>', 'sm').box.querySelector('[data-x2]').onclick = () => document.querySelector('.mm-ov').remove();
  }catch(e){ window.hideLoading && hideLoading(); A.toast('배치하지 못했어요 — ' + A.errText(e), 'err'); console.error(e); }
}
/* 판 저장 — vers/{n} 에 자리 사진 */
async function saveVer(quiet, note){
  const r = A.R;
  const n = (Number(r.ver) || 0) + 1;
  const bt = A.FS.writeBatch(A.db);
  bt.set(A.FS.doc(A.db, 'consultRounds', r.id, 'vers', String(n)), { n, seats: r.seats || {}, days: r.days || [], tpl: C.tplOf(r), note: note || '', at: A.FS.serverTimestamp(), by: A.CU.uid, byName: A.CU.name || '' });
  bt.update(A.roundRef(), { ver: n, updatedAt: A.FS.serverTimestamp(), updatedBy: A.CU.uid });
  await bt.commit();
  r.ver = n;
  if(!quiet){ A.toast(`판 ${n}을(를) 저장했어요`); A.render(true); }
  return n;
}
/* 담임 확인 보내기 · 고친 것 보내기 */
async function send(){
  const r = A.R;
  const errs = ((A.chk && A.chk.issues) || []).filter(i => i.lvl === 'err');
  const un = A.chk ? A.chk.sum.unplaced : 0;
  const first = !r.sentVer;
  const msg = `${first ? '담임 · 부담임 선생님들께 지금 표를 보내요 (판으로 저장).<br>선생님들은 우리 반 시간을 보고 «확인» 또는 «변경 요청»을 해요.' : `고친 ${C.diffSeats(r.sentSeats || {}, r.seats || {}).length}명을 선생님들께 다시 보내요.`}
    ${errs.length ? `<br><b style="color:#B42318">오류 ${errs.length}건</b>이 남아 있어요 (${esc(errs[0].text)} …)` : ''}${un ? `<br><b style="color:#C2410C">자리 없는 학생 ${un}명</b>` : ''}`;
  if(!(await A.confirm(first ? '담임 확인 보내기' : '고친 것 보내기', msg, '보내기'))) return;
  try{
    const n = await saveVer(true, first ? '담임 확인' : '고친 것 보내기');
    const p = { sentSeats: r.seats || {}, sentVer: n, sentAt: A.FS.serverTimestamp(), stu: C.stuSnap(A.scope, A.members, A.KIDS), colVer: A.colVerPatch(n, r.sentSeats || null, r.seats || {}) };
    if(r.state === 'prep' || r.state === 'draft') p.state = 'review';
    await A.saveRound(p);
    const to = A.colTeachers();
    A.notify(A.colNotifyUids(), 'sent', first ? '📅 학부모 상담 일정 확인 부탁' : '📅 학부모 상담 일정이 바뀌었어요', `${r.title} — 판 ${n}${first ? ' · 우리 반 시간을 확인해 주세요' : ' · 바뀐 시간을 확인해 주세요'}`, 'consult.html#board');
    A.toast(`판 ${n}을(를) 선생님 ${to.length}분께 보냈어요`);
  }catch(e){ A.toast('보내지 못했어요 — ' + A.errText(e), 'err'); }
}
/* 📨 학부모께 보내기 — 초안 → 수정 1 → 수정 2 … (판으로 기록 · 인쇄 · PDF 창 · 담임 알림) */
async function verSeats(ver){
  if(!ver) return null;
  try{ const d = await A.FS.getDoc(A.FS.doc(A.db, 'consultRounds', A.R.id, 'vers', String(ver))); return d.exists() ? (d.data().seats || {}) : null; }catch(e){ return null; }
}
async function publish(){
  const r = A.R;
  const label = C.nextPubLabel(r);
  const pubs = C.pubsOf(r).filter(p => p.label !== '확정');
  const last = pubs[pubs.length - 1];
  const unsent = r.sentSeats ? C.diffSeats(r.sentSeats, r.seats || {}).length : Object.keys(r.seats || {}).length;
  let nCh = 0;
  if(last){ const ps = await verSeats(last.ver); nCh = ps ? C.diffSeats(ps, r.seats || {}).length : 0; if(ps && !nCh){ A.toast(`«${last.label}»와 같아요 — 바뀐 자리가 없어요`, 'err'); return; } }
  const errs = ((A.chk && A.chk.issues) || []).filter(i => i.lvl === 'err');
  const nReq = A.REQS.filter(q => ['new', 'answered'].includes(q.state)).length;
  const msg = `지금 표를 <b>«${esc(label)}»</b>${C.ro(label)} 기록하고 인쇄 · PDF 창을 열어요 — 가정통신문 · 문자로 학부모님께 나눠 주세요.
    ${last ? `<br>· «${esc(last.label)}»에서 바뀐 학생 <b>${nCh}명</b> — 인쇄본에 ★로 표시돼요` : ''}${unsent ? `<br>· 아직 보내지 않은 변경 ${unsent}명은 담임 선생님들께도 함께 보내요` : ''}
    ${nReq ? `<br>· <b style="color:#C2410C">처리 안 한 변경 요청 ${nReq}건</b>` : ''}${errs.length ? `<br>· <b style="color:#B42318">오류 ${errs.length}건</b> (${esc(errs[0].text)} …)` : ''}
    <br><span class="cs-mut">학부모 변경 요청은 담임 선생님이 «변경 요청»으로 모아 주시고 → «요청 모아 반영» → 다시 «학부모께 ${esc(C.pubLabel(pubs.length + 1))} 보내기». 학부모 사이트 공개는 다음 버전에서 더해요 (그때부터 이 판이 학부모 화면에 떠요).</span>`;
  if(!(await A.confirm(`📨 학부모께 «${label}» 보내기`, msg, `${label}${C.ro(label)} 보내기`))) return;
  try{
    let n = r.sentVer;
    const p = {};
    if(unsent || !n){
      n = await saveVer(true, label + ' · 학부모 안내');
      Object.assign(p, { sentSeats: r.seats || {}, sentVer: n, sentAt: A.FS.serverTimestamp(), stu: C.stuSnap(A.scope, A.members, A.KIDS), colVer: A.colVerPatch(n, r.sentSeats || null, r.seats || {}) });
    }
    p.pubs = (r.pubs || []).concat([{ n: pubs.length, label, ver: n, at: Date.now(), by: A.CU.uid, byName: A.CU.name || '' }]);
    await A.saveRound(p);
    A.notify(A.colNotifyUids(), 'pub', `📨 학부모 상담 일정 «${label}» — 학부모님께 나가요`, `${r.title} — ${label} (판 ${n}) · 학부모님 변경 요청은 «변경 요청»으로 보내 주세요`, 'consult.html#board');
    A.toast(`«${label}»${C.ro(label)} 기록했어요 — 인쇄 · PDF로 나눠 주세요`);
    const P = await import('./consult-past.js?v=151'); await P.printRound(A, A.R, A.R.seats || {}, 'p' + pubs.length);
  }catch(e){ A.toast('보내지 못했어요 — ' + A.errText(e), 'err'); console.error(e); }
}
async function finalize(){
  const r = A.R;
  const unsent = r.sentSeats ? C.diffSeats(r.sentSeats, r.seats).length : 0;
  const nReq = A.REQS.filter(q => q.state === 'new').length;
  const acks = A.colTeachers().filter(A.ackOk).length;
  if(!(await A.confirm('확정하기', `이 판으로 상담 일정을 확정할까요?<br>· 담임 확인 ${acks} / ${A.colTeachers().length}${nReq ? `<br>· <b style="color:#C2410C">처리 안 한 변경 요청 ${nReq}건</b>` : ''}${unsent ? `<br>· 보내지 않은 변경 ${unsent}명도 함께 확정돼요` : ''}<br><span class="cs-mut">확정 뒤에도 고칠 수 있고, 고치면 «고친 것 보내기»로 바뀐 반에 알려요. 학부모 사이트 공개는 다음 버전에서 더해요.</span>`, '확정하기'))) return;
  try{
    let n = r.sentVer;
    if(unsent || !n) n = await saveVer(true, '확정');
    const pubs = C.pubsOf(r);
    await A.saveRound({ state: 'final', colVer: (unsent || !r.sentVer) ? A.colVerPatch(n, r.sentSeats || null, r.seats || {}) : (r.colVer || {}), sentSeats: r.seats || {}, sentVer: n, pubVer: n, pubAt: A.FS.serverTimestamp(), stu: C.stuSnap(A.scope, A.members, A.KIDS),
      pubs: (r.pubs || []).concat([{ n: pubs.length, label: '확정', ver: n, at: Date.now(), by: A.CU.uid, byName: A.CU.name || '' }]) });
    A.notify(C.uniq(A.colNotifyUids().concat(A.mgrUids())), 'final', '📌 학부모 상담 일정 확정', `${r.title} — 판 ${n}으로 확정됐어요`, 'consult.html#board');
    A.toast('확정했어요 — «🖨 인쇄 · PDF»에서 «확정»판을 뽑아 나눠 주세요');
  }catch(e){ A.toast('확정하지 못했어요 — ' + A.errText(e), 'err'); }
}
async function closeRound(){
  const r = A.R;
  if(!(await A.confirm('상담 끝내기', '상담을 끝내고 «지난 상담»으로 옮길까요?<br><span class="cs-mut">끝난 상담은 보기만 할 수 있고, 가정마다 자리(앞 · 가운데 · 뒤)가 다음 학기 순번 점검에 쓰여요.</span>', '끝내기'))) return;
  try{
    const seats = r.sentSeats || r.seats || {};
    await A.saveRound({ state: 'closed', closedAt: A.FS.serverTimestamp(), hist: C.histOf(Object.assign({}, r, { seats })), stu: C.stuSnap(A.scope, A.members, A.KIDS) });
    A.toast('상담을 끝냈어요 — 지난 상담에서 볼 수 있어요');
  }catch(e){ A.toast('끝내지 못했어요 — ' + A.errText(e), 'err'); }
}
/* 판 비교 */
async function versModal(){
  const r = A.R;
  let vers = [];
  try{ const s = await A.FS.getDocs(A.FS.collection(A.db, 'consultRounds', r.id, 'vers')); s.forEach(d => vers.push(Object.assign({ id: d.id }, d.data()))); }catch(e){}
  vers.sort((a, b) => (b.n || 0) - (a.n || 0));
  const m = A.modal('🗂 판 비교', `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><span class="cs-mut">지금 표와 비교할 판</span>
      <select class="cs-sel" data-v>${vers.map(v => `<option value="${esc(v.id)}">판 ${v.n}${v.note ? ' · ' + esc(v.note) : ''}${v.byName ? ' · ' + esc(v.byName) : ''}</option>`).join('') || '<option value="">저장한 판이 없어요</option>'}</select></div><div data-out></div>`,
    A.isMgr && r.state !== 'closed' ? '<button class="cs-btn r" data-back>이 판으로 되돌리기</button><button class="cs-btn" data-x2>닫기</button>' : '<button class="cs-btn" data-x2>닫기</button>', 'mid');
  const draw = () => {
    const v = vers.find(x => x.id === m.box.querySelector('[data-v]').value);
    const out = m.box.querySelector('[data-out]');
    if(!v){ out.innerHTML = '<div class="cs-empty">저장한 판이 없어요.</div>'; return; }
    const cur = A.isMgr ? (r.seats || {}) : A.viewSeats();
    const ch = C.diffSeats(v.seats || {}, cur);
    const pos = st => !st ? '자리 없음' : st.k !== 'face' ? C.KINDS[st.k] : `${C.dayLabel((C.dayList(r)[st.d] || {}).date, true)} ${C.slotTime(r, st.d, st.s)}`;
    out.innerHTML = ch.length ? `<div class="cs-mut" style="margin-bottom:6px">바뀐 학생 ${ch.length}명</div>` + ch.map(id => `<div class="cs-fr" style="grid-template-columns:110px 1fr 1fr"><b>${esc(A.stuName(id))}</b><span>판 ${v.n}: ${esc(pos((v.seats || {})[id]))}</span><span>지금: <b>${esc(pos(cur[id]))}</b></span></div>`).join('') : '<div class="cs-empty">지금 표와 같아요.</div>';
  };
  m.box.querySelector('[data-v]').onchange = draw; draw();
  m.box.querySelector('[data-x2]').onclick = () => m.close();
  const bk = m.box.querySelector('[data-back]');
  if(bk) bk.onclick = async () => {
    const v = vers.find(x => x.id === m.box.querySelector('[data-v]').value); if(!v) return;
    if(!(await A.confirm('되돌리기', `지금 표를 판 ${v.n}의 자리로 바꿀까요? (지금 표는 먼저 판으로 저장해요)`, '되돌리기'))) return;
    m.close();
    try{ await saveVer(true, `판 ${v.n}으로 되돌리기 전`); await A.saveRound({ seats: v.seats || {} }); A.toast(`판 ${v.n}의 자리로 되돌렸어요`); }catch(e){ A.toast('되돌리지 못했어요 — ' + A.errText(e), 'err'); }
  };
}
