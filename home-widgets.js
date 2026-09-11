/* ═══════════════════════════════════════════════════════════
   🏠 home-widgets.js — 홈 실황 위젯 엔진 (재정비 7단계 분가)
   · index.html에서 통째로 이주: 출결 2.0(3스타일) · 동아리 실황 ·
     학사 D-Day · 결재/경비 카운터 · 💰 이달 활동 합계
   · index는 installHomeWidgets(문맥) 한 줄로 설치 — 동작 동일
   ═══════════════════════════════════════════════════════════ */
export function installHomeWidgets(ctx){
  const { db, getCU, $I, esc, ORGS } = ctx;
  const { doc, getDoc, getDocs, collection, query, where, orderBy, limit, onSnapshot, Timestamp } = ctx.fs;

/* ── 📋 오늘의 출결 2.0 — 반별·보드·요약 3스타일, 담임이 표시하는 순간 홈이 바뀐다 ── */
const ATT_UNIFIED_POS = ['교장','교감','행정실장'];
let _attUnsubs = [], _attStu = {}, _attTypes = null, _attLast = {}, ATT_OPEN = {}
let _attCls = null;   // 🏫 반편성 원장 캐시
let ATT_STYLE = (()=>{ try{ return localStorage.getItem('gyosa_attstyle')||'cls'; }catch(e){ return 'cls'; } })();
window.setAttStyle = s => { ATT_STYLE = s; try{ localStorage.setItem('gyosa_attstyle', s); }catch(e){}
  document.querySelectorAll('.att-seg button').forEach(b=>b.classList.toggle('on', b.dataset.s===s));
  Object.keys(_attLast).forEach(o=>paintAttOrg(o)); };
window.togAttOpen = o => { ATT_OPEN[o] = !ATT_OPEN[o]; paintAttOrg(o); };
function attHomeOrgs(){ return orgCore.myOrgs(getCU(),'unifiedDF'); }   // 🏛 org-core 원장 위임
function attBucket(nm){
  const n = String(nm||'');
  if(n.includes('결석')) return 'abs';
  if(n.includes('지각')) return 'lat';
  if(n.includes('조퇴')) return 'ear';
  return 'etc';
}
const ATT_BK = { abs:{l:'결석',c:'#DC2626',bg:'#FDE8E8'}, lat:{l:'지각',c:'#D97706',bg:'#FEF3D9'},
                 ear:{l:'조퇴',c:'#2563EB',bg:'#E5EDFC'}, etc:{l:'기타',c:'#6B7280',bg:'#EEF0F2'} };
async function loadAttendWidget(){
  const box = $I('w-attend'); if(!box) return;
  _attUnsubs.forEach(u=>{ try{u();}catch(e){} }); _attUnsubs = [];
  const orgs = attHomeOrgs();
  if(!orgs.length){ box.innerHTML=''; return; }
  const today = (()=>{ const n=new Date(); const p=x=>String(x).padStart(2,'0');
    return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`; })();
  try {
    if(!_attTypes){
      const ts = await getDocs(collection(db,'attendTypes'));
      _attTypes = ts.docs.map(d=>({id:d.id, ...d.data()}));
    }
    if(_attCls == null){                                   // 🏫 반편성 원장 — 학생 문서엔 반이 없다
      const cs = await getDocs(collection(db,'classes'));
      _attCls = cs.docs.map(d=>({id:d.id, ...d.data()}));
    }
    for(const o of orgs){
      if(_attStu[o] == null){
        const ss = await getDocs(query(collection(db,'students'), where('org','==',o)));
        const y = new Date().getFullYear();
        const mine = _attCls.filter(c=>!c.org || c.org===o)
          .sort((a,b)=>((b.year||y)===y?1:0)-((a.year||y)===y?1:0));   // 올해 반 우선
        const info = {};
        mine.forEach(c=>{ (c.students||[]).forEach(sid=>{
          if(info[sid]) return;
          info[sid] = { className: c.name||'', classId: c.id,
            grade: (c.grades && c.grades[sid]) || c.grade || '' }; }); });
        _attStu[o] = ss.docs.map(d=>{ const st={id:d.id, ...d.data()};
            const i = info[d.id] || {};
            return { ...st, className: st.className || i.className || '', classId: i.classId||'', grade: st.grade || i.grade || '' };
          }).filter(x=>!x.deleted && (x.status||'active')==='active');
      }
    }
  } catch(e){ box.innerHTML = `<div class="hw-dim">출결 정보를 불러오지 못했어요.</div>`; return; }
  box.innerHTML = orgs.map(o=>`<div id="att-row-${o}"></div>`).join('');
  orgs.forEach(o=>{
    const qy = query(collection(db,'studentAttendance'), where('org','==',o), where('date','==',today));
    const un = onSnapshot(qy, snap=>{
      const smap = {}; _attStu[o].forEach(st=>smap[st.id]=st);
      const flag = {};
      snap.forEach(d=>{ const m=d.data();
        const ids = (m.typeIds && m.typeIds.length) ? m.typeIds : (m.typeId?[m.typeId]:[]);
        const ts = ids.map(id=>_attTypes.find(x=>x.id===id)).filter(t=>t && !t.isPresent);
        if(!ts.length) return;
        const st = smap[m.studentId] || {};
        flag[m.studentId] = {
          name: st.name||m.studentName||'',
          clsId: st.classId || m.classId || '',
          grade: st.grade || '',
          cls: st.className || m.className || '',
          type: ts.map(t=>t.name).join('·'),            // 예: 지각·조퇴 (둘 다 보이게)
          types: ts.map(t=>t.name),
          bk: attBucket(ts[0].name),
          bks: ts.map(t=>attBucket(t.name)),
          memo: m.memo||m.note||m.reason||'' };
      });
      _attLast[o] = { flag, today };
      paintAttOrg(o);
    }, ()=>{ const el=$I('att-row-'+o); if(el) el.innerHTML=`<div class="hw-dim">출결 구독 실패 — 새로고침해 보세요.</div>`; });
    _attUnsubs.push(un);
  });
}
function attByClass(o){
  /* 반 이름이 학년마다 겹치므로(로이반=2·3학년 등) «반 문서» 단위로 가른다.
     재적이 1명이라도 있는 반은 특이사항이 없어도 모두 보여준다. */
  const map = {};
  const key = st => st.classId || ('nm:'+(st.className||'미배정'));
  (_attStu[o]||[]).forEach(st=>{
    const k = key(st);
    const m = (map[k] = map[k] || { name: st.className||'미배정', grade: st.grade||'', n:0, fl:[] });
    m.n++;
    if(!m.grade && st.grade) m.grade = st.grade;
  });
  const flag = (_attLast[o]||{}).flag || {};
  Object.values(flag).forEach(f=>{
    const k = f.clsId || ('nm:'+(f.cls||'미배정'));
    const m = (map[k] = map[k] || { name: f.cls||'미배정', grade: f.grade||'', n:0, fl:[] });
    m.fl.push(f);
  });
  const gnum = g => { const n = parseInt(String(g),10); return isNaN(n) ? 99 : n; };
  return Object.entries(map)
    .filter(([,v])=>v.n > 0)                                  // 재학생 있는 반만
    .sort((a,b)=> gnum(a[1].grade)-gnum(b[1].grade) || String(a[1].name).localeCompare(String(b[1].name),'ko'));
}
function paintAttOrg(o){
  const el = $I('att-row-'+o); if(!el) return;
  const L = _attLast[o]; if(!L){ el.innerHTML=''; return; }
  const roster = (_attStu[o]||[]).length;
  const flags = Object.values(L.flag);
  const cnt = { abs:0, lat:0, ear:0, etc:0 };
  flags.forEach(f=>{ const seen={}; (f.bks||[f.bk]).forEach(b=>{ if(seen[b]) return; seen[b]=1; cnt[b]++; }); });
  const present = Math.max(0, roster - flags.length);
  const rate = roster ? Math.round(present/roster*100) : 100;
  const orgNm = (window.ORGS&&ORGS[o])||o;
  const go = `attend.html?stat=live&org=${o}`;
  const chip = f => `<span class="att-pc" style="background:${ATT_BK[f.bk].bg};color:${ATT_BK[f.bk].c}" title="${esc(f.type)}${f.memo?' · '+esc(f.memo):''}">${(f.bks||[f.bk]).map(b=>ATT_BK[b].l).join('')} ${esc(f.name)}</span>`;
  let h = '';
  if(ATT_STYLE==='cls'){
    const cls = attByClass(o);
    h = `<div class="att-orghd"><b>${esc(orgNm)}</b><span>${present}/${roster} 출석 · ${rate}%</span></div>
      <div class="att-grid">${cls.map(([,v])=>{
        const p = v.n - v.fl.length, pct = v.n? Math.round(p/v.n*100) : 100;
        const gTxt = v.grade ? String(v.grade).replace('학년','')+'학년' : '';
        return `<a class="att-card${v.fl.length?' has':''}" href="${go}">
          <div class="att-ct"><b>${gTxt?`<i class="att-g">${esc(gTxt)}</i> `:''}${esc(v.name)}</b><span>${p}/${v.n}</span></div>
          <div class="att-bar"><i style="width:${pct}%;${pct<100?'background:#f59e0b':''}"></i></div>
          <div class="att-pch">${v.fl.length? v.fl.map(chip).join('') : '<span class="att-pc ok">✓ 전원 출석</span>'}</div></a>`; }).join('')}</div>`;
  } else if(ATT_STYLE==='board'){
    const row = bk => { const list=flags.filter(f=>f.bk===bk); if(!list.length) return '';
      const memos = list.filter(f=>f.memo).map(f=>`${esc(f.name)}: ${esc(f.memo)}`).join(' · ');
      return `<a class="att-brow" href="${go}"><span class="att-k" style="color:${ATT_BK[bk].c}">${ATT_BK[bk].l}</span>
        <span class="att-nms">${list.map(f=>`<span class="att-nm">${esc(f.name)}<i>${esc(String(f.cls).replace('반',''))}</i></span>`).join('')}</span>
        ${memos?`<span class="att-memo">${memos}</span>`:''}</a>`; };
    h = `<div class="att-orghd"><b>${esc(orgNm)}</b></div>
      <div class="att-stats">
        <a class="att-st g" href="${go}"><b>${rate}%</b><span>출석률</span></a>
        <a class="att-st r" href="${go}"><b>${cnt.abs}</b><span>결석</span></a>
        <a class="att-st a" href="${go}"><b>${cnt.lat}</b><span>지각</span></a>
        <a class="att-st b" href="${go}"><b>${cnt.ear}</b><span>조퇴</span></a></div>
      ${row('abs')}${row('lat')}${row('ear')}${cnt.etc?row('etc'):''}
      ${!flags.length?`<div class="att-clear">🎉 오늘 특이사항 없음 — 전원 출석이에요</div>`:''}`;
  } else {
    const cls = attByClass(o);
    const tick = flags.length
      ? flags.map(f=>`${f.bk==='abs'?'🔴':f.bk==='lat'?'🟡':f.bk==='ear'?'🔵':'⚪️'} ${esc(f.name)}(${esc(String(f.cls).replace('반',''))}) ${ATT_BK[f.bk].l}${f.memo?' · '+esc(f.memo):''}`).join('  ·  ')
      : '✓ 특이사항 없음 — 전원 출석';
    h = `<div class="att-sum">
      <div class="att-top" onclick="togAttOpen('${o}')">
        <div class="att-ring" style="background:conic-gradient(#16a34a 0 ${rate*3.6}deg,var(--iv) ${rate*3.6}deg 360deg)"><i>${rate}%</i></div>
        <div class="att-mid"><b>${esc(orgNm)} · ${present}/${roster} 출석</b>
          <span>결석 ${cnt.abs} · 지각 ${cnt.lat} · 조퇴 ${cnt.ear} — 탭해서 반별 보기</span></div>
        <span class="att-ar">${ATT_OPEN[o]?'⌃':'⌄'}</span></div>
      <div class="att-tick">${tick}</div>
      ${ATT_OPEN[o]?`<div class="att-open">${cls.map(([,v])=>{
        const p=v.n-v.fl.length;
        const gTxt = v.grade ? String(v.grade).replace('학년','')+'학년 ' : '';
        return `<a class="att-trow" href="${go}"><b>${esc(gTxt)}${esc(v.name)}</b><span class="n">${p}/${v.n}</span>
          <span class="who">${v.fl.length? v.fl.map(f=>`${ATT_BK[f.bk].l} ${esc(f.name)}`).join(' · ') : '✓ 전원 출석'}</span></a>`; }).join('')}</div>`:''}
    </div>`;
  }
  el.innerHTML = h;
}

/* ── 🎨 동아리 실황 위젯 ── */
async function loadClubWidget(){
  const box = $I('w-club'); if(!box) return;
  const orgs = attHomeOrgs(); if(!orgs.length){ box.innerHTML=''; return; }
  const today = new Date(); const p=x=>String(x).padStart(2,'0');
  const ts = `${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;
  const WDK = ['일','월','화','수','목','금','토'];
  try{
    const ss = await getDocs(collection(db,'clubSemesters'));
    const sems = ss.docs.map(d=>({id:d.id, ...d.data()}));
    const rows = [];
    for(const o of orgs){
      const cand = sems.filter(x=>x.org===o && ['enrolling','adjusting','confirmed','running'].includes(x.status))
        .sort((a,b)=>String(b.rangeFrom||'').localeCompare(String(a.rangeFrom||'')));
      const sm = cand[0]; if(!sm) continue;
      const orgNm = (window.ORGS&&ORGS[o])||o;
      if(sm.status==='enrolling' || sm.status==='adjusting'){
        const en = await getDocs(query(collection(db,'clubEnrollments'), where('semId','==',sm.id)));
        const n = en.docs.filter(d=>{ const e=d.data(); return !e.deleted && (((e.picks||[]).length)||((e.picks2||[]).length)); }).length;
        const msE = (sm.milestones||[]).find(m=>m.role==='enrollEnd');
        let dd=''; if(msE && msE.at){ const dt=String(msE.at).slice(0,10);
          const dn=Math.round((new Date(dt+'T00:00:00')-new Date(ts+'T00:00:00'))/86400000);
          if(dn>=0) dd = ` · 마감 ${dn===0?'오늘':'D-'+dn}`; }
        rows.push(`<a class="hw-line" href="club-admin.html"><span class="hw-ic">🎯</span>
          <b>${esc(orgNm)} — 학부모 신청 진행 중 · ${n}명${dd}</b><span class="hw-go">›</span></a>`);
      } else {
        const as = await getDocs(query(collection(db,'clubApplications'), where('semId','==',sm.id)));
        const apps = as.docs.map(d=>({id:d.id, ...d.data()}))
          .filter(c=>!c.deleted && !c.cancelled && c.status==='approved' && (c.sessions||[]).length);
        const bm = {}; (sm.blocked||[]).forEach(bk=>{ if(bk.date) bm[bk.date]=1; });
        const off = x => x.skip || (!x.extra && !x.override && (x.blocked || bm[x.date]));
        const am = (hm,mn)=>{ const [h,mi]=String(hm||'0:0').split(':').map(Number); const t=h*60+mi+(Number(mn)||60);
          return `${p(Math.floor(t/60)%24)}:${p(t%60)}`; };
        const todays=[], future=[];
        apps.forEach(c=>{
          const arr=(c.sessions||[]).filter(x=>x&&x.date&&!off(x))
            .sort((a,b)=>a.date===b.date?String(a.time||c.start||'').localeCompare(String(b.time||c.start||'')):a.date.localeCompare(b.date));
          arr.forEach((x,i)=>{ const it={t:c.title||'',time:x.time||c.start||'',no:i+1,tot:arr.length,date:x.date};
            if(x.date===ts) todays.push(it); else if(x.date>ts) future.push(it); });
        });
        todays.sort((a,b)=>a.time.localeCompare(b.time)); future.sort((a,b)=>a.date===b.date?a.time.localeCompare(b.time):a.date.localeCompare(b.date));
        if(todays.length){
          const two = todays.slice(0,2).map(x=>`${esc(x.t)} ${x.time} <i>(${x.no}/${x.tot}차시)</i>`).join(' · ');
          rows.push(`<a class="hw-line" href="club-status.html"><span class="hw-ic">🎨</span>
            <b>${esc(orgNm)} — 오늘 동아리 ${todays.length}개 · ${two}${todays.length>2?' 외':''}</b><span class="hw-go">›</span></a>`);
        } else if(future.length){
          const nx=future[0]; const d=new Date(nx.date+'T00:00:00');
          rows.push(`<a class="hw-line" href="club-status.html"><span class="hw-ic">🎨</span>
            <b>${esc(orgNm)} — 다음 수업 ${Number(nx.date.slice(5,7))}/${Number(nx.date.slice(8,10))}(${WDK[d.getDay()]}) ${esc(nx.t)} ${nx.time} <i>(${nx.no}/${nx.tot}차시)</i></b><span class="hw-go">›</span></a>`);
        }
      }
    }
    box.innerHTML = rows.join('') || `<div class="hw-dim">진행 중인 동아리 학기가 없어요.</div>`;
  }catch(e){ box.innerHTML = `<div class="hw-dim">동아리 정보를 불러오지 못했어요.</div>`; }
}

/* ── 📅 학사 D-Day 위젯 ── */
async function loadAcdday(){
  const box = $I('w-acdday'); if(!box) return;
  const orgs = attHomeOrgs();
  const n=new Date(); const p=x=>String(x).padStart(2,'0');
  const ts=`${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;
  try{
    const far = new Date(); far.setDate(far.getDate()+120);
    const p2 = x=>String(x).padStart(2,'0');
    const farS = `${far.getFullYear()}-${p2(far.getMonth()+1)}-${p2(far.getDate())}`;
    const es = await getDocs(query(collection(db,'academicEvents'),
      where('start','>=',ts), where('start','<=',farS), orderBy('start'), limit(30)));
    const evOrgOK = e => { const os = (Array.isArray(e.orgs)&&e.orgs.length)? e.orgs
        : [ (e.org==='both'||e.org==='all') ? 'all' : (e.org||'daniel') ];
      return os.includes('all') || os.some(x=>orgs.includes(x)); };
    const up = es.docs.map(d=>d.data()).filter(e=>evOrgOK(e) && (e.start||e.date))
      .map(e=>({ t:e.title||'학사 행사', d:(e.start||e.date) }))
      .filter(e=>e.d>=ts).sort((a,b)=>a.d.localeCompare(b.d)).slice(0,3);
    if(!up.length){ box.innerHTML = `<div class="hw-dim">다가오는 학사 일정이 없어요.</div>`; return; }
    box.innerHTML = up.map(e=>{
      const dn = Math.round((new Date(e.d+'T00:00:00')-new Date(ts+'T00:00:00'))/86400000);
      return `<a class="hw-line" href="academic.html"><span class="hw-ic">📅</span>
        <b>${esc(e.t)} <i>${Number(e.d.slice(5,7))}/${Number(e.d.slice(8,10))}</i></b>
        <span class="hw-dd${dn<=3?' hot':''}">${dn===0?'오늘!':'D-'+dn}</span></a>`; }).join('');
  }catch(e){ box.innerHTML = `<div class="hw-dim">학사 일정을 불러오지 못했어요.</div>`; }
}

/* ── 🧾💰 결재·경비 위젯 — 기존 알림 계량기(__notif) 재사용 ── */
window.updateHomeCounters = function(){
  const nn = window.__notif || {};
  const a = $I('w-appr-t');
  if(a) a.innerHTML = (nn.approvalCnt>0)
    ? `내 차례 <em>${nn.approvalCnt}건</em> — 기다리는 결재가 있어요`
    : `결재함이 비어 있어요 🎉`;
  const m = $I('w-money-t');
  if(m){ const pc=nn.payCnt||0, pw=nn.payWaitCnt||0;
    m.innerHTML = (pc+pw>0)
      ? `${pc?`경비 결재 <em>${pc}건</em>`:''}${pc&&pw?' · ':''}${pw?`지급 대기 <em>${pw}건</em>`:''}`
      : `처리할 경비 요청이 없어요 🎉`; }
};



/* ── 💰 이달 활동 합계 — 장부(ledger) 경유 요약 ── */
async function loadMoneySums(){
  const el = $I('w-money-sum'); if(!el) return;
  try{
    const orgs = attHomeOrgs(); if(!orgs.length){ el.textContent=''; return; }
    const ls = await getDocs(collection(db,'actLedgers'));
    const ids = ls.docs.map(d=>({id:d.id, ...d.data()}))
      .filter(l=>!l.deleted && orgs.includes(l.org)).map(l=>l.id);
    if(!ids.length){ el.textContent=''; return; }
    const n=new Date(), y=n.getFullYear(), m=n.getMonth();
    const inMonth = t=>{ const d=t&&t.seconds? new Date(t.seconds*1000):null;
      return d && d.getFullYear()===y && d.getMonth()===m; };
    let exp=0, inc=0;
    for(let i=0;i<ids.length;i+=10){
      const chunk = ids.slice(i,i+10);
      const es = await getDocs(query(collection(db,'actExpenses'), where('ledgerId','in',chunk)));
      es.forEach(d=>{ const v=d.data(); if(!v.deleted && inMonth(v.createdAt)) exp += Number(v.subtotal ?? v.amount ?? 0)||0; });
      try{
        const is = await getDocs(query(collection(db,'actIncomes'), where('ledgerId','in',chunk)));
        is.forEach(d=>{ const v=d.data(); if(!v.deleted && inMonth(v.createdAt)) inc += Number(v.subtotal ?? v.amount ?? 0)||0; });
      }catch(_){/* 수입 없음 */}
    }
    const won = x=>x.toLocaleString('ko-KR');
    el.textContent = (exp||inc) ? `이달 활동 — 지출 ${won(exp)}원 · 수입 ${won(inc)}원` : '이달 활동 지출·수입 없음';
  }catch(e){ el.textContent=''; }
}

  window.loadAttendWidget = loadAttendWidget;
  window.loadClubWidget = loadClubWidget;
  window.loadAcdday = loadAcdday;
  window.loadMoneySums = loadMoneySums;
}
