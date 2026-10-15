/* 🧾 영수증 사진 다듬기 (v125) — 글자가 깨지지 않게
   ─────────────────────────────────────────────────────────────
   · 원본 사진에서 바로 자르고 돌린다
     (화면에 맞춰 크게 줄인 미리보기에서 자르면, 폰 화면 크기(400px 안팎)로 저장돼 글자가 뭉개진다)
   · 원본 전체 크기의 캔버스를 만들지 않는다
     (아이폰 사파리는 1,670만 화소가 넘는 캔버스를 그리지 못한다 — 2,400만 화소 사진이 흔하다)
   · 줄일 때는 고품질 보간 + 많이 줄일 때는 반씩 나눠 줄인다 (작은 글자의 획이 끊기지 않게)
   · 문서 한 개(1MB) 안에 들어가게 — 해상도를 먼저 지키고 품질은 0.74까지만 낮춘 뒤, 그다음 해상도를 낮춘다
   · 투명한 그림(PNG 캡처)은 흰 바탕 위에 (JPEG로 바꿀 때 검게 되지 않게)

   쓰는 곳: 수행성 경비 · 경비 지급 요청서 · 활동 경비 · 공사 경비
     encode(img, { rot, frac, cap })   — 이미 불러온 <img>에서 (rot: 0·90·180·270, frac: 돌린 뒤 기준 0~1 자를 칸)
     fromFile(file, { cap })            — 파일에서 바로
   돌려주는 값: 'data:image/jpeg;base64,…' (지금까지와 같은 모양 — 보기 · 인쇄 · PDF 코드는 그대로) */

export const CAP = 900 * 1024;                 // dataURL 글자 수 — Firestore 문서 1MB 안의 안전선 (영수증만 따로 담는 문서)
export const CAP_INDOC = 480 * 1024;           // 기록 문서 안에 함께 담는 곳 (활동 경비 · 공사 경비) — 목록을 열 때 모두 내려받으므로 가볍게
const MAX_SIDE = 4096;                          // 긴 변 상한
const MAX_PX = 6.0e6;                           // 저장 그림 화소 상한 (6백만)
const STEP_PX = 12e6;                           // 중간 단계 캔버스 상한 (아이폰 1,670만 아래)
const BUDGETS = [6.0e6, 4.6e6, 3.6e6, 2.8e6, 2.2e6, 1.7e6, 1.3e6, 1.0e6, 0.75e6];
const QUALS = [0.86, 0.8, 0.74];
const PREFIX = 'data:image/jpeg;base64,'.length;

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const free = c => { try{ if(c){ c.width = 0; c.height = 0; } }catch(e){} };   // 아이폰은 캔버스 메모리 총량도 작다 — 다 쓴 것은 바로 비운다
const hq = x => { if(!x) throw new Error('사진을 그릴 메모리가 모자라요 — 다른 앱을 닫고 다시 해 주세요'); x.imageSmoothingEnabled = true; try{ x.imageSmoothingQuality = 'high'; }catch(e){} return x; };
const tick = () => new Promise(r => setTimeout(r, 0));

export function loadImage(src){
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('이미지 형식을 열 수 없어요. HEIC 사진은 JPG로 올려 주세요.'));
    im.src = src;
  });
}

/* 돌린 뒤의 크기 */
export function rotatedSize(img, rot){
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const r = ((Number(rot) || 0) % 360 + 360) % 360;
  const swap = r === 90 || r === 270;
  return { iw, ih, r, W: swap ? ih : iw, H: swap ? iw : ih };
}

/* 원본(img)에서 R(돌린 뒤 좌표의 칸)을 s배로 바로 그린다 — 결과 캔버스 = R × s */
function blit(img, g, R, s){
  const c = mk(R.w * s, R.h * s), x = hq(c.getContext('2d'));
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.setTransform(c.width / R.w, 0, 0, c.height / R.h, -R.x * c.width / R.w, -R.y * c.height / R.h);
  x.translate(g.W / 2, g.H / 2);
  x.rotate(g.r * Math.PI / 180);
  x.drawImage(img, -g.iw / 2, -g.ih / 2, g.iw, g.ih);
  return c;
}

/* R을 화소 예산(px)에 맞춰 그린다 — 많이 줄여야 하면 반씩 나눠서 */
export function render(img, { rot = 0, frac = null, px = MAX_PX } = {}){
  const g = rotatedSize(img, rot);
  const R = region(g, frac);
  const s = Math.min(1, MAX_SIDE / Math.max(R.w, R.h), Math.sqrt(px / (R.w * R.h)));
  // 첫 단계 배율: 목표의 2ⁿ배 (원본보다 크지 않게 · 중간 캔버스가 너무 크지 않게)
  let m = s;
  while(m * 2 <= 1 && (R.w * m * 2) * (R.h * m * 2) <= STEP_PX) m *= 2;
  let c = blit(img, g, R, m);
  const tw = Math.max(1, Math.round(R.w * s)), th = Math.max(1, Math.round(R.h * s));
  while(c.width > tw || c.height > th){
    const nw = Math.max(tw, Math.round(c.width / 2)), nh = Math.max(th, Math.round(c.height / 2));
    const n = mk(nw, nh), x = hq(n.getContext('2d'));
    x.drawImage(c, 0, 0, nw, nh);
    free(c); c = n;
  }
  return c;
}

