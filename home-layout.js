/* ═══════════════════════════════════════════════════════════
   🧱 home-layout.js — 홈 화면 «✏️ 배치 바꾸기» (v136)
   · 창마다 넓이(전체 · 3/4 · 2/3 · 1/2 · 1/3 · 1/4 · 자동) · 높이(자동 · 원하는 만큼)
   · 넓은 화면(두 단): 창을 왼쪽 단 ↔ 오른쪽 단으로 옮기고, 가운데 경계로 두 단 폭을 정함
   · 보통 화면(한 단): 넓이 · 높이만 (자리 = 차례)
   · 휴대폰(760px 아래): 늘 한 줄 그대로 (넓이 · 높이 쓰지 않음)
   모양: L = { w:{ side, it:{ 키:{ c:'m'|'s', w:'a'|3..12, h:0|px } } }, n:{ it:{ 키:{ w, h } } } }
         w = 넓은 화면(data-lay 2 · 3) · n = 보통 화면(data-lay 1)
   저장은 홈(index.html)이 맡는다 — 선생님 계정(userMemos/{uid}.home) + 이 기기 사본
   ═══════════════════════════════════════════════════════════ */
(function(){
  const G = 14;                                    // 창 사이 가로 간격(px)
  const WS = [3, 4, 6, 8, 9, 12];                  // 넓이 칸 (12칸 기준)
  const WL = { a:'자동', 3:'1/4', 4:'1/3', 6:'1/2', 8:'2/3', 9:'3/4', 12:'전체' };
  const GROUP = { wx:'wm', memo:'wm', chk:'tl', dday:'tl', fav:'tl' };   // 자동 넓이일 때 한 줄에 같이 서는 묶음
  const CARD = { wx:1, memo:1, chk:1, dday:1, fav:1, world:1 };   // 카드 하나로 된 창 (높이를 정하면 카드가 그 높이를 채움)
  let O = null;                                    // 홈이 넘겨준 것 { getOrder, setOrder, sideKeys, label, save, toast }
  let L = { w:{ it:{} }, n:{ it:{} } };
  const SIDE_MAX = 900, SIDE_FR = 0.45;            // 오른쪽 단 폭 상한 (저장 900px · 그릴 때 본문 폭의 45%)
  let EDIT = null;                                 // 편집 중이면 { snapL, snapOrder }

  const clone = x => JSON.parse(JSON.stringify(x || {}));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  const lay = () => document.documentElement.getAttribute('data-lay') || '1';
  const wide = () => lay() !== '1';
  const phone = () => { try{ return matchMedia('(max-width:760px)').matches; }catch(e){ return false; } };
  const modeKey = () => wide() ? 'w' : 'n';
  function norm(x){
    const o = { w:{ it:{} }, n:{ it:{} } };
    if(!x || typeof x !== 'object') return o;
    ['w', 'n'].forEach(m => {
      const src = x[m] && typeof x[m] === 'object' ? x[m] : {};
      if(m === 'w' && Number(src.side) >= 240 && Number(src.side) <= 900) o.w.side = Math.round(Number(src.side));
      const it = src.it && typeof src.it === 'object' ? src.it : {};
      Object.keys(it).slice(0, 40).forEach(k => {
        if(!/^[a-z]{2,8}$/.test(k)) return;
        const v = it[k] || {}; const r = {};
        if(m === 'w' && (v.c === 'm' || v.c === 's')) r.c = v.c;
        if(WS.includes(Number(v.w))) r.w = Number(v.w);
        const h = Number(v.h); if(h >= 60 && h <= 2400) r.h = Math.round(h);
        if(Object.keys(r).length) o[m].it[k] = r;
      });
    });
    return o;
  }
  const itemOf = (k, m) => (L[m || modeKey()].it[k]) || {};
  const sideKeys = () => (O && O.sideKeys) || [];
  function colOf(k){ const v = itemOf(k, 'w'); return v.c || (sideKeys().includes(k) ? 's' : 'm'); }

  const CSS = `
#home-body .hm-blocks{position:relative}
#home-body .hm-col{display:flex;flex-wrap:wrap;align-items:stretch;align-content:flex-start;column-gap:${G}px;min-width:0}
#home-body .hm-col > .hm-br{flex:0 0 100%;height:0;margin:0;padding:0}
#home-body .hm-col > section.hm-b{flex:0 0 100%;min-width:0;max-width:100%;box-sizing:border-box;position:relative}
#home-body .hm-col > section.hm-b:not([data-w="a"]){flex:0 0 calc((100% + ${G}px) * var(--w, 12) / 12 - ${G}px)}
/* 자동 넓이 = 예전 모양 (날씨 · 메모 나란히 · 할 일 · D-Day · 즐겨찾기는 폭만큼) */
#home-body .hm-col > section.hm-b[data-w="a"][data-k="wx"]{flex:1.15 1 330px}
#home-body .hm-col > section.hm-b[data-w="a"][data-k="memo"]{flex:1 1 300px}
#home-body .hl-memo .hm-col > section.hm-b[data-w="a"][data-k="wx"]{flex:2 1 300px}
#home-body .hl-memo .hm-col > section.hm-b[data-w="a"][data-k="memo"]{flex:3 1 300px}
#home-body .hl-one .hm-col > section.hm-b[data-w="a"][data-k="wx"],#home-body .hl-one .hm-col > section.hm-b[data-w="a"][data-k="memo"]{flex:0 0 100%}
#home-body .hm-col > section.hm-b[data-w="a"]:is([data-k="chk"],[data-k="dday"],[data-k="fav"]){flex:1 1 255px}
@media(max-width:1100px){ #home-body .hm-col > section.hm-b[data-w="a"]:is([data-k="wx"],[data-k="memo"]){flex:0 0 100%} }
#home-body section.hm-b:is([data-k="wx"],[data-k="memo"],[data-k="world"]){margin-bottom:16px}
#home-body section.hm-b:is([data-k="chk"],[data-k="dday"],[data-k="fav"]){margin-bottom:12px}
#home-body section.hm-b.hcard{display:flex;flex-direction:column}
#home-body section.hm-b.hcard > :is(.hm-wx,.hm-memo,.hm-tool,.hm-world){flex:1 1 auto;margin-bottom:0;min-height:0}
/* 높이를 정한 창 — 넘치면 그 안에서 내려 봄 · 메모는 적는 칸이 남는 높이를 채움 */
#home-body section.hm-b.hfix{height:var(--h);overflow:auto}
#home-body section.hm-b.hfix.hcard{overflow:hidden}
#home-body section.hm-b.hfix.hcard > :is(.hm-wx,.hm-memo,.hm-tool,.hm-world){overflow:auto}
#home-body section.hm-b.hfix .hm-memo{display:flex;flex-direction:column}
#home-body section.hm-b.hfix .hm-memo .mm-text{flex:1 1 auto;min-height:112px}
#home-body .hl-phone .hm-col > section.hm-b{flex:0 0 100%!important;height:auto!important}
/* ✏️ 고치는 중 */
html.hm-editing #home-body section.hm-b{outline:2px dashed rgba(0,112,74,.5);outline-offset:3px;border-radius:12px}
html.hm-editing #home-body section.hm-b > :not(.hle):not(.hle-menu){pointer-events:none;user-select:none}
html.hm-editing #home-body section.hm-b.hfix{overflow:hidden}
html.hm-editing #home-body section.hm-b.hle-thin{min-height:46px;margin-bottom:12px}
html.hm-editing #home-body section.hm-b.hle-on{outline-color:#00704A;outline-style:solid}
.hle{position:absolute;inset:0;z-index:20;pointer-events:none}
.hle-tag{pointer-events:auto;position:absolute;top:6px;left:6px;display:inline-flex;align-items:center;gap:6px;background:#1E3932;color:#fff;border:0;border-radius:10px;padding:5px 10px;font-size:12px;font-family:inherit;cursor:grab;box-shadow:0 4px 12px rgba(0,0,0,.2);max-width:calc(100% - 52px);touch-action:none;line-height:1.3}
.hle-tag:active{cursor:grabbing}
.hle-tag b{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.hle-tag em{font-style:normal;font-size:11px;opacity:.78;white-space:nowrap}
.hle-hnd{letter-spacing:-2px;opacity:.85}
.hle-grip{pointer-events:auto;position:absolute;right:0;bottom:0;width:34px;height:34px;display:flex;align-items:flex-end;justify-content:flex-end;padding:0 3px 1px 0;box-sizing:border-box;font-size:20px;line-height:1;color:#00704A;cursor:nwse-resize;touch-action:none;border-radius:0 0 12px 0;background:radial-gradient(circle at 100% 100%, rgba(255,255,255,.96) 0 62%, transparent 63%)}
.hle-div{position:absolute;top:0;bottom:0;width:18px;cursor:col-resize;z-index:25;display:flex;justify-content:center;touch-action:none}
.hle-div i{width:5px;border-radius:5px;background:rgba(0,112,74,.35)}
.hle-div:hover i,.hle-div.on i{background:#00704A}
section.hm-b.hle-ph{outline:2px dashed #00704A!important;background:rgba(0,112,74,.07);border-radius:12px;margin-bottom:14px}
section.hm-b.hle-drag{opacity:.9;box-shadow:0 18px 40px rgba(0,0,0,.25);transform:rotate(-.6deg);background:var(--bg,#F2F0EB);border-radius:12px;overflow:hidden}
#hle-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + var(--union-h,0px));z-index:3100;display:flex;align-items:center;gap:14px;background:#10241D;color:#fff;border-radius:14px;padding:10px 12px 10px 16px;box-shadow:0 12px 32px rgba(0,0,0,.3);width:max-content;max-width:calc(100vw - 32px);font-family:inherit}
.hle-bt{display:flex;flex-direction:column;gap:2px;min-width:0}
.hle-bt b{font-size:13.5px}
.hle-bt span{font-size:11px;opacity:.78;line-height:1.45}
.hle-bb{display:flex;gap:6px;flex:none}
.hle-b0{border:1px solid rgba(255,255,255,.32);background:transparent;color:#fff;border-radius:10px;padding:8px 12px;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer}
.hle-b1{border:0;background:#00A86B;color:#fff;border-radius:10px;padding:8px 16px;font-family:inherit;font-weight:900;font-size:12.5px;cursor:pointer}
.hle-menu{position:absolute;top:40px;left:6px;z-index:30;background:var(--wh,#fff);border:1px solid var(--ivd,#E3E1DA);border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.2);padding:9px;display:flex;flex-direction:column;gap:6px;pointer-events:auto;max-width:calc(100% - 12px)}
.hle-menu .hm-r{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.hle-menu .hm-r > span{font-size:11px;font-weight:800;color:var(--tl,#7C837E);width:30px;flex:none}
.hle-menu button{border:1px solid var(--ivd,#E3E1DA);background:var(--wh,#fff);border-radius:8px;padding:4px 8px;font-size:11.5px;font-family:inherit;cursor:pointer;color:var(--ts,#4F5A55)}
.hle-menu button.on{background:#1E3932;border-color:#1E3932;color:#fff}
`;
  function ensureCss(){ if(document.getElementById('hl-css')) return; const st = document.createElement('style'); st.id = 'hl-css'; st.textContent = CSS; document.head.appendChild(st); }

  /* ── 그리기: 창을 단에 나눠 담고 넓이 · 높이를 입힌다 ── */
  function blocksEl(){ return document.querySelector('#home-body .hm-blocks'); }
  function apply(){
    const bl = blocksEl(); if(!bl) return;
    ensureCss();
    const order = (O && O.getOrder) ? O.getOrder() : [];
    const rank = k => { const i = order.indexOf(k); return i < 0 ? 999 : i; };
    const secs = [...bl.querySelectorAll('section.hm-b')].sort((a, b) => rank(a.dataset.k) - rank(b.dataset.k));
    secs.forEach(s => { s.style.removeProperty('order'); });   // 차례는 놓는 자리(DOM)로 — CSS order 를 남기면 줄 바꿈 · 끌어 놓기 자리가 어긋남
    const W = wide(), P = phone(), m = modeKey();
    const main = [], side = [];
    secs.forEach(s => ((W && colOf(s.dataset.k) === 's') ? side : main).push(s));
    const split = W && side.length > 0 && main.length > 0;
    let cm = bl.querySelector(':scope > .hm-col.m'), cs = bl.querySelector(':scope > .hm-col.s');
    if(!cm){ cm = document.createElement('div'); cm.className = 'hm-col m'; }
    if(!cs){ cs = document.createElement('div'); cs.className = 'hm-col s hm-side'; }
    const mainList = split ? main : secs, sideList = split ? side : [];
    cm.querySelectorAll(':scope > .hm-br').forEach(x => x.remove()); cs.querySelectorAll(':scope > .hm-br').forEach(x => x.remove());
    mainList.forEach(s => cm.appendChild(s)); sideList.forEach(s => cs.appendChild(s));
    bl.querySelectorAll(':scope > section.hm-b').forEach(x => cm.appendChild(x));   // 남은 것 (없어야 정상)
    cm.classList.toggle('hm-main', split);           // 두 단일 때만 «왼쪽 단» 모양(세계 시계 칸 수 등)
    if(cm.parentElement !== bl) bl.appendChild(cm);
    if(cs.parentElement !== bl) bl.appendChild(cs);
    cs.style.display = split ? '' : 'none';
    bl.classList.toggle('split', split);
    bl.classList.toggle('hl-phone', P);
    const sw = L.w.side;
    if(W && sw){ bl.style.setProperty('--hm-side', `min(${sw}px, ${Math.round(SIDE_FR * 100)}%)`); } else bl.style.removeProperty('--hm-side');   // 좁은 두 단 화면(노트북)에서는 화면 폭의 45%까지만
    [cm, cs].forEach(col => {
      let prev = null;
      [...col.querySelectorAll(':scope > section.hm-b')].forEach(s => {
        const k = s.dataset.k, v = itemOf(k, m);
        const w = P ? 12 : (v.w || 'a');
        s.dataset.w = String(w);
        if(w !== 'a') s.style.setProperty('--w', w); else s.style.removeProperty('--w');
        const h = P ? 0 : (v.h || 0);
        s.classList.toggle('hfix', !!h);
        if(h) s.style.setProperty('--h', h + 'px'); else s.style.removeProperty('--h');
        s.classList.toggle('hcard', !!CARD[k]);
        // 자동 넓이끼리는 묶음이 바뀌는 곳에서 줄을 바꾼다 (날씨 · 메모 / 할 일 · D-Day · 즐겨찾기가 다른 창과 한 줄에 서지 않게)
        if(prev && !P){
          const pa = prev.dataset.w === 'a', ca = w === 'a';
          const pg = GROUP[prev.dataset.k] || prev.dataset.k, cg = GROUP[k] || k;
          if((pa || ca) && pg !== cg){ const br = document.createElement('i'); br.className = 'hm-br'; col.insertBefore(br, s); }
        }
        prev = s;
      });
    });
    if(EDIT) paintEdit();
  }

  /* ── ✏️ 편집 모드 ── */
  let _gesture = null;   // 끌고 있는 동작을 멈추는 함수 — 끌던 중에 편집이 끝나면(Esc · 취소 · 폭 바뀜 · 다른 탭) 바로 멈춤
  function stopGesture(){ const g = _gesture; _gesture = null; if(g){ try{ g(); }catch(e){} } }
  function begin(){
    if(EDIT) return;
    if(phone()){ O && O.toast && O.toast('휴대폰에서는 늘 한 줄로 보여요 — 컴퓨터 · 패드에서 바꿔 주세요', 'err'); return; }
    EDIT = { snapL: clone(L), snapOrder: (O && O.getOrder) ? O.getOrder().slice() : [] };
    document.documentElement.classList.add('hm-editing');
    paintBar(); apply();
    try{ blocksEl().scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){}
  }
  function end(save){
    if(!EDIT) return;
    stopGesture();
    const snap = EDIT; EDIT = null;
    document.documentElement.classList.remove('hm-editing');
    document.getElementById('hle-bar')?.remove();
    document.querySelectorAll('.hle, .hle-div, .hle-menu').forEach(x => x.remove());
    document.querySelectorAll('section.hm-b.hle-thin').forEach(x => x.classList.remove('hle-thin'));
    if(save){ O && O.save && O.save(clone(L), O.getOrder ? O.getOrder().slice() : []); }
    else { L = snap.snapL; if(O && O.setOrder) O.setOrder(snap.snapOrder, true); }
    apply();
  }
  function reset(){
    if(!EDIT) return;
    if(!confirm('이 화면 폭의 배치를 처음 상태로 되돌릴까요?\n(넓이 · 높이 · 자리 · 두 단 폭)')) return;
    const m = modeKey(); L[m] = { it:{} };
    apply();
  }
  function paintBar(){
    document.getElementById('hle-bar')?.remove();
    const b = document.createElement('div'); b.id = 'hle-bar';
    b.innerHTML = `<div class="hle-bt"><b>✏️ 배치 바꾸는 중</b>
        <span>◢ 모서리 끌기 = 넓이 · 높이 · ⠿ 끌기 = 자리${wide() ? ' (왼쪽 ↔ 오른쪽 단)' : ''}${wide() ? ' · ║ 끌기 = 두 단 폭' : ''} · 이름표를 누르면 단추로도</span></div>
      <div class="hle-bb"><button class="hle-b0" data-a="reset">처음 상태로</button><button class="hle-b0" data-a="cancel">취소</button><button class="hle-b1" data-a="done">완료</button></div>`;
    b.addEventListener('click', e => { const a = e.target.closest('button')?.dataset.a;
      if(a === 'done') end(true); else if(a === 'cancel') end(false); else if(a === 'reset') reset(); });
    document.body.appendChild(b);
  }
  const hLabel = (s) => { const v = itemOf(s.dataset.k); return v.h ? `높이 ${v.h}` : '높이 자동'; };
  function paintEdit(){
    const bl = blocksEl(); if(!bl) return;
    bl.querySelectorAll('section.hm-b').forEach(s => {
      let o = s.querySelector(':scope > .hle');
      if(!o){
        o = document.createElement('div'); o.className = 'hle';
        o.innerHTML = `<button type="button" class="hle-tag" title="끌어서 자리 옮기기 · 누르면 크기 단추"><span class="hle-hnd">⠿</span><b></b><em></em></button>
          <span class="hle-grip" title="끌어서 넓이 · 높이 바꾸기 (두 번 누르면 높이 자동)">◢</span>`;
        s.appendChild(o);
        o.querySelector('.hle-tag').addEventListener('pointerdown', e => startMove(e, s));
        o.querySelector('.hle-grip').addEventListener('pointerdown', e => startSize(e, s));
        o.querySelector('.hle-grip').addEventListener('dblclick', e => { e.preventDefault(); setItem(s.dataset.k, { h:0 }); apply(); });   // (아래 startSize 도 두 번 누르기를 알아봄)
      }
      o.querySelector('b').textContent = (O && O.label) ? O.label(s.dataset.k) : s.dataset.k;
      // 지금 내용이 없는 창(예: 오늘 수업 없는 «내 시간표»)도 잡을 수 있게 — 고치는 동안만 자리를 조금 줌
      const thin = !s.classList.contains('hle-thin') ? s.getBoundingClientRect().height < 30 : s.scrollHeight <= 48;
      s.classList.toggle('hle-thin', thin);
      o.querySelector('em').textContent = `${WL[s.dataset.w] || '자동'} · ${hLabel(s)}${thin ? ' · 지금은 비어 있음' : ''}`;
    });
    // 두 단 경계
    bl.querySelectorAll(':scope > .hle-div').forEach(x => x.remove());
    if(bl.classList.contains('split')){
      const d = document.createElement('div'); d.className = 'hle-div'; d.title = '끌어서 두 단 폭 바꾸기';
      d.innerHTML = '<i></i>';
      bl.appendChild(d); placeDiv();
      d.addEventListener('pointerdown', startDiv);
    }
  }
  function placeDiv(){
    const bl = blocksEl(); const d = bl && bl.querySelector(':scope > .hle-div'); const cs = bl && bl.querySelector(':scope > .hm-col.s');
    if(!d || !cs) return;
    const br = bl.getBoundingClientRect(), r = cs.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(bl).columnGap) || 24;
    d.style.left = (r.left - br.left - gap / 2 - 9) + 'px';
  }
  function setItem(k, patch){
    const m = modeKey(); const cur = Object.assign({}, L[m].it[k] || {}, patch);
    if(cur.w === 'a' || cur.w === 0) delete cur.w;
    if(!cur.h) delete cur.h;
    if(m !== 'w') delete cur.c;
    if(Object.keys(cur).length) L[m].it[k] = cur; else delete L[m].it[k];
  }

  /* ◢ 넓이 · 높이 */
  let _lastTap = { k:'', t:0 };
  function startSize(ev, s){
    ev.preventDefault(); ev.stopPropagation();
    closeMenu();
    const col = s.parentElement; const cr = col.getBoundingClientRect();
    const r = s.getBoundingClientRect();
    const x0 = ev.clientX, y0 = ev.clientY; let moved = false;
    s.classList.remove('hfix'); const nat = s.getBoundingClientRect().height; apply();   // 자동일 때 높이
    const cw = cr.width;
    try{ ev.target.setPointerCapture(ev.pointerId); }catch(e){}
    s.classList.add('hle-on');
    const move = e => {
      if(!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
      moved = true;
      const wpx = Math.max(60, e.clientX - r.left);
      const frac = (wpx + G) / (cw + G) * 12;
      let w = WS.reduce((a, b) => Math.abs(b - frac) < Math.abs(a - frac) ? b : a, 12);
      if(e.clientX > cr.right + 20) w = 12;            // 단 오른쪽 끝을 넘겨 끌면 «전체» (줄 가운데 있는 창도 한 줄을 다 차지)
      let h = Math.round((e.clientY - r.top) / 10) * 10;
      h = Math.max(80, h);
      if(Math.abs(h - nat) < 18) h = 0;            // 내용 높이 근처면 «자동»
      setItem(s.dataset.k, { w, h }); apply();
    };
    const off = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); s.classList.remove('hle-on'); };
    const up = () => {
      if(_gesture === off) _gesture = null;
      off();
      if(!EDIT) return;
      if(!moved){   // 끌지 않고 두 번 누르면 높이 «자동»
        const now = Date.now();
        if(_lastTap.k === s.dataset.k && now - _lastTap.t < 450){ setItem(s.dataset.k, { h:0 }); _lastTap = { k:'', t:0 }; }
        else _lastTap = { k: s.dataset.k, t: now };
      }
      apply();
    };
    stopGesture(); _gesture = off;
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }

  /* ⠿ 자리 옮기기 (짧게 누르면 크기 단추) */
  function startMove(ev, s){
    if(ev.button != null && ev.button !== 0) return;
    ev.preventDefault();
    const x0 = ev.clientX, y0 = ev.clientY; let moved = false, ph = null, ghost = null, last = null, scr = null;
    const r = s.getBoundingClientRect();
    const bl = blocksEl();
    // 화면 위 · 아래 끝으로 끌면 저절로 올라가고 내려감 (긴 홈에서 멀리 옮기기)
    const autoScroll = () => { if(!last) return; const y = last.clientY, vh = innerHeight;
      const d = y < 70 ? -Math.ceil((70 - y) / 4) : y > vh - 70 ? Math.ceil((y - (vh - 70)) / 4) : 0;
      if(d){ scrollBy(0, d); place(last); } };
    const move = e => { last = e; place(e); };
    const place = e => {
      if(!EDIT) return;
      if(!moved){
        if(Math.hypot(e.clientX - x0, e.clientY - y0) < 6) return;
        moved = true; closeMenu();
        ph = document.createElement('section'); ph.className = 'hm-b hle-ph'; ph.dataset.w = s.dataset.w;
        if(s.dataset.w !== 'a') ph.style.setProperty('--w', s.dataset.w);
        ph.style.height = r.height + 'px';
        s.parentElement.insertBefore(ph, s);
        ghost = s; ghost.classList.add('hle-drag');
        Object.assign(ghost.style, { position:'fixed', left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', height:r.height + 'px', zIndex:3200, pointerEvents:'none' });
        document.body.appendChild(ghost);
        scr = setInterval(autoScroll, 30);
      }
      ghost.style.left = (r.left + e.clientX - x0) + 'px'; ghost.style.top = (r.top + e.clientY - y0) + 'px';
      // 어느 단 · 어느 자리
      const cols = [...bl.querySelectorAll(':scope > .hm-col')].filter(c => c.style.display !== 'none');
      let col = cols[0];
      if(wide()){
        const cs = bl.querySelector(':scope > .hm-col.s'), cm = bl.querySelector(':scope > .hm-col.m');
        const sideOn = bl.classList.contains('split');
        if(sideOn){ const rs = cs.getBoundingClientRect(); col = e.clientX >= rs.left - 12 ? cs : cm; }
        else {
          // 오른쪽 단이 비어 있으면 — 오른쪽 끝 140px 로 끌어오면 오른쪽 단을 새로 만든다
          const rm = cm.getBoundingClientRect();
          if(e.clientX > rm.right - 140){ cs.style.display = ''; bl.classList.add('split'); col = cs; }
          else col = cm;
        }
      }
      const sibs = [...col.querySelectorAll(':scope > section.hm-b:not(.hle-ph)')];
      let ref = null;
      for(const sb of sibs){
        const q = sb.getBoundingClientRect();
        const sameRow = e.clientY >= q.top && e.clientY <= q.bottom;
        if((sameRow && e.clientX < q.left + q.width / 2) || e.clientY < q.top){ ref = sb; break; }
      }
      if(ref) col.insertBefore(ph, ref); else col.appendChild(ph);
    };
    const unghost = () => { if(!ghost) return; ghost.classList.remove('hle-drag'); ['position', 'left', 'top', 'width', 'height', 'zIndex', 'pointerEvents'].forEach(p => { ghost.style[p] = ''; }); };
    const off = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); if(scr){ clearInterval(scr); scr = null; } };
    const abort = () => {   // 끌던 중에 편집이 끝남 — 창을 원래 자리 근처(빈 자리)로 돌려놓기만 하고 바꾼 것은 남기지 않음
      off(); unghost();
      if(ph){ if(ph.parentElement) ph.parentElement.insertBefore(s, ph); ph.remove(); ph = null; }
    };
    const up = () => {
      if(_gesture === abort) _gesture = null;
      off();
      if(!EDIT){ abort(); return; }
      if(!moved){ openMenu(s); return; }
      unghost();
      const col = ph.parentElement; col.insertBefore(s, ph); ph.remove(); ph = null;
      const k = s.dataset.k;
      if(wide()) setItem(k, { c: col.classList.contains('s') ? 's' : 'm' });
      // 전체 차례: 같은 단의 바로 앞 창 다음으로 (없으면 바로 뒤 창 앞으로)
      const order = O.getOrder().filter(x => x !== k);
      let pv = s.previousElementSibling; while(pv && !pv.matches('section.hm-b')) pv = pv.previousElementSibling;
      let nx = s.nextElementSibling; while(nx && !nx.matches('section.hm-b')) nx = nx.nextElementSibling;
      if(pv && order.includes(pv.dataset.k)) order.splice(order.indexOf(pv.dataset.k) + 1, 0, k);
      else if(nx && order.includes(nx.dataset.k)) order.splice(order.indexOf(nx.dataset.k), 0, k);
      else order.push(k);
      O.setOrder(order);
      apply();
    };
    stopGesture(); _gesture = abort;
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }

  /* ║ 두 단 폭 */
  function startDiv(ev){
    ev.preventDefault();
    const bl = blocksEl(); const br = bl.getBoundingClientRect();
    const d = ev.currentTarget; d.classList.add('on');
    const move = e => {
      let sw = Math.round((br.right - e.clientX) / 10) * 10;
      sw = Math.max(260, Math.min(sw, SIDE_MAX, Math.round(br.width * SIDE_FR)));
      L.w.side = sw; bl.style.setProperty('--hm-side', sw + 'px'); placeDiv();
    };
    const off = () => { d.classList.remove('on'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); };
    const up = () => { if(_gesture === off) _gesture = null; off(); if(EDIT) apply(); };
    stopGesture(); _gesture = off;
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }

  /* 크기 단추 (이름표를 짧게 누르면) — 패드 · 끌기 어려울 때 */
  function closeMenu(){ document.querySelectorAll('.hle-menu').forEach(x => x.remove()); }
  function openMenu(s){
    closeMenu();
    const k = s.dataset.k, v = itemOf(k), W = wide();
    const m = document.createElement('div'); m.className = 'hle-menu';
    const wb = ['a', 3, 4, 6, 8, 9, 12].map(w => `<button data-w="${w}" class="${String(v.w || 'a') === String(w) ? 'on' : ''}">${WL[w]}</button>`).join('');
    m.innerHTML = `<div class="hm-r"><span>넓이</span>${wb}</div>
      <div class="hm-r"><span>높이</span><button data-h="0" class="${!v.h ? 'on' : ''}">자동</button><button data-h="-80">줄이기</button><button data-h="80">늘리기</button></div>
      ${W ? `<div class="hm-r"><span>자리</span><button data-c="m" class="${colOf(k) === 'm' ? 'on' : ''}">왼쪽 단</button><button data-c="s" class="${colOf(k) === 's' ? 'on' : ''}">오른쪽 단</button></div>` : ''}
      <div class="hm-r"><span>차례</span><button data-mv="-1">▲ 앞으로</button><button data-mv="1">▼ 뒤로</button></div>`;
    m.addEventListener('pointerdown', e => e.stopPropagation());
    m.addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.w != null) setItem(k, { w: b.dataset.w === 'a' ? 'a' : Number(b.dataset.w) });
      if(b.dataset.h != null){
        const dh = Number(b.dataset.h);
        if(!dh) setItem(k, { h:0 });
        else { const cur = v.h || Math.round(s.getBoundingClientRect().height / 10) * 10; setItem(k, { h: Math.max(80, Math.min(2400, cur + dh)) }); }
      }
      if(b.dataset.c) setItem(k, { c: b.dataset.c });
      if(b.dataset.mv){
        const order = O.getOrder().slice(); const col = s.parentElement;
        const sib = [...col.querySelectorAll(':scope > section.hm-b')]; const i = sib.indexOf(s); const j = i + Number(b.dataset.mv);
        if(j >= 0 && j < sib.length){
          const other = sib[j].dataset.k; const a = order.indexOf(k), c = order.indexOf(other);
          if(a >= 0 && c >= 0){ order[a] = other; order[c] = k; O.setOrder(order); }
        }
      }
      apply(); openMenu(s);
    });
    s.appendChild(m);
  }
  document.addEventListener('pointerdown', e => { if(!e.target.closest('.hle-menu') && !e.target.closest('.hle-tag')) closeMenu(); });
  window.addEventListener('resize', () => { if(EDIT){ placeDiv(); } });
  window.addEventListener('gyosa:lay', () => { try{ apply(); if(EDIT) paintBar(); }catch(e){} });
  try{ matchMedia('(max-width:760px)').addEventListener('change', () => { try{ if(EDIT && phone()) end(false); apply(); }catch(e){} }); }catch(e){}
  document.addEventListener('keydown', e => { if(EDIT && e.key === 'Escape'){ if(document.querySelector('.hle-menu')) closeMenu(); else end(false); } });

  window.HomeLayout = {
    init(opts){ O = opts || {}; },
    set(x){ L = norm(x); if(!EDIT) apply(); },
    get(){ return clone(L); },
    apply, begin, end, editing: () => !!EDIT, norm,
  };
})();
