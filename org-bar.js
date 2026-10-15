/* ═══════════════════════════════════════════════
   org-bar.js — 기관 선택 바 (공통 컴포넌트)

   사용법:
     1) HTML에서 <script src="org-bar.js"></script> 로 불러오기
     2) 페이지 콘텐츠 최상단에 <div id="org-bar"></div> 배치
     3) 로그인 확인 후:
          OrgBar.init({
            orgs: myOrgs(),            // 이 사용자가 볼 수 있는 기관 배열
            labels: ORGS,              // {jihyebit:'지혜빛', daniel:'다니엘 아마츠'}
            storeKey: 'students_org',  // localStorage 키 (페이지별로 다르게)
            onChange: (org) => { ... } // 기관이 바뀔 때 호출 (화면 다시 그리기)
          });
     4) 현재 기관은 OrgBar.current 로 읽기

   특징
     · 기관이 1개뿐인 사용자에게는 '보이되 비활성화'로 표시
     · 선택은 localStorage에 저장되어 다음 방문 시 복원
   ═══════════════════════════════════════════════ */

(function(global){
  'use strict';

  const NOTE = {
    daniel:   '다니엘 아마츠 · 1~12학년',
    jihyebit: '지혜빛 선교원 · 4~7세',
  };

  const OrgBar = {
    current: '',
    _cfg: null,

    init(cfg){
      this._cfg = cfg || {};
      const orgs = (cfg.orgs || []).filter(Boolean);
      if(!orgs.length){ this._renderEmpty(); return ''; }
      // allowAll: '전체' 선택지 추가 (기관이 2개 이상일 때만 의미 있음)
      const opts = (cfg.allowAll && orgs.length > 1) ? ['__all__'].concat(orgs) : orgs;

      // 저장된 선택 복원 (없거나 권한 밖이면 기본값)
      let saved = '';
      try { saved = localStorage.getItem(cfg.storeKey || 'org_scope') || ''; } catch(e){}
      this.current = opts.includes(saved) ? saved : (cfg.defaultAll && opts.includes('__all__') ? '__all__' : orgs[0]);

      this.render();
      return this.current;
    },

    set(org, silent){
      const cfg = this._cfg || {};
      const orgs = (cfg.orgs || []).filter(Boolean);
      const opts = (cfg.allowAll && orgs.length > 1) ? ['__all__'].concat(orgs) : orgs;
      if(!opts.includes(org) || org === this.current) return;
      this.current = org;
      try { localStorage.setItem(cfg.storeKey || 'org_scope', org); } catch(e){}
      this.render();
      if(!silent && typeof cfg.onChange === 'function') cfg.onChange(org);
    },

    render(){
      const cfg = this._cfg || {};
      const box = document.getElementById('org-bar');
      if(!box) return;
      const orgs   = (cfg.orgs || []).filter(Boolean);
      const labels = cfg.labels || {};
      const only   = orgs.length <= 1;   // 기관이 하나면 비활성화 표시
      const opts   = (cfg.allowAll && orgs.length > 1) ? ['__all__'].concat(orgs) : orgs;

      box.innerHTML = `
        <div class="ob-wrap${only ? ' ob-single' : ''}">
          <span class="ob-lab">🏫 기관</span>
          <div class="ob-chips">
            ${opts.map(o => `
              <button type="button" class="ob-chip${o === this.current ? ' on' : ''}"
                ${only ? 'disabled title="소속된 기관이 하나입니다"' : ''}
                onclick="OrgBar.set('${o}')">${o==='__all__' ? '전체' : (labels[o] || o)}</button>`).join('')}
          </div>
          <span class="ob-note">${this.current==='__all__' ? '두 기관 전체' : (NOTE[this.current] || '')}</span>
        </div>`;
    },

    _renderEmpty(){
      const box = document.getElementById('org-bar');
      if(box) box.innerHTML = '';
    },
  };

  // 스타일 1회 주입
  if(!document.getElementById('org-bar-style')){
    const st = document.createElement('style');
    st.id = 'org-bar-style';
    st.textContent = `
      .ob-wrap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
        padding:11px 14px;margin-bottom:14px;background:var(--gp,#E8F3EF);
        border:1px solid var(--gl,#D6E9E0);border-radius:12px}
      .ob-lab{font-size:12.5px;font-weight:800;color:var(--gd,#1E3932)}
      .ob-chips{display:flex;gap:6px;flex-wrap:wrap}
      .ob-chip{font-family:inherit;font-size:12.5px;font-weight:700;padding:7px 16px;
        border:1.5px solid var(--ivd,#E3E1DA);border-radius:9px;background:var(--wh,#fff);
        color:var(--ts,#5A6560);cursor:pointer;transition:all .12s}
      .ob-chip:hover:not(:disabled){border-color:var(--gm,#00704A);color:var(--gm,#00704A)}
      .ob-chip.on{background:var(--gm,#00704A);border-color:var(--gm,#00704A);color:#fff;font-weight:800}
      .ob-chip:disabled{cursor:default;opacity:.85}
      .ob-single .ob-chip.on{background:var(--gm,#00704A);opacity:.75}
      .ob-single .ob-chip:not(.on){display:none}
      .ob-note{font-size:11.5px;color:var(--ts,#5A6560);margin-left:auto}
      @media(max-width:600px){ .ob-note{width:100%;margin-left:0;text-align:right} }`;
    document.head.appendChild(st);
  }

  global.OrgBar = OrgBar;
})(window);
