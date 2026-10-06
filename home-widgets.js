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
/* 반별·보드·요약 — 선생님(계정)마다 따로 기억한다. 아무것도 고르지 않았으면 모두 «반별»
   (같은 컴퓨터를 여러 선생님이 써도 서로 섞이지 않게 계정별 칸에 둔다) */
const ATT_STYLES = ['cls','board','sum'];
function attStyleKey(){ const cu = getCU(); return 'gyosa_attstyle:' + ((cu && cu.uid) || '_'); }
function readAttStyle(){ try{ const v = localStorage.getItem(attStyleKey()); return ATT_STYLES.includes(v) ? v : 'cls'; }catch(e){ return 'cls'; } }
function syncAttSeg(){ document.querySelectorAll('.att-seg button').forEach(b=>b.classList.toggle('on', b.dataset.s===ATT_STYLE)); }
let ATT_STYLE = 'cls';
window.getAttStyle = () => readAttStyle();
window.setAttStyle = s => { if(!ATT_STYLES.includes(s)) return; ATT_STYLE = s; try{ localStorage.setItem(attStyleKey(), s); }catch(e){}
  syncAttSeg();
  attHomeOrgs().forEach(o=>paintAttOrg(o)); };

/* 📅 오늘이 «수업일»인가 — 출석부(attend.html)와 똑같은 규칙
   학기(terms) 안 · 평일 · 휴일(holidays: 공휴일·대체공휴일·휴교)이 아님 · 방학(workPeriods vacation)이 아님 */
let _sdData = null, _sdAt = 0;
async function loadSchoolDayData(){
  if(_sdData && Date.now() - _sdAt < 10*60000) return _sdData;
  const [h, w, t] = await Promise.all([ getDocs(collection(db,'holidays')), getDocs(collection(db,'workPeriods')), getDocs(collection(db,'terms')) ]);
  _sdData = { hol: h.docs.map(d=>d.data()), wp: w.docs.map(d=>d.data()), terms: t.docs.map(d=>d.data()) };
  _sdAt = Date.now();
  return _sdData;
}
const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function attDayInfo(ds, org, D){
  const dow = new Date(ds+'T00:00:00').getDay();
  const hol = D.hol.find(h => h.date===ds && (h.org==='all' || h.org===org));
  if(hol) return { school:false, kind:'hol', name: hol.name || '공휴일' };
  const vac = D.wp.find(w => w.type==='vacation' && w.org===org && ds>=w.s && ds<=w.e);
  if(vac) return { school:false, kind:'vac', name: vac.vac || vac.name || '방학' };
  if(dow===0 || dow===6) return { school:false, kind:'wknd', name: dow===0 ? '일요일' : '토요일' };
  const y = Number(ds.slice(0,4));
  const ts = D.terms.filter(t => t.org===org && t.year===y);
  if(!ts.length) return { school:false, kind:'noterm', name: y+'년' };
  if(!ts.some(t => t.start && t.end && ds>=t.start && ds<=t.end)) return { school:false, kind:'out', name:'' };
  return { school:true };
}
function attNextSchoolDay(ds, org, D){
  const d = new Date(ds+'T00:00:00');
  for(let i=0; i<240; i++){ d.setDate(d.getDate()+1); const x = ymdOf(d); if(attDayInfo(x, org, D).school) return x; }
  return '';
}
/* 학사일정 — 올해(연말·연초엔 이웃 해까지) 행사를 한 번에 받아 «오늘 학사일정»과 «학사 D-Day»가 같이 쓴다 */
let _yevP = null, _yevAt = 0;
function loadYearEvents(){
  if(_yevP && Date.now() - _yevAt < 10*60000) return _yevP;
  const n = new Date(), y = n.getFullYear(), mo = n.getMonth()+1;
  const years = [y]; if(mo <= 2) years.unshift(y-1); if(mo >= 9) years.push(y+1);
  _yevAt = Date.now();
  _yevP = getDocs(query(collection(db,'academicEvents'), where('year','in',years)))
    .then(s => s.docs.map(d=>({ id:d.id, ...d.data() })).filter(e=>!e.deleted && e.startDate))
    .catch(e => { _yevP = null; throw e; });
  return _yevP;
}
function evOrgOf(e){ return (Array.isArray(e.orgs) && e.orgs.length) ? e.orgs : [ (e.org==='both'||e.org==='all') ? 'all' : (e.org||'daniel') ]; }
function evHitsOrg(e, orgs){ const os = evOrgOf(e); return os.includes('all') || os.some(x=>orgs.includes(x)); }
// 이 날 열리는가 (기간 · 고른 요일 · «이날만 빼기»까지)
function evOnDay(e, ds){
  if(ds < e.startDate || ds > (e.endDate || e.startDate)) return false;
  const wd = Array.isArray(e.weekdays) ? e.weekdays : [];
  if(wd.length && !wd.includes(new Date(ds+'T00:00:00').getDay())) return false;
  return !(Array.isArray(e.skipDates) && e.skipDates.includes(ds));
}
function evTargetLabel(e){
  if(!e.scope || e.scope==='all') return '';
  const t = (e.targets || []).map(String);
  if(e.scope==='grade' && t.length && t.every(x=>/학년$/.test(x))) return t.map(x=>x.replace('학년','')).join('·') + '학년';
  return t.join('·');
}
const DOW_KO = ['일','월','화','수','목','금','토'];
const mdDow = ds => `${Number(ds.slice(5,7))}/${Number(ds.slice(8,10))} (${DOW_KO[new Date(ds+'T00:00:00').getDay()]})`;
const josaIeyo = w => { const c = String(w||'').trim().slice(-1).charCodeAt(0);
  return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 === 0) ? '예요' : '이에요'; };
let _attDayInfo = {}, _attEv = {}, _attMerge = null, _attDay = '', _attTick = null;
window.togAttOpen = o => { ATT_OPEN[o] = !ATT_OPEN[o]; paintAttOrg(o); };
function attHomeOrgs(){ return orgCore.myOrgs(getCU(),'unifiedDF'); }   // 🏛 org-core 원장 위임
/* 출결 항목 → 묶음. (v-107) 지각·조퇴·체험학습처럼 «출석으로 인정»되는 항목도 홈에 보인다 —
   출석률은 결석(출석 인정 안 되는 항목)만 빼고 센다 */
function attBucket(nm){
  const n = String(nm||'');
  if(n.includes('체험')) return 'trip';
  if(n.includes('결석') || n.includes('병결') || n==='결') return 'abs';
  if(n.includes('지각')) return 'lat';
  if(n.includes('조퇴')) return 'ear';
  return 'etc';
}
const ATT_BK = { abs:{l:'결석',c:'#DC2626',bg:'#FDE8E8'}, lat:{l:'지각',c:'#D97706',bg:'#FEF3D9'},
                 ear:{l:'조퇴',c:'#2563EB',bg:'#E5EDFC'}, trip:{l:'체험',c:'#0E7490',bg:'#DDF1F5'},
                 etc:{l:'기타',c:'#6B7280',bg:'#EEF0F2'}, lv:{l:'휴학',c:'#B45309',bg:'#FDF0DA'} };
