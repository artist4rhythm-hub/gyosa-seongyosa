/* ═══════════════════════════════════════════════════════════════
   📡 학사일정 → 구글 캘린더 구독 함수 (academicIcs)
   ───────────────────────────────────────────────────────────────
   · 교사 선교사의 학사일정·쉬는 날을 표준 일정 파일(ICS)로 응답합니다.
   · 구글 클라우드 콘솔 > Cloud Run 함수 > 인라인 편집기에
     이 파일(index.js)과 package.json을 붙여넣어 배포합니다.
   · 주소 뒤에 붙이는 값:
       ?cal=all|daniel|jihyebit   (어느 캘린더인지 · 그 캘린더에 등록한 일정만 나온다)
       &aud=teacher|parent        (학부모용은 교사 전용 일정 제외 · 기본 teacher)
       &key=…                     (아래 KEY를 정했을 때만)
   ═══════════════════════════════════════════════════════════════ */

const KEY = '';   // 비워두면 주소를 아는 사람은 누구나 구독 가능.
                  // 예: 'da2026' 으로 정하면 주소마다 &key=da2026 을 붙여야 열립니다.

let db = null;
function getDb(){
  if(!db){
    const admin = require('firebase-admin');
    if(!admin.apps.length) admin.initializeApp();
    db = admin.firestore();
  }
  return db;
}

const CAT_LABEL = { event:'행사', program:'프로그램', break:'방학', exam:'시험',
                    worship:'예배·기도회', admin:'행정', closed:'휴교·휴일' };
const CAL_NAME  = { all:'DA 전체', daniel:'다니엘 아마츠', jihyebit:'지혜빛 선교원' };

function icsEsc(s){
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, m => '\\' + m);
}
function icsDate(d){ return String(d || '').replace(/-/g, ''); }
function nextDay(d){
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10).replace(/-/g, '');
}
function fold(line){   // 긴 줄 접기 (규격상 한 줄 75바이트 제한)
  const out = []; let s = line;
  while(s.length > 60){ out.push(s.slice(0, 60)); s = ' ' + s.slice(60); }
  out.push(s); return out.join('\r\n');
}

/* 🔁 (v-103) 기간 안에서 요일을 고른 일정 · 시각 일정 — 학사일정 달력과 같은 날·시각으로
   예전엔 모든 일정을 «시작~끝 긴 막대(종일)»로 내보내서, 월·금만 고른 일정도 기간 내내 보였습니다 */
