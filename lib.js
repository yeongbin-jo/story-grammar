/* 공용 도구: 수학, 이징, 스프링, 캔버스 그리기, 조작 UI */
window.LESSONS = [];
window.PLANNED = {}; // 장 번호 → 준비 중 레슨 제목 목록

const M = {};
M.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
M.lerp = (a, b, t) => a + (b - a) * t;
M.smooth = (t) => t * t * (3 - 2 * t);

/* CSS cubic-bezier 와 같은 계산 */
M.bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 40; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
};
M.ease = {
  linear: (t) => t,
  in: M.bezier(0.42, 0, 1, 1),
  out: M.bezier(0.16, 1, 0.3, 1),
  inOut: M.bezier(0.65, 0, 0.35, 1),
};

/* 감쇠 스프링: 0 → 1. 고정 간격으로 미리 계산 */
M.spring = (k, c, m, T = 6, dt = 1 / 240) => {
  const n = Math.ceil(T / dt);
  const xs = new Float32Array(n + 1);
  let x = 0, v = 0, settle = T;
  let lastBusy = 0;
  for (let i = 0; i <= n; i++) {
    xs[i] = x;
    if (Math.abs(x - 1) > 0.002 || Math.abs(v) > 0.02) lastBusy = i;
    const a = (-k * (x - 1) - c * v) / m;
    v += a * dt; x += v * dt;
  }
  settle = Math.min(T, (lastBusy + 1) * dt);
  const at = (s) => xs[M.clamp(Math.round(s / dt), 0, n)];
  return { at, settle, zeta: c / (2 * Math.sqrt(k * m)) };
};

/* 반복 재생: duration 동안 0→1, hold 동안 1에 머묾 */
M.cycle = (time, dur, hold = 700) => Math.min(1, (time % (dur + hold)) / dur);
/* 왕복 재생: {p, back} */
M.pingpong = (time, dur, hold = 700) => {
  const P = dur + hold, n = Math.floor(time / P);
  return { p: Math.min(1, (time % P) / dur), back: n % 2 === 1 };
};

/* 색 토큰 (테마 바뀌면 다시 읽음) */
let _cols = null;
M.col = () => {
  if (_cols) return _cols;
  const s = getComputedStyle(document.documentElement);
  const g = (n) => s.getPropertyValue(n).trim();
  _cols = { bg: g("--bg"), surface: g("--surface"), sunk: g("--sunk"), ink: g("--ink"), muted: g("--muted"), line: g("--line"), grid: g("--grid"), key: g("--key"), a: g("--a"), b: g("--b"), c: g("--c") };
  return _cols;
};
M.resetCols = () => (_cols = null);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => (_cols = null));
new MutationObserver(() => (_cols = null)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

M.alpha = (hex, a) => {
  if (typeof hex !== "string" || !hex.trim().startsWith("#")) return hex ? `color-mix(in srgb, ${hex} ${Math.round(a * 100)}%, transparent)` : `rgba(128,128,128,${a})`;
  const h = hex.trim().replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

M.font = (px, kind = "ui", weight = 500) => kind === "mono"
  ? `${weight} ${px}px SFMono-Regular, Menlo, Monaco, Consolas, "Pretendard Variable", monospace`
  : `${weight} ${px}px "Inter", "Pretendard Variable", -apple-system, "Apple SD Gothic Neo", sans-serif`;

/* 캔버스: 부모 폭에 맞추고 DPR 반영 */
/* h 가 "fill" 이면 무대 높이를 가득 채움(최소 360px). 그리기는 M.fit 의 w·h 기준으로 반응형으로. */
M.canvas = (parent, h) => {
  const c = document.createElement("canvas");
  if (h === "fill") c.className = "fill"; else c.style.height = h + "px";
  parent.appendChild(c);
  return c;
};
M.fit = (c) => {
  const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext("2d");
  /* 안쪽 여백: 가장자리에 붙여 그린 선·상자가 잘리지 않게. 포인터 좌표는 c._inset 만큼 빼서 쓴다 */
  const m = r.width < 520 ? 4 : 8; c._inset = m;
  x.setTransform(d, 0, 0, d, d * m, d * m);
  x.clearRect(-m, -m, r.width, r.height);
  return { x, w: r.width - 2 * m, h: r.height - 2 * m };
};

M.text = (x, s, px, py, o = {}) => {
  x.font = M.font(o.size || 12, o.mono ? "mono" : "ui", o.weight || 500);
  x.fillStyle = o.color || M.col().muted;
  x.textAlign = o.align || "left";
  x.textBaseline = o.base || "alphabetic";
  x.fillText(s, px, py);
};
M.dot = (x, cx, cy, r, fill, stroke) => {
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1.5; x.stroke(); }
};
M.rrect = (x, px, py, w, h, r) => {
  x.beginPath();
  if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h);
};
M.line = (x, x0, y0, x1, y1, color, w = 1, dash) => {
  x.save(); x.strokeStyle = color; x.lineWidth = w; if (dash) x.setLineDash(dash);
  x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.restore();
};
M.arrow = (x, x0, y0, x1, y1, color, w = 1.5) => {
  M.line(x, x0, y0, x1, y1, color, w);
  const a = Math.atan2(y1 - y0, x1 - x0), s = 7;
  x.beginPath(); x.moveTo(x1, y1);
  x.lineTo(x1 - s * Math.cos(a - 0.45), y1 - s * Math.sin(a - 0.45));
  x.lineTo(x1 - s * Math.cos(a + 0.45), y1 - s * Math.sin(a + 0.45));
  x.closePath(); x.fillStyle = color; x.fill();
};

