/* ═══════════════════════════════════════════════════════════
   📝 minutes-core.js — 회의록 공용 부품 (v-93)
   · 화면(목록·문서) · 출력(인쇄·PDF) · 워드(.docx)가 «같은 모양»을 쓰도록
     번호 매기기 · 문서 그리기 · 고친 곳 비교 · 찾기를 한곳에 모았습니다.
   · Firebase를 쓰지 않는 순수 함수만 둡니다 (시험하기 쉽게).
   ═══════════════════════════════════════════════════════════ */

/* ── 기관 — 'da' = DA전체 (모든 기관 교직원이 함께 드나드는 회의록) ── */
export const MORG = { daniel:'다니엘 아마츠', jihyebit:'지혜빛 선교원', da:'DA전체' };
export const MORG_SHORT = { daniel:'다니엘', jihyebit:'지혜빛', da:'DA전체' };
export const MORDER = ['daniel', 'jihyebit', 'da'];
export const MCOLOR = { daniel:'#00704A', jihyebit:'#B7791F', da:'#2B5797' };

/* 처음 설정값 — 회의록 쓰는 화면에서 바로 넣고 뺄 수 있다 (minutesConfig/types) */
export const OLD_TYPES = ['훈련센터 회의'];
export const DEF_TYPES = {
  daniel:   ['다니엘 아마츠 학교 회의'],                  // (v-95) «훈련센터»는 더 쓰지 않음 — 예전 회의록 제목은 그대로
  jihyebit: ['지혜빛 선교원 교사 회의'],
  da:       ['DA 전체 회의'],
};
export const DEF_ABS = ['출장', '수업', '병가', '개인 사정'];
export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const STATUS = {
  todo:  { l:'진행 전', c:'#5A6560', bg:'#EEF0EE' },
  doing: { l:'진행 중', c:'#B45309', bg:'#FEF3C7' },
  done:  { l:'완료',    c:'#00704A', bg:'#E8F3EF' },
};

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* ── 날짜 · 학기 ── */
export const pad2 = n => String(n).padStart(2, '0');
export function todayStr(d){ d = d || new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
export function dowOf(ds){ const [y,m,d] = String(ds).split('-').map(Number); return new Date(y, (m||1)-1, d||1).getDay(); }
/* 2~7월 = 1학기, 8~12월 = 2학기, 1월 = 지난해 2학기(겨울 방학) */
export function semOf(ds){
  const y = +String(ds).slice(0,4), m = +String(ds).slice(5,7);
  if(!y || !m) return '';
  if(m >= 2 && m <= 7) return `${y}-1`;
  if(m >= 8) return `${y}-2`;
  return `${y-1}-2`;
}
export function semLabel(s){ if(!s) return '전체 학기'; const [y,t] = String(s).split('-'); return `${y} ${t}학기`; }
/* 지금 학기부터 2026 1학기까지 (이 회의록 탭이 생긴 학기) */
export function semList(cur, first){
  first = first || '2026-1';
  const out = []; let [y, t] = String(cur).split('-').map(Number);
  const [fy, ft] = first.split('-').map(Number);
  let guard = 0;
  while((y > fy || (y === fy && t >= ft)) && guard++ < 40){
    out.push(`${y}-${t}`);
    if(t === 2) t = 1; else { t = 2; y--; }
  }
  return out;
}
export function fmtLong(ds, time){
  if(!ds) return '';
  const [y,m,d] = ds.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일 ${WD[dowOf(ds)]}요일${time ? ' ' + time : ''}`;
}
export function fmtMD(ds, withDow){
  if(!ds) return '';
  const [, m, d] = ds.split('-').map(Number);
  return `${m}/${d}${withDow === false ? '' : '(' + WD[dowOf(ds)] + ')'}`;
}
/* (v-101) 올해가 아닌 회의는 해를 붙인다 — «24년 3/4(월)» (전체 학기로 찾을 때 몇 년도 것인지 바로) */
export function fmtMDY(ds, withDow, today){
  const s = fmtMD(ds, withDow), y = String(ds || '').slice(0, 4), ty = String(today || todayStr()).slice(0, 4);
  return s && /^\d{4}$/.test(y) && y !== ty ? `${y.slice(2)}년 ${s}` : s;
}
export function fmtYMD(ds){
  if(!ds) return '';
  const [y, m, d] = String(ds).split('-').map(Number);
  return `${y}.${m}.${d}(${WD[dowOf(ds)]})`;
}
export function fmtStamp(ms){
  if(!ms) return '';
  const d = new Date(ms);
  return `${d.getMonth()+1}/${d.getDate()} (${WD[d.getDay()]}) ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
export function tsMs(v){
  if(!v) return 0;
  if(typeof v === 'number') return v;
  if(typeof v.toMillis === 'function') return v.toMillis();
  if(v.seconds != null) return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  const t = Date.parse(v); return isNaN(t) ? 0 : t;
}
export function dueInfo(due, today){
  if(!due) return null;
  today = today || todayStr();
  const a = Date.parse(due + 'T00:00:00'), b = Date.parse(today + 'T00:00:00');
  const dd = Math.round((a - b) / 86400000);
  return { dd, label: dd === 0 ? '오늘까지' : dd > 0 ? `D-${dd}` : `${-dd}일 지남`, over: dd < 0, soon: dd >= 0 && dd <= 2 };
}

/* 회의록 제목 — «훈련센터 회의» → «훈련센터 회의록» */
export function titleOf(m){
  if(m && m.title) return m.title;
  const t = (m && m.type) || '';
  if(!t) return '회의록';
  return /회의$/.test(t) ? t + '록' : /회의록$/.test(t) ? t : t + ' 회의록';
}

/* ── 글 · 번호 ── */
const ENT = { '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'", '&nbsp;':' ' };
export function textOf(html){
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENT[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
const ROMAN_T = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
export function roman(n){ let s = ''; for(const [v,c] of ROMAN_T) while(n >= v){ s += c; n -= v; } return s; }
/* 지금 쓰시는 번호 그대로: 주제 1. → (1) → 1) → I. → (I) */
export function lvLabel(lv, n){
  return lv === 1 ? `(${n})` : lv === 2 ? `${n})` : lv === 3 ? `${roman(n)}.` : `(${roman(n)})`;
}
export const clampLv = lv => Math.max(1, Math.min(4, +lv || 1));
const BULLET = /^\s*[-·•*※➔→▶▷◦○●■□✓✔☞]/;
export const isBullet = html => BULLET.test(textOf(html));
export function numberBody(body){
  const c = [0,0,0,0,0];
  return (body || []).map(b => {
    if(!b || b.k !== 'l') return '';
    const lv = clampLv(b.lv);
    if(isBullet(b.h)) return '';
    c[lv]++;
    for(let j = lv + 1; j <= 4; j++) c[j] = 0;
    return lvLabel(lv, c[lv]);
  });
}

/* ── 붙여 넣은 글에서 번호를 읽어 단계로 (Pages·한글·워드에서 복사해 와도 그대로) ── */
const PAT = [
  { re:/^\s*(\d{1,2})\.\s+/,          lv:0 },   // 1. 주제
  { re:/^\s*\((\d{1,2})\)\s*/,        lv:1 },   // (1)
  { re:/^\s*(\d{1,2})\)\s*/,          lv:2 },   // 1)
  { re:/^\s*([IVX]{1,5})\.\s*/,       lv:3 },   // I.
  { re:/^\s*\(([IVX]{1,5})\)\s*/,     lv:4 },   // (I)
  { re:/^\s*([①-⑳])\s*/,             lv:4 },
];
export function parseOutline(text){
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const topics = []; let cur = { title:'', lines:[] }; let lastLv = 1;
  for(const raw of lines){
    if(!raw.trim()){ continue; }
    let hit = null;
    for(const p of PAT){ const m = p.re.exec(raw); if(m){ hit = { lv:p.lv, rest: raw.slice(m[0].length) }; break; } }
    if(hit && hit.lv === 0){
      if(cur.title || cur.lines.length) topics.push(cur);
      cur = { title: hit.rest.trim(), lines:[] }; lastLv = 1; continue;
    }
    if(hit){ lastLv = hit.lv; cur.lines.push({ lv: hit.lv, t: hit.rest.trim() }); continue; }
    const ind = /^(\t+| {4,})/.exec(raw);
    const lv = ind ? clampLv((ind[1].includes('\t') ? ind[1].length : Math.floor(ind[1].length / 4)) + 1) : lastLv;
    cur.lines.push({ lv, t: raw.trim() });
  }
  if(cur.title || cur.lines.length) topics.push(cur);
  return topics;
}
/* 탭으로 나뉜 글(엑셀·Numbers 칸 복사의 글자판) → 표 */
export function tsvToTable(text){
  const rows = String(text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n').map(r => r.split('\t'));
  if(rows.length < 1 || Math.max(...rows.map(r => r.length)) < 2) return '';
  const w = Math.max(...rows.map(r => r.length));
  return '<table>' + rows.map((r, i) => '<tr>' + Array.from({ length:w }, (_, j) =>
    i === 0 ? `<th>${esc(r[j] || '')}</th>` : `<td>${esc(r[j] || '')}</td>`).join('') + '</tr>').join('') + '</table>';
}

/* ── 출석 ── */
export function attSplit(m){
  const att = (m && m.att) || {}, names = (m && m.attNames) || {};
  const on = [], off = [];
  for(const [uid, a] of Object.entries(att)){
    const nm = names[uid] || (a && a.n) || '';
    if(!a) continue;
    if(a.s === 'o') on.push({ uid, name:nm });
    else if(a.s === 'x') off.push({ uid, name:nm, r: a.r || '' });
  }
  const ko = (a, b) => a.name.localeCompare(b.name, 'ko');
  on.sort(ko); off.sort(ko);
  return { on, off };
}

/* ── 세기 ── */
export function countOf(m){
  let dec = 0, task = 0, tbl = 0, img = 0, doc = 0;
  for(const t of (m && m.topics) || []){
    dec += (t.dec || []).filter(d => textOf(d.h).trim()).length;
    task += (t.tasks || []).filter(k => textOf(k.h).trim()).length;
    for(const b of t.body || []){
      if(b.k === 'tbl') tbl++;
      else if(b.k === 'img') img++;
      else if(b.k === 'pdf' || b.k === 'file' || b.k === 'link') doc++;
    }
  }
  return { dec, task, tbl, img, doc };
}
export const taskKey = (mid, kid) => `${mid}_${kid}`;

/* ═══ 문서 그리기 — 지금 회의록 모양 그대로 (날짜 · 노란 주제 띠 · 번호 개요) ═══
   ctx = { interactive, tasks:{key:doc}, cmt:{'t:<id>':n,'k:<id>':n}, files:{fid:dataURL},
           me, canStatus:fn(task)→bool, hl:'찾는 말', print:bool, opts:{att,img,tbl} } */
/* 찾는 말 칠하기 — 글자(엔티티를 푼 뒤)에서 찾고 다시 감싼다 */
export function hlText(raw, q){
  const words = String(q || '').trim().split(/\s+/).filter(Boolean);
  if(!words.length) return esc(raw);
  const re = new RegExp('(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return String(raw).split(re).map((part, i) => i % 2 ? `<em class="md-hit">${esc(part)}</em>` : esc(part)).join('');
}
function hl(html, q){
  if(!q || !String(q).trim()) return html;
  return String(html).replace(/(^|>)([^<]+)/g, (all, a, txt) => a + hlText(textOf(txt), q));
}
function fileIcon(name){
  const e = String(name || '').toLowerCase().split('.').pop();
  return e === 'pdf' ? '📕' : ['hwp','hwpx'].includes(e) ? '📘' : ['doc','docx','pages'].includes(e) ? '📄'
    : ['xls','xlsx','numbers','csv'].includes(e) ? '📗' : ['ppt','pptx','key'].includes(e) ? '📙'
    : ['zip'].includes(e) ? '🗜️' : '📎';
}
/* 🔒 링크는 http(s)만 · 그림은 data:image만 (javascript: 등 차단) */
export const safeUrl = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '';
export const okSrc = s => /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(s || ''));
const num = v => Math.max(0, +v || 0);
export const fmtSize = n => !n ? '' : n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB';
function hostOf(u){ try{ return new URL(u).hostname.replace(/^www\./, ''); }catch(e){ return ''; } }

export function renderBlock(b, label, ctx){
  ctx = ctx || {};
  const q = ctx.hl || '';
  const clean = ctx.clean || (h => h), cleanTbl = ctx.cleanTbl || (h => h);
  if(b.k === 'l'){
    const lv = clampLv(b.lv);
    return `<div class="md-l md-l${lv}"><i>${esc(label)}</i><span>${hl(clean(b.h || ''), q)}</span></div>`;
  }
  if(b.k === 'tbl'){
    if(ctx.opts && ctx.opts.tbl === false) return '';
    return `<div class="md-tbl">${cleanTbl(b.h || '')}</div>${b.cap ? `<div class="md-cap">${esc(b.cap)}</div>` : ''}`;
  }
  if(b.k === 'img'){
    if(ctx.opts && ctx.opts.img === false) return '';
    const src0 = (ctx.files || {})[b.fid], src = okSrc(src0) ? src0 : '';
    return `<figure class="md-img"${ctx.interactive ? ` data-act="img" data-fid="${esc(b.fid)}"` : ''}>
      ${src ? `<img src="${src}" alt="${esc(b.cap || '사진')}">` : `<div class="md-ph" data-fid="${esc(b.fid)}">사진 불러오는 중…</div>`}
      ${b.cap ? `<figcaption>${esc(b.cap)}</figcaption>` : ''}</figure>`;
  }
  if(b.k === 'pdf'){
    if(ctx.opts && ctx.opts.img === false) return `<div class="md-file"><span class="md-fi">📕</span><b>${esc(b.name || 'PDF')}</b><small>${num(b.pages) || (b.fids||[]).length}쪽</small></div>`;
    const fids = b.fids || [];
    const showAll = ctx.print || (ctx.open && ctx.open[b.id]);
    const pages = (showAll ? fids : fids.slice(0, 1)).map((fid, i) => {
      const src0 = (ctx.files || {})[fid], src = okSrc(src0) ? src0 : '';
      return `<figure class="md-pg"${ctx.interactive ? ` data-act="img" data-fid="${esc(fid)}"` : ''}>${src ? `<img src="${src}" alt="${i+1}쪽">`
        : `<div class="md-ph" data-fid="${esc(fid)}">${i+1}쪽 불러오는 중…</div>`}</figure>`;
    }).join('');
    const more = !showAll && fids.length > 1 && ctx.interactive
      ? `<button class="md-more" data-act="pdfall" data-bid="${esc(b.id || '')}">${fids.length}쪽 모두 펼치기 ▾</button>` : '';
    const orig = b.fid ? `<button class="md-orig" data-act="file" data-fid="${esc(b.fid)}" data-name="${esc(b.name || '')}">원본 받기</button>`
      : safeUrl(b.link) ? `<a class="md-orig" href="${esc(safeUrl(b.link))}" target="_blank" rel="noopener">원본 열기 ›</a>` : '';
    return `<div class="md-pdf"><div class="md-pdfh"><span class="md-fi">📕</span><b>${esc(b.name || 'PDF')}</b>
      <small>${fids.length}쪽</small>${ctx.print ? '' : orig}</div>${pages}${more}</div>`;
  }
  if(b.k === 'file'){
    const act = ctx.print ? '' : b.fid ? `<button class="md-orig" data-act="file" data-fid="${esc(b.fid)}" data-name="${esc(b.name || '')}">받기</button>`
      : safeUrl(b.link) ? `<a class="md-orig" href="${esc(safeUrl(b.link))}" target="_blank" rel="noopener">열기 ›</a>` : '';
    return `<div class="md-file"><span class="md-fi">${fileIcon(b.name)}</span><b>${esc(b.name || '문서')}</b>
      <small>${esc(fmtSize(b.size))}${b.link && !b.fid ? ' · 링크' : ''}</small>${act}</div>`;
  }
  if(b.k === 'link'){
    const u = safeUrl(b.url);
    const h = hostOf(u);
    const drive = /google\.com$/.test(h) || /drive|docs/.test(h);
    const inner = `<span class="md-fi">${drive ? '🗂️' : '🔗'}</span><b>${esc(b.title || b.url)}</b><small>${esc(u ? (drive ? '구글 드라이브' : h) : '열 수 없는 주소')}</small>`;
    return u ? `<a class="md-link" href="${esc(u)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="md-link">${inner}</div>`;
  }
  return '';
}
/* 사진이 이어지면 한 줄에 나란히 */
/* 지난 회의에서 가져온 줄(from)은 회색 상자로 묶고, 그 뒤 새로 쓴 줄 앞에 «이번 회의»를 붙인다 */
export function renderBody(body, ctx){
  const labels = numberBody(body);
  const segs = [];
  (body || []).forEach((b, i) => {
    const f = b.from || '';
    const last = segs[segs.length - 1];
    if(last && last.from === f) last.items.push([b, i]); else segs.push({ from: f, items: [[b, i]] });
  });
  const hasPrev = segs.some(g => g.from);
  let out = '';
  segs.forEach((g, gi) => {
    let inner = '', imgs = '';
    for(const [b, i] of g.items){
      if(b.k === 'img' && !(ctx && ctx.opts && ctx.opts.img === false)){ imgs += renderBlock(b, '', ctx); continue; }
      if(imgs){ inner += `<div class="md-imgs">${imgs}</div>`; imgs = ''; }
      inner += renderBlock(b, labels[i], ctx);
    }
    if(imgs) inner += `<div class="md-imgs">${imgs}</div>`;
    if(g.from) out += `<div class="md-prev"><div class="md-prev-h">↩ ${esc(fmtMDY(g.from))} 회의에서 이어진 내용</div>${inner}</div>`;
    else out += (hasPrev && gi > 0 ? `<div class="md-new-h">✎ 이번 회의</div>` : '') + inner;
  });
  return out;
}
export function statusChip(st, can, key){
  const s = STATUS[st] || STATUS.todo;
  return can
    ? `<button class="md-st" data-act="kstat" data-kid="${esc(key)}" style="color:${s.c};background:${s.bg}">${s.l} ▾</button>`
    : `<span class="md-st" style="color:${s.c};background:${s.bg}">${s.l}</span>`;
}
export function renderTopic(m, t, i, ctx){
  ctx = ctx || {};
  const q = ctx.hl || '';
  const tk = ctx.tasks || {};
  const cm = ctx.cmt || {};
  const dec = (t.dec || []).filter(d => textOf(d.h).trim());
  const tasks = (t.tasks || []).filter(k => textOf(k.h).trim());
  const tc = num(cm['t:' + t.id]);
  const thr = t.thrFrom ? `<span class="md-thr">↩ ${esc(fmtMDY(t.thrFrom))} 회의에서 이어짐</span>` : '';
  let h = `<section class="md-t" id="t-${esc(t.id)}" data-tid="${esc(t.id)}">
    <div class="md-th"><i>${i + 1}.</i><b>${hl(esc(t.title || '(제목 없음)'), q)}</b>${thr}
      ${ctx.interactive ? `<button class="md-tc${tc ? ' on' : ''}" data-act="tcmt" data-tid="${esc(t.id)}">💬 ${tc || '댓글'}</button>` : ''}</div>
    ${renderBody(t.body, ctx)}`;
  const clean = ctx.clean || (x => x);
  for(const d of dec) h += `<div class="md-dec"><b>결정</b><span>${hl(clean(d.h || ''), q)}</span></div>`;
  for(const k of tasks){
    const key = taskKey(m.id, k.id);
    const doc = tk[key] || {};
    const st = doc.status || 'todo';
    const who = (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean);
    const due = k.due ? `${fmtMD(k.due)}까지` : '';
    const kc = num(cm['k:' + key] || doc.cmt);
    const can = !!(ctx.interactive && ctx.canStatus && ctx.canStatus(k, doc));
    h += `<div class="md-task${st === 'done' ? ' done' : ''}" id="k-${esc(key)}"><b>임무</b>
      <span class="md-kt">${hl(clean(k.h || ''), q)}${who.length ? ` · <u>${esc(who.join(', '))}</u>` : ''}${due ? ` · ${esc(due)}` : ''}</span>
      ${m.imported ? '' : statusChip(st, can, key)}
      ${ctx.interactive ? `<button class="md-kc${kc ? ' on' : ''}" data-act="kcmt" data-kid="${esc(key)}">💬 ${kc}</button>` : ''}</div>`;
  }
  if(t.ed && t.ed.name && !ctx.print){
    h += `<div class="md-ed"${ctx.interactive ? ` data-act="ed" data-tid="${esc(t.id)}" data-rev="${esc(t.ed.rev || '')}"` : ''}>✎ ${esc(t.ed.name)} 님이 ${esc(fmtStamp(t.ed.at))}에 고쳤어요${ctx.interactive ? ' · <u>고치기 전 보기</u>' : ''}</div>`;
  }
  return h + '</section>';
}
export function renderAttRows(m, ctx){
  ctx = ctx || {};
  const { on, off } = attSplit(m);
  const lim = ctx.print ? 999 : 10;
  const nm = a => esc(a.name || '?');
  const onTxt = on.length ? `${on.length}명 — ${on.slice(0, lim).map(nm).join(' · ')}${on.length > lim ? ` … <button class="md-lk" data-act="attall">모두 보기</button>` : ''}` : '';
  const offTxt = off.length ? `${off.length}명 — ${off.map(a => nm(a) + (a.r ? ` (${esc(a.r)})` : '')).join(' · ')}` : '';
  let rows = '';
  if(m.place) rows += `<tr><th>장소</th><td>${esc(m.place)}</td></tr>`;
  if(m.writerName) rows += `<tr><th>쓴 사람</th><td>${esc(m.writerName)}</td></tr>`;
  if(!(ctx.opts && ctx.opts.att === false)){
    if(onTxt) rows += `<tr><th>참석</th><td>${onTxt}</td></tr>`;
    if(offTxt) rows += `<tr><th>불참</th><td>${offTxt}</td></tr>`;
    if(m.guests) rows += `<tr><th>그 외</th><td>${esc(m.guests)}</td></tr>`;
  }
  return rows ? `<table class="md-info">${rows}</table>` : '';
}
export function renderDoc(m, ctx){
  ctx = ctx || {};
  const org = MORG[m.org] || '';
  const tps = (m.topics || []).map((t, i) => renderTopic(m, t, i, ctx)).join('');
  return `<article class="md-doc" data-mid="${esc(m.id || '')}">
    <div class="md-date">${esc(fmtLong(m.date, m.time))}${m.imported && !ctx.print ? ' <span class="md-imp">PDF에서 옮김</span>' : ''}</div>
    <h1 class="md-title">${esc(titleOf(m))}</h1>
    ${ctx.print ? '' : `<div class="md-org">${esc(org)}${m.type && titleOf(m) !== m.type + '록' ? ' · ' + esc(m.type) : ''}</div>`}
    ${renderAttRows(m, ctx)}
    ${tps || '<div class="md-empty">아직 적은 주제가 없어요.</div>'}
  </article>`;
}

/* ═══ (v-100) 문서 B — 결정 · 임무 먼저 (화면에서 보는 모양)
   · 머리 띠(날짜 · 제목 · 장소 · 참석 · 수정 횟수) → 이번 회의 결정 · 임무 요약 → 주제 카드
   · 주제 카드: 번호 · 제목 · 내용(번호 개요 그대로) · 결정 · 임무 · 댓글 — 접고 펼 수 있다
   · 출력 · PDF · 워드는 지금처럼 renderDoc(문서 A — 종이 모양)을 쓴다
   ctx = renderDoc과 같음 + { fold:{tid:true}, cmtLast:{tgt:ms} } ═══ */
export function renderDocB(m, ctx){
  ctx = ctx || {};
  const q = ctx.hl || '', clean = ctx.clean || (x => x);
  const tk = ctx.tasks || {}, cm = ctx.cmt || {}, lastAt = ctx.cmtLast || {}, fold = ctx.fold || {};
  const { on, off } = attSplit(m);
  const decs = [], tasks = [];
  (m.topics || []).forEach((t, i) => {
    (t.dec || []).filter(d => textOf(d.h).trim()).forEach(d => decs.push({ t, i, d }));
    (t.tasks || []).filter(k => textOf(k.h).trim()).forEach(k => tasks.push({ t, i, k }));
  });
  const whoOf = k => (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean);
  const canOf = (k, doc) => !!(ctx.interactive && ctx.canStatus && ctx.canStatus(k, doc));
  const [, mo, dd] = String(m.date || '').split('-').map(Number);
  const pills = [];
  if(m.place) pills.push(`<span class="mb-pill">${esc(m.place)}</span>`);
  if(on.length || off.length) pills.push(`<button type="button" class="mb-pill" data-act="attall">참석 ${on.length} · 불참 ${off.length}</button>`);
  if(m.writerName) pills.push(`<span class="mb-pill">쓴 사람 ${esc(m.writerName)}</span>`);
  const rv = Math.max(0, (+m.rev || 1) - 1);
  if(rv) pills.push(`<button type="button" class="mb-pill" data-act="hist">수정 ${rv}번</button>`);
  if(m.imported) pills.push(`<span class="mb-pill y">PDF에서 옮김</span>`);
  const sub = [MORG[m.org] || '', m.type && titleOf(m) !== m.type + '록' ? m.type : ''].filter(Boolean).join(' · ');
  let h = `<article class="md-doc mb-doc" data-mid="${esc(m.id || '')}">
    <header class="mb-hd">
      <div class="mb-org">${esc(sub)}</div>
      <div class="mb-when"><b>${mo ? `<em>${String(m.date).slice(0, 4)}년</em> ${mo}월 ${dd}일 ${WD[dowOf(m.date)]}요일` : ''}</b>${m.time ? `<span>${esc(m.time)}</span>` : ''}</div>
      <h1 class="mb-ttl">${hl(esc(titleOf(m)), q)}</h1>
      ${pills.length ? `<div class="mb-pills">${pills.join('')}</div>` : ''}
    </header>`;
  if(decs.length || tasks.length){
    const dn = tasks.filter(x => (tk[taskKey(m.id, x.k.id)] || {}).status === 'done').length;
    h += `<div class="mb-sum${decs.length && tasks.length ? '' : ' one'}">`;
    if(decs.length) h += `<section class="mb-card"><h3><i class="g"></i>이번 회의 결정 ${decs.length}</h3>${decs.map(x =>
      `<button type="button" class="mb-sr" data-act="goto" data-tid="${esc(x.t.id)}"><i>${x.i + 1}</i><span>${hl(clean(x.d.h || ''), q)}</span></button>`).join('')}</section>`;
    if(tasks.length) h += `<section class="mb-card"><h3><i class="y"></i>임무 ${tasks.length}${dn ? ` <small>완료 ${dn}</small>` : ''}</h3>${tasks.map(x => {
      const key = taskKey(m.id, x.k.id), doc = tk[key] || {}, st = doc.status || 'todo', who = whoOf(x.k);
      return `<div class="mb-sr"><button type="button" class="mb-sl" data-act="gotok" data-kid="${esc(key)}" data-tid="${esc(x.t.id)}"><i>${x.i + 1}</i><span>${hl(clean(x.k.h || ''), q)}${who.length ? ` · <u>${esc(who.join(', '))}</u>` : ''}${x.k.due ? ` · ${esc(fmtMD(x.k.due))}까지` : ''}</span></button>${m.imported ? '' : statusChip(st, canOf(x.k, doc), key)}</div>`;
    }).join('')}</section>`;
    h += `</div>`;
  }
  (m.topics || []).forEach((t, i) => {
    const dec = (t.dec || []).filter(d => textOf(d.h).trim());
    const tks = (t.tasks || []).filter(k => textOf(k.h).trim());
    const tc = num(cm['t:' + t.id]);
    const folded = !!fold[t.id];
    const thr = t.thrFrom ? `<span class="md-thr">↩ ${esc(fmtMDY(t.thrFrom))} 회의에서 이어짐</span>` : '';
    const ed = t.ed && t.ed.name && !ctx.print
      ? `<button type="button" class="md-ed mb-ed" data-act="ed" data-tid="${esc(t.id)}" data-rev="${esc(t.ed.rev || '')}">✎ ${esc(t.ed.name)} ${esc(fmtStamp(t.ed.at))} 고침</button>` : '';
    const nl = (t.body || []).length;
    h += `<section class="md-t mb-t${folded ? ' fold' : ''}" id="t-${esc(t.id)}" data-tid="${esc(t.id)}">
      <div class="mb-th"><span class="mb-n">${i + 1}</span><b>${hl(esc(t.title || '(제목 없음)'), q)}</b>${thr}${ed}
        ${ctx.interactive && ctx.pinned ? (pin => `<button type="button" class="mb-pin${pin ? ' on' : ''}" data-act="pin" data-mid="${esc(m.id)}" data-tid="${esc(t.id)}" aria-pressed="${pin}" aria-label="${pin ? '모아 둔 것에서 빼기' : '모아 두기'}" title="${pin ? '모아 둔 주제에서 빼기' : '☆ 모아 두기 (나만 보기)'}">${pin ? '★' : '☆'}</button>`)(ctx.pinned.has(t.id)) : ''}
        ${ctx.interactive && (nl || dec.length) ? `<button type="button" class="mb-fd" data-act="fold" data-tid="${esc(t.id)}" aria-expanded="${!folded}">${folded ? `펼치기 ▾` : '접기 ▴'}</button>` : ''}</div>`;
    if(!folded && (nl || dec.length))
      h += `<div class="mb-tb">${renderBody(t.body, ctx)}${dec.map(d => `<div class="md-dec"><b>결정</b><span>${hl(clean(d.h || ''), q)}</span></div>`).join('')}</div>`;
    else if(folded) h += `<div class="mb-fdn">${nl ? `내용 ${nl}줄` : ''}${dec.length ? ` · 결정 ${dec.length}` : ''}</div>`;
    const last = lastAt['t:' + t.id];
    const krows = tks.map(k => {
      const key = taskKey(m.id, k.id), doc = tk[key] || {}, st = doc.status || 'todo', who = whoOf(k);
      const kc = num(cm['k:' + key] || doc.cmt);
      return `<div class="md-task mb-k${st === 'done' ? ' done' : ''}" id="k-${esc(key)}"><b>임무</b>
        <span class="md-kt">${hl(clean(k.h || ''), q)}${who.length ? ` · <u>${esc(who.join(', '))}</u>` : ''}${k.due ? ` · ${esc(fmtMD(k.due))}까지` : ''}</span>
        ${m.imported ? '' : statusChip(st, canOf(k, doc), key)}
        ${ctx.interactive ? `<button type="button" class="md-kc${kc ? ' on' : ''}" data-act="kcmt" data-kid="${esc(key)}">💬 ${kc}</button>` : ''}</div>`;
    }).join('');
    if(krows || ctx.interactive){
      h += `<div class="mb-ft">${krows}${ctx.interactive ? `<button type="button" class="md-tc mb-tc${tc ? ' on' : ''}" data-act="tcmt" data-tid="${esc(t.id)}">💬 ${tc ? `댓글 ${tc}${last ? ' · 마지막 ' + esc(fmtStamp(last)) : ''}` : '댓글 남기기'} ›</button>` : ''}</div>`;
    }
    h += `</section>`;
  });
  if(!(m.topics || []).length) h += `<div class="md-empty">아직 적은 주제가 없어요.</div>`;
  return h + `</article>`;
}

/* 문서 모양 — 화면 · 인쇄가 같은 규칙 */
export const DOC_CSS = `
.md-doc{font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1F2320;line-height:1.75;font-size:14px;word-break:keep-all;overflow-wrap:anywhere}
.md-date{font-size:13.5px;font-weight:800;color:#1F2320}
.md-imp{font-size:11px;font-weight:800;color:#7A5A00;background:#FFF4B8;border-radius:100px;padding:1px 8px;margin-left:6px;vertical-align:1px}
.md-title{font-size:24px;font-weight:900;text-align:center;letter-spacing:.18em;margin:10px 0 4px}
.md-org{text-align:center;font-size:12px;color:#6B7670;font-weight:700;margin-bottom:12px}
.md-info{width:100%;border-collapse:collapse;margin:8px 0 18px;font-size:13px}
.md-info th{width:74px;text-align:left;color:#5A6560;font-weight:800;padding:6px 8px;border-top:1px solid #E3E1DA;border-bottom:1px solid #E3E1DA;vertical-align:top;white-space:nowrap}
.md-info td{padding:6px 8px;border-top:1px solid #E3E1DA;border-bottom:1px solid #E3E1DA}
.md-t{margin:0 0 18px;scroll-margin-top:80px}
.md-th{display:flex;align-items:baseline;gap:8px;margin:0 0 4px;flex-wrap:wrap}
.md-th>i{font-style:normal;font-weight:900;font-size:15px;min-width:22px}
.md-th>b{font-weight:800;font-size:15px;background:#FFF59D;padding:1px 5px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.md-thr{font-size:11px;font-weight:800;color:#2B6CB0;background:#E6F0FB;border-radius:100px;padding:1px 8px}
.md-l{display:flex;gap:6px;font-size:14px;line-height:1.8}
.md-l>i{font-style:normal;flex:none;min-width:24px;color:#3F4A45}
.md-l>span{flex:1;min-width:0;white-space:pre-wrap}
.md-l1{padding-left:26px}.md-l2{padding-left:52px}.md-l3{padding-left:78px}.md-l4{padding-left:104px}
.md-l mark,.md-dec mark,.md-kt mark{background:#FFF59D;color:inherit;padding:0 2px}
.md-dec,.md-task{display:flex;gap:10px;align-items:flex-start;margin:6px 0 0 26px;padding:7px 10px;border-radius:10px;font-size:13.5px;line-height:1.6}
.md-dec{background:#EEF6F2}
.md-dec>b{flex:none;font-size:11.5px;font-weight:900;color:#00704A;padding-top:2px}
.md-task{background:#FBF6E6}
.md-task>b{flex:none;font-size:11.5px;font-weight:900;color:#8A6D00;padding-top:2px}
.md-task.done .md-kt{color:#6B7670}
.md-kt{flex:1;min-width:0}.md-kt u{text-decoration:none;font-weight:800}
.md-st{flex:none;font-family:inherit;font-size:11.5px;font-weight:800;border:0;border-radius:100px;padding:2px 10px;cursor:default;white-space:nowrap}
button.md-st{cursor:pointer}
.md-kc,.md-tc{flex:none;font-family:inherit;font-size:11.5px;font-weight:800;color:#6B7670;background:transparent;border:1px solid #E3E1DA;border-radius:100px;padding:1px 9px;cursor:pointer;white-space:nowrap}
.md-kc.on,.md-tc.on{color:#00704A;border-color:#9CCBB6;background:#F3FAF7}
.md-tc{margin-left:auto}
.md-ed{margin:6px 0 0 26px;font-size:11.5px;color:#8A6D00;cursor:pointer}
.md-ed u{text-decoration:underline}
.md-tbl{margin:8px 0 6px 26px;overflow-x:auto}
.md-tbl table{border-collapse:collapse;font-size:12.5px;min-width:60%}
.md-tbl th,.md-tbl td{border:1px solid #C9C5B9;padding:5px 8px;vertical-align:top}
.md-tbl th{background:#EEECE6;font-weight:800}
.md-cap{margin:2px 0 8px 26px;font-size:11.5px;color:#6B7670}
.md-imgs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 8px 26px}
.md-img{margin:0;max-width:100%;flex:0 1 auto}
.md-img img{display:block;max-width:100%;max-height:420px;border-radius:8px;border:1px solid #E3E1DA;cursor:zoom-in}
.md-img figcaption{font-size:11.5px;color:#6B7670;margin-top:3px}
.md-ph{width:220px;height:140px;border-radius:8px;background:#EEECE6;color:#93A09A;font-size:12px;display:flex;align-items:center;justify-content:center}
.md-pdf{margin:8px 0 8px 26px;border:1px solid #E3E1DA;border-radius:10px;padding:8px 10px;background:#FCFBF8}
.md-pdfh{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px}
.md-pg{margin:0 0 6px}.md-pg img{display:block;width:100%;max-width:640px;border:1px solid #E3E1DA;border-radius:4px;cursor:zoom-in}
.md-more{font-family:inherit;font-size:12px;font-weight:800;color:#00704A;background:#E8F3EF;border:0;border-radius:8px;padding:5px 10px;cursor:pointer}
.md-file,.md-link{display:flex;align-items:center;gap:8px;margin:8px 0 8px 26px;border:1px solid #E3E1DA;border-radius:10px;padding:8px 12px;background:#FCFBF8;font-size:13px;color:inherit;text-decoration:none;max-width:560px}
.md-file small,.md-link small,.md-pdfh small{color:#6B7670;font-size:11.5px}
.md-file b,.md-link b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.md-fi{font-size:18px}
.md-orig{margin-left:auto;font-family:inherit;font-size:12px;font-weight:800;color:#00704A;background:#E8F3EF;border:0;border-radius:8px;padding:4px 10px;cursor:pointer;text-decoration:none;white-space:nowrap}
.md-lk{font-family:inherit;font-size:12px;font-weight:800;color:#00704A;background:none;border:0;padding:0;cursor:pointer;text-decoration:underline}
.md-empty{color:#93A09A;font-size:13px;padding:20px 0;text-align:center}
.md-hit{font-style:normal;background:#FFE08A;border-radius:3px;box-shadow:0 0 0 1px #F2C94C}
.md-prev{margin:4px 0 6px 18px;padding:5px 0 6px;background:#F3F5F4;border-left:3px solid #BFCCC6;border-radius:0 8px 8px 0;color:#5E6A64}
.md-prev .md-l{color:#5E6A64}.md-prev .md-l>i{color:#8A958F}
.md-prev .md-l1{padding-left:8px}.md-prev .md-l2{padding-left:34px}.md-prev .md-l3{padding-left:60px}.md-prev .md-l4{padding-left:86px}
.md-prev .md-tbl,.md-prev .md-imgs,.md-prev .md-pdf,.md-prev .md-file,.md-prev .md-link,.md-prev .md-cap{margin-left:8px}
.md-prev-h{font-size:11px;font-weight:800;color:#7A8A82;padding:0 0 2px 8px}
.md-new-h{font-size:11px;font-weight:900;color:#00704A;margin:8px 0 1px 26px}
@media (max-width:700px){
  .md-title{font-size:20px;letter-spacing:.1em}
  .md-l1{padding-left:12px}.md-l2{padding-left:30px}.md-l3{padding-left:48px}.md-l4{padding-left:66px}
  .md-dec,.md-task,.md-ed,.md-tbl,.md-imgs,.md-pdf,.md-file,.md-link,.md-cap{margin-left:8px}
  .md-task{flex-wrap:wrap}.md-task .md-kt{flex-basis:calc(100% - 40px)}.md-task .md-st{margin-left:34px}
}
`;

/* ═══ 고친 곳 비교 — 수정 이력 ═══ */
export function topicLines(t){
  const out = [];
  const labels = numberBody(t.body);
  (t.body || []).forEach((b, i) => {
    if(b.k === 'l') out.push(`${labels[i] ? labels[i] + ' ' : ''}${textOf(b.h)}`);
    else if(b.k === 'tbl') out.push(`[표] ${textOf(String(b.h || '').replace(/<\/(td|th)>/gi, ' | ').replace(/<\/tr>/gi, ' / ')).replace(/\s*\|\s*\/\s*/g, ' / ').replace(/[\s|/]+$/, '').replace(/\s+/g, ' ').slice(0, 160)}`);
    else if(b.k === 'img') out.push(`[사진]${b.cap ? ' ' + b.cap : ''}`);
    else if(b.k === 'pdf') out.push(`[PDF] ${b.name || ''}`);
    else if(b.k === 'file') out.push(`[문서] ${b.name || ''}`);
    else if(b.k === 'link') out.push(`[링크] ${b.title || b.url || ''}`);
  });
  for(const d of t.dec || []) out.push(`결정: ${textOf(d.h)}`);
  for(const k of t.tasks || []){
    const who = (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean).join(', ');
    out.push(`임무: ${textOf(k.h)}${who ? ' · ' + who : ''}${k.due ? ' · ' + fmtMD(k.due) + '까지' : ''}`);
  }
  return out;
}
export function lcs(a, b){
  const n = a.length, m = b.length;
  const dp = Array.from({ length:n + 1 }, () => new Int32Array(m + 1));
  for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  const ops = []; let i = 0, j = 0;
  while(i < n && j < m){
    if(a[i] === b[j]){ ops.push({ t:'=', a:a[i] }); i++; j++; }
    else if(dp[i+1][j] >= dp[i][j+1]) ops.push({ t:'-', a:a[i++] });
    else ops.push({ t:'+', b:b[j++] });
  }
  while(i < n) ops.push({ t:'-', a:a[i++] });
  while(j < m) ops.push({ t:'+', b:b[j++] });
  return ops;
}
/* 한 줄 안에서 바뀐 낱말만 칠하기 */
export function wordDiff(x, y){
  const ta = String(x).split(/(\s+)/), tb = String(y).split(/(\s+)/);
  if(ta.length * tb.length > 40000) return { a:`<del>${esc(x)}</del>`, b:`<ins>${esc(y)}</ins>` };
  const ops = lcs(ta, tb);
  /* 이웃한 바뀐 낱말은 한 덩어리로 — 바뀐 낱말 사이의 띄어쓰기도 바뀐 덩어리에 넣는다 */
  const seq = ops.map(o => ({ t:o.t, v: o.t === '+' ? o.b : o.a }));
  for(let i = 1; i < seq.length - 1; i++){
    if(seq[i].t === '=' && /^\s+$/.test(seq[i].v) && seq[i-1].t !== '=' && seq[i+1].t !== '='){
      seq.splice(i, 1, { t:'-', v:seq[i].v }, { t:'+', v:seq[i].v }); i++;
    }
  }
  let a = '', b = '', da = '', db = '';
  const flush = () => { if(da) a += `<del>${esc(da)}</del>`; if(db) b += `<ins>${esc(db)}</ins>`; da = db = ''; };
  for(const r of seq){
    if(r.t === '='){ flush(); a += esc(r.v); b += esc(r.v); }
    else if(r.t === '-') da += r.v;
    else db += r.v;
  }
  flush();
  return { a, b };
}
/* 두 줄 묶음 비교 → 화면용 줄들 [{t:'='|'-'|'+'|'~', html}] */
export function diffLines(A, B){
  const ops = lcs(A, B);
  const out = [];
  for(let i = 0; i < ops.length; i++){
    const o = ops[i], nx = ops[i+1];
    if(o.t === '-' && nx && nx.t === '+'){
      const w = wordDiff(o.a, nx.b);
      out.push({ t:'-', html:w.a }, { t:'+', html:w.b }); i++; continue;
    }
    if(o.t === '=') out.push({ t:'=', html:esc(o.a) });
    else if(o.t === '-') out.push({ t:'-', html:`<del>${esc(o.a)}</del>` });
    else out.push({ t:'+', html:`<ins>${esc(o.b)}</ins>` });
  }
  return out;
}
const sig = t => JSON.stringify([t.title || '', topicLines(t)]);
/* 이번 저장에서 바뀐 것 — 요약 한 줄과 «고친 주제» 목록 */
export function changeSummary(prev, next){
  if(!prev) return { sum:'처음 작성', changed:(next.topics || []).map(t => t.id) };
  const P = new Map((prev.topics || []).map(t => [t.id, t]));
  const N = new Map((next.topics || []).map(t => [t.id, t]));
  const parts = [], changed = [];
  (next.topics || []).forEach((t, i) => {
    const p = P.get(t.id);
    const nm = `${i + 1}. ${String(t.title || '').slice(0, 18)}`;
    if(!p){ parts.push(`${nm} 추가`); changed.push(t.id); return; }
    if(sig(p) === sig(t)) return;
    changed.push(t.id);
    const bits = [];
    if((p.title || '') !== (t.title || '')) bits.push('제목');
    const lb = x => JSON.stringify(topicLines({ body:x.body }));
    if(lb(p) !== lb(t)) bits.push('내용');
    const dc = (x) => (x.dec || []).map(d => textOf(d.h)).join('\n');
    if(dc(p) !== dc(t)) bits.push((t.dec || []).length > (p.dec || []).length ? '결정 추가' : '결정');
    const kc = (x) => JSON.stringify(topicLines({ tasks:x.tasks }));
    if(kc(p) !== kc(t)) bits.push((t.tasks || []).length > (p.tasks || []).length ? `임무 ${(t.tasks||[]).length - (p.tasks||[]).length} 추가` : '임무');
    parts.push(`${nm} — ${bits.join(' · ') || '고침'}`);
  });
  for(const [id, p] of P){ if(!N.has(id)) parts.push(`${String(p.title || '').slice(0, 18)} 뺌`); }
  const ordA = (prev.topics || []).map(t => t.id).filter(id => N.has(id)), ordB = (next.topics || []).map(t => t.id).filter(id => P.has(id));
  if(ordA.join() !== ordB.join()) parts.push('주제 순서 바꿈');
  const head = [];
  for(const k of ['date','time','place','type','title']) if((prev[k] || '') !== (next[k] || '')) head.push(({ date:'날짜', time:'시각', place:'장소', type:'회의 종류', title:'제목' })[k]);
  if(JSON.stringify(prev.att || {}) !== JSON.stringify(next.att || {}) || (prev.guests || '') !== (next.guests || '')) head.push('참석');
  if(head.length) parts.unshift(head.join('·') + ' 고침');
  return { sum: parts.join(' / ') || '고친 곳 없음', changed };
}

/* ═══ 찾기 — 주제로 모아 보기 ═══ */
export const normTitle = s => String(s || '').toLowerCase().replace(/[\s\-_.,·:;!?'"()[\]{}~…]/g, '').replace(/관련$|건$/, '');
export function topicText(t){ return [t.title || '', ...topicLines(t)].join('\n'); }
/* comments = [{meetingId, tgt, text}] — 댓글도 찾는다 */
export function searchMeetings(list, q, comments){
  const s = String(q || '').trim().toLowerCase();
  if(!s) return [];
  const words = s.split(/\s+/).filter(Boolean);
  const hit = txt => { const L = String(txt || '').toLowerCase(); return words.every(w => L.includes(w)); };
  const cm = new Map();
  for(const c of comments || []){
    if(c.del) continue;
    const k = c.meetingId + '|' + c.tgt;
    if(!cm.has(k)) cm.set(k, []);
    cm.get(k).push(c);
  }
  const groups = new Map();
  for(const m of list){
    (m.topics || []).forEach((t, i) => {
      const own = topicText(t);
      const tc = (cm.get(m.id + '|t:' + t.id) || []).concat(
        ...(t.tasks || []).map(k => cm.get(m.id + '|k:' + taskKey(m.id, k.id)) || []));
      const cHit = tc.filter(c => hit(c.text));
      if(!hit(own) && !cHit.length) return;
      /* 제목에 찾는 말이 들었으면 한 갈래로 모아 «흐름»을 보여 준다 (신발장 → 신발장 사용 → 신발장 사용 관련…) */
      const key = hit(t.title) ? '__q__' : (t.thr || normTitle(t.title) || (m.id + t.id));
      if(!groups.has(key)) groups.set(key, { key, title: key === '__q__' ? String(q).trim() : (t.title || '(제목 없음)'), rows:[] });
      const lines = topicLines(t).filter(l => hit(l)).slice(0, 3);
      groups.get(key).rows.push({ m, t, i, lines, cmts:cHit.slice(0, 2) });
    });
    const mc = (cm.get(m.id + '|m') || []).filter(c => hit(c.text));
    if(mc.length){
      const key = '__m__' + m.id;
      groups.set(key, { key, title:'회의록 댓글', rows:[{ m, t:null, i:-1, lines:[], cmts:mc.slice(0, 3) }] });
    }
  }
  const out = [...groups.values()];
  out.forEach(g => g.rows.sort((a, b) => String(a.m.date).localeCompare(String(b.m.date))));
  out.sort((a, b) => (b.key === '__q__') - (a.key === '__q__') || b.rows.length - a.rows.length || String(b.rows[b.rows.length-1].m.date).localeCompare(String(a.rows[a.rows.length-1].m.date)));
  return out;
}

/* (v-100) 모아 둔 주제가 뒤 회의에서 다시 나왔나 — 이어 쓴 주제(thr)거나 제목이 같으면 */
export function laterDates(list, pin){
  const key = normTitle(pin.title), thr = pin.thr || `${pin.mid}:${pin.tid}`;
  const out = [];
  for(const m of list || []){
    if(m.id === pin.mid || String(m.date) <= String(pin.date || '')) continue;
    if((m.topics || []).some(x => (x.thr && x.thr === thr) || (key && normTitle(x.title) === key))) out.push(m.date);
  }
  return [...new Set(out)].sort();
}

/* ═══ 결정 · 임무 요약표 (여러 건 출력 맨 앞) ═══ */
export function summaryRows(list, tasks){
  const rows = [];
  for(const m of list){
    (m.topics || []).forEach((t, i) => {
      const dec = (t.dec || []).map(d => textOf(d.h).trim()).filter(Boolean);
      const tk = (t.tasks || []).filter(k => textOf(k.h).trim()).map(k => {
        const d = (tasks || {})[taskKey(m.id, k.id)] || {};
        const who = (k.uids || []).map(u => (k.names || {})[u] || '').filter(Boolean).join(', ');
        return { h: textOf(k.h).trim(), who, due: k.due || '', st: d.status || 'todo' };
      });
      if(dec.length || tk.length) rows.push({ m, t, i, dec, tk });
    });
  }
  return rows;
}
