/* ═══════════════════════════════════════════════
   migrate.js — 🔒📉 v120 자료 정리 (수퍼관리자가 홈을 열면 저절로 · 딱 한 번)

   보안 규칙 v28 은 «관계된 사람만 읽기»를 문서 안의 칸으로 판단합니다.
   새로 만드는 문서에는 v120 화면이 그 칸을 넣지만, 예전 문서에는 없으므로 여기서 채웁니다.
     · 쪽지          unread  = 받는 사람 중 아직 안 읽은 사람
     · 전자결재      uids    = 기안자 + 결재선 / turnUid = 지금 결재할 사람
     · 지급 요청서   uids    = 신청자 + 결재선 + 공유 + 하이패스 열람 / turnUid = 지금 결재할 사람
   결과는 systemConfig/migrate120 에 남습니다 (관리자 › 시스템에서 확인).
   ⚠ 규칙 v28을 게시하기 «전에» 한 번 돌아야 쪽지까지 모두 정리됩니다.
     (먼저 게시했어도 괜찮습니다 — 쪽지는 받는 사람이 화면을 열 때 스스로 채웁니다)
   ═══════════════════════════════════════════════ */
import { collection, getDocs, doc, getDoc, setDoc, writeBatch, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const uniq = a => [...new Set(a.filter(Boolean))];
const apvUids = d => uniq([d.drafterUid, ...(d.line || []).map(s => s && s.uid)]);
const apvTurn = d => d.status === 'progress' ? (((d.line || [])[d.currentStep] || {}).uid || '') : '';
const prUids = r => uniq([r.createdByUid, r.origByUid, ...(r.chain || []).map(c => c && c.uid), ...(r.sharedWith || []), ...(r.hipassViewers || []).map(v => v && v.uid)]);
const prTurn = r => r.status === 'approving' ? (((r.chain || [])[r.chainIndex] || {}).uid || '') : '';
const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && b.every(x => a.includes(x));

async function commit(db, items){
  let n = 0;
  for(let i = 0; i < items.length; i += 400){
    const bt = writeBatch(db);
    items.slice(i, i + 400).forEach(([ref, patch]) => bt.update(ref, patch));
    await bt.commit();
    n += Math.min(400, items.length - i);
  }
  return n;
}

export async function runMigrate120(db, CU, toast){
  if(!CU || CU.role !== 'super') return null;
  const ref = doc(db, 'systemConfig', 'migrate120');
  try { const s = await getDoc(ref); if(s.exists() && s.data().done) return s.data(); } catch(e){ return null; }
  const say = (m, t) => { try { toast && toast(m, t); } catch(_){} };
  say('🧹 v120 자료 정리 중… (처음 한 번만 · 잠시만요)');
  const out = { messages: 0, approvals: 0, payRequests: 0, notes: [] };
  let hardFail = false;

  // ① 쪽지 — 안 읽은 사람 표시
  try {
    const snap = await getDocs(collection(db, 'messages'));
    const items = [];
    snap.forEach(d => { const m = d.data(); if(!Array.isArray(m.unread)) items.push([d.ref, { unread: (m.toUids || []).filter(u => !(m.readBy || []).includes(u)) }]); });
    out.messages = await commit(db, items);
  } catch(e){
    // 규칙 v28을 먼저 게시하면 수퍼관리자도 남의 쪽지를 못 읽는다 → 받는 사람이 스스로 채운다
    out.notes.push('쪽지: ' + (e.code === 'permission-denied' ? '규칙 v28이 이미 게시됨 — 받는 사람이 화면을 열 때 스스로 채움' : (e.message || e.code)));
    if(e.code !== 'permission-denied') hardFail = true;
  }
  // ② 전자결재
  try {
    const snap = await getDocs(collection(db, 'approvals'));
    const items = [];
    snap.forEach(d => { const a = d.data(), u = apvUids(a), t = apvTurn(a);
      if(!sameSet(a.uids, u) || (a.turnUid ?? null) !== t) items.push([d.ref, { uids: u, turnUid: t }]); });
    out.approvals = await commit(db, items);
  } catch(e){ out.notes.push('결재: ' + (e.message || e.code)); hardFail = true; }
  // ③ 경비 지급 요청서
  try {
    const snap = await getDocs(collection(db, 'payRequests'));
    const all = {}; snap.forEach(d => { all[d.id] = d.data(); });
    const items = [];
    snap.forEach(d => { const r = Object.assign({}, d.data());
      if(r.correctionOf && !r.origByUid && all[r.correctionOf] && all[r.correctionOf].createdByUid) r.origByUid = all[r.correctionOf].createdByUid;
      const u = prUids(r), t = prTurn(r);
      if(!sameSet(r.uids, u) || (r.turnUid ?? null) !== t) items.push([d.ref, Object.assign({ uids: u, turnUid: t }, r.origByUid && !d.data().origByUid ? { origByUid: r.origByUid } : {})]); });
    out.payRequests = await commit(db, items);
  } catch(e){ out.notes.push('지급 요청서: ' + (e.message || e.code)); hardFail = true; }

  const rec = Object.assign({ done: !hardFail, at: Timestamp.now(), byUid: CU.uid, byName: CU.name || '' }, out);
  try { await setDoc(ref, rec); } catch(e){}
  if(hardFail) say('⚠️ 자료 정리 중 일부가 멈췄어요 — 다음에 홈을 열면 이어서 합니다', 'err');
  else say(`✅ v120 자료 정리 끝 — 쪽지 ${out.messages} · 결재 ${out.approvals} · 지급 요청서 ${out.payRequests}건`, 'ok');
  return rec;
}