/* 진행도-시간 그래프. curves: [{f(t)->v, color, w}] */
M.graph = (x, b, curves, o = {}) => {
  const c = M.col();
  const ymin = o.ymin ?? 0, ymax = o.ymax ?? 1;
  const X = (t) => b.x + t * b.w;
  const Y = (v) => b.y + b.h - ((v - ymin) / (ymax - ymin)) * b.h;
  x.save();
  x.fillStyle = M.alpha(c.surface, 0.85); x.fillRect(b.x, b.y, b.w, b.h);
  x.strokeStyle = c.line; x.lineWidth = 1; x.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  for (let i = 1; i < 4; i++) M.line(x, X(i / 4), b.y, X(i / 4), b.y + b.h, c.sunk, 1);
  for (const v of [0, 1]) if (v >= ymin && v <= ymax) {
    M.line(x, b.x, Y(v), b.x + b.w, Y(v), c.grid, 1, [3, 4]);
    M.text(x, v ? (o.top || "100%") : (o.bottom || "0%"), b.x - 6, Y(v) + 4, { size: 11, mono: true, align: "right" });
  }
  M.text(x, o.xl || "시간 →", b.x + b.w, b.y + b.h + 15, { size: 11, mono: true, align: "right" });
  if (o.yl) M.text(x, o.yl, b.x + 6, b.y + 14, { size: 10.5, mono: true });
  x.beginPath(); x.rect(b.x, b.y - 2, b.w, b.h + 4); x.clip();
  const N = Math.max(60, Math.round(b.w / 2));
  for (const cv of curves) {
    x.strokeStyle = cv.color; x.lineWidth = cv.w || 2.2; x.lineJoin = "round";
    if (cv.dash) x.setLineDash(cv.dash); else x.setLineDash([]);
    x.beginPath();
    for (let i = 0; i <= N; i++) { const t = i / N, v = cv.f(t); i ? x.lineTo(X(t), Y(v)) : x.moveTo(X(t), Y(v)); }
    x.stroke();
  }
  x.setLineDash([]);
  if (o.t != null) {
    M.line(x, X(o.t), b.y, X(o.t), b.y + b.h, c.key, 1.5);
    for (const cv of curves) if (!cv.noDot) M.dot(x, X(o.t), Y(cv.f(o.t)), 4.5, cv.color, c.surface);
  }
  x.restore();
  return { X, Y };
};

