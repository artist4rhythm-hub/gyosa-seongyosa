/* ═══════════════════════════════════════════════════════════════
   ⏱ 타임머신 (timemachine.js)
   ───────────────────────────────────────────────────────────────
   저장을 하기 «직전»의 데이터를 자동으로 보관해 두었다가,
   실수했을 때 그 시점으로 되돌릴 수 있게 해 주는 공용 장치.

   · 우측 패널(RightPanel): 화면 오른쪽에 열고 닫는 서랍.
     앞으로 다른 기능도 RightPanel.register()로 칸을 추가할 수 있다.
   · 스냅샷 엔진(TM): 문서 하나(snapDoc) 또는 컬렉션 묶음(snapBundle)을
     snapshots 컬렉션에 보관하고, 문서당 최근 15개만 남긴다.
   · 되돌리기: 되돌리기 직전 상태도 자동 보관되므로 «되돌리기 자체도 되돌릴 수» 있다.

   각 페이지 연결 방법:
     TM.init({ page, pageLabel, F:{doc,getDoc,setDoc,addDoc,deleteDoc,
               getDocs,collection,Timestamp}, db, me:()=>({uid,name}),
               canRestore:()=>bool, targets:[…], onRestored:async()=>{} });
     저장 함수 안에서:  await TM.snapDoc('컬렉션','문서ID','라벨');
                       await TM.snapBundle('컬렉션',{scope…},'라벨');
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
const KEEP = 15;   // 대상(key)마다 보관할 스냅샷 수
const say = (msg, type)=>{ try{ if(typeof window.toast==='function') window.toast(msg, type); else console.log('[TM]', msg); }catch(e){} };

/* ───────────────────────── 우측 패널 ───────────────────────── */
const RightPanel = {
  _secs: [],
  _open: false,
  register(sec){            // {id, title, render(el)}
    const i = this._secs.findIndex(s=>s.id===sec.id);
    if(i>=0) this._secs[i]=sec; else this._secs.push(sec);
    this._ensureDom();
  },
  _ensureDom(){
    if(document.getElementById('rp-handle')) return;
    const css = document.createElement('style');
    css.textContent = `
      #rp-handle{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:800;
        writing-mode:vertical-rl;background:var(--gd,#14392b);color:#fff;border:none;cursor:pointer;
        padding:14px 7px;border-radius:10px 0 0 10px;font-family:inherit;font-size:12.5px;font-weight:800;
        letter-spacing:.12em;box-shadow:-2px 2px 10px rgba(0,0,0,.18);opacity:.92}
      #rp-handle:hover{opacity:1}
      #rp-wrap{position:fixed;inset:0;z-index:900;display:none}
      #rp-wrap.open{display:block}
      #rp-bk{position:absolute;inset:0;background:rgba(10,20,15,.35)}
      #rp-panel{position:absolute;right:0;top:0;bottom:0;width:min(400px,94vw);
        background:var(--wh,#fff);box-shadow:-8px 0 28px rgba(0,0,0,.18);
        display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease}
      #rp-wrap.open #rp-panel{transform:translateX(0)}
      #rp-head{display:flex;align-items:center;gap:8px;padding:14px 16px;
        border-bottom:1px solid var(--ivd,#e5e1d8);flex:none}
      #rp-head b{font-size:15px;color:var(--gd,#14392b)}
      #rp-close{margin-left:auto;border:none;background:var(--iv,#f4f1ea);border-radius:8px;
        width:30px;height:30px;cursor:pointer;font-size:14px;color:var(--ts,#555);font-family:inherit}
      #rp-body{flex:1;overflow-y:auto;padding:14px 16px 24px}
      .rp-sec{margin-bottom:20px}
      .rp-sec-t{font-size:13px;font-weight:800;color:var(--gd,#14392b);margin-bottom:8px;
        padding-bottom:5px;border-bottom:2px solid var(--gp,#e8efe9)}
      .tm-grp{margin-bottom:14px}
      .tm-grp-t{font-size:12.5px;font-weight:800;color:var(--gm,#2c6e54);margin-bottom:5px}
      .tm-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--ivd,#e5e1d8);
        border-radius:9px;margin-bottom:5px;background:var(--wh,#fff)}
      .tm-item .tm-i-b{flex:1;min-width:0}
      .tm-item .tm-lb{font-size:12.5px;font-weight:700;color:var(--gd,#14392b);
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tm-item .tm-mt{font-size:10.5px;color:var(--tl,#999)}
      .tm-btn{flex:none;font-family:inherit;font-size:11px;font-weight:800;padding:6px 10px;
        border:1.5px solid var(--gm,#2c6e54);border-radius:7px;background:var(--wh,#fff);
        color:var(--gm,#2c6e54);cursor:pointer;white-space:nowrap}
      .tm-btn:hover{background:var(--gm,#2c6e54);color:#fff}
      .tm-empty{font-size:12px;color:var(--tl,#999);padding:4px 2px}
      .tm-note{font-size:11px;color:var(--tl,#999);line-height:1.6;margin-top:2px}
      @media (max-width:600px){ #rp-handle{padding:11px 6px;font-size:11.5px} }
    `;
    document.head.appendChild(css);
    const btn = document.createElement('button');
    btn.id = 'rp-handle'; btn.type='button';
    btn.textContent = '⏱ 타임머신';
    btn.onclick = ()=>this.open();
    document.body.appendChild(btn);
    const wrap = document.createElement('div');
    wrap.id = 'rp-wrap';
    wrap.innerHTML = `
      <div id="rp-bk"></div>
      <div id="rp-panel">
        <div id="rp-head"><span style="font-size:17px">⏱</span><b>타임머신</b>
          <button id="rp-close" title="닫기">✕</button></div>
        <div id="rp-body"></div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('#rp-bk').onclick = ()=>this.close();
    wrap.querySelector('#rp-close').onclick = ()=>this.close();
  },
  open(){
    this._ensureDom();
    const body = document.getElementById('rp-body');
    body.innerHTML = '';
    this._secs.forEach(s=>{
      const el = document.createElement('div');
      el.className = 'rp-sec';
      el.innerHTML = `<div class="rp-sec-t">${s.title}</div><div class="rp-sec-b"></div>`;
      body.appendChild(el);
      try { s.render(el.querySelector('.rp-sec-b')); } catch(e){ console.error(e); }
    });
    document.getElementById('rp-wrap').classList.add('open');
    this._open = true;
  },
  close(){
    document.getElementById('rp-wrap')?.classList.remove('open');
    this._open = false;
  },
  refresh(){ if(this._open) this.open(); }
};
window.RightPanel = RightPanel;

/* ───────────────────────── 스냅샷 엔진 ───────────────────────── */
const TM = {
  _cfg: null,

  init(cfg){
    this._cfg = cfg;
    RightPanel.register({
      id: 'tm',
      title: `⏱ 되돌리기 — ${cfg.pageLabel||cfg.page}`,
      render: (el)=>this._renderSection(el)
    });
  },

  _me(){ const m = this._cfg?.me?.(); return {byUid: m?.uid||'', byName: m?.name||''}; },
  _key(col, docIdOrScope){
    return typeof docIdOrScope === 'string'
      ? col + '/' + docIdOrScope
      : col + '|' + JSON.stringify(docIdOrScope||{});
  },

  /* 문서 하나 — 저장 «직전»에 부른다. DB에서 지금 상태를 읽어 보관한다.
     opt.minGapSec: 자동 저장처럼 잦은 저장은 이 간격 안에서는 한 번만 보관 */
  async snapDoc(col, docId, label, opt){
    const c = this._cfg; if(!c) return;
    const F = c.F;
    try {
      if(opt && opt.minGapSec){
        const prev = await this.list(this._key(col, docId));
        if(prev[0] && (Date.now()/1000 - (prev[0].at?.seconds||0)) < opt.minGapSec) return;
      }
      const g = await F.getDoc(F.doc(c.db, col, docId));
      if(!g.exists()) return;   // 처음 만드는 문서면 보관할 이전이 없다
      await this._store({
        key: this._key(col, docId), col, docId, label: label||'변경 전',
        data: JSON.stringify(g.data())
      });
    } catch(e){ /* 보관 실패가 저장을 막으면 안 된다 */ }
  },

  /* 컬렉션 묶음 — scope(필드 일치 조건)에 맞는 문서 전체를 통째로 보관.
     scope 예: {year:2026, org__in:['daniel']} · 빈 {}면 컬렉션 전체 */
  async snapBundle(col, scope, label){
    const c = this._cfg; if(!c) return;
    const F = c.F;
    try {
      // 등호 조건은 서버에서 거른다 — 컬렉션이 커져도 저장이 느려지지 않는다
      let src = F.collection(c.db, col);
      if(F.query && F.where && scope){
        const eqs = Object.keys(scope).filter(k => !k.endsWith('__in'));
        if(eqs.length) src = F.query(src, ...eqs.map(k => F.where(k, '==', scope[k])));
      }
      const snap = await F.getDocs(src);
      const docs = [];
      snap.forEach(d=>{
        const v = d.data();
        if(this._inScope(v, scope)) docs.push({id:d.id, ...v});
      });
      await this._store({
        key: this._key(col, scope), col, bundle: true,
        scope: JSON.stringify(scope||{}), label: label||'변경 전',
        data: JSON.stringify(docs)
      });
    } catch(e){}
  },

  _inScope(v, scope){
    for(const k of Object.keys(scope||{})){
      if(k.endsWith('__in')){
        const f = k.slice(0,-4);
        if(!(scope[k]||[]).includes(v[f])) return false;
      } else if(v[k] !== scope[k]) return false;
    }
    return true;
  },

  async _store(rec){
    const c = this._cfg; const F = c.F;
    await F.addDoc(F.collection(c.db,'snapshots'), {
      ...rec, page: c.page, pageLabel: c.pageLabel||c.page,
      at: F.Timestamp.now(), ...this._me()
    });
    // 오래된 것 정리 (대상마다 최근 KEEP개)
    try {
      const all = await F.getDocs(F.collection(c.db,'snapshots'));
      const mine = [];
      all.forEach(d=>{ const v=d.data(); if(v.key===rec.key) mine.push({id:d.id, at:v.at?.seconds||0}); });
      mine.sort((a,b)=>b.at-a.at);
      for(const old of mine.slice(KEEP)){
        await F.deleteDoc(F.doc(c.db,'snapshots',old.id));
      }
    } catch(e){}
  },

  async list(key){
    const c = this._cfg; const F = c.F;
    const all = await F.getDocs(F.collection(c.db,'snapshots'));
    const out = [];
    all.forEach(d=>{ const v=d.data(); if(v.key===key) out.push({id:d.id, ...v}); });
    out.sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
    return out;
  },

  /* 되돌리기 — 실행 전에 지금 상태를 «되돌리기 직전» 라벨로 한 번 더 보관한다 */
  async restore(snapId){
    const c = this._cfg; const F = c.F;
    const g = await F.getDoc(F.doc(c.db,'snapshots',snapId));
    if(!g.exists()) throw new Error('스냅샷을 찾을 수 없습니다.');
    const s = g.data();
    if(s.bundle){
      const scope = JSON.parse(s.scope||'{}');
      await this.snapBundle(s.col, scope, '되돌리기 직전 자동 보관');
      const saved = JSON.parse(s.data||'[]');
      const savedIds = new Set(saved.map(d=>d.id));
      // ① 보관된 문서 복원
      for(const d of saved){
        const {id, ...rest} = d;
        await F.setDoc(F.doc(c.db, s.col, id), rest);
      }
      // ② 범위 안에서 그 뒤에 새로 생긴 문서는 지운다
      const cur = await F.getDocs(F.collection(c.db, s.col));
      const extras = [];
      cur.forEach(d=>{ const v=d.data(); if(this._inScope(v, scope) && !savedIds.has(d.id)) extras.push(d.id); });
      for(const id of extras) await F.deleteDoc(F.doc(c.db, s.col, id));
      return {bundle:true, restored:saved.length, removed:extras.length};
    } else {
      await this.snapDoc(s.col, s.docId, '되돌리기 직전 자동 보관');
      await F.setDoc(F.doc(c.db, s.col, s.docId), JSON.parse(s.data||'{}'));
      return {bundle:false};
    }
  },

  _ago(at){
    const sec = at?.seconds ? (Date.now()/1000 - at.seconds) : 0;
    if(sec < 60) return '방금';
    if(sec < 3600) return Math.floor(sec/60)+'분 전';
    if(sec < 86400) return Math.floor(sec/3600)+'시간 전';
    const d = at.seconds ? new Date(at.seconds*1000) : new Date();
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
  _esc(x){ return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  /* 페이지 패널 칸 */
  async _renderSection(el){
    const c = this._cfg;
    el.innerHTML = '<div class="tm-empty">불러오는 중…</div>';
    const canR = !c.canRestore || c.canRestore();
    let html = '';
    for(const t of (c.targets||[])){
      const docId = typeof t.docId === 'function' ? t.docId() : t.docId;
      const scope = typeof t.scope === 'function' ? t.scope() : t.scope;
      const key = scope ? this._key(t.col, scope) : this._key(t.col, docId);
      let items = [];
      try { items = await this.list(key); } catch(e){}
      html += `<div class="tm-grp"><div class="tm-grp-t">${this._esc(t.label)}</div>`;
      if(!items.length){
        html += `<div class="tm-empty">보관된 이전 버전이 아직 없어요. 다음 저장부터 자동으로 쌓입니다.</div>`;
      } else {
        html += items.slice(0,8).map(it=>`
          <div class="tm-item">
            <div class="tm-i-b">
              <div class="tm-lb">${this._esc(it.label)}</div>
              <div class="tm-mt">${this._ago(it.at)} · ${this._esc(it.byName||'')}</div>
            </div>
            ${canR?`<button class="tm-btn" onclick="TM._doRestore('${it.id}', this)">이 시점으로</button>`:''}
          </div>`).join('');
      }
      html += `</div>`;
    }
    html += `<div class="tm-note">저장할 때마다 «저장 직전» 상태가 자동으로 보관돼요 (대상마다 최근 ${KEEP}개).
      되돌리기 전 상태도 자동 보관되니, 되돌리기 자체도 되돌릴 수 있어요.</div>`;
    el.innerHTML = html;
  },

  async _doRestore(snapId, btn){
    if(!confirm('이 시점의 데이터로 되돌릴까요?\n(지금 상태도 자동 보관되어, 다시 되돌아올 수 있습니다)')) return;
    if(btn){ btn.disabled = true; btn.textContent = '…'; }
    try {
      const r = await this.restore(snapId);
      say(r.bundle ? `되돌렸습니다 — ${r.restored}개 복원${r.removed?` · ${r.removed}개 정리`:''}` : '되돌렸습니다.','ok');
      if(this._cfg.onRestored) await this._cfg.onRestored();
      RightPanel.refresh();
    } catch(e){
      say('되돌리기 실패: '+(e.message||''),'err');
      if(btn){ btn.disabled=false; btn.textContent='이 시점으로'; }
    }
  },

  /* ── 관리자 전체 브라우저 (관리자 > 보안·기록 > 타임머신) ── */
  async renderAdminList(el){
    const c = this._cfg; const F = c.F;
    el.innerHTML = '<p class="empty">불러오는 중…</p>';
    let rows = [];
    try {
      const all = await F.getDocs(F.collection(c.db,'snapshots'));
      all.forEach(d=>rows.push({id:d.id, ...d.data()}));
    } catch(e){ el.innerHTML = `<p class="empty">불러올 수 없습니다: ${this._esc(e.message)}</p>`; return; }
    rows.sort((a,b)=>(b.at?.seconds||0)-(a.at?.seconds||0));
    const pages = Array.from(new Set(rows.map(r=>r.pageLabel||r.page))).filter(Boolean);
    const draw = (filter)=>{
      const list = filter ? rows.filter(r=>(r.pageLabel||r.page)===filter) : rows;
      const body = list.slice(0,200).map(r=>`
        <div class="tm-item" style="margin-bottom:6px">
          <div class="tm-i-b">
            <div class="tm-lb">[${this._esc(r.pageLabel||r.page)}] ${this._esc(r.label)}</div>
            <div class="tm-mt">${this._esc(r.key)} · ${this._ago(r.at)} · ${this._esc(r.byName||'')}</div>
          </div>
          <button class="tm-btn" onclick="TM._doRestore('${r.id}', this)">이 시점으로</button>
          <button class="tm-btn" style="border-color:var(--danger,#c0392b);color:var(--danger,#c0392b)"
            onclick="TM._delSnap('${r.id}', this)">삭제</button>
        </div>`).join('');
      el.querySelector('#tm-adm-list').innerHTML = body || '<p class="empty">보관된 스냅샷이 없습니다.</p>';
      el.querySelector('#tm-adm-cnt').textContent = `${list.length}개`;
    };
    el.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <select id="tm-adm-filter" style="height:36px;border:1.5px solid var(--ivd);border-radius:8px;padding:0 10px;font-size:13px;font-family:inherit;background:var(--iv)">
          <option value="">전체 화면</option>
          ${pages.map(p=>`<option value="${this._esc(p)}">${this._esc(p)}</option>`).join('')}
        </select>
        <span id="tm-adm-cnt" style="font-size:12px;color:var(--tl)"></span>
      </div>
      <div id="tm-adm-list"></div>`;
    el.querySelector('#tm-adm-filter').onchange = (ev)=>draw(ev.target.value);
    draw('');
  },
  async _delSnap(id, btn){
    if(!confirm('이 스냅샷을 삭제할까요? (복원용 보관본이 사라집니다)')) return;
    const c = this._cfg; const F = c.F;
    try {
      await F.deleteDoc(F.doc(c.db,'snapshots',id));
      btn?.closest('.tm-item')?.remove();
      say('삭제했습니다.');
    } catch(e){ say('삭제 실패: '+(e.message||''),'err'); }
  }
};
window.TM = TM;
})();
