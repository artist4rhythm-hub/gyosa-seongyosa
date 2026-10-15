/* ═══════════════════════════════════════════════════════════════
   🖨 학사일정 인쇄 (v-114) — academic-print.js
   ───────────────────────────────────────────────────────────────
   학사일정 위쪽 «🖨 인쇄» → 인쇄 창
     ① 기관 (여러 곳 · 기관마다 따로 / 한 장에 함께) + DA 전체 일정
     ② 학부모용 / 교사용
     ③ 기간 (이번 달 · 다음 달 · 학기 · 학년도 · 직접 고르기)
     ④ 모양 — 달력형 · 목록형 · 한눈에
     ⑤ 용지 — A4 / A3 · 가로 / 세로 (한 장에 많이 담기는 것은 처음부터 A3)
     ⑥ 넣을 것 — 수업 없음 · 매주 일정 · 요약 · 시간 · 장소 · 메모 · 주차 · 로고 · 발행일 · 흑백
     ⑦ 이 쪽의 안내 · 맨 아래 한 줄
   · 글자 크기는 쪽마다 «자동 맞춤» — 칸이 넉넉하면 크게, 많으면 작게 (정해 둔 가장 작은 크기 아래로는 안 내려감)
   · 미리보기와 인쇄가 같은 쪽을 쓴다 → 보이는 그대로 나온다
   · 일정·쉬는 날·학기는 화면과 같은 원장·같은 규칙 (academic.html 의 window.acPrintCtx)
   · 아무것도 저장하지 않는다 (설정·안내 문구는 이 기기에만 기억) → 보안 규칙 그대로
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const C = () => window.acPrintCtx;
const DOW = ['일','월','화','수','목','금','토'];
const pad = n => String(n).padStart(2, '0');
const dstr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const toD = s => new Date(s + 'T00:00:00');
const fmt = d => dstr(d.getFullYear(), d.getMonth() + 1, d.getDate());
const addD = (s, n) => { const d = toD(s); d.setDate(d.getDate() + n); return fmt(d); };
const dowOf = s => toD(s).getDay();
const dnum = s => +s.slice(8, 10), mnum = s => +s.slice(5, 7);
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const ymKey = (y, m) => `${y}-${pad(m)}`;
const today = () => fmt(new Date());
const store = {
  get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(_){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(_){} },
};

/* ── 색 ── */
function rgb(h){ h = String(h || '#A996E0').replace('#', ''); if(h.length === 3) h = h.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); }
function mix(h, t, to){ const a = rgb(h), b = to ? rgb(to) : [255, 255, 255]; return '#' + a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, '0')).join(''); }
const tint = c => mix(c, .64), edge = c => mix(c, .3, '#1F2320');

/* ── 기관 모양 ── */
const LOOK = {
  daniel:   { logo:'logo-daniel.png',   ac:'#1E3932', ac2:'#00704A', tn:'#E8F3EF', short:'다니엘', tag:'#00704A' },
  jihyebit: { logo:'logo-jihyebit.png', ac:'#3F2A86', ac2:'#5B3FB5', tn:'#EFEAFB', short:'지혜빛', tag:'#5B3FB5' },
  both:     { logo:'',                  ac:'#1E3932', ac2:'#00704A', tn:'#E8F3EF', short:'두 기관' },
};
const orgName = o => (C().ORGS && C().ORGS[o]) || o;
function orgSub(o){ const g = (C().GRADE_ORDER || {})[o] || []; if(!g.length) return '';
  const a = g[0], b = g[g.length - 1]; return a.includes('학년') ? `${parseInt(a)}~${parseInt(b)}학년` : `${parseInt(a)}~${parseInt(b)}세`; }

/* ── 용지 ── */
const PAPER = { A4:{ w:210, h:297 }, A3:{ w:297, h:420 } };
const dims = (paper, orient) => { const p = PAPER[paper] || PAPER.A4; return orient === 'l' ? { w:p.h, h:p.w } : { w:p.w, h:p.h }; };
/* 글자 크기 범위(pt) — 쪽마다 이 안에서 가장 크게 맞춘다 */
const U_RANGE = { cal:[7.6, 11.5], list:[8.4, 12.5], year:[7, 10.5] };
const PAPER_K = { A4:{ k:1, lo:1, hi:1 }, A3:{ k:1.3, lo:1.12, hi:1.4 } };
function layoutKey(o, nMonths){ return o.layout + (o.together && o.orgs.length > 1 ? '+t' : '') + (o.layout === 'year' ? (nMonths > 6 ? '+12' : '+6') : ''); }
function defPaper(key){
  if(key.startsWith('year')) return key.endsWith('+12') ? { paper:'A3', orient:'p' } : { paper:'A4', orient:'p' };
  if(key.startsWith('cal')) return key.includes('+t') ? { paper:'A3', orient:'l' } : { paper:'A4', orient:'l' };
  return key.includes('+t') ? { paper:'A3', orient:'p' } : { paper:'A4', orient:'p' };
}

/* ═══ 설정 ═══ */
const OPT_KEY = 'ac_print_opts', NOTE_KEY = 'ac_print_notes', FOOT_KEY = 'ac_print_foot';
const SHOW_DEF = { noClass:true, weekly:true, summary:true, time:true, place:true, memo:false, weekNo:false, logo:true, issued:true, mono:false };
function freshOpts(){
  const c = C(), saved = store.get(OPT_KEY, {});
  const can = c.printableOrgs();
  const cur = c.org === c.ORG_ALL ? can : [c.org].filter(o => can.includes(o));
  const o = {
    orgs: cur.length ? cur : can.slice(0, 1), withAll: saved.withAll !== false, together: !!saved.together,
    audience: saved.audience || 'parent', layout: saved.layout || 'cal', period: 'this',
    from: ymKey(c.year, c.month), to: ymKey(c.year, c.month),
    paperBy: saved.paperBy || {}, show: Object.assign({}, SHOW_DEF, saved.show || {}), page: 0,
    timeAt: saved.timeAt === 'side' ? 'side' : 'top',
  };
  if(o.layout === 'year') o.period = 'acyear';
  if(o.audience !== 'teacher') o.show.memo = false;
  return o;
}
function saveOpts(o){ store.set(OPT_KEY, { withAll:o.withAll, together:o.together, audience:o.audience, layout:o.layout, paperBy:o.paperBy, show:o.show, timeAt:o.timeAt }); }
const notes = () => store.get(NOTE_KEY, {});
const foots = () => store.get(FOOT_KEY, {});

