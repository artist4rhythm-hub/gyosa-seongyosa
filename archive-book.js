/* ═══════════════════════════════════════════════════════════
   📖 archive-book.js — 보관본을 «책자»로 (v196)
   · archive-core.js 가 만든 장(章) · 꼭지를 A4 쪽 상자(210×297mm)에 직접 나눠 담는다
       표지 → 차례(쪽 번호 · 누르면 그 쪽으로) → 장마다 «장 첫 쪽(한눈에)» → 꼭지(새 쪽에서 시작) → 끝 쪽(이 보관본에 대하여)
   · 쪽마다 머리글(장 · 꼭지 이름) · 쪽 번호 · 오른쪽 가장자리 장 탭
   · 화면 미리 보기 = 인쇄(PDF) — 같은 쪽 · 같은 쪽 번호 (화면에서는 크기만 줄여 보여 줌)
   · 표는 칸 너비를 정해 두고 낱말 단위로만 줄을 바꿔 글자가 세로로 늘어지지 않게,
     넓은 표(한글에서 옮긴 표 등)는 쪽 너비에 맞게 줄이고, 긴 표는 쪽마다 머리줄을 다시 단다
   ═══════════════════════════════════════════════════════════ */
import * as M from './minutes-core.js';
const esc = M.esc;   // archive-core.js 를 다시 부르지 않게 (주소가 다르면 두 번 읽힘)

const ALL = 2, PART = 1, NONE = 0;
/* 쪽 안 여백 (mm) — CSS 와 같은 값 */
const PG = { w: 210, h: 297, top: 21, bottom: 19, left: 18, right: 21, slack: 2.5 };
/* 쪼개지 않고 통째로 옮기는 것 (사진 줄 .md-imgs 는 사진마다 나눌 수 있게 뺐음) */
const ATOMIC = '.md-l,.md-dec,.md-task,.md-th,.md-img,.md-file,.md-link,.md-ph,.md-cap,.md-date,.md-title,.md-pdfh,.md-pg,.md-new-h,.md-prev-h,'
  + '.pc,.prc-cell,.prc-hd,.arc-tag,.bk-ph,.bk-h3,.bk-lead,.bk-note,.bk-none,.bk-err,.bk-keep,.ch-open,.toc-ch,.toc-e,.colo-n,tr,img,figure,h1,h2,h3,h4,p,li';
const SPLIT_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'HEADER', 'MAIN']);
const isKwn = el => el && el.nodeType === 1 && el.classList.contains('bk-kwn');
const fontsReady = () => Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), new Promise(r => setTimeout(r, 3000))]).catch(() => {});
/* rowspan 으로 묶인 줄은 함께 옮긴다 (칸이 어긋나지 않게) */
function groupAt(body){
  const rows = body.rows; if(!rows.length) return [];
  let end = 0;
  for(let k = 0; k <= end && k < rows.length; k++) for(const c of rows[k].cells) end = Math.max(end, k + (c.rowSpan || 1) - 1);
  return [...rows].slice(0, Math.min(end, rows.length - 1) + 1);
}

class Pager {
  constructor(root, info){ this.root = root; this.info = info; this.pages = []; this.ctx = { kind: 'flow' }; this.body = null; this.placed = 0; this.notes = new Set(); }
  page(kind, ctx){
    if(ctx) this.ctx = { ...ctx, kind };
    const c = this.ctx, I = this.info, n = this.pages.length + 1;
    const w = document.createElement('div'); w.className = 'pg-w';
    const p = document.createElement('div'); p.className = `pg pg-${kind}${c.ch != null ? ' t' + c.ch : ''}`; p.id = 'pg-' + n;
    const tabs = kind === 'toc' || kind === 'sum' ? I.chapters.map((ch, i) => tab(ch, i, true)).join('') : (c.ch != null ? tab(I.chapters[c.ch], c.ch, false) : '');
    p.innerHTML = kind === 'cover' ? '<div class="pg-body pg-cv"></div>' :
      `<div class="pg-hd"><span class="hd-l">${esc(c.hl || '')}</span><span class="hd-r">${esc(c.hr || '')}</span></div>
       <div class="pg-body"></div>
       <div class="pg-ft"><span class="ft-l">${esc(I.foot)}</span><span class="ft-n"><b class="pn">${n}</b><i class="pt"></i></span></div>${tabs}`;
    w.appendChild(p); this.root.appendChild(w);
    this.pages.push({ el: p, kind });
    this.body = p.querySelector('.pg-body');
    this.placed = 0;   // 이 쪽에 실제로 들어간 것 (빈 껍데기 · 머리줄 말고)
    return p;
  }
  fits(){ return this.body.scrollHeight <= this.body.clientHeight + 1; }
  next(){ this.page(this.ctx.kind === 'toc' || this.ctx.kind === 'sum' ? this.ctx.kind : 'flow'); }

