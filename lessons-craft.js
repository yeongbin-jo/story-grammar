/* 4~6장: 장면과 완급 · 시점과 서술 · 정보 설계 (예시는 모두 새로 지은 짧은 이야기) */
(() => {
  /* ---------- 공용 도구 ---------- */
  const follow = (cur, tgt, dt, ms = 300) => cur + (tgt - cur) * (1 - Math.pow(0.004, (dt || 16) / ms));
  const hx = (h) => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map((q) => q + q).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  /* 불투명 틴트: 표면색에 색을 t 만큼 섞음 */
  const tint = (col, t) => { const a = hx(M.col().surface), b = hx(col); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`; };
  /* 장 색 등 M.col 에 없는 토큰 */
  let _cs = null, _cc = null;
  const cc = () => {
    const c = M.col();
    if (c !== _cs) {
      _cs = c; const s = getComputedStyle(document.documentElement), g = (n) => s.getPropertyValue(n).trim();
      _cc = { ch2: g("--ch2"), ch3: g("--ch3"), ch4: g("--ch4"), ch5: g("--ch5"), ink2: g("--ink2"), faint: g("--faint"), line2: g("--line2") };
    }
    return _cc;
  };
  const clamp01 = (v) => M.clamp(v, 0, 1);
  const ease = (v) => M.ease.out(clamp01(v));
  /* 받침 → 조사 */
  const bat = (s) => { const ch = String(s).trim().slice(-1).charCodeAt(0); return ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 : 0; };
  const eul = (s) => s + (bat(s) ? "을" : "를");
  const ro = (s) => s + (bat(s) && bat(s) !== 8 ? "으로" : "로");

  /* 줄바꿈: 띄어쓰기 기준, 너무 긴 낱말은 글자 단위 */
  const wrap = (x, s, maxW) => {
    const out = [];
    for (const para of String(s).split("\n")) {
      let line = "";
      for (const w0 of para.split(" ")) {
        const cand = line ? line + " " + w0 : w0;
        if (x.measureText(cand).width <= maxW) { line = cand; continue; }
        if (line) out.push(line);
        let wd = w0;
        while (x.measureText(wd).width > maxW && wd.length > 1) {
          let k = wd.length; while (k > 1 && x.measureText(wd.slice(0, k)).width > maxW) k--;
          out.push(wd.slice(0, k)); wd = wd.slice(k);
        }
        line = wd;
      }
      out.push(line);
    }
    return out;
  };
  /* 문단 그리기. 반환: 높이 */
  const para = (x, s, px, py, maxW, o = {}) => {
    const size = o.size || 13, lh = o.lh || Math.round(size * 1.5);
    x.font = M.font(size, "ui", o.weight || 500);
    let lines = wrap(x, s, maxW);
    if (o.max && lines.length > o.max) { lines = lines.slice(0, o.max); lines[o.max - 1] = clip(x, lines[o.max - 1] + "…", maxW); }
    if (!o.measure) lines.forEach((ln, i) => M.text(x, ln, px, py + i * lh, { size, weight: o.weight || 500, color: o.color || M.col().ink, align: o.align }));
    return lines.length * lh;
  };
  const paraH = (x, s, maxW, o = {}) => para(x, s, 0, 0, maxW, { ...o, measure: true });
  const clip = (x, s, maxW) => {
    if (x.measureText(s).width <= maxW) return s;
    let k = s.length; while (k > 1 && x.measureText(s.slice(0, k) + "…").width > maxW) k--;
    return s.slice(0, k) + "…";
  };
  const line1 = (x, s, px, py, maxW, o = {}) => {
    x.font = M.font(o.size || 12, "ui", o.weight || 500);
    M.text(x, clip(x, s, maxW), px, py, { color: M.col().ink, ...o });
  };
  /* 카드: 진한 테두리 + 오프셋 그림자 */
  const box = (x, X, Y, W, H, o = {}) => {
    const c = M.col(), r = o.r ?? 10;
    x.save();
    if (o.alpha != null) x.globalAlpha *= o.alpha;
    if (o.shadow !== false) { M.rrect(x, X + 2, Y + 2.5, W, H, r); x.fillStyle = c.ink; x.fill(); }
    M.rrect(x, X, Y, W, H, r); x.fillStyle = c.surface; x.fill();
    if (o.fill) { x.fillStyle = o.fill; x.fill(); }
    if (o.dash) x.setLineDash(o.dash);
    x.lineWidth = o.lw || 1.25; x.strokeStyle = o.stroke || c.ink; x.stroke();
    x.restore();
  };
  /* 번호 동그라미 */
  const badge = (x, n, cx, cy, o = {}) => {
    const c = M.col(), r = o.r || 9;
    M.dot(x, cx, cy, r, o.fill || c.surface, o.stroke || c.ink);
    M.text(x, String(n), cx, cy + 0.5, { size: o.size || 11, weight: 700, align: "center", base: "middle", color: o.color || c.ink });
  };
  const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "0");

  /* 서식 있는 글: segs = [[글, 스타일], ...] 스타일 {k, color, bg, bold, strike, under} */
  const rich = (x, segs, maxW, size) => {
    const toks = [];
    segs.forEach(([t, st]) => String(t).split(/(\n| +)/).forEach((p) => {
      if (!p) return;
      if (p === "\n") toks.push({ nl: 1 }); else if (/^ +$/.test(p)) toks.push({ sp: 1 }); else toks.push({ t: p, st: st || null });
    }));
    const lines = [[]]; let lw = 0, space = false;
    x.font = M.font(size, "ui", 500); const spW = x.measureText(" ").width;
    for (const tk of toks) {
      if (tk.nl) { lines.push([]); lw = 0; space = false; continue; }
      if (tk.sp) { space = true; continue; }
      x.font = M.font(size, "ui", tk.st && tk.st.bold ? 700 : 500);
      let t = tk.t, w = x.measureText(t).width;
      let cur = lines[lines.length - 1], gap = cur.length && space ? spW : 0;
      if (cur.length && lw + gap + w > maxW) { lines.push((cur = [])); lw = 0; gap = 0; }
      while (w > maxW && t.length > 1) {
        let k = t.length; while (k > 1 && x.measureText(t.slice(0, k)).width > maxW - lw) k--;
        cur.push({ t: t.slice(0, k), st: tk.st, x: lw, w: x.measureText(t.slice(0, k)).width, sp: false });
        lines.push((cur = [])); lw = 0; t = t.slice(k); w = x.measureText(t).width;
      }
      cur.push({ t, st: tk.st, x: lw + gap, w, sp: gap > 0 }); lw += gap + w; space = false;
    }
    return { lines, size };
  };
  /* rich 결과를 그림. 반환: {h, spans: {k: [{x,y,w,h}]}} */
  const drawRich = (x, R, px, py, o = {}) => {
    const c = M.col(), size = R.size, lh = o.lh || Math.round(size * 1.6), spans = {};
    R.lines.forEach((ln, i) => {
      const by = py + i * lh;
      ln.forEach((it, j) => {
        const st = it.st || {};
        const prev = ln[j - 1], joined = prev && prev.st === it.st && it.sp;
        const x0 = px + (joined ? prev.x + prev.w : it.x), x1 = px + it.x + it.w;
        if (st.bg) { x.fillStyle = st.bg; x.fillRect(x0 - (joined ? 0 : 2), by - size * 0.95, x1 - x0 + (joined ? 2 : 4), size * 1.32); }
        if (st.k != null) {
          const a = (spans[st.k] = spans[st.k] || []), r = { x: x0, y: by - size * 0.95, w: x1 - x0, h: size * 1.32 };
          const last = a[a.length - 1];
          if (last && joined && Math.abs(last.y - r.y) < 1) last.w = x1 - last.x; else a.push(r);
        }
      });
      ln.forEach((it, j) => {
        const st = it.st || {};
        x.font = M.font(size, "ui", st.bold ? 700 : 500); x.fillStyle = st.color || o.color || c.ink;
        x.textAlign = "left"; x.textBaseline = "alphabetic";
        x.fillText(it.t, px + it.x, by);
        const prev = ln[j - 1], joined = prev && prev.st === it.st && it.sp;
        const x0 = px + (joined ? prev.x + prev.w : it.x), x1 = px + it.x + it.w;
        if (st.strike) M.line(x, x0, by - size * 0.33, x1, by - size * 0.33, st.strike, 1.6);
        if (st.under) M.line(x, x0, by + 3, x1, by + 3, st.under, 2);
      });
    });
    return { h: R.lines.length * lh, spans };
  };

  /* =========================================================
     4장 · 장면과 완급
     ========================================================= */

  /* ===== 4-1 장면은 무엇을 바꾸는가 ===== */
  const ST_RES = [
    { k: "그냥 예", txt: "시장이 해명하고, 연우는 그대로 기사를 쓴다.", tension: 0.15, q: "남는 질문이 없다. 긴장이 풀린다.", vals: [["지식", "모름", "앎", -1, 1]] },
    { k: "예, 하지만", txt: "답은 받았다. 그런데 시장이 \"그 서류, 누가 줬는지 곧 알게 될 겁니다\"라고 한다.", tension: 0.85, q: "제보자는 무사할까?", vals: [["지식", "모름", "앎", -1, 1], ["안전", "안전", "위험", 1, -1]] },
    { k: "그냥 아니오", txt: "시장은 뒷문으로 나가 차에 탄다. 답은 없다.", tension: 0.5, q: "다른 길이 있을까?", vals: [["기회", "있음", "없음", 1, -1]] },
    { k: "아니오, 게다가", txt: "답도 못 받았고, 이튿날 시청 출입 정지 통보까지 받는다.", tension: 0.9, q: "이제 어떻게 취재하나?", vals: [["기회", "있음", "없음", 1, -1], ["자유", "출입 가능", "출입 정지", 1, -1]] },
  ];
  const ST_BEATS = [
    ["\"시장님!\" 하고 불러 세운다", "비서실장이 앞을 막아선다", -0.75],
    ["서류 사본을 꺼내 든다", "시장이 걸음을 멈춘다", 0.45],
    ["시장이 서류 출처를 캐묻는다", "연우가 말문이 막힌다", -0.95],
    ["\"내일 1면에 나갑니다\"", "시장이 돌아서서 입을 연다", 0.85],
  ];
  const ST_REPEAT = [
    ["\"시장님, 한 말씀만!\"", "비서실장이 막는다", -0.55],
    ["\"한 말씀만 해 주세요!\"", "비서실장이 또 막는다", -0.55],
    ["\"정말 한 말씀만요!\"", "비서실장이 또 막는다", -0.55],
    ["\"시장님!\"", "비서실장이 또 막는다", -0.55],
  ];

  LESSONS.push({
    id: "scene-turn", ch: 3, order: 1,
    title: "장면은 무엇을 바꾸는가",
    lede: "이 레슨을 마치면 장면 하나를 목표·갈등·결과로 나누고, 장면이 끝났을 때 어떤 값이 +에서 −로(또는 반대로) 바뀌었는지 확인하는 법을 알게 됩니다.",
    key: "장면은 시점 인물이 무언가를 시도해 상태를 바꾸는 단위입니다. 끝났을 때 아무 값도 바뀌지 않았다면 잘라도 되는 장면입니다.",
    steps: [
      ["장면 카드", "예시 장면입니다. 신입 기자 연우가 퇴근하는 시장에게 답을 받아 내려 합니다. 위쪽 세 칸이 장면의 뼈대 <b>목표 → 갈등 → 결과</b>이고, 아래 카드는 장면을 쓰기 전에 채우는 칸입니다. 시점 인물과 시간·장소, 그리고 끝에서 바뀌는 값까지 적습니다."],
      ["갈등은 비트로 움직인다", "갈등 칸을 펼쳤습니다. 한쪽이 행동하고 상대가 반응하면 <b>비트</b> 하나입니다. 비트마다 선이 위(연우 우세)와 아래(상대 우세)를 오갑니다. '해보기'에서 비트 반복을 켜면 같은 실랑이가 네 번 이어지고 선이 평평해집니다. 힘의 균형이 멈추면 장면도 멈춘 것입니다."],
      ["결과는 네 가지", "목표를 이뤘는지에 따라 결과는 넷으로 갈립니다. <b>그냥 예</b>는 긴장을 풀어 버립니다. <b>예, 하지만</b>과 <b>아니오, 게다가</b>는 다음 장면으로 가는 질문을 남깁니다. 카드를 눌러 결과를 바꿔 보며 긴장 막대와 남는 질문을 비교하세요."],
      ["값 전환", "장면 시작과 끝에서 인물이 놓인 <b>값</b>을 비교합니다. 값은 안전·지식·자유·관계처럼 +와 −가 있는 축입니다. '예, 하지만'이면 지식은 모름(−)에서 앎(+)으로 오르고 안전은 +에서 −로 떨어집니다. 적어도 한 축이 바뀌어야 장면입니다."],
      ["바뀌지 않는 장면", "왼쪽은 연우가 복도 벤치에서 시청 건물의 역사를 떠올리는 세 쪽짜리 장면입니다. 바뀐 값이 하나도 없습니다. <b>한 줄 테스트</b> '이 장면은 ___을 ___에서 ___로 바꾼다'의 빈칸을 못 채우면 고치거나 다른 장면에 합칩니다. 오른쪽처럼 같은 정보를 갈등 속에 섞으면 장면이 됩니다."],
    ],
    terms: [
      ["장면", "Scene", "한 시간·장소에서 시점 인물이 목표를 갖고 움직이고, 끝에 무언가가 달라지는 이야기의 기본 단위입니다."],
      ["비트", "Beat", "장면 안의 가장 작은 행동–반응 단위. 비트마다 힘의 균형이 조금씩 움직여야 합니다."],
      ["값 전환", "Value shift", "장면 시작과 끝에서 안전·신뢰·지식 같은 축이 +에서 −로(또는 반대로) 바뀌는 것. 로버트 맥키가 『Story』에서 강조한 기준입니다."],
      ["예, 하지만 · 아니오, 게다가", "Yes, but · No, and", "목표를 이루되 새 문제가 생기거나, 실패한 데다 상황까지 나빠지는 결과. 다음 장면으로 가는 질문을 남깁니다."],
      ["시퀀스", "Sequence", "하나의 중간 목표를 향해 이어지는 장면 묶음. 막 ⊃ 시퀀스 ⊃ 장면 ⊃ 비트 순으로 작아집니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, res = 1, repeat = false, since = 0, appear = 0, leafHits = [];
      const chips = M.chips(api.controls, { title: "장면의 결과", items: ST_RES.map((r) => r.k), value: 1, onPick: (i) => { res = i; since = 0; } });
      const rep = M.check(api.controls, { id: "stRepeat", label: "비트 반복 (같은 실랑이 네 번)", onChange: (v) => { repeat = v; since = 0; } });
      api.controls.append(M.el("p", { class: "hint" }, "결과를 바꾸면 위쪽 결과 칸, 카드의 값 전환, 남는 질문이 함께 바뀝니다."));
      cv.addEventListener("pointerdown", (e) => {
        if (step !== 2) return;
        const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        const hit = leafHits.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
        if (hit) { res = hit.i; chips.set(hit.i); since = 0; }
      });

      const PIPE = [["목표", "답을 받아 낸다"], ["갈등", "막아서는 비서실장"], ["결과", ""]];
      function pipeline(x, X, Y, W, H, focus) {
        const c = M.col(), nar = W < 480, gap = nar ? 16 : 30, bw = (W - gap * 2) / 3;
        for (let i = 0; i < 3; i++) {
          const bx = X + i * (bw + gap), on = focus < 0 || focus === i;
          box(x, bx, Y, bw, H, { alpha: on ? 1 : 0.45, fill: focus === i ? tint(c.key, 0.32) : null, lw: focus === i ? 2 : 1.25, r: 9 });
          x.save(); x.globalAlpha = on ? 1 : 0.45;
          badge(x, i + 1, bx + 15, Y + 15, { r: 8, size: 10.5, fill: tint(c.key, 0.5) });
          M.text(x, PIPE[i][0], bx + 28, Y + 19.5, { size: 12, weight: 700, color: c.muted });
          const sub = i === 2 ? ST_RES[res].k : nar && i === 1 ? "비서실장이 막음" : PIPE[i][1];
          line1(x, sub, bx + 10, Y + H - 11, bw - 18, { size: nar ? 12 : 13.5, weight: 700, color: i === 2 && res % 2 === 1 ? c.ink : c.ink });
          x.restore();
          if (i < 2) M.arrow(x, bx + bw + 4, Y + H / 2, bx + bw + gap - 4, Y + H / 2, c.ink, 1.5);
        }
        if (focus >= 0) {
          const cx = X + focus * (bw + gap) + bw / 2;
          return cx;
        }
        return null;
      }

      /* 값 한 줄: [축] (시작) → (끝) */
      function valRow(x, v, X, Y, W, prog, o = {}) {
        const c = M.col(), [name, sl, el, sv, ev] = v, size = o.size || 12;
        const changed = sv !== ev, nameW = o.nameW || 40;
        M.text(x, name, X, Y + 4, { size, weight: 700, color: c.ink });
        const pill = (s, val, px, alpha) => {
          x.save(); x.globalAlpha *= alpha;
          const col = val > 0 ? c.c : c.b;
          const t = M.tag(x, `${sign(val)} ${s}`, px, Y, { size: size - 0.5, fill: tint(col, 0.28), color: c.ink });
          x.restore(); return t;
        };
        const a = pill(sl, sv, X + nameW, 1);
        const ax = a.x + a.w + 8, aw = Math.max(18, Math.min(46, W * 0.14));
        M.arrow(x, ax, Y, ax + aw * clamp01(prog), Y, changed ? (ev > sv ? c.c : c.b) : c.muted, 1.6);
        if (prog > 0.6) {
          const b = pill(el, ev, ax + aw + 8, clamp01((prog - 0.6) / 0.4));
          if (!changed) M.text(x, "그대로", b.x + b.w + 8, Y + 4, { size: 11.5, color: c.muted, weight: 600 });
        }
      }

      function drawCard(x, D) {
        const c = M.col(), nar = D.w < 480, size = nar ? 12 : D.h > 330 ? 14 : 13, lh = Math.round(size * 1.45);
        const R = ST_RES[res];
        const rows = [
          [null, "시점 인물", "연우 · 입사 석 달 된 신입 기자"],
          [null, "시간·장소", "시청 1층 복도, 오후 6시"],
          [1, "목표", "퇴근하는 시장에게 공사 비리 의혹에 대한 답을 받아 낸다"],
          [2, "갈등", "비서실장이 막아서고, 시장은 뒷문 쪽으로 걸어간다"],
          [3, "결과", `${R.k} — ${R.txt}`],
          [null, "값 전환", R.vals.map((v) => `${v[0]} ${sign(v[3])}→${sign(v[4])}`).join(" · ")],
        ];
        const cw = Math.min(D.w, 640), lw = nar ? 66 : 90, tw = cw - lw - 26;
        let hs = rows.map((r) => Math.max(lh, paraH(x, r[2], tw, { size, lh })) + (nar ? 8 : D.h > 330 ? 18 : 12));
        const H = hs.reduce((a, b) => a + b, 0) + 14, X = D.x + (D.w - cw) / 2, Y = D.y + Math.max(0, (D.h - H) / 2);
        box(x, X, Y, cw, H, { r: 12 });
        let y = Y + 7;
        rows.forEach((r, i) => {
          const a = ease((since - i * 110) / 320);
          x.save(); x.globalAlpha *= 0.2 + 0.8 * a;
          if (i === 5) { x.fillStyle = tint(c.key, 0.18); x.fillRect(X + 1, y - 2, cw - 2, hs[i] - 2); }
          if (r[0]) badge(x, r[0], X + 16, y + lh / 2 + 2, { r: 8, size: 10.5, fill: tint(c.key, 0.5) });
          M.text(x, r[1], X + (r[0] ? 30 : 12), y + lh / 2 + 6, { size: 12, weight: 700, color: c.muted });
          para(x, r[2], X + lw + 12, y + size + 3, tw, { size, lh, weight: i >= 4 ? 600 : 500 });
          x.restore();
          y += hs[i];
          if (i < rows.length - 1) M.line(x, X + 10, y - 3, X + cw - 10, y - 3, c.line, 1);
        });
      }

      function drawBeats(x, D) {
        const c = M.col(), nar = D.w < 520, B = repeat ? ST_REPEAT : ST_BEATS, n = B.length;
        const p = Math.min(n, since / 900);
        const g = nar ? { x: D.x + 8, y: D.y + 8, w: D.w - 16, h: D.h * 0.52 } : { x: D.x + 74, y: D.y + 14, w: D.w * 0.52 - 74, h: D.h - 40 };
        // 축
        const mid = g.y + g.h / 2, Y = (v) => mid - v * (g.h / 2) * 0.82;
        x.fillStyle = tint(c.c, 0.12); x.fillRect(g.x, g.y, g.w, g.h / 2);
        x.fillStyle = tint(c.b, 0.1); x.fillRect(g.x, mid, g.w, g.h / 2);
        M.line(x, g.x, mid, g.x + g.w, mid, c.muted, 1, [4, 4]);
        x.strokeStyle = c.line; x.lineWidth = 1; x.strokeRect(g.x + 0.5, g.y + 0.5, g.w - 1, g.h - 1);
        if (nar) {
          M.text(x, "연우 우세", g.x + 6, g.y + 15, { size: 12, weight: 600, color: c.muted });
          M.text(x, "상대 우세", g.x + 6, g.y + g.h - 7, { size: 12, weight: 600, color: c.muted });
        } else {
          M.text(x, "연우 우세", g.x - 8, g.y + 16, { size: 12, weight: 700, color: c.ink, align: "right" });
          M.text(x, "팽팽", g.x - 8, mid + 4, { size: 12, weight: 600, color: c.muted, align: "right" });
          M.text(x, "상대 우세", g.x - 8, g.y + g.h - 8, { size: 12, weight: 700, color: c.ink, align: "right" });
        }
        const pts = [[g.x + 14, Y(0)]].concat(B.map((b, i) => [g.x + 14 + ((i + 1) / n) * (g.w - 28), Y(b[2])]));
        x.save(); x.strokeStyle = c.ink; x.lineWidth = 2.2; x.lineJoin = "round"; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i <= n; i++) {
          const f = clamp01(p - (i - 1)); if (f <= 0) break;
          const e = M.ease.inOut(f), [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          x.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e);
        }
        x.stroke(); x.restore();
        M.dot(x, pts[0][0], pts[0][1], 4, c.ink);
        if (!nar) M.text(x, "시작", pts[0][0], g.y + g.h + 16, { size: 12, color: c.muted, align: "center" });
        const curI = Math.min(n, Math.max(1, Math.ceil(p)));
        for (let i = 1; i <= n; i++) {
          if (p < i - 0.05) continue;
          const v = B[i - 1][2];
          badge(x, i, pts[i][0], pts[i][1], { r: 10, fill: i === curI ? c.key : tint(v > 0 ? c.c : c.b, 0.45) });
          if (!nar) M.text(x, `비트 ${i}`, pts[i][0], g.y + g.h + 16, { size: 12, color: c.muted, align: "center" });
        }
        if (repeat && p >= n) M.tag(x, "네 비트 내내 균형이 그대로", g.x + g.w / 2, g.y + 18, { align: "center", size: 12, fill: tint(c.b, 0.3) });
        // 비트 목록
        const size = nar ? 12 : 12.5, lh = Math.round(size * 1.45);
        if (nar) {
          const b = B[curI - 1], ty = g.y + g.h + 14, tw = D.w - 16;
          box(x, D.x + 4, ty, D.w - 8, D.y + D.h - ty - 2, { r: 9, shadow: false, lw: 1 });
          badge(x, curI, D.x + 20, ty + 18, { r: 9, fill: c.key });
          M.text(x, "행동", D.x + 36, ty + 22, { size: 12, weight: 700, color: c.muted });
          para(x, b[0], D.x + 16, ty + 42, tw - 24, { size, lh, max: 2 });
          M.text(x, "→ 반응", D.x + 16, ty + 44 + lh * 1.2, { size: 12, weight: 700, color: c.muted });
          para(x, b[1], D.x + 16, ty + 62 + lh * 1.2, tw - 24, { size, lh, max: 2 });
          return;
        }
        const lx = D.x + D.w * 0.57, lw2 = D.x + D.w - lx - 4;
        const hs = B.map((b) => paraH(x, `${b[0]} → ${b[1]}`, lw2 - 30, { size, lh }) + 12);
        let y = D.y + Math.max(0, (D.h - hs.reduce((a, b) => a + b, 0)) / 2);
        M.text(x, "행동 → 반응", lx, y - 8, { size: 12, weight: 700, color: c.muted });
        B.forEach((b, i) => {
          const on = p >= i + 0.95 || curI === i + 1, cur = curI === i + 1;
          x.save(); x.globalAlpha *= p >= i ? 1 : 0.3;
          if (cur) { M.rrect(x, lx - 6, y + 2, lw2 + 6, hs[i] - 4, 8); x.fillStyle = tint(c.key, 0.22); x.fill(); }
          badge(x, i + 1, lx + 9, y + 15, { r: 9, fill: cur ? c.key : c.surface });
          para(x, `${b[0]} → ${b[1]}`, lx + 26, y + 19, lw2 - 30, { size, lh, weight: on ? 600 : 500 });
          x.restore();
          y += hs[i];
        });
      }

      function drawTree(x, D) {
        const c = M.col(), nar = D.w < 480;
        const rootY = D.y + 12, headY = D.y + 50;
        const colW = Math.min((D.w - 14) / 2, 310), gx = D.x + (D.w - colW * 2 - 14) / 2;
        const cols = [gx + colW / 2, gx + colW + 14 + colW / 2];
        M.line(x, D.x + D.w / 2, rootY, cols[0], headY, c.line2 || c.muted, 1.25);
        M.line(x, D.x + D.w / 2, rootY, cols[1], headY, c.muted, 1.25);
        M.tag(x, "목표를 이뤘나?", D.x + D.w / 2, rootY, { align: "center", size: 12 });
        M.tag(x, "예", cols[0], headY, { align: "center", size: 12, fill: tint(c.c, 0.3) });
        M.tag(x, "아니오", cols[1], headY, { align: "center", size: 12, fill: tint(c.b, 0.3) });
        const top = headY + 22, lh = (D.y + D.h - top - 8) / 2;
        leafHits = [];
        const order = [[0, 0], [1, 0], [2, 1], [3, 1]];
        order.forEach(([i, col], k) => {
          const R = ST_RES[i], row = k % 2, X = gx + col * (colW + 14), Y = top + row * lh, H = lh - 10, sel = i === res;
          box(x, X, Y, colW, H, { fill: sel ? tint(c.key, 0.3) : null, lw: sel ? 2 : 1.25, r: 10, alpha: sel ? 1 : 0.92 });
          leafHits.push({ x: X, y: Y, w: colW, h: H, i });
          M.text(x, R.k, X + 12, Y + 21, { size: nar ? 12.5 : 13.5, weight: 700, color: c.ink });
          // 긴장 막대
          const bx = X + (nar ? 12 : colW * 0.5), bw = nar ? colW - 24 : colW * 0.5 - 14, by = nar ? Y + 30 : Y + 12;
          if (!nar) M.text(x, "긴장", bx - 6, by + 8, { size: 12, color: c.muted, align: "right", weight: 600 });
          M.rrect(x, bx, by, bw, 10, 5); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
          const tv = R.tension * ease(since / 600 + 0.15);
          M.rrect(x, bx, by, Math.max(4, bw * tv), 10, 5); x.fillStyle = R.tension > 0.6 ? c.b : R.tension < 0.3 ? c.muted : c.key; x.fill();
          let qy = nar ? Y + 58 : Y + 46;
          const good = R.tension > 0.6, qs = (good ? "남는 질문: " : "") + R.q;
          if (!nar && H > 110) { qy += para(x, R.txt, X + 12, qy, colW - 24, { size: 12.5, max: 2, color: c.muted }) + 6; }
          if (H > (nar ? 70 : 54)) para(x, qs, X + 12, qy, colW - 24, { size: 12.5, max: nar ? Math.max(1, Math.floor((Y + H - qy + 6) / 17)) : 2, color: good ? c.ink : c.muted, weight: good ? 700 : 500 });
        });
      }

      function drawValues(x, D) {
        const c = M.col(), R = ST_RES[res], n = R.vals.length, nar = D.w < 480;
        const cw = Math.min(D.w, 560), X = D.x + (D.w - cw) / 2;
        const rh = Math.min(nar ? 116 : 132, (D.h - 30) / n), top = D.y + (D.h - rh * n - 24) / 2 + 22;
        const c0 = X + (nar ? 96 : 150), c1 = X + cw - (nar ? 86 : 130);
        M.text(x, "장면 시작", c0, top - 8, { size: 12, weight: 700, color: c.muted, align: "center" });
        M.text(x, "장면 끝", c1, top - 8, { size: 12, weight: 700, color: c.muted, align: "center" });
        R.vals.forEach((v, i) => {
          const y0 = top + i * rh, h = rh - 14, mid = y0 + h / 2, Y = (val) => mid - val * h * 0.2;
          box(x, X, y0, cw, h, { shadow: false, lw: 1, r: 10 });
          x.fillStyle = tint(c.c, 0.1); x.fillRect(c0 - 30, y0 + 6, c1 - c0 + 60, h / 2 - 6);
          x.fillStyle = tint(c.b, 0.09); x.fillRect(c0 - 30, mid, c1 - c0 + 60, h / 2 - 6);
          M.line(x, c0 - 30, mid, c1 + 30, mid, c.muted, 1, [3, 4]);
          M.text(x, "+", c0 - 40, y0 + 22, { size: 14, weight: 700, color: c.c, align: "center" });
          M.text(x, "−", c0 - 40, y0 + h - 10, { size: 14, weight: 700, color: c.b, align: "center" });
          M.text(x, v[0], X + 14, mid + 5, { size: nar ? 13 : 15, weight: 700, color: c.ink });
          const pr = M.ease.inOut(clamp01((since - 250 - i * 300) / 900));
          const ys = Y(v[3]), ye = Y(v[4]), col = v[4] > v[3] ? c.c : c.b;
          x.save(); x.strokeStyle = col; x.lineWidth = 3; x.lineCap = "round"; x.beginPath(); x.moveTo(c0, ys); x.lineTo(c0 + (c1 - c0) * pr, ys + (ye - ys) * pr); x.stroke(); x.restore();
          M.dot(x, c0, ys, 6, v[3] > 0 ? c.c : c.b, c.ink);
          M.text(x, v[1], c0, v[3] > 0 ? ys - 12 : ys + 22, { size: 12, weight: 600, color: c.ink, align: "center" });
          if (pr > 0.98) {
            M.dot(x, c1, ye, 6, v[4] > 0 ? c.c : c.b, c.ink);
            M.text(x, v[2], c1, v[4] > 0 ? ye - 12 : ye + 22, { size: 12, weight: 600, color: c.ink, align: "center" });
            M.tag(x, `${sign(v[3])} → ${sign(v[4])}`, X + cw - 12, mid, { align: "right", size: 13, fill: tint(col, 0.32) });
          }
        });
      }

      function drawCompare(x, D) {
        const c = M.col(), nar = D.w < 520, R = ST_RES[res];
        const cards = [
          { t: "벤치 장면 · 3쪽", d: "연우가 복도 벤치에 앉아 시청 건물의 역사를 떠올린다.", vals: [["지식", "모름", "모름", -1, -1], ["안전", "안전", "안전", 1, 1], ["기회", "있음", "있음", 1, 1]], bad: true },
          { t: "고친 장면", d: "비서실장이 \"이 건물 지을 때도 같은 소문이 돌았죠\" 하며 길을 막는다. 역사가 실랑이 속에서 나온다.", vals: R.vals, bad: false },
        ];
        const gap = 14, cw = nar ? D.w - 8 : (D.w - gap) / 2, chh = nar ? (D.h - gap) / 2 : D.h - 6;
        cards.forEach((k, i) => {
          const X = nar ? D.x + 4 : D.x + i * (cw + gap), Y = nar ? D.y + i * (chh + gap) : D.y, W = nar ? cw : cw;
          box(x, X, Y, W, chh, { r: 12, fill: k.bad ? tint(c.b, 0.07) : tint(c.c, 0.08) });
          M.text(x, k.t, X + 12, Y + 22, { size: 13.5, weight: 700, color: c.ink });
          let y = Y + 30;
          if (!nar) { y += 12; y += para(x, k.d, X + 12, y, W - 24, { size: 12.5, max: 3, color: c.muted }); y += 4; }
          const rowH = nar ? 25 : 36;
          if (!nar) y += 10;
          k.vals.forEach((v, j) => valRow(x, v, X + 12, y + 12 + j * rowH, W - 24, k.bad ? 1 : clamp01((since - 200 - j * 250) / 600), { size: nar ? 12 : 13, nameW: nar ? 40 : 46 }));
          y += 12 + k.vals.length * rowH;
          const ch = k.vals.find((v) => v[3] !== v[4]);
          const test = ch ? `이 장면은 ${eul(ch[0])} ${ch[1]}에서 ${ro(ch[2])} 바꾼다.` : "이 장면은 ___을 ___에서 ___로 바꾼다.";
          const ty = Y + chh - (nar ? 12 : 16);
          x.font = M.font(12.5, "ui", 700);
          const tl = wrap(x, test, W - 24);
          tl.slice(-2).forEach((ln, q, arr) => M.text(x, ln, X + 12, ty - (arr.length - 1 - q) * 18, { size: 12.5, weight: 700, color: k.bad ? c.b : c.ink }));
          const nCh = k.vals.filter((v) => v[3] !== v[4]).length;
          const vt = k.bad ? (nar ? "바뀐 값 0개" : "바뀐 값 0개 → 잘라도 된다") : (nar ? `바뀐 값 ${nCh}개` : `바뀐 값 ${nCh}개 → 장면이 된다`);
          if (nar) M.tag(x, vt, X + W - 10, Y + 18, { align: "right", size: 12, fill: tint(k.bad ? c.b : c.c, 0.3) });
          else M.tag(x, vt, X + 12, ty - (Math.min(2, tl.length) - 1) * 18 - 30, { size: 12, fill: tint(k.bad ? c.b : c.c, 0.3) });
        });
      }

      return {
        setStep(s) { step = s; since = 0; appear = 0; rep.el.style.display = s === 1 ? "" : "none"; },
        replay() { since = 0; appear = 0; },
        frame(t, dt) {
          since += dt; appear = Math.min(1, appear + (dt || 0) / 380);
          const { x, w, h } = M.fit(cv), c = M.col();
          const nar = w < 520, pad = nar ? 6 : 14, pH = nar ? 46 : 54;
          const focus = [-1, 1, 2, 2, -1][step];
          const cx = pipeline(x, pad, 6, w - pad * 2, pH, focus);
          const D = { x: pad, y: 6 + pH + (nar ? 16 : 24), w: w - pad * 2, h: h - (6 + pH + (nar ? 16 : 24)) - 6 };
          if (cx != null) { M.line(x, cx, 6 + pH + 3, cx, D.y - 3, c.ink, 1.25, [3, 3]); M.dot(x, cx, D.y - 3, 2.5, c.ink); }
          x.save(); x.globalAlpha = ease(appear);
          x.translate(0, (1 - ease(appear)) * 8);
          [drawCard, drawBeats, drawTree, drawValues, drawCompare][step](x, D);
          x.restore();
        },
      };
    },
  });

  /* ===== 4-2 장면과 여운 ===== */
  const SQ_NODES = [
    [["목표", "시장에게 답을 받는다", "답을 받는다"], ["갈등", "비서실장이 길을 막는다", "비서실장이 막음"], ["재난", "이튿날 출입 정지 통보", "출입 정지"],
      ["반응", "빈 기자실에서 출입증만 만지작거린다", "출입증만 만지작"], ["딜레마", "사과하고 물러설까, 제보자를 직접 찾아갈까", "물러설까, 찾아갈까"], ["결정", "제보자의 옛 주소를 수첩에 적는다", "주소를 적는다"]],
    [["목표", "제보자를 만나 원본 서류를 얻는다", "원본을 얻는다"], ["갈등", "제보자가 문을 열어 주지 않는다", "문이 안 열림"], ["재난", "누군가 먼저 다녀가 방이 비어 있다", "방이 비었다"],
      ["반응", "현관 앞 계단에 주저앉는다", "계단에 주저앉음"], ["딜레마", "경찰에 알릴까, 혼자 쫓을까", "신고할까, 쫓을까"], ["결정", "떨어진 영수증의 가게로 간다", "가게로 간다"]],
  ];
  LESSONS.push({
    id: "scene-sequel", ch: 3, order: 2,
    title: "장면과 여운",
    lede: "이 레슨을 마치면 행동하는 장면 뒤에 그 결과를 소화하는 여운을 붙여, 이야기의 인과를 잇고 빠름과 느림의 리듬을 만드는 법을 알게 됩니다.",
    key: "장면(목표·갈등·재난) 뒤에는 여운(반응·딜레마·결정)이 오고, 여운의 결정이 다음 장면의 목표가 됩니다. 결정 없이 끝나는 여운은 사슬을 끊습니다.",
    steps: [
      ["장면: 빠른 반쪽", "위쪽 줄이 <b>장면</b>입니다. 목표 → 갈등 → 재난(나쁜 결과). 점은 독자의 시선이고, 바깥 행동이라 빠르게 지나갑니다. 지난 레슨의 연우가 시장을 놓치고 출입 정지까지 당하는 장면입니다."],
      ["여운: 느린 반쪽", "아래쪽 줄이 <b>여운</b>입니다. 반응(감정) → 딜레마(선택지 고민) → 결정. 바뀐 상태를 인물이 받아들이는 안쪽 시간이라 점이 천천히 움직입니다. 드와이트 스웨인이 정리한 장면과 여운(scene and sequel)의 리듬입니다."],
      ["결정이 다음 목표가 된다", "왼쪽 화살표를 보세요. 여운의 끝인 <b>결정</b>(제보자의 주소를 적는다)이 고리를 돌아 다음 장면의 <b>목표</b>(제보자를 만난다)가 됩니다. 한 바퀴 돌 때마다 칸의 내용이 다음 사건으로 바뀝니다. 이 사슬이 '그래서'로 이어지는 인과입니다."],
      ["리듬: 빠름과 느림", "아래 막대는 한 장(章)의 흐름입니다. 진한 칸이 장면, 옅은 칸이 여운이고 폭은 분량입니다. '해보기'에서 <b>여운 길이</b>를 바꿔 보세요. 여운이 너무 짧으면 숨이 차고, 너무 길면 처집니다. 여운은 한 문단일 수도, 한 장일 수도 있습니다."],
      ["여운이 없으면", "여운 길이를 0으로 둔 상태입니다. 아래 줄이 사라지고 장면만 이어집니다. 사건은 크게 터지는데 인물이 다음 장면에서 아무 일 없었다는 듯 움직이니, <b>독자가 감정을 둘 곳</b>이 없습니다. 전투가 세 번 이어져도 사이에 짧은 여운을 넣어야 하는 이유입니다."],
      ["결정 없는 여운", "이번엔 결정 칸을 뺐습니다. 점이 반응과 딜레마 사이만 맴돌고, 다음 장면의 목표 칸이 비었습니다. 고민만 하다 장면이 바뀌면 <b>다음 장면을 움직일 힘</b>이 없습니다. 여운은 반드시 결정으로 끝나야 합니다."],
    ],
    terms: [
      ["장면과 여운", "Scene and sequel", "행동하는 장면과 그 결과에 반응하며 다음 행동을 정하는 여운을 번갈아 쓰는 기법. 드와이트 스웨인이 정리하고 잭 비컴이 대중화했습니다."],
      ["재난", "Disaster", "장면의 결과가 목표 달성을 막는 쪽으로 끝나는 것. '아니오'나 '예, 하지만'처럼 다음 질문을 남깁니다."],
      ["반응 · 딜레마 · 결정", "Reaction · Dilemma · Decision", "여운의 세 칸. 감정으로 받아들이고, 선택지를 따져 보고, 새 목표를 정합니다."],
      ["속편이 아니다", "Sequel", "여기서 sequel 은 '속편'이 아니라 장면 뒤의 반응 구간을 뜻합니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, seqLen = 1.5, noDecision = false, since = 0;
      const sl = M.slider(api.controls, { id: "sqLen", label: "여운 길이 (장면 1 기준)", min: 0, max: 3, step: 0.25, value: 1.5, fmt: (v) => (v === 0 ? "없음" : "×" + v.toFixed(2)), onInput: (v) => { seqLen = v; since = 0; } });
      const ck = M.check(api.controls, { id: "sqNoDec", label: "여운에서 결정 빼기", onChange: (v) => { noDecision = v; since = 0; } });
      api.controls.append(M.el("p", { class: "hint" }, "여운 길이는 아래 막대의 폭과 점이 아래 줄에 머무는 시간을 함께 바꿉니다."));
      const PRE = [[1.5, false], [1.5, false], [1.5, false], [1.5, false], [0, false], [1.5, true]];

      /* 점 위치: 한 바퀴 안의 노드 순서와 머무는 시간 */
      function plan() {
        const fast = 650, slow = 650 * Math.max(0.35, seqLen) * 1.25;
        const seq = [];
        const topOnly = step === 0 || seqLen === 0;
        for (let i = 0; i < 3; i++) seq.push([i, fast]);
        if (!topOnly) {
          if (noDecision) { seq.push([3, slow], [4, slow], [3, slow], [4, slow], [3, slow], [4, slow]); }
          else seq.push([3, slow], [4, slow], [5, slow]);
        }
        return seq;
      }
      return {
        setStep(s) { step = s; since = 0; [seqLen, noDecision] = PRE[s]; sl.set(seqLen); ck.set(noDecision); },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), c = M.col(), nar = w < 520;
          const pad = nar ? 6 : 16, gapX = nar ? 14 : 34;
          const trackH = Math.min(h * 0.62, 300), stripTop = trackH + (nar ? 16 : 22);
          const bw = (w - pad * 2 - 30 - gapX * 2) / 3, bh = Math.min((trackH - 40) / 2, nar ? 92 : 84);
          const X0 = pad + 30, rowY = [8 + 18, 8 + 18 + bh + Math.max(26, trackH - 26 - bh * 2 - 12)];
          const pos = (i) => i < 3 ? [X0 + i * (bw + gapX), rowY[0]] : [X0 + (5 - i) * (bw + gapX), rowY[1]];
          // 진행
          const seq = plan(), total = seq.reduce((a, b) => a + b[1], 0) + 500;
          const cycle = Math.floor(since / total), tt = since % total;
          let acc = 0, node = seq[seq.length - 1][0], f = 1, k = seq.length - 1;
          for (let j = 0; j < seq.length; j++) { if (tt < acc + seq[j][1]) { node = seq[j][0]; f = (tt - acc) / seq[j][1]; k = j; break; } acc += seq[j][1]; }
          const inLoop = tt >= seq.reduce((a, b) => a + b[1], 0);
          const ver = (step >= 2 && !noDecision && seqLen > 0) ? cycle % 2 : 0;
          const verPrev = (step >= 2 && !noDecision && seqLen > 0) ? (cycle + 1) % 2 : 0;
          const showSeq = step >= 1 && seqLen > 0;
          // 줄 라벨
          M.text(x, "장면", X0, rowY[0] - 8, { size: 12, weight: 700, color: c.ink });
          M.text(x, "빠름", X0 + 34, rowY[0] - 8, { size: 12, color: c.muted });
          x.save(); x.globalAlpha = showSeq ? 1 : 0.3;
          M.text(x, "여운", X0, rowY[1] - 8, { size: 12, weight: 700, color: c.ink });
          M.text(x, seqLen === 0 ? "생략됨" : "느림", X0 + 34, rowY[1] - 8, { size: 12, color: seqLen === 0 ? c.b : c.muted });
          x.restore();
          // 연결 화살표
          for (let i = 0; i < 2; i++) { const [ax, ay] = pos(i); M.arrow(x, ax + bw + 4, ay + bh / 2, ax + bw + gapX - 4, ay + bh / 2, c.ink, 1.5); }
          x.save(); x.globalAlpha = showSeq ? 1 : 0.25;
          const [rx, ry] = pos(2), [rx2, ry2] = pos(3);
          M.arrow(x, rx + bw / 2, ry + bh + 3, rx2 + bw / 2, ry2 - 3, c.ink, 1.5);
          for (let i = 3; i < 5; i++) { const [ax, ay] = pos(i), [bx2] = pos(i + 1); M.arrow(x, ax - 4, ay + bh / 2, bx2 + bw + 4, ay + bh / 2, c.ink, 1.5); }
          x.restore();
          // 결정 → 목표 고리
          const [gx0, gy0] = pos(0), [dx0, dy0] = pos(5), lx = gx0 - 16;
          const loopOn = step >= 2 && showSeq;
          x.save();
          x.strokeStyle = noDecision && showSeq ? c.b : loopOn ? c.key : c.muted; x.lineWidth = loopOn ? 2.5 : 1.25;
          if (noDecision || !showSeq) x.setLineDash([4, 5]);
          x.globalAlpha = showSeq ? 1 : 0.3;
          x.beginPath(); x.moveTo(dx0 - 3, dy0 + bh / 2); x.lineTo(lx, dy0 + bh / 2); x.lineTo(lx, gy0 + bh / 2); x.lineTo(gx0 - 4, gy0 + bh / 2); x.stroke();
          x.restore();
          if (!noDecision && showSeq) M.arrow(x, lx, gy0 + bh / 2, gx0 - 4, gy0 + bh / 2, loopOn ? c.key : c.muted, loopOn ? 2.5 : 1.25);
          if (loopOn && !nar && !noDecision) {
            x.save(); x.translate(lx - 7, (gy0 + dy0 + bh) / 2); x.rotate(-Math.PI / 2);
            M.text(x, "결정 = 다음 목표", 0, 0, { size: 12, weight: 700, color: c.ink, align: "center" }); x.restore();
          }
          // 노드
          for (let i = 0; i < 6; i++) {
            const [bx, by] = pos(i), isSeq = i >= 3;
            const dead = isSeq && !showSeq, removed = i === 5 && noDecision && showSeq;
            const cur = node === i && !inLoop;
            let N = SQ_NODES[ver][i];
            if (i === 0 && noDecision && step >= 5) N = ["목표", "?", "?"];
            const col = isSeq ? c.a : c.b;
            box(x, bx, by, bw, bh, { alpha: dead ? 0.22 : removed ? 0.6 : 1, dash: removed ? [4, 4] : null, fill: cur ? tint(c.key, 0.38) : tint(col, isSeq ? 0.1 : 0.12), lw: cur ? 2 : 1.25, shadow: !removed, r: 10 });
            x.save(); x.globalAlpha *= dead ? 0.25 : 1;
            M.text(x, N[0], bx + 10, by + 19, { size: 12, weight: 700, color: c.muted });
            if (removed) M.text(x, "빠짐", bx + bw / 2, by + bh / 2 + 10, { size: 13, weight: 700, color: c.b, align: "center" });
            else if (N[1] === "?") { M.text(x, "?", bx + bw / 2, by + bh / 2 + 14, { size: 26, weight: 700, color: c.b, align: "center" }); if (!nar) M.text(x, "동력 없음", bx + bw - 10, by + 19, { size: 12, weight: 700, color: c.b, align: "right" }); }
            else {
              const txt = nar ? N[2] : N[1];
              const flip = i === 0 && step >= 2 && showSeq && !noDecision && cycle > 0 ? ease(tt / 500) : 1;
              x.globalAlpha *= flip;
              para(x, txt, bx + 10, by + (nar ? 40 : 44), bw - 20, { size: nar ? 12 : 14.5, weight: 600, max: Math.max(1, Math.floor((bh - 30) / (nar ? 17 : 21))), lh: nar ? 17 : 21 });
            }
            x.restore();
          }
          // 이동 점
          if (!inLoop) {
            const [bx, by] = pos(node), q = seq[k + 1] ? pos(seq[k + 1][0]) : null;
            let px = bx + bw / 2, py = by + bh;
            const e = M.ease.inOut(clamp01((f - 0.7) / 0.3));
            if (q && e > 0) { px += (q[0] + bw / 2 - px) * e; py += (q[1] + bh - py) * e; }
            M.dot(x, px, py, 6.5, c.key, c.ink);
          } else if (!noDecision && showSeq && step >= 2) {
            const e = M.ease.inOut(clamp01((tt - seq.reduce((a, b) => a + b[1], 0)) / 500));
            const path = [[dx0, dy0 + bh / 2], [lx, dy0 + bh / 2], [lx, gy0 + bh / 2], [gx0, gy0 + bh / 2]];
            const segs = [path[0][0] - path[1][0], path[1][1] - path[2][1], path[3][0] - path[2][0]], L = segs.reduce((a, b) => a + b, 0);
            let d = e * L, p2 = path[0];
            for (let s = 0; s < 3; s++) { if (d <= segs[s]) { const a = path[s], b = path[s + 1], r = d / segs[s]; p2 = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]; break; } d -= segs[s]; p2 = path[s + 1]; }
            M.dot(x, p2[0], p2[1], 6.5, c.key, c.ink);
          }
          if (noDecision && showSeq && !nar) {
            const [bx, by] = pos(4);
            M.tag(x, "고민만 맴돈다", bx + bw / 2, by + bh + 14, { align: "center", size: 12, fill: tint(c.b, 0.3) });
          }
          // 한 장의 리듬 막대
          const sy = stripTop, sh = h - sy - 8;
          x.save(); x.globalAlpha = step >= 3 ? 1 : 0.55;
          const units = []; for (let r = 0; r < 4; r++) { units.push(["장면", 1]); if (seqLen > 0) units.push(["여운", seqLen]); }
          const tot = units.reduce((a, b) => a + b[1], 0), sx = pad, swd = w - pad * 2;
          M.text(x, nar ? "한 장의 흐름" : "한 장(章)의 흐름 · 폭 = 분량", sx, sy + 12, { size: 12, weight: 700, color: c.ink });
          const verdict = seqLen === 0 ? ["숨 쉴 틈이 없다", c.b] : seqLen >= 2.6 ? ["처진다", c.b] : seqLen <= 0.5 ? ["숨이 차다", c.key] : ["빠름과 느림이 번갈아", c.c];
          M.tag(x, verdict[0], sx + swd, sy + 8, { align: "right", size: 12, fill: tint(verdict[1], 0.32) });
          const bH = Math.max(22, Math.min(76, sh - 30)), by0 = sy + 24 + Math.max(0, (sh - 30 - bH) / 2);
          let ux = sx;
          units.forEach(([kind, u]) => {
            const uw = (u / tot) * swd - 3, isS = kind === "장면";
            M.rrect(x, ux, by0 + (isS ? 0 : bH * 0.3), Math.max(2, uw), isS ? bH : bH * 0.7, 6);
            x.fillStyle = isS ? tint(c.b, 0.55) : tint(c.a, 0.22); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
            if (uw > 34) M.text(x, kind, ux + uw / 2, by0 + bH / 2 + (isS ? 4 : 8), { size: 12, weight: 600, color: c.ink, align: "center" });
            ux += uw + 3;
          });
          x.restore();
        },
      };
    },
  });

  /* ===== 4-3 이야기 시간과 서술 시간 ===== */
  /* story: 분 단위 이야기 시간, text: 서술 분량(문장 단위) */
  const PC_SEG = {
    scene: { name: "장면", story: 10, text: 3, s: [["“제 이름은 빼 주세요.” 남자가 말했다.", 0], ["“약속드릴게요.”", 0], ["“기자들은 다 그렇게 말하죠.” 그는 봉투를 탁자에 올려놓고도 손을 떼지 않았다.", 0]] },
    summary: { name: "요약", story: 3 * 24 * 60, text: 1.2, s: [["사흘 동안 연우는 제보자가 일했던 공사 현장 세 곳을 돌았다. 아무도 그의 이름을 기억하지 못했다.", 0]] },
    ellipsis: { name: "생략", story: 14 * 60, text: 0, s: [["넷째 날 아침, 연우는 낡은 연립주택 3층 문 앞에 서 있었다.", 1]] },
    pause: { name: "휴지", story: 0, text: 2, s: [["벽에는 같은 작업복을 입은 남자들의 단체 사진이 빼곡했다. 사진 속 얼굴의 절반에 볼펜으로 줄이 그어져 있었다.", 0]] },
  };
  /* 같은 10분을 얼마나 쓸까 (슬라이더) */
  const PC_TEN = [
    [0, "생략", "(빈 줄) 봉투는 이미 연우의 가방 안에 있었다."],
    [0.45, "요약", "남자는 한참을 망설이다 결국 봉투를 건넸다."],
    [1.6, "장면", "“제 이름은 빼 주세요.” “약속드릴게요.” “기자들은 다 그렇게 말하죠.” 그는 봉투에서 손을 떼지 않았다."],
    [3, "늘이기", "그가 봉투를 밀었다. 연우는 손을 뻗지 않았다. 봉투 모서리가 탁자 끝에 걸렸다. 일 초. 이 초. 남자의 손가락이 봉투에서 떨어졌다."],
  ];
  const PC_CH = {
    flat: { t: "모두 장면", segs: [["장면", 10, 3], ["장면", 10, 3], ["장면", 10, 3], ["장면", 10, 3], ["장면", 10, 3], ["장면", 10, 3]], v: ["모든 순간이 같은 무게라 늘어진다", 1] },
    rush: { t: "모두 요약", segs: [["요약", 2880, 1], ["요약", 1440, 0.8], ["요약", 4320, 1], ["요약", 720, 0.7], ["요약", 2880, 1], ["요약", 1440, 0.8]], v: ["줄거리 소개처럼 읽힌다", 1] },
    mixed: { t: "섞어서", segs: [["요약", 4320, 1.2], ["생략", 840, 0], ["장면", 10, 3], ["휴지", 0, 1.6], ["늘이기", 1, 3.2], ["요약", 1440, 1]], v: ["완급: 건너뛰고, 멈추고, 늘인다", 0] },
  };
  const tenMode = (v) => v === 0 ? "생략" : v < 0.8 ? "요약" : v <= 2.2 ? "장면" : "늘이기";
  const fmtStory = (m) => m === 0 ? "0분" : m >= 1440 ? `${+(m / 1440).toFixed(1)}일` : m >= 60 ? `${+(m / 60).toFixed(1)}시간` : m >= 1 ? `${Math.round(m)}분` : `${Math.round(m * 60)}초`;

  LESSONS.push({
    id: "pacing", ch: 3, order: 3,
    title: "이야기 시간과 서술 시간",
    lede: "이 레슨을 마치면 사건이 걸린 시간과 그것을 읽는 데 드는 분량의 비율로 요약·장면·생략·휴지를 구별하고, 그 비율을 바꿔 완급을 만드는 법을 알게 됩니다.",
    key: "완급은 '이야기 시간 ÷ 서술 분량'의 비율입니다. 연결부는 요약하거나 건너뛰고, 중요한 순간은 장면으로 쓰거나 늘입니다.",
    steps: [
      ["두 개의 시계", "왼쪽 원고를 읽는 속도와 오른쪽 <b>이야기 시계</b>를 비교합니다. 원고의 노란 줄이 지금 읽는 곳이고, 시계는 그동안 이야기 속에서 흐른 시간입니다. 대화 장면은 10분 동안의 일을 세 줄로 씁니다. 읽는 시간과 이야기 시간이 거의 같이 갑니다. 이것이 <b>장면</b>입니다."],
      ["요약", "사흘 동안 있었던 일을 두 문장으로 씁니다. 한 줄을 읽는 사이 시계가 하루 넘게 돕니다. <b>요약</b>은 이야기 시간을 압축합니다. 중요하지 않은 연결부에 씁니다."],
      ["생략", "하룻밤이 통째로 빠졌습니다. 빈 줄 한 번에 시계가 14시간을 건너뜁니다. <b>생략</b>은 서술 분량이 0입니다. '넷째 날 아침,'처럼 다음 문장이 시간이 흘렀다는 표시를 붙여 줍니다."],
      ["휴지", "이번엔 시계가 멈춥니다. 방 안의 사진을 묘사하는 동안 이야기 속 시간은 흐르지 않습니다. <b>휴지</b>(묘사로 멈춤)는 서술만 있고 이야기 시간은 0입니다. 독자에게 숨을 고르게 하거나 무언가를 눈여겨보게 할 때 씁니다."],
      ["같은 10분, 다른 분량", "같은 10분짜리 일을 몇 줄로 쓰느냐에 따라 이름이 바뀝니다. '해보기'의 <b>서술 분량</b>을 0에서 3까지 끌어 보세요. 0이면 생략, 조금이면 요약, 비슷하면 장면, 더 길면 <b>늘이기</b>(슬로 모션)가 됩니다. 중요한 순간일수록 늘입니다."],
      ["한 장의 완급", "한 장을 여섯 구간으로 나눈 막대입니다. 폭은 분량, 위의 선은 속도(한 줄에 흐르는 이야기 시간)입니다. '해보기'에서 배치를 바꿔 보세요. <b>모두 장면</b>이면 선이 평평해 늘어지고, <b>모두 요약</b>이면 줄거리 소개처럼 읽힙니다. 섞어야 선이 오르내립니다."],
    ],
    terms: [
      ["이야기 시간 · 서술 시간", "Story time · Discourse time", "사건이 이야기 속에서 실제로 걸린 시간과, 그것을 서술하는 데 쓴 분량(읽는 시간). 둘의 비율이 속도입니다."],
      ["요약", "Summary", "긴 이야기 시간을 짧은 서술로 압축하는 것. 연결부와 시간 건너뛰기에 씁니다."],
      ["생략", "Ellipsis", "이야기 시간은 흘렀지만 서술은 0인 구간. 빈 줄이나 장 바뀜으로 표시합니다."],
      ["휴지", "Pause", "서술은 이어지지만 이야기 시간은 멈춘 구간. 묘사와 설명이 여기에 해당합니다. 제라르 주네트가 이 넷을 서술 속도의 기본형으로 정리했습니다."],
      ["늘이기", "Stretch", "실제보다 더 긴 분량으로 한순간을 늘려 쓰는 것. 영화의 슬로 모션과 같습니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, ten = 1.6, preset = "mixed", since = 0;
      const sl = M.slider(api.controls, { id: "pcTen", label: "10분을 쓸 서술 분량 (줄)", min: 0, max: 3, step: 0.05, value: 1.6, fmt: (v) => `${v.toFixed(2)}줄 · ${tenMode(v)}`, onInput: (v) => { ten = v; since = 0; } });
      const ch = M.chips(api.controls, { title: "한 장의 배치", items: ["모두 장면", "모두 요약", "섞어서"], value: 2, onPick: (i) => { preset = ["flat", "rush", "mixed"][i]; since = 0; } });
      const hint = M.el("p", { class: "hint" }, "분량이 0이면 생략, 조금이면 요약, 비슷하면 장면, 더 길면 늘이기가 됩니다.");
      api.controls.append(hint);
      const segFor = () => {
        if (step === 4) {
          const m = tenMode(ten), row = PC_TEN.find((r) => r[1] === m) || PC_TEN[2];
          return { name: m, story: 10, text: ten, s: [[row[2], m === "생략" ? 1 : 0]] };
        }
        return PC_SEG[["scene", "summary", "ellipsis", "pause"][Math.min(step, 3)]];
      };
      const COL = () => { const c = M.col(); return { 장면: c.c, 요약: c.a, 생략: c.muted, 휴지: c.key, 늘이기: c.b }; };

      function drawPlayer(x, w, h, nar) {
        const c = M.col(), S = segFor(), col = COL()[S.name] || c.ink;
        const pad = nar ? 6 : 14;
        const leftW = nar ? w - pad * 2 : Math.min(w * 0.58, w - 260);
        const size = nar ? 12.5 : h > 420 ? 17 : 15, lh = Math.round(size * 1.6), tw = leftW - 26;
        const segs = S.s.map(([t]) => [t + " ", null]);
        const R = rich(x, segs, tw, size), blank = S.text === 0 || S.s[0][1];
        const need = 62 + (blank ? 30 : 0) + R.lines.length * lh;
        const pageH = nar ? h * 0.5 : Math.round(M.clamp(Math.max(need, 236), 200, h * 0.6));
        const top = nar ? 6 : Math.max(6, Math.round((h - pageH - 12 - 112) / 2));
        // 진행: 줄 단위로 읽음. 생략이면 빈 줄 0.9초
        const per = 1100, readDur = S.text === 0 ? 900 : Math.max(900, S.text * per), hold = 1300;
        const T = since % (readDur + hold), r = clamp01(T / readDur);
        // 원고
        box(x, pad, top, leftW, pageH, { r: 10 });
        M.text(x, "원고", pad + 12, top + 20, { size: 12, weight: 700, color: c.muted });
        M.tag(x, S.name, pad + leftW - 10, top + 16, { align: "right", size: 12, fill: tint(col, 0.35) });
        let ty = top + 48;
        if (blank) {
          // 빈 줄 표시
          const on = S.text === 0;
          M.rrect(x, pad + 12, ty - 14, tw, 22, 6); x.fillStyle = on && r < 1 ? tint(c.key, 0.45) : c.sunk; x.fill();
          M.text(x, "(빈 줄)", pad + 12 + tw / 2, ty + 1, { size: 12, weight: 700, color: c.muted, align: "center" });
          ty += 30;
        }
        const nL = R.lines.length;
        // 읽는 위치를 줄 단위로 칠함
        const readLines = S.text === 0 ? nL : r * nL;
        R.lines.forEach((ln, i) => {
          const f = clamp01(readLines - i), lw = ln.length ? ln[ln.length - 1].x + ln[ln.length - 1].w : 0;
          if (f > 0 && S.text > 0) { x.fillStyle = tint(c.key, 0.4); x.fillRect(pad + 11, ty + i * lh - size * 1.0, lw * f + 2, size * 1.35); }
        });
        drawRich(x, R, pad + 12, ty, { lh });
        // 이야기 시계
        const cx0 = nar ? pad : pad + leftW + 18, cw = nar ? w - pad * 2 : w - cx0 - pad;
        const cy0 = nar ? top + pageH + 10 : top, chh = nar ? h - (top + pageH + 10) - 64 : pageH;
        box(x, cx0, cy0, cw, chh, { r: 10 });
        M.text(x, "이야기 시계", cx0 + 12, cy0 + 20, { size: 12, weight: 700, color: c.muted });
        let storyNow = S.text === 0 ? (r < 0.45 ? 0 : S.story * M.ease.inOut(clamp01((r - 0.45) / 0.3))) : S.story * r;
        const R0 = Math.max(16, Math.min(cw * 0.3, nar ? (chh - 50) / 2 : (chh - 116) / 2, 78));
        const ccx = nar ? cx0 + 20 + R0 : cx0 + cw / 2, ccy = nar ? cy0 + chh / 2 + 8 : cy0 + 32 + R0;
        M.dot(x, ccx, ccy, R0, c.surface, c.ink);
        for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; M.line(x, ccx + Math.sin(a) * R0 * 0.82, ccy - Math.cos(a) * R0 * 0.82, ccx + Math.sin(a) * R0 * 0.94, ccy - Math.cos(a) * R0 * 0.94, c.muted, 1.5); }
        const base = 9 * 60 + 40;
        const mins = base + storyNow, am = (mins / 60) * Math.PI * 2, ah = (mins / 720) * Math.PI * 2;
        M.line(x, ccx, ccy, ccx + Math.sin(ah) * R0 * 0.5, ccy - Math.cos(ah) * R0 * 0.5, c.ink, 3.5);
        M.line(x, ccx, ccy, ccx + Math.sin(am) * R0 * 0.8, ccy - Math.cos(am) * R0 * 0.8, col, 2.5);
        M.dot(x, ccx, ccy, 3.5, c.ink);
        const frozen = S.story === 0;
        const lbl = frozen ? "멈춤 · +0분" : `+${fmtStory(storyNow)}`;
        const ly = nar ? ccy - 14 : ccy + R0 + 26, lx = nar ? ccx + R0 + 16 : ccx;
        M.text(x, lbl, lx, ly, { size: nar ? 15 : 17, weight: 700, color: frozen ? c.key : c.ink, align: nar ? "left" : "center" });
        M.text(x, `이야기 ${fmtStory(S.story)} · 서술 ${S.text === 0 ? "0줄" : S.text.toFixed(1) + "줄"}`, lx, ly + 19, { size: 12, color: c.muted, align: nar ? "left" : "center" });
        const rate = S.text === 0 ? "읽는 시간 0에 건너뜀" : S.story === 0 ? "한 줄에 0분 · 시간이 멈춤" : `한 줄에 ${fmtStory(S.story / S.text)}`;
        M.text(x, rate, lx, ly + 37, { size: 12.5, weight: 700, color: c.ink, align: nar ? "left" : "center" });
        // 아래 막대: 이 장의 네 구간
        const order = ["summary", "ellipsis", "scene", "pause"], key = step === 4 ? "scene" : order[[2, 0, 1, 3][Math.min(step, 3)]];
        const by = nar ? h - 54 : top + pageH + 12, bh = nar ? 48 : Math.min(112, h - by - 6);
        stripMini(x, pad, by, w - pad * 2, bh, order.map((k) => (k === "scene" && step === 4 ? { ...PC_SEG.scene, name: tenMode(ten), text: ten } : PC_SEG[k])), order.indexOf(key));
      }
      function stripMini(x, X, Y, W, H, segs, cur) {
        const c = M.col(), CL = COL();
        const minW = 18, tot = segs.reduce((a, s) => a + Math.max(0.35, s.text), 0);
        M.text(x, "이 장의 구간 (폭 = 분량)", X, Y + 12, { size: 12, weight: 700, color: c.ink });
        const lab = H > 70;
        let ux = X; const y0 = Y + 20, hh = Math.max(16, Math.min(64, H - 24 - (lab ? 22 : 0)));
        segs.forEach((s, i) => {
          const uw = Math.max(minW, (Math.max(0.35, s.text) / tot) * (W - 4 * segs.length)), col = CL[s.name] || c.ink;
          const on = i === cur;
          if (s.text === 0) {
            M.line(x, ux + uw / 2, y0, ux + uw / 2, y0 + hh, col, 2, [3, 3]);
            x.font = M.font(12, "ui", 700); const lw0 = x.measureText("생략").width + 6;
            x.fillStyle = c.surface; x.fillRect(ux + uw / 2 - lw0 / 2, y0 + hh / 2 - 9, lw0, 17);
            M.text(x, "생략", ux + uw / 2, y0 + hh / 2 + 4, { size: 12, weight: on ? 700 : 500, color: on ? c.ink : c.muted, align: "center" });
          } else {
            M.rrect(x, ux, y0, uw, hh, 6); x.fillStyle = tint(col, on ? 0.6 : 0.25); x.fill(); x.lineWidth = on ? 2 : 1; x.strokeStyle = c.ink; x.stroke();
            if (uw > 44) M.text(x, s.name, ux + uw / 2, y0 + hh / 2 + 4, { size: 12, weight: on ? 700 : 500, color: c.ink, align: "center" });
          }
          if (lab && (uw > 44 || s.text === 0)) M.text(x, fmtStory(s.story), ux + uw / 2, y0 + hh + 17, { size: 12, color: on ? c.ink : c.muted, weight: on ? 700 : 500, align: "center" });
          ux += uw + 4;
        });
      }
      function drawChapter(x, w, h, nar) {
        const c = M.col(), P = PC_CH[preset], CL = COL(), pad = nar ? 6 : 14;
        const segs = P.segs, tot = segs.reduce((a, s) => a + Math.max(0.5, s[2]), 0);
        const X = pad + (nar ? 0 : 44), W = w - X - pad, top = 10;
        M.tag(x, P.v[0], w - pad, top + 10, { align: "right", size: 12, fill: tint(P.v[1] ? c.b : c.c, 0.32) });
        M.text(x, P.t, pad, top + 14, { size: 13, weight: 700, color: c.ink });
        // 속도 그래프
        const gy = top + (nar ? 42 : 34), gh = Math.max(80, h * 0.44), barY = gy + gh + 22, barH = Math.max(40, h - barY - (nar ? 54 : 46));
        const speed = (s) => s[2] === 0 ? 1 : s[1] === 0 ? 0 : M.clamp((Math.log10(s[1] / s[2] + 0.01) + 1) / 4.6, 0.04, 0.96);
        x.strokeStyle = c.line; x.lineWidth = 1; x.strokeRect(X + 0.5, gy + 0.5, W - 1, gh - 1);
        if (!nar) {
          M.text(x, "빠름", X - 8, gy + 14, { size: 12, weight: 700, color: c.ink, align: "right" });
          M.text(x, "멈춤", X - 8, gy + gh - 4, { size: 12, weight: 700, color: c.ink, align: "right" });
        } else {
          M.text(x, "선이 위 = 빠름 · 아래 = 멈춤", X, gy - 7, { size: 12, color: c.muted });
        }
        let ux = X; const xs = [];
        segs.forEach((s) => { const uw = (Math.max(0.5, s[2]) / tot) * W; xs.push([ux, uw]); ux += uw; });
        const prog = clamp01(since / 1600);
        x.save(); x.beginPath(); x.rect(X, gy - 4, W * prog, gh + 8); x.clip();
        x.strokeStyle = c.ink; x.lineWidth = 2.5; x.lineJoin = "round"; x.beginPath();
        segs.forEach((s, i) => { const [a, b] = xs[i], yv = gy + gh - speed(s) * gh; if (!i) x.moveTo(a, yv); else x.lineTo(a, yv); x.lineTo(a + b, yv); });
        x.stroke(); x.restore();
        segs.forEach((s, i) => { const [a, b] = xs[i]; if (i) M.line(x, a, gy, a, barY + barH, c.line, 1, [2, 4]); });
        // 막대
        segs.forEach((s, i) => {
          const [a, b] = xs[i], col = CL[s[0]] || c.ink;
          if (s[2] === 0) { M.line(x, a + b / 2, barY, a + b / 2, barY + barH, col, 2, [3, 3]); }
          else { M.rrect(x, a + 2, barY, b - 4, barH, 6); x.fillStyle = tint(col, 0.45); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke(); }
          if (b > 40 || !nar) {
            M.text(x, s[0], a + b / 2, barY + barH / 2 + 4, { size: 12, weight: 700, color: c.ink, align: "center" });
            M.text(x, fmtStory(s[1]), a + b / 2, barY + barH + 16, { size: 12, color: c.muted, align: "center" });
          }
        });
        M.text(x, nar ? "막대 폭 = 분량 · 아래 = 이야기 시간" : "막대 폭 = 서술 분량 · 아래 숫자 = 그 구간의 이야기 시간", X, h - 8, { size: 12, color: c.muted });
      }
      return {
        setStep(s) {
          step = s; since = 0;
          sl.el.style.display = s === 4 ? "" : "none"; ch.el.style.display = s === 5 ? "" : "none";
          hint.textContent = s === 5 ? "속도 선은 한 줄을 읽는 동안 흐르는 이야기 시간을 로그 눈금으로 그렸습니다." : s === 4 ? "분량이 0이면 생략, 조금이면 요약, 비슷하면 장면, 더 길면 늘이기가 됩니다." : "단계를 넘기면 원고와 시계가 그 구간으로 바뀝니다.";
        },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), nar = w < 520;
          if (step === 5) drawChapter(x, w, h, nar); else drawPlayer(x, w, h, nar);
        },
      };
    },
  });

  /* =========================================================
     5장 · 시점과 서술
     ========================================================= */
  const itemCol = (k) => { const c = M.col(), e = cc(); return [null, c.a, c.b, e.ch4, e.ch5, c.c][k] || c.ink; };

  /* ===== 5-1 시점은 카메라다 ===== */
  const PV_ITEMS = [
    [1, "은재의 속마음", "해고 얘기만 안 나오면 된다"],
    [2, "팀장의 속마음", "이미 내정자가 있다"],
    [3, "명단에 그어진 줄", "은재 이름에 줄"],
    [4, "복도의 합격자 공지", "공지가 붙는 중"],
    [5, "은재의 떨리는 손", "겉으로 보인다"],
  ];
  const PV_MODES = [
    { name: "전체 보기", who: "작가", access: [1, 2, 3, 4, 5], cam: "all", voice: "작가는 다섯 가지를 모두 안다" },
    { name: "1인칭 · 은재", who: "나", access: [1, 5], cam: "A-eye", voice: "화자 = 나(은재)",
      text: [["나는 ", 0], ["무릎 위에서 떨리는 손을", 5], [" 바지에 문질렀다. ", 0], ["해고 얘기만 안 나오면 된다.", 1], [" 팀장은 서류에서 눈을 떼지 않았다.", 0]] },
    { name: "3인칭 제한 · 은재", who: "은재는", access: [1, 5], cam: "A", voice: "서술자 = 은재에게 밀착",
      text: [["은재는 ", 0], ["무릎 위에서 떨리는 손을", 5], [" 바지에 문질렀다. ", 0], ["해고 얘기만 안 나오면 된다.", 1], [" 팀장은 서류에서 눈을 떼지 않았다.", 0]] },
    { name: "3인칭 제한 · 팀장", who: "박 팀장은", access: [2, 3, 5], cam: "B", voice: "서술자 = 팀장에게 밀착",
      text: [["지원자의 ", 0], ["손이 무릎 위에서 쉬지 않았다.", 5], [" 박 팀장은 ", 0], ["줄 그어 둔 이름", 3], ["을 손바닥으로 덮었다. ", 0], ["어차피 내정자는 따로 있었다.", 2]] },
    { name: "관찰자 1인칭 · 나", who: "나(기록 담당)", access: [5], cam: "C", voice: "화자 = 옆에서 본 사람",
      text: [["나는 두 사람 사이에서 기록만 했다. ", 0], ["지원자의 손이 떨렸고", 5], [", 팀장님의 펜은 한 번도 움직이지 않았다. 그때는 그게 무슨 뜻인지 몰랐다.", 0]] },
    { name: "3인칭 전지", who: "서술자", access: [1, 2, 3, 4, 5], cam: "top", voice: "서술자 = 모든 것을 안다",
      text: [["은재는 ", 0], ["해고 얘기만 나오지 않기를 바랐다.", 1], [" 박 팀장은 ", 0], ["이미 다른 사람으로 정해 두었다.", 2], [" 그 시각 ", 0], ["복도에서는 합격자 공지가 붙고 있었다.", 4], [" 셋 중 누구도 서로의 사정을 몰랐다.", 0]] },
  ];
  const PV_HOP = [["은재는 ", 0], ["무릎 위에서 떨리는 손을", 5], [" 바지에 문질렀다. ", 0], ["해고 얘기만 안 나오면 된다.", 1], [" 박 팀장은 속으로 이 지원자가 안쓰럽다고 생각했다.", "hop"], [" 은재는 침을 삼켰다.", 0]];

  LESSONS.push({
    id: "pov-camera", ch: 4, order: 1,
    title: "시점은 카메라다",
    lede: "이 레슨을 마치면 1인칭·3인칭 제한·관찰자·전지 시점이 독자에게 주는 정보의 범위가 어떻게 다른지, 그리고 장면 중간에 시점이 흔들리면 무엇이 깨지는지 알게 됩니다.",
    key: "시점은 독자가 들어갈 수 있는 머릿속을 정합니다. 한 장면에는 한 시점 인물. 시점을 바꾸려면 장면을 끊습니다.",
    steps: [
      ["같은 방, 다섯 가지 정보", "면접실을 위에서 본 그림입니다. 지원자 은재, 면접관 박 팀장, 벽 쪽에서 기록하는 직원 '나'가 있습니다. 번호 ①~⑤가 이 장면에 있는 정보입니다. 작가는 다섯 가지를 다 압니다. 독자에게 무엇을 줄지는 <b>카메라를 어디에 두느냐</b>가 정합니다."],
      ["1인칭: 인물의 눈 안", "카메라가 은재의 눈 안에 들어갔습니다. 노란 부채꼴이 보이는 범위이고, 그 밖은 흐려졌습니다. 독자는 은재의 속마음(①)과 떨리는 손(⑤)만 받습니다. 팀장의 속셈과 명단의 줄은 <b>은재가 모르니 쓸 수 없습니다.</b> 오른쪽 문장의 주어는 '나'입니다."],
      ["3인칭 제한: 어깨 뒤", "카메라가 은재의 어깨 뒤로 한 걸음 물러났습니다. 주어가 '은재는'으로 바뀌었지만 받는 정보는 1인칭과 같습니다. <b>3인칭 제한</b>은 한 인물에 밀착합니다. '해보기'에서 팀장으로 바꿔 보세요. 이번엔 ②·③이 열리고 ①이 닫힙니다. 장면마다 누구 눈으로 볼지 고를 수 있습니다."],
      ["전지: 방 위에서", "카메라가 방 위로 올라갔습니다. 세 사람의 속마음과 복도의 공지(④)까지 모두 보입니다. 넓게 보여 줄 수 있지만, 팀장이 이미 내정자를 정했다는 <b>긴장의 원천이 첫 문단에 새 버립니다.</b> 전지 시점은 극적 아이러니를 만들기 쉽고 긴장을 잃기도 쉽습니다."],
      ["관찰자 화자", "이번엔 기록 담당 '나'가 화자입니다. 두 사람의 겉모습(⑤)만 보이고 아무의 속마음도 열리지 않습니다. 셜록 홈즈 이야기의 왓슨처럼 <b>옆에서 본 사람</b>이 서술하면, 주인공의 머릿속을 끝까지 숨긴 채 독자와 함께 놀랄 수 있습니다."],
      ["시점 흔들림", "은재 시점 장면에 '박 팀장은 속으로 … 생각했다'가 끼어들었습니다. 카메라가 은재와 팀장 사이를 튀고, 닫혀 있어야 할 ②가 새어 나옵니다. 이것이 <b>시점 흔들림</b>(head-hopping)입니다. 독자는 지금 누구 곁에 있는지 헷갈립니다. 시점을 바꾸려면 빈 줄이나 구분 기호로 장면을 끊습니다."],
    ],
    terms: [
      ["시점", "Point of view", "이야기를 누구의 눈과 머릿속을 통해 전달하느냐. 독자가 접근할 수 있는 정보의 범위를 정합니다."],
      ["3인칭 제한 시점", "Third person limited", "'그/그녀'로 부르되 한 인물의 감각과 생각만 따라가는 시점. 장면마다 시점 인물을 바꿀 수 있습니다."],
      ["전지 시점", "Omniscient", "서술자가 여러 인물의 속마음과 다른 곳의 일까지 아는 시점. 시야가 넓지만 긴장이 새기 쉽습니다."],
      ["관찰자 화자", "Observer narrator", "주인공이 아닌 곁의 인물이 '나'로 서술하는 방식. 왓슨, 『위대한 개츠비』의 닉이 대표적입니다."],
      ["시점 흔들림", "Head-hopping", "한 장면 안에서 시점 인물이 아닌 다른 인물의 속마음으로 넘어가는 실수. 장면을 끊고 바꿉니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, mode = 0, since = 0;
      const cam = { x: 0.5, y: 0.5, a: -Math.PI / 2, spread: 0, top: 0 };
      const chips = M.chips(api.controls, { title: "카메라 두기", items: PV_MODES.slice(1).map((m) => m.name), onPick: (i) => { mode = i + 1; since = 0; } });
      api.controls.append(M.el("p", { class: "hint" }, "카메라를 바꾸면 방에서 열리는 정보와 오른쪽 문장이 함께 바뀝니다."));
      const STEPMODE = [0, 1, 2, 5, 4, 2];
      /* 방 안 좌표(0~1) */
      const P = { A: [0.42, 0.8], B: [0.42, 0.2], C: [0.07, 0.5], desk: [0.42, 0.5], paper: [0.5, 0.42], hand: [0.3, 0.66] };
      const camTarget = (m, hopB) => {
        const k = PV_MODES[m].cam;
        if (k === "A-eye") return { x: P.A[0], y: P.A[1] - 0.02, a: -Math.PI / 2, spread: 1, top: 0 };
        if (k === "A" || (k === "hop" && !hopB)) return { x: P.A[0] + 0.06, y: P.A[1] + 0.13, a: -Math.PI / 2 - 0.12, spread: 1, top: 0 };
        if (k === "B" || hopB) return { x: P.B[0] - 0.06, y: P.B[1] - 0.13, a: Math.PI / 2 - 0.12, spread: 1, top: 0 };
        if (k === "C") return { x: P.C[0] - 0.02, y: P.C[1], a: 0, spread: 1.15, top: 0 };
        return { x: 0.5, y: -0.08, a: Math.PI / 2, spread: 0, top: 1 };
      };
      return {
        setStep(s) { step = s; mode = STEPMODE[s]; since = 0; chips.set(mode - 1); },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), c = M.col(), nar = w < 560;
          const hop = step === 5, hopB = hop && Math.floor(since / 1100) % 2 === 1 && since > 900;
          const md = PV_MODES[mode], tg = camTarget(mode, hopB);
          for (const k of ["x", "y", "spread", "top"]) cam[k] = follow(cam[k], tg[k], dt, hop ? 160 : 420);
          let da = tg.a - cam.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; cam.a += da * (1 - Math.pow(0.004, (dt || 16) / (hop ? 160 : 420)));
          const vis = (k) => md.access.includes(k) || (hop && hopB && k === 2);
          // 배치
          const pad = nar ? 6 : 12;
          const planW = nar ? w - pad * 2 : Math.min(w * 0.52, (h - 20) * 1.25), planH = nar ? Math.min(h * 0.43, planW * 0.6) : h - 20;
          const PX = pad, PY = 10, corW = planW * 0.2, rw = planW - corW - 8, rh = planH - (nar ? 6 : 24);
          const RX = PX + 4, RY = PY + (nar ? 2 : 12);
          const X = (u) => RX + u * rw, Y = (v) => RY + v * rh;
          // 복도
          const CX = RX + rw + 8, cwid = corW - 4;
          x.save();
          M.rrect(x, CX, RY, cwid, rh, 8); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
          M.text(x, "복도", CX + cwid / 2, RY + 18, { size: 12, weight: 700, color: c.muted, align: "center" });
          const nb = { x: CX + 8, y: RY + rh * 0.32, w: cwid - 16, h: rh * 0.36 };
          M.rrect(x, nb.x, nb.y, nb.w, nb.h, 4); x.fillStyle = vis(4) ? tint(itemCol(4), 0.3) : c.surface; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
          if (vis(4)) { if (!nar && nb.w > 50) para(x, "합격자 공지", nb.x + nb.w / 2, nb.y + nb.h / 2, nb.w - 6, { size: 12, weight: 700, align: "center" }); }
          else M.text(x, "?", nb.x + nb.w / 2, nb.y + nb.h / 2 + 7, { size: 18, weight: 700, color: c.muted, align: "center" });
          badge(x, 4, nb.x + nb.w, nb.y, { r: 9, fill: tint(itemCol(4), 0.55) });
          x.restore();
          // 방
          M.rrect(x, RX, RY, rw, rh, 6); x.fillStyle = c.surface; x.fill();
          x.strokeStyle = c.ink; x.lineWidth = 3; x.stroke();
          const dY = Y(0.5), dl = rh * 0.16; x.fillStyle = c.surface; x.fillRect(RX + rw - 4, dY - dl / 2, 10, dl);
          M.line(x, RX + rw, dY - dl / 2, RX + rw - dl, dY - dl / 2, c.ink, 1.5);
          x.save(); x.strokeStyle = M.alpha(c.ink, 0.4); x.setLineDash([2, 3]); x.beginPath(); x.arc(RX + rw, dY - dl / 2, dl, Math.PI / 2, Math.PI); x.stroke(); x.restore();
          if (!nar) M.text(x, "문", RX + rw - 10, dY + dl / 2 + 14, { size: 12, color: c.muted, align: "right" });
          // 책상
          const dw = rw * 0.5, dh = rh * 0.22;
          M.rrect(x, X(P.desk[0]) - dw / 2, Y(P.desk[1]) - dh / 2, dw, dh, 6); x.fillStyle = tint(c.key, 0.28); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.25; x.stroke();
          // 시야(부채꼴) 또는 위에서 비춤
          const camX = X(cam.x), camY = cam.top > 0.5 ? RY - 6 : Y(cam.y);
          if (cam.spread > 0.02) {
            const L = Math.hypot(rw, rh) * 1.2, half = 0.62 * cam.spread;
            x.save(); x.globalAlpha = cam.spread;
            x.beginPath(); x.rect(RX, RY, rw, rh); x.clip();
            x.beginPath(); x.moveTo(camX, camY); x.arc(camX, camY, L, cam.a - half, cam.a + half); x.closePath();
            x.fillStyle = M.alpha(c.key, 0.18); x.fill();
            x.restore();
          }
          if (cam.top > 0.02) {
            x.save(); x.globalAlpha = cam.top;
            x.fillStyle = M.alpha(c.key, 0.12); x.fillRect(RX, RY, rw, rh); x.fillRect(CX, RY, cwid, rh);
            x.restore();
          }
          // 사람
          const pr = Math.max(9, Math.min(rw, rh) * 0.07);
          const person = (p, name, fill, face, lblDy) => {
            const px = X(p[0]), py = Y(p[1]);
            M.dot(x, px, py, pr, fill, c.ink);
            x.beginPath(); x.moveTo(px + Math.cos(face) * (pr + 6), py + Math.sin(face) * (pr + 6));
            x.lineTo(px + Math.cos(face + 0.5) * pr, py + Math.sin(face + 0.5) * pr); x.lineTo(px + Math.cos(face - 0.5) * pr, py + Math.sin(face - 0.5) * pr);
            x.closePath(); x.fillStyle = c.ink; x.fill();
            M.text(x, name, px, py + lblDy, { size: 12, weight: 700, color: c.ink, align: "center" });
          };
          { const px = X(P.A[0]), py = Y(P.A[1]); person(P.A, "", tint(c.a, 0.5), -Math.PI / 2, 0); M.text(x, "은재", px - pr - 6, py + 5, { size: 12, weight: 700, color: c.ink, align: "right" }); }
          person(P.B, "팀장", tint(c.b, 0.5), Math.PI / 2, -pr - 8);
          person(P.C, "나", tint(c.muted, 0.4), 0, pr + 16);
          // 명단
          const pw = Math.max(16, rw * 0.09), ph = pw * 1.25, ppx = X(P.paper[0]) - pw / 2, ppy = Y(P.paper[1]) - ph / 2;
          M.rrect(x, ppx, ppy, pw, ph, 2); x.fillStyle = vis(3) ? c.surface : c.sunk; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
          if (vis(3)) { for (let i = 0; i < 3; i++) M.line(x, ppx + 3, ppy + 5 + i * (ph / 4), ppx + pw - 3, ppy + 5 + i * (ph / 4), c.muted, 1); M.line(x, ppx + 2, ppy + 5 + ph / 4, ppx + pw - 2, ppy + 5 + ph / 4, itemCol(3), 2.5); }
          else M.text(x, "?", ppx + pw / 2, ppy + ph / 2 + 5, { size: 13, weight: 700, color: c.muted, align: "center" });
          badge(x, 3, ppx + pw + 8, ppy, { r: 9, fill: tint(itemCol(3), 0.55) });
          // 떨리는 손
          const hx0 = X(P.hand[0]), hy0 = Y(P.hand[1]), wob = Math.sin(since / 60) * 1.5;
          for (let i = 0; i < 3; i++) M.line(x, hx0 - 6 + i * 6 + wob, hy0 - 5, hx0 - 8 + i * 6 + wob, hy0 + 5, itemCol(5), 2);
          badge(x, 5, hx0 - 18, hy0, { r: 9, fill: tint(itemCol(5), 0.55) });
          // 속마음 말풍선
          const bubble = (k, p, bx, by, bwid, txt) => {
            const on = vis(k), leak = hop && hopB && k === 2;
            const bh2 = nar ? 22 : 40;
            x.save();
            M.line(x, X(p[0]), Y(p[1]), bx + bwid / 2, by + bh2 / 2, M.alpha(c.ink, on ? 0.5 : 0.2), 1, [2, 3]);
            box(x, bx, by, bwid, bh2, { r: 8, shadow: on, dash: on ? null : [4, 4], fill: on ? tint(leak ? c.b : itemCol(k), leak ? 0.45 : 0.22) : c.sunk, alpha: on ? 1 : 0.75 });
            if (on && !nar) para(x, txt, bx + 8, by + 17, bwid - 14, { size: 12, max: 2, lh: 15, weight: 600 });
            else if (!on) M.text(x, nar ? "?" : "? 닫힘", bx + bwid / 2, by + bh2 / 2 + 5, { size: 12, weight: 700, color: c.muted, align: "center" });
            badge(x, k, bx, by, { r: 9, fill: tint(itemCol(k), 0.55) });
            x.restore();
          };
          const bwid = nar ? 30 : Math.min(150, rw * 0.42);
          bubble(1, P.A, X(0.62), Y(0.8) - (nar ? 11 : 20), bwid, "해고 얘기만 안 나오면 된다");
          bubble(2, P.B, X(0.62), Y(0.2) - (nar ? 11 : 20), bwid, "이미 내정자가 있다");
          // 카메라 아이콘
          x.save(); x.translate(camX, camY); x.rotate(cam.a);
          M.rrect(x, -10, -7, 15, 14, 3); x.fillStyle = c.ink; x.fill();
          x.beginPath(); x.moveTo(5, -4); x.lineTo(11, -7); x.lineTo(11, 7); x.lineTo(5, 4); x.closePath(); x.fill();
          x.restore();
          if (!nar) M.tag(x, step === 0 ? "작가의 눈" : "카메라: " + md.name, PX + 4, PY + planH + (nar ? 4 : 0) - 2, { size: 12, fill: tint(c.key, 0.3) });
          // 오른쪽(아래) 패널
          const QX = nar ? pad : PX + planW + 16, QW = nar ? w - pad * 2 : w - QX - pad;
          let qy = nar ? PY + planH + 12 : PY + 2;
          const n = md.access.length;
          M.text(x, "독자가 받는 정보", QX, qy + 12, { size: 12.5, weight: 700, color: c.ink });
          M.tag(x, `${n} / 5`, QX + QW, qy + 8, { align: "right", size: 12, fill: tint(n === 5 ? c.b : n <= 1 ? c.muted : c.c, 0.3) });
          qy += 22;
          const rowH = nar ? 19 : 23, colsN = nar ? 2 : 1, colW2 = QW / colsN;
          PV_ITEMS.forEach(([k, name, sub], i) => {
            const cx2 = QX + (i % colsN) * colW2, cy2 = qy + Math.floor(i / colsN) * rowH + 10;
            const on = vis(k), leak = hop && hopB && k === 2;
            badge(x, k, cx2 + 9, cy2, { r: 8, size: 10.5, fill: tint(itemCol(k), on ? 0.6 : 0.15) });
            x.save(); x.globalAlpha = on ? 1 : 0.5;
            line1(x, name, cx2 + 23, cy2 + 4.5, colW2 - 50, { size: 12, weight: on ? 600 : 500, color: on ? c.ink : c.muted });
            x.restore();
            M.text(x, leak ? "새어 나옴" : on ? "✓" : "✕", cx2 + colW2 - 6, cy2 + 4.5, { size: leak ? 12 : 13, weight: 700, color: leak ? c.b : on ? c.c : c.muted, align: "right" });
          });
          qy += Math.ceil(5 / colsN) * rowH + (nar ? 6 : 12);
          // 문장
          const bx = QX, bwid2 = QW, bh3 = h - qy - 6;
          box(x, bx, qy, bwid2, bh3, { r: 10, shadow: !nar });
          const hidden = PV_ITEMS.filter(([k]) => !md.access.includes(k));
          if (!nar && step > 0 && hidden.length && !hop) {
            let hy = qy + bh3 - 16 - 26;
            M.line(x, bx + 10, hy - 14, bx + bwid2 - 10, hy - 14, c.line, 1);
            M.text(x, "이 시점으로는 쓸 수 없는 것", bx + 12, hy + 2, { size: 12, weight: 700, color: c.muted });
            let tx = bx + 12; hy += 22;
            hidden.forEach(([k, name]) => { x.font = M.font(12, "ui", 600); const tw = x.measureText(name).width + 18; if (tx + tw > bx + bwid2 - 8) return; const tg = M.tag(x, name, tx, hy, { size: 12, fill: tint(itemCol(k), 0.2), color: c.muted }); tx += tg.w + 6; });
          }
          M.text(x, step === 0 ? "작가 노트" : md.voice, bx + 12, qy + (nar ? 17 : 19), { size: 12, weight: 700, color: c.muted });
          const segs = step === 0 ? [[nar ? "다섯 가지 중 무엇을 독자에게 줄지는 카메라가 정합니다." : "이 장면에는 정보가 다섯 개 있습니다. 어떤 시점을 고르느냐에 따라 독자는 그중 일부만 받습니다. 아래 단계를 넘기며 카메라를 옮겨 보세요.", 0]] : hop ? PV_HOP : md.text;
          const size = nar ? 12 : bwid2 > 300 && bh3 > 200 ? 15 : 13.5;
          const R = rich(x, segs.map(([s, k]) => [s, k === "hop" ? { bg: tint(c.b, 0.4), k: "hop" } : k ? { bg: tint(itemCol(k), 0.28) } : null]), bwid2 - 24, size);
          const res = drawRich(x, R, bx + 12, qy + (nar ? 26 : 30) + size, { lh: Math.round(size * (nar ? 1.5 : 1.6)) });
          if (hop && res.spans.hop && !nar) {
            const sp = res.spans.hop[res.spans.hop.length - 1];
            const ty = Math.min(qy + bh3 - 14, sp.y + sp.h + 18);
            M.tag(x, "시점 흔들림 → 빈 줄로 장면을 끊고 바꾼다", bx + 12, ty, { size: 12, fill: tint(c.b, 0.3) });
          }
        },
      };
    },
  });

  /* ===== 5-2 서술 거리 ===== */
  const DS_LV = [
    { z: 1, name: "아주 멀리", segs: [["그해 첫눈이 내린 날 오후, ", "far"], ["한 젊은 여자가", "far"], [" 정류장에서 버스를 놓쳤다.", 0]], tags: [["far", "서술자가 시대와 상황을 요약한다"]], voice: 0 },
    { z: 1.7, name: "멀리", segs: [["수아는", "name"], [" 버스를 놓쳤다. ", 0], ["그녀는 원래 겨울을 싫어했다.", "far"]], tags: [["name", "이름을 부른다"], ["far", "서술자가 인물을 설명한다"]], voice: 0.2 },
    { z: 3, name: "중간", segs: [["수아는 버스가 모퉁이를 도는 것을 ", 0], ["보았다.", "filter"], [" 춥다고 그녀는 ", 0], ["생각했다.", "filter"]], tags: [["filter", "거르는 말: 보았다 · 생각했다"]], voice: 0.45 },
    { z: 6, name: "가까이", segs: [["버스가 모퉁이를 돌아 사라졌다. ", 0], ["이 추위에 이십 분을 더 서 있으라고?", "fid"]], tags: [["fid", "자유간접화법: 인물의 말투가 서술에 섞인다"]], voice: 0.75 },
    { z: 12, name: "아주 가까이", segs: [["버스. 갔다. ", "fid"], ["발가락, 감각이 없다.", "sense"], [" 이십 분. 이십 분이나.", "fid"]], tags: [["sense", "감각이 날것으로 들어온다"], ["fid", "문장이 생각의 속도로 끊긴다"]], voice: 1 },
  ];
  const DS_CURVE = [[0, "도입: 상황을 멀리서"], [1, "인물을 부른다"], [2, "다가간다"], [3, "감정이 오른다"], [4, "정점: 가장 가까이"], [2, "빠져나온다"], [1, "다음 장면으로"]];
  LESSONS.push({
    id: "narrative-distance", ch: 4, order: 2,
    title: "서술 거리",
    lede: "이 레슨을 마치면 같은 순간을 멀리서 요약하는 문장과 인물의 머릿속에서 들리는 문장이 어떻게 다른지, 그리고 한 장면 안에서 거리를 언제 좁히고 넓히는지 알게 됩니다.",
    key: "서술 거리는 카메라와 인물 마음 사이의 거리입니다. '보았다·생각했다' 같은 거르는 말을 빼면 가까워지고, 감정의 정점에서 가장 가깝게 둡니다.",
    steps: [
      ["아주 멀리", "같은 순간을 다섯 거리로 씁니다. 지금은 가장 먼 거리입니다. 화면 속 카메라는 거리 전체를 비추고, 문장은 <b>서술자가 시대와 상황을 요약</b>합니다. 인물은 아직 '한 젊은 여자'입니다. 오른쪽 아래 막대는 이 문장을 누구의 목소리로 듣는지 보여 줍니다."],
      ["이름과 설명", "카메라가 다가가 인물이 보입니다. 서술자가 <b>이름을 부르고</b>, '원래 겨울을 싫어했다'처럼 인물을 바깥에서 설명합니다. 아직 서술자의 목소리가 더 큽니다."],
      ["거르는 말", "'보았다', '생각했다'는 독자와 인물 사이에 유리를 한 장 끼웁니다. 서술자가 '그녀가 이렇게 느꼈다'고 전해 주는 셈입니다. 이런 <b>거르는 말</b>(filter words)을 지우면 독자가 직접 보고 느끼게 됩니다."],
      ["자유간접화법", "'이 추위에 이십 분을 더 서 있으라고?'는 3인칭 서술인데 따옴표도 '생각했다'도 없이 <b>인물의 말투</b>로 들립니다. 서술자와 인물의 목소리가 섞이는 이 기법이 <b>자유간접화법</b>입니다. 3인칭 제한 시점이 1인칭만큼 가까워지는 방법입니다."],
      ["아주 가까이", "카메라가 얼굴 바로 앞까지 왔습니다. 문장이 생각의 속도로 끊기고 감각이 날것으로 들어옵니다. 가장 강렬하지만 <b>오래 쓰면 독자가 지칩니다.</b> 거리 슬라이더로 다섯 단계를 오가며 화면과 문장이 함께 바뀌는 것을 비교해 보세요."],
      ["한 장면 안에서 움직이기", "거리는 한 장면 안에서도 움직입니다. 아래 그래프는 일곱 문단짜리 장면의 거리 곡선입니다. 도입은 멀리서 상황을 잡고, <b>감정의 정점에서 가장 가까이</b> 간 뒤, 끝에서 다시 물러나 다음 장면으로 넘깁니다. 화면의 카메라가 곡선을 따라 움직입니다."],
    ],
    terms: [
      ["서술 거리", "Narrative distance", "서술자가 인물의 마음에서 얼마나 떨어져 있는가. 존 가드너는 이를 '심리적 거리'(psychic distance)라 불렀습니다."],
      ["거르는 말", "Filter words", "'보았다·들었다·느꼈다·생각했다'처럼 인물의 지각을 한 번 거쳐 전하는 말. 빼면 거리가 줄어듭니다."],
      ["자유간접화법", "Free indirect speech", "3인칭 서술 안에 따옴표 없이 인물의 생각과 말투가 섞여 드는 기법. 제임스 우드가 『How Fiction Works』에서 자세히 다룹니다."],
      ["의식의 흐름", "Stream of consciousness", "생각이 떠오르는 순서와 속도 그대로 문장을 끊어 쓰는 방식. 가장 가까운 거리입니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, lvl = 0, zc = 1, since = 0, headR = null;
      const sl = M.slider(api.controls, { id: "dsLv", label: "서술 거리", min: 1, max: 5, step: 1, value: 1, fmt: (v) => `${v} · ${DS_LV[v - 1].name}`, onInput: (v) => { lvl = v - 1; since = 0; } });
      api.controls.append(M.el("p", { class: "hint" }, "1이 가장 멀고 5가 가장 가깝습니다. 화면의 카메라와 문장이 함께 바뀝니다."));
      const TAGCOL = () => { const c = M.col(); return { far: c.a, name: c.c, filter: c.b, fid: c.key, sense: cc().ch4 }; };
      return {
        setStep(s) { step = s; since = 0; if (s < 5) { lvl = s; sl.set(s + 1); } sl.el.style.display = s === 5 ? "none" : ""; },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), c = M.col(), nar = w < 560;
          let cur = lvl, pi = 0;
          if (step === 5) { pi = Math.floor(since / 1700) % DS_CURVE.length; cur = DS_CURVE[pi][0]; }
          const L = DS_LV[cur];
          zc = follow(zc, L.z, dt, step === 5 ? 700 : 500);
          const pad = nar ? 6 : 12;
          const FW = nar ? w - pad * 2 : Math.min(w * 0.5, (h - 20) * 1.05), FH = nar ? Math.min(h * 0.42, FW * 0.62) : h - 20;
          const FX = pad, FY = 8;
          // 화면
          x.save();
          M.rrect(x, FX, FY, FW, FH, 10); x.clip();
          const cx0 = FX + FW / 2, cy0 = FY + FH / 2;
          const feetX = FX + FW * 0.42, feetY = FY + FH * 0.9, ph = FH * 0.3;
          if (!headR) {
            x.save(); x.globalAlpha = 0;
            const r0 = M.art.person(x, { cx: 0, cy: 0, h: 100, who: "B", view: "three-quarter-right", expr: "worried" });
            x.restore(); headR = { dx: r0.head.x / 100, dy: r0.head.y / 100 };
          }
          const hxw = feetX + headR.dx * ph, hyw = feetY + headR.dy * ph;
          const k = clamp01((zc - 1) / 2.2);
          let fx = cx0 + (hxw - cx0) * k, fy = cy0 + (hyw - cy0) * k;
          const hw = FW / (2 * zc), hh = FH / (2 * zc);
          fx = M.clamp(fx, FX + hw, FX + FW - hw); fy = M.clamp(fy, FY + hh, FY + FH - hh);
          x.translate(cx0, cy0); x.scale(zc, zc); x.translate(-fx, -fy);
          M.art.backdrop(x, "street", { x: FX, y: FY, w: FW, h: FH, time: since });
          // 정류장
          const sx = feetX + FH * 0.16, gy = FY + FH * 0.74;
          x.fillStyle = "#5d6670"; x.fillRect(sx - 2, feetY - FH * 0.42, 4, FH * 0.42);
          M.dot(x, sx, feetY - FH * 0.44, FH * 0.045, "#3f7fbf", "#2a1d18");
          // 버스(멀어짐)
          const bt = (since % 5200) / 5200, bxp = FX + FW * (0.6 + bt * 0.9), byp = gy + FH * 0.06;
          x.fillStyle = "#4f8f6a"; M.rrect(x, bxp, byp - FH * 0.16, FH * 0.36, FH * 0.15, 5); x.fill(); x.strokeStyle = "#2a1d18"; x.lineWidth = 1; x.stroke();
          x.fillStyle = "#cfe3ea"; for (let i = 0; i < 4; i++) x.fillRect(bxp + 6 + i * FH * 0.08, byp - FH * 0.14, FH * 0.06, FH * 0.05);
          M.art.person(x, { cx: feetX, cy: feetY, h: ph, who: "B", view: "three-quarter-right", expr: cur >= 3 ? "worried" : "neutral" });
          x.restore();
          // 눈(화면 공간)
          x.save(); M.rrect(x, FX, FY, FW, FH, 10); x.clip();
          for (let i = 0; i < 70; i++) {
            const sxp = FX + ((i * 97.3 + (since / 1000) * (8 + (i % 5) * 3)) % FW), syp = FY + ((i * 53.7 + (since / 1000) * (22 + (i % 7) * 4)) % FH);
            M.dot(x, sxp, syp, 1.2 + (i % 3) * 0.6, "rgba(255,255,255,0.85)");
          }
          if (cur === 4 || zc > 9) {
            const a = clamp01((zc - 8) / 4);
            x.fillStyle = `rgba(20,16,12,${0.35 * a})`; x.fillRect(FX, FY, FW, FH);
            ["발가락", "감각이 없다", "이십 분", "버스"].forEach((wd, i) => {
              const ang = since / 2400 + i * 1.6, rr = Math.min(FW, FH) * 0.32;
              x.globalAlpha = a; M.text(x, wd, cx0 + Math.cos(ang) * rr, cy0 + Math.sin(ang) * rr * 0.7, { size: 14, weight: 700, color: "#fff6e4", align: "center" }); x.globalAlpha = 1;
            });
          }
          x.restore();
          M.rrect(x, FX, FY, FW, FH, 10); x.strokeStyle = c.ink; x.lineWidth = 1.5; x.stroke();
          M.tag(x, `거리 ${cur + 1} · ${L.name}`, FX + 10, FY + 18, { size: 12, fill: tint(c.key, 0.35) });
          // 패널
          const QX = nar ? pad : FX + FW + 16, QW = nar ? w - pad * 2 : w - QX - pad;
          let qy = nar ? FY + FH + 10 : FY;
          const TC = TAGCOL();
          if (step === 5) {
            // 거리 곡선
            const gh = nar ? 64 : Math.min(130, h * 0.3), gx = QX + (nar ? 0 : 0), gw = QW;
            M.text(x, "가까움", gx, qy + 11, { size: 12, color: c.muted });
            const gy0 = qy + 18;
            x.strokeStyle = c.line; x.lineWidth = 1; x.strokeRect(gx + 0.5, gy0 + 0.5, gw - 1, gh - 1);
            const PXc = (i) => gx + 14 + (i / (DS_CURVE.length - 1)) * (gw - 28), PYc = (v) => gy0 + gh - 10 - (v / 4) * (gh - 20);
            x.strokeStyle = c.ink; x.lineWidth = 2.2; x.beginPath();
            DS_CURVE.forEach(([v], i) => (i ? x.lineTo(PXc(i), PYc(v)) : x.moveTo(PXc(i), PYc(v)))); x.stroke();
            DS_CURVE.forEach(([v], i) => M.dot(x, PXc(i), PYc(v), i === pi ? 7 : 4, i === pi ? c.key : c.surface, c.ink));
            M.text(x, "문단 →", gx + gw, gy0 + gh + 15, { size: 12, color: c.muted, align: "right" });
            M.text(x, `${pi + 1}문단 · ${DS_CURVE[pi][1]}`, gx, gy0 + gh + 15, { size: 12, weight: 700, color: c.ink });
            qy = gy0 + gh + 26;
          } else {
            // 거리 눈금
            M.text(x, "멀리", QX, qy + 12, { size: 12, color: c.muted });
            M.text(x, "가까이", QX + QW, qy + 12, { size: 12, color: c.muted, align: "right" });
            const sy0 = qy + 26;
            M.line(x, QX + 6, sy0, QX + QW - 6, sy0, c.line, 2);
            for (let i = 0; i < 5; i++) { const px = QX + 6 + (i / 4) * (QW - 12); M.dot(x, px, sy0, i === cur ? 8 : 4.5, i === cur ? c.key : c.surface, c.ink); }
            qy = sy0 + 18;
          }
          // 문장 카드
          const size = nar ? 13 : QW > 300 ? 16 : 14.5;
          const segs = L.segs.map(([s, k]) => [s, k ? { bg: tint(TC[k], 0.32) } : null]);
          const R = rich(x, segs, QW - 24, size);
          const lh = Math.round(size * 1.6), cardH = R.lines.length * lh + 26;
          box(x, QX, qy, QW, cardH, { r: 10 });
          drawRich(x, R, QX + 12, qy + 14 + size, { lh });
          qy += cardH + 12;
          // 특징 태그
          L.tags.forEach(([k, s]) => {
            M.rrect(x, QX, qy, 12, 12, 3); x.fillStyle = tint(TC[k], 0.5); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
            qy += 6 + para(x, s, QX + 20, qy + 11, QW - 22, { size: 12.5, weight: 600 }) - 6 + 8;
          });
          // 목소리 막대
          if (h - qy > 44) {
            const vy = qy + 18;
            M.text(x, "누구의 목소리로 들리나", QX, vy, { size: 12, weight: 700, color: c.muted });
            const by2 = vy + 10, v = L.voice;
            M.rrect(x, QX, by2, QW, 14, 7); x.fillStyle = tint(c.a, 0.3); x.fill();
            M.rrect(x, QX + QW * (1 - 0), by2, 0, 14, 7);
            x.save(); M.rrect(x, QX, by2, QW, 14, 7); x.clip(); x.fillStyle = tint(c.key, 0.7); x.fillRect(QX + QW * (1 - v), by2, QW * v, 14); x.restore();
            M.rrect(x, QX, by2, QW, 14, 7); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
            M.text(x, "서술자", QX + 6, by2 + 26, { size: 12, color: c.ink, weight: 600 });
            M.text(x, "인물", QX + QW - 6, by2 + 26, { size: 12, color: c.ink, weight: 600, align: "right" });
          }
        },
      };
    },
  });

  /* ===== 5-3 보여주기와 말하기 ===== */
  const SH_EMO = [
    { name: "긴장", tell: "수아는 긴장했다. 면접관이 무서웠다.", show: [["수아는 ", 0], ["이력서를 세 번째로 처음부터 읽었다.", 1], [" ", 0], ["글자가 머리에 들어오지 않았다.", 2]], ev: [[1, "행동", "같은 걸 또 읽는다"], [2, "감각", "글자가 안 들어온다"]], concl: "긴장했구나" },
    { name: "설렘", tell: "수아는 합격 소식에 무척 기뻤다.", show: [["수아는 문자를 읽고 ", 0], ["휴대폰을 엎어 놓았다.", 1], [" ", 0], ["다시 뒤집어 한 번 더 읽었다.", 2]], ev: [[1, "행동", "엎어 놓는다"], [2, "행동", "또 확인한다"]], concl: "믿기지 않을 만큼 기쁘구나" },
    { name: "서운함", tell: "수아는 친구가 약속을 잊어서 서운했다.", show: [["", 0], ["“아, 오늘이었구나.”", 1], [" 친구가 웃었다. 수아는 ", 0], ["가방 속 케이크 상자를 조금 더 깊이 밀어 넣었다.", 2]], ev: [[1, "대사", "잊고 있었다"], [2, "행동", "케이크를 숨긴다"]], concl: "서운하구나" },
  ];
  LESSONS.push({
    id: "show-tell", ch: 4, order: 3,
    title: "보여주기와 말하기",
    lede: "이 레슨을 마치면 감정을 이름으로 말한 문장을 행동·감각·대사로 고쳐 쓰는 법과, 반대로 말하기가 더 나은 자리를 구별하는 법을 알게 됩니다.",
    key: "감정의 정점과 핵심 장면은 증거(행동·감각·대사)로 보여 주고 결론은 독자에게 맡깁니다. 연결부는 말하기로 압축합니다.",
    steps: [
      ["말하기", "왼쪽 원고는 감정에 이름을 붙여 <b>결론을 바로 말합니다</b>. 오른쪽은 독자의 머릿속입니다. 결론은 들어왔지만 증거 칸이 비어 있고, 독자가 할 일이 없습니다. '해보기'에서 감정을 바꿔도 마찬가지입니다."],
      ["증거로 보여주기", "같은 순간을 <b>행동과 감각</b>으로 고쳤습니다. 원고의 칠한 부분이 증거이고, 오른쪽에서 증거가 모여 독자가 스스로 결론을 내립니다. 독자가 추론한 만큼 몰입이 생깁니다. 감정을 바꿔 세 가지 고쳐 쓰기를 비교해 보세요."],
      ["대사 아래의 뜻", "3년 만에 아버지 장례식장에서 만난 형제입니다. 고치기 전 대사는 속마음을 그대로 말합니다. 고친 대사는 넥타이 이야기뿐입니다. 오른쪽 빙산처럼 물 위에는 말한 것만, 물 아래에는 말하지 않은 뜻이 있습니다. 이것이 <b>서브텍스트</b>이고, 독자는 그 틈을 읽으며 즐거워합니다."],
      ["이름 붙이고 또 보여주기", "'화가 났다'고 말한 뒤 '주먹을 꽉 쥐었다'고 또 보여 줍니다. 결론이 두 번 들어오니 독자의 몫이 사라집니다. <b>둘 중 하나면 됩니다.</b> 대개 뒤쪽(증거)을 남기고 앞쪽(이름)을 지웁니다."],
      ["말하기가 나은 곳", "다섯 줄짜리 버스 여행 묘사를 한 줄로 줄였습니다. 아무 일도 일어나지 않는 <b>연결부</b>를 모두 보여 주면 늘어집니다. 오른쪽 그래프처럼 감정이 높은 곳은 보여 주고, 낮은 연결부는 말하기로 건너뜁니다. '항상 보여 줘라'는 틀린 규칙입니다."],
      ["AI 초고 고치기", "AI가 쓴 초고에 흔한 문장입니다. 감정에 이름(복잡한 감정)을 붙이고 상투적 비유(소용돌이)를 썼습니다. 구체적인 <b>행동 하나</b>로 바꾸면 독자가 망설임을 직접 읽어 냅니다. 이런 표현은 작품의 금지 표현 목록에 올려 둡니다."],
    ],
    terms: [
      ["보여주기와 말하기", "Show, don't tell", "감정과 성격을 설명하지 말고 행동·감각·대사로 독자가 느끼게 하라는 조언. 연결부에서는 말하기가 낫습니다."],
      ["서브텍스트", "Subtext", "대사나 행동의 표면 아래에 깔린, 말하지 않은 진짜 뜻. 헤밍웨이는 이를 빙산에 비유했습니다."],
      ["감정 이름", "Named emotion", "'슬펐다·화가 났다'처럼 감정을 단어로 바로 말하는 것. AI 초고에서 특히 잦습니다."],
      ["상투적 표현", "Cliché", "너무 자주 쓰여 더는 아무것도 보여 주지 못하는 비유. '감정이 소용돌이쳤다'가 예입니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, emo = 0, since = 0, mBottom = 0;
      const chips = M.chips(api.controls, { title: "고쳐 쓸 감정", items: SH_EMO.map((e) => e.name), value: 0, onPick: (i) => { emo = i; since = 0; } });
      const hint = M.el("p", { class: "hint" }, "감정마다 증거의 종류(행동·감각·대사)가 달라집니다.");
      api.controls.append(hint);
      const evCol = (k) => [null, M.col().a, M.col().c][k] || M.col().key;
      const mkS = (segs) => segs.map(([s, k]) => [s, k && typeof k === "object" ? k : k ? { bg: tint(evCol(k), 0.32) } : null]);

      /* 원고 카드: 고치기 전 → 고친 후 */
      function manuscript(x, X, Y, W, H, before, after, o = {}) {
        before = mkS(before); after = after && mkS(after);
        const c = M.col(), nar = W < 400, size = nar ? 12.5 : W > 380 && H > 380 ? 17 : 14.5, lh = Math.round(size * 1.6);
        const Rb0 = rich(x, before, W - 24, size), Ra0 = after ? rich(x, after, W - 24, size) : null;
        const need = 36 + Rb0.lines.length * lh + 6 + (Ra0 ? 44 + Ra0.lines.length * lh : 0) + 12;
        const BH = nar ? Math.min(H, need) : Math.min(H, Math.max(need, H * 0.55));
        if (nar) Y = Y - (H - BH) / 2;
        mBottom = Y + (H - BH) / 2 + BH;
        Y = Y + (H - BH) / 2;
        box(x, X, Y, W, BH, { r: 12 });
        let y = Y + 14;
        M.tag(x, o.beforeTag || "고치기 전", X + 12, y + 6, { size: 12, fill: tint(c.b, 0.3) });
        if (o.beforeNote) { x.font = M.font(12, "ui", 600); M.text(x, clip(x, o.beforeNote, W - 130), X + W - 12, y + 10, { size: 12, color: c.b, weight: 600, align: "right" }); }
        y += 22;
        const Rb = rich(x, before, W - 24, size);
        const hb = drawRich(x, Rb, X + 12, y + size, { lh, color: o.after === false ? c.ink : c.muted });
        y += hb.h + 6;
        if (after) {
          const ap = ease((since - 350) / 500);
          M.arrow(x, X + 24, y, X + 24, y + 16 * ap, c.ink, 1.5);
          y += 22;
          x.save(); x.globalAlpha *= ap;
          M.tag(x, "고친 후", X + 12, y + 6, { size: 12, fill: tint(c.c, 0.3) });
          y += 22;
          const Ra = rich(x, after, W - 24, size);
          const ha = drawRich(x, Ra, X + 12, y + size, { lh });
          x.restore();
          return { spans: ha.spans, bottom: y + ha.h };
        }
        return { spans: hb.spans, bottom: y };
      }
      /* 독자의 머릿속: 증거 → 결론 */
      function reader(x, X, Y, W, H, ev, concl, mode) {
        const c = M.col(), nar = W < 400;
        box(x, X, Y, W, H, { r: 12, shadow: false, lw: 1, fill: tint(c.a, 0.05) });
        M.text(x, "독자의 머릿속", X + 12, Y + 20, { size: 12, weight: 700, color: c.muted });
        const evW = nar ? W * 0.5 : W * 0.5, top = Y + 34, slotH = nar ? 30 : 38, gap = 8;
        const n = ev.length, colH = n * slotH + (n - 1) * gap;
        const cy = top + (H - 34 - 40 - colH) / 2;
        const bubX = X + evW + (nar ? 24 : 34), bubW = X + W - 12 - bubX, bubH = nar ? 44 : 60, bubY = cy + colH / 2 - bubH / 2;
        for (let i = 0; i < n; i++) {
          const e = ev[i], sy = cy + i * (slotH + gap);
          if (!e) { box(x, X + 12, sy, evW - 12, slotH, { r: 8, shadow: false, dash: [4, 4], stroke: c.muted, lw: 1 }); M.text(x, "증거 없음", X + 12 + (evW - 12) / 2, sy + slotH / 2 + 4, { size: 12, color: c.muted, align: "center" }); continue; }
          const a = ease((since - 600 - i * 380) / 420);
          x.save(); x.globalAlpha *= a;
          box(x, X + 12, sy, evW - 12, slotH, { r: 8, fill: tint(evCol(e[0]), 0.3) });
          M.text(x, e[1], X + 22, sy + (nar ? 19 : 16), { size: 12, weight: 700, color: c.muted });
          if (!nar) line1(x, e[2], X + 22, sy + 31, evW - 32, { size: 12.5, weight: 600 });
          else line1(x, e[2], X + 52, sy + 19, evW - 62, { size: 12, weight: 600 });
          x.restore();
          if (a > 0.5) M.arrow(x, X + evW + 2, sy + slotH / 2, bubX - 4, bubY + bubH / 2, M.alpha(c.ink, 0.7), 1.3);
        }
        const bA = mode === "tell" ? 1 : ease((since - 600 - ev.length * 380 - 200) / 450);
        x.save(); x.globalAlpha *= mode === "tell" ? 1 : 0.25 + 0.75 * bA;
        box(x, bubX, bubY, bubW, bubH, { r: bubH / 2, fill: mode === "tell" ? c.sunk : tint(c.key, 0.45), dash: null });
        para(x, concl, bubX + bubW / 2, bubY + bubH / 2 + (paraH(x, concl, bubW - 18, { size: 13, weight: 700 }) > 22 ? -3 : 5), bubW - 18, { size: 13, weight: 700, align: "center", lh: 17, max: 2 });
        x.restore();
        M.text(x, mode === "tell" ? "작가가 결론을 대신 말함" : "독자가 스스로 낸 결론", bubX + bubW / 2, bubY + bubH + 18, { size: 12, weight: 600, color: mode === "tell" ? c.b : c.ink, align: "center" });
        // 독자의 몫
        const my = Y + H - 26, mw = W - 24 - (nar ? 70 : 96);
        M.text(x, "독자의 몫", X + 12, my + 9, { size: 12, weight: 700, color: c.ink });
        const share = mode === "tell" ? 0 : mode === "double" ? 0.15 : Math.min(1, ev.length * 0.42) * bA;
        M.rrect(x, X + (nar ? 70 : 84), my, mw, 12, 6); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
        if (share > 0.01) { M.rrect(x, X + (nar ? 70 : 84), my, mw * share, 12, 6); x.fillStyle = c.c; x.fill(); }
      }
      function iceberg(x, X, Y, W, H) {
        const c = M.col(), nar = W < 400;
        box(x, X, Y, W, H, { r: 12, shadow: false, lw: 1 });
        const wl = nar ? Y + 58 : Y + H * 0.36;
        x.save(); M.rrect(x, X, Y, W, H, 12); x.clip();
        x.fillStyle = tint(c.a, 0.18); x.fillRect(X, wl, W, Y + H - wl);
        // 빙산
        const cx = X + W / 2, topY = nar ? Y + 10 : Y + 30, bw = W * 0.34, deep = Y + H - 10;
        x.beginPath(); x.moveTo(cx - bw * 0.35, topY + 26); x.lineTo(cx + bw * 0.1, topY + 18); x.lineTo(cx + bw * 0.45, wl);
        x.lineTo(cx + bw * 1.25, wl + (deep - wl) * 0.45); x.lineTo(cx + bw * 0.6, deep); x.lineTo(cx - bw * 0.8, deep - 6); x.lineTo(cx - bw * 1.3, wl + (deep - wl) * 0.4); x.lineTo(cx - bw * 0.45, wl); x.closePath();
        x.fillStyle = c.surface; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.25; x.stroke();
        x.restore();
        M.line(x, X, wl, X + W, wl, c.a, 1.5, [6, 4]);
        if (!nar) M.text(x, "물 위: 말한 것", X + 12, Y + 20, { size: 12, weight: 700, color: c.muted });
        M.text(x, "물 아래: 말하지 않은 뜻", X + 12, wl + 18, { size: 12, weight: 700, color: c.muted });
        { const qs = "“넥타이 아직도 혼자 못 매? 이리 와 봐.”", qw = W - 24, qsz = nar ? 12.5 : 14, qh = paraH(x, qs, qw - 16, { size: qsz, weight: 700, lh: 18 });
          box(x, X + 12, topY - 2, qw, qh + 14, { r: 8, fill: tint(c.key, 0.3) });
          para(x, qs, cx, topY + 16, qw - 16, { size: qsz, weight: 700, align: "center", lh: 18 }); }
        const under = ["네가 아직 걱정된다", "예전처럼 지내고 싶다", "먼저 사과하긴 어렵다"];
        const uy = wl + (nar ? 28 : 34), uh = (deep - uy - 4) / under.length;
        under.forEach((u, i) => {
          const a = ease((since - 500 - i * 450) / 450);
          x.save(); x.globalAlpha *= a;
          M.tag(x, u, cx, uy + i * uh + uh * 0.35, { align: "center", size: nar ? 12 : 12.5, fill: tint(c.key, 0.35) });
          x.restore();
        });
      }
      function bigShape(x, X, Y, W, H) {
        const c = M.col();
        box(x, X, Y, W, H, { r: 12, shadow: false, lw: 1 });
        M.text(x, "한 장의 감정 곡선", X + 12, Y + 20, { size: 12, weight: 700, color: c.muted });
        const g = { x: X + 12, y: Y + 34, w: W - 24, h: H - 80 };
        const pts = [0.2, 0.35, 0.85, 0.3, 0.15, 0.25, 0.95, 0.4];
        const PXs = (i) => g.x + (i / (pts.length - 1)) * g.w, PYs = (v) => g.y + g.h - v * g.h;
        const pr = clamp01(since / 1400);
        x.save(); x.beginPath(); x.rect(g.x - 4, g.y - 4, (g.w + 8) * pr, g.h + 8); x.clip();
        x.beginPath(); pts.forEach((v, i) => (i ? x.lineTo(PXs(i), PYs(v)) : x.moveTo(PXs(i), PYs(v))));
        x.strokeStyle = c.ink; x.lineWidth = 2.2; x.stroke(); x.restore();
        pts.forEach((v, i) => {
          if (i / (pts.length - 1) > pr + 0.01) return;
          const show = v > 0.6;
          M.dot(x, PXs(i), PYs(v), 5, show ? c.key : tint(c.a, 0.5), c.ink);
        });
        const ly = Y + H - 30;
        M.dot(x, X + 18, ly, 5, c.key, c.ink); M.text(x, "정점: 보여주기", X + 28, ly + 4, { size: 12, weight: 600, color: c.ink });
        M.dot(x, X + 18, ly + 18, 5, tint(c.a, 0.5), c.ink); M.text(x, "연결부: 말하기로 압축", X + 28, ly + 22, { size: 12, weight: 600, color: c.ink });
        // 지금 고친 곳 표시(5번째 점)
        if (pr > 0.6) M.callout(x, "버스 여행", PXs(4), PYs(pts[4]), PXs(4) + 30, PYs(pts[4]) - 30, { size: 12 });
      }
      return {
        setStep(s) { step = s; since = 0; chips.el.style.display = s <= 1 ? "" : "none"; hint.style.display = s <= 1 ? "" : "none"; },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), c = M.col(), nar = w < 560, pad = nar ? 6 : 12;
          const E = SH_EMO[emo];
          const LW = nar ? w - pad * 2 : w * 0.54, LH = nar ? h * 0.56 : h - 16;
          const RX = nar ? pad : pad + LW + 14, RW = nar ? w - pad * 2 : w - RX - pad;
          const ry = () => (nar ? mBottom + 10 : 8), rh = () => (nar ? h - ry() - 6 : h - 16);
          const mk = (segs) => segs.map(([s, k]) => [s, k && typeof k === "object" ? k : k ? { bg: tint(evCol(k), 0.32) } : null]);
          if (step === 0) {
            manuscript(x, pad, 8, LW, LH, [[E.tell, { bg: tint(c.b, 0.22) }]], null, { beforeTag: "말하기", beforeNote: "감정 이름 = 결론", after: false });
            reader(x, RX, ry(), RW, rh(), [null, null], E.concl, "tell");
          } else if (step === 1) {
            manuscript(x, pad, 8, LW, LH, [[E.tell, { strike: M.alpha(c.b, 0.8) }]], mk(E.show), { beforeTag: "말하기" });
            reader(x, RX, ry(), RW, rh(), E.ev, E.concl, "show");
          } else if (step === 2) {
            manuscript(x, pad, 8, LW, LH, [["“형, 나 그동안 형한테 서운했어. 그래도 다시 잘 지내고 싶어.”", { strike: M.alpha(c.b, 0.8) }]], [["“", 0], ["넥타이 아직도 혼자 못 매?", { bg: tint(c.key, 0.35) }], [" 이리 와 봐.” 형은 동생의 대답을 기다리지 않고 매듭을 풀었다.", 0]], { beforeTag: "속마음을 그대로", beforeNote: nar ? "" : "3년 만에, 아버지 장례식장" });
            iceberg(x, RX, ry(), RW, rh());
          } else if (step === 3) {
            manuscript(x, pad, 8, LW, LH, [["수아는 화가 났다.", { strike: M.alpha(c.b, 0.8), bg: tint(c.b, 0.2) }], [" 주먹을 꽉 쥐었다.", { bg: tint(c.a, 0.25) }]], [["수아는 ", 0], ["주먹을 꽉 쥐었다.", 1], [" 컵 속 얼음이 소리를 냈다.", 2]], { beforeTag: "이름 + 증거", beforeNote: "결론이 두 번" });
            reader(x, RX, ry(), RW, rh(), [[1, "행동", "주먹을 쥔다"], [2, "감각", "얼음이 떨린다"]], "화가 났구나", "show");
          } else if (step === 4) {
            const trip = "수아는 버스에 올랐다. 창밖으로 논이 지나갔다. 휴게소에서 우동을 먹었다. 다시 버스에 탔다. 졸다 깨니 또 논이었다. 그렇게 사흘이 걸렸다.";
            manuscript(x, pad, 8, LW, LH, [[trip, null]], [["사흘 뒤, 수아는 서울에 도착했다.", { bg: tint(c.a, 0.3) }]], { beforeTag: "전부 보여주기", beforeNote: "아무 일도 없는 6문장" });
            bigShape(x, RX, ry(), RW, rh());
          } else {
            manuscript(x, pad, 8, LW, LH, [["그녀의 마음속에 ", 0], ["복잡한 감정이", { bg: tint(c.b, 0.25) }], [" ", 0], ["소용돌이쳤다.", { bg: tint(c.key, 0.35) }]], [["수아는 ", 0], ["펜 뚜껑을 닫았다가 다시 열었다.", 1]], { beforeTag: "AI 초고", beforeNote: "감정 이름 + 상투 비유" });
            reader(x, RX, ry(), RW, rh(), [[1, "행동", "닫았다 연다"]], "망설이는구나", "show");
          }
        },
      };
    },
  });

  /* =========================================================
     6장 · 정보 설계
     ========================================================= */

  /* ===== 6-1 누가 무엇을 아는가 ===== */
  const IG_E = 0.88; /* 폭발 시각 */
  const IG_PRE = [[0.4, 0.4], [1, 1], [0.08, 1], [1, 0.12], [0.08, 1], null];
  LESSONS.push({
    id: "info-gap", ch: 5, order: 1,
    title: "누가 무엇을 아는가",
    lede: "이 레슨을 마치면 독자와 인물이 각각 언제 무엇을 아는지를 두 줄로 그려 보고, 그 차이에서 놀람·서스펜스·미스터리·극적 아이러니·반전이 어떻게 생기는지 알게 됩니다.",
    key: "독자가 인물보다 더 알면 서스펜스, 덜 알면 미스터리, 같이 모르다 터지면 놀람입니다. 놀람은 한 번이고 서스펜스는 지속됩니다.",
    steps: [
      ["두 줄 타임라인", "카페 탁자 밑에 폭탄이 있고, 두 사람은 아무것도 모른 채 15분 동안 야구 이야기를 합니다. 위 줄은 <b>독자</b>, 아래 줄은 <b>인물</b>이 폭탄을 알게 되는 때입니다. 지금은 둘이 같은 순간에 압니다. 함께 발견하니 독자는 인물과 같은 자리에서 놀랍니다. 아래 그래프가 독자의 긴장입니다."],
      ["놀람: 둘 다 모른다", "독자도 인물도 끝까지 모르다가 폭탄이 터집니다. 긴장 그래프는 폭발하는 순간 한 번 튀고 끝납니다. 그 전 15분의 대화는 그냥 평범한 대화입니다. 알프레드 히치콕이 트뤼포와의 대담에서 든 예입니다. <b>놀람은 몇 초</b>입니다."],
      ["서스펜스: 독자가 먼저 안다", "이번엔 첫 장면에서 독자에게만 폭탄을 보여 줍니다. 두 줄 사이의 칠한 띠가 <b>독자 > 인물</b>인 구간입니다. 같은 야구 이야기가 이제 15분 내내 조마조마합니다. 그래프가 폭발 전부터 계속 오릅니다. 히치콕의 결론처럼 <b>서스펜스는 지속</b>됩니다."],
      ["미스터리: 인물이 먼저 안다", "반대로 인물은 폭탄을 알고 독자는 모릅니다. 인물이 자꾸 시계를 보고 탁자 밑을 흘깃거리는데 이유를 알 수 없습니다. 보라색 띠가 <b>인물 > 독자</b> 구간이고, 그래프는 긴장 대신 <b>궁금증</b>이 쌓입니다. 독자가 알게 되는 순간 풀립니다. 두 슬라이더로 직접 바꿔 보세요."],
      ["극적 아이러니", "다시 독자만 아는 상태입니다. 인물이 웃으며 \"천천히 드세요, 시간 많아요\"라고 말합니다. 인물에게는 평범한 말인데 독자에게는 전혀 다르게 들립니다. 독자가 아는 것을 인물이 모를 때 대사가 두 겹이 되는 것, 이것이 <b>극적 아이러니</b>입니다. 『로미오와 줄리엣』의 마지막 장면이 대표적입니다."],
      ["반전: 믿음이 뒤집힌다", "반전은 정보가 아니라 <b>독자의 믿음</b>을 뒤집습니다. 독자는 친절한 웨이터를 무관하다고 믿다가 끝에서 그가 폭탄을 두었다는 것을 압니다. 그 순간 앞의 단서 세 개가 다시 보입니다. '해보기'에서 단서를 빼면 같은 반전이 반칙이 됩니다. 공정한 반전은 다시 읽으면 증거가 있어야 합니다."],
    ],
    terms: [
      ["서스펜스", "Suspense", "독자가 인물보다 더 많이 알아 '거기 가면 안 돼'라고 조마조마한 상태. 정보를 먼저 줄수록 길어집니다."],
      ["놀람", "Surprise", "독자도 모르던 일이 갑자기 드러날 때의 짧은 충격. 히치콕은 놀람은 몇 초, 서스펜스는 몇 분이라고 했습니다."],
      ["미스터리", "Mystery", "인물(또는 작가)은 아는데 독자는 모르는 상태. 궁금증이 동력이 됩니다."],
      ["극적 아이러니", "Dramatic irony", "독자는 알고 인물은 모를 때, 인물의 평범한 말과 행동이 독자에게 이중의 뜻으로 읽히는 효과."],
      ["반전", "Twist", "독자가 믿던 해석을 뒤집는 전개. 단서가 미리 있었고, 서술이 거짓말을 하지 않았고, 앞 장면이 새로 읽혀야 공정합니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, R = 0.4, C = 0.4, noClue = false, since = 0;
      const fmt = (v) => (v >= 0.9 ? "폭발할 때" : `${Math.round(v * 15)}분째`);
      const sR = M.slider(api.controls, { id: "igR", label: "독자가 폭탄을 아는 때", min: 0, max: 1, step: 0.02, value: 0.4, fmt, onInput: (v) => { R = v; since = 0; } });
      const sC = M.slider(api.controls, { id: "igC", label: "인물이 폭탄을 아는 때", min: 0, max: 1, step: 0.02, value: 0.4, fmt, onInput: (v) => { C = v; since = 0; } });
      const ck = M.check(api.controls, { id: "igClue", label: "반전의 단서 세 개 빼기", onChange: (v) => { noClue = v; since = 0; } });
      const hint = M.el("p", { class: "hint" }, "끝까지 밀면 '폭발할 때'(그 전엔 모름)입니다.");
      api.controls.append(hint);
      const tR = () => (R >= 0.9 ? IG_E : R), tC = () => (C >= 0.9 ? IG_E : C);
      const curves = (t) => {
        const r = tR(), q = tC(), rk = t >= r, ckk = t >= q;
        let s = 0, m = 0;
        if (t < IG_E) {
          if (rk && !ckk) s = 0.3 + 0.62 * clamp01((t - r) / Math.max(0.05, IG_E - r));
          else if (rk && ckk) s = 0.42;
          if (ckk && !rk) m = 0.3 + 0.45 * clamp01((t - q) / 0.5);
        } else {
          const d = (t - IG_E) / 0.12;
          s = Math.max(0, 1 - d) * (r < IG_E ? 1 : 0);
        }
        if (r >= IG_E) s = Math.max(s, Math.max(0, 1 - Math.abs(t - IG_E - 0.012) / 0.03));
        return [s, m];
      };
      return {
        setStep(s) {
          step = s; since = 0;
          if (IG_PRE[s]) { [R, C] = IG_PRE[s]; sR.set(R); sC.set(C); }
          sR.el.style.display = sC.el.style.display = s === 5 ? "none" : "";
          ck.el.style.display = s === 5 ? "" : "none"; if (s !== 5) { noClue = false; ck.set(false); }
          hint.textContent = s === 5 ? "단서를 빼면 반전 뒤에 다시 볼 증거가 사라집니다." : "끝까지 밀면 '폭발할 때'(그 전엔 모름)입니다.";
        },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), c = M.col(), e = cc(), nar = w < 560;
          const pad = nar ? 6 : 14, LBL = nar ? 40 : 62;
          const X0 = pad + LBL, W0 = w - X0 - pad - (nar ? 4 : 10);
          const T = (u) => X0 + u * W0;
          const dur = 6500, hold = 1600, play = clamp01((since % (dur + hold)) / dur);
          // 머리글
          M.text(x, nar ? "탁자 밑 폭탄 · 15분의 대화" : "카페, 탁자 밑에 폭탄 · 두 사람의 15분짜리 대화", pad, 16, { size: 12.5, weight: 700, color: c.ink });
          if (step === 5) return reversal(x, w, h, c, nar, pad, X0, W0, T, play);
          const r = tR(), q = tC();
          const kind = r >= IG_E && q >= IG_E ? ["놀람", c.key] : r < q - 0.04 ? ["서스펜스 · 독자 > 인물", c.b] : q < r - 0.04 ? ["미스터리 · 인물 > 독자", e.ch2] : ["함께 발견", c.c];
          M.tag(x, kind[0], w - pad, 12, { align: "right", size: 12, fill: tint(kind[1], 0.32) });
          // 시간 눈금
          const ly0 = 62, laneH = nar ? 20 : 24, gapH = nar ? 22 : 30, ly1 = ly0 + laneH + gapH;
          M.line(x, T(IG_E), ly0 - 10, T(IG_E), ly1 + laneH + 6, c.b, 1.5, [4, 3]);
          M.text(x, "폭발", T(IG_E), ly0 - 13, { size: 12, weight: 700, color: c.b, align: "center" });
          if (!nar) { M.text(x, "0분", T(0), ly0 - 13, { size: 12, color: c.muted, align: "center" }); }
          // 띠(정보 격차)
          const N = 120;
          for (let i = 0; i < N; i++) {
            const u = i / N; if (u >= IG_E) break;
            const rk = u >= r, kk = u >= q;
            if (rk === kk) continue;
            x.fillStyle = tint(rk ? c.b : e.ch2, 0.3); x.fillRect(T(u), ly0 + laneH, W0 / N + 0.6, gapH);
          }
          const midGap = (() => { const a = Math.min(r, q), b = Math.min(Math.max(r, q), IG_E); return b - a > 0.08 ? [(a + b) / 2, r < q ? "독자 > 인물" : "인물 > 독자"] : null; })();
          if (midGap) M.text(x, midGap[1], T(midGap[0]), ly0 + laneH + gapH / 2 + 4, { size: 12, weight: 700, color: c.ink, align: "center" });
          // 두 줄
          const lane = (y, name, learn, col) => {
            M.text(x, name, X0 - 8, y + laneH / 2 + 4, { size: 12, weight: 700, color: c.ink, align: "right" });
            M.rrect(x, T(0), y, W0, laneH, 6); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
            const a = Math.min(learn, 1), bx = T(a);
            if (a < 1) { M.rrect(x, bx, y, T(1) - bx, laneH, 6); x.fillStyle = tint(col, 0.55); x.fill(); x.strokeStyle = c.ink; x.stroke(); }
            M.dot(x, bx, y + laneH / 2, 6, col, c.ink);
            if (!nar && T(1) - bx > 70) M.text(x, "폭탄을 안다", bx + 12, y + laneH / 2 + 4, { size: 12, weight: 600, color: c.ink });
          };
          lane(ly0, "독자", r, c.a);
          lane(ly1, "인물", q, c.c);
          // 재생 머리
          M.line(x, T(play), ly0 - 4, T(play), ly1 + laneH + 4, c.ink, 1.5);
          // 극적 아이러니 말풍선
          if (step === 4 && play > 0.45) {
            const bxp = T(0.5), byp = ly1 + laneH + 8;
            M.callout(x, "“천천히 드세요, 시간 많아요.”", bxp, ly1 + laneH / 2, bxp + (nar ? -6 : 12), byp + 14, { size: 12, fill: tint(c.c, 0.3) });
          }
          // 긴장 그래프
          const gy = ly1 + laneH + (step === 4 ? 52 : 26), gh = h - gy - 24;
          x.strokeStyle = c.line; x.lineWidth = 1; x.strokeRect(T(0) + 0.5, gy + 0.5, W0 - 1, gh - 1);
          M.text(x, nar ? "긴장" : "독자의 긴장", X0 - 8, gy + 14, { size: 12, weight: 700, color: c.ink, align: "right" });
          const Yg = (v) => gy + gh - 4 - v * (gh - 12);
          const draw = (idx, col) => {
            x.save(); x.beginPath(); x.rect(T(0), gy - 2, W0 * play, gh + 4); x.clip();
            x.beginPath(); for (let i = 0; i <= 240; i++) { const u = i / 240, v = curves(u)[idx]; i ? x.lineTo(T(u), Yg(v)) : x.moveTo(T(u), Yg(v)); }
            x.lineTo(T(1), Yg(0)); x.lineTo(T(0), Yg(0)); x.closePath();
            x.fillStyle = M.alpha(col, 0.18); x.fill(); x.strokeStyle = col; x.lineWidth = 2.2; x.stroke(); x.restore();
          };
          draw(1, e.ch2); draw(0, c.b);
          const lx = T(0) + 8;
          M.rrect(x, lx, gy + gh + 9, 10, 10, 2); x.fillStyle = c.b; x.fill();
          M.text(x, "긴장(조마조마)", lx + 14, gy + gh + 18, { size: 12, color: c.ink });
          M.rrect(x, lx + 120, gy + gh + 9, 10, 10, 2); x.fillStyle = e.ch2; x.fill();
          M.text(x, "궁금증", lx + 134, gy + gh + 18, { size: 12, color: c.ink });
          // 긴장의 길이
          let area = 0; for (let i = 0; i < 200; i++) area += curves(i / 200)[0] > 0.25 ? 1 : 0;
          if (!nar) M.text(x, `긴장이 흐른 시간 ${Math.round((area / 200) * 15)}분`, T(1), gy + gh + 18, { size: 12, weight: 700, color: c.ink, align: "right" });
        },
      };
      function reversal(x, w, h, c, nar, pad, X0, W0, T, play) {
        const flip = 0.8, clues = [[0.2, "탁자 밑을 오래 닦는다"], [0.45, "자꾸 시계를 본다"], [0.62, "앞치마가 유난히 무겁다"]];
        M.tag(x, noClue ? "단서 없음 → 반칙" : "공정한 반전", w - pad, 12, { align: "right", size: 12, fill: tint(noClue ? c.b : c.c, 0.32) });
        const ly = 50, laneH = nar ? 30 : 36;
        M.text(x, nar ? "믿음" : "독자의 믿음", X0 - 8, ly + laneH / 2 + 4, { size: 12, weight: 700, color: c.ink, align: "right" });
        const fx = T(flip);
        M.rrect(x, T(0), ly, fx - T(0), laneH, 6); x.fillStyle = tint(c.a, 0.3); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
        line1(x, "웨이터는 사건과 무관하다", T(0) + 10, ly + laneH / 2 + 4, fx - T(0) - 16, { size: nar ? 12 : 13, weight: 600 });
        const after = play >= flip;
        x.save(); x.globalAlpha = after ? 1 : 0.25;
        M.rrect(x, fx + 3, ly, T(1) - fx - 3, laneH, 6); x.fillStyle = tint(c.b, 0.4); x.fill(); x.strokeStyle = c.ink; x.stroke();
        if (!nar) line1(x, "그가 두었다", fx + 10, ly + laneH / 2 + 4, T(1) - fx - 16, { size: 13, weight: 700 });
        x.restore();
        M.text(x, "반전", fx, ly - 8, { size: 12, weight: 700, color: c.b, align: "center" });
        // 장면 줄
        const sy = ly + laneH + (nar ? 70 : 96);
        M.text(x, "장면", X0 - 8, sy + 4, { size: 12, weight: 700, color: c.ink, align: "right" });
        M.line(x, T(0), sy, T(1), sy, c.ink, 1.5);
        M.line(x, T(play), ly - 4, T(play), sy + 8, c.ink, 1.2, [3, 3]);
        if (!noClue) clues.forEach(([u, s], i) => {
          const lit = after;
          M.dot(x, T(u), sy, lit ? 7 : 5, lit ? c.key : c.surface, c.ink);
          if (lit) {
            const a = ease((play - flip) / 0.06 - i * 0.4);
            x.save(); x.globalAlpha = a; x.strokeStyle = c.key; x.lineWidth = 2;
            x.beginPath(); x.moveTo(fx, ly + laneH); x.quadraticCurveTo((fx + T(u)) / 2, ly + laneH + 10, T(u), sy - 8); x.stroke(); x.restore();
          }
          const ty = sy + 20 + (i % 2) * (nar ? 0 : 18);
          if (!nar) M.text(x, s, T(u), ty, { size: 12, weight: lit ? 700 : 500, color: lit ? c.ink : c.muted, align: "center" });
          else badge(x, i + 1, T(u), sy + 18, { r: 8, size: 10.5, fill: lit ? c.key : c.surface });
        });
        // 공정성 점검
        const by = sy + (nar ? 34 : 60), bh = Math.min(118, h - by - 6), bw = Math.min(w - pad * 2, 520), bx = (w - bw) / 2;
        if (bh < 60) return;
        box(x, bx, by, bw, bh, { r: 10, shadow: false, lw: 1 });
        const rows = [["단서가 있었다", !noClue], ["서술이 거짓말하지 않았다", true], ["앞 장면이 새로 읽힌다", !noClue]];
        M.text(x, "공정한 반전의 세 조건", bx + 12, by + 20, { size: 12, weight: 700, color: c.muted });
        const rh2 = Math.min(26, (bh - 30) / 3);
        rows.forEach(([s, ok], i) => {
          const yy = by + 30 + i * rh2 + rh2 / 2;
          M.text(x, ok ? "✓" : "✕", bx + 16, yy + 5, { size: 14, weight: 700, color: ok ? c.c : c.b });
          M.text(x, s, bx + 36, yy + 5, { size: nar ? 12 : 13, weight: 600, color: ok ? c.ink : c.b });
        });
      }
    },
  });

  /* ===== 6-2 복선과 회수 ===== */
  const SP_ITEMS = [
    { id: 1, set: 2, pay: 25, emph: 1, dis: "목록 속에", s: "열쇠 꾸러미에 하나가 빈다", p: "반전: 사라진 등대 열쇠" },
    { id: 2, set: 3, pay: 14, emph: 1, dis: "다른 일에 묻기", s: "추격전 중 스친 배 이름", p: "그 배가 다시 나타난다" },
    { id: 3, set: 4, pay: 25, emph: 2, dis: "다른 의미 붙이기", s: "이장의 왼손 붕대 \"그물에 쓸렸어\"", p: "반전: 붕대 아래 화상" },
    { id: 4, set: 6, pay: 25, emph: 1, dis: "유머로 감싸기", s: "불 얘기에 농담으로 화제를 돌림", p: "반전: 피하던 이유" },
    { id: 5, set: 9, pay: null, fixPay: 28, emph: 3, dis: "클로즈업", s: "낡은 무전기를 오래 들여다봄", p: "무전기로 구조를 부른다" },
    { id: 6, set: null, fixSet: 11, pay: 27, emph: 2, dis: "—", s: "지하 통로 지도", p: "비밀 통로로 탈출" },
  ];
  LESSONS.push({
    id: "setup-payoff", ch: 5, order: 2,
    title: "복선과 회수",
    lede: "이 레슨을 마치면 복선을 심고 거두는 거리를 한 줄에 그려 보고, 회수 없는 복선과 심지 않은 회수를 찾아내고, 반전이 공정한지 점검하는 법을 알게 됩니다.",
    key: "강조한 만큼 약속한 것입니다. 보여 준 것은 쓰고, 쓸 것은 미리 보여 줍니다. 열린 떡밥은 장부로 관리합니다.",
    steps: [
      ["심고 거둔다", "30화짜리 섬마을 미스터리를 한 줄로 폈습니다. 축 아래 동그라미가 <b>복선을 심은 화</b>, 위의 호가 <b>회수한 화</b>까지의 거리입니다. 2화에 심은 열쇠는 25화에야 거둡니다. 거리가 길수록 회수할 때 '아, 그래서!'가 커집니다. 아래 표가 이 이야기의 떡밥 장부입니다."],
      ["강조의 크기 = 약속의 크기", "동그라미 크기는 <b>강조</b>의 크기입니다. 지나가는 한 줄은 작은 약속이고, 인물이 멈춰 서서 들여다본 무전기(⑤)는 큰 약속입니다. 표의 '위장' 칸은 복선을 숨긴 방법입니다. 목록 속에 넣거나, 다른 사건에 묻거나, 농담으로 감싸거나, 그럴듯한 다른 이유를 먼저 줍니다."],
      ["회수 없는 복선", "⑤ 무전기는 9화에서 클로즈업했는데 끝까지 쓰이지 않습니다. 호가 화면 밖으로 끊겨 있습니다. 독자는 강조된 것을 약속으로 받아들이므로 이건 깨진 약속입니다. <b>체호프의 총</b>의 첫 번째 뜻, '보여 준 것은 쓴다'를 어겼습니다. '해보기'에서 고친 버전을 켜면 28화에서 거둡니다."],
      ["심지 않은 회수", "⑥ 27화에서 주인공이 처음 보는 비밀 통로로 탈출합니다. 앞에 심은 것이 없으니 독자는 반칙이라고 느낍니다. 체호프의 총의 두 번째 뜻, <b>'쓸 것은 미리 보여 준다'</b>를 어겼습니다. 고친 버전에서는 11화에 지하 통로 지도를 위장해 심습니다."],
      ["공정한 반전", "25화의 반전 '등대 화재는 이장이 낸 불'에 세 복선(①③④)이 모입니다. 단서가 미리 있었고, 붕대 설명은 인물의 말일 뿐 서술이 사실이라 한 적이 없으며, 반전 뒤에 4화와 6화가 새로 읽힙니다. <b>공정한 반전의 세 조건</b>을 모두 채웠습니다."],
      ["떡밥 장부", "'해보기'의 <b>지금 몇 화</b> 슬라이더를 움직여 보세요. 세로선까지 읽은 독자에게 열린 떡밥이 몇 개인지, 어떤 것이 오래 열려 있는지 표가 알려 줍니다. 장기 연재에서는 이 장부로 회수 계획을 세우고, 오래 열린 것부터 거둡니다."],
    ],
    terms: [
      ["복선", "Foreshadowing", "나중에 일어날 일을 미리 살짝 보여 두는 장치. 처음엔 의미를 모르고 지나가야 효과가 큽니다."],
      ["떡밥 회수", "Setup and payoff", "심어 둔 것을 나중에 의미 있게 거두는 일. 웹소설 독자는 회수되지 않은 설정을 떡밥이라 부르며 기억합니다."],
      ["체호프의 총", "Chekhov's gun", "1막에 걸어 둔 총은 쏴야 하고, 쏘지 않을 총은 걸지 말라는 원칙. 반대로 쏠 총은 미리 걸어 둬야 합니다."],
      ["위장", "Misdirection", "복선을 눈에 띄지 않게 숨기는 기술. 목록 속에 넣기, 다른 일에 묻기, 유머로 감싸기, 다른 의미 붙이기가 대표적입니다."],
      ["떡밥 장부", "Setup ledger", "심은 화·강조·아는 사람·회수 예정·상태를 적어 열린 떡밥을 관리하는 표."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      let step = 0, N = 30, fixed = false, since = 0;
      const sl = M.slider(api.controls, { id: "spN", label: "지금 몇 화까지 읽었나", min: 1, max: 30, step: 1, value: 30, fmt: (v) => `${v}화`, onInput: (v) => { N = v; } });
      const ck = M.check(api.controls, { id: "spFix", label: "고친 버전 (⑤ 28화 회수 · ⑥ 11화에 심기)", onChange: (v) => { fixed = v; since = 0; } });
      api.controls.append(M.el("p", { class: "hint" }, "슬라이더를 왼쪽으로 옮기면 아직 읽지 않은 화의 복선과 회수가 지워집니다."));
      const FOCUS = [null, null, [5], [6], [1, 3, 4], null];
      const eff = (it) => ({ set: it.set ?? (fixed ? it.fixSet : null), pay: it.pay ?? (fixed ? it.fixPay : null) });
      return {
        setStep(s) { step = s; since = 0; if (s !== 5) { N = 30; sl.set(30); } },
        replay() { since = 0; },
        frame(t, dt) {
          since += dt;
          const { x, w, h } = M.fit(cv), c = M.col(), nar = w < 560, pad = nar ? 6 : 14;
          const X0 = pad + 12, W0 = w - pad * 2 - 24, E = (ep) => X0 + ((ep - 1) / 29) * W0;
          const tableH = nar ? 6 * 19 + 24 : Math.min(6 * 24 + 28, h * 0.42);
          const axY = h - tableH - (nar ? 60 : 58), topY = 22;
          const foc = FOCUS[step], isF = (id) => !foc || foc.includes(id);
          // 읽은 범위
          x.fillStyle = tint(c.a, 0.07); x.fillRect(E(1) - 6, topY - 6, E(N) - E(1) + 12, axY - topY + 34);
          // 축
          M.line(x, E(1), axY, E(30), axY, c.ink, 1.5);
          for (let ep = 1; ep <= 30; ep++) {
            const major = ep === 1 || ep % 5 === 0;
            M.line(x, E(ep), axY - (major ? 5 : 3), E(ep), axY + (major ? 5 : 3), c.ink, 1);
            if (major && (!nar || ep % 10 === 0 || ep === 1)) M.text(x, `${ep}화`, E(ep), axY + (nar ? 24 : 34), { size: 12, color: c.muted, align: "center" });
          }
          if (N < 30) { M.line(x, E(N), topY - 8, E(N), axY + 22, c.a, 2); M.tag(x, `지금 ${N}화`, E(N), topY - 6, { align: N > 24 ? "right" : "left", size: 12, fill: tint(c.a, 0.3) }); }
          // 반전 표시
          const tw = E(25);
          if (N >= 25) { M.line(x, tw, topY + 4, tw, axY, c.b, 1.2, [3, 3]); M.text(x, "반전", tw, topY + 1, { size: 12, weight: 700, color: c.b, align: "center" }); }
          const prog = ease(since / 900);
          // 호
          const maxH = axY - topY - 18;
          SP_ITEMS.forEach((it) => {
            const { set, pay } = eff(it), on = isF(it.id);
            if (set != null && set > N) return;
            x.save(); x.globalAlpha = on ? 1 : 0.22;
            const col = itemColSP(it.id);
            if (set != null && pay != null) {
              const ax = E(set), bx = E(Math.min(pay, N)), done = pay <= N;
              const hh = Math.min(maxH, (Math.abs(E(pay) - ax) / W0) * maxH * 1.6 + 14);
              x.strokeStyle = col; x.lineWidth = on && foc ? 3 : 2; if (!done) x.setLineDash([5, 4]);
              x.beginPath(); x.moveTo(ax, axY);
              const steps = 40;
              for (let i = 1; i <= steps; i++) { const u = (i / steps) * prog, px = ax + (E(pay) - ax) * u; if (px > bx + 0.5) break; x.lineTo(px, axY - Math.sin(Math.PI * u) * hh); }
              x.stroke(); x.setLineDash([]);
              if (done && prog > 0.98) { x.save(); x.translate(E(pay), axY); x.rotate(Math.PI / 4); x.fillStyle = col; x.fillRect(-5, -5, 10, 10); x.strokeStyle = c.ink; x.lineWidth = 1; x.strokeRect(-5, -5, 10, 10); x.restore(); }
            } else if (set != null && pay == null) {
              const ax = E(set), hh = maxH * 0.55;
              x.strokeStyle = c.b; x.lineWidth = 2.5; x.setLineDash([5, 5]);
              x.beginPath(); x.moveTo(ax, axY); x.quadraticCurveTo(ax + W0 * 0.1, axY - hh * 1.3, ax + W0 * 0.22 * prog, axY - hh * 0.9); x.stroke(); x.setLineDash([]);
              if (N >= 30 && prog > 0.9 && step !== 1) M.tag(x, nar ? "회수 없음" : "⑤ 회수 없음", ax + W0 * 0.22 + 4, axY - hh * 0.9, { size: 12, fill: tint(c.b, 0.32), align: "left" });
            } else if (set == null && pay != null && pay <= N) {
              const bx = E(pay), hh = maxH * 0.5;
              x.strokeStyle = c.b; x.lineWidth = 2.5; x.setLineDash([3, 4]);
              x.beginPath(); x.moveTo(bx - W0 * 0.12, axY - hh); x.quadraticCurveTo(bx - 10, axY - hh, bx, axY); x.stroke(); x.setLineDash([]);
              M.text(x, "?", bx - W0 * 0.12 - 4, axY - hh + 5, { size: 18, weight: 700, color: c.b, align: "right" });
              x.save(); x.translate(bx, axY); x.rotate(Math.PI / 4); x.fillStyle = c.b; x.fillRect(-5, -5, 10, 10); x.restore();
              M.tag(x, nar ? "급조" : "⑥ 심지 않은 회수", bx, axY - hh - 18, { size: 12, fill: tint(c.b, 0.32), align: "right" });
            }
            x.restore();
          });
          // 심은 점(크기 = 강조)
          SP_ITEMS.forEach((it, k) => {
            const { set } = eff(it); if (set == null || set > N) return;
            const on = isF(it.id), r = 4 + it.emph * (nar ? 2.5 : 3.5);
            x.save(); x.globalAlpha = on ? 1 : 0.3;
            M.dot(x, E(set), axY, r, itemColSP(it.id), c.ink);
            x.restore();
            x.save(); x.globalAlpha = on ? 1 : 0.35;
            badge(x, it.id, E(set), axY - r - 11 - (nar && it.id % 2 === 0 ? 17 : 0), { r: 8, size: 10.5, fill: tint(itemColSP(it.id), 0.5) });
            x.restore();
          });
          if (step === 1 && !nar) {
            M.callout(x, "클로즈업 = 큰 약속", E(9), axY - 16, E(9) + 40, axY - 60, { size: 12 });
          }
          if (step === 4 && N >= 25 && !nar) {
            const bw = 210, bx = E(25) - bw - 16, by = topY + 8;
            box(x, bx, by, bw, 78, { r: 8, shadow: false, lw: 1 });
            ["단서가 있었다 (①③④)", "서술은 거짓말하지 않았다", "4·6화가 새로 읽힌다"].forEach((s, i) => {
              M.text(x, "✓", bx + 10, by + 22 + i * 21, { size: 13, weight: 700, color: c.c });
              M.text(x, s, bx + 28, by + 22 + i * 21, { size: 12, weight: 600, color: c.ink });
            });
          }
          // 장부
          const ty = h - tableH, rowH = nar ? 19 : Math.min(24, (tableH - 28) / 6);
          const cols = nar ? [["", 22], ["복선", W0 - 140], ["심음→회수", 70], ["상태", 60]] : [["", 24], ["복선", (w - pad * 2) * 0.38], ["위장", 110], ["심음", 48], ["회수", 48], ["상태", 0]];
          let cx = pad; const cxs = cols.map(([, cw]) => { const v = cx; cx += cw; return v; });
          M.line(x, pad, ty + 4, w - pad, ty + 4, c.ink, 1);
          cols.forEach(([n], i) => n && M.text(x, n, cxs[i] + 4, ty, { size: 12, weight: 700, color: c.muted }));
          let open = 0;
          SP_ITEMS.forEach((it, i) => {
            const { set, pay } = eff(it), y = ty + 8 + i * rowH + rowH / 2;
            const seen = set != null ? set <= N : pay != null && pay <= N;
            let st, sc;
            if (set == null) { st = pay <= N ? "급조" : "—"; sc = pay <= N ? c.b : c.muted; }
            else if (set > N) { st = "아직"; sc = c.muted; }
            else if (pay == null) { st = N >= 30 ? "회수 없음" : "열림"; sc = c.b; open++; }
            else if (pay <= N) { st = "회수"; sc = c.c; }
            else { st = `열림 ${N - set}화째`; sc = c.key; open++; }
            const on = isF(it.id);
            if (foc && on) { x.fillStyle = tint(c.key, 0.22); x.fillRect(pad, y - rowH / 2 + 1, w - pad * 2, rowH - 2); }
            x.save(); x.globalAlpha = seen ? (on ? 1 : 0.55) : 0.35;
            M.dot(x, cxs[0] + 10, y, 6, itemColSP(it.id), c.ink);
            M.text(x, String(it.id), cxs[0] + 10, y + 4, { size: 10, weight: 700, color: c.ink, align: "center" });
            line1(x, it.s, cxs[1] + 4, y + 4.5, cols[1][1] - 8, { size: 12, weight: 600 });
            if (nar) M.text(x, `${set ?? "?"} → ${pay ?? "?"}`, cxs[2] + 4, y + 4.5, { size: 12, color: c.ink });
            else {
              M.text(x, it.dis, cxs[2] + 4, y + 4.5, { size: 12, color: c.muted });
              M.text(x, set ? `${set}화` : "—", cxs[3] + 4, y + 4.5, { size: 12, color: c.ink });
              M.text(x, pay ? `${pay}화` : "—", cxs[4] + 4, y + 4.5, { size: 12, color: c.ink });
            }
            M.text(x, st, cxs[cols.length - 1] + 4, y + 4.5, { size: 12, weight: 700, color: sc });
            x.restore();
          });
          if (!nar) M.tag(x, `열린 떡밥 ${open}개`, w - pad, ty - 4, { align: "right", size: 12, fill: tint(open ? c.key : c.c, 0.3) });
        },
      };
    },
  });
  const itemColSP = (id) => { const c = M.col(), e = cc(); return [null, c.a, e.ch5, c.c, e.ch2, c.key, c.b][id] || c.ink; };

  /* @@END */
})();
