/* ═══════════════════════════════════════════════════════════
   🎨 nhp-theme.js — 나학평 출력 디자인 (v144)
   · 표지 8가지 (예전 모양 · 최초 C · 최초 C 발전 ①②③ · 3차 A · B · C) — 한글 · 영문
   · 속지 3가지 (예전 모양 · A 클래식 라인 · C 모던 블록)
     A · C 는 «같은 12칸 격자»: 본문 폭 680px = 왼쪽 이름 칸 92px + 49px × 12칸
     → 출결 · 5단계 · 시험 · 목록 표의 세로줄이 쪽 전체에서 위아래로 맞는다 (5단계 다섯 칸은 늘 맨 오른쪽 같은 자리)
   · 인쇄 원칙: 흰 종이 · 넓게 칠하지 않음 · 선과 글은 가장자리에서 12mm 안 (최초 C 표지의 띠만 예외 — 원안 그대로)
   · 원본(문서 내용)은 그대로 — 디자인은 그릴 때만 바뀐다
   ═══════════════════════════════════════════════════════════ */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── 고를 수 있는 모양 ── */
export const COVERS = [
  { k: 'cc1', ko: '최초 C 발전 ① 원안 다듬기', fam: 'c', d: '왼쪽 짙은 띠 (가장자리 12mm 안) · 아주 큰 «나의 / 학교 / 생활» · 아래 정보표 + 교표' },
  { k: 'cc2', ko: '최초 C 발전 ② 가는 띠', fam: 'c', d: '띠를 가는 선으로 — 잉크가 가장 적게 듦' },
  { k: 'cc3', ko: '최초 C 발전 ③ 띠에 이름', fam: 'c', d: '띠에 반 · 이름을 세로로 (책등처럼 — 모아 꽂아도 찾기 쉬움)' },
  { k: 'c0', ko: '최초 C · 모던 타이포', fam: 'c', d: '1차 C안 그대로 — 띠가 종이 끝까지 (프린터에 따라 가장자리가 조금 덜 찍힐 수 있음)' },
  { k: 'af', ko: '3차 A · 고전 증서', fam: 'a', d: '금선 테 · 교표 원 · 명조 제목 · 세 줄 이름표' },
  { k: 'cf', ko: '3차 B · 모던 그리드', fam: 'c', d: '윤곽선 «2026» · 이번 학기 표시 · 표지에 목차' },
  { k: 'acf', ko: '3차 C · 세로 선 책등', fam: 'a', d: '왼쪽 두 세로선 + 세로 글씨 · 명조 큰 제목' },
  { k: 'old', ko: '예전 모양', fam: 'old', d: '예전 나학평 표지 (그림 + 글)' },
];
export const INNERS = [
  { k: 'c', ko: 'C 모던 블록', d: '고딕 · 큰 초록 번호 · 세로선 없음 · 고른 단계는 초록 네모' },
  { k: 'a', ko: 'A 클래식 라인', d: '명조 제목 · 금선 · 가는 세로선 · 고른 단계는 초록 점' },
  { k: 'old', ko: '예전 모양', d: '예전 나학평 그대로 (파란 표 · O 표시)' },
];
export const DEF = { cover: 'cc1', inner: 'c' };
export const coverOf = k => COVERS.find(c => c.k === k) || COVERS.find(c => c.k === DEF.cover);
export const innerOf = k => INNERS.find(c => c.k === k) || INNERS.find(c => c.k === DEF.inner);
/* 표지에 어울리는 속지 (속지를 따로 고르지 않았을 때) */
export const innerForCover = k => { const f = coverOf(k).fam; return f === 'a' ? 'a' : f === 'old' ? 'old' : 'c'; };
/* 설정 → 실제로 쓸 모양 { cover, inner, sign } */
export function pick(cfg, over){
  const p = Object.assign({}, (cfg && cfg.print) || {}, over || {});
  const cover = coverOf(p.cover).k;
  const inner = p.inner ? innerOf(p.inner).k : innerForCover(cover);
  return { cover, inner, sign: p.sign || null };
}

/* ═══ 12칸 격자 ═══ */
export const GRID = { W: 680, L: 92, U: 49 };
const pct = px => Math.round(px / GRID.W * 100000) / 1000;
export const toPct = arr => arr.map(pct);
/* 예전 표 너비(%) → 격자 너비(px) — 지금 나학평이 만드는 모양과 옮겨 온 자료에 많은 모양만 (모르는 모양은 그대로) */
const L = GRID.L, U = GRID.U;
const SIG = {
  '12,53,7,7,7,7,7': [L, GRID.W - L - 5 * U, U, U, U, U, U],
  '14,7.16,7.16,7.16,7.16,7.16,7.16,7.16,7.16,7.16,7.16,7.16,7.16': [L].concat(Array(12).fill(U)),
  '15,7.08,7.08,7.08,7.08,7.08,7.08,7.08,7.08,7.08,7.08,7.08,7.08': [L].concat(Array(12).fill(U)),
  '18,82': [L, GRID.W - L],
  '12,14,74': [L, 2 * U, GRID.W - L - 2 * U],
  '20,80': [L + U, GRID.W - L - U],
  '18,46,10,26': [L + U, 8 * U, U, 2 * U],
  '20,20,60': [L + 2 * U, 2 * U, 8 * U],
  '27,23,50': [L + 2 * U, 3 * U, 7 * U],
  '30,20,30,20': [L + 3 * U, 2 * U, 5 * U, 2 * U],
  '100': [GRID.W],
};
const sigOf = cols => (cols || []).map(x => String(Math.round(Number(x) * 100) / 100).replace(/\.0+$/, '')).join(',');
/* 시험 표 (제목 · 구분 · 시험 항목 n · 총점) — 제목 92 · 구분 98 · 나머지를 고르게 */
function scoreGrid(n){
  const rest = GRID.W - L - 2 * U;
  if(n <= 0) return null;
  const base = Math.floor(rest / n), out = [L, 2 * U];
  for(let i = 0; i < n; i++) out.push(i === n - 1 ? rest - base * (n - 1) : base);
  return out;
}
/* 이 표를 이 속지 모양으로 그릴 때의 칸 너비(%) — 예전 모양이면 원래 너비 */
export function colsFor(t, theme){
  const cols = t.cols || [];
  if(!theme || theme === 'old' || !cols.length) return cols;
  if(Array.isArray(t.g) && t.g.length === cols.length) return toPct(t.g);          // 새로 만든 표 (격자 너비를 함께 저장)
  const g = SIG[sigOf(cols)];
  if(g && g.length === cols.length) return toPct(g);
  if(t.cls === 'score' && cols.length >= 3 && Math.abs(Number(cols[0]) - 14) < 0.6 && Math.abs(Number(cols[1]) - 14) < 2.5){ const s = scoreGrid(cols.length - 2); if(s) return toPct(s); }
  return cols;
}

