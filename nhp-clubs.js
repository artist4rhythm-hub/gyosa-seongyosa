/* ═══════════════════════════════════════════════════════════
   🎨 nhp-clubs.js — 특별활동 칸의 «동아리 · 조이클래스» 줄을 동아리 확정 명단에서 가져오기 · v207
   · 지난 학기까지는 담임이 학생마다 «동아리 | 1학기 | * 주제 · * 선생님»을 손으로 썼음 → 이제 저절로
   · 어디서: 이 학기와 기간이 겹치는 «확정» 뒤(확정 · 운영중 · 정산 · 잠금) 동아리 학기의
       개설(clubApplications · 승인된 것 · 폐강 뺌) + 확정 명단(clubEnrollments · 취소 반영)
   · 줄 3가지
       club  동아리 참여           «동아리    | 2학기 | * 주제 : ○○ / * 선생님 : ○○»
       joy   조이클래스 참여       «조이클래스 | 2학기 | * 주제 : ○○ / * 선생님 : (연 학생)»
       host  조이클래스를 연 학생  «조이클래스 | 2학기 | * 주제 : ○○ / * 클래스 기획 및 진행»  (강사 이름이 학생 이름과 같을 때)
   · 참여 횟수 · 출석은 넣지 않음 — 했다 · 안 했다만
   · 저장: nhpEntries/<특별활동 칸>.rows.<학생>.cl.<줄> = «종류\n주제\n선생님\n학기» · 숨김 clx.<줄> · 담임이 고친 글 clm.<줄>
     (새 자리는 nhpEntries 안쪽뿐 — 보안 규칙은 그대로)
   ═══════════════════════════════════════════════════════════ */
import { rosterOf, instrOf } from './club-roster.js?v=205';
let A = null, C = null, FS = null;
const bind = a => { A = a; C = a.C; FS = a.FS; };
const OKST = ['confirmed', 'running', 'settling', 'locked'];
const one = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const CL = {};
export const ready = () => !!(A && A.TERM && CL[A.TERM.id] && CL[A.TERM.id].ok);
export const failed = () => !!(A && A.TERM && CL[A.TERM.id] && CL[A.TERM.id].err);
export const info = () => (A && A.TERM && CL[A.TERM.id]) || null;