const ATT_BK_ORDER = ['abs','ear','lat','trip','etc'];
// 기본 «출석» 항목 — 이것만 고른 기록은 특이사항이 아니다
function attDefaultType(){
  const ts = (_attTypes||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0));
  return ts.find(t=>t.name==='출석') || ts.find(t=>t.isPresent) || null;
}
// 칩에 쓸 짧은 이름 — «체험학습 (가족여행)» → «체험», «질병지각»·«병결»은 그대로
function attShort(t){ const b = attBucket(t.name); if(b==='trip') return '체험'; const n = String(t.name||''); return n.length>4 ? ATT_BK[b].l : n; }
// 다니엘은 학년으로 부서를 가른다 (초등 1~5 · 중등 6~9 · 고등 10~12)
function attDeptOf(o, grade){
  if(o !== 'daniel') return '';
  const n = parseInt(String(grade||''),10);
  if(n>=1 && n<=5) return '초등부'; if(n>=6 && n<=9) return '중등부'; if(n>=10 && n<=12) return '고등부';
  return '미지정';
}
let _attStuRaw = {}, _attMarks = {}, _attLeave = {};
async function loadAttendWidget(){
  const box = $I('w-attend'); if(!box) return;
  _attUnsubs.forEach(u=>{ try{u();}catch(e){} }); _attUnsubs = [];
  ATT_STYLE = readAttStyle(); syncAttSeg(); attOffCss();
  const orgs = attHomeOrgs();
  if(!orgs.length){ box.innerHTML=''; return; }
  const today = hwToday();
  if(_attDay && _attDay !== today){ _attStu = {}; _attCls = null; _attStuRaw = {}; _attMarks = {}; _attLeave = {}; _attLast = {}; }   // 날이 바뀌면 재적·휴학 판정도 새로
  _attDay = today;
  // 🕛 자정이 지나면 그날 것으로 저절로 갈아탄다
  if(!_attTick) _attTick = setInterval(()=>{ if($I('w-attend') && hwToday() !== _attDay) loadAttendWidget(); }, 60000);
  // 📅 오늘이 수업일인지 + 오늘 학사일정 (못 받아 오면 예전처럼 출결만 보여 준다)
  _attDayInfo = {}; _attEv = {}; _attMerge = null;
  try {
    const SD = await loadSchoolDayData();
    orgs.forEach(o=>{
      const di = attDayInfo(today, o, SD);
      if(!di.school && di.kind!=='noterm') di.next = attNextSchoolDay(today, o, SD);
      _attDayInfo[o] = di;
    });
    const off = orgs.map(o=>_attDayInfo[o]);
    if(orgs.length > 1 && off.every(d=>!d.school && d.kind===off[0].kind && d.name===off[0].name && d.next===off[0].next))
      _attMerge = orgs.slice();                                      // 두 기관이 같은 이유로 쉬면 카드 하나로
  } catch(e){ _attDayInfo = {}; }
  try {
    const evs = await loadYearEvents();
    orgs.forEach(o=>{ _attEv[o] = evs.filter(e=>e.kind!=='staff' && evHitsOrg(e,[o]) && evOnDay(e, today))
      .sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||'') || String(a.title||'').localeCompare(String(b.title||''),'ko')); });
  } catch(e){ _attEv = {}; }
  try {
    if(!_attTypes){
      const ts = await getDocs(collection(db,'attendTypes'));
      _attTypes = ts.docs.map(d=>({id:d.id, ...d.data()}));
    }
  } catch(e){ box.innerHTML = `<div class="hw-dim">출결 정보를 불러오지 못했어요.</div>`; return; }
  box.innerHTML = orgs.map(o=>`<div id="att-row-${o}"></div>`).join('');
  /* 🔁 반편성 · 학생(휴학) · 출결 모두 실시간 — 학생관리에서 휴학을 걸거나 담임이 체험학습을 표시하면 홈이 바로 바뀐다 */
  let clsReady; const clsP = new Promise(r=>clsReady=r);
  _attUnsubs.push(onSnapshot(collection(db,'classes'), s=>{
    _attCls = s.docs.map(d=>({id:d.id, ...d.data()}));
    orgs.forEach(o=>{ if(_attStuRaw[o]){ attBuildStu(o); attBuildFlags(o); paintAttOrg(o); } });
    clsReady();
  }, ()=>{ _attCls = _attCls || []; clsReady(); }));
  await clsP;
  orgs.forEach(o=>{
    _attUnsubs.push(onSnapshot(query(collection(db,'students'), where('org','==',o)), s=>{
      _attStuRaw[o] = s.docs.map(d=>({id:d.id, ...d.data()}));
      attBuildStu(o); attBuildFlags(o); paintAttOrg(o);
    }, ()=>{ const el=$I('att-row-'+o); if(el && !_attStu[o]) el.innerHTML=`<div class="hw-dim">학생 명단을 불러오지 못했어요.</div>`; }));
    const qy = query(collection(db,'studentAttendance'), where('org','==',o), where('date','==',today));
    _attUnsubs.push(onSnapshot(qy, snap=>{
      _attMarks[o] = snap.docs.map(d=>d.data());
      attBuildFlags(o); paintAttOrg(o);
    }, ()=>{ const el=$I('att-row-'+o); if(el) el.innerHTML=`<div class="hw-dim">출결 구독 실패 — 새로고침해 보세요.</div>`; }));
  });
}
// 이 기관 학생 → 오늘 재학(출결 대상) / 오늘 휴학, 반·학년 붙이기
function attBuildStu(o){
  const y = new Date().getFullYear();
  const mine = (_attCls||[]).filter(c=>!c.org || c.org===o)
    .sort((a,b)=>((b.year||y)===y?1:0)-((a.year||y)===y?1:0));   // 올해 반 우선
  const info = {};
  mine.forEach(c=>{ (c.students||[]).forEach(sid=>{
    if(info[sid]) return;
    info[sid] = { className: c.name||'', classId: c.id, grade: (c.grades && c.grades[sid]) || c.grade || '' }; }); });
  const all = (_attStuRaw[o]||[]).filter(x=>!x.deleted).map(st=>{ const i = info[st.id] || {};
    return { ...st, className: st.className || i.className || '', classId: i.classId||'', grade: st.grade || i.grade || '' }; });
  const stOf = x => window.StuStatus ? StuStatus.status(x) : ((x.status||'active')==='active' ? 'active' : x.status);
  _attStu[o] = all.filter(x=>stOf(x)==='active');                  // 오늘 휴학(기간 포함)은 뺀다 — 출석부와 같은 규칙
  _attLeave[o] = all.filter(x=>stOf(x)==='leave' && x.classId)       // 반에 있는 휴학생 — 반 카드에 «휴학»으로 보인다
    .map(x=>({ id:x.id, name:x.name||'', clsId:x.classId, cls:x.className, grade:x.grade,
               note: window.StuStatus ? StuStatus.leaveNote(x) : '' }));
}
// 오늘 기록 → 학생별 특이사항 (기본 «출석»만 고른 기록은 뺀다)
function attBuildFlags(o){
  if(!_attStu[o] || !_attMarks[o] || !_attTypes) return;
  const smap = {}; _attStu[o].forEach(st=>smap[st.id]=st);
  const def = attDefaultType();
  const flag = {};
  _attMarks[o].forEach(m=>{
    const ids = (m.typeIds && m.typeIds.length) ? m.typeIds : (m.typeId?[m.typeId]:[]);
    const ts = ids.map(id=>_attTypes.find(x=>x.id===id)).filter(t=>t && (!def || t.id!==def.id));
    if(!ts.length) return;
    const st = smap[m.studentId];
    if(!st) return;   // 오늘 휴학(또는 재학이 아닌) 학생 — 휴학 전에 입력된 기록이 있어도 출결로 세지 않는다 (기록은 보관)
    flag[m.studentId] = {
      name: st.name||m.studentName||'',
      clsId: st.classId || m.classId || '',
      grade: st.grade || '',
      cls: st.className || m.className || '',
      type: ts.map(t=>t.name).join('·'),            // 예: 지각·조퇴 (둘 다 보이게)
      types: ts.map(t=>t.name),
      short: ts.map(attShort).join('·'),
      bk: attBucket(ts[0].name),
      bks: ts.map(t=>attBucket(t.name)),
      np: ts.some(t=>!t.isPresent),                 // 출석으로 치지 않는 항목(결석 등)이 있나
      memo: m.memo||m.note||m.reason||'' };
  });
  _attLast[o] = { flag, today: _attDay };
}
function attByClass(o){
  /* 반 이름이 학년마다 겹치므로(로이반=2·3학년 등) «반 문서» 단위로 가른다.
     재적이 1명이라도 있는 반은 특이사항이 없어도 모두 보여준다. 휴학생은 n 에 넣지 않고 lv 로 따로 */
  const map = {};
  const key = st => st.classId || ('nm:'+(st.className||'미배정'));
  const slot = (k, name, grade) => (map[k] = map[k] || { name: name||'미배정', grade: grade||'', n:0, fl:[], lv:[] });
  (_attStu[o]||[]).forEach(st=>{
    const m = slot(key(st), st.className, st.grade);
    m.n++;
    if(!m.grade && st.grade) m.grade = st.grade;
  });
  (_attLeave[o]||[]).forEach(l=>{ const m = slot(l.clsId || ('nm:'+(l.cls||'미배정')), l.cls, l.grade); m.lv.push(l); if(!m.grade && l.grade) m.grade = l.grade; });
  const flag = (_attLast[o]||{}).flag || {};
  Object.values(flag).forEach(f=>{ slot(f.clsId || ('nm:'+(f.cls||'미배정')), f.cls, f.grade).fl.push(f); });
  const gnum = g => { const n = parseInt(String(g),10); return isNaN(n) ? 99 : n; };
  const rank = f => Math.min(...(f.bks||[f.bk]).map(b=>ATT_BK_ORDER.indexOf(b)));
  return Object.entries(map)
    .filter(([,v])=>v.n > 0 || v.lv.length)                    // 재학생(또는 휴학생) 있는 반만
    .map(([k,v])=>{ v.fl.sort((a,b)=>rank(a)-rank(b) || String(a.name).localeCompare(String(b.name),'ko'));
      v.abs = v.fl.filter(f=>f.np).length; v.p = Math.max(0, v.n - v.abs); v.dept = attDeptOf(o, v.grade); return [k,v]; })
    .sort((a,b)=> gnum(a[1].grade)-gnum(b[1].grade) || String(a[1].name).localeCompare(String(b[1].name),'ko'));
}
/* 시안·점검용 — 한 기관의 오늘 출결 묶음 (그리는 쪽과 같은 자료) */
function attModel(o){
  const L = _attLast[o]; if(!L) return null;
  const flags = Object.values(L.flag);
  const cnt = { abs:0, lat:0, ear:0, trip:0, etc:0, lv:(_attLeave[o]||[]).length };
  flags.forEach(f=>{ const seen={}; (f.bks||[f.bk]).forEach(b=>{ if(seen[b]) return; seen[b]=1; cnt[b]++; }); });
  const roster = (_attStu[o]||[]).length;
  const absent = flags.filter(f=>f.np).length;
  const present = Math.max(0, roster - absent);
  return { org:o, orgNm:(window.ORGS&&ORGS[o])||o, roster, present, rate: roster ? Math.round(present/roster*100) : 100,
    cnt, flags, leave:(_attLeave[o]||[]).slice(), classes: attByClass(o).map(([,v])=>v), day:_attDayInfo[o]||null, events:_attEv[o]||[] };
}
window.__attModel = attModel;
function attOffCss(){
  if(document.getElementById('hwa-css')) return;
  const st = document.createElement('style'); st.id = 'hwa-css';
  st.textContent = `
  .att-off{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:14px;border:1px solid var(--ivd);
    text-decoration:none;color:inherit;margin-bottom:8px;background:var(--iv)}
  .att-off:hover{border-color:var(--gm)}
  .att-off .ao-ic{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-size:22px;flex:none;background:var(--wh);box-shadow:0 1px 0 rgba(0,0,0,.04)}
  .att-off .ao-mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
  .att-off .ao-mid b{font-size:15px;font-weight:900;color:var(--gd);letter-spacing:-.2px}
  .att-off .ao-mid>span{font-size:11.8px;color:var(--ts);font-weight:600}
  .att-off .ao-next{flex:none;text-align:center;background:var(--wh);border:1px solid var(--ivd);border-radius:12px;
    padding:8px 14px;display:flex;flex-direction:column;gap:1px;min-width:92px}
  .att-off .ao-next i{font-style:normal;font-size:10px;font-weight:800;color:var(--tl)}
  .att-off .ao-next b{font-size:14px;font-weight:900;color:var(--gd);font-variant-numeric:tabular-nums;white-space:nowrap}
  .att-off .ao-next em{font-style:normal;font-size:10.5px;font-weight:900;color:var(--gm)}
  .att-off .ao-mk{font-size:10.5px;font-weight:800;color:#B45309}
  .att-off.hol{background:rgba(220,38,38,.055);border-color:rgba(220,38,38,.22)}
  .att-off.hol .ao-mid b{color:#C53030}
  .att-off.vac{background:rgba(14,116,144,.06);border-color:rgba(14,116,144,.22)}
  .att-off.vac .ao-mid b{color:#0E7490}
  .att-off.wknd{background:var(--gp)}
  .att-off.wknd .ao-mid b{color:var(--gm)}
  .att-off.out .ao-mid b{color:var(--ts)}
  .att-evl{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:-2px 2px 7px}
  .att-evh{font-size:10.5px;font-weight:900;color:var(--gm);margin-right:2px}
  .att-evs{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}
  .att-evc{font-size:10.5px;font-weight:800;color:var(--gd);background:var(--wh);border:1px solid var(--ivd);border-radius:7px;padding:2px 8px}
  .att-evc i{font-style:normal;color:var(--tl);font-weight:700;margin-left:4px}
  .att-evc.more{color:var(--tl)}
  .att-stats.six{grid-template-columns:repeat(6,1fr)}
  .acol-top{display:flex;flex-wrap:wrap;gap:4px 18px;margin:2px 2px 7px}
  .acol-org{display:inline-flex;align-items:baseline;gap:7px}
  .acol-org b{font-size:12.5px;font-weight:900;color:var(--gd)}.acol-org span{font-size:10.5px;color:var(--tl);font-weight:700}
  .acol{display:grid;gap:10px;margin-bottom:8px;align-items:start;grid-template-columns:repeat(4,minmax(0,1fr))}
  .acol.n1{grid-template-columns:minmax(0,1fr)}.acol.n2{grid-template-columns:repeat(2,minmax(0,1fr))}.acol.n3{grid-template-columns:repeat(3,minmax(0,1fr))}
  .acol-c{background:var(--wh);border:1px solid var(--ivd);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
  .acol-h{display:block;padding:10px 12px 8px;border-bottom:1px solid var(--ivd);background:var(--iv);text-decoration:none;color:inherit}
  .acol-h .t{display:flex;align-items:baseline;gap:6px}.acol-h b{font-size:13.5px;font-weight:900;color:var(--gd)}
  .acol-h i{font-style:normal;font-size:10px;color:var(--tl);font-weight:700}
  .acol-h .n{margin-left:auto;font-size:12px;font-weight:900;color:var(--gm);font-variant-numeric:tabular-nums}
  .acol-bar{display:block;height:4px;border-radius:9px;background:var(--ivd);margin-top:7px;overflow:hidden}
  .acol-bar i{display:block;height:100%;background:#16a34a;border-radius:9px}
  .acol-r{display:block;padding:7px 12px;border-top:1px solid var(--ivd);text-decoration:none;color:inherit}
  .acol-h + .acol-r{border-top:0}.acol-r:hover{background:var(--gp)}
  .acol-r .l{display:flex;align-items:center;gap:6px;font-size:12.5px}
  .acol-g{min-width:22px;height:20px;padding:0 4px;box-sizing:border-box;border-radius:6px;background:var(--gp);color:var(--gm);font-size:10.5px;font-weight:900;
    display:inline-flex;align-items:center;justify-content:center;flex:none}
  .acol-r .l b{font-weight:800;color:var(--gd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .acol-r .l .c{margin-left:auto;font-weight:900;font-variant-numeric:tabular-nums;color:var(--gm);font-size:12px}
  .acol-r .l .ok{color:#16a34a;font-size:11px;font-weight:900;margin-left:2px}
  .acol-r .cs{display:flex;flex-wrap:wrap;gap:3px;margin:5px 0 1px 28px}
  .acol-r.warn .l .c{color:#DC2626}
  @media(max-width:760px){ .acol.n3,.acol.n4,.acol{grid-template-columns:repeat(2,minmax(0,1fr))} .acol.n1{grid-template-columns:minmax(0,1fr)} }
  .att-st.t b{color:#0E7490}.att-st.v b{color:#B45309}
  .att-card.note{border-color:#BFDDE4}
  @media(max-width:560px){ .att-stats.six{grid-template-columns:repeat(3,1fr)} }
  @media(max-width:560px){
    .att-off{flex-wrap:wrap;gap:10px 12px;padding:14px}
    .att-off .ao-mid{flex-basis:calc(100% - 60px)}
    .att-off .ao-next{flex-direction:row;align-items:baseline;justify-content:center;gap:8px;width:100%;padding:7px 10px}
  }`;
  document.head.appendChild(st);
}
/* 🏠 수업 없는 날 카드 — 출결 숫자 대신 «오늘이 어떤 날인지»와 «다음 수업일» */
const ATT_OFF = {
  hol:   { ic:'🏠', cls:'hol' },   // 🎌(일본 국기 두 개)는 쓰지 않는다
  vac:   { ic:'🏖️', cls:'vac' },
  wknd:  { ic:'🌿', cls:'wknd' },
  out:   { ic:'📘', cls:'out' },
  noterm:{ ic:'🗓️', cls:'out' },
};
// 학년 표시 — 지혜빛은 «4세» 그대로 (예전엔 «4세학년»으로 보였다)
function attGradeTxt(g){ if(!g) return ''; const t = String(g); return /세$/.test(t) ? t : t.replace('학년','')+'학년'; }
function attEvChips(list, max){
  return (list||[]).slice(0, max||3).map(e=>{ const tl = evTargetLabel(e);
    return `<span class="att-evc">${esc(e.title||'학사 행사')}${tl?`<i>${esc(tl)}</i>`:''}</span>`; }).join('')
    + ((list||[]).length > (max||3) ? `<span class="att-evc more">+${list.length-(max||3)}</span>` : '');
}
function attOffHTML(orgList, D){
  const k = ATT_OFF[D.kind] || ATT_OFF.out;
  const names = orgList.map(o=>(window.ORGS&&ORGS[o])||o).join(' · ');
  let title, sub;
  if(D.kind==='hol'){ title = `오늘은 ${D.name}${josaIeyo(D.name)}`; sub = `수업이 없는 날이라 출결을 받지 않아요`; }
  else if(D.kind==='vac'){ title = `${D.name} 중이에요`; sub = `방학 동안은 출결을 받지 않아요`; }
  else if(D.kind==='wknd'){ title = `오늘은 ${D.name}${josaIeyo(D.name)}`; sub = `주말 — 수업이 없는 날이에요`; }
  else if(D.kind==='noterm'){ title = `${D.name} 학기 일정이 아직 없어요`; sub = `출석부 › 설정에서 학기를 등록하면 출결이 시작돼요`; }
  else { title = `학기 기간이 아니에요`; sub = `학기가 시작되면 출결이 다시 보여요`; }
  let next = '';
  if(D.next){
    const dn = Math.round((new Date(D.next+'T00:00:00') - new Date(_attDay+'T00:00:00'))/86400000);
    const rel = dn===1 ? '내일' : dn===2 ? '모레' : `D-${dn}`;
    next = `<span class="ao-next"><i>${D.kind==='out'?'개학':'다음 수업일'}</i><b>${mdDow(D.next)}</b><em>${rel}</em></span>`;
  }
  const marks = orgList.reduce((n,o)=>n + Object.keys((_attLast[o]||{}).flag||{}).length, 0);
  const evs = [].concat(...orgList.map(o=>_attEv[o]||[])).filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i)
    .filter(e=>e.category!=='closed' && e.category!=='break' && e.title!==D.name);
  return `<a class="att-off ${k.cls}" href="${D.kind==='noterm'?'attend.html':'academic.html'}">
    <span class="ao-ic">${k.ic}</span>
    <span class="ao-mid"><b>${esc(title)}</b>
      <span>${esc(names)} — ${esc(sub)}</span>
      ${evs.length?`<span class="att-evs"><span class="att-evh">📅 학사일정</span>${attEvChips(evs)}</span>`:''}
      ${marks?`<span class="ao-mk">출석부에 남은 기록 ${marks}건</span>`:''}</span>
    ${next}</a>`;
}
/* 🏛 반별 = «부서 칼럼» (v-108, 시안 A) — 초등부·중등부·고등부(·지혜빛)를 기둥으로, 반은 한 줄씩.
   특이사항(결석·지각·조퇴·체험·휴학)이 있는 반 밑에만 이름 칩. 두 기관을 함께 보면 한 판에 나란히 */