/* ═══ 속지 CSS (A · C) — 예전 모양(REPORT_CSS) 위에 덮어 씀 ═══ */
const SERIF = "'Noto Serif KR','Nanum Myeongjo','AppleMyungjo',serif";
export const THEME_CSS = `
.nr.th-a,.nr.th-c{color:#1F2320;font-size:12.4px;line-height:1.55}
.nr.th-a .nb,.nr.th-c .nb{margin:0 0 22px}
.nr.th-a .nb.cont,.nr.th-c .nb.cont{margin-top:0}
.nr.th-a table,.nr.th-c table{margin:0 0 10px}
.nr.th-a td,.nr.th-c td{border:0;padding:7px 8px;background:none}
.nr.th-a tr.hd td,.nr.th-c tr.hd td{background:none;line-height:1.3}
.nr.th-a td.mk,.nr.th-c td.mk{padding-left:0;padding-right:0}
.nr .mkd{display:inline-block;vertical-align:middle}
.nr.th-a .mkd{width:10px;height:10px;border-radius:50%;background:#00704A}
.nr.th-c .mkd{width:9px;height:9px;background:#00704A}
.nr .nis{display:grid;grid-template-columns:${L + 2 * U}px ${4 * U}px ${3 * U}px minmax(0,1fr);margin:0 0 24px}
.nr .nis div{display:flex;flex-direction:column;gap:4px;padding:9px 12px 10px;min-width:0}
.nr .nis span{font-size:10px;font-weight:700;letter-spacing:.16em;color:#00704A}
.nr .nis b{font-size:14px;font-weight:700;color:#1F2320;overflow-wrap:anywhere}
.nr .nis b.nm{font-size:16px;font-weight:900;color:#1E3932}
.nr .nsg{margin-top:8px}
.nr .nsg .ln{font-size:13.5px;font-weight:700;color:#1E3932;letter-spacing:.04em}
.nr .nsg .dt{font-size:12px;color:#5A6560;letter-spacing:.06em}
.nr .nsg .who{display:flex;gap:30px;justify-content:flex-end;margin-top:8px}
.nr .nsg .who div{display:flex;align-items:center;gap:10px}
.nr .nsg .who span{font-size:11px;font-weight:700;letter-spacing:.16em;color:#00704A}
.nr .nsg .who b{font-size:15px;font-weight:700}
.nr .nsg .who i{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;border:1px dashed #B08D3C;font-style:normal;font-size:11px;font-weight:700;color:#8A6410}
/* — A 클래식 라인 — */
.nr.th-a .nh{display:flex;align-items:baseline;gap:10px;padding-bottom:7px;border-bottom:1px solid #1E3932;position:relative;margin:0 0 12px;font-size:inherit;font-weight:inherit}
.nr.th-a .nh:after{content:"";position:absolute;left:0;right:0;bottom:-4px;height:1px;background:#B08D3C}
.nr.th-a .nh .no{font-family:${SERIF};font-size:15px;font-weight:900;color:#B08D3C;flex:0 0 auto}
.nr.th-a .nh .t{font-family:${SERIF};font-size:18px;font-weight:900;color:#1E3932;min-width:0}
.nr.th-a .nh .k{font-size:10.5px;font-weight:700;color:#00704A;border:1px solid #9DB5AA;padding:1px 7px;border-radius:3px;white-space:nowrap;flex:0 0 auto}
.nr.th-a .nh .k.g{color:#8A6410;border-color:#D8C08A}
.nr.th-a .nh .w{margin-left:auto;font-size:11.5px;color:#5A6560;white-space:nowrap;padding-left:8px}
.nr.th-a .ns .nh{border:0;padding:0;margin:4px 0 12px;gap:12px;align-items:center}
.nr.th-a .ns .nh:after{display:none}
.nr.th-a .ns .nh .t{font-size:13px;letter-spacing:.14em;color:#8A6410;font-weight:700}
.nr.th-a .ns .nh .rl{flex:1 1 auto;height:1px;background:#B08D3C}
.nr.th-a .ns{margin-bottom:10px}
.nr.th-a table{border-bottom:1.5px solid #1E3932}
.nr.th-a td{border-bottom:1px solid #E1E8E4}
.nr.th-a td:not(:last-child){border-right:1px solid #E1E8E4}
.nr.th-a tr:last-child td{border-bottom:0}
.nr.th-a tr.hd td{font-size:11.5px;font-weight:700;color:#1E3932;padding:7px 3px;border-bottom:1px solid #1E3932;text-align:center}
.nr.th-a tr.hd td.sm{font-weight:500;font-size:10.6px}
.nr.th-a td.gp{font-family:${SERIF};font-weight:900;color:#1E3932;text-align:center;border-right:1px solid #C9D6D0}
.nr.th-a td.sd{font-weight:700;color:#00704A;font-size:11.8px}
.nr.th-a td.lb{font-family:${SERIF};font-weight:700;color:#00704A;font-size:12.6px;text-align:left}
.nr.th-a table.score tr:not(.hd) td.b:last-child{font-family:${SERIF};font-size:16px;font-weight:900;color:#8A6410}
.nr.th-a .nn{font-size:12px;line-height:1.75;margin:4px 0 8px}
.nr.th-a .nn b{font-family:${SERIF};color:#00704A;font-weight:700}
/* — C 모던 블록 — */
.nr.th-c .nh{display:grid;grid-template-columns:${L}px minmax(0,1fr) auto;align-items:end;margin:0 0 10px;font-size:inherit;font-weight:inherit}
.nr.th-c .nh .no{display:flex;flex-direction:column;gap:5px;font-size:30px;font-weight:900;line-height:.9;letter-spacing:-.04em;color:#00704A}
.nr.th-c .nh .no i{display:block;width:22px;height:4px;background:#B08D3C}
.nr.th-c .nh .t{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:18px;font-weight:900;color:#1E3932;padding-bottom:9px;min-width:0}
.nr.th-c .nh .k{font-size:10.5px;font-weight:800;letter-spacing:.04em;color:#00704A;white-space:nowrap}
.nr.th-c .nh .k.g{color:#8A6410}
.nr.th-c .nh .w{font-size:11.5px;color:#5A6560;padding-bottom:10px;white-space:nowrap;padding-left:10px}
.nr.th-c .ns .nh{display:flex;align-items:center;gap:8px;margin:2px 0 10px}
.nr.th-c .ns .nh .sq{display:block;width:8px;height:8px;background:#1E3932}
.nr.th-c .ns .nh .t{font-size:13px;letter-spacing:.06em;padding:0}
.nr.th-c .ns .nh .rl{flex:1 1 auto;height:1px;background:#1E3932}
.nr.th-c .ns{margin-bottom:8px}
.nr.th-c tr.hd td{font-size:10.5px;font-weight:800;letter-spacing:.04em;color:#5A6560;padding:6px 3px;border-bottom:2px solid #1E3932;text-align:center}
.nr.th-c tr.hd + tr.hd td{border-top:0}
.nr.th-c tr.hd td.sm{font-weight:700;font-size:10px}
.nr.th-c td{border-bottom:1px solid #E3E1DA}
.nr.th-c td.gp{vertical-align:top;font-size:11px;font-weight:900;letter-spacing:.08em;color:#00704A;padding-top:9px;text-align:left;border-bottom:1px solid #1E3932}
.nr.th-c td.sd{font-weight:800;color:#1E3932;font-size:11.8px}
.nr.th-c td.lb{font-size:11px;font-weight:800;letter-spacing:.06em;color:#00704A;text-align:left;vertical-align:top;padding-top:9px}
.nr.th-c table.score tr:not(.hd) td.b:last-child{font-size:17px;font-weight:900;color:#00704A}
.nr.th-c table.att tr.hd:first-child td:not(:first-child){color:#00704A;border-bottom:1px solid #00704A}
.nr.th-c .nn{font-size:12px;line-height:1.75;margin:4px 0 8px}
.nr.th-c .nn b{color:#00704A;font-weight:800;letter-spacing:.04em}
/* 출결 — 결석 · 지각 · 조퇴 · 체험학습 묶음 경계 */
.nr.th-a table.att tr:nth-child(2) td:nth-child(3n+2),.nr.th-a table.att tr:nth-child(3) td:nth-child(3n+1){border-left:1px solid #9DB5AA}
.nr.th-a table.att tr:first-child td:not(:first-child){border-left:1px solid #9DB5AA}
.nr.th-a .ed-zone,.nr.th-c .ed-zone{outline:0}
.nr.th-a.en .nh .t,.nr.th-c.en .nh .t{letter-spacing:0}
.nr.th-a.en tr.hd td,.nr.th-c.en tr.hd td{font-size:9.8px}
`;

