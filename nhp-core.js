/* ═══════════════════════════════════════════════════════════
   📒 nhp-core.js — 나학평(나의 학교생활 평가서) 핵심 계산 (v141)
   · 화면(nhp.html)과 상관없는 «계산»만 모은 곳 — 브라우저와 Node 시험에서 똑같이 돈다
   · 학기 열기(반편성 → 반 · 시간표 수업 정의 → 과목 칸) · 지난 학기 이어받기
   · 검토 흐름(작성 중 → 검토 단계들 → 최종 검토 → 승인) — 보안 규칙 v35 와 같은 기준
   · 학생별 나학평 문서 모양(ReportDoc) 만들기 · 출력본(가리기 · 고치기 · 용어 바꾸기) · 영문판
   · v144 평가 틀 «세부» 칸 · 칸 너비(표 모양) · 조별 칸(학년 · 반이 섞인 칸) · 출력 디자인(표지 · 속지 모양)은 nhp-theme.js
   ═══════════════════════════════════════════════════════════ */
import * as TH from './nhp-theme.js?v=144';
export { TH };

export const ORG = 'daniel';
export const ORG_NAME = '다니엘 아마츠';
export const ORG_EN = 'Daniel Amatz';

/* ── 교과 평가 방식 (예전 나학평 TYPE 그대로 · 이름은 쉬운 말로) ── */
export const TYPES = {
  E: { k: 'E', ko: '5단계 평가', short: '5단계', d: '평가 항목마다 5단계 (매우 잘함 ~ 노력 요함)' },
  S: { k: 'S', ko: '시험 성적', short: '시험', d: '시험 항목 점수 · 비율 → 총점 · 반 평균' },
  M: { k: 'M', ko: '5단계 + 시험', short: '5단계+시험', d: '평가 항목 5단계와 시험 성적을 함께' },
  A: { k: 'A', ko: '활동 서술', short: '서술', d: '제목 · 항목마다 글 (자치활동 · 프로젝트 · 개관)' },
  R: { k: 'R', ko: '암송 · 읽기', short: '암송', d: '전체 제목 + 내용 1~3칸' },
};
export const TYPE_ORDER = ['E', 'S', 'M', 'A', 'R'];

/* ── 칸 종류 — 과목 말고도 반마다 하나씩 (담임이 기본 담당) ── */
export const KINDS = {
  hr:     { k: 'hr',     ko: '담임평가',                 icon: '💬', order: 10,  en: "Homeroom Teacher's Evaluation" },
  att:    { k: 'att',    ko: '출결',                     icon: '✅', order: 20,  en: 'Attendance' },
  parent: { k: 'parent', ko: '부모교육 및 과제',          icon: '👪', order: 30,  en: 'Parent Education & Assignments' },
  subj:   { k: 'subj',   ko: '교과',                     icon: '📘', order: 100, en: 'Subject' },
  vision: { k: 'vision', ko: '비전트립 (활동 및 평가)',   icon: '🧭', order: 800, en: 'Vision Trip' },
  camp:   { k: 'camp',   ko: '캠프 (활동 및 평가)',       icon: '🏕', order: 810, en: 'Camp' },
  act:    { k: 'act',    ko: '특별활동',                  icon: '🎉', order: 900, en: 'Special Activities' },
  book:   { k: 'book',   ko: '도서 활동 (학기 중 수업 시간에 읽은 도서)', icon: '📚', order: 910, en: 'Reading (Books Read in Class This Semester)' },
  serve:  { k: 'serve',  ko: '교내 봉사활동 및 수상 내역', icon: '🏅', order: 920, en: 'School Service & Awards' },
};
export const SPECIAL_DEFAULT = ['att', 'parent', 'act', 'book', 'serve'];   // 학기 열 때 반마다 기본으로 만드는 칸 (담임평가 · 비전트립 · 캠프는 켜면)

/* ── 5단계 ── */
export const LEVELS = [
  { v: 5, ko: '매우 잘함', br: '매우\n잘함', en: 'Excellent',    enBr: 'Excellent' },
  { v: 4, ko: '잘함',     br: '잘함',      en: 'Very Good',    enBr: 'Very\nGood' },
  { v: 3, ko: '보통',     br: '보통',      en: 'Satisfactory', enBr: 'Satis-\nfactory' },
  { v: 2, ko: '부족',     br: '부족',      en: 'Developing',   enBr: 'Devel-\noping' },
  { v: 1, ko: '노력 요함', br: '노력\n요함', en: 'Needs Effort', enBr: 'Needs\nEffort' },
];
export const levelOf = v => LEVELS.find(l => l.v === Number(v)) || null;

/* 서술 칸 이름 — 예전 나학평에서 고르던 것 그대로 */
export const NARR_PRESETS = ['수업 내용 개관', '교사 서술 평가', '품성 및 학교생활', '영성 활동', '영성 및 태도'];
/* 서술 칸 — «학생마다 따로»(each) 인가, «모든 학생 같은 글»(fixed) 인가
   each 를 정하지 않은 옛 칸은 «같은 글»이 비어 있으면 학생마다로 본다 (예전 나학평과 같은 뜻) */
export const isEach = n => !!n && (n.each === true || (n.each !== false && !String(n.fixed || '').trim()));
/* 출결 칸 — 예전 나학평 · 출석부 «학기말 출결표»와 같은 모양 */
export const ATT_GROUPS = [
  { k: 'ab', ko: '결석일수', en: 'Absences', subs: ['질병', '무단', '기타'] },
  { k: 'la', ko: '지각',     en: 'Late',     subs: ['질병', '무단', '기타'] },
  { k: 'eo', ko: '조퇴',     en: 'Early Leave', subs: ['질병', '무단', '기타'] },
  { k: 'ex', ko: '체험학습', en: 'Field Learning', subs: ['가족 대소사', '가족 여행', '기타'] },
];
/* 부모교육 대상 */
export const PE_TARGET = { P: '부모', F: '부', M: '모' };

