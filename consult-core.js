/* ═══ 📅 consult-core.js — 학부모 상담 스케줄 (v149 · v151 전화 상담 시간 · 학부모 안내판 · v152 가정 특이 사항 · v155 단계: 학부모 확인 → 최종 반영) · 화면 없이 계산만 ═══
   · 상담 한 번 = consultRounds/{기관_연도_학기}
       tpl   기본 틀 { start:'15:30', len:25, gap:5, n:5 }  (상담 25분 + 쉼 5분 · 하루 5칸)
       days  [{ date, start?, n?, off? }]   날마다 시작 · 칸 수를 따로 바꿀 수 있음
       cols  [{ key, classId, name, grades, uid, tname, room, off:['d_s'] }]   세로줄 = 반편성의 반 (담임 = 상담 교사)
       inc   { sid: 1 | 0 }   대상 학생 직접 넣기(1) · 빼기(0) — 없으면 상담 첫날 재학 · 휴학으로 저절로
       seats { sid: { d, s, k:'face'|'phone'|'sep', pin, note, pd?, pt? } }   자리 (세로줄은 학생의 반)
             전화 상담(phone)은 표 밖 — pd 날짜('YYYY-MM-DD') · pt 시각('HH:MM') 을 따로 (비면 «시간 미정»)
       pubs  [{ n, label:'초안'|'수정 n'|'최종', ver, at(ms), by, byName }]   학부모께 나간 판 (v151 · v155 마지막 판 «최종» — 예전 «확정»도 같은 뜻)
       cond  { sid: { noDays:['YYYY-MM-DD'], after:'HH:MM', before:'HH:MM', noSlots:['YYYY-MM-DD_s'], note } }   🧩 가정 특이 사항 (v152 · 이번 상담만)
             가정(형제) 모두의 자리에 같은 것을 적고, 읽을 때는 가정 안 것을 모두 합침 — 기본(적지 않음) = 다 됨
       vac   { 'c|d|s': { n, why } }   초안 뒤에 빠진 학생 자리 («비움»)
       opt   { order:'flip'|'asc'|'desc'|'fair', guardFront, guardBack, fill:'front'|'even', sib:'next'|'gap1'|'day', kid:'after'|'last'|'sep' }
   · 이 파일은 계산만 — 화면(consult.html)과 시험(Node)이 함께 쓴다 */

export const ORG = 'daniel';
export const DEF_TPL = { start: '15:30', len: 25, gap: 5, n: 5 };
export const DEF_OPT = { order: 'flip', guardFront: true, guardBack: true, fill: 'front', sib: 'next', kid: 'after' };
export const STATES = {
  prep: { ko: '준비', no: 1 }, draft: { ko: '초안 편성', no: 2 }, review: { ko: '담임 확인', no: 3 },
  final: { ko: '최종 반영', no: 4 }, closed: { ko: '끝남', no: 5 },
};
export const KINDS = { face: '대면', phone: '전화 상담', sep: '별도 일정' };
export const NO_KO = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째', '열한째', '열두째'];
export const FRONT_SLOTS = 2;   // «맨 앞» = 첫날 첫째 · 둘째 칸

export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uniq = a => [...new Set(a)];
const cmpKo = (a, b) => String(a || '').localeCompare(String(b || ''), 'ko');