/* ── 칸 · 머리글 (A · C) ── */
export function markHTML(theme){ return theme === 'old' ? 'O' : '<span class="mkd"></span>'; }
const two = n => String(n).padStart(2, '0');
/* «출결 (정상 수업 기간 : 8.24~12.18)» → 제목 «출결» · 곁 «정상 수업 기간 8.24 ~ 12.18» */
function splitTitle(x, en){
  const s = String(x || '').trim();
  let m = /^(.+?)\s*\(\s*(.+?)\s*\)\s*$/.exec(s);
  if(!m) return { t: s, w: '' };
  const w = m[2].replace(/\s*:\s*/, ' ').replace(/\s*[~∼〜]\s*/g, ' ~ ');
  return { t: m[1], w: en ? w.replace(/^Regular school period\s*/i, 'Regular period ') : w };
}
/* 블록 머리글 — 예전 모양은 nhp-core.headText 그대로 (여기서는 A · C) */
export function headHTML(b, lang, no, edit, theme, KEY_HEAD){
  const h = b.h || {}, en = lang === 'en';
  const at = edit ? ` data-h="${esc(b.id)}"` : '';
  if(b.k === 'sec'){
    const t = h.x || (KEY_HEAD[h.key] || ['', ''])[en ? 1 : 0];
    return theme === 'a' ? `<div class="nh"${at}><span class="t">${esc(t)}</span><span class="rl"></span></div>`
      : `<div class="nh"${at}><span class="sq"></span><span class="t">${esc(t)}</span><span class="rl"></span></div>`;
  }
  let t = '', w = '', k = '', kg = false;
  if(h.t === 'subj'){
    t = h.name || '';
    if(h.teacher) w = en ? `Teacher: ${h.teacher}` : `${h.grp ? '조 담당' : '교사'} ${h.teacher}`;
    if(!en && h.kd){ k = h.kd; kg = !!h.grp; }
  } else if(h.t === 'hr'){
    t = h.name || (en ? KEY_HEAD.hr[1] : '담임평가');
    if(h.teacher) w = en ? `Homeroom: ${h.teacher}` : `담임 ${h.teacher}`;
  } else if(h.t === 'fixed'){
    t = h.x || (KEY_HEAD[h.key] || ['', ''])[en ? 1 : 0];
    if(h.meta) w = h.meta;
  } else {
    const sp = splitTitle(h.x, en); t = sp.t; w = sp.w;
  }
  const n = no ? two(no) : '';
  if(theme === 'a') return `<div class="nh"${at}>${n ? `<span class="no">${n}</span>` : ''}<span class="t">${esc(t)}</span>${k ? `<span class="k${kg ? ' g' : ''}">${esc(k)}</span>` : ''}${w ? `<span class="w">${esc(w)}</span>` : ''}</div>`;
  return `<div class="nh"${at}><span class="no">${n}${n ? '<i></i>' : ''}</span><span class="t">${esc(t)}${k ? `<span class="k${kg ? ' g' : ''}">${esc(k)}</span>` : ''}</span><span class="w">${esc(w)}</span></div>`;
}
/* 쪽마다 번호 — A · C 는 모든 블록에 차례로 (교과 머리글 «sec» 빼고) */
export function numberAll(doc){
  let n = 0; const m = {};
  (doc.blocks || []).forEach(b => { if(b.k !== 'sec') m[b.id] = ++n; });
  return m;
}