function attColumns(o, M, multi){
  const go = `attend.html?stat=live&org=${o}`;
  const groups = [];
  const put = (name, v) => { let g = groups.find(x=>x.name===name); if(!g){ g = { name, cs:[] }; groups.push(g); } g.cs.push(v); };
  if(o === 'daniel'){
    const order = ['초등부','중등부','고등부','미지정'];
    M.classes.forEach(v=>put(v.dept || '미지정', v));
    groups.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));
  } else if(o === 'jihyebit' && !multi){
    M.classes.forEach(v=>put(v.grade || '미지정', v));            // 지혜빛만 볼 땐 나이별 기둥
  } else {
    M.classes.forEach(v=>put(M.orgNm, v));
  }
  const chip = f => `<span class="att-pc" style="background:${ATT_BK[f.bk].bg};color:${ATT_BK[f.bk].c}" title="${esc(f.type)}${f.memo?' · '+esc(f.memo):''}">${esc(f.short)} ${esc(f.name)}</span>`;
  const lvChip = l => `<span class="att-pc" style="background:${ATT_BK.lv.bg};color:${ATT_BK.lv.c}" title="휴학${l.note?' '+esc(l.note):''}">휴학 ${esc(l.name)}</span>`;
  const gTag = v => { const t = String(v.grade||''); return /세$/.test(t) ? t : t.replace('학년',''); };
  return groups.map(gr=>{
    const n = gr.cs.reduce((a,v)=>a+v.n,0), p = gr.cs.reduce((a,v)=>a+v.p,0);
    const rate = n ? Math.round(p/n*100) : 100;
    return `<div class="acol-c"><a class="acol-h" href="${go}"><span class="t"><b>${esc(gr.name)}</b><i>${gr.cs.length}반</i><span class="n">${p}/${n}</span></span>
      <span class="acol-bar"><i style="width:${rate}%;${rate<100?'background:#f59e0b':''}"></i></span></a>
      ${gr.cs.map(v=>{ const any = v.fl.length || v.lv.length;
        return `<a class="acol-r${v.abs?' warn':''}" href="${go}"><span class="l"><span class="acol-g">${esc(gTag(v))}</span><b>${esc(v.name)}</b><span class="c">${v.p}/${v.n}</span>${any?'':'<span class="ok">✓</span>'}</span>
          ${any?`<span class="cs">${v.fl.map(chip).join('')}${v.lv.map(lvChip).join('')}</span>`:''}</a>`; }).join('')}</div>`;
  });
}
function paintAttCols(){
  const orgs = attHomeOrgs(); if(!orgs.length) return;
  const el = $I('att-row-'+orgs[0]); if(!el) return;
  orgs.slice(1).forEach(o=>{ const e = $I('att-row-'+o); if(e) e.innerHTML = ''; });
  const offOrgs = orgs.filter(o=>_attDayInfo[o] && !_attDayInfo[o].school);
  let off = '';
  if(_attMerge) off = attOffHTML(_attMerge, _attDayInfo[_attMerge[0]]);
  else offOrgs.forEach(o=>{ off += attOffHTML([o], _attDayInfo[o]); });
  const on = orgs.filter(o=>!offOrgs.includes(o));
  const multi = orgs.length > 1;
  const heads = [], cols = [], evs = [];
  on.forEach(o=>{
    const M = attModel(o); if(!M) return;
    heads.push(`<span class="acol-org"><b>${esc(M.orgNm)}</b><span>${M.present}/${M.roster} 출석 · ${M.rate}%${M.cnt.lv?` · 휴학 ${M.cnt.lv}`:''}</span></span>`);
    (_attEv[o]||[]).forEach(e=>{ if(!evs.some(x=>x.id===e.id)) evs.push(e); });
    cols.push(...attColumns(o, M, multi));
  });
  const evl = evs.length ? `<div class="att-evl"><span class="att-evh">📅 오늘 학사일정</span>${attEvChips(evs, 4)}</div>` : '';
  el.innerHTML = (cols.length ? `<div class="acol-top">${heads.join('')}</div>${evl}<div class="acol n${Math.min(cols.length,4)}">${cols.join('')}</div>` : '') + off;
}
function paintAttOrg(o){
  if(ATT_STYLE==='cls'){ paintAttCols(); return; }      // 반별(부서 칼럼)은 기관을 한 판에 함께 그린다
  const el = $I('att-row-'+o); if(!el) return;
  const D = _attDayInfo[o];
  if(D && !D.school){                                   // 수업 없는 날 → 출결 대신 오늘이 어떤 날인지
    if(_attMerge && _attMerge.includes(o)){ el.innerHTML = o===_attMerge[0] ? attOffHTML(_attMerge, D) : ''; }
    else el.innerHTML = attOffHTML([o], D);
    return;
  }
  const M = attModel(o); if(!M){ el.innerHTML=''; return; }
  const evl = (_attEv[o]||[]).length ? `<div class="att-evl"><span class="att-evh">📅 오늘 학사일정</span>${attEvChips(_attEv[o], 4)}</div>` : '';
  const { roster, present, rate, cnt, flags } = M;
  const orgNm = M.orgNm;
  const go = `attend.html?stat=live&org=${o}`;
  const chip = f => `<span class="att-pc" style="background:${ATT_BK[f.bk].bg};color:${ATT_BK[f.bk].c}" title="${esc(f.type)}${f.memo?' · '+esc(f.memo):''}">${esc(f.short)} ${esc(f.name)}</span>`;
  const lvChip = l => `<span class="att-pc" style="background:${ATT_BK.lv.bg};color:${ATT_BK.lv.c}" title="휴학${l.note?' '+esc(l.note):''}">휴학 ${esc(l.name)}</span>`;
  const lvTxt = cnt.lv ? ` · 휴학 ${cnt.lv}` : '';
  let h = '';
  if(ATT_STYLE==='board'){
    const row = bk => { const list=flags.filter(f=>(f.bks||[f.bk]).includes(bk)); if(!list.length) return '';
      const memos = list.filter(f=>f.memo).map(f=>`${esc(f.name)}: ${esc(f.memo)}`).join(' · ');
      return `<a class="att-brow" href="${go}"><span class="att-k" style="color:${ATT_BK[bk].c}">${ATT_BK[bk].l}</span>
        <span class="att-nms">${list.map(f=>`<span class="att-nm">${esc(f.name)}<i>${esc(String(f.cls).replace('반',''))}</i></span>`).join('')}</span>
        ${memos?`<span class="att-memo">${memos}</span>`:''}</a>`; };
    const lvRow = M.leave.length ? `<a class="att-brow" href="students.html"><span class="att-k" style="color:${ATT_BK.lv.c}">휴학</span>
        <span class="att-nms">${M.leave.map(l=>`<span class="att-nm">${esc(l.name)}<i>${esc(String(l.cls).replace('반',''))}</i></span>`).join('')}</span></a>` : '';
    h = `<div class="att-orghd"><b>${esc(orgNm)}</b></div>${evl}
      <div class="att-stats six">
        <a class="att-st g" href="${go}"><b>${rate}%</b><span>출석률</span></a>
        <a class="att-st r" href="${go}"><b>${cnt.abs}</b><span>결석</span></a>
        <a class="att-st a" href="${go}"><b>${cnt.lat}</b><span>지각</span></a>
        <a class="att-st b" href="${go}"><b>${cnt.ear}</b><span>조퇴</span></a>
        <a class="att-st t" href="${go}"><b>${cnt.trip}</b><span>체험학습</span></a>
        <a class="att-st v" href="students.html"><b>${cnt.lv}</b><span>휴학</span></a></div>
      ${ATT_BK_ORDER.map(row).join('')}${lvRow}
      ${!flags.length && !M.leave.length?`<div class="att-clear">🎉 오늘 특이사항 없음 — 전원 출석이에요</div>`:''}`;
  } else {
    const ic = { abs:'🔴', lat:'🟡', ear:'🔵', trip:'🟢', etc:'⚪️' };
    const items = flags.map(f=>`${ic[f.bk]||'⚪️'} ${esc(f.name)}(${esc(String(f.cls).replace('반',''))}) ${esc(f.short)}${f.memo?' · '+esc(f.memo):''}`)
      .concat(M.leave.map(l=>`🟠 ${esc(l.name)}(${esc(String(l.cls).replace('반',''))}) 휴학`));
    const tick = items.length ? items.join('  ·  ') : '✓ 특이사항 없음 — 전원 출석';
    h = `${evl}<div class="att-sum">
      <div class="att-top" onclick="togAttOpen('${o}')">
        <div class="att-ring" style="background:conic-gradient(#16a34a 0 ${rate*3.6}deg,var(--iv) ${rate*3.6}deg 360deg)"><i>${rate}%</i></div>
        <div class="att-mid"><b>${esc(orgNm)} · ${present}/${roster} 출석</b>
          <span>결석 ${cnt.abs} · 지각 ${cnt.lat} · 조퇴 ${cnt.ear} · 체험 ${cnt.trip}${cnt.lv?` · 휴학 ${cnt.lv}`:''} — 탭해서 반별 보기</span></div>
        <span class="att-ar">${ATT_OPEN[o]?'⌃':'⌄'}</span></div>
      <div class="att-tick">${tick}</div>
      ${ATT_OPEN[o]?`<div class="att-open">${M.classes.map(v=>{
        const gTxt = attGradeTxt(v.grade) ? attGradeTxt(v.grade)+' ' : '';
        const who = v.fl.map(f=>`${esc(f.short)} ${esc(f.name)}`).concat(v.lv.map(l=>`휴학 ${esc(l.name)}`));
        return `<a class="att-trow" href="${go}"><b>${esc(gTxt)}${esc(v.name)}</b><span class="n">${v.p}/${v.n}</span>
          <span class="who">${who.length? who.join(' · ') : '✓ 전원 출석'}</span></a>`; }).join('')}</div>`:''}
    </div>`;
  }
  el.innerHTML = h;
}