  /* 남은 높이에 node 를 넣을 수 있는 만큼 — node 는 떨어져 있는 상태로 받는다
     ALL = 통째로 들어감 · PART = 앞부분만 들어가고 node 에는 나머지가 남음 · NONE = 하나도 못 넣음
     빈 쪽에도 안 들어가는 덩어리는 «그 덩어리만» 그 자리에서 줄이거나(사진 · 표) 글을 나눈다 */
  fill(node, parent){
    parent.appendChild(node);
    if(this.fits()){ this.placed++; return ALL; }
    node.remove();
    const atomic = node.nodeType !== 1 || node.matches(ATOMIC) || !(SPLIT_TAGS.has(node.tagName) || node.tagName === 'TABLE');
    if(atomic) return this.placed === 0 ? this.forceAtom(node, parent) : NONE;
    if(node.tagName === 'TABLE') return this.fillTable(node, parent);
    const p0 = this.placed;
    const shell = node.cloneNode(false);
    node.removeAttribute('id');
    parent.appendChild(shell);
    let any = false;
    while(node.firstChild){
      const ch = node.firstChild; ch.remove();
      if(ch.nodeType === 3 && !ch.nodeValue.trim()){ shell.appendChild(ch); continue; }
      const r = this.fill(ch, shell);
      if(r === ALL){ any = true; continue; }
      node.insertBefore(ch, node.firstChild);
      if(r === PART) any = true;
      break;
    }
    /* 제목(bk-kwn)만 쪽 끝에 남지 않게 — 다음 쪽으로 */
    while(shell.lastElementChild && isKwn(shell.lastElementChild) && shell.children.length > 1){
      node.insertBefore(shell.lastElementChild, node.firstChild); this.placed--;
    }
    if(!any || (shell.children.length === 1 && isKwn(shell.firstElementChild) && node.firstChild)){
      while(shell.lastChild) node.insertBefore(shell.lastChild, node.firstChild);
      shell.remove(); this.placed = p0; return NONE;
    }
    node.classList.add('bk-cont');
    return PART;
  }
  /* 표 — 줄(또는 rowspan 묶음) 단위로 · 다음 쪽에는 머리줄(thead)을 다시 · 맺음줄(tfoot)은 마지막 쪽에 */
  fillTable(tbl, parent){
    const body = tbl.tBodies[0];
    if(!body || body.rows.length < 1) return this.placed === 0 ? this.forceAtom(tbl, parent) : NONE;
    const p0 = this.placed;
    const shell = tbl.cloneNode(false); shell.removeAttribute('id');
    for(const k of tbl.children){ if(k.tagName === 'COLGROUP' || k.tagName === 'THEAD' || k.tagName === 'CAPTION') shell.appendChild(k.cloneNode(true)); }
    const tb = document.createElement('tbody'); shell.appendChild(tb);
    parent.appendChild(shell);
    if(!this.fits()){ shell.remove(); return NONE; }
    let n = 0;
    for(;;){
      const g = groupAt(body); if(!g.length) break;
      g.forEach(r => tb.appendChild(r));
      if(this.fits()){ n += g.length; this.placed += g.length; continue; }
      for(let i = g.length - 1; i >= 0; i--) body.insertBefore(g[i], body.firstChild);
      if(n === 0 && p0 === 0){   // 빈 쪽인데 첫 묶음도 안 들어감
        if(g.length > 1){   // 아주 큰 rowspan 묶음 — 한 줄씩이라도
          while(body.rows.length){ const r = body.rows[0]; tb.appendChild(r); if(!this.fits()){ body.insertBefore(r, body.firstChild); break; } n++; this.placed++; }
          if(n) break;
        }
        const fr = this.forceRow(body.rows[0], tb, body);
        if(fr !== NONE){ n++; this.placed++; if(fr === ALL) continue; }
      }
      break;
    }
    while(n > 0 && isKwn(tb.lastElementChild)){ body.insertBefore(tb.lastElementChild, body.firstChild); n--; this.placed--; }
    if(!body.rows.length && n > 1){ body.insertBefore(tb.lastElementChild, body.firstChild); n--; this.placed--; }   // 맺음줄만 다음 쪽에 홀로 남지 않게
    if(n === 0){ while(tb.lastChild) body.insertBefore(tb.lastChild, body.firstChild); shell.remove(); this.placed = p0; return NONE; }
    tbl.classList.add('bk-cont');
    return PART;
  }
  /* 빈 쪽에도 안 들어가는 표 한 줄 — 가장 긴 칸의 글을 쪽마다 나눈다 */
  forceRow(r, tb, body){
    r.remove(); tb.appendChild(r);
    if(this.fits()) return ALL;
    const cells = [...r.cells]; let bi = 0;
    cells.forEach((c, i) => { if((c.innerText || '').length > (cells[bi].innerText || '').length) bi = i; });
    const txt = cells[bi].innerText || '';
    r.remove();
    const head = r.cloneNode(true); tb.appendChild(head);
    const hc = head.cells[bi];
    let lo = 1, hi = txt.length, best = 0;
    while(lo <= hi){ const mid = (lo + hi) >> 1; hc.textContent = txt.slice(0, mid); if(this.fits()){ best = mid; lo = mid + 1; } else hi = mid - 1; }
    if(!best){ head.remove(); tb.appendChild(r); r.style.zoom = '0.5'; this.notes.add('clip'); return ALL; }
    hc.textContent = txt.slice(0, best);
    const rest = txt.slice(best).replace(/^\s+/, '');
    this.notes.add('text');
    if(!rest) return ALL;
    [...r.cells].forEach((c, i) => { c.textContent = i === bi ? rest : (i === 0 ? '↳' : ''); });
    r.classList.add('bk-cont');
    body.insertBefore(r, body.firstChild);
    return PART;
  }
  /* 빈 쪽에도 안 들어가는 한 덩어리 — 그 덩어리만: 글자를 줄이고(사진 · 표는 끝까지 줄임), 그래도 크면 글만 쪽마다 나눈다 */
  forceAtom(node, parent){
    if(node.nodeType !== 1){ const d = document.createElement('div'); d.textContent = node.nodeValue || ''; node = d; }
    parent.appendChild(node);
    if(this.fits()){ this.placed++; return ALL; }
    const media = node.matches('img,figure') || !!node.querySelector('img,figure,svg,canvas,table');
    for(const z of media ? [0.86, 0.74, 0.62, 0.5, 0.4, 0.3] : [0.9, 0.8]){
      node.style.zoom = String(z);
      if(this.fits()){ this.placed++; this.notes.add('zoom'); return ALL; }
    }
    if(media){ this.placed++; this.notes.add('clip'); return ALL; }   // 사진 · 표는 글로 바꾸지 않는다
    node.style.zoom = '';
    const txt = node.innerText || node.textContent || '';   // 붙어 있을 때 읽어야 줄바꿈이 산다
    node.remove();
    const d = node.cloneNode(false); d.removeAttribute('id'); d.removeAttribute('style'); d.classList.add('bk-txt'); parent.appendChild(d);
    let lo = 1, hi = txt.length, best = 0;
    while(lo <= hi){ const mid = (lo + hi) >> 1; d.textContent = txt.slice(0, mid); if(this.fits()){ best = mid; lo = mid + 1; } else hi = mid - 1; }
    if(!best){ d.remove(); return NONE; }
    d.textContent = txt.slice(0, best);
    const rest = txt.slice(best).replace(/^\s+/, '');
    this.placed++; this.notes.add('text');
    if(!rest) return ALL;
    while(node.firstChild) node.firstChild.remove();
    node.textContent = rest; node.removeAttribute('style'); node.classList.add('bk-txt', 'bk-cont');
    return PART;
  }
  put(node){
    for(let guard = 0; guard < 4000; guard++){
      const r = this.fill(node, this.body);
      if(r === ALL) return;
      if(r === NONE && this.placed === 0){   // 있을 수 없지만 — 잃지 않게 그대로 둔다
        this.body.appendChild(node); this.notes.add('clip'); return;
      }
      if(r === NONE){
        const last = this.body.lastElementChild;
        if(last && isKwn(last) && this.body.children.length > 1){ last.remove(); this.next(); this.body.appendChild(last); this.placed++; continue; }
      }
      this.next();
    }
    this.body.appendChild(node); this.notes.add('clip');   // 너무 많이 나뉘면 — 잃지 않게 마지막 쪽에
  }
  async flow(html, stage){
    stage.innerHTML = html;
    void stage.offsetHeight;   // 글꼴(글자 묶음)을 이 글자들로 불러오게
    await settle(stage);
    await fontsReady();
    /* tbody 가 여럿인 표(붙여 넣은 표) — 하나로 합쳐 줄마다 나눌 수 있게 */
    stage.querySelectorAll('table').forEach(t => { const bs = [...t.tBodies]; bs.slice(1).forEach(x => { while(x.rows.length) bs[0].appendChild(x.rows[0]); x.remove(); }); });
    /* 머리줄이 tbody 첫 줄(th 만)인 표(한글에서 옮긴 표) — thead 로 옮겨 다음 쪽에도 다시 달리게 */
    stage.querySelectorAll('table').forEach(t => { const b = t.tBodies[0], r = b && b.rows[0];
      if(!t.tHead && r && b.rows.length > 1 && r.cells.length && [...r.cells].every(c => c.tagName === 'TH' && (c.rowSpan || 1) === 1)) t.createTHead().appendChild(r); });
    fitWide(stage);
    while(stage.firstChild){
      const n = stage.firstChild; n.remove();
      if(n.nodeType === 3 && !n.nodeValue.trim()) continue;
      this.put(n);
    }
  }
}
function tab(ch, i, all){ return `<div class="pg-tab t${i}${all ? ' all' : ''}" style="--i:${i}"><b>${ch.no}</b><span>${esc(ch.s)}</span></div>`; }
/* 사진 · 글꼴이 다 그려진 뒤에 재야 쪽이 맞는다 */
async function settle(root){
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(imgs.map(im => (im.complete && im.naturalWidth) ? 0 : new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); setTimeout(r, 6000); })));
  await Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => {}) : 0));
}
/* 쪽보다 넓은 표 — 쪽 너비에 맞게 줄인다. 반 넘게 줄여야 하면(칸이 아주 많은 표) 50%에서 칸 너비를 나눠 글자 단위로 줄바꿈 (잘리지 않게) */
function fitWide(root){
  root.querySelectorAll('.md-tbl table, .bk-wide').forEach(t => {
    const box = t.parentElement; if(!box) return;
    const cw = box.clientWidth, tw = t.scrollWidth;
    if(!(cw > 0 && tw > cw + 1)) return;
    const z = (cw - 2) / tw;
    if(z >= 0.5){ t.style.zoom = z.toFixed(3); return; }
    t.style.zoom = '0.5'; t.classList.add('bk-tfix'); t.style.width = Math.floor((cw - 2) / 0.5) + 'px';
  });
}

