/* ═══════════════════════════════════════════════════════════
   🧭 pagebar.js — 한 줄 머리 + ⚙ 설정 서랍 (v190 · 현우님이 고른 B안)
   sidebar.js 가 화면을 만들 때 한 번 불러온다. 화면 파일은 고치지 않는다.
   ① 화면 이름은 위 막대에 (아이콘 + 이름) — 본문 맨 위 큰 제목 · 설명 한 줄은 숨김
   ② 탭 줄 → 위 막대 같은 줄에 «거울 탭» (넓은 화면 · 자리가 될 때만)
      · 원래 탭 줄은 그대로 두고 숨긴다 → 거울 탭을 누르면 원래 탭을 대신 누름 (화면 코드는 그대로)
   ③ 설정 탭(⚙ 설정 · 설정·백업 · 직책 관리 · 준비 · 설정 …)은 탭 줄에서 빼고 오른쪽 위 «⚙» 서랍 안으로
      · 설정 화면을 열고 있을 때만 탭 줄에도 보인다 (돌아갈 곳이 보이게)
   ④ 화면마다 정한 보기 설정 · 관리 정보 → 서랍
      · 거울(기본): 원래 칸은 숨기고 똑같이 그려, 누르면 원래 것을 대신 누름 — 화면이 다시 그리면 거울도 다시
      · 옮김(move): 입력 칸이 든 것(직인 올리기 · 등록 정보)은 통째로 서랍 안으로 옮김
   ⑤ 카드 제목이 탭 이름과 같으면 숨김 (결재할 문서 › 결재할 문서 …)
   ⑥ 화면마다 정한 «위 막대로 올릴 것»(달 이동 · 시간표 보기 대상)도 거울로 위 막대에
   · 폰 · 좁은 화면: 탭은 본문에 그대로 · ⚙ 서랍은 아래에서 올라오는 판
   ═══════════════════════════════════════════════════════════ */
