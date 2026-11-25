/* 이야기의 문법 · 6장 세계와 관계, 7장 장편과 연재 */
(() => {
  /* ---------- 공용 도구 ---------- */
  const follow = (cur, tgt, dt, ms = 300) => cur + (tgt - cur) * (1 - Math.pow(0.004, (dt || 16) / ms));
  let _cv = null, _cvKey = null;
  const C = () => {
    const c = M.col();
    if (_cvKey !== c) {
      const s = getComputedStyle(document.documentElement), g = (n) => s.getPropertyValue(n).trim();
      _cv = { ...c, ink2: g("--ink2"), faint: g("--faint"), line2: g("--line2"), card: g("--card"),
        ch2: g("--ch2"), ch4: g("--ch4"), ch6: g("--ch6"), ch7: g("--ch7") };
      _cvKey = c;
    }
    return _cv;
  };
  /* 점들 사이를 부드럽게 잇는 함수 [[t, v], ...] */
  const pw = (pts) => (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      if (t <= x1) { const [x0, y0] = pts[i - 1]; return y0 + (y1 - y0) * M.smooth((t - x0) / (x1 - x0)); }
    }
    return pts[pts.length - 1][1];
  };
  const font = (x, size, weight = 500, mono) => (x.font = M.font(size, mono ? "mono" : "ui", weight));
  const wrapLines = (x, s, maxW) => {
    const out = []; let ln = "";
    for (const wd of s.split(" ")) {
      const t = ln ? ln + " " + wd : wd;
      if (!ln || x.measureText(t).width <= maxW) ln = t; else { out.push(ln); ln = wd; }
    }
    if (ln) out.push(ln);
    return out;
  };
  /* 폭에 맞춰 글자 크기를 줄임(12px 아래로는 안 줄임) */
  const fitSize = (x, s, maxW, size, weight = 500) => {
    for (let z = size; z > 12; z -= 0.5) { font(x, z, weight); if (x.measureText(s).width <= maxW) return z; }
    return 12;
  };
  const T = (x, s, px, py, o = {}) => M.text(x, s, px, py, { size: 12, ...o });
  const box = (x, px, py, w, h, r, fill, stroke, lw = 1) => {
    M.rrect(x, px, py, w, h, r);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
  };
  const hatch = (x, px, py, w, h, col, gap = 6) => {
    x.save(); x.beginPath(); x.rect(px, py, w, h); x.clip();
    x.strokeStyle = col; x.lineWidth = 1;
    for (let k = -h; k < w; k += gap) { x.beginPath(); x.moveTo(px + k, py + h); x.lineTo(px + k + h, py); x.stroke(); }
    x.restore();
  };

  /* 무대: 캔버스 + (선택) 고치기 전/후 문장 띠 */
  function shell(api, o = {}) {
    const root = M.el("div", { class: "serial-stage" });
    const wrap = M.el("div", { class: "serial-cv" });
    const cv = document.createElement("canvas");
    wrap.append(cv); root.append(wrap);
    const prose = M.el("div", { class: "serial-prose" });
    const cards = [0, 1].map(() => {
      const h = M.el("div", { class: "serial-pr__h" }, M.el("b"), M.el("span"));
      const t = M.el("div", { class: "serial-pr__t" });
      const card = M.el("div", { class: "serial-pr" }, h, t);
      prose.append(card);
      return { card, h, t };
    });
    if (o.prose !== false) root.append(prose);
    api.stage.append(root);
    let last = "";
    /* items: [[kind(bad|good|info), 꼬리표, 짧은 설명, 본문 HTML], ...] */
    const setProse = (items) => {
      const key = JSON.stringify(items);
      if (key === last) return; last = key;
      if (!items) { prose.hidden = true; return; }
      prose.hidden = false; prose.dataset.mode = items.length === 1 ? "one" : "two";
      cards.forEach((cd, i) => {
        const it = items[i]; cd.card.hidden = !it; if (!it) return;
        cd.card.className = "serial-pr " + it[0];
        cd.h.firstChild.textContent = it[1]; cd.h.lastChild.textContent = it[2] || "";
        cd.t.innerHTML = it[3];
        void cd.card.offsetWidth; cd.card.classList.add("swap");
      });
    };
    const fit = () => M.fit(cv);
    return { root, cv, setProse, fit };
  }
  const hint = (api, s) => api.controls.append(M.el("p", { class: "hint" }, s));

  /* =====================================================================
     6-1 규칙과 대가 (세계관의 규칙 · 마법 체계 · 샌더슨의 법칙)
     ===================================================================== */
  LESSONS.push({
    id: "rules-cost", ch: 6, order: 1,
    title: "규칙과 대가",
    lede: "이 레슨을 마치면 능력에 한계·대가·비용을 붙여 위기마다 긴장을 만드는 법과, 클라이맥스에서 규칙으로 문제를 풀어도 되는 조건을 알게 됩니다.",
    key: "능력은 한계·대가·비용이 붙어야 이야기가 됩니다. 클라이맥스에서 쓸 규칙은 미리 보여 주고, 새 능력을 더하기보다 이미 있는 규칙을 넓혀 씁니다.",
    steps: [
      ["무엇이든 되는 힘", "왼쪽 저울에는 '손을 대면 불이 꺼진다'는 능력만 올라가 있고, 반대편 접시는 비어 있습니다. 오른쪽은 주인공 하준이 겪는 <b>위기 다섯 개</b>에서 독자가 느끼는 긴장입니다. 어떤 불이든 손짓 한 번에 꺼지니 막대가 모두 바닥이고, 판정은 '어차피 이긴다'입니다."],
      ["한계를 건다", "<b>한계</b> '자기 몸에 닿은 불만 끈다'를 올렸습니다. 내 손에 붙은 불과 결투 상대의 불덩이는 여전히 쉽지만, 창고·동생 방·시장처럼 <b>남의 불</b>인 위기는 능력 밖이 되어 막대가 솟습니다. 할 수 없는 일이 생기자 인물이 다른 방법을 찾아야 합니다."],
      ["대가를 붙인다", "<b>대가</b> '쓸수록 손끝 감각이 사라진다'를 더했습니다. 이제 쉬운 위기에서도 능력을 쓸지 말지 <b>선택</b>해야 해서 모든 막대가 올라갑니다. 아래 문장 비교처럼, 대가가 있으면 손을 드는 장면이 망설임의 장면으로 바뀝니다."],
      ["비용: 시간과 자원", "<b>비용</b> '한 번 쓰면 반나절 못 쓴다'까지 올리자 저울이 수평이 됐습니다. 위기가 연달아 오는 창고와 결투에서는 '아직 못 씀'이 붙어 긴장이 가장 큽니다. 브랜던 샌더슨이 말한 <b>제2법칙</b>, 한계가 힘보다 흥미롭다는 원리가 이 막대들입니다."],
      ["제1법칙: 아는 만큼 풀 수 있다", "오른쪽이 20화까지 <b>독자가 그 규칙을 얼마나 아는가</b>로 바뀌었습니다. 20화 클라이맥스에서 하준은 한계를 역이용해 문제를 풉니다. 3화에 한계를 보여 주고 두 번 더 쓰면 해결이 영리해 보이고, '19화'나 '안 보여 줌'으로 바꾸면 같은 해결이 편의주의로 떨어집니다. 직접 해보기에서 시점을 바꿔 보세요."],
      ["제3법칙: 새로 더하기 전에 넓힌다", "클라이맥스에서 <b>새 능력이 각성</b>하면 왼쪽 접시에 대가 없는 무게가 얹혀 저울이 다시 기웁니다. 독자는 그 능력을 처음 보니 설득력이 바닥입니다. 이미 있는 한계를 뒤집어 쓰는 해결은 새 설정 없이도 놀랍습니다. '클라이맥스 해결'을 바꿔 비교해 보세요."],
    ],
    terms: [
      ["마법 체계", "Magic system", "이야기 속 초자연적 힘이 따르는 규칙의 묶음. 무엇을 할 수 있고, 무엇은 못 하며, 쓰면 무엇을 잃는지를 정합니다."],
      ["하드 마법 / 소프트 마법", "Hard / soft magic", "규칙을 독자에게 밝히는 쪽이 하드, 신비로 남겨 두는 쪽이 소프트입니다. 하드 쪽일수록 문제 해결 도구로 써도 공정해 보입니다."],
      ["샌더슨의 법칙", "Sanderson's Laws", "작가 브랜던 샌더슨이 정리한 세 원칙. ① 마법으로 갈등을 푸는 힘은 독자가 그 마법을 이해한 정도에 비례 ② 한계가 힘보다 흥미롭다 ③ 새로 더하기 전에 있는 것을 넓혀라."],
      ["대가", "Cost", "능력을 쓸 때 잃는 것. 대가가 있으면 능력 사용이 해결이 아니라 선택이 되어 장면에 긴장이 생깁니다."],
      ["데우스 엑스 마키나", "Deus ex machina", "앞에서 준비하지 않은 힘이나 우연으로 갑자기 문제를 푸는 결말. 독자는 작가의 편의로 받아들입니다."],
    ],
    mount(api) {
      const S = shell(api);
      const CR = [
        { n: "내 손에 붙은 불", self: 1, quick: 0 },
        { n: "무너지는 창고", self: 0, quick: 1 },
        { n: "동생 방의 불", self: 0, quick: 0 },
        { n: "결투 상대의 불덩이", self: 1, quick: 1 },
        { n: "번지는 시장 화재", self: 0, quick: 0 },
      ];
      const WT = [["lim", "한계", "자기 몸에 닿은 불만 끈다"], ["cost", "대가", "쓸수록 손끝 감각이 사라진다"], ["time", "비용", "한 번 쓰면 반나절 못 쓴다"]];
      const ST = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 1], [1, 1, 1]];
      const tgt = { lim: 0, cost: 0, time: 0 }, cur = { lim: 0, cost: 0, time: 0, nw: 0, view: 0, pers: 0 };
      let step = 0, reveal = 0, ending = 0, force = false;
      const checks = WT.map(([k, lab, t]) => M.check(api.controls, { id: "rc-" + k, label: `${lab}: ${t}`, onChange: (v) => (tgt[k] = v ? 1 : 0) }));
      const revChips = M.chips(api.controls, { title: "한계를 처음 보여 주는 때", items: ["3화", "19화", "안 보여 줌"], value: 0, onPick: (i) => { reveal = i; force = true; } });
      const endChips = M.chips(api.controls, { title: "클라이맥스 해결", items: ["있는 규칙 응용", "새 능력 각성"], value: 0, onPick: (i) => { ending = i; force = true; prose(); } });
      hint(api, "체크를 끄고 켜며 오른쪽 막대를 보세요. 아래 두 칩을 고르면 20화 타임라인으로 바뀝니다.");

      const tens = (c, i) => { const k = CR[i]; let t = 0.1; if (!k.self) t += 0.55 * c.lim; t += 0.32 * c.cost; if (k.quick) t += 0.38 * c.time; return Math.min(1, t); };
      const reason = (c, i) => { const k = CR[i]; if (!k.self && c.lim > 0.5) return "능력 밖"; if (k.quick && c.time > 0.5) return "아직 못 씀"; if (c.cost > 0.5) return "쓸까 말까"; return "손짓 한 번"; };
      const EV = [[[3, "한계 공개", 0.45], [8, "다시 씀", 0.7], [13, "대가 치름", 0.9]], [[19, "한계 공개", 0.35]], []];
      const under = (ep) => { let u = 0; for (const [e, , v] of EV[reveal]) if (ep >= e) u = v; return u; };

      const PROSE = [
        [["bad", "고치기 전", "대가 없는 능력", "불길이 덮쳤다. 하준이 손을 들자 불이 꺼졌다. 다음 불도, 그다음 불도 그랬다."]],
        [["bad", "고치기 전", "한계 없음", "창고가 무너지기 전에 하준은 손을 뻗어 불을 껐다."], ["good", "고친 후", "한계가 있음", "창고의 불은 하준의 몸에 닿지 않았다. <mark class=\"ok\">끌 수 없는 불이었다.</mark> 그는 물통을 찾아 뛰었다."]],
        [["bad", "고치기 전", "대가 없음", "하준은 손을 들어 동생 방의 불을 껐다."], ["good", "고친 후", "대가가 있음", "하준은 손을 들다 멈췄다. <mark class=\"ok\">이번에 끄면 왼손 약지의 감각이 사라진다.</mark> 방 안에서 동생이 기침을 했다."]],
        [["bad", "고치기 전", "비용 없음", "결투 상대가 불덩이를 던졌다. 하준은 또 손을 들었다."], ["good", "고친 후", "비용이 있음", "불덩이가 날아왔다. 하준의 손은 <mark class=\"ok\">아침에 창고에서 한 번 썼다.</mark> 그는 몸을 굴려 피했다."]],
        [["bad", "공개하지 않음", "20화에서 처음 밝힘", "그 순간 하준이 말했다. \"나는 내 몸에 닿은 불만 끌 수 있어.\" <small>(처음 듣는 규칙)</small>"], ["good", "3화에 공개", "이후 두 번 더 씀", "3화, 동생이 물었다. \"형, 옆집 불은 왜 못 꺼?\" \"<mark class=\"ok\">내 몸에 닿아야 해.</mark>\""]],
        [["bad", "새 능력 각성", "제1·3법칙 위반", "그 순간 하준 안에서 새로운 힘이 깨어났다. 시장의 불이 한꺼번에 꺼졌다."], ["good", "있는 규칙 응용", "한계를 뒤집어 씀", "하준은 불붙은 도화선을 맨손으로 움켜쥐었다. <mark class=\"ok\">이제 그건 그의 몸에 닿은 불이었다.</mark>"]],
      ];
      const prose = () => {
        if (step === 5) { const p = PROSE[5]; S.setProse(ending ? [p[0], p[1]] : [p[1], p[0]]); return; }
        S.setProse(PROSE[step]);
      };

      function drawScale(x, c, bx, by, bw, bh) {
        const cx = bx + bw / 2, py = by + 22;
        const power = 1 + cur.nw * 1.1, cons = (cur.lim + cur.cost + cur.time) * 0.34;
        const ang = M.clamp(power - cons, -0.5, 1.6) * 0.17;
        const PW = Math.min(bw * 0.4, 128), BL = Math.min(bw - PW - 12, 300);
        const S0 = Math.max(52, bh * 0.5), blkH = M.clamp((S0 - 14) / 3.3, 12, 20);
        const dx = Math.cos(ang) * BL / 2, dy = Math.sin(ang) * BL / 2;
        const ends = [[cx - dx, py + dy], [cx + dx, py - dy]];
        const baseY = by + bh - 8;
        box(x, cx - 34, baseY - 4, 68, 8, 4, c.ink);
        M.line(x, cx, py, cx, baseY, c.ink, 3);
        x.beginPath(); x.moveTo(cx - 9, py + 14); x.lineTo(cx + 9, py + 14); x.lineTo(cx, py - 2); x.closePath(); x.fillStyle = c.ink; x.fill();
        M.line(x, ends[0][0], ends[0][1], ends[1][0], ends[1][1], c.ink, 4);
        ends.forEach(([ex, ey], side) => {
          const panY = ey + S0;
          M.line(x, ex, ey, ex - PW / 2 + 4, panY, M.alpha(c.ink, 0.6), 1.2);
          M.line(x, ex, ey, ex + PW / 2 - 4, panY, M.alpha(c.ink, 0.6), 1.2);
          M.dot(x, ex, ey, 3.5, c.ink);
          // 접시 위 블록
          const items = side === 0
            ? [["능력", "불을 끈다", 1, c.b], ["각성", "새 능력", cur.nw, c.b]]
            : WT.map(([k, lab]) => [lab, "", cur[k], c.a]);
          let yy = panY;
          items.forEach(([lab, sub, v, col]) => {
            if (v < 0.02) return;
            const bwid = PW * 0.84, h0 = blkH;
            const top = yy - h0 - (1 - v) * 26;
            x.save(); x.globalAlpha = v;
            box(x, ex - bwid / 2 + 1.5, top + 2, bwid, h0 - 2, 4, M.alpha(c.ink, 0.9));
            box(x, ex - bwid / 2, top, bwid, h0 - 2, 4, c.surface, c.ink);
            box(x, ex - bwid / 2, top, bwid, h0 - 2, 4, M.alpha(col, side === 0 && lab === "각성" ? 0.5 : 0.22));
            T(x, sub && bwid > 110 ? `${lab} · ${sub}` : lab, ex, top + h0 / 2 + 3, { align: "center", weight: 700, color: c.ink });
            x.restore();
            yy -= h0 * v;
          });
          // 접시
          x.beginPath(); x.moveTo(ex - PW / 2, panY); x.quadraticCurveTo(ex, panY + 16, ex + PW / 2, panY); x.closePath();
          x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.3; x.stroke();
          T(x, side === 0 ? "힘" : "제약", ex, Math.min(panY + 24, baseY - 12), { align: "center", weight: 700, color: c.muted });
        });
      }

      function drawCard(x, c, bx, by, bw, bh) {
        if (bh < 60) return;
        box(x, bx, by, bw, bh, 10, c.surface, c.line2);
        const rows = [["규칙", "손을 대면 불이 꺼진다", 1, c.ink]].concat(WT.map(([k, lab, t]) => [lab, t, cur[k], c.a]));
        if (cur.nw > 0.05) rows.push(["각성", "도시의 불을 한꺼번에 끈다(대가 없음)", cur.nw, c.b]);
        const rh = Math.min(22, (bh - 28) / rows.length);
        T(x, "설정 노트 · 손으로 끄는 불", bx + 10, by + 17, { weight: 700, color: c.ink2 });
        rows.forEach(([k, t, v, col], i) => {
          const yy = by + 30 + i * rh + rh / 2;
          const on = v > 0.5;
          font(x, 12, 700); const kw = x.measureText(k).width + 12;
          box(x, bx + 10, yy - 9, kw, 18, 9, on ? M.alpha(col, 0.18) : null, on ? c.ink : c.line2);
          T(x, k, bx + 16, yy + 4, { weight: 700, color: on ? c.ink : c.faint });
          const maxW = bw - kw - 28;
          const sz = fitSize(x, on ? t : "없음", maxW, 12.5);
          let s = on ? t : "없음";
          font(x, sz); while (x.measureText(s).width > maxW && s.length > 2) s = s.slice(0, -2) + "…";
          T(x, s, bx + kw + 18, yy + 4, { size: sz, color: on ? c.ink : c.faint });
        });
      }

      function drawBars(x, c, rx, ry, rw, rh) {
        const avg = CR.reduce((s, _, i) => s + tens(cur, i), 0) / CR.length;
        const verdict = avg < 0.3 ? "어차피 이긴다" : avg < 0.6 ? "가끔 궁금하다" : "매번 어떻게 할지 궁금하다";
        T(x, "위기 다섯 개 · 독자가 느끼는 긴장", rx, ry + 14, { weight: 700, color: c.ink, size: 12.5 });
        const tagY = rw > 380 ? ry + 10 : ry + 36;
        M.tag(x, `평균 ${Math.round(avg * 100)}% · ${verdict}`, rx + rw, tagY, { align: "right", size: 12, fill: M.alpha(avg < 0.3 ? c.b : c.c, 0.22) });
        const top = ry + (rw > 380 ? 52 : 70), base = ry + rh - 40;
        const colW = rw / CR.length;
        M.line(x, rx, base, rx + rw, base, c.ink, 1.2);
        const yAvg = base - avg * (base - top);
        M.line(x, rx, yAvg, rx + rw, yAvg, M.alpha(c.key, 0.9), 1.5, [5, 4]);
        CR.forEach((k, i) => {
          const t = tens(cur, i), bx = rx + i * colW + colW * 0.2, bw = colW * 0.6, bh = t * (base - top);
          box(x, bx, base - bh, bw, bh, 5, M.alpha(c.b, 0.15 + 0.55 * t), c.ink, 1.2);
          const r = reason(cur, i);
          T(x, r, bx + bw / 2, Math.max(top - 4, base - bh - 7), { align: "center", weight: 700, color: t > 0.5 ? c.ink : c.muted });
          font(x, 12, 600);
          wrapLines(x, k.n, colW - 4).slice(0, 2).forEach((ln, j) => T(x, ln, bx + bw / 2, base + 17 + j * 15, { align: "center", weight: 600, color: c.ink2 }));
        });
      }

      function drawTimeline(x, c, rx, ry, rw, rh) {
        T(x, "20화까지 · 독자가 한계 규칙을 아는 정도", rx, ry + 14, { weight: 700, color: c.ink, size: 12.5 });
        const gx = rx + 8, gw = rw - 16, top = ry + 54, base = ry + rh - 96;
        const X = (ep) => gx + ((ep - 1) / 19) * gw, Y = (v) => base - v * (base - top);
        M.line(x, gx, base, gx + gw, base, c.ink, 1.2);
        for (let e = 1; e <= 20; e++) {
          M.line(x, X(e), base, X(e), base + 4, c.ink, 1);
          if (e === 1 || e % 5 === 0) T(x, e + "화", X(e), base + 17, { align: "center", color: c.muted });
        }
        // 클라이맥스 띠
        box(x, X(19.5), top - 14, X(20) - X(19.5) + 8, base - top + 14, 4, M.alpha(c.key, 0.22));
        T(x, "20화 해결", X(20) + 6, top - 20, { align: "right", weight: 700, color: c.ink });
        // 이해도 계단선
        x.save(); x.strokeStyle = c.a; x.lineWidth = 2.5; x.beginPath();
        for (let e = 1; e <= 20; e++) { const v = under(e), vp = e > 1 ? under(e - 1) : 0; if (e === 1) x.moveTo(X(1), Y(v)); else { x.lineTo(X(e), Y(vp)); x.lineTo(X(e), Y(v)); } }
        x.lineTo(X(20) + 6, Y(under(20))); x.stroke(); x.restore();
        EV[reveal].forEach(([e, lab, v], k) => {
          M.dot(x, X(e), Y(v), 5, c.a, c.surface);
          const lx = M.clamp(X(e), gx + 30, gx + gw - 60);
          M.tag(x, `${e}화 ${lab}`, lx, Y(v) - 16 - (k % 2) * 0, { align: "center", size: 12 });
        });
        if (!EV[reveal].length) T(x, "독자는 이 규칙을 한 번도 보지 못했다", gx + gw / 2, base - 14, { align: "center", color: c.muted, weight: 600 });
        if (cur.nw > 0.05) {
          x.save(); x.globalAlpha = cur.nw; M.dot(x, X(20), base, 6, c.b, c.surface);
          M.tag(x, "새 능력: 처음 봄", X(20) - 8, base - 22, { align: "right", size: 12, color: c.b }); x.restore();
        }
        // 설득력 미터
        const my = ry + rh - 52;
        T(x, "20화 해결의 설득력", rx, my, { weight: 700, color: c.ink });
        box(x, rx, my + 9, rw, 16, 8, c.sunk, c.ink);
        if (cur.pers > 0.01) box(x, rx, my + 9, Math.max(16, rw * cur.pers), 16, 8, M.alpha(cur.pers > 0.6 ? c.c : c.b, 0.75));
        const p = ending ? 0.06 : under(20);
        const v = p >= 0.75 ? "영리하다 · 독자도 풀 수 있었다" : p >= 0.3 ? "급조한 느낌" : "작가 편의(데우스 엑스 마키나)";
        T(x, v, rx, my + 42, { weight: 700, color: c.ink2 });
      }

      return {
        setStep(s) {
          step = s; force = false;
          const st = ST[s]; WT.forEach(([k], i) => { tgt[k] = st[i]; checks[i].set(!!st[i]); });
          if (s === 4) { reveal = 0; revChips.set(0); }
          ending = 0; endChips.set(0);
          if (s === 5) { ending = 1; endChips.set(1); }
          prose();
        },
        frame(t, dt) {
          const c = C(), { x, w, h } = S.fit();
          for (const k of ["lim", "cost", "time"]) cur[k] = follow(cur[k], tgt[k], dt, 380);
          const tl = step >= 4 || force;
          cur.nw = follow(cur.nw, tl && ending ? 1 : 0, dt, 420);
          cur.view = follow(cur.view, tl ? 1 : 0, dt, 300);
          cur.pers = follow(cur.pers, ending ? 0.06 : under(20), dt, 500);
          const wide = w >= 560;
          let L, R;
          if (wide) { const lw = Math.min(300, w * 0.4); L = [8, 6, lw, h - 12]; R = [lw + 34, 6, w - lw - 44, h - 12]; }
          else { L = [4, 4, w - 8, h * 0.46]; R = [8, h * 0.46 + 14, w - 16, h * 0.54 - 18]; }
          const need = 36 + (cur.nw > 0.05 ? 5 : 4) * 20;
          const scH = wide ? Math.max(L[3] * 0.45, Math.min(L[3] * 0.62, L[3] - need - 8)) : L[3];
          if (wide) { drawScale(x, c, L[0], L[1], L[2], scH); drawCard(x, c, L[0], L[1] + scH + 8, L[2], L[3] - scH - 8); }
          else { drawScale(x, c, L[0], L[1], L[2] * 0.5, L[3]); drawCard(x, c, L[0] + L[2] * 0.5 + 4, L[1] + 8, L[2] * 0.5 - 4, L[3] - 12); }
          if (wide) M.line(x, R[0] - 18, 14, R[0] - 18, h - 14, c.line, 1);
          x.save(); x.globalAlpha = 1 - cur.view; if (cur.view < 0.98) drawBars(x, c, ...R); x.restore();
          x.save(); x.globalAlpha = cur.view; if (cur.view > 0.02) drawTimeline(x, c, ...R); x.restore();
        },
      };
    },
  });

  /* =====================================================================
     6-2 관계와 감정선
     ===================================================================== */
  LESSONS.push({
    id: "emotion-line", ch: 6, order: 2,
    title: "관계와 감정선",
    lede: "이 레슨을 마치면 두 인물 사이의 관계를 신뢰·친밀·힘의 세 축으로 추적하고, 회차별 감정선 그래프에서 지루한 구간과 약한 이별을 찾아 고치는 법을 알게 됩니다.",
    key: "관계는 사건마다 상태가 바뀌는 선입니다. 감정선이 평평하면 지루하고, 이별은 바깥 장애물이 아니라 두 사람 안의 거짓 믿음에서 나와야 재회가 성장이 됩니다.",
    steps: [
      ["관계는 상태를 가진 선", "지호와 은수 사이의 선이 <b>관계</b>입니다. 선은 상태를 갖고 있고, 사건이 그 상태를 바꿉니다. 3화에서 은수가 지호의 거짓말을 덮어 주자 신뢰가 −3에서 −1로 오르고, 점선이던 선이 조금 진해집니다. 상태가 하나도 바뀌지 않는 사건은 독자에게 '아무 일도 없던 화'입니다."],
      ["세 축: 신뢰·친밀·힘", "회차가 지나가는 동안 두 사람의 <b>거리</b>는 친밀, <b>선의 굵기와 실선 여부</b>는 신뢰, 오른쪽 세 번째 막대는 <b>힘의 균형</b>입니다. 좋은 관계 아크는 단계마다 한 축 이상이 움직입니다. 회차 슬라이더를 직접 끌어 보세요."],
      ["회차별 감정선", "화마다 끝 시점의 관계 감정을 −5에서 +5로 찍은 그래프입니다. 커서가 지나가며 선이 그려집니다. 8화 무렵 가장 가까워졌다가 12화에 최저점을 찍고 다시 오릅니다. <b>최저점이 깊어야</b> 회복이 크게 느껴집니다."],
      ["평평하면 지루하다", "같은 이야기를 '평평한 판'으로 바꿨습니다. 4화부터 거의 같은 값이 이어지고, 노란 띠가 <b>3화 넘게 그대로인 구간</b>입니다. 독자가 지루해지는 신호입니다. '고친 판'으로 바꾸면 띠가 사라지고 9~12화에 깊은 골이 생깁니다."],
      ["두 줄을 겹쳐 본다", "파란 선은 <b>메인 플롯</b>(사건이 잘 풀리는 정도)입니다. 11화에서 사건은 해결로 치솟는데 관계는 바닥으로 꺾입니다. '성공했지만 외롭다'처럼 두 선이 엇갈리는 곳에서 감정이 입체적이 됩니다."],
      ["물러섬은 안에서 온다", "배경 띠는 로맨스 구조의 네 국면입니다. ③ 물러섬의 원인이 가문 반대 같은 <b>바깥 장애물</b>이면 장애물만 치우면 끝나서 아무도 변하지 않습니다. 원인이 지호의 <b>거짓 믿음</b>('결국 버려진다')이면 15화의 큰 결단이 곧 그의 성장이 됩니다."],
    ],
    terms: [
      ["관계 아크", "Relationship arc", "두 인물 사이 관계가 이야기 동안 바뀌어 가는 궤적. 신뢰·친밀·힘의 균형 중 하나 이상이 단계마다 움직여야 합니다."],
      ["감정선", "Emotional arc", "회차나 장면마다 독자가 느끼는 감정의 높낮이를 이은 선. 평평한 구간은 지루함, 진폭이 작으면 밋밋함의 신호입니다."],
      ["거짓 믿음", "False belief / The lie", "인물이 자기 상처 때문에 붙들고 있는 잘못된 믿음. 관계의 위기가 여기서 나와야 화해가 곧 인물의 변화가 됩니다."],
      ["HEA / HFN", "Happily Ever After / Happy For Now", "장르 로맨스가 약속하는 결말 형태. 영원히 행복하거나, 적어도 지금은 행복한 결말입니다."],
      ["큰 결단", "Grand gesture", "로맨스 후반, 인물이 거짓 믿음을 버렸다는 것을 행동으로 보여 주는 장면."],
    ],
    mount(api) {
      const S = shell(api);
      /* [신뢰, 친밀, 힘(−: 지호 우위), 관계 감정, 메인 플롯, 사건] */
      const GOOD = [
        [-3, 0, -1, -1, 0, "첫 만남, 은수가 지호의 실수를 공개적으로 지적"],
        [-3, 1, -1, -2, -1, "같은 조사팀에 배정"],
        [-1, 1, 0, 0, 0, "은수가 지호의 거짓말을 덮어 줌"],
        [0, 2, 0, 2, 1, "밤샘 작업 끝에 처음 같이 웃음"],
        [1, 2, 0, 1, -1, "조사가 막힘, 서로 탓하다 화해"],
        [2, 3, 0, 3, 1, "지호가 자기 상처를 털어놓음"],
        [2, 3, 0, 2, 2, "단서를 함께 찾음"],
        [3, 4, 0, 4, 0, "가장 가까워진 밤"],
        [1, 4, 1, 1, 1, "은수가 지호 몰래 위험한 결정"],
        [-1, 3, 1, -2, 2, "지호가 먼저 거리를 둠"],
        [-3, 2, 1, -4, 4, "사건은 해결, 둘은 갈라섬"],
        [-3, 1, 0, -5, 3, "최저점: 지호가 도시를 떠날 준비"],
        [-1, 2, 0, -2, 1, "은수의 편지"],
        [2, 3, 0, 1, 2, "지호가 '결국 버려진다'는 믿음을 내려놓음"],
        [4, 4, 0, 4, 3, "큰 결단: 지호가 먼저 찾아감"],
        [4, 5, 0, 5, 4, "재회"],
      ];
      const FLAT = GOOD.map((r, i) => { const e = [-1, -2, 0, 2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 3, 3, 3][i]; return [Math.min(r[0], 2), Math.min(r[1], 3), 0, e, r[4], r[5]]; });
      const N = GOOD.length;
      const PH = [[1, 2, "① 설정"], [3, 8, "② 빠져듦"], [9, 12, "③ 물러섬"], [13, 16, "④ 다시 싸움"]];
      let step = 0, ep = 1, epT = 1, auto = false, flatT = 0, flat = 0, mainT = 0, main = 0, graphT = 0, graph = 0, phase = 0, phaseT = 0;
      const sl = M.slider(api.controls, { id: "el-ep", label: "회차", min: 1, max: 16, value: 1, fmt: (v) => v + "화", onInput: (v) => { auto = false; epT = v; } });
      const ver = M.chips(api.controls, { title: "감정선", items: ["고친 판", "평평한 판"], value: 0, onPick: (i) => { flatT = i; graphT = 1; } });
      const mc = M.check(api.controls, { id: "el-main", label: "메인 플롯 선 겹치기", onChange: (v) => { mainT = v ? 1 : 0; graphT = 1; } });
      hint(api, "슬라이더로 회차를 옮기면 두 사람의 거리와 선이 그 화의 관계 상태로 바뀝니다.");
      const val = (k) => {
        const i = M.clamp(ep - 1, 0, N - 1), i0 = Math.floor(i), i1 = Math.min(N - 1, i0 + 1), f = i - i0;
        const g = (arr) => M.lerp(arr[i0][k], arr[i1][k], f);
        return M.lerp(g(GOOD), g(FLAT), flat);
      };
      const PROSE = {
        3: [["bad", "평평한 판", "6~10화", "둘은 오늘도 함께 조사했다. 은수가 커피를 건넸고, 지호는 고맙다고 했다."], ["good", "고친 판", "9화", "은수는 지호에게 말하지 않고 증인을 만나러 갔다. <mark class=\"ok\">돌아왔을 때 지호는 아무것도 묻지 않았다.</mark>"]],
        4: [["info", "11화", "사건은 해결", "범인이 잡혔다는 보도가 나왔다. <mark class=\"ok\">축하 문자는 열두 통이었지만, 은수의 이름은 없었다.</mark>"]],
        5: [["bad", "바깥 장애물", "장애물이 사라지면 끝", "지호의 집안이 은수를 반대했다. 둘은 헤어졌다. 반대가 풀리자 다시 만났다."], ["good", "거짓 믿음", "믿음을 버려야 재회", "\"어차피 너도 떠날 거잖아.\" <mark class=\"ok\">지호는 버려지기 전에 먼저 떠나는 쪽을 골랐다.</mark>"]],
      };
      const prose = () => S.setProse(PROSE[step] || (step === 0 ? [["info", "3화", "신뢰 −3 → −1", "\"그 보고서, 제가 늦게 넘긴 거예요.\" <mark class=\"ok\">은수는 지호 대신 고개를 숙였다.</mark>"]] : null));

      function heads(x, c, bx, by, bw, bh) {
        const tr = val(0), it = val(1), pwr = val(2), em = val(3);
        const r = M.clamp((bh - 58) / 4.1, 10, 34);
        const cy = by + 30 + r * 1.3 + Math.max(0, (bh - 58 - r * 4.1) / 2);
        const gap = M.lerp(bw * 0.62, r * 3.4, it / 5);
        const ax = bx + bw / 2 - gap / 2, bxp = bx + bw / 2 + gap / 2;
        const expr = em >= 3 ? "smile" : em >= 0.5 ? "talk" : em <= -3 ? "sad" : em < -0.5 ? "worried" : "neutral";
        // 관계 선
        const x0 = ax + r * 1.25, x1 = bxp - r * 1.25, ly = cy + r * 0.3;
        const tn = (tr + 5) / 10;
        const dash = tr < 0 ? [4 + tn * 6, 6 - tn * 3] : null;
        if (x1 > x0) M.line(x, x0, ly, x1, ly, tr < 0 ? M.alpha(c.b, 0.85) : c.ch6, 1 + tn * 5, dash);
        M.art.head(x, { cx: ax, cy, r, who: "A", view: "three-quarter-right", expr, cut: -76 });
        M.art.head(x, { cx: bxp, cy, r, who: "B", view: "three-quarter-left", expr, cut: -76 });
        T(x, "지호", ax, cy + r * 2.6 + 18, { align: "center", weight: 700, color: c.ink });
        T(x, "은수", bxp, cy + r * 2.6 + 18, { align: "center", weight: 700, color: c.ink });
        const i0 = M.clamp(Math.round(ep), 1, N), row = (flat > 0.5 ? FLAT : GOOD)[i0 - 1];
        const cap = `${i0}화 · ${row[5]}`;
        const sz = fitSize(x, cap, bw - 20, 12.5, 600);
        M.tag(x, cap, bx + bw / 2, by + 12, { align: "center", size: sz });
        return { tr, it, pwr };
      }
      /* 최근 사건과 그 사건이 바꾼 관계 값 */
      function log(x, c, bx, bottom, bw) {
        const cur = M.clamp(Math.round(ep), 1, N), from = Math.max(1, cur - 3);
        const sgn = (d) => (d > 0 ? "+" : "−") + Math.abs(d);
        const rows = [];
        for (let e = from; e <= cur; e++) {
          const r = GOOD[e - 1], p = e > 1 ? GOOD[e - 2] : null;
          const ds = p ? [["신뢰", r[0] - p[0]], ["친밀", r[1] - p[1]]].filter(([, d]) => d).map(([k, d]) => `${k} ${sgn(d)}`) : ["관계 시작"];
          rows.push([`${e}화`, r[5], ds.length ? ds.join(" · ") : "변화 없음", e === cur]);
        }
        const rh = 26, top = bottom - rows.length * rh - 22;
        T(x, "사건 → 관계 상태의 변화", bx, top + 8, { weight: 700, color: c.muted });
        rows.forEach(([n, ev, d, now], i) => {
          const y = top + 22 + i * rh;
          box(x, bx, y, bw, rh - 4, 6, now ? M.alpha(c.key, 0.18) : M.alpha(c.surface, 0.7), now ? c.ink : c.line2);
          T(x, n, bx + 10, y + 16, { mono: true, weight: 700, color: c.ink });
          font(x, 12, 700); const dw = x.measureText(d).width;
          let e2 = ev; font(x, 12.5, 500); while (x.measureText(e2).width > bw - dw - 90 && e2.length > 2) e2 = e2.slice(0, -2) + "…";
          T(x, e2, bx + 50, y + 16, { size: 12.5, color: c.ink2 });
          T(x, d, bx + bw - 10, y + 16, { align: "right", weight: 700, color: d.includes("−") ? c.b : d.includes("+") ? c.c : c.muted });
        });
        return top;
      }
      function meters(x, c, bx, by, bw, v) {
        const rows = [["신뢰", v.tr, -5, 5, c.ch6], ["친밀", v.it, 0, 5, c.ch6], ["힘", v.pwr, -2, 2, c.key]];
        rows.forEach(([lab, val0, a, b, col], i) => {
          const yy = by + i * 34;
          T(x, lab, bx, yy + 12, { weight: 700, color: c.ink });
          const rv = Math.round(val0) || 0;
          const vs = lab === "힘" ? (Math.abs(val0) < 0.4 ? "대등" : val0 < 0 ? "지호 우위" : "은수 우위") : (rv > 0 && a < 0 ? "+" : rv < 0 ? "−" : "") + Math.abs(rv);
          T(x, vs, bx + bw, yy + 12, { align: "right", mono: true, color: c.muted });
          const ty = yy + 19, z = a < 0 ? (0 - a) / (b - a) : 0;
          box(x, bx, ty, bw, 8, 4, c.sunk, c.line2);
          const p = (val0 - a) / (b - a);
          const xa = bx + bw * Math.min(z, p), xb = bx + bw * Math.max(z, p);
          box(x, xa, ty, Math.max(3, xb - xa), 8, 4, M.alpha(lab === "신뢰" && val0 < 0 ? c.b : col, 0.85));
          if (a < 0) M.line(x, bx + bw * z, ty - 2, bx + bw * z, ty + 10, c.ink, 1);
        });
      }
      function chart(x, c, gx, gy, gw, gh) {
        const X = (e) => gx + ((e - 1) / (N - 1)) * gw, Y = (v) => gy + gh / 2 - (v / 6.4) * (gh / 2);
        if (phase > 0.01) {
          PH.forEach(([a, b, lab], k) => {
            x.save(); x.globalAlpha = phase;
            box(x, X(a) - (k ? (X(a) - X(a - 1)) / 2 : 6), gy, (X(b) - X(a)) + (X(2) - X(1)), gh, 0, M.alpha([c.ch6, c.ch6, c.b, c.c][k], k === 2 ? 0.13 : 0.07));
            if (k === 3) T(x, lab, X(a) - 10, gy + 15, { weight: 700, color: c.ink2 });
            else T(x, lab, (X(a) + X(b)) / 2, gy + 15, { align: "center", weight: 700, color: c.ink2 });
            x.restore();
          });
        }
        box(x, gx - 6, gy, gw + 12, gh, 6, null, c.line);
        M.line(x, gx - 6, Y(0), gx + gw + 6, Y(0), c.line2, 1, [3, 4]);
        M.line(x, gx - 6, Y(5), gx + gw + 6, Y(5), M.alpha(c.line2, 0.5), 1, [2, 5]); M.line(x, gx - 6, Y(-5), gx + gw + 6, Y(-5), M.alpha(c.line2, 0.5), 1, [2, 5]);
        T(x, "+5", gx - 10, Y(5) + 4, { align: "right", mono: true, color: c.muted });
        T(x, "0", gx - 10, Y(0) + 4, { align: "right", mono: true, color: c.muted });
        T(x, "−5", gx - 10, Y(-5) + 4, { align: "right", mono: true, color: c.muted });
        const every = gw / (N - 1) >= 24 ? 1 : 3;
        for (let e = 1; e <= N; e++) if ((e - 1) % every === 0 || e === N) T(x, String(e), X(e), gy + gh + 15, { align: "center", mono: true, color: c.muted });
        T(x, "화", gx + gw + 10, gy + gh + 15, { color: c.muted });
        // 평평한 구간
        const ser = []; for (let e = 1; e <= N; e++) ser.push(M.lerp(GOOD[e - 1][3], FLAT[e - 1][3], flat));
        if (step >= 3) {
          let s0 = 0;
          for (let i = 1; i <= N; i++) {
            const run = ser.slice(s0, i + 1);
            if (i < N && Math.max(...run) - Math.min(...run) <= 1.05) continue;
            if (i - s0 >= 4) {
              const xa = X(s0 + 1) - 8, xb = X(i) + 8;
              box(x, xa, gy + 2, xb - xa, gh - 4, 4, M.alpha(c.key, 0.22));
              M.tag(x, `평평한 구간 · ${i - s0}화`, (xa + xb) / 2, gy + gh - 14, { align: "center", size: 12, fill: M.alpha(c.key, 0.3) });
            }
            s0 = i;
          }
        }
        const upto = step <= 2 && graph > 0 ? ep : N;
        const line = (k, col, wdt) => {
          x.save(); x.strokeStyle = col; x.lineWidth = wdt; x.lineJoin = "round"; x.beginPath();
          for (let e = 1; e <= upto + 1e-6; e += 0.25) {
            const i0 = Math.floor(e) - 1, f = e - Math.floor(e);
            const v = M.lerp(M.lerp(GOOD[i0][k], FLAT[i0][k], flat), i0 + 1 < N ? M.lerp(GOOD[i0 + 1][k], FLAT[i0 + 1][k], flat) : 0, f);
            e === 1 ? x.moveTo(X(e), Y(v)) : x.lineTo(X(e), Y(v));
          }
          x.stroke(); x.restore();
          for (let e = 1; e <= Math.floor(upto); e++) M.dot(x, X(e), Y(M.lerp(GOOD[e - 1][k], FLAT[e - 1][k], flat)), 3, col, c.surface);
        };
        if (main > 0.01) { x.save(); x.globalAlpha = main; line(4, c.a, 2.2); x.restore(); }
        line(3, c.b, 2.6);
        // 제목·범례
        T(x, "회차별 감정선", gx - 6, gy - 8, { weight: 700, color: c.ink });
        font(x, 12, 700); let lx = gx - 6 + x.measureText("회차별 감정선").width + 16;
        M.line(x, lx, gy - 12, lx + 14, gy - 12, c.b, 2.6); T(x, "관계", lx + 18, gy - 8, { weight: 700, color: c.b });
        lx += 18 + x.measureText("관계").width + 12;
        x.save(); x.globalAlpha = main; M.line(x, lx, gy - 12, lx + 14, gy - 12, c.a, 2.2); T(x, "메인 플롯", lx + 18, gy - 8, { weight: 700, color: c.a }); x.restore();
        // 커서
        M.line(x, X(ep), gy, X(ep), gy + gh, c.key, 1.5);
        // 주석
        if (step === 4 && main > 0.5) {
          M.callout(x, "사건은 성공, 관계는 바닥", X(11), Y(GOOD[10][3]), Math.max(gx + 10, X(11) - 40), Y(-4.2) + 2, { align: "right", size: 12 });
        }
        if (step === 5 && phase > 0.5) {
          const lab = gw > 420 ? "원인: 지호의 믿음 '결국 버려진다'" : "원인: 거짓 믿음";
          M.tag(x, lab, M.clamp(X(12), gx + 120, gx + gw - 120), Y(-5.75), { align: "center", size: 12, fill: M.alpha(c.b, 0.2) });
          const tg = M.tag(x, "큰 결단", gx + gw + 6, gy + 11, { align: "right", size: 12, fill: M.alpha(c.c, 0.25) });
          M.line(x, X(15), tg.y + tg.h + 1, X(15), Y(4) - 5, c.ink, 1, [2, 3]);
        }
      }
      return {
        setStep(s) {
          step = s; auto = s === 1 || s === 2;
          flatT = s === 3 ? 1 : 0; ver.set(flatT);
          mainT = s >= 4 ? 1 : 0; mc.set(!!mainT);
          graphT = s >= 2 ? 1 : 0; phaseT = s === 5 ? 1 : 0;
          epT = [1, 1, 1, 8, 11, 12][s]; if (!auto && s !== 0) sl.set(epT);
          prose();
        },
        replay() { if (step === 1 || step === 2) { auto = true; } },
        frame(t, dt) {
          const c = C(), { x, w, h } = S.fit();
          if (step === 0) epT = t < 1100 ? 1 : 3;
          if (auto) { epT = Math.min(16, 1 + t / 650); sl.set(Math.round(epT)); }
          ep = auto ? epT : follow(ep, epT, dt, 320);
          flat = follow(flat, flatT, dt, 420); main = follow(main, mainT, dt, 350);
          graph = follow(graph, graphT, dt, 350); phase = follow(phase, phaseT, dt, 400);
          if (step === 0) sl.set(Math.round(ep));
          const wide = w >= 560;
          const topH = M.lerp(h - 10, Math.max(150, h * 0.44), graph);
          const mw = wide ? Math.min(180, w * 0.26) : 0;
          const logH = wide ? (1 - graph) * (4 * 26 + 30) : 0;
          const v = heads(x, c, 4, 4, w - 8 - (mw ? mw + 16 : 0), wide ? topH - 8 - logH : topH - 112);
          if (wide) meters(x, c, w - mw - 6, Math.max(26, (topH - logH) / 2 - 52), mw, v);
          else meters(x, c, 16, topH - 104, w - 32, v);
          if (graph > 0.02) {
            x.save(); x.globalAlpha = graph;
            chart(x, c, 34, topH + 22, w - 56, h - topH - 46);
            x.restore();
          }
          if (graph < 0.98 && wide) { x.save(); x.globalAlpha = 1 - graph; log(x, c, 12, h - 4, w - 24); x.restore(); }
        },
      };
    },
  });
  /* =====================================================================
     7-1 회차와 훅
     ===================================================================== */
  LESSONS.push({
    id: "episode-hook", ch: 7, order: 1,
    title: "회차와 훅",
    lede: "이 레슨을 마치면 약 5천 자 한 회차를 도입·전개·훅으로 나누고, 회차 끝을 어디서 끊어야 다음 화로 넘어가는지, 훅을 어떻게 섞어야 무뎌지지 않는지 알게 됩니다.",
    key: "한 회차에는 가치 변화가 하나 이상 있어야 하고, 끝은 긴장이 가장 높은 곳에서 끊습니다. 훅은 종류를 섞어야 무뎌지지 않습니다.",
    steps: [
      ["회차 한 칸", "아래 띠가 웹소설 <b>한 회차</b>(관행상 공백 포함 약 5천 자)입니다. 앞 10%는 직전 화의 훅을 이어받는 도입, 70%는 이번 화의 목표·장애·결과가 있는 전개, 마지막 20%가 다음 화로 당기는 <b>훅</b>입니다. 위의 선은 회차 안에서 독자가 느끼는 긴장입니다."],
      ["가치가 바뀌어야 한 화", "흐린 빨간 점선은 <b>물 회차</b>입니다. 시작도 끝도 '언니의 죽음은 사고'라서 긴장이 평평합니다. 진한 선은 언니의 반지를 발견해 끝에서 '사고가 아니다'로 바뀝니다. 시작과 끝의 꼬리표가 다르면 그 화에서 무언가 일어난 것입니다."],
      ["끝은 일찍 끊는다", "점선은 정점을 지나 '그날 밤은 조용히 지나갔다'까지 정리하고 끝나는 판입니다. 긴장이 내려간 채 끝나서 <b>다음 화로 당기는 힘</b> 화살표가 짧습니다. 가위 표시처럼 정점에서 끊으면 같은 내용으로 화살표가 길어집니다."],
      ["훅의 여섯 종류", "회차 끝의 훅은 <b>위기·폭로·질문·결정·보상 예고·감정</b>으로 나눠 볼 수 있습니다. 위기의 순간에 끊는 클리프행어는 그중 가장 센 한 종류일 뿐입니다. 직접 해보기에서 종류를 바꾸면 끝 꼬리표와 마지막 문장이 바뀝니다."],
      ["같은 훅만 쓰면 무뎌진다", "열 회차를 모두 '위기'로 끝냈습니다. 위 선은 각 화의 훅이 다음 화로 당기는 힘인데, 직전 세 화에 같은 종류가 있을수록 약해지게 만든 <b>개념 모형</b>입니다. '섞어 쓰기'로 바꾸거나 카드를 눌러 종류를 바꿔 보세요."],
      ["오프닝 3화는 계약서", "독자는 대체로 첫 1~3화에서 계속 볼지 정한다고들 합니다. 1화는 결핍과 일상을 깨는 사건, 2화는 주인공의 무기와 그 제약, 3화는 큰 목표와 장기 떡밥입니다. '세계관 설명'으로 시작하면 아래 선처럼 1화에서 독자가 크게 빠집니다."],
    ],
    terms: [
      ["회차", "Episode", "연재의 한 번 배포 단위. 한국 유료 웹소설은 관행적으로 공백 포함 약 5천 자 안팎이고, 플랫폼마다 기준이 다릅니다."],
      ["훅", "Hook", "독자를 다음 회차로 끌어당기는 장치. 위기·폭로·질문·결정·보상 예고·감정 등 종류가 여럿입니다."],
      ["클리프행어", "Cliffhanger", "위기가 터지는 순간에 끊는 강한 훅. 매 화 쓰면 효과가 떨어집니다."],
      ["물 회차", "Filler episode", "분량은 있지만 상황·관계·정보·인물 상태가 하나도 바뀌지 않는 회차를 부르는 독자들의 말."],
      ["가치 변화", "Value change", "장면이나 회차의 시작과 끝 사이에 인물의 처지나 관계가 바뀌는 것. 바뀌어야 무언가 일어났다고 느낍니다."],
    ],
    mount(api) {
      const S = shell(api);
      const HN = ["위기", "폭로", "질문", "결정", "보상 예고", "감정"];
      const HCOL = (c) => [c.b, c.a, c.key, c.c, c.ch2, c.ch4];
      const HLINE = [
        "등 뒤에서 문이 잠기는 소리가 났다.",
        "반지 안쪽에 새겨진 이름은 언니가 아니었다.",
        "처음 보는 노인이 나래의 이름을 불렀다.",
        "나래는 봉인된 무덤을 다시 열기로 했다.",
        "검시 기록에 처음 보는 칸이 하나 늘어 있었다. 아직은 비어 있었다.",
        "\"그날 언니를 두고 나온 건, 나야.\"",
      ];
      const ALL = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], MIX = [0, 1, 2, 3, 0, 5, 1, 4, 2, 1];
      const good = pw([[0, 0.55], [0.1, 0.5], [0.22, 0.42], [0.38, 0.6], [0.5, 0.52], [0.66, 0.74], [0.74, 0.66], [0.88, 0.86], [1, 0.97]]);
      const flatF = pw([[0, 0.42], [0.25, 0.47], [0.5, 0.4], [0.75, 0.45], [1, 0.42]]);
      const late = (t) => (t <= 0.8 ? good(t / 0.8) : pw([[0.8, 0.97], [0.9, 0.58], [1, 0.32]])(t));
      let step = 0, hook = 1, arr = MIX.slice(), open = 0, force5 = false;
      const an = { split: 1, cmp: 0, cut: 0, strip: 0, v5: 0, pull: 0 };
      let hits = [];
      const hookC = M.chips(api.controls, { title: "10화 끝 훅", items: HN, value: 1, onPick: (i) => { hook = i; arr[9] = i; prose(); } });
      const arrC = M.chips(api.controls, { title: "열 회차의 훅 배열", items: ["모두 위기", "섞어 쓰기"], value: 1, onPick: (i) => { arr = (i ? MIX : ALL).slice(); hook = arr[9]; hookC.set(hook); prose(); } });
      const openC = M.chips(api.controls, { title: "1화 첫 장면", items: ["사건으로 시작", "세계관 설명으로 시작"], value: 0, onPick: (i) => { open = i; force5 = true; prose(); } });
      hint(api, "4·5단계에서는 아래 회차 카드를 누를 때마다 그 화의 훅 종류가 바뀝니다.");
      S.cv.addEventListener("pointerdown", (e) => {
        const r = S.cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        const h = hits.find((q) => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
        if (!h) return;
        arr[h.i] = (arr[h.i] + 1) % HN.length; arrC.set(-1);
        if (h.i === 9) { hook = arr[9]; hookC.set(hook); prose(); }
      });
      const pullOf = (a, i) => { let k = 0; for (let j = Math.max(0, i - 3); j < i; j++) if (a[j] === a[i]) k++; return 0.9 * Math.pow(0.68, k); };

      const prose = () => {
        const P = {
          0: [["info", "10화 마지막 문장", "훅 20% 구간", "…나래는 반지를 등불에 비췄다. <mark class=\"ok\">안쪽에 새겨진 날짜는 어제였다.</mark>"]],
          1: [["bad", "물 회차", "시작 = 끝", "두 사람은 시장을 둘러보며 지난 일을 이야기했다. 별다른 단서는 없었다."], ["good", "가치 변화", "사고 → 사고 아님", "시장 끝 노점에 언니의 반지가 걸려 있었다. <mark class=\"ok\">사흘 전 언니와 함께 묻은 반지였다.</mark>"]],
          2: [["bad", "늦게 끝낸 판", "정점 뒤에 정리", "…나래는 반지를 주머니에 넣고 집에 와 씻고 누웠다. <mark>그날 밤은 조용히 지나갔다.</mark>"], ["good", "정점에서 끊은 판", "같은 내용, 끝만 다름", "…반지 안쪽에 글자가 새겨져 있었다. <mark class=\"ok\">날짜는 어제였다.</mark>"]],
          3: [["info", `훅: ${HN[hook]}`, "10화 마지막 문장", HLINE[hook]]],
          5: open ? [["bad", "세계관 설명으로 시작", "1화 첫 문장", "이 대륙에는 일곱 왕국이 있었다. 첫째 왕국은 바다를 끼고 있었고, 둘째 왕국은…"]]
            : [["good", "사건으로 시작", "1화 첫 문장", "검시관 나래가 시신의 손을 펴자, <mark class=\"ok\">손바닥에 자기 이름이 적혀 있었다.</mark>"]],
        };
        S.setProse(force5 ? P[5] : P[step] || null);
      };

      function episode(x, c, ex, ey, ew, eh) {
        const barH = 30, x0 = ex + 6, x1 = ex + ew - (ew > 420 ? 96 : 70);
        const by = ey + eh - barH - 20, py0 = ey + 40, py1 = by - 14;
        const X = (t) => x0 + t * (x1 - x0), Y = (v) => py1 - v * (py1 - py0);
        // 띠: 도입·전개·훅
        const SEG = [[0, 0.1, "도입", "약 500자"], [0.1, 0.8, "전개", "약 3,500자"], [0.8, 1, "훅", "약 1,000자"]];
        SEG.forEach(([a, b, lab, n], k) => {
          box(x, X(a) + 1, by, X(b) - X(a) - 2, barH, 6, M.alpha(k === 2 ? c.key : c.ch7, k === 1 ? 0.16 : 0.3), c.ink);
          const z = fitSize(x, `${lab} · ${n}`, X(b) - X(a) - 10, 12.5, 700);
          T(x, X(b) - X(a) > 110 ? `${lab} · ${n}` : lab, (X(a) + X(b)) / 2, by + barH / 2 + 4, { align: "center", weight: 700, color: c.ink, size: z });
        });
        T(x, "한 회차 · 공백 포함 약 5,000자", x0, by + barH + 16, { color: c.muted });
        // 바닥 선
        M.line(x, x0, py1, x1, py1, c.line2, 1);
        T(x, "긴장", x0, py0 - 6, { weight: 700, color: c.muted });
        const curve = (f, a, b, col, wdt, dash) => {
          x.save(); x.strokeStyle = col; x.lineWidth = wdt; x.lineJoin = "round"; if (dash) x.setLineDash(dash);
          x.beginPath(); for (let i = 0; i <= 120; i++) { const t = a + (b - a) * (i / 120); i ? x.lineTo(X(t), Y(f(t))) : x.moveTo(X(t), Y(f(t))); } x.stroke(); x.restore();
        };
        const arrow = (px, py, v, col, lab) => {
          const L = 14 + v * (ew > 420 ? 66 : 44);
          M.arrow(x, px + 6, py, px + 6 + L, py, col, 3);
          if (lab) T(x, lab, px + 6, py - 10, { color: col === c.c ? c.ink : c.muted, weight: 700 });
        };
        // 물 회차 비교
        if (an.cmp > 0.01) {
          x.save(); x.globalAlpha = an.cmp; curve(flatF, 0, 1, M.alpha(c.b, 0.8), 2, [6, 5]); x.restore();
        }
        if (an.cut > 0.01) {
          x.save(); x.globalAlpha = an.cut;
          curve(late, 0.8, 1, M.alpha(c.b, 0.85), 2.2, [6, 5]);
          const cx = X(0.8);
          M.line(x, cx, py0 - 4, cx, by - 4, c.ink, 1.4, [3, 3]);
          M.tag(x, "여기서 끊는다", cx - 8, by - 26, { align: "right", size: 12, fill: M.alpha(c.c, 0.25) });
          T(x, "정리하며 내려감", X(0.9), Y(0.16), { align: "center", color: c.b, weight: 700 });
          arrow(X(1), Y(late(1)), late(1), M.alpha(c.b, 0.85), null);
          x.restore();
        }
        const endT = M.lerp(1, 0.8, an.cut);
        curve(an.cut > 0.5 ? late : good, 0, an.cut > 0.5 ? 0.8 : 1, c.ink, 2.8);
        const ev = an.cut > 0.5 ? late(0.8) : good(1);
        M.dot(x, X(endT), Y(ev), 5, c.c, c.ink);
        arrow(X(endT), Y(ev), ev, c.c, ew > 420 ? "다음 화로" : null);
        // 시작/끝 상태 꼬리표
        if (step >= 1 && step <= 3) {
          M.tag(x, "시작: 사고사", x0, Y(good(0)) - 22, { size: 12 });
          if (step === 3) {
            const col = HCOL(c)[hook];
            M.tag(x, `훅: ${HN[hook]}`, X(1), Y(ev) - 24, { align: "right", size: 12.5, fill: M.alpha(col, 0.3) });
          } else if (step === 1) {
            M.tag(x, "끝: 사고가 아니다", X(1), Y(ev) - 24, { align: "right", size: 12, fill: M.alpha(c.c, 0.25) });
            x.save(); x.globalAlpha = an.cmp;
            M.tag(x, "끝: 그대로 사고사", X(1), Y(flatF(1)) + 24, { align: "right", size: 12, color: c.b });
            x.restore();
          }
        }
      }

      function strip(x, c, sx, sy, sw, sh) {
        hits = [];
        const n = 10, gap = 4, cw = (sw - gap * (n - 1)) / n, ch = 44;
        const cy = sy + sh - ch;
        const ly0 = sy + 36, ly1 = cy - 18;
        const pulls = arr.map((_, i) => pullOf(arr, i));
        const avg = pulls.reduce((a, b) => a + b, 0) / n;
        T(x, an.pull > 0.5 ? "회차별 · 훅이 다음 화로 당기는 힘" : "열 회차의 훅 종류 · 카드를 누르면 바뀜", sx, sy + 14, { weight: 700, color: c.ink });
        x.save(); x.globalAlpha = an.pull;
        M.tag(x, `평균 ${Math.round(avg * 100)}%`, sx + sw, sy + 10, { align: "right", size: 12, fill: M.alpha(avg < 0.6 ? c.b : c.c, 0.25) });
        M.line(x, sx, ly1, sx + sw, ly1, c.line2, 1);
        const PX = (i) => sx + i * (cw + gap) + cw / 2, PY = (v) => ly1 - v * (ly1 - ly0);
        x.strokeStyle = c.a; x.lineWidth = 2.4; x.beginPath();
        pulls.forEach((v, i) => (i ? x.lineTo(PX(i), PY(v)) : x.moveTo(PX(i), PY(v)))); x.stroke();
        pulls.forEach((v, i) => {
          M.dot(x, PX(i), PY(v), 4.5, v < 0.5 ? c.b : c.a, c.surface);
          if (cw > 40) T(x, Math.round(v * 100) + "", PX(i), PY(v) - 9, { align: "center", mono: true, color: c.muted });
        });
        x.restore();
        const cols = HCOL(c);
        arr.forEach((tp, i) => {
          const px = sx + i * (cw + gap);
          box(x, px + 1.5, cy + 2, cw, ch, 7, M.alpha(c.ink, 0.85));
          box(x, px, cy, cw, ch, 7, c.surface, c.ink);
          box(x, px, cy, cw, ch, 7, M.alpha(cols[tp], 0.28));
          T(x, `${i + 1}화`, px + cw / 2, cy + 16, { align: "center", color: c.ink2, mono: true });
          let nm = HN[tp]; font(x, 12, 700); if (x.measureText(nm).width > cw - 4) nm = nm.split(" ")[0];
          T(x, nm, px + cw / 2, cy + 34, { align: "center", weight: 700, color: c.ink });
          hits.push({ x: px, y: cy, w: cw, h: ch, i });
        });
      }

      function opening(x, c, ox, oy, ow, oh) {
        const G = [["1화", ["주인공과 결핍", "일상을 깨는 사건", "첫 쪽에 장르가 보임"]], ["2화", ["주인공의 무기", "무기의 제약", "작은 승리 하나"]], ["3화", ["큰 목표와 스테이크", "장기 떡밥 하나", "강한 훅"]]];
        const B1 = ["일곱 왕국의 역사", "지도와 연표", "주인공은 아직 없음"];
        const gap = 10, cw = (ow - gap * 2) / 3;
        const narrow = cw < 150;
        const chh = narrow ? 3 * 50 + 2 * 8 : Math.min(118, oh * 0.44);
        if (narrow) G.forEach(([t, items], k) => {
          const py = oy + k * 58, bad = open && k === 0;
          box(x, ox + 2, py + 3, ow, 50, 10, M.alpha(c.ink, 0.85));
          box(x, ox, py, ow, 50, 10, c.surface, c.ink);
          if (bad) box(x, ox, py, ow, 50, 10, M.alpha(c.b, 0.16));
          T(x, t, ox + 12, py + 30, { weight: 700, color: c.ink, size: 14 });
          font(x, 12, 600);
          wrapLines(x, (bad ? B1 : items).join(" · "), ow - 62).slice(0, 2).forEach((ln, j) => T(x, ln, ox + 48, py + 21 + j * 16, { weight: 600, color: c.ink2 }));
        });
        else G.forEach(([t, items], k) => {
          const px = ox + k * (cw + gap), bad = open && k === 0;
          box(x, px + 2, oy + 3, cw, chh, 10, M.alpha(c.ink, 0.85));
          box(x, px, oy, cw, chh, 10, c.surface, c.ink);
          if (bad) box(x, px, oy, cw, chh, 10, M.alpha(c.b, 0.16));
          T(x, t, px + 12, oy + 21, { weight: 700, color: c.ink, size: 14 });
          (bad ? B1 : items).forEach((s, j) => {
            const yy = oy + 44 + j * Math.min(24, (chh - 50) / 3);
            M.dot(x, px + 15, yy - 4, 3, bad ? c.b : c.c);
            const z = fitSize(x, s, cw - 34, 12.5, 600);
            T(x, s, px + 25, yy, { weight: 600, color: c.ink2, size: z });
          });
        });
        const gy = oy + chh + 34, gh = oy + oh - gy - 24, gx = ox + 40, gw = ow - 96;
        const X = (i) => gx + (i / 3) * gw, Y = (v) => gy + gh - (v / 100) * gh;
        T(x, "계속 읽는 독자 · 개념 모형(실제 수치 아님)", ox, gy - 12, { weight: 700, color: c.ink });
        [0, 50, 100].forEach((v) => { M.line(x, gx, Y(v), gx + gw, Y(v), c.line, 1, v ? [3, 4] : null); T(x, v + "%", gx - 8, Y(v) + 4, { align: "right", mono: true, color: c.muted }); });
        ["시작", "1화 뒤", "2화 뒤", "3화 뒤"].forEach((s, i) => T(x, s, X(i), gy + gh + 16, { align: "center", color: c.muted }));
        const R = [[100, 78, 66, 61], [100, 42, 34, 31]];
        R.forEach((ser, k) => {
          const on = k === open;
          x.save(); x.globalAlpha = on ? 1 : 0.35;
          x.strokeStyle = k ? c.b : c.c; x.lineWidth = on ? 3 : 1.6; if (!on) x.setLineDash([5, 4]);
          x.beginPath(); ser.forEach((v, i) => (i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v)))); x.stroke(); x.setLineDash([]);
          ser.forEach((v, i) => M.dot(x, X(i), Y(v), on ? 4.5 : 3, k ? c.b : c.c, c.surface));
          if (on) T(x, `${ser[3]}%`, X(3) + 10, Y(ser[3]) + 4, { weight: 700, color: c.ink });
          x.restore();
        });
      }

      return {
        setStep(s) {
          step = s; force5 = false;
          if (s === 3) { arr = MIX.slice(); arrC.set(1); hook = 1; hookC.set(1); }
          if (s === 4) { arr = ALL.slice(); arrC.set(0); hook = 0; hookC.set(0); }
          if (s === 5) { open = 0; openC.set(0); }
          if (s < 3) { hook = 1; hookC.set(1); arr = MIX.slice(); arrC.set(1); }
          prose();
        },
        frame(t, dt) {
          const c = C(), { x, w, h } = S.fit();
          const v5 = step === 5 || force5;
          const tg = { split: [1, 1, 1, 0.74, 0, 0][step], cmp: step === 1 ? 1 : 0, cut: step === 2 ? 1 : 0, strip: step >= 3 && step <= 4 ? 1 : 0, v5: v5 ? 1 : 0, pull: step === 4 ? 1 : 0 };
          if (force5) tg.split = 0, tg.strip = 0;
          for (const k in an) an[k] = follow(an[k], tg[k], dt, 360);
          x.save(); x.globalAlpha = 1 - an.v5;
          const eh = (h - 8) * an.split;
          if (an.split > 0.05) { x.save(); x.beginPath(); x.rect(0, 0, w, eh + 4); x.clip(); episode(x, c, 4, 0, w - 8, Math.max(eh, 200) - 4); x.restore(); }
          if (an.strip > 0.02) {
            x.save(); x.globalAlpha *= an.strip;
            const sy = eh + 10, sh = h - sy - 6;
            if (sh > 60) strip(x, c, 8, sy, w - 16, sh);
            x.restore();
          } else hits = [];
          x.restore();
          if (an.v5 > 0.02) { x.save(); x.globalAlpha = an.v5; opening(x, c, 8, 8, w - 16, h - 16); x.restore(); }
        },
      };
    },
  });

  /* =====================================================================
     7-2 고구마·사이다와 아크
     ===================================================================== */
  LESSONS.push({
    id: "cider-arc", ch: 7, order: 2,
    title: "고구마·사이다와 아크",
    lede: "이 레슨을 마치면 답답함(고구마)을 쌓았다가 터뜨리는(사이다) 리듬의 길이를 정하고, 회차를 에피소드·아크로 묶어 유료 전환과 성장 곡선을 배치하는 법을 알게 됩니다.",
    key: "고구마는 사이다의 연료지만 길면 독자가 떠납니다. 회차를 에피소드·아크로 묶어 가장 큰 훅을 전환점에 두고, 성장은 일직선이 아니라 정체와 돌파의 계단으로 만듭니다.",
    steps: [
      ["고구마는 사이다의 연료", "막대 하나가 회차 하나입니다. 빨간 막대는 <b>고구마</b>(주인공이 억울하게 당하는 답답함)로 화마다 쌓이고, 초록 막대는 <b>사이다</b>(통쾌한 반격)입니다. 사이다의 높이는 앞에서 쌓인 답답함만큼입니다. 고구마 길이를 0으로 하면 매 화 이기지만 사이다가 낮게 깔립니다."],
      ["길게 끌면 떠난다", "파란 선은 <b>남은 독자</b>입니다. 고구마를 7화로 늘리자 사이다는 높아졌지만 그 전에 독자가 계속 빠져 30화에는 절반도 남지 않습니다. 슬라이더로 길이를 바꿔 보세요. 사이다 높이와 남은 독자가 함께 괜찮은 길이가 리듬입니다. (개념 모형이라 숫자 자체에는 의미가 없습니다)"],
      ["당하면서도 준비한다", "고구마 구간에 <b>준비하는 모습</b>을 독자에게만 보여 주면(노란 점) 같은 길이에서도 독자가 덜 빠집니다. 인물은 당하고 있지만 독자는 반격을 기다리며 견딥니다. 극적 아이러니를 리듬에 쓰는 방법입니다."],
      ["에피소드와 아크로 묶는다", "300화를 3막 하나로 짤 수는 없습니다. 아래 괄호처럼 회차 몇 개가 사건 하나를 해결하는 <b>에피소드</b>가 되고(사이다로 끝남), 에피소드 여럿이 큰 적과 큰 목표를 가진 <b>아크</b>가 됩니다. 아크 여럿에 무대가 바뀌면 <b>부</b>가 됩니다."],
      ["전환점에 가장 큰 훅", "유료 연재는 일정 회차까지 무료로 열고 유료로 넘어가는 경우가 많습니다(회차 수는 플랫폼마다 다름). 점선처럼 아크의 전환점을 무료 구간 끝에 맞추고, 직전에 사이다를, 전환 회차 끝에 <b>아크 최대의 훅</b>을 둡니다."],
      ["성장은 계단으로", "파란 선은 주인공의 힘, 회색 선은 상대의 기준입니다. '일직선'으로 바꾸면 둘의 차이가 끝없이 벌어져 숫자가 의미를 잃습니다. 정체 뒤 돌파하는 <b>계단식 성장</b>에 16화의 <b>무대 교체</b>로 상대 기준을 올리면 차이가 좁게 유지되어 긴장이 살아납니다."],
    ],
    terms: [
      ["고구마", "Goguma", "주인공이 억울하게 당하거나 일이 풀리지 않는 답답한 구간을 부르는 웹소설 독자의 말. 사이다의 연료입니다."],
      ["사이다", "Cider", "쌓인 답답함을 시원하게 푸는 장면. 통쾌한 반격, 정체 폭로, 성장 확인 등."],
      ["에피소드", "Episode arc", "몇 회차에 걸쳐 작은 사건 하나를 시작하고 해결하는 묶음. 보통 사이다로 끝납니다."],
      ["아크", "Arc", "큰 적과 큰 목표를 가진 수십 화 단위의 묶음. 그 안이 하나의 3막 구조입니다."],
      ["연재 페이싱", "Serial pacing", "회차·에피소드·아크 단위로 긴장과 해소의 간격을 조절하는 일."],
    ],
    mount(api) {
      const S = shell(api);
      let step = 0, G = 3, prep = false, growth = 0, forceG = false;
      const an = { ret: 0, br: 0, pay: 0, gv: 0, lin: 0, hl: 0 };
      const sl = M.slider(api.controls, { id: "ca-g", label: "고구마 길이", min: 0, max: 8, value: 3, fmt: (v) => v + "화", onInput: (v) => (G = v) });
      const pc = M.check(api.controls, { id: "ca-prep", label: "고구마 동안 준비하는 모습을 보여 줌", onChange: (v) => (prep = v) });
      const gc = M.chips(api.controls, { title: "성장 방식", items: ["계단 + 무대 교체", "일직선"], value: 0, onPick: (i) => { growth = i; forceG = true; prose(); } });
      hint(api, "슬라이더를 0에서 8까지 끌며 초록 막대 높이와 파란 선 끝을 함께 보세요.");
      const seq = () => {
        const out = []; let run = 0, r = 1;
        for (let e = 1; e <= 30; e++) {
          if (G > 0 && run < G) { run++; const loss = (0.006 + 0.0065 * run) * (prep ? 0.4 : 1); r *= 1 - loss; out.push({ g: 1, f: 1 - Math.exp(-run / 2.4), r, run }); }
          else { const sat = 0.16 + 0.84 * (1 - Math.exp(-run / 2.4)); r *= 0.997; out.push({ g: 0, sat, r, run }); run = 0; }
        }
        return out;
      };
      const PROSE = {
        0: [["bad", "매 화 이김", "고구마 0화", "강도가 덤볐다. 류하는 가볍게 쓰러뜨렸다. 다음 날도 그랬다."], ["good", "쌓은 뒤 터뜨림", "고구마 3화 → 사이다", "사흘 내내 장부를 빼앗기고도 류하는 웃었다. <mark class=\"ok\">나흘째, 그 장부가 길드장 앞에 펼쳐졌다.</mark>"]],
        2: [["bad", "무력한 고구마", "", "류하는 또 당했다. 할 수 있는 게 없었다."], ["good", "준비하는 고구마", "독자만 아는 반격의 씨앗", "류하는 고개를 숙였다. <mark class=\"ok\">소매 안에서는 상대의 인장을 본뜬 밀랍이 식어 가고 있었다.</mark>"]],
        4: [["info", "25화 마지막 문장", "무료 구간의 끝", "길드장이 장부를 덮었다. <mark class=\"ok\">\"이 장부의 첫 주인은 네 아버지다.\"</mark>"]],
        5: [["bad", "일직선", "숫자 인플레이션", "레벨 312. 어제보다 9 올랐다. 오늘 상대는 레벨 40이었다."], ["good", "계단 + 무대 교체", "상대 기준이 바뀜", "도시의 문지기들은 모두 류하보다 강했다. <mark class=\"ok\">동네에서 쌓은 이름은 여기서 아무 의미가 없었다.</mark>"]],
      };
      const prose = () => { const p = PROSE[forceG ? 5 : step]; if (forceG || step === 5) S.setProse(growth ? [p[0]] : [p[1]]); else S.setProse(p || null); };

      function bars(x, c, gx, gy, gw, gh) {
        const sq = seq(), N = 30, cw = gw / N;
        const X = (e) => gx + (e - 0.5) * cw, Y = (v) => gy + gh - v * gh;
        M.line(x, gx, gy + gh, gx + gw, gy + gh, c.ink, 1.2);
        for (let e = 1; e <= N; e++) if (e === 1 || e % 5 === 0) T(x, e + "화", X(e), gy + gh + 15, { align: "center", color: c.muted });
        // 결제 전환선
        if (an.pay > 0.01) {
          x.save(); x.globalAlpha = an.pay;
          box(x, gx + 25 * cw, gy, 5 * cw, gh, 0, M.alpha(c.ch7, 0.1));
          M.line(x, gx + 25 * cw, gy - 6, gx + 25 * cw, gy + gh, c.ink, 1.5, [5, 4]);
          T(x, "여기부터 유료(예시)", gx + 25 * cw + 6, gy + 8, { weight: 700, color: c.ink, size: 12 });
          const env = pw([[1, 0.18], [8, 0.3], [15, 0.45], [21, 0.6], [25, 0.95], [26, 0.62], [29, 0.98], [30, 0.6]]);
          x.strokeStyle = c.ink2; x.lineWidth = 2.2; x.setLineDash([6, 4]); x.beginPath();
          for (let e = 1; e <= 30; e += 0.25) e === 1 ? x.moveTo(X(e), Y(env(e))) : x.lineTo(X(e), Y(env(e)));
          x.stroke(); x.setLineDash([]);
          M.line(x, gx, Y(0.97), gx + 22, Y(0.97), c.ink2, 2.2, [6, 4]);
          T(x, "아크 전체의 긴장 흐름", gx + 28, Y(0.97) + 4, { color: c.ink2, weight: 700 });
          M.tag(x, "최대 훅", X(25), Y(0.95) - 16, { align: "right", size: 12, fill: M.alpha(c.key, 0.4) });
          x.restore();
        }
        sq.forEach((d, i) => {
          const e = i + 1, bx = gx + i * cw + cw * 0.14, bw = cw * 0.72;
          const hlA = an.hl > 0.01 && e > 4 ? 1 - an.hl * 0.6 : 1;
          x.save(); x.globalAlpha *= hlA;
          if (d.g) {
            const v = d.f * 0.62;
            box(x, bx, Y(v), bw, v * gh, 3, M.alpha(c.b, 0.25 + 0.5 * d.f), M.alpha(c.ink, 0.6), 1);
            if (prep) M.dot(x, bx + bw / 2, Y(v) - 7, 3, c.key, c.ink);
          } else {
            box(x, bx, Y(d.sat), bw, d.sat * gh, 3, M.alpha(c.c, 0.85), c.ink, 1.2);
          }
          x.restore();
        });
        if (an.hl > 0.01 && G > 0) {
          x.save(); x.globalAlpha = an.hl;
          const d = sq[Math.min(G, 29)];
          const tg = M.tag(x, "쌓인 답답함만큼 시원하다", gx, Y(0.98), { size: 12, fill: M.alpha(c.c, 0.25) });
          M.arrow(x, tg.x + tg.w + 4, Y(0.98), X(G + 1) - 2, Y(d.sat || 0.2) - 6, c.ink, 1.6);
          x.restore();
        }
        // 남은 독자
        if (an.ret > 0.01) {
          x.save(); x.globalAlpha = an.ret;
          x.strokeStyle = c.a; x.lineWidth = 2.6; x.beginPath();
          x.moveTo(gx, Y(1)); sq.forEach((d, i) => x.lineTo(X(i + 1), Y(d.r))); x.stroke();
          const rEnd = sq[29].r;
          M.dot(x, X(30), Y(rEnd), 4.5, c.a, c.surface);
          M.tag(x, `남은 독자 ${Math.round(rEnd * 100)}%`, X(30), Y(rEnd) + (rEnd > 0.85 ? 20 : -18), { align: "right", size: 12, color: c.a });
          x.restore();
        }
        return sq;
      }
      function brackets(x, c, gx, gy, gw) {
        const N = 30, cw = gw / N, g = Math.max(1, G + 1);
        let row = gy;
        const br = (a, b, y, lab, col, strong) => {
          const xa = gx + (a - 1) * cw + 2, xb = gx + b * cw - 2;
          x.save(); x.strokeStyle = col; x.lineWidth = strong ? 2 : 1.4;
          x.beginPath(); x.moveTo(xa, y - 5); x.lineTo(xa, y); x.lineTo(xb, y); x.lineTo(xb, y - 5); x.stroke(); x.restore();
          if (lab) T(x, lab, (xa + xb) / 2, y + 15, { align: "center", weight: 700, color: c.ink2 });
        };
        let k = 0;
        for (let a = 1; a <= N; a += g) { br(a, Math.min(N, a + g - 1), row, k === 0 && g * cw > 54 ? "에피소드" : "", c.ch7, false); k++; }
        row += 30;
        br(1, N, row, "아크 1 · 큰 적 하나, 3막 하나", c.ink, true);
        T(x, "부(시즌) = 아크 여럿 + 무대 교체", gx + gw, row + 34, { align: "right", color: c.muted, weight: 600 });
      }
      function growthChart(x, c, gx, gy, gw, gh) {
        const N = 30, X = (e) => gx + ((e - 1) / (N - 1)) * gw, Y = (v) => gy + gh - (v / 1.2) * gh;
        const stair = (e) => { let p = 0.1; for (let k = 4; k <= e; k += 4) p += k === 16 ? 0.14 : 0.09; return p; };
        const lin = (e) => 0.1 + (e - 1) * 0.036;
        const oppS = (e) => (e < 16 ? 0.16 + e * 0.008 : 0.55 + (e - 16) * 0.012);
        const oppL = () => 0.24;
        const hero = (e) => M.lerp(stair(e), lin(e), an.lin), opp = (e) => M.lerp(oppS(e), oppL(e), an.lin);
        T(x, "주인공의 힘과 상대의 기준", gx, gy - 10, { weight: 700, color: c.ink });
        M.line(x, gx, gy + gh, gx + gw, gy + gh, c.ink, 1.2);
        for (let e = 1; e <= N; e++) if (e === 1 || e % 5 === 0) T(x, e + "화", X(e), gy + gh + 15, { align: "center", color: c.muted });
        // 차이 영역
        x.beginPath();
        for (let e = 1; e <= N; e += 0.5) e === 1 ? x.moveTo(X(e), Y(hero(e))) : x.lineTo(X(e), Y(hero(e)));
        for (let e = N; e >= 1; e -= 0.5) x.lineTo(X(e), Y(opp(e)));
        x.closePath(); x.fillStyle = M.alpha(M.lerp(0, 1, an.lin) > 0.5 ? c.b : c.c, 0.16); x.fill();
        const plot = (f, col, wdt, stepped) => {
          x.save(); x.strokeStyle = col; x.lineWidth = wdt; x.beginPath();
          for (let e = 1; e <= N; e += stepped ? 0.02 : 0.5) { const v = f(Math.floor(e * 1000) / 1000); e === 1 ? x.moveTo(X(e), Y(v)) : x.lineTo(X(e), Y(v)); }
          x.stroke(); x.restore();
        };
        plot((e) => M.lerp(stair(Math.floor(e)), lin(e), an.lin), c.a, 3, true);
        plot((e) => M.lerp(oppS(Math.floor(e)), oppL(e), an.lin), c.muted, 2.2, true);
        x.save(); x.globalAlpha = 1 - an.lin;
        M.line(x, X(16), gy + 6, X(16), gy + gh, c.ink, 1.2, [4, 4]);
        M.tag(x, "16화 무대 교체: 동네 → 도시", X(16) - 6, gy + 12, { align: "right", size: 12, fill: M.alpha(c.key, 0.3) });
        x.restore();
        const gap30 = hero(30) - opp(30);
        T(x, "주인공", X(30) + 6, Y(hero(30)) + 4, { weight: 700, color: c.a });
        T(x, "상대", X(30) + 6, Y(opp(30)) + 4, { weight: 700, color: c.muted });
        const msg = gap30 > 0.4 ? "차이가 너무 커서 어떤 싸움도 긴장이 없다" : "차이가 좁아 다음 싸움이 궁금하다";
        M.tag(x, msg, gx + 4, gy + gh - 16, { size: 12, fill: M.alpha(gap30 > 0.4 ? c.b : c.c, 0.25) });
      }
      return {
        setStep(s) {
          step = s; forceG = false;
          G = [3, 7, 7, 3, 3, 3][s]; sl.set(G);
          prep = s === 2; pc.set(prep);
          growth = 0; gc.set(0);
          prose();
        },
        frame(t, dt) {
          const c = C(), { x, w, h } = S.fit();
          const g5 = step === 5 || forceG;
          const tg = { ret: step === 1 || step === 2 ? 1 : 0, br: step === 3 ? 1 : 0, pay: step === 4 ? 1 : 0, gv: g5 ? 1 : 0, lin: growth, hl: step === 0 ? 1 : 0 };
          for (const k in an) an[k] = follow(an[k], tg[k], dt, 380);
          const gx = 40, gw = w - 60 - (w > 500 ? 30 : 0), right = w > 500 ? 30 : 0;
          x.save(); x.globalAlpha = 1 - an.gv;
          if (an.gv < 0.98) {
            const brH = 86 * an.br;
            const gy = 40, gh = h - gy - 28 - brH;
            const sq = bars(x, c, gx, gy, gw, gh);
            // 판정
            const sats = sq.filter((d) => !d.g).map((d) => d.sat);
            const avgS = sats.length ? sats.reduce((a, b) => a + b, 0) / sats.length : 0, r = sq[29].r;
            const msg = G === 0 ? "매 화 이기지만 밋밋하다" : r < 0.5 ? "답답해서 떠난다" : avgS < 0.5 ? "사이다가 약하다" : "리듬이 산다";
            T(x, `고구마 ${G}화 → 사이다 1화`, gx - 30, 18, { weight: 700, color: c.ink });
            M.tag(x, `사이다 높이 ${Math.round(avgS * 100)}% · ${msg}`, gx + gw + right, 14, { align: "right", size: 12, fill: M.alpha(msg === "리듬이 산다" ? c.c : c.b, 0.22) });
            if (an.br > 0.02) { x.save(); x.globalAlpha *= an.br; brackets(x, c, gx, gy + gh + 30, gw); x.restore(); }
          }
          x.restore();
          if (an.gv > 0.02) { x.save(); x.globalAlpha = an.gv; growthChart(x, c, gx, 36, gw - 20, h - 36 - 30); x.restore(); }
        },
      };
    },
  });
  /* =====================================================================
     7-3 설정 원장과 연속성 (+ AI 공동집필의 원리 핵심)
     ===================================================================== */
  LESSONS.push({
    id: "continuity-ledger", ch: 7, order: 3,
    title: "설정 원장과 연속성",
    lede: "이 레슨을 마치면 회차마다 바뀐 것만 적는 원장으로 '지금 이 세계의 상태'를 꺼내 보고, 시간선 모순·지식 경계 위반·떡밥 방치·레트콘 비용을 잡는 법과, AI와 장편을 쓸 때 무엇을 골라 넣고 누가 검사할지 알게 됩니다.",
    key: "장편은 회차별 변경 기록(원장)을 합쳐서 관리합니다. 사실에는 유효 구간을, 지식에는 아는 시점을 붙이고, 새 회차에는 걸린 항목만 넣고, 검사는 쓴 쪽과 따로 원문을 인용해 합니다.",
    steps: [
      ["회차는 변경 기록", "가로가 회차, 한 줄이 <b>원장</b>의 항목 하나입니다. 회차마다 바뀐 것만 적고, 1화부터 N화까지를 합치면 N화 시점의 세계가 됩니다. 커서가 지나가며 아래 'N화 시점'이 다시 계산됩니다. 슬라이더로 직접 옮겨 보세요."],
      ["사실에는 유효 구간", "윤재의 왼발목 부상은 3화에 생겨 6화에 <b>닫혔습니다</b>. 그런데 11화 원고에 '절뚝이며'가 있어 빨간 표시가 붙었습니다. 닫힌 사실을 되살린 <b>시간선 모순</b>입니다. 끝 회차를 적어 두지 않으면 지나간 상태가 계속 살아납니다."],
      ["사실과 지식은 따로", "'선장이 해도를 바꿨다'는 사실 하나지만 아는 시점은 다릅니다. 독자 7화, 세아 8화, 윤재 10화. 9화의 윤재가 그 말을 하면 <b>지식 경계 위반</b>입니다. 노란 띠는 독자만 아는 극적 아이러니 구간이라, 이 오류는 긴장까지 깨뜨립니다."],
      ["떡밥 장부", "떡밥은 연 회차와 회수한 회차를 함께 적습니다. 찢긴 해도 귀퉁이는 1화에 열어 5화에 닫혔지만, 잠긴 항해일지는 2화 뒤로 한 번도 나오지 않아 <b>방치</b> 표시가 붙었습니다. 오래 묵은 떡밥은 독자가 잊거나, 잊지 않고 따집니다."],
      ["레트콘의 비용", "12화에 '선장은 사실 윤재의 외삼촌'으로 설정을 바꾸면(<b>레트콘</b>), 원장에서 '초면'에 기댄 2·4·9화가 한꺼번에 걸립니다. 바꿀 수는 있지만 앞 회차를 맞추는 비용을 치러야 합니다. 원장이 있어야 이 목록을 바로 뽑을 수 있습니다."],
      ["필요한 것만 넣는다", "긴 연재는 사람 머리에도, AI의 <b>컨텍스트 창</b>에도 다 들어가지 않고, 많이 넣을수록 중요한 한 줄이 묻힙니다. 13화 계획에 나오는 이름(윤재·세아·항해일지)이 걸린 줄만 골라 넣고, 이미 닫힌 사실은 뺍니다. 아래 막대로 두 방식의 양을 비교해 보세요."],
      ["검사는 따로, 근거와 함께", "쓴 쪽이 자기 글을 검사하면 관대해지고, 긴 원고를 통째로 주면 모순을 잘 놓칩니다. 독립된 검사자가 원장을 기준으로 <b>유형별로</b> 보고, 지적마다 <b>원문을 인용</b>하게 하면 ①②③ 세 곳이 근거와 함께 나옵니다. 판단은 사람이 합니다."],
    ],
    terms: [
      ["시리즈 바이블", "Series bible", "세계 규칙, 인물의 고정 속성, 지명·용어 표기처럼 시간이 지나도 참인 것을 모은 문서. 변하는 상태는 넣지 않습니다."],
      ["상태 원장", "State ledger", "회차가 바꾼 것만 적는 기록. 사실·지식·떡밥·인물 상태로 나누고, 처음부터 합치면 그 시점의 세계가 됩니다."],
      ["연속성 오류", "Continuity error", "앞에서 정한 사실·시간·지식·규칙과 어긋나는 서술. 연재가 길수록 늘어납니다."],
      ["지식 경계", "Knowledge boundary", "어떤 인물이 어떤 정보를 언제부터 아는지의 경계. 아직 모를 것을 말하면 위반입니다."],
      ["레트콘", "Retcon", "Retroactive continuity. 이미 공개된 설정을 나중에 바꾸거나 다르게 해석하는 것. 앞뒤를 맞추는 비용이 듭니다."],
      ["컨텍스트 창", "Context window", "AI 모델이 한 번에 볼 수 있는 글의 양. 다 넣을 수 없고, 많이 넣을수록 필요한 정보가 묻히기 쉽습니다."],
    ],
    mount(api) {
      const S = shell(api);
      const ROWS = [
        { h: "사실" },
        { lab: "배 이름: 청새치호", a: 1, b: 99, k: "fact", nm: [] },
        { lab: "윤재 왼발목 부상", a: 3, b: 6, k: "fact", nm: ["윤재"], id: "ankle" },
        { lab: "나침반이 북을 못 가리킴", a: 2, b: 99, k: "fact", nm: [] },
        { lab: "선장은 윤재와 초면", a: 2, b: 99, k: "fact", nm: ["윤재"], id: "uncle" },
        { h: "지식 · 선장이 해도를 바꿨다" },
        { lab: "독자", a: 7, k: "know", nm: [] },
        { lab: "세아", a: 8, k: "know", nm: ["세아"] },
        { lab: "윤재", a: 10, k: "know", nm: ["윤재"], id: "yk" },
        { h: "떡밥" },
        { lab: "찢긴 해도 귀퉁이", a: 1, pay: 5, k: "thread", nm: [] },
        { lab: "잠긴 항해일지", a: 2, last: 2, k: "thread", nm: ["항해일지"], id: "log" },
      ];
      const picked = (r) => r.nm && r.nm.length && !(r.b && r.b < 13);
      let step = 0, nowT = 12, now = 12, auto = false, retcon = true, ctx = 0, forceCtx = false;
      const an = { irony: 0, retc: 0, ctx: 0, f1: 0, f2: 0, f3: 0, num: 0 };
      const sl = M.slider(api.controls, { id: "cl-now", label: "지금 회차", min: 1, max: 12, value: 12, fmt: (v) => v + "화", onInput: (v) => { auto = false; nowT = v; } });
      const rc = M.check(api.controls, { id: "cl-ret", label: "레트콘: 선장은 윤재의 외삼촌(12화)", checked: true, onChange: (v) => (retcon = v) });
      const cc = M.chips(api.controls, { title: "13화를 쓸 때 넣는 것", items: ["걸린 항목만", "전부 넣기"], value: 0, onPick: (i) => { ctx = i; forceCtx = true; } });
      hint(api, "슬라이더를 앞으로 당기면 그 회차까지만 원장을 합친 세계가 보입니다.");
      const summary = (n) => {
        const ank = n < 3 ? "멀쩡함" : n <= 6 ? "다침" : "나음(흉터만)";
        const who = [["독자", 7], ["세아", 8], ["윤재", 10]].filter(([, a]) => n >= a).map(([w]) => w);
        const th = []; if (n >= 1 && n < 5) th.push("찢긴 해도"); if (n >= 2) th.push("항해일지");
        return `<b>${n}화 시점</b> · 윤재 발목: ${ank}${n >= 2 ? " · 나침반 이상" : ""}${n >= 2 ? " · 선장과 윤재: 초면" : ""} · 해도 위조를 아는 쪽: ${who.length ? who.join(", ") : "없음"} · 열린 떡밥: ${th.length ? th.join(", ") : "없음"}`;
      };
      const PROSE = {
        1: [["bad", "11화 원고", "검사 전", "윤재는 <mark>절뚝이며</mark> 갑판을 건넜다."], ["good", "고친 원고", "발목은 6화에 나음", "윤재는 <mark class=\"ok\">발목의 흉터를 문지르며</mark> 갑판을 건넜다."]],
        2: [["bad", "9화 원고", "윤재는 아직 모름", "\"<mark>선장님이 해도를 바꿨잖아요.</mark>\" 윤재가 말했다."], ["good", "고친 원고", "독자만 아는 긴장", "윤재는 선장이 건넨 해도를 <mark class=\"ok\">고맙다며 받아 들었다.</mark>"]],
        3: [["info", "12화까지 원장", "떡밥 점검", "잠긴 항해일지: 2화에 열림, <mark>10화째 언급 없음.</mark> 회수할 계획이 없으면 13화 계획에서 다시 꺼낸다."]],
        4: [["bad", "조용한 레트콘", "기록 없음", "12화: \"사실 선장은 네 외삼촌이다.\" <small>(2·4·9화의 초면 장면과 부딪힘)</small>"], ["good", "기록한 레트콘", "영향 회차 3개를 맞춤", "원장: <mark class=\"ok\">'초면' → '정체를 숨긴 외삼촌'</mark>. 2·4·9화 대사를 '모른 척'으로 손본다."]],
        5: [["info", "13화 계획", "이름 트리거", "<mark class=\"ok\">윤재</mark>와 <mark class=\"ok\">세아</mark>가 잠긴 <mark class=\"ok\">항해일지</mark>를 연다."]],
        6: [["bad", "쓴 모델이 직접 검사", "원고 전체 + '모순 찾아 줘'", "\"특별한 모순은 보이지 않습니다.\""], ["good", "독립 검사", "유형별 · 원문 인용", "① 11화 '절뚝이며' ↔ 발목 부상 3~6화 ② 9화 '해도를 바꿨잖아요' ↔ 윤재는 10화부터 앎 ③ 항해일지 10화째 미언급"]],
      };
      let lastN = -1;
      const prose = () => {
        if (step === 0) { const n = Math.round(now); if (n !== lastN) { lastN = n; S.setProse([["info", "합친 결과", "1화부터 이 회차까지", summary(n)]]); } return; }
        lastN = -1; S.setProse(PROSE[step] || null);
      };

      function grid(x, c, w, h, footH) {
        const LW = M.clamp(w * 0.3, 112, 196), NC = 13;
        const gx = LW, gw = w - LW - 8, cw = gw / NC, top = 30;
        const rh = M.clamp((h - top - footH - 6) / ROWS.length, 16, 30);
        const CX = (e) => gx + (e - 0.5) * cw, CL = (e) => gx + (e - 1) * cw;
        // 머리줄
        for (let e = 1; e <= NC; e++) {
          const is13 = e === 13;
          if (is13 && an.ctx < 0.02) continue;
          x.save(); x.globalAlpha = is13 ? an.ctx : 1;
          if (cw < 24 && e % 2 === 0 && e !== Math.round(now)) { x.restore(); continue; }
          T(x, String(e), CX(e), 18, { align: "center", mono: true, weight: e === Math.round(now) ? 700 : 500, color: e === Math.round(now) ? c.ink : c.muted });
          x.restore();
        }
        T(x, "회차 →", gx - 8, 18, { align: "right", color: c.muted });
        for (let e = 1; e <= 12; e++) M.line(x, CL(e), top - 4, CL(e), top + rh * ROWS.length, M.alpha(c.line, 0.7), 1);
        // 13화 계획 열
        if (an.ctx > 0.02) {
          x.save(); x.globalAlpha = an.ctx;
          box(x, CL(13) + 1, top - 4, cw - 2, rh * ROWS.length + 4, 4, M.alpha(c.key, 0.18), c.key, 1.2);
          x.restore();
        }
        // 극적 아이러니 띠
        if (an.irony > 0.02) {
          const r0 = ROWS.findIndex((r) => r.lab === "독자"), y0 = top + r0 * rh, y1 = top + (r0 + 3) * rh;
          x.save(); x.globalAlpha = an.irony;
          box(x, CL(7), y0 + 1, cw * 3, y1 - y0 - 2, 4, M.alpha(c.key, 0.28));
          x.restore();
        }
        const rows = [];
        ROWS.forEach((r, i) => {
          const y = top + i * rh, my = y + rh / 2;
          rows.push({ r, y, my });
          if (r.h) {
            T(x, r.h, 4, my + 4, { weight: 700, color: c.ink, size: 12 });
            M.line(x, gx, my, gx + 12 * cw, my, c.line2, 1, [1, 3]);
            return;
          }
          const sel = picked(r);
          const dim = an.ctx > 0.02 && !sel ? 1 - an.ctx * 0.7 : 1;
          x.save(); x.globalAlpha = dim;
          if (an.ctx > 0.02 && sel) box(x, 2, y + 1, gx + 13 * cw - 4, rh - 2, 5, M.alpha(c.key, 0.16 * an.ctx));
          font(x, 12, 600); let s = r.lab; while (x.measureText(s).width > LW - 22 && s.length > 2) s = s.slice(0, -2) + "…";
          T(x, s, 14, my + 4, { weight: 600, color: c.ink2 });
          const bh = Math.min(14, rh * 0.56), n = now;
          if (r.k === "fact" || r.k === "know") {
            const endE = Math.min(r.b || 99, n);
            if (n >= r.a) {
              const xa = CL(r.a) + 2, xb = CL(endE + 1) - 2;
              const col = r.k === "fact" ? c.ch7 : c.c;
              let xr = xb;
              if (r.id === "uncle" && an.retc > 0.02 && n > 11.5) xr = CL(12) - 2;
              box(x, xa, my - bh / 2, Math.max(4, xr - xa), bh, 4, M.alpha(col, 0.4), c.ink, 1);
              if (r.id === "uncle" && an.retc > 0.02 && n > 11.5) {
                x.save(); x.globalAlpha *= an.retc;
                box(x, CL(12) + 2, my - bh / 2, cw - 4, bh, 4, M.alpha(c.b, 0.35), c.b, 1.2);
                x.restore();
              }
              if (r.b && r.b < 99 && n >= r.b) { M.line(x, xb, my - bh / 2 - 3, xb, my + bh / 2 + 3, c.ink, 2.2); if (cw > 30) T(x, "닫힘", xb + 4, my + 4, { color: c.muted }); }
              if (r.k === "know") M.dot(x, xa + 4, my, 3.5, c.ink);
            }
          } else {
            if (n >= r.a) {
              const xa = CX(r.a), payE = r.pay && n >= r.pay ? r.pay : null, xe = payE ? CX(payE) : CL(n + 1) - 4;
              M.line(x, xa, my, xe, my, M.alpha(c.ink, 0.7), 1.5, [4, 3]);
              M.dot(x, xa, my, 5, c.surface, c.ink);
              if (payE) { M.dot(x, CX(payE), my, 5, c.c, c.ink); if (cw > 26) T(x, "회수", CX(payE) + 9, my + 4, { color: c.muted }); }
              if (r.last) for (let e = r.a; e <= Math.min(n, r.last); e++) M.dot(x, CX(e), my, 2.5, c.ink);
            }
          }
          x.restore();
        });
        const rowOf = (id) => rows.find((q) => q.r.id === id);
        const flag = (id, e, lab, a, num) => {
          if (a < 0.02) return;
          const q = rowOf(id); if (!q) return;
          x.save(); x.globalAlpha = a;
          const fx = CX(e), fy = q.my;
          M.dot(x, fx, fy, 8, c.b, c.ink);
          x.strokeStyle = c.surface; x.lineWidth = 2; x.beginPath(); x.moveTo(fx - 3.5, fy - 3.5); x.lineTo(fx + 3.5, fy + 3.5); x.moveTo(fx + 3.5, fy - 3.5); x.lineTo(fx - 3.5, fy + 3.5); x.stroke();
          const t = (an.num > 0.5 ? num + " " : "") + lab;
          const right = fx + 14 + 110 < gx + 12 * cw;
          M.tag(x, t, right ? fx + 13 : fx - 13, fy, { align: right ? "left" : "right", size: 12, fill: M.alpha(c.b, 0.2) });
          x.restore();
        };
        flag("ankle", 11, "11화 '절뚝이며'", an.f1, "①");
        flag("yk", 9, "9화 대사", an.f2, "②");
        if (an.f3 > 0.02 && now >= 8) {
          const q = rowOf("log"); x.save(); x.globalAlpha = an.f3;
          M.tag(x, `${an.num > 0.5 ? "③ " : ""}${Math.round(now) - 2}화째 방치`, CL(Math.round(now) + 1) - 6, q.my, { align: "right", size: 12, fill: M.alpha(c.b, 0.2) });
          x.restore();
        }
        if (an.irony > 0.3) {
          const q = rows.find((z) => z.r.lab === "독자");
          x.save(); x.globalAlpha = an.irony;
          T(x, "독자만 앎", CX(8), q.y - 2, { align: "center", weight: 700, color: c.ink, size: 12 });
          x.restore();
        }
        if (an.retc > 0.02 && now > 11.5) {
          const q = rowOf("uncle");
          x.save(); x.globalAlpha = an.retc;
          [2, 4, 9].forEach((e) => { box(x, CL(e) + 2, q.y + 2, cw - 4, rh - 4, 4, null, c.b, 2); });
          M.tag(x, "12화부터 외삼촌", CL(13) - 2, q.y + rh + 8, { align: "right", size: 12, fill: M.alpha(c.b, 0.25) });
          M.tag(x, "고칠 회차 3개", CL(2) + 2, q.y + rh + 8, { size: 12, color: c.b });
          x.restore();
        }
        // 지금 커서
        const kx = CL(now + 1);
        if (now < 12) { x.save(); x.fillStyle = M.alpha(c.bg, 0.6); x.fillRect(kx, top - 4, CL(13) - kx, rh * ROWS.length + 4); x.restore(); }
        M.line(x, kx, top - 8, kx, top + rh * ROWS.length, c.key, 2);
        return { bottom: top + rh * ROWS.length };
      }
      function budget(x, c, bx, by, bw) {
        const win = bw * 0.62;
        const rows = [["전부 넣기 · 원고 12화와 설정 전부", 1.45], ["걸린 항목만 · 요약 + 5줄", 0.2]];
        T(x, "넣는 양", bx, by + 12, { weight: 700, color: c.ink });
        rows.forEach(([lab, v], i) => {
          const y = by + 22 + i * 22, on = (i === 0) === (ctx === 1);
          const len = Math.min(bw - 4, win * v);
          x.save(); x.globalAlpha = on ? 1 : 0.4;
          box(x, bx, y, len, 14, 4, M.alpha(v > 1 ? c.b : c.c, 0.5), c.ink, 1);
          if (v > 1) hatch(x, bx + win, y, len - win, 14, M.alpha(c.b, 0.9), 5);
          const z = fitSize(x, lab, bw - Math.min(len, win * 0.3) - 16, 12, 600);
          T(x, lab, v > 1 ? bx + 6 : bx + len + 8, y + 11, { weight: 600, color: c.ink, size: z });
          x.restore();
        });
        M.line(x, bx + win, by + 16, bx + win, by + 62, c.ink, 1.5, [4, 3]);
        T(x, "한 번에 잘 다루는 양", bx + win + 6, by + 12, { color: c.muted, weight: 600 });
      }
      return {
        setStep(s) {
          step = s; forceCtx = false; auto = s === 0;
          nowT = 12; if (!auto) sl.set(12);
          retcon = s === 4; rc.set(retcon);
          ctx = 0; cc.set(0);
          prose();
        },
        replay() { if (step === 0) auto = true; },
        frame(t, dt) {
          const c = C(), { x, w, h } = S.fit();
          if (auto) { nowT = Math.min(12, 1 + t / 700); sl.set(Math.round(nowT)); now = nowT; }
          else now = follow(now, nowT, dt, 260);
          const cx = step === 5 || forceCtx;
          const tg = { irony: step === 2 ? 1 : 0, retc: (step === 4 || retcon) && step !== 5 ? (retcon ? 1 : 0) : 0, ctx: cx ? 1 : 0,
            f1: step === 1 || step === 6 ? 1 : 0, f2: step === 2 || step === 6 ? 1 : 0, f3: step === 3 || step === 6 ? 1 : 0, num: step === 6 ? 1 : 0 };
          for (const k in an) an[k] = follow(an[k], tg[k], dt, 320);
          prose();
          const footH = 74 * an.ctx;
          const g = grid(x, c, w, h, footH);
          if (an.ctx > 0.02) { x.save(); x.globalAlpha = an.ctx; budget(x, c, 8, Math.max(g.bottom + 6, h - 72), w - 16); x.restore(); }
        },
      };
    },
  });

  /* =====================================================================
     7-4 장르의 약속
     ===================================================================== */
  LESSONS.push({
    id: "genre-promise", ch: 7, order: 4,
    title: "장르의 약속",
    lede: "이 레슨을 마치면 장르를 독자와 맺은 계약으로 보고, 미스터리·로맨스·게임판타지·SF가 각각 꼭 지켜야 하는 약속과 그 약속을 구조에서 지키는 법, 장르를 섞을 때의 우선순위를 알게 됩니다.",
    key: "장르의 약속은 지키고, 약속을 전하는 트로프는 비틉니다. 장르를 섞을 때는 두 약속이 겹치는 장면을 찾고, 못 찾으면 주 장르의 약속을 지킵니다.",
    steps: [
      ["약속 안에서 비튼다", "원은 로맨스 장르의 약속(관계가 중심, 희망적 결말)의 경계이고, 가운데 흐린 점들은 흔한 선택이 몰리는 평균, 곧 <b>클리셰</b>입니다. AI에게 장르 이름만 주면 가운데로 끌려가기 쉽습니다. '비틀기' 슬라이더로 점을 옮기면 원 안에서는 신선해지고, 원을 넘으면 약속 위반이 됩니다."],
      ["미스터리: 공정한 단서", "미스터리의 약속은 <b>독자도 풀 수 있었던 해답</b>입니다. 해결에 필요한 단서 셋(초록)이 12화 해결 장면 전에 모두 나와 있고, 가짜 단서(빨강)는 진짜를 가리는 데 씁니다. '약속 어기기'를 켜면 결정적 단서가 해결 장면에서 처음 나와 공정성 칸이 하나 빕니다."],
      ["로맨스: 관계와 희망적 결말", "장르 로맨스는 <b>두 사람의 관계가 중심</b>이고 결말이 정서적으로 만족스럽고 희망적이라는 약속을 합니다. 오른쪽 위 띠가 HEA(영원히 행복)·HFN(지금은 행복) 구역입니다. 약속을 어기면 끝점이 구역 밖으로 떨어집니다. 로맨스로 소개한 작품이면 독자는 배신감을 느낍니다."],
      ["게임판타지: 보이는 성장", "게임판타지의 약속은 <b>숫자로 확인하는 성장</b>의 쾌감입니다. 계단마다 레벨이 오르고 새 제약이 함께 열립니다. 약속을 어기면 3화에 이미 최강이 되어 이후 계단이 사라지고, 더 성장할 곳이 없어집니다."],
      ["SF: '만약'을 끝까지", "SF는 '만약 이것이 가능하다면'을 끝까지 따라갑니다. 가운데의 새로운 것(<b>노붐</b>) '잠을 사고파는 도시'가 경제 → 법 → 한 사람의 삶으로 번져 나갑니다. 약속을 어기면 파문이 첫 고리에서 멈추고 인물이 사라져, 설정 소개만 남습니다."],
      ["섞을 때는 주 장르부터", "미스터리와 로맨스를 섞으면 두 약속의 원이 겹칩니다. 클라이맥스는 <b>겹치는 곳</b>의 장면이 가장 좋습니다. 그런 장면을 못 찾으면 <b>주 장르의 원 안</b>에 있는 쪽을 고릅니다. '주 장르'를 바꾸면 살아남는 후보가 바뀝니다."],
    ],
    terms: [
      ["장르의 약속", "Promise of the genre", "독자가 그 장르를 고를 때 끝까지 읽고 반드시 받기를 기대하는 경험. 바꾸면 장르가 바뀝니다."],
      ["트로프", "Trope", "장르에서 반복되는 익숙한 장치(계약 결혼, 밀실, 회귀). 약속을 빨리 전하는 공용 어휘입니다."],
      ["클리셰", "Cliché", "이유 없이 반복돼 효과가 닳은 트로프. 트로프에 비틀 지점 하나를 두면 피할 수 있습니다."],
      ["페어플레이", "Fair play", "미스터리에서 해답에 필요한 단서를 해결 전에 독자에게 보여 주는 원칙. 1920년대 녹스의 '10계', 반 다인의 '20칙'이 이를 규칙으로 적으려 했습니다."],
      ["노붐", "Novum", "비평가 다르코 수빈의 말로, SF 세계에 들어온 '새로운 것'. 그것이 사회와 사람에게 번지는 결과가 플롯이 됩니다."],
    ],
    mount(api) {
      const S = shell(api);
      let step = 0, twist = 0.75, broken = false, mainG = 0;
      const an = { tw: 0.75, br: 0, main: 0 };
      const sl = M.slider(api.controls, { id: "gp-tw", label: "비틀기", min: 0, max: 1.4, step: 0.01, value: 0.75, fmt: (v) => (v < 0.3 ? "평균 그대로" : v <= 1 ? "약속 안에서 비틂" : "약속 밖"), onInput: (v) => { twist = v; prose(); } });
      const bc = M.check(api.controls, { id: "gp-br", label: "약속 어기기", onChange: (v) => { broken = v; prose(); } });
      const mc = M.chips(api.controls, { title: "주 장르", items: ["미스터리", "로맨스"], value: 0, onPick: (i) => { mainG = i; } });
      const vis = () => { sl.el.style.display = step === 0 ? "" : "none"; bc.el.style.display = step >= 1 && step <= 4 ? "" : "none"; mc.el.style.display = step === 5 ? "" : "none"; };
      const PROSE = {
        0: [["bad", "평균 버전", "트로프를 그대로", "차가운 재벌 후계자가 평범한 그녀에게 계약 결혼을 제안했다."], ["good", "비튼 버전", "약속은 지키고 트로프를 비틂", "계약 결혼을 제안한 쪽은 파산 직전의 그녀였다. <mark class=\"ok\">조건은 하나, 이혼할 때 그의 회사를 받는 것.</mark>"]],
        1: [["bad", "뒷북 단서", "해결 장면에서 처음 나옴", "탐정이 말했다. \"<mark>사실 범인에게는 쌍둥이 형이 있었습니다.</mark>\""], ["good", "공정한 단서", "5화에 이미 나옴", "탐정이 말했다. \"<mark class=\"ok\">5화에 멈춰 있던 시계, 기억하십니까?</mark>\""]],
        2: [["bad", "약속 위반", "로맨스로 소개했다면", "마지막 화, 두 사람은 끝내 다시 만나지 않았다."], ["good", "HFN", "지금은 행복", "내일 일은 몰라도, <mark class=\"ok\">오늘 둘은 같은 우산 아래 서 있었다.</mark>"]],
        3: [["bad", "성장 없음", "3화에 이미 최강", "3화, 그는 이미 세상에서 가장 강했다. 남은 일은 그걸 확인하는 것뿐이었다."], ["good", "보이는 성장", "숫자와 새 제약", "Lv 4. <mark class=\"ok\">처음으로 고블린 하나를 혼자 잡았다.</mark> 대신 회복 물약이 바닥났다."]],
        4: [["bad", "설정 소개만", "파급이 없음", "이 도시에서는 잠을 사고팔 수 있었다. 사람들은 평소처럼 살았다."], ["good", "파급", "경제 → 법 → 한 사람", "잠을 판 어머니는 열흘째 깨어 있었다. <mark class=\"ok\">딸의 학비는 그 열흘 치 값이었다.</mark>"]],
        5: [["bad", "부딪힌 약속", "고백이 해답을 덮음", "범인을 밝히려던 순간, 그가 고백했다. 사건 이야기는 그걸로 끝났다."], ["good", "겹치는 장면", "고백이 마지막 단서를 엶", "\"그날 밤 네 곁에 있었어.\" <mark class=\"ok\">그 고백이 곧 범인의 알리바이를 무너뜨렸다.</mark>"]],
      };
      const prose = () => {
        const p = PROSE[step];
        const bad = step === 0 ? twist < 0.3 || twist > 1 : step <= 4 ? broken : false;
        if (step === 0 && twist > 1) { S.setProse([["bad", "약속 밖", "장르가 바뀜", "계약 결혼은 끝내 사업 이야기로 흘렀고, 두 사람의 관계는 3화 이후 나오지 않았다."], p[1]]); return; }
        S.setProse(bad ? [p[0], p[1]] : [p[1], p[0]]);
      };
      const head = (x, c, w, title, ok, okText, badText) => {
        T(x, title, 10, 20, { weight: 700, color: c.ink, size: 13 });
        M.tag(x, ok ? okText : badText, w - 10, 16, { align: "right", size: 12, fill: M.alpha(ok ? c.c : c.b, 0.25) });
      };
      // 결정적 의사 난수
      const PTS = []; { let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280); for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.24; PTS.push([Math.cos(a) * d, Math.sin(a) * d]); } }

      function map(x, c, w, h) {
        const cx = w / 2, cy = h / 2 + 12, R = Math.min(w * 0.36, h * 0.38);
        const tw = an.tw, ang = -0.55;
        const inside = tw <= 1, avg = tw < 0.3;
        head(x, c, w, "로맨스 · 이야기 선택의 공간", inside && !avg, "약속 안에서 신선함", avg ? "평균 그대로(클리셰)" : "약속 밖: 장르가 바뀜");
        box(x, cx - R, cy - R, R * 2, R * 2, R, M.alpha(c.ch4, 0.1), c.ink, 1.5);
        T(x, "약속의 경계: 관계가 중심, 희망적 결말", cx, cy - R - 10, { align: "center", weight: 700, color: c.ink2 });
        PTS.forEach(([px, py]) => M.dot(x, cx + px * R, cy + py * R, 3.5, M.alpha(c.muted, 0.55)));
        T(x, "평균 = 클리셰", cx, cy + R * 0.32 + 14, { align: "center", weight: 700, color: c.muted });
        const px = cx + Math.cos(ang) * tw * R, py = cy + Math.sin(ang) * tw * R;
        M.line(x, cx, cy, px, py, c.ink2, 1.5, [4, 4]);
        const col = avg ? c.muted : inside ? c.c : c.b;
        M.dot(x, px, py, 9, col, c.ink);
        const lab = avg ? "AI 평균 버전" : inside ? "비튼 버전" : "약속을 어긴 버전";
        M.tag(x, lab, px + 14, py, { size: 12, fill: M.alpha(col, 0.25) });
        T(x, "익숙함", cx - R + 12, cy + R + 20, { color: c.muted, weight: 600 });
        T(x, "신선함 →", cx + R - 12, cy + R + 20, { align: "right", color: c.muted, weight: 600 });
      }
      function mystery(x, c, w, h) {
        const br = an.br, ok = br < 0.5;
        head(x, c, w, "미스터리 · 공정한 단서로 풀 수 있는 해답", ok, "공정: 독자도 풀 수 있었다", "뒷북: 독자는 풀 기회가 없었다");
        const gx = 28, gw = w - 60, ty = h * 0.58;
        const X = (e) => gx + ((e - 1) / 11) * gw;
        M.line(x, gx, ty, gx + gw, ty, c.ink, 1.5);
        for (let e = 1; e <= 12; e++) { M.line(x, X(e), ty - 4, X(e), ty + 4, c.ink, 1); T(x, e + "화", X(e), ty + 20, { align: "center", color: c.muted }); }
        box(x, X(11.6), 40, X(12) - X(11.6) + 22, ty - 30, 6, M.alpha(c.key, 0.28));
        T(x, "해결 장면", X(12) + 4, 54, { align: "right", weight: 700, color: c.ink });
        const CL = [[2, "왼손잡이", 1, 0], [5, "멈춘 시계", 1, 1], [6, "협박 편지", 0, 0], [9, "젖은 우산", 1, 1]];
        CL.forEach(([e, lab, real, up], i) => {
          let ee = e;
          if (i === 1) ee = M.lerp(5, 11.8, br);
          const px = X(ee), py = ty - 42 - (up ? 34 : 0) - (i === 1 ? br * 20 : 0);
          M.line(x, px, py, px, ty, M.alpha(c.ink, 0.5), 1, [2, 3]);
          const late = i === 1 && br > 0.5;
          M.dot(x, px, py, 8, real ? (late ? c.b : c.c) : M.alpha(c.b, 0.6), c.ink);
          M.tag(x, late ? "뒷북 단서" : lab, px, py - 22, { align: "center", size: 12, fill: M.alpha(real ? (late ? c.b : c.c) : c.b, 0.2) });
        });
        // 공정성 칸
        const fy = ty + 50;
        T(x, "해결 전에 나온 필수 단서", gx, fy + 4, { weight: 700, color: c.ink });
        font(x, 12, 700); const sx = gx + x.measureText("해결 전에 나온 필수 단서").width + 14;
        [0, 1, 2].forEach((k) => { const on = !(k === 1 && br > 0.5); box(x, sx + k * 30, fy - 9, 24, 18, 5, on ? M.alpha(c.c, 0.7) : null, on ? c.ink : c.b, 1.5); });
        T(x, br > 0.5 ? "2 / 3" : "3 / 3", sx + 96, fy + 4, { mono: true, weight: 700, color: c.ink });
        M.dot(x, gx + 6, fy + 34, 6, c.c, c.ink); T(x, "진짜 단서", gx + 18, fy + 38, { color: c.ink2 });
        M.dot(x, gx + 106, fy + 34, 6, M.alpha(c.b, 0.6), c.ink); T(x, "가짜 단서", gx + 118, fy + 38, { color: c.ink2 });
      }
      function romance(x, c, w, h) {
        const br = an.br;
        head(x, c, w, "로맨스 · 관계가 중심, 희망적 결말", br < 0.5, "끝점이 HEA·HFN 구역 안", "끝점이 구역 밖: 약속 위반");
        const gx = 40, gw = w - 70, gy = 50, gh = h - gy - 40;
        const X = (e) => gx + ((e - 1) / 11) * gw, Y = (v) => gy + gh / 2 - (v / 5.6) * (gh / 2);
        box(x, X(11.3), Y(5.4), X(12) - X(11.3) + 18, Y(1.6) - Y(5.4), 8, M.alpha(c.c, 0.2), c.c, 1.2);
        T(x, "HEA / HFN", X(12) + 14, Y(5.4) - 6, { align: "right", weight: 700, color: c.ink });
        M.line(x, gx, Y(0), gx + gw, Y(0), c.line2, 1, [3, 4]);
        T(x, "+5", gx - 8, Y(5) + 4, { align: "right", mono: true, color: c.muted }); T(x, "−5", gx - 8, Y(-5) + 4, { align: "right", mono: true, color: c.muted });
        for (let e = 1; e <= 12; e++) T(x, String(e), X(e), gy + gh + 16, { align: "center", mono: true, color: c.muted });
        const A = [-1, -2, 0, 2, 1, 3, 4, 1, -2, -4, 1, 4], B = [-1, -2, 0, 2, 1, 3, 4, 1, -2, -4, -3, -4.5];
        const v = (i) => M.lerp(A[i], B[i], br);
        x.strokeStyle = c.b; x.lineWidth = 2.6; x.beginPath();
        A.forEach((_, i) => (i ? x.lineTo(X(i + 1), Y(v(i))) : x.moveTo(X(1), Y(v(0))))); x.stroke();
        A.forEach((_, i) => M.dot(x, X(i + 1), Y(v(i)), i === 11 ? 7 : 3, i === 11 ? (br > 0.5 ? c.b : c.c) : c.b, c.ink));
        T(x, "관계 감정", gx, gy - 8, { weight: 700, color: c.b });
        M.tag(x, "위기: 거짓 믿음", X(10), Y(-4) + 22, { align: "center", size: 12 });
      }
      function game(x, c, w, h) {
        const br = an.br;
        head(x, c, w, "게임판타지 · 숫자로 보이는 성장", br < 0.5, "계단마다 성장과 새 제약", "3화에 최강: 성장할 곳이 없다");
        const gx = 40, gw = w - 80, gy = 54, gh = h - gy - 40;
        const X = (e) => gx + ((e - 1) / 11) * gw, Y = (v) => gy + gh - (v / 100) * gh;
        const LV = [[1, 1], [3, 4], [6, 9], [9, 15], [11, 24]];
        const lvA = (e) => { let l = 1; for (const [k, v] of LV) if (e >= k) l = v; return l; };
        const lvB = (e) => (e >= 3 ? 99 : 1);
        const lv = (e) => M.lerp(lvA(e), lvB(e), br);
        const sc = (l) => Math.min(100, l * 3.6);
        M.line(x, gx, gy + gh, gx + gw, gy + gh, c.ink, 1.2);
        for (let e = 1; e <= 12; e++) T(x, e + "화", X(e), gy + gh + 16, { align: "center", color: c.muted });
        x.strokeStyle = c.a; x.lineWidth = 3; x.beginPath();
        for (let e = 1; e <= 12; e += 0.02) { const v = sc(lv(Math.floor(e))); e === 1 ? x.moveTo(X(e), Y(v)) : x.lineTo(X(e), Y(v)); }
        x.stroke();
        const CON = ["", "물약 부족", "동료 필요", "봉인 구역", "대가 큰 스킬"];
        LV.forEach(([e, l], k) => {
          if (k === 0) return;
          x.save(); x.globalAlpha = 1 - br;
          const last = k === LV.length - 1;
          M.tag(x, `Lv ${l}`, last ? X(12) : X(e) + 4, Y(sc(l)) - 14, { align: last ? "right" : "left", size: 12, fill: M.alpha(c.a, 0.2) });
          if (gw > 380) T(x, "새 제약: " + CON[k], last ? X(12) : X(e) + 6, Y(sc(l)) + 18, { align: last ? "right" : "left", color: c.muted, weight: 600 });
          x.restore();
        });
        x.save(); x.globalAlpha = br;
        M.tag(x, "Lv 99", X(3) + 4, Y(100) + 16, { size: 12, fill: M.alpha(c.b, 0.25) });
        x.restore();
      }
      function sf(x, c, w, h, t) {
        const br = an.br;
        head(x, c, w, "SF · 노붐이 번지는 결과", br < 0.5, "경제 → 법 → 한 사람", "첫 고리에서 멈춤: 사람이 없다");
        const nar = w < 520, Rm = nar ? Math.min(w * 0.42, h * 0.28) : Math.min(w * 0.3, h * 0.4);
        const cx = nar ? w / 2 : Math.max(Rm + 12, w * 0.5 - Rm * 0.55), cy = nar ? 50 + Rm : h / 2 + 14;
        const rings = [[0.42, "경제", "잠 시장이 생긴다"], [0.7, "법", "수면 노동 계약"], [0.98, "한 사람", "잠을 판 어머니"]];
        const reach = M.lerp(1, 0.42, br);
        // 파문
        for (let k = 0; k < 3; k++) {
          const p = ((t / 2600 + k / 3) % 1), rr = p * reach * Rm;
          x.save(); x.globalAlpha = (1 - p) * 0.6; x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.strokeStyle = c.ch7; x.lineWidth = 2; x.stroke(); x.restore();
        }
        rings.forEach(([f, lab, sub], k) => {
          const on = f <= reach + 0.01;
          x.save(); x.globalAlpha = on ? 1 : 0.4;
          x.beginPath(); x.arc(cx, cy, f * Rm, 0, Math.PI * 2); x.strokeStyle = on ? c.ink : c.line2; x.lineWidth = 1.2; if (!on) x.setLineDash([4, 4]); x.stroke(); x.setLineDash([]);
          const ly = cy - Rm * 0.55 + k * Rm * 0.55, a = Math.asin(M.clamp((ly - cy) / (f * Rm), -1, 1));
          const px = cx + Math.cos(a) * f * Rm, py = cy + Math.sin(a) * f * Rm;
          const txt = on ? `${lab}: ${sub}` : `${lab}: ?`;
          if (w >= 520) M.callout(x, txt, px, py, cx + Rm + 16, ly, { align: "left", size: 12, fill: on ? M.alpha(c.ch7, 0.2) : null });
          else { M.tag(x, `${k + 1}  ${txt}`, 12, cy + Rm + 26 + k * 28, { size: 12, fill: on ? M.alpha(c.ch7, 0.2) : null }); }
          M.dot(x, px, py, w >= 520 ? 6 : 8, on ? c.ch7 : c.surface, c.ink);
          if (w < 520) T(x, String(k + 1), px, py + 4, { align: "center", weight: 700, color: c.ink });
          x.restore();
        });
        box(x, cx - 52, cy - 22, 104, 44, 22, c.surface, c.ink, 1.5);
        T(x, "잠을 사고파는", cx, cy - 3, { align: "center", weight: 700, color: c.ink });
        T(x, "도시", cx, cy + 13, { align: "center", weight: 700, color: c.ink });
      }
      function venn(x, c, w, h) {
        const R = Math.min(w * 0.27, h * 0.36), cy = h / 2 + 18, cxA = w / 2 - R * 0.58, cxB = w / 2 + R * 0.58;
        head(x, c, w, "미스터리 + 로맨스 · 클라이맥스 후보", true, `주 장르: ${mainG ? "로맨스" : "미스터리"}`, "");
        const m = an.main;
        [[cxA, "미스터리: 공정한 해답", c.a, 0], [cxB, "로맨스: 관계의 결실", c.ch4, 1]].forEach(([cx, lab, col, k]) => {
          const isMain = (k === 1) === (mainG === 1);
          box(x, cx - R, cy - R, R * 2, R * 2, R, M.alpha(col, isMain ? 0.16 : 0.06), c.ink, isMain ? 2.6 : 1);
          T(x, lab + (isMain ? " (주)" : ""), cx + (k ? R * 0.25 : -R * 0.25), cy - R - 10, { align: "center", weight: 700, color: isMain ? c.ink : c.muted });
        });
        const C3 = [
          [w / 2, cy, "A 고백이 단서를 연다", "both"],
          [cxB + R * 0.45, cy + R * 0.42, "B 고백이 해답을 덮는다", "rom"],
          [cxA - R * 0.42, cy - R * 0.3, "C 범인만, 관계는 잊힘", "mys"],
        ];
        C3.forEach(([px, py, lab, where], i) => {
          const alive = where === "both" || (where === "mys" && mainG === 0) || (where === "rom" && mainG === 1);
          const best = where === "both";
          x.save(); x.globalAlpha = alive ? 1 : 0.45;
          M.dot(x, px, py, 8, best ? c.c : alive ? c.key : c.surface, c.ink);
          font(x, 12, 600); const tw = x.measureText(lab).width + 16;
          let lx = px, ly = py + 24, al = "center";
          if (i === 1 && px + 13 + tw < w - 6) { lx = px + 13; ly = py; al = "left"; }
          else if (i === 2 && px - 13 - tw > 6) { lx = px - 13; ly = py; al = "right"; }
          else if (i === 2) ly = py - 22;
          if (al === "center") lx = M.clamp(lx, tw / 2 + 4, w - tw / 2 - 4);
          const tg = M.tag(x, lab, lx, ly, { align: al, size: 12, fill: best ? M.alpha(c.c, 0.25) : null });
          if (!alive) { M.line(x, tg.x, tg.y + tg.h / 2, tg.x + tg.w, tg.y + tg.h / 2, c.b, 2); }
          x.restore();
        });
        T(x, "1순위: 겹치는 장면 · 2순위: 주 장르 안의 장면", w / 2, h - 10, { align: "center", color: c.muted, weight: 600 });
      }
      const DRAW = [map, mystery, romance, game, sf, venn];
      return {
        setStep(s) {
          step = s; broken = false; bc.set(false);
          twist = 0.75; sl.set(0.75);
          vis(); prose();
        },
        frame(t, dt) {
          const c = C(), { x, w, h } = S.fit();
          an.tw = follow(an.tw, twist, dt, 300); an.br = follow(an.br, broken ? 1 : 0, dt, 420); an.main = follow(an.main, mainG, dt, 300);
          DRAW[step](x, c, w, h, t);
        },
      };
    },
  });
})();
