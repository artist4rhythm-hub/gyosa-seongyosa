/* ═══════════════════════════════════════════════════════════
   🏛 showroom.js — «전시장» 공통 손질 (v157)
   sidebar.js 가 화면을 만들 때 한 번 불러온다. 화면 파일은 고치지 않는다.
   ① 그림 문자(이모지) → 선 아이콘
      · 단추 · 탭 · 제목 «맨 앞»의 그림 문자만 · 글자는 지우지 않고 감춘다
        (화면 코드가 글자를 읽어 비교해도 그대로 — textContent 가 바뀌지 않음)
      · 글쓰기 칸 · 편집 중인 문서 · 인쇄 화면 안은 건드리지 않는다
   ② 화면 설명(.adesc) → 제목 옆 ⓘ (눌러야 펼쳐짐)
   ③ 기관 띠(#org-bar) → 상단 바 칩
   ═══════════════════════════════════════════════════════════ */
(function(){
  if(window.__gxOn) return;
  window.__gxOn = true;

  /* ── 그림 문자 → 아이콘 이름 (Material Symbols Rounded) ──
     값이 'dot:#색' 이면 동그란 색 점으로 그린다 */
  const MAP = {
    '📋':'assignment','✅':'check_circle','✏':'edit','🖨':'print','⚠':'warning','🔒':'lock','📅':'calendar_month',
    '↩':'undo','✓':'check','🗑':'delete','⚙':'settings','👥':'group','📊':'bar_chart','🧾':'receipt_long',
    '📄':'description','💬':'chat','🔗':'link','💾':'save','📌':'push_pin','📥':'move_to_inbox','⬇':'download',
    '🗓':'event_note','👤':'person','📝':'edit_note','🖼':'image','💰':'payments','🔍':'search','🔑':'key',
    '📚':'library_books','⏳':'hourglass_top','🧩':'extension','🔐':'lock_person','←':'arrow_back','👁':'visibility',
    '📜':'history','✔':'check','🗂':'folder_open','📨':'send','🧹':'cleaning_services','↻':'refresh','🔓':'lock_open',
    '🏫':'school','📇':'contacts','👨‍👩‍👧':'family_restroom','🔄':'sync','☎':'call','🔔':'notifications','🎯':'flag',
    '→':'arrow_forward','⏰':'alarm','👀':'visibility','📦':'inventory_2','🎨':'palette','✉':'mail','📢':'campaign',
    '🧪':'science','⏱':'timer','⚡':'bolt','✕':'close','📎':'attach_file','🧑‍🏫':'co_present','💵':'payments',
    '🤝':'handshake','🔁':'repeat','💳':'credit_card','👪':'family_restroom','📣':'campaign','↺':'restart_alt',
    '💡':'lightbulb','🔎':'search','✎':'edit','📷':'photo_camera','↔':'swap_horiz','🤖':'smart_toy','✨':'auto_awesome',
    '🛡':'shield','📈':'trending_up','🧭':'explore','🌍':'public','➕':'add','🎉':'celebration','⛔':'block',
    '📮':'markunread_mailbox','🕐':'schedule','🚫':'block','📤':'upload','🎓':'school','🌙':'dark_mode','❌':'cancel',
    '📒':'menu_book','🚪':'door_front','📆':'calendar_today','📱':'smartphone','⬆':'upload','🧲':'open_with','🏷':'sell',
    '🌐':'language','☀':'light_mode','⏸':'pause_circle','🏛':'account_balance','↗':'north_east','🕘':'history',
    '📍':'location_on','👩‍🏫':'co_present','🔀':'shuffle','🏢':'corporate_fare','✗':'close','📂':'folder_open',
    '📲':'install_mobile','🎂':'cake','★':'star|#D9A21B','☆':'star','🙈':'visibility_off','🌱':'eco','🕰':'history','✍':'draw',
    '🎒':'backpack','🩺':'monitor_heart','📞':'call','⛶':'fullscreen','🎫':'confirmation_number','⚖':'balance',
    '☑':'check_box','☐':'check_box_outline_blank','🧮':'calculate','⭐':'star|#D9A21B','📑':'bookmarks','🗝':'key','📡':'rss_feed','↕':'swap_vert','📁':'folder',
    '➖':'remove','🏖':'beach_access','🎭':'theater_comedy','👦':'child_care','🏦':'account_balance','🌤':'partly_cloudy_day',
    '💻':'computer','🏠':'home','🧐':'fact_check','👆':'touch_app','🔥':'local_fire_department','📗':'table_view','👧':'face',
    '🏁':'sports_score','✋':'pan_tool','🏗':'construction','👔':'badge','💸':'payments','🏕':'camping','🙋':'emoji_people',
    '📃':'article','🖐':'pan_tool','♻':'autorenew','🪄':'auto_fix_high','🔲':'grid_view','❓':'help','🚀':'rocket_launch',
    '🍎':'phone_iphone','🍏':'laptop_mac','🪟':'desktop_windows','📘':'book','📕':'book','📰':'newspaper','👑':'workspace_premium',
    '🕒':'schedule','🕗':'schedule','🙅':'do_not_disturb_on','⏭':'skip_next','⬛':'crop_square','📐':'straighten',
    '✂':'content_cut','↑':'arrow_upward','➗':'calculate','🎲':'casino','🌿':'spa','☕':'coffee','📖':'menu_book',
    '🧒':'child_care','🛠':'build','🔌':'power_off','🐢':'speed','🙏':'volunteer_activism','🔏':'verified','🚗':'directions_car',
    '☁':'cloud','🌅':'wb_twilight','🌇':'wb_twilight','🛰':'satellite_alt','🌈':'palette','🌸':'local_florist','🪢':'merge',
    '✖':'close','📭':'inbox','📬':'mail','🗒':'sticky_note_2','🧑‍💼':'badge','👨‍💼':'badge','👩‍💼':'badge','🏃':'directions_run',
    '🎵':'music_note','🎹':'piano','🎻':'music_note','📸':'photo_camera','🗺':'map','🧑‍🤝‍🧑':'group','👨‍👩‍👧‍👦':'family_restroom',
    '🐷':'savings','👈':'arrow_back','👉':'arrow_forward','🧑':'person','👩':'person','👨':'person','🗃':'inventory_2','🪪':'badge','🧷':'attach_file','🏥':'local_hospital','🍽':'restaurant','🚌':'directions_bus',
    '🟢':'dot:#2F9E6A','🟡':'dot:#D9A21B','🔴':'dot:#D14B3A','⚫':'dot:#3A423E','⚪':'dot:#C9CEC9','🔵':'dot:#3B7BD4',
    '🟩':'dot:#2F9E6A','🟦':'dot:#3B7BD4','🟥':'dot:#D14B3A','🟨':'dot:#D9A21B','🟧':'dot:#E07B2E','🟣':'dot:#7A5BC2','🟠':'dot:#E07B2E'
  };
  /* 맨 앞 그림 문자 하나 (변형 선택자 · 이어 붙인 사람 모양까지) */
  const LEAD = /^(\s*)((?:[←-⇿⌀-⏿☀-➿⬀-⯿]|[\u{1F300}-\u{1FAFF}])️?(?:‍(?:[☀-➿]|[\u{1F300}-\u{1FAFF}])️?)*)/u;
  const SEL = 'button,a,label,summary,th,h1,h2,h3,h4,.subtbtn,.tab-sub,.tab-main,.tbtn,.tabbtn,.pg-link,.actitle,.mtitle,.dir-sec,.dir-gt,.chip,' +
              '.hm-sec,.tl,.ptitle,.wx-t,.mm-t,.wc-t,.sl-t,.hm-tdc,.hm-qt-ic,.hm-ti';   // 홈 · 시간표 · 증명서의 칸 제목
  const SKIP = '[contenteditable="true"],[contenteditable=""],textarea,select,option,script,style,pre,code,svg,.ProseMirror,.no-gx,.gxe,#sb,' +
               '#union-key,' +                                                    // 숨은 문(연합 열쇠)은 그림 그대로 — 알아보기 쉬운 아이콘이 되면 안 됨
               '.dw-more,.dw-lead,.dw-ronote,' +                                  // 서랍 설명 칸 — drawer.js 가 원문과 비교해 다시 그리므로 손대면 끝없이 되풀이
               '#print-area,.sheet-doc,.rc-doc,.cert-sheet,.ex-doc,.np-pages,.np-host,#captureArea,#tv-content';   // 인쇄 · 그림 내보내기 문서

  function keyOf(e){ return e.replace(/️/g, ''); }
  /* 요소의 맨 앞 글자 마디 (빈칸만 있는 마디는 건너뜀 · 앞에 다른 요소가 오면 손대지 않음) */
  function leadText(el){
    let n = el.firstChild, depth = 0;
    while(n && depth < 4){
      if(n.nodeType === 3){
        if(/^\s*$/.test(n.nodeValue)){ n = n.nextSibling; continue; }
        return n;
      }
      if(n.nodeType === 1){
        if(n.matches && (n.matches('.gxe,.material-symbols-rounded,img,svg,input,select,textarea,br') || n.matches(SKIP))) return null;
        // 글자를 감싼 작은 꾸밈(b · span · i · strong) 안으로 한 겹 들어간다
        if(/^(B|STRONG|SPAN|I|EM|SMALL)$/.test(n.tagName) && !n.matches(SEL)){ n = n.firstChild; depth++; continue; }
        return null;
      }
      n = n.nextSibling;
    }
    return null;
  }
  function convert(el, checked){
    if(!el || el.nodeType !== 1 || !el.isConnected) return;
    if(!checked && el.closest && el.closest(SKIP)) return;
    const t = leadText(el);
    if(!t) return;
    const m = LEAD.exec(t.nodeValue);
    if(!m) return;
    const name = MAP[keyOf(m[2])];
    if(!name) return;
    const sp = document.createElement('span');
    sp.className = 'gxe';
    sp.setAttribute('aria-hidden', 'true');
    if(name.indexOf('dot:') === 0){ sp.setAttribute('data-dot', ''); sp.style.setProperty('--gxd', name.slice(4)); }
    else {
      const [nm, col] = name.split('|');                 // 'star|#색' — 채운 별처럼 색으로 구별할 것
      sp.setAttribute('data-i', nm);
      if(col){ sp.setAttribute('data-c', ''); sp.style.setProperty('--gxc', col); }
    }
    const o = document.createElement('i');
    o.className = 'gxe-o';
    o.textContent = m[2];                       // 원래 글자는 그대로 남긴다 (보이지만 않게)
    sp.appendChild(o);
    const rest = t.nodeValue.slice(m[0].length);
    const parent = t.parentNode;
    if(m[1]) parent.insertBefore(document.createTextNode(m[1]), t);
    parent.insertBefore(sp, t);
    t.nodeValue = rest;
  }

  /* ── ② 설명 → ⓘ ── 본문 카드 제목 바로 아래 «설명»만 (창 · 입력 칸 · 단추가 든 설명은 그대로)
     · 날짜 · 권한 안내(«…만 가능» 등)처럼 자료나 꼭 알아야 할 말이 든 설명도 그대로 펼쳐 둔다
     · ⓘ 그림은 글자가 아닌 CSS 로 그려서 제목 글자(textContent)가 바뀌지 않게 */
  const KEEP_DESC = /\d{4}\s*[.\-/년]\s*\d{1,2}|만\s*(가능|편집|표시|볼\s*수|할\s*수|입력|보여|고칠|보입|됩니다|돼요)|권한|관리자만|담당자만|본인.{0,8}만/;
  function infoize(title){
    if(!title || !title.closest || !title.closest('#mn') || title.closest('.mbox,.mov,#mwrap,.modal,.overlay')) return;
    const d = title.nextElementSibling;
    if(!d || !d.classList || !d.classList.contains('adesc')) return;
    const txt = (d.textContent || '').trim();
    if(txt.length < 12 || KEEP_DESC.test(txt)) return;
    if(d.querySelector('button,input,select,textarea,a,label')) return;
    let b = title.querySelector(':scope > .gx-info');
    if(b){ if(!d.classList.contains('gx-dshow')) d.classList.add('gx-dhide'); return; }   // 설명만 새로 그려졌으면 다시 접기
    d.classList.add('gx-dhide');
    b = document.createElement('button');
    b.type = 'button';
    b.className = 'gx-info';
    b.title = '설명 보기';
    b.setAttribute('aria-label', '설명 보기');
    b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const dd = title.nextElementSibling;                // 누를 때의 설명 (화면이 설명만 다시 그렸어도)
      if(!dd || !dd.classList.contains('adesc')){ b.remove(); return; }
      const open = dd.classList.toggle('gx-dshow');
      dd.classList.toggle('gx-dhide', !open);
      b.classList.toggle('on', open);
    });
    // 제목 안에 단추 · 입력이 함께 있으면 그 앞 (글자 바로 뒤)에 둔다
    const ctl = [...title.children].find(c => c.matches('button,a,select,input,div,label') && !c.classList.contains('gxe'));
    if(ctl) title.insertBefore(b, ctl); else title.appendChild(b);
  }

  /* ── 한 덩어리 손질 ──
     · 손볼 요소를 먼저 모으고(제외 영역은 한 번만 따져 봄), 아이콘 바꾸기는 한 번에 10ms 씩 나눠서
       (칸이 수천 개인 표도 화면이 멈추지 않게) */
  function collect(root, out){
    if(!root || root.nodeType !== 1) return;
    if(root.closest && (root.closest('#sb') || root.closest(SKIP))) return;
    const hasSkip = !!(root.querySelector && root.querySelector(SKIP));
    const add = el => { if(hasSkip && el.closest(SKIP)) return; out.push(el); };
    if(root.matches && root.matches(SEL)) add(root);
    if(root.querySelectorAll) root.querySelectorAll(SEL).forEach(add);
    if(root.matches && root.matches('.actitle')) infoize(root);
    if(root.querySelectorAll) root.querySelectorAll('.actitle').forEach(infoize);
    if((root.closest && root.closest('#org-bar')) || (root.querySelector && root.querySelector('#org-bar .ob-wrap, #org-bar .obr-p'))) moveOrgBar();
  }
  function scan(root){                                  // 한꺼번에 (시험 · 처음 한 번)
    const work = []; collect(root, work);
    for(const el of work){ try{ convert(el, true); }catch(e){} }
  }
  /* 화면이 새로 그려지면 (innerHTML · textContent) 그 자리만 다시 */
  let queue = new Set(), raf = 0, obs = null, work = [];
  function flush(){
    raf = 0;
    if(queue.size){
      const list = [...queue]; queue.clear();
      for(const n of list){ try{ if(n.isConnected) collect(n, work); }catch(e){} }
    }
    const t0 = performance.now();
    let i = 0;
    while(i < work.length && performance.now() - t0 < 10){ try{ convert(work[i], true); }catch(e){} i++; }
    work = work.slice(i);
    if(obs) obs.takeRecords();                          // 방금 내가 바꾼 것으로 생긴 알림은 버린다 (한 번 더 훑지 않게)
    if(work.length && !raf) raf = requestAnimationFrame(flush);
  }
  function push(n){
    if(!n) return;
    if(n.nodeType === 3) n = n.parentElement;
    if(!n || n.nodeType !== 1) return;
    queue.add(n);
    if(!raf) raf = requestAnimationFrame(flush);
  }
  function watch(){
    push(document.body);                                // 처음 한 번도 나눠서
    try{
      obs = new MutationObserver(ms => {
        for(const m of ms){
          if(m.type === 'characterData'){ push(m.target); continue; }
          if(m.target && m.target.nodeType === 1 && m.target.matches && m.target.matches(SEL)) push(m.target);
          m.addedNodes.forEach(n => push(n));
        }
      });
      obs.observe(document.body, { childList:true, subtree:true, characterData:true });
    }catch(e){}
  }

  /* ── ③ 기관 띠 · 바로 가기 칩 → 상단 바 ──
     · 원래 자리에 표시(주석)를 남기고 옮긴다 → 화면이 좁아지면(창 줄이기 · 폰 돌리기) 제자리로 돌려놓는다 */
  function park(el, minW){
    const slot = document.getElementById('tb-org');
    if(!el || !slot) return;
    const wide = (window.innerWidth || 1024) > minW;
    if(wide && !slot.contains(el)){
      const mn = document.getElementById('mn');
      if(!mn || !mn.contains(el)) return;
      if(!el.__gxHome){ el.__gxHome = document.createComment('gx-home'); el.parentNode.insertBefore(el.__gxHome, el); }
      if(el.classList.contains('pg-links')) slot.insertBefore(el, slot.firstChild); else slot.appendChild(el);
    } else if(!wide && slot.contains(el) && el.__gxHome && el.__gxHome.isConnected){
      el.__gxHome.parentNode.insertBefore(el, el.__gxHome);
    }
  }
  function moveOrgBar(){
    const ob = document.getElementById('org-bar');
    if(!ob) return;
    // 기관 고르기 부품(org-bar.js · orgbar.js)이 그린 띠만 — 학사일정의 «캘린더 고르기»처럼 같은 이름을 다른 뜻으로 쓰는 화면은 그대로
    if(!ob.querySelector('.ob-wrap, .obr-p')) return;
    if([...ob.children].some(c => !c.matches('.ob-wrap, .obr-p'))) return;
    park(ob, 640);                                       // 폰은 상단 바가 좁아 본문 자리 그대로
  }
  /* 바로 가기 칩(반 편성 → · 내 정보 · 로그아웃) — 넓은 화면에서만 */
  function moveLinks(){
    const slot = document.getElementById('tb-org');
    const mn = document.getElementById('mn');
    let pl = slot && slot.querySelector('.pg-links');
    if(!pl && mn) pl = [...mn.querySelectorAll('.pg-links')].find(x => x.getClientRects().length && !x.closest('.tc,.acard,.mbox') && !x.querySelector('input,select,textarea'));
    if(pl) park(pl, 900);
  }
  window.gxMoveOrgBar = function(){ moveOrgBar(); moveLinks(); };
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(window.gxMoveOrgBar, 150); });

  function boot(){
    watch();
    window.gxMoveOrgBar();
    [300, 1200, 3000].forEach(t => setTimeout(window.gxMoveOrgBar, t));
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.gxScan = scan;
})();