/* ── 시간 ── */
export const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
export const fromMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
export function tplOf(r){ return Object.assign({}, DEF_TPL, (r && r.tpl) || {}); }
export function optOf(r){ return Object.assign({}, DEF_OPT, (r && r.opt) || {}); }
export function dayList(r){ return ((r && r.days) || []).filter(d => d && d.date && !d.off); }
/* 그날 칸 수 · 시작 */
export function dayN(r, d){ const t = tplOf(r), x = dayList(r)[d] || {}; const n = Number(x.n || t.n) || 0; return Math.max(0, Math.min(12, n)); }
export function slotStart(r, d, s){ const t = tplOf(r), x = dayList(r)[d] || {}; const st = toMin(x.start || t.start); return st + s * ((Number(t.len) || 25) + (Number(t.gap) || 0)); }
export function slotTime(r, d, s){ const a = slotStart(r, d, s); return isNaN(a) ? '' : fromMin(a); }
export function slotRange(r, d, s){ const t = tplOf(r); const a = slotStart(r, d, s); return isNaN(a) ? '' : `${fromMin(a)}–${fromMin(a + (Number(t.len) || 25))}`; }
const WD = ['일', '월', '화', '수', '목', '금', '토'];
export function dayLabel(date, short){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '')); if(!m) return String(date || '');
  const w = WD[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
  return short ? `${+m[2]}/${+m[3]}(${w})` : `${+m[2]}월 ${+m[3]}일 (${w})`;
}
/* 날짜 사이 평일 (주말 · 뺀 날 빼고) */
export function weekdaysBetween(from, to, skip){
  const out = []; const sk = new Set(skip || []);
  const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if(isNaN(a) || isNaN(b) || b < a) return out;
  for(let d = new Date(a); d <= b && out.length < 31; d.setDate(d.getDate() + 1)){
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if(d.getDay() !== 0 && d.getDay() !== 6 && !sk.has(ds)) out.push(ds);
  }
  return out;
}
/* 모든 칸 (시간 순) */
export function allSlots(r){
  const out = [];
  dayList(r).forEach((_, d) => { for(let s = 0; s < dayN(r, d); s++) out.push({ d, s, i: out.length }); });
  return out;
}
export const slotIdx = (r, d, s) => { let i = 0; for(let k = 0; k < d; k++) i += dayN(r, k); return i + s; };
/* 시각(pd · pt)이 상담 칸 안이면 그 칸 { d, s } — 아니면 null */
export function slotAt(r, pd, pt){
  const d = dayList(r).findIndex(x => x.date === pd); if(d < 0) return null;
  const m = toMin(pt); if(isNaN(m)) return null;
  const len = Number(tplOf(r).len) || 25;
  for(let s = 0; s < dayN(r, d); s++){ const a = slotStart(r, d, s); if(m >= a && m < a + len) return { d, s }; }
  return null;
}
/* 전화 상담 때 — «11/10(화) 18:00» · 비면 «시간 미정» */
export function phoneWhen(st){
  if(!st || st.k !== 'phone') return '';
  const a = st.pd ? dayLabel(st.pd, true) : '', b = st.pt || '';
  return (a || b) ? [a, b].filter(Boolean).join(' ') : '시간 미정';
}
export const phoneKey = st => `${(st && st.pd) || '9999-99-99'} ${(st && st.pt) || '99:99'}`;
/* ── 🧩 가정 특이 사항 (이번 상담만) — 안 되는 날 · ○시 이후 · ○시 전까지 · 안 되는 칸 · 메모 ── */
export function condMerge(list){
  const out = { noDays: [], after: '', before: '', noSlots: [], note: '' };
  const notes = [];
  (list || []).filter(Boolean).forEach(c => {
    (c.noDays || []).forEach(x => { if(x && !out.noDays.includes(x)) out.noDays.push(x); });
    (c.noSlots || []).forEach(x => { if(x && !out.noSlots.includes(x)) out.noSlots.push(x); });
    if(c.after && (!out.after || toMin(c.after) > toMin(out.after))) out.after = c.after;
    if(c.before && (!out.before || toMin(c.before) < toMin(out.before))) out.before = c.before;
    String(c.note || '').split(' · ').map(t => t.trim()).filter(Boolean).forEach(t => { if(!notes.includes(t)) notes.push(t); });
  });
  out.noDays.sort(); out.noSlots.sort(); out.note = notes.join(' · ');
  return out;
}
export const condOf = (r, ids) => condMerge((ids || []).map(id => ((r && r.cond) || {})[id]).filter(Boolean));
export const condHas = c => !!c && !!((c.noDays || []).length || c.after || c.before || (c.noSlots || []).length);
export const condAny = c => condHas(c) || !!(c && c.note);
/* 이 칸을 그 가정이 쓸 수 있나 — 이유 글 (괜찮으면 '') */
export function slotWhy(r, c, d, s){
  if(!condHas(c)) return '';
  const day = dayList(r)[d]; if(!day) return '없는 날';
  if((c.noDays || []).includes(day.date)) return `${dayLabel(day.date, true)} 안 됨`;
  if((c.noSlots || []).includes(`${day.date}_${s}`)) return `${dayLabel(day.date, true)} ${slotTime(r, d, s)} 안 됨`;
  const a = slotStart(r, d, s), len = Number(tplOf(r).len) || 25;
  if(c.after && a < toMin(c.after)) return `${c.after} 이후만`;
  if(c.before && a + len > toMin(c.before)) return `${c.before} 전까지만`;
  return '';
}
export const slotOk = (r, c, d, s) => !slotWhy(r, c, d, s);
export function condText(c, opt){
  if(!c) return '';
  opt = opt || {};
  const WDs = (c.noDays || []).map(x => dayLabel(x, true));
  const bits = [];
  if(WDs.length) bits.push(`${WDs.join(' · ')} 안 됨`);
  if(c.after && c.before) bits.push(`${c.after}~${c.before}만`);
  else if(c.after) bits.push(`${c.after} 이후만`);
  else if(c.before) bits.push(`${c.before} 전까지만`);
  if((c.noSlots || []).length) bits.push(`안 되는 칸 ${c.noSlots.length}`);
  if(c.note && !opt.noNote) bits.push(c.note);
  return bits.join(' · ');
}
/* 학부모께 나간 판 (초안 → 수정 1 → 수정 2 … → 최종) */
export const pubsOf = r => ((r && r.pubs) || []).slice().sort((a, b) => (a.n || 0) - (b.n || 0));
/* v155 마지막 판 — 새로는 «최종» · v154 까지 저장한 «확정»도 같은 판 · 화면 · 인쇄에는 모두 «최종» */
export const FINAL_LABEL = '최종';
export const isFinalPub = p => !!p && (p.label === FINAL_LABEL || p.label === '확정');
export const pubName = p => !p ? '' : isFinalPub(p) ? FINAL_LABEL : String(p.label || '');
export const pubLabel = n => n ? `수정 ${n}` : '초안';
/* «…으로 / …로» — 받침이 있으면(ㄹ 빼고) 으로 · 숫자는 3 · 6 · 0 만 으로 */
export function ro(w){
  const c = String(w || '').trim().slice(-1);
  if(/[0-9]/.test(c)) return /[360]/.test(c) ? '으로' : '로';
  const k = c.charCodeAt(0) - 0xAC00; if(k < 0 || k > 11171) return '로';
  const jong = k % 28; return jong && jong !== 8 ? '으로' : '로';
}
export function nextPubLabel(r){ const p = pubsOf(r).filter(x => !isFinalPub(x)); return pubLabel(p.length); }
/* 단계 (띠) — 1 준비 · 2 초안 편성 · 3 담임 확인 · 4 학부모 확인 (초안 · 수정 n 을 학부모께 보내고 변경 요청 반영) · 5 최종 반영
   · 4 는 «학부모께 초안 보내기»를 한 뒤부터 · 5 «최종 반영»은 4 를 거친 뒤에만 (canFinal) */
export function stepNo(r){
  if(!r) return 1;
  if(r.state === 'closed') return 6;
  if(r.state === 'final') return 5;
  if(r.state === 'review') return pubsOf(r).length ? 4 : 3;
  return r.state === 'draft' ? 2 : 1;
}
export const canFinal = r => !!r && r.state === 'review' && pubsOf(r).some(p => !isFinalPub(p));

/* ── 학년 · 세로줄 ── */
export function gradeNoOf(g){ const m = /(\d+)\s*학년/.exec(String(g || '')); return m ? +m[1] : 0; }
function baseGrade(g){ const m = /^\s*(\d+\s*학년)/.exec(String(g || '')); return m ? m[1].replace(/\s+/g, '') : String(g || '').trim(); }
export function classGrades(c){
  const set = [];
  const add = g => { g = baseGrade(g); if(g && !set.includes(g)) set.push(g); };
  (Array.isArray(c.gradeList) ? c.gradeList : []).forEach(add);
  if(!set.length && c.grade) String(c.grade).split(/[·,/]/).forEach(add);
  Object.values(c.grades || {}).forEach(add);
  return set.sort((a, b) => gradeNoOf(a) - gradeNoOf(b));
}
/* «8학년 · 9학년» → «8·9학년» */
export function gradesLabel(list){
  const nums = (list || []).map(gradeNoOf).filter(Boolean);
  if(nums.length && nums.length === (list || []).length) return nums.join('·') + '학년';
  return (list || []).join(' · ');
}
/* 교실 이름 맞추기 — 시간표 › 교실 배치(timetableRooms) 에서 반 이름이 들어간 교실 */
export function roomGuess(floors, cname){
  const n = String(cname || '').replace(/\s+/g, '');
  if(!n) return '';
  for(const f of (floors || [])) for(const rm of (f.rooms || [])){
    const rn = String(rm.name || '').replace(/\s+/g, '');
    if(rn && (rn.includes(n) || n.includes(rn))) return [f.name, rm.name].filter(Boolean).join(' ');
  }
  return '';
}
export function roomOptions(floors){
  const out = [];
  (floors || []).forEach(f => (f.rooms || []).forEach(rm => { const t = [f.name, rm.name].filter(Boolean).join(' '); if(t && !out.includes(t)) out.push(t); }));
  return out;
}
/* 반편성 → 세로줄 (그 해 · 그 기관 · 학생이 있는 반 · 학년 순) */
export function colsFromClasses(classes, year, org, floors, staffName){
  return (classes || []).filter(c => c && !c.deleted && (c.org || ORG) === (org || ORG) && Number(c.year) === Number(year) && (c.students || []).length)
    .map(c => { const gs = classGrades(c); return { key: c.id, classId: c.id, name: c.name || '', grades: gradesLabel(gs), gno: gradeNoOf(gs[0]) || 99,
      uid: c.teacherUid || '', tname: (staffName && staffName(c.teacherUid)) || '', room: roomGuess(floors, c.name), off: [] }; })
    .sort((a, b) => a.gno - b.gno || cmpKo(a.name, b.name))
    .map(({ gno, ...x }) => x);
}
export const colLabel = c => c ? `${c.grades ? c.grades + ' ' : ''}${c.name || ''}`.trim() : '';