/* ── 표지 · 차례 · 장 첫 쪽 · 끝 쪽 ── */
const statLine = st => (st || []).map(s => `${s.l} ${s.v}${s.u ? (/^[·\s]/.test(s.u) ? ' ' + s.u : s.u) : ''}`).join(' · ');
function coverHTML(I){
  const m = I.meta;
  const title = m.packLabel === '전부' ? '전체 보관본' : m.packLabel ? `${m.packLabel} 보관본` : '보관본';
  return `<div class="cv">
    <div class="cv-top"><img class="cv-logo" src="icon-192.png" alt=""><span class="cv-brand">교사 선교사</span></div>
    <div class="cv-main">
      <div class="cv-kicker">기록 보관본 · ${esc(m.from.slice(0, 4))}</div>
      <h1 class="cv-title">${esc(title)}</h1>
      <div class="cv-org">${esc(m.orgLabel || '다니엘아마츠학교 · 그루터기 선교원')}</div>
      <div class="cv-range">${esc(m.range)}</div>
    </div>
    <div class="cv-band"></div>
    <ol class="cv-list">${I.chapters.map(ch => `<li><b>${ch.no}</b><span>${esc(ch.l)}</span><em>${ch.err ? '읽지 못함' : esc(ch.count) + '건'}${(ch.warn || []).length || ch.err ? ' ⚠️' : ''}</em></li>`).join('')}</ol>
    <div class="cv-meta">만든 때 ${esc(m.madeLabel)}${m.auto ? ' · 자동 백업' : m.by ? ` · 만든 사람 ${esc(m.by)}` : ''}<br>이 문서는 만든 때의 기록을 옮긴 사본이에요. 원본은 교사 선교사 사이트에 있어요.</div>
  </div>`;
}
/* 표지 다음 쪽 — 한눈에 보기 (숫자 카드 + 장마다 두 줄) */
function summaryHTML(I){
  const m = I.meta;
  const KEY = { mtg: ['회의', '결정', '임무'], lead: ['회의', '결정'], pay: ['지출', '요청서', '영수증'], att: ['출석률', '학생', '반'], act: ['기록', '수정 · 삭제'] };
  const pick = j => I.chapters.map(ch => { const k = (KEY[ch.k] || [])[j]; const s = (ch.stats || []).find(x => x.l === k); return s ? { ch, s } : null; }).filter(Boolean);
  const tiles = [...pick(0), ...pick(1), ...pick(2)].slice(0, 6);
  const warns = I.chapters.flatMap(ch => [...(ch.warn || []).map(w => `${ch.l}: ${w}`), ...(ch.err ? [`${ch.l}: 읽지 못함`] : [])]);
  return `<div class="sm" data-anc="summary">
    <div class="sm-hd"><div class="sm-kick">한눈에 보기</div><h1 class="sm-t">이번 보관본 종합</h1>
      <p class="sm-sub">${esc(m.range)} · ${esc(m.orgLabel || '두 기관 모두')}${m.packLabel ? ' · ' + esc(m.packLabel) : ''}</p></div>
    ${tiles.length ? `<div class="sm-tiles">${tiles.map(({ ch, s }) => `<div class="sm-tile t${ch.no - 1}"><small>${esc(ch.l)} · ${esc(s.l)}</small><b>${esc(s.v)}</b><i>${esc(s.u && !/^·/.test(s.u) ? s.u : '')}</i></div>`).join('')}</div>` : ''}
    <div class="sm-rows">${I.chapters.map(ch => `<div class="sm-row t${ch.no - 1}"><span class="sm-no">${ch.no}</span>
      <div class="sm-c"><div class="sm-l"><b>${esc(ch.l)}</b><span>${ch.err ? '읽지 못했어요' : esc(statLine(ch.stats))}</span></div>
      ${(ch.brief || []).length ? `<ul>${ch.brief.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>
      <a class="toc-pn sm-pn" data-to="ch-${ch.k}">000</a></div>`).join('')}</div>
    ${warns.length ? `<div class="sm-warn"><b>⚠️ 못 읽은 것</b> ${warns.map(esc).join(' · ')}</div>` : `<div class="sm-ok">✓ 고른 자료를 모두 읽었어요</div>`}
    <p class="sm-foot">자세한 내용은 다음 쪽 차례에서 — 쪽 번호를 누르면 그 쪽으로 가요.</p>
  </div>`;
}
function tocHTML(I){
  return `<h1 class="toc-h">차례</h1><p class="toc-sub">${esc(I.meta.range)}${I.meta.orgLabel ? ' · ' + esc(I.meta.orgLabel) : ''} · 쪽 번호를 누르면 그 쪽으로 가요</p>
  <div class="toc">${I.chapters.map(ch => `<div class="toc-ch bk-kwn t${ch.no - 1}"><span class="toc-no">${ch.no}</span><span class="toc-t"><b>${esc(ch.l)}</b><small>${ch.err ? '읽지 못했어요' : esc(statLine(ch.stats))}${(ch.warn || []).length ? ' · ⚠️ 일부 못 읽음' : ''}</small></span><a class="toc-pn" data-to="ch-${ch.k}">000</a></div>
    ${ch.parts.map(p => `<div class="toc-e"><span class="toc-et">${esc(p.title)}${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</span><span class="toc-dots"></span><a class="toc-pn" data-to="${p.id}">000</a></div>`).join('')}`).join('')}
    <div class="toc-ch bk-kwn toc-end"><span class="toc-no">·</span><span class="toc-t"><b>이 보관본에 대하여</b><small>만든 때 · 담긴 것 · 못 읽은 것</small></span><a class="toc-pn" data-to="colophon">000</a></div>
  </div>`;
}
function openerHTML(ch){
  const warn = [...(ch.warn || []), ...(ch.err ? ['읽지 못했어요 — ' + ch.err] : [])];
  return `<header class="ch-open" data-anc="ch-${ch.k}">
    <div class="ch-kick">제${ch.no}장</div><div class="ch-big">${String(ch.no).padStart(2, '0')}</div>
    <h1 class="ch-t">${esc(ch.l)}</h1><p class="ch-d">${esc(ch.d)}</p>
    ${(ch.stats || []).length ? `<div class="ch-stats">${ch.stats.map(s => `<div class="ch-stat"><small>${esc(s.l)}</small><b>${esc(s.v)}</b><i>${esc(s.u)}</i></div>`).join('')}</div>` : ''}
    ${warn.length ? `<div class="ch-warn">⚠️ ${warn.map(esc).join(' · ')}</div>` : ''}
  </header><div class="ch-intro">${ch.intro || ''}</div>`;
}
function colophonHTML(I){
  const m = I.meta;
  const warns = I.chapters.flatMap(ch => [...(ch.warn || []).map(w => `${ch.l}: ${w}`), ...(ch.err ? [`${ch.l}: 읽지 못함 (${ch.err})`] : [])]);
  return `<div class="colo" data-anc="colophon"><h1 class="toc-h">이 보관본에 대하여</h1>
    <table class="bk-t colo-t"><colgroup><col style="width:24%"><col></colgroup><tbody>
      <tr><th>기간</th><td>${esc(m.range)} (${esc(m.from)} ~ ${esc(m.to)})</td></tr>
      <tr><th>기관</th><td>${esc(m.orgLabel || '두 기관 모두')}</td></tr>
      <tr><th>묶음</th><td>${esc(m.packLabel || '직접 고름')}</td></tr>
      ${I.chapters.map(ch => `<tr><th>제${ch.no}장 ${esc(ch.l)}</th><td>${ch.err ? '읽지 못했어요' : esc(statLine(ch.stats) || ch.count + '건')}</td></tr>`).join('')}
      <tr><th>못 읽은 것</th><td>${warns.length ? warns.map(esc).join('<br>') : '없음'}</td></tr>
      ${I.notes && I.notes.size ? `<tr><th>쪽에 맞춘 것</th><td>${[I.notes.has('zoom') ? '쪽보다 큰 사진 · 표 · 글은 글자 크기를 줄였어요' : '', I.notes.has('text') ? '쪽보다 긴 글 몇 곳은 글자만 옮겨 쪽마다 나눴어요 (굵게 · 색은 빠짐)' : '', I.notes.has('clip') ? '아주 큰 사진 · 표 몇 곳은 쪽 끝이 잘렸을 수 있어요 — 원본은 사이트에서' : ''].filter(Boolean).join('<br>')}</td></tr>` : ''}
      <tr><th>만든 때</th><td>${esc(m.madeLabel)}${m.auto ? ' · 자동 백업 (매주)' : m.by ? ' · ' + esc(m.by) : ''}</td></tr>
      <tr><th>쪽 수</th><td><span class="colo-pages">0</span>쪽</td></tr>
      <tr><th>원본</th><td>교사 선교사 사이트 — 이 문서는 만든 때의 사본이라 그 뒤에 고친 내용은 들어 있지 않아요</td></tr>
    </tbody></table>
    <p class="colo-n">NAS 보관함의 묶음 폴더(교직원 · 주임 · 경비 · 관리자)에 넣어 두세요. 볼 사람이 다른 자료는 섞지 않아요.</p></div>`;
}

/* ═══ 책 만들기 ═══
   root = 쪽들이 들어갈 곳 · out = buildArchive 결과 */
export async function renderBook(root, out, opt = {}, onStep){
  const m = out.meta;
  const info = { meta: m, chapters: out.chapters,
    foot: ['교사 선교사 보관본', m.packLabel || '', m.orgLabel || '', `${m.from.replace(/-/g, '.')} – ${m.to.slice(m.from.slice(0, 4) === m.to.slice(0, 4) ? 5 : 0).replace(/-/g, '.')}`].filter(Boolean).join(' · ') };
  root.innerHTML = '';
  root.className = 'bk';
  const stage = document.createElement('div'); stage.className = 'bk-stage pg-body';
  root.appendChild(stage);
  try{ await Promise.race([document.fonts && document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); }catch(e){}
  const P = new Pager(root, info);
  /* 1 표지 */
  P.page('cover', {});
  P.body.innerHTML = coverHTML(info);
  await settle(P.body);
  /* 2 한눈에 보기 */
  P.page('sum', { hl: '한눈에 보기', hr: m.range });
  await P.flow(summaryHTML(info), stage);
  /* 3 차례 */
  P.page('toc', { hl: '차례', hr: m.range });
  await P.flow(tocHTML(info), stage);
  /* 3 장마다 */
  for(const [i, ch] of out.chapters.entries()){
    onStep && onStep(`쪽 나누는 중 — 제${ch.no}장 ${ch.l}`);
    P.page('flow', { ch: i, hl: `제${ch.no}장 ${ch.l}`, hr: ch.l });
    await P.flow(openerHTML(ch), stage);
    for(const p of ch.parts){
      if(p.brk) P.page('flow', { ch: i, hl: `제${ch.no}장 ${ch.l}`, hr: p.short });
      else P.ctx = { ...P.ctx, hr: p.short };
      const head = p.head ? `<div class="bk-ph bk-kwn"><span class="bk-ph-k">제${ch.no}장 · ${esc(ch.s)}</span><h2>${esc(p.title)}</h2>${p.sub ? `<p>${esc(p.sub)}</p>` : ''}</div>` : '';
      await P.flow(`<div class="bk-part" data-anc="${esc(p.id)}">${head}${p.html}</div>`, stage);
      await new Promise(r => setTimeout(r, 0));   // 화면이 멈추지 않게
    }
  }
  /* 4 끝 쪽 */
  P.page('flow', { ch: null, hl: '이 보관본에 대하여', hr: m.range });
  info.notes = P.notes;
  await P.flow(colophonHTML(info), stage);
  stage.remove();
  /* 쪽 번호 · 차례 번호 · 바로가기 */
  const total = P.pages.length, where = {};
  P.pages.forEach((pg, i) => { pg.el.querySelectorAll('[data-anc]').forEach(a => { const k = a.dataset.anc; if(!(k in where)) where[k] = i + 1; }); pg.el.querySelectorAll('.pt').forEach(x => { x.textContent = ' / ' + total; }); });
  root.querySelectorAll('.toc-pn').forEach(a => { const n = where[a.dataset.to]; if(n){ a.textContent = n; a.href = '#pg-' + n; } else { a.textContent = '–'; a.removeAttribute('href'); } });
  root.querySelectorAll('.colo-pages').forEach(x => { x.textContent = total; });
  scaleBook(root);
  return { pages: total, where };
}
/* 화면에서는 폭에 맞게 줄여 보여 준다 (인쇄는 그대로) */
export function scaleBook(root){
  const pxw = PG.w * 96 / 25.4, avail = Math.max(240, (root.parentElement ? root.parentElement.clientWidth : window.innerWidth) - 8);
  root.style.setProperty('--z', Math.min(1, avail / pxw).toFixed(4));
}

/* ═══ 모양 — 화면 미리 보기 · 인쇄가 같은 규칙 ═══ */
const B = PG;
const BODY_H = (B.h - B.top - B.bottom - B.slack).toFixed(1), BODY_W = (B.w - B.left - B.right).toFixed(1);
const PS_CSS = `
.ps-tbl td{font-size:8.6pt}
.ps-req td{background:var(--soft);color:var(--ink);padding:5px 7px!important;border-top:1.5px solid var(--acc)!important}
.ps-rq1{font-size:9.6pt;line-height:1.45}.ps-rq1 b{font-weight:800}.ps-no{font-weight:900;color:var(--acc);margin-right:2px}
.ps-meta{font-size:8pt;color:var(--ink2);margin-top:1px;line-height:1.45}
.ps-c{text-align:center}.ps-amt{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.ps-sub2 td{background:#FAFAF8;font-weight:800;color:var(--ink2);text-align:right;font-size:8.6pt}
.ps-corr{color:#5b21b6;font-weight:700}.ps-rejn{color:#991b1b;font-weight:700}
.ps-st{display:inline-block;padding:0 6px;border-radius:8px;font-size:7.8pt;font-weight:800;vertical-align:1px;margin-left:3px}
.ps-st.paid{background:#dcfce7;color:#166534}.ps-st.wait{background:#fef3c7;color:#92400e}.ps-st.apv{background:#dbeafe;color:#1e40af}
.ps-st.inc{background:#ede9fe;color:#5b21b6}.ps-st.rej{background:#fee2e2;color:#991b1b}
.ps-tbl tfoot,.bk-t tfoot{display:table-row-group}
.ps-tbl tr.ps-tot td{background:#F4ECD6;font-weight:900;color:#7A5A10;text-align:right;border-top:2px solid #B08D3C;font-size:10pt;padding:7px}
.ps-tbl tr.ps-fn td{background:none;border:0;color:var(--ink3);font-size:8pt;font-weight:500;padding:5px 0 0}
.ps-empty{text-align:center;color:#999;padding:14px}
.ps-sum{width:70%!important}
.prc-card{border:1px solid var(--line);border-radius:10px;margin:0 0 4mm;overflow:hidden}
.prc-card.bk-cont{border-top-style:dashed}
.prc-hd{background:var(--soft);padding:6px 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.prc-seq{background:var(--acc);color:#fff;font-size:9pt;font-weight:800;padding:1px 8px;border-radius:10px}
.prc-purpose{font-size:10.5pt;font-weight:800}.prc-meta{font-size:8.3pt;color:var(--ink2)}.prc-meta b{color:#7A5A10}
.prc-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm;padding:3mm}
.prc-cell{border:1px solid #E6E3DB;border-radius:8px;background:#F8F7F3;position:relative;overflow:hidden;text-align:center;padding:4px}
.prc-cell.wide{grid-column:1 / -1}.prc-cell img{max-width:100%;object-fit:contain;display:block;margin:0 auto}
.prc-cell.tall img{max-height:105mm}.prc-cell.short img{max-height:66mm}.prc-cell.wide img{max-height:78mm}
.prc-no{position:absolute;top:4px;left:4px;background:var(--acc);color:#fff;font-size:7.8pt;font-weight:700;padding:0 6px;border-radius:8px;opacity:.92}
.prc-lbl{font-size:7.8pt;color:var(--ink2);margin-top:3px;line-height:1.3}`;

export const BOOK_CSS = M.DOC_CSS + PS_CSS + `
@page{size:A4;margin:0}
.bk{--z:1;--ink:#1F2320;--ink2:#56615C;--ink3:#8A958F;--line:#D9D5CB;--soft:#EEF5F1;--acc:#00704A;--dk:#1E3932;--gold:#B8955A;
  font-family:'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact;
  display:flex;flex-direction:column;align-items:center;gap:14px}
.pg-w{width:calc(${B.w}mm * var(--z));height:calc(${B.h}mm * var(--z));flex:none;box-shadow:0 3px 16px rgba(0,0,0,.16);background:#fff}
.pg{position:relative;width:${B.w}mm;height:${B.h}mm;overflow:hidden;background:#fff;transform:scale(var(--z));transform-origin:0 0;contain:strict}
.pg-body,.bk-stage{position:absolute;top:${B.top}mm;left:${B.left}mm;width:${BODY_W}mm;height:${BODY_H}mm;overflow:hidden;display:flow-root;font-size:10pt;line-height:1.6;word-break:keep-all;overflow-wrap:break-word}
.bk-stage{position:fixed;left:-30000px;top:0;height:auto;visibility:hidden}
.pg-cv{top:0;left:0;width:100%;height:100%}
.pg-hd{position:absolute;top:9mm;left:${B.left}mm;right:${B.right}mm;display:flex;justify-content:space-between;gap:10mm;font-size:7.8pt;color:var(--ink3);border-bottom:.6pt solid var(--line);padding-bottom:1.6mm;white-space:nowrap}
.pg-hd span{overflow:hidden;text-overflow:ellipsis}.hd-l{font-weight:800;color:var(--acc)}
.pg-ft{position:absolute;bottom:8mm;left:${B.left}mm;right:${B.right}mm;display:flex;justify-content:space-between;align-items:baseline;font-size:7.5pt;color:var(--ink3)}
.ft-n b{font-size:10pt;color:var(--ink);font-weight:800}.ft-n i{font-style:normal}
.pg-tab{position:absolute;right:0;top:calc(34mm + var(--i) * 25mm);width:8.5mm;height:22mm;border-radius:3mm 0 0 3mm;background:var(--acc);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm}
.pg-tab b{font-size:10pt;font-weight:900}.pg-tab span{writing-mode:vertical-rl;font-size:7pt;font-weight:700;letter-spacing:.08em}
.pg-tab.all{opacity:.9}
.t0{--tc:#2F7D5B}.t1{--tc:#B7791F}.t2{--tc:#2B5797}.t3{--tc:#8E4A8C}.t4{--tc:#7A6A55}
.pg-tab{background:var(--tc,var(--acc))}
.bk-cont{margin-top:0!important;padding-top:0!important}
.bk-part{display:flow-root}
.bk-txt{white-space:pre-wrap;font-size:9.5pt;display:block!important}
.bk-att td.y{color:#A14A08;font-weight:800;background:#FEF3D9}.bk-okc{font-size:7.4pt;color:#A14A08;font-weight:700}
.bk-xr{color:#B42318}.bk-xy{color:#A14A08}
/* 표 — 칸 너비 고정 · 낱말 단위 줄바꿈 (글자가 세로로 늘어지지 않게) */
.bk-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.8pt;line-height:1.5;margin:0 0 3mm}
.bk-t th{background:var(--dk);color:#fff;font-weight:700;padding:4px 5px;text-align:left;font-size:8.4pt;vertical-align:bottom}
.bk-t td{border:.6pt solid var(--line);padding:3.5px 5px;vertical-align:top}
.bk-t th,.bk-t td{word-break:keep-all;overflow-wrap:break-word}
.bk-t tr{break-inside:avoid}
.bk-t tfoot td{background:#F4F2EC;font-weight:800}
.bk-li+.bk-li{margin-top:2px;padding-top:2px;border-top:.5pt dashed var(--line)}
.bk-sum tr.g1 td{border-top:1.2pt solid var(--ink2)}
.bk-sum tr.g2 .bk-when{color:var(--ink3)}
.bk-when b{display:block;font-weight:800}.bk-when small{display:block;font-size:7.8pt;color:var(--ink2)}
.bk-st{display:inline-block;font-size:7.4pt;font-weight:800;border-radius:100px;padding:0 6px;white-space:nowrap}
.bk-att th,.bk-att td{text-align:center;padding:2px 1px;font-size:7.8pt}
.bk-att th small{display:block;font-weight:500;opacity:.8;font-size:6.6pt}
.bk-att .bk-nm{text-align:left;padding-left:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bk-att td.ok{color:var(--acc)}.bk-att td.x{color:#B42318;font-weight:800;background:#FDF1F0}
.bk-att .we{background:#F1F0EC}.bk-att th.we{background:#55605B}
.bk-att .bk-tot{font-weight:700;font-size:7.4pt;white-space:nowrap}
.bk-att2 .bk-nm{white-space:nowrap}
.bk-notes td{font-size:8.4pt}
.bk-act td{font-size:8.2pt}
.bk-h3{font-size:11pt;font-weight:800;margin:4mm 0 2mm;color:var(--dk)}
.bk-lead{font-size:9pt;color:var(--ink2);margin:0 0 3mm}
.bk-note{font-size:8.4pt;color:var(--ink2);margin:0 0 3mm}
.bk-none{color:var(--ink3);text-align:center;padding:10mm 0;font-size:10pt}
.bk-err{color:#B42318;font-weight:700;padding:4mm 0}
/* 꼭지 머리 띠 */
.bk-ph{border-bottom:1.6pt solid var(--dk);padding:0 0 2.2mm;margin:0 0 4mm}
.bk-ph-k{display:inline-block;font-size:7.8pt;font-weight:800;color:var(--acc);letter-spacing:.04em}
.bk-ph h2{font-size:15pt;font-weight:900;margin:.5mm 0 0;line-height:1.3;color:var(--dk)}
.bk-ph p{margin:.5mm 0 0;font-size:8.6pt;color:var(--ink2)}
/* 회의록 — 종이 모양을 쪽에 맞게 */
.bk .md-doc{font-size:10pt;line-height:1.65}
.bk .md-title{font-size:17pt;letter-spacing:.08em;margin:2mm 0 1mm}
.bk .md-date{font-size:10pt}
.bk .md-info{font-size:9pt;margin:2mm 0 4mm}.bk .md-info th{width:20mm}
.bk .md-th>i,.bk .md-th>b{font-size:11pt}
.bk .md-l{font-size:10pt;line-height:1.65}
.bk .md-dec,.bk .md-task{font-size:9.4pt;padding:5px 9px;margin-top:4px}
.bk .md-t{margin:0 0 5mm}
/* 창이 좁아도(700px 아래 · 크게 확대한 창) 인쇄 폭(A4)과 같은 모양으로 재야 쪽이 맞는다 — DOC_CSS 의 좁은 화면 규칙을 되돌림 */
.bk .md-l1{padding-left:26px}.bk .md-l2{padding-left:52px}.bk .md-l3{padding-left:78px}.bk .md-l4{padding-left:104px}
.bk .md-dec,.bk .md-task,.bk .md-ed,.bk .md-tbl,.bk .md-imgs,.bk .md-pdf,.bk .md-file,.bk .md-link,.bk .md-cap,.bk .md-new-h{margin-left:26px}
.bk .md-task{flex-wrap:nowrap}.bk .md-task .md-kt{flex-basis:auto}.bk .md-task .md-st{margin-left:0}
.bk .md-prev{margin-left:18px}
.bk .md-prev .md-l1{padding-left:8px}.bk .md-prev .md-l2{padding-left:34px}.bk .md-prev .md-l3{padding-left:60px}.bk .md-prev .md-l4{padding-left:86px}
.bk .md-prev .md-tbl,.bk .md-prev .md-imgs,.bk .md-prev .md-pdf,.bk .md-prev .md-file,.bk .md-prev .md-link,.bk .md-prev .md-cap{margin-left:8px}
.bk .md-tbl{overflow:visible;margin-right:0}
.bk .md-tbl table.bk-tfix{table-layout:fixed}.bk .md-tbl table.bk-tfix th,.bk .md-tbl table.bk-tfix td{word-break:break-all;padding:3px 3px}
.bk .md-tbl table{min-width:0;width:auto;max-width:none;font-size:8.8pt}
.bk .md-tbl th,.bk .md-tbl td{word-break:keep-all;overflow-wrap:break-word;padding:4px 6px}
.bk .md-img img{max-height:92mm}.bk .md-pg img{max-width:100%;max-height:220mm}
.bk .md-imgs{gap:3mm}
.arc-tag{display:inline-block;font-size:8pt;font-weight:800;color:#fff;background:var(--acc);border-radius:100px;padding:0 9px;margin-bottom:1mm}
.pcm{margin-top:5mm;border-top:.8pt solid var(--line);padding-top:2mm}.pcm h3{font-size:10.5pt;margin:0 0 2mm}
.pc{font-size:9pt;margin:0 0 2mm;line-height:1.55}.pc small{color:var(--ink3)}.pc.rp{margin:0 0 2mm 6mm;padding-left:3mm;border-left:2px solid var(--line)}
/* 표지 */
.cv{position:absolute;inset:0;display:flex;flex-direction:column;padding:26mm 22mm 20mm}
.cv-band{display:none}
.cv-top{display:flex;align-items:center;gap:3mm}.cv-logo{width:11mm;height:11mm;border-radius:2.5mm}
.cv-brand{font-size:11pt;font-weight:800;letter-spacing:.32em;color:var(--acc)}
.cv-main{margin-top:44mm}
.cv-kicker{font-size:10pt;font-weight:700;letter-spacing:.2em;color:var(--ink2)}
.cv-title{font-size:38pt;font-weight:900;line-height:1.15;margin:3mm 0 4mm;color:var(--dk);letter-spacing:.02em}
.cv-org{font-size:14pt;font-weight:800;color:var(--acc)}
.cv-range{font-size:13pt;font-weight:700;margin-top:2mm}
.cv-list{list-style:none;margin:18mm 0 0;padding:0;border-top:1pt solid var(--dk)}
.cv-list li{display:flex;align-items:baseline;gap:4mm;padding:2.6mm 0;border-bottom:.6pt solid var(--line);font-size:11pt}
.cv-list b{width:8mm;color:var(--acc);font-weight:900}.cv-list span{flex:1;font-weight:700}.cv-list em{font-style:normal;color:var(--ink2);font-size:10pt}
.cv-meta{margin-top:auto;font-size:8.6pt;color:var(--ink2);line-height:1.8}
/* 차례 */
.toc-h{font-size:22pt;font-weight:900;margin:0 0 1mm;color:var(--dk);letter-spacing:.1em}
.toc-sub{font-size:8.6pt;color:var(--ink2);margin:0 0 6mm}
.toc-ch{display:flex;align-items:center;gap:3mm;margin:4mm 0 1mm;padding:2mm 0 1.6mm;border-bottom:1.2pt solid var(--dk)}
.toc-no{width:8mm;height:8mm;border-radius:2mm;background:var(--tc,var(--acc));color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:10.5pt;flex:none}
.toc-end .toc-no{background:var(--ink3)}
.toc-t{flex:1;min-width:0}.toc-t b{display:block;font-size:12pt;font-weight:900}.toc-t small{display:block;font-size:8pt;color:var(--ink2)}
.toc-pn{font-weight:900;font-size:11pt;color:var(--ink);text-decoration:none;min-width:9mm;text-align:right;white-space:nowrap}
.toc-e{display:flex;align-items:baseline;gap:2mm;padding:1.2mm 0 1.2mm 11mm;font-size:9.6pt}
.toc-et{min-width:0;max-width:82%}.toc-et small{color:var(--ink3);font-size:7.8pt;margin-left:2mm}
.toc-dots{flex:1;border-bottom:1pt dotted #B9B5AA;transform:translateY(-1mm)}
.toc-e .toc-pn{font-size:9.6pt;font-weight:700}
/* 장 첫 쪽 */
.ch-open{position:relative;margin:0 0 6mm;padding:0 0 4mm;border-bottom:1.6pt solid var(--dk)}
.ch-kick{font-size:9pt;font-weight:800;letter-spacing:.24em;color:var(--tc,var(--acc))}
.ch-big{position:absolute;right:0;top:-3mm;font-size:46pt;font-weight:900;color:var(--soft);line-height:1}
.ch-t{font-size:24pt;font-weight:900;margin:1mm 0 1mm;color:var(--dk)}
.ch-d{font-size:9.4pt;color:var(--ink2);margin:0}
.ch-stats{display:flex;gap:3mm;margin-top:4mm;flex-wrap:wrap}
.ch-stat{flex:1;min-width:26mm;border:.8pt solid var(--line);border-radius:3mm;padding:2mm 3mm}
.ch-stat small{display:block;font-size:7.8pt;color:var(--ink2);font-weight:700}.ch-stat b{font-size:15pt;font-weight:900}.ch-stat i{font-style:normal;font-size:8pt;color:var(--ink2);margin-left:1mm}
.ch-warn{margin-top:3mm;font-size:8.6pt;color:#B42318;font-weight:700}
/* 끝 쪽 */
.colo-t th{background:#F4F2EC;color:var(--ink);border:.6pt solid var(--line);vertical-align:top}
.colo-n{font-size:8.6pt;color:var(--ink2);margin-top:3mm}

/* ── 딥그린 책자 (현우님 선택: 시안 B + 표지 다음 «한눈에 보기») — 짙은 녹색 표지 · 장마다 색 띠 · 색 탭 ── */
.bk .pg-cover{background:var(--dk)}
.bk .cv{color:#fff;padding:24mm 22mm 18mm}
.bk .cv-band{display:block;width:46mm;height:1.6pt;background:var(--gold);margin-top:9mm}
.bk .cv-brand{color:#CFE7DA}.bk .cv-logo{box-shadow:0 0 0 1.5pt rgba(255,255,255,.25)}
.bk .cv-kicker{color:var(--gold)}.bk .cv-title{color:#fff}.bk .cv-org{color:#9FD8BC}.bk .cv-range{color:#fff}
.bk .cv-list{border-top-color:rgba(255,255,255,.5);margin-top:26mm}.bk .cv-list li{border-bottom-color:rgba(255,255,255,.16)}
.bk .cv-list b{color:var(--gold)}.bk .cv-list em{color:#CFE7DA}.bk .cv-meta{color:#A9C3B7}
.bk .ch-open{background:var(--tc,var(--dk));color:#fff;border:0;border-radius:4mm;padding:7mm 8mm 6mm;margin-bottom:7mm}
.bk .ch-kick{color:rgba(255,255,255,.85)}.bk .ch-t{color:#fff}.bk .ch-d{color:rgba(255,255,255,.85)}
.bk .ch-big{color:rgba(255,255,255,.2);right:7mm;top:4mm;font-size:54pt}
.bk .ch-stat{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25)}.bk .ch-stat small,.bk .ch-stat i{color:rgba(255,255,255,.8)}
.bk .ch-warn{color:#FFD2CC}
.bk .hd-l{color:var(--tc,var(--acc))}
.bk .ft-n b{display:inline-flex;align-items:center;justify-content:center;min-width:7mm;height:7mm;border-radius:100px;background:var(--tc,var(--dk));color:#fff;font-size:8.6pt;padding:0 1.5mm}

/* 한눈에 보기 */
.sm-hd{background:var(--dk);color:#fff;border-radius:4mm;padding:6mm 8mm 5mm;margin:0 0 5mm;position:relative;overflow:hidden}
.sm-hd::after{content:'';position:absolute;left:8mm;right:8mm;bottom:0;height:1.2pt;background:var(--gold)}
.sm-kick{font-size:8.6pt;font-weight:800;letter-spacing:.24em;color:var(--gold)}
.sm-t{font-size:21pt;font-weight:900;margin:1mm 0 .5mm}.sm-sub{margin:0;font-size:9pt;color:#CFE7DA}
.sm-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:3.2mm;margin:0 0 5mm}
.sm-tile{border:.8pt solid var(--line);border-top:2.4pt solid var(--tc,var(--acc));border-radius:3mm;padding:3mm 4mm 2.6mm;background:#fff}
.sm-tile small{display:block;font-size:7.8pt;color:var(--ink2);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sm-tile b{font-size:18pt;font-weight:900;color:var(--dk);line-height:1.25}.sm-tile i{font-style:normal;font-size:8.4pt;color:var(--ink2);margin-left:1mm}
.sm-rows{border-top:1.2pt solid var(--dk)}
.sm-row{display:flex;align-items:flex-start;gap:3.5mm;padding:3mm 0;border-bottom:.6pt solid var(--line)}
.sm-no{width:8mm;height:8mm;border-radius:2mm;background:var(--tc,var(--acc));color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:10.5pt;flex:none}
.sm-c{flex:1;min-width:0}.sm-l b{font-size:11.5pt;font-weight:900;margin-right:2.5mm}.sm-l span{font-size:8.8pt;color:var(--ink2)}
.sm-c ul{margin:1mm 0 0;padding-left:4.5mm;font-size:9pt;line-height:1.55}.sm-c li::marker{color:var(--tc,var(--acc))}
.sm-pn{font-size:9pt!important;color:var(--ink2)!important;padding-top:1.4mm}.sm-pn::before{content:'p.';font-weight:600}
.sm-warn{margin-top:4mm;font-size:8.8pt;color:#B42318;background:#FDF1F0;border-radius:3mm;padding:2.5mm 4mm}
.sm-ok{margin-top:4mm;font-size:8.8pt;color:var(--acc);background:var(--soft);border-radius:3mm;padding:2.5mm 4mm;font-weight:700}
.sm-foot{font-size:8pt;color:var(--ink3);margin-top:3mm}
@media print{
  .bk{display:block;gap:0}
  .pg-w{width:auto;height:auto;box-shadow:none;margin:0}
  .pg{transform:none;break-after:page;page-break-after:always}
  .pg-w:last-child .pg{break-after:auto;page-break-after:auto}
}`;
