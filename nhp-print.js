/* ═══════════════════════════════════════════════════════════
   🖨 nhp-print.js — 나학평 A4 쪽 나눔 · 인쇄 · PDF (v141)
   · 문서(ReportDoc)를 A4 쪽에 차례로 담는다 — 표가 쪽을 넘으면 «줄 단위»로 나누고 머리 줄을 다음 쪽에 다시 단다
     (범위 칸처럼 위아래로 묶인 줄은 함께 · 출결 · 시험 표는 통째로 · 제목만 쪽 끝에 홀로 남지 않게)
   · 아주 긴 글 한 칸은 문단 · 문장에서 나눠 다음 쪽으로 잇는다
   · 인쇄와 PDF가 같은 쪽을 쓴다 (화면에서 본 그대로 나온다)
   · v144 표지 모양(opt.cover) · 속지 모양(opt.inner: old · a · c) — A · C 는 쪽 머리 · 첫 쪽 학생 정보 줄 · 바닥 쪽 번호가 따로
   ═══════════════════════════════════════════════════════════ */
import * as C from './nhp-core.js?v=144';
const TH = C.TH;

export const PAGE = { w: 794, h: 1123, m: 57, foot: 22 };   // A4 · 여백 15mm
const INNER_H = PAGE.h - PAGE.m * 2 - PAGE.foot;

export const PAGE_CSS = `
.np-host{position:absolute;left:-12000px;top:0;width:${PAGE.w}px;visibility:hidden;pointer-events:none}
.np{width:${PAGE.w}px;height:${PAGE.h}px;background:#fff;position:relative;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.14);margin:0 auto 18px;color:#15181A}
.np .np-in{position:absolute;left:${PAGE.m}px;right:${PAGE.m}px;top:${PAGE.m}px;height:${INNER_H}px;overflow:hidden}
.np .np-cv{position:absolute;left:${PAGE.m}px;right:${PAGE.m}px;top:${PAGE.m}px;bottom:${PAGE.m}px}
.np .np-ft{position:absolute;left:${PAGE.m}px;right:${PAGE.m}px;bottom:${PAGE.m - 30}px;height:16px;display:flex;justify-content:space-between;font:600 9.5px/16px 'Noto Sans KR','Noto Sans',sans-serif;color:#8B948F;letter-spacing:.02em}
.np .np-in > .nb:last-child{margin-bottom:0}
.np-pages{zoom:var(--np-zoom,1)}
@media print{
  @page{size:A4;margin:0}
  html,body{background:#fff!important}
  body.np-printing > *:not(#np-print-root){display:none!important}
  #np-print-root{display:block!important}
  #np-print-root .np{box-shadow:none;margin:0;page-break-after:always;break-after:page}
  #np-print-root .np:last-child{page-break-after:auto;break-after:auto}
}
#np-print-root{display:none}
` + TH.CHROME_CSS + TH.COVER_CSS;
export function ensureCSS(){
  if(!document.getElementById('nr-css')){ const s = document.createElement('style'); s.id = 'nr-css'; s.textContent = C.REPORT_CSS; document.head.appendChild(s); }
  if(!document.getElementById('np-css')){ const s = document.createElement('style'); s.id = 'np-css'; s.textContent = PAGE_CSS; document.head.appendChild(s); }
}
function el(html){ const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
async function fontsReady(){ try{ if(document.fonts && document.fonts.ready) await document.fonts.ready; }catch(e){} }
function imgsReady(root){
  const ims = Array.from(root.querySelectorAll('img'));
  return Promise.all(ims.map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 6000); })));
}