/* ── 대상 학생 ── */
const GONE = { quit: 1, grad: 1, egrad: 1 };
const md = ds => { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(ds || '')); return m ? `${+m[1]}/${+m[2]}` : ''; };
/* 상담 날짜들 기준 판정 — St = StuStatus (student-status.js)
   돌려줌: { auto: 1|0, flag: '', why: '', gone } — flag 가 있으면 «확인 필요» */
export function judge(s, dates, today, St){
  const stored = (s && s.status) || 'active';
  if(!s || s.deleted) return { auto: 0, gone: true, why: '지운 학생', flag: '' };
  if(GONE[stored]) return { auto: 0, gone: true, why: { quit: '자퇴', grad: '졸업', egrad: '조기졸업' }[stored], flag: '' };
  dates = (dates || []).filter(Boolean);
  const first = dates[0] || today, last = dates[dates.length - 1] || first;
  const st0 = St.status(s, first), stN = St.status(s, today);
  const each = dates.map(ds => St.status(s, ds));
  const mixed = each.some(x => x !== each[0]);
  const lv = St.period(s, first) || St.period(s, today);
  if(mixed){
    const i = each.findIndex(x => x !== each[0]);
    return { auto: st0 === 'active' ? 1 : 0, why: st0 === 'active' ? '재학' : '휴학',
      flag: st0 === 'active' ? `재학 · ${md(dates[i])}부터 휴학 (상담 기간 가운데) — 상담하고 갈지 확인` : `휴학 · ${md(dates[i])}부터 재학 (상담 기간 가운데 복학)` };
  }
  if(st0 === 'active'){
    if(stN === 'leave') return { auto: 1, why: '재학', flag: `지금 휴학 · ${lv && lv.end ? md(lv.end) + '까지 → ' : ''}상담 때는 재학 (복학 예정)` };
    return { auto: 1, why: '재학', flag: '' };
  }
  // 상담 때 휴학
  if(stN === 'active'){
    const p = St.period(s, first);
    return { auto: 0, why: '휴학', flag: `지금 재학 · ${p ? md(p.start) + '부터 ' : ''}휴학 예정 → 상담 때는 휴학` };
  }
  const p = St.period(s, first);
  if(p && !p.end) return { auto: 0, why: '휴학', flag: '휴학 · 복학일 미정 — 복학 상담을 하려면 넣기' };
  return { auto: 0, why: '휴학', flag: `휴학${p && p.end ? ' · ' + md(p.end) + '까지' : ''}` };
}
/* 대상 목록 — 세로줄(반)의 학생들 · 넣기/빼기 반영
   돌려줌: { list:[{ sid, col, name, grade, in, auto, flag, why, man }], byCol } */
export function scopeOf(r, classesById, studentsById, today, St){
  const dates = dayList(r).map(d => d.date);
  const inc = (r && r.inc) || {};
  const out = []; const seen = new Set();
  (r.cols || []).forEach(col => {
    const ids = [];
    (col.classIds || [col.classId || col.key]).forEach(cid => { const c = classesById[cid]; if(c) (c.students || []).forEach(id => { if(!ids.includes(id)) ids.push(id); }); });
    const c0 = classesById[col.classId || col.key] || {};
    ids.forEach(sid => {
      if(seen.has(sid)) return; seen.add(sid);
      const s = studentsById[sid];
      const j = judge(s, dates, today, St);
      if(j.gone && !(sid in inc)) return;
      const man = sid in inc;
      out.push({ sid, col: col.key, name: (s && s.name) || ((r.stu || {})[sid] || {}).n || '(이름 없음)', grade: baseGrade((c0.grades || {})[sid] || '') || col.grades || '',
        auto: j.auto, in: man ? !!inc[sid] : !!j.auto, man, flag: j.flag, why: j.why, gone: !!j.gone });
    });
  });
  out.sort((a, b) => cmpKo(a.name, b.name));
  return out;
}

/* ── 가정 (형제) — 학생관리 형제 연결(students.siblings) 로 묶음 · 대상 안에서만 ── */
export function familiesOf(sids, studentsById, extraPairs){
  const set = new Set(sids); const par = {};
  const find = x => { while(par[x] !== x){ par[x] = par[par[x]]; x = par[x]; } return x; };
  const join = (a, b) => { a = find(a); b = find(b); if(a !== b){ if(a < b) par[b] = a; else par[a] = b; } };
  sids.forEach(id => { par[id] = id; });
  sids.forEach(id => { const s = studentsById[id]; ((s && s.siblings) || []).forEach(o => { if(set.has(o)) join(id, o); }); });
  (extraPairs || []).forEach(([a, b]) => { if(set.has(a) && set.has(b)) join(a, b); });
  const fam = {}; const members = {};
  sids.forEach(id => { const k = find(id); fam[id] = k; (members[k] = members[k] || []).push(id); });
  return { fam, members };
}
/* 보호자 번호가 같은데 형제로 안 묶인 학생 (묶을까요?) */
export function phonePairs(sids, studentsById, fam){
  const by = {}; const norm = p => String(p || '').replace(/\D/g, '');
  sids.forEach(id => { const s = studentsById[id]; const p = norm(s && s.guardianPhone); if(p.length >= 9) (by[p] = by[p] || []).push(id); });
  const out = [];
  Object.values(by).forEach(ids => { for(let i = 0; i < ids.length; i++) for(let j = i + 1; j < ids.length; j++) if(fam[ids[i]] !== fam[ids[j]]) out.push([ids[i], ids[j]]); });
  return out;
}
/* 가정 색 (같은 색 + 같은 번호 = 한 가정 · 흑백으로 뽑아도 번호로 가름) */
export const FAM_COLORS = [
  ['#FDE2C8', '#7A3E0B'], ['#D6E6FF', '#1E4E8C'], ['#E1F2D3', '#35601A'], ['#F6D9EC', '#7D2459'], ['#E6E0FA', '#47378A'], ['#D3EFEB', '#1B615A'],
  ['#FFF0B3', '#6E5100'], ['#EBDCCB', '#64442A'], ['#FFD9D6', '#8A2A20'], ['#DCEBF7', '#244E6E'], ['#EEF5C8', '#4F5A12'], ['#F0DDF7', '#62307A'],
];
export const NUM_MARK = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚';
export function famStyles(members, nameOf){
  const keys = Object.keys(members).filter(k => members[k].length > 1)
    .sort((a, b) => cmpKo(nameOf(members[a][0]), nameOf(members[b][0])));
  const out = {};
  keys.forEach((k, i) => { const c = FAM_COLORS[i % FAM_COLORS.length]; out[k] = { bg: c[0], fg: c[1], no: i + 1, mark: NUM_MARK[i] || String(i + 1) }; });
  return out;
}

