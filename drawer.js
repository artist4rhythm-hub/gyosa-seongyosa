/* ═══ 서랍 정리 (drawer.js · v2026.10.14-119) ═══
   «처음엔 지금 상태만 · 열면 할 일 · 더 열면 설명»

   쓰는 법
     1) 서랍으로 만들 덩어리에 data-dw="키" 를 붙인다 (.acard · .asc 등)
        — 바로 아래 .actitle(또는 h3) 은 서랍 이름, .adesc 는 한 줄 설명 + «자세히» 로 쓴다
     2) 페이지 스크립트에서 Drawer.def('키', { … }) 로 아이콘·요약을 알려 준다
          icon  : Material Symbols 이름 (사이드바와 같은 글꼴)
          title : 서랍 이름 (없으면 .actitle 글자에서 이모지를 뺀 것)
          sum   : el => '지금 상태 한 줄' (HTML · <b> 가능) — 안의 내용이 바뀔 때마다 다시 계산
          badge : el => [['3개'], ['켜짐','ok'], ['설정 필요','warn']]
          lead  : 한 줄 설명 (없으면 .adesc 첫 문장 · 함수도 됨 el => '…')
          more  : «자세히»에 덧붙일 글 (HTML)
          moreSel : 바로 아래 자식 중 이 선택자에 맞는 도움말 상자는 감추고 «자세히» 안으로 (예: '.help')
          group : 묶음 이름 — 바로 앞 서랍과 다르면 위에 작은 이름표
          open  : true 면 처음 열려 있음 (이 기기에 기억된 것이 있으면 그것을 따름)
          compact : true 면 얇은 한 줄 (도구 줄용 — 이름과 요약을 한 줄에, 요약은 <span class="dw-chip"> 로)
          hint  : 오른쪽 끝 작은 글 (예: '보기 바꾸기')
          add   : { label:'기간 넣기', form:['.fg','button.bp'] }
                  — 바로 아래 자식 중 form 에 맞는 것은 «+ 넣기»를 눌러야 보인다 (목록이 먼저)
          tools : [{ sel:'.hol-kr', label:'법정 공휴일 한 번에 담기', icon:'event_available' }]
                  — 가끔 쓰는 도구 줄의 select·button 을 흰 단추 한 줄로, 설명은 «자세히»로
          ro    : true 또는 el => true 면 «보기 전용» (넣기 · 도구 · ✕(.bx) · [data-ro-hide] 를 숨김) — v119
          roNote: 보기 전용일 때 안쪽 맨 위 한 줄 (예: '기관관리자 · 수퍼관리자만 바꿀 수 있어요')
          space : 아래 간격(px) — 서랍이 아닌 카드와 섞여 있는 곳에서 카드 간격에 맞출 때 (예: 16)
          head  : 바로 아래 자식 중 제목 줄(예: '.panel-head') — 숨기고 그 안의 단추만 도구 줄로 옮긴다
     3) 내용은 페이지가 그대로 그린다. 서랍은 감싸기만 하고 저장·onclick·id 는 건드리지 않는다.
        페이지가 innerHTML 로 다시 그려도 알아서 다시 감싼다 (MutationObserver).
   기억: 마지막으로 연 서랍은 이 기기에만 (localStorage «dw:페이지»)
   숨은 서랍 안의 칸으로 scrollIntoView · focus 하면 그 서랍이 먼저 열린다 (도우미 짚어 주기 포함) */
