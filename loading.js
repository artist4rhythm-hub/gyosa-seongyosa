/* ===== 공통 졸라맨 로딩 화면 (loading.js) =====
   사용법: 페이지에서 <script src="loading.js"></script> 로드 후
   window.showLoading('문구'), window.setLoadStep('문구', 퍼센트), window.hideLoading()
   CSS·HTML은 이 파일이 자동으로 주입합니다. */
(function(){
  // 중복 로드 방지
  if(window.__loadingReady) return;
  window.__loadingReady = true;

  // ---- CSS 주입 ----
  const css = `
  #loadOverlay{position:fixed;inset:0;z-index:3000;display:none;flex-direction:column;align-items:center;justify-content:center;
    background:linear-gradient(150deg,#eef0f8 0%,#f5f0e8 55%,#fdf3d8 100%);}
  #loadOverlay.show{display:flex;}
  #loadOverlay .load-stage{width:200px;height:160px;position:relative;margin-bottom:8px;}
  #loadOverlay .load-svg{width:100%;height:100%;}
  #loadOverlay .load-caption{font-size:15px;font-weight:700;color:#1e2e5c;margin-bottom:4px;min-height:20px;text-align:center;}
  #loadOverlay .load-sub{font-size:12.5px;color:#8888aa;margin-bottom:18px;min-height:16px;text-align:center;padding:0 20px;}
  #loadOverlay .load-bar{width:220px;height:8px;background:#e2ddd0;border-radius:100px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.08);}
  #loadOverlay .load-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#2b3990,#5a70cc);border-radius:100px;transition:width .4s ease;}
  #loadOverlay .load-pct{font-size:11px;color:#8888aa;margin-top:8px;font-variant-numeric:tabular-nums;}
  @keyframes sm-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  @keyframes sm-armL{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-24deg)}}
  @keyframes sm-armR{0%,100%{transform:rotate(0deg)}50%{transform:rotate(24deg)}}
  @keyframes sm-legL{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-6deg)}}
  @keyframes sm-legR{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
  @keyframes sm-note{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translateY(-40px) scale(1.1)}}
  @keyframes sm-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
  #loadOverlay .sm-body{animation:sm-bounce 0.6s ease-in-out infinite;transform-origin:center;}
  #loadOverlay .sm-armL{animation:sm-armL 0.35s ease-in-out infinite;transform-origin:top center;}
  #loadOverlay .sm-armR{animation:sm-armR 0.35s ease-in-out infinite;transform-origin:top center;}
  #loadOverlay .sm-legL{animation:sm-legL 0.6s ease-in-out infinite;transform-origin:top center;}
  #loadOverlay .sm-legR{animation:sm-legR 0.6s ease-in-out infinite;transform-origin:top center;}
  #loadOverlay .sm-note{animation:sm-note 1.1s ease-out infinite;}
  #loadOverlay .sm-note.n2{animation-delay:.4s;} #loadOverlay .sm-note.n3{animation-delay:.8s;}
  #loadOverlay .sm-inst{animation:sm-shake 0.4s ease-in-out infinite;transform-origin:center;}
  @media (prefers-reduced-motion:reduce){
    #loadOverlay .sm-body,#loadOverlay .sm-armL,#loadOverlay .sm-armR,#loadOverlay .sm-legL,#loadOverlay .sm-legR,#loadOverlay .sm-note,#loadOverlay .sm-inst{animation:none;}
  }`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  // ---- HTML 주입 ----
  function injectHTML(){
    if(document.getElementById('loadOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'loadOverlay';
    ov.innerHTML = `
      <div class="load-stage"><div class="load-svg" id="load-svg"></div></div>
      <div class="load-caption" id="load-caption">준비하는 중…</div>
      <div class="load-sub" id="load-sub"></div>
      <div class="load-bar"><div class="load-bar-fill" id="load-bar-fill"></div></div>
      <div class="load-pct" id="load-pct">0%</div>`;
    document.body.appendChild(ov);
  }
  if(document.body) injectHTML();
  else document.addEventListener('DOMContentLoaded', injectHTML);

  // ---- 졸라맨 SVG ----
  const STICK_FIGURES = [
    { name:'드럼', emoji:'🥁', inst:`
      <ellipse cx="100" cy="150" rx="26" ry="7" fill="#c9a84c" opacity="0.3"/>
      <g class="sm-inst"><ellipse cx="78" cy="128" rx="15" ry="6" fill="#2b3990"/><rect x="63" y="128" width="30" height="14" fill="#3a4aa8"/><ellipse cx="78" cy="142" rx="15" ry="6" fill="#1e2e5c"/>
      <ellipse cx="122" cy="128" rx="15" ry="6" fill="#c9a84c"/><rect x="107" y="128" width="30" height="14" fill="#d4b968"/><ellipse cx="122" cy="142" rx="15" ry="6" fill="#a8873a"/></g>` },
    { name:'기타', emoji:'🎸', inst:`
      <g class="sm-inst"><rect x="95" y="95" width="6" height="52" rx="3" fill="#8B4513" transform="rotate(28 98 120)"/>
      <ellipse cx="118" cy="135" rx="17" ry="21" fill="#c9702a"/><ellipse cx="118" cy="135" rx="7" ry="8" fill="#3a2410"/></g>` },
    { name:'피아노', emoji:'🎹', inst:`
      <g class="sm-inst"><rect x="72" y="128" width="56" height="16" rx="2" fill="#1a1a2e"/>
      <rect x="74" y="130" width="7" height="12" fill="#fff"/><rect x="82" y="130" width="7" height="12" fill="#fff"/><rect x="90" y="130" width="7" height="12" fill="#fff"/><rect x="98" y="130" width="7" height="12" fill="#fff"/><rect x="106" y="130" width="7" height="12" fill="#fff"/><rect x="114" y="130" width="7" height="12" fill="#fff"/>
      <rect x="79" y="130" width="4" height="7" fill="#1a1a2e"/><rect x="88" y="130" width="4" height="7" fill="#1a1a2e"/><rect x="104" y="130" width="4" height="7" fill="#1a1a2e"/><rect x="112" y="130" width="4" height="7" fill="#1a1a2e"/></g>` },
    { name:'트럼펫', emoji:'🎺', inst:`
      <g class="sm-inst"><rect x="95" y="112" width="34" height="7" rx="3" fill="#c9a84c"/>
      <path d="M125 108 L140 100 L140 130 L125 122 Z" fill="#d4b968"/><circle cx="102" cy="115" r="2.5" fill="#a8873a"/><circle cx="110" cy="115" r="2.5" fill="#a8873a"/><circle cx="118" cy="115" r="2.5" fill="#a8873a"/></g>` },
    { name:'바이올린', emoji:'🎻', inst:`
      <g class="sm-inst"><ellipse cx="112" cy="118" rx="13" ry="19" fill="#8B4513" transform="rotate(-30 112 118)"/>
      <rect x="118" y="90" width="4" height="30" rx="2" fill="#5a3410" transform="rotate(-30 120 105)"/>
      <rect x="70" y="118" width="52" height="3" rx="1.5" fill="#3a2410" transform="rotate(-12 96 120)"/></g>` },
    { name:'마이크', emoji:'🎤', inst:`
      <g class="sm-inst"><circle cx="118" cy="108" r="9" fill="#444"/><rect x="115" y="115" width="6" height="26" rx="3" fill="#888"/></g>` },
    { name:'탬버린', emoji:'🪘', inst:`
      <g class="sm-inst"><circle cx="120" cy="118" r="16" fill="none" stroke="#c9702a" stroke-width="4"/><circle cx="108" cy="107" r="2.5" fill="#d4b968"/><circle cx="132" cy="107" r="2.5" fill="#d4b968"/><circle cx="132" cy="129" r="2.5" fill="#d4b968"/><circle cx="108" cy="129" r="2.5" fill="#d4b968"/></g>` },
  ];

  function stickFigureSVG(fig){
    return `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">
      <text class="sm-note" x="50" y="60" font-size="20" fill="#2b3990">♪</text>
      <text class="sm-note n2" x="140" y="50" font-size="24" fill="#c9a84c">♫</text>
      <text class="sm-note n3" x="95" y="35" font-size="18" fill="#5a70cc">♪</text>
      <g class="sm-body">
        <circle cx="100" cy="55" r="15" fill="none" stroke="#1e2e5c" stroke-width="3.5"/>
        <line x1="100" y1="70" x2="100" y2="112" stroke="#1e2e5c" stroke-width="3.5" stroke-linecap="round"/>
        <line class="sm-armL" x1="100" y1="82" x2="78" y2="105" stroke="#1e2e5c" stroke-width="3.5" stroke-linecap="round"/>
        <line class="sm-armR" x1="100" y1="82" x2="122" y2="105" stroke="#1e2e5c" stroke-width="3.5" stroke-linecap="round"/>
        <line class="sm-legL" x1="100" y1="112" x2="86" y2="145" stroke="#1e2e5c" stroke-width="3.5" stroke-linecap="round"/>
        <line class="sm-legR" x1="100" y1="112" x2="114" y2="145" stroke="#1e2e5c" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      ${fig.inst}
    </svg>`;
  }

  const LOAD_MSGS = ['잠시만요, 준비하고 있어요','신나게 불러오는 중…','거의 다 왔어요','리듬을 타고 가져오는 중…','한 박자만 기다려 주세요'];
  let _loadTimer = null, _loadPct = 0;
  const $ = id => document.getElementById(id);

  window.showLoading = function(caption){
    injectHTML();
    const ov = $('loadOverlay'); if(!ov) return;
    const fig = STICK_FIGURES[Math.floor(Math.random()*STICK_FIGURES.length)];
    $('load-svg').innerHTML = stickFigureSVG(fig);
    $('load-caption').textContent = caption || '불러오는 중…';
    $('load-sub').textContent = `${fig.emoji} ${fig.name} 연주하며 ${LOAD_MSGS[Math.floor(Math.random()*LOAD_MSGS.length)]}`;
    _loadPct = 0; window.setLoadPct(8);
    ov.classList.add('show');
    clearInterval(_loadTimer);
    _loadTimer = setInterval(()=>{
      if(_loadPct < 90) window.setLoadPct(_loadPct + Math.max(1, Math.round((90-_loadPct)/8)));
    }, 260);
  };
  window.setLoadStep = function(caption, pct){
    if(caption && $('load-caption')) $('load-caption').textContent = caption;
    if(pct!=null) window.setLoadPct(pct);
  };
  window.setLoadPct = function(p){
    _loadPct = Math.min(100, Math.max(0, p));
    const f = $('load-bar-fill'); if(f) f.style.width = _loadPct+'%';
    const t = $('load-pct'); if(t) t.textContent = _loadPct+'%';
  };
  window.hideLoading = function(){
    clearInterval(_loadTimer);
    window.setLoadPct(100);
    setTimeout(()=>{ const ov=$('loadOverlay'); if(ov) ov.classList.remove('show'); }, 350);
  };
})();