/* ── 자리 위치 («맨 앞 · 가운데 · 맨 뒤») — 다음 학기 순번 점검용 ── */
export function posOf(r, seat){
  if(!seat) return '';
  if(seat.k === 'phone' || seat.k === 'sep') return 'b';
  const D = dayList(r).length;
  if(seat.d === 0 && seat.s < FRONT_SLOTS) return 'f';
  if(D > 1 && seat.d === D - 1) return 'b';
  return 'm';
}
export const POS_KO = { f: '앞', m: '가운데', b: '뒤' };
export function histOf(r){ const h = {}; Object.entries((r && r.seats) || {}).forEach(([sid, st]) => { const p = posOf(r, st); if(p) h[sid] = p; }); return h; }

/* ── 순서 ── */
/* 지난 상담(들)에서 가정마다 지난 자리 — rounds 는 최근 것부터 */
export function lastPosFor(sids, rounds){
  const out = {};
  sids.forEach(sid => { for(const r of (rounds || [])){ const h = r.hist || histOf(r); if(h[sid]){ out[sid] = h[sid]; break; } } });
  return out;
}
export function famScore(ids, rounds){
  const V = { f: 0, m: 0.5, b: 1 }; let n = 0, t = 0;
  (rounds || []).slice(0, 3).forEach(r => { const h = r.hist || histOf(r); const ps = ids.map(id => h[id]).filter(Boolean); if(ps.length){ n++; t += Math.min(...ps.map(p => V[p])); } });
  return n ? t / n : 0.5;
}
/* 이번 방향 — «지난번과 반대»면 지난 상담 방향의 반대 (처음이면 ㄱ→ㅎ) */
export function dirFor(opt, prevDir){
  if(opt.order === 'asc' || opt.order === 'desc') return opt.order;
  if(opt.order === 'flip') return prevDir === 'asc' ? 'desc' : (prevDir === 'desc' ? 'asc' : 'asc');
  return 'asc';
}
/* 가정 순서 — 돌려줌 { order:[famKey], dir, notes:[] } */
export function orderFamilies(members, nameOf, opt, rounds, prevDir){
  const dir = dirFor(opt, prevDir);
  const keyName = k => { const ns = members[k].map(nameOf).sort(cmpKo); return dir === 'desc' ? ns[ns.length - 1] : ns[0]; };
  let keys = Object.keys(members);
  keys.sort((a, b) => (dir === 'desc' ? -1 : 1) * cmpKo(keyName(a), keyName(b)) || cmpKo(a, b));
  const notes = [];
  if(opt.order === 'fair'){
    const sc = {}; keys.forEach(k => { sc[k] = famScore(members[k], rounds); });
    keys = keys.slice().sort((a, b) => sc[b] - sc[a]);   // 지난번 뒤였던 가정부터 (같으면 가나다)
  }
  if(opt.guardBack && rounds && rounds.length){
    const last = lastPosFor(Object.values(members).flat(), rounds);
    const back = keys.filter(k => members[k].some(id => last[id] === 'b'));
    if(back.length && opt.order !== 'fair'){
      // 지난번 맨 뒤(마지막 날 · 전화 · 별도)였던 가정은 이번엔 앞쪽 절반 안에 섞어서
      const rest = keys.filter(k => !back.includes(k));
      const half = Math.ceil(rest.length / 2);
      const mixed = []; let bi = 0;
      rest.slice(0, half).forEach((k, i) => { mixed.push(k); if(bi < back.length && i % 2 === 1) mixed.push(back[bi++]); });
      while(bi < back.length) mixed.push(back[bi++]);
      keys = mixed.concat(rest.slice(half));
      notes.push(`지난번 맨 뒤였던 ${back.length}가정은 앞쪽으로`);
    }
  }
  return { order: keys, dir, notes };
}

/* ═══ 자동 배치 ═══
   ctx = { r, scope:[{sid,col,in,name}], studentsById, kids:{sid: staffUid}, rounds:[지난 상담 · 최근 것부터], prevDir }
   · 고정(pin) 칸 · 전화 · 별도는 그대로 두고 나머지를 다시 배치
   · 돌려줌 { seats, unplaced:[sid], notes:[], dir } */
