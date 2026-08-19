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

/* 행사 + 수동 휴일 → ICS 본문 */
function buildIcs(events, holidays, opt){
  const cal = opt.cal || 'all', aud = opt.aud || 'teacher';
  const okOrg = o => o === cal;   // 순수 분리 — 그 캘린더에 등록한 일정만 (섞지 않는다)
  const okAud = a => aud === 'teacher' ? true : ((a || 'both') !== 'teacher');
  const L = [];
  L.push('BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//gyosa-seongyosa//academic//KR',
         'CALSCALE:GREGORIAN','METHOD:PUBLISH');
  L.push('X-GYOSA-VER:2-pure-split');   // ← 이 줄이 보이면 «순수 분리» 새 버전이 살아있는 것
  L.push(fold('X-WR-CALNAME:' + icsEsc((CAL_NAME[cal] || cal) + ' 학사일정' + (aud === 'parent' ? ' (학부모)' : ''))));
  L.push('X-WR-TIMEZONE:Asia/Seoul');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  for(const e of events){
    if(!e.startDate || !e.endDate) continue;
    if(!okOrg(e.org || 'daniel')) continue;
    if(!okAud(e.audience)) continue;
    L.push('BEGIN:VEVENT');
    L.push('UID:ev-' + e.id + '@daniel-amatz');
    L.push('DTSTAMP:' + stamp);
    L.push('DTSTART;VALUE=DATE:' + icsDate(e.startDate));
    L.push('DTEND;VALUE=DATE:' + nextDay(e.endDate));     // 종료 다음 날 (규격)
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
