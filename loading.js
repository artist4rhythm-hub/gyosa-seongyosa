/* ═══════════════════════════════════════════════
   loading.js — 전체 화면 로딩 오버레이
   API:
     window.showLoading('문구')
     window.setLoadStep('문구', 퍼센트)
     window.hideLoading()
   ═══════════════════════════════════════════════ */
(function(){
  const CSS = `
  #loadOverlay{
    position:fixed; inset:0; z-index:9999;
    display:none; align-items:center; justify-content:center;
    background:rgba(242,240,235,0.82);
    -webkit-backdrop-filter:blur(10px) saturate(1.05);
    backdrop-filter:blur(10px) saturate(1.05);
    opacity:0; transition:opacity .22s ease;
  }
  #loadOverlay.on{ display:flex; opacity:1; }
  #loadOverlay .lo-card{
    display:flex; flex-direction:column; align-items:center; gap:20px;
    padding:34px 42px;
    transform:translateY(6px) scale(.98);
    transition:transform .28s cubic-bezier(.2,.8,.2,1);
  }
  #loadOverlay.on .lo-card{ transform:none; }

  /* ── 링 + 파동 ── */
  .lo-mark{ position:relative; width:96px; height:96px; }
  .lo-mark svg{ width:96px; height:96px; display:block; }

  /* 바깥 파동 (은은하게 번짐) */
  .lo-wave{
    position:absolute; inset:0; border-radius:50%;
    border:1.5px solid rgba(0,112,74,0.30);
    animation:loWave 2.1s cubic-bezier(.2,.7,.3,1) infinite;
  }
  .lo-wave:nth-child(2){ animation-delay:.7s; }
  @keyframes loWave{
    0%   { transform:scale(.72); opacity:.55; }
    70%  { opacity:0; }
    100% { transform:scale(1.28); opacity:0; }
  }

  /* 회전하는 호 */
  .lo-arc{
    transform-origin:50% 50%;
    animation:loSpin 1.15s cubic-bezier(.55,.15,.45,.85) infinite;
  }
  @keyframes loSpin{ to{ transform:rotate(360deg); } }

  /* 가운데 점 (숨쉬듯) */
  .lo-core{ animation:loPulse 1.7s ease-in-out infinite; transform-origin:50% 50%; }
  @keyframes loPulse{
    0%,100% { transform:scale(1);    opacity:1; }
    50%     { transform:scale(.78);  opacity:.72; }
  }

  /* 궤도 도는 작은 점 */
  .lo-orbit{ transform-origin:48px 48px; animation:loSpin 2.6s linear infinite; }

  /* ── 문구 ── */
  .lo-cap{
    font-size:15px; font-weight:700; color:#1E3932;
    letter-spacing:-.2px; min-height:20px; text-align:center;
    font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;
  }
  .lo-sub{
    font-size:12px; color:#93A09A; margin-top:-14px; min-height:16px; text-align:center;
    font-family:inherit;
  }

  /* ── 진행 바 ── */
  .lo-bar{
    width:190px; height:4px; border-radius:100px;
    background:rgba(30,57,50,0.10); overflow:hidden; position:relative;
  }
  .lo-fill{
    height:100%; width:0%; border-radius:100px;
    background:linear-gradient(90deg,#00704A,#4DA98A);
    transition:width .45s cubic-bezier(.2,.8,.2,1);
  }
  /* 퍼센트를 모를 때: 좌우로 흐르는 표시 */
  .lo-bar.indet .lo-fill{
    width:38% !important; transition:none;
    animation:loSlide 1.25s cubic-bezier(.5,0,.5,1) infinite;
  }
  @keyframes loSlide{
    0%   { transform:translateX(-110%); }
    100% { transform:translateX(300%); }
  }

  @media (prefers-reduced-motion:reduce){
    .lo-wave,.lo-arc,.lo-core,.lo-orbit,.lo-bar.indet .lo-fill{ animation:none !important; }
  }`;

  const st = document.createElement('style');
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  let ov = null, sub = '';

  function build(){
    ov = document.createElement('div');
    ov.id = 'loadOverlay';
    ov.innerHTML = `
      <div class="lo-card">
        <div class="lo-mark">
          <span class="lo-wave"></span>
          <span class="lo-wave"></span>
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <!-- 바탕 링 -->
            <circle cx="48" cy="48" r="34" fill="none" stroke="rgba(30,57,50,0.10)" stroke-width="4"/>
            <!-- 회전 호 -->
            <g class="lo-arc">
              <circle cx="48" cy="48" r="34" fill="none" stroke="#00704A" stroke-width="4"
                      stroke-linecap="round" stroke-dasharray="54 160"/>
            </g>
            <!-- 궤도 점 -->
            <g class="lo-orbit">
              <circle cx="48" cy="14" r="3.2" fill="#B08D3C"/>
            </g>
            <!-- 가운데 -->
            <g class="lo-core">
              <circle cx="48" cy="48" r="13" fill="#1E3932"/>
              <circle cx="48" cy="48" r="5"  fill="#D4E9E2"/>
            </g>
          </svg>
        </div>
        <div class="lo-cap" id="lo-cap">불러오는 중…</div>
        <div class="lo-sub" id="lo-sub"></div>
        <div class="lo-bar indet" id="lo-bar"><div class="lo-fill" id="lo-fill"></div></div>
      </div>`;
    document.body.appendChild(ov);
  }

  function ensure(){
    if(!ov || !document.body.contains(ov)){
      if(!document.body){ return null; }
      build();
    }
    return ov;
  }

  window.showLoading = function(caption){
    const o = ensure(); if(!o) return;
    const cap = document.getElementById('lo-cap');
    if(cap) cap.textContent = caption || '불러오는 중…';
    const s = document.getElementById('lo-sub'); if(s) s.textContent = '';
    const bar = document.getElementById('lo-bar');
    const fill = document.getElementById('lo-fill');
    if(bar) bar.classList.add('indet');
    if(fill) fill.style.width = '0%';
    o.classList.add('on');
  };

  window.setLoadStep = function(caption, pct){
    const o = ensure(); if(!o) return;
    if(!o.classList.contains('on')) o.classList.add('on');
    const cap = document.getElementById('lo-cap');
    if(cap && caption) cap.textContent = caption;
    const bar = document.getElementById('lo-bar');
    const fill = document.getElementById('lo-fill');
    if(typeof pct === 'number' && !isNaN(pct)){
      if(bar) bar.classList.remove('indet');
      if(fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
      const s = document.getElementById('lo-sub');
      if(s) s.textContent = Math.round(pct) + '%';
    }
  };

  window.hideLoading = function(){
    if(!ov) return;
    ov.classList.remove('on');
  };

  /* ── 페이지 이동 시 자동 표시 ──
     사이드바·카드 등 내부 링크를 누르면 곧바로 로딩을 띄워
     "아무 반응 없는 것처럼 보이는" 구간을 없앱니다. */
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if(a.target === '_blank' || a.hasAttribute('download')) return;
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // 같은 사이트의 다른 페이지로 이동할 때만
    try {
      const url = new URL(href, location.href);
      if(url.origin !== location.origin) return;
      if(url.pathname === location.pathname) return;   // 같은 페이지 내 이동은 제외
    } catch(err){ return; }
    window.showLoading('페이지를 여는 중…');
  }, true);

  // 뒤로가기 등으로 복귀했을 때 남아있지 않도록
  window.addEventListener('pageshow', function(){ window.hideLoading(); });
})();
