/* ═══════════════════════════════════════════════════════════
   🧭 orgbar.js — 페이지 상단 기관 선택 바 (재정비 3단계 실체화)
   · students·attend·cert가 if(window.OrgBar) 가드로 기다리던 계약의 첫 구현
   · 전역 컨텍스트(org-core.curOrg)와 양방향 동기 — 한 화면에서 바꾸면 전 화면이 따라온다
   · «전체 기관(👥)» 노출은 관제탑의 함께 보기 설정(systemConfig/orgView)이 결정
   계약: OrgBar.init(opts) → 초기 선택값 반환 · OrgBar.current · opts.onChange()
   ═══════════════════════════════════════════════════════════ */
window.OrgBar = (function(){
  const S = { current:'', opts:null, host:null, wired:false };

  function effAllowAll(){
    if(!S.opts || !S.opts.allowAll) return false;
    return window.orgCore ? orgCore.combinedHas(window.__PAGEKEY || '') : true;
  }
  function pills(){
    const list = [ ...(effAllowAll() ? [['__all__','👥 전체 기관']] : []),
                   ...S.opts.orgs.map(o=>[o, (S.opts.labels&&S.opts.labels[o])||o]) ];
    return list.map(([v,l])=>`<button type="button" class="obr-p${S.current===v?' on':''}" data-v="${v}">${l}</button>`).join('');
  }
  function paint(){ if(S.host) S.host.innerHTML = pills(); }
  function commit(v, fromGlobal){
    if(v===S.current){ paint(); return; }
    S.current = v;
    try{ localStorage.setItem(S.opts.storeKey, v); }catch(e){}
    if(!fromGlobal && window.orgCore) orgCore.setCurOrg(v==='__all__' ? 'all' : v, true);   // 전역 동기 (재이벤트 없이)
    paint();
    if(S.opts.onChange) S.opts.onChange(v);
  }
  function initialVal(){
    const g = window.orgCore ? orgCore.curOrg() : '';
    if(g==='all' && effAllowAll()) return '__all__';
    if(g && S.opts.orgs.includes(g)) return g;
    try{ const v = localStorage.getItem(S.opts.storeKey);
      if(v==='__all__' && effAllowAll()) return v;
      if(v && S.opts.orgs.includes(v)) return v; }catch(e){}
    if(S.opts.defaultAll && effAllowAll()) return '__all__';
    return S.opts.orgs[0] || '';
  }
  function init(opts){
    window.__ORG_LIVE = true;                             // 이 화면은 새로고침 없이 스위처를 따라간다
    S.opts = Object.assign({ orgs:[], labels:{}, storeKey:'orgbar', allowAll:false, defaultAll:false }, opts||{});
    // 호스트 — #org-bar가 있으면 쓰고, 없으면 상단 이동경로(#tb) 바로 아래 자가 생성
    S.host = document.getElementById('org-bar');
    if(!S.host){
      S.host = document.createElement('div'); S.host.id = 'org-bar'; S.host.className = 'obr';
      const tb = document.getElementById('tb');
      (tb && tb.parentNode) ? tb.parentNode.insertBefore(S.host, tb.nextSibling) : document.body.prepend(S.host);
    }
    if(S.opts.orgs.length < 2 && !S.opts.allowAll){         // 한 기관뿐이면 바 자체가 불필요
      S.host.style.display = 'none';
      S.current = S.opts.orgs[0] || '';
      return S.current;
    }
    if(!S.wired){
      S.wired = true;
      S.host.addEventListener('click', e=>{ const b = e.target.closest('.obr-p'); if(b) commit(b.dataset.v, false); });
      window.addEventListener('orgchange', ev=>{           // 사이드바·다른 화면에서 바뀐 전역을 따라간다
        const d = ev.detail || {}; if(d.silent) return;
        const g = d.org;
        const v = g==='all' ? (effAllowAll() ? '__all__' : S.current)
                : (S.opts.orgs.includes(g) ? g : S.current);
        commit(v, true);
      });
    }
    S.current = initialVal(); paint();
    if(window.orgCore && !orgCore.curOrg())               // 전역이 비어 있으면 이 화면 값으로 씨앗
      orgCore.setCurOrg(S.current==='__all__' ? 'all' : S.current, true);
    return S.current;
  }
  // 스타일 1회 주입 — 둥근 알약, 시스템 파스텔
  const css = document.createElement('style');
  css.textContent = `.obr{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px 0;max-width:1200px;margin:0 auto}
  .obr:empty{display:none}
  .obr-p{font-family:inherit;font-size:12px;font-weight:800;color:#5A6560;background:#fff;
    border:1.5px solid #E3E1DA;border-radius:100px;padding:6px 14px;cursor:pointer}
  .obr-p.on{background:#1E3932;border-color:#1E3932;color:#fff}
  .obr-p:hover:not(.on){border-color:#1E3932;color:#1E3932}`;
  document.head.appendChild(css);

  return { init, get current(){ return S.current; }, set:(v)=>commit(v,false) };
})();