function region(g, frac){
  if(!frac) return { x: 0, y: 0, w: g.W, h: g.H };
  const cl = v => Math.max(0, Math.min(1, Number(v) || 0));
  const fx = cl(frac.x), fy = cl(frac.y);
  const fw = Math.max(1e-3, Math.min(1 - fx, Number(frac.w) || 1)), fh = Math.max(1e-3, Math.min(1 - fy, Number(frac.h) || 1));
  return { x: fx * g.W, y: fy * g.H, w: Math.max(1, fw * g.W), h: Math.max(1, fh * g.H) };
}

/* JPEG 한 번 — toBlob(그리는 동안 화면이 덜 멈춤)이 있으면 그것으로, 아니면 toDataURL · 실패하면 null (멈추지 않게) */
function jpeg(c, q){
  const viaUrl = () => { try{ const u = c.toDataURL('image/jpeg', q); return (u && u.startsWith('data:image/jpeg') && u.length > 1000) ? u : null; }catch(e){ return null; } };
  return new Promise(res => {
    let done = false; const fin = v => { if(!done){ done = true; res(v); } };
    try{
      if(c.toBlob){
        c.toBlob(b => { fin(b && b.size > 700 ? b : viaUrl()); }, 'image/jpeg', q);
        setTimeout(() => fin(viaUrl()), 20000);   // 콜백이 오지 않는 기기 대비
        return;
      }
    }catch(e){}
    fin(viaUrl());
  });
}
const lenOf = r => !r ? Infinity : typeof r === 'string' ? r.length : PREFIX + Math.ceil(r.size / 3) * 4;
const toUrl = r => {
  if(!r) return Promise.reject(new Error('사진을 만들지 못했어요'));
  if(typeof r === 'string') return Promise.resolve(r);
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const u = String(fr.result || ''); u.startsWith('data:image/jpeg') && u.length > 1000 ? res(u) : rej(new Error('사진을 만들지 못했어요')); };
    fr.onerror = () => rej(new Error('사진을 읽지 못했어요'));
    fr.readAsDataURL(r);
  });
};

/* 다듬기 — 해상도 먼저 · 품질은 0.74까지만 · 넘치면 해상도 한 단계씩 (마지막 안전망은 품질도 낮춤) */
export async function encode(img, { rot = 0, frac = null, cap = CAP } = {}){
  const g = rotatedSize(img, rot);
  if(!g.iw || !g.ih) throw new Error('이미지를 읽지 못했어요');
  const R = region(g, frac);
  const native = Math.min(R.w * R.h, MAX_PX, MAX_SIDE * MAX_SIDE);
  let list = BUDGETS.filter(b => b < native);
  list.unshift(native);
  let last = null;
  for(let i = 0; i < list.length; i++){
    const c = render(img, { rot, frac, px: list[i] });
    await tick();
    const pxNow = c.width * c.height;
    let first = 0;
    for(let k = 0; k < QUALS.length; k++){
      const r = await jpeg(c, QUALS[k]);
      const n = lenOf(r);
      if(!k) first = isFinite(n) ? n : cap * 4;
      if(n <= cap){ free(c); return toUrl(r); }
      if(r) last = r;
      if(!k && n > cap / 0.62) break;          // 품질을 낮춰도 못 맞출 만큼 크면 바로 다음 해상도로
    }
    free(c);
    // 다음 해상도는 크기 비율로 짐작해 건너뛴다 (인코딩 횟수를 줄이려고)
    const need = pxNow * (cap / Math.max(1, first)) * 1.5;
    while(i + 1 < list.length - 1 && list[i + 1] > need) i++;
  }
  // 마지막 안전망 — 작은 크기에서 품질을 더 낮춤
  const c = render(img, { rot, frac, px: BUDGETS[BUDGETS.length - 1] });
  for(const q of [0.68, 0.6, 0.5, 0.4]){
    const r = await jpeg(c, q);
    if(lenOf(r) <= cap){ free(c); return toUrl(r); }
    if(r) last = r;
  }
  free(c);
  return toUrl(last);
}

/* 파일에서 바로 (자르기 화면이 없는 곳 — 활동 경비 · 공사 경비) */
export async function fromFile(file, opt = {}){
  if(!file) throw new Error('사진이 없어요');
  let url = '';
  try{
    url = URL.createObjectURL(file);
    const img = await loadImage(url);
    return await encode(img, opt);
  } finally { if(url) try{ URL.revokeObjectURL(url); }catch(e){} }
}