/* ── 작은 도구 ── */
export const pad2 = n => String(n).padStart(2, '0');
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uniq = a => Array.from(new Set((a || []).filter(Boolean)));
export const norm = s => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
export const normKey = s => norm(s).replace(/\s+/g, ' ').toLowerCase();
export function rid(prefix, n){
  const A = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  try {
    const b = new Uint8Array(n || 8); (globalThis.crypto || require('crypto').webcrypto).getRandomValues(b);
    b.forEach(x => { s += A[x % A.length]; });
  } catch(e){ for(let i = 0; i < (n || 8); i++) s += A[Math.floor(Math.random() * A.length)]; }
  return (prefix || '') + s;
}
/* FNV-1a — 번역 표 열쇠 (같은 글 = 같은 열쇠) */
export function hashKey(s){
  const t = normKey(s);
  let h = 0x811c9dc5;
  for(let i = 0; i < t.length; i++){ h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'h' + h.toString(36) + t.length.toString(36);
}
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

/* ── 학기 ── */
export const termIdOf = (year, term) => `${ORG}_${year}_${term}`;
export function termName(t){ return (t && t.name) || ((t && t.term) ? `${t.term}학기` : ''); }
export function termLabel(t){ return t ? `${t.year}학년도 ${termName(t)}` : ''; }
/* «2.9~7.16» — 예전 출결 제목의 기간 모양 */
export function shortRange(start, end){
  const f = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${+m[2]}.${+m[3]}` : ''; };
  const a = f(start), b = f(end);
  return a && b ? `${a}~${b}` : (a || b);
}

/* ── 학년 ── */
export function gradeNoOf(g){ const m = /(\d+)\s*학년/.exec(String(g || '')); return m ? +m[1] : 0; }
/* «10학년 A» → «10학년» (시간표의 나뉜 학년) */
export function baseGrade(g){ const m = /^\s*(\d+\s*학년)/.exec(String(g || '')); return m ? m[1].replace(/\s+/g, '') : String(g || '').trim(); }
function classGradeList(c){
  const set = [];
  const add = g => { g = baseGrade(g); if(g && !set.includes(g)) set.push(g); };
  (Array.isArray(c.gradeList) ? c.gradeList : []).forEach(add);
  if(!set.length && c.grade) String(c.grade).split(/[·,/]/).forEach(add);
  Object.values(c.grades || {}).forEach(add);
  return set.sort((a, b) => gradeNoOf(a) - gradeNoOf(b));
}

/* ═══ 학기 열기 ① 반편성 → 나학평 «반» (반 × 학년) ═══
   · 한 반에 학년이 여럿이면(합반) 학년마다 따로 — 예전 나학평처럼 «로이반 (2학년)» · «로이반 (3학년)»
   · 학생의 학년은 반편성 «학년 지정»(classes.grades)에서 · 지정이 없고 반 학년이 하나면 그 학년
   · keep(학생) 이 false 인 학생(자퇴 · 졸업)은 뺀다 */
export function sectionsFromClasses(classes, studentsById, keep){
  const out = [];
  const ok = s => !!s && (typeof keep === 'function' ? keep(s) : true);
  (classes || []).filter(c => c && c.org === ORG).forEach(c => {
    const grades = classGradeList(c);
    const studs = (c.students || []).map(id => studentsById[id] ? { id, s: studentsById[id] } : null).filter(x => x && ok(x.s));
    const gOf = id => baseGrade((c.grades || {})[id] || '');
    const mk = (g, ids, unassigned) => ({
      id: `${c.id}__${gradeNoOf(g) || 0}`, classId: c.id, name: c.name || '', grade: g || '', gradeNo: gradeNoOf(g),
      hrUid: c.teacherUid || '', deputies: (c.deputies || []).slice(), students: ids, unassigned: unassigned || [],
    });
    if(grades.length <= 1){
      out.push(mk(grades[0] || '', studs.map(x => x.id)));
      return;
    }
    const byG = {}; grades.forEach(g => { byG[g] = []; });
    const none = [];
    studs.forEach(x => { const g = gOf(x.id); if(byG[g]) byG[g].push(x.id); else none.push(x.id); });
    grades.forEach((g, i) => out.push(mk(g, byG[g], i === 0 ? none : [])));
  });
  out.sort((a, b) => (a.gradeNo || 99) - (b.gradeNo || 99) || String(a.name).localeCompare(String(b.name), 'ko'));
  return out;
}
export const secLabel = s => s ? `${s.name}${s.grade ? ` (${s.grade})` : ''}` : '';

/* ═══ 학기 열기 ② 시간표 «수업 정의» → 과목 칸 ═══
   · 그 반 학년을 듣는 수업만 (나뉜 학년 «10학년 A»도 10학년으로) · 쉬는 시간 카드는 뺀다
   · 같은 과목 이름은 한 칸으로 (선생님은 모두 함께) */
export function subjectsForSection(sec, lessons){
  const list = (lessons || []).filter(l => l && (l.org || ORG) === ORG && l.kind !== 'break' && String(l.subject || '').trim()
    && (l.grades || []).some(g => baseGrade(g) === sec.grade));
  const by = new Map();
  list.forEach(l => {
    const name = String(l.subject).trim();
    const k = normKey(name);
    if(!by.has(k)) by.set(k, { name, teacherUids: [], lessonIds: [] });
    const x = by.get(k);
    const lead = l.leadUid && (l.teacherUids || []).includes(l.leadUid) ? [l.leadUid] : [];
    x.teacherUids = uniq([...x.teacherUids, ...lead, ...(l.teacherUids || [])]);
    x.lessonIds.push(l.id);
  });
  return Array.from(by.values());
}

/* ═══ 지난 학기에서 이어받기 — 같은 이름 · 같은 학년 과목의 평가 방식과 평가 틀 ═══
   prev: 지난 학기 칸 목록 (secGradeNo 를 함께 담은 것) */
export function findPrev(prev, name, gradeNo){
  const k = normKey(name);
  const same = (prev || []).filter(p => p.kind === 'subj' && normKey(p.name) === k);
  // 같은 학년만 (다른 학년 평가 틀은 내용이 달라 잘못 들어가기 쉬움) · 학년을 모르는 지난 자료는 같은 이름이 하나뿐일 때만
  return same.find(p => (p.gradeNo || 0) === (gradeNo || 0)) || (same.length === 1 && !(same[0].gradeNo || 0) ? same[0] : null);
}
export function inheritSetup(p, opt){
  opt = opt || {};
  if(!p) return null;
  const s = JSON.parse(JSON.stringify(p.setup || {}));
  // 서술 칸 — «같은 글»이었던 칸은 같은 글 칸으로 남기고 글은 비운다 (개관은 학기마다 바뀜) · «개관 글도 가져오기»면 그대로
  if(Array.isArray(s.narr)) s.narr = s.narr.map(n => Object.assign({}, n, { each: isEach(n), fixed: (!isEach(n) && opt.keepOverview) ? (n.fixed || '') : '' }));
  return { type: p.type || 'E', setup: s, printName: p.printName || '' };
}
export function emptySetup(type){
  const s = { items: [], narr: [], score: null, a: null, r: null };
  if(type === 'E' || type === 'M') s.narr = [{ id: rid('n'), t: '수업 내용 개관', each: false, fixed: '' }];
  if(type === 'S' || type === 'M') s.score = { title: '성적', sub: '시험', cols: [{ id: rid('c'), t: '시험', w: 100 }], tot: { on: false, t: '총 점수' }, r1: '개인점수', r2: '반 평균', avgOn: true, avg: {} };
  if(type === 'A') { s.narr = [{ id: rid('n'), t: '', each: true, fixed: '' }]; s.a = { t1: '', t2: '', noTitle: true }; }
  if(type === 'R') s.r = { title: '', it: '암송 구절 및 묵상 본문', n: 1 };
  return s;
}
export function setupForType(prevSetup, type){
  const base = emptySetup(type);
  const p = prevSetup || {};
  // 방식을 바꿔도 이미 만든 항목 · 서술 칸은 남긴다 (화면에서 안 보일 뿐)
  return Object.assign(base, p.items && p.items.length ? { items: p.items } : {},
    p.narr && p.narr.length ? { narr: p.narr } : {}, p.score ? { score: p.score } : {}, p.a ? { a: p.a } : {}, p.r ? { r: p.r } : {});
}

/* ═══ v144 평가 틀 양식 (평가 틀 › ① 양식) — 고른 뒤에도 칸 · 항목은 자유롭게 ═══ */
export const FORMS = [
  { k: 'e', ko: '5단계 표', d: '평가 내용 + 5단계', type: 'E', lay: { sOn: false } },
  { k: 'eg', ko: '범위 + 5단계', d: '같은 범위는 한 칸으로 묶임 (예: 태도 · 이론)', type: 'E', lay: { sOn: false, g: 'n' }, hint: 'g' },
  { k: 'egs', ko: '범위 + 세부 + 5단계', d: '범위 · 세부(예: 수업 준비) · 내용 세 칸', type: 'E', lay: { sOn: true, g: 'n', s: 'n' }, hint: 'gs' },
  { k: 's', ko: '시험 성적 (비율)', d: '시험 항목 점수 · 비율 → 총점 · 반 평균', type: 'S' },
  { k: 'm', ko: '시험 + 5단계', d: '5단계 표와 시험 성적을 함께', type: 'M', lay: { sOn: false } },
  { k: 'a', ko: '서술만', d: '제목 · 항목마다 글 (자치활동 · 프로젝트)', type: 'A' },
  { k: 'r', ko: '암송 · 읽기', d: '전체 제목 + 내용 1~3칸', type: 'R' },
];
export const formOf = (sub) => {
  const t = sub.type || 'E', st = sub.setup || {};
  if(t === 'E'){ if(hasSub(st)) return 'egs'; if((st.items || []).some(it => String(it.g || '').trim()) || (st.lay && st.lay.g)) return 'eg'; return 'e'; }
  return { S: 's', M: 'm', A: 'a', R: 'r' }[t] || 'e';
};
/* 가져온 틀의 항목 · 서술 칸 · 시험 항목 id — 지금 틀에 같은 글이 있으면 그 id 를 이어 쓴다 (이미 넣은 5단계 · 글이 끊기지 않게) */
export function reuseIds(oldSt, newSt){
  const o = oldSt || {}, n = JSON.parse(JSON.stringify(newSt || {}));
  // 같은 글 → 지금 id 그대로 · 짝이 없는 항목은 id 가 겹치거나 «지금 다른 글이 쓰는 id»면 새 id (다른 항목의 5단계가 엉뚱하게 붙지 않게)
  const re = (olds, news, key, pre) => {
    const idx = {}; (olds || []).forEach(x => { const k = normKey(key(x)); if(k && !idx[k]) idx[k] = x.id; });
    const oldIds = new Set((olds || []).map(x => x.id));
    const used = new Set(), hit = new Set();
    (news || []).forEach((x, i) => { const k = normKey(key(x)); const id = idx[k]; if(id && !used.has(id)){ x.id = id; used.add(id); hit.add(i); } });
    (news || []).forEach((x, i) => { if(hit.has(i)) return; if(!x.id || used.has(x.id) || oldIds.has(x.id)) x.id = rid(pre); used.add(x.id); });
  };
  re(o.items, n.items, x => x.t || '', 'i');
  re(o.narr, n.narr, x => x.t || '', 'n');
  if(n.score && o.score) re(o.score.cols, n.score.cols, x => x.t || '', 'c');
  return n;
}
/* 🔗 함께 쓰기 — 칸의 묶음 열쇠: 스스로 적은 share, 아니면 다른 칸이 «sh_내 id»로 나를 가리킬 때 */
//   · share 'x_…' = 이 칸만 묶음에서 빠짐 (다른 칸이 «sh_내 id»로 가리켜도 나는 빠짐)
export const shareOf = (sub, subs) => { if(!sub) return ''; const s = sub.share || ''; if(s.startsWith('x_')) return ''; if(s) return s;
  return (subs || []).some(x => x !== sub && x.id !== sub.id && x.share === 'sh_' + sub.id && !x.removed) ? 'sh_' + sub.id : ''; };
export const shareMembers = (key, subs) => !key ? [] : (subs || []).filter(x => !x.removed && (x.share === key || (('sh_' + x.id) === key && !x.share)));
/* 틀이 바뀔 때 학생 입력 이어 주기 — 같은 글의 항목 · 서술 · 점수 칸끼리 (예전 id 값은 지우지 않고 남김)
   → nhpEntries 에 쓸 { 'rows.<학생>.e': {...}, … } (바뀐 것만) */
export function remapPatch(rows, from, to){
  const up = {};
  Object.keys(rows || {}).forEach(sid => {
    const r0 = rows[sid] || {}; const mr = mapRow(r0, from, to); if(!mr) return;
    ['e', 'n', 's'].forEach(k => { if(!mr[k] || !Object.keys(mr[k]).length) return;
      const merged = Object.assign({}, r0[k] || {}, mr[k]);
      if(JSON.stringify(merged) !== JSON.stringify(r0[k] || {})) up[`rows.${sid}.${k}`] = merged; });
  });
  return up;
}

/* ═══ 검토 순서 → 칸마다 검토관 명단 ═══
   term.review = { stages:[{ id, label, mode:'homeroom'|'people', uids:[], per:{ secId:[uids] } }], final:{ label, uids:[], per:{} } }
   · 담임 단계는 그 반 담임 · 사람 단계는 «모든 반 같은 분» 또는 «반마다 따로»
   · 사람이 없는 단계는 건너뛴다 (규칙도 같은 기준 — 빈 단계에서 멈추지 않게) */
export const DEFAULT_REVIEW = () => ({
  stages: [
    { id: 'st_hr', label: '담임 검토', mode: 'homeroom', uids: [], per: {} },
    { id: 'st_rv', label: '검토관 검토', mode: 'people', uids: [], per: {} },
  ],
  final: { label: '최종 승인', uids: [], per: {} },
});
export function rvFor(term, sec){
  const rv = {}, rvL = [];
  const R = (term && term.review) || DEFAULT_REVIEW();
  let k = 1;
  (R.stages || []).forEach(st => {
    let u;
    if(st.mode === 'homeroom') u = [sec && sec.hrUid].filter(Boolean);
    else u = (st.per && sec && Array.isArray(st.per[sec.id]) && st.per[sec.id].length) ? st.per[sec.id] : (st.uids || []);
    u = uniq(u);
    if(!u.length) return;
    rv['r' + k] = u; rvL.push(st.label || `${k}단계 검토`); k++;
  });
  const F = R.final || {};
  rv.fin = uniq((F.per && sec && Array.isArray(F.per[sec.id]) && F.per[sec.id].length) ? F.per[sec.id] : (F.uids || []));
  return { rv, rvL, finL: F.label || '최종 승인' };
}
/* 칸 하나의 검토 순서 — 본인이 쓴 칸은 본인이 검토하지 않는다
   (예: 담임이 맡은 출결 · 담임평가 · 예배 칸은 «담임 검토» 단계를 건너뛰고 다음 검토관에게 · 최종은 다른 분이 없을 때만 본인) */
export function rvForSub(term, sec, sub){
  const r = rvFor(term, sec);
  const me = new Set((sub && sub.teacherUids) || []);
  if(!me.size) return r;
  const rv = {}, rvL = [];
  let k = 1;
  r.rvL.forEach((lab, i) => {
    const u = (r.rv['r' + (i + 1)] || []).filter(x => !me.has(x));
    if(!u.length) return;
    rv['r' + k] = u; rvL.push(lab); k++;
  });
  const f = r.rv.fin || [];
  rv.fin = f.some(x => !me.has(x)) ? f.filter(x => !me.has(x)) : f.slice();
  return { rv, rvL, finL: r.finL };
}
/* v144 조별 칸(학년 · 반이 섞인 칸)의 «반» 자리 — 담임 검토 단계는 건너뛰고(담임이 없음) 검토관 → 최종 승인
   검토 순서에서 «반마다 다른 분»을 정할 때 열쇠 '__grp' 로 조별 칸만 따로 정할 수 있다 */
export const GRP_SEC = { id: '__grp', name: '조별 칸', grade: '', hrUid: '', students: [] };
export const secForSub = (term, sub) => (sub && sub.grp) ? GRP_SEC : (((term && term.sections) || []).find(x => x.id === (sub && sub.secId)) || null);
export function finAllOf(term, sections){
  const s = new Set();
  (sections || []).concat([GRP_SEC]).forEach(sec => rvFor(term, sec).rv.fin.forEach(u => s.add(u)));
  return Array.from(s);
}
/* 평가 틀이 다른 칸 사이에서 학생 입력 옮기기 — 같은 글(항목 · 서술 칸 제목 · 시험 항목)끼리 이어 준다
   (조별 칸으로 바꿀 때 · 가져오기로 틀을 바꿀 때 · 학생이 다른 조로 옮길 때) */
export function mapRow(row, from, to){
  if(!row) return null;
  from = from || {}; to = to || {};
  const byText = (a, b, key) => { const m = {}; const idx = {}; (b || []).forEach(x => { idx[normKey(key(x))] = x.id; }); (a || []).forEach(x => { const k = normKey(key(x)); if(k && idx[k]) m[x.id] = idx[k]; }); (a || []).forEach(x => { if(!m[x.id] && (b || []).some(y => y.id === x.id)) m[x.id] = x.id; }); return m; };
  const out = JSON.parse(JSON.stringify(row));
  const im = byText(from.items, to.items, x => `${x.g || ''}|${x.s || ''}|${x.t || ''}`);
  const im2 = byText(from.items, to.items, x => x.t || '');
  if(out.e){ const e = {}; Object.keys(out.e).forEach(k => { const t = im[k] || im2[k]; if(t) e[t] = out.e[k]; }); out.e = e; }
  const nm = byText(from.narr, to.narr, x => x.t || '');
  if(out.n){ const n = {}; Object.keys(out.n).forEach(k => { if(/^c[123]$/.test(k)) n[k] = out.n[k]; else if(nm[k]) n[nm[k]] = out.n[k]; }); out.n = n; }
  const cm = byText((from.score || {}).cols, (to.score || {}).cols, x => x.t || '');
  if(out.s){ const sc = {}; Object.keys(out.s).forEach(k => { if(k === '__tot') sc[k] = out.s[k]; else if(cm[k]) sc[cm[k]] = out.s[k]; }); out.s = sc; }
  return out;
}
export const stageKeyOf = d => d.state === 'final' ? 'fin' : 'r' + ((d.stage || 0) + 1);
export const hasNext = d => ('r' + ((d.stage || 0) + 2)) in (d.rv || {});
/* 지금 손을 대야 하는 사람 — 사이드바 숫자 · «내 할 일»이 이 칸으로 바로 찾는다 */
export function turnOf(d){
  if(!d) return [];
  if(d.state === 'draft') return uniq(d.teacherUids || []);
  if(d.state === 'review' || d.state === 'final') return uniq((d.rv || {})[stageKeyOf(d)] || []);
  return [];
}
/* 상태 이름 */
export function stateOf(d){
  const st = d.state || 'draft';
  const redo = st === 'draft' && Array.isArray(d.log) && d.log.length && d.log[d.log.length - 1].act === 'redo';
  if(st === 'draft') return { k: redo ? 'redo' : 'draft', ko: redo ? '수정 요청 받음' : '작성 중', tone: redo ? 'warn' : 'gray' };
  if(st === 'review') return { k: 'review', ko: `${(d.rvL || [])[d.stage || 0] || ((d.stage || 0) + 1) + '단계 검토'} 중`, tone: 'info' };
  if(st === 'final') return { k: 'final', ko: `${d.finL || '최종 승인'} 대기`, tone: 'purple' };
  if(st === 'done') return { k: 'done', ko: '승인 완료', tone: 'ok' };
  return { k: st, ko: st, tone: 'gray' };
}
/* 이 사람이 이 칸에서 할 수 있는 일 — 규칙 v35 와 같은 기준 (화면에서 단추를 보이고 숨길 때) */
export function canDo(d, uid, isMgr){
  isMgr = !!isMgr;
  const st = d.state || 'draft';
  const teacher = (d.teacherUids || []).includes(uid);
  const now = (st === 'review' || st === 'final') && ((d.rv || {})[stageKeyOf(d)] || []).includes(uid);
  const fin = ((d.rv || {}).fin || []).includes(uid);
  // 검토 단계: 본인이 맡은 칸은 본인이 넘기지 않는다 (규칙도 같음) · 최종 승인은 다른 분이 없을 때 본인도
  const rvNow = st === 'review' ? (now && !teacher) : now;
  const log = Array.isArray(d.log) ? d.log : [];
  const untouched = !log.length || (log[log.length - 1] || {}).act === 'submit';
  return {
    edit:     st !== 'done' && (isMgr || (st === 'draft' && teacher) || now),
    setup:    st !== 'done' && (isMgr || (st === 'draft' && teacher) || rvNow),
    submit:   st === 'draft' && (teacher || isMgr),
    withdraw: st === 'review' && (d.stage || 0) === 0 && ((teacher && untouched) || isMgr),
    review:   st === 'review' && (rvNow || isMgr),
    approve:  st === 'final' && (fin || isMgr),
    redo:     (st === 'review' || st === 'final') && (rvNow || isMgr),
    reopen:   st === 'done' && (fin || isMgr),
    teacher, now, fin,
  };
}
/* 상태 바꾸기 — 바꿀 칸만 돌려준다 (화면이 그대로 저장) */
export function patchFor(d, act, me, msg){
  const at = new Date().toISOString();
  const log = (Array.isArray(d.log) ? d.log.slice(-79) : []);
  const entry = { at, uid: me.uid, name: me.name || '', act };
  let p = {};
  if(act === 'submit'){
    const first = 'r1' in (d.rv || {});
    p = first ? { state: 'review', stage: 0 } : { state: 'final', stage: 0 };
    entry.st = first ? (d.rvL || [])[0] || '1단계 검토' : (d.finL || '최종 승인');
  } else if(act === 'withdraw'){
    p = { state: 'draft', stage: 0 };
  } else if(act === 'ok'){
    if(hasNext(d)){ p = { state: 'review', stage: (d.stage || 0) + 1 }; entry.st = (d.rvL || [])[(d.stage || 0) + 1] || ''; }
    else { p = { state: 'final', stage: d.stage || 0 }; entry.st = d.finL || '최종 승인'; }
  } else if(act === 'redo'){
    p = { state: 'draft', stage: 0 };
  } else if(act === 'approve'){
    p = { state: 'done', doneAt: at, doneBy: me.uid };
  } else if(act === 'reopen'){
    p = { state: 'draft', stage: 0 };
  } else if(act === 'cmt'){
    p = {};
  }
  if(msg) entry.msg = String(msg).slice(0, 500);
  log.push(entry);
  p.log = log;
  const next = Object.assign({}, d, p);
  if(act !== 'cmt') p.turn = turnOf(next);
  return p;
}
/* 반 전체 상태 — 칸 가운데 가장 늦은 단계 */
export function sectionState(subs){
  const rank = { draft: 0, review: 1, final: 2, done: 3 };
  if(!subs || !subs.length) return 'none';
  let m = 9; subs.forEach(s => { m = Math.min(m, rank[s.state || 'draft'] ?? 0); });
  return Object.keys(rank).find(k => rank[k] === m) || 'draft';
}

/* ═══ 입력 계산 ═══ */
export const isNum = v => v !== '' && v != null && isFinite(Number(String(v).replace(/,/g, '')));
export const toNum = v => Number(String(v).replace(/,/g, ''));
const r1 = n => Math.round(n * 10) / 10;
export const fmt1 = n => { const v = r1(n); return Number.isInteger(v) ? String(v) : v.toFixed(1); };

/* 시험 — 비율(%)이 모든 항목에 있으면 «총 점수»를 비율대로 · 하나라도 비율이 없으면 직접 넣은 값 */
export function scoreTotal(score, vals){
  if(!score || !score.tot || !score.tot.on) return '';
  const cols = score.cols || [];
  if(!cols.length) return '';
  const weighted = cols.every(c => Number(c.w) > 0);
  if(!weighted) return (vals && vals.__tot != null) ? String(vals.__tot) : '';
  if(!cols.every(c => vals && isNum(vals[c.id]))) return '';
  const sw = cols.reduce((a, c) => a + Number(c.w), 0);
  return fmt1(cols.reduce((a, c) => a + toNum(vals[c.id]) * Number(c.w), 0) / sw);
}
/* 반 평균 — 그 과목 학생들의 숫자만 · 직접 넣은 평균(avg)이 있으면 그것 */
export function scoreAvg(score, rows, sids, colId){
  if(score && score.avg && score.avg[colId] != null && String(score.avg[colId]).trim() !== '') return String(score.avg[colId]);
  const vs = [];
  (sids || []).forEach(sid => {
    const r = (rows || {})[sid]; if(!r) return;
    const v = colId === '__tot' ? scoreTotal(score, r.s || {}) : (r.s || {})[colId];
    if(isNum(v)) vs.push(toNum(v));
  });
  return vs.length ? fmt1(vs.reduce((a, b) => a + b, 0) / vs.length) : '';
}
/* 학기 중 기록 → 5단계 제안 (평균을 반올림) */
export function suggestLevel(vals){
  const v = (vals || []).map(Number).filter(n => n >= 1 && n <= 5);
  if(!v.length) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return { avg: r1(m), lv: Math.min(5, Math.max(1, Math.floor(m + 0.5))), n: v.length };
}
/* 학생 한 명이 이 칸을 다 채웠는가 (화면 진행 막대 · «작성완료» 전 확인) */
export function rowFilled(sub, row){
  row = row || {};
  if(row.off) return true;                                  // 출력에서 뺀 학생
  const st = sub.setup || {};
  const narrNeed = (st.narr || []).filter(isEach);
  const nOk = narrNeed.every(n => String((row.n || {})[n.id] || '').trim());
  if(sub.kind === 'subj'){
    const t = sub.type || 'E';
    const eOk = !(t === 'E' || t === 'M') || (st.items || []).every(it => levelOf((row.e || {})[it.id]));
    const sOk = !(t === 'S' || t === 'M') || ((st.score && st.score.cols) || []).every(c => String((row.s || {})[c.id] ?? '').trim() !== '');
    if(t === 'R'){ const n = Math.max(1, Math.min(3, Number((st.r || {}).n) || 1)); return [1, 2, 3].slice(0, n).every(i => String((row.n || {})['c' + i] || '').trim()); }
    return eOk && sOk && nOk;
  }
  if(sub.kind === 'hr') return (st.narr || []).every(n => !isEach(n) || String((row.n || {})[n.id] || '').trim());
  if(sub.kind === 'camp' || sub.kind === 'vision') return nOk;
  return true;                                              // 출결 · 부모교육 · 특별활동 · 도서 · 봉사는 비어 있어도 됨
}
export function progressOf(sub, entry, sids){
  const ids = sids || sub.studentIds || [];
  const rows = (entry && entry.rows) || {};
  const done = ids.filter(id => rowFilled(sub, rows[id])).length;
  return { done, total: ids.length };
}

/* ═══ 출결 — 출석부 «학기말 출결표»와 같은 셈 (attend.html tallyStudent · calcSchoolDays 그대로) ═══
   types: attendTypes 목록 · recs: 그 학생의 studentAttendance · onLeave(date) · holidays · workPeriods */
export function holidayReason(ds, org, holidays, workPeriods){
  const hol = (holidays || []).find(h => h.date === ds && (h.org === 'all' || h.org === org));
  if(hol) return hol.name || '공휴일';
  const vac = (workPeriods || []).find(w => w.type === 'vacation' && w.org === org && ds >= w.s && ds <= w.e);
  if(vac) return vac.vac || vac.name || '방학';
  return null;
}
export function schoolDays(term, holidays, workPeriods){
  const out = [];
  if(!term || !term.start || !term.end) return out;
  const d = new Date(term.start + 'T00:00:00'), end = new Date(term.end + 'T00:00:00');
  while(d <= end){
    const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const w = d.getDay();
    if(w !== 0 && w !== 6 && !holidayReason(ds, term.org || ORG, holidays, workPeriods)) out.push(ds);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export function tallyAttendance(types, recs, term){
  const z = () => [0, 0, 0];
  const t = { ab: z(), la: z(), eo: z(), ex: z() };
  const typeIds = r => (r && Array.isArray(r.typeIds) && r.typeIds.length) ? r.typeIds : (r && r.typeId ? [r.typeId] : []);
  (recs || []).forEach(r => {
    if(!r.date || r.date < term.start || r.date > term.end) return;
    const ids = typeIds(r); const ty = ids.length ? (types || []).find(x => x.id === ids[0]) : null;
    if(!ty) return;
    let name = ty.name, reason = r.reason || '';
    if(name === '병결'){ name = '결석'; reason = '질병'; }
    if(name === '결석' || name === '지각' || name === '조퇴'){
      const g = name === '결석' ? 'ab' : name === '지각' ? 'la' : 'eo';
      t[g][reason === '질병' ? 0 : reason === '무단' ? 1 : 2]++;
    } else if(name === '체험학습'){
      t.ex[reason === '가족 대소사' ? 0 : reason === '가족 여행' ? 1 : 2]++;
    }
  });
  return t;
}
export const sum3 = a => (a || []).reduce((x, y) => x + (Number(y) || 0), 0);
/* 학기 안 «기관 전용 휴일»(임시 휴교 등) — 출결 아래 설명 */
export function closureNote(holidays, term){
  const items = (holidays || []).filter(h => h.org === (term.org || ORG) && h.date >= term.start && h.date <= term.end)
    .sort((a, b) => a.date.localeCompare(b.date));
  if(!items.length) return '';
  const by = {};
  items.forEach(h => { const k = h.name || '임시 휴교'; (by[k] = by[k] || []).push(`${+h.date.slice(5, 7)}/${+h.date.slice(8, 10)}`); });
  return Object.entries(by).map(([k, ds], i) => `${i + 1}. ${k} ※ ${ds.join(', ')} (총 ${ds.length}일)`).join('\n');
}

/* ═══════════════════════════════════════════════════════════
   📄 학생 한 명의 나학평 문서 (ReportDoc)
   { v:1, lang, cover:{ term, cls, grade, name, no }, blocks:[ { id, k, h, tables:[T], notes:[{id,h,p}] } ] }
   T = { id, cls, cols:[너비%], rows:[ { id, hd?, cells:[ { id, x, b?, cs?, rs?, al?, mk?, kd? } ] } ] }
   · x 는 글자 그대로 (줄바꿈은 \n) — 화면에 그릴 때 한 곳에서만 HTML로 바꾼다
   · id 는 출력본(가리기 · 고치기)이 가리키는 «자리» — 과목 id · 항목 id 로 만들어 다시 만들어도 같다
   · kd(글 종류): lab 고정 이름 · lvl 5단계 머리 · nm 사람 이름 · dt 날짜 · num 숫자 · tx 내용
   ═══════════════════════════════════════════════════════════ */
const C = (id, x, o) => Object.assign({ id, x: x == null ? '' : String(x) }, o || {});
const HD = { b: 1, al: 'c' };

export function teacherText(sub, staffName){
  if(sub.printTeacher) return sub.printTeacher;
  return (sub.teacherUids || []).map(u => staffName(u)).filter(Boolean).join(', ');
}
function narrRows(bid, sub, row, opt){
  const st = sub.setup || {};
  const rows = [];
  (st.narr || []).forEach(n => {
    const txt = isEach(n) ? ((row.n || {})[n.id] || '') : (n.fixed || '');
    if(!String(txt).trim()) return;
    if(opt && opt.noTitle) rows.push({ id: `${bid}:n:${n.id}`, cells: [C(`${bid}:n:${n.id}:x`, txt, { kd: 'tx' })] });
    else rows.push({ id: `${bid}:n:${n.id}`, cells: [C(`${bid}:n:${n.id}:t`, n.t || '', { b: 1, al: 'c', kd: 'lab' }), C(`${bid}:n:${n.id}:x`, txt, { kd: 'tx' })] });
  });
  return rows;
}
/* ═══ v144 표 모양 (평가 틀 › ② 표 모양) — 5단계 표 왼쪽 칸 (범위 · 세부 · 내용) 너비 ═══
   lay = { g:'n'|'m'|'w', s:'n'|'m'|'w', sOn:false } — 12칸 격자(왼쪽 이름 칸 92px + 49px 칸)에 붙는 세 가지 너비
   · 범위: 좁게 92 · 보통 141 · 넓게 190 / 세부: 좁게 98 · 보통 147 · 넓게 196 / 내용 = 나머지 · 5단계 다섯 칸은 늘 49px × 5 */
export const LAY_W = { g: { n: 92, m: 141, w: 190 }, s: { n: 98, m: 147, w: 196 } };
export const LAY_NAME = { n: '좁게', m: '보통', w: '넓게' };
export const hasSub = st => !!(st && st.lay && st.lay.sOn) || ((st && st.items) || []).some(it => String(it.s || '').trim());
export function evalCols(st, hasG, hasS){
  const lay = (st && st.lay) || {};
  const gw = LAY_W.g[lay.g] || 92, sw = LAY_W.s[lay.s] || 98, lv = 5 * 49;
  const g = [];
  if(hasS){ g.push(gw, sw, 680 - gw - sw - lv); }
  else g.push(gw, 680 - gw - lv);
  for(let i = 0; i < 5; i++) g.push(49);
  // 예전 모양(%) — 세부 칸이 없고 너비를 고치지 않았으면 예전 그대로 (12 · 53 · 7 × 5)
  const cols = (!hasS && !lay.g) ? [12, 53, 7, 7, 7, 7, 7] : TH.toPct(g);
  void hasG;
  return { cols, g };
}
function evalTable(bid, sub, row){
  const st = sub.setup || {};
  const items = st.items || [];
  if(!items.length) return null;
  const groups = items.some(it => String(it.g || '').trim());
  const subOn = hasSub(st);
  const left = subOn ? 3 : 2;
  const rows = [{ id: `${bid}:eh`, hd: 1, cells: [C(`${bid}:eh:0`, '평가', Object.assign({ cs: left, kd: 'lab' }, HD)),
    ...LEVELS.map(l => C(`${bid}:eh:${l.v}`, l.br, Object.assign({ kd: 'lvl', lv: l.v }, HD)))] }];
  // 같은 범위가 이어지는 동안 한 칸으로 묶는다 (예전 나학평 «범위» 칸)
  for(let i = 0; i < items.length; i++){
    const it = items[i];
    const v = Number((row.e || {})[it.id]) || 0;
    const marks = LEVELS.map(l => C(`${bid}:i:${it.id}:${l.v}`, v === l.v ? 'O' : '', { al: 'c', mk: 1 }));
    const g = String(it.g || '').trim();
    const sd = String(it.s || '').trim();
    const cells = [];
    const inGroup = groups && g;
    if(inGroup){
      let span = 1; while(i + span < items.length && String(items[i + span].g || '').trim() === g) span++;
      if(!(i > 0 && String(items[i - 1].g || '').trim() === g)) cells.push(C(`${bid}:g:${it.id}`, g, { rs: span, al: 'c', b: 1, kd: 'tx', gp: 1 }));
    }
    if(subOn){
      // 범위가 없는 줄은 범위 칸을 세부와 합친다
      cells.push(C(`${bid}:i:${it.id}:s`, sd, Object.assign({ kd: 'sd' }, inGroup ? {} : { cs: 2 })));
      cells.push(C(`${bid}:i:${it.id}:t`, it.t, { kd: 'tx' }));
    } else {
      cells.push(C(`${bid}:i:${it.id}:t`, it.t, Object.assign({ kd: 'tx' }, inGroup ? {} : { cs: 2 })));
    }
    rows.push({ id: `${bid}:i:${it.id}`, gid: g && groups ? `${bid}:g:${g}` : '', cells: cells.concat(marks) });
  }
  // 범위 칸(rowspan)이 이어지는 줄 — 한 줄로 묶어 쪽 나눔에서 떨어지지 않게
  const w = evalCols(st, groups, subOn);
  return { id: `${bid}:E`, cls: 'eval', cols: w.cols, g: w.g, rows };
}
function scoreTable(bid, sub, row, entry, sids0){
  const sc = (sub.setup || {}).score;
  if(!sc || !(sc.cols || []).length) return null;
  const cols = sc.cols, tot = sc.tot && sc.tot.on;
  const sids = sids0 || sub.studentIds || [];
  const rs = (entry && entry.rows) || {};
  const nCol = cols.length + (tot ? 1 : 0);
  const head = [C(`${bid}:sh:t`, sc.title || '성적', Object.assign({ rs: sc.avgOn !== false ? 3 : 2, kd: 'lab' }, HD)),
    C(`${bid}:sh:s`, sc.sub || '', Object.assign({ kd: 'lab' }, HD)),
    ...cols.map(c => C(`${bid}:sh:${c.id}`, c.t + (Number(c.w) > 0 && !/%/.test(c.t) ? `\n(${c.w}%)` : ''), Object.assign({ kd: 'lab' }, HD)))];
  if(tot) head.push(C(`${bid}:sh:__tot`, sc.tot.t || '총 점수', Object.assign({ kd: 'lab' }, HD)));
  const vals = row.s || {};
  const me = [C(`${bid}:sr:l`, sc.r1 || '개인점수', { b: 1, al: 'c', kd: 'lab' }),
    ...cols.map(c => C(`${bid}:sr:${c.id}`, vals[c.id] ?? '', { al: 'c', kd: 'num' }))];
  if(tot) me.push(C(`${bid}:sr:__tot`, scoreTotal(sc, vals), { al: 'c', b: 1, kd: 'num' }));
  const rows = [{ id: `${bid}:sh`, hd: 1, cells: head }, { id: `${bid}:sr`, cells: me }];
  if(sc.avgOn !== false){
    const av = [C(`${bid}:sa:l`, sc.r2 || '반 평균', { b: 1, al: 'c', kd: 'lab' }),
      ...cols.map(c => C(`${bid}:sa:${c.id}`, scoreAvg(sc, rs, sids, c.id), { al: 'c', kd: 'num' }))];
    if(tot) av.push(C(`${bid}:sa:__tot`, scoreAvg(sc, rs, sids, '__tot'), { al: 'c', kd: 'num' }));
    rows.push({ id: `${bid}:sa`, cells: av });
  }
  const w = Math.max(8, Math.floor(70 / nCol));
  return { id: `${bid}:S`, cls: 'score', cols: [14, 16].concat(Array(nCol).fill(w)), rows, keep: 1 };
}

/* 특별활동 — 그 반에 해당하는 활동 (대상 반을 고르지 않았으면 모든 반)
   · 활동마다 «기본 참여»(def:'all' 모두 · 'none' 고른 학생만) → 학생별로 빠짐(no) · 더함(yes) */
export function actsFor(lists, secId){
  return ((lists && lists.activities) || []).filter(a => a && String(a.t || '').trim() && (!a.secs || !a.secs.length || a.secs.includes(secId)))
    .sort((a, b) => (a.o || 0) - (b.o || 0));
}
export function joined(a, row){
  row = row || {};
  if(a.def === 'none') return !!(row.yes || {})[a.id];
  return !(row.no || {})[a.id];
}

/* 이 칸을 듣는 학생 — 따로 고르지 않았으면 그 반 학생 모두 */
export function subStudents(sub, sec){
  return (sub && Array.isArray(sub.studentIds) && sub.studentIds.length) ? sub.studentIds : ((sec && sec.students) || []);
}

/* 칸 하나 → 문서 블록 (없으면 null) */
export function blockFor(sub, ctx){
  const { stu, entry, lists, staffName, term } = ctx;
  const row = ((entry && entry.rows) || {})[stu.id] || {};
  if(row.off) return null;                               // 이 학생은 이 칸을 출력하지 않음
  const st = sub.setup || {};
  const bid = sub.id;
  const teacher = teacherText(sub, staffName);
  if(sub.kind === 'subj'){
    const t = sub.type || 'E';
    const tables = [];
    if(t === 'E' || t === 'M'){ const x = evalTable(bid, sub, row); if(x) tables.push(x); }
    if(t === 'S' || t === 'M'){ const x = scoreTable(bid, sub, row, entry, subStudents(sub, ctx.sec)); if(x) tables.push(x); }
    if(t === 'R'){
      const r = st.r || {}; const n = Math.max(1, Math.min(3, Number(r.n) || 1));
      const cs = [1, 2, 3].slice(0, n).map(i => (row.n || {})['c' + i] || '').filter(x => String(x).trim());
      const rows = [];
      if(String(r.title || '').trim()) rows.push({ id: `${bid}:rt`, cells: [C(`${bid}:rt:x`, r.title, { cs: 2, b: 1, al: 'c', kd: 'tx' })] });
      cs.forEach((x, i) => rows.push({ id: `${bid}:r${i}`, cells: [
        ...(i === 0 ? [C(`${bid}:r:it`, r.it || '', { rs: cs.length, b: 1, al: 'c', kd: 'lab' })] : []), C(`${bid}:r${i}:x`, x, { kd: 'tx' })] }));
      if(rows.length) tables.push({ id: `${bid}:R`, cls: 'narr', cols: [20, 80], rows });
    }
    if(t === 'A'){
      const a = st.a || {};
      const nr = narrRows(bid, sub, row, { noTitle: !!a.noTitle });
      const rows = [];
      if(String(a.t1 || '').trim() && !a.noTitle) rows.push({ id: `${bid}:at`, hd: 1, cells: [C(`${bid}:at:1`, a.t1, Object.assign({ kd: 'tx', cs: a.t2 ? 1 : 2 }, HD)), ...(a.t2 ? [C(`${bid}:at:2`, a.t2, Object.assign({ kd: 'tx' }, HD))] : [])] });
      if(nr.length) tables.push({ id: `${bid}:A`, cls: 'narr', cols: a.noTitle ? [100] : [18, 82], rows: rows.concat(nr) });
    } else {
      const nr = narrRows(bid, sub, row);
      if(nr.length) tables.push({ id: `${bid}:N`, cls: 'narr', cols: [18, 82], rows: nr });
    }
    if(!tables.length) return null;
    // v144 머리글 곁 — 교과 · 방식 / 조별 · 3조 (A · C 속지에 작게)
    const kd = sub.grp ? `조별 · ${sub.grp.name || ''}` : `교과 · ${(TYPES[t] || TYPES.E).short}`;
    return { id: bid, k: 'subj', h: { t: 'subj', name: sub.printName || sub.name, teacher, tid: bid + ':h', kd, grp: sub.grp ? (sub.grp.name || '') : '' }, tables };
  }
  if(sub.kind === 'hr'){
    const items = (st.narr || []).map(n => ({ n, x: isEach(n) ? ((row.n || {})[n.id] || '') : (n.fixed || '') })).filter(o => String(o.x).trim());
    if(!items.length) return null;
    const label = st.label || '담임 평가';
    const rows = items.map((o, i) => ({ id: `${bid}:n:${o.n.id}`, cells: [
      ...(i === 0 ? [C(`${bid}:lab`, label, { rs: items.length, b: 1, al: 'c', kd: 'lab' })] : []),
      C(`${bid}:n:${o.n.id}:t`, o.n.t || '', { b: 1, al: 'c', kd: 'lab' }), C(`${bid}:n:${o.n.id}:x`, o.x, { kd: 'tx' })] }));
    return { id: bid, k: 'hr', h: { t: 'hr', name: sub.printName || '담임평가', teacher, tid: bid + ':h' }, tables: [{ id: `${bid}:H`, cls: 'narr', cols: [12, 14, 74], rows }] };
  }
  if(sub.kind === 'att'){
    const m = (entry && entry.meta) || {};
    const a = row.a || {};
    const days = a.days != null ? Number(a.days) : Number(m.days || 0);
    const absent = sum3(a.ab);
    const present = a.present != null ? Number(a.present) : Math.max(0, days - absent);
    const v = x => (Number(x) ? String(x) : '·');
    const hd0 = [C(`${bid}:h0`, '출석 일수 /\n총 수업 일수', Object.assign({ kd: 'lab', sm: 1 }, HD)),
      ...ATT_GROUPS.map(g => C(`${bid}:h0:${g.k}`, g.ko, Object.assign({ cs: 3, kd: 'lab' }, HD)))];
    const hd1 = [C(`${bid}:days`, `${present}일 /\n총 ${days}일` + (Number(a.lv) ? `\n(휴학 ${Number(a.lv)}일 제외)` : ''), { rs: 2, al: 'c', b: 1, kd: 'num' }),
      ...ATT_GROUPS.flatMap(g => g.subs.map((s, i) => C(`${bid}:h1:${g.k}${i}`, s.replace(' ', '\n'), Object.assign({ kd: 'lab', sm: 1 }, HD))))];
    const vals = ATT_GROUPS.flatMap(g => [0, 1, 2].map(i => C(`${bid}:v:${g.k}${i}`, v((a[g.k] || [])[i]), { al: 'c', kd: 'num' })));
    const notes = [];
    const note = a.note != null ? a.note : m.note;
    if(String(note || '').trim()) notes.push({ id: `${bid}:note`, h: m.noteTitle || '*휴교 사유', p: note });
    const title = m.title || `출결 (정상 수업 기간 : ${shortRange(term && term.start, term && term.end)})`;
    return { id: bid, k: 'att', h: { t: 'text', x: title, tid: bid + ':h' }, keep: 1,
      tables: [{ id: `${bid}:T`, cls: 'att', cols: [14].concat(Array(12).fill(7.16)), rows: [
        { id: `${bid}:r0`, hd: 1, cells: hd0 }, { id: `${bid}:r1`, hd: 1, cells: hd1 }, { id: `${bid}:r2`, cells: vals }], keep: 1 }], notes };
  }
  if(sub.kind === 'parent'){
    const pick = st.pick || [];
    const items = ((lists && lists.parentEdu) || []).filter(p => pick.includes(p.id));
    const res = row.p || {};
    const rows = [];
    items.forEach(p => {
      const tg = p.target === 'F' ? ['F'] : p.target === 'M' ? ['M'] : ['F', 'M'];
      tg.forEach(w => {
        const r = ((res[p.id] || {})[w === 'F' ? 'f' : 'm'] || '').trim();
        if(!r || r === 'LD') return;
        rows.push({ id: `${bid}:p:${p.id}:${w}`, cells: [
          C(`${bid}:p:${p.id}:${w}:k`, w === 'F' ? '아버지 교육' : '어머니 교육', { al: 'c', b: 1, kd: 'lab' }),
          C(`${bid}:p:${p.id}:t`, [p.t, p.d].filter(Boolean).join(' '), { kd: 'tx' }),
          C(`${bid}:p:${p.id}:${w}:w`, w === 'F' ? '부' : '모', { al: 'c', kd: 'lab' }),
          C(`${bid}:p:${p.id}:${w}:r`, r, { al: 'c', kd: 'tx' })] });
      });
    });
    if(!rows.length) return null;
    const notes = String(st.note || '').trim() ? [{ id: `${bid}:note`, h: '', p: st.note }] : [];
    return { id: bid, k: 'parent', h: { t: 'fixed', key: 'parent', tid: bid + ':h' }, tables: [{ id: `${bid}:T`, cls: 'list', cols: [18, 46, 10, 26], rows }], notes };
  }
  if(sub.kind === 'act'){
    const rows = actsFor(lists, sub.secId).filter(a => joined(a, row)).map(a => ({ id: `${bid}:a:${a.id}`, cells: [
      C(`${bid}:a:${a.id}:t`, a.t, { al: 'c', kd: 'tx' }), C(`${bid}:a:${a.id}:d`, a.d || '', { al: 'c', kd: 'dt' }), C(`${bid}:a:${a.id}:c`, a.c || '', { kd: 'tx' })] }));
    if(!rows.length) return null;
    const ag = ctx.actGroup ? ctx.actGroup(stu.id) : '';
    return { id: bid, k: 'act', h: Object.assign({ t: 'fixed', key: 'act', tid: bid + ':h' }, ag ? { meta: `활동조 ${ag}` } : {}), tables: [{ id: `${bid}:T`, cls: 'list', cols: [20, 20, 60], rows: [
      { id: `${bid}:hd`, hd: 1, cells: [C(`${bid}:hd:0`, '특별활동', Object.assign({ kd: 'lab' }, HD)), C(`${bid}:hd:1`, '일시', Object.assign({ kd: 'lab' }, HD)), C(`${bid}:hd:2`, '활동 사항', Object.assign({ kd: 'lab' }, HD))] }].concat(rows) }] };
  }
  if(sub.kind === 'book'){
    const no = row.no || {};
    const books = (st.books || []).filter(b => b && String(b.t || '').trim() && !no[b.id]);
    if(!books.length) return null;
    const rows = [{ id: `${bid}:hd`, hd: 1, cells: [C(`${bid}:hd:0`, '도서', Object.assign({ kd: 'lab' }, HD)), C(`${bid}:hd:1`, '출판사', Object.assign({ kd: 'lab' }, HD)),
      C(`${bid}:hd:2`, '도서', Object.assign({ kd: 'lab' }, HD)), C(`${bid}:hd:3`, '출판사', Object.assign({ kd: 'lab' }, HD))] }];
    for(let i = 0; i < books.length; i += 2){
      const a = books[i], b = books[i + 1];
      rows.push({ id: `${bid}:b:${a.id}`, cells: [C(`${bid}:b:${a.id}:t`, a.t, { al: 'c', kd: 'tx' }), C(`${bid}:b:${a.id}:p`, a.p || '', { al: 'c', kd: 'tx' }),
        C(b ? `${bid}:b:${b.id}:t` : `${bid}:b:${a.id}:t2`, b ? b.t : '', { al: 'c', kd: 'tx' }), C(b ? `${bid}:b:${b.id}:p` : `${bid}:b:${a.id}:p2`, b ? (b.p || '') : '', { al: 'c', kd: 'tx' })] });
    }
    return { id: bid, k: 'book', h: { t: 'fixed', key: 'book', tid: bid + ':h' }, tables: [{ id: `${bid}:T`, cls: 'list', cols: [30, 20, 30, 20], rows }] };
  }
  if(sub.kind === 'serve'){
    const list = (row.list || []).filter(x => x && String(x.t || x.c || '').trim());
    if(!list.length) return null;
    const rows = [{ id: `${bid}:hd`, hd: 1, cells: [C(`${bid}:hd:0`, '봉사활동 및 수상 내역', Object.assign({ kd: 'lab' }, HD)), C(`${bid}:hd:1`, '날짜 및 기간', Object.assign({ kd: 'lab' }, HD)), C(`${bid}:hd:2`, '활동 사항', Object.assign({ kd: 'lab' }, HD))] }]
      .concat(list.map((x, i) => { const k = x.id || 'x' + i; return { id: `${bid}:s:${k}`, cells: [
        C(`${bid}:s:${k}:t`, x.t || '', { al: 'c', kd: 'tx' }), C(`${bid}:s:${k}:d`, x.d || '', { al: 'c', kd: 'dt' }), C(`${bid}:s:${k}:c`, x.c || '', { kd: 'tx' })] }; }));
    return { id: bid, k: 'serve', h: { t: 'fixed', key: 'serve', tid: bid + ':h' }, tables: [{ id: `${bid}:T`, cls: 'list', cols: [27, 23, 50], rows }] };
  }
  if(sub.kind === 'vision' || sub.kind === 'camp'){
    const L = ((lists && (sub.kind === 'vision' ? lists.visions : lists.camps)) || []).find(v => v.id === st.pick) || null;
    const F = sub.kind === 'vision'
      ? [['period', '기간'], ['theme', '주제'], ['pre', '사전 활동'], ['act', '활동 사항'], ['post', '사후 활동'], ['ov', '비전트립 활동 개관']]
      : [['theme', '주제'], ['period', '기간'], ['act', '활동 사항']];
    const rows = [];
    if(L) F.forEach(([k, lab]) => { if(String(L[k] || '').trim()) rows.push({ id: `${bid}:f:${k}`, cells: [C(`${bid}:f:${k}:t`, lab, { b: 1, al: 'c', kd: 'lab' }), C(`${bid}:f:${k}:x`, L[k], { kd: 'tx' })] }); });
    narrRows(bid, sub, row).forEach(r => rows.push(r));
    if(!rows.length) return null;
    return { id: bid, k: sub.kind, h: { t: 'fixed', key: sub.kind, x: sub.printName || '', tid: bid + ':h' }, tables: [{ id: `${bid}:T`, cls: 'narr', cols: [18, 82], rows }] };
  }
  return null;
}

/* 학생 한 명 문서 — subs: 그 반 칸 전부 (순서대로) · entries: { 칸 id: 입력 문서 } */
export function buildReport(o){
  const { term, sec, stu, subs, entries, lists } = o;
  const staffName = o.staffName || (u => u);
  // v144 조별 칸(학년 · 반이 섞인 칸)도 — 그 학생이 든 칸만 (subs 에 함께 넘긴다)
  const mine = (subs || []).filter(s => !s.removed && (s.grp ? (s.studentIds || []).includes(stu.id) : (!(s.studentIds || []).length || (s.studentIds || []).includes(stu.id))))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const blocks = [];
  let subjHead = false;
  mine.forEach(s => {
    const b = blockFor(s, { stu, sec, entry: (entries || {})[s.id], lists, staffName, term, actGroup: o.actGroupOf || null });
    if(!b) return;
    if(b.k === 'subj' && !subjHead){ blocks.push({ id: 'h_subj', k: 'sec', h: { t: 'fixed', key: 'subjects', tid: 'h_subj:h' }, tables: [] }); subjHead = true; }
    blocks.push(b);
  });
  return {
    v: 1, lang: 'ko', org: ORG, termId: term && term.id, sid: stu.id,
    cover: Object.assign({ term: termLabel(term), cls: sec ? sec.name : '', grade: sec ? sec.grade : '', name: stu.name || '', no: stu.studentNo || '' },
      (sec && sec.hrUid && staffName(sec.hrUid)) ? { hr: staffName(sec.hrUid) } : {}),
    blocks,
  };
}

/* ═══════════════════════════════════════════════════════════
   🌐 영문판 · 출력본
   ═══════════════════════════════════════════════════════════ */
export const KEY_HEAD = {
  subjects: ['교과 학습활동', 'Academic Subjects'],
  parent:   ['부모교육 및 과제', 'Parent Education & Assignments'],
  act:      ['특별활동', 'Special Activities'],
  book:     ['도서 활동 (학기 중 수업 시간에 읽은 도서)', 'Reading (Books Read in Class This Semester)'],
  serve:    ['교내 봉사활동 및 수상 내역', 'School Service & Awards'],
  vision:   ['비전트립 (활동 및 평가)', 'Vision Trip'],
  camp:     ['캠프 (활동 및 평가)', 'Camp'],
  hr:       ['담임평가', "Homeroom Teacher's Evaluation"],
};
/* 고정 문구 (같은 글이면 어디서든) — 번역 표에서 바꿀 수 있다 */
export const EN_FIXED = {
  '평가': 'Assessment', '매우 잘함': 'Excellent', '잘함': 'Very Good', '보통': 'Satisfactory', '부족': 'Developing', '노력 요함': 'Needs Effort',
  '출석 일수 / 총 수업 일수': 'Days Present / School Days', '결석일수': 'Absences', '결석 일수': 'Absences', '결석': 'Absences', '지각': 'Late', '조퇴': 'Early Leave', '체험학습': 'Field Learning',
  '질병': 'Illness', '무단': 'Unexcused', '기타': 'Other', '가족 대소사': 'Family Event', '가족 / 대소사': 'Family Event', '가족 여행': 'Family Trip', '가족 / 여행': 'Family Trip',
  '성적': 'Scores', '시험': 'Exam', '개인점수': 'Student', '개인 점수': 'Student', '반 평균': 'Class Avg.', '반평균': 'Class Avg.', '학년 평균': 'Grade Avg.', '총 점수': 'Total', '총점': 'Total', '점수': 'Score',
  '수업 내용 개관': 'Course Overview', '수업 내용\n개관': 'Course Overview', '학습 개관': 'Course Overview', '수업 개관': 'Course Overview',
  '교사 서술 평가': "Teacher's Comments", '교사서술평가': "Teacher's Comments", '교사 서술평가': "Teacher's Comments",
  '품성 및 학교생활': 'Character & School Life', '영성 활동': 'Spiritual Life', '영성 및 태도': 'Spirituality & Attitude',
  '담임 평가': 'Homeroom Teacher', '담임평가': "Homeroom Teacher's Evaluation",
  '특별활동': 'Activity', '일시': 'Date', '활동 사항': 'Description', '활동사항': 'Description', '도서': 'Title', '출판사': 'Publisher',
  '봉사활동 및 수상 내역': 'Service / Award', '날짜 및 기간': 'Date / Period', '봉사': 'Service', '수상': 'Award',
  '아버지 교육': 'Father', '어머니 교육': 'Mother', '부': 'Father', '모': 'Mother', '부모': 'Parents',
  '수료': 'Completed', '미수료': 'Not Completed', '제출': 'Submitted', '미제출': 'Not Submitted', '미등록': 'Not Registered', '등록': 'Registered',
  '참석': 'Attended', '불참': 'Absent', '이수': 'Completed', '미이수': 'Not Completed', '교사교육으로 대체': 'Replaced by teacher training',
  '기간': 'Period', '주제': 'Theme', '사전 활동': 'Pre-trip Activities', '사후 활동': 'Post-trip Activities', '비전트립 활동 개관': 'Vision Trip Overview',
  '*휴교 사유': '*School Closures', '*휴업 사유': '*School Closures', '휴교 사유': 'School Closures', '휴업 사유': 'School Closures',
  '암송 구절 및 묵상 본문': 'Memory Verses & Devotional Passages',
  '기말평가': 'Final Assessment', '기말 평가': 'Final Assessment', '기말고사': 'Final Exam', '중간고사': 'Midterm Exam', '중간평가': 'Midterm Assessment', '수행평가': 'Performance Assessment',
  '태도': 'Attitude', '어휘력': 'Vocabulary', '수업 참여도': 'Class Participation', '과제': 'Assignments', '쪽지시험': 'Quizzes', '발표': 'Presentation',
  '교과 학습활동': 'Academic Subjects', '출결': 'Attendance', '부모교육 및 과제': 'Parent Education & Assignments',
  '도서 활동 (학기 중 수업 시간에 읽은 도서)': 'Reading (Books Read in Class This Semester)', '교내 봉사활동 및 수상 내역': 'School Service & Awards',
  '나의 학교생활': 'My School Life', '이름': 'Name', '학년': 'Grade', '반': 'Class',
};
const EN_FIX_N = (() => { const o = {}; Object.keys(EN_FIXED).forEach(k => { o[normKey(k)] = EN_FIXED[k]; }); return o; })();
/* 반 이름 (히브리 이름) — 번역 표에서 바꿀 수 있다 */
export const EN_CLASS = { '이레': 'Jireh', '로이': 'Roi', '샬롬': 'Shalom', '라파': 'Rapha', '닛시': 'Nissi', '샴마': 'Shammah', '삼마': 'Shammah', '엘샤다이': 'El Shaddai' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = { '일': 'Sun', '월': 'Mon', '화': 'Tue', '수': 'Wed', '목': 'Thu', '금': 'Fri', '토': 'Sat' };
export function enTerm(name){
  const s = String(name || '').trim();
  let m;
  if((m = /^(\d)\s*,\s*(\d)\s*학기$/.exec(s))) return `Semesters ${m[1]}–${m[2]}`;
  if((m = /^(\d)\s*학기$/.exec(s))) return `Semester ${m[1]}`;
  if(s === '여름 학기') return 'Summer Term';
  if(s === '겨울 학기') return 'Winter Term';
  return s;
}
export function enTermLabel(label){
  const m = /^(\d{4})\s*학년도\s*(.*)$/.exec(String(label || '').trim());
  return m ? `${m[1]} School Year · ${enTerm(m[2])}` : String(label || '');
}
/* v144 조 이름 — «3조» → «Group 3» */
export function enGroup(g){ const m = /^\s*(\d+)\s*조\s*$/.exec(String(g || '')); return m ? `Group ${m[1]}` : String(g || ''); }
export function enGrade(g){ const n = gradeNoOf(g); return n ? `Grade ${n}` : String(g || ''); }
export function enClass(name, extra){
  const s = String(name || '').trim();
  const map = Object.assign({}, EN_CLASS, extra || {});
  if(map[s]) return map[s];
  const m = /^(.+?)\s*반$/.exec(s);
  if(m && map[m[1]]) return `${map[m[1]]} Class`;
  if(m) return `${romanize(m[1], true)} Class`;
  return romanize(s, true);
}
/* 날짜 글 → 영문 (글 전체가 날짜 모양일 때만) — «2월 10일 ~ 12일» → «Feb 10–12» */
export function enDate(s){
  const t = String(s == null ? '' : s).trim();
  if(!t) return null;
  let x = t.replace(/(\d{4})\s*년\s*/g, '$1 ')
    .replace(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, (a, m, d) => `${MON[+m - 1] || m} ${+d}`)
    .replace(/(\d{1,2})\s*월/g, (a, m) => `${MON[+m - 1] || m}`)
    .replace(/(\d{1,2})\s*일/g, (a, d) => `${+d}`)
    .replace(/\b(\d{1,2})\.(\d{1,2})\b/g, (a, m, d) => (+m >= 1 && +m <= 12 ? `${MON[+m - 1]} ${+d}` : a))
    .replace(/\s*\(\s*([일월화수목금토])\s*\)/g, (a, w) => ` (${DOW[w]})`)
    .replace(/(\d)\s*학기/g, (a, n) => `Semester ${n}`)
    .replace(/\s*[~∼〜]\s*/g, '–')
    .replace(/\s*,\s*/g, ', ');
  if(/[가-힣]/.test(x)) return null;
  // «Feb 10–Mar 2» 처럼 두 달이 걸치면 가운데에 빈칸
  x = x.replace(/([A-Z][a-z]{2} \d+)–([A-Z][a-z]{2})/g, '$1 – $2');
  return x;
}
/* 한글 이름 로마자 (예시용 · 번역 표에서 고친다) — 김혜원 → Hyewon Kim */
const SUR = { '김': 'Kim', '이': 'Lee', '박': 'Park', '최': 'Choi', '정': 'Jung', '강': 'Kang', '조': 'Cho', '윤': 'Yoon', '장': 'Jang', '임': 'Lim', '한': 'Han',
  '오': 'Oh', '서': 'Seo', '신': 'Shin', '권': 'Kwon', '황': 'Hwang', '안': 'Ahn', '송': 'Song', '류': 'Ryu', '유': 'Yoo', '전': 'Jeon', '홍': 'Hong', '고': 'Ko',
  '문': 'Moon', '양': 'Yang', '손': 'Son', '배': 'Bae', '백': 'Baek', '허': 'Heo', '남': 'Nam', '심': 'Shim', '노': 'Noh', '하': 'Ha', '곽': 'Kwak', '성': 'Sung',
  '차': 'Cha', '주': 'Joo', '우': 'Woo', '구': 'Koo', '민': 'Min', '진': 'Jin', '나': 'Na', '변': 'Byun', '염': 'Yeom', '선': 'Sun', '소': 'So', '추': 'Choo',
  '도': 'Do', '마': 'Ma', '방': 'Bang', '석': 'Seok', '설': 'Seol', '지': 'Ji', '천': 'Cheon', '편': 'Pyeon', '표': 'Pyo', '현': 'Hyun', '엄': 'Eom', '원': 'Won',
  '채': 'Chae', '탁': 'Tak', '왕': 'Wang', '여': 'Yeo', '육': 'Yook', '인': 'In', '국': 'Kook', '기': 'Ki', '모': 'Mo', '명': 'Myung', '맹': 'Maeng', '봉': 'Bong',
  '황보': 'Hwangbo', '남궁': 'Namgung', '제갈': 'Jegal', '선우': 'Sunwoo', '독고': 'Dokgo', '사공': 'Sagong', '서문': 'Seomun' };
const RI = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const RV = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const RF = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];
export function romanize(s, cap){
  let out = '';
  for(const ch of String(s || '')){
    const c = ch.charCodeAt(0);
    if(c >= 0xAC00 && c <= 0xD7A3){ const i = c - 0xAC00; out += RI[Math.floor(i / 588)] + RV[Math.floor((i % 588) / 28)] + RF[i % 28]; }
    else out += ch;
  }
  return cap ? out.replace(/(^|[\s-])([a-z])/g, (a, p, l) => p + l.toUpperCase()) : out;
}
export function romanName(name){
  const s = String(name || '').replace(/\s+/g, '');
  if(!/^[가-힣]{2,5}$/.test(s)) return String(name || '');
  let sur = s.slice(0, 1), given = s.slice(1);
  if(s.length >= 3 && SUR[s.slice(0, 2)]){ sur = s.slice(0, 2); given = s.slice(2); }
  const g = romanize(given); const G = g.charAt(0).toUpperCase() + g.slice(1);
  return `${G} ${SUR[sur] || romanize(sur, true)}`;
}
/* 번역기 — 고친 글(출력본) > 번역 표 > 고정 문구 > 모양(날짜 · 숫자) > (이름이면 로마자 예시) > 그대로 */
export function makeTranslator(o){
  o = o || {};
  const gl = o.gloss || {};          // { 열쇠: { k:원문, e:영문 } }
  const names = o.names || {};       // { 한글 이름: 영문 }
  const cls = o.classes || {};
  return {
    tx(text, kd){
      const raw = String(text == null ? '' : text);
      const t = norm(raw);
      if(!t || /^[·.O○●\-–—/%\s]+$/.test(t)) return { x: raw, ok: true };
      if(/^[\d\s.,/%~()+-]+$/.test(t)) return { x: raw, ok: true };
      const g = gl[hashKey(t)];
      if(g && String(g.e || '').trim()) return { x: g.e, ok: true, g: 1 };
      const f = EN_FIX_N[normKey(t)];
      if(f) return { x: f, ok: true };
      if(names[t]) return { x: names[t], ok: true };
      let m;
      if((m = /^(\d+)\s*일\s*\/\s*총\s*(\d+)\s*일$/.exec(t.replace(/\n/g, ' ')))) return { x: `${m[1]} / ${m[2]} days`, ok: true };
      if((m = /^(\d+)\s*일\s*\/\s*총\s*(\d+)\s*일\s*\(\s*휴학\s*(\d+)\s*일\s*제외\s*\)$/.exec(t.replace(/\n/g, ' ')))) return { x: `${m[1]} / ${m[2]} days\n(${m[3]} days of leave excluded)`, ok: true };
      if((m = /^출결\s*\(\s*정상\s*수업\s*기간\s*:\s*(.+?)\s*\)$/.exec(t))) return { x: `Attendance (Regular school period: ${enDate(m[1]) || m[1]})`, ok: true };
      if((m = /^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\)$/.exec(t.replace(/\n/g, ' ')))){ const h = this.tx(m[1], kd); if(h.ok) return { x: `${h.x} (${m[2]}%)`, ok: true }; }
      if((m = /^(.+?)\s*\/\s*(\d+(?:\.\d+)?)\s*%$/.exec(t.replace(/\n/g, ' ')))){ const h = this.tx(m[1], kd); if(h.ok) return { x: `${h.x} (${m[2]}%)`, ok: true }; }
      if(/학년도/.test(t) && /^\d{4}\s*학년도/.test(t)) return { x: enTermLabel(t), ok: true };
      if(/^\d\s*(,\s*\d\s*)?학기$/.test(t)) return { x: enTerm(t), ok: true };
      const d = enDate(t);
      if(d) return { x: d, ok: true };
      if(kd === 'cls'){ return { x: enClass(t, cls), ok: true, auto: 1 }; }
      if(kd === 'nm' && /^[가-힣]{2,5}$/.test(t.replace(/\s+/g, ''))) return { x: romanName(t), ok: true, auto: 1 };
      return { x: raw, ok: false };
    },
  };
}
/* 영문판 좁은 칸 — 줄바꿈 자리 · 칸 너비 (5단계 표 · 담임평가 표) */
const EN_WRAP = { 'Unexcused': 'Un-\nexcused', 'Family Event': 'Family\nEvent', 'Family Trip': 'Family\nTrip' };
const EN_COLS = { 'eval:7': [10, 40, 10, 10, 10, 10, 10], 'narr:3': [15, 18, 67] };
/* 용어 바꾸기 — [{ f:'휴교', t:'휴업' }] (긴 말부터) */
export function applyRep(x, rep){
  let s = String(x == null ? '' : x);
  (rep || []).filter(r => r && String(r.f || '') && r.f !== r.t).sort((a, b) => String(b.f).length - String(a.f).length)
    .forEach(r => { s = s.split(r.f).join(r.t == null ? '' : r.t); });
  return s;
}
export const REP_SUGGEST = [
  { f: '휴교', t: '휴업' }, { f: '학교생활', t: '기관 생활' }, { f: '개교기념', t: '설립 기념' }, { f: '등교', t: '등원' },
];

/* 표 줄 빼기 — 위아래로 묶인 칸(rowspan)이 있어도 모양이 무너지지 않게 다시 맞춘다 */
export function layoutTable(t){
  const occ = []; const pos = [];
  (t.rows || []).forEach((r, ri) => {
    occ[ri] = occ[ri] || [];
    let col = 0;
    pos[ri] = (r.cells || []).map(c => {
      while(occ[ri][col]) col++;
      const cs = Math.max(1, c.cs || 1), rs = Math.max(1, c.rs || 1);
      for(let y = 0; y < rs; y++){ occ[ri + y] = occ[ri + y] || []; for(let x = 0; x < cs; x++) occ[ri + y][col + x] = 1; }
      const p = { c, col, ri }; col += cs; return p;
    });
  });
  return pos;
}
export function dropRows(t, drop){
  if(!drop || !drop.size) return t;
  const pos = layoutTable(t);
  const keep = (t.rows || []).map((r, i) => !drop.has(i));
  const moved = {};          // 새로 들어갈 줄 → [{c, col}]
  const rows = [];
  (t.rows || []).forEach((r, ri) => {
    pos[ri].forEach(p => {
      const rs = Math.max(1, p.c.rs || 1);
      const span = []; for(let y = ri; y < ri + rs && y < t.rows.length; y++) if(keep[y]) span.push(y);
      if(!span.length) return;
      const c = Object.assign({}, p.c); if(rs > 1) c.rs = span.length; if(c.rs === 1) delete c.rs;
      (moved[span[0]] = moved[span[0]] || []).push({ c, col: p.col });
    });
  });
  (t.rows || []).forEach((r, ri) => {
    if(!keep[ri]) return;
    rows.push(Object.assign({}, r, { cells: (moved[ri] || []).sort((a, b) => a.col - b.col).map(x => x.c) }));
  });
  return Object.assign({}, t, { rows });
}

/* 출력본 적용 — 원본(doc)은 건드리지 않고 새 문서를 돌려준다
   ed = { lang, ov:{ 자리:글 }, hide:{ 자리:1 }, rep:[…], useRep, nameEn, renumber }
   opt = { tr: 번역기, rep: 기본 용어 바꾸기(설정) } */
export function applyEdition(doc, ed, opt){
  ed = ed || {}; opt = opt || {};
  const lang = ed.lang || doc.lang || 'ko';
  const out = JSON.parse(JSON.stringify(doc));
  out.lang = lang;
  const tr = lang === 'en' ? (opt.tr || makeTranslator({})) : null;
  const rep = (ed.useRep === false ? [] : (opt.rep || [])).concat(ed.rep || []);
  const ov = ed.ov || {}, hide = ed.hide || {};
  const names = Object.assign({}, opt.names || {}, ed.names || {});
  let untr = 0;
  const fix = (id, x, kd) => {
    if(id && ov[id] != null) return { x: String(ov[id]), ov: 1 };
    let t = x == null ? '' : String(x), ut = false;
    if(tr){ const r = tr.tx(t, kd); t = r.x; ut = !r.ok; if(ut) untr++; }
    return { x: applyRep(t, rep), ut };
  };
  // 표지
  const cv = out.cover || {};
  const cvo = {};
  // v144 담임(hr) — 새 표지 · 첫 쪽 정보 줄에 나옴 (영문판은 번역 표의 이름 · 없으면 로마자)
  [['term', 'cv.term', 'dt'], ['cls', 'cv.cls', 'cls'], ['grade', 'cv.grade', 'lab'], ['name', 'cv.name', 'nm'], ['hr', 'cv.hr', 'nm']].forEach(([k, id, kd]) => {
    if(k === 'hr' && !cv.hr && ov[id] == null) return;
    let v = cv[k] || '';
    if(lang === 'en'){
      if(k === 'term') v = enTermLabel(v);
      else if(k === 'grade') v = enGrade(v);
      else if(k === 'name') v = ed.nameEn || (opt.nameEn || '') || romanName(v);
      else if(k === 'hr') v = names[v] || tr.tx(v, 'nm').x;
      else if(k === 'cls') v = tr.tx(v, 'cls').x;
    }
    cvo[k] = ov[id] != null ? String(ov[id]) : applyRep(v, rep);
  });
  out.cover = Object.assign({}, cv, cvo);
  // 블록
  out.blocks = (out.blocks || []).filter(b => !hide[b.id]).map(b => {
    const nb = Object.assign({}, b);
    nb.h = Object.assign({}, b.h || {});
    if(nb.h.t === 'subj' || nb.h.t === 'hr'){
      if(lang === 'en'){
        if(ov[b.id + ':hn'] != null) nb.h.name = String(ov[b.id + ':hn']);
        else { const r = tr.tx(nb.h.name, 'tx'); nb.h.name = r.x; if(!r.ok) untr++; }
        nb.h.teacher = String(nb.h.teacher || '').split(/\s*,\s*/).filter(Boolean).map(n => names[n] || tr.tx(n, 'nm').x).join(', ');
        if(nb.h.grp) nb.h.grp = enGroup(nb.h.grp);
      } else if(ov[b.id + ':hn'] != null) nb.h.name = String(ov[b.id + ':hn']);
      nb.h.name = applyRep(nb.h.name, rep); nb.h.teacher = applyRep(nb.h.teacher || '', rep);
    } else if(nb.h.t === 'text'){
      nb.h.x = fix(null, nb.h.x, 'lab').x;
    } else if(nb.h.t === 'fixed'){
      nb.h.x = (nb.h.x && lang !== 'en') ? nb.h.x : (KEY_HEAD[nb.h.key] || ['', ''])[lang === 'en' ? 1 : 0];
      nb.h.x = applyRep(nb.h.x, rep);
      if(nb.h.meta && lang === 'en') nb.h.meta = String(nb.h.meta).replace(/^활동조\s*(.*)$/, (m, g) => `Activity ${enGroup(g)}`);
    }
    if(ov[b.id + ':h'] != null) nb.h = { t: 'text', x: String(ov[b.id + ':h']), tid: b.id + ':h' };
    nb.tables = (b.tables || []).filter(t => !hide[t.id]).map(t => {
      const drop = new Set();
      (t.rows || []).forEach((r, i) => { if(hide[r.id] || (r.gid && hide[r.gid])) drop.add(i); });
      const t2 = dropRows(t, drop);
      t2.rows = t2.rows.map(r => Object.assign({}, r, { cells: r.cells.map(c => {
        const nc = Object.assign({}, c);
        if(hide[c.id]){ nc.x = ''; nc.hid = 1; return nc; }
        if(c.kd === 'lvl' && lang === 'en'){ const l = levelOf(c.lv); nc.x = ov[c.id] != null ? String(ov[c.id]) : (l ? (opt.levelEn && opt.levelEn[l.v]) || l.enBr || l.en : c.x); return nc; }
        const r2 = fix(c.id, c.x, c.kd); nc.x = r2.x; if(r2.ut) nc.ut = 1; if(r2.ov) nc.ov = 1;
        if(lang === 'en' && r.hd && !r2.ov && EN_WRAP[nc.x]) nc.x = EN_WRAP[nc.x];
        return nc;
      }) }));
      // 영문은 낱말이 길어 좁은 칸이 어긋난다 — 영문판에서만 칸 너비를 조금 바꾼다
      { const k = `${t2.cls}:${(t2.cols || []).length}`; if(lang === 'en' && EN_COLS[k]) t2.cols = EN_COLS[k].slice(); }
      return t2;
    }).filter(t => t.rows.some(r => !r.hd));
    nb.notes = (b.notes || []).filter(n => !hide[n.id]).map(n => {
      const h = fix(n.id + ':h', n.h, 'lab'), p = fix(n.id, n.p, 'tx');
      return Object.assign({}, n, { h: h.x, p: p.x, ut: p.ut ? 1 : 0 });
    });
    return nb;
  }).filter(b => b.k === 'sec' || (b.tables || []).length || (b.notes || []).length);
  // 교과 머리글만 남고 과목이 다 빠졌으면 머리글도 뺀다
  if(!out.blocks.some(b => b.k === 'subj')) out.blocks = out.blocks.filter(b => b.k !== 'sec');
  out.untranslated = untr;
  return out;
}

/* ═══════════════════════════════════════════════════════════
   🖼 문서 그리기 (HTML 글자) — 화면 미리보기 · 쪽 나눔 · 인쇄 · PDF 가 모두 이것을 쓴다
   ═══════════════════════════════════════════════════════════ */
export const REPORT_CSS = `
.nr{font-family:'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#15181A;font-size:12.4px;line-height:1.58;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.nr.en{font-family:'Noto Sans','Helvetica Neue',Arial,'Noto Sans KR',sans-serif}
.nr *{box-sizing:border-box}
.nr .nb{margin:0 0 15px}
.nr .nh{font-weight:800;font-size:13.6px;margin:0 0 6px;display:flex;align-items:baseline;gap:7px;color:#15181A}
.nr .nh .tri{flex:0 0 auto;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid #23408E;transform:translateY(-1px)}
.nr .nh .t{min-width:0}
.nr .ns .nh{font-size:15px;font-weight:900;margin-top:2px}
.nr .nsub .nh{font-size:13.2px}
.nr table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 7px}
.nr table.auto{table-layout:auto}
.nr td{border:1px solid #3557A8;padding:6px 8px;vertical-align:middle;word-break:keep-all;overflow-wrap:anywhere;white-space:normal}
.nr td.b{font-weight:700}
.nr td.c{text-align:center}
.nr td.r{text-align:right}
.nr td.sm{font-size:11px;line-height:1.35}
.nr tr.hd td{background:#EDF2FB;font-weight:700;text-align:center}
.nr td.mk{font-weight:900;color:#1D3C8C;text-align:center;font-size:13px}
.nr table.att td{text-align:center;padding:5px 3px}
.nr table.eval tr.hd td{font-size:11.4px;line-height:1.3;padding:5px 3px}
.nr table.score td{text-align:center}
.nr .nn{font-size:11.6px;line-height:1.72;margin:3px 0 8px;white-space:normal}
.nr .nn b{font-weight:800}
.nr.en td{word-break:normal;overflow-wrap:break-word}
.nr.en table.eval tr.hd td{font-size:10.4px}
.nr.en table.att td.sm{font-size:10px}
.nr .ut{background:#FFF4C2}
.nr .ovr{background:#E9F7EF}
.nr .hid{color:#B7BDB9}
.nr.ed [data-c],.nr.ed [data-h],.nr.ed [data-nt]{cursor:pointer}
.nr.ed [data-c]:hover,.nr.ed [data-h]:hover,.nr.ed [data-nt]:hover{outline:2px solid #00704A;outline-offset:-2px}
.nr.ed .nb:hover{box-shadow:inset 3px 0 0 #00704A}
.nrc{position:relative;height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#15181A}
.nrc .top{width:78%;margin-top:8mm}
.nrc .top img{width:100%;display:block}
.nrc .tl{font-size:31px;font-weight:900;line-height:1.3;margin-top:10mm;letter-spacing:-.01em}
.nrc .who{font-size:27px;font-weight:900;line-height:1.35;margin-top:4mm}
.nrc .logo{margin-top:auto;margin-bottom:6mm}
.nrc .bn{display:flex;align-items:center;gap:12px;color:#22307A;text-align:left}
.nrc .bn img{width:58px;height:auto;display:block}
.nrc .bn b{display:block;font-size:31px;font-weight:900;letter-spacing:.08em;line-height:1.1}
.nrc .bn span{display:block;font-size:11.5px;font-weight:800;letter-spacing:.38em;margin-top:3px;font-family:'Noto Sans','Helvetica Neue',Arial,sans-serif}
.nrc .bn.en b{font-size:27px;letter-spacing:.06em;font-family:'Noto Sans','Helvetica Neue',Arial,sans-serif}
.nrc .bn.en span{letter-spacing:.2em}
.nrc.en{font-family:'Noto Sans','Helvetica Neue',Arial,sans-serif}
.nrc.en .big{margin-top:34mm;font-size:54px;font-weight:900;letter-spacing:-.02em;line-height:1}
.nrc.en .big i{font-style:normal;color:#F07A55}.nrc.en .big u{text-decoration:none;color:#21A1E8}
.nrc.en .sub{font-size:17px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#3557A8;margin-top:6mm}
.nrc.en .bar{width:64mm;height:2px;background:#15181A;margin:12mm auto 10mm}
.nrc.en .tl{font-size:22px;margin-top:0}
.nrc.en .who{font-size:20px;font-weight:700;margin-top:6mm;line-height:1.7}
.nrc.en .who b{font-weight:900}
` + TH.THEME_CSS;
/* v144 theme: 'old'(예전) · 'a' · 'c' — 칸 종류 표시(lb 이름 칸 · gp 범위 묶음 · sd 세부)는 A · C 속지 모양에만 쓰인다 */
export function cellClass(c, edit, hd){
  return [c.b ? 'b' : '', c.al === 'c' ? 'c' : c.al === 'r' ? 'r' : '', c.mk ? 'mk' : '', c.sm ? 'sm' : '',
    !hd && c.kd === 'lab' ? 'lb' : '', !hd && (c.gp || (c.rs > 1 && c.kd === 'tx' && c.b)) ? 'gp' : '', !hd && c.kd === 'sd' ? 'sd' : '',
    edit && c.ut ? 'ut' : '', edit && c.ov ? 'ovr' : '', edit && c.hid ? 'hid' : ''].filter(Boolean).join(' ');
}
export function cellText(c, edit, theme){
  if(edit && c.hid) return '(가림)';
  if(c.mk && theme && theme !== 'old' && String(c.x || '').trim()) return TH.markHTML(theme);
  return esc(c.x).replace(/\n/g, '<br>');
}
function cellHTML(c, edit, hd, theme){
  const cls = cellClass(c, edit, hd);
  const at = (c.cs > 1 ? ` colspan="${Number(c.cs) | 0}"` : '') + (c.rs > 1 ? ` rowspan="${Number(c.rs) | 0}"` : '') + (cls ? ` class="${cls}"` : '') + (edit && c.id && !c.mk ? ` data-c="${esc(c.id)}"` : '');
  return `<td${at}>${cellText(c, edit, theme)}</td>`;
}
export function colgroupHTML(t, theme){
  const cw = TH.colsFor(t, theme);
  return (cw || []).length ? `<colgroup>${cw.map(w => `<col style="width:${Number(w) || 0}%">`).join('')}</colgroup>` : '';
}
export function tableHTML(t, edit, theme){
  return `<table class="${esc((t.cls || '') + (t.auto ? ' auto' : ''))}" data-t="${esc(t.id || '')}">${colgroupHTML(t, theme)}<tbody>${(t.rows || []).map(r =>
    `<tr${r.hd ? ' class="hd"' : ''} data-r="${esc(r.id || '')}">${(r.cells || []).map(c => cellHTML(c, edit, r.hd, theme)).join('')}</tr>`).join('')}</tbody></table>`;
}
export function headText(b, lang, no){
  const h = b.h || {};
  const en = lang === 'en';
  if(h.t === 'subj') return `${no ? no + '. ' : ''}${h.name || ''}${h.grp ? ` (${h.grp})` : ''}${h.teacher ? (en ? ` — Teacher: ${h.teacher}` : ` - ${h.grp ? '조 담당' : '교사'} ${h.teacher}`) : ''}`;
  if(h.t === 'hr') return `${h.name || (en ? KEY_HEAD.hr[1] : '담임평가')}${h.teacher ? (en ? ` — Teacher: ${h.teacher}` : ` - 교사 ${h.teacher}`) : ''}`;
  if(h.t === 'fixed') return (h.x || (KEY_HEAD[h.key] || ['', ''])[en ? 1 : 0]) + (h.meta ? ` (${h.meta})` : '');
  return h.x || '';
}
export function noteHTML(n, edit){
  const h = String(n.h || '').trim(), p = String(n.p || '').trim();
  if(!h && !p) return '';
  return `<div class="nn${edit && n.ut ? ' ut' : ''}"${edit ? ` data-nt="${esc(n.id)}"` : ''}>${h ? `<b>${esc(h)}</b><br>` : ''}${esc(p).replace(/\n/g, '<br>')}</div>`;
}
/* 블록 하나 — 쪽 나눔이 «머리글 / 표 / 설명» 조각으로 다시 나눠 쓴다 */
export function blockParts(b, lang, no, edit, theme){
  const head = (theme && theme !== 'old') ? TH.headHTML(b, lang, no, edit, theme, KEY_HEAD)
    : `<div class="nh"${edit ? ` data-h="${esc(b.id)}"` : ''}><span class="tri"></span><span class="t">${esc(headText(b, lang, no))}</span></div>`;
  return { head, tables: (b.tables || []).map(t => t), notes: (b.notes || []).map(n => noteHTML(n, edit)).filter(Boolean) };
}
/* 번호 — 예전 모양은 교과만 (1. 2. …) · A · C 는 모든 칸에 차례로 (01 02 …) */
export const numbersFor = (doc, theme) => (theme && theme !== 'old') ? TH.numberAll(doc) : numberSubjects(doc);
export const themeClass = theme => (theme && theme !== 'old') ? ` th-${theme}` : '';
export function numberSubjects(doc){
  let n = 0; const m = {};
  (doc.blocks || []).forEach(b => { if(b.k === 'subj') m[b.id] = ++n; });
  return m;
}
export function docHTML(doc, opt){
  opt = opt || {};
  const edit = !!opt.edit, lang = doc.lang || 'ko', theme = opt.theme || 'old';
  const nos = numbersFor(doc, theme);
  const body = (doc.blocks || []).map(b => {
    const p = blockParts(b, lang, nos[b.id], edit, theme);
    const cls = b.k === 'sec' ? 'nb ns' : b.k === 'subj' ? 'nb nsub' : 'nb';
    return `<section class="${cls}" data-b="${esc(b.id)}" data-k="${esc(b.k)}">${p.head}${p.tables.map(t => tableHTML(t, edit, theme)).join('')}${p.notes.join('')}</section>`;
  }).join('');
  return `<div class="nr${lang === 'en' ? ' en' : ''}${edit ? ' ed' : ''}${themeClass(theme)}">${body}</div>`;
}
export function coverHTML(doc, opt){
  opt = opt || {};
  const cv = doc.cover || {};
  if((doc.lang || 'ko') === 'en'){
    return `<div class="nrc en">
      <div class="big"><i>My</i> <u>School</u> Life</div>
      <div class="sub">Student Progress Report</div>
      <div class="bar"></div>
      <div class="tl">${esc(cv.term || '')}</div>
      <div class="who">${cv.cls ? `<div>Class&nbsp; <b>${esc(String(cv.cls).replace(/\s+Class$/i, ''))}</b>${cv.grade ? ` · ${esc(cv.grade)}` : ''}</div>` : ''}<div>Name&nbsp; <b>${esc(cv.name || '')}</b></div></div>
      ${banner(opt.logo, true)}
    </div>`;
  }
  return `<div class="nrc">
    ${opt.cover ? `<div class="top"><img src="${esc(opt.cover)}" alt=""></div>` : ''}
    <div class="tl">${esc(cv.term || '')}</div>
    <div class="who">${esc([cv.cls, cv.grade].filter(Boolean).join(' '))} 이름 : ${esc(cv.name || '')}</div>
    ${banner(opt.logo)}
  </div>`;
}
/* 표지 아래 기관 이름띠 — 교표 + 이름 (예전 나학평 표지 띠를 글자로 다시 그림 · 크게 뽑아도 선명) */
function banner(emblem, en){
  return `<div class="logo"><div class="bn${en ? ' en' : ''}">${emblem ? `<img src="${esc(emblem)}" alt="">` : ''}<div>${en ? '<b>DANIEL AMATZ</b><span>[אמץ]</span>' : '<b>다니엘 아마츠</b><span>DANIEL AMATZ [אמץ]</span>'}</div></div></div>`;
}