const DOW_RR = ['SU','MO','TU','WE','TH','FR','SA'];
function addD(ds, n){ const t = new Date(ds + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function dowOf(ds){ return new Date(ds + 'T00:00:00Z').getUTCDay(); }
function hmOf(t){ const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? { h: +m[1], m: +m[2] } : null; }
const p2 = n => String(n).padStart(2, '0');
/* 그 행사가 놓이는 날 — 기간 안에서 고른 요일만 · «이날만 빼기»로 뺀 날은 빼고 */
function occOf(e){
  let wd = Array.isArray(e.weekdays) ? [...new Set(e.weekdays.map(Number).filter(n=> Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [];
  if(wd.length === 7) wd = [];
  const sk = new Set(Array.isArray(e.skipDates) ? e.skipDates.map(String) : []);
  const days = [];
  for(let d = e.startDate, i = 0; d <= e.endDate && i < 4000; d = addD(d, 1), i++)
    if((!wd.length || wd.includes(dowOf(d))) && !sk.has(d)) days.push(d);
  return { wd, days, sk };
}
function timedOf(e){
  const s = hmOf(e.startTime), t = hmOf(e.endTime);
  return (s && t && (t.h * 60 + t.m) > (s.h * 60 + s.m)) ? { s, t } : null;
}
const localDT = (ds, x) => icsDate(ds) + 'T' + p2(x.h) + p2(x.m) + '00';
/* 일정 하나의 날짜 줄들 — 한 건(종일 막대 · 하루 시각) 또는 반복(RRULE + 빠진 날 EXDATE) */
function whenLines(e){
  const o = occOf(e); if(!o.days.length) return null;
  const tm = timedOf(e), first = o.days[0], last = o.days[o.days.length - 1];
  const contiguous = o.days.length === Math.round((Date.parse(last + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z')) / 86400000) + 1;
  const L = [];
  if(tm){
    L.push('DTSTART;TZID=Asia/Seoul:' + localDT(first, tm.s), 'DTEND;TZID=Asia/Seoul:' + localDT(first, tm.t));
  } else {
    L.push('DTSTART;VALUE=DATE:' + icsDate(first), 'DTEND;VALUE=DATE:' + nextDay(o.days.length > 1 && contiguous ? last : first));
  }
  if(o.days.length === 1 || (!tm && contiguous)) return L;            // 한 건
  const rr = o.wd.length ? ['FREQ=WEEKLY', 'BYDAY=' + o.wd.map(i=> DOW_RR[i]).join(',')] : ['FREQ=DAILY'];
  rr.push('UNTIL=' + (tm ? icsDate(last) + 'T145959Z' : icsDate(last)));      // 시각 일정은 마지막 날 밤 23:59:59(한국)까지
  L.push('RRULE:' + rr.join(';'));
  const ex = [...o.sk].filter(d=> d > first && d < last && (!o.wd.length || o.wd.includes(dowOf(d)))).sort();
  if(ex.length) L.push(tm ? 'EXDATE;TZID=Asia/Seoul:' + ex.map(d=> localDT(d, tm.s)).join(',')
                          : 'EXDATE;VALUE=DATE:' + ex.map(icsDate).join(','));
  return L;
}

/* 행사 + 수동 휴일 → ICS 본문 */
function buildIcs(events, holidays, opt){
  const cal = opt.cal || 'all', aud = opt.aud || 'teacher';
  // 순수 분리 — 그 캘린더에 «넣기로 고른» 일정만 (복수 선택 orgs 지원, 옛 문서는 org 하나)
  const orgsOf = e => (Array.isArray(e.orgs) && e.orgs.length) ? e.orgs : [e.org || 'daniel'];
  const okOrg = o => o === cal;
  const okAud = a => aud === 'teacher' ? true : ((a || 'both') !== 'teacher');
  const L = [];
  L.push('BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//gyosa-seongyosa//academic//KR',
         'CALSCALE:GREGORIAN','METHOD:PUBLISH');
  L.push('X-GYOSA-VER:3-weekdays');     // ← 이 줄이 보이면 «요일 반복» 새 버전이 살아있는 것 (v-103)
  L.push(fold('X-WR-CALNAME:' + icsEsc((CAL_NAME[cal] || cal) + ' 학사일정' + (aud === 'parent' ? ' (학부모)' : ''))));
  L.push('X-WR-TIMEZONE:Asia/Seoul');
  L.push('BEGIN:VTIMEZONE','TZID:Asia/Seoul','BEGIN:STANDARD','DTSTART:19700101T000000',
         'TZOFFSETFROM:+0900','TZOFFSETTO:+0900','TZNAME:KST','END:STANDARD','END:VTIMEZONE');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  for(const e of events){
    if(!e.startDate || !e.endDate) continue;
    if(!orgsOf(e).includes(cal)) continue;
    if(!okAud(e.audience)) continue;
    const when = whenLines(e);
    if(!when) continue;                                   // 고른 요일이 기간 안에 하루도 없음 — 달력에도 안 보임
    L.push('BEGIN:VEVENT');
    L.push('UID:ev-' + e.id + '@daniel-amatz');
    L.push('DTSTAMP:' + stamp);
    when.forEach(x=> L.push(x));
    L.push(fold('SUMMARY:' + icsEsc(e.title + (e.subtitle ? ' — ' + e.subtitle : ''))));
    const desc = [CAT_LABEL[e.category] || '', aud === 'teacher' ? (e.memo || '') : '']
      .filter(Boolean).join(' · ');
    if(desc) L.push(fold('DESCRIPTION:' + icsEsc(desc)));
    L.push('END:VEVENT');
  }

  for(const h of holidays){
    if(h.src === 'academic') continue;   // 휴교 행사로 이미 들어감 — 중복 방지
    if(!h.date) continue;
    if(!okOrg(h.org || 'all')) continue;
    L.push('BEGIN:VEVENT');
    L.push('UID:hol-' + h.id + '@daniel-amatz');
    L.push('DTSTAMP:' + stamp);
    L.push('DTSTART;VALUE=DATE:' + icsDate(h.date));
    L.push('DTEND;VALUE=DATE:' + nextDay(h.date));
    L.push(fold('SUMMARY:' + icsEsc('🔴 ' + (h.name || '휴일'))));
    L.push('END:VEVENT');
  }

  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}

exports.academicIcs = async (req, res) => {
  try {
    if(KEY && (req.query.key || '') !== KEY){ res.status(403).send('key가 맞지 않습니다.'); return; }
    const cal = ['all','daniel','jihyebit'].includes(req.query.cal) ? req.query.cal : 'all';
    const aud = req.query.aud === 'parent' ? 'parent' : 'teacher';

    const d = getDb();
    const nowY = new Date().getFullYear();
    const evSnap = await d.collection('academicEvents').get();
    const events = [];
    evSnap.forEach(x => { const v = x.data(); if((v.year || 0) >= nowY - 1) events.push({ id: x.id, ...v }); });
    const hSnap = await d.collection('holidays').get();
    const holidays = []; hSnap.forEach(x => holidays.push({ id: x.id, ...x.data() }));

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');   // 10분 — 구독에도 충분하고 확인도 빠르다
    res.status(200).send(buildIcs(events, holidays, { cal, aud }));
  } catch(e){
    res.status(500).send('오류: ' + (e.message || ''));
  }
};

exports._buildIcs = buildIcs;   // 시험용