/* ---------- 조작 UI ---------- */
M.el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
};

M.slider = (parent, o) => {
  const out = M.el("output", { for: o.id });
  const inp = M.el("input", { type: "range", id: o.id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
  const fmt = o.fmt || ((v) => v + (o.unit || ""));
  const wrap = M.el("div", { class: "ctl" }, M.el("label", { for: o.id }, M.el("span", {}, o.label), out), inp);
  parent.append(wrap);
  const show = () => (out.textContent = fmt(+inp.value));
  inp.addEventListener("input", () => { show(); o.onInput && o.onInput(+inp.value); });
  show();
  return { get: () => +inp.value, set: (v) => { inp.value = v; show(); }, el: wrap };
};

M.chips = (parent, o) => {
  const box = M.el("div", { class: "chips", role: "group", "aria-label": o.label || "" });
  const btns = o.items.map((it, i) =>
    M.el("button", { class: "chip", "aria-pressed": "false", onclick: () => { set(i); o.onPick && o.onPick(i, it); } }, it.label || it));
  btns.forEach((b) => box.append(b));
  const wrap = M.el("div", { class: "ctl" });
  if (o.title) wrap.append(M.el("span", { class: "lbl" }, o.title));
  wrap.append(box);
  parent.append(wrap);
  const set = (i) => btns.forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
  if (o.value != null) set(o.value);
  return { set, el: wrap };
};

M.check = (parent, o) => {
  const inp = M.el("input", { type: "checkbox", id: o.id });
  inp.checked = !!o.checked;
  inp.addEventListener("change", () => o.onChange && o.onChange(inp.checked));
  const lab = M.el("label", { class: "ctl-check", for: o.id }, inp, o.label);
  parent.append(lab);
  return { get: () => inp.checked, set: (v) => (inp.checked = v), el: lab };
};

M.readout = (parent) => { const r = M.el("div", { class: "readout" }); parent.append(r); return r; };

M.copyRow = (parent) => {
  const r = M.el("div", { class: "readout" });
  const b = M.el("button", { class: "chip" }, "복사");
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(r.textContent); b.textContent = "복사됨"; }
    catch { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(r); s.removeAllRanges(); s.addRange(rg); b.textContent = "선택됨"; }
    setTimeout(() => (b.textContent = "복사"), 1200);
  });
  parent.append(M.el("div", { class: "copy-row" }, r, b));
  return r;
};

