/* ═══ 📅 consult-setup.js — 준비 · 설정 (v149 · 편성 담당) ═══
   ① 기간 · 시간 칸 (학사일정에서 가져오기 · 틀 바꾸기)  ② 상담 교사 · 교실 (반편성 담임)
   ③ 대상 학생 (휴학 · 복학 · 휴학 예정 → 넣기 / 빼기)  ④ 형제 가정  ⑤ 교직원 자녀  ⑥ 순서 · 채우기
   + 새 상담 만들기 */
let A = null, C = null, esc = null;
const SEC = (n, title, small, body, id) => `<section class="cs-sec" id="${id || 'cs-s' + n}"><h2><span class="no">${n}</span>${title}${small ? ` <small>${small}</small>` : ''}</h2>${body}</section>`;

function jumpHTML(){
  const r = A.R; const sc = A.scope;
  const flags = sc.filter(x => x.flag).length;
  const fams = Object.values(A.members).filter(m => m.length > 1).length;
  const kids = sc.filter(x => x.in && A.KIDS[x.sid]).length;
  const opt = C.optOf(r);
  const items = [
    [1, '기간 · 시간', `${C.dayList(r).length}일 · 하루 ${C.tplOf(r).n}칸`], [2, '상담 교사', `${(r.cols || []).length}줄`],
    [3, '대상 학생', `${sc.filter(x => x.in).length}명${flags ? ` · 확인 ${flags}` : ''}`, flags], [4, '형제 가정', `${fams}가정`],
    [5, '교직원 자녀', `${kids}명`], [6, '순서', { flip: '지난번과 반대', asc: 'ㄱ→ㅎ', desc: 'ㅎ→ㄱ', fair: '지난 자리로' }[opt.order]],
  ];
  return `<div class="cs-jump">${items.map(([n, l, s, w]) => `<a class="cs-btn sm" href="#setup" data-jump="cs-s${n}" style="${w ? 'background:#FFFBF0;border-color:#F3D58A' : ''}"><span style="width:20px;height:20px;border-radius:10px;background:${w ? '#C2410C' : 'var(--sb-green)'};color:#fff;font-size:11px;display:inline-flex;align-items:center;justify-content:center">${n}</span>${l} <span class="cs-mut" style="font-weight:700">${esc(s)}</span></a>`).join('')}</div>`;
}
/* ① 기간 · 시간 */
function periodHTML(){
  const r = A.R, t = C.tplOf(r);
  const days = r.days || [];
  const times = []; for(let s = 0; s < (Number(t.n) || 0); s++) times.push(`<span class="ch" style="height:30px;padding:0 10px;font-variant-numeric:tabular-nums">${C.NO_KO[s] || s + 1} ${C.fromMin(C.toMin(t.start) + s * ((+t.len || 25) + (+t.gap || 0)))}</span>`);
  return `<div id="cs-evts" class="cs-desc">학사일정에서 «상담» 일정을 찾는 중…</div>
    <div class="cs-dc">${days.map((d, i) => `<div class="cs-dcard${d.off ? ' off' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b style="font-size:14px">${esc(C.dayLabel(d.date))}</b><span style="display:flex;gap:4px"><button class="cs-btn xs" data-doff="${i}">${d.off ? '쓰기' : '쉬기'}</button><button class="cs-btn xs r" data-ddel="${i}" aria-label="날짜 지우기">✕</button></span></div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><label class="cs-fl" style="flex-direction:row;align-items:center;gap:4px">시작<input class="cs-in" data-dstart="${i}" value="${esc(d.start || '')}" placeholder="${esc(t.start)}" style="width:72px;height:30px;font-size:12.5px"></label>
      <label class="cs-fl" style="flex-direction:row;align-items:center;gap:4px">칸<input class="cs-in" data-dn="${i}" value="${esc(d.n || '')}" placeholder="${esc(t.n)}" style="width:48px;height:30px;font-size:12.5px" inputmode="numeric"></label></div>
      <span class="cs-mut">${d.off ? '이날은 상담 없음' : `${esc(C.slotTime(r, C.dayList(r).indexOf(d), 0) || t.start)} ~ · ${d.n || t.n}칸`}</span></div>`).join('')}
      <div class="cs-dcard" style="border-style:dashed;border-color:var(--line)"><b style="font-size:13px">+ 날짜 더하기</b><input type="date" class="cs-in" data-dadd style="height:34px"><span class="cs-mut">예: 별도로 진행하는 날 (목)</span></div></div>
    <div class="cs-flr">
      <label class="cs-fl">시작<input class="cs-in" data-tpl="start" value="${esc(t.start)}" style="width:90px"></label>
      <label class="cs-fl">한 칸 (분)<input class="cs-in" data-tpl="len" value="${esc(t.len)}" style="width:72px" inputmode="numeric"></label>
      <label class="cs-fl">쉼 (분)<input class="cs-in" data-tpl="gap" value="${esc(t.gap)}" style="width:72px" inputmode="numeric"></label>
      <label class="cs-fl">하루 칸 수<input class="cs-in" data-tpl="n" value="${esc(t.n)}" style="width:72px" inputmode="numeric"></label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;padding-bottom:3px">${times.join('')}</div></div>
    <div class="cs-mut">기본: 15:30 시작 · 상담 25분 + 쉼 5분 · 하루 5칸. 날마다 시작 · 칸 수를 따로 바꿀 수 있어요. 자리를 잡은 뒤 칸을 줄이면 점검에 «없는 칸»으로 떠요.</div>`;
}
/* ② 상담 교사 · 교실 */
function colsHTML(){
  const r = A.R, cols = r.cols || [];
  const staff = A.staffPick();
  const rooms = C.roomOptions(A.FLOORS);
  const used = new Set(cols.map(c => c.classId || c.key));
  const more = A.CLASSES.filter(c => !c.deleted && (c.org || C.ORG) === (r.org || C.ORG) && Number(c.year) === Number(r.year) && !used.has(c.id) && (c.students || []).length);
  const cnt = {}; A.scope.filter(x => x.in).forEach(x => { cnt[x.col] = (cnt[x.col] || 0) + 1; });
  return `<datalist id="cs-rooms">${rooms.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <div class="cs-tbl"><div class="cs-tr col hd"><span></span><span>학년 · 반</span><span>상담 교사</span><span class="hm">교실</span><span class="hm">못 하는 시간</span><span style="text-align:right">인원</span></div>
    ${cols.map((c, i) => `<div class="cs-tr col">
      <span style="display:flex;flex-direction:column;gap:2px"><button class="cs-btn xs" data-cup="${i}" aria-label="위로"${i ? '' : ' disabled'}>▲</button><button class="cs-btn xs" data-cdn="${i}" aria-label="아래로"${i < cols.length - 1 ? '' : ' disabled'}>▼</button></span>
      <span><b>${esc(c.grades || '')}</b> ${esc(c.name || '')} <button class="cs-btn xs r" data-cdel="${i}" aria-label="이 줄 빼기" title="이 반을 상담에서 빼기">✕</button></span>
      <span><select class="cs-sel" data-cuid="${i}" style="height:34px;max-width:100%"><option value="">— 담임 없음 —</option>${staff.map(s => `<option value="${esc(s.uid)}"${s.uid === c.uid ? ' selected' : ''}>${esc(s.name || '')}</option>`).join('')}</select></span>
      <span class="hm"><input class="cs-in" list="cs-rooms" data-croom="${i}" value="${esc(c.room || '')}" placeholder="예: 3층 이레반" style="height:34px;width:100%"></span>
      <span class="hm" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${(c.off || []).length ? `<span class="ch warn">${(c.off || []).length}칸 빼 둠</span>` : ''}<button class="cs-btn xs" data-coff="${i}">+ 시간 빼기</button></span>
      <span style="text-align:right;font-weight:800;font-variant-numeric:tabular-nums">${cnt[c.key] || 0}명</span></div>`).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${more.length ? `<select class="cs-sel" data-cadd style="height:34px"><option value="">+ 반 더하기…</option>${more.map(c => `<option value="${esc(c.id)}">${esc(C.gradesLabel(C.classGrades(c)))} ${esc(c.name || '')} (${(c.students || []).length}명)</option>`).join('')}</select>` : ''}
      <button class="cs-btn sm" data-crefill>↻ 반편성에서 다시 채우기</button>
      <span class="cs-mut">세로줄 = 반편성의 반 · 상담 교사 = 담임 (바꿀 수 있어요) · 교실은 시간표 › 교실 배치에서 이름이 같은 교실을 찾아 넣어요</span></div>`;
}
/* ③ 대상 학생 */
function scopeHTML(){
  const r = A.R, sc = A.scope;
  const q = (A.SQ || '').trim();
  const flags = sc.filter(x => x.flag);
  const man = sc.filter(x => x.man);
  const out = sc.filter(x => !x.in && !x.gone);
  const pick = x => `<span class="cs-pick"><button data-inc="${esc(x.sid)}" data-v="1" class="${x.in ? 'in' : ''}">넣기</button><button data-inc="${esc(x.sid)}" data-v="0" class="${!x.in ? 'out' : ''}">빼기</button></span>`;
  const colL = x => { const c = A.colByKey(x.col); return c ? `${c.grades || ''} ${c.name || ''}` : ''; };
  const row = x => `<div class="cs-tr chk"><span><b>${esc(x.name)}</b> <span class="cs-mut">${esc(colL(x))}</span>${x.man ? ' <span class="ch blue">직접</span>' : ''}</span><span class="cs-mut" style="font-size:12.5px">${esc(x.flag || x.why || '')}${x.man ? ` <button class="cs-btn xs" data-inc="${esc(x.sid)}" data-v="auto">↩ 저절로</button>` : ''}</span>${pick(x)}</div>`;
  const found = q ? sc.filter(x => String(x.name).includes(q)).slice(0, 30) : [];
  return `<div class="cs-sum"><div class="g"><span>넣음</span><b>${sc.filter(x => x.in).length}<small style="font-size:13px"> 명</small></b></div>
      <div><span>뺌 · 휴학</span><b>${out.length}<small style="font-size:13px"> 명</small></b></div>
      <div class="w"><span>확인 필요</span><b>${flags.length}<small style="font-size:13px"> 명</small></b></div>
      <div><span>직접 넣음 · 뺌</span><b>${man.length}<small style="font-size:13px"> 명</small></b></div></div>
    ${flags.length ? `<div class="cs-tbl" style="border-color:#F3D58A"><div class="cs-tr hd" style="background:#FEF3C7;color:#7A4B00">확인 필요 — 상담 기간 앞뒤로 재학 · 휴학이 바뀌는 학생 (학생관리 «휴학 기간»으로 판단)</div>${flags.map(row).join('')}</div>` : '<div class="cs-mut">확인할 학생이 없어요 — 상담 첫날 재학인 학생은 모두 넣고, 휴학인 학생은 뺐어요.</div>'}
    ${man.filter(x => !x.flag).length ? `<div class="cs-tbl"><div class="cs-tr hd">직접 넣거나 뺀 학생</div>${man.filter(x => !x.flag).map(row).join('')}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="cs-in" data-sq value="${esc(q)}" placeholder="학생 이름으로 찾아 넣기 · 빼기" style="width:240px"><span class="cs-mut">초안 뒤에 갑자기 휴학하면 그 칸은 «비움»으로 남고, 새로 넣은 학생은 «넣을 학생»에 떠요 — 다른 칸은 그대로예요.</span></div>
    ${found.length ? `<div class="cs-tbl">${found.map(row).join('')}</div>` : (q ? '<div class="cs-mut">이 상담의 반에서 찾는 학생이 없어요 — 반편성에 들어 있는지 확인해 주세요.</div>' : '')}`;
}
/* ④ 형제 가정 */
function famHTML(){
  const r = A.R, opt = C.optOf(r);
  const fams = Object.entries(A.members).filter(([, m]) => m.length > 1);
  const ignore = new Set((r.notSib || []).map(p => p.slice().sort().join('|')));
  const pairs = C.phonePairs([...A.inSet], A.STU, A.fam).filter(p => !ignore.has(p.slice().sort().join('|')));
  const nm = id => { const c = A.colByKey(A.colOf[id]); return `${c ? c.grades + ' ' : ''}${A.stuName(id)}`; };
  const radio = (k, v, t, d) => `<label class="cs-radio${opt[k] === v ? ' on' : ''}"><input type="radio" name="cs-${k}" data-opt="${k}" value="${v}"${opt[k] === v ? ' checked' : ''}><span><b>${t}</b>${d ? `<br><span class="cs-mut">${d}</span>` : ''}</span></label>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
    <div style="display:flex;flex-direction:column;gap:8px"><b style="font-size:13px">묶인 가정 ${fams.length} · 형제 ${fams.reduce((t, [, m]) => t + m.length, 0)}명</b>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${fams.map(([k, m]) => { const s = A.styles[k] || {}; return `<span class="ch" style="background:${s.bg || '#F3F2EE'};color:${s.fg || 'inherit'};height:28px;padding:0 10px">${s.mark || ''} ${esc(m.map(nm).join(' · '))}</span>`; }).join('') || '<span class="cs-mut">형제로 묶인 학생이 없어요 (학생관리 › 학생 › 형제 연결)</span>'}</div>
      ${pairs.length ? `<div style="padding:10px 12px;border-radius:10px;border:1px dashed #D97706;background:#FFFBF0;font-size:12.5px;line-height:1.6">보호자 번호가 같은데 형제로 묶이지 않은 학생 <b>${pairs.length}쌍</b>
        ${pairs.map(p => `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px"><span>${esc(p.map(nm).join(' · '))}</span><button class="cs-btn xs g" data-sib="${esc(p.join('|'))}">형제로 묶기</button><button class="cs-btn xs" data-nosib="${esc(p.join('|'))}">따로 두기</button></div>`).join('')}
        <div class="cs-mut" style="margin-top:6px">«형제로 묶기»는 학생관리의 형제 연결에도 저장돼요.</div></div>` : ''}</div>
    <div style="display:flex;flex-direction:column;gap:8px"><b style="font-size:13px">형제 시간 잡는 법</b>
      ${radio('sib', 'next', '바로 이어서 (추천 · 지금 방식)', '다른 교실이면 쉼 5분에 옮겨 가요 · 같은 선생님(쌍둥이)이면 두 칸 연달아')}
      ${radio('sib', 'gap1', '한 칸 쉬고', '교실이 멀거나 층이 다를 때')}
      ${radio('sib', 'day', '같은 날이면 됨', '시간은 떨어져도 하루에 끝나게')}</div></div>`;
}
/* ⑤ 교직원 자녀 */
function kidHTML(){
  const r = A.R, opt = C.optOf(r);
  const list = A.scope.filter(x => x.in && A.KIDS[x.sid]);
  const colUids = (r.cols || []).map(c => c.uid);
  const radio = (v, t, d) => `<label class="cs-radio${opt.kid === v ? ' on' : ''}"><input type="radio" name="cs-kid" data-opt="kid" value="${v}"${opt.kid === v ? ' checked' : ''}><span><b>${t}</b>${d ? `<br><span class="cs-mut">${d}</span>` : ''}</span></label>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
    <div class="cs-tbl">${list.map(x => { const u = A.KIDS[x.sid]; const c = A.colByKey(x.col); return `<div class="cs-tr" style="grid-template-columns:minmax(0,1fr) 22px minmax(0,1fr)"><span><b>${esc(x.name)}</b> <span class="cs-mut">${esc(c ? c.grades + ' ' + c.name : '')}</span></span><span class="cs-mut">↔</span><span><b style="color:var(--sb-green)">${esc(A.staffName(u) || '(교직원)')}</b> <span class="cs-mut">${colUids.includes(u) ? '상담함 → 그 뒤로' : '상담 안 함 → 보통 자리'}</span></span></div>`; }).join('') || '<div class="cs-tr" style="grid-template-columns:1fr"><span class="cs-mut">이 상담의 학생 가운데 이어진 교직원 자녀가 없어요.</span></div>'}
      <div class="cs-tr" style="grid-template-columns:1fr"><a class="cs-btn sm" href="#kids" style="justify-self:start">🧑‍🏫 교직원 자녀 잇기 · 고치기 →</a></div></div>
    <div style="display:flex;flex-direction:column;gap:8px">${radio('after', '그 선생님 상담이 다 끝난 뒤 (추천)', '마지막 상담 다음 칸부터 · 그날 칸이 없으면 다음 날')}${radio('last', '마지막 날 마지막 시간')}${radio('sep', '별도 일정', '담임과 따로 정함 · 표 아래 «그 외»에')}
      <div class="cs-mut">선생님이 직접 «내 자녀 잇기»로 넣거나 편성 담당이 넣어요 · 학부모 상담 안에서만 쓰고 다음 학기에도 이어져요.</div></div></div>`;
}
/* ⑥ 순서 · 채우기 */
function orderHTML(){
  const r = A.R, opt = C.optOf(r);
  const prev = A.prevRounds();
  const pd = A.prevDir();
  const dir = C.dirFor(opt, pd);
  const card = (v, t, d, rec) => `<button class="cs-ordc${opt.order === v ? ' on' : ''}" data-opt="order" data-val="${v}"><b>${t}</b><span>${d}</span>${rec ? '<span class="ch dark" style="align-self:flex-start">추천</span>' : ''}</button>`;
  const ck = (k, t) => `<label class="ck"><input type="checkbox" data-optc="${k}"${opt[k] ? ' checked' : ''}> ${t}</label>`;
  const radio = (v, t, d) => `<label class="cs-radio${opt.fill === v ? ' on' : ''}"><input type="radio" name="cs-fill" data-opt="fill" value="${v}"${opt.fill === v ? ' checked' : ''}><span><b>${t}</b>${d ? `<br><span class="cs-mut">${d}</span>` : ''}</span></label>`;
  // 미리 보기 (자리는 바꾸지 않고 계산만)
  let pv = '';
  try{
    const out = C.autoPlace({ r: Object.assign({}, r, { seats: {} }), scope: A.scope, studentsById: A.STU, kids: A.KIDS, rounds: prev, prevDir: pd });
    const fr = Object.entries(out.seats).filter(([, st]) => C.posOf(r, st) === 'f');
    const last = prev.length ? C.lastPosFor([...A.inSet], prev) : {};
    const rep = fr.filter(([id]) => last[id] === 'f').length;
    const mv = /(\d+)가정은 이번에 그 자리를 피함/.exec(out.notes.join(' ')); const moved = mv ? +mv[1] : 0;
    pv = `<b style="font-size:13px">미리 보기</b> (자리는 그대로 · 계산만)<br>이번 방향 <b>${out.dir === 'desc' ? 'ㅎ→ㄱ' : 'ㄱ→ㅎ'}</b>${pd ? ` · 지난번 ${pd === 'desc' ? 'ㅎ→ㄱ' : 'ㄱ→ㅎ'}` : ' · 지난 상담 기록 없음'}<br>
      첫날 첫째 · 둘째 시간 ${fr.length}명 가운데 지난번에도 그 자리였던 학생 <b>${rep}</b>${moved ? `<br>지난번 맨 앞이던 <b>${moved}가정</b>은 이번에 첫째 · 둘째 칸을 피해요` : ''}${out.unplaced.length ? `<br><span style="color:#C2410C">자리 없음 ${out.unplaced.length}명 — 날짜나 하루 칸 수를 늘려 주세요</span>` : ''}`;
  }catch(e){ pv = '미리 보기를 계산하지 못했어요.'; }
  return `<div class="cs-mut">지난 상담: ${prev.length ? esc(prev[0].title || prev[0].id) + (pd ? ` · ${pd === 'desc' ? 'ㅎ→ㄱ 역순' : 'ㄱ→ㅎ'}` : '') : '없음 (이 상담부터 기록이 쌓여요)'}</div>
    <div class="cs-ord">${card('flip', '지난번과 반대', `지난 상담 방향의 반대 — 이번엔 ${dir === 'desc' ? 'ㅎ→ㄱ' : 'ㄱ→ㅎ'} · 학기마다 저절로 바뀜`, true)}${card('asc', 'ㄱ → ㅎ', '가나다 순')}${card('desc', 'ㅎ → ㄱ', '역순')}${card('fair', '지난 자리로 고르게', '지난 3학기 자리를 점수로 — 앞이었던 가정은 뒤로')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:18px">${ck('guardFront', '두 학기 연속 맨 앞 (첫날 첫째 · 둘째) 막기')}${ck('guardBack', '지난번 맨 뒤 (마지막 날 · 전화 · 별도)였던 가정은 앞쪽으로')}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
      <div style="padding:12px 14px;border-radius:10px;background:#F7F6F2;font-size:12.5px;line-height:1.7">${pv}</div>
      <div style="display:flex;flex-direction:column;gap:8px">${radio('front', '앞에서부터 채우기 (지금 방식)', '첫날부터 꽉 채우고 마지막 날은 변경용 여유로')}${radio('even', '날마다 고르게', '선생님마다 하루 상담 수를 비슷하게')}</div></div>`;
}
export function setupHTML(a){
  A = a; C = a.C; esc = a.esc;
  const r = A.R;
  const has = Object.keys(r.seats || {}).length;
  return `<div style="max-width:1180px;margin:12px auto 0">${jumpHTML()}
    ${r.state === 'closed' ? '<div class="cs-card" style="margin-bottom:12px">끝난 상담이에요 — 보기만 할 수 있어요.</div>' : ''}
    ${['review', 'final'].includes(r.state) ? '<div class="cs-card" style="margin-bottom:12px;background:#FFF7E6;border-color:#F3D58A;font-size:13px">선생님들께 보낸 뒤예요 — 여기서 바꾸면 표에 바로 반영되고, «고친 것 보내기»를 눌러야 선생님들께 보여요.</div>' : ''}
    ${SEC(1, '기간 · 시간 칸', '학사일정의 «상담» 일정에서 날짜를 가져와요', periodHTML())}
    ${SEC(2, '상담 교사 · 교실', '표의 세로줄 순서 그대로', colsHTML())}
    ${SEC(3, '대상 학생', `기준: 상담 날짜 (${esc(C.dayList(r).map(d => C.dayLabel(d.date, true)).join(' · ') || '날짜 없음')}) 재학 · 휴학`, scopeHTML())}
    ${SEC(4, '형제 가정', '학생관리의 «형제 연결»로 묶어요 · 한 가정 = 이어진 시간', famHTML())}
    ${SEC(5, '교직원 자녀', '부모 선생님이 상담하는 시간과 겹치지 않게', kidHTML())}
    ${SEC(6, '순서 · 채우기', '', orderHTML())}
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end;padding-top:4px">
      <span class="cs-mut">${A.inSet.size}명 · 형제 ${Object.values(A.members).filter(m => m.length > 1).length}가정 · 대면 칸 ${(r.cols || []).length * C.allSlots(r).length}개${has ? ' · 📌 고정 · 전화 · 별도는 그대로 두고 다시 만들어요' : ''}</span>
      ${r.state !== 'closed' ? `<button class="cs-btn g" data-sb="auto" style="height:46px;font-size:15px">${has ? '↻ 자동 배치 다시 →' : '초안 만들기 →'}</button>` : ''}
      ${['prep', 'draft'].includes(r.state) ? '<button class="cs-btn r sm" data-sb="del">이 상담 지우기</button>' : ''}</div></div>`;
}

/* ── 고치기 ── */
async function save(patch){ try{ await A.saveRound(patch); }catch(e){ A.toast('저장하지 못했어요 — ' + A.errText(e), 'err'); } }
async function setDays(days){
  days = days.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const r = A.R;
  const m = C.remapDays(r, days);
  if(m.same) return save({ days });
  if(m.lost && !(await A.confirm('날짜 바꾸기', `없어지는 날에 잡힌 자리 <b>${m.lost}명</b>은 «넣을 학생»으로 돌아가요. 바꿀까요?`, '바꾸기', true))) { A.render(true); return; }
  const p = { days, seats: m.seats, cols: m.cols }; if(m.sentSeats) p.sentSeats = m.sentSeats;
  return save(p);
}
async function offPicker(i){
  const r = A.R, c = r.cols[i];
  let off = new Set(c.off || []);
  const days = C.dayList(r);
  const maxN = Math.max(1, ...days.map((x, d) => C.dayN(r, d)));
  const draw = () => `<div class="cs-desc" style="margin-bottom:8px">${esc(c.tname || c.name)} 선생님이 상담할 수 없는 칸을 눌러 주세요 (노란 칸 = 못 함 · 자동 배치가 비워 둬요)</div>
    <div class="cs-offg" style="grid-template-columns:90px repeat(${maxN},minmax(0,1fr))"><span></span>${[...Array(maxN).keys()].map(s => `<span class="cs-mut" style="text-align:center;font-size:11px">${C.NO_KO[s]}</span>`).join('')}
    ${days.map((x, d) => `<span class="cs-mut" style="font-size:12px;font-weight:800;display:flex;align-items:center">${esc(C.dayLabel(x.date, true))}</span>${[...Array(maxN).keys()].map(s => s < C.dayN(r, d) ? `<button data-o="${d}_${s}" class="${off.has(d + '_' + s) ? 'on' : ''}">${C.slotTime(r, d, s)}</button>` : '<span></span>').join('')}`).join('')}</div>`;
  const m = A.modal('🚫 못 하는 시간', `<div data-g>${draw()}</div>`, '<button class="cs-btn" data-n>취소</button><button class="cs-btn p" data-y>저장</button>', 'mid');
  m.box.querySelector('[data-g]').onclick = e => { const b = e.target.closest('[data-o]'); if(!b) return; const k = b.dataset.o; if(off.has(k)) off.delete(k); else off.add(k); m.box.querySelector('[data-g]').innerHTML = draw(); };
  m.box.querySelector('[data-n]').onclick = () => m.close();
  m.box.querySelector('[data-y]').onclick = async () => { m.close(); const cols = JSON.parse(JSON.stringify(r.cols)); cols[i].off = [...off]; await save({ cols }); };
}
async function loadEvts(){
  const r = A.R; const el = document.getElementById('cs-evts'); if(!el) return;
  const list = (await A.loadEvents(r.year)).filter(e => /상담/.test(String(e.title || '') + String(e.subtitle || '')) && (!e.org || e.org === 'daniel' || e.org === 'all' || (e.orgs || []).includes('daniel')))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  if(!document.getElementById('cs-evts')) return;
  el.innerHTML = list.length ? `<div style="display:flex;flex-direction:column;gap:6px">${list.map(e => `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:9px 12px;border-radius:10px;background:var(--sb-mint-2)"><span>📅 <b>${esc(e.title || '')}</b> · ${esc(C.dayLabel(e.startDate, true))}${e.endDate && e.endDate !== e.startDate ? ' ~ ' + esc(C.dayLabel(e.endDate, true)) : ''}</span><span class="cs-mut">학사일정</span><span style="flex:1"></span><button class="cs-btn xs m" data-evt="${esc(e.id)}">이 날짜로</button></div>`).join('')}</div>`
    : `<span class="cs-mut">학사일정에 «상담»이 들어간 ${esc(r.year)}학년도 일정이 없어요 — 아래에서 날짜를 직접 더하거나, 학사일정에 «학부모 상담» 일정을 넣으면 여기에 떠요.</span>`;
  el.onclick = async ev => {
    const b = ev.target.closest('[data-evt]'); if(!b) return;
    const e = list.find(x => x.id === b.dataset.evt); if(!e) return;
    let ds = C.weekdaysBetween(e.startDate, e.endDate || e.startDate, e.skipDates);
    if(Array.isArray(e.weekdays) && e.weekdays.length) ds = ds.filter(d => e.weekdays.includes(new Date(d + 'T00:00:00').getDay()));
    if(!ds.length){ A.toast('그 일정에는 평일이 없어요', 'err'); return; }
    if(!(await A.confirm('날짜 바꾸기', `상담 날짜를 ${esc(ds.map(d => C.dayLabel(d, true)).join(' · '))}로 바꿀까요?<br><span class="cs-mut">같은 날짜에 잡은 자리는 그대로 따라가요.</span>`, '바꾸기'))) return;
    await setDays(ds.map(date => { const old = (A.R.days || []).find(d => d.date === date); return old || { date }; }));
    A.toast(`상담 날짜 ${ds.length}일을 넣었어요`);
  };
}
export function after(a){
  A = a; C = a.C; esc = a.esc;
  const root = document.getElementById('cs'); if(!root) return;
  if(!A.FLOORS.length && !A._floorsLoaded){ A._floorsLoaded = true; A.loadFloors().then(() => { if(A.VIEW === 'setup') A.render(true); }); }
  loadEvts();
  root.onclick = async e => {
    const t = e.target, r = A.R;
    const j = t.closest('[data-jump]'); if(j){ e.preventDefault(); const el = document.getElementById(j.dataset.jump); if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const doff = t.closest('[data-doff]'); if(doff){ const days = JSON.parse(JSON.stringify(r.days || [])); const d = days[+doff.dataset.doff]; d.off = !d.off; if(!d.off) delete d.off; await setDays(days); return; }
    const ddel = t.closest('[data-ddel]'); if(ddel){ const days = JSON.parse(JSON.stringify(r.days || [])); const d = days[+ddel.dataset.ddel]; if(!(await A.confirm('날짜 지우기', `${esc(C.dayLabel(d.date))}을(를) 지울까요?<br><span class="cs-mut">그 뒤 날짜에 잡은 자리는 하루씩 앞으로 당겨 보여요 — 지우기보다 «쉬기»를 권해요.</span>`, '지우기', true))) return; days.splice(+ddel.dataset.ddel, 1); await setDays(days); return; }
    const cup = t.closest('[data-cup],[data-cdn]'); if(cup){ const i = +(cup.dataset.cup ?? cup.dataset.cdn), j2 = cup.dataset.cup != null ? i - 1 : i + 1; const cols = JSON.parse(JSON.stringify(r.cols)); if(j2 < 0 || j2 >= cols.length) return; [cols[i], cols[j2]] = [cols[j2], cols[i]]; await save({ cols }); return; }
    const cdel = t.closest('[data-cdel]'); if(cdel){ const i = +cdel.dataset.cdel; const c = r.cols[i]; const n = A.scope.filter(x => x.col === c.key && x.in).length; if(!(await A.confirm('반 빼기', `${esc(C.colLabel(c))}을(를) 이번 상담에서 뺄까요?<br><span class="cs-mut">학생 ${n}명이 대상에서 빠지고, 잡은 자리는 «빠진 학생»으로 남아요.</span>`, '빼기', true))) return; const cols = JSON.parse(JSON.stringify(r.cols)); cols.splice(i, 1); await save({ cols }); return; }
    const coff = t.closest('[data-coff]'); if(coff){ offPicker(+coff.dataset.coff); return; }
    const cre = t.closest('[data-crefill]'); if(cre){
      const fresh = C.colsFromClasses(A.CLASSES, r.year, r.org || C.ORG, A.FLOORS, A.staffName);
      const old = {}; (r.cols || []).forEach(c => { old[c.key] = c; });
      const cols = fresh.map(c => old[c.key] ? Object.assign({}, c, { room: old[c.key].room || c.room, off: old[c.key].off || [], uid: old[c.key].uid || c.uid, tname: A.staffName(old[c.key].uid || c.uid) || c.tname }) : c);
      if(!(await A.confirm('반편성에서 다시 채우기', `반편성의 ${r.year}학년도 반으로 세로줄을 다시 채울까요? (${cols.length}줄)<br><span class="cs-mut">이미 있던 줄의 교실 · 못 하는 시간 · 상담 교사는 그대로 둬요. 세로줄 순서는 학년 순으로.</span>`, '다시 채우기'))) return;
      await save({ cols }); return;
    }
    const inc = t.closest('[data-inc]'); if(inc){ const sid = inc.dataset.inc, v = inc.dataset.v; const p = {}; p['inc.' + sid] = v === 'auto' ? A.FS.deleteField() : (v === '1' ? 1 : 0); await save(p); return; }
    const sib = t.closest('[data-sib]'); if(sib){
      const [a1, b1] = sib.dataset.sib.split('|');
      if(!(await A.confirm('형제로 묶기', `${esc(A.stuName(a1))} · ${esc(A.stuName(b1))}을(를) 형제로 묶을까요?<br><span class="cs-mut">학생관리의 «형제 연결»에도 저장돼요.</span>`, '묶기'))) return;
      try{
        const bt = A.FS.writeBatch(A.db);
        bt.update(A.FS.doc(A.db, 'students', a1), { siblings: A.FS.arrayUnion(b1) });
        bt.update(A.FS.doc(A.db, 'students', b1), { siblings: A.FS.arrayUnion(a1) });
        await bt.commit();
        [[a1, b1], [b1, a1]].forEach(([x, y]) => { const s = A.STU[x]; if(s){ s.siblings = C.uniq((s.siblings || []).concat([y])); } });
        A.derive(); A.render(true); A.toast('형제로 묶었어요');
      }catch(err){ A.toast('묶지 못했어요 — ' + A.errText(err), 'err'); }
      return;
    }
    const nos = t.closest('[data-nosib]'); if(nos){ await save({ notSib: (r.notSib || []).concat([nos.dataset.nosib.split('|')]) }); return; }
    const oc = t.closest('[data-opt][data-val]'); if(oc){ await save({ opt: Object.assign({}, C.optOf(r), { [oc.dataset.opt]: oc.dataset.val }) }); return; }
    const sb = t.closest('[data-sb]'); if(sb){
      if(sb.dataset.sb === 'auto'){ const B = await import('./consult-board.js?v=152'); await B.runAuto(A); A.go('board'); return; }
      if(sb.dataset.sb === 'del'){ if(!(await A.confirm('상담 지우기', `«${esc(r.title)}»을(를) 지울까요? 되돌릴 수 없어요.`, '지우기', true))) return; try{ await A.FS.deleteDoc(A.roundRef()); A.ROUNDS = A.ROUNDS.filter(x => x.id !== r.id); await A.useRound((A.ROUNDS.find(x => x.state !== 'closed') || {}).id || ''); A.go('board'); A.toast('지웠어요'); }catch(err){ A.toast('지우지 못했어요 — ' + A.errText(err), 'err'); } return; }
    }
  };
  root.onchange = async e => {
    const t = e.target, r = A.R;
    if(t.matches('[data-tpl]')){
      const k = t.dataset.tpl; let v = t.value.trim();
      if(k === 'start'){ if(isNaN(C.toMin(v))){ A.toast('시작은 15:30처럼 적어 주세요', 'err'); A.render(true); return; } v = C.fromMin(C.toMin(v)); }
      else { v = Math.round(Number(v)); if(!(v >= (k === 'gap' ? 0 : 1)) || v > (k === 'n' ? 12 : 180)){ A.toast('숫자를 확인해 주세요', 'err'); A.render(true); return; } }
      await save({ tpl: Object.assign({}, C.tplOf(r), { [k]: v }) }); return;
    }
    if(t.matches('[data-dstart],[data-dn]')){
      const i = +(t.dataset.dstart ?? t.dataset.dn); const days = JSON.parse(JSON.stringify(r.days || []));
      const v = t.value.trim();
      if(t.dataset.dstart != null){ if(v && isNaN(C.toMin(v))){ A.toast('시작은 16:00처럼 적어 주세요', 'err'); A.render(true); return; } if(v) days[i].start = C.fromMin(C.toMin(v)); else delete days[i].start; }
      else { const n = Math.round(Number(v)); if(v && !(n >= 1 && n <= 12)){ A.toast('칸 수는 1~12', 'err'); A.render(true); return; } if(v) days[i].n = n; else delete days[i].n; }
      await setDays(days); return;
    }
    if(t.matches('[data-dadd]')){ const v = t.value; if(!v) return; if((r.days || []).some(d => d.date === v)){ A.toast('이미 있는 날짜예요', 'err'); return; } await setDays((r.days || []).concat([{ date: v }])); return; }
    if(t.matches('[data-cuid]')){ const i = +t.dataset.cuid; const cols = JSON.parse(JSON.stringify(r.cols)); cols[i].uid = t.value; cols[i].tname = A.staffName(t.value); await save({ cols }); return; }
    if(t.matches('[data-croom]')){ const i = +t.dataset.croom; const cols = JSON.parse(JSON.stringify(r.cols)); cols[i].room = t.value.trim(); await save({ cols }); return; }
    if(t.matches('[data-cadd]')){ const c = A.CBYID[t.value]; if(!c) return; const add = C.colsFromClasses([c], r.year, r.org || C.ORG, A.FLOORS, A.staffName)[0]; if(!add) return; await save({ cols: (r.cols || []).concat([add]) }); return; }
    if(t.matches('[data-opt]') && t.type === 'radio'){ await save({ opt: Object.assign({}, C.optOf(r), { [t.dataset.opt]: t.value }) }); return; }
    if(t.matches('[data-optc]')){ await save({ opt: Object.assign({}, C.optOf(r), { [t.dataset.optc]: t.checked }) }); return; }
  };
  root.oninput = e => {
    if(e.target.matches('[data-sq]')){ A.SQ = e.target.value; clearTimeout(A._sqT); A._sqT = setTimeout(() => { A.render(true); const el = document.querySelector('[data-sq]'); if(el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); }
  };
}

/* ═══ 새 상담 만들기 ═══ */
export async function newRound(a){
  A = a; C = a.C; esc = a.esc;
  const today = A.today();
  const y0 = Number(today.slice(0, 4)), mo = Number(today.slice(5, 7));
  let year = y0, term = mo >= 7 ? 2 : 1;
  await A.loadFloors();
  const m = A.modal('📅 새 상담 일정', '<div data-b>불러오는 중…</div>', '<button class="cs-btn" data-n>취소</button><button class="cs-btn g" data-y>만들기</button>', 'mid');
  let evts = [], pickEvt = '', from = '', to = '';
  const prevOf = () => A.ROUNDS.filter(x => (x.org || C.ORG) === C.ORG && ((x.year * 10 + x.term) < (year * 10 + term))).sort((p, q) => (q.year * 10 + q.term) - (p.year * 10 + p.term))[0] || null;
  const draw = async () => {
    evts = (await A.loadEvents(year)).filter(e => /상담/.test(String(e.title || '') + String(e.subtitle || ''))).sort((p, q) => String(p.startDate).localeCompare(String(q.startDate)));
    const cols = C.colsFromClasses(A.CLASSES, year, C.ORG, A.FLOORS, A.staffName);
    const prev = prevOf();
    const exists = A.ROUNDS.filter(x => x.year === year && x.term === term && (x.org || C.ORG) === C.ORG).length;
    m.box.querySelector('[data-b]').innerHTML = `<div style="display:flex;flex-direction:column;gap:14px">
      <div class="cs-flr"><label class="cs-fl">학년도<select class="cs-sel" data-yr>${[y0 - 1, y0, y0 + 1].map(v => `<option value="${v}"${v === year ? ' selected' : ''}>${v}학년도</option>`).join('')}</select></label>
        <label class="cs-fl">학기<select class="cs-sel" data-tm><option value="1"${term === 1 ? ' selected' : ''}>1학기</option><option value="2"${term === 2 ? ' selected' : ''}>2학기</option></select></label>
        <span class="cs-mut" style="padding-bottom:10px">${esc(C.roundTitle(year, term, exists + 1))}${exists ? ` · 이 학기에 이미 ${exists}개 있어요` : ''}</span></div>
      <div class="cs-fl">상담 날짜 — 학사일정의 «상담» 일정
        ${evts.length ? evts.map(e => `<label class="cs-radio${pickEvt === e.id ? ' on' : ''}" style="font-weight:500;color:var(--ink)"><input type="radio" name="cs-ne" value="${esc(e.id)}"${pickEvt === e.id ? ' checked' : ''}><span><b>${esc(e.title || '')}</b> · ${esc(C.dayLabel(e.startDate, true))}${e.endDate && e.endDate !== e.startDate ? ' ~ ' + esc(C.dayLabel(e.endDate, true)) : ''}</span></label>`).join('') : `<span class="cs-mut" style="font-weight:500">${year}학년도 학사일정에 «상담»이 들어간 일정이 없어요 — 아래에서 직접 고르세요.</span>`}
        <label class="cs-radio${!pickEvt ? ' on' : ''}" style="font-weight:500;color:var(--ink)"><input type="radio" name="cs-ne" value=""${!pickEvt ? ' checked' : ''}><span><b>직접 고르기</b> · 평일만 <input type="date" class="cs-in" data-from value="${esc(from)}" style="height:32px"> ~ <input type="date" class="cs-in" data-to value="${esc(to)}" style="height:32px"></span></label></div>
      <div class="cs-desc">· 세로줄: 반편성 ${year}학년도 다니엘 아마츠 반 <b>${cols.length}줄</b> (학년 순 · 담임 = 상담 교사)${cols.length ? '' : ' — <b style="color:#B42318">반편성에 이 학년도 반이 없어요</b>'}<br>
        · 시간: 15:30 시작 · 25분 + 쉼 5분 · 하루 5칸 (준비에서 바꿀 수 있어요)<br>
        ${prev ? `· 지난 상담 «${esc(prev.title || prev.id)}»의 교실 · 시간 틀 · 순서 설정을 이어받아요` : '· 처음 만드는 상담이에요 — 순번은 ㄱ→ㅎ부터 시작해요'}</div></div>`;
  };
  await draw();
  m.box.addEventListener('change', async e => {
    if(e.target.matches('[data-yr]')){ year = +e.target.value; pickEvt = ''; await draw(); }
    if(e.target.matches('[data-tm]')){ term = +e.target.value; await draw(); }
    if(e.target.name === 'cs-ne'){ pickEvt = e.target.value; m.box.querySelectorAll('.cs-radio').forEach(x => x.classList.toggle('on', x.querySelector('input') === e.target)); }
    if(e.target.matches('[data-from]')){ from = e.target.value; if(!to || to < from) to = from; pickEvt = ''; await draw(); }
    if(e.target.matches('[data-to]')){ to = e.target.value; pickEvt = ''; await draw(); }
  });
  m.box.querySelector('[data-n]').onclick = () => m.close();
  m.box.querySelector('[data-y]').onclick = async () => {
    let dates = [];
    if(pickEvt){ const ev = evts.find(x => x.id === pickEvt); if(ev){ dates = C.weekdaysBetween(ev.startDate, ev.endDate || ev.startDate, ev.skipDates); if(Array.isArray(ev.weekdays) && ev.weekdays.length) dates = dates.filter(d => ev.weekdays.includes(new Date(d + 'T00:00:00').getDay())); } }
    else if(from) dates = C.weekdaysBetween(from, to || from);
    if(!dates.length){ A.toast('상담 날짜를 골라 주세요 (평일)', 'err'); return; }
    const cols = C.colsFromClasses(A.CLASSES, year, C.ORG, A.FLOORS, A.staffName);
    const prev = prevOf();
    if(prev){ cols.forEach(c => { const o = (prev.cols || []).find(x => x.key === c.key) || (prev.cols || []).find(x => x.name === c.name && x.grades === c.grades); if(o && o.room) c.room = o.room; }); }
    const n = A.ROUNDS.filter(x => x.year === year && x.term === term && (x.org || C.ORG) === C.ORG).length + 1;
    const id = C.roundId(C.ORG, year, term, n);
    const data = { org: C.ORG, year, term, title: C.roundTitle(year, term, n), state: 'prep',
      tpl: Object.assign({}, C.DEF_TPL, prev && prev.tpl ? prev.tpl : {}), days: dates.map(date => ({ date })), cols,
      opt: Object.assign({}, C.DEF_OPT, prev && prev.opt ? prev.opt : {}), inc: {}, seats: {}, ver: 0, acks: {},
      createdAt: A.FS.serverTimestamp(), createdBy: A.CU.uid, updatedAt: A.FS.serverTimestamp(), updatedBy: A.CU.uid };
    try{
      await A.FS.setDoc(A.FS.doc(A.db, 'consultRounds', id), data);
      m.close();
      await A.loadRounds(); await A.useRound(id);
      A.go('setup'); A.toast('새 상담을 만들었어요 — 준비를 확인하고 «초안 만들기»를 눌러 주세요');
    }catch(e){ A.toast('만들지 못했어요 — ' + A.errText(e), 'err'); }
  };
}
