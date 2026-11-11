/* ═══════════════════════════════════════════════════════════════
   🔽 select-pop.js — 고르는 목록(<select>)을 화면 안 목록으로 (v178)
   ───────────────────────────────────────────────────────────────
   · 왜: 맥 크롬의 기본 목록 창은 운영체제가 따로 띄워서, 목록을 연 채 화면이 새로 그려지거나
     다른 앱(잔디 등)으로 넘어가면 목록만 다른 창 위에 떠 있는 일이 있었다.
   · 그래서 컴퓨터(마우스)에서는 기본 목록 대신 이 화면 안에 목록을 그린다 — 다른 창 위로 못 나간다.
   · 폰 · 태블릿(손가락)은 기본 고르기 창 그대로 (그쪽은 문제가 없고 더 편하다).
   · <select> 는 그대로 두고 «여는 창»만 바꾼다 — 값 · change 이벤트 · 모양은 예전과 같다.
   · 빼고 싶은 곳: <select data-native> (여러 개 고르기 · size 큰 목록 · 막힌 목록은 저절로 빠짐)
   · sidebar.js 가 모든 화면에 불러온다 (사이드바가 없는 화면은 직접 <script src="select-pop.js">)
   ═══════════════════════════════════════════════════════════════ */
(function(){
  if(window.__selPop) return; window.__selPop = true;
  var MQ = null; try { MQ = matchMedia('(hover: hover) and (pointer: fine)'); } catch(_){}
  var MAC = /Mac/i.test(navigator.platform || navigator.userAgent || '');
  function off(s){ return !s || s.multiple || (s.size || 0) > 1 || s.disabled || s.hasAttribute('data-native') || (MQ && !MQ.matches); }

  var CSS = '.sp-pop{position:fixed!important;z-index:2147483000!important;box-sizing:border-box!important;width:auto!important;height:auto!important;margin:0!important;'
    + 'right:auto!important;bottom:auto!important;transform:none!important;flex:none!important;overflow:auto;overscroll-behavior:contain;'
    + 'background:var(--wh,#fff);color:var(--ink,#1F2320);border:1px solid var(--ivd,#E3E1DA);border-radius:10px;'
    + 'box-shadow:0 12px 32px rgba(20,40,34,.18),0 2px 6px rgba(20,40,34,.08);padding:4px;'
    + "font:500 13px/1.35 'Apple SD Gothic Neo','Malgun Gothic',sans-serif;text-align:left;outline:none}"
    + '.sp-it{position:relative;padding:7px 12px 7px 27px;border-radius:7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.sp-it.on{font-weight:800;color:var(--gm,#00704A)}'
    + '.sp-it.on::before{content:"✓";position:absolute;left:10px;top:7px;font-weight:900}'
    + '.sp-it.hi{background:var(--gp,#E8F3EF)}'
    + '.sp-it.dis{opacity:.42;cursor:default}'
    + '.sp-gl{padding:7px 12px 3px;font-size:11px;font-weight:800;color:var(--tl,#93A09A);cursor:default}'
    + '.sp-gl ~ .sp-it{padding-left:33px}.sp-gl ~ .sp-it.on::before{left:16px}';
  function css(){
    if(document.getElementById('sp-css')) return;
    var st = document.createElement('style'); st.id = 'sp-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var cur = null;   // { sel, box, items:[{el, i}], hi, mo, typed, tt }
  function close(refocus){
    if(!cur) return;
    var c = cur; cur = null;
    try { c.mo && c.mo.disconnect(); } catch(_){}
    try { c.box.remove(); } catch(_){}
    window.removeEventListener('resize', onWin, true);
    window.removeEventListener('blur', onWinBlur);
    document.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
    if(refocus && c.sel.isConnected){ try { c.sel.focus({ preventScroll: true }); } catch(_){} }
  }
  function onWin(){ close(false); }
  function onWinBlur(e){ if(e.target === window) close(false); }   // 창이 포커스를 잃을 때만 (화면 안 칸의 blur 는 아님)
  function onScroll(e){ if(cur && !(cur.box === e.target || cur.box.contains(e.target))) close(false); }
  function onDocDown(e){ if(cur && !cur.box.contains(e.target) && e.target !== cur.sel) close(false); }

  function setHi(n, scroll){
    if(!cur) return;
    if(cur.hi >= 0 && cur.items[cur.hi]) cur.items[cur.hi].el.classList.remove('hi');
    cur.hi = n;
    var it = cur.items[n]; if(!it) return;
    it.el.classList.add('hi');
    if(scroll){
      var b = cur.box, t = it.el.offsetTop, h = it.el.offsetHeight;
      if(t < b.scrollTop) b.scrollTop = t - 4; else if(t + h > b.scrollTop + b.clientHeight) b.scrollTop = t + h - b.clientHeight + 4;
    }
  }
  function move(d){
    if(!cur || !cur.items.length) return;
    var L = cur.items.length, dir = d > 0 ? 1 : -1, steps = Math.abs(d);
    var n = cur.hi < 0 ? (dir > 0 ? -1 : L) : cur.hi, best = cur.hi;
    while(steps-- > 0){
      var m = n + dir;
      while(m >= 0 && m < L && cur.items[m].dis) m += dir;   // 막힌 줄은 건너뜀
      if(m < 0 || m >= L) break;
      n = best = m;
    }
    if(best >= 0 && best !== cur.hi) setHi(best, true);
  }
  function pick(it){
    if(!cur || !it || it.dis) return;
    var s = cur.sel;
    close(true);
    if(!s.isConnected || s.disabled || !s.contains(it.o)) return;   // 연 사이 목록이 바뀌었으면 고르지 않음
    if(!it.o.selected){
      it.o.selected = true;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function onKey(e){
    if(!cur) return;
    var k = e.key;
    if(k === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(true); return; }
    if(k === 'Tab'){ close(false); return; }
    if(k === 'ArrowDown' || k === 'ArrowUp'){ e.preventDefault(); e.stopPropagation(); move(k === 'ArrowDown' ? 1 : -1); return; }
    if(k === 'Home' || k === 'End'){ e.preventDefault(); setHi(k === 'Home' ? 0 : cur.items.length - 1, true); return; }
    if(k === 'PageDown' || k === 'PageUp'){ e.preventDefault(); move(k === 'PageDown' ? 8 : -8); return; }
    if(k === 'Enter' || (k === ' ' && !cur.typed)){ e.preventDefault(); e.stopPropagation(); pick(cur.items[cur.hi]); return; }
    if(k && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){   // 글자를 치면 그 글자로 시작하는 줄로
      e.preventDefault();
      cur.typed = (cur.typed || '') + k.toLowerCase();
      clearTimeout(cur.tt); cur.tt = setTimeout(function(){ if(cur) cur.typed = ''; }, 700);
      var q = cur.typed, n = cur.items.findIndex(function(x){ return !x.dis && x.t.toLowerCase().indexOf(q) === 0; });
      if(n < 0) n = cur.items.findIndex(function(x){ return !x.dis && x.t.toLowerCase().indexOf(q) >= 0; });
      if(n >= 0) setHi(n, true);
    }
  }

  function open(s){
    close(false);
    if(off(s) || !s.isConnected) return;
    var r = s.getBoundingClientRect();
    if(!r.width && !r.height) return;
    css();
    var box = document.createElement('div');
    box.className = 'sp-pop'; box.setAttribute('role', 'listbox'); box.tabIndex = -1;
    var items = [], lastGroup = null, selI = s.selectedIndex;
    for(var i = 0; i < s.options.length; i++){
      var o = s.options[i];
      if(o.hidden || o.style.display === 'none') continue;
      var g = o.parentElement && o.parentElement.tagName === 'OPTGROUP' ? o.parentElement : null;
      if(g && g !== lastGroup){ var gl = document.createElement('div'); gl.className = 'sp-gl'; gl.textContent = g.label || ''; box.appendChild(gl); }
      lastGroup = g;
      var el = document.createElement('div');
      var dis = o.disabled || (g && g.disabled);
      el.className = 'sp-it' + (i === selI ? ' on' : '') + (dis ? ' dis' : '');
      el.setAttribute('role', 'option'); el.setAttribute('aria-selected', i === selI ? 'true' : 'false');
      el.textContent = o.label || o.text || ' ';
      el.title = o.text || '';
      box.appendChild(el);
      items.push({ el: el, i: i, o: o, dis: !!dis, t: o.text || '' });
    }
    if(!items.length) return;
    /* 목록은 <select> 바로 옆에 붙인다 — 그래야 그 <select>가 든 창 · 작은 메뉴가 «바깥을 눌렀다»고 닫히지 않는다
       (자리는 화면 기준 fixed · 붙은 곳이 움직이는 창이면 아래에서 어긋난 만큼 바로잡음) */
    var at = (s.parentElement && s.parentElement.tagName === 'LABEL') ? s.parentElement : s;
    at.insertAdjacentElement('afterend', box);
    // 자리: 목록 아래 (모자라면 위) · 화면 밖으로 안 나가게
    var vw = window.innerWidth, vh = window.innerHeight, pad = 8;
    box.style.minWidth = Math.max(r.width, 120) + 'px';
    box.style.maxWidth = Math.max(160, Math.min(480, vw - pad * 2)) + 'px';
    var below = vh - r.bottom - pad, above = r.top - pad;
    var want = Math.min(box.scrollHeight, 360);
    var up = want > below && above > below;
    var room = Math.max(120, up ? above - 4 : below - 4);
    box.style.maxHeight = Math.min(360, room) + 'px';
    var h = Math.min(box.scrollHeight, Math.min(360, room)), w = box.offsetWidth;
    var top = up ? Math.max(pad, r.top - 4 - h) : Math.min(vh - pad - h, r.bottom + 4), left = Math.max(pad, Math.min(vw - pad - w, r.left));
    box.style.top = top + 'px'; box.style.left = left + 'px';
    var br = box.getBoundingClientRect();   // 붙은 곳이 transform 된 창이면 fixed 기준이 달라져 어긋난다 → 그만큼 되돌림
    if(Math.abs(br.left - left) > 1 || Math.abs(br.top - top) > 1){ box.style.top = (2 * top - br.top) + 'px'; box.style.left = (2 * left - br.left) + 'px'; }
    cur = { sel: s, box: box, items: items, hi: -1, typed: '', tt: 0, mo: null };
    var sI = items.findIndex(function(x){ return x.i === selI; });
    setHi(sI >= 0 ? sI : items.findIndex(function(x){ return !x.dis; }), false);
    if(cur.hi >= 0){ var it = items[cur.hi].el; box.scrollTop = Math.max(0, it.offsetTop - (box.clientHeight - it.offsetHeight) / 2); }
    box.addEventListener('mousemove', function(e){ var t = e.target.closest && e.target.closest('.sp-it'); if(!t || !cur) return; var n = cur.items.findIndex(function(x){ return x.el === t; }); if(n >= 0 && n !== cur.hi && !cur.items[n].dis) setHi(n, false); });
    var hit = function(e){ var t = e.target.closest && e.target.closest('.sp-it'); return t && cur ? cur.items.find(function(x){ return x.el === t; }) : null; };
    var stop = function(e){ e.stopPropagation(); };   // 목록 안 눌림이 창(끌어 옮기기) · 줄 클릭으로 새지 않게 — 문서의 «바깥 누르면 닫기»(capture)는 먼저 돌아 영향 없음
    box.addEventListener('mousedown', function(e){ e.preventDefault(); stop(e); });   // 눌러도 <select> 에서 포커스가 빠지지 않게
    box.addEventListener('pointerdown', stop);
    box.addEventListener('mouseup', function(e){ stop(e);   // 목록을 누른 채 끌어 와서 놓아도 고름 (맥 기본 목록처럼)
      if(DOWN && (Date.now() - DOWN.t > 250 || Math.abs(e.clientX - DOWN.x) + Math.abs(e.clientY - DOWN.y) > 6)){ DOWN = null; SWALLOW = Date.now(); pick(hit(e)); } });
    box.addEventListener('click', function(e){ stop(e); pick(hit(e)); });
    // 화면이 새로 그려져 <select> 가 사라지면 목록도 닫는다 (예전엔 기본 목록이 홀로 남았다)
    try { cur.mo = new MutationObserver(function(ms){
      if(!cur) return;
      if(!cur.sel.isConnected || ms.some(function(m){ return m.target === cur.sel || cur.sel.contains(m.target); })) close(false);   // 사라지거나 · 고를 줄이 바뀌면
    }); cur.mo.observe(document.body, { childList: true, subtree: true, characterData: true }); } catch(_){}
    window.addEventListener('resize', onWin, true);
    window.addEventListener('blur', onWinBlur);       // 다른 앱 · 다른 창으로 넘어가면 닫는다
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
  }

  var DOWN = null, SWALLOW = 0;   // <select> 를 누른 때 · 자리 (누른 채 끌어 고르기) · 그 뒤 따라오는 click 한 번은 삼킴
  document.addEventListener('mouseup', function(){ setTimeout(function(){ DOWN = null; }, 0); }, true);
  document.addEventListener('click', function(e){   // 끌어 고른 뒤 브라우저가 <select>와 목록의 공통 부모에 보내는 click — 줄 · 카드 클릭으로 새지 않게
    if(SWALLOW && Date.now() - SWALLOW < 400){ SWALLOW = 0; e.stopPropagation(); e.preventDefault(); }
  }, true);
  // 마우스로 누르면 — 기본 목록 대신 화면 안 목록
  document.addEventListener('mousedown', function(e){
    if(e.button !== 0) return;
    var s = e.target && e.target.closest ? e.target.closest('select') : null;
    if(!s || off(s)) return;
    e.preventDefault();
    if(cur && cur.sel === s){ close(true); return; }
    DOWN = { t: Date.now(), x: e.clientX, y: e.clientY };
    try { s.focus({ preventScroll: true }); } catch(_){}
    setTimeout(function(){ open(s); }, 0);   // focus 때 목록을 채우는 화면이 있어 한 박자 뒤에
  }, true);
  // 글쇠로 열 때 (맥은 위 · 아래 글쇠도 목록을 연다)
  document.addEventListener('keydown', function(e){
    if(cur) return;
    var s = e.target;
    if(!s || s.tagName !== 'SELECT' || off(s) || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if(k === ' ' || (k === 'Enter' && MAC) || ((k === 'ArrowDown' || k === 'ArrowUp') && (MAC || e.altKey))){
      e.preventDefault(); open(s);
    }
  }, true);
  window.selectPop = { open: open, close: close, get current(){ return cur && cur.sel; } };
})();