export function autoPlace(ctx){
  const r = ctx.r, opt = optOf(r);
  const cols = (r.cols || []).map(c => c.key);
  const colIdx = {}; cols.forEach((k, i) => { colIdx[k] = i; });
  const D = dayList(r).length;
  const inScope = (ctx.scope || []).filter(x => x.in);
  const colOf = {}; const nameOf = {}; inScope.forEach(x => { colOf[x.sid] = x.col; nameOf[x.sid] = x.name; });
  const nm = sid => nameOf[sid] || '';
  const old = r.seats || {};
  const seats = {};
  // 칸 지도 G[col][d][s] = sid | 'X'(못 하는 시간)
  const G = {}; cols.forEach(k => { G[k] = []; for(let d = 0; d < D; d++) G[k].push(new Array(dayN(r, d)).fill(null)); });
  (r.cols || []).forEach(c => (c.off || []).forEach(o => { const [d, s] = String(o).split('_').map(Number); if(G[c.key] && G[c.key][d] && s < G[c.key][d].length) G[c.key][d][s] = 'X'; }));
  const free = (c, d, s) => G[c] && G[c][d] && s >= 0 && s < G[c][d].length && G[c][d][s] === null;
  const take = (sid, d, s) => { G[colOf[sid]][d][s] = sid; seats[sid] = { d, s, k: 'face' }; };
  // ① 그대로 둘 자리 — 고정 · 전화 · 별도
  inScope.forEach(x => {
    const st = old[x.sid]; if(!st) return;
    if(st.k === 'phone' || st.k === 'sep'){ seats[x.sid] = Object.assign({}, st); return; }
    if(st.pin && free(x.col, st.d, st.s)){ G[x.col][st.d][st.s] = x.sid; seats[x.sid] = Object.assign({}, st); }
  });
  const todo = inScope.filter(x => !seats[x.sid]).map(x => x.sid);
  const { members } = familiesOf(inScope.map(x => x.sid), ctx.studentsById || {}, ctx.extraPairs);
  // 남은(배치할) 학생만 가정으로
  const fams = {}; Object.entries(members).forEach(([k, ids]) => { const t = ids.filter(id => todo.includes(id)); if(t.length) fams[k] = t; });
  const { order, dir, notes } = orderFamilies(fams, nm, opt, ctx.rounds || [], ctx.prevDir);
  const last = (opt.guardFront && (ctx.rounds || []).length) ? lastPosFor(todo, ctx.rounds) : {};
  const kids = ctx.kids || {};
  const parentCol = uid => { const c = (r.cols || []).find(c => c.uid === uid); return c ? c.key : ''; };
  const kidFam = k => fams[k].some(id => kids[id] && parentCol(kids[id]) && parentCol(kids[id]) !== colOf[id]);
  // 🧩 특이 사항 있는 가정은 먼저 (맞는 칸이 좁으니까) · 조건은 가정 모두에게
  const fc = {}; Object.keys(fams).forEach(k => { fc[k] = condOf(r, members[k] || fams[k]); });
  const hasC = k => condHas(fc[k]);
  const normal = order.filter(k => !kidFam(k) && hasC(k)).concat(order.filter(k => !kidFam(k) && !hasC(k))), kidList = order.filter(k => kidFam(k));
  const condNote = normal.some(hasC) ? `🧩 특이 사항이 있는 ${normal.filter(hasC).length}가정을 먼저 맞는 칸에 잡음` : '';
  // 날마다 줄마다 상담 수 (고르게 채우기)
  const load = (c, d) => G[c][d].filter(v => v && v !== 'X').length;
  const target = {}; cols.forEach(c => { const n = inScope.filter(x => x.col === c).length; target[c] = Math.max(1, Math.ceil(n / Math.max(1, D))); });
  const perms = a => a.length <= 1 ? [a.slice()] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
  const step = { next: 1, gap1: 2 };
  // 한 가정 자리 찾기 — cand(d, s) = 이 칸을 써도 되나 (앞자리 · 교직원 자녀 조건)
  function tryChain(ids, mode, okSlot, evenPass, dayOrder){
    const ps = ids.length > 5 ? [ids] : perms(ids.slice().sort((a, b) => colIdx[colOf[b]] - colIdx[colOf[a]]));
    for(const d of dayOrder){
      const n = dayN(r, d);
      if(mode === 'day'){
        for(const p of ps){
          const got = []; let s = 0; let ok = true;
          for(const id of p){
            while(s < n && !(free(colOf[id], d, s) && okSlot(d, s, id) && (!evenPass || load(colOf[id], d) < target[colOf[id]]))) s++;
            if(s >= n){ ok = false; break; }
            got.push([id, d, s]); s++;
          }
          if(ok) return got;
        }
        continue;
      }
      const st = step[mode];
      for(let s0 = 0; s0 < n; s0++){
        for(const p of ps){
          let ok = true; const got = [];
          for(let i = 0; i < p.length; i++){
            const s = s0 + i * st, c = colOf[p[i]];
            if(!(free(c, d, s) && okSlot(d, s, p[i]) && (!evenPass || load(c, d) < target[c]))){ ok = false; break; }
            got.push([p[i], d, s]);
          }
          if(ok) return got;
        }
      }
    }
    return null;
  }
  const allDays = [...Array(D).keys()];
  function place(k, okSlot0, fromEnd){
    const ids = fams[k];
    const okSlot = (d, s, id) => okSlot0(d, s, id) && slotOk(r, fc[k], d, s);
    const modes = ids.length < 2 ? ['next'] : (opt.sib === 'day' ? ['day'] : opt.sib === 'gap1' ? ['gap1', 'next', 'day'] : ['next', 'gap1', 'day']);
    const dayOrders = [];
    if(opt.fill === 'even' && !fromEnd){
      const byLoad = allDays.slice().sort((a, b) => ids.reduce((t, id) => t + load(colOf[id], a), 0) - ids.reduce((t, id) => t + load(colOf[id], b), 0) || a - b);
      dayOrders.push([byLoad, true]);
    }
    dayOrders.push([fromEnd ? allDays.slice().reverse() : allDays, false]);
    for(const [dorder, even] of dayOrders){
      for(const m of modes){
        let got;
        if(fromEnd){
          // 뒤에서부터 — 날을 뒤에서부터 보고 그날 안에서는 가장 늦은 칸
          got = null;
          for(const d of dorder){
            const n = dayN(r, d);
            const ps = perms(ids);
            for(let s0 = n - 1; s0 >= 0 && !got; s0--){
              for(const p of ps){
                const st = m === 'gap1' ? 2 : 1; let ok = true; const g = [];
                for(let i = 0; i < p.length; i++){ const s = s0 - (p.length - 1 - i) * st; if(!(free(colOf[p[i]], d, s) && okSlot(d, s, p[i]))){ ok = false; break; } g.push([p[i], d, s]); }
                if(ok){ got = g; break; }
              }
            }
            if(got) break;
          }
        } else got = tryChain(ids, m, okSlot, even, dorder);
        if(got){ got.forEach(([id, d, s]) => take(id, d, s)); return m; }
      }
    }
    // 형제를 이어서 못 잡으면 한 명씩 (점검에서 «형제 떨어짐»)
    let all = true;
    ids.forEach(id => {
      for(const d of (fromEnd ? allDays.slice().reverse() : allDays)){
        const n = dayN(r, d);
        let s = fromEnd ? n - 1 : 0;
        const busyAt = (dd, ss) => Object.entries(seats).some(([o, st]) => fams[k].includes(o) && st.k === 'face' && st.d === dd && st.s === ss);
        while(s >= 0 && s < n && !(free(colOf[id], d, s) && okSlot(d, s, id) && !busyAt(d, s))) s += fromEnd ? -1 : 1;
        if(s >= 0 && s < n){ take(id, d, s); return; }
      }
      all = false;
    });
    return all ? 'split' : 'none';
  }
  // ② 일반 가정
  let avoided = 0;
  normal.forEach(k => {
    const wasFront = fams[k].some(id => last[id] === 'f');
    const ok = (d, s) => !(wasFront && d === 0 && s < FRONT_SLOTS);
    let how = place(k, ok);
    if(how === 'none' && hasC(k)){ const keep = fc[k], allIds = fams[k]; fc[k] = null; fams[k] = allIds.filter(id => !seats[id]); how = place(k, ok); fc[k] = keep; fams[k] = allIds; notes.push(`🧩 ${nm(fams[k][0])} 가정 — 특이 사항에 맞는 칸이 없어 우선 다른 칸에 (점검에서 확인)`); }
    if(wasFront) avoided++;
    if(how === 'split' && fams[k].length > 1) notes.push(`${nm(fams[k][0])} 가정 — 형제 시간을 잇지 못함`);
  });
  if(avoided) notes.unshift(`지난번 맨 앞(첫날 첫째 · 둘째)이던 ${avoided}가정은 이번에 그 자리를 피함`);
  if(condNote) notes.unshift(condNote);
  // ③ 교직원 자녀 — 부모 선생님의 상담이 다 끝난 뒤 (또는 마지막 · 별도)
  kidList.forEach(k => {
    const pcs = uniq(fams[k].map(id => kids[id] && parentCol(kids[id])).filter(c => c));
    if(opt.kid === 'sep'){ fams[k].forEach(id => { seats[id] = { k: 'sep', note: '교직원 자녀 · 따로 정함' }; }); return; }
    const lastBusy = c => { let li = -1; for(let d = 0; d < D; d++) for(let s = 0; s < G[c][d].length; s++){ const v = G[c][d][s]; if(v && v !== 'X') li = Math.max(li, slotIdx(r, d, s)); } return li; };
    const after = Math.max(-1, ...pcs.map(lastBusy));
    const ok = (d, s) => slotIdx(r, d, s) > after && pcs.every(c => !(G[c][d] && G[c][d][s] && G[c][d][s] !== 'X'));
    const how = place(k, ok, opt.kid === 'last');
    if(how === 'none'){ fams[k].filter(id => !seats[id]).forEach(id => { seats[id] = { k: 'sep', note: '교직원 자녀 · 빈 칸 없음' }; }); notes.push(`${nm(fams[k][0])} — 교직원 자녀 자리가 없어 별도 일정으로`); }
  });
  const unplaced = todo.filter(id => !seats[id]);
  // 메모 · 고정 이어 주기
  Object.keys(seats).forEach(id => { const o = old[id]; if(o && o.note && !seats[id].note) seats[id].note = o.note; });
  return { seats, unplaced, notes, dir };
}