/* ═══ 쪽 머리 · 바닥 · 첫 쪽 학생 정보 줄 · 확인 칸 ═══ */
const TX = {
  ko: { title: '나의 학교생활', report: '학교생활 평가서', term: '학년도 · 학기', cls: '반 · 학년', name: '이름', hr: '담임', org: '다니엘 아마츠', orgEn: 'DANIEL AMATZ', heb: 'DANIEL AMATZ [אמץ]', en1: 'My School Life', en2: 'Student Progress Report', inside: '이 평가서에 담긴 것', draft: '승인 전 미리보기', s1: '1학기', s2: '2학기', lead: '학교생활 평가서', big: ['나의', '학교', '생활'], seal: '인', signHr: '담임', signHead: '학교장' },
  en: { title: 'My School Life', report: 'Student Progress Report', term: 'School Year', cls: 'Class · Grade', name: 'Name', hr: 'Homeroom', org: 'DANIEL AMATZ', orgEn: 'DANIEL AMATZ', heb: 'DANIEL AMATZ [אמץ]', en1: 'Daniel Amatz', en2: 'Student Progress Report', inside: 'In This Report', draft: 'Draft preview', s1: 'Sem. 1', s2: 'Sem. 2', lead: 'Student Progress Report', big: ['My', 'School', 'Life'], seal: 'Seal', signHr: 'Homeroom', signHead: 'Principal' },
};
const tx = lang => TX[lang === 'en' ? 'en' : 'ko'];
export const CHROME = {
  old: { top: 57, innerH: 1123 - 57 * 2 - 22 },
  a: { top: 57 + 36, innerH: 1123 - (57 + 36) - 72 },
  c: { top: 57 + 36, innerH: 1123 - (57 + 36) - 72 },
};
export function runHeadHTML(theme, doc){
  const T = tx(doc.lang), cv = doc.cover || {};
  if(theme === 'a') return `<div class="npr npr-a"><i></i><b>${esc(T.title)}</b><i></i></div>`;
  const who = [shortTerm(cv.term, doc.lang), [cv.cls, cv.grade].filter(Boolean).join(' '), cv.name].filter(Boolean).join(' · ');
  return `<div class="npr npr-c"><b><i></i>${esc(T.title)}</b><span>${esc(who)}</span></div>`;
}
function shortTerm(term, lang){
  const m = /^(\d{4})\s*학년도\s*(\d)\s*학기/.exec(String(term || ''));
  if(m) return `${m[1]}-${m[2]}`;
  const e = /^(\d{4}) School Year · Semester (\d)/.exec(String(term || ''));
  if(e) return `${e[1]}-${e[2]}`;
  return String(term || '');
}
export function footHTML(theme, doc, i, n, opt){
  opt = opt || {};
  const T = tx(doc.lang), cv = doc.cover || {};
  const nm = cv.name || '', dr = opt.draft ? `${T.draft}` : '';
  if(theme === 'a') return `<div class="npf npf-a"><span>${esc(doc.lang === 'en' ? T.orgEn : T.org)}${dr ? ' · ' + esc(dr) : ''}</span><span class="pg"><i></i>${i} / ${n}<i></i></span><span class="r">${esc(nm)}</span></div>`;
  return `<div class="npf npf-c"><span>${esc(T.orgEn)} · ${esc(T.title)} · ${esc(nm)}${dr ? ' · ' + esc(dr) : ''}</span><span class="pg"><i></i><b>${two(i)}</b><small>/ ${two(n)}</small></span></div>`;
}
export function infoStripHTML(doc, theme){
  const T = tx(doc.lang), cv = doc.cover || {};
  const line = theme === 'a' ? 'border-top:1px solid #1E3932;border-bottom:1px solid #1E3932' : '';
  const sep = theme === 'a' ? 'border-left:1px solid #C9D6D0' : '';
  const cell = (lab, val, cls, s) => `<div style="${s || ''}"><span>${esc(lab)}</span><b${cls ? ` class="${cls}"` : ''}>${esc(val || '—')}</b></div>`;
  return `<div class="nis" style="${line}">${cell(T.term, cv.term, '', theme === 'a' ? 'padding-left:8px' : 'padding-left:0')}${cell(T.cls, [cv.cls, cv.grade].filter(Boolean).join(' · '), '', sep)}${cell(T.name, cv.name, 'nm', sep)}${cv.hr ? cell(T.hr, cv.hr, '', sep) : '<div></div>'}</div>`;
}
/* 마지막 «확인» 칸 — 학기 설정 › 출력 모양에서 켤 때만 */
export function signHTML(doc, theme, sign){
  if(!sign || !sign.on) return '';
  const T = tx(doc.lang), cv = doc.cover || {};
  const en = doc.lang === 'en';
  const line = en ? `This report reflects ${cv.term ? esc(cv.term) : 'this term'} of school life.` : `위와 같이 ${esc(cv.term || '이번 학기')} 학교생활을 평가합니다.`;
  const top = theme === 'a' ? 'border-top:1px solid #1E3932;box-shadow:0 3px 0 -2px #B08D3C inset;padding-top:16px;text-align:center' : 'border-top:2px solid #1E3932;padding-top:14px';
  const who = [[T.signHr, cv.hr], [sign.title || T.signHead, sign.principal]].filter(x => String(x[1] || '').trim());
  return `<div class="nsg" style="${top}"><div class="ln">${line}</div>${sign.date ? `<div class="dt">${esc(sign.date)}</div>` : ''}
    ${who.length ? `<div class="who">${who.map(([l, n]) => `<div><span>${esc(l)}</span><b>${esc(n)}</b><i>${esc(T.seal)}</i></div>`).join('')}</div>` : ''}</div>`;
}
export const CHROME_CSS = `
.np .npr{position:absolute;left:57px;right:57px;top:57px;height:22px;display:flex;align-items:center}
.np .npr-a{gap:12px;justify-content:center}
.np .npr-a i{flex:1 1 auto;height:1px;background:#B08D3C}
.np .npr-a b{font-family:${SERIF};font-size:13px;font-weight:900;color:#1E3932;letter-spacing:.12em}
.np .npr-c{justify-content:space-between;border-bottom:1px solid #1E3932;padding-bottom:8px;height:30px;top:51px}
.np .npr-c b{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;color:#1E3932;font-family:'Noto Sans KR','Malgun Gothic',sans-serif}
.np .npr-c b i{display:block;width:9px;height:9px;background:#00704A}
.np .npr-c span{font-size:10.5px;font-weight:700;color:#5A6560;letter-spacing:.05em;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:60%}
.np .npf{position:absolute;left:57px;right:57px;bottom:42px;height:18px;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;font-size:9.5px;font-weight:700;color:#6B7570;letter-spacing:.04em}
.np .npf-a{display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
.np .npf-a .pg{display:flex;align-items:center;gap:8px;color:#1E3932;font-size:11px}
.np .npf-a .pg i{display:block;width:5px;height:5px;background:#B08D3C;transform:rotate(45deg)}
.np .npf-a .r{text-align:right}
.np .npf-c{display:flex;justify-content:space-between;align-items:center}
.np .npf-c .pg{display:flex;align-items:center;gap:8px}
.np .npf-c .pg i{display:block;width:7px;height:7px;background:#B08D3C}
.np .npf-c .pg b{font-size:15px;font-weight:900;color:#00704A;letter-spacing:-.02em}
.np .npf-c .pg small{font-size:11px;font-weight:700;color:#9AA39F}
`;

