/* ═══════════════════════════════════════════════
   loading.js — 전체 화면 로딩 (밤하늘 궁창 · 은하수 · 별똥별)
   API:
     window.showLoading('문구')
     window.setLoadStep('문구', 퍼센트)
     window.hideLoading()
   ═══════════════════════════════════════════════ */
(function(){
  const CSS = `
  #loadOverlay{
    position:fixed; inset:0; z-index:9999;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden;
    visibility:hidden; pointer-events:none;
    background:
      radial-gradient(120% 90% at 78% 8%,  rgba(0,112,74,0.20) 0%, rgba(0,0,0,0) 55%),
      radial-gradient(110% 80% at 12% 92%, rgba(176,141,60,0.13) 0%, rgba(0,0,0,0) 55%),
      linear-gradient(170deg, #08130F 0%, #10241D 42%, #1E3932 100%);
    opacity:0; transition:opacity .16s ease, visibility 0s linear .16s;
  }
  #loadOverlay.on{ visibility:visible; pointer-events:auto; opacity:1; transition:opacity .16s ease, visibility 0s; }

  /* ── 은하수 띠 ── */
  #loadOverlay .sky-way{
    position:absolute; left:-25%; top:-15%;
    width:150%; height:130%;
    background:
      radial-gradient(closest-side at 50% 50%, rgba(212,233,226,0.16) 0%, rgba(212,233,226,0.07) 40%, rgba(0,0,0,0) 72%);
    transform:rotate(-24deg) scaleY(.30);
    filter:blur(14px);
    animation:skyDrift 16s ease-in-out infinite alternate;
  }
  #loadOverlay .sky-way.b{
    background:radial-gradient(closest-side at 50% 50%, rgba(176,141,60,0.13) 0%, rgba(0,0,0,0) 68%);
    transform:rotate(-24deg) scaleY(.16) translateY(-14px);
    animation-duration:22s;
  }
  @keyframes skyDrift{
    from{ opacity:.55; transform:rotate(-25deg) scaleY(.28) translateX(-1.5%); }
    to  { opacity:1;   transform:rotate(-22deg) scaleY(.34) translateX(1.5%); }
  }

  /* ── 별 ── */
  #loadOverlay .sky-stars{ position:absolute; inset:0; }
  #loadOverlay .star{
    position:absolute; border-radius:50%;
    background:#fff;
    animation:twinkle var(--tw,3s) ease-in-out infinite;
    animation-delay:var(--dl,0s);
  }
  @keyframes twinkle{
    0%,100%{ opacity:var(--o1,.25); transform:scale(.85); }
    50%    { opacity:var(--o2,1);   transform:scale(1.15); }
  }
  /* 큰 별 — 십자 반짝임 */
  #loadOverlay .star.big::before,
  #loadOverlay .star.big::after{
    content:''; position:absolute; left:50%; top:50%;
    background:linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.75) 50%, rgba(255,255,255,0) 100%);
    transform:translate(-50%,-50%);
  }
  #loadOverlay .star.big::before{ width:14px; height:1px; }
  #loadOverlay .star.big::after { width:1px; height:14px; }

  /* ── 별똥별 ── */
  #loadOverlay .shoot{
    position:absolute; width:3px; height:3px; border-radius:50%;
    background:#fff; box-shadow:0 0 10px 2px rgba(255,255,255,.9);
    opacity:0;
    transform:rotate(22deg);
    animation:shootFly var(--sd,1.9s) linear infinite;
    animation-delay:var(--sdl,0s);
  }
  #loadOverlay .shoot::after{
    content:''; position:absolute; right:2px; top:50%;
    width:var(--tail,170px); height:2px; transform:translateY(-50%);
    background:linear-gradient(270deg,
      rgba(255,255,255,1) 0%,
      rgba(232,217,168,.55) 30%,
      rgba(212,233,226,.25) 60%,
      rgba(255,255,255,0) 100%);
    border-radius:100px;
    filter:blur(.3px);
  }
  /* 뜨자마자 곧바로 날아가고, 끊김 없이 이어짐 */
  @keyframes shootFly{
    0%   { opacity:0;  transform:translate(-60px,-25px) rotate(22deg) scale(.6); }
    8%   { opacity:1;  }
    75%  { opacity:1;  }
    100% { opacity:0;  transform:translate(var(--dx,520px), var(--dy,215px)) rotate(22deg) scale(1); }
  }

  /* ── 가운데 내용 ── */
  #loadOverlay .lo-card{
    position:relative; z-index:2;
    display:flex; flex-direction:column; align-items:center; gap:18px;
    padding:30px 40px;
    transform:translateY(8px); transition:transform .3s cubic-bezier(.2,.8,.2,1);
  }
  #loadOverlay.on .lo-card{ transform:none; }

  /* 북극성 (가운데 큰 별) */
  .lo-north{ position:relative; width:84px; height:84px; }
  .lo-north svg{ width:84px; height:84px; display:block; overflow:visible; }
  .lo-halo{
    transform-origin:42px 42px;
    animation:haloPulse 2.6s ease-in-out infinite;
  }
  @keyframes haloPulse{
    0%,100%{ opacity:.35; transform:scale(.9); }
    50%    { opacity:.85; transform:scale(1.06); }
  }
  .lo-ray{ transform-origin:42px 42px; animation:raySpin 9s linear infinite; }
  @keyframes raySpin{ to{ transform:rotate(360deg); } }
  .lo-twinkle{ transform-origin:42px 42px; animation:starBeat 1.9s ease-in-out infinite; }
  @keyframes starBeat{
    0%,100%{ transform:scale(1);    opacity:1; }
    50%    { transform:scale(1.12); opacity:.9; }
  }

  /* 문구 */
  .lo-cap{
    font-size:15px; font-weight:700; color:#F2F0EB; letter-spacing:-.2px;
    min-height:20px; text-align:center; text-shadow:0 1px 12px rgba(0,0,0,.35);
    font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;
  }
  .lo-sub{
    font-size:12px; color:rgba(212,233,226,.65); margin-top:-12px;
    min-height:16px; text-align:center; font-family:inherit; letter-spacing:.3px;
  }

  /* 진행 바 */
  .lo-bar{
    width:200px; height:3px; border-radius:100px;
    background:rgba(212,233,226,0.16); overflow:hidden; position:relative;
  }
  .lo-fill{
    height:100%; width:0%; border-radius:100px;
    background:linear-gradient(90deg, #D4E9E2, #FFFFFF 55%, #E8D9A8);
    box-shadow:0 0 10px rgba(255,255,255,.55);
    transition:width .45s cubic-bezier(.2,.8,.2,1);
  }
  .lo-bar.indet .lo-fill{
    width:36% !important; transition:none;
    animation:loSlide 1.35s cubic-bezier(.5,0,.5,1) infinite;
  }
  @keyframes loSlide{
    0%   { transform:translateX(-110%); }
    100% { transform:translateX(320%); }
  }

  @media (prefers-reduced-motion:reduce){
    #loadOverlay *{ animation:none !important; }
  }`;

  const st = document.createElement('style');
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  let ov = null;

  /* 별밭 생성 */
  function starsHTML(){
    let s = '';
    const N = 70;
    for(let i=0;i<N;i++){
      const x  = Math.random()*100;
      const y  = Math.random()*100;
      const r  = Math.random();
      const sz = r > 0.93 ? 2.6 : r > 0.75 ? 1.8 : 1.1;   // 대부분 작게
      const big = r > 0.955;
      const tw = (2.2 + Math.random()*3.4).toFixed(2);
      const dl = (Math.random()*4).toFixed(2);
      const o1 = (0.12 + Math.random()*0.25).toFixed(2);
      const o2 = (0.7 + Math.random()*0.3).toFixed(2);
      s += `<span class="star${big?' big':''}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${sz}px;height:${sz}px;--tw:${tw}s;--dl:${dl}s;--o1:${o1};--o2:${o2}"></span>`;
    }
    return s;
  }

  /* 별똥별 — 뜨자마자 곧바로, 끊임없이 날아가도록 */
  function shootHTML(){
    // dl(지연)을 0부터 촘촘히 깔아 로딩이 짧아도 바로 보이게 함
    const conf = [
      { x:-6, y:-4, d:1.5, dl:0.00, tail:200, dx:640, dy:265 },
      { x:22, y:-8, d:1.9, dl:0.12, tail:160, dx:560, dy:230 },
      { x:48, y:-6, d:1.7, dl:0.30, tail:185, dx:600, dy:248 },
      { x:-2, y:16, d:2.1, dl:0.45, tail:150, dx:520, dy:215 },
      { x:66, y:-9, d:1.6, dl:0.62, tail:210, dx:660, dy:272 },
      { x:30, y:14, d:2.0, dl:0.80, tail:145, dx:500, dy:206 },
      { x:8,  y:34, d:1.8, dl:0.98, tail:175, dx:580, dy:240 },
      { x:54, y:20, d:2.2, dl:1.18, tail:130, dx:470, dy:194 },
      { x:76, y:10, d:1.7, dl:1.35, tail:195, dx:620, dy:256 },
      { x:38, y:38, d:1.9, dl:1.55, tail:165, dx:545, dy:225 },
    ];
    return conf.map(c =>
      `<span class="shoot" style="left:${c.x}%;top:${c.y}%;--sd:${c.d}s;--sdl:${c.dl}s;--tail:${c.tail}px;--dx:${c.dx}px;--dy:${c.dy}px"></span>`
    ).join('');
  }

  function build(){
    ov = document.createElement('div');
    ov.id = 'loadOverlay';
    ov.innerHTML = `
      <div class="sky-way"></div>
      <div class="sky-way b"></div>
      <div class="sky-stars">${starsHTML()}${shootHTML()}</div>

      <div class="lo-card">
        <div class="lo-north">
          <svg viewBox="0 0 84 84" aria-hidden="true">
            <defs>
              <radialGradient id="loGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.55"/>
                <stop offset="45%"  stop-color="#D4E9E2" stop-opacity="0.22"/>
                <stop offset="100%" stop-color="#D4E9E2" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <!-- 후광 -->
            <circle class="lo-halo" cx="42" cy="42" r="38" fill="url(#loGlow)"/>
            <!-- 천천히 도는 빛살 -->
            <g class="lo-ray" opacity="0.5">
              <line x1="42" y1="6"  x2="42" y2="18" stroke="#D4E9E2" stroke-width="1" stroke-linecap="round"/>
              <line x1="42" y1="66" x2="42" y2="78" stroke="#D4E9E2" stroke-width="1" stroke-linecap="round"/>
              <line x1="6"  y1="42" x2="18" y2="42" stroke="#D4E9E2" stroke-width="1" stroke-linecap="round"/>
              <line x1="66" y1="42" x2="78" y2="42" stroke="#D4E9E2" stroke-width="1" stroke-linecap="round"/>
            </g>
            <!-- 북극성 (4방향 별) -->
            <g class="lo-twinkle">
              <path d="M42 14 L46.4 37.6 L70 42 L46.4 46.4 L42 70 L37.6 46.4 L14 42 L37.6 37.6 Z"
                    fill="#FFFFFF"/>
              <path d="M42 26 L44.2 39.8 L58 42 L44.2 44.2 L42 58 L39.8 44.2 L26 42 L39.8 39.8 Z"
                    fill="#E8D9A8"/>
              <circle cx="42" cy="42" r="3.4" fill="#FFFFFF"/>
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
    if(!document.body) return null;
    if(!ov || !document.body.contains(ov)) build();
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
    if(ov) ov.classList.remove('on');
  };

  /* 페이지 이동 시 자동 표시 */
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if(a.target === '_blank' || a.hasAttribute('download')) return;
    if(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    try {
      const url = new URL(href, location.href);
      if(url.origin !== location.origin) return;
      if(url.pathname === location.pathname) return;
    } catch(err){ return; }
    window.showLoading('페이지를 여는 중…');
  }, true);

  window.addEventListener('pageshow', function(){ window.hideLoading(); });
})();