/* 표 줄 묶음 — 위아래로 묶인 칸(rowspan)이 걸친 줄은 한 묶음 · 머리 줄(hd)은 따로 */
export function rowGroups(t){
  const rows = t.rows || [];
  const heads = [], groups = [];
  let i = 0;
  while(i < rows.length && rows[i].hd){ heads.push(i); i++; }
  if(t.keep){ if(i < rows.length) groups.push(rows.slice(i).map((r, k) => i + k)); return { heads, groups }; }
  while(i < rows.length){
    let end = i;
    for(let j = i; j <= end; j++){
      (rows[j].cells || []).forEach(c => { const rs = Math.max(1, c.rs || 1); if(j + rs - 1 > end) end = Math.min(rows.length - 1, j + rs - 1); });
    }
    const g = []; for(let j = i; j <= end; j++) g.push(j);
    groups.push(g); i = end + 1;
  }
  return { heads, groups };
}
let THEME = 'old';      // 지금 쪽 나눔이 쓰는 속지 모양 (paginate 안에서만 바뀜)
function tableShell(t){
  return el(`<table class="${C.esc((t.cls || '') + (t.auto ? ' auto' : ''))}">${C.colgroupHTML(t, THEME)}<tbody></tbody></table>`);
}
function rowEl(r){
  const tb = el(`<table><tbody>${`<tr${r.hd ? ' class="hd"' : ''}>${(r.cells || []).map(c => {
    const cls = C.cellClass(c, false, r.hd);
    return `<td${c.cs > 1 ? ` colspan="${Number(c.cs) | 0}"` : ''}${c.rs > 1 ? ` rowspan="${Number(c.rs) | 0}"` : ''}${cls ? ` class="${cls}"` : ''}>${C.cellText(c, false, THEME)}</td>`;
  }).join('')}</tr>`}</tbody></table>`);
  return tb.querySelector('tr');
}
/* 아주 긴 글 칸 나누기 — 문단 → 문장 → 글자 */
//   조각마다 뒤의 줄바꿈 · 띄어쓰기를 붙여 둔다 (이어 붙이면 원래 글 그대로) · 한 조각이 또 한 쪽보다 길면 그 조각을 다시 나눈다
function splitText(x){
  const s = String(x || '');
  const paras = s.split(/\n/);
  if(paras.length > 1) return { pieces: paras.map((p, i) => i < paras.length - 1 ? p + '\n' : p), sep: '' };
  const sent = s.match(/[^.!?。]+[.!?。]+["'”’)]*\s*|[^.!?。]+$/g);
  if(sent && sent.length > 1) return { pieces: sent, sep: '' };
  const out = []; for(let i = 0; i < s.length; i += 40) out.push(s.slice(i, i + 40));
  return { pieces: out.length ? out : [''], sep: '' };
}
const joinP = (ps, a, z) => ps.slice(a, z + 1).join('').replace(/\n+$/, '');
/* 더 나눌 수 있으면 조각 k 를 잘게 (줄바꿈은 마지막 조각에 그대로) */
function refine(ps, k){
  const raw = ps[k], tail = /\n$/.test(raw) ? '\n' : '';
  const sub = splitText(raw.replace(/\n$/, '')).pieces;
  if(sub.length < 2) return false;
  sub[sub.length - 1] += tail;
  ps.splice(k, 1, ...sub);
  return true;
}

/* ═══ 쪽 나누기 — 문서 하나 → 쪽 요소들 ═══
   opt = { cover:true|false, coverKey:'cc1'…'old', inner:'old'|'a'|'c', sign:{on,…}, draft, coverImg, logoImg, footL, footR(예전 모양) } */
export async function paginate(doc, opt){
  opt = opt || {};
  ensureCSS();
  const theme = (opt.inner === 'a' || opt.inner === 'c') ? opt.inner : 'old';
  const coverKey = TH.coverOf(opt.coverKey || (theme === 'old' ? 'old' : TH.DEF.cover)).k;
  THEME = theme;
  await fontsReady();
  await TH.fontsFor(coverKey, theme);
  const lang = doc.lang || 'ko';
  const G = TH.CHROME[theme] || TH.CHROME.old;
  const IH = G.innerH;
  const host = el('<div class="np-host"></div>');
  document.body.appendChild(host);
  const pages = [];
  const newPage = () => {
    if(pages.length > 300){ host.remove(); throw new Error('쪽이 너무 많아요 (300쪽 넘음) — 나학평 담당에게 알려 주세요'); }   // 혹시 모를 끝없는 쪽 나눔 막기
    const p = theme === 'old'
      ? el(`<div class="np"><div class="np-in nr${lang === 'en' ? ' en' : ''}"></div><div class="np-ft"><span></span><span></span></div></div>`)
      : el(`<div class="np np-th"><div class="np-in nr${lang === 'en' ? ' en' : ''} th-${theme}" style="top:${G.top}px;height:${IH}px"></div>${TH.runHeadHTML(theme, doc)}<div class="np-fx"></div></div>`);
    host.appendChild(p); pages.push(p); return p.querySelector('.np-in');
  };
  // 내용의 실제 아래 끝(여백 빼고)으로 잰다 · 6px 여유 — 화면 확대(미리보기) · 브라우저 인쇄에서 줄바꿈이 조금 달라져도 쪽 끝이 잘리지 않게
  const fits = inner => {
    const top = inner.getBoundingClientRect().top;
    let bot = top;
    for(const c of inner.children){ const b = c.getBoundingClientRect().bottom; if(b > bot) bot = b; }
    return bot - top <= IH - 6;
  };
  if(opt.cover !== false){
    const p = coverKey === 'old'
      ? el(`<div class="np np-cover"><div class="np-cv">${C.coverHTML(doc, { cover: opt.coverImg, logo: opt.logoImg })}</div></div>`)
      : el(`<div class="np np-cover">${TH.coverHTML(doc, coverKey, { emblem: opt.logoImg, contents: TH.contentsOf(doc, C.KEY_HEAD) })}</div>`);
    host.appendChild(p); pages.push(p);
    await imgsReady(p);
  }
  let inner = newPage();
  if(theme !== 'old') inner.appendChild(el(TH.infoStripHTML(doc, theme)));     // 첫 쪽 학생 정보 줄
  const nos = C.numbersFor(doc, theme);
  const blocks = doc.blocks || [];
  for(const b of blocks){
    const parts = C.blockParts(b, lang, nos[b.id], false, theme);
    const secCls = b.k === 'sec' ? 'nb ns' : b.k === 'subj' ? 'nb nsub' : 'nb';
    let sec = el(`<section class="${secCls}"></section>`);
    const head = el(parts.head);
    sec.appendChild(head);
    inner.appendChild(sec);
    // 제목만 있는 블록(교과 학습활동) — 다음 블록 제목과 함께 가도록, 넘치면 새 쪽
    if(!fits(inner)){ sec.remove(); inner = newPage(); inner.appendChild(sec); }
    let headAlone = true;            // 이 쪽에서 제목 뒤에 아직 아무것도 없음
    const startNew = (withHead) => {
      if(headAlone && sec.childElementCount === 1 && withHead !== false){ sec.remove(); inner = newPage(); inner.appendChild(sec); return sec; }
      inner = newPage();
      sec = el(`<section class="${secCls} cont"></section>`); inner.appendChild(sec);
      return sec;
    };
    for(const t of (b.tables || [])){
      const { heads, groups } = rowGroups(t);
      let tbl = tableShell(t); sec.appendChild(tbl);
      let tb = tbl.querySelector('tbody');
      const addHeads = () => heads.forEach(i => tb.appendChild(rowEl(t.rows[i])));
      addHeads();
      let bodyRows = 0;
      if(!fits(inner)){ tbl.remove(); startNew(); tbl = tableShell(t); sec.appendChild(tbl); tb = tbl.querySelector('tbody'); addHeads(); }
      // 묶음 넣기 — ① 지금 쪽에 통째로 ② 작은 묶음(2줄 이하) · 통째 표는 새 쪽에 통째로 ③ 그래도 안 되면 줄 단위로 나눈다
      //   (범위 칸처럼 위아래로 묶인 칸은 쪽마다 다시 단다 · 한 줄이 한 쪽보다 길면 긴 글 칸을 문단 · 문장에서 나눈다)
      const put = rows => { const els = rows.map(rowEl); els.forEach(e => tb.appendChild(e)); if(fits(inner)) return true; els.forEach(e => e.remove()); return false; };
      const slice = (a, z) => { const drop = new Set(); (t.rows || []).forEach((r, i) => { if(i < a || i > z) drop.add(i); }); return C.dropRows(t, drop).rows; };
      const nextPage = () => { if(bodyRows === 0) tbl.remove(); startNew(); tbl = tableShell(t); sec.appendChild(tbl); tb = tbl.querySelector('tbody'); addHeads(); bodyRows = 0; };
      const fresh = () => bodyRows === 0 && inner.childElementCount === 1 && sec.querySelectorAll('table').length === 1;
      const splitLong = r => {
        const li = (r.cells || []).reduce((m, c, i) => (String(c.x || '').length > String((r.cells[m] || {}).x || '').length ? i : m), 0);
        const ps = splitText(r.cells[li].x).pieces;
        const mk = (txt, cont) => rowEl(Object.assign({}, r, { cells: r.cells.map((c, i) => i === li ? Object.assign({}, c, { x: txt }) : ((cont && c.mk) ? Object.assign({}, c, { x: '' }) : c)) }));
        let k = 0, cont = false;
        while(k < ps.length){
          let fit = '', take = 0;
          for(let j = k; j < ps.length; j++){
            const txt = joinP(ps, k, j);
            const e = mk(txt, cont); tb.appendChild(e);
            const ok = fits(inner); e.remove();
            if(!ok) break;
            fit = txt; take = j - k + 1;
          }
          if(!take){
            if(!fresh()){ nextPage(); cont = true; continue; }
            if(refine(ps, k)) continue;                                                              // 빈 쪽에도 안 들어가는 조각 — 더 잘게
            tb.appendChild(mk(joinP(ps, k, k), cont)); k++; bodyRows++; headAlone = false;         // 더 못 나누는 조각 — 그대로
          } else { tb.appendChild(mk(fit, cont)); k += take; bodyRows++; headAlone = false; }
          if(k < ps.length){ nextPage(); cont = true; }
        }
      };
      for(const g of groups){
        if(put(g.map(i => t.rows[i]))){ bodyRows += g.length; headAlone = false; continue; }
        // 묶음 높이 — 쪽의 절반 아래면 새 쪽에 통째로 (범위 칸이 둘로 갈라지지 않게) · 더 크면 지금 쪽부터 나눠 채운다
        const gh = (() => { const els = g.map(i => rowEl(t.rows[i])); els.forEach(x => tb.appendChild(x)); const h = els[els.length - 1].getBoundingClientRect().bottom - els[0].getBoundingClientRect().top; els.forEach(x => x.remove()); return h; })();
        if((g.length <= 2 || t.keep || gh <= IH * 0.45) && !fresh()){
          nextPage();
          if(put(g.map(i => t.rows[i]))){ bodyRows += g.length; headAlone = false; continue; }
        }
        // 줄 단위로 — 지금 쪽부터 채운다
        let k = g[0]; const e = g[g.length - 1];
        while(k <= e){
          let best = -1;
          for(let j = k; j <= e; j++){
            const els = slice(k, j).map(rowEl); els.forEach(x => tb.appendChild(x));
            const ok = fits(inner); els.forEach(x => x.remove());
            if(!ok) break;
            best = j;
          }
          if(best >= k){
            slice(k, best).map(rowEl).forEach(x => tb.appendChild(x)); bodyRows += best - k + 1; headAlone = false; k = best + 1;
            if(k <= e) nextPage();
            continue;
          }
          if(!fresh()){ nextPage(); continue; }       // 한 줄도 안 들어감 — 새 쪽에서 다시
          splitLong(slice(k, k)[0]); k++;            // 빈 쪽에도 안 들어가는 한 줄 — 긴 글 칸을 나눠 잇는다
        }
      }
    }
    // 아래 설명(휴교 사유 등) — 안 들어가면 새 쪽 · 한 쪽보다 길면 문단 · 문장에서 나눠 잇는다
    const pageFresh = () => inner.childElementCount === 1 && sec.childElementCount <= 1;
    for(const n0 of (b.notes || [])){
      const nh = C.noteHTML(n0, false); if(!nh) continue;
      let n = el(nh); sec.appendChild(n);
      if(fits(inner)){ headAlone = false; continue; }
      n.remove();
      if(!pageFresh()){ startNew(); n = el(nh); sec.appendChild(n); if(fits(inner)){ headAlone = false; continue; } n.remove(); }
      const ps = splitText(n0.p).pieces; let k = 0, first = true;
      const mkN = txt => el(C.noteHTML({ h: first ? n0.h : '', p: txt }, false) || '<div></div>');
      while(k < ps.length){
        let fit = -1;
        for(let j = k; j < ps.length; j++){ const e = mkN(joinP(ps, k, j)); sec.appendChild(e); const ok = fits(inner); e.remove(); if(!ok) break; fit = j; }
        if(fit < k){
          if(!pageFresh()){ startNew(); continue; }
          if(refine(ps, k)) continue;
          fit = k;
        }
        sec.appendChild(mkN(joinP(ps, k, fit))); headAlone = false; first = false; k = fit + 1;
        if(k < ps.length) startNew();
      }
    }
  }
  // v144 마지막 «확인» 칸 (학기 설정 › 출력 모양에서 켰을 때) — 안 들어가면 새 쪽
  const sg = TH.signHTML(doc, theme === 'old' ? 'c' : theme, opt.sign);
  if(sg){ let x = el(sg); inner.appendChild(x); if(!fits(inner)){ x.remove(); inner = newPage(); inner.appendChild(el(sg)); } }
  // 빈 마지막 쪽 지우기
  const last = pages[pages.length - 1];
  if(last && !last.classList.contains('np-cover') && !last.querySelector('.np-in').childElementCount){ last.remove(); pages.pop(); }
  // 쪽 번호
  const body = pages.filter(p => !p.classList.contains('np-cover'));
  body.forEach((p, i) => {
    if(theme !== 'old'){ const fx = p.querySelector('.np-fx'); if(fx) fx.outerHTML = TH.footHTML(theme, doc, i + 1, body.length, { draft: opt.draft }); return; }
    const f = p.querySelectorAll('.np-ft span');
    if(f[0]) f[0].textContent = opt.footL || '';
    if(f[1]) f[1].textContent = `${opt.footR ? opt.footR + '  ·  ' : ''}${i + 1} / ${body.length}`;
  });
  host.remove();
  pages.forEach(p => p.remove());
  THEME = 'old';
  return pages;
}

/* 인쇄 — 쪽 요소들을 인쇄 전용 자리에 놓고 브라우저 인쇄 */
export function printPages(pages, name){
  ensureCSS();
  let root = document.getElementById('np-print-root');
  if(!root){ root = document.createElement('div'); root.id = 'np-print-root'; document.body.appendChild(root); }
  root.innerHTML = '';
  pages.forEach(p => root.appendChild(p.cloneNode(true)));
  document.body.classList.add('np-printing');
  const done = () => { document.body.classList.remove('np-printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  const go = () => { try{ window.print(); }catch(e){} setTimeout(done, 1500); };
  if(window.FN && FN.printAs) FN.printAs(name || ['나학평'], go); else go();
}

/* PDF — 쪽마다 그림으로 (html2canvas → jsPDF) · onStep(지금, 모두) */
export async function pdfPages(pageSets, fileName, opt){
  opt = opt || {};
  if(window.ensureJsPDF) await window.ensureJsPDF();
  if(window.ensureH2C) await window.ensureH2C();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
  const all = pageSets.flat();
  const stage = el('<div style="position:fixed;left:-12000px;top:0;width:794px;background:#fff"></div>');
  document.body.appendChild(stage);
  const scale = opt.scale || (all.length > 60 ? 1.4 : all.length > 12 ? 1.6 : 2);   // 반 전체(수십 ~ 수백 쪽)는 조금 가볍게
  try {
    for(let i = 0; i < all.length; i++){
      if(opt.onStep) opt.onStep(i + 1, all.length);
      const pg = all[i].cloneNode(true);
      pg.style.boxShadow = 'none'; pg.style.margin = '0';
      stage.innerHTML = ''; stage.appendChild(pg);
      await imgsReady(pg);
      const cv = await window.html2canvas(pg, { scale, backgroundColor: '#ffffff', useCORS: true, logging: false, width: PAGE.w, height: PAGE.h, windowWidth: PAGE.w });
      if(i) pdf.addPage('a4', 'p');
      pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
      await new Promise(r => setTimeout(r, 0));
    }
  } finally { stage.remove(); }
  if(opt.blob) return pdf.output('blob');
  pdf.save(fileName || '나학평.pdf');
  return null;
}