(function(){
  if(window.Drawer) return;
  const DEF = Object.create(null);
  const PAGE = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  const LSK = 'dw:' + PAGE;
  let mem = {};
  try { mem = JSON.parse(localStorage.getItem(LSK) || '{}') || {}; } catch(_){ mem = {}; }
  const remember = () => { try { localStorage.setItem(LSK, JSON.stringify(mem)); } catch(_){} };
  const ic = (n, cls) => `<span class="material-symbols-rounded${cls ? ' ' + cls : ''}" aria-hidden="true">${n}</span>`;
  const EMO = /[\u{1F000}-\u{1FAFF}☀-➿⬀-⯿←-⇿️‍]/gu;
  const strip = s => String(s == null ? '' : s).replace(EMO, '').replace(/\s+/g, ' ').trim();
  const kids = (el, sel) => { try { return [...el.querySelectorAll(':scope > ' + sel)]; } catch(_){ return []; } };

  /* ── 모양 ── */
  const CSS = `
  .dw-stack{ display:flex; flex-direction:column; gap:10px !important; }   /* display 에 !important 를 쓰면 탭을 감춘 style="display:none" 을 이겨 버린다 */
  .dw-bar{ display:flex; justify-content:flex-end; margin:-4px 2px -2px; }
  .dw-all{ border:0; background:none; color:var(--gm); font:inherit; font-size:13px; font-weight:700; cursor:pointer;
    padding:4px 4px; display:inline-flex; align-items:center; gap:2px; border-radius:8px; }
  .dw-all .material-symbols-rounded{ font-size:18px; }
  .dw-grp{ font-size:12px; font-weight:700; color:var(--ink-3, var(--tl)); margin:10px 4px -2px; letter-spacing:.02em; }
  .dw-grp:first-child, .dw-bar + .dw-grp{ margin-top:0; }
  .dw{ background:var(--surface, var(--wh)); border:1px solid var(--line, var(--ivd)); border-radius:12px; overflow:hidden;
    box-shadow:0 1px 2px rgba(30,57,50,.05); --dw-open-line:#BFDCCF; --dw-open-head:var(--sb-mint-2, var(--gp)); }
  html[data-theme="dark"] .dw{ --dw-open-line:#2E5A48; box-shadow:none; }
  .dw-h{ display:flex; align-items:center; gap:14px; padding:13px 18px; min-height:66px; cursor:pointer; user-select:none;
    -webkit-tap-highlight-color:transparent; outline:none; }
  .dw-h:focus-visible{ box-shadow:inset 0 0 0 2px var(--gm); border-radius:12px; }
  .dw-ic{ width:38px; height:38px; border-radius:10px; background:var(--sb-mint-2, var(--gp)); color:var(--gm);
    display:flex; align-items:center; justify-content:center; flex:none; }
  .dw-ic .material-symbols-rounded{ font-size:21px; }
  .dw-t{ flex:1; min-width:0; }
  .dw-tt{ font-size:15px; font-weight:700; color:var(--ink, var(--gd)); letter-spacing:-.01em; line-height:1.35; }
  .dw-s{ font-size:13px; color:var(--ink-2, var(--ts)); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.4; }
  .dw-s:empty{ display:none; }
  .dw-s b{ color:var(--ink, var(--gd)); font-weight:700; }
  .dw-bd{ display:flex; gap:6px; flex:none; }
  .dw-b{ font-size:12px; font-weight:700; padding:3px 10px; border-radius:100px; background:var(--line-soft, var(--iv)); color:var(--ink-2, var(--ts)); white-space:nowrap; }
  .dw-b.ok{ background:var(--ok-bg); color:var(--ok); } .dw-b.warn{ background:var(--warn-bg); color:var(--warn); }
  .dw-b.info{ background:var(--info-bg); color:var(--info); } .dw-b.danger{ background:var(--danger-bg); color:var(--danger); }
  .dw-cv{ color:var(--ink-3, var(--tl)); flex:none; transition:transform .2s cubic-bezier(.2,.8,.2,1); }
  .dw.open{ border-color:var(--dw-open-line); box-shadow:0 4px 16px rgba(30,57,50,.08); }
  .dw.open > .dw-h{ background:var(--dw-open-head); border-bottom:1px solid var(--dw-open-line); }
  .dw.open > .dw-h .dw-cv{ transform:rotate(180deg); color:var(--gm); }
  .dw-body{ display:none; padding:16px 20px 20px; }
  .dw.open > .dw-body{ display:block; }
  .dw > .dw-body > .dw-card{ background:none !important; box-shadow:none !important; padding:0 !important; margin:0 !important;
    border:0 !important; border-radius:0 !important; animation:none !important; transform:none !important; }
  .dw-card > .dw-hd{ display:none !important; }
  .dw-lead{ font-size:13px; color:var(--ink-2, var(--ts)); margin:0 0 14px; line-height:1.6; }
  .dw-lead:empty{ display:none; }
  .dw-ronote{ display:flex; align-items:center; gap:7px; font-size:12.5px; font-weight:700; color:var(--ink-2, var(--ts)); background:var(--iv, #F4F2EC); border-radius:10px; padding:8px 12px; margin:0 0 12px; }
  .dw-ronote:empty{ display:none; }
  .dw-ronote .material-symbols-rounded{ font-size:17px; }
  .dw-ro .dw-tools, .dw-ro .dw-addbox, .dw-ro .bx, .dw-ro [data-ro-hide]{ display:none !important; }
  .dw-mb{ border:0; background:none; color:var(--gm); font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; padding:0 2px; margin-left:4px;
    display:inline-flex; align-items:center; vertical-align:-3px; }
  .dw-mb .material-symbols-rounded{ font-size:17px; transition:transform .2s; }
  .dw.more-on .dw-mb .material-symbols-rounded{ transform:rotate(180deg); }
  .dw-more{ display:none; font-size:12.5px; color:var(--ink-2, var(--ts)); background:var(--bg, var(--iv)); border-radius:10px;
    padding:10px 14px; margin:-6px 0 14px; line-height:1.7; }
  .dw.more-on .dw-more:not(:empty){ display:block; }
  .dw-tools{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:0 0 12px; }
  .dw-tools .dw-sp{ flex:1; }
  .dw-add{ font:inherit; font-size:13px; font-weight:700; border:0; border-radius:10px; padding:9px 16px; background:var(--gm); color:#fff;
    cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
  html[data-theme="dark"] .dw-add{ color:#06130E; }
  .dw-add .material-symbols-rounded{ font-size:18px; transition:transform .2s; }
  .dw-adding .dw-add .material-symbols-rounded{ transform:rotate(45deg); }
  .dw-tool{ font:inherit !important; font-size:13px !important; font-weight:700 !important; border:1px solid var(--line, var(--ivd)) !important;
    border-radius:10px !important; padding:8px 14px !important; background:var(--surface, var(--wh)) !important; color:var(--ink, var(--gd)) !important;
    cursor:pointer; display:inline-flex !important; align-items:center; gap:6px; height:auto !important; }
  .dw-tool .material-symbols-rounded{ font-size:18px; color:var(--gm); }
  .dw-tools select{ height:36px; border:1px solid var(--line, var(--ivd)) !important; border-radius:10px !important; padding:0 8px !important;
    background:var(--surface, var(--wh)) !important; font:inherit; font-size:13px; color:var(--ink, var(--gd)); }
  .dw-addbox{ display:none; border:1px dashed var(--dw-open-line, #BFDCCF); border-radius:12px; padding:14px 16px 16px; margin:0 0 14px;
    background:color-mix(in srgb, var(--surface, #fff) 92%, var(--gm)); }
  .dw-adding > .dw-addbox{ display:block; }
  .dw-addh{ display:flex; align-items:center; margin:0 0 10px; font-size:13px; font-weight:700; color:var(--gm); }
  .dw-addh button{ margin-left:auto; border:0; background:none; font:inherit; font-size:12.5px; color:var(--ink-3, var(--tl)); cursor:pointer; }
  /* 목록 줄 서랍 (Drawer.rows) */
  .dw-row-m{ border:1px solid var(--line, var(--ivd)); background:var(--surface, var(--wh)); border-radius:10px; font:inherit; font-size:13px;
    font-weight:700; color:var(--ink-2, var(--ts)); padding:6px 8px 6px 12px; display:inline-flex; align-items:center; gap:2px; cursor:pointer; flex:none; }
  .dw-row-m .material-symbols-rounded{ font-size:18px; transition:transform .2s; }
  .dw-row-on .dw-row-m{ color:var(--gm); border-color:var(--dw-open-line, #BFDCCF); }
  .dw-row-on .dw-row-m .material-symbols-rounded{ transform:rotate(180deg); }
  .dw-row-hide{ display:none !important; }
  .dw-row-dw{ border:1px solid var(--dw-open-line, #BFDCCF); border-top:0; border-radius:0 0 12px 12px; background:var(--surface, var(--wh));
    padding:12px 16px 14px; margin:-7px 0 0; --dw-open-line:#BFDCCF; }
  html[data-theme="dark"] .dw-row-dw{ --dw-open-line:#2E5A48; }
  .dw-row-dw .dw-inf{ display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px 16px; font-size:13px; color:var(--ink, var(--gd)); margin-bottom:12px; }
  .dw-row-dw .dw-inf span{ display:block; font-size:12px; color:var(--ink-3, var(--tl)); margin-bottom:2px; }
  .dw-row-dw .dw-acts{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .dw-row-dw .dw-acts:empty{ display:none; }   /* v119: 단추가 없는 줄(보기만) */
  .dw-row-dw .dw-inf:last-child{ margin-bottom:0; }
  .dw-row-dw .dw-acts .dw-sp{ flex:1; }
  .dw-row-dw .dw-acts button{ font:inherit !important; font-size:13px !important; font-weight:700 !important; border-radius:10px !important; padding:8px 14px !important;
    cursor:pointer; display:inline-flex !important; align-items:center; gap:6px; border:1px solid var(--line, var(--ivd)) !important;
    background:var(--surface, var(--wh)) !important; color:var(--ink, var(--gd)) !important; height:auto !important; }
  .dw-row-dw .dw-acts button .material-symbols-rounded{ font-size:18px; color:var(--gm); }
  .dw-row-dw .dw-acts button.dg{ color:var(--danger) !important; border-color:color-mix(in srgb, var(--danger) 30%, transparent) !important; }
  .dw-row-dw .dw-acts button.dg .material-symbols-rounded{ color:var(--danger); }
  .dw-compact > .dw-h{ min-height:50px; padding:8px 14px 8px 12px; gap:10px; }
  .dw-compact .dw-ic{ width:32px; height:32px; background:none; }
  .dw-compact .dw-t{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .dw-compact .dw-tt{ font-size:13px; color:var(--ink-3, var(--tl)); font-weight:700; }
  .dw-compact .dw-s{ margin:0; display:flex; gap:6px; flex-wrap:wrap; white-space:normal; }
  .dw-chip{ display:inline-flex; align-items:center; font-size:13px; font-weight:700; color:var(--ink, var(--gd)); background:var(--bg, var(--iv));
    border-radius:100px; padding:3px 12px; line-height:1.5; }
  .dw-chip.g{ background:var(--sb-mint-2, var(--gp)); color:var(--gm); }
  .dw-hint{ font-size:13px; font-weight:700; color:var(--gm); white-space:nowrap; }
  .dw-compact > .dw-body{ padding:12px 16px 4px; }
  @media (max-width:760px){
    .dw-h{ padding:12px 14px; gap:12px; min-height:60px; } .dw-bd{ display:none; } .dw-ic{ width:34px; height:34px; }
    .dw-s{ white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
    .dw-body{ padding:14px; }
    .dw-tools .dw-sp{ display:none; }
  }
  @media print{
    .dw{ break-inside:avoid; box-shadow:none; }
    .dw-body{ display:block !important; } .dw-cv, .dw-bar, .dw-tools, .dw-mb, .dw-row-m{ display:none !important; }
  }`;
  function injectCSS(){
    if(document.getElementById('dw-style')) return;
    const st = document.createElement('style'); st.id = 'dw-style'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── 묶음(같은 부모) ── */
  function stackKey(stack){
    if(stack.dataset.dwStack) return stack.dataset.dwStack;
    const a = stack.id ? stack : stack.closest('[id]');
    const k = (a && a.id) || 'main';
    stack.dataset.dwStack = k; return k;
  }
  function drawersOf(stack){ return kids(stack, '.dw'); }
  function layoutStack(stack){
    /* 부모가 서랍만 담고 있거나 이미 세로 flex 일 때만 간격을 맞춘다 (다른 내용이 섞인 큰 틀은 건드리지 않음) */
    const others = [...stack.children].filter(c => !c.matches('.dw, .dw-grp, .dw-bar, style, script, template, link'));
    const cs = getComputedStyle(stack);
    if(!others.length || /flex|grid/.test(cs.display)) stack.classList.add('dw-stack');
    const ws = drawersOf(stack);
    kids(stack, '.dw-grp').forEach(g => g.remove());
    let prev = null;
    ws.forEach(w => { const g = (DEF[w.dataset.dwk] || {}).group || null;
      if(g && g !== prev){ const gl = document.createElement('div'); gl.className = 'dw-grp'; gl.textContent = g; stack.insertBefore(gl, w); }
      prev = g; });
    let bar = kids(stack, '.dw-bar')[0];
    if(ws.length >= 3){
      if(!bar){ bar = document.createElement('div'); bar.className = 'dw-bar';
        bar.innerHTML = `<button type="button" class="dw-all">${ic('unfold_more')}<span>모두 펼치기</span></button>`;
        bar.firstChild.addEventListener('click', () => toggleAll(stack)); }
      /* v119: 다른 카드와 섞인 곳이면 «모두 펼치기»는 첫 서랍(이름표) 바로 위에 — 맨 위에 두면 무엇을 펼치는지 알기 어렵다 */
      const f0 = ws[0], fp = f0 && f0.previousElementSibling;
      const at = others.length ? ((fp && fp.classList.contains('dw-grp')) ? fp : f0) : stack.firstChild;
      if(bar.nextSibling !== at) stack.insertBefore(bar, at);
      syncAllLabel(stack);
    } else if(bar) bar.remove();
  }
  function syncAllLabel(stack){
    const b = kids(stack, '.dw-bar')[0]; if(!b) return;
    const all = drawersOf(stack).every(w => w.classList.contains('open'));
    b.querySelector('span:last-child').textContent = all ? '모두 접기' : '모두 펼치기';
    b.querySelector('.material-symbols-rounded').textContent = all ? 'unfold_less' : 'unfold_more';
  }
  function toggleAll(stack){
    const ws = drawersOf(stack); const all = ws.every(w => w.classList.contains('open'));
    stack.dataset.dwAll = all ? '' : '1';
    ws.forEach(w => setOpen(w, !all, true));
    syncAllLabel(stack);
  }

  /* ── 열고 닫기 ── */
  function setOpen(w, on, quiet){
    if(!w) return;
    w.classList.toggle('open', !!on);
    const h = w.querySelector(':scope > .dw-h'); if(h) h.setAttribute('aria-expanded', on ? 'true' : 'false');
    const stack = w.parentElement; if(!stack) return;
    if(quiet) return;
    if(on && !stack.dataset.dwAll) drawersOf(stack).forEach(x => { if(x !== w && x.classList.contains('open')) setOpen(x, false, true); });
    const sk = stackKey(stack);
    if(on) mem[sk] = w.dataset.dwk;
    else if(mem[sk] === w.dataset.dwk) mem[sk] = '';
    remember(); syncAllLabel(stack);
    if(on) refresh(w);
  }

  /* ── 서랍 하나 만들기 ── */
  function enhance(el){
    if(el.__dw) return;
    const key = el.dataset.dw; const d = DEF[key] || {};
    const pb = el.parentElement;
    if(pb && pb.classList.contains('dw-body')){            /* 페이지가 서랍 안의 덩어리만 바꿔 끼운 경우 */
      el.__dw = true; el.classList.add('dw-card'); refresh(pb.parentElement); return; }
    el.__dw = true; el.classList.add('dw-card');
    const w = document.createElement('section'); w.className = 'dw' + (d.compact ? ' dw-compact' : ''); w.dataset.dwk = key;
    const h = document.createElement('div'); h.className = 'dw-h'; h.setAttribute('role', 'button'); h.tabIndex = 0; h.setAttribute('aria-expanded', 'false');
    h.innerHTML = `<div class="dw-ic">${ic(d.icon || 'tune')}</div><div class="dw-t"><div class="dw-tt"></div><div class="dw-s"></div></div><div class="dw-bd"></div>${d.hint ? `<span class="dw-hint">${d.hint}</span>` : ''}${ic('expand_more', 'dw-cv')}`;
    const b = document.createElement('div'); b.className = 'dw-body';
    b.innerHTML = '<div class="dw-lead"></div><div class="dw-more"></div>';
    el.parentNode.insertBefore(w, el); w.append(h, b); b.appendChild(el);
    h.addEventListener('click', e => { if(e.target.closest('a,button,input,select,label') && !e.target.closest('.dw-h > .dw-cv')) return; setOpen(w, !w.classList.contains('open')); });
    h.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); setOpen(w, !w.classList.contains('open')); } });
    b.addEventListener('click', e => {
      const mb = e.target.closest('.dw-mb'); if(mb && mb.closest('.dw') === w){ w.classList.toggle('more-on'); return; }
      const ad = e.target.closest('.dw-add, .dw-addh button'); if(ad && ad.closest('.dw') === w){ const c = w.querySelector(':scope > .dw-body > .dw-card'); if(c){ c.classList.toggle('dw-adding'); if(c.classList.contains('dw-adding')){ const f = c.querySelector('.dw-addbox input:not([type=hidden]), .dw-addbox select'); if(f) try { f.focus({ preventScroll:true }); } catch(_){} } } }
    });
    const later = () => schedule(w);
    b.addEventListener('change', later); b.addEventListener('input', later);
    const mo = new MutationObserver(later); mo.observe(b, { childList:true, subtree:true, characterData:true });
    w.__mo = mo;
    refresh(w);
    const stack = w.parentElement; const sk = stackKey(stack);
    const want = (sk in mem) ? mem[sk] === key : !!d.open;
    if(want){ w.classList.add('open'); h.setAttribute('aria-expanded', 'true'); }
    return w;
  }

  /* ── 요약 · 제목 · 설명 · 넣기 다시 맞추기 ── */
  const pend = new Set(); let tmr = 0;
  function schedule(w){ pend.add(w); if(!tmr) tmr = setTimeout(() => { tmr = 0; const a = [...pend]; pend.clear(); a.forEach(refresh); }, 60); }
  const setHTML = (el, html) => { if(el && el.innerHTML !== html) el.innerHTML = html; };
  function firstSentence(t){ const m = /^(.+?(?:다|요|니다|세요|어요|아요)?[.!?])(?:\s|$)/.exec(t); return m ? m[1] : t; }
  function refresh(w){
    if(!w || !w.isConnected) return;
    const key = w.dataset.dwk; const d = DEF[key] || {};
    const body = w.querySelector(':scope > .dw-body'); const el = body && body.querySelector(':scope > .dw-card');
    if(!el) return;
    /* 정의가 늦게 온 경우(정적 HTML) — 모양도 맞춘다 */
    w.classList.toggle('dw-compact', !!d.compact);
    if(d.space != null) w.style.marginBottom = typeof d.space === 'number' ? d.space + 'px' : d.space;   /* v119: 다른 카드와 섞인 곳의 아래 간격 */
    const icn = w.querySelector(':scope > .dw-h .dw-ic .material-symbols-rounded'); if(icn && icn.textContent !== (d.icon || 'tune')) icn.textContent = d.icon || 'tune';
    let hn = w.querySelector(':scope > .dw-h > .dw-hint');
    if(d.hint && !hn){ hn = document.createElement('span'); hn.className = 'dw-hint'; w.querySelector(':scope > .dw-h').insertBefore(hn, w.querySelector(':scope > .dw-h > .dw-cv')); }
    if(hn) hn.textContent = d.hint || '';
    /* 제목 · 설명 */
    const head = kids(el, '.actitle')[0] || kids(el, 'h3')[0] || kids(el, 'h2')[0];
    if(head && !head.classList.contains('dw-hd') && !d.keepHead) head.classList.add('dw-hd');
    let title = d.title;
    if(!title && head){ const own = [...head.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join(' '); title = strip(own) || strip(head.textContent); }
    setHTML(w.querySelector('.dw-tt'), title || '');
    const desc = kids(el, '.adesc')[0];
    if(desc && !desc.classList.contains('dw-hd')) desc.classList.add('dw-hd');
    const full = desc ? desc.innerHTML.trim() : '';
    const plain = desc ? desc.textContent.replace(/\s+/g, ' ').trim() : '';
    let lead = d.lead != null ? d.lead : (plain ? firstSentence(plain) : '');
    if(typeof lead === 'function'){ try { lead = lead(el) || ''; } catch(_){ lead = ''; } }
    /* v119: 제목 줄(.panel-head 등) — 숨기고 단추만 도구 줄로 */
    const headBar = d.head ? kids(el, d.head)[0] : null;
    /* 도구 줄 (가끔 쓰는 단추) */
    let toolsMore = '';
    const wantTools = (d.tools || []).length || d.add || (headBar && headBar.querySelector('button'));
    let tools = kids(el, '.dw-tools')[0];
    if(wantTools && !tools){
      tools = document.createElement('div'); tools.className = 'dw-tools';
      if(d.add){ const a = document.createElement('button'); a.type = 'button'; a.className = 'dw-add'; a.innerHTML = ic(d.add.icon || 'add') + `<span>${d.add.label || '넣기'}</span>`; tools.appendChild(a); }
      const sp = document.createElement('span'); sp.className = 'dw-sp'; tools.appendChild(sp);
      const firstForm = d.add ? (d.add.form || []).map(s => kids(el, s)[0]).filter(Boolean)[0] : null;
      el.insertBefore(tools, firstForm || el.firstChild);
    }
    if(headBar && !headBar.__dwHead){
      headBar.__dwHead = true;
      [...headBar.querySelectorAll('button')].forEach(bt => { bt.classList.add('dw-tool'); tools.appendChild(bt); });
      headBar.classList.add('dw-hd');
    }
    (d.tools || []).forEach(t => {
      const bar = kids(el, t.sel)[0];
      if(bar && !bar.__dwTool){
        bar.__dwTool = true;
        const cl = bar.cloneNode(true); cl.querySelectorAll('select,button').forEach(x => x.remove());
        const lab = cl.firstElementChild; const lt = lab ? lab.textContent : ''; if(lab) lab.remove();
        bar.__dwDesc = `<div>· <b>${t.label}</b> — ${strip(cl.textContent)}</div>`;
        kids(bar, 'select').forEach(s => tools.appendChild(s));
        kids(bar, 'button').forEach(bt => { bt.classList.add('dw-tool'); bt.innerHTML = ic(t.icon || 'build') + t.label; tools.appendChild(bt); });
        bar.classList.add('dw-hd');
      }
      if(bar && bar.__dwDesc) toolsMore += bar.__dwDesc;
    });
    /* 입력칸은 «+ 넣기» 안으로 */
    if(d.add && !kids(el, '.dw-addbox')[0]){
      const parts = []; (d.add.form || []).forEach(s => kids(el, s).forEach(x => { if(!parts.includes(x)) parts.push(x); }));
      parts.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
      if(parts.length){
        const box = document.createElement('div'); box.className = 'dw-addbox';
        box.innerHTML = `<div class="dw-addh"><span>새로 넣기</span><button type="button">닫기</button></div>`;
        el.insertBefore(box, tools ? tools.nextSibling : parts[0]);
        parts.forEach(p => box.appendChild(p));
      }
    }
    let selMore = '';
    if(d.moreSel) kids(el, d.moreSel).forEach(x => { x.classList.add('dw-hd'); selMore += `<div style="margin-top:8px">${x.innerHTML}</div>`; });
    const moreHTML = (plain && plain !== lead ? full : '') + toolsMore + selMore + (d.more || '');
    setHTML(body.querySelector(':scope > .dw-more'), moreHTML);
    setHTML(body.querySelector(':scope > .dw-lead'), lead ? lead + (moreHTML ? ` <button type="button" class="dw-mb">자세히${ic('expand_more')}</button>` : '') : '');
    /* 요약 · 배지 */
    let sum = ''; try { sum = d.sum ? (d.sum(el) || '') : ''; } catch(e){ sum = ''; }
    setHTML(w.querySelector('.dw-s'), sum);
    let bd = []; try { bd = d.badge ? (d.badge(el) || []) : []; } catch(e){ bd = []; }
    /* v119: 보기 전용 — 권한(보안 규칙)이 없는 사람에게는 넣기 · 도구 · ✕ 를 숨기고 한 줄로 알려 준다 */
    let ro = false; try { ro = typeof d.ro === 'function' ? !!d.ro(el) : !!d.ro; } catch(e){ ro = false; }
    w.classList.toggle('dw-ro', ro);
    let rn = body.querySelector(':scope > .dw-ronote');
    if(ro && !rn){ rn = document.createElement('div'); rn.className = 'dw-ronote'; body.insertBefore(rn, body.querySelector(':scope > .dw-card')); }
    if(rn) setHTML(rn, ro ? ic('visibility') + `<span>${d.roNote || '보기만 할 수 있어요'}</span>` : '');
    if(ro) bd = bd.concat([['보기 전용']]);
    setHTML(w.querySelector('.dw-bd'), bd.filter(x => x && x[0]).map(x => `<span class="dw-b ${x[1] || ''}">${x[0]}</span>`).join(''));
    if(w.__mo) w.__mo.takeRecords();
  }

  /* ── 찾기 · 새로 그려진 것 감싸기 ── */
  function scan(root){
    const r = root || document;
    const BLOCK = /^(DIV|SECTION|ARTICLE|FORM|FIELDSET)$/;   /* 단추 · 글자 · 링크에 붙은 data-dw 는 서랍이 아님 */
    const els = [...r.querySelectorAll('[data-dw]')].filter(e => !e.__dw && BLOCK.test(e.tagName));
    if(r.nodeType === 1 && r.matches && r.matches('[data-dw]') && !r.__dw && BLOCK.test(r.tagName)) els.unshift(r);
    if(!els.length) return;
    injectCSS();
    const stacks = new Set();
    els.forEach(e => { if(!e.parentElement) return; enhance(e); const w = e.closest('.dw'); if(w && w.parentElement) stacks.add(w.parentElement); });
    stacks.forEach(layoutStack);
  }
  let sTmr = 0;
  const gmo = new MutationObserver(recs => {
    for(const r of recs) for(const n of r.addedNodes){
      if(n.nodeType === 1 && ((n.matches && n.matches('[data-dw]')) || (n.querySelector && n.querySelector('[data-dw]')))){
        if(!sTmr) sTmr = requestAnimationFrame(() => { sTmr = 0; scan(); }); return; }
    }
  });
  function start(){ injectCSS(); scan(); gmo.observe(document.body, { childList:true, subtree:true }); }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  /* ── 숨은 서랍 안을 가리키면 먼저 열기 ── */
  function reveal(el){
    if(!el || !el.closest) return false;
    let opened = false;
    const box = el.closest('.dw-addbox'); if(box && box.parentElement && !box.parentElement.classList.contains('dw-adding')){ box.parentElement.classList.add('dw-adding'); opened = true; }
    if(el.closest('.dw-more')){ const w = el.closest('.dw'); if(w && !w.classList.contains('more-on')){ w.classList.add('more-on'); opened = true; } }
    let w = el.closest('.dw-body') && el.closest('.dw');
    while(w){ if(!w.classList.contains('open')){ setOpen(w, true); opened = true; } const up = w.parentElement && w.parentElement.closest('.dw-body'); w = up ? up.closest('.dw') : null; }
    const row = el.closest('.dw-row-dw'); if(row && row.classList.contains('dw-row-hide')){ row.classList.remove('dw-row-hide'); opened = true; }
    return opened;
  }
  const _siv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function(){ try { reveal(this); } catch(_){} return _siv.apply(this, arguments); };
  const _focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function(){ try { reveal(this); } catch(_){} return _focus.apply(this, arguments); };

  /* ── 목록 줄 서랍: 줄마다 단추 여러 개 → «관리» 하나, 누른 줄만 열림 ──
     Drawer.rows(listEl, { row:'.sitem', actions:'선택자(줄 안 단추 묶음)', info: row => [['기관','…'],…],
                           buttons: row => [{label, icon, danger, run}] }) — 목록을 다시 그린 뒤 부르면 된다 */
  function rows(list, o){
    if(!list) return; injectCSS();
    const openId = list.__dwRowOpen || null;
    kids(list, '.dw-row-dw').forEach(x => x.remove());
    kids(list, o.row).forEach((r, i) => {
      if(r.__dwRow) return; r.__dwRow = true;
      const id = (o.id && o.id(r)) || String(i);
      r.dataset.dwRow = id;
      const acts = o.actions ? r.querySelector(o.actions) : null; if(acts) acts.classList.add('dw-row-hide');
      const m = document.createElement('button'); m.type = 'button'; m.className = 'dw-row-m'; m.innerHTML = `<span>${o.label || '관리'}</span>` + ic('expand_more');
      r.appendChild(m);
      m.addEventListener('click', e => { e.stopPropagation(); toggleRow(list, r, o); });
      if(openId && openId === id) toggleRow(list, r, o);
    });
  }
  function toggleRow(list, r, o){
    const was = r.classList.contains('dw-row-on');
    kids(list, '.dw-row-dw').forEach(x => x.remove()); kids(list, '.dw-row-on').forEach(x => x.classList.remove('dw-row-on'));
    list.__dwRowOpen = null;
    if(was) return;
    r.classList.add('dw-row-on'); list.__dwRowOpen = r.dataset.dwRow;
    const d = document.createElement('div'); d.className = 'dw-row-dw';
    const info = (o.info && o.info(r)) || [];
    d.innerHTML = (info.length ? `<div class="dw-inf">${info.map(x => `<div><span>${x[0]}</span>${x[1]}</div>`).join('')}</div>` : '') + '<div class="dw-acts"></div>';
    const acts = d.querySelector('.dw-acts');
    const bs = (o.buttons && o.buttons(r)) || [];
    let sp = false;
    bs.forEach(b => {
      if(b.danger && !sp){ const s = document.createElement('span'); s.className = 'dw-sp'; acts.appendChild(s); sp = true; }
      const bt = document.createElement('button'); bt.type = 'button'; if(b.danger) bt.className = 'dg';
      bt.innerHTML = ic(b.icon || 'chevron_right') + b.label;
      bt.addEventListener('click', e => { e.stopPropagation(); b.run && b.run(e); });
      acts.appendChild(bt);
    });
    r.after(d);
  }

  window.Drawer = {
    def(key, d){ DEF[key] = Object.assign(DEF[key] || {}, d || {});
      document.querySelectorAll(`.dw[data-dwk="${key}"]`).forEach(w => {
        if(DEF[key].open && w.parentElement && !(stackKey(w.parentElement) in mem)) setOpen(w, true, true);
        if(w.parentElement) layoutStack(w.parentElement);
        refresh(w); }); },
    scan, refresh(w){ if(w) schedule(w); else document.querySelectorAll('.dw').forEach(schedule); },
    open(key){ const w = document.querySelector(`.dw[data-dwk="${key}"]`); if(w){ setOpen(w, true); try { _siv.call(w, { block:'start', behavior:'smooth' }); } catch(_){} } return !!w; },
    close(key){ const w = document.querySelector(`.dw[data-dwk="${key}"]`); if(w) setOpen(w, false); },
    reveal, rows,
    _mem: () => mem
  };
})();
