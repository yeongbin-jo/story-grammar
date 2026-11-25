/* M.art — 영상 트랙 공용 일러스트 키트 (캔버스 2D, 에디토리얼 플랫 일러스트)
   person / head / prop / backdrop / frame / clip / waveform
   - 인물·소품·배경은 사진 속 사물처럼 고정 색, 외곽선·라벨만 토큰(c.ink 등).
   - 모든 함수는 save/restore 로 상태를 남기지 않는다. */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  /* ---------- 색 ---------- */
  const RGB = new Map();
  const rgb = (h) => {
    let v = RGB.get(h);
    if (!v) {
      const s = h.replace("#", ""), n = parseInt(s.length === 3 ? s.split("").map((q) => q + q).join("") : s, 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(h, v);
    }
    return v;
  };
  const MIX = new Map();
  const mix = (a, b, t) => {
    const k = a + b + t; let v = MIX.get(k);
    if (!v) { const p = rgb(a), q = rgb(b); v = `rgb(${Math.round(lerp(p[0], q[0], t))},${Math.round(lerp(p[1], q[1], t))},${Math.round(lerp(p[2], q[2], t))})`; MIX.set(k, v); }
    return v;
  };
  const rgba = (h, a) => { const p = rgb(h); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
  const isDark = () => {
    const bg = M.col().bg || "#ffffff";
    if (bg[0] !== "#") return false;
    const p = rgb(bg); return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255 < 0.4;
  };
  const FEAT = "#2a1d18";          // 눈·입 (피부 위라 다크 모드에서도 어두운 색)
  const SHADE = "#2c1f3a";         // 셀 음영(차가운 보라 갈색)
  const RIM = "#fff6e4";

  /* 인물 팔레트 — A: 짧은 갈색 머리, 세이지 셔츠, 네이비 바지 / B: 적갈색 단발, 테라코타 상의, 차콜 바지 */
  const PAL = {
    A: { skin: "#c98d66", hair: "#33251f", brow: "#2b1f1a", top: "#8fac90", topLine: "#6f8f72", bottom: "#3a4763", shoe: "#3b2f29", sole: "#e8e0d2", lip: "#a65f50" },
    B: { skin: "#efc6a5", hair: "#8e4b2d", brow: "#5b2f1d", top: "#cf7b5d", topLine: "#b1614a", bottom: "#4b4647", shoe: "#efe8dc", sole: "#cfc6b8", lip: "#c0675d" },
  };
  const BODY = {
    A: { sh: 10.6, chest: 9.7, waist: 8.0, hip: 8.6, shJ: 8.0, bust: 0.4 },
    B: { sh: 9.4, chest: 8.7, waist: 6.9, hip: 8.9, shJ: 7.1, bust: 1.1 },
  };
  const YAW = { front: 0, "three-quarter-right": 45, "profile-right": 90, back: 180, "three-quarter-left": -45, "profile-left": -90 };

  /* 표정 파라미터 */
  const EXPR = {
    neutral: { by: 0, tilt: 0, eye: "dot", curve: 0.12, open: 0, mw: 1.35 },
    smile: { by: -0.15, tilt: -0.1, eye: "happy", curve: 0.8, open: 0.42, mw: 2.2, blush: 1 },
    sad: { by: 0.15, tilt: 0.65, eye: "sad", curve: -0.55, open: 0, mw: 1.2 },
    surprised: { by: -0.75, tilt: 0.1, eye: "wide", curve: 0, open: 1, mw: 0.85, oh: true },
    worried: { by: -0.2, tilt: 0.75, eye: "dot", curve: -0.2, open: 0, mw: 1.35, wavy: true, look: 0.35 },
    talk: { by: -0.12, tilt: 0, eye: "dot", curve: 0.25, open: 0.55, mw: 1.35 },
  };

  /* ---------- 경로 도우미 ---------- */
  const P2 = (fn) => { const p = new Path2D(); fn(p); return p; };
  /* Catmull-Rom 을 베지어로: 현재점이 pts[0] 이라고 가정 */
  const crTo = (P, pts) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      P.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  };
  /* 굵기가 변하는 팔다리: 꺾인 선(pts) + 반지름(rs) → 둥근 끝 외곽 */
  const limb = (pts, rs) => {
    const n = pts.length, N = [];
    const segN = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-6; return [-dy / l, dx / l]; };
    for (let i = 0; i < n; i++) {
      if (i === 0) N.push(segN(pts[0], pts[1]));
      else if (i === n - 1) N.push(segN(pts[n - 2], pts[n - 1]));
      else {
        const a = segN(pts[i - 1], pts[i]), b = segN(pts[i], pts[i + 1]);
        let m = [a[0] + b[0], a[1] + b[1]]; const l = Math.hypot(m[0], m[1]);
        if (l < 1e-3) m = a; else m = [m[0] / l, m[1] / l];
        const k = 1 / Math.max(0.55, m[0] * a[0] + m[1] * a[1]);
        N.push([m[0] * k, m[1] * k]);
      }
    }
    const P = new Path2D();
    P.moveTo(pts[0][0] + N[0][0] * rs[0], pts[0][1] + N[0][1] * rs[0]);
    for (let i = 1; i < n; i++) P.lineTo(pts[i][0] + N[i][0] * rs[i], pts[i][1] + N[i][1] * rs[i]);
    const ae = Math.atan2(N[n - 1][1], N[n - 1][0]);
    P.arc(pts[n - 1][0], pts[n - 1][1], rs[n - 1], ae, ae - Math.PI, true);
    for (let i = n - 2; i >= 0; i--) P.lineTo(pts[i][0] - N[i][0] * rs[i], pts[i][1] - N[i][1] * rs[i]);
    const a0 = Math.atan2(N[0][1], N[0][0]);
    P.arc(pts[0][0], pts[0][1], rs[0], a0 + Math.PI, a0, true);
    P.closePath();
    return P;
  };
  /* 소매: 어깨는 둥글게, 소맷단은 평평하게 */
  const sleeve = (a, b, r0, r1) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l], an = Math.atan2(n[1], n[0]);
    return P2((P) => {
      P.moveTo(a[0] + n[0] * r0, a[1] + n[1] * r0);
      P.lineTo(b[0] + n[0] * r1 - (dx / l) * 0.2, b[1] + n[1] * r1 - (dy / l) * 0.2);
      P.lineTo(b[0] - n[0] * r1 + (dx / l) * 0.2, b[1] - n[1] * r1 + (dy / l) * 0.2);
      P.lineTo(a[0] - n[0] * r0, a[1] - n[1] * r0);
      P.arc(a[0], a[1], r0, an + Math.PI, an, true);
      P.closePath();
    });
  };
  const ellP = (cx, cy, rx, ry, rot = 0) => P2((p) => p.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU));

  /* ---------- 빛·셀 음영 ---------- */
  /* light 옵션을 내부 형태로. custom=false 면 은은한 기본 음영 */
  function lightOf(L) {
    if (!L) return { custom: false, lx: -0.6, ly: -0.8, mag: 0.7, lit: 0, shad: 0.17, rim: 0, warm: 0, soft: 0 };
    const dx = L.dx ?? -0.6, dy = L.dy ?? -0.45, mag = clamp(Math.hypot(dx, dy), 0, 1);
    const l = Math.hypot(dx, dy) || 1, lx = mag < 0.02 ? 0 : dx / l, ly = mag < 0.02 ? -1 : dy / l;
    const key = clamp(L.key ?? 1, 0, 1.5), fill = clamp(L.fill ?? 0.35, 0, 1.5);
    const lit = clamp(1 - (0.1 + key * 0.9 + fill * 0.15), 0, 0.92) * 0.9;
    const shad = clamp(1 - (0.1 + fill * 0.85 + key * (1 - mag) * 0.7), 0, 0.95) * 0.88;
    return { custom: true, lx, ly, mag, lit, shad: Math.max(shad, lit), rim: clamp(L.rim ?? 0, 0, 1.5), warm: clamp(L.warm ?? 0, -1, 1), soft: clamp(L.soft ?? 0, 0, 1) };
  }
  const shiftD = (Lt, size) => size * (Lt.custom ? 0.06 + 0.4 * Lt.mag : 0.26);
  const DEEP = "#1d1519";
  const outside = (P, tx, ty) => { const q = new Path2D(); q.rect(-1e5, -1e5, 2e5, 2e5); q.addPath(P, new DOMMatrix([1, 0, 0, 1, tx, ty])); return q; };
  /* P 안을 Lt 에 맞춰 칠함: 난색/한색 틴트 → 전체 감광 → 광원 반대쪽 셀 그림자 → 림 */
  function shade(x, P, size, Lt) {
    x.save(); x.clip(P);
    if (Lt.warm) { x.fillStyle = Lt.warm > 0 ? `rgba(255,150,60,${0.22 * Lt.warm})` : `rgba(90,140,255,${-0.2 * Lt.warm})`; x.fill(P); }
    const SC = Lt.custom ? DEEP : SHADE;
    if (Lt.lit > 0.004) { x.fillStyle = rgba(SC, Lt.lit); x.fill(P); }
    const d = shiftD(Lt, size);
    if (Lt.shad > 0.004 && d > 0) {
      const A = Lt.lit > 0 ? 1 - (1 - Lt.shad) / (1 - Lt.lit) : Lt.shad;
      const n = Lt.soft > 0.05 ? 6 : 1, a = 1 - Math.pow(1 - A, 1 / n);
      for (let k = 0; k < n; k++) {
        const dk = n === 1 ? d : d * (1 - Lt.soft * 0.55 + (Lt.soft * 1.1 * k) / (n - 1));
        x.save(); x.clip(outside(P, Lt.lx * dk, Lt.ly * dk), "evenodd");
        x.fillStyle = rgba(SC, a); x.fill(P); x.restore();
      }
    }
    x.restore();
  }
  /* 림 라이트: 인물 전체 실루엣(합집합)의 가장자리에만 띠를 그림 — 오프스크린 한 장 재사용 */
  /* 일러스트(사진 속 사물) 외곽선은 테마와 상관없이 진한 잉크 */
  const ART_INK = "#221e1a";
  let SINK = null, SINKM = null, OFF = null;
  function rimPass(x, sil, w, Lt) {
    const cv = x.canvas;
    if (!OFF) OFF = document.createElement("canvas");
    if (OFF.width !== cv.width || OFF.height !== cv.height) { OFF.width = cv.width; OFF.height = cv.height; }
    const o = OFF.getContext("2d"), T = x.getTransform();
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (const [px, py] of [[-60, -112], [60, -112], [-60, 8], [60, 8]]) { const q = T.transformPoint({ x: px, y: py }); bx0 = Math.min(bx0, q.x); by0 = Math.min(by0, q.y); bx1 = Math.max(bx1, q.x); by1 = Math.max(by1, q.y); }
    bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0)); bx1 = Math.min(OFF.width, Math.ceil(bx1)); by1 = Math.min(OFF.height, Math.ceil(by1));
    const bw = bx1 - bx0, bh = by1 - by0; if (bw <= 0 || bh <= 0) return;
    for (const sd of [-1, 1]) {
      const strong = Lt.lx === 0 || !Lt.custom ? 0.85 : (sd === -Math.sign(Lt.lx) ? 1 : 0.6);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = "source-over"; o.clearRect(bx0, by0, bw, bh);
      const fillAll = (dx, dy) => { for (const [P, m] of sil) { o.setTransform(T); o.translate(dx, dy); if (m) o.transform(m.a, m.b, m.c, m.d, m.e, m.f); o.fill(P); } };
      o.fillStyle = "#fff"; fillAll(0, 0);
      o.globalCompositeOperation = "destination-out"; fillAll(-sd * w, w * 0.5);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = "source-in";
      o.fillStyle = rgba(RIM, Math.min(0.95, 0.85 * Lt.rim * strong)); o.fillRect(bx0, by0, bw, bh);
      x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(OFF, bx0, by0, bw, bh, bx0, by0, bw, bh); x.restore();
    }
  }
  function part(x, P, fill, size, Lt, lw, ink) {
    if (SINK) SINK.push([P, SINKM]);
    x.fillStyle = fill; x.fill(P);
    if (Lt) shade(x, P, size, Lt);
    if (lw) { x.lineWidth = lw; x.strokeStyle = ink; x.stroke(P); }
  }

  /* ---------- 머리·헤어 경로 (머리 중심 기준, 오른쪽을 보는 기준, 높이 약 13) ---------- */
  const HEAD = {}, HAIR = {};
  function headPath(v) {
    if (HEAD[v]) return HEAD[v];
    const p = new Path2D();
    if (v === "front" || v === "back") {
      p.moveTo(0, -6.6);
      p.bezierCurveTo(3.3, -6.6, 5.1, -4.4, 5.1, -1.0);
      p.bezierCurveTo(5.1, 1.7, 4.6, 3.7, 3.2, 5.1);
      p.bezierCurveTo(2.2, 6.0, 1.2, 6.4, 0, 6.4);
      p.bezierCurveTo(-1.2, 6.4, -2.2, 6.0, -3.2, 5.1);
      p.bezierCurveTo(-4.6, 3.7, -5.1, 1.7, -5.1, -1.0);
      p.bezierCurveTo(-5.1, -4.4, -3.3, -6.6, 0, -6.6);
    } else if (v === "3q") {
      p.moveTo(-0.5, -6.6);
      p.bezierCurveTo(2.6, -6.7, 4.7, -4.8, 4.9, -1.9);
      p.bezierCurveTo(5.05, -0.7, 4.75, 0.4, 4.85, 1.3);
      p.bezierCurveTo(4.75, 3.4, 3.9, 5.2, 2.6, 6.1);
      p.bezierCurveTo(1.8, 6.6, 0.6, 6.5, -0.4, 6.0);
      p.bezierCurveTo(-2.2, 5.2, -3.6, 4.2, -4.3, 2.6);
      p.bezierCurveTo(-5.6, 1.0, -5.8, -2.4, -5.1, -4.0);
      p.bezierCurveTo(-4.2, -6.0, -2.6, -6.6, -0.5, -6.6);
    } else { // profile
      p.moveTo(-0.6, -6.6);
      p.bezierCurveTo(2.6, -6.7, 4.6, -5.0, 4.8, -2.4);
      p.bezierCurveTo(4.85, -1.5, 4.95, -1.0, 5.2, -0.6);
      p.bezierCurveTo(5.6, 0.2, 6.25, 1.15, 6.35, 1.7);
      p.bezierCurveTo(6.4, 2.1, 5.9, 2.3, 5.4, 2.3);
      p.bezierCurveTo(5.5, 2.75, 5.6, 3.05, 5.4, 3.3);
      p.bezierCurveTo(5.55, 3.6, 5.5, 3.95, 5.25, 4.2);
      p.bezierCurveTo(5.0, 4.55, 5.0, 4.8, 5.2, 5.3);
      p.bezierCurveTo(5.2, 6.1, 4.2, 6.5, 3.0, 6.4);
      p.bezierCurveTo(1.8, 6.3, 0.4, 5.6, -0.4, 4.6);
      p.bezierCurveTo(-2.4, 4.6, -4.4, 4.0, -5.3, 2.0);
      p.bezierCurveTo(-6.2, 0, -6.1, -3.6, -4.4, -5.4);
      p.bezierCurveTo(-3.2, -6.4, -2.0, -6.6, -0.6, -6.6);
    }
    p.closePath();
    return (HEAD[v] = p);
  }
  /* {back: 머리 뒤 레이어, front: 머리 위 레이어, strands: 결 선} */
  function hairPaths(who, v) {
    const k = who + v;
    if (HAIR[k]) return HAIR[k];
    const H = { back: null, front: new Path2D(), strands: new Path2D() }, f = H.front, s = H.strands;
    if (who === "A") {
      if (v === "front") {
        f.moveTo(-5.35, -0.6);
        f.bezierCurveTo(-6.1, -5.2, -3.6, -7.9, 0.2, -7.8);
        f.bezierCurveTo(4.0, -7.8, 6.2, -5.2, 5.4, -0.6);
        f.lineTo(4.85, -1.1);
        f.bezierCurveTo(4.7, -3.2, 3.4, -4.6, 1.0, -4.5);
        f.bezierCurveTo(-1.0, -4.4, -2.0, -3.1, -3.7, -3.6);
        f.bezierCurveTo(-4.4, -3.3, -4.8, -2.2, -4.85, -1.1);
        f.closePath();
        s.moveTo(-1.6, -7.2); s.bezierCurveTo(-0.2, -6.0, 1.6, -5.4, 3.6, -5.3);
        s.moveTo(-3.6, -6.1); s.bezierCurveTo(-2.6, -4.9, -1.2, -4.3, 0.2, -4.4);
      } else if (v === "3q") {
        f.moveTo(-4.6, 1.9);
        f.bezierCurveTo(-6.5, -0.6, -6.6, -5.4, -2.9, -7.3);
        f.bezierCurveTo(0.4, -8.6, 4.8, -7.5, 5.45, -3.6);
        f.bezierCurveTo(5.55, -2.6, 5.2, -2.1, 4.9, -2.3);
        f.bezierCurveTo(4.5, -3.7, 3.3, -4.6, 1.3, -4.3);
        f.bezierCurveTo(0.0, -4.1, -0.9, -3.0, -1.1, -1.1);
        f.lineTo(-1.35, 0.5); f.lineTo(-1.8, 0.4);
        f.bezierCurveTo(-2.2, -0.3, -3.3, -0.4, -3.6, 0.8);
        f.bezierCurveTo(-3.7, 1.3, -4.0, 1.7, -4.6, 1.9);
        f.closePath();
        s.moveTo(-3.6, -6.0); s.bezierCurveTo(-1.6, -6.6, 1.4, -6.4, 3.8, -5.0);
        s.moveTo(-4.8, -3.6); s.bezierCurveTo(-3.6, -3.9, -2.4, -3.6, -1.6, -2.6);
      } else if (v === "profile") {
        f.moveTo(-5.0, 2.0);
        f.bezierCurveTo(-6.7, -0.4, -6.9, -5.0, -3.3, -7.1);
        f.bezierCurveTo(0, -8.6, 4.6, -7.7, 5.3, -3.8);
        f.bezierCurveTo(5.4, -3.0, 5.0, -2.6, 4.6, -2.9);
        f.bezierCurveTo(4.1, -4.2, 2.6, -4.8, 1.3, -4.4);
        f.bezierCurveTo(0.6, -3.6, 0.5, -1.6, 0.35, 0.1);
        f.lineTo(-0.1, 0.2);
        f.bezierCurveTo(-0.9, -0.9, -2.6, -0.7, -2.6, 0.9);
        f.bezierCurveTo(-2.6, 1.7, -3.6, 1.95, -5.0, 2.0);
        f.closePath();
        s.moveTo(-4.4, -5.6); s.bezierCurveTo(-2.0, -6.8, 1.6, -6.8, 4.0, -5.0);
        s.moveTo(-5.4, -2.4); s.bezierCurveTo(-4.2, -3.2, -2.8, -3.0, -1.8, -2.0);
      } else { // back
        f.moveTo(-5.4, 0.2);
        f.bezierCurveTo(-5.9, -5.0, -3.6, -7.8, 0, -7.8);
        f.bezierCurveTo(3.6, -7.8, 5.9, -5.0, 5.4, 0.2);
        f.bezierCurveTo(5.3, 2.4, 4.6, 4.2, 3.0, 5.2);
        f.bezierCurveTo(1.4, 4.7, -1.4, 4.7, -3.0, 5.2);
        f.bezierCurveTo(-4.6, 4.2, -5.3, 2.4, -5.4, 0.2);
        f.closePath();
        s.moveTo(0.4, -7.6); s.bezierCurveTo(-1.4, -5.0, -1.6, -2.0, -0.8, 1.0);
        s.moveTo(2.6, -6.8); s.bezierCurveTo(1.6, -4.4, 1.8, -1.6, 2.4, 1.2);
      }
    } else {
      if (v === "front") {
        H.back = P2((b) => {
          b.moveTo(0, -7.0);
          b.bezierCurveTo(4.4, -7.0, 6.2, -4.6, 6.1, -0.6);
          b.bezierCurveTo(6.0, 2.4, 6.2, 4.4, 5.9, 5.6);
          b.lineTo(-5.9, 5.6);
          b.bezierCurveTo(-6.2, 4.4, -6.0, 2.4, -6.1, -0.6);
          b.bezierCurveTo(-6.2, -4.6, -4.4, -7.0, 0, -7.0);
          b.closePath();
        });
        f.moveTo(-6.45, 5.6);
        f.bezierCurveTo(-7.1, 0.4, -6.9, -7.7, 0, -7.7);
        f.bezierCurveTo(6.9, -7.7, 7.1, 0.4, 6.45, 5.6);
        f.bezierCurveTo(6.0, 5.9, 5.5, 5.9, 5.2, 5.6);
        f.bezierCurveTo(5.1, 2.4, 5.1, -0.4, 4.4, -2.0);
        f.bezierCurveTo(3.4, -2.6, 1.8, -2.2, 0.6, -2.9);
        f.bezierCurveTo(-0.4, -2.0, -2.6, -1.9, -4.4, -2.0);
        f.bezierCurveTo(-5.1, -0.4, -5.1, 2.4, -5.2, 5.6);
        f.bezierCurveTo(-5.5, 5.9, -6.0, 5.9, -6.45, 5.6);
        f.closePath();
        s.moveTo(0.6, -7.4); s.bezierCurveTo(-0.6, -5.6, -0.4, -4.0, 0.6, -2.9);
        s.moveTo(-3.4, -6.2); s.bezierCurveTo(-5.6, -3.4, -5.9, 1.0, -5.8, 5.0);
        s.moveTo(3.6, -6.2); s.bezierCurveTo(5.6, -3.4, 5.9, 1.0, 5.8, 5.0);
      } else if (v === "3q") {
        f.moveTo(-5.9, 5.4);
        f.bezierCurveTo(-7.3, 1.4, -7.0, -6.4, -1.6, -7.7);
        f.bezierCurveTo(2.6, -8.5, 5.7, -6.0, 5.65, -2.6);
        f.bezierCurveTo(5.5, -1.8, 5.1, -1.4, 4.75, -1.3);
        f.bezierCurveTo(4.2, -2.3, 3.2, -2.6, 2.0, -2.3);
        f.bezierCurveTo(0.8, -2.9, -0.5, -2.2, -1.2, -1.6);
        f.bezierCurveTo(-1.8, 0.4, -1.6, 3.6, -1.9, 6.2);
        f.bezierCurveTo(-3.4, 6.2, -4.8, 5.9, -5.9, 5.4);
        f.closePath();
        s.moveTo(-2.4, -7.2); s.bezierCurveTo(-4.6, -4.6, -5.0, 0.6, -4.6, 5.2);
        s.moveTo(0.4, -7.6); s.bezierCurveTo(-0.8, -5.6, -1.6, -3.6, -1.5, -1.6);
        s.moveTo(2.4, -7.2); s.bezierCurveTo(2.0, -5.4, 2.6, -3.6, 3.6, -2.5);
      } else if (v === "profile") {
        f.moveTo(-5.8, 5.2);
        f.bezierCurveTo(-7.2, 1.0, -7.0, -6.6, -1.6, -7.7);
        f.bezierCurveTo(2.6, -8.5, 5.5, -6.2, 5.45, -2.8);
        f.bezierCurveTo(5.35, -2.0, 4.95, -1.7, 4.6, -1.7);
        f.bezierCurveTo(4.2, -2.6, 3.2, -3.0, 2.0, -2.7);
        f.bezierCurveTo(1.0, -2.0, 0.6, -0.6, 0.6, 1.0);
        f.bezierCurveTo(0.6, 3.0, 0.5, 5.0, 0.3, 6.3);
        f.bezierCurveTo(-2.0, 6.2, -4.2, 5.8, -5.8, 5.2);
        f.closePath();
        s.moveTo(-1.8, -7.0); s.bezierCurveTo(-4.2, -4.6, -4.8, 0.6, -4.2, 5.2);
        s.moveTo(1.0, -7.2); s.bezierCurveTo(-0.6, -5.0, -1.4, -2.0, -1.8, 5.8);
      } else {
        f.moveTo(-6.6, 6.0);
        f.bezierCurveTo(-7.4, 1.0, -7.0, -7.9, 0, -7.9);
        f.bezierCurveTo(7.0, -7.9, 7.4, 1.0, 6.6, 6.0);
        f.bezierCurveTo(3.6, 6.6, -3.6, 6.6, -6.6, 6.0);
        f.closePath();
        s.moveTo(0, -7.6); s.bezierCurveTo(-0.4, -4.0, -0.4, 1.0, -0.2, 6.2);
        s.moveTo(-3.4, -6.6); s.bezierCurveTo(-5.2, -3.4, -5.4, 1.4, -4.6, 6.0);
        s.moveTo(3.4, -6.6); s.bezierCurveTo(5.2, -3.4, 5.4, 1.4, 4.6, 6.0);
      }
    }
    return (HAIR[k] = H);
  }

  /* ---------- 얼굴 ---------- */
  function drawFace(x, hv, who, E, o, det, k, lwU) {
    const pal = PAL[who];
    // 눈 위치 (오른쪽을 보는 기준 좌표)
    let eyes, fc, nose, mouth, blush;
    if (hv === "front") { eyes = [[-1.95, 0.45, 1], [1.95, 0.45, 1]]; fc = 0; mouth = [0, 3.95]; blush = [[-3.0, 2.5], [3.0, 2.5]]; }
    else if (hv === "3q") { eyes = [[0.15, 0.45, 1], [3.25, 0.45, 0.78]]; fc = 1.8; mouth = [2.35, 3.95]; blush = [[0.1, 2.6], [4.0, 2.5]]; }
    else { eyes = [[3.95, 0.3, 0.7]]; fc = 6; mouth = [5.0, 3.45]; blush = [[2.9, 2.5]]; }
    const look = (o.look ?? E.look ?? 0) * (hv === "front" ? 0.35 : 0.15);
    const minW = 1.05 / k;
    x.save(); x.lineCap = "round"; x.lineJoin = "round";
    // 볼 홍조
    if (det >= 2) {
      x.save(); x.clip(headPath(hv));
      x.fillStyle = `rgba(226,110,100,${E.blush ? 0.28 : 0.16})`;
      for (const [bx, by] of blush) { x.beginPath(); x.ellipse(bx, by, 0.95, 0.55, 0, 0, TAU); x.fill(); }
      x.restore();
    }
    // 눈썹
    const bw = Math.max(0.36, minW * 1.1);
    x.strokeStyle = pal.brow; x.lineWidth = bw;
    for (const [ex, ey, sx] of eyes) {
      const dir = Math.sign(fc - ex) || 1, by = ey - 1.45 + E.by;
      const ix = ex + dir * 0.75 * sx, ox = ex - dir * 0.85 * sx;
      const iy = by - E.tilt * 0.55, oy = by + E.tilt * 0.2 + (E.tilt < 0 ? 0 : 0.05);
      x.beginPath(); x.moveTo(ox, oy); x.quadraticCurveTo((ix + ox) / 2, Math.min(iy, oy) - 0.28 + E.tilt * 0.12, ix, iy); x.stroke();
      if (E.wavy && det >= 2) { x.lineWidth = Math.max(0.16, minW * 0.6); x.beginPath(); x.moveTo(ix + dir * 0.05, iy + 0.25); x.lineTo(ix - dir * 0.05, iy + 0.55); x.stroke(); x.lineWidth = bw; }
    }
    // 눈
    const blink = o.blink || 0;
    for (const [ex0, ey, sx] of eyes) {
      const ex = ex0 + look;
      if (blink > 0.5 || E.eye === "happy") {
        x.strokeStyle = FEAT; x.lineWidth = Math.max(0.3, minW);
        x.beginPath();
        if (E.eye === "happy" && blink <= 0.5) { x.moveTo(ex - 0.62 * sx, ey + 0.25); x.quadraticCurveTo(ex, ey - 0.6, ex + 0.62 * sx, ey + 0.25); }
        else { x.moveTo(ex - 0.6 * sx, ey + 0.1); x.quadraticCurveTo(ex, ey + 0.4, ex + 0.6 * sx, ey + 0.1); }
        x.stroke(); continue;
      }
      if (E.eye === "wide" && det >= 1) {
        x.fillStyle = "#fbf8f2"; x.beginPath(); x.ellipse(ex, ey, 0.8 * sx, 0.92, 0, 0, TAU); x.fill();
        x.strokeStyle = FEAT; x.lineWidth = Math.max(0.16, minW * 0.7); x.stroke();
        x.fillStyle = FEAT; x.beginPath(); x.ellipse(ex + look * 0.5, ey + 0.05, 0.42 * sx, 0.46, 0, 0, TAU); x.fill();
      } else {
        const rx = Math.max(0.4 * sx, minW * 0.85), ry = Math.max(0.56, minW);
        x.fillStyle = FEAT; x.beginPath(); x.ellipse(ex, ey, rx, ry, 0, 0, TAU); x.fill();
        if (E.eye === "sad" && det >= 1) {
          x.strokeStyle = FEAT; x.lineWidth = Math.max(0.2, minW * 0.8);
          const dir = Math.sign(fc - ex0) || 1;
          x.beginPath(); x.moveTo(ex - dir * 0.75 * sx, ey - 0.45); x.lineTo(ex + dir * 0.55 * sx, ey - 0.85); x.stroke();
        }
      }
      if (det >= 3) { x.fillStyle = "rgba(255,255,255,0.9)"; x.beginPath(); x.arc(ex + 0.14 * sx, ey - 0.2, 0.15, 0, TAU); x.fill(); }
    }
    // 코
    if (det >= 2) {
      x.strokeStyle = rgba(FEAT, 0.6); x.lineWidth = Math.max(0.2, minW * 0.8);
      x.beginPath();
      if (hv === "front") { x.moveTo(0.35, 0.7); x.quadraticCurveTo(0.85, 2.0, 0.55, 2.35); x.quadraticCurveTo(0.15, 2.65, -0.35, 2.4); }
      else if (hv === "3q") { x.moveTo(2.95, 0.6); x.quadraticCurveTo(3.95, 1.95, 3.85, 2.35); x.quadraticCurveTo(3.55, 2.7, 3.05, 2.5); }
      else { x.moveTo(5.55, 1.95); x.quadraticCurveTo(5.25, 2.1, 5.3, 1.75); }
      x.stroke();
    }
    // 입
    if (det >= 1) {
      const talk = o.mouth != null ? clamp(o.mouth, 0, 1) : null;
      const open = talk != null && (E === EXPR.talk || E.open) ? talk * (E.oh ? 1 : 0.9) + (E === EXPR.talk ? 0 : 0) : E.open;
      const [mx, my] = mouth, mw = E.mw * (hv === "3q" ? 0.85 : 1), cv = E.curve;
      x.lineWidth = Math.max(0.24, minW * 0.95); x.strokeStyle = FEAT;
      if (hv === "profile") {
        x.beginPath();
        if (open > 0.08) {
          x.moveTo(5.35, my - 0.15 - open * 0.1); x.quadraticCurveTo(4.6, my + open * 0.3, 5.35, my + 0.2 + open * 0.55); x.closePath();
          x.fillStyle = "#6a2b2b"; x.fill(); x.stroke();
        } else { x.moveTo(5.3, my); x.quadraticCurveTo(4.95, my + 0.05 + cv * 0.25, 4.55, my - cv * 0.35); x.stroke(); }
      } else if (E.oh || open > 0.08) {
        const ow = E.oh ? mw * 0.55 : mw * 0.5, oh = E.oh ? 0.55 + open * 0.45 : 0.15 + open * 0.55;
        x.beginPath();
        if (E.oh) x.ellipse(mx, my + 0.1, ow, oh, 0, 0, TAU);
        else {
          x.moveTo(mx - ow, my - cv * 0.15);
          x.quadraticCurveTo(mx, my + cv * 0.25 - 0.08, mx + ow, my - cv * 0.15);
          x.quadraticCurveTo(mx, my + oh * 2 + cv * 0.2, mx - ow, my - cv * 0.15);
        }
        x.fillStyle = "#6a2b2b"; x.fill();
        if (!E.oh && det >= 2 && cv > 0.3) {
          x.save(); x.clip(); x.fillStyle = "#fbf8f2"; x.fillRect(mx - ow, my - 1, ow * 2, 0.95 + cv * 0.15); x.restore();
        }
        x.stroke();
      } else {
        x.beginPath();
        if (E.wavy) {
          x.moveTo(mx - mw / 2, my + 0.1); x.quadraticCurveTo(mx - mw / 4, my - 0.25, mx, my + 0.05); x.quadraticCurveTo(mx + mw / 4, my + 0.3, mx + mw / 2, my);
        } else { x.moveTo(mx - mw / 2, my - cv * 0.35); x.quadraticCurveTo(mx, my + cv * 0.55, mx + mw / 2, my - cv * 0.35); }
        x.stroke();
      }
    }
    x.restore();
  }

  /* ---------- 인물 렌더러 ---------- */
  /* 몸 좌표: 발바닥 y=0, 정수리 y=-100 (키 100), x 는 정면에서 화면 오른쪽(+), z 는 정면에서 카메라 쪽(+) */
  function skeleton(o, who, psi) {
    const pose = o.pose || "stand", ph = o.phase || 0, B = BODY[who];
    const sn = Math.sin(psi), cs = Math.cos(psi);
    const proj = (v) => [v[0] * cs + v[2] * sn, v[1]];
    const depth = (v) => v[2] * cs - v[0] * sn;
    const add = (a, b, l) => [a[0] + b[0] * l, a[1] + b[1] * l, a[2] + b[2] * l];
    const legs = [], arms = [];
    for (const sd of [-1, 1]) {
      let th = 0, kn = 0.05, toe = 0;
      const lp = (ph + (sd > 0 ? 0 : 0.5)) * TAU;
      if (pose === "walk") { th = 0.42 * Math.sin(lp); kn = 0.06 + 0.7 * Math.pow(Math.max(0, Math.cos(lp + 0.5)), 1.4); toe = -0.2 * Math.max(0, Math.cos(lp + 0.5)); }
      else if (pose === "sit") { th = 1.5; kn = 1.5; }
      const hip = [sd * 4.5, -50, 0];
      const knee = add(hip, norm3([sd * (pose === "sit" ? 0.12 : 0.04), Math.cos(th), Math.sin(th)]), 23);
      const ankle = add(knee, norm3([sd * (pose === "sit" ? 0.02 : 0.03), Math.cos(th - kn), Math.sin(th - kn)]), 23);
      const fdir = norm3([sd * 0.18, Math.sin(toe), Math.cos(toe)]);
      const heel = add(add(ankle, [0, 1, 0], 3.4), fdir, -1.6);
      legs.push({ sd, hip, knee, ankle, heel, toe: add(heel, fdir, 11.5), fdir });
    }
    // 제스처 팔: 정면에서는 화면 오른쪽 팔, 옆·3/4 에서는 보는 방향 쪽
    const gest = pose === "point" || pose === "wave";
    const s = Math.sign(sn) || 1;
    const dX = Math.abs(sn) < 0.3 ? 1 : s * cs, dZ = Math.abs(sn) < 0.3 ? 0 : Math.abs(sn);
    let gSd = Math.abs(dX) > 0.3 ? Math.sign(dX) : -s;
    if (Math.abs(psi) > 2.5) gSd = -1; // 뒷모습: 화면 오른쪽 팔
    for (const sd of [-1, 1]) {
      const S = [sd * B.shJ, -80.5, 0];
      let u = norm3([sd * 0.15, 1, 0.03]), f = norm3([sd * 0.06, 1, 0.2]), hand = "relax";
      if (pose === "walk") {
        const lp = (ph + (sd > 0 ? 0 : 0.5)) * TAU, a = -0.42 * Math.sin(lp);
        u = norm3([sd * 0.12, Math.cos(a), Math.sin(a)]); f = norm3([sd * 0.05, Math.cos(a + 0.45), Math.sin(a + 0.45)]);
      } else if (pose === "sit") { u = norm3([sd * 0.1, 0.94, 0.33]); f = norm3([sd * -0.05, 0.3, 1]); }
      if (gest && sd === gSd) {
        if (pose === "point") {
          const gx = Math.abs(psi) > 2.5 ? 1 : dX;
          u = norm3([gx * 0.9, 0.22, dZ * 0.9]); f = norm3([gx, 0.02, dZ]); hand = "point";
        } else {
          const w = 0.45 * Math.sin((o.phase || 0) * TAU);
          const gx = Math.abs(psi) > 2.5 ? 1 : dX;
          u = norm3([gx * 0.85, 0.3, dZ * 0.85]); f = norm3([gx * (0.12 + w * 0.6), -1, dZ * (0.12 + w * 0.6)]); hand = "open";
        }
      }
      const E = add(S, u, 16.8), W = add(E, f, 15.2);
      arms.push({ sd, S, E, W, f, hand, gest: gest && sd === gSd, depth: (depth(S) + depth(W)) / 2 });
    }
    return { legs, arms, proj, depth, sn, cs };
  }

  function torsoPath(who, sn, cs) {
    const B = BODY[who];
    const L = [
      { y: -80.2, a: B.sh, b: 5.4, z: -0.6 },
      { y: -72, a: B.chest, b: 6.6, z: B.bust * 0.7 },
      { y: -61, a: B.waist, b: 5.6, z: 0.2 },
      { y: -49.2, a: B.hip + 0.5, b: 6.6, z: -0.6 },
    ].map((q) => ({ y: q.y, c: q.z * sn, w: Math.sqrt((q.a * cs) ** 2 + (q.b * sn) ** 2) }));
    const nc = -0.5 * sn, nw = 2.5 * (1 + 0.15 * Math.abs(sn));
    const P = new Path2D();
    P.moveTo(nc - nw, -85);
    P.quadraticCurveTo(L[0].c - L[0].w * 0.72, -84.6, L[0].c - L[0].w, L[0].y);
    crTo(P, L.map((q) => [q.c - q.w, q.y]));
    P.lineTo(L[3].c + L[3].w, L[3].y);
    crTo(P, L.slice().reverse().map((q) => [q.c + q.w, q.y]));
    P.quadraticCurveTo(L[0].c + L[0].w * 0.72, -84.6, nc + nw, -85);
    if (Math.abs(cs) > 0.15 && cs > 0) P.quadraticCurveTo(nc, -82.6, nc - nw, -85);
    P.closePath();
    return { P, L, nc, nw };
  }
  function pelvisPath(who, sn, cs) {
    const B = BODY[who];
    const W = (a, b) => Math.sqrt((a * cs) ** 2 + (b * sn) ** 2);
    const w0 = W(B.waist, 5.4), w1 = W(B.hip, 5.4), w2 = W(B.hip * 0.6, 4.0), c = -0.5 * sn;
    return P2((P) => {
      P.moveTo(c - w0, -58); P.lineTo(c + w0, -58);
      P.quadraticCurveTo(c + w1, -54, c + w1, -49); P.quadraticCurveTo(c + w1, -44, c + w2, -41.5); P.lineTo(c - w2, -41.5); P.quadraticCurveTo(c - w1, -44, c - w1, -49);
      P.quadraticCurveTo(c - w1, -54, c - w0, -58); P.closePath();
    });
  }
  /* 손: w 손목(화면), f 팔뚝 방향(화면 단위 벡터), th 엄지 쪽 부호 */
  function handPath(kind, w, f, th, det) {
    const p = [-f[1] * th, f[0] * th], ang = Math.atan2(f[1], f[0]);
    const HS = 1.3, at = (a, b) => [w[0] + (f[0] * a + p[0] * b) * HS, w[1] + (f[1] * a + p[1] * b) * HS];
    const out = [];
    if (det < 1) { const c = at(2.4, 0); out.push(ellP(c[0], c[1], 2.4 * HS, 1.8 * HS, ang)); return out; }
    if (kind === "point") {
      const c = at(2.1, 0); const tip = at(7.0, -0.5), base = at(3.4, -0.5);
      out.push(limb([base, tip], [0.75 * HS, 0.6 * HS]));
      out.push(ellP(c[0], c[1], 2.3 * HS, 2.0 * HS, ang));
      const t0 = at(2.6, 1.2), t1 = at(4.0, 1.0); out.push(limb([t0, t1], [0.75 * HS, 0.6 * HS]));
    } else if (kind === "open") {
      const c = at(2.5, 0);
      for (const [a, l] of [[-0.28, 3.4], [-0.08, 3.8], [0.12, 3.6], [0.32, 3.0]]) {
        const d = [Math.cos(ang + a), Math.sin(ang + a)], b0 = [c[0] + d[0] * 1.2 * HS, c[1] + d[1] * 1.2 * HS];
        out.push(limb([b0, [b0[0] + d[0] * l * HS, b0[1] + d[1] * l * HS]], [0.62 * HS, 0.52 * HS]));
      }
      out.push(ellP(c[0], c[1], 2.35 * HS, 2.05 * HS, ang));
      const t0 = at(1.6, 1.4 * -1), d = [Math.cos(ang - 0.95), Math.sin(ang - 0.95)];
      out.push(limb([t0, [t0[0] + d[0] * 2.4 * HS, t0[1] + d[1] * 2.4 * HS]], [0.75 * HS, 0.6 * HS]));
    } else {
      const c = at(2.9, -0.1);
      out.push(P2((P) => { // 미튼형 손바닥
        const q = (a, b) => at(a, b);
        const m = (a, b) => q(a, b);
        let p0 = m(0, -1.35); P.moveTo(p0[0], p0[1]);
        const cv = (c1, c2, e) => { const A1 = m(...c1), A2 = m(...c2), E1 = m(...e); P.bezierCurveTo(A1[0], A1[1], A2[0], A2[1], E1[0], E1[1]); };
        cv([1.4, -1.6], [3.0, -2.0], [4.6, -1.7]);
        cv([6.0, -1.4], [6.9, -0.2], [6.3, 0.8]);
        cv([5.8, 1.6], [4.2, 1.7], [3.0, 1.5]);
        cv([1.8, 1.4], [0.6, 1.5], [0, 1.35]);
        P.closePath();
      }));
      if (det >= 2) { const t0 = at(1.2, 1.1), t1 = at(3.9, 2.0); out.unshift(limb([t0, t1], [0.85 * HS, 0.65 * HS])); }
      void c;
    }
    return out;
  }
  function shoePath(lg, proj, sn, cs) {
    const a = proj(lg.ankle), h = proj(lg.heel), t = proj(lg.toe);
    const L = t[0] - h[0], dir = Math.sign(L) || 1, pad = 1.9 + 1.0 * Math.abs(cs);
    const sole = Math.max(h[1], t[1]);
    const back = h[0] - dir * pad * 0.6, front = t[0] + dir * pad * 0.55;
    const top = a[1] + 0.2, tY = Math.min(t[1], sole) - 3.4 + Math.abs(cs) * 0.8;
    return P2((P) => {
      P.moveTo(a[0] - dir * 1.9 * (0.6 + 0.4 * Math.abs(sn)), top);
      P.lineTo(a[0] + dir * 1.9 * (0.6 + 0.4 * Math.abs(sn)), top);
      P.quadraticCurveTo(lerp(a[0], front, 0.6), tY, front, sole - 1.3);
      P.quadraticCurveTo(front + dir * 0.2, sole, front - dir * 1.2, sole);
      P.lineTo(back + dir * 0.8, sole);
      P.quadraticCurveTo(back - dir * 0.2, sole, back, sole - 1.6);
      P.quadraticCurveTo(back, top, a[0] - dir * 1.9 * (0.6 + 0.4 * Math.abs(sn)), top);
      P.closePath();
    });
  }

  /* 실제 그리기. scale(px/단위), ox/oy(몸 원점 화면 위치), clipY(이 y 아래는 자름 — head() 용) */
  function drawFigure(x, o, scale, ox, oy, clipY) {
    const c = M.col(), who = o.who === "B" ? "B" : "A", pal = PAL[who];
    const view = YAW[o.view] != null ? o.view : "front";
    const psi = (YAW[view] * Math.PI) / 180;
    const sk = skeleton(o, who, psi), { proj, sn, cs } = sk;
    const E = EXPR[o.expr] || EXPR.neutral;
    const Lt = lightOf(o.light);
    const hpx = 13 * scale, det = hpx < 9 ? 0 : hpx < 20 ? 1 : hpx < 48 ? 2 : 3;
    const lwPx = clamp(0.85 + hpx * 0.013, 1, 1.5), lw = lwPx / scale, ink = ART_INK;
    // 바닥 맞추기
    let maxY = -1e9; for (const lg of sk.legs) maxY = Math.max(maxY, lg.heel[1], lg.toe[1]);
    const lift = clipY != null ? 0 : -maxY;
    x.save();
    if (o.alpha != null) x.globalAlpha *= clamp(o.alpha, 0, 1);
    x.translate(ox, oy); x.scale(scale, scale);
    if (clipY != null) { x.beginPath(); x.rect(-200, -300, 400, 300 + clipY); x.clip(); }
    x.translate(0, lift);
    x.lineJoin = "round"; x.lineCap = "round";
    SINK = Lt.rim > 0.01 ? [] : null; SINKM = null;
    // 바닥 그림자
    if (o.shadow !== false && clipY == null) {
      const xs = sk.legs.map((lg) => proj(lg.toe)[0]).concat(sk.legs.map((lg) => proj(lg.heel)[0]));
      const mn = Math.min(...xs), mx = Math.max(...xs);
      x.fillStyle = isDark() ? "rgba(0,0,0,0.38)" : "rgba(60,40,20,0.14)";
      x.beginPath(); x.ellipse((mn + mx) / 2, -lift, Math.max(9, (mx - mn) / 2 + 5), 2.2, 0, 0, TAU); x.fill();
    }
    const hc = [0.7 * sn, -93.4];
    const back = Math.abs(psi) > 2.5;
    const hv = back ? "back" : Math.abs(sn) > 0.92 ? "profile" : Math.abs(sn) > 0.38 ? "3q" : "front";
    const ms = hv === "front" || hv === "back" ? 1 : Math.sign(sn);
    const thumbSign = (a, f) => {
      const p = -f[1], w = proj(a.W);
      let want = hv === "front" ? -Math.sign(w[0]) : hv === "back" ? Math.sign(w[0]) : Math.sign(sn);
      if (a.hand === "point" || a.hand === "open") want = hv === "front" ? -1 : -want;
      return Math.sign(p) === want || Math.abs(p) < 0.05 ? 1 : -1;
    };

    const drawArm = (a) => {
      const S = proj(a.S), El = proj(a.E), W = proj(a.W);
      const fv = [W[0] - El[0], W[1] - El[1]], fl = Math.hypot(fv[0], fv[1]) || 1;
      const fs = fl < 3 ? [proj(a.f)[0] || 0, 1] : [fv[0] / fl, fv[1] / fl];
      const fn = [fs[0] / (Math.hypot(fs[0], fs[1]) || 1), fs[1] / (Math.hypot(fs[0], fs[1]) || 1)];
      const th = thumbSign(a, fn);
      const hands = handPath(a.hand, W, fn, th, det);
      const handFirst = back; // 뒷모습은 손등만 보이게
      const drawHands = () => { for (const hp of hands) part(x, hp, pal.skin, 4, Lt, lw, ink); };
      if (who === "A") {
        part(x, limb([S, El, W], [2.75, 2.05, 1.5]), pal.skin, 4.5, Lt, lw, ink);
        const sv = [S[0] + (El[0] - S[0]) * 0.5, S[1] + (El[1] - S[1]) * 0.5];
        part(x, sleeve(S, sv, 3.15, 2.95), pal.top, 6, Lt, lw, ink);
        drawHands();
      } else {
        if (handFirst) drawHands();
        part(x, limb([S, El, W], [3.0, 2.35, 1.9]), pal.top, 5, Lt, lw, ink);
        if (det >= 2) { x.strokeStyle = rgba(FEAT, 0.35); x.lineWidth = lw * 0.8; const cu = [W[0] - fn[0] * 1.4, W[1] - fn[1] * 1.4]; x.beginPath(); x.moveTo(cu[0] - fn[1] * 1.9, cu[1] + fn[0] * 1.9); x.lineTo(cu[0] + fn[1] * 1.9, cu[1] - fn[0] * 1.9); x.stroke(); }
        if (!handFirst) drawHands();
      }
    };
    const drawLeg = (lg) => {
      const H = proj(lg.hip), K = proj(lg.knee), A = proj(lg.ankle);
      part(x, limb([H, K, A], [4.4, 3.0, 2.25]), pal.bottom, 7, Lt, lw, ink);
      part(x, shoePath(lg, proj, sn, cs), pal.shoe, 4, Lt, lw, ink);
      if (det >= 2) {
        const h = proj(lg.heel), t = proj(lg.toe), sole = Math.max(h[1], t[1]);
        x.save(); x.clip(shoePath(lg, proj, sn, cs)); x.fillStyle = pal.sole; x.fillRect(Math.min(h[0], t[0]) - 4, sole - 0.9, Math.abs(t[0] - h[0]) + 8, 2); x.restore();
        x.strokeStyle = ink; x.lineWidth = lw; x.stroke(shoePath(lg, proj, sn, cs));
      }
    };

    const arms = sk.arms.slice().sort((a, b) => a.depth - b.depth);
    const behind = arms.filter((a) => !a.gest && a.depth < -1.5 && !back);
    const front = arms.filter((a) => !behind.includes(a));
    for (const a of behind) drawArm(a);
    // 다리·골반
    const legs = sk.legs.slice().sort((a, b) => sk.depth(a.knee) + sk.depth(a.ankle) - sk.depth(b.knee) - sk.depth(b.ankle));
    part(x, pelvisPath(who, sn, cs), pal.bottom, 12, Lt, lw, ink);
    for (const lg of legs) drawLeg(lg);
    // 머리 뒤 레이어 + 목
    const hp = hairPaths(who, hv);
    const headLocal = (fn) => { x.save(); x.translate(hc[0], hc[1]); x.scale(ms, 1); SINKM = new DOMMatrix([ms, 0, 0, 1, hc[0], hc[1]]); fn(); SINKM = null; x.restore(); };
    const Lm = { ...Lt, lx: Lt.lx * ms };
    if (hp.back) headLocal(() => part(x, hp.back, pal.hair, 12, Lm, lw, ink));
    const nc = -0.5 * sn, nw = 2.2 * (1 + 0.15 * Math.abs(sn));
    const neck = P2((P) => { P.moveTo(nc - nw, -89.5); P.lineTo(nc - nw * 1.05, -83.2); P.quadraticCurveTo(nc, -82.2, nc + nw * 1.05, -83.2); P.lineTo(nc + nw, -89.5); P.closePath(); });
    part(x, neck, pal.skin, 4.4, Lt, lw, ink);
    if (!back) { x.save(); x.clip(neck); x.fillStyle = rgba(SHADE, 0.22); x.beginPath(); x.ellipse(hc[0] + 0.6 * sn, -87.6, 4.6, 1.9, 0, 0, TAU); x.fill(); x.restore(); }
    // 상의
    const T = torsoPath(who, sn, cs);
    part(x, T.P, pal.top, T.L[1].w * 2, Lt, lw, ink);
    if (det >= 2) {
      x.save(); x.clip(T.P); x.strokeStyle = rgba(FEAT, 0.3); x.lineWidth = lw * 0.85;
      if (who === "A" && !back && cs > 0.2) { // 칼라 V + 단추선
        x.beginPath(); x.moveTo(T.nc - T.nw, -84.8); x.lineTo(T.nc + 0.3 * sn, -80.8); x.lineTo(T.nc + T.nw, -84.8); x.stroke();
        x.beginPath(); x.moveTo(T.nc + 0.3 * sn, -80.8); x.lineTo(T.nc + 0.6 * sn, -50); x.stroke();
        if (det >= 3) { x.fillStyle = rgba(FEAT, 0.35); for (let y = -76; y > -80 + -0.1 && y < -50; y += 7) { x.beginPath(); x.arc(T.nc + 0.3 * sn + 0.6, y, 0.35, 0, TAU); x.fill(); } }
      } else if (who === "B" && !back) {
        x.beginPath(); x.moveTo(T.L[3].c - T.L[3].w, -52.2); x.lineTo(T.L[3].c + T.L[3].w, -52.2); x.stroke();
      }
      x.restore();
    }
    for (const a of front) drawArm(a);
    // 머리
    headLocal(() => {
      const H = headPath(hv), hl = Lm;
      const ears = (hv === "front" || hv === "back") ? [[-5.05, 0.9], [5.05, 0.9]] : hv === "3q" ? [[-2.5, 1.0]] : [[-0.9, 1.0]];
      const earP = ears.map(([ex, ey]) => ellP(ex, ey, hv === "profile" ? 1.15 : 1.0, hv === "profile" ? 1.7 : 1.55));
      const earsBehind = hv === "front" || hv === "back";
      if (earsBehind && det >= 1 && hv === "front") for (const p of earP) part(x, p, pal.skin, 2, hl, lw, ink);
      part(x, H, pal.skin, 11, hl, lw, ink);
      if (!earsBehind && det >= 1 && who === "A") for (const p of earP) {
        part(x, p, pal.skin, 2, hl, lw, ink);
        if (det >= 2) { const [ex, ey] = ears[0]; x.strokeStyle = rgba(FEAT, 0.35); x.lineWidth = lw * 0.8; x.beginPath(); x.arc(ex + 0.15, ey, 0.6, -1.9, 1.9); x.stroke(); }
      }
      // 조명: 코 그림자
      if (Lt.custom && det >= 2 && hv !== "back" && Lt.shad > 0.05) {
        const sx = -Math.sign(hl.lx || 0.0001);
        const nx = hv === "front" ? 0.4 : hv === "3q" ? 3.4 : 5.6;
        x.save(); x.clip(H); x.fillStyle = rgba(DEEP, Lt.shad * 0.3 * Lt.mag);
        x.beginPath(); x.ellipse(nx + sx * 0.75, 2.55 - (hl.ly || 0) * 0.1, 0.75, 0.32, sx * 0.3, 0, TAU); x.fill(); x.restore();
      }
      if (hv !== "back") drawFace(x, hv, who, E, o, det, scale, lw);
      part(x, hp.front, pal.hair, 13, hl, lw, ink);
      if (det >= 2) { x.save(); x.clip(hp.front); x.strokeStyle = rgba("#000000", 0.22); x.lineWidth = Math.max(lw * 0.8, 0.14); x.stroke(hp.strands); x.restore(); }
      if (hv === "back" && who === "A" && det >= 1) for (const p of earP) part(x, p, pal.skin, 2, hl, lw, ink);
    });
    if (SINK) { const sil = SINK; SINK = null; rimPass(x, sil, 0.42 * Math.min(1.2, Lt.rim), Lt); }
    x.restore();

    // 반환 좌표
    const toS = (p) => [ox + p[0] * scale, oy + (p[1] + lift) * scale];
    const pts = [[hc[0] - 7.2, hc[1] - 8], [hc[0] + 7.2, hc[1] + 6.5]];
    for (const a of sk.arms) { const w = proj(a.W), e = proj(a.E); pts.push(w, e, [w[0] + (w[0] - e[0]) * 0.45, w[1] + (w[1] - e[1]) * 0.45]); }
    for (const lg of sk.legs) pts.push(proj(lg.toe), proj(lg.heel), proj(lg.knee));
    const T0 = torsoPath(who, sn, cs).L; for (const q of T0) pts.push([q.c - q.w, q.y], [q.c + q.w, q.y]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const s = toS(p); x0 = Math.min(x0, s[0]); y0 = Math.min(y0, s[1]); x1 = Math.max(x1, s[0]); y1 = Math.max(y1, s[1]); }
    const hs = toS(hc);
    const eyeL = hv === "front" ? [0, 0.45] : hv === "3q" ? [1.7 * ms, 0.45] : hv === "profile" ? [3.95 * ms, 0.3] : [0, 0.45];
    const es = toS([hc[0] + eyeL[0], hc[1] + eyeL[1]]);
    const seat = toS([-0.5 * sn, sk.legs[0].hip[1] + 4.4]);
    return { head: { x: hs[0], y: hs[1], r: 6.6 * scale }, eyes: { x: es[0], y: es[1] }, bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, seat: { x: seat[0], y: seat[1] } };
  }

  /* ---------- 공개 API ---------- */
  const A = {};
  A.PAL = PAL;

  /* person: cx,cy = 발(바닥) 중심, h = 키(px) */
  A.person = (x, o = {}) => {
    const h = Math.max(10, o.h || 200), sc = h / 100;
    return drawFigure(x, o, sc, o.cx || 0, o.cy || 0, null);
  };
  /* head: cx,cy = 머리 중심, r = 머리 반높이(px). 목·어깨·가슴까지 그림 */
  A.head = (x, o = {}) => {
    const r = Math.max(4, o.r || 60), sc = r / 6.6;
    const view = YAW[o.view] != null ? o.view : "front", sn = Math.sin((YAW[view] * Math.PI) / 180);
    const ox = (o.cx || 0) - 0.7 * sn * sc, oy = (o.cy || 0) + 93.4 * sc;
    return drawFigure(x, { ...o, pose: "stand", shadow: false }, sc, ox, oy, o.cut ?? -64);
  };

  /* ---------- 소품 ---------- */
  const PC = {
    wood: "#b98a5f", woodDk: "#8e6441", cream: "#efe6d6", metal: "#8b8f93", green: "#7fa57a", green2: "#5f8a63",
    pot: "#c8764f", glass: "#b9d2df", sky: "#cfe2ea", dark: "#2f3136", gold: "#e0b154", rose: "#d97a6c", petal: "#e8a0a0",
  };
  const ph = (fn) => { const p = new Path2D(); fn(p); return p; };
  const R = (P, x0, y0, w, h, r = 0) => { if (r && P.roundRect) P.roundRect(x0, y0, w, h, r); else P.rect(x0, y0, w, h); };
  const poly = (P, pts) => { P.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) P.lineTo(pts[i][0], pts[i][1]); P.closePath(); };
  /* 겹친 원 덩어리의 바깥 윤곽만: 굵게 그은 뒤 위에 채움 */
  function blob(x, circles, fill, lw, ink, shadeA = 0.16, sh = [0.06, 0.05]) {
    x.save(); x.strokeStyle = ink; x.lineWidth = lw * 2;
    for (const [cx, cy, r] of circles) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
    const P = new Path2D(); for (const [cx, cy, r] of circles) { P.moveTo(cx + r, cy); P.arc(cx, cy, r, 0, TAU); }
    x.fillStyle = fill; x.fill(P);
    if (shadeA) { x.save(); x.clip(P); x.clip(outside(P, -sh[0], -sh[1]), "evenodd"); x.fillStyle = rgba(SHADE, shadeA); x.fill(P); x.restore(); }
    x.restore();
    return P;
  }
  const PROPS = {
    chair(x, q) {
      const { pt, lw } = q;
      pt(ph((P) => { R(P, -0.235, -0.55, 0.045, 0.53); R(P, 0.19, -0.55, 0.045, 0.53); }), PC.woodDk);
      pt(ph((P) => { R(P, -0.235, -1.0, 0.05, 0.47, 0.02); R(P, 0.185, -1.0, 0.05, 0.47, 0.02); }), PC.wood, 0.05);
      pt(ph((P) => R(P, -0.25, -0.97, 0.5, 0.2, 0.05)), PC.wood, 0.1);
      pt(ph((P) => R(P, -0.2, -0.72, 0.4, 0.05, 0.02)), PC.woodDk);
      pt(ph((P) => { R(P, -0.28, -0.47, 0.055, 0.47, 0.02); R(P, 0.225, -0.47, 0.055, 0.47, 0.02); }), PC.wood, 0.05);
      pt(ph((P) => poly(P, [[-0.3, -0.47], [0.3, -0.47], [0.25, -0.56], [-0.25, -0.56]])), PC.wood, 0.1);
      pt(ph((P) => R(P, -0.3, -0.47, 0.6, 0.06, 0.02)), PC.woodDk);
      void lw;
    },
    table(x, q) {
      const { pt } = q;
      pt(ph((P) => { R(P, -0.78, -0.95, 0.055, 0.85); R(P, 0.725, -0.95, 0.055, 0.85); }), PC.woodDk);
      pt(ph((P) => { R(P, -0.92, -0.8, 0.07, 0.8, 0.02); R(P, 0.85, -0.8, 0.07, 0.8, 0.02); }), PC.wood, 0.07);
      pt(ph((P) => R(P, -0.92, -0.86, 1.84, 0.1)), PC.woodDk);
      pt(ph((P) => poly(P, [[-1, -0.86], [1, -0.86], [0.86, -1.0], [-0.86, -1.0]])), PC.wood, 0.3);
      pt(ph((P) => R(P, -1, -0.86, 2, 0.05)), PC.woodDk);
    },
    lamp(x, q, o) {
      const { pt } = q, on = o.on !== false;
      if (on) {
        const g = x.createRadialGradient(0, -0.78, 0.02, 0, -0.78, 0.6);
        g.addColorStop(0, "rgba(255,214,140,0.55)"); g.addColorStop(1, "rgba(255,214,140,0)");
        x.fillStyle = g; x.beginPath(); x.arc(0, -0.78, 0.6, 0, TAU); x.fill();
      }
      pt(ph((P) => P.ellipse(0, -0.02, 0.17, 0.035, 0, 0, TAU)), PC.metal, 0.1);
      pt(ph((P) => R(P, -0.016, -0.8, 0.032, 0.78)), PC.metal);
      pt(ph((P) => poly(P, [[-0.13, -1.0], [0.13, -1.0], [0.22, -0.76], [-0.22, -0.76]])), on ? "#f6e2b6" : PC.cream, 0.15);
    },
    plant(x, q) {
      const { pt } = q;
      const leaves = [[-1.15, 0.5, 1], [1.1, 0.48, 1], [-0.7, 0.62, 0], [0.65, 0.64, 0], [-0.25, 0.66, 1], [0.2, 0.6, 0], [0, 0.56, 1]];
      for (const [a, l, g] of leaves) {
        const ang = a - Math.PI / 2, ex = Math.cos(ang) * l, ey = -0.36 + Math.sin(ang) * l;
        const nx = -Math.sin(ang) * l * 0.2, ny = Math.cos(ang) * l * 0.2;
        const mx = ex * 0.5, my = -0.36 + (ey + 0.36) * 0.5;
        pt(ph((P) => { P.moveTo(0, -0.36); P.quadraticCurveTo(mx + nx, my + ny, ex, ey); P.quadraticCurveTo(mx - nx, my - ny, 0, -0.36); P.closePath(); }), g ? PC.green : PC.green2, 0.05);
        x.save(); x.strokeStyle = "rgba(0,0,0,0.18)"; x.lineWidth = q.lw * 0.8; x.beginPath(); x.moveTo(0, -0.36); x.lineTo(ex * 0.8, -0.36 + (ey + 0.36) * 0.8); x.stroke(); x.restore();
      }
      pt(ph((P) => poly(P, [[-0.2, -0.33], [0.2, -0.33], [0.15, 0], [-0.15, 0]])), PC.pot, 0.08);
      pt(ph((P) => R(P, -0.23, -0.4, 0.46, 0.09, 0.02)), PC.pot, 0.05);
    },
    window(x, q) {
      const { pt, lw, ink } = q;
      pt(ph((P) => R(P, -0.42, -1.0, 0.84, 0.94, 0.02)), PC.cream, 0.05);
      const gl = ph((P) => { R(P, -0.36, -0.94, 0.33, 0.82); R(P, 0.03, -0.94, 0.33, 0.82); });
      x.fillStyle = PC.sky; x.fill(gl);
      x.save(); x.clip(gl);
      x.fillStyle = "rgba(255,255,255,0.55)";
      x.beginPath(); x.moveTo(-0.3, -0.2); x.lineTo(-0.05, -0.75); x.lineTo(0.03, -0.75); x.lineTo(-0.22, -0.2); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(0.1, -0.3); x.lineTo(0.3, -0.75); x.lineTo(0.34, -0.75); x.lineTo(0.14, -0.3); x.closePath(); x.fill();
      x.fillStyle = "rgba(255,255,255,0.75)"; x.beginPath(); x.arc(-0.18, -0.68, 0.07, 0, TAU); x.arc(-0.1, -0.7, 0.09, 0, TAU); x.arc(-0.02, -0.67, 0.06, 0, TAU); x.fill();
      x.restore();
      x.lineWidth = lw; x.strokeStyle = ink; x.stroke(gl);
      x.beginPath(); x.moveTo(-0.36, -0.53); x.lineTo(-0.03, -0.53); x.moveTo(0.03, -0.53); x.lineTo(0.36, -0.53); x.stroke();
      pt(ph((P) => R(P, -0.48, -0.08, 0.96, 0.08, 0.02)), PC.cream, 0.3);
    },
    door(x, q) {
      const { pt } = q;
      pt(ph((P) => R(P, -0.3, -1.0, 0.6, 1.0)), PC.cream, 0.05);
      pt(ph((P) => R(P, -0.25, -0.95, 0.5, 0.95)), "#a77a55", 0.08);
      pt(ph((P) => { R(P, -0.19, -0.88, 0.38, 0.34, 0.02); R(P, -0.19, -0.48, 0.38, 0.4, 0.02); }), "#b88a63", 0.04);
      pt(ph((P) => P.arc(0.17, -0.5, 0.025, 0, TAU)), PC.gold);
    },
    mug(x, q, o) {
      const { pt, lw, ink } = q, col = o.color || "#e9e1d2";
      x.save(); x.lineWidth = lw * 2; x.strokeStyle = ink; x.beginPath(); x.ellipse(0.4, -0.45, 0.17, 0.2, 0, 0, TAU); x.stroke();
      x.lineWidth = 0.09; x.strokeStyle = col; x.stroke(); x.restore();
      pt(ph((P) => { P.moveTo(-0.36, -0.8); P.lineTo(-0.36, -0.08); P.quadraticCurveTo(-0.36, 0, -0.28, 0); P.lineTo(0.28, 0); P.quadraticCurveTo(0.36, 0, 0.36, -0.08); P.lineTo(0.36, -0.8); P.ellipse(0, -0.8, 0.36, 0.08, 0, 0, Math.PI, true); P.closePath(); }), col, 0.18);
      pt(ph((P) => P.ellipse(0, -0.8, 0.36, 0.08, 0, 0, TAU)), col);
      pt(ph((P) => P.ellipse(0, -0.79, 0.29, 0.055, 0, 0, TAU)), "#6b4430");
      if (o.steam) steam(x, q, o, [-0.1, 0.12], -0.92, 0.5);
    },
    bowl(x, q, o) {
      const { pt } = q;
      pt(ph((P) => P.ellipse(0, -0.03, 0.22, 0.04, 0, 0, TAU)), "#d9cdb9");
      pt(ph((P) => { P.moveTo(-0.62, -0.55); P.bezierCurveTo(-0.6, -0.12, -0.3, -0.04, 0, -0.04); P.bezierCurveTo(0.3, -0.04, 0.6, -0.12, 0.62, -0.55); P.ellipse(0, -0.55, 0.62, 0.13, 0, 0, Math.PI, true); P.closePath(); }), o.color || "#7fa0b8", 0.2);
      pt(ph((P) => P.ellipse(0, -0.55, 0.62, 0.13, 0, 0, TAU)), "#efe7da");
      pt(ph((P) => P.ellipse(0, -0.535, 0.54, 0.1, 0, 0, TAU)), "#e2a85c");
      x.fillStyle = PC.green; for (const [a, b] of [[-0.2, -0.54], [0.15, -0.52], [0.02, -0.57]]) { x.beginPath(); x.ellipse(a, b, 0.05, 0.022, 0.4, 0, TAU); x.fill(); }
      if (o.steam !== false) steam(x, q, o, [-0.22, 0, 0.22], -0.7, 0.5);
    },
    flower(x, q, o) {
      const { pt, lw, ink } = q, droop = clamp(o.droop || 0, 0, 1);
      const heads = [[-0.2, -0.86, -0.5], [0.05, -1.0, 0], [0.24, -0.82, 0.55]];
      x.save(); x.strokeStyle = PC.green2; x.lineWidth = Math.max(lw * 1.6, 0.022);
      const tips = heads.map(([hx, hy, b]) => {
        const tx = hx + b * droop * 0.25, ty = hy + droop * 0.35 * (1 + Math.abs(b));
        x.beginPath(); x.moveTo(0, -0.42); x.quadraticCurveTo(hx * 0.6, (hy - 0.42) / 2, tx, ty); x.stroke();
        return [tx, ty];
      });
      x.restore();
      pt(ph((P) => { P.moveTo(0, -0.6); P.quadraticCurveTo(-0.2, -0.7, -0.26, -0.62); P.quadraticCurveTo(-0.14, -0.56, 0, -0.6); }), PC.green, 0.03);
      tips.forEach(([tx, ty], i) => {
        const r = 0.085, col = i === 1 ? "#e9b44f" : PC.petal;
        const P = ph((P) => { for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + i, px = tx + Math.cos(a) * r, py = ty + Math.sin(a) * r; P.moveTo(px + r * 0.75, py); P.ellipse(px, py, r * 0.75, r * 0.75, 0, 0, TAU); } });
        x.save(); x.lineWidth = lw * 2; x.strokeStyle = ink; x.stroke(P); x.fillStyle = col; x.fill(P); x.restore();
        pt(ph((P) => P.arc(tx, ty, r * 0.5, 0, TAU)), "#f3dfa2");
      });
      pt(ph((P) => { P.moveTo(-0.1, -0.45); P.quadraticCurveTo(-0.22, -0.2, -0.16, 0); P.lineTo(0.16, 0); P.quadraticCurveTo(0.22, -0.2, 0.1, -0.45); P.closePath(); }), "#9fbcc9", 0.06);
      pt(ph((P) => R(P, -0.12, -0.5, 0.24, 0.06, 0.02)), "#9fbcc9");
    },
    gift(x, q, o) {
      const { pt } = q, col = o.color || PC.rose, rib = "#f4e7c6";
      pt(ph((P) => { P.ellipse(-0.14, -0.8, 0.15, 0.08, -0.5, 0, TAU); P.moveTo(0.29, -0.8); P.ellipse(0.14, -0.8, 0.15, 0.08, 0.5, 0, TAU); }), rib, 0.03);
      pt(ph((P) => R(P, -0.38, -0.62, 0.76, 0.62)), col, 0.25);
      pt(ph((P) => R(P, -0.43, -0.74, 0.86, 0.14, 0.02)), col, 0.1);
      pt(ph((P) => { R(P, -0.06, -0.74, 0.12, 0.74); }), rib, 0.03);
      pt(ph((P) => P.ellipse(0, -0.76, 0.06, 0.045, 0, 0, TAU)), rib);
    },
    phone(x, q, o) {
      const { pt } = q, on = o.on !== false;
      pt(ph((P) => R(P, -0.26, -1, 0.52, 1, 0.08)), "#34363b", 0.04);
      pt(ph((P) => R(P, -0.22, -0.95, 0.44, 0.9, 0.05)), on ? "#e7eef2" : "#1e2024");
      if (on) {
        x.fillStyle = "#9cc0d6"; x.fillRect(-0.18, -0.84, 0.36, 0.22);
        x.fillStyle = "#c9d6dd"; for (let i = 0; i < 4; i++) x.fillRect(-0.18, -0.56 + i * 0.1, 0.36 - (i % 2) * 0.12, 0.05);
      }
      x.fillStyle = "#34363b"; x.beginPath(); R(x, -0.07, -0.94, 0.14, 0.035, 0.017); x.fill();
    },
    laptop(x, q, o) {
      const { pt } = q, on = o.on !== false;
      pt(ph((P) => R(P, -0.62, -1.0, 1.24, 0.86, 0.04)), "#3a3d42", 0.04);
      pt(ph((P) => R(P, -0.56, -0.95, 1.12, 0.76, 0.02)), on ? "#e6edf1" : "#1e2024");
      if (on) {
        x.fillStyle = "#a9c8d8"; x.fillRect(-0.5, -0.89, 1.0, 0.12);
        x.fillStyle = "#cdd8de"; x.fillRect(-0.5, -0.72, 0.3, 0.46); for (let i = 0; i < 4; i++) x.fillRect(-0.15, -0.72 + i * 0.12, 0.62 - (i % 2) * 0.2, 0.06);
      }
      pt(ph((P) => poly(P, [[-0.64, -0.14], [0.64, -0.14], [0.78, -0.03], [-0.78, -0.03]])), "#b9bcc0", 0.1);
      pt(ph((P) => R(P, -0.78, -0.035, 1.56, 0.035, 0.015)), "#8f9398");
    },
    car(x, q, o) {
      const { pt } = q, col = o.color || "#6f93b0";
      const body = ph((P) => {
        P.moveTo(-1.3, -0.2); P.lineTo(-1.32, -0.48); P.quadraticCurveTo(-1.3, -0.58, -1.12, -0.6);
        P.lineTo(-0.82, -0.62); P.quadraticCurveTo(-0.66, -0.95, -0.5, -0.96); P.lineTo(0.2, -0.96);
        P.quadraticCurveTo(0.36, -0.95, 0.62, -0.64); P.lineTo(1.12, -0.56); P.quadraticCurveTo(1.32, -0.52, 1.34, -0.4);
        P.lineTo(1.34, -0.2); P.lineTo(1.08, -0.2); P.arc(0.82, -0.2, 0.26, 0, Math.PI, true); P.lineTo(-0.56, -0.2);
        P.arc(-0.82, -0.2, 0.26, 0, Math.PI, true); P.closePath();
      });
      pt(body, col, 0.25);
      pt(ph((P) => { poly(P, [[-0.74, -0.64], [-0.58, -0.88], [-0.22, -0.88], [-0.22, -0.64]]); poly(P, [[-0.14, -0.64], [-0.14, -0.88], [0.16, -0.88], [0.48, -0.64]]); }), PC.glass, 0.1);
      x.save(); x.strokeStyle = "rgba(0,0,0,0.25)"; x.lineWidth = q.lw; x.beginPath(); x.moveTo(-0.18, -0.6); x.lineTo(-0.18, -0.22); x.moveTo(-0.95, -0.42); x.lineTo(1.3, -0.42); x.stroke(); x.restore();
      pt(ph((P) => R(P, 1.24, -0.46, 0.1, 0.07, 0.02)), "#f6e6b0");
      pt(ph((P) => R(P, -1.33, -0.48, 0.07, 0.08, 0.02)), "#d0584a");
      for (const wx of [-0.82, 0.82]) {
        pt(ph((P) => P.arc(wx, -0.2, 0.21, 0, TAU)), "#2c2c30");
        pt(ph((P) => P.arc(wx, -0.2, 0.1, 0, TAU)), "#c9ccd0");
      }
    },
    tree(x, q, o) {
      const { pt, lw, ink } = q;
      pt(ph((P) => { P.moveTo(-0.06, 0); P.lineTo(-0.035, -0.5); P.lineTo(0.035, -0.5); P.lineTo(0.06, 0); P.closePath(); }), "#8a6446", 0.05);
      x.save(); x.strokeStyle = "#8a6446"; x.lineWidth = 0.03; x.beginPath(); x.moveTo(0, -0.38); x.lineTo(0.14, -0.52); x.stroke(); x.restore();
      const sway = o.time ? Math.sin(o.time / 900) * 0.01 : 0;
      blob(x, [[-0.2 + sway, -0.62, 0.2], [0.18 + sway, -0.6, 0.21], [0, -0.8, 0.24], [-0.14 + sway, -0.88, 0.16], [0.17 + sway, -0.82, 0.17]], o.color || PC.green, lw, ink, 0.2, [0.07, 0.06]);
    },
    building(x, q, o) {
      const { pt, lw } = q, W = (o.w || 0.7) / 2, col = o.color || "#d8c3a4";
      pt(ph((P) => R(P, -W, -1, W * 2, 1)), col, W * 0.6);
      pt(ph((P) => R(P, -W - 0.03, -1.0, W * 2 + 0.06, 0.05)), mix(col, "#000000", 0.15));
      const cols = Math.max(2, Math.round(W * 2 / 0.2)), rows = o.floors || 5, gw = (W * 2 - 0.12) / cols;
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
        const wx = -W + 0.06 + k * gw + gw * 0.2, wy = -0.92 + r * ((0.72) / rows);
        const lit = o.lit && ((r * 7 + k * 3) % 5 === 0);
        x.fillStyle = lit ? "#f5d78e" : "#a9c3d1"; x.fillRect(wx, wy, gw * 0.6, 0.72 / rows * 0.6);
        x.strokeStyle = q.ink; x.lineWidth = lw * 0.8; x.strokeRect(wx, wy, gw * 0.6, 0.72 / rows * 0.6);
      }
      pt(ph((P) => R(P, -0.06, -0.16, 0.12, 0.16)), "#6b5a4c");
    },
  };
  function steam(x, q, o, xs, y0, h) {
    const t = (o.time || 0) / 1000;
    x.save(); x.strokeStyle = isDark() ? "rgba(255,255,255,0.45)" : "rgba(120,110,100,0.45)"; x.lineWidth = Math.max(q.lw * 1.2, 0.018); x.lineCap = "round";
    xs.forEach((sx, i) => {
      x.beginPath();
      for (let k = 0; k <= 12; k++) { const yy = y0 - (k / 12) * h, xx = sx + Math.sin(k * 0.7 + t * 3 + i * 2) * 0.04; k ? x.lineTo(xx, yy) : x.moveTo(xx, yy); }
      x.stroke();
    });
    x.restore();
  }
  /* prop: cx,cy = 바닥 중심, s = 높이(px). car 는 폭이 약 2.7s, table 2s */
  A.prop = (x, kind, o = {}) => {
    const fn = PROPS[kind]; if (!fn) return;
    const s = Math.max(4, o.s || 60), c = M.col();
    const lwPx = clamp(0.9 + s * 0.003, 1, 1.5), lw = lwPx / s, ink = ART_INK;
    x.save();
    if (o.alpha != null) x.globalAlpha *= o.alpha;
    x.translate(o.cx || 0, o.cy || 0); x.scale((o.flip ? -1 : 1) * s, s);
    x.lineJoin = "round"; x.lineCap = "round";
    const Lt = { custom: false, lx: -0.6, ly: -0.8, mag: 0.7, lit: 0, shad: 0.16, rim: 0, warm: 0, soft: 0 };
    const pt = (P, fill, size = 0) => { x.fillStyle = fill; x.fill(P); if (size) shade(x, P, size, Lt); x.lineWidth = lw; x.strokeStyle = ink; x.stroke(P); };
    fn(x, { pt, lw, ink }, o);
    x.restore();
  };

  /* ---------- 배경 ---------- */
  const hash = (i, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
  function cloud(x, cx, cy, s, lw, ink) {
    blob(x, [[cx - s * 0.9, cy, s * 0.55], [cx, cy - s * 0.35, s * 0.75], [cx + s * 0.9, cy - s * 0.05, s * 0.6], [cx + s * 0.25, cy + s * 0.15, s * 0.55]], "#fbfaf6", lw, ink, 0.08, [s * 0.1, s * 0.1]);
  }
  const BACKDROPS = {
    room(x, b, o, k) {
      const { X, Y, W, H, lw, ink } = k, hor = Y + H * 0.68, vp = [X + W * 0.5, Y + H * 0.42];
      x.fillStyle = "#efe3d1"; x.fillRect(X, Y, W, hor - Y);
      x.fillStyle = "rgba(120,90,60,0.06)"; x.fillRect(X, Y, W, H * 0.08);
      x.fillStyle = "#c9a37f"; x.fillRect(X, hor, W, Y + H - hor);
      x.save(); x.strokeStyle = "rgba(90,60,35,0.28)"; x.lineWidth = lw;
      for (let i = -12; i <= 12; i++) { const fx = vp[0] + i * W * 0.09, t = (hor - vp[1]) / (Y + H - vp[1]); x.beginPath(); x.moveTo(vp[0] + (fx - vp[0]) * t, hor); x.lineTo(fx, Y + H); x.stroke(); }
      for (let j = 1; j < 5; j++) { const yy = hor + (Y + H - hor) * Math.pow(j / 5, 1.6); x.globalAlpha = 0.5; x.beginPath(); x.moveTo(X, yy); x.lineTo(X + W, yy); x.stroke(); }
      x.restore();
      // 창으로 들어온 빛
      const wx = X + W * 0.1, ww = Math.min(W * 0.22, H * 0.36), wh = ww * 1.15, wy = Y + H * 0.14;
      x.fillStyle = "rgba(255,244,214,0.35)"; x.beginPath(); x.moveTo(wx + ww * 0.1, hor + 2); x.lineTo(wx + ww * 0.9, hor + 2); x.lineTo(wx + ww * 1.6, Y + H); x.lineTo(wx + ww * 0.5, Y + H); x.closePath(); x.fill();
      x.fillStyle = "#f6efe3"; x.fillRect(X, hor - H * 0.025, W, H * 0.025);
      x.strokeStyle = ink; x.lineWidth = lw; x.beginPath(); x.moveTo(X, hor + 0.5); x.lineTo(X + W, hor + 0.5); x.moveTo(X, hor - H * 0.025); x.lineTo(X + W, hor - H * 0.025); x.stroke();
      A.prop(x, "window", { cx: wx + ww / 2, cy: wy + wh, s: wh });
      // 액자
      const fw = Math.min(W * 0.16, H * 0.24), fh = fw * 0.75, fx = X + W * 0.68, fy = Y + H * 0.2;
      x.fillStyle = "#f4ede2"; x.fillRect(fx, fy, fw, fh); x.strokeStyle = ink; x.lineWidth = lw; x.strokeRect(fx, fy, fw, fh);
      x.save(); x.beginPath(); x.rect(fx + fw * 0.1, fy + fh * 0.12, fw * 0.8, fh * 0.76); x.clip();
      x.fillStyle = "#cfe0e4"; x.fillRect(fx, fy, fw, fh);
      x.fillStyle = "#e3b96b"; x.beginPath(); x.arc(fx + fw * 0.68, fy + fh * 0.38, fh * 0.1, 0, TAU); x.fill();
      x.fillStyle = "#8fb08a"; x.beginPath(); x.moveTo(fx, fy + fh * 0.9); x.lineTo(fx + fw * 0.35, fy + fh * 0.42); x.lineTo(fx + fw * 0.6, fy + fh * 0.7); x.lineTo(fx + fw * 0.75, fy + fh * 0.55); x.lineTo(fx + fw, fy + fh * 0.9); x.closePath(); x.fill();
      x.restore(); x.strokeRect(fx + fw * 0.1, fy + fh * 0.12, fw * 0.8, fh * 0.76);
    },
    street(x, b, o, k) {
      const { X, Y, W, H, lw, ink, t } = k, hor = Y + H * 0.74;
      x.fillStyle = "#d3e3e8"; x.fillRect(X, Y, W, hor - Y);
      cloud(x, X + ((W * 0.2 + t * 6) % (W * 1.2)) - W * 0.1, Y + H * 0.14, H * 0.05, lw, ink);
      // 먼 건물
      x.fillStyle = "#b9c9cf";
      for (let i = 0, px = X - 10; px < X + W; i++) { const bw = H * (0.12 + hash(i, 3) * 0.1), bh = H * (0.25 + hash(i, 4) * 0.25); x.fillRect(px, hor - bh, bw, bh); px += bw; }
      // 가까운 건물
      const cols = ["#d8c3a4", "#c98f75", "#e2d5bf", "#a9b8a2", "#d6a98a"];
      for (let i = 0, px = X - H * 0.05; px < X + W; i++) {
        const bw = H * (0.3 + hash(i, 1) * 0.18), bh = H * (0.42 + hash(i, 2) * 0.22);
        A.prop(x, "building", { cx: px + bw / 2, cy: hor, s: bh, w: bw / bh, color: cols[i % cols.length], floors: 3 + (i % 3), lit: o.lit });
        px += bw + H * 0.02;
      }
      x.fillStyle = "#ddd4c7"; x.fillRect(X, hor, W, Y + H - hor);
      x.fillStyle = "#b9b2a8"; x.fillRect(X, Y + H * 0.94, W, H * 0.06);
      x.save(); x.strokeStyle = "rgba(80,70,60,0.3)"; x.lineWidth = lw;
      const vp = [X + W * 0.5, Y + H * 0.35];
      for (let i = -14; i <= 14; i++) { const fx = vp[0] + i * W * 0.08, t2 = (hor - vp[1]) / (Y + H * 0.94 - vp[1]); x.beginPath(); x.moveTo(vp[0] + (fx - vp[0]) * t2, hor); x.lineTo(fx, Y + H * 0.94); x.stroke(); }
      for (let j = 1; j < 4; j++) { const yy = hor + (Y + H * 0.94 - hor) * Math.pow(j / 4, 1.5); x.beginPath(); x.moveTo(X, yy); x.lineTo(X + W, yy); x.stroke(); }
      x.restore();
      x.strokeStyle = ink; x.lineWidth = lw; x.beginPath(); x.moveTo(X, hor); x.lineTo(X + W, hor); x.moveTo(X, Y + H * 0.94); x.lineTo(X + W, Y + H * 0.94); x.stroke();
    },
    park(x, b, o, k) {
      const { X, Y, W, H, lw, ink, t } = k, hor = Y + H * 0.62;
      x.fillStyle = "#d4e5ea"; x.fillRect(X, Y, W, H);
      x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(X, hor - H * 0.12, W, H * 0.12);
      cloud(x, X + ((W * 0.18 + t * 5) % (W * 1.2)) - W * 0.05, Y + H * 0.16, H * 0.055, lw, ink);
      cloud(x, X + ((W * 0.7 + t * 3) % (W * 1.2)) - W * 0.05, Y + H * 0.26, H * 0.04, lw, ink);
      x.fillStyle = "#b8cfa6"; x.beginPath(); x.moveTo(X, hor); x.quadraticCurveTo(X + W * 0.3, hor - H * 0.16, X + W * 0.62, hor - H * 0.02); x.quadraticCurveTo(X + W * 0.85, hor - H * 0.12, X + W, hor - H * 0.05); x.lineTo(X + W, Y + H); x.lineTo(X, Y + H); x.closePath(); x.fill();
      x.strokeStyle = M.alpha(ink, 0.5); x.lineWidth = lw; x.stroke();
      for (let i = 0; i < 6; i++) A.prop(x, "tree", { cx: X + W * (0.06 + i * 0.18 + hash(i, 7) * 0.05), cy: hor + H * (0.02 + hash(i, 8) * 0.03), s: H * (0.16 + hash(i, 9) * 0.08), time: o.time, color: i % 2 ? "#89ad7f" : "#7a9f78" });
      x.fillStyle = "#9fc289"; x.beginPath(); x.moveTo(X, hor + H * 0.08); x.quadraticCurveTo(X + W * 0.5, hor - H * 0.02, X + W, hor + H * 0.1); x.lineTo(X + W, Y + H); x.lineTo(X, Y + H); x.closePath(); x.fill();
      x.strokeStyle = M.alpha(ink, 0.6); x.stroke();
      const vp = X + W * 0.55;
      x.fillStyle = "#e8d9bb"; x.beginPath(); x.moveTo(vp - W * 0.015, hor + H * 0.05); x.lineTo(vp + W * 0.015, hor + H * 0.05); x.quadraticCurveTo(vp + W * 0.05, Y + H * 0.85, vp + W * 0.25, Y + H); x.lineTo(vp - W * 0.2, Y + H); x.quadraticCurveTo(vp - W * 0.05, Y + H * 0.85, vp - W * 0.015, hor + H * 0.05); x.closePath(); x.fill();
      x.strokeStyle = M.alpha(ink, 0.5); x.stroke();
      x.save(); x.strokeStyle = "rgba(70,110,60,0.35)"; x.lineWidth = lw;
      for (let i = 0; i < 40; i++) { const gx = X + hash(i, 11) * W, gy = hor + H * 0.12 + hash(i, 12) * H * 0.36; if (Math.abs(gx - vp) < W * 0.08 + (gy - hor) * 0.35) continue; x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx - 2, gy - 5); x.moveTo(gx + 2, gy); x.lineTo(gx + 3, gy - 4); x.stroke(); }
      x.restore();
    },
    studio(x, b, o, k) {
      const { X, Y, W, H } = k, hor = Y + H * 0.7;
      x.fillStyle = "#e4ded5"; x.fillRect(X, Y, W, H);
      const g = x.createLinearGradient(0, hor - H * 0.12, 0, hor + H * 0.08);
      g.addColorStop(0, "rgba(120,100,80,0)"); g.addColorStop(1, "rgba(120,100,80,0.1)");
      x.fillStyle = g; x.fillRect(X, hor - H * 0.12, W, Y + H - hor + H * 0.12);
      const r = x.createRadialGradient(X + W * 0.5, Y + H * 0.4, 0, X + W * 0.5, Y + H * 0.4, Math.max(W, H) * 0.7);
      r.addColorStop(0, "rgba(255,255,255,0.35)"); r.addColorStop(1, "rgba(60,45,30,0.14)");
      x.fillStyle = r; x.fillRect(X, Y, W, H);
    },
  };
  A.backdrop = (x, kind, o = {}) => {
    const fn = BACKDROPS[kind] || BACKDROPS.studio, c = M.col();
    const X = o.x || 0, Y = o.y || 0, W = o.w || 300, H = o.h || 200;
    const lw = clamp(0.9 + H * 0.0015, 1, 1.4);
    x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip();
    x.lineJoin = "round"; x.lineCap = "round";
    fn(x, o, o, { X, Y, W, H, lw, ink: ART_INK, t: (o.time || 0) / 1000 });
    if (isDark() && o.dim !== false) { x.fillStyle = "rgba(12,10,8,0.16)"; x.fillRect(X, Y, W, H); }
    x.restore();
    return { horizon: Y + H * (kind === "room" ? 0.68 : kind === "street" ? 0.74 : kind === "park" ? 0.62 : 0.7) };
  };

  /* ---------- 뷰파인더 ---------- */
  const tcOf = (ms, fps = 24) => {
    const f = Math.floor((ms / 1000) * fps), s = Math.floor(f / fps), p2 = (n) => String(n).padStart(2, "0");
    return `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}:${p2(f % fps)}`;
  };
  A.timecode = tcOf;
  A.frame = (x, o = {}) => {
    const c = M.col(), fx = o.x || 0, fy = o.y || 0, fw = o.w || 320, fh = o.h || 180;
    const bez = clamp(Math.min(fw, fh) * 0.028, 4, 12);
    const bar = o.label || o.rec || o.tc != null || o.time != null;
    const top = bar ? clamp(fh * 0.075, 20, 26) : bez;
    x.save();
    M.rrect(x, fx, fy, fw, fh, Math.min(14, bez * 1.6)); x.fillStyle = "#151413"; x.fill();
    x.lineWidth = 1; x.strokeStyle = M.alpha(c.ink, isDark() ? 0.35 : 0.9); x.stroke();
    let r = { x: fx + bez, y: fy + top, w: fw - bez * 2, h: fh - top - bez };
    if (o.aspect) {
      const a = +o.aspect; let w = r.w, h = r.w / a;
      if (h > r.h) { h = r.h; w = h * a; }
      r = { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
    }
    if (bar) {
      const cy = fy + top / 2 + 0.5;
      let lx = fx + bez + 4;
      x.textBaseline = "middle";
      if (o.rec) {
        const on = o.time == null || Math.floor(o.time / 600) % 2 === 0;
        M.dot(x, lx + 4, cy, 4, on ? "#e5484d" : "rgba(229,72,77,0.35)");
        x.font = M.font(11, "ui", 700); x.fillStyle = "#f2ece2"; x.textAlign = "left"; x.fillText("REC", lx + 12, cy); lx += 44;
      }
      if (o.tc != null || o.time != null) {
        x.font = M.font(11, "mono", 500); x.fillStyle = "#cfc8bd"; x.textAlign = "left";
        x.fillText(typeof o.tc === "string" ? o.tc : tcOf(o.tc != null ? o.tc : o.time), lx, cy);
      }
      if (o.label) {
        x.font = M.font(11, "ui", 700); const tw = x.measureText(o.label).width + 14, th = 16;
        const tx = fx + fw - bez - tw - 2;
        M.rrect(x, tx, cy - th / 2, tw, th, th / 2); x.fillStyle = "#f2ece2"; x.fill();
        x.fillStyle = "#151413"; x.textAlign = "left"; x.fillText(o.label, tx + 7, cy + 0.5);
      }
    }
    x.restore();
    const overlay = () => {
      x.save();
      const L = clamp(Math.min(r.w, r.h) * 0.08, 8, 22), m = clamp(Math.min(r.w, r.h) * 0.04, 5, 14);
      x.strokeStyle = "rgba(255,255,255,0.85)"; x.lineWidth = 1.5; x.lineCap = "square";
      for (const [ax, ay, sx, sy] of [[r.x + m, r.y + m, 1, 1], [r.x + r.w - m, r.y + m, -1, 1], [r.x + m, r.y + r.h - m, 1, -1], [r.x + r.w - m, r.y + r.h - m, -1, -1]]) {
        x.beginPath(); x.moveTo(ax, ay + sy * L); x.lineTo(ax, ay); x.lineTo(ax + sx * L, ay); x.stroke();
      }
      if (o.thirds) {
        x.strokeStyle = "rgba(255,255,255,0.4)"; x.lineWidth = 1;
        for (const k of [1, 2]) { x.beginPath(); x.moveTo(r.x + (r.w * k) / 3, r.y); x.lineTo(r.x + (r.w * k) / 3, r.y + r.h); x.moveTo(r.x, r.y + (r.h * k) / 3); x.lineTo(r.x + r.w, r.y + (r.h * k) / 3); x.stroke(); }
      }
      if (o.center !== false) {
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = clamp(L * 0.35, 4, 7);
        x.strokeStyle = "rgba(255,255,255,0.7)"; x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx - s, cy); x.lineTo(cx + s, cy); x.moveTo(cx, cy - s); x.lineTo(cx, cy + s); x.stroke();
      }
      x.restore();
    };
    if (o.draw) { x.save(); x.beginPath(); x.rect(r.x, r.y, r.w, r.h); x.clip(); o.draw(x, r); x.restore(); overlay(); }
    return { ...r, overlay };
  };

  /* ---------- 타임라인 클립 ---------- */
  A.clip = (x, o = {}) => {
    const c = M.col(), X = o.x || 0, Y = o.y || 0, W = o.w || 120, H = o.h || 30, col = o.color || c.a;
    if (W < 1 || H < 1) return;
    const r = Math.min(5, H / 3, W / 2);
    x.save();
    M.rrect(x, X, Y, W, H, r); x.fillStyle = c.surface; x.fill(); x.fillStyle = M.alpha(col, o.dim ? 0.1 : 0.24); x.fill();
    x.save(); x.clip();
    x.fillStyle = M.alpha(col, o.dim ? 0.4 : 0.9); x.fillRect(X, Y, W, Math.max(2, Math.min(4, H * 0.12)));
    let tx = X + 7;
    if (o.thumb && H >= 24 && W > H * 1.9) {
      const th = H - 8, tw = Math.min(th * 16 / 9, W * 0.45), rr = { x: X + 4, y: Y + 5, w: tw, h: th - 1 };
      x.save(); x.beginPath(); x.rect(rr.x, rr.y, rr.w, rr.h); x.clip(); x.fillStyle = "#151413"; x.fillRect(rr.x, rr.y, rr.w, rr.h); o.thumb(x, rr); x.restore();
      x.strokeStyle = M.alpha(c.ink, 0.5); x.lineWidth = 1; x.strokeRect(rr.x + 0.5, rr.y + 0.5, rr.w - 1, rr.h - 1);
      tx = rr.x + rr.w + 6;
    }
    if (o.label && W - (tx - X) > 14) {
      const two = o.sub && H >= 34;
      x.font = M.font(11, "ui", 600); x.fillStyle = c.ink; x.textAlign = "left"; x.textBaseline = "middle";
      x.fillText(o.label, tx, two ? Y + H / 2 - 6 : Y + H / 2 + 1);
      if (two) { x.font = M.font(11, "mono", 500); x.fillStyle = c.muted; x.fillText(o.sub, tx, Y + H / 2 + 8); }
    }
    x.restore();
    M.rrect(x, X + 0.5, Y + 0.5, W - 1, H - 1, r); x.lineWidth = o.selected ? 2 : 1.25; x.strokeStyle = o.selected ? c.key : c.ink; x.stroke();
    x.restore();
  };

  /* ---------- 오디오 파형 ---------- */
  A.waveform = (x, o = {}) => {
    const c = M.col(), X = o.x || 0, Y = o.y || 0, W = o.w || 200, H = o.h || 40;
    const seed = o.seed ?? 1, dens = o.density ?? 0.45, gain = o.gain ?? 1, col = o.color || c.c;
    const n = Math.max(8, Math.round(W * dens)), bw = W / n, mid = Y + H / 2;
    const vn = (t, s) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u); };
    x.save(); x.fillStyle = col;
    const amp = (i) => {
      const gate = vn(i / (n * 0.09 + 3), seed + 5) > 0.32 ? 1 : 0.12;
      const env = 0.25 + 0.75 * Math.pow(vn(i / 6, seed), 1.2);
      return clamp(gain * gate * env * (0.45 + 0.55 * hash(i, seed + 9)), 0, 1);
    };
    if (bw >= 2) {
      for (let i = 0; i < n; i++) { const a = Math.max(1, amp(i) * H * 0.92); M.rrect(x, X + i * bw + bw * 0.2, mid - a / 2, Math.max(1, bw * 0.6), a, Math.min(bw * 0.3, 1.5)); x.fill(); }
    } else {
      x.beginPath(); x.moveTo(X, mid);
      for (let i = 0; i < n; i++) x.lineTo(X + i * bw, mid - amp(i) * H * 0.46);
      for (let i = n - 1; i >= 0; i--) x.lineTo(X + i * bw, mid + amp(i) * H * 0.46);
      x.closePath(); x.fill();
    }
    x.fillStyle = M.alpha(col, 0.5); x.fillRect(X, mid - 0.5, W, 1);
    x.restore();
  };

  M.art = A;
})();