/* ── 기간 → 달 목록 ── */
function acYearOf(y, m){ return m >= 3 ? y : y - 1; }
function monthsOf(o){
  const c = C();
  const ay = acYearOf(c.year, c.month);
  const span = (a, b) => { const out = []; let [y, m] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number);
    for(let i = 0; i < 24 && (y < y2 || (y === y2 && m <= m2)); i++){ out.push([y, m]); m++; if(m > 12){ m = 1; y++; } } return out; };
  const p = o.period;
  if(p === 'this') return span(ymKey(c.year, c.month), ymKey(c.year, c.month));
  if(p === 'next'){ const y = c.month === 12 ? c.year + 1 : c.year, m = c.month === 12 ? 1 : c.month + 1; return span(ymKey(y, m), ymKey(y, m)); }
  if(p === 'acyear') return span(`${ay}-03`, `${ay + 1}-02`);
  if(p && p.startsWith('term:')){
    const t = termList()[+p.slice(5)];
    if(t) return span(t.start.slice(0, 7), t.end.slice(0, 7));
  }
  return span(o.from <= o.to ? o.from : o.to, o.from <= o.to ? o.to : o.from);
}
function termList(){
  const c = C(); const ay = acYearOf(c.year, c.month);
  const org = (window.__acpOpts && window.__acpOpts.orgs[0]) || (c.org === c.ORG_ALL ? c.printableOrgs()[0] : c.org);
  return (c.periods(org, ay).terms || []).filter(t => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
}

/* ═══ 자료 모으기 ═══ */
function occ(e, a, b){
  const out = []; if(!e || !e.startDate) return out;
  const end = e.endDate || e.startDate; const wd = Array.isArray(e.weekdays) ? e.weekdays : [];
  const skip = new Set(Array.isArray(e.skipDates) ? e.skipDates : []);
  let s = e.startDate < a ? a : e.startDate; const lim = end > b ? b : end;
  for(let i = 0; s <= lim && i < 800; i++, s = addD(s, 1)){
    if(wd.length && !wd.includes(dowOf(s))) continue;
    if(skip.has(s)) continue; out.push(s);
  }
  return out;
}
const isWeekly = e => Array.isArray(e.weekdays) && e.weekdays.length > 0 && (toD(e.endDate || e.startDate) - toD(e.startDate)) / 864e5 > 7;
const evTime = e => e.startTime ? (e.endTime ? `${e.startTime}~${e.endTime}` : e.startTime) : '';
const gradeIdx = (org, g) => ((C().GRADE_ORDER || {})[org] || []).indexOf(g);
function runsLabel(org, list){
  const order = (C().GRADE_ORDER || {})[org] || [];
  const ix = [...new Set(list)].map(g => order.indexOf(g)).filter(i => i >= 0).sort((a, b) => a - b);
  if(!ix.length) return '';
  const unit = order[0] && order[0].includes('학년') ? '학년' : '세';
  const runs = []; ix.forEach(i => { const r = runs[runs.length - 1]; if(r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); });
  const num = i => parseInt(order[i], 10);
  return runs.map(r => r[0] === r[1] ? num(r[0]) : (r[1] === r[0] + 1 ? `${num(r[0])}·${num(r[1])}` : `${num(r[0])}~${num(r[1])}`)).join('·') + unit;
}
function noClassLabel(e, org){
  if(!org || isBrk(e) || e.category === 'closed') return '';
  const c = C(), order = (c.GRADE_ORDER || {})[org] || []; if(!order.length) return '';
  let off = [];
  try { off = order.filter(g => c.classStateOf(e, g) === 'off'); } catch(_){ return ''; }
  if(!off.length) return '';
  const word = org === 'jihyebit' ? '등원' : '수업';
  if(off.length === order.length) return org === 'jihyebit' ? '전체 등원 없음' : '전 학년 수업 없음';
  return `${runsLabel(org, off)} ${word} 없음`;
}
function targetLabel(e, org){
  const c = C();
  let kind = 'student'; try { kind = c.evKind(e); } catch(_){}
  if(kind === 'staff' || e.audience === 'teacher') return '교직원';
  if(!e.scope || e.scope === 'all') return kind === 'all' ? '전체 (교직원 포함)' : '전체';
  if(e.scope === 'dept') return (e.targets || []).join('·') || '전체';
  let gs = []; try { gs = c.evGrades(e); } catch(_){ gs = e.targets || []; }
  return runsLabel(org || (e.orgs || [])[0] || e.org || 'daniel', gs) || (e.targets || []).join('·') || '전체';
}
function evColorOf(e){ try { return C().evColor(e); } catch(_){ return e.color || ((C().CATEGORIES || {})[e.category] || { color:'#A996E0' }).color; } }
function catColorOf(k){ try { return C().catColor(k); } catch(_){ return ((C().CATEGORIES || {})[k] || { color:'#A996E0' }).color; } }
const catLabel = k => ((C().CATEGORIES || {})[k] || { label:'일정' }).label;

/* 한 기관(또는 두 기관 함께)의 인쇄 자료 */
async function gather(o, months){
  const c = C();
  const first = dstr(months[0][0], months[0][1], 1);
  const lm = months[months.length - 1], last = dstr(lm[0], lm[1], lastDay(lm[0], lm[1]));
  const y0 = months[0][0], y1 = lm[0];
  const [all, hol] = await Promise.all([c.events(y0 - 1, y1), c.holidays(y0, y1)]);
  const groups = (o.together && o.orgs.length > 1) ? [{ key:'both', orgs:o.orgs.slice() }] : o.orgs.map(g => ({ key:g, orgs:[g] }));
  const acYears = [...new Set(months.map(([y, m]) => acYearOf(y, m)))];
  return groups.map(g => {
    const want = new Set(g.orgs); if(o.withAll) want.add('all');
    const evs = all.filter(e => {
      if(!e.startDate || (e.endDate || e.startDate) < first || e.startDate > last) return false;
      let os = []; try { os = c.orgsOf(e); } catch(_){ os = e.orgs || [e.org]; }
      os = os.map(x => x === 'both' ? 'all' : x);
      if(!os.some(x => want.has(x))) return false;
      if(o.audience === 'parent' && !(e.audience === 'parent' || e.audience === 'both')) return false;
      return true;
    }).map(e => {
      let os = []; try { os = c.orgsOf(e); } catch(_){ os = e.orgs || [e.org]; }
      const x = Object.assign({}, e); x._orgs = os.map(v => v === 'both' ? 'all' : v);
      x._occ = occ(e, first, last); x._w = isWeekly(e); return x;
    }).filter(e => e._occ.length);
    // 학기 · 방학 (학년도 문서) — 방학은 일정처럼 띠로
    const terms = [], breaks = [];
    g.orgs.forEach(org => acYears.forEach(ay => { const p = c.periods(org, ay);
      (p.terms || []).forEach(t => terms.push(Object.assign({ org }, t)));
      (p.breaks || []).forEach(b => breaks.push(Object.assign({ org }, b))); }));
    breaks.forEach(b => {
      if(!b.start || !b.end || b.end < first || b.start > last) return;
      const x = { id:'brk:' + b.org + b.start, title:b.name || '방학', startDate:b.start, endDate:b.end, category:'break', audience:'both', _orgs:[b.org], _yb:true };
      x._occ = occ(x, first, last); x._w = false; if(x._occ.length) evs.push(x);
    });
    // 같은 일이 두 번 들어간 것은 하나로 (v-116) — 학사일정·학년도 방학 칸·두 기관에 따로 넣은 같은 행사
    mergeDup(evs);
    // 쉬는 날 — 법정 공휴일 + 원장(관리자·출근부에서 넣은 휴일 · 휴교)
    const H = {};
    Object.entries(hol.kr || {}).forEach(([d, n]) => { if(d >= first && d <= last) H[d] = { name:n, who:'all', kr:true }; });
    (hol.ledger || []).forEach(v => {
      if(!v || !v.date || v.date < first || v.date > last) return;
      if(!(v.org === 'all' || !v.org || want.has(v.org))) return;
      const who = v.who || 'all';
      if(who === 'staff' && o.audience === 'parent') return;
      if(H[v.date] && H[v.date].kr && who === 'staff') return;
      H[v.date] = { name:v.name || '휴일', who, org:v.org || 'all' };
    });
    // 휴교 일정
    evs.forEach(e => { if(e.category === 'closed') e._occ.forEach(d => { if(!H[d]) H[d] = { name:e.title, who:'school', ev:true }; }); });
    // 쉬는 날 이름이 그날 일정과 같으면 (관리자 휴일 «풀타임 정기 휴가» + 학사일정 «풀타임 정기 휴가») 이름은 일정 쪽 한 번만
    // — 칸 색(쉬는 날 · 교직원만 쉬는 날)은 그대로 남는다
    Object.entries(H).forEach(([d, h]) => { if(h.ev || evs.some(e => e._occ.includes(d) && sameName(e.title, h.name))) h.dup = true; });
    return { g, evs, H, terms, breaks, first, last };
  });
}
/* ── 같은 일 하나로 (v-116) ──
   이름은 띄어쓰기·기호와 괄호 속 «누구» 표시를 빼고 견준다 («풀타임 정기 휴가 (교직원)» = «풀타임 정기 휴가», «가을방학» = «가을 방학»).
   · 이름이 같고 날짜가 겹치면 하나로 (날짜는 합침 · 기관·장소·시간·메모도 합침)
   · 이름이 달라도 둘 다 방학이고 기간이 반 넘게 겹치면 하나로 (학년도 «방학» 칸 ↔ 학사일정 방학 일정) */
// 견줄 때 빼는 것: 띄어쓰기·기호 · 괄호 속 «누구» 표시 «(교직원)» «(교사)» «(전체)» … (괄호 속 다른 말 «(1학년)»은 남겨 다른 일로 본다)
const TAG_PAREN = /[(\[]\s*(교직원|직원|교사|전체|공통|모두|학부모|학생|교직원만|휴무|휴일|쉬는\s*날)\s*[)\]]/g;
const normName = s => String(s || '').replace(TAG_PAREN, '').replace(/[\s·・,.\-_~!?'"“”‘’()[\]]/g, '').toLowerCase();
const sameName = (a, b) => { const x = normName(a); return !!x && x === normName(b); };
const isBrk = e => e.category === 'break' || !!e._brk;
const AUD_RANK = { both:3, parent:2, teacher:1 };
function mergeDup(evs){
  const span = e => [e._occ[0], e._occ[e._occ.length - 1]];
  const cont = e => !(e.weekdays || []).length;
  const overlap = (a, b) => { const [a0, a1] = span(a), [b0, b1] = span(b); const lo = a0 > b0 ? a0 : b0, hi = a1 < b1 ? a1 : b1;
    if(lo > hi) return 0; const len = s => (toD(s[1]) - toD(s[0])) / 864e5 + 1; return ((toD(hi) - toD(lo)) / 864e5 + 1) / Math.min(len([a0, a1]), len([b0, b1])); };
  for(let i = 0; i < evs.length; i++){
    let a = evs[i]; if(!a || a._w) continue;
    for(let j = i + 1; j < evs.length; j++){
      const b = evs[j]; if(!b || b._w) continue;
      const same = sameName(a.title, b.title);
      const sameDays = a.startDate === b.startDate && (a.endDate || a.startDate) === (b.endDate || b.startDate) && (a.weekdays || []).join() === (b.weekdays || []).join();
      const ok = (same && (sameDays || (cont(a) && cont(b) && overlap(a, b) > 0)))
              || (isBrk(a) && isBrk(b) && cont(a) && cont(b) && overlap(a, b) >= .5);
      if(!ok) continue;
      // 남길 쪽: 학년도 방학 칸보다 학사일정 일정 · 그다음 들어 있는 것이 많은 쪽
      const [k, d] = (a._yb && !b._yb) ? [b, a] : [a, b];
      evs[i] = k; evs[j] = null; a = k;
      k._orgs = [...new Set([...(k._orgs || []), ...(d._orgs || [])])];
      k._occ = [...new Set([...k._occ, ...d._occ])].sort();
      if(isBrk(d)) k._brk = true;
      ['subtitle', 'startTime', 'endTime', 'memo'].forEach(f => { if(!k[f] && d[f]) k[f] = d[f]; });
      if((AUD_RANK[d.audience] || 0) > (AUD_RANK[k.audience] || 0)){ k.audience = d.audience; k.kind = d.kind; }
      if(d.dayMemos) k.dayMemos = Object.assign({}, d.dayMemos, k.dayMemos || {});
      if(d.classImpact && !k.classImpact) k.classImpact = d.classImpact;
      k.startDate = k.startDate < d.startDate ? k.startDate : d.startDate;
      k.endDate = (k.endDate || k.startDate) > (d.endDate || d.startDate) ? (k.endDate || k.startDate) : (d.endDate || d.startDate);
    }
  }
  for(let i = evs.length - 1; i >= 0; i--) if(!evs[i]) evs.splice(i, 1);
}

/* 그날 학년별 수업 — 화면 «📋 수업일»과 같은 기준 (학기 안 평일 · 쉬는 날·방학 아님 · 학년별 수업 없음 반영) */
function dayKind(D, org, d){
  const w = dowOf(d); if(w === 0 || w === 6) return 'off';
  const h = D.H[d]; if(h && h.who !== 'staff') return 'off';
  if(!D.terms.some(t => t.org === org && d >= t.start && d <= t.end)) return 'off';
  if(D.evs.some(e => isBrk(e) && e._orgs.some(x => x === org || x === 'all') && e._occ.includes(d))) return 'off';
  const order = (C().GRADE_ORDER || {})[org] || []; if(!order.length) return 'all';
  const today = D.evs.filter(e => e._occ.includes(d) && e._orgs.some(x => x === org || x === 'all'));
  let on = order;
  try { on = order.filter(g => !today.some(e => C().classStateOf(e, g) === 'off')); } catch(_){}
  return !on.length ? 'none' : on.length === order.length ? 'all' : 'some';
}
function classCount(D, org, y, m){
  let all = 0, some = 0; const n = lastDay(y, m);
  for(let d = 1; d <= n; d++){ const k = dayKind(D, org, dstr(y, m, d)); if(k === 'all') all++; else if(k === 'some') some++; }
  return { all, some };
}
/* 주차 — 화면과 같은 방식 (그 주와 가장 많이 겹치는 학기·방학 기준) */
function weekLabel(D, sun){
  const org = D.g.orgs[0];
  const spans = [...D.terms.filter(t => t.org === org).map(t => ({ name:t.name, start:t.start, end:t.end, kind:'term' })),
    ...D.breaks.filter(b => b.org === org).map(b => ({ name:b.name || '방학', start:b.start, end:b.end, kind:'break' }))];
  let best = null, bn = 0;
  spans.forEach(s => { let n = 0; for(let i = 0; i < 7; i++){ const d = addD(sun, i); if(d >= s.start && d <= s.end) n++; }
    if(n > bn || (n === bn && n > 0 && s.kind === 'term' && best && best.kind === 'break')){ best = s; bn = n; } });
  if(!best) return '';
  const s0 = addD(best.start, -dowOf(best.start));
  const k = Math.floor((toD(sun) - toD(s0)) / (7 * 864e5)) + 1;
  return `${best.name} ${k > 0 ? k : 1}주`;
}
/* 주차 칸 글 — «2학기 7주» → [«2학기», «7주»]
   화면과 같은 규칙: 이름에 «/» 가 있으면 거기서 줄을 바꾸고, 없으면 첫 띄어쓰기에서 한 번만 (여름 가정학습의 달 → 여름 / 가정학습의 달) */
function weekLines(label){
  const m = /^(.*\S)\s+(\d+주)$/.exec(label || ''); if(!m) return label ? [label] : [];
  const name = m[1].trim(); let parts = [name];
  if(name.includes('/')) parts = name.split(/\s*\/\s*/);
  else if(chW(name) > 5.6){
    // 띄어쓰기 가운데 두 줄 길이가 가장 비슷해지는 곳에서 한 번 — 한 글자만 남는 줄은 만들지 않는다
    let best = null; [...name].forEach((ch, i) => { if(ch !== ' ') return; const a = name.slice(0, i), b = name.slice(i + 1), w = Math.max(chW(a), chW(b));
      if(!best || w < best.w) best = { a, b, w, lo:Math.min(chW(a), chW(b)) }; });
    if(best && !(best.lo < 1.5 && chW(name) <= 7.2)) parts = [best.a, best.b];
  }
  return [...parts.filter(Boolean), m[2]];
}
const chW = s => [...String(s)].reduce((n, ch) => n + (/[0-9a-zA-Z ]/.test(ch) ? .58 : 1), 0);

/* ═══ 쪽 그리기 — 세 모양이 같은 머리·바닥·글꼴·색을 쓴다 ═══ */
function orgTag(e, D){
  if(D.g.key !== 'both') return '';
  const os = e._orgs || [];
  if(os.includes('all') || D.g.orgs.every(x => os.includes(x))) return '<i class="ot all">함께</i>';
  const o = D.g.orgs.find(x => os.includes(x)); if(!o) return '';
  return `<i class="ot" style="background:${LOOK[o].tag}">${esc(LOOK[o].short)}</i>`;
}
const isTeacherOnly = e => e.audience === 'teacher';
function head(o, D, titleHTML, sub){
  const g = D.g, aud = o.audience === 'teacher' ? '교사용' : '학부모용';
  const logos = g.key === 'both' ? g.orgs.map(x => `<img src="${LOOK[x].logo}" alt="">`).join('') : `<img src="${LOOK[g.key].logo}" alt="">`;
  const name = g.key === 'both' ? g.orgs.map(orgName).join(' · ') : orgName(g.key);
  const subl = g.key === 'both' ? '두 기관 함께' : orgSub(g.key);
  const issued = o.show.issued ? `<span>발행 ${today().replace(/^(\d+)-0?(\d+)-0?(\d+)$/, '$1. $2. $3.')}</span>` : '';
  return `<header class="ph"><div class="ph-org">${o.show.logo ? logos : ''}<div><b>${esc(name)}</b><span>${esc(subl)}</span></div></div>
    <div class="ph-t">${titleHTML}</div>
    <div class="ph-r"><span class="ph-aud ${o.audience === 'teacher' ? 't' : ''}">${aud}</span><span>${esc(sub)}</span>${issued}</div></header>`;
}
function legend(cats, D){
  return `<div class="lg">${cats.map(k => `<span><i style="background:${tint(catColorOf(k))};border-color:${edge(catColorOf(k))}"></i>${esc(catLabel(k))}</span>`).join('')}<span><i class="hol"></i>공휴일·쉬는 날</span>${D.g.key === 'both' ? D.g.orgs.map(x => `<span><i class="ot" style="background:${LOOK[x].tag}">${esc(LOOK[x].short)}</i></span>`).join('') : ''}</div>`;
}
function weeklyBox(o, D, list){
  if(!o.show.weekly || !list.length) return '';
  const seen = new Set();
  const rows = list.filter(e => { const k = e.title + '|' + (e.weekdays || []).join(); if(seen.has(k)) return false; seen.add(k); return true; })
    .map(e => `<div>${orgTag(e, D)}${(e.weekdays || []).slice().sort().map(w => DOW[w]).join('·')}요일${o.show.time && evTime(e) ? ' ' + evTime(e) : ''} <em style="border-color:${edge(evColorOf(e))}">${esc(e.title)}</em>${o.show.place && e.subtitle ? ` · ${esc(e.subtitle)}` : ''}</div>`).join('');
  return `<div class="fb wkb" data-fit><b>🔁 매주</b>${rows}</div>`;
}
function noteBox(o, D, key){
  const t = (notes()[key] || '').trim(); if(!t) return '';
  return `<div class="fb nt" data-fit><b>📌 안내</b>${t.split('\n').map(l => `<div>${esc(l)}</div>`).join('')}</div>`;
}
function footLine(D){
  const f = foots(); const t = D.g.key === 'both' ? D.g.orgs.map(x => f[x]).filter(Boolean).join('   ') : (f[D.g.key] || '');
  return t ? `<div class="fl">${esc(t)}</div>` : '';
}
function sumBox(o, D, y, m, cats){
  if(!o.show.summary) return cats.length ? `<div class="fb sm">${legend(cats, D)}</div>` : '';
  const lines = D.g.orgs.map(org => { const n = classCount(D, org, y, m);
    return `<div class="cnt">${D.g.key === 'both' ? `<i class="ot" style="background:${LOOK[org].tag}">${esc(LOOK[org].short)}</i>` : ''}${org === 'jihyebit' ? '등원일' : '수업일'} <b>${n.all + n.some}</b>일${n.some ? `<small>학년마다 다른 날 ${n.some}일</small>` : ''}</div>`; }).join('');
  return `<div class="fb sm">${lines}${legend(cats, D)}</div>`;
}
function pageOpen(o, D, kind, extraCls){
  const L = LOOK[D.g.key] || LOOK.both, pk = PAPER_K[o.paper] || PAPER_K.A4, dm = dims(o.paper, o.orient);
  return `<section class="acp-pg ${kind} ${o.orient === 'l' ? 'land' : 'port'}${o.show.mono ? ' mono' : ''}${extraCls || ''}" style="width:${dm.w}mm;height:${dm.h}mm;--k:${pk.k};--u:${o._u || 9};--ac:${L.ac};--ac2:${L.ac2};--tn:${L.tn}">`;
}

/* ── 달력형 ── (v-116)
   · 요일 칸 폭은 일~토 모두 같게
   · 주 줄 높이는 그 주 일정 양만큼 — 일정이 적은 주는 남는 자리를 나눠 갖는다 (칸이 모자라 잘리는 일 없음 · «외 n건» 없음)
   · 시간은 제목 윗줄에 따로(기본) 또는 제목 옆 칸 — 제목이 시간 때문에 중간에서 끊기지 않게
   · 관리자 휴일이 며칠 이어지면 날마다 이름을 적지 않고 띠 하나로
   · part {a, b, i, n} — 일정이 아주 많은 달은 주를 나눠 여러 쪽으로 (글자를 너무 줄이지 않으려고) */
function pageCal(o, D, y, m, part){
  const first = dstr(y, m, 1), last = dstr(y, m, lastDay(y, m));
  let s0 = addD(first, -dowOf(first)); const allWeeks = [];
  while(s0 <= last){ allWeeks.push(Array.from({ length:7 }, (_, i) => addD(s0, i))); s0 = addD(s0, 7); }
  const weeks = part ? allWeeks.slice(part.a, part.b) : allWeeks;
  const isLast = !part || part.foot || part.i === part.n - 1;
  const inM = d => d >= first && d <= last;
  const evs = D.evs.filter(e => e._occ.some(inM));
  const weekly = evs.filter(e => o.show.weekly && e._w);
  const main = evs.filter(e => !(o.show.weekly && e._w));
  const wn = o.show.weekNo;
  const side = o.timeAt === 'side';
  // 주차 칸 폭 — 이 달에서 가장 긴 낱말에 맞춘다 (글자가 칸 줄에 걸리지 않게)
  const wls = weeks.map(days => wn ? weekLines(weekLabel(D, days[0])) : []);
  const wch = Math.min(o.orient === 'p' ? 5.6 : 7.2, Math.max(2.6, ...wls.flat().map(chW)));
  const cols = (wn ? 'var(--wn) ' : '') + 'repeat(7,minmax(0,1fr))';
  const timeOf = e => o.show.time && e.startTime ? (o.audience === 'teacher' ? evTime(e) : e.startTime) : '';
  const tags = e => (isTeacherOnly(e) ? '<i class="tt">교사</i>' : '') + orgTag(e, D);
  const memoOf = (e, d) => o.show.memo && o.audience === 'teacher' && e.dayMemos && e.dayMemos[d] ? e.dayMemos[d] : '';
  const chip = (e, d) => {
    const c = evColorOf(e), t = timeOf(e), plc = o.show.place && e.subtitle ? esc(e.subtitle) : '';
    const pl = plc ? `<small> ·&nbsp;${plc}</small>` : '';
    const mm = memoOf(e, d) ? `<small class="mm">${esc(memoOf(e, d))}</small>` : '';
    const st = `style="background:${o.show.mono ? '#fff' : tint(c)};border-color:${edge(c)}"`;
    const cls = `ev${isTeacherOnly(e) ? ' tonly' : ''}`;
    if(t && side){
      const [a, b] = t.split('~');
      return `<div class="${cls} sd" ${st}><u>${esc(a)}${b ? `<br><s>~${esc(b)}</s>` : ''}</u><span>${tags(e)}<b>${esc(e.title)}</b>${pl}${mm}</span></div>`;
    }
    // 시간이 있으면 «시간 · 장소»를 윗줄에, 제목은 아랫줄에 홀로 — 제목이 시간 때문에 끊기지 않게
    if(t) return `<div class="${cls}" ${st}><span class="et">${tags(e)}<u>${esc(t)}</u>${plc ? `<small> ·&nbsp;${plc}</small>` : ''}</span><b>${esc(e.title)}</b>${mm}</div>`;
    return `<div class="${cls}" ${st}>${tags(e)}<b>${esc(e.title)}</b>${pl}${mm}</div>`;
  };
  const rows = weeks.map((days, wi) => {
    const bars = [], singles = days.map(() => []);
    main.forEach(e => {
      const os = e._occ.filter(d => days.includes(d) && inM(d)); if(!os.length) return;
      const cont = !(e.weekdays || []).length && (e.endDate || e.startDate) > e.startDate;
      if(cont){
        const runs = []; os.forEach(d => { const r = runs[runs.length - 1]; if(r && addD(r[1], 1) === d) r[1] = d; else runs.push([d, d]); });
        runs.forEach(([a, b]) => bars.push({ e, c0:days.indexOf(a), c1:days.indexOf(b), cl:a > e.startDate, cr:b < (e.endDate || e.startDate) }));
      }
      else os.forEach(d => singles[days.indexOf(d)].push(e));
    });
    // 관리자 휴일이 이틀 넘게 이어지면 띠로 (날마다 같은 이름이 되풀이되지 않게)
    const hdr = days.map(() => null);
    for(let i = 0; i < 7; i++){
      const d = days[i], h = inM(d) && D.H[d]; if(!h || h.dup || h.kr) { if(h && !h.dup) hdr[i] = h; continue; }
      let j = i; while(j + 1 < 7 && inM(days[j + 1]) && D.H[days[j + 1]] && !D.H[days[j + 1]].dup && !D.H[days[j + 1]].kr && D.H[days[j + 1]].name === h.name && D.H[days[j + 1]].who === h.who) j++;
      const prevSame = i === 0 && inM(addD(d, -1)) && D.H[addD(d, -1)] && D.H[addD(d, -1)].name === h.name;
      const nextSame = j === 6 && inM(addD(days[6], 1)) && D.H[addD(days[6], 1)] && D.H[addD(days[6], 1)].name === h.name;
      if(j > i || prevSame || nextSame) bars.push({ h, c0:i, c1:j, cl:prevSame, cr:nextSame }); else hdr[i] = h;
      i = j;
    }
    bars.sort((a, b) => (!!b.h - !!a.h) || (b.c1 - b.c0) - (a.c1 - a.c0) || a.c0 - b.c0);
    const lanes = []; bars.forEach(b => { let L = lanes.findIndex(l => l.every(x => x.c1 < b.c0 || x.c0 > b.c1)); if(L < 0){ lanes.push([]); L = lanes.length - 1; } lanes[L].push(b); b.L = L; });
    const off = wn ? 1 : 0, NL = lanes.length;
    // 띠가 지나가지 않는 칸은 하루 일정을 띠 줄 높이부터 바로 쓴다 (빈 줄이 남지 않게)
    const top = days.map((_, i) => bars.reduce((t, b) => (b.c0 <= i && i <= b.c1 ? Math.max(t, b.L + 1) : t), 0));
    const wlab = wn ? `<div class="wn" style="grid-column:1;grid-row:1/-1">${wls[wi].map((w, k) => k === wls[wi].length - 1 && wls[wi].length > 1 ? `<b>${esc(w)}</b>` : `<span>${esc(w)}</span>`).join('')}</div>` : '';
    const cells = days.map((d, i) => {
      const out = !inM(d), h = !out && D.H[d], w = dowOf(d), hn = hdr[i];
      const red = !out && (w === 0 || (h && h.who !== 'staff'));
      const brk = !out && main.some(e => isBrk(e) && e._occ.includes(d));
      let nc = ''; if(!out && o.show.noClass) for(const e of main){ if(e._occ.includes(d)){ const l = noClassLabel(e, D.g.key === 'both' ? (e._orgs.find(x => D.g.orgs.includes(x)) || D.g.orgs[0]) : D.g.key); if(l){ nc = l; break; } } }
      const sg = out ? [] : singles[i].slice().sort((a, b) => (a.startTime || '99').localeCompare(b.startTime || '99'));
      return `<div class="cc${out ? ' out' : ''}${red ? ' hol' : ''}${brk ? ' brk' : ''}${h && h.who === 'staff' ? ' stf' : ''}" style="grid-column:${i + 1 + off};grid-row:1/-1"></div>
        <div class="cd${(w === 0 || red) ? ' red' : w === 6 ? ' blue' : ''}${out ? ' out' : ''}" style="grid-column:${i + 1 + off};grid-row:1"><b>${dnum(d)}</b>${hn ? `<span class="hn${hn.who === 'staff' ? ' s' : ''}">${esc(hn.who === 'staff' ? hn.name + ' (교직원)' : hn.name)}</span>` : ''}${nc ? `<span class="nc">${esc(nc)}</span>` : ''}</div>
        <div class="sg" data-fit style="grid-column:${i + 1 + off};grid-row:${top[i] + 2}/-1">${sg.map(e => chip(e, d)).join('')}</div>`;
    }).join('');
    const items = bars.map(b => {
      const pos = `grid-column:${b.c0 + 1 + off}/${b.c1 + 2 + off};grid-row:${b.L + 2}`;
      if(b.h){ const st = b.h.who === 'staff';
        return `<div class="ev bar hb${st ? ' s' : ''}${b.cl ? ' cl' : ''}${b.cr ? ' cr' : ''}" style="${pos}"><span>${esc(st ? b.h.name + ' (교직원)' : b.h.name)}</span></div>`; }
      const c = evColorOf(b.e), t = o.show.time && b.e.startTime ? b.e.startTime : '';
      return `<div class="ev bar${b.cl ? ' cl' : ''}${b.cr ? ' cr' : ''}${isTeacherOnly(b.e) ? ' tonly' : ''}" style="${pos};background:${o.show.mono ? '#fff' : tint(c)};border-color:${edge(c)}">${tags(b.e)}${t ? `<u>${esc(t)}</u>` : ''}<span>${esc(b.e.title)}</span></div>`; }).join('');
    return `<div class="wk" style="grid-template-columns:${cols};grid-template-rows:auto ${NL ? `repeat(${NL},auto) ` : ''}minmax(calc(var(--U)*2.6),1fr)">${wlab}${cells}${items}</div>`;
  }).join('');
  const t = D.terms.find(t => t.org === D.g.orgs[0] && dstr(y, m, 15) >= t.start && dstr(y, m, 15) <= t.end);
  const cats = [...new Set(main.filter(e => e._occ.some(inM)).map(e => e.category))].filter(Boolean);
  const nk = `${D.g.key}|${ymKey(y, m)}`;
  const fb = isLast ? [weeklyBox(o, D, weekly), noteBox(o, D, nk), sumBox(o, D, y, m, cats)].filter(Boolean) : [];
  const tmpl = fb.map(x => x.includes('fb nt') ? '1.7fr' : x.includes('fb wkb') ? '.9fr' : '1fr').join(' ');
  const pn = part && part.n > 1 ? ` <small>(${part.i + 1}/${part.n})</small>` : '';
  return pageOpen(o, D, 'cal') + head(o, D, `<b>${m}</b><span>월 학사일정${pn}</span>`, `${acYearOf(y, m)}학년도${t ? ' ' + t.name : ''}`)
    + `<div class="cal" data-fit style="--wn:calc(var(--U)*${(wch * .78).toFixed(2)} + 2.4mm)"><div class="dow" style="grid-template-columns:${cols}">${wn ? '<div class="dwn">주차</div>' : ''}${DOW.map((x, i) => `<div class="${i === 0 ? 'red' : i === 6 ? 'blue' : ''}">${x}</div>`).join('')}</div>${rows}</div>`
    + (fb.length ? `<footer class="pf" style="grid-template-columns:${tmpl}">${fb.join('')}</footer>` : '') + footLine(D) + `</section>`;
}

/* ── 작은 달력 (목록형 · 한눈에) ── */
function miniCal(o, D, y, m){
  const first = dstr(y, m, 1); const cells = [];
  for(let i = 0; i < dowOf(first); i++) cells.push('<i></i>');
  for(let d = 1; d <= lastDay(y, m); d++){
    const s = dstr(y, m, d), w = dowOf(s), h = D.H[s];
    const e = D.evs.find(x => !x._w && !isBrk(x) && x.category !== 'closed' && x._occ.includes(s));
    const brk = D.evs.some(x => isBrk(x) && x._occ.includes(s));
    const red = w === 0 || (h && h.who !== 'staff');
    cells.push(`<i class="${red ? 'red' : w === 6 ? 'blue' : ''}${brk ? ' brk' : ''}${e ? ' on' : ''}"${e ? ` style="${o.show.mono ? 'box-shadow:inset 0 0 0 .3mm #333' : `background:${tint(evColorOf(e))}`}"` : ''}>${d}</i>`);
  }
  return `<div class="mini"><div class="mh">${DOW.map((x, i) => `<i class="${i === 0 ? 'red' : i === 6 ? 'blue' : ''}">${x}</i>`).join('')}</div><div class="mg">${cells.join('')}</div></div>`;
}

/* ── 목록형 ── (rows 를 나눠 받을 수 있게: 넘치면 다음 쪽으로 이어서) */
function listRows(o, D, y, m){
  const first = dstr(y, m, 1), last = dstr(y, m, lastDay(y, m));
  const inM = d => d >= first && d <= last;
  const rows = [];
  D.evs.forEach(e => {
    if(o.show.weekly && e._w) return;
    const os = e._occ.filter(inM); if(!os.length) return;
    const cont = !(e.weekdays || []).length;
    if(cont) rows.push({ d:os[0], d2:os[os.length - 1], e });
    else os.forEach(d => rows.push({ d, d2:d, e }));
  });
  // 쉬는 날 — 일정과 이름이 같은 날은 빼고(일정 줄에 이미 있음), 같은 이름이 이어지면 한 줄로 (v-116)
  Object.keys(D.H).filter(d => inM(d) && !D.H[d].dup).sort().forEach(d => { const h = D.H[d], r = rows[rows.length - 1];
    if(r && r.h && !h.kr && !r.h.kr && r.h.name === h.name && r.h.who === h.who && addD(r.d2, 1) === d) r.d2 = d; else rows.push({ d, d2:d, h }); });
  rows.sort((a, b) => a.d.localeCompare(b.d) || (a.h ? -1 : b.h ? 1 : 0) || ((a.e && a.e.startTime) || '99').localeCompare((b.e && b.e.startTime) || '99'));
  return rows;
}
function listBody(o, D, rows, first, last){
  const short = s => `${dnum(s)}(${DOW[dowOf(s)]})`;
  const kd = s => `${mnum(s)}. ${dnum(s)}.(${DOW[dowOf(s)]})`;
  let html = '', cur = '';
  rows.forEach(r => {
    const sun = addD(r.d, -dowOf(r.d));
    if(sun !== cur){ cur = sun; const wl = o.show.weekNo ? weekLabel(D, sun) : '';
      html += `<tr class="wb"><td colspan="4">${wl ? `<b>${esc(wl)}</b>` : ''}<span>${kd(sun < first ? first : sun)} ~ ${kd(addD(sun, 6) > last ? last : addD(sun, 6))}</span></td></tr>`; }
    const dd = r.d2 !== r.d ? `${short(r.d)}<small>~ ${short(r.d2)}</small>` : short(r.d);
    const w = dowOf(r.d);
    if(r.h){
      const staff = r.h.who === 'staff';
      html += `<tr class="${staff ? 'hs' : 'hr'}"><td class="dt${staff ? '' : ' red'}">${dd}</td><td colspan="3"><b>${esc(r.h.name)}</b> <span class="sm">${staff ? '교직원만 쉬는 날' : '쉬는 날'}</span></td></tr>`; return;
    }
    const e = r.e, c = evColorOf(e);
    const org = D.g.key === 'both' ? (e._orgs.find(x => D.g.orgs.includes(x)) || D.g.orgs[0]) : D.g.key;
    const nc = o.show.noClass ? noClassLabel(e, org) : '';
    const tp = [o.show.time ? (o.audience === 'teacher' ? evTime(e) : (e.startTime || '')) : '', o.show.place ? e.subtitle : ''].filter(Boolean).join(' · ');
    const memo = [nc, e.memo && (o.audience === 'teacher' || o.show.memo) ? e.memo : '',
      o.show.memo && o.audience === 'teacher' ? Object.entries(e.dayMemos || {}).filter(([k]) => k >= r.d && k <= r.d2).map(([, v]) => v).join(' · ') : ''].filter(Boolean).join(' · ');
    const red = w === 0 || (D.H[r.d] && D.H[r.d].who !== 'staff');
    html += `<tr class="${isTeacherOnly(e) ? 'tonly' : ''}"><td class="dt${red ? ' red' : w === 6 ? ' blue' : ''}">${dd}</td>
      <td class="ttl"><i class="dot" style="background:${o.show.mono ? '#fff' : tint(c)};border-color:${edge(c)}"></i>${orgTag(e, D)}<b>${esc(e.title)}</b>${isTeacherOnly(e) ? ' <i class="tt">교사</i>' : ''}</td>
      <td>${esc(targetLabel(e, org))}${tp ? `<div class="sm">${esc(tp)}</div>` : ''}</td><td class="sm">${esc(memo)}</td></tr>`;
  });
  return html;
}
function pageList(o, D, y, m, part){
  const first = dstr(y, m, 1), last = dstr(y, m, lastDay(y, m));
  const rows = part ? part.rows : listRows(o, D, y, m);
  const isFirst = !part || part.i === 0, isLast = !part || part.i === part.n - 1;
  const t = D.terms.find(t => t.org === D.g.orgs[0] && dstr(y, m, 15) >= t.start && dstr(y, m, 15) <= t.end);
  const evAll = D.evs.filter(e => e._occ.some(d => d >= first && d <= last));
  const hols = Object.entries(D.H).filter(([d, h]) => d >= first && d <= last && h.who !== 'staff').sort((a, b) => a[0].localeCompare(b[0]));
  // 쉬는 날 요약 — 날짜 순 · 같은 이름이 이어지면 «26~30일 가을 방학» 한 번 (v-116)
  const holRuns = []; hols.forEach(([d, h]) => { const r = holRuns[holRuns.length - 1]; if(r && r.name === h.name && addD(r.b, 1) === d) r.b = d; else holRuns.push({ a:d, b:d, name:h.name }); });
  const allRows = part ? part.all : rows;
  const nEv = allRows.filter(r => r.e).length;
  const sum = isFirst && o.show.summary ? `<div class="lsum"><div class="sumtx">
      ${D.g.orgs.map(org => { const n = classCount(D, org, y, m); return `<div><em>${D.g.key === 'both' ? esc(LOOK[org].short) + ' ' : ''}${org === 'jihyebit' ? '등원일' : '수업일'}</em><p><b>${n.all + n.some}</b>일</p>${n.some ? `<small>학년마다 다른 날 ${n.some}일</small>` : ''}</div>`; }).join('')}
      <div><em>쉬는 날</em><p><b>${hols.length}</b>일</p><small>${holRuns.map(r => `${dnum(r.a)}${r.b !== r.a ? '~' + dnum(r.b) : ''}일 ${esc(r.name)}`).join(' · ')}</small></div>
      <div><em>일정</em><p><b>${nEv}</b>건</p></div></div>${miniCal(o, D, y, m)}</div>` : '';
  const nk = `${D.g.key}|${ymKey(y, m)}`;
  const cats = [...new Set(evAll.map(e => e.category))].filter(Boolean);
  const fb = isLast ? [weeklyBox(o, D, evAll.filter(e => o.show.weekly && e._w)), noteBox(o, D, nk), `<div class="fb sm lg0">${legend(cats, D)}</div>`].filter(Boolean) : [];
  const title = part && part.i > 0 ? `<b>${m}</b><span>월 학사일정 <small>(이어서 ${part.i + 1}/${part.n})</small></span>` : `<b>${m}</b><span>월 학사일정${part && part.n > 1 ? ` <small>(1/${part.n})</small>` : ''}</span>`;
  const th = `<thead><tr><th class="c1">날짜</th><th>일정</th><th class="c3">대상${o.show.time || o.show.place ? ' · ' + [o.show.time ? '시간' : '', o.show.place ? '장소' : ''].filter(Boolean).join('·') : ''}</th><th class="c4">비고${o.audience === 'teacher' && o.show.memo ? ' · 담당' : ''}</th></tr></thead>`;
  return pageOpen(o, D, 'list') + head(o, D, title, `${acYearOf(y, m)}학년도${t ? ' ' + t.name : ''}`) + sum
    + `<div class="lwrap" data-fit><table class="lt">${th}<tbody>${listBody(o, D, rows, first, last) || '<tr><td colspan="4" class="none">이 달에는 넣어 둔 일정이 없어요</td></tr>'}</tbody></table></div>`
    + (isLast ? `<footer class="pf lpf" style="grid-template-columns:${fb.map(x => x.includes('fb nt') ? 'minmax(0,1.7fr)' : x.includes('lg0') ? 'minmax(0,.8fr)' : 'minmax(0,1fr)').join(' ')}">${fb.join('')}</footer>` : '')
    + footLine(D) + `</section>`;
}

/* ── 한눈에 ── */
function pageYear(o, D, months, part){
  const n = months.length;
  const land = o.orient === 'l';
  const [cols, rowsN] = n <= 2 ? [n, 1] : n <= 4 ? [2, 2] : n <= 6 ? (land ? [3, 2] : [2, 3]) : n <= 9 ? [3, 3] : (land ? [4, 3] : [3, 4]);
  const dm = dims(o.paper, o.orient), K = (PAPER_K[o.paper] || PAPER_K.A4).k;
  const cardW = (dm.w - 18 * K - (cols - 1) * 2.4 * K) / cols;     // 달 칸 하나의 폭(mm)
  const cards = months.map(([y, m]) => {
    const first = dstr(y, m, 1), last = dstr(y, m, lastDay(y, m));
    const list = [];
    D.evs.filter(e => !e._w).forEach(e => { const os = e._occ.filter(d => d >= first && d <= last); if(!os.length) return;
      if(isBrk(e) && os[0] !== e.startDate && os[os.length - 1] !== (e.endDate || e.startDate)) return;
      list.push({ d:os[0], d2:os[os.length - 1], e }); });
    const hs = Object.keys(D.H).filter(d => d >= first && d <= last && D.H[d].who !== 'staff' && !D.H[d].dup).sort(); const runs = [];
    hs.forEach(d => { const full = D.H[d].name, base = full.replace(/ ?연휴$/, '').replace(/ ?대체(공)?휴일$/, '') || full, r = runs[runs.length - 1];
      if(r && addD(r.b, 1) === d && (r.base === base || /대체/.test(full))) r.b = d; else runs.push({ a:d, b:d, base, full }); });
    runs.forEach(r => list.push({ d:r.a, d2:r.b, hol: r.a === r.b ? r.full : r.base }));
    list.sort((a, b) => a.d.localeCompare(b.d));
    const lines = list.map(r => { const c = r.hol ? '#E7A39B' : evColorOf(r.e);
      return `<div class="yl${r.hol ? ' h' : ''}${r.e && isTeacherOnly(r.e) ? ' tonly' : ''}"><i style="background:${o.show.mono ? '#fff' : tint(c)};border-color:${edge(c)}"></i><u>${dnum(r.d)}${r.d2 !== r.d ? '~' + (mnum(r.d2) !== m ? mnum(r.d2) + '/' : '') + dnum(r.d2) : ''}</u>${r.e ? orgTag(r.e, D) : ''}<span>${esc(r.hol || r.e.title)}</span></div>`; }).join('');
    return `<div class="ym" data-fit><div class="ymh"><b>${m}</b>월${months[0][0] !== y || m < months[0][1] ? `<small>${y}</small>` : ''}</div>${miniCal(o, D, y, m)}<div class="yls${cardW >= 78 && list.length > 5 ? ' two' : ''}">${lines || '<div class="yl none">—</div>'}</div></div>`;
  }).join('');
  const s0 = dstr(months[0][0], months[0][1], 1), lm = months[n - 1], s1 = dstr(lm[0], lm[1], lastDay(lm[0], lm[1]));
  const tot = (toD(s1) - toD(s0)) / 864e5 + 1;
  const pos = (a, b) => { const A = a < s0 ? s0 : a, B = b > s1 ? s1 : b; return `left:${((toD(A) - toD(s0)) / 864e5) / tot * 100}%;width:${((toD(B) - toD(A)) / 864e5 + 1) / tot * 100}%`; };
  const inR = (a, b) => a && b && b >= s0 && a <= s1;
  const tl = D.g.orgs.map(org => {
    const bars = D.terms.filter(t => t.org === org && inR(t.start, t.end)).map(t => `<div class="tb term" style="${pos(t.start, t.end)}">${esc(t.name)} <small>${mnum(t.start)}.${dnum(t.start)}~${mnum(t.end)}.${dnum(t.end)}</small></div>`).join('')
      + D.evs.filter(e => isBrk(e) && e._orgs.includes(org) && inR(e.startDate, e.endDate || e.startDate)).map(e => `<div class="tb brk" style="${pos(e.startDate, e.endDate || e.startDate)}">${esc(e.title.replace(/\s/g, ''))}</div>`).join('');
    return `<div class="tbs">${D.g.key === 'both' ? `<em style="color:${LOOK[org].tag}">${esc(LOOK[org].short)}</em>` : ''}${bars}</div>`;
  }).join('');
  const ticks = months.map(([y, m]) => `<span style="${pos(dstr(y, m, 1), dstr(y, m, lastDay(y, m)))}">${m}월</span>`).join('');
  const ay = acYearOf(months[0][0], months[0][1]);
  const isYear = n === 12 && months[0][1] === 3;
  const term = !isYear && D.terms.find(t => t.org === D.g.orgs[0] && t.start.slice(0, 7) === ymKey(months[0][0], months[0][1]) && t.end.slice(0, 7) === ymKey(lm[0], lm[1]));
  const pn = part && part.n > 1 ? ` <small>(${part.i + 1}/${part.n})</small>` : '';
  const title = isYear ? `<b>${ay}</b><span>학년도 학사일정${pn}</span>` : term ? `<b>${esc(term.name)}</b><span>학사일정${pn}</span>`
    : n === 1 ? `<b>${lm[1]}</b><span>월 학사일정${pn}</span>` : `<b>${months[0][1]}~${lm[1]}</b><span>월 학사일정${pn}</span>`;
  const cats = [...new Set(D.evs.map(e => e.category))].filter(Boolean);
  const nk = `${D.g.key}|year|${ymKey(months[0][0], months[0][1])}`;
  const nb = noteBox(o, D, nk);
  return pageOpen(o, D, 'year') + head(o, D, title, isYear ? '한눈에 보기' : `${ay}학년도 · 한눈에 보기`)
    + `<div class="tl"><div class="tt0">${ticks}</div>${tl}</div>`
    + `<div class="yg" style="grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${rowsN},minmax(0,1fr))">${cards}</div>`
    + `<footer class="pf yf">${nb}<div class="fb sm">${legend(cats, D)}<div class="cv">날짜는 사정에 따라 바뀔 수 있어요</div></div></footer>` + footLine(D) + `</section>`;
}

/* ═══ 글자 자동 맞춤 ═══
   쪽을 실제 크기(mm)로 그려 두고 --u(본문 글자 pt)를 키웠다 줄였다 하며 넘치지 않는 가장 큰 값을 찾는다. */
/* 쪽은 그림자 상자(Shadow DOM) 안에 그린다 — 학사일정 화면의 CSS·다크 모드가 쪽에 스며들지 않게 (화면·재기·인쇄 모두 같은 상자) */
function shadowBox(cls){
  const host = document.createElement('div'); if(cls) host.className = cls;
  const sr = host.attachShadow({ mode:'open' });
  sr.innerHTML = `<style>${PAGE_CSS}</style><div class="acp-root"></div>`;
  return { host, root: sr.querySelector('.acp-root') };
}
let MEAS = null;
function meas(){ if(MEAS && MEAS.host.isConnected) return MEAS.root; MEAS = shadowBox('acp-meas'); document.body.appendChild(MEAS.host); return MEAS.root; }
const pvPages = () => [...document.querySelectorAll('#acp-pv .acp-shost')].flatMap(h => [...h.shadowRoot.querySelectorAll('.acp-pg')]);
function overflow(pg){
  if(pg.scrollHeight > pg.clientHeight + 1) return true;
  for(const el of pg.querySelectorAll('[data-fit]')) if(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return true;
  return false;
}
function fitEl(pg, lo, hi){
  const set = v => pg.style.setProperty('--u', v.toFixed(2));
  set(hi); if(!overflow(pg)) return { u:hi, ok:true };
  set(lo); if(overflow(pg)) return { u:lo, ok:false };
  let a = lo, b = hi;
  for(let i = 0; i < 9; i++){ const mid = (a + b) / 2; set(mid); if(overflow(pg)) b = mid; else a = mid; }
  set(a); return { u:a, ok:true };
}
/* 일정은 덜어 내지 않는다 (v-116 · «외 n건» 없음) — 정해 둔 가장 작은 글자보다 조금 더(×0.88) 줄여 보고,
   그래도 넘치면 달력형은 주를, 한눈에는 달을 나눠 여러 쪽으로 */
const U_FLOOR = .88;
function splitEven(n, k){ const out = []; let a = 0; for(let i = 0; i < k; i++){ const b = Math.round(n * (i + 1) / k); out.push({ a, b, i, n:k }); a = b; } return out; }
function rangeFor(o){ const r = U_RANGE[o.layout] || U_RANGE.cal, pk = PAPER_K[o.paper] || PAPER_K.A4; return [r[0] * pk.lo, r[1] * pk.hi]; }
/* 한 쪽 그리기 + 맞추기 → 완성된 HTML 들 (목록형은 넘치면 여러 쪽) */
function buildSpec(o, sp){
  const host = meas(); const [lo, hi] = rangeFor(o);
  const render = html => { host.innerHTML = html; return host.firstElementChild; };
  if(sp.kind === 'list'){
    const D = sp.D, rows = listRows(o, D, sp.y, sp.m);
    let pg = render(pageList(o, D, sp.y, sp.m)); let r = fitEl(pg, lo, hi);
    if(r.ok){ spread(pg); return [pg.outerHTML]; }
    // 넘친다 — 가장 작은 글자에서 한 쪽에 들어가는 줄 수만큼씩 나눈다
    const parts = []; let rest = rows.slice(); let guard = 0;
    while(rest.length && guard++ < 20){
      let k = rest.length;
      const tryN = n => { const pt = { rows:rest.slice(0, n), i:parts.length, n:parts.length + 2, all:rows }; const el = render(pageList(o, D, sp.y, sp.m, pt)); el.style.setProperty('--u', lo.toFixed(2)); return !overflow(el); };
      if(!tryN(k)){ let a = 1, b = k; while(a < b){ const mid = Math.ceil((a + b) / 2); if(tryN(mid)) a = mid; else b = mid - 1; } k = Math.max(1, a); }
      parts.push(rest.slice(0, k)); rest = rest.slice(k);
    }
    // 마지막 쪽은 바닥(매주·안내·범례)이 붙으니 다시 재어 넘치면 줄을 한 쪽 더로 넘긴다
    for(let g2 = 0; g2 < 40; g2++){
      const i = parts.length - 1, el = render(pageList(o, D, sp.y, sp.m, { rows:parts[i], i, n:parts.length, all:rows }));
      el.style.setProperty('--u', lo.toFixed(2)); if(!overflow(el) || parts[i].length <= 1) break;
      const mv = []; while(parts[i].length > 1){ mv.unshift(parts[i].pop()); const e2 = render(pageList(o, D, sp.y, sp.m, { rows:parts[i], i, n:parts.length + 1, all:rows })); e2.style.setProperty('--u', lo.toFixed(2)); if(!overflow(e2)) break; }
      parts.push(mv);
    }
    // 같은 달의 쪽들은 같은 글자 크기로 (쪽마다 크기가 달라 보이지 않게) — 가장 작은 쪽에 맞춘다
    const fits = parts.map((rs, i) => { const el = render(pageList(o, D, sp.y, sp.m, { rows:rs, i, n:parts.length, all:rows })); return fitEl(el, lo, hi).u; });
    const u = Math.min(...fits);
    return parts.map((rs, i) => { const el = render(pageList(o, D, sp.y, sp.m, { rows:rs, i, n:parts.length, all:rows })); el.style.setProperty('--u', u.toFixed(2)); return el.outerHTML; });
  }
  // 달력형 · 한눈에 — 한 쪽에 다 들어가는 가장 큰 글자 · 모자라면 나눈다
  const floor = lo * U_FLOOR;
  if(sp.kind === 'cal'){
    const one = fitEl(render(pageCal(o, sp.D, sp.y, sp.m)), floor, hi);
    if(one.ok){ const el = render(pageCal(o, sp.D, sp.y, sp.m)); el.style.setProperty('--u', one.u.toFixed(2)); if(one.u < lo - .01) el.dataset.small = '1'; return [el.outerHTML]; }
    // 주를 차례로 담다가 넘치면 다음 쪽으로 (바닥 칸은 늘 넣어 보고 잰다 — 어느 쪽이 마지막이 될지 모르니)
    const N = calWeeks(sp.y, sp.m), fitsAt = (a, b, u) => { const el = render(pageCal(o, sp.D, sp.y, sp.m, { a, b, i:0, n:2, foot:true })); el.style.setProperty('--u', u.toFixed(2)); return !overflow(el); };
    const parts = []; let a = 0;
    while(a < N){ let b = a + 1; while(b < N && fitsAt(a, b + 1, floor)) b++; parts.push([a, b]); a = b; }
    const n = parts.length, P = parts.map(([a, b], i) => ({ a, b, i, n }));
    // 같은 달 쪽들은 같은 글자 — 한 주만으로도 넘치는 쪽은 더 작게(최소 5.2pt)
    const us = P.map(pt => { const el = render(pageCal(o, sp.D, sp.y, sp.m, pt)); const r = fitEl(el, floor, hi); return r.ok ? r.u : fitEl(el, Math.min(5.2, floor), floor).u; });
    const u = Math.min(...us);
    return P.map(pt => { const el = render(pageCal(o, sp.D, sp.y, sp.m, pt)); el.style.setProperty('--u', u.toFixed(2));
      el.dataset.split = String(n); if(u < lo - .01) el.dataset.small = '1'; if(overflow(el)) el.dataset.over = '1'; return el.outerHTML; });
  }
  // 한눈에 — 달을 고르게 나눠 (12달 → 6+6 …) 달 칸 크기가 같게
  const N = sp.months.length;
  const draw = pt => pageYear(o, sp.D, pt ? sp.months.slice(pt.a, pt.b) : sp.months, pt);
  const maxK = Math.min(4, N);
  for(let k = 1; k <= maxK; k++){
    const parts = k === 1 ? [null] : splitEven(N, k);
    const us = []; let ok = true;
    for(const pt of parts){ const r = fitEl(render(draw(pt)), floor, hi); us.push(r.u); if(!r.ok){ ok = false; break; } }
    if(!ok && k < maxK) continue;
    const u = Math.min(...us);   // 나눈 쪽들은 같은 글자 크기로
    return parts.map(pt => { const el = render(draw(pt)); el.style.setProperty('--u', u.toFixed(2));
      if(u < lo - .01) el.dataset.small = '1'; if(k > 1) el.dataset.split = String(k); if(!ok) el.dataset.over = '1';
      return el.outerHTML; });
  }
}
function calWeeks(y, m){ const first = dstr(y, m, 1); return Math.ceil((dowOf(first) + lastDay(y, m)) / 7); }
/* 목록형 — 글자가 가장 커도 쪽이 남으면 줄 간격을 넓혀 고르게 */
function spread(pg){
  const box = pg.querySelector('.lwrap'), tb = box && box.querySelector('table'); if(!tb) return;
  let a = 1, b = 2.6; const set = v => pg.style.setProperty('--rp', v.toFixed(2));
  set(b); if(!overflow(pg) && tb.offsetHeight <= box.clientHeight) return;
  for(let i = 0; i < 8; i++){ const mid = (a + b) / 2; set(mid); if(overflow(pg) || tb.offsetHeight > box.clientHeight) b = mid; else a = mid; }
  set(a);
}

/* ═══ 인쇄 창 ═══ */
let O = null, MODEL = null, SPECS = [], CACHE = {}, BUSY = 0, PV_IDX = 0;
const sig = o => JSON.stringify([o.orgs, o.withAll, o.together, o.audience, o.layout, o.period, o.from, o.to, o.paper, o.orient, o.show, o.timeAt, notes(), foots()]);
function resolvePaper(o, months){
  const key = layoutKey(o, months.length); const p = o.paperBy[key] || defPaper(key);
  o.paper = p.paper; o.orient = p.orient; o._pkey = key;
}
async function rebuild(){
  const my = ++BUSY;
  const can = C().printableOrgs(); O.orgs = O.orgs.filter(x => can.includes(x)); if(!O.orgs.length) O.orgs = can.slice(0, 1);
  const months = monthsOf(O); resolvePaper(O, months);
  const dkey = JSON.stringify([O.orgs, O.withAll, O.together, O.audience, months[0], months[months.length - 1]]);
  if(!MODEL || MODEL.key !== dkey){ setStatus('일정을 불러오는 중…'); const groups = await gather(O, months); if(my !== BUSY) return; MODEL = { key:dkey, groups, months }; }
  SPECS = [];
  MODEL.groups.forEach(D => {
    if(O.layout === 'year') SPECS.push({ kind:'year', D, months, label:`${D.g.key === 'both' ? '두 기관' : LOOK[D.g.key].short}` });
    else months.forEach(([y, m]) => SPECS.push({ kind:O.layout, D, y, m, label:`${MODEL.groups.length > 1 ? LOOK[D.g.key].short + ' ' : ''}${m}월` }));
  });
  CACHE = {}; PV_IDX = Math.min(PV_IDX, Math.max(0, SPECS.length - 1));
  renderPanel(); syncFileName(); await showPreview(my);
}
function specPages(i){ const s = sig(O) + '|' + i; if(!CACHE[s]) CACHE[s] = buildSpec(O, SPECS[i]); return CACHE[s]; }
function noteKeyOf(sp){ return sp.kind === 'year' ? `${sp.D.g.key}|year|${ymKey(sp.months[0][0], sp.months[0][1])}` : `${sp.D.g.key}|${ymKey(sp.y, sp.m)}`; }
async function showPreview(my){
  const pv = $('acp-pv'); if(!pv || !SPECS.length){ if(pv) pv.innerHTML = '<div class="acp-empty">고른 기간에 인쇄할 쪽이 없어요</div>'; setStatus(''); return; }
  setStatus('쪽을 맞추는 중…'); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  if(my != null && my !== BUSY) return;
  const pages = specPages(PV_IDX);
  pv.innerHTML = `<div class="acp-sheets"></div>`;
  const wrap = pv.firstElementChild;
  pages.forEach(h => { const sh = document.createElement('div'); sh.className = 'acp-sheet'; const b = shadowBox('acp-shost'); b.root.innerHTML = h; sh.appendChild(b.host); wrap.appendChild(sh); });
  scalePreview(); setStatus(''); renderPager(); syncNote();
  // 일정은 줄이지 않는다 — 글자를 작게 했거나 쪽을 나눴으면 알려 준다 (v-116)
  const pg0 = pvPages()[0], hn = $('acp-pg') && $('acp-pg').querySelector('.hint');
  if(hn && pvPages().some(p => p.dataset.over)){ hn.classList.add('warn'); hn.textContent = '⚠ 하루에 일정이 너무 많아 달력에 다 담기지 않아요 — 이 달은 목록형으로 뽑아 주세요'; return; }
  if(hn && pg0 && (pg0.dataset.small || pg0.dataset.split)){
    const alt = O.layout === 'cal' ? (O.orient === 'l' ? '세로형' : '') : '';
    const tip = [alt, O.paper === 'A4' ? 'A3' : ''].filter(Boolean).join('·');
    hn.classList.add('warn');
    hn.textContent = pg0.dataset.split ? `ⓘ 일정이 많아 ${pg0.dataset.split}쪽으로 나눴어요 — 모든 일정이 다 들어가요${tip ? ` · ${tip}로 바꾸면 쪽이 줄 수 있어요` : ''}`
      : `ⓘ 일정이 많아 글자를 조금 작게 했어요 (${(+pg0.style.getPropertyValue('--u')).toFixed(1)}pt) — 모든 일정이 다 들어가요${tip ? ` · ${tip}로 바꾸면 더 크게` : ''}`;
  }
}
function scalePreview(){
  const pv = $('acp-pv'); if(!pv) return;
  const r = pv.getBoundingClientRect();
  pv.querySelectorAll('.acp-sheet').forEach((sh, i, all) => {
    const host = sh.querySelector('.acp-shost'), pg = host && host.shadowRoot.querySelector('.acp-pg'); if(!pg) return;
    const w = pg.offsetWidth, h = pg.offsetHeight, many = all.length > 1;
    const k = Math.min((r.width - 40) / w, many ? 9 : (r.height - 36) / h);
    sh.style.width = (w * k) + 'px'; sh.style.height = (h * k) + 'px';
    sh.firstElementChild.style.transform = `scale(${k})`;
  });
}
function setStatus(t){ const s = $('acp-st'); if(s){ s.textContent = t; s.style.display = t ? '' : 'none'; } }
function renderPager(){
  const pg = $('acp-pg'); if(!pg) return;
  const dm = dims(O.paper, O.orient);
  pg.innerHTML = `<button class="nv" data-nv="-1" ${PV_IDX <= 0 ? 'disabled' : ''} aria-label="앞 쪽">‹</button><button class="nv" data-nv="1" ${PV_IDX >= SPECS.length - 1 ? 'disabled' : ''} aria-label="다음 쪽">›</button>
    <span class="cnt">${PV_IDX + 1} / ${SPECS.length}${O.layout === 'list' ? '' : '장'} · ${O.paper} ${O.orient === 'l' ? '가로' : '세로'}</span>
    ${SPECS.length > 1 ? `<div class="th">${SPECS.map((s, i) => `<button data-pi="${i}" class="${i === PV_IDX ? 'on' : ''}">${esc(s.label)}</button>`).join('')}</div>` : ''}
    <span class="hint">미리보기는 실제 인쇄와 같은 비율 · 글자 크기는 쪽마다 자동으로 맞춰요</span>`;
}
function syncNote(){
  const ta = $('acp-note'), lb = $('acp-note-l'); if(!ta || !SPECS[PV_IDX]) return;
  const sp = SPECS[PV_IDX], k = noteKeyOf(sp);
  ta.dataset.key = k; if(document.activeElement !== ta) ta.value = notes()[k] || '';
  if(lb) lb.textContent = sp.kind === 'year' ? `${sp.label} · 한 장 전체` : `${sp.D.g.key === 'both' ? '두 기관' : LOOK[sp.D.g.key].short} · ${sp.y}년 ${sp.m}월`;
}
const LAY_ICO = {
  cal:'<svg width="44" height="31" viewBox="0 0 44 31"><rect x=".7" y=".7" width="42.6" height="29.6" rx="3" fill="#fff" stroke="currentColor" stroke-opacity=".45"/><rect x="1" y="1" width="42" height="5.5" rx="2.5" fill="currentColor" fill-opacity=".18"/>' + [0, 1, 2, 3].map(r => [0, 1, 2, 3, 4, 5, 6].map(c => `<rect x="${3 + c * 5.6}" y="${8.5 + r * 5.3}" width="4.8" height="4.4" rx=".6" fill="${(r * 7 + c) % 5 === 2 ? '#B9A7EA' : '#E6E8E3'}"/>`).join('')).join('') + '</svg>',
  list:'<svg width="31" height="38" viewBox="0 0 31 38"><rect x=".7" y=".7" width="29.6" height="36.6" rx="3" fill="#fff" stroke="currentColor" stroke-opacity=".45"/><rect x="4" y="4" width="15" height="3.4" rx="1" fill="currentColor" fill-opacity=".7"/>' + [0, 1, 2, 3, 4, 5].map(r => `<rect x="4" y="${11 + r * 4.3}" width="4" height="2.4" fill="#C9CDC8"/><rect x="10" y="${11 + r * 4.3}" width="${10 + (r % 3) * 4}" height="2.4" fill="${r % 2 ? '#B9A7EA' : '#9FBFE6'}"/>`).join('') + '</svg>',
  year:'<svg width="31" height="38" viewBox="0 0 31 38"><rect x=".7" y=".7" width="29.6" height="36.6" rx="3" fill="#fff" stroke="currentColor" stroke-opacity=".45"/><rect x="4" y="4" width="23" height="2.8" rx="1" fill="currentColor" fill-opacity=".7"/>' + [0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect x="${4 + c * 7.9}" y="${9.5 + r * 6.8}" width="7" height="5.9" rx="1" fill="#EEF0EC" stroke="#D3D7D1" stroke-width=".5"/>`).join('')).join('') + '</svg>',
};
/* 달력 방향 그림 (가로형 · 세로형) */
const calIco = (w, h) => { const x0 = 3, y0 = 6, W = w - 6, H = h - 9; let g = '';
  for(let i = 1; i < 7; i++) g += `<line x1="${(x0 + W * i / 7).toFixed(1)}" y1="${y0}" x2="${(x0 + W * i / 7).toFixed(1)}" y2="${y0 + H}"/>`;
  for(let j = 1; j < 5; j++) g += `<line x1="${x0}" y1="${(y0 + H * j / 5).toFixed(1)}" x2="${x0 + W}" y2="${(y0 + H * j / 5).toFixed(1)}"/>`;
  return `<svg class="ci" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><rect x=".8" y=".8" width="${w - 1.6}" height="${h - 1.6}" rx="2.5" fill="#fff" stroke="currentColor" stroke-width="1.6"/><rect x="2.4" y="2.4" width="${w - 4.8}" height="3" rx="1" fill="currentColor" opacity=".55"/><g stroke="currentColor" stroke-width=".7" opacity=".45">${g}</g></svg>`; };
const CORI_ICO = { l: calIco(34, 24), p: calIco(24, 34) };
function chip(on, attrs, html, cls){ return `<button type="button" class="acp-chip${on ? ' on' : ''}${cls ? ' ' + cls : ''}" ${attrs}>${html}</button>`; }
function ck(k, label, sub, dis){ return `<label class="acp-ck${dis ? ' dis' : ''}"><input type="checkbox" data-show="${k}" ${O.show[k] ? 'checked' : ''} ${dis ? 'disabled' : ''}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>`; }
function monthOptions(sel){
  const c = C(), ay = acYearOf(c.year, c.month); let h = '';
  for(let y = ay - 1; y <= ay + 1; y++) for(let m = 1; m <= 12; m++){ const k = ymKey(y, m); if(k < `${ay - 1}-03` || k > `${ay + 2}-02`) continue; h += `<option value="${k}" ${k === sel ? 'selected' : ''}>${y}년 ${m}월</option>`; }
  return h;
}
function renderPanel(){
  const L = $('acp-l'); if(!L) return;
  const c = C(), can = c.printableOrgs(), months = monthsOf(O), terms = termList();
  const yearLay = O.layout === 'year';
  const per = [];
  if(!yearLay){ per.push(['this', `이번 달 (${c.month}월)`]); per.push(['next', `다음 달 (${c.month === 12 ? 1 : c.month + 1}월)`]); }
  terms.forEach((t, i) => per.push([`term:${i}`, `${t.name} (${mnum(t.start)}~${mnum(t.end)}월)`]));
  per.push(['acyear', `${acYearOf(c.year, c.month)}학년도 전체`]);
  per.push(['custom', '직접 고르기']);
  const multi = O.orgs.length > 1;
  const nPages = O.layout === 'year' ? MODEL ? MODEL.groups.length : 1 : (MODEL ? MODEL.groups.length : 1) * months.length;
  L.innerHTML = `
    <div class="acp-s"><h4><i>1</i>기관<em>여러 곳을 고를 수 있어요</em></h4>
      <div class="acp-chips">${can.map(o => chip(O.orgs.includes(o), `data-org="${o}"`, `<img src="${LOOK[o].logo}" alt="">${esc(orgName(o))}`, o === 'jihyebit' ? 'jh' : '')).join('')}</div>
      ${multi ? `<div class="acp-seg" style="margin-top:9px">${chip(!O.together, 'data-tog="0"', '기관마다 따로')}${chip(O.together, 'data-tog="1"', '한 장에 함께')}</div>
        <div class="acp-hint">${O.together ? '두 기관 일정을 한 쪽에 모아요 · 기관 이름표(다니엘·지혜빛)가 붙어요 · 처음엔 A3' : '기관마다 로고·색이 다른 쪽이 따로 나와요'}</div>` : ''}
      <label class="acp-ck" style="margin-top:10px"><input type="checkbox" data-withall ${O.withAll ? 'checked' : ''}><span>DA 전체 일정도 함께<small>연합 예배·창립 기념일처럼 두 기관이 같이 하는 일</small></span></label></div>
    <div class="acp-s"><h4><i>2</i>누구에게 줄까요</h4>
      <div class="acp-rad">
        <button type="button" data-aud="parent" class="${O.audience === 'parent' ? 'on' : ''}">👪 학부모용<small>교사 일정·교사만 쉬는 날·담당 메모는 빠져요</small></button>
        <button type="button" data-aud="teacher" class="t ${O.audience === 'teacher' ? 'on' : ''}">🧑‍🏫 교사용<small>교사 일정까지 · 시간·장소·담당 메모</small></button></div></div>
    <div class="acp-s"><h4><i>3</i>기간<em>${yearLay ? `${months.length}달을 한 장에` : `한 달에 한 장 · ${nPages}장`}</em></h4>
      <div class="acp-chips">${per.map(([k, l]) => chip(O.period === k, `data-per="${k}"`, esc(l))).join('')}</div>
      ${O.period === 'custom' ? `<div class="acp-per"><select data-from>${monthOptions(O.from)}</select><span>~</span><select data-to>${monthOptions(O.to)}</select></div>` : ''}</div>
    <div class="acp-s"><h4><i>4</i>모양</h4>
      <div class="acp-lay">
        <button type="button" data-lay="cal" class="${O.layout === 'cal' ? 'on' : ''}">${LAY_ICO.cal}<b>달력형</b><small>게시·가정 배부</small></button>
        <button type="button" data-lay="list" class="${O.layout === 'list' ? 'on' : ''}">${LAY_ICO.list}<b>목록형</b><small>날짜 순 표 · 업무용</small></button>
        <button type="button" data-lay="year" class="${O.layout === 'year' ? 'on' : ''}">${LAY_ICO.year}<b>한눈에</b><small>학년도·학기 한 장</small></button></div>
      ${O.layout === 'cal' ? `<div class="acp-cori">
        <button type="button" data-cori="l" class="${O.orient === 'l' ? 'on' : ''}">${CORI_ICO.l}<span><b>가로형</b><small>칸이 넓어요</small></span></button>
        <button type="button" data-cori="p" class="${O.orient === 'p' ? 'on' : ''}">${CORI_ICO.p}<span><b>세로형</b><small>칸이 높아요</small></span></button></div>
      <div class="acp-hint">일정이 많은 달은 세로형이 한 칸에 더 많이 들어가요 · 일정은 줄이지 않고 모두 넣어요</div>` : ''}</div>
    <div class="acp-s"><h4><i>5</i>용지</h4>
      <div class="acp-seg2"><div class="acp-seg">${chip(O.paper === 'A4', 'data-paper="A4"', 'A4')}${chip(O.paper === 'A3', 'data-paper="A3"', 'A3')}</div>
        <div class="acp-seg">${chip(O.orient === 'l', 'data-ori="l"', '가로')}${chip(O.orient === 'p', 'data-ori="p"', '세로')}</div></div>
      <div class="acp-hint">${O.paper === 'A3' ? 'A3는 A3 프린터가 필요해요 · 없으면 «PDF로 저장» 후 복사기·인쇄소에서' : '한 장에 많이 담는 모양(한눈에 학년도·두 기관 함께)은 처음부터 A3로 골라져요'}</div></div>
    <div class="acp-s"><h4><i>6</i>넣을 것</h4>
      <div class="acp-cks">
        ${ck('noClass', '학년별 «수업 없음»', '체험학습·시험 날 어느 학년이 수업이 없는지')}
        ${ck('weekly', '매주 하는 일은 아래에 한 번만', '수요 채플처럼 매주 있는 일로 칸이 차지 않게', O.layout === 'year')}
        ${ck('summary', '수업일 수 · 쉬는 날 요약', '', O.layout === 'year')}
        ${ck('time', '시간')}
        ${O.layout === 'cal' && O.show.time ? `<div class="acp-tpos"><span>시간 자리</span><div class="acp-seg">${chip(O.timeAt !== 'side', 'data-tat="top"', '제목 윗줄')}${chip(O.timeAt === 'side', 'data-tat="side"', '제목 옆')}</div></div>` : ''}
        ${ck('place', '장소')}
        ${ck('memo', '메모 · 담당', O.audience === 'teacher' ? '' : '교사용에서만', O.audience !== 'teacher' || O.layout === 'year')}
        ${ck('weekNo', '주차 (2학기 7주)', '', O.layout === 'year')}
        ${ck('logo', '기관 로고')}
        ${ck('issued', '발행일')}
        ${ck('mono', '흑백 프린터용', '색 대신 테두리·빗금으로 구분')}</div></div>
    <div class="acp-s"><h4><i>7</i>안내 문구<em id="acp-note-l"></em></h4>
      <textarea id="acp-note" class="acp-note" rows="4" placeholder="이 쪽 아래 «📌 안내»에 들어갈 말 (비워 두면 칸이 안 생겨요)&#10;예: 28일(수) 가을 체육 대회 — 체육복을 입고 등교합니다."></textarea>
      <div class="acp-hint">쪽(기관·달)마다 따로 적고, 이 기기에 기억해 두었다가 다음에 다시 보여 드려요</div>
      <div class="acp-foot">${(O.together ? O.orgs : O.orgs).map(o => `<label><span>${esc(LOOK[o].short)} 맨 아래 한 줄</span><input data-foot="${o}" value="${esc(foots()[o] || '')}" placeholder="예: 문의 교무실 031-000-0000"></label>`).join('')}</div></div>`;
  syncNote();
}
function onPanel(e){
  const b = e.target.closest('button,input,select'); if(!b) return;
  const d = b.dataset; let rb = true;
  if(d.org){ const i = O.orgs.indexOf(d.org); if(i >= 0){ if(O.orgs.length > 1) O.orgs.splice(i, 1); } else O.orgs.push(d.org); O.orgs.sort((a, b2) => ['daniel', 'jihyebit'].indexOf(a) - ['daniel', 'jihyebit'].indexOf(b2)); }
  else if(d.tog != null) O.together = d.tog === '1';
  else if('withall' in d) O.withAll = b.checked;
  else if(d.aud){ if(O.audience !== d.aud){ O.audience = d.aud; if(d.aud === 'teacher'){ O.show.memo = true; O.show.weekNo = true; } else { O.show.memo = false; O.show.weekNo = false; } } }
  else if(d.per){ O.period = d.per; if(d.per === 'custom' && O.layout === 'year'){ const ms = monthsOf(Object.assign({}, O, { period:'acyear' })); O.from = ymKey(...ms[0]); O.to = ymKey(...ms[ms.length - 1]); } }
  else if('from' in d) O.from = b.value;
  else if('to' in d) O.to = b.value;
  else if(d.lay){ O.layout = d.lay; if(d.lay === 'year' && (O.period === 'this' || O.period === 'next')) O.period = 'acyear'; }
  else if(d.paper || d.ori || d.cori){ const cur = O.paperBy[O._pkey] || defPaper(O._pkey); O.paperBy[O._pkey] = { paper:d.paper || cur.paper, orient:d.ori || d.cori || cur.orient }; }
  else if(d.tat){ O.timeAt = d.tat === 'side' ? 'side' : 'top'; }
  else if(d.show){ O.show[d.show] = b.checked; }
  else if(d.foot){ return; }
  else rb = false;
  if(rb){ saveOpts(O); PV_IDX = d.org || d.tog != null ? 0 : PV_IDX; if(d.per || d.lay || 'from' in d || 'to' in d) PV_IDX = 0; rebuild(); }
}
let noteT = 0;
function onInput(e){
  const t = e.target;
  if(t.id === 'acp-note'){ const all = notes(); const v = t.value; if(v.trim()) all[t.dataset.key] = v; else delete all[t.dataset.key]; store.set(NOTE_KEY, all);
    clearTimeout(noteT); noteT = setTimeout(() => showPreview(), 350); }
  if(t.dataset && t.dataset.foot){ const all = foots(); all[t.dataset.foot] = t.value; store.set(FOOT_KEY, all); clearTimeout(noteT); noteT = setTimeout(() => showPreview(), 350); }
}
function onPager(e){
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.nv){ PV_IDX = Math.min(SPECS.length - 1, Math.max(0, PV_IDX + +b.dataset.nv)); showPreview(); }
  if(b.dataset.pi != null){ PV_IDX = +b.dataset.pi; showPreview(); }
}

/* ── 인쇄 — 모든 쪽을 맞춘 뒤 브라우저 인쇄 창 (A4·A3 · 가로·세로를 쪽 크기로 알려 준다) ── */
async function preparePrint(){
  setStatus(`인쇄할 쪽을 맞추는 중… (0/${SPECS.length})`);
  const html = [];
  for(let i = 0; i < SPECS.length; i++){ html.push(...specPages(i)); setStatus(`인쇄할 쪽을 맞추는 중… (${i + 1}/${SPECS.length})`); await new Promise(r => setTimeout(r, 0)); }
  let old = $('acp-print'); if(old) old.remove();
  const pb = shadowBox(); pb.host.id = 'acp-print'; pb.root.innerHTML = html.join('');
  document.body.appendChild(pb.host); const box = pb.root;
  const dm = dims(O.paper, O.orient);
  let st = $('acp-page'); if(!st){ st = document.createElement('style'); st.id = 'acp-page'; document.head.appendChild(st); }
  st.textContent = `@page{size:${dm.w}mm ${dm.h}mm;margin:0}`;
  document.body.classList.add('acp-printing');
  await Promise.all([...box.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
  setStatus('');
  return html.length;
}
function cleanupPrint(){ document.body.classList.remove('acp-printing'); const b = $('acp-print'); if(b) b.remove(); const s = $('acp-page'); if(s) s.remove(); }
window.addEventListener('afterprint', () => setTimeout(cleanupPrint, 50));
/* 저장될 파일 이름 (v-115) — 브라우저 «PDF로 저장»이 이 이름을 쓴다
   예: 학사일정_2026년 10월_다니엘 아마츠_학부모용 · 학사일정_2026학년도_다니엘·지혜빛 함께_교사용_한눈에_A3 */
function printParts(o){
  const c = C(), ms = monthsOf(o), ay = acYearOf(c.year, c.month);
  let per = '';
  if(o.period === 'acyear') per = `${ay}학년도`;
  else if(o.period && o.period.startsWith('term:')){ const t = termList()[+o.period.slice(5)]; if(t && t.name) per = `${ay}학년도 ${t.name}`; }
  if(!per && ms.length){
    const [y0, m0] = ms[0], [y1, m1] = ms[ms.length - 1];
    per = ms.length === 1 ? `${y0}년 ${m0}월` : y0 === y1 ? `${y0}년 ${m0}~${m1}월` : `${y0}년 ${m0}월~${y1}년 ${m1}월`;
  }
  const orgs = o.orgs.length === 1 ? orgName(o.orgs[0]) : o.orgs.map(x => (LOOK[x] && LOOK[x].short) || x).join('·') + (o.together ? ' 함께' : '');
  return ['학사일정', per, orgs, o.audience === 'teacher' ? '교사용' : '학부모용',
    { list:'목록형', year:'한눈에' }[o.layout] || (o.orient === 'p' ? '세로형' : ''), o.paper === 'A3' ? 'A3' : '', o.show && o.show.mono ? '흑백' : ''];
}
function printFileName(o){ const p = printParts(o); return window.FN ? FN.make(p) : p.filter(Boolean).join('_'); }
function syncFileName(){ const el = $('acp-fn'); if(el && O){ const n = printFileName(O) + '.pdf'; el.innerHTML = `📄 저장 이름 · <b>${esc(n)}</b>`; el.title = n; } }
async function doPrint(pdf){
  if(!SPECS.length) return;
  const n = await preparePrint();
  const name = printFileName(O);
  if(pdf) toast(`인쇄 창의 «대상»에서 «PDF로 저장»을 고르세요 (${n}쪽)\n파일 이름: ${name}.pdf`);
  setTimeout(() => { try { window.FN ? FN.printAs(name) : window.print(); } catch(_){} }, 60);
}
/* 인쇄 창이 열려 있을 때 Ctrl+P(⌘P) — 앱 화면 대신 고른 그대로 인쇄 */
window.onPrintKey = () => { if($('acp-ov')){ doPrint(false); return true; } return false; };
function toast(t){ let el = $('acp-toast'); if(el) el.remove(); el = document.createElement('div'); el.id = 'acp-toast'; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 3800); }

/* ── 창 열기 · 닫기 ── */
async function openAcPrint(){
  const c = C(); if(!c){ alert('학사일정을 불러온 뒤에 다시 눌러 주세요.'); return; }
  if(c.share) return;
  injectCSS();
  O = freshOpts(); window.__acpOpts = O; MODEL = null; CACHE = {}; PV_IDX = 0;
  let ov = $('acp-ov'); if(ov) ov.remove();
  ov = document.createElement('div'); ov.id = 'acp-ov'; ov.className = 'acp-ov';
  ov.innerHTML = `<div class="acp" role="dialog" aria-label="학사일정 인쇄">
    <div class="acp-hd"><div class="ic">🖨</div><div><b>학사일정 인쇄</b><small>고르면 오른쪽에 인쇄될 모양이 바로 보여요 · 보이는 그대로 인쇄돼요</small></div><button class="x" aria-label="닫기" data-close>✕</button></div>
    <div class="acp-bd"><div class="acp-l" id="acp-l"></div>
      <div class="acp-r"><div class="acp-pv" id="acp-pv"></div><div class="acp-st" id="acp-st" style="display:none"></div><div class="acp-pgr" id="acp-pg"></div></div></div>
    <div class="acp-ft"><span class="tip" id="acp-fn">💡 PDF로 받으려면 인쇄 창의 «대상»에서 «PDF로 저장» — 가정통신문·카톡 보내기용</span>
      <button class="sc r" data-close>닫기</button><button class="sc" data-pdf>📄 PDF로 저장</button><button class="pr" data-print>🖨 인쇄하기</button></div></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if(e.target === ov || e.target.closest('[data-close]')) closeAcPrint(); else if(e.target.closest('[data-print]')) doPrint(false); else if(e.target.closest('[data-pdf]')) doPrint(true); });
  $('acp-l').addEventListener('click', e => { if(e.target.closest('input,select,textarea,label')) return; onPanel(e); });
  $('acp-l').addEventListener('change', e => { if(e.target.matches('select,input[type=checkbox]')) onPanel(e); });
  $('acp-l').addEventListener('input', onInput);
  $('acp-pg').addEventListener('click', onPager);
  document.addEventListener('keydown', escClose);
  try { await (document.fonts && document.fonts.load ? Promise.race([Promise.all([document.fonts.load('900 20px "Noto Sans KR"'), document.fonts.load('700 12px "Noto Sans KR"')]), new Promise(r => setTimeout(r, 1500))]) : 0); } catch(_){}
  await rebuild();
}
function escClose(e){ if(e.key === 'Escape' && $('acp-ov') && !document.documentElement.classList.contains('hp-open')) closeAcPrint(); }
function closeAcPrint(){ const ov = $('acp-ov'); if(ov) ov.remove(); document.removeEventListener('keydown', escClose); cleanupPrint(); if(MEAS){ MEAS.host.remove(); MEAS = null; } }
window.openAcPrint = openAcPrint; window.closeAcPrint = closeAcPrint;
window.addEventListener('resize', () => { clearTimeout(window.__acpR); window.__acpR = setTimeout(scalePreview, 120); });
/* 시험·점검용 */
window.acPrintDebug = { pages: () => pvPages(), get opts(){ return O; }, set(p){ const sh = p.show; const q = Object.assign({}, p); delete q.show; Object.assign(O, q); if(sh) O.show = Object.assign({}, O.show, sh); return rebuild(); }, preparePrint, cleanupPrint, get specs(){ return SPECS; }, specPages, monthsOf:() => monthsOf(O) };

/* ═══ 모양 (쪽 · 인쇄 창) ═══ */
function injectCSS(){
  if($('acp-css')) return;
  const st = document.createElement('style'); st.id = 'acp-css'; st.textContent = CSS; document.head.appendChild(st);
}
const PAGE_CSS = `
:host{all:initial;display:block}
.acp-root,.acp-root *{box-sizing:border-box}
.acp-root{font-family:'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1F2320;-webkit-print-color-adjust:exact;print-color-adjust:exact;line-height:1.35}
/* ── 쪽 공통 ── (--k: 용지 배율 · --u: 본문 글자 pt · 자동 맞춤) */
.acp-pg{--U:calc(var(--u) * 1pt);--K:var(--k);background:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;padding:calc(8mm * var(--K)) calc(9mm * var(--K)) calc(7mm * var(--K));break-after:page;page-break-after:always}
.acp-pg:last-child{break-after:auto;page-break-after:auto}
.acp-pg .ph{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:calc(4mm * var(--K));padding-bottom:calc(2.8mm * var(--K));border-bottom:calc(.7mm * var(--K)) solid var(--ac);margin-bottom:calc(2.6mm * var(--K));flex:none}
.acp-pg .ph-org{display:flex;align-items:center;gap:calc(2.4mm * var(--K));min-width:0}
.acp-pg .ph-org img{height:calc(13mm * var(--K));width:auto}
.acp-pg .ph-org b{display:block;font-size:calc(12.5pt * var(--K));font-weight:900;color:var(--ac);letter-spacing:-.2pt;white-space:nowrap}
.acp-pg .ph-org span{display:block;font-size:calc(7.8pt * var(--K));color:#6B756F;margin-top:.4mm}
.acp-pg .ph-t{display:flex;align-items:baseline;gap:calc(1.2mm * var(--K));color:var(--ac);white-space:nowrap}
.acp-pg .ph-t b{font-size:calc(30pt * var(--K));font-weight:900;line-height:1;letter-spacing:-1pt}
.acp-pg .ph-t span{font-size:calc(17pt * var(--K));font-weight:900;letter-spacing:-.4pt;color:#1F2320}
.acp-pg .ph-t small{font-size:calc(9pt * var(--K));font-weight:700;color:#6B756F}
.acp-pg .ph-r{display:flex;flex-direction:column;align-items:flex-end;gap:calc(.6mm * var(--K));font-size:calc(7.8pt * var(--K));color:#6B756F}
.acp-pg .ph-aud{font-size:calc(8.4pt * var(--K));font-weight:900;color:#fff;background:var(--ac2);border-radius:10mm;padding:calc(.6mm * var(--K)) calc(3mm * var(--K))}
.acp-pg .ph-aud.t{background:#8A6410}
.acp-pg .red{color:#C0392B}.acp-pg .blue{color:#2B6CB0}
.acp-pg .ot{display:inline-block;font-style:normal;font-size:calc(var(--U)*.7);font-weight:900;color:#fff;border-radius:.8mm;padding:0 .9mm;margin-right:.9mm;line-height:1.5;vertical-align:.08em}
.acp-pg .ot.all{background:#8A8F96}
.acp-pg .tt{display:inline-block;font-style:normal;font-size:calc(var(--U)*.68);font-weight:900;color:#fff;background:#8A6410;border-radius:.8mm;padding:0 .8mm;margin-right:.8mm;line-height:1.5;vertical-align:.08em}
/* 바닥 */
.acp-pg .pf{display:grid;gap:calc(2.4mm * var(--K));margin-top:calc(2.4mm * var(--K));flex:none;max-height:28%}
.acp-pg .fb{border:.3mm solid #DADDD8;border-radius:1.6mm;padding:calc(var(--U)*.55) calc(var(--U)*.9);font-size:calc(var(--U)*.92);line-height:1.5;color:#3A423D;overflow:hidden;min-width:0}
.acp-pg .fb>b{display:block;font-size:calc(var(--U)*.92);font-weight:900;color:var(--ac);margin-bottom:.4mm}
.acp-pg .fb em{font-style:normal;font-weight:800;border-bottom:.5mm solid}
.acp-pg .fb.nt{background:var(--tn);border-color:transparent}
.acp-pg .fb.sm{display:flex;flex-direction:column;gap:calc(var(--U)*.3)}
.acp-pg .cnt{font-size:calc(var(--U)*.95)}.acp-pg .cnt b{font-size:calc(var(--U)*1.35);color:var(--ac);font-weight:900}.acp-pg .cnt small{font-size:calc(var(--U)*.78);color:#6B756F;margin-left:1.4mm}
.acp-pg .lg{display:flex;flex-wrap:wrap;gap:calc(var(--U)*.15) calc(var(--U)*.8);font-size:calc(var(--U)*.8);color:#4A544E}
.acp-pg .lg span{display:inline-flex;align-items:center;gap:.8mm}
.acp-pg .lg i{width:calc(var(--U)*1.1);height:calc(var(--U)*.8);border-radius:.5mm;border-left:.7mm solid;display:inline-block}
.acp-pg .lg i.hol{background:#FDF2F1;border-color:#C0392B}
.acp-pg .lg i.ot{width:auto;height:auto;border:0}
.acp-pg .fl{flex:none;margin-top:calc(1.6mm * var(--K));font-size:calc(7.6pt * var(--K));color:#6B756F;text-align:right}
/* ── 달력형 ── */
.acp-pg .cal{flex:1;display:flex;flex-direction:column;border:.35mm solid #C9CDC8;border-radius:1.6mm;overflow:hidden;min-height:0}
.acp-pg .dow{display:grid;background:var(--tn);border-bottom:.35mm solid #C9CDC8;flex:none}
.acp-pg .dow div{text-align:center;font-size:calc(var(--U)*1.02);font-weight:900;padding:calc(var(--U)*.28) 0;color:var(--ac)}
.acp-pg .dow .red{color:#C0392B}.acp-pg .dow .blue{color:#2B6CB0}
.acp-pg .dow .dwn{font-size:calc(var(--U)*.7);color:#6B756F;font-weight:800;align-self:center}
/* 주 줄 — 고르게 나누되, 일정이 많은 주는 내용만큼 (min-content) 키운다 */
.acp-pg .wk{flex:1 0 0;display:grid;border-bottom:.25mm solid #DADDD8;min-height:min-content}
.acp-pg .wk:last-child{border-bottom:0}
.acp-pg .wn{background:#F4F5F2;border-right:.25mm solid #DADDD8;color:#6B756F;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25mm;text-align:center;padding:1mm .8mm;min-width:0;word-break:keep-all;overflow-wrap:anywhere}
.acp-pg .wn span{font-size:calc(var(--U)*.72);font-weight:800;line-height:1.2}
.acp-pg .wn b{font-size:calc(var(--U)*.92);font-weight:900;line-height:1.2;color:var(--ac)}
.acp-pg .cc{border-right:.25mm solid #E3E5E1}
.acp-pg .cc.out{background:#F6F6F4}.acp-pg .cc.hol{background:#FDF2F1}.acp-pg .cc.brk{background:#FFF7E8}.acp-pg .cc.stf{background:#F7F5EE}
.acp-pg .cd{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:calc(var(--U)*.35);row-gap:0;padding:calc(var(--U)*.22) calc(var(--U)*.42) calc(var(--U)*.12);min-width:0;z-index:1}
.acp-pg .cd b{font-size:calc(var(--U)*1.2);font-weight:900;flex:none}
.acp-pg .cd.out b{color:#B8BDB9;font-weight:700}
.acp-pg .hn{font-size:calc(var(--U)*.8);font-weight:800;line-height:1.25;color:#C0392B;min-width:0;word-break:keep-all;overflow-wrap:anywhere}
.acp-pg .hn.s{color:#8A7A4A}
.acp-pg .nc{margin-left:auto;font-size:calc(var(--U)*.68);font-weight:800;line-height:1.35;color:#5A6560;background:#ECEEEA;border-radius:1mm;padding:.15mm 1mm;min-width:0;word-break:keep-all;overflow-wrap:anywhere;align-self:center}
.acp-pg .ev{z-index:1;margin:calc(var(--U)*.07) calc(var(--U)*.24);border-left:calc(var(--U)*.22) solid;border-radius:.8mm;padding:calc(var(--U)*.06) calc(var(--U)*.34);font-size:var(--U);font-weight:700;line-height:1.28;min-width:0;word-break:keep-all;overflow-wrap:anywhere}
.acp-pg .ev b{font-weight:700}
.acp-pg .ev u{text-decoration:none;font-weight:800;color:#4A544E;font-size:calc(var(--U)*.86);margin-right:.9mm}
/* 시간 — 제목 윗줄에 따로 (기본) */
.acp-pg .ev .et{display:block;line-height:1.15;margin-bottom:.15mm}
.acp-pg .ev .et u{font-size:calc(var(--U)*.8);margin:0}
/* 시간 — 제목 옆 칸 (줄이 바뀌어도 제목 첫 글자에 맞춰 내려간다) */
.acp-pg .ev.sd{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:1mm;align-items:start}
.acp-pg .ev.sd u{margin:0;font-size:calc(var(--U)*.8);line-height:1.6;white-space:nowrap}
.acp-pg .ev.sd u s{text-decoration:none;font-weight:700;color:#7A847E;display:block;line-height:1.1}
.acp-pg .ev small.mm{display:block;line-height:1.25}
.acp-pg .ev small{font-size:calc(var(--U)*.82);font-weight:600;color:#4A544E}
.acp-pg .ev.bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:1mm;row-gap:0;text-align:center;min-height:calc(var(--U)*1.62);padding-top:calc(var(--U)*.05);padding-bottom:calc(var(--U)*.05)}
.acp-pg .ev.bar span{min-width:0}
.acp-pg .ev.bar u{margin:0}
/* 관리자 휴일 띠 (며칠 이어지는 쉬는 날) */
.acp-pg .ev.hb{background:#FBE5E2;border-color:#C0392B;color:#A93226;font-weight:800}
.acp-pg .ev.hb.s{background:#F2EDE0;border-color:#8A7A4A;color:#6E6038}
.acp-pg .ev.cl{border-left-style:dotted;border-top-left-radius:0;border-bottom-left-radius:0}
.acp-pg .ev.cr{border-top-right-radius:0;border-bottom-right-radius:0}
.acp-pg .ev.tonly{border-style:dashed;border-left-style:solid;border-width:.25mm .25mm .25mm calc(var(--U)*.22);background:#fff!important}
.acp-pg .sg{z-index:1;min-height:0;display:flex;flex-direction:column;padding-bottom:.4mm}
/* ── 목록형 ── */
.acp-pg .lsum{display:grid;grid-template-columns:1fr calc(62mm * var(--K));gap:calc(4mm * var(--K));margin-bottom:calc(2.6mm * var(--K));flex:none}
.acp-pg .sumtx{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:calc(2.2mm * var(--K))}
.acp-pg .sumtx>div{background:var(--tn);border-radius:1.8mm;padding:calc(var(--U)*.55) calc(var(--U)*.8);display:flex;flex-direction:column;justify-content:center;min-width:0}
.acp-pg .sumtx em{font-style:normal;font-size:calc(var(--U)*.86);font-weight:800;color:var(--ac)}
.acp-pg .sumtx p{margin:.3mm 0 0;font-size:calc(var(--U)*1);font-weight:800}
.acp-pg .sumtx p b{font-size:calc(var(--U)*2);font-weight:900;line-height:1.1;margin-right:.6mm}
.acp-pg .sumtx small{font-size:calc(var(--U)*.74);color:#6B756F;line-height:1.4}
.acp-pg .mini{border:.3mm solid #DADDD8;border-radius:1.6mm;padding:calc(var(--U)*.35)}
.acp-pg .mini .mh,.acp-pg .mini .mg{display:grid;grid-template-columns:repeat(7,1fr);text-align:center}
.acp-pg .mini i{font-style:normal;font-size:calc(var(--U)*.78);font-weight:700;line-height:1.95;border-radius:50%;margin:.15mm .35mm}
.acp-pg .mini .mh i{font-weight:900;color:#6B756F;font-size:calc(var(--U)*.7)}
.acp-pg .mini .mh i.red{color:#C0392B}.acp-pg .mini .mh i.blue{color:#2B6CB0}
.acp-pg .mini .brk{box-shadow:inset 0 0 0 .35mm #E7B868}
.acp-pg .lwrap{flex:1;min-height:0;overflow:hidden}
.acp-pg .lt{width:100%;border-collapse:collapse;font-size:var(--U);table-layout:fixed;--rp:1}
.acp-pg .lt th{background:var(--ac);color:#fff;font-weight:800;font-size:calc(var(--U)*.9);padding:calc(var(--U)*.42) calc(var(--U)*.7);text-align:left}
.acp-pg .lt th.c1{width:16%}.acp-pg .lt th.c3{width:22%}.acp-pg .lt th.c4{width:27%}
.acp-pg .lt td{border-bottom:.25mm solid #E3E5E1;padding:calc(var(--U)*.32*var(--rp,1)) calc(var(--U)*.7);vertical-align:top;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere}
.acp-pg.land .lt th.c1{width:12%}.acp-pg.land .lt th.c3{width:22%}.acp-pg.land .lt th.c4{width:30%}
.acp-pg .lt tr.wb td{background:#F4F5F2;font-size:calc(var(--U)*.82);font-weight:900;color:var(--ac);padding:calc(var(--U)*.24) calc(var(--U)*.7);border-bottom:0}
.acp-pg .lt tr.wb b{margin-right:2mm}.acp-pg .lt tr.wb span{font-weight:700;color:#6B756F}
.acp-pg .lt td.ttl b{font-weight:800}
.acp-pg .lt td.dt{font-weight:900;white-space:nowrap}.acp-pg .lt td.dt small{display:block;font-weight:700;color:#6B756F;font-size:calc(var(--U)*.84)}
.acp-pg .lt tr.hr td{color:#C0392B;background:#FDF7F6}
.acp-pg .lt tr.hs td{color:#8A7A4A;background:#F9F7F1}
.acp-pg .lt .sm{font-size:calc(var(--U)*.84);color:#5A6560}
.acp-pg .lt .dot{display:inline-block;width:calc(var(--U)*.8);height:calc(var(--U)*.8);border-radius:50%;border:.4mm solid;margin-right:1.4mm;vertical-align:-.05em}
.acp-pg .lt tr.tonly td{background:#FFFCF2}
.acp-pg .lt td.none{text-align:center;color:#9AA39E;padding:8mm 0}
.acp-pg .pf.lpf{margin-top:calc(2.6mm * var(--K))}
.acp-pg .pf.lpf .lg0{justify-content:center}
/* ── 한눈에 ── */
.acp-pg .tl{flex:none;margin:0 0 calc(2.6mm * var(--K))}
.acp-pg .tt0{position:relative;height:calc(var(--U)*1.4);font-size:calc(var(--U)*.78);font-weight:800;color:#6B756F}
.acp-pg .tt0 span{position:absolute;top:0;text-align:center;border-left:.25mm solid #DADDD8}
.acp-pg .tbs{position:relative;height:calc(var(--U)*2);background:#F4F5F2;border-radius:1.2mm;margin-top:.8mm}
.acp-pg .tbs em{position:absolute;left:-.2mm;top:-.2mm;font-style:normal;font-size:calc(var(--U)*.7);font-weight:900;z-index:2;background:#fff;border-radius:.8mm;padding:0 .8mm}
.acp-pg .tb{position:absolute;top:0;height:100%;border-radius:1.2mm;font-size:calc(var(--U)*.85);font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center;gap:1mm;white-space:nowrap;overflow:hidden}
.acp-pg .tb small{font-weight:700;opacity:.88;font-size:calc(var(--U)*.72)}
.acp-pg .tb.term{background:var(--ac2)}.acp-pg .tb.brk{background:#EFC48A;color:#5C4214;top:14%;height:72%;font-size:calc(var(--U)*.74)}
.acp-pg .yg{flex:1;display:grid;gap:calc(2.4mm * var(--K));min-height:0}
.acp-pg .ym{border:.3mm solid #DADDD8;border-radius:1.8mm;padding:calc(var(--U)*.45) calc(var(--U)*.6);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.acp-pg .ymh{font-size:calc(var(--U)*1);font-weight:800;color:#3A423D;display:flex;align-items:baseline;gap:.6mm;margin-bottom:.4mm;flex:none}
.acp-pg .ymh b{font-size:calc(var(--U)*1.75);font-weight:900;color:var(--ac)}.acp-pg .ymh small{margin-left:auto;font-size:calc(var(--U)*.75);color:#9AA39E}
/* 달 칸 — 일정이 적은 달은 작은 달력이 칸을 채우고, 많은 달은 목록이 자리를 가져간다 */
.acp-pg .ym .mini{border:0;padding:0;flex:1 0 auto;display:flex;flex-direction:column}
.acp-pg .ym .mini .mg{flex:1 1 auto;grid-auto-rows:minmax(calc(var(--U)*1.6),1fr);align-items:center}
.acp-pg .ym .mini .mg i{justify-self:center;width:calc(var(--U)*1.75);height:calc(var(--U)*1.75);line-height:calc(var(--U)*1.75);margin:0;font-size:calc(var(--U)*.82)}
.acp-pg .yls{flex:none;margin-top:calc(var(--U)*.3);border-top:.25mm dashed #DADDD8;padding-top:calc(var(--U)*.25)}
.acp-pg .yl{font-size:calc(var(--U)*.9);line-height:1.45;display:flex;align-items:flex-start;gap:1mm;break-inside:avoid}
.acp-pg .yls.two{column-count:2;column-gap:calc(3mm * var(--K));column-fill:balance}
.acp-pg .yl>i{width:calc(var(--U)*.72);height:calc(var(--U)*.72);border-radius:50%;border:.35mm solid;flex:none;margin-top:.32em}
.acp-pg .yl u{text-decoration:none;font-weight:900;color:var(--ac);min-width:calc(var(--U)*1.9);flex:none}
.acp-pg .yl span{min-width:0;word-break:keep-all;overflow-wrap:anywhere}
.acp-pg .yl.h,.acp-pg .yl.h u{color:#C0392B;font-weight:700}
.acp-pg .yl.none{color:#9AA39E;padding-left:calc(var(--U)*1.2)}
.acp-pg .pf.yf{display:flex;gap:calc(2.4mm * var(--K))}
.acp-pg .pf.yf .fb.nt{flex:1.6}.acp-pg .pf.yf .fb.sm{flex:1;flex-direction:row;align-items:center;justify-content:space-between;flex-wrap:wrap}
.acp-pg .cv{font-size:calc(var(--U)*.78);color:#6B756F}
/* ── 흑백 ── */
.acp-pg.mono .cc.hol,.acp-pg.mono .lt tr.hr td{background:#F1F1F1}
.acp-pg.mono .cc.brk{background:repeating-linear-gradient(135deg,#fff 0 1.4mm,#EFEFEF 1.4mm 2.8mm)}
.acp-pg.mono .ev{border-color:#333!important;border-style:solid;border-width:.25mm .25mm .25mm calc(var(--U)*.22)}
.acp-pg.mono .ev.hb{background:#F1F1F1;color:#111}
.acp-pg.mono .ph{border-color:#222}.acp-pg.mono .ph-t,.acp-pg.mono .ph-org b,.acp-pg.mono .dow div,.acp-pg.mono .fb>b,.acp-pg.mono .cnt b,.acp-pg.mono .ymh b,.acp-pg.mono .yl u,.acp-pg.mono .sumtx em{color:#111}
.acp-pg.mono .ph-aud,.acp-pg.mono .ot,.acp-pg.mono .tt{background:#333!important}.acp-pg.mono .dow,.acp-pg.mono .fb.nt,.acp-pg.mono .sumtx>div{background:#F1F1F1}
.acp-pg.mono .lt th{background:#333}.acp-pg.mono .tb.term{background:#555}.acp-pg.mono .tb.brk{background:#CFCFCF;color:#111}.acp-pg.mono .ph-org img{filter:grayscale(1)}
.acp-pg.mono .red,.acp-pg.mono .hn{color:#111!important;text-decoration:underline}.acp-pg.mono .blue{color:#333}
`;
const CSS = `
.acp-meas{position:fixed;left:-30000px;top:0;visibility:hidden;pointer-events:none;z-index:-1}
#acp-print{display:none}
/* ── 인쇄할 때: 이 쪽들만 ── */
@media print{
  body.acp-printing{margin:0!important;padding:0!important;background:#fff!important}
  body.acp-printing>*:not(#acp-print){display:none!important}
  body.acp-printing #acp-print{display:block!important}
  }

/* ── 인쇄 창 (화면) ── */
.acp-ov{position:fixed;inset:0;z-index:3000;background:rgba(10,20,15,.5);display:flex;align-items:center;justify-content:center;font-family:'Noto Sans KR',-apple-system,'Apple SD Gothic Neo',sans-serif}
.acp{width:min(1540px,96vw);height:min(940px,94vh);background:var(--bg,#F2F0EB);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden;color:var(--ink,#1F2320)}
.acp-hd{display:flex;align-items:center;gap:12px;padding:15px 22px;background:var(--wh,#fff);border-bottom:1px solid var(--ivd,#E3E1DA);flex:none}
.acp-hd .ic{width:38px;height:38px;border-radius:12px;background:var(--gp,#E8F3EF);display:flex;align-items:center;justify-content:center;font-size:19px}
.acp-hd b{font-size:18px;font-weight:900;color:var(--gd,#1E3932)}.acp-hd small{display:block;font-size:12px;color:var(--tl,#93A09A);margin-top:2px}
.acp-hd .x{margin-left:auto;width:34px;height:34px;border-radius:10px;border:0;background:var(--iv,#F2F0EB);font-size:15px;color:var(--ts,#5A6560);cursor:pointer}
.acp-bd{flex:1;display:grid;grid-template-columns:430px minmax(0,1fr);min-height:0}
.acp-l{background:var(--wh,#fff);border-right:1px solid var(--ivd,#E3E1DA);overflow:auto;padding:4px 20px 22px}
.acp-s{padding:13px 0 12px;border-bottom:1px dashed var(--ivd,#E3E1DA)}.acp-s:last-child{border-bottom:0}
.acp-s h4{margin:0 0 9px;font-size:13px;font-weight:900;color:var(--gd,#1E3932);display:flex;align-items:center;gap:7px}
.acp-s h4 i{font-style:normal;width:20px;height:20px;border-radius:50%;background:var(--gm,#00704A);color:#fff;font-size:11px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.acp-s h4 em{margin-left:auto;font-style:normal;font-size:11px;font-weight:700;color:var(--tl,#93A09A);text-align:right}
.acp-chips{display:flex;flex-wrap:wrap;gap:7px}
.acp-chip{border:1.5px solid var(--ivd,#E3E1DA);background:var(--wh,#fff);border-radius:11px;padding:8px 12px;font:800 13px/1.2 inherit;font-family:inherit;color:var(--ts,#5A6560);display:inline-flex;align-items:center;gap:7px;cursor:pointer}
.acp-chip.on{border-color:var(--gm,#00704A);background:var(--gp,#E8F3EF);color:var(--gd,#1E3932)}
.acp-chip.on::before{content:'✓';font-weight:900;color:var(--gm,#00704A)}
.acp-chip img{height:18px}
.acp-chip.jh.on{border-color:#5B3FB5;background:#EFEAFB;color:#3F2A86}.acp-chip.jh.on::before{color:#5B3FB5}
.acp-seg{display:inline-flex;gap:0;border:1.5px solid var(--ivd,#E3E1DA);border-radius:11px;overflow:hidden;background:var(--wh,#fff)}
.acp-seg .acp-chip{border:0;border-radius:0;padding:8px 14px}.acp-seg .acp-chip.on::before{content:none}
.acp-seg .acp-chip.on{background:var(--gm,#00704A);color:#fff}
.acp-seg2{display:flex;gap:8px;flex-wrap:wrap}
.acp-rad{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.acp-rad button{border:1.5px solid var(--ivd,#E3E1DA);border-radius:12px;padding:10px 12px;font:800 13px/1.3 inherit;font-family:inherit;color:var(--ink,#1F2320);background:var(--wh,#fff);text-align:left;cursor:pointer}
.acp-rad small{display:block;font-size:11px;font-weight:600;color:var(--tl,#93A09A);margin-top:3px;line-height:1.45}
.acp-rad .on{border-color:var(--gm,#00704A);background:var(--gp,#E8F3EF);box-shadow:inset 0 0 0 1px var(--gm,#00704A)}
.acp-rad .t.on{border-color:#8A6410;background:var(--goldp,#F7EFD8);box-shadow:inset 0 0 0 1px #8A6410}
.acp-lay{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.acp-lay button{border:1.5px solid var(--ivd,#E3E1DA);border-radius:12px;padding:9px 6px 8px;text-align:center;font:inherit;font-family:inherit;color:var(--gd,#1E3932);background:var(--wh,#fff);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.acp-lay button b{font-size:13px;font-weight:900;color:var(--ink,#1F2320)}.acp-lay button small{font-size:10.5px;font-weight:700;color:var(--tl,#93A09A)}
.acp-lay .on{border-color:var(--gm,#00704A);background:var(--gp,#E8F3EF);box-shadow:inset 0 0 0 1px var(--gm,#00704A)}
/* 달력형 — 가로형 · 세로형 (v-116) */
.acp-cori{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
.acp-cori button{display:flex;align-items:center;gap:9px;border:1.5px solid var(--ivd,#E3E1DA);border-radius:11px;padding:8px 10px;background:var(--wh,#fff);font:inherit;font-family:inherit;text-align:left;cursor:pointer;color:var(--ink,#1F2320)}
.acp-cori button b{display:block;font-size:12.5px;font-weight:900}.acp-cori button small{display:block;font-size:10.5px;font-weight:700;color:var(--tl,#93A09A);margin-top:1px;line-height:1.35}
.acp-cori .on{border-color:var(--gm,#00704A);background:var(--gp,#E8F3EF);box-shadow:inset 0 0 0 1px var(--gm,#00704A)}
.acp-cori .ci{flex:none;display:block;color:var(--tl,#93A09A)}.acp-cori .on .ci{color:var(--gm,#00704A)}
.acp-tpos{grid-column:1/-1;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:800;color:var(--ts,#5A6560);margin:-2px 0 2px 24px}
.acp-tpos .acp-chip{padding:6px 12px;font-size:12px}
.acp-per{display:flex;align-items:center;gap:6px;margin-top:9px;font-size:13px;color:var(--ts,#5A6560)}
.acp-per select{border:1.5px solid var(--ivd,#E3E1DA);border-radius:9px;padding:7px 8px;font:700 13px inherit;font-family:inherit;background:var(--wh,#fff);color:var(--ink,#1F2320)}
.acp-cks{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px}
.acp-ck{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;font-weight:700;color:var(--ink,#1F2320);cursor:pointer;line-height:1.35}
.acp-ck span{display:block;min-width:0}.acp-ck small{display:block;font-size:10.5px;font-weight:600;color:var(--tl,#93A09A);margin-top:1px}
.acp-ck input{width:16px;height:16px;accent-color:var(--gm,#00704A);margin:1px 0 0;flex:none}
.acp-ck.dis{opacity:.42;cursor:default}
.acp-hint{font-size:11px;color:var(--tl,#93A09A);margin-top:7px;line-height:1.5}
.acp-note{width:100%;border:1.5px solid var(--ivd,#E3E1DA);border-radius:11px;padding:10px 12px;font:500 12.5px/1.6 inherit;font-family:inherit;color:var(--ink,#1F2320);background:var(--wh,#fff);resize:vertical;box-sizing:border-box}
.acp-foot{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.acp-foot label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;color:var(--ts,#5A6560)}
.acp-foot label span{flex:none;width:118px}
.acp-foot input{flex:1;min-width:0;border:1.5px solid var(--ivd,#E3E1DA);border-radius:9px;padding:7px 9px;font:600 12.5px inherit;font-family:inherit;color:var(--ink,#1F2320);background:var(--wh,#fff)}
.acp-r{display:flex;flex-direction:column;min-height:0;position:relative}
.acp-pv{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:18px 20px;background:#D6D6D1}
html[data-theme="dark"] .acp-pv{background:#2A2F2C}
.acp-sheets{display:flex;flex-direction:column;align-items:center;gap:14px;margin:auto 0}
.acp-sheet{position:relative;box-shadow:0 10px 30px rgba(0,0,0,.25);background:#fff;flex:none}
.acp-sheet>.acp-shost{position:absolute;left:0;top:0;transform-origin:0 0}
.acp-empty{margin:auto;color:#5A6560;font-weight:700}
.acp-st{position:absolute;left:50%;top:18px;transform:translateX(-50%);background:#1E3932;color:#fff;font-size:12.5px;font-weight:800;padding:8px 14px;border-radius:10px;z-index:2}
.acp-pgr{display:flex;align-items:center;gap:10px;padding:9px 16px;background:var(--iv,#ECEBE6);border-top:1px solid var(--ivd,#DADAD4);font-size:12.5px;color:var(--ts,#5A6560);font-weight:700;flex:none;overflow-x:auto}
.acp-pgr .nv{width:30px;height:30px;border-radius:8px;border:1px solid var(--ivd,#DADAD4);background:var(--wh,#fff);font-size:15px;font-weight:900;color:var(--gd,#1E3932);cursor:pointer;flex:none}
.acp-pgr .nv:disabled{opacity:.35;cursor:default}
.acp-pgr .cnt{white-space:nowrap}
.acp-pgr .th{display:flex;gap:6px}
.acp-pgr .th button{border:1.5px solid var(--ivd,#DADAD4);background:var(--wh,#fff);border-radius:8px;padding:5px 9px;font:800 11.5px inherit;font-family:inherit;color:var(--ts,#5A6560);white-space:nowrap;cursor:pointer}
.acp-pgr .th button.on{border-color:var(--gm,#00704A);color:var(--gd,#1E3932);background:var(--gp,#E8F3EF)}
.acp-pgr .hint{margin-left:auto;font-size:11.5px;color:var(--tl,#93A09A);white-space:nowrap}
.acp-pgr .hint.warn{color:#B45309;font-weight:800}
.acp-ft{display:flex;align-items:center;gap:10px;padding:12px 22px;background:var(--wh,#fff);border-top:1px solid var(--ivd,#E3E1DA);flex:none}
.acp-ft .tip{font-size:12px;color:var(--tl,#93A09A);flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acp-ft .tip b{color:var(--gd,#1E3932);font-weight:800}
.acp-ft button{border:0;border-radius:11px;padding:12px 18px;font:900 14px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}
.acp-ft .sc{background:var(--wh,#fff);border:1.5px solid var(--ivd,#E3E1DA);color:var(--ts,#5A6560)}
.acp-ft .pr{background:var(--gm,#00704A);color:#fff}
html[data-theme="dark"] .acp-ft .pr,html[data-theme="dark"] .acp-s h4 i,html[data-theme="dark"] .acp-seg .acp-chip.on{color:#06130E}
.acp-ft .r{margin-left:auto}
#acp-toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:3100;background:#1E3932;color:#fff;padding:12px 18px;border-radius:12px;font:800 13px/1.4 'Noto Sans KR',sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);max-width:92vw;white-space:pre-line;text-align:center;word-break:keep-all}
@media(max-width:1100px){.acp-bd{grid-template-columns:360px minmax(0,1fr)}.acp-cks{grid-template-columns:1fr}}
@media(max-width:768px){
  .acp-pgr .hint.warn{display:block;white-space:normal}
  .acp-ov{align-items:stretch}
  .acp{width:100vw;height:100vh;height:100dvh;border-radius:0}
  .acp-bd{display:flex;flex-direction:column;overflow:auto}
  .acp-r{order:-1;height:46vh;flex:none}
  .acp-l{border-right:0;overflow:visible}
  .acp-ft .tip{display:none}.acp-ft{padding:10px 12px;gap:7px}.acp-ft button{padding:11px 12px;font-size:13px}
  .acp-pgr .hint{display:none}
  .acp-cks{grid-template-columns:1fr 1fr}
}
`;
})();