/* ── 🎨 동아리 실황 위젯 ──
   (v-92) 운영 중이면 «오늘 수업» 목록을 동아리 현황의 그날 목록 모양 그대로 —
   교실 · 담당 강사 · 인원까지, 날마다 저절로 (자정이 지나면 다음 날 것으로 바뀝니다)
   동아리를 누르면 참여 학생 + 오늘 출석부(결석·지각·조퇴) + 동아리 출석(강사 기록) */
const CLUB_ST = {};          // 기관별 { sm, apps, enr, cols, orgNm, ts }
let _clubTick = null, _clubLoadedAt = 0, _clubDay = '';
function clubCss(){
  if(document.getElementById('hwc-css')) return;
  const st = document.createElement('style'); st.id = 'hwc-css';
  st.textContent = `
  .hwc{background:var(--wh);border:1px solid var(--ivd);border-radius:14px;overflow:hidden;margin-bottom:8px}
  .hwc-h{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--iv);border-bottom:1px solid var(--ivd);font-size:12.5px}
  .hwc-h b{font-weight:900;color:var(--gd)}
  .hwc-h span{font-size:11.5px;font-weight:700;color:var(--ts)}
  .hwc-h a{margin-left:auto;font-size:11.5px;font-weight:800;color:var(--gm);text-decoration:none;white-space:nowrap}
  .hwc-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
  .hwc-it{display:flex;align-items:center;gap:10px;padding:10px 14px;border:0;border-bottom:1px solid var(--ivd);background:transparent;
    text-align:left;font-family:inherit;color:inherit;cursor:pointer;min-width:0}
  .hwc-it:hover{background:var(--gp)}
  .hwc-it .bar{width:4px;align-self:stretch;border-radius:3px;flex:none}
  .hwc-it .mid{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
  .hwc-it .l1{display:flex;align-items:center;gap:6px;min-width:0}
  .hwc-it .l1 b{font-size:13px;font-weight:900;color:var(--gd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hwc-it .no{font-size:10px;font-weight:900;color:#fff;border-radius:6px;padding:1px 6px;flex:none}
  .hwc-it .nowb{font-size:10px;font-weight:900;color:#fff;background:var(--gm);border-radius:6px;padding:1px 6px;flex:none}
  .hwc-it .l2{font-size:11.2px;font-weight:600;color:var(--ts);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hwc-it .l2 em{font-style:normal;font-weight:800;color:var(--gm)}
  .hwc-it .t{font-size:11.5px;font-weight:800;color:var(--ts);font-variant-numeric:tabular-nums;white-space:nowrap;flex:none}
  .hwc-it.done{opacity:.55}
  .hwc-it.now{background:linear-gradient(90deg,rgba(0,112,74,.07),transparent)}
  @media (max-width:640px){ .hwc-list{grid-template-columns:1fr} }`;
  document.head.appendChild(st);
}
function hwToday(){ const n = new Date(); const p = x => String(x).padStart(2,'0'); return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`; }
function clubTodayHTML(o){
  const S = CLUB_ST[o]; if(!S) return '';
  const now = new Date(); const p = x => String(x).padStart(2,'0');
  const hm = `${p(now.getHours())}:${p(now.getMinutes())}`;
  const items = CR.sessionsOn(S.apps, S.sm, S.ts);
  const d = new Date(S.ts + 'T00:00:00');
  return `<div class="hwc"><div class="hwc-h"><b>${esc(S.orgNm)}</b><span>${Number(S.ts.slice(5,7))}월 ${Number(S.ts.slice(8,10))}일 (${'일월화수목금토'[d.getDay()]}) · 오늘 동아리 ${items.length}개</span>
      <a href="club-status.html">동아리 현황 ›</a></div>
    <div class="hwc-list">${items.map(({ c, s })=>{
      const col = S.cols[c.id] || '#00704A', n = CR.rosterOf(S.enr, c.id).length;
      const room = CR.roomOf(c), who = CR.instrOf(c);
      const st = (hm >= s.time && hm < s.end) ? 'now' : (hm >= s.end ? 'done' : '');
      return `<button type="button" class="hwc-it ${st}" onclick="hwClubRoster('${o}','${c.id}')" title="누르면 참여 학생을 볼 수 있어요">
        <span class="bar" style="background:${col}"></span>
        <span class="mid"><span class="l1"><b>${esc(c.title||'')}</b><span class="no" style="background:${col}">${s.no}/${s.total}차시</span>${st==='now'?'<span class="nowb">● 진행 중</span>':''}</span>
          <span class="l2">🏫 ${room ? esc(room) : '교실 미정'}${who ? ` · 👤 ${esc(who)}` : ''} · 👥 <em>${n}명</em></span></span>
        <span class="t">${esc(s.time)}–${esc(s.end)}</span></button>`; }).join('')}</div></div>`;
}
function paintClubToday(){
  Object.keys(CLUB_ST).forEach(o=>{ const el = document.getElementById('hwc-' + o); if(el) el.innerHTML = clubTodayHTML(o); });
}
window.hwClubRoster = (o, cid)=>{
  const S = CLUB_ST[o]; if(!S) return;
  const c = S.apps.find(x=>x.id===cid); if(!c) return;
  const s = CR.liveSessions(c, S.sm).find(x=>x.date===S.ts) || null;
  CR.openClubRoster({ db, fs:{ doc, getDoc, getDocs, collection, query, where }, club:c, sem:S.sm, session:s,
    roster: CR.rosterOf(S.enr, cid), color: S.cols[cid], org:o, link:'club-status.html' });
};
async function loadClubWidget(){
  const box = $I('w-club'); if(!box) return;
  const orgs = attHomeOrgs(); if(!orgs.length){ box.innerHTML=''; return; }
  const ts = hwToday();
  const today = new Date(); const p=x=>String(x).padStart(2,'0');
  const WDK = ['일','월','화','수','목','금','토'];
  _clubLoadedAt = Date.now(); _clubDay = ts;
  Object.keys(CLUB_ST).forEach(k=> delete CLUB_ST[k]);
  try{
    if(!CR) CR = await import('./club-roster.js');
    clubCss();
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
        const [as, es, shd] = await Promise.all([
          getDocs(query(collection(db,'clubApplications'), where('semId','==',sm.id))),
          getDocs(query(collection(db,'clubEnrollments'), where('semId','==',sm.id))).catch(()=>null),
          getDoc(doc(db,'clubStatusShare', sm.id)).catch(()=>null),
        ]);
        const apps = as.docs.map(d=>({id:d.id, ...d.data()}))
          .filter(c=>!c.deleted && !c.cancelled && c.status==='approved' && (c.sessions||[]).length);
        const enr = es ? es.docs.map(d=>({id:d.id, ...d.data()})).filter(e=>!e.deleted) : [];
        const cols = CR.colorMap(apps, (shd && shd.exists()) ? (shd.data().colors || null) : null);
        const todays = CR.sessionsOn(apps, sm, ts);
        if(todays.length){
          CLUB_ST[o] = { sm, apps, enr, cols, orgNm, ts };
          rows.push(`<div id="hwc-${o}">${clubTodayHTML(o)}</div>`);
        } else {
          const future = [];
          apps.forEach(c=> CR.liveSessions(c, sm).forEach(x=>{ if(x.date > ts) future.push({ c, x }); }));
          future.sort((a,b)=> a.x.date===b.x.date ? a.x.time.localeCompare(b.x.time) : a.x.date.localeCompare(b.x.date));
          if(future.length){
            const { c, x } = future[0]; const d=new Date(x.date+'T00:00:00');
            const room = CR.roomOf(c);
            rows.push(`<a class="hw-line" href="club-status.html"><span class="hw-ic">🎨</span>
              <b>${esc(orgNm)} — 오늘은 동아리가 없어요 · 다음 수업 ${Number(x.date.slice(5,7))}/${Number(x.date.slice(8,10))}(${WDK[d.getDay()]}) ${esc(c.title||'')} ${x.time} <i>(${x.no}/${x.total}차시${room?' · '+esc(room):''})</i></b><span class="hw-go">›</span></a>`);
          }
        }
      }
    }
    box.innerHTML = rows.join('') || `<div class="hw-dim">진행 중인 동아리 학기가 없어요.</div>`;
  }catch(e){ box.innerHTML = `<div class="hw-dim">동아리 정보를 불러오지 못했어요.</div>`; }
  /* ⏱ 1분마다 «진행 중»을 다시 칠하고, 날짜가 바뀌면 다음 날 것으로 새로 읽습니다 · 탭으로 돌아오면 새로 */
  if(!_clubTick){
    _clubTick = setInterval(()=>{
      if(!$I('w-club')) return;
      if(hwToday() !== _clubDay) loadClubWidget(); else paintClubToday();
    }, 60000);
    document.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState !== 'visible' || !$I('w-club')) return;
      if(hwToday() !== _clubDay || Date.now() - _clubLoadedAt > 5*60000) loadClubWidget(); else paintClubToday();
    });
  }
}
let CR = null;   // club-roster.js (처음 쓸 때 불러옵니다)

/* ── 📅 학사 D-Day 위젯 ── */
async function loadAcdday(){
  const box = $I('w-acdday'); if(!box) return;
  const orgs = attHomeOrgs();
  const ts = hwToday();
  try{
    /* (v-105) 학사일정은 startDate/endDate 로 저장된다 — 예전 «start» 칸으로 찾던 탓에 비어 보이던 것을 바로잡음.
       기간 안에서 요일을 고른 행사는 «다음에 열리는 날»로 센다 */
    const far = new Date(ts+'T00:00:00'); far.setDate(far.getDate()+120);
    const farS = ymdOf(far);
    const evs = await loadYearEvents();
    const nextOcc = e => {
      const d = new Date(((e.startDate > ts) ? e.startDate : ts)+'T00:00:00');
      const last = (e.endDate || e.startDate) < farS ? (e.endDate || e.startDate) : farS;
      for(let i=0; i<400; i++){ const x = ymdOf(d); if(x > last) return ''; if(evOnDay(e, x)) return x; d.setDate(d.getDate()+1); }
      return '';
    };
    const up = evs.filter(e=>evHitsOrg(e, orgs))
      .map(e=>({ t:e.title||'학사 행사', d:nextOcc(e) })).filter(e=>e.d)
      .sort((a,b)=>a.d.localeCompare(b.d) || a.t.localeCompare(b.t,'ko')).slice(0,3);
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

/* ── 📝 회의에서 맡은 일 (v-93) — 회의록 «임무» 담당이 되면 바로 뜬다 · 진행 전 → 진행 중 → 완료 ── */
let _mtgUn = [], _mtgT = [], _mtgN = [], _mtgUid = '';
const MST = { todo:{ i:'○', l:'진행 전' }, doing:{ i:'◐', l:'진행 중' }, done:{ i:'✓', l:'완료' } };
function mtgCss(){
  if(document.getElementById('hwm-css')) return;
  const s = document.createElement('style'); s.id = 'hwm-css';
  s.textContent = `
  .hwm{display:flex;align-items:center;gap:10px;background:var(--wh);border:1px solid var(--ivd);border-radius:12px;padding:9px 12px}
  .hwm:hover{border-color:var(--gm)}
  .hwm-ck{flex:none;width:30px;height:30px;border-radius:50%;border:1.5px solid var(--ivd);background:var(--wh);color:var(--tl);font-size:14px;font-weight:900;cursor:pointer;font-family:inherit}
  .hwm-ck.doing{border-color:#E9B65A;color:#B45309;background:#FEF3C7}
  .hwm-ck.done{border-color:var(--gm);color:#fff;background:var(--gm)}
  .hwm-t{flex:1;min-width:0;text-decoration:none;color:inherit}
  .hwm-t b{display:block;font-size:12.8px;font-weight:800;color:var(--gd);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .hwm-t span{display:block;font-size:10.8px;color:var(--tl);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .hwm-d{flex:none;font-size:10.8px;font-weight:900;color:var(--gm);background:var(--gp);border-radius:8px;padding:2px 8px;white-space:nowrap}
  .hwm-d.over{color:#DC2626;background:#FDE8E8}.hwm-d.soon{color:#B45309;background:#FEF3C7}
  .hwm.done{opacity:.55}.hwm.done .hwm-t b{text-decoration:line-through}
  .hwm-n{display:flex;gap:8px;align-items:center;font-size:11.8px;color:var(--ts);text-decoration:none;padding:3px 4px}
  .hwm-n b{color:var(--gd)}`;
  document.head.appendChild(s);
}
function mtgDue(due){
  if(!due) return null;
  const n = new Date(); const p = x => String(x).padStart(2,'0');
  const t = `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;
  const dd = Math.round((new Date(due+'T00:00:00') - new Date(t+'T00:00:00')) / 86400000);
  return { dd, l: `${Number(due.slice(5,7))}/${Number(due.slice(8,10))}까지${dd < 0 ? ` · ${-dd}일 지남` : dd === 0 ? ' · 오늘' : ` · D-${dd}`}` };
}
function paintMtg(){
  const box = $I('w-mtg'); if(!box) return;
  mtgCss();
  const recent = Date.now() - 2 * 86400000;
  const ms = v => v && v.seconds ? v.seconds * 1000 : 0;
  const rows = _mtgT.filter(t => (t.status || 'todo') !== 'done' || ms(t.doneAt) > recent)
    .sort((a, b) => ((a.status === 'done') - (b.status === 'done')) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || String(b.date).localeCompare(String(a.date)));
  const open = _mtgT.filter(t => (t.status || 'todo') !== 'done').length;
  const un = _mtgN.filter(n => !n.read && n.kind !== 'task');
  const cnt = $I('w-mtg-n'); if(cnt) cnt.textContent = open ? `${open}건` : '';
  const show = rows.slice(0, 6);
  let h = show.map(t => {
    const st = t.status || 'todo', d = mtgDue(t.due);
    const md = t.date ? `${Number(t.date.slice(5,7))}/${Number(t.date.slice(8,10))}` : '';
    const mates = (t.uids || []).filter(u => u !== _mtgUid).map(u => (t.names || {})[u] || '').filter(Boolean);
    return `<div class="hwm${st === 'done' ? ' done' : ''}">
      <button class="hwm-ck ${st}" onclick="hwMtgSt('${esc(t.id)}')" title="${MST[st].l} — 누르면 ${MST[st === 'todo' ? 'doing' : st === 'doing' ? 'done' : 'todo'].l}">${MST[st].i}</button>
      <a class="hwm-t" href="minutes.html?m=${encodeURIComponent(t.meetingId)}&k=${encodeURIComponent(t.id)}"><b>${esc(t.h || '')}</b>
        <span>${esc(md)} ${esc(t.mtitle || '')} · ${esc((t.topicNo ? t.topicNo + '. ' : '') + (t.topicTitle || ''))}${mates.length ? ' · 함께 ' + esc(mates.join(', ')) : ''}${t.cmt ? ' · 💬' + t.cmt : ''}</span></a>
      ${d && st !== 'done' ? `<span class="hwm-d${d.dd < 0 ? ' over' : d.dd <= 2 ? ' soon' : ''}">${esc(d.l)}</span>` : ''}</div>`;
  }).join('');
  if(!show.length) h = `<div class="hw-dim">회의에서 맡은 임무가 없어요 🎉</div>`;
  if(rows.length > show.length) h += `<a class="hwm-n" href="minutes.html?mine=1">… ${rows.length - show.length}건 더 · <b>모두 보기 ›</b></a>`;
  if(un.length) h += `<a class="hwm-n" href="minutes.html?mine=1">🔔 회의록 새 소식 <b>${un.length}</b> — ${esc(un[0].fromName || '')}: ${esc(String(un[0].text || '').slice(0, 40))} ›</a>`;
  box.innerHTML = h;
}
window.hwMtgSt = async (key) => {
  const t = _mtgT.find(x => x.id === key); if(!t) return;
  const nx = (t.status || 'todo') === 'todo' ? 'doing' : t.status === 'doing' ? 'done' : 'todo';
  const me = getCU() || {};
  try{
    await ctx.fs.updateDoc(doc(db, 'meetingTasks', key), { status: nx, updatedAt: Timestamp.now(),
      doneAt: nx === 'done' ? Timestamp.now() : null, doneByUid: nx === 'done' ? me.uid : '', doneByName: nx === 'done' ? (me.name || '') : '' });
    t.status = nx; if(nx === 'done') t.doneAt = Timestamp.now();
    paintMtg();
    try{ window.refreshBadges && refreshBadges(); }catch(e){}
  }catch(e){ alert('바꾸지 못했어요 — ' + (e.code || e.message)); }
};
function loadMtgWidget(){
  const box = $I('w-mtg'); if(!box) return;
  const cu = getCU(); if(!cu) return;
  if(_mtgUid === cu.uid && _mtgUn.length){ paintMtg(); return; }
  _mtgUn.forEach(u => { try{ u(); }catch(e){} }); _mtgUn = []; _mtgUid = cu.uid;
  try{
    _mtgUn.push(onSnapshot(query(collection(db, 'meetingTasks'), where('uids', 'array-contains', cu.uid)),
      s => { _mtgT = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => !t.deleted); paintMtg(); },
      e => { _mtgT = []; const b = $I('w-mtg'); if(b) b.innerHTML = `<div class="hw-dim">회의록 임무를 아직 불러올 수 없어요 (보안 규칙 v23 게시 후 보여요).</div>`; }));
    _mtgUn.push(onSnapshot(query(collection(db, 'mtgNotifs'), where('toUid', '==', cu.uid)),
      s => { _mtgN = s.docs.map(d => ({ id: d.id, ...d.data() })); paintMtg(); }, e => {}));
  }catch(e){ box.innerHTML = `<div class="hw-dim">회의록 임무를 불러오지 못했어요.</div>`; }
}

  window.loadAttendWidget = loadAttendWidget;
  window.loadClubWidget = loadClubWidget;
  window.loadAcdday = loadAcdday;
  window.loadMoneySums = loadMoneySums;
  window.loadMtgWidget = loadMtgWidget;
}