/* ═══ 점검 ═══
   돌려줌 { issues:[{ lvl:'err'|'warn'|'info', code, sids, text }], sum } */
export function check(r, ctx){
  const opt = optOf(r);
  const seats = r.seats || {};
  const scope = (ctx.scope || []).filter(x => x.in);
  const colOf = {}; const nameOf = {}; scope.forEach(x => { colOf[x.sid] = x.col; nameOf[x.sid] = x.name; });
  const nm = id => nameOf[id] || ((r.stu || {})[id] || {}).n || '';
  const issues = [];
  const at = {};   // 'c|d|s' → [sid]
  const face = Object.entries(seats).filter(([id, st]) => st && st.k === 'face' && colOf[id] !== undefined);
  face.forEach(([id, st]) => { const k = `${colOf[id]}|${st.d}|${st.s}`; (at[k] = at[k] || []).push(id); });
  Object.entries(at).forEach(([k, ids]) => { if(ids.length > 1) issues.push({ lvl: 'err', code: 'double', sids: ids, text: `한 칸에 두 명 — ${ids.map(nm).join(' · ')}` }); });
  // 못 하는 시간
  (r.cols || []).forEach(c => (c.off || []).forEach(o => { const [d, s] = String(o).split('_').map(Number); const ids = at[`${c.key}|${d}|${s}`]; if(ids) issues.push({ lvl: 'err', code: 'off', sids: ids, text: `${c.tname || c.name} 못 하는 시간 — ${ids.map(nm).join(' · ')}` }); }));
  // 범위 밖
  face.forEach(([id, st]) => { if(st.d >= dayList(r).length || st.s >= dayN(r, st.d)) issues.push({ lvl: 'err', code: 'range', sids: [id], text: `없는 칸 — ${nm(id)} (날짜 · 칸 수가 바뀜)` }); });
  // 가정
  const { fam, members } = familiesOf(scope.map(x => x.sid), ctx.studentsById || {}, ctx.extraPairs);
  let famN = 0, famOk = 0;
  Object.values(members).filter(ids => ids.length > 1).forEach(ids => {
    famN++;
    const fs = ids.map(id => [id, seats[id]]).filter(([, st]) => st && st.k === 'face');
    const tk = {}; let clash = false;
    fs.forEach(([id, st]) => { const k = `${st.d}|${st.s}`; if(tk[k]) clash = true; tk[k] = 1; });
    if(clash){ issues.push({ lvl: 'err', code: 'famClash', sids: ids, text: `한 가정이 같은 시간에 두 곳 — ${ids.map(nm).join(' · ')}` }); return; }
    if(fs.length < 2){ famOk++; return; }
    const days = uniq(fs.map(([, st]) => st.d));
    const sorted = fs.map(([, st]) => st.s).sort((a, b) => a - b);
    let gapMax = 0; for(let i = 1; i < sorted.length; i++) gapMax = Math.max(gapMax, sorted[i] - sorted[i - 1] - 1);
    const want = opt.sib === 'gap1' ? 1 : 0;
    if(days.length > 1) issues.push({ lvl: 'warn', code: 'sibDay', sids: ids, text: `형제가 다른 날 — ${ids.map(nm).join(' · ')}` });
    else if(opt.sib !== 'day' && gapMax > want) issues.push({ lvl: 'warn', code: 'sibGap', sids: ids, text: `형제 시간 ${gapMax}칸 떨어짐 — ${ids.map(nm).join(' · ')}` });
    else famOk++;
  });
  // 교직원 자녀 — 부모 선생님이 상담하는 시간과 겹치면
  const kids = ctx.kids || {};
  let kidN = 0;
  Object.entries(kids).forEach(([id, uid]) => {
    if(colOf[id] === undefined) return;
    kidN++;
    const st = seats[id]; if(!st || st.k !== 'face') return;
    const c = (r.cols || []).find(c => c.uid === uid); if(!c || c.key === colOf[id]) return;
    const ids = at[`${c.key}|${st.d}|${st.s}`];
    if(ids && ids.length) issues.push({ lvl: 'err', code: 'kid', sids: [id].concat(ids), text: `${nm(id)} — 부모 선생님(${c.tname || c.name})이 그 시간에 상담 중` });
  });
  // 앞자리 연속
  let frontRep = 0;
  if(opt.guardFront && (ctx.rounds || []).length){
    const last = lastPosFor(scope.map(x => x.sid), ctx.rounds);
    const reps = Object.values(members).filter(ids => ids.some(id => posOf(r, seats[id]) === 'f') && ids.some(id => last[id] === 'f'));
    frontRep = reps.length;
    reps.forEach(ids => issues.push({ lvl: 'warn', code: 'front', sids: ids, text: `두 번 연속 맨 앞 — ${ids.map(nm).join(' · ')}` }));
  }
  // 🧩 가정 특이 사항 — 대면 자리가 조건에 안 맞으면
  let condN = 0, condBad = 0;
  Object.values(members).forEach(ids => {
    const c = condOf(r, ids); if(!condAny(c)) return;
    condN++;
    let bad = false;
    ids.forEach(id => { const st = seats[id]; if(!st || st.k !== 'face') return; const why = slotWhy(r, c, st.d, st.s); if(why){ bad = true; issues.push({ lvl: 'err', code: 'cond', sids: [id], text: `🧩 ${nm(id)} — ${why} (지금 ${dayLabel((dayList(r)[st.d] || {}).date, true)} ${slotTime(r, st.d, st.s)})` }); } });
    if(bad) condBad++;
  });
  // ☎ 전화 상담 — 그 시간에 담임이 대면 상담 중 · 가정이 대면 상담 중 · 같은 선생님 전화 두 건
  let phoneN = 0, phoneNoTime = 0;
  const phAt = {};
  Object.entries(seats).forEach(([id, st]) => {
    if(!st || st.k !== 'phone' || colOf[id] === undefined) return;
    phoneN++;
    if(!st.pd || !st.pt){ phoneNoTime++; return; }
    const pk = `${colOf[id]}|${st.pd}|${st.pt}`; (phAt[pk] = phAt[pk] || []).push(id);
    const sl = slotAt(r, st.pd, st.pt); if(!sl) return;
    const busy = (at[`${colOf[id]}|${sl.d}|${sl.s}`] || []).filter(o => o !== id);
    const c = (r.cols || []).find(c => c.key === colOf[id]);
    if(busy.length) issues.push({ lvl: 'warn', code: 'phone', sids: [id].concat(busy), text: `☎ ${nm(id)} 전화 시간에 ${c ? c.tname || c.name : '담임'} 대면 상담 중 (${busy.map(nm).join(' · ')})` });
    const k = fam[id]; const sib = k ? (members[k] || []).filter(o => o !== id && seats[o] && seats[o].k === 'face' && seats[o].d === sl.d && seats[o].s === sl.s) : [];
    if(sib.length) issues.push({ lvl: 'warn', code: 'phone', sids: [id].concat(sib), text: `☎ ${nm(id)} 전화 시간에 형제 ${sib.map(nm).join(' · ')} 대면 상담` });
  });
  Object.values(phAt).forEach(ids => { if(ids.length > 1) issues.push({ lvl: 'warn', code: 'phone', sids: ids, text: `☎ 같은 선생님 같은 시각 전화 ${ids.length}건 — ${ids.map(nm).join(' · ')}` }); });
  const unplaced = scope.filter(x => !seats[x.sid]).map(x => x.sid);
  if(unplaced.length) issues.push({ lvl: 'warn', code: 'unplaced', sids: unplaced, text: `자리 없는 학생 ${unplaced.length}명 — ${unplaced.slice(0, 6).map(nm).join(' · ')}${unplaced.length > 6 ? ' …' : ''}` });
  const vac = Object.keys(r.vac || {}).length;
  const n = { face: 0, phone: 0, sep: 0 };
  scope.forEach(x => { const st = seats[x.sid]; if(st) n[st.k || 'face']++; });
  return { issues, sum: { famN, famOk, kidN, frontRep, unplaced: unplaced.length, vac, n, total: scope.length, phoneN, phoneNoTime, condN, condBad } };
}