(function(){
  if(window.__pbOn) return;
  window.__pbOn = true;
  const FILE = ((location.pathname.split('/').pop() || '').replace(/\.html?$/, '')) || 'index';
  if(FILE === 'index') return;                                    // 홈은 따로 (홈 고르기)
  try{ if(localStorage.getItem('pb_off') === '1') return; }catch(e){}   // 시험용 · 예전 머리로 보기 (기기마다)

  /* ── 화면마다 ── (없으면 공통 규칙만)
     bar  : 위 막대로 올릴 것 [{ sel, hide(본문에서 숨길 것 · 기본 sel), skip(거울에서 뺄 것) }]
     dr   : 서랍에 넣을 것 [{ sel, t(묶음 이름), show(숨은 칸도 펼쳐서), move(통째로 옮김) }]
     hide : 늘 숨길 것 (서랍 · 위 막대로 간 것의 원래 자리)
     gear : ⚙ 단추 이름 · warn : 이것이 있으면 ⚙ 에 빨간 점
     wideOnly : 넓은 화면(폭 900 넘음)에서만 숨기고 서랍으로 — 폰은 화면이 원래 쓰던 접기 단추(📚 👀 🎯 · ⚙ 보기 설정)를 그대로 */
  const CFG = {
    academic: {
      gear: '보기 · 설정', wideOnly: 1,
      bar: [{ sel: '.ac-head .ac-toolbar', hide: '.ac-head', skip: '#vs-toggle' }],
      dr: [{ sel: '.ac-viewbox', t: '보는 중 — 캘린더 · 보기 · 학년' }, { sel: '#vs-drawer', t: '학년도 · 학년 표시', show: 1 }],
      hide: ['#vs-toggle', '.dw[data-dwk="ac-view"]', '#vs-drawer']
    },
    'timetable-final': {
      gear: '보기 · 설정', wideOnly: 1,
      bar: [{ sel: '#vw-bar' }],
      dr: [{ sel: '#vw-content .tv-set', t: '보기 · 크기', show: 1 }, { sel: '#pub-info', t: '게시본 · 세부 내용', show: 1 }],
      hide: ['.panel > .ptitle', '#vw-content .tv-setbtn', '#vw-content .tv-set', '#pub-info'],
      css: `#ms > .panel{background:none !important;border:0 !important;box-shadow:none !important;padding:0 !important;margin:0 !important}
#vw-content .tv-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 8px !important;padding:0 !important}
#vw-content .tv-head > div:first-child{display:flex;align-items:baseline;gap:4px 12px;flex-wrap:wrap}
#vw-content .tv-title{font-size:16px !important}
#vw-content .tv-sum{margin:0 !important}`
    },
    consult: {
      dr: [{ sel: '#cs .cs-legend', t: '표시 설명' }],
      hide: ['#cs .cs-legend']
    },
    cert: {
      gear: '직인 · 등록 정보',
      dr: [{ sel: '#seal-bar', t: '직인 · 등록 정보', move: 1 }],
      warn: '.sl-bar.warn'
    }
  };
  const C = CFG[FILE] || {};

  const TBAR = '.subtb, .subtabs, .tabs-main, .g-tabs, .wrap > .tabs, .nh-tabs.top, .cs-tabs, .tabs-sub';
  const TAB = 'button, a, .tab-main, .subtbtn, .tab-sub, .cs-tab, [role=tab]';
  const NOT_TAB_BAR = '.pb-dr, .mbox, .mov, #mwrap, .modal, .overlay, [role=dialog]';
  const SET_LEAD = /^\s*(⚙|💾)/;
  const SET_RE = /설정|백업|직책\s*관리/;
  const PH_H1 = '.sh-l > h1, .mt-hl > h1, .nh-hl > h1, .cs-head .hl > h1, h1.dr-h1, h1.pr-h1, .adl-hl > h2, h1.cbs-h1, h1.ac-title';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const root = document.documentElement;
  root.classList.add('pb-on');
  const roomyNow = () => (window.innerWidth || 0) > 900;
  root.classList.toggle('pb-roomy', roomyNow());
  try{ root.setAttribute('data-pb', FILE); }catch(e){}

  /* ── 모양 ── */
  const PRE = C.wideOnly ? 'html.pb-on.pb-roomy' : 'html.pb-on';
  const HIDE = (C.hide || []).map(s => `${PRE} ${s}:not(.pb-dr *)`);
  const BARHIDE = (C.bar || []).map(b => `html.pb-bar-on ${b.hide || b.sel}:not(.pb-dr *):not(#tb *)`);
  const CSS = `
html.pb-on #mn{padding-top:14px}
html.pb-on #mn .gx-ph-t{display:none}
html.pb-on #mn .gx-ph:not(.pb-keep-s) .gx-ph-s{display:none}
html.pb-on #mn .gx-ph{margin:0 0 10px;align-items:center}
html.pb-on #mn .gx-ph:not(.pb-keep-s):not(:has(> .gx-ph-a > *)){display:none}
html.pb-on #mn .pb-h1:not(.pb-dr *){display:none}
html.pb-on .pb-hid:not(.pb-dr *){display:none !important}
html.pb-on .pb-dup{display:none !important}
${HIDE.length ? HIDE.join(',\n') + '{display:none !important}' : ''}
${BARHIDE.length ? BARHIDE.join(',\n') + '{display:none !important}' : ''}
${C.css ? C.css.split('}').filter(x => x.trim()).map(r => PRE + ' ' + r.trim() + '}').join('\n') : ''}
/* 위 막대 — 화면 이름 · 탭 · 올린 것 */
html.pb-on #tb{gap:8px}
html.pb-on #tb .tb-crumb{flex:none;gap:0}
html.pb-on #tb .tb-g, html.pb-on #tb .tb-g + .tb-sep{display:none}
html.pb-tabs-on #tb #tb-tail{display:none}
html.pb-on #tb .tb-p{font-size:calc(17px * var(--zoom,1));font-weight:800;letter-spacing:-.01em;display:inline-flex;align-items:center;gap:8px}
#tb .pb-ic{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--sb-mint-2,#E4F1EA);color:var(--sb-green,#00704A);flex:none}
#tb .pb-ic .material-symbols-rounded{font-size:19px}
#tb .pb-vr{width:1px;height:24px;background:var(--line,#E4E2DB);flex:none;margin:0 4px}
#tb .pb-tabs{display:flex;align-items:stretch;align-self:stretch;gap:2px;flex:none}
#tb .pb-t{border:0;border-bottom:2.5px solid transparent;border-top:2.5px solid transparent;background:none;padding:0 11px;font:inherit;font-size:calc(13.5px * var(--zoom,1));font-weight:600;color:var(--ink-2,#56635D);white-space:nowrap;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border-radius:0}
#tb .pb-t:hover{color:var(--ink,#1F2320);background:var(--sb-mint-2,#EEF6F1)}
#tb .pb-t.on{color:var(--sb-green,#00704A);border-bottom-color:currentColor;font-weight:800}
#tb .pb-t .pb-n{background:var(--danger,#C2410C);color:#fff;border-radius:99px;padding:0 6px;font-size:11px;font-weight:800;line-height:17px}
#tb .pb-t.set .material-symbols-rounded{font-size:16px}
#tb .pb-bar{display:flex;align-items:center;gap:6px;flex:none}
#tb .pb-bar > *{margin:0 !important}
#tb .pb-bar :is(button, select, .btn){height:32px;font-size:calc(12.5px * var(--zoom,1))}
#tb .pb-sp{flex:1;min-width:8px}
#tb .pb-bar :is(.vw-bar, .ac-toolbar){display:flex;align-items:center;gap:6px;background:none !important;border:0 !important;padding:0 !important;box-shadow:none !important;margin:0 !important;flex-wrap:nowrap}
#tb .pb-bar .ac-nav{padding:2px;border-radius:10px}
#tb .pb-bar .ac-nav button{width:30px;height:30px}
#tb .pb-bar .ac-ym{min-width:108px;font-size:14.5px;line-height:1.15}
#tb .pb-bar .ac-ym small{font-size:10.5px}
#tb .pb-bar .vw-right{margin:0 !important}
#tb .pb-bar .vw-kb{height:32px;padding:0 11px}
#tb .pb-bar select{max-width:200px}
html.pb-tabs-on #tb .tb-help-l, html.pb-tabs-on #tb .tb-kbd{display:none}
html.pb-tabs-on #tb .tb-help{padding:0 10px !important;min-width:0 !important}
.pb-gear{display:inline-flex;align-items:center;gap:6px;height:34px;border-radius:10px;border:1.5px solid var(--sb-mint-3,#CFE6DA);background:var(--sb-mint-2,#E4F1EA);color:var(--sb-house,#173F31);
  font:inherit;font-size:calc(13px * var(--zoom,1));font-weight:800;padding:0 12px;cursor:pointer;white-space:nowrap;position:relative}
.pb-gear:hover, .pb-gear.on{background:var(--sb-house,#173F31);border-color:var(--sb-house,#173F31);color:#fff}
.pb-gear .material-symbols-rounded{font-size:18px}
.pb-gear .pb-dot{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#D14B3A;border:2px solid var(--surface,#fff)}
/* 서랍 */
.pb-scrim{position:fixed;inset:0;background:rgba(18,28,24,.22);z-index:88;opacity:0;pointer-events:none;transition:opacity .16s}
.pb-scrim.on{opacity:1;pointer-events:auto}
.pb-dr{position:fixed;top:0;right:0;bottom:0;width:min(440px,calc(100vw / var(--zoom,1)));background:var(--surface,#fff);border-left:1px solid var(--line,#E4E2DB);box-shadow:-14px 0 36px rgba(0,0,0,.12);
  z-index:90;display:flex;flex-direction:column;transform:translateX(102%);transition:transform .18s ease;visibility:hidden}
.pb-dr.on{transform:none;visibility:visible}
.pb-dr-h{height:56px;flex:none;display:flex;align-items:center;gap:10px;padding:0 10px 0 18px;border-bottom:1px solid var(--line,#E4E2DB);font-size:16px;font-weight:800;color:var(--ink,#1F2320)}
.pb-dr-h .material-symbols-rounded{color:var(--sb-green,#00704A)}
.pb-dr-x{margin-left:auto;width:40px;height:40px;border:0;background:none;border-radius:10px;cursor:pointer;color:var(--ink-2,#56635D);display:grid;place-items:center}
.pb-dr-x:hover{background:var(--sb-mint-2,#EEF6F1)}
.pb-dr-x:focus{outline:none}
.pb-dr-x:focus-visible{outline:2px solid var(--sb-green,#00704A);outline-offset:1px}
.pb-mir .vs-drawer{display:block !important;border:0 !important;background:none !important;padding:0 !important;margin:0 !important}
.pb-mir .vsd-t{display:none !important}
.pb-dr-b{flex:1;min-height:0;overflow:auto;padding:14px 18px 24px;display:flex;flex-direction:column;gap:18px}
.pb-sec{display:flex;flex-direction:column;gap:9px;min-width:0}
.pb-sec[hidden]{display:none}
.pb-sec-t{font-size:12px;font-weight:800;color:var(--ink-3,#6B7771);letter-spacing:.02em}
.pb-mir{min-width:0}
.pb-mir > *{margin:0 !important;max-width:100%}
.pb-mir :is(.avb-row){display:block !important;margin:0 0 10px !important}
.pb-mir :is(.avb-l){display:block !important;font-size:12px;font-weight:700;color:var(--ink-2,#56635D);margin:0 0 6px}
.pb-mir :is(.tv-set){display:block !important}
.pb-mir :is(.tv-opts, .tv-zoom){display:flex;flex-wrap:wrap;gap:10px 14px;margin:0 0 10px}
.pb-mir input:not([type=checkbox]):not([type=radio]), .pb-mir textarea{pointer-events:none;opacity:.7}
.pb-row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px 14px;border:1px solid var(--line,#E4E2DB);border-radius:12px;background:var(--surface,#fff);
  font:inherit;font-size:14px;font-weight:700;color:var(--ink,#1F2320);cursor:pointer}
.pb-row:hover{border-color:var(--sb-green,#00704A)}
.pb-row.on{border-color:var(--sb-green,#00704A);background:var(--sb-mint-2,#EEF6F1)}
.pb-row .material-symbols-rounded{color:var(--sb-green,#00704A);font-size:20px}
.pb-row small{display:block;font-weight:500;font-size:12px;color:var(--ink-3,#6B7771)}
.pb-row .pb-go{margin-left:auto;color:var(--ink-3,#6B7771)}
html[data-theme="dark"] .pb-dr{box-shadow:-14px 0 36px rgba(0,0,0,.45)}
html[data-theme="dark"] .pb-gear{background:#20352C;border-color:#2F4C40;color:#CFE9DC}
html[data-theme="dark"] .pb-gear:hover, html[data-theme="dark"] .pb-gear.on{background:#57C79A;border-color:#57C79A;color:#0F1915}
html[data-theme="dark"] #tb .pb-t.on{color:#7FD9B0}
html[data-theme="dark"] #tb .pb-ic{background:#20352C;color:#7FD9B0}
@media(max-width:900px){
  .pb-gear .pb-gl{display:none}
  .pb-gear{padding:0 9px}
  .pb-dr{top:auto;left:0;width:calc(100vw / var(--zoom,1));max-height:calc(86vh / var(--zoom,1));max-height:calc(86dvh / var(--zoom,1));border-left:0;border-top:1px solid var(--line,#E4E2DB);border-radius:18px 18px 0 0;transform:translateY(102%)}
  html.pb-on #tb .tb-p{font-size:calc(15.5px * var(--zoom,1))}
  #tb .pb-ic{width:26px;height:26px}
}
@media print{ .pb-dr, .pb-scrim, #tb .pb-tabs, #tb .pb-bar, .pb-gear{display:none !important} }
`;
  function style(){
    if(document.getElementById('pb-css')) return;
    const st = document.createElement('style'); st.id = 'pb-css'; st.textContent = CSS; document.head.appendChild(st);
    const s2 = document.createElement('style'); s2.id = 'pb-css-set';
    s2.textContent = 'html.pb-on .pb-set:not(.on):not(.active):not([aria-selected="true"]){display:none !important}';
    document.head.appendChild(s2);
  }

  /* ── 탭 이름 (아이콘 글자 · 알림 숫자 빼고) ── */
  const BADGE = '.badge,.tb-b,.nb,.cnt,.num,.dot,[class*="badge"],.pr-tc,.cs-n,.n';
  function labelOf(btn){
    const c = btn.cloneNode(true);
    c.querySelectorAll(BADGE + ',.gxe,.gxe-o,.material-symbols-rounded,.tab-ic,svg').forEach(x => x.remove());
    return (c.textContent || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  }
  function badgeOf(btn){
    const b = btn.querySelector(BADGE);
    let t = b ? (b.textContent || '').trim() : '';
    if(!b){ const m = /(\d+)\s*$/.exec(btn.textContent || ''); if(m) t = m[1]; }
    return t && t !== '0' ? t : '';
  }
  const isOn = el => el.matches('.on, .active, [aria-selected="true"]');
  const shown = el => !el.hidden && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';

  /* ── ① 화면 이름 → 위 막대 ── */
  let item = null;
  function pageItem(){
    if(item) return item;
    try{ item = (window.__PAGEKEY && typeof window.menuFind === 'function') ? window.menuFind(window.__PAGEKEY) : null; }catch(e){ item = null; }
    return item;
  }
  function paintTitle(){
    const tb = document.getElementById('tb'); if(!tb) return;
    const p = tb.querySelector('.tb-crumb .tb-p'); if(!p) return;
    const it = pageItem();
    if(it && !p.querySelector('.pb-ic')){
      const ic = document.createElement('span');
      ic.className = 'pb-ic'; ic.setAttribute('aria-hidden', 'true');
      ic.innerHTML = `<span class="material-symbols-rounded">${esc(it.icon || 'description')}</span>`;
      p.insertBefore(ic, p.firstChild);
    }
    // 숨긴 제목의 도움말(ⓘ)은 이름 위에 올리면 보이게
    if(!p.title){
      const h = document.querySelector('#mn [aria-label^="도움말"], #mn .gx-ph-s');
      const t = h ? (h.getAttribute('aria-label') || h.textContent || '').replace(/^도움말\s*—\s*/, '').trim() : '';
      if(t) p.title = t;
    }
    const ph = document.querySelector('#mn .gx-ph');
    if(ph) ph.classList.toggle('pb-keep-s', !!(window.__gxPh && window.__gxPh.sub));
    // 화면이 직접 그린 큰 제목 — 화면 이름과 같을 때만 숨김 («나에게 공유된 주제»처럼 다른 말이면 그대로 둠)
    const lab = it ? norm(it.label) : '';
    if(lab) document.querySelectorAll('#mn :is(' + PH_H1 + ')').forEach(h => {
      if(h.closest('.pb-dr')) return;
      const same = norm(labelOf(h)).startsWith(lab);
      if(h.classList.contains('pb-h1') !== same) h.classList.toggle('pb-h1', same);
    });
  }

  /* ── 거울 — 원래 칸을 똑같이 그리고, 누르면 원래 것을 대신 ── */
  function cloneOf(src, o){
    const c = src.cloneNode(true);
    for(const el of [c, ...c.querySelectorAll('*')]){
      if(el.hasAttribute && (el.hasAttribute('onclick') || el.matches('button, a, label, summary, select, input'))) el.setAttribute('data-pb-c', '');
      for(const a of [...el.attributes]){
        const n = a.name;
        if(n.startsWith('on') || n === 'id' || n === 'name' || n === 'for' || n === 'data-dw' || n === 'data-dwk' || n === 'autofocus') el.removeAttribute(n);
      }
    }
    c.classList.remove('pb-hid');
    if(o && o.show){ c.style.display = ''; c.hidden = false; c.classList.add('open'); }
    if(o && o.skip) src.querySelectorAll(o.skip).forEach(s => { const q = resolve(c, pathOf(src, s)); if(q) q.style.display = 'none'; });
    return c;
  }
  function pathOf(top, el){ const p = []; while(el && el !== top){ const par = el.parentElement; if(!par) return null; p.unshift([...par.children].indexOf(el)); el = par; } return el === top ? p : null; }
  function resolve(top, p){ let el = top; for(const i of (p || [])){ el = el && el.children[i]; } return el || null; }
  /* 다시 그릴 때 — 손(키보드)이 있던 칸으로 돌려놓기 */
  function keepFocus(box, redraw, keyOf, find){
    const a = document.activeElement;
    const k = a && a !== document.body && box && box.contains(a) ? keyOf(a) : null;
    redraw();
    if(k == null) return;
    const n = find(k);
    if(n && n.isConnected && typeof n.focus === 'function'){ try{ n.focus({ preventScroll: true }); }catch(e){} }
  }
  /* 거울 한 칸 — host 안에 원래 칸(src)의 사본을 둔다 · 바뀌었을 때만 다시 */
  function Mirror(host, getSrc, o){
    const m = { host, getSrc, o: o || {}, sig: '', clone: null, src: null };
    m.sync = function(){
      const src = m.getSrc();
      if(!src){ if(m.clone){ m.host.innerHTML = ''; m.clone = null; m.sig = ''; } m.src = null; return false; }
      const sig = src.outerHTML.replace(/ ?pb-hid/g, '');
      if(sig === m.sig && m.clone && m.src === src) return true;
      m.sig = sig; m.src = src;
      const old = m.clone;
      keepFocus(m.host, () => { m.clone = cloneOf(src, m.o); m.host.replaceChildren(m.clone); },
        a => old ? pathOf(old, a) : null, p => resolve(m.clone, p));
      return true;
    };
    host.addEventListener('click', e => {
      if(!m.clone || !m.src) return;
      const t = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
      if(!t || !m.clone.contains(t)) return;
      if(t.closest('select')) return;                                   // 고르기 칸은 change 로
      const p = pathOf(m.clone, t);
      const o = p && resolve(m.src, p);
      e.preventDefault(); e.stopPropagation();
      if(o && o.isConnected) o.click();
      kick();
    }, true);
    host.addEventListener('change', e => {
      const s = e.target; if(!s || s.tagName !== 'SELECT' || !m.clone || !m.src) return;
      e.stopPropagation();
      const o = resolve(m.src, pathOf(m.clone, s));
      if(o && o.tagName === 'SELECT'){
        o.value = s.value;
        o.dispatchEvent(new Event('input', { bubbles: true }));
        o.dispatchEvent(new Event('change', { bubbles: true }));
      }
      kick();
    }, true);
    return m;
  }
  const firstOf = sel => { for(const el of document.querySelectorAll(sel)){ if(!el.closest('.pb-dr') && !el.closest('#tb')) return el; } return null; };

  /* ── ③ ⚙ 서랍 ── */
  let dr = null, scrim = null, gear = null, setSec = null, lastFocus = null;
  const secs = [];      // { cfg, sec, host, mirror? }
  function buildDrawer(){
    if(dr) return;
    const mn = document.getElementById('mn'); if(!mn) return;
    scrim = document.createElement('div'); scrim.className = 'pb-scrim';
    scrim.addEventListener('click', closeDr);
    dr = document.createElement('aside');
    dr.className = 'pb-dr'; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-modal', 'true'); dr.setAttribute('aria-label', '설정 서랍'); dr.tabIndex = -1;
    dr.innerHTML = `<div class="pb-dr-h no-gx"><span class="material-symbols-rounded" aria-hidden="true">tune</span><span class="pb-dr-tt"></span><button type="button" class="pb-dr-x" aria-label="닫기"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div><div class="pb-dr-b"></div>`;
    dr.querySelector('.pb-dr-x').addEventListener('click', closeDr);
    const body = dr.querySelector('.pb-dr-b');
    (C.dr || []).forEach(cf => {
      const sec = document.createElement('section'); sec.className = 'pb-sec'; sec.hidden = true;
      sec.innerHTML = `<div class="pb-sec-t">${esc(cf.t || '')}</div><div class="pb-mir"></div>`;
      body.appendChild(sec);
      const host = sec.querySelector('.pb-mir');
      host.classList.add(cf.move ? 'pb-mv' : 'no-gx');                     // 옮긴 칸은 진짜 칸 — 화면 규칙(아이콘 · 다시 그리기)이 그대로
      const s = { cfg: cf, sec, host };
      if(!cf.move) s.mirror = Mirror(host, () => firstOf(cf.sel), cf);
      secs.push(s);
    });
    setSec = document.createElement('section'); setSec.className = 'pb-sec'; setSec.hidden = true;
    setSec.innerHTML = `<div class="pb-sec-t">설정 · 관리 — 가끔 여는 화면</div><div class="pb-rows no-gx"></div>`;
    body.appendChild(setSec);
    setSec.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.pb-row'); if(!b) return;
      const t = setTabs[+b.dataset.i]; closeDr();
      if(t && t.isConnected) t.click();
      setTimeout(kick, 60);
    });
    mn.appendChild(scrim); mn.appendChild(dr);
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && dr.classList.contains('on')){ e.stopPropagation(); closeDr(); }
      if(e.key === 'Tab' && dr.classList.contains('on')){                      // 서랍 안에서만 돌기
        const f = [...dr.querySelectorAll('button, a[href], select, input, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(x => x.getClientRects().length && !x.disabled);
        if(!f.length) return;
        if(e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
        else if(!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
      }
    }, true);
  }
  function drawerHas(){ return secs.some(s => !s.sec.hidden) || setTabs.length > 0; }
  function syncDrawer(){
    if(!dr) return;
    const roomy = root.classList.contains('pb-roomy');
    for(const s of secs){
      if(C.wideOnly && !roomy){ s.sec.hidden = true; continue; }        // 폰 — 원래 자리에 그대로 있음
      if(s.cfg.move){
        const el = firstOf(s.cfg.sel) || s.host.firstElementChild;
        if(el && !s.host.contains(el)) s.host.replaceChildren(el);     // 서랍 안으로 통째로 (입력 칸 · 파일 올리기가 그대로 동작)
        s.sec.hidden = !(s.host.firstElementChild && (s.host.firstElementChild.textContent || '').trim());
      } else {
        // 닫혀 있을 때는 «있는지»만 (거울은 열 때 그림)
        if(dr.classList.contains('on')) s.sec.hidden = !s.mirror.sync();
        else s.sec.hidden = !firstOf(s.cfg.sel);
      }
    }
    const rows = setSec.querySelector('.pb-rows');
    const sig = setTabs.map(t => labelOf(t) + (isOn(t) ? '*' : '')).join('|');
    if(rows.getAttribute('data-sig') !== sig){
      rows.setAttribute('data-sig', sig);
      keepFocus(rows, () => { rows.innerHTML = setTabs.map((t, i) => `<button type="button" class="pb-row${isOn(t) ? ' on' : ''}" data-i="${i}"><span class="material-symbols-rounded" aria-hidden="true">${/백업|정리/.test(labelOf(t)) ? 'backup' : /직책/.test(labelOf(t)) ? 'badge' : 'settings'}</span><span>${esc(labelOf(t))}<small>${isOn(t) ? '지금 열려 있어요' : '누르면 이 화면으로'}</small></span><span class="pb-go" aria-hidden="true">›</span></button>`).join(''); },
        a => { const b = a.closest('.pb-row'); return b ? b.dataset.i : null; }, i => rows.querySelector(`.pb-row[data-i="${i}"]`));
    }
    setSec.hidden = !setTabs.length;
    dr.querySelector('.pb-dr-tt').textContent = gearLabel();
  }
  function gearLabel(){
    if(C.gear && !(C.wideOnly && !root.classList.contains('pb-roomy'))) return C.gear;
    if(setTabs.length === 1) return labelOf(setTabs[0]) || '설정';
    return '설정';
  }
  function openDr(){
    buildDrawer(); if(!dr) return;
    lastFocus = document.activeElement;
    dr.classList.add('on'); scrim.classList.add('on'); if(gear) gear.classList.add('on'), gear.setAttribute('aria-expanded', 'true');
    syncDrawer();
    setTimeout(() => { try{ (dr.querySelector('.pb-dr-x')).focus(); }catch(e){} }, 30);
  }
  function closeDr(){
    if(!dr) return;
    dr.classList.remove('on'); scrim.classList.remove('on'); if(gear) gear.classList.remove('on'), gear.setAttribute('aria-expanded', 'false');
    try{ if(lastFocus && lastFocus.isConnected) lastFocus.focus(); }catch(e){}
  }
  window.pbOpen = openDr; window.pbClose = closeDr;

  /* ── ② 탭 줄 · 거울 탭 ── */
  let bar = null, setTabs = [], tabsEl = null, barEl = null, sp = null, vr = null;
  const barMirrors = [];
  function findBar(){
    if(bar && bar.isConnected) return bar;
    bar = null;
    const mn = document.getElementById('mn'); if(!mn) return null;
    const top0 = mn.getBoundingClientRect().top;
    for(const b of mn.querySelectorAll(TBAR)){
      if(b.closest(NOT_TAB_BAR)) continue;
      if(!b.classList.contains('pb-hid') && !b.getClientRects().length) continue;
      if(!b.classList.contains('pb-hid') && b.getBoundingClientRect().top - top0 > 380) continue;   // 맨 위 탭 줄만 (안쪽 작은 탭은 그대로)
      const kids = [...b.children].filter(c => c.matches(TAB));
      if(kids.length < 2) continue;
      bar = b; break;
    }
    return bar;
  }
  function isSetTab(c){ return SET_LEAD.test(c.textContent || '') || (SET_RE.test(labelOf(c)) && !/편집/.test(labelOf(c))); }

  let wide = false, fitOK = { tabs: true, bar: true };
  function measureWide(){ const tb = document.getElementById('tb'); return !!tb && tb.clientWidth >= 1000 && (window.innerWidth || 0) > 900; }

  function ensureTbSlots(){
    const tb = document.getElementById('tb'); if(!tb) return false;
    const crumb = tb.querySelector('.tb-crumb'); const right = tb.querySelector('.tb-right');
    if(!crumb || !right) return false;
    if(!vr){ vr = document.createElement('span'); vr.className = 'pb-vr'; vr.setAttribute('aria-hidden', 'true'); }
    if(!tabsEl){ tabsEl = document.createElement('div'); tabsEl.className = 'pb-tabs no-gx'; tabsEl.setAttribute('role', 'tablist');
      tabsEl.addEventListener('click', e => {
        const b = e.target.closest && e.target.closest('.pb-t'); if(!b) return;
        const t = curTabs[+b.dataset.i]; if(t && t.isConnected) t.click();
        setTimeout(kick, 40);
      });
    }
    if(!barEl){ barEl = document.createElement('div'); barEl.className = 'pb-bar no-gx';
      (C.bar || []).forEach(cf => { const h = document.createElement('div'); h.style.display = 'contents'; barEl.appendChild(h); barMirrors.push(Mirror(h, () => { const s = firstOf(cf.sel); return s && s.style.display !== 'none' && !s.hidden ? s : null; }, cf)); });
    }
    if(!sp){ sp = document.createElement('span'); sp.className = 'pb-sp'; }
    if(vr.parentNode !== tb || crumb.nextSibling !== vr){ crumb.after(vr); vr.after(tabsEl); tabsEl.after(barEl); barEl.after(sp); }
    // ⚙
    if(!gear){
      gear = document.createElement('button'); gear.type = 'button'; gear.className = 'pb-gear';
      gear.setAttribute('aria-haspopup', 'dialog'); gear.setAttribute('aria-expanded', 'false');
      gear.addEventListener('click', () => (dr && dr.classList.contains('on')) ? closeDr() : openDr());
    }
    const org = right.querySelector('#tb-org');
    if(gear.parentNode !== right){ if(org) org.after(gear); else right.insertBefore(gear, right.firstChild); }
    return true;
  }

  let curTabs = [], visMemo = {};
  function syncTabs(){
    const b = findBar();
    setTabs = [];
    const normal = [];
    if(b){
      const kids = [...b.children].filter(c => c.matches(TAB));
      // 화면이 숨긴 탭인지 — 내 규칙은 잠시 끄고 잼 (DOM 은 안 바뀜) · 탭 줄이 그대로면 지난번 값 (끄고 켜면 화면 전체 모양 계산이 다시 돎)
      const key = document.body.className + '§' + b.outerHTML.replace(/ ?pb-(hid|set)/g, '');
      let vis = visMemo.key === key && visMemo.bar === b && visMemo.n === kids.length ? visMemo.vis : null;
      if(!vis){
        const ss = document.getElementById('pb-css-set'); if(ss) ss.disabled = true;
        vis = kids.map(c => !c.hidden && c.style.display !== 'none' && getComputedStyle(c).display !== 'none');
        if(ss) ss.disabled = false;
        visMemo = { key, bar: b, n: kids.length, vis };
      }
      kids.forEach((c, i) => {
        const s = isSetTab(c);
        if(c.classList.contains('pb-set') !== s) c.classList.toggle('pb-set', s);
        if(vis[i]) (s ? setTabs : normal).push(c);
      });
    }
    const setOn = setTabs.filter(isOn);
    curTabs = normal.concat(setOn);
    // 한 탭만 남으면(설정을 뺀 뒤) 탭 줄을 통째로 숨김 — 이름은 위 막대에 이미 있음
    const single = normal.length <= 1 && !setOn.length;
    const proxy = !!b && wide && fitOK.tabs && curTabs.length >= 2;
    if(b) b.classList.toggle('pb-hid', single || proxy);
    root.classList.toggle('pb-tabs-on', proxy);
    if(!tabsEl) return;
    if(!proxy){ if(tabsEl.childElementCount) tabsEl.replaceChildren(); tabsEl.removeAttribute('data-sig'); vr.style.display = 'none'; return; }
    vr.style.display = '';
    const sig = curTabs.map(t => labelOf(t) + (isOn(t) ? '*' : '') + badgeOf(t)).join('|');
    if(tabsEl.getAttribute('data-sig') === sig) return;
    tabsEl.setAttribute('data-sig', sig);
    keepFocus(tabsEl, () => { tabsEl.innerHTML = curTabs.map((t, i) => {
      const on = isOn(t), s = t.classList.contains('pb-set'), bd = badgeOf(t);
      return `<button type="button" class="pb-t${on ? ' on' : ''}${s ? ' set' : ''}" role="tab" aria-selected="${on}" data-i="${i}">${s ? '<span class="material-symbols-rounded" aria-hidden="true">settings</span>' : ''}${esc(labelOf(t))}${bd ? `<span class="pb-n">${esc(bd)}</span>` : ''}</button>`;
    }).join(''); }, a => { const b = a.closest('.pb-t'); return b ? b.dataset.i : null; }, i => tabsEl.querySelector(`.pb-t[data-i="${i}"]`));
  }

  function syncBar(){
    const on = wide && fitOK.bar && barMirrors.length > 0;
    let any = false;
    if(on){ for(const m of barMirrors){ if(m.sync()) any = true; } }
    else for(const m of barMirrors){ if(m.clone){ m.host.replaceChildren(); m.clone = null; m.sig = ''; } }
    root.classList.toggle('pb-bar-on', on && any);
    if(barEl) barEl.style.display = on && any ? '' : 'none';
  }

  function syncGear(){
    if(!gear) return;
    buildDrawer();
    if(dr) syncDrawer();
    const has = drawerHas();
    gear.style.display = has ? '' : 'none';
    const w = C.warn && document.querySelector(C.warn);
    const lab = gearLabel();
    const html = `<span class="material-symbols-rounded" aria-hidden="true">tune</span><span class="pb-gl">${esc(lab)}</span>${w ? '<span class="pb-dot" aria-hidden="true"></span>' : ''}`;
    if(gear.getAttribute('data-v') !== html){ gear.setAttribute('data-v', html); gear.innerHTML = html; gear.setAttribute('aria-label', lab + (w ? ' — 확인할 것이 있어요' : '')); gear.title = lab; }
  }

  /* ── 도우미(helper.js)가 짚을 곳이 숨어 있으면 — 대신 보이는 것 (위 막대 거울 탭 · 위 막대 사본 · ⚙) ── */
  window.pbStand = function(el){
    try{
      if(!el || !el.isConnected) return null;
      const tab = el.closest && el.closest(TAB);
      const i = tab ? curTabs.indexOf(tab) : -1;
      if(i >= 0 && tabsEl){ const b = tabsEl.querySelector(`.pb-t[data-i="${i}"]`); if(b && b.getClientRects().length) return b; }
      if(tab && setTabs.includes(tab)){
        if(dr && dr.classList.contains('on') && setSec){ const r = setSec.querySelector(`.pb-row[data-i="${setTabs.indexOf(tab)}"]`); if(r && r.getClientRects().length) return r; }
        if(gear && gear.getClientRects().length) return gear;
      }
      for(const m of barMirrors){
        if(m.src && m.clone && m.src.contains(el)){ const c = resolve(m.clone, pathOf(m.src, el)); if(c && c.getClientRects().length) return c; }
      }
      const open = !!(dr && dr.classList.contains('on'));
      if(open){                                                          // 서랍이 열려 있으면 — 서랍 안 사본을 짚는다
        for(const x of secs){
          const m = x.mirror;
          if(m && m.src && m.clone && m.src.contains(el)){ const c = resolve(m.clone, pathOf(m.src, el)); if(c && c.getClientRects().length) return c; }
        }
        if(dr.contains(el)) return null;
      }
      const inDr = (dr && dr.contains(el)) || secs.some(x => { const src = x.mirror ? (x.mirror.src || firstOf(x.cfg.sel)) : null; return src && src.contains(el); });
      if(inDr && gear && gear.getClientRects().length && !open) return gear;
    }catch(e){}
    return null;
  };

  /* ── ⑤ 카드 제목 = 탭 이름 → 숨김 ── */
  function norm(t){ return String(t || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{200D}ⓘℹ]/gu, '').replace(/\s*\d+\s*$/, '').replace(/\s+/g, '').trim(); }
  function syncDup(){
    const mn = document.getElementById('mn'); if(!mn) return;
    const names = new Set();
    const onTab = curTabs.find(isOn) || (bar ? [...bar.children].find(c => c.matches(TAB) && isOn(c)) : null);
    if(onTab) names.add(norm(labelOf(onTab)));
    const it = pageItem(); if(it) names.add(norm(it.label));
    names.delete('');
    mn.querySelectorAll('.pb-dup').forEach(x => { const own = norm(labelOf(x)); if(!names.has(own)) x.classList.remove('pb-dup'); });
    if(!names.size) return;
    const top0 = mn.getBoundingClientRect().top;
    let n = 0;
    for(const h of mn.querySelectorAll('.actitle, .ptitle, .ctitle, h2, h3')){
      if(h.closest('.pb-dr, .mbox, .mov, #mwrap, .modal, .overlay, [role=dialog], #print-area, .sheet-doc')) continue;
      if(!h.getClientRects().length && !h.classList.contains('pb-dup')) continue;
      if(!h.classList.contains('pb-dup') && h.getBoundingClientRect().top - top0 > 420) break;
      if(++n > 4) break;
      if(h.querySelector('input, select, textarea, button:not(.gx-info), a')) continue;
      if(names.has(norm(labelOf(h))) && !h.classList.contains('pb-dup')) h.classList.add('pb-dup');   // 이미 있으면 건드리지 않음 (건드리면 바뀜 알림 → 끝없이 다시)
    }
  }

  /* ── 맞추기 — 화면이 바뀌면 (한 프레임에 한 번) ── */
  let raf = 0, busy = false, lastRun = 0, tmr = 0;
  const GAP = 90;                                                        // 끌어 옮기기처럼 바뀜이 쏟아질 때 — 0.09초에 한 번까지만
  function kick(){
    if(raf || tmr) return;
    const wait = GAP - ((window.performance ? performance.now() : Date.now()) - lastRun);
    if(wait > 0) tmr = setTimeout(() => { tmr = 0; kick(); }, wait);
    else raf = requestAnimationFrame(run);
  }
  function run(){
    raf = 0; if(busy) return; busy = true;
    lastRun = window.performance ? performance.now() : Date.now();
    window.__pbRuns = (window.__pbRuns || 0) + 1;                        // 시험용 — 가만히 있을 때 늘지 않아야 함
    try{
      root.classList.toggle('pb-roomy', roomyNow());
      if(document.body.classList.contains('share-mode')){ root.classList.remove('pb-on'); busy = false; return; }
      style();
      if(!ensureTbSlots()){ busy = false; return; }
      paintTitle();
      wide = measureWide();
      syncTabs();
      syncBar();
      syncGear();
      syncDup();
      fit();
    }catch(e){ try{ console.warn('pagebar', e); }catch(_){} }
    busy = false;
  }
  /* 위 막대가 넘치면 — 올린 것부터 내려놓고, 그래도 넘치면 탭도 본문으로 */
  function fit(){
    const tb = document.getElementById('tb'); if(!tb || !wide) return;
    const over = () => tb.scrollWidth > tb.clientWidth + 2;
    if(!over()) return;
    if(fitOK.bar && barMirrors.length && root.classList.contains('pb-bar-on')){ fitOK.bar = false; syncBar(); if(!over()) return; }
    if(fitOK.tabs && root.classList.contains('pb-tabs-on')){ fitOK.tabs = false; syncTabs(); }
  }
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { fitOK = { tabs: true, bar: true }; kick(); }, 120); });

  function watch(){
    const mn = document.getElementById('mn'), tb = document.getElementById('tb');
    try{
      new MutationObserver(ms => {
        for(const m of ms){
          const t = m.target;
          if(t && t.nodeType === 1 && t.closest && t.closest('.pb-dr') && !t.closest('.pb-mv')) continue;   // 서랍 안 거울은 무시 (옮긴 진짜 칸은 봄 — 빨간 점)
          kick(); return;
        }
      }).observe(mn, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-selected', 'disabled', 'value'], characterData: true });
    }catch(e){}
    try{ new MutationObserver(() => kick()).observe(tb, { childList: true }); }catch(e){}   // 위 막대를 다시 그리면 (알림 숫자 · 기관 바꾸기)
  }
  function boot(){
    if(!document.getElementById('mn') || !document.getElementById('tb')){ setTimeout(boot, 60); return; }
    style(); run(); watch();
    [250, 900, 2200, 4500].forEach(t => setTimeout(kick, t));
    document.addEventListener('click', e => { if(e.target && e.target.closest && e.target.closest(TBAR)) setTimeout(kick, 50); }, true);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
