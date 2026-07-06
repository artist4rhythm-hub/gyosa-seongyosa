/* ===== 공통 모달 닫기 버튼 (modal-close.js) =====
   맥 스타일: 모달(.mbox) 좌측 상단에 원형 닫기 버튼을 자동으로 추가.
   사용법: <script src="modal-close.js"></script> 만 넣으면 됨.
   - 화면에 나타나는 모든 .mbox 안에 좌측 상단 닫기 버튼을 자동 삽입
   - 버튼 클릭 시: 가장 가까운 오버레이(.mov / [id$="-mod"] / [id$="-overlay"])를 제거
   - 이미 닫기 버튼이 있어도 중복 없이 하나만 유지
*/
(function(){
  if(window.__modalCloseReady) return;
  window.__modalCloseReady = true;

  // ---- CSS 주입 ----
  const css = `
  .mac-close{
    position:absolute; top:14px; left:14px; z-index:20;
    width:13px; height:13px; border-radius:50%;
    border:none; padding:0; cursor:pointer;
    background:#ff5f57;
    box-shadow:0 0 0 0.5px rgba(0,0,0,0.12);
    display:flex; align-items:center; justify-content:center;
    transition:filter .15s ease, transform .1s ease;
  }
  .mac-close::before{
    content:'✕';
    font-size:9px; font-weight:900; line-height:1;
    color:rgba(0,0,0,0.55);
    opacity:0; transition:opacity .15s ease;
    margin-top:-0.5px;
  }
  .mac-close:hover{ filter:brightness(0.95); }
  .mac-close:hover::before{ opacity:1; }
  .mac-close:active{ transform:scale(0.92); }
  /* 신호등 장식용 두 점 (노랑·초록, 비활성 느낌) */
  .mac-dots{
    position:absolute; top:14px; left:34px; z-index:20;
    display:flex; gap:8px; pointer-events:none;
  }
  .mac-dots i{ width:13px; height:13px; border-radius:50%; display:block; box-shadow:0 0 0 0.5px rgba(0,0,0,0.10); }
  .mac-dots i.y{ background:#febc2e; }
  .mac-dots i.g{ background:#28c840; }
  /* 모달 박스에 좌측 상단 여백 확보 (버튼 자리) */
  .mbox.mac-has-close{ padding-top:42px; }
  .mbox.mac-has-close .mtitle{ padding-right:20px; }
  @media (prefers-reduced-motion:reduce){
    .mac-close{ transition:none; }
  }`;
  const st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ---- 오버레이 찾기 ----
  function findOverlay(box){
    // 우선순위: .mov 부모 → id가 -mod/-overlay로 끝나는 부모
    let el = box.parentElement;
    while(el && el !== document.body){
      if(el.classList && el.classList.contains('mov')) return el;
      if(el.id && (/-mod$/.test(el.id) || /-overlay$/.test(el.id) || /-modal$/.test(el.id))) return el;
      el = el.parentElement;
    }
    // 못 찾으면 .mbox 자신을 감싼 최상위(오버레이 역할) 반환
    return box.closest('.mov') || box.parentElement;
  }

  function closeModal(box){
    const ov = findOverlay(box);
    if(ov && ov !== document.body){ ov.remove(); }
    else { box.remove(); }
  }

  // ---- .mbox에 버튼 삽입 ----
  function decorate(box){
    if(!box || box.classList.contains('mac-has-close')) return;
    box.classList.add('mac-has-close');
    if(getComputedStyle(box).position === 'static') box.style.position = 'relative';

    const btn = document.createElement('button');
    btn.className = 'mac-close';
    btn.setAttribute('aria-label','닫기');
    btn.title = '닫기';
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      closeModal(box);
    });
    const dots = document.createElement('div');
    dots.className = 'mac-dots';
    dots.innerHTML = '<i class="y"></i><i class="g"></i>';

    box.insertBefore(dots, box.firstChild);
    box.insertBefore(btn, box.firstChild);
  }

  function scan(root){
    const boxes = (root || document).querySelectorAll('.mbox:not(.mac-has-close)');
    boxes.forEach(decorate);
  }

  // ---- 동적으로 추가되는 모달 감지 ----
  const mo = new MutationObserver(muts=>{
    for(const m of muts){
      for(const node of m.addedNodes){
        if(node.nodeType !== 1) continue;
        if(node.classList && node.classList.contains('mbox')) decorate(node);
        else if(node.querySelectorAll) scan(node);
      }
    }
  });

  function start(){
    scan(document);
    mo.observe(document.body, {childList:true, subtree:true});
  }
  if(document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  // ESC로도 닫기 (가장 위 모달)
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){
      const boxes = document.querySelectorAll('.mbox.mac-has-close');
      if(boxes.length){ closeModal(boxes[boxes.length-1]); }
    }
  });
})();