/* ── 손으로 옮기기 — 같은 세로줄 안: 빈 칸이면 옮기고 · 사람이 있으면 서로 바꿈 ──
   돌려줌 patch { sid: seat|null } (null = 자리 지움) */
export function movePatch(r, colOf, sid, to){
  const seats = r.seats || {};
  const cur = seats[sid] || null;
  const patch = {};
  if(to.k === 'phone' || to.k === 'sep'){
    patch[sid] = Object.assign({}, cur || {}, { k: to.k, note: to.note != null ? to.note : ((cur && cur.note) || '') });
    delete patch[sid].d; delete patch[sid].s;
    if(to.k === 'phone'){ patch[sid].pd = to.pd != null ? to.pd : ((cur && cur.pd) || ''); patch[sid].pt = to.pt != null ? to.pt : ((cur && cur.pt) || ''); }
    else { delete patch[sid].pd; delete patch[sid].pt; }
    return patch;
  }
  if(to.k === 'none'){ patch[sid] = null; return patch; }
  const other = Object.keys(seats).find(o => o !== sid && colOf[o] === colOf[sid] && seats[o] && seats[o].k === 'face' && seats[o].d === to.d && seats[o].s === to.s);
  patch[sid] = Object.assign({}, cur || {}, { k: 'face', d: to.d, s: to.s }); delete patch[sid].pd; delete patch[sid].pt;
  if(other){
    if(cur && cur.k === 'face') patch[other] = Object.assign({}, seats[other], { d: cur.d, s: cur.s });
    else patch[other] = null;   // 빈 자리에서 끌어와 사람 칸에 놓으면 그 사람은 «자리 없음»으로
  }
  return patch;
}
/* 날짜를 바꿀 때 자리 따라가기 — 같은 날짜로 (없어진 날의 자리는 빠짐 → «넣을 학생») */
export function remapDays(r, newDays){
  const oldL = dayList(r).map(d => d.date);
  const newL = (newDays || []).filter(d => d && d.date && !d.off).map(d => d.date);
  const map = {}; oldL.forEach((ds, i) => { map[i] = newL.indexOf(ds); });
  const fix = seats => { const out = {}; let lost = 0; Object.entries(seats || {}).forEach(([id, st]) => { if(!st) return; if(st.k !== 'face'){ out[id] = st; return; } const j = map[st.d]; if(j == null || j < 0){ lost++; return; } out[id] = Object.assign({}, st, { d: j }); }); return { out, lost }; };
  const a = fix(r.seats), b = r.sentSeats ? fix(r.sentSeats) : null;
  const cols = (r.cols || []).map(c => Object.assign({}, c, { off: (c.off || []).map(o => { const [d, s] = String(o).split('_').map(Number); const j = map[d]; return j != null && j >= 0 ? j + '_' + s : null; }).filter(Boolean) }));
  const same = oldL.length === newL.length && oldL.every((x, i) => x === newL[i]);
  return { seats: a.out, sentSeats: b ? b.out : null, cols, lost: a.lost, same };
}
/* 판 비교 — 바뀐 학생 */
export function diffSeats(a, b){
  const ks = uniq(Object.keys(a || {}).concat(Object.keys(b || {})));
  const J = v => JSON.stringify(v ? (v.k === 'phone' ? { k: 'phone', pd: v.pd || '', pt: v.pt || '' } : v.k === 'sep' ? { k: 'sep', note: v.note || '' } : { d: v.d, s: v.s, k: v.k }) : null);
  return ks.filter(k => J((a || {})[k]) !== J((b || {})[k]));
}

/* ── 빈 칸 찾기 (변경 요청 · 넣을 학생) — 형제 함께 · 다른 가정은 그대로
   want = [{ d, s }] 원하는 칸(첫 칸) 또는 { d } 날만 · 돌려줌 [[sid, d, s], …] | null */
export function findSpot(r, colOf, ids, want, opt){
  opt = Object.assign({}, optOf(r), opt || {});
  const seats = r.seats || {};
  const D = dayList(r).length;
  const busy = {};
  Object.entries(seats).forEach(([id, st]) => { if(st && st.k === 'face' && !ids.includes(id)) busy[`${colOf[id]}|${st.d}|${st.s}`] = 1; });
  (r.cols || []).forEach(c => (c.off || []).forEach(o => { busy[`${c.key}|${o.replace('_', '|')}`] = 1; }));
  const cd = opt.noCond ? null : (opt.cond || condOf(r, ids));
  const freeAt = (id, d, s) => s >= 0 && s < dayN(r, d) && !busy[`${colOf[id]}|${d}|${s}`] && slotOk(r, cd, d, s);
  const perms = a => a.length <= 1 ? [a.slice()] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
  const cands = [];
  for(let d = 0; d < D; d++) for(let s = 0; s < dayN(r, d); s++) cands.push({ d, s });
  const wants = (want && want.length) ? want : [];
  const score = c => { if(!wants.length) return slotIdx(r, c.d, c.s); let best = 1e9; wants.forEach(w => { if(w.s == null){ if(w.d === c.d) best = Math.min(best, c.s); } else if(w.d === c.d) best = Math.min(best, Math.abs(w.s - c.s) + (c.s < w.s ? 0.5 : 0)); }); return best; };
  cands.sort((a, b) => score(a) - score(b) || slotIdx(r, a.d, a.s) - slotIdx(r, b.d, b.s));
  for(const c of cands){
    if(wants.length && score(c) >= 1e9) continue;
    for(const p of perms(ids)){
      let ok = true; const got = [];
      for(let i = 0; i < p.length; i++){ const s = c.s + i * (opt.sib === 'gap1' ? 2 : 1); if(!freeAt(p[i], c.d, s)){ ok = false; break; } got.push([p[i], c.d, s]); }
      if(ok) return got;
    }
  }
  return null;
}