/* ═══ 표지 ═══ */
export const COVER_CSS = `
.npc{position:absolute;inset:0;font-family:'Noto Sans KR','Malgun Gothic',sans-serif;color:#1F2320;overflow:hidden;background:#fff}
.npc *{box-sizing:border-box}
.npc .ab{position:absolute}
.npc .em{display:block;height:auto}
.npc .ir{display:grid;grid-template-columns:118px minmax(0,1fr);padding:13px 0;border-bottom:1px solid #D4E9E2;align-items:baseline}
.npc .ir:last-child{border-bottom:none}
.npc .ir span{font-size:12px;font-weight:700;letter-spacing:.2em;color:#00704A}
.npc .ir b{font-size:19px;font-weight:700;color:#1F2320;overflow-wrap:anywhere}
.npc .ir b.nm{font-size:27px;font-weight:900;color:#1E3932}
.npc .big{margin:42px 0 0;font-weight:900;font-size:132px;line-height:1.02;letter-spacing:-.04em;color:#1E3932;display:flex;flex-direction:column}
.npc.en .big{font-size:118px;letter-spacing:-.03em;font-family:'Noto Sans','Noto Sans KR',sans-serif}
.npc .lock{display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:6px}
.npc .lock b{font-size:15px;font-weight:900;letter-spacing:.18em;color:#1E3932;padding-left:.18em;white-space:nowrap}
.npc .lock small{font-size:9.5px;font-weight:700;letter-spacing:.3em;color:#8A6410;padding-left:.3em;white-space:nowrap}
.npc .srf{font-family:${SERIF}}
.npc .np2{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:baseline;padding:14px 4px 13px;border-bottom:1px solid #DCE6E1}
.npc .np2:last-child{border-bottom:none}
.npc .np2 span{font-size:12.5px;font-weight:700;letter-spacing:.22em;color:#00704A}
.npc .np2 b{font-family:${SERIF};font-size:20px;font-weight:700;color:#1F2320;text-align:right;overflow-wrap:anywhere}
.npc .inf{display:flex;flex-direction:column;gap:6px;padding:14px 16px 0;min-width:0}
.npc .inf span{font-size:11.5px;font-weight:700;letter-spacing:.2em;color:#00704A}
.npc .inf b{font-size:19px;font-weight:700;color:#1F2320;overflow-wrap:anywhere}
.npc .ix{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:20px}
.npc .ix div{display:flex;align-items:baseline;gap:10px;padding:9px 0 8px;border-bottom:1px solid #E3E1DA;min-width:0}
.npc .ix b{font-size:13px;font-weight:900;color:#00704A;letter-spacing:-.02em;width:20px;flex:0 0 auto}
.npc .ix span{font-size:13px;font-weight:500;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.npc .nm3{display:flex;flex-direction:column;gap:8px;padding:14px 18px 0;min-width:0}
.npc .nm3 span{font-size:11.5px;font-weight:700;letter-spacing:.22em;color:#00704A}
.npc .nm3 b{font-family:${SERIF};font-size:20px;font-weight:700;overflow-wrap:anywhere}
`;
function parts(doc){
  const cv = doc.cover || {}, en = doc.lang === 'en';
  const term = String(cv.term || '');
  let year = '', tn = '', tno = 0, m;
  if((m = /^(\d{4})\s*학년도\s*(.*)$/.exec(term))){ year = m[1]; tn = m[2].trim(); const k = /^(\d)\s*학기/.exec(tn); tno = k ? +k[1] : 0; }
  else if((m = /^(\d{4}) School Year\s*·\s*(.*)$/.exec(term))){ year = m[1]; tn = m[2].trim(); const k = /Semester (\d)/.exec(tn); tno = k ? +k[1] : 0; }
  const vert = year ? (en ? `${year} · ${tn}` : `${year}학년도 · ${tn}`) : term;
  return { cv, en, term, year, tn, tno, vert, clsg: [cv.cls, cv.grade].filter(Boolean).join(' · '), T: tx(doc.lang) };
}
const lockup = (emb, T, w) => `<div class="lock">${emb ? `<img class="em" src="${esc(emb)}" alt="" style="width:${w || 84}px">` : ''}<b>${esc(T === TX.en ? T.orgEn : T.org)}</b><small>${esc(T.heb)}</small></div>`;
function infoRows(p, withHr){
  const { cv, T } = p;
  return `<div style="border-top:2px solid #1E3932">
    <div class="ir"><span>${esc(T.term)}</span><b>${esc(p.term)}</b></div>
    <div class="ir"><span>${esc(T.cls)}</span><b>${esc(p.clsg)}</b></div>
    ${withHr && cv.hr ? `<div class="ir"><span>${esc(T.hr)}</span><b>${esc(cv.hr)}</b></div>` : ''}
    <div class="ir"><span>${esc(T.name)}</span><b class="nm">${esc(cv.name || '')}</b></div></div>`;
}
const bigSpans = T => `<span>${esc(T.big[0])}</span><span style="color:#00704A">${esc(T.big[1])}</span><span>${esc(T.big[2])}</span>`;
const big = T => `<h1 class="big">${bigSpans(T)}</h1>`;
const leadLine = T => `<div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:3px;background:#00704A"></div><div style="font-size:13px;font-weight:700;letter-spacing:.34em;color:#00704A">${esc(T.lead)}</div></div>`;
const subLine = T => `<div style="margin-top:26px;display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span style="font-size:17px;font-weight:500;letter-spacing:.08em;color:#5A6560">${esc(T.en1)}</span><span style="width:5px;height:5px;background:#B08D3C"></span><span style="font-size:17px;font-weight:500;letter-spacing:.08em;color:#5A6560">${esc(T.en2)}</span></div>`;
/* 최초 C 계열 본문 (띠 오른쪽) */
function cBody(p, emb, left, withHr){
  return `<div class="ab" style="left:${left}px;top:0;right:0;bottom:0;padding:104px 72px 76px 70px;display:flex;flex-direction:column">
    ${leadLine(p.T)}${big(p.T)}${subLine(p.T)}
    <div style="margin-top:auto;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:34px">${infoRows(p, withHr)}${lockup(emb, p.T)}</div></div>`;
}
export function coverHTML(doc, key, opt){
  opt = opt || {};
  const p = parts(doc), emb = opt.emblem || '', T = p.T, cv = p.cv;
  const cls = `npc npc-${key}${p.en ? ' en' : ''}`;
  if(key === 'c0'){
    return `<div class="${cls}"><div class="ab" style="left:0;top:0;bottom:0;width:104px;background:#1E3932;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:64px 0 56px">
      <div style="writing-mode:vertical-rl;font-size:14px;font-weight:700;letter-spacing:.5em;color:#D4E9E2">${esc(p.vert)}</div><div style="width:24px;height:24px;background:#D2B36A"></div></div>
      <div class="ab" style="left:104px;top:0;right:0;bottom:0;padding:96px 72px 64px 72px;display:flex;flex-direction:column">${leadLine(T)}<h1 class="big" style="margin-top:40px">${bigSpans(T)}</h1>${subLine(T)}
      <div style="margin-top:auto;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:32px">${infoRows(p, false)}${lockup(emb, T)}</div></div></div>`;
  }
  if(key === 'cc1'){
    return `<div class="${cls}"><div class="ab" style="left:45px;top:45px;bottom:45px;width:96px;background:#1E3932;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:46px 0 40px">
      <div style="writing-mode:vertical-rl;font-size:14px;font-weight:700;letter-spacing:.5em;color:#D4E9E2">${esc(p.vert)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:10px"><div style="width:1px;height:70px;background:#D2B36A"></div><div style="width:22px;height:22px;background:#D2B36A"></div></div></div>
      ${cBody(p, emb, 141, true)}</div>`;
  }
  if(key === 'cc2'){
    return `<div class="${cls}"><div class="ab" style="left:45px;top:45px;bottom:45px;width:14px;background:#1E3932"></div><div class="ab" style="left:66px;top:45px;bottom:45px;width:1px;background:#B08D3C"></div>
      <div class="ab" style="left:82px;top:96px;writing-mode:vertical-rl;font-size:14px;font-weight:700;letter-spacing:.5em;color:#1E3932">${esc(p.vert)}</div>
      <div class="ab" style="left:86px;bottom:96px;width:18px;height:18px;background:#B08D3C"></div>${cBody(p, emb, 141, true)}</div>`;
  }
  if(key === 'cc3'){
    return `<div class="${cls}"><div class="ab" style="left:45px;top:45px;bottom:45px;width:96px;background:#1E3932;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:46px 0 40px">
      <div style="writing-mode:vertical-rl;font-size:13px;font-weight:700;letter-spacing:.5em;color:#D4E9E2;max-height:430px;overflow:hidden">${esc(p.vert)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px"><div style="display:flex;gap:6px;align-items:flex-start;max-height:440px;overflow:hidden">
        <div style="writing-mode:vertical-rl;font-size:12.5px;font-weight:700;letter-spacing:.3em;color:#D2B36A">${esc(p.clsg)}</div>
        <div style="writing-mode:vertical-rl;font-size:30px;font-weight:900;letter-spacing:.2em;color:#FFFFFF">${esc(cv.name || '')}</div></div>
        <div style="width:22px;height:22px;background:#D2B36A"></div></div></div>
      ${cBody(p, emb, 141, false)}</div>`;
  }
  if(key === 'af'){
    const cb = (pos, bw) => `<div class="ab" style="${pos};width:26px;height:26px;border:0 solid #1E3932;${bw}"></div>`;
    return `<div class="${cls}"><div class="ab" style="left:45px;top:45px;right:45px;bottom:45px;border:1px solid #B08D3C"></div>
      <div class="ab" style="left:393px;top:41px;width:8px;height:8px;background:#fff;border:1px solid #B08D3C;transform:rotate(45deg)"></div>
      <div class="ab" style="left:393px;bottom:41px;width:8px;height:8px;background:#fff;border:1px solid #B08D3C;transform:rotate(45deg)"></div>
      ${cb('left:56px;top:56px', 'border-left-width:1.5px;border-top-width:1.5px')}${cb('right:56px;top:56px', 'border-right-width:1.5px;border-top-width:1.5px')}
      ${cb('left:56px;bottom:56px', 'border-left-width:1.5px;border-bottom-width:1.5px')}${cb('right:56px;bottom:56px', 'border-right-width:1.5px;border-bottom-width:1.5px')}
      <div class="ab" style="left:0;top:0;width:794px;height:1123px;padding:116px 110px 104px;display:flex;flex-direction:column;align-items:center">
        <div style="display:flex;align-items:center;gap:14px"><div style="width:36px;height:1px;background:#B08D3C"></div><span class="srf" style="font-size:14px;font-weight:700;letter-spacing:.3em;color:#1E3932;padding-left:.3em">${esc(p.vert)}</span><div style="width:36px;height:1px;background:#B08D3C"></div></div>
        <div style="margin-top:54px;width:150px;height:150px;border-radius:50%;border:1px solid #B08D3C;display:flex;align-items:center;justify-content:center;position:relative"><div class="ab" style="inset:6px;border-radius:50%;border:1px solid #D4E9E2"></div>${emb ? `<img class="em" src="${esc(emb)}" alt="" style="width:90px;position:relative">` : ''}</div>
        <div style="margin-top:58px;width:100%;display:flex;flex-direction:column;align-items:center">
          <div style="width:100%;display:flex;flex-direction:column;gap:3px"><div style="height:1px;background:#1E3932"></div><div style="height:1px;background:#B08D3C"></div></div>
          <h1 class="srf" style="margin:24px 0 0;font-weight:900;font-size:${p.en ? 60 : 68}px;line-height:1.12;color:#1E3932;text-align:center">${esc(T.title)}</h1>
          <div style="margin-top:14px;font-size:15px;font-weight:700;letter-spacing:${p.en ? '.3em' : '.6em'};color:#5A6560;padding-left:.6em">${esc(T.report)}</div>
          <div style="margin-top:8px;font-size:10.5px;font-weight:700;letter-spacing:.42em;color:#8A6410;padding-left:.42em">REPORT ON SCHOOL LIFE</div>
          <div style="margin-top:24px;width:100%;display:flex;flex-direction:column;gap:3px"><div style="height:1px;background:#B08D3C"></div><div style="height:1px;background:#1E3932"></div></div></div>
        <div style="margin-top:62px;width:440px;border-top:1px solid #1E3932;border-bottom:1px solid #1E3932">
          <div class="np2"><span>${esc(T.cls)}</span><b>${esc(p.clsg)}</b></div>
          <div class="np2"><span>${esc(T.name)}</span><b style="font-size:28px;font-weight:900;color:#1E3932">${esc(cv.name || '')}</b></div>
          ${cv.hr ? `<div class="np2"><span>${esc(T.hr)}</span><b>${esc(cv.hr)}</b></div>` : ''}</div>
        <div style="margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:8px">
          <div style="display:flex;align-items:center;gap:12px"><div style="width:28px;height:1px;background:#B08D3C"></div><div style="font-size:19px;font-weight:900;letter-spacing:.24em;color:#1E3932;padding-left:.24em">${esc(p.en ? T.orgEn : T.org)}</div><div style="width:28px;height:1px;background:#B08D3C"></div></div>
          <div style="font-size:10.5px;font-weight:700;letter-spacing:.38em;color:#8A6410;padding-left:.38em">${esc(T.heb)}</div></div></div></div>`;
  }
  if(key === 'cf'){
    const items = (opt.contents || []).slice(0, 9);
    const sem = p.tno ? `<div style="display:flex;gap:18px;padding-bottom:4px;font-size:12.5px;font-weight:700;color:#5A6560">
        <span style="display:flex;align-items:center;gap:7px${p.tno === 1 ? ';color:#1E3932' : ''}"><i style="display:block;width:10px;height:10px;${p.tno === 1 ? 'background:#00704A' : 'border:1.5px solid #9DB5AA'}"></i>${esc(T.s1)}</span>
        <span style="display:flex;align-items:center;gap:7px${p.tno === 2 ? ';color:#1E3932' : ''}"><i style="display:block;width:10px;height:10px;${p.tno === 2 ? 'background:#00704A' : 'border:1.5px solid #9DB5AA'}"></i>${esc(T.s2)}</span></div>` : '';
    return `<div class="${cls}"><div class="ab" style="left:0;top:0;width:794px;height:1123px;padding:72px 72px 64px;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:space-between;align-items:center"><span style="display:flex;align-items:center;gap:10px;font-size:12px;font-weight:700;letter-spacing:.3em;color:#00704A"><i style="display:block;width:10px;height:10px;background:#00704A"></i>${esc(T.report)}</span><span style="font-size:12px;font-weight:700;letter-spacing:.3em;color:#5A6560">DANIEL AMATZ</span></div>
      <div style="margin-top:12px;height:1px;background:#1E3932"></div>
      <div style="margin-top:70px;font-weight:900;font-size:228px;line-height:.9;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:2px #00704A;margin-left:-8px;font-family:'Noto Sans KR',sans-serif">${esc(p.year || '')}</div>
      <div style="margin-top:16px;display:flex;justify-content:space-between;align-items:flex-end"><div style="display:flex;flex-direction:column;gap:8px"><span style="width:56px;height:4px;background:#B08D3C"></span><span style="font-size:44px;font-weight:900;line-height:1;color:#1E3932;letter-spacing:-.02em">${esc(p.tn || p.term)}</span></div>${sem}</div>
      <h1 style="margin:52px 0 0;display:flex;align-items:baseline;gap:6px;font-weight:900;font-size:${p.en ? 70 : 80}px;line-height:1.1;letter-spacing:-.035em;color:#1E3932">${esc(T.title)}<i style="display:block;width:14px;height:14px;background:#00704A;flex:0 0 auto"></i></h1>
      <div style="margin-top:12px;font-size:16px;font-weight:500;letter-spacing:.06em;color:#5A6560">${esc(p.en ? 'Daniel Amatz — Student Progress Report' : 'My School Life — Student Progress Report')}</div>
      ${items.length ? `<div style="margin-top:50px"><div style="font-size:11px;font-weight:800;letter-spacing:.24em;color:#8A6410;padding-bottom:6px;border-bottom:1px solid #1E3932">${esc(T.inside)}</div>
        <div class="ix">${items.map((x, i) => `<div><b>${two(i + 1)}</b><span>${esc(x)}</span></div>`).join('')}</div></div>` : ''}
      <div style="margin-top:auto;display:grid;grid-template-columns:178px 178px 150px minmax(0,1fr);border-top:2px solid #1E3932">
        <div class="inf" style="padding-left:0"><span>${esc(T.term)}</span><b>${esc(p.term)}</b></div>
        <div class="inf" style="border-left:1px solid #D4E9E2"><span>${esc(T.cls)}</span><b>${esc(p.clsg)}</b></div>
        <div class="inf" style="border-left:1px solid #D4E9E2"><span>${esc(T.hr)}</span><b>${esc(cv.hr || '—')}</b></div>
        <div class="inf" style="border-left:1px solid #D4E9E2;padding-right:0"><span>${esc(T.name)}</span><b style="font-size:28px;font-weight:900;color:#1E3932">${esc(cv.name || '')}</b></div></div>
      <div style="margin-top:40px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px">${emb ? `<img class="em" src="${esc(emb)}" alt="" style="width:44px">` : ''}<span style="font-size:16px;font-weight:900;letter-spacing:.2em;color:#1E3932">${esc(p.en ? T.orgEn : T.org)}</span><span style="font-size:10px;font-weight:700;letter-spacing:.32em;color:#8A6410">${esc(T.heb)}</span></div>
        <span style="display:flex;gap:4px"><i style="display:block;width:10px;height:10px;background:#D4E9E2"></i><i style="display:block;width:10px;height:10px;background:#00704A"></i><i style="display:block;width:10px;height:10px;background:#B08D3C"></i></span></div></div></div>`;
  }
  if(key === 'acf'){
    return `<div class="${cls}"><div class="ab" style="left:96px;top:96px;bottom:96px;width:2px;background:#1E3932"></div><div class="ab" style="left:102px;top:96px;bottom:96px;width:1px;background:#B08D3C"></div>
      <div class="ab" style="left:92px;top:92px;width:10px;height:10px;background:#00704A"></div>
      <div class="ab srf" style="left:58px;top:120px;writing-mode:vertical-rl;font-size:12.5px;font-weight:700;letter-spacing:.36em;color:#1E3932;max-height:620px;overflow:hidden">${esc(p.vert)} · ${esc(T.report)}</div>
      <div class="ab" style="left:62px;bottom:112px;writing-mode:vertical-rl;font-size:9.5px;font-weight:700;letter-spacing:.36em;color:#8A6410">DANIEL AMATZ</div>
      <div class="ab" style="left:150px;top:108px;right:84px;bottom:96px;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:14px">${emb ? `<img class="em" src="${esc(emb)}" alt="" style="width:54px">` : ''}<div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:16px;font-weight:900;letter-spacing:.2em;color:#1E3932">${esc(p.en ? T.orgEn : T.org)}</span><span style="font-size:9.5px;font-weight:700;letter-spacing:.34em;color:#8A6410">${esc(T.heb)}</span></div></div>
          <span style="display:flex;gap:4px"><i style="display:block;width:9px;height:9px;background:#D4E9E2"></i><i style="display:block;width:9px;height:9px;background:#00704A"></i><i style="display:block;width:9px;height:9px;background:#B08D3C"></i></span></div>
        <div style="margin-top:150px;font-size:13px;font-weight:700;letter-spacing:.42em;color:#8A6410">${esc(T.report)}</div>
        <h1 class="srf" style="margin:18px 0 0;font-weight:900;color:#1E3932;display:flex;flex-direction:column;line-height:1.12">${p.en ? `<span style="font-size:62px">My School</span><span style="font-size:100px">Life</span>` : `<span style="font-size:62px">나의</span><span style="font-size:108px;letter-spacing:-.02em">학교생활</span>`}</h1>
        <div style="margin-top:22px;display:flex;align-items:center;gap:16px"><div style="flex:1 1 auto;height:1px;background:#B08D3C"></div><span class="srf" style="font-size:17px;font-weight:500;letter-spacing:.12em;color:#00704A">${esc(p.en ? 'Student Progress Report' : 'My School Life')}</span></div>
        <div style="margin-top:70px;display:flex;align-items:flex-end;gap:18px"><span style="font-size:72px;font-weight:900;line-height:.9;letter-spacing:-.04em;color:#00704A">${esc(p.year || '')}</span><span style="display:flex;flex-direction:column;gap:8px;padding-bottom:4px"><i style="display:block;width:40px;height:3px;background:#B08D3C"></i><b style="font-size:30px;font-weight:900;line-height:1;color:#1E3932">${esc(p.tn || '')}</b></span></div>
        <div style="margin-top:auto;display:grid;grid-template-columns:190px minmax(0,1fr) 130px;border-top:1px solid #1E3932">
          <div class="nm3" style="padding-left:0"><span>${esc(T.cls)}</span><b>${esc(p.clsg)}</b></div>
          <div class="nm3" style="border-left:1px solid #DCE6E1"><span>${esc(T.name)}</span><b style="font-size:34px;font-weight:900;color:#1E3932;line-height:1">${esc(cv.name || '')}</b></div>
          <div class="nm3" style="border-left:1px solid #DCE6E1;padding-right:0"><span>${esc(T.hr)}</span><b>${esc(cv.hr || '—')}</b></div></div></div></div>`;
  }
  return '';
}
/* 표지 목차 (3차 B) — 문서 블록 이름 */
export function contentsOf(doc, KEY_HEAD){
  const en = doc.lang === 'en';
  return (doc.blocks || []).filter(b => b.k !== 'sec').map(b => {
    const h = b.h || {};
    if(h.t === 'subj') return h.name || '';
    if(h.t === 'hr') return h.name || (en ? KEY_HEAD.hr[1] : '담임평가');
    if(h.t === 'fixed') return (h.x || (KEY_HEAD[h.key] || ['', ''])[en ? 1 : 0]).replace(/\s*\(.*\)\s*$/, '');
    return splitTitle(h.x, en).t;
  }).filter(Boolean);
}
/* 쓰는 글꼴 — 명조가 들어가는 모양이면 미리 받아 둔다 (PDF 그림에 빠지지 않게) */
export async function fontsFor(cover, inner){
  if(typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
  const need = [];
  if(['af', 'acf'].includes(cover) || inner === 'a') need.push("900 20px 'Noto Serif KR'", "700 20px 'Noto Serif KR'", "500 20px 'Noto Serif KR'");
  need.push("900 20px 'Noto Sans KR'", "800 20px 'Noto Sans KR'", "700 20px 'Noto Sans KR'", "500 20px 'Noto Sans KR'");
  try{ await Promise.all(need.map(f => document.fonts.load(f, '나의 학교생활 가나다 2026'))); }catch(e){}
}