/* ✨ 자동 여백 제거 도우미 — 어두운 탁자 위에 놓고 찍은 영수증이면 «밝은 종이»만 찾는다
   (예전 방식은 «밝지 않은 것 = 내용»이라, 바탕이 어두우면 사진 전체가 그대로 남았다)
   · 사진을 160칸 안팎의 격자로 줄여 밝기 평균 → 오츠 문턱값으로 «밝은 칸» 가르기
   · 가장자리가 문턱보다 어두워야 «탁자 위 영수증»으로 본다 (흰 바탕 스캔 · 캡처는 null → 화면의 예전 방식)
   · 가운데에서 가장 가까운 밝은 덩어리 하나만 (위쪽 밝은 벽 · 창문 · 다른 흰 물건에 끌려가지 않게)
   돌려주는 값: 캔버스 화소 기준 { x, y, w, h } 또는 null */
export function paperBox(data, w, h){
  if(!data || !w || !h) return null;
  const cs = Math.max(1, Math.ceil(Math.max(w, h) / 160));
  const gw = Math.ceil(w / cs), gh = Math.ceil(h / cs), sub = Math.max(1, Math.floor(cs / 3));
  const L = new Float32Array(gw * gh);
  for(let gy = 0; gy < gh; gy++) for(let gx = 0; gx < gw; gx++){
    let t = 0, n = 0;
    for(let y = gy * cs; y < Math.min(h, (gy + 1) * cs); y += sub) for(let x = gx * cs; x < Math.min(w, (gx + 1) * cs); x += sub){
      const i = (y * w + x) * 4; t += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; n++; }
    L[gy * gw + gx] = n ? t / n : 0;
  }
  // 오츠 문턱값
  const hist = new Array(256).fill(0); for(const v of L) hist[Math.min(255, Math.round(v))]++;
  const N = L.length; let sum = 0; for(let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = -1, T = 128;
  for(let t = 0; t < 256; t++){ wB += hist[t]; if(!wB) continue; const wF = N - wB; if(!wF) break; sB += t * hist[t];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if(v > best){ best = v; T = t; } }
  // 가장자리(바깥 4% · 적어도 한 칸)가 어두운가
  const bw = Math.max(1, Math.round(Math.min(gw, gh) * 0.04));
  let eb = 0, en = 0;
  for(let gy = 0; gy < gh; gy++) for(let gx = 0; gx < gw; gx++)
    if(gx < bw || gy < bw || gx >= gw - bw || gy >= gh - bw){ eb += L[gy * gw + gx]; en++; }
  if(!en || eb / en >= T - 12) return null;
  const B = i => L[i] > T;
  // 가운데에서 가장 가까운 밝은 칸 (가운데 둘레 30% 안)
  const cx = gw / 2, cy = gh / 2, rmax = Math.min(gw, gh) * 0.3;
  let seed = -1, sd = Infinity;
  for(let gy = 0; gy < gh; gy++) for(let gx = 0; gx < gw; gx++){
    const i = gy * gw + gx; if(!B(i)) continue;
    const d = Math.hypot(gx + .5 - cx, gy + .5 - cy); if(d < sd && d <= rmax){ sd = d; seed = i; } }
  if(seed < 0) return null;
  // 그 칸과 이어진 밝은 덩어리 (네 방향)
  const seen = new Uint8Array(N), q = [seed]; seen[seed] = 1;
  let x0 = gw, y0 = gh, x1 = -1, y1 = -1, cnt = 0;
  while(q.length){
    const i = q.pop(), gx = i % gw, gy = (i - gx) / gw; cnt++;
    if(gx < x0) x0 = gx; if(gx > x1) x1 = gx; if(gy < y0) y0 = gy; if(gy > y1) y1 = gy;
    for(const j of [gx > 0 ? i - 1 : -1, gx < gw - 1 ? i + 1 : -1, gy > 0 ? i - gw : -1, gy < gh - 1 ? i + gw : -1])
      if(j >= 0 && !seen[j] && B(j)){ seen[j] = 1; q.push(j); }
  }
  const area = (x1 - x0 + 1) * (y1 - y0 + 1);
  if(area < N * 0.04 || area > N * 0.97 || cnt < area * 0.35) return null;   // 너무 작거나 거의 전체 · 듬성듬성하면 믿지 않음
  const pad = Math.round(Math.min(w, h) * 0.012);
  const X0 = Math.max(0, x0 * cs - pad), Y0 = Math.max(0, y0 * cs - pad);
  const X1 = Math.min(w, (x1 + 1) * cs + pad), Y1 = Math.min(h, (y1 + 1) * cs + pad);
  return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
}

/* 자르기 화면 미리보기를 또렷하게 — 고해상도 화면(레티나)에서는 화소를 화면 배율만큼 */
export function previewRatio(cssW, srcW){
  const d = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
  return Math.max(1, Math.min(d, srcW / Math.max(1, cssW)));
}