/* ── 변경 요청 모아 반영 — 들어온 차례대로 (앞 요청이 잡은 칸은 뒤 요청이 못 씀) · 다른 가정은 그대로
   reqs [{ id, sids, how:'face'|'phone'|'sep', want, wantText, ph:{pd,pt} }]
   돌려줌 [{ id, ok, how, patch, plan, why }] — patch 는 고정(pin) 자리 */
export function batchPlan(r, colOf, reqs, inSet, famIdsOf){
  const work = Object.assign({}, r, { seats: Object.assign({}, r.seats || {}), cond: Object.assign({}, r.cond || {}) });
  return (reqs || []).map(q => {
    const ids = (q.sids || []).filter(id => !inSet || inSet.has(id));
    const how = q.how || 'face';
    if(!ids.length) return { id: q.id, ok: false, how, why: '대상 학생이 없어요' };
    // 🧩 요청에 적은 특이 사항 → 그 가정 조건에 더함 (이번 상담 동안)
    const fam = famIdsOf ? uniq(ids.flatMap(id => famIdsOf(id))) : ids;
    let cond = null;
    if(condAny(q.cond)){ cond = condMerge([condOf(work, fam), q.cond]); fam.forEach(id => { work.cond[id] = cond; }); }
    const cd = condOf(work, fam);
    const patch = {};
    if(how === 'phone'){
      const ph = q.ph || {};
      ids.forEach(id => { patch[id] = Object.assign({}, work.seats[id] || {}, { k: 'phone', pd: ph.pd || '', pt: ph.pt || '', note: (work.seats[id] && work.seats[id].note) || '', pin: true }); delete patch[id].d; delete patch[id].s; });
    } else if(how === 'sep'){
      const note = String(q.wantText || '').trim();
      ids.forEach(id => { patch[id] = Object.assign({}, work.seats[id] || {}, { k: 'sep', note: note || ((work.seats[id] && work.seats[id].note) || ''), pin: true }); delete patch[id].d; delete patch[id].s; delete patch[id].pd; delete patch[id].pt; });
    } else {
      if(!(q.want || []).length){
        if(!condHas(cd)) return { id: q.id, ok: false, how, cond, why: '원하는 칸 · 특이 사항이 없는 요청 — 글을 보고 손으로' };
        // 원하는 칸 없이 특이 사항만 — 지금 자리가 맞으면 그대로, 안 맞으면 맞는 빈자리로
        const nowOk = ids.every(id => { const st = work.seats[id]; return !st || st.k !== 'face' || slotOk(work, cd, st.d, st.s); }) && ids.every(id => work.seats[id] && work.seats[id].k === 'face');
        if(nowOk) return { id: q.id, ok: true, how, patch: {}, cond, keep: true };
      }
      const plan = findSpot(work, colOf, ids, q.want || [], { cond: cd });
      if(!plan) return { id: q.id, ok: false, how, cond, why: condHas(cd) ? `특이 사항(${condText(cd, { noNote: true })})에 맞는 빈 자리가 없어요` : '원하는 때에 빈 자리가 없어요' };
      plan.forEach(([id, d, s]) => { patch[id] = Object.assign({}, work.seats[id] || {}, { k: 'face', d, s, pin: true }); delete patch[id].pd; delete patch[id].pt; });
      Object.assign(work.seats, patch);
      return { id: q.id, ok: true, how, patch, plan, cond };
    }
    Object.assign(work.seats, patch);
    return { id: q.id, ok: true, how, patch, cond };
  });
}

/* ── 🧩 조건 맞춰 옮기기 — 특이 사항에 안 맞는 가정만 맞는 빈자리로 (형제 함께 · 다른 가정은 그대로)
   members { famKey: [sid] } · 돌려줌 [{ key, ids, ok, patch, why }] */
export function condFix(r, colOf, members, inSet){
  const work = Object.assign({}, r, { seats: Object.assign({}, r.seats || {}) });
  const out = [];
  Object.entries(members || {}).forEach(([key, all]) => {
    const ids = all.filter(id => !inSet || inSet.has(id));
    const c = condOf(work, ids); if(!condHas(c)) return;
    const face = ids.filter(id => work.seats[id] && work.seats[id].k === 'face');
    const bad = face.filter(id => !slotOk(work, c, work.seats[id].d, work.seats[id].s));
    if(!bad.length) return;
    // 형제가 함께 있으면 가정째로 · 아니면 어긴 학생만
    let plan = findSpot(work, colOf, face, [], { cond: c });
    if(!plan && face.length > 1) plan = findSpot(work, colOf, bad, [], { cond: c });
    if(!plan){ out.push({ key, ids: bad, ok: false, why: `${condText(c, { noNote: true })}에 맞는 빈 자리가 없어요` }); return; }
    const patch = {}; plan.forEach(([id, d, s]) => { patch[id] = Object.assign({}, work.seats[id] || {}, { k: 'face', d, s, pin: true }); });
    Object.assign(work.seats, patch);
    out.push({ key, ids: plan.map(p => p[0]), ok: true, patch, plan });
  });
  return out;
}

/* ── 이름 (원본 학생이 지워져도 표에 남게 — 상담 문서 안 stu 사진) ── */
export function stuSnap(scope, members, kids){
  const fk = {}; Object.entries(members || {}).forEach(([k, ids]) => { if(ids.length > 1) ids.forEach(id => { fk[id] = k; }); });
  const out = {};
  scope.filter(x => x.in).forEach(x => { const o = { n: x.name, c: x.col, g: x.grade || '' }; if(fk[x.sid]) o.f = fk[x.sid]; if(kids && kids[x.sid]) o.k = kids[x.sid]; out[x.sid] = o; });
  return out;
}
/* 상담 이름 · id */
export const roundId = (org, year, term, n) => `${org}_${year}_${term}${n > 1 ? '_' + n : ''}`;
export const roundTitle = (year, term, n) => `${year}학년도 ${term}학기 학부모 상담${n > 1 ? ` (${n})` : ''}`;
/* 파일 이름에서 학년도 · 학기 읽기 — «2025 1학기 …», «DA 26_1 …», «25-2 …» */
export function yearTermFromName(name){
  const s = String(name || '');
  let m = /(20\d{2}|\d{2})\s*(?:학년도)?\s*[-_.\s(]*\s*([12])\s*\)?\s*(?:학기|[-_\s)]|$)/.exec(s);
  if(!m) m = /(20\d{2}|\d{2})\D{0,6}([12])\s*학기/.exec(s);
  if(!m) return { year: 0, term: 0 };
  let y = +m[1]; if(y < 100) y += 2000;
  return { year: y, term: +m[2] };
}