/* 동아리 학기 · 개설 · 확정 명단 읽기 (학기 한 번 · 5분 동안 다시 읽지 않음) */
export async function load(a, fresh){
  bind(a);
  const id = A.TERM.id; const cur = CL[id];
  if(cur && cur.p && !fresh) return cur.p;
  if(cur && cur.ok && !fresh && Date.now() - cur.at < 300000) return cur;
  const T = CL[id] = { ok: false, err: false, at: Date.now(), sems: [], by: {}, amb: {} };
  T.p = (async () => {
    try{
      const ts = String(A.TERM.start || ''), te = String(A.TERM.end || '');
      const live = q => { if(q && q.metadata && q.metadata.fromCache) throw new Error('offline'); return q; };      // 끊긴 채 읽은 빈 명단으로 줄을 지우지 않게
      const ss = live(await FS.getDocs(FS.collection(A.db, 'clubSemesters')));
      const sems = []; ss.forEach(d => { const x = Object.assign({ id: d.id }, d.data());
        const f = String(x.rangeFrom || ''), t = String(x.rangeTo || x.rangeFrom || '');
        if(!(x.org === C.ORG && OKST.includes(x.status) && f && ts && te && f <= te && t >= ts)) return;
        const mid = new Date((new Date(f + 'T00:00:00').getTime() + new Date(t + 'T00:00:00').getTime()) / 2);      // 하루 이틀 걸친 옆 학기는 빼고 — 동아리 학기의 가운데 날이 이 학기 안일 때만
        const ms = `${mid.getFullYear()}-${String(mid.getMonth() + 1).padStart(2, '0')}-${String(mid.getDate()).padStart(2, '0')}`;
        if(ms >= ts && ms <= te) sems.push(x); });
      const names = {};                                          // 학생 이름 → 학생들 (조이클래스를 연 학생 찾기 · 명단에 학생 번호가 없을 때)
      Object.keys(A.STU || {}).forEach(sid => { const s = A.STU[sid]; if(s.deleted || (s.org && s.org !== C.ORG)) return; const n = one(s.name); if(n) (names[n] = names[n] || []).push(sid); });
      const d = C.termName(A.TERM) || '';
      const add = (sid, l) => { const L = (T.by[sid] = T.by[sid] || []); if(!L.some(x => x.key === l.key)) L.push(l); };
      for(const sm of sems){
        const [as, es] = (await Promise.all([
          FS.getDocs(FS.query(FS.collection(A.db, 'clubApplications'), FS.where('semId', '==', sm.id))),
          FS.getDocs(FS.query(FS.collection(A.db, 'clubEnrollments'), FS.where('semId', '==', sm.id)))])).map(live);
        const apps = []; as.forEach(x => { const c = Object.assign({ id: x.id }, x.data()); if(!c.deleted && !c.cancelled && c.status === 'approved' && /^[A-Za-z0-9_-]+$/.test(c.id)) apps.push(c); });
        const enr = []; es.forEach(x => enr.push(Object.assign({ id: x.id }, x.data())));
        apps.forEach(c => {
          const joy = c.type === 'joy'; const t = one(c.title); if(!t) return;
          const w = one(instrOf(c)).replace(/ · /g, ', ');
          const hosts = new Set();
          if(joy) one([c.instructorName, c.coInstructors].filter(Boolean).join(' ')).split(/[\s,·/&()]+/).forEach(tok => {
            const L = names[tok]; if(!L) return;
            L.forEach(sid => { if(L.length === 1) hosts.add(sid); add(sid, { key: 'h_' + c.id, k: 'host', t, w: '', d }); if(L.length > 1) (T.amb[sid] = T.amb[sid] || {})['h_' + c.id] = 1; }); });
          rosterOf(enr, c.id).forEach(e => {
            let sid = (e.id && A.STU[e.id]) ? e.id : '';
            if(!sid && !e.id){ const L = names[one(e.n)] || []; if(L.length === 1) sid = L[0]; }
            if(!sid || hosts.has(sid)) return;
            add(sid, { key: c.id, k: joy ? 'joy' : 'club', t, w, d });
          });
        });
      }
      T.sems = sems.map(x => one(x.name || x.title) || '동아리 학기');
      T.ok = true;
    }catch(e){ T.err = true; console.warn('동아리 읽기', e); }
    T.p = null; T.at = Date.now();
    return T;
  })();
  return T.p;
}
export const encode = l => [l.k, one(l.t), one(l.w), one(l.d)].join('\n');
export const wanted = sid => { const T = info(); return ((T && T.ok && T.by[sid]) || []); };
export const isAmb = (sid, key) => { const T = info(); return !!(T && T.amb[sid] && T.amb[sid][key]); };

/* 명단대로 맞추려면 — [{ path, v }] (v 가 undefined 면 그 자리를 지움)
   · 새 줄 · 이름이나 선생님이 바뀐 줄은 다시 씀 (담임이 고친 글 clm · 숨김 clx 는 그대로)
   · 명단에서 빠진 줄(취소 · 폐강)은 지움 — 겹치는 동아리 학기가 하나도 없을 때는 아무것도 지우지 않음 */
export const allOf = () => { const T = info(); return T && T.ok ? T : null; };
export function plan(sids, rows){
  const T = info(); const ops = [];
  if(!T || !T.ok) return ops;
  (sids || []).forEach(sid => {
    const r = (rows || {})[sid] || {}; const have = r.cl || {}; const want = T.by[sid] || [];
    want.forEach(l => { const v = encode(l); if(have[l.key] !== v) ops.push({ path: `rows.${sid}.cl.${l.key}`, v }); });
    if(!T.sems.length) return;
    Object.keys(have).forEach(key => { if(want.some(l => l.key === key)) return;
      ops.push({ path: `rows.${sid}.cl.${key}`, v: undefined }); });      // 고친 글(clm) · 숨김(clx)은 남겨 둠 — 줄이 돌아오면 그대로 살아남
  });
  return ops;
}