/* ---------- 아주 작은 3D: 카메라·원근 투영 ---------- */
M.v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
};
/* 카메라 {pos:[x,y,z], yaw, pitch, fov(deg)}. y 위, z 앞(yaw 0 에서 +z 를 봄) */
M.cam = {
  toView(cam, p) {
    const d = M.v3.sub(p, cam.pos);
    const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
    let x = d[0] * cy + d[2] * sy, z = -d[0] * sy + d[2] * cy, y = d[1];
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    return [x, y2, z2];
  },
  project(cam, v, w, h) {
    if (cam.ortho) return [w / 2 + v[0] * cam.ortho, h / 2 - v[1] * cam.ortho, v[2]];
    const f = (h / 2) / Math.tan((cam.fov * Math.PI) / 360);
    return [w / 2 + (v[0] / v[2]) * f, h / 2 - (v[1] / v[2]) * f, v[2]];
  },
};
/* 상자 목록을 화가 알고리즘으로 그림. box: {c:[x,y,z], s:[w,h,d], color} */
M.drawScene = (x, cam, boxes, w, h, o = {}) => {
  const near = o.near ?? 0.1, far = o.far ?? 1e9;
  const faces = [];
  const FACES = [[0, 1, 2, 3, 0.78], [4, 5, 6, 7, 0.78], [0, 1, 5, 4, 0.62], [3, 2, 6, 7, 1], [1, 2, 6, 5, 0.9], [0, 3, 7, 4, 0.9]];
  for (const b of boxes) {
    const [cx, cy, cz] = b.c, [sw, sh, sd] = b.s;
    const P = [];
    for (const [dx, dy, dz] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]])
      P.push(M.cam.toView(cam, [cx + (dx * sw) / 2, cy + (dy * sh) / 2, cz + (dz * sd) / 2]));
    const avgZ = P.reduce((s, p) => s + p[2], 0) / 8;
    if (avgZ < near || avgZ > far) { if (o.onCull) o.onCull(b); continue; }
    if (P.some((p) => p[2] < near)) continue;
    for (const f of FACES) {
      const pts = f.slice(0, 4).map((i) => M.cam.project(cam, P[i], w, h));
      const z = f.slice(0, 4).reduce((s, i) => s + P[i][2], 0) / 4;
      faces.push({ pts, z, color: b.color, shade: f[4], stroke: b.stroke });
    }
  }
  faces.sort((a, b) => b.z - a.z);
  const c = M.col();
  for (const f of faces) {
    x.beginPath(); f.pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath();
    x.fillStyle = f.color; x.fill();
    x.fillStyle = `rgba(0,0,0,${(1 - f.shade) * 0.55})`; x.fill();
    x.strokeStyle = M.alpha(c.ink, 0.35); x.lineWidth = 1; x.stroke();
  }
};
M.drawGround = (x, cam, w, h, color, size = 20, step = 2) => {
  x.save(); x.strokeStyle = color; x.lineWidth = 1;
  const seg = (a, b) => {
    const N = 24;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const p = [M.lerp(a[0], b[0], i / N), 0, M.lerp(a[2], b[2], i / N)];
      const v = M.cam.toView(cam, p);
      if (v[2] < 0.2) { prev = null; continue; }
      const s = M.cam.project(cam, v, w, h);
      if (prev) { x.beginPath(); x.moveTo(prev[0], prev[1]); x.lineTo(s[0], s[1]); x.stroke(); }
      prev = s;
    }
  };
  for (let i = -size; i <= size; i += step) { seg([i, 0, -size], [i, 0, size]); seg([-size, 0, i], [size, 0, i]); }
  x.restore();
};

/* ---------- 주석(다이어그램 안 설명) ---------- */
/* 알약 모양 태그: 진한 테두리 + 오프셋 그림자 (사이트 버튼과 같은 말투). 반환: {x,y,w,h} */
M.tag = (x, s, px, py, o = {}) => {
  const c = M.col(), size = o.size || 11.5, padX = o.padX ?? 8, h = o.h || size + 11;
  x.font = M.font(size, o.mono ? "mono" : "ui", o.weight || 600);
  const w = x.measureText(s).width + padX * 2;
  let left = px;
  if (o.align === "center") left = px - w / 2; else if (o.align === "right") left = px - w;
  const top = py - h / 2;
  x.save();
  M.rrect(x, left + 1.5, top + 2, w, h, h / 2); x.fillStyle = c.ink; x.fill();
  M.rrect(x, left, top, w, h, h / 2); x.fillStyle = c.surface; x.fill(); if (o.fill) { x.fillStyle = o.fill; x.fill(); }
  x.lineWidth = 1; x.strokeStyle = c.ink; x.stroke();
  x.fillStyle = o.color || c.ink; x.textAlign = "left"; x.textBaseline = "middle";
  x.fillText(s, left + padX, top + h / 2 + 0.5);
  x.restore();
  return { x: left, y: top, w, h };
};
/* 지시선 주석: (ax,ay) 대상 점에서 (lx,ly) 라벨로 꺾인 선 + 끝점 + 태그 */
M.callout = (x, s, ax, ay, lx, ly, o = {}) => {
  const c = M.col(), col = o.line || c.ink;
  x.save();
  x.strokeStyle = M.alpha(col, 0.7); x.lineWidth = 1; x.setLineDash(o.dash || []);
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(lx, ay + (ly - ay) * 0.0); x.lineTo(lx, ly); x.stroke();
  x.restore();
  M.dot(x, ax, ay, 3, col);
  return M.tag(x, s, lx, ly, { align: lx < ax ? "right" : "left", ...o });
};
