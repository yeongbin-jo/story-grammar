/* 0~2장: 이야기의 엔진 · 인물 · 구조
   예시는 이 강의를 위해 지어낸 이야기(시장 골목 빵집의 제빵사 '준')와 널리 알려진 작품의 일반적 언급만 씁니다. */
(() => {
  /* ---------- 공용 도우미 ---------- */
  const follow = (cur, tgt, dt, ms = 300) => cur + (tgt - cur) * (1 - Math.pow(0.004, (dt || 16) / ms));
  /* CSS 변수 읽기 (테마가 바뀌면 M.col() 객체가 새로 만들어지므로 그때 캐시를 비움) */
  let vKey = null, vCache = {};
  const V = (n) => {
    const k = M.col();
    if (k !== vKey) { vKey = k; vCache = {}; }
    if (!(n in vCache)) vCache[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return vCache[n];
  };
  /* 한국어 줄바꿈: 띄어쓰기 단위, 너무 긴 낱말은 글자 단위 */
  const wrap = (x, s, maxW) => {
    const out = []; let line = "";
    for (const w of s.split(" ")) {
      const t = line ? line + " " + w : w;
      if (x.measureText(t).width <= maxW || !line) {
        if (x.measureText(t).width > maxW && !line) {
          let buf = "";
          for (const ch of w) { if (x.measureText(buf + ch).width > maxW && buf) { out.push(buf); buf = ch; } else buf += ch; }
          line = buf;
        } else line = t;
      } else { out.push(line); line = w; }
    }
    if (line) out.push(line);
    return out;
  };
  /* 여러 줄 글자. 반환: 그린 줄 수 */
  const para = (x, s, px, py, maxW, o = {}) => {
    const size = o.size || 13, lh = o.lh || Math.round(size * 1.45);
    x.font = M.font(size, "ui", o.weight || 500);
    const lines = wrap(x, s, maxW);
    lines.forEach((ln, i) => M.text(x, ln, px, py + i * lh, { size, weight: o.weight || 500, color: o.color, align: o.align }));
    return lines.length;
  };
  /* 사이트 말투의 카드: 진한 테두리 + 오프셋 그림자 */
  const card = (x, px, py, w, h, o = {}) => {
    const c = M.col(), r = o.r ?? 10;
    x.save();
    if (o.shadow !== false) { M.rrect(x, px + 2, py + 2.5, w, h, r); x.fillStyle = c.ink; x.globalAlpha = o.alpha ?? 1; x.fill(); }
    M.rrect(x, px, py, w, h, r); x.fillStyle = c.surface; x.fill();
    if (o.fill) { x.fillStyle = o.fill; x.fill(); }
    x.lineWidth = o.lw || 1; x.strokeStyle = o.stroke || c.ink; if (o.dash) x.setLineDash(o.dash); x.stroke();
    x.restore();
  };
  /* 표면색에 색을 t 만큼 섞은 불투명 색 */
  const hx = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((q) => q + q).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const tint = (col, t, base) => {
    const a = hx(base || M.col().surface), b = hx(col);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
  };
  const isNarrow = (w) => w < 560;
  /* 좁은 화면(폰)에서는 캔버스를 세로로 길게: 페이지가 세로로 스크롤됨 */
  const tall = (cv, px) => { if (matchMedia("(max-width: 600px)").matches) cv.style.minHeight = px + "px"; };
  /* 단조 3차 보간(Fritsch–Carlson): keys = [[t, v], ...] → 출렁임 없이 부드러운 곡선 */
  const TAN = new WeakMap();
  const mono = (keys, t) => {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let m = TAN.get(keys);
    if (!m) {
      const d = []; for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
      m = [d[0]]; for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
      for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b; if (q > 9) { const k = 3 / Math.sqrt(q); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; } }
      TAN.set(keys, m);
    }
    let i = 0; while (t > keys[i + 1][0]) i++;
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1], hh = t1 - t0, u = (t - t0) / hh;
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    return h00 * v0 + h10 * hh * m[i] + h01 * v1 + h11 * hh * m[i + 1];
  };

  /* =====================================================================
     0-1 스토리와 플롯
     ===================================================================== */
  LESSONS.push({
    id: "story-plot", ch: 0, order: 1,
    title: "스토리와 플롯",
    lede: "이 레슨을 마치면 '일어난 일'(스토리)과 '독자에게 보여 주는 순서'(플롯)를 나눠 보고, 사건을 인과로 잇는 법을 알게 됩니다. 같은 사건으로도 플롯은 여러 개 만들 수 있습니다.",
    key: "플롯은 '그리고'가 아니라 '그래서·그런데'로 이어집니다. 같은 스토리라도 무엇을 먼저 보여 주느냐에 따라 독자가 품는 질문이 달라집니다.",
    steps: [
      ["그리고만 있으면 일지", "아래 줄의 카드 다섯 장은 준의 하루입니다. 사이를 잇는 말이 모두 <b>'그리고'</b>라서, 한 사건이 다음 사건을 일으키지 않습니다. 순서를 바꿔도 아무 일이 없으니 독자에게 궁금한 것도 생기지 않습니다. 이것은 플롯이 아니라 <b>일지</b>입니다."],
      ["그래서·그런데로 잇기", "사건을 바꿔 <b>앞 사건이 뒤 사건의 원인</b>이 되게 했습니다. 초록 '그래서'는 결과를, 주황 '그런데'는 예상을 꺾는 장애를 잇습니다. 포스터의 유명한 구분처럼 \"왕이 죽고 왕비가 죽었다\"는 나열이고, \"왕이 죽자 슬픔에 왕비가 죽었다\"는 플롯입니다. 이제 아래 상자에 독자의 질문이 생겼습니다."],
      ["스토리: 일어난 순서", "위 줄(호박색 테두리)이 <b>스토리</b>, 곧 세계 안에서 일이 일어난 시간 순서입니다. 지금은 아래 줄(플롯)도 같은 순서라 둘을 잇는 선이 곧게 내려갑니다. 스토리는 하나로 정해져 있고, 작가가 고르는 것은 그것을 <b>보여 줄 순서와 방식</b>입니다."],
      ["플롯 1: 발견에서 시작", "플롯을 <b>빈 금고를 발견한 아침</b>부터 시작하고, 전날 밤 일은 맨 끝에 '회상'으로 밝힙니다. 위아래를 잇는 선이 엇갈린 만큼 플롯이 스토리와 다릅니다. 독자는 준과 똑같이 범인을 모르므로 <b>\"누가 열었지?\"</b>라는 호기심으로 따라옵니다. 미스터리가 흔히 쓰는 순서입니다."],
      ["플롯 2: 프롤로그로 먼저", "이번엔 전날 밤 장면을 <b>프롤로그</b>로 먼저 보여 주면서 금고를 연 사람이 동생이라는 것까지 드러냅니다. 독자가 준보다 많이 알게 되어(오른쪽 막대), 질문이 \"누가?\"에서 <b>\"준은 언제 알아챌까?\"</b>로 바뀝니다. 사건은 하나도 바꾸지 않았는데 긴장의 종류가 달라졌습니다."],
    ],
    terms: [
      ["스토리", "Story", "이야기 세계 안에서 일어난 사건 전체를 시간순으로 놓은 것. \"무슨 일이 있었나?\"에 대한 답입니다."],
      ["플롯", "Plot", "그 사건들을 독자에게 어떤 순서와 방식으로 보여 줄지 정한 설계. 사건 사이가 인과('그래서', '그런데')로 이어집니다."],
      ["인과", "Causality", "앞 사건이 뒤 사건을 일으키는 관계. 사건 사이에 '그래서/그런데'를 넣어 읽어 보면 인과가 있는지 바로 드러납니다."],
      ["프롤로그", "Prologue", "본 이야기 앞에 따로 두는 장면. 시간이나 시점을 비켜서 독자에게 주인공보다 먼저 정보를 줄 때 자주 씁니다."],
    ],
    mount(api) {
      const COLS = ["--ch0", "--ch1", "--ch2", "--ch3", "--ch4"];
      const TIME = ["전날 밤", "아침", "오전", "오후", "저녁"];
      const LOG = { short: ["빵 굽기", "손님", "비", "동생 방문", "문 닫기"], text: ["새벽, 준이 빵을 굽는다", "가게에 손님이 몇 명 온다", "오후에 비가 내린다", "동생이 들러 수다를 떤다", "준이 가게 문을 닫는다"], time: ["새벽", "오전", "오후", "오후", "저녁"] };
      const EV = { short: ["금고가 열림", "빈 금고", "직접 조사", "열쇠 발견", "동생의 열쇠"], text: ["밤 11시, 누군가 빵집 금고를 연다", "아침, 준이 텅 빈 금고를 발견한다", "준은 경찰 대신 직접 범인을 찾기로 한다", "단골손님 주머니에서 금고 열쇠가 나온다", "그 열쇠는 동생이 맡겨 둔 것이었다"], time: TIME };
      const PROLOGUE = "밤 11시, 준의 동생이 몰래 금고를 연다";
      /* 플롯 순서: 화면 칸 → 사건 번호 */
      const ORDER = { chrono: [0, 1, 2, 3, 4], mystery: [1, 2, 3, 4, 0], prologue: [0, 1, 2, 3, 4] };
      const LINKS = {
        log: [["그리고", ""], ["그리고", ""], ["그리고", ""], ["그리고", ""]],
        chrono: [["그래서", "so"], ["그래서", "so"], ["그런데", "but"], ["그런데", "but"]],
        mystery: [["그래서", "so"], ["그런데", "but"], ["그런데", "but"], ["되짚으면", "back"]],
        prologue: [["그래서", "so"], ["그래서", "so"], ["그런데", "but"], ["그런데", "but"]],
      };
      const Q = {
        log: ["독자의 질문: (없음)", "다음 사건이 앞 사건과 상관이 없어 궁금한 것이 생기지 않습니다.", 0, 0],
        chrono: ["독자의 질문: \"그래서 누가 열었는데?\"", "사건이 서로를 밀어서 다음 장면을 기다리게 됩니다.", 0, 0],
        mystery: ["독자의 질문: \"누가 금고를 열었지?\"", "호기심 · 독자와 준이 똑같이 모른 채 함께 찾습니다.", 0, 0],
        prologue: ["독자의 질문: \"준은 언제 알아챌까?\"", "서스펜스 · 독자가 주인공보다 먼저 압니다.", 1, 0],
      };

      const root = M.el("div", { class: "dom-stage core-sp" });
      const wires = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      wires.setAttribute("class", "core-sp__wires");
      const paths = COLS.map((v) => { const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("fill", "none"); p.setAttribute("stroke", `var(${v})`); p.setAttribute("stroke-width", "2"); p.setAttribute("stroke-linecap", "round"); wires.append(p); return p; });

      const storyLane = M.el("div", { class: "core-sp__lane" }, M.el("p", { class: "core-eyebrow", html: "<b>스토리</b> · 세계 안에서 일어난 순서" }));
      const axis = M.el("div", { class: "core-sp__axis" });
      const chips = [0, 1, 2, 3, 4].map((i) => {
        const tx = M.el("span", { class: "tx" }, M.el("small"), M.el("span"));
        const ch = M.el("div", { class: "core-sp__chip", style: `--ev: var(${COLS[i]})` }, M.el("span", { class: "n" }, String(i + 1)), tx);
        axis.append(ch); return ch;
      });
      storyLane.append(axis);

      const plotLane = M.el("div", { class: "core-sp__lane" }, M.el("p", { class: "core-eyebrow", html: "<b>플롯</b> · 독자가 보는 순서" }));
      const plot = M.el("div", { class: "core-sp__plot" });
      const cards = [0, 1, 2, 3, 4].map((i) => {
        const c = M.el("div", { class: "core-sp__card", style: `--ev: var(${COLS[i]}); --slot: ${i}` }, M.el("span", { class: "n" }, String(i + 1)), M.el("span", { class: "tag" }), M.el("span", { class: "tx" }));
        plot.append(c); return c;
      });
      const links = M.el("div", { class: "core-sp__links" });
      const linkEls = [0, 1, 2, 3].map((k) => { const s = M.el("span"); links.append(M.el("div", { class: "core-sp__link", style: `grid-column: ${k + 1}` }, s)); return s; });
      plotLane.append(plot, links);

      const qt = M.el("p", { class: "core-sp__qt" }), qs = M.el("p", { class: "core-sp__qs" });
      const barR = M.el("b"), barJ = M.el("b");
      const know = M.el("div", { class: "core-sp__know" }, M.el("span", {}, "독자가 아는 범인"), M.el("i", {}, barR), M.el("span", {}, "준이 아는 범인"), M.el("i", {}, barJ));
      const qbox = M.el("div", { class: "core-sp__q core-card" }, M.el("div", {}, qt, qs), know);
      root.append(wires, storyLane, plotLane, qbox);
      api.stage.append(root);

      let mode = "log", order = "chrono", step = 0;
      const modeChips = M.chips(api.controls, { title: "사건 잇기", items: ["일지 (그리고)", "인과 (그래서·그런데)"], value: 0, onPick: (i) => { mode = i ? "cause" : "log"; if (mode === "log") { order = "chrono"; orderChips.set(0); } render(); } });
      const orderChips = M.chips(api.controls, { title: "플롯 순서", items: ["시간순", "발견부터", "프롤로그 먼저"], value: 0, onPick: (i) => { order = ["chrono", "mystery", "prologue"][i]; if (mode === "log") { mode = "cause"; modeChips.set(1); } render(); } });
      api.controls.append(M.el("p", { class: "hint" }, "플롯 순서를 바꾸면 위 줄(스토리)은 그대로이고 아래 카드만 자리를 옮깁니다. 엇갈리는 선의 수가 스토리와 플롯의 거리입니다."));

      let lastKey = "";
      function render() {
        const D = mode === "log" ? LOG : EV, ord = ORDER[order];
        chips.forEach((c, i) => { c.querySelector("small").textContent = D.time[i]; c.querySelector(".tx > span").textContent = D.short[i]; });
        const key = mode + order;
        cards.forEach((c, i) => {
          const slot = ord.indexOf(i);
          c.style.setProperty("--slot", slot);
          let txt = D.text[i], tag = "";
          if (mode === "cause" && i === 0 && order === "prologue") { txt = PROLOGUE; tag = "프롤로그"; }
          if (mode === "cause" && i === 0 && order === "mystery") tag = "회상";
          const tx = c.querySelector(".tx"), tg = c.querySelector(".tag");
          if (tx.textContent !== txt) { tx.textContent = txt; c.classList.remove("swap"); void c.offsetWidth; c.classList.add("swap"); }
          tg.textContent = tag; tg.style.display = tag ? "" : "none";
        });
        const L = mode === "log" ? LINKS.log : LINKS[order];
        linkEls.forEach((s, k) => { s.textContent = L[k][0] + " →"; s.className = L[k][1]; });
        const q = mode === "log" ? Q.log : Q[order];
        qt.textContent = q[0]; qs.textContent = q[1];
        barR.style.width = (mode === "cause" && order === "prologue" ? 100 : mode === "cause" && order === "mystery" ? 0 : 0) + "%";
        barJ.style.width = "0%";
        know.style.opacity = mode === "log" ? 0.35 : 1;
        storyLane.classList.toggle("is-hot", step === 2);
        plotLane.classList.toggle("is-hot", step >= 3);
        if (key !== lastKey) lastKey = key;
        sizePlot();
      }
      function sizePlot() {
        let h = 0; cards.forEach((c) => (h = Math.max(h, c.offsetHeight)));
        plot.style.height = h + "px";
      }
      const ro = new ResizeObserver(sizePlot); ro.observe(plot);

      const PRESET = [["log", "chrono"], ["cause", "chrono"], ["cause", "chrono"], ["cause", "mystery"], ["cause", "prologue"]];
      return {
        setStep(s) {
          step = s; [mode, order] = PRESET[s];
          modeChips.set(mode === "log" ? 0 : 1); orderChips.set(["chrono", "mystery", "prologue"].indexOf(order));
          render();
        },
        frame() {
          /* 스토리 칩 아래 → 플롯 카드 위를 잇는 선 */
          const R = root.getBoundingClientRect();
          chips.forEach((ch, i) => {
            const a = ch.getBoundingClientRect(), b = cards[i].getBoundingClientRect();
            const x0 = a.left + a.width / 2 - R.left, y0 = a.bottom - R.top;
            const x1 = b.left + b.width / 2 - R.left, y1 = b.top - R.top;
            const m = (y0 + y1) / 2;
            paths[i].setAttribute("d", `M${x0},${y0} C${x0},${m} ${x1},${m} ${x1},${y1}`);
          });
        },
        destroy() { ro.disconnect(); },
      };
    },
  });

  /* =====================================================================
     0-2 로그라인
     ===================================================================== */
  LESSONS.push({
    id: "logline", ch: 0, order: 2,
    title: "로그라인 한 문장",
    lede: "이 레슨을 마치면 인물·욕망·장애·대가 네 칸으로 이야기를 한 문장에 담고, 어느 칸이 비었거나 흐린지 찾아내는 법을 알게 됩니다.",
    key: "[인물]이 [욕망]을 이루려 하지만 [장애]가 막고, 실패하면 [대가]를 잃는다. 네 칸이 다 차고 구체적이며, 인물과 상황이 어긋날 때 문장이 질문을 남깁니다.",
    steps: [
      ["전제는 아직 이야기가 아니다", "맨 위 한 줄이 <b>전제</b>(\"만약 ~라면?\")입니다. 흥미로운 씨앗이지만 누가 무엇을 하려는지가 없어서, 가운데 문장의 네 칸이 모두 빨간 점선 <b>빈칸</b>입니다. 긴장 막대도 0이고, 독자는 \"누구 이야기야?\"부터 묻습니다."],
      ["인물과 욕망", "인물 칸에 <b>처지가 보이는 사람</b>(시장 골목 빵집의 청년 제빵사)을, 욕망 칸에 <b>눈에 보이는 목표</b>(석 달 뒤 전국 제빵 대회 우승)를 넣었습니다. '꿈을 이룬다'처럼 흐린 목표는 장면으로 찍을 수 없으니, 이뤘는지 판정할 수 있는 말로 씁니다. 그래도 독자는 \"그냥 하면 되잖아?\"라고 묻습니다."],
      ["장애물", "<b>장애</b> 칸이 찼습니다. 가게 자리를 노리는 프랜차이즈 대표가 심사위원장입니다. 장애물은 <b>의지를 가지고 막거나 구조적으로 피할 수 없어야</b> 합니다. 비가 와서 늦는 것은 장애가 아니라 사고입니다."],
      ["대가", "마지막 칸 <b>대가</b>는 실패하면 잃는 것, 곧 스테이크입니다. 지면 할머니가 40년 지킨 가게를 넘겨야 합니다. 네 칸이 모두 구체적이 되자 독자 반응이 <b>\"그래서 어떻게 되는데?\"</b>로 바뀌었습니다. 좋은 로그라인이 남기는 질문입니다."],
      ["아이러니", "인물 칸 하나만 바꿨습니다. 제빵사가 <b>사고로 미각을 잃었습니다</b>. 맛을 봐야 이기는 대회에 맛을 못 보는 사람이 나가니, 인물과 상황이 어긋나는 <b>아이러니</b> 칸이 켜지고 긴장이 한 번 더 올라갑니다. 물을 무서워하는 경찰서장이 상어를 잡아야 하는 〈죠스〉가 같은 구조입니다."],
      ["고치기 전 / 고친 후", "왼쪽은 네 칸이 다 있지만 모두 <b>흐린</b> 문장, 오른쪽은 지금까지 고친 문장입니다. 칸의 수가 아니라 <b>구체성</b>이 차이를 만듭니다. 오른쪽 '직접 해보기'에서 칸을 바꾸면 오른쪽 문장만 바뀌니, 한 칸씩 흐리게 되돌려 어디서 긴장이 가장 크게 빠지는지 보세요."],
    ],
    terms: [
      ["전제", "Premise", "이야기가 출발하는 상황과 가능성. 흔히 \"만약 ~라면?\"으로 씁니다. 인물과 욕망이 붙어야 이야기가 됩니다."],
      ["로그라인", "Logline", "작품을 인물·욕망·장애·대가가 들어간 한두 문장으로 줄인 것. 영화 업계에서 시나리오를 한 줄로 소개하던 형식에서 왔습니다."],
      ["욕망", "Want", "인물이 의식적으로 쫓는 구체적 목표. 이뤘는지 아닌지 판정할 수 있어야 합니다."],
      ["스테이크", "Stakes", "실패하면 잃는 것. 독자는 사건 자체보다 잃을 수 있는 것에 반응합니다."],
      ["아이러니", "Irony", "인물과 상황이 어긋나는 것. 로그라인에 아이러니가 있으면 읽는 사람이 \"그래서 어떻게?\"를 묻게 됩니다."],
    ],
    mount(api) {
      const SLOTS = [
        { k: "who", name: "인물", col: "--ch0", hole: "누가?", opts: [null, ["한 청년이", 1], ["시장 골목 빵집의 청년 제빵사 준이", 2], ["사고로 미각을 잃은 제빵사 준이", 3]] },
        { k: "want", name: "욕망", col: "--ch2", hole: "무엇을 원하나?", opts: [null, ["꿈을 이루려 하지만", 1], ["석 달 뒤 전국 제빵 대회에서 우승하려 하지만", 2]] },
        { k: "obs", name: "장애", col: "--ch3", hole: "무엇이 막나?", opts: [null, ["여러 어려움이 막고", 1], ["가게 자리를 노리는 프랜차이즈 대표가 심사위원장으로 앉아 있고", 2]] },
        { k: "cost", name: "대가", col: "--ch8", hole: "지면 무엇을 잃나?", opts: [null, ["실패하면 아쉬움이 남는다", 1], ["지면 할머니가 40년 지킨 가게를 넘겨야 한다", 2]] },
      ];
      const QN = ["빈칸", "흐림", "구체", "아이러니"];
      const DESC = { who: "누구인가, 처지가 보이게", want: "눈에 보이는 목표", obs: "정면으로 막는 힘", cost: "실패하면 잃는 것" };
      const root = M.el("div", { class: "dom-stage core-ll" });
      const premise = M.el("p", { class: "core-ll__premise", html: "전제 · <b>만약 제빵사가 맛을 느끼지 못하게 된다면?</b>" });
      const slotRow = M.el("div", { class: "core-ll__slots" });
      const slotEls = SLOTS.map((s) => {
        const q = M.el("span", { class: "core-ll__q" });
        const e = M.el("div", { class: "core-ll__slot", style: `--sl: var(${s.col})` }, M.el("h4", {}, s.name, q), M.el("p", {}, DESC[s.k]));
        slotRow.append(e); return { e, q };
      });
      const body = M.el("div", { class: "core-ll__body" });
      const mk = (before) => {
        const stamp = M.el("span", { class: "core-ll__stamp" });
        const eb = M.el("p", { class: "core-eyebrow" }, M.el("b", {}, "로그라인"), stamp);
        const text = M.el("p", { class: "core-ll__text" });
        const fill = M.el("i"), num = M.el("span", { class: "core-ll__num" });
        const score = M.el("div", { class: "core-ll__score" }, M.el("b", {}, "긴장"), M.el("div", { class: "core-ll__gauge" }, fill), num);
        const chk = M.el("div", { class: "core-ll__checks" });
        const checks = ["네 칸이 다 있다", "구체적이다", "아이러니가 있다", "질문을 남긴다"].map((t) => { const s = M.el("span", {}, t); chk.append(s); return s; });
        const bubble = M.el("span", { class: "core-ll__bubble" });
        const reader = M.el("div", { class: "core-ll__reader" }, M.el("em", {}, "독자"), bubble);
        const box = M.el("div", { class: "core-ll__sent core-card" + (before ? " is-before" : "") }, eb, text, score, chk, reader);
        return { box, stamp, text, fill, num, checks, bubble };
      };
      const before = mk(true), after = mk(false);
      body.append(after.box);
      root.append(premise, slotRow, body);
      api.stage.append(root);

      let sel = [0, 0, 0, 0], step = 0, prevSel = null;
      const ctl = SLOTS.map((s, i) => M.chips(api.controls, {
        title: s.name, items: s.opts.map((o, j) => QN[o ? o[1] : 0] + (j === 3 ? "" : "")).map((t, j) => (j === 0 ? "빈칸" : t)),
        value: 0, onPick: (j) => { sel[i] = j; render(); },
      }));

      function evaluate(sl) {
        const q = sl.map((j, i) => (SLOTS[i].opts[j] ? SLOTS[i].opts[j][1] : 0));
        const full = q.every((v) => v > 0), concrete = q.every((v) => v >= 2);
        const irony = q[0] === 3 && q[1] === 2, question = full && q[2] >= 2 && q[3] >= 2;
        const per = q.map((v) => (v === 0 ? 0 : v === 1 ? 0.3 : 1));
        let score = (per.reduce((a, b) => a + b, 0) / 4) * (full ? 0.85 : 0.55) + (irony ? 0.15 : 0);
        score = Math.round(score * 100);
        let say;
        const miss = q.findIndex((v) => v === 0);
        if (miss === 0) say = q.every((v) => v === 0) ? "누구 이야기야? 아직 설정만 있네." : "그래서 누구 이야기야?";
        else if (miss === 1) say = "그래서 뭘 하려는 건데?";
        else if (miss === 2) say = "그냥 하면 되잖아? 뭐가 어려운데?";
        else if (miss === 3) say = "지면 뭐 어때서?";
        else if (!concrete) say = "말은 되는데… 구체적으로 뭔데?";
        else if (irony) say = "맛을 못 보는데 대회에서 이긴다고? 어떻게?";
        else say = "그래서 어떻게 되는데?";
        return { q, full, concrete, irony, question, score, say };
      }
      function paint(view, sl, prev) {
        const ev = evaluate(sl);
        view.text.innerHTML = "";
        SLOTS.forEach((s, i) => {
          const o = s.opts[sl[i]];
          const sp = o ? M.el("span", { style: `--sl: var(${s.col})`, class: o[1] === 1 ? "vague" : "" }, o[0]) : M.el("span", { class: "hole" }, s.hole);
          if (prev && prev[i] !== sl[i]) sp.classList.add("new");
          view.text.append(sp, i < 3 ? (o && i >= 1 ? ", " : " ") : (o ? "." : ""));
        });
        view.fill.style.width = ev.score + "%";
        view.num.textContent = ev.score;
        [ev.full, ev.concrete, ev.irony, ev.question].forEach((v, i) => view.checks[i].classList.toggle("on", v));
        if (view.bubble.textContent !== ev.say) { view.bubble.textContent = ev.say; view.bubble.classList.remove("swap"); void view.bubble.offsetWidth; view.bubble.classList.add("swap"); }
        return ev;
      }
      function render() {
        const ev = paint(after, sel, prevSel); prevSel = sel.slice();
        slotEls.forEach(({ e, q }, i) => {
          e.classList.toggle("is-empty", ev.q[i] === 0);
          q.textContent = QN[ev.q[i]]; q.className = "core-ll__q q" + ev.q[i];
        });
        ctl.forEach((c, i) => c.set(sel[i]));
        const cmp = step === 5;
        body.classList.toggle("is-compare", cmp);
        if (cmp && !before.box.isConnected) body.prepend(before.box);
        if (!cmp && before.box.isConnected) before.box.remove();
        before.stamp.textContent = "고치기 전"; before.stamp.className = "core-ll__stamp bad";
        after.stamp.textContent = cmp ? "고친 후" : ""; after.stamp.className = "core-ll__stamp good"; after.stamp.style.display = cmp ? "" : "none";
        before.stamp.style.display = "";
        if (cmp) paint(before, [1, 1, 1, 1], null);
      }
      const PRESET = [[0, 0, 0, 0], [2, 2, 0, 0], [2, 2, 2, 0], [2, 2, 2, 2], [3, 2, 2, 2], [3, 2, 2, 2]];
      return {
        setStep(s) { step = s; sel = PRESET[s].slice(); render(); },
      };
    },
  });

  /* =====================================================================
     0-3 갈등의 층과 스테이크
     ===================================================================== */
  LESSONS.push({
    id: "conflict-stakes", ch: 0, order: 3,
    title: "갈등의 층과 스테이크",
    lede: "이 레슨을 마치면 한 장면에 걸린 갈등을 내적·대인·사회 세 층으로 나눠 보고, '실패하면 무엇을 잃나'가 왜 곱셈으로 커지거나 0이 되는지 알게 됩니다.",
    key: "강한 장면은 갈등의 층이 겹쳐서 바깥 사건이 안쪽 약점을 찌릅니다. 스테이크는 크기 × 아끼는 정도 × 실패 가능성이라, 하나만 0이어도 0입니다.",
    steps: [
      ["갈등 없는 장면", "준이 대회 신청서를 내고, 접수원은 웃으며 받아 줍니다. 원하는 것을 막는 것이 없어서 왼쪽 세 겹의 원이 모두 비어 있습니다. 이런 장면은 <b>정보 전달</b>일 뿐입니다. 갈등은 원하는 것과 막는 것이 부딪칠 때 생깁니다."],
      ["대인 갈등", "가운데 고리가 켜졌습니다. 동생이 신청서를 붙잡고 \"가게 팔자\"고 합니다. <b>다른 인물</b>과 부딪치는 갈등입니다. 화살표가 바깥에서 준 쪽으로 밀고 들어오는 압력입니다."],
      ["사회 갈등", "바깥 고리가 켜졌습니다. 대회 규정은 '개인 출전, 외부 도움을 받으면 실격'입니다. <b>제도·집단·규칙</b>과의 갈등이고, 악의 없이도 인물을 조입니다. 자연·괴물·마법의 대가 같은 환경 갈등도 이 바깥쪽에 놓입니다."],
      ["내적 갈등", "가장 안쪽이 켜졌습니다. 준은 사고 뒤 미각을 잃은 것을 아무에게도 말하지 못합니다. <b>자기 자신</b>과의 갈등입니다. 이제 세 층이 다 있지만 아직 서로 따로 놉니다."],
      ["층이 겹칠 때", "결승 과제가 <b>블라인드 시식</b>으로 발표됩니다. 이 사건 하나가 세 고리를 차례로 뚫고 들어갑니다. 규정상 혼자 맛을 봐야 하고(사회), 그래서 동생에게 부탁할 수도 없고(대인), 들키면 끝이라는 두려움(내적)이 정면으로 찔립니다. <b>바깥 사건이 안쪽 약점을 건드릴 때</b> 장면이 강해집니다."],
      ["스테이크는 곱셈", "오른쪽이 스테이크 계산으로 바뀌었습니다. <b>잃을 것의 크기 × 독자가 그것을 아끼는 정도 × 실패할 가능성</b>입니다. 세 값이 상자의 가로·높이·깊이라서, 상자의 부피가 곧 스테이크입니다. '직접 해보기'의 막대로 세 값을 바꿔 보세요."],
      ["하나라도 0이면", "실패 가능성을 0으로 내렸습니다. 준이 질 리가 없어 보이면 할머니의 가게가 걸려 있어도 상자가 납작해집니다. 세계 멸망이 걸려 있어도 독자가 그 세계에 정이 없으면 마찬가지입니다. 반대로 작은 것이라도 독자가 아끼면 크게 느껴집니다."],
    ],
    terms: [
      ["갈등", "Conflict", "원하는 것과 그것을 막는 것이 부딪치는 일. 갈등 없는 장면은 정보 전달에 그칩니다."],
      ["내적 갈등", "Internal conflict", "두려움·죄책감·모순된 욕구처럼 인물이 자기 자신과 부딪치는 갈등."],
      ["대인 갈등", "Interpersonal conflict", "라이벌·연인·가족·적대자처럼 다른 인물과 부딪치는 갈등."],
      ["사회 갈등", "Societal conflict", "제도·집단·규칙과 부딪치는 갈등. 악의가 없어도 인물을 조입니다."],
      ["스테이크", "Stakes", "실패하면 잃는 것. 잃을 것의 크기, 독자가 그것을 아끼는 정도, 실패할 가능성이 곱해져 체감됩니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill"); tall(cv, 620);
      /* 바깥 → 안쪽 */
      const LAY = [
        { name: "사회", sub: "제도·규칙과", col: "--ch2", ex: "규정: 개인 출전, 외부 도움을 받으면 실격", hit: "그래서 혼자 맛을 봐야 한다" },
        { name: "대인", sub: "다른 인물과", col: "--ch3", ex: "동생: \"가게 팔자. 대회는 무슨.\"", hit: "동생에게 맛을 봐 달라고 할 수도 없다" },
        { name: "내적", sub: "자기 자신과", col: "--ch8", ex: "미각을 잃은 걸 아무에게도 말하지 못한다", hit: "들키면 끝이라는 두려움이 찔린다" },
      ];
      const SCENE = [
        ["준이 대회 신청서를 내고, 접수원이 웃으며 받아 준다.", "정보 전달"],
        ["대회 접수 날, 준이 신청서를 내려 한다.", "갈등 1층"],
        ["대회 접수 날, 준이 신청서를 내려 한다.", "갈등 2층"],
        ["대회 접수 날, 준이 신청서를 내려 한다.", "갈등 3층"],
        ["결승 과제가 발표된다: 블라인드 시식.", "세 층이 겹침"],
        ["결승에서 지면 무엇을 잃나?", "스테이크"],
        ["결승에서 지면 무엇을 잃나?", "스테이크"],
      ];
      const FAC = [
        { name: "잃을 것의 크기", ex: ["동네 빵 한 판", "대회 상금", "할머니가 40년 지킨 가게"] },
        { name: "독자가 아끼는 정도", ex: ["가게를 한 번도 보여 주지 않았다", "가게 장면이 몇 번 나왔다", "할머니와 가게의 추억을 함께 봤다"] },
        { name: "실패할 가능성", ex: ["준이 질 리가 없다", "이길 수도, 질 수도 있다", "이대로면 거의 진다"] },
      ];
      /* 단계별 목표: 켜진 층(사회·대인·내적), 겹침, 패널(0 갈등 목록, 1 스테이크), 스테이크 세 값 */
      const T = [
        [[0, 0, 0], 0, 0], [[0, 1, 0], 0, 0], [[1, 1, 0], 0, 0], [[1, 1, 1], 0, 0], [[1, 1, 1], 1, 0], [[1, 1, 1], 1, 1], [[1, 1, 1], 1, 1],
      ];
      const SK = [[0.85, 0.8, 0.7], [0.85, 0.8, 0.7], [0.85, 0.8, 0.7], [0.85, 0.8, 0.7], [0.85, 0.8, 0.7], [0.85, 0.8, 0.7], [0.85, 0.8, 0]];
      let step = 0, on = [0, 0, 0], over = 0, panel = 0, fac = [0.85, 0.8, 0.7];
      const cur = { on: [0, 0, 0], over: 0, panel: 0, fac: fac.slice() };
      let overT0 = 0, time = 0;

      const layerChips = M.chips(api.controls, { title: "갈등 층 쌓기", items: ["없음", "대인", "+사회", "+내적", "겹치기"], value: 0, onPick: (i) => {
        on = [i >= 2 ? 1 : 0, i >= 1 ? 1 : 0, i >= 3 ? 1 : 0]; const was = over; over = i >= 4 ? 1 : 0; if (over && !was) overT0 = time; panel = 0;
      } });
      const sl = FAC.map((f, i) => M.slider(api.controls, { id: "csF" + i, label: f.name, min: 0, max: 100, step: 5, value: fac[i] * 100, fmt: (v) => (v / 100).toFixed(2), onInput: (v) => { fac[i] = v / 100; panel = 1; } }));
      api.controls.append(M.el("p", { class: "hint" }, "막대 하나를 0으로 내려 보세요. 나머지가 아무리 커도 상자가 납작해집니다."));

      const exOf = (f, v) => FAC[f].ex[v < 0.34 ? 0 : v < 0.67 ? 1 : 2];

      function drawRings(x, L, t) {
        const c = M.col();
        const R = Math.max(40, Math.min(L.w / 2 - 6, (L.h - 30) / 2));
        const cx = L.x + L.w / 2, cy = L.y + 30 + (L.h - 30) / 2;
        const rad = [R, R * 0.7, R * 0.42];
        for (let i = 0; i < 3; i++) {
          const a = cur.on[i], col = V(LAY[i].col), ro = rad[i], ri = i < 2 ? rad[i + 1] : 0;
          x.save();
          x.beginPath(); x.arc(cx, cy, ro, 0, Math.PI * 2);
          if (ri) { x.moveTo(cx + ri, cy); x.arc(cx, cy, ri, 0, Math.PI * 2, true); }
          x.fillStyle = tint(col, 0.06 + 0.28 * a); x.fill();
          x.restore();
          x.save();
          x.beginPath(); x.arc(cx, cy, ro, 0, Math.PI * 2);
          x.strokeStyle = a > 0.5 ? c.ink : c.muted; x.lineWidth = a > 0.5 ? 1.5 : 1; x.setLineDash(a > 0.5 ? [] : [4, 4]); x.stroke();
          x.restore();
          /* 압력 화살촉: 바깥에서 안으로 */
          if (a > 0.02) {
            const n = i === 2 ? 6 : 10, span = ro - (ri || R * 0.2);
            x.save(); x.globalAlpha = a;
            for (let k = 0; k < n; k++) {
              const ang = (k / n) * Math.PI * 2 + i * 0.4 + 0.2;
              const ph = ((t / 1600 + k * 0.13) % 1);
              const r = ro - 6 - ph * (span - 14);
              const px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
              const ux = -Math.cos(ang), uy = -Math.sin(ang), s = 6.5;
              x.globalAlpha = a * Math.sin(ph * Math.PI) * 0.75;
              x.beginPath();
              x.moveTo(px + ux * s, py + uy * s); x.lineTo(px - ux * s * 0.6 + uy * s * 0.8, py - uy * s * 0.6 - ux * s * 0.8); x.lineTo(px - ux * s * 0.6 - uy * s * 0.8, py - uy * s * 0.6 + ux * s * 0.8); x.closePath();
              x.fillStyle = c.ink; x.fill();
            }
            x.restore();
          }
        }
        /* 층 이름 */
        const ly = [cy - (rad[0] + rad[1]) / 2, cy - (rad[1] + rad[2]) / 2, cy - rad[2] * 0.66];
        if (R > 70) LAY.forEach((l, i) => {
          const a = cur.on[i];
          M.text(x, l.name, cx, ly[i] + 4, { size: 12.5, weight: 700, align: "center", color: a > 0.5 ? c.ink : c.muted });
        });
        /* 주인공 */
        M.art.head(x, { cx, cy: cy + rad[2] * 0.12, r: rad[2] * 0.3, who: "A", expr: cur.over > 0.5 ? "worried" : cur.on[2] > 0.5 ? "sad" : "neutral" });
        /* 겹침: 바깥 사건이 세 고리를 뚫고 들어감 */
        if (cur.over > 0.02) {
          const p = M.ease.out(M.clamp((t - overT0) / 1500, 0, 1));
          const ang = -Math.PI * 0.27;
          const r0 = Math.min(R * 1.22, (cy - L.y - 22) / Math.abs(Math.sin(ang))), r1 = rad[2] * 0.5;
          const sx = cx + Math.cos(ang) * r0, sy = cy + Math.sin(ang) * r0;
          const rr = M.lerp(r0, r1, p), ex = cx + Math.cos(ang) * rr, ey = cy + Math.sin(ang) * rr;
          x.save(); x.globalAlpha = cur.over;
          M.arrow(x, sx, sy, ex, ey, c.b, 2.6);
          rad.forEach((r, i) => {
            if (rr <= r) {
              const q = M.clamp((r - rr) / (R * 0.25), 0, 1);
              const fx = cx + Math.cos(ang) * r, fy = cy + Math.sin(ang) * r;
              M.dot(x, fx, fy, 4 + 8 * (1 - q), M.alpha(c.b, 0.25 + 0.5 * (1 - q)));
              M.dot(x, fx, fy, 3.5, c.b, c.surface);
            }
          });
          x.restore();
          const tg = M.tag(x, "결승 과제: 블라인드 시식", Math.min(L.x + L.w, sx + 30), L.y + 10, { align: "right", fill: M.alpha(c.b, 0.18) });
          void tg;
        }
      }

      function drawLayers(x, P, a) {
        const c = M.col();
        x.save(); x.globalAlpha = a;
        const n = cur.on.reduce((s, v) => s + (v > 0.5 ? 1 : 0), 0);
        M.text(x, `갈등 목록 · ${n}층${cur.over > 0.5 ? " · 겹침" : ""}`, P.x, P.y + 12, { size: 12.5, weight: 700, color: c.ink });
        const gap = 10, top = P.y + 24;
        const rh = Math.min(96, (P.h - 24 - gap * 2) / 3);
        LAY.forEach((l, i) => {
          const y = top + i * (rh + gap), A = cur.on[i] > 0.5, col = V(l.col);
          if (A) card(x, P.x, y, P.w, rh, { fill: M.alpha(col, 0.12) });
          else { M.rrect(x, P.x, y, P.w, rh, 10); x.strokeStyle = c.muted; x.setLineDash([4, 4]); x.lineWidth = 1; x.stroke(); x.setLineDash([]); }
          M.rrect(x, P.x + 1, y + 10, 4, rh - 20, 2); x.fillStyle = A ? col : M.alpha(c.muted, 0.4); x.fill();
          M.text(x, `${l.name} 갈등`, P.x + 14, y + 20, { size: 13, weight: 700, color: A ? c.ink : c.muted });
          x.font = M.font(13, "ui", 700); const nw = x.measureText(`${l.name} 갈등`).width;
          if (P.w > 300) M.text(x, `· ${l.sub}`, P.x + 20 + nw, y + 20, { size: 12, color: c.muted });
          const tw = P.w - 26;
          if (!A) { M.text(x, "아직 없음", P.x + 14, y + 40, { size: 12.5, color: c.muted }); return; }
          const big = rh > 70;
          const lines = para(x, l.ex, P.x + 14, y + 40, tw, { size: big ? 13 : 12, color: c.ink, lh: big ? 18 : 16 });
          if (cur.over > 0.05) {
            x.save(); x.globalAlpha = a * cur.over;
            const yy = y + 40 + lines * (big ? 18 : 16) + (big ? 2 : 0);
            if (yy < y + rh - 4) M.text(x, "→ " + l.hit, P.x + 14, yy, { size: 12, weight: 700, color: c.b });
            x.restore();
          }
        });
        if (cur.over > 0.05) {
          x.save(); x.globalAlpha = a * cur.over;
          for (let i = 0; i < 2; i++) { const y = top + (i + 1) * (rh + gap) - gap; M.arrow(x, P.x + P.w - 22, y - 2, P.x + P.w - 22, y + gap + 6, c.b, 2); }
          x.restore();
        }
        x.restore();
      }

      function drawStakes(x, P, a) {
        const c = M.col(), red = c.b;
        x.save(); x.globalAlpha = a;
        M.text(x, "스테이크 = 크기 × 아끼는 정도 × 실패 가능성", P.x, P.y + 12, { size: 12.5, weight: 700, color: c.ink });
        const top = P.y + 26, rh = Math.min(58, (P.h - 26) * 0.17);
        FAC.forEach((f, i) => {
          const y = top + i * (rh + 6), v = cur.fac[i];
          M.text(x, f.name, P.x, y + 13, { size: 12, weight: 700, color: c.ink });
          M.text(x, v.toFixed(2), P.x + P.w, y + 13, { size: 12, mono: true, weight: 700, color: c.ink, align: "right" });
          const by = y + 20, bw = P.w;
          M.rrect(x, P.x, by, bw, 9, 4.5); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
          if (v > 0.005) { M.rrect(x, P.x, by, Math.max(9, bw * v), 9, 4.5); x.fillStyle = M.alpha(red, 0.55); x.fill(); }
          if (rh >= 44) M.text(x, exOf(i, v), P.x, by + 24, { size: 12, color: v < 0.05 ? red : c.muted, weight: v < 0.05 ? 700 : 500 });
          if (i < 2 && rh >= 44) M.text(x, "×", P.x + P.w, by + 24, { size: 13, weight: 700, color: c.muted, align: "right" });
        });
        /* 결과: 부피 상자 */
        const prod = cur.fac[0] * cur.fac[1] * cur.fac[2];
        const by0 = top + 3 * (rh + 6) + 4, bh = P.y + P.h - by0;
        M.text(x, "=", P.x, by0 + 26, { size: 22, weight: 700, color: c.ink });
        M.text(x, prod.toFixed(2), P.x + 22, by0 + 28, { size: 26, weight: 800, color: prod < 0.02 ? red : c.ink, mono: true });
        M.text(x, prod < 0.02 ? "체감 스테이크 0" : prod < 0.2 ? "약함" : prod < 0.45 ? "보통" : "강함", P.x + 2, by0 + 48, { size: 12, weight: 700, color: prod < 0.02 ? red : c.muted });
        if (bh > 90) { M.text(x, "상자 가로 = 크기", P.x + 2, by0 + 74, { size: 12, color: c.muted }); M.text(x, "높이 = 아끼는 정도", P.x + 2, by0 + 92, { size: 12, color: c.muted }); M.text(x, "깊이 = 실패 가능성", P.x + 2, by0 + 110, { size: 12, color: c.muted }); }
        const U = Math.max(30, Math.min(bh - 20, P.w * 0.5) * 0.75);
        const bw = U * cur.fac[0], bhh = U * cur.fac[1], bd = U * 0.55 * cur.fac[2];
        const ox = P.x + P.w - U * 1.05 - 6, oy = by0 + 8 + U * 0.55 * 0.5 + (U - bhh) + bhh;
        const dx = bd * 0.9, dy = -bd * 0.5;
        /* 바탕 격자(최대 크기 상자 윤곽) */
        x.save(); x.setLineDash([3, 4]); x.strokeStyle = M.alpha(c.muted, 0.6); x.lineWidth = 1;
        const Ux = U, Uy = U, Ud = U * 0.55, mdx = Ud * 0.9, mdy = -Ud * 0.5, oyM = oy;
        x.strokeRect(ox, oyM - Uy, Ux, Uy);
        x.beginPath(); x.moveTo(ox, oyM - Uy); x.lineTo(ox + mdx, oyM - Uy + mdy); x.lineTo(ox + Ux + mdx, oyM - Uy + mdy); x.lineTo(ox + Ux, oyM - Uy);
        x.moveTo(ox + Ux + mdx, oyM - Uy + mdy); x.lineTo(ox + Ux + mdx, oyM + mdy); x.lineTo(ox + Ux, oyM); x.stroke();
        x.restore();
        if (prod > 0.0005) {
          const face = (pts, f) => { x.beginPath(); pts.forEach((p, k) => (k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fillStyle = f; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.2; x.stroke(); };
          face([[ox, oy], [ox + bw, oy], [ox + bw, oy - bhh], [ox, oy - bhh]], tint(red, 0.45));
          face([[ox, oy - bhh], [ox + bw, oy - bhh], [ox + bw + dx, oy - bhh + dy], [ox + dx, oy - bhh + dy]], tint(red, 0.28));
          face([[ox + bw, oy], [ox + bw + dx, oy + dy], [ox + bw + dx, oy - bhh + dy], [ox + bw, oy - bhh]], tint(red, 0.62));
        } else {
          M.line(x, ox, oy, ox + Math.max(bw, 2), oy, red, 2.5);
          M.line(x, ox + Math.max(bw, 2), oy, ox + Math.max(bw, 2) + Math.max(dx, 2), oy + Math.min(dy, -1), red, 2.5);
        }
        x.restore();
      }

      return {
        setStep(s) {
          step = s; const [o, ov, pn] = T[s];
          on = o.slice(); if (ov && !over) overT0 = 0; over = ov; panel = pn; if (s === 4) overT0 = 0;
          fac = SK[s].slice(); sl.forEach((q, i) => q.set(fac[i] * 100));
          layerChips.set(ov ? 4 : o[2] ? 3 : o[0] ? 2 : o[1] ? 1 : 0);
        },
        replay() { overT0 = 0; },
        frame(t, dt) {
          time = t;
          for (let i = 0; i < 3; i++) { cur.on[i] = follow(cur.on[i], on[i], dt, 350); cur.fac[i] = follow(cur.fac[i], fac[i], dt, 300); }
          cur.over = follow(cur.over, over, dt, 300); cur.panel = follow(cur.panel, panel, dt, 320);
          const { x, w, h } = M.fit(cv), c = M.col();
          const pad = 10, narrow = isNarrow(w);
          /* 장면 카드 */
          const [scene, tag] = SCENE[step];
          const capH = narrow ? 54 : 44;
          card(x, pad, 4, w - pad * 2 - 2, capH, {});
          x.font = M.font(12.5, "ui", 700); const tagW = x.measureText(tag).width + 18;
          M.text(x, "장면", pad + 14, 4 + capH / 2 + 4.5, { size: 12, weight: 700, color: c.muted });
          para(x, scene, pad + 50, narrow ? 4 + 22 : 4 + capH / 2 + 5, w - pad * 2 - 74 - tagW, { size: narrow ? 13 : 14, weight: 600, color: c.ink, lh: 18 });
          M.tag(x, tag, w - pad - 14, 4 + capH / 2, { align: "right", fill: step === 0 ? M.alpha(c.muted, 0.15) : M.alpha(c.b, 0.15) });
          const top = 4 + capH + 16;
          let L, P;
          if (!narrow) { const lw = Math.min(w * 0.5, h - top - 8 + 40); L = { x: pad, y: top, w: lw, h: h - top - 8 }; P = { x: pad + lw + 20, y: top, w: w - pad * 2 - lw - 22, h: h - top - 8 }; }
          else { const lh = (h - top) * 0.46; L = { x: pad, y: top, w: w - pad * 2, h: lh }; P = { x: pad, y: top + lh + 10, w: w - pad * 2, h: h - top - lh - 16 }; }
          drawRings(x, L, t);
          if (cur.panel < 0.98) drawLayers(x, P, 1 - cur.panel);
          if (cur.panel > 0.02) drawStakes(x, P, cur.panel);
        },
      };
    },
  });

  /* =====================================================================
     1-1 욕망과 필요
     ===================================================================== */
  LESSONS.push({
    id: "want-need", ch: 1, order: 1,
    title: "욕망과 필요",
    lede: "이 레슨을 마치면 인물이 '원하는 것'(욕망)과 '진짜 필요한 것'(필요)을 나눠 쓰고, 둘이 이야기 내내 어긋나다 마지막 선택에서 만나는 구조를 그래프로 읽을 수 있습니다.",
    key: "욕망은 플롯을 움직이고 필요는 주제를 드러냅니다. 좋은 이야기는 욕망을 좇다가 필요를 발견하고, 마지막에 둘 중 하나를 고르게 합니다.",
    steps: [
      ["욕망: 눈에 보이는 목표", "가로축은 이야기의 진행, 세로축은 목표에 얼마나 다가갔는지입니다. 실선이 준의 <b>욕망</b>, 곧 '전국 제빵 대회 우승'입니다. 이뤘는지 판정할 수 있는 바깥 목표라서 예선·본선처럼 사건마다 오르내립니다. 욕망은 <b>플롯을 움직입니다</b>."],
      ["필요: 본인은 모르는 것", "점선이 준의 <b>필요</b>입니다. 동생을 믿고 맛을 맡기는 것, 곧 '기대도 빼앗기지 않는다'를 받아들이는 일입니다. 준 자신은 이것이 필요한지 모릅니다. 내면의 변화라서 장면 하나로 판정할 수 없고, 이야기 전체가 끝나야 드러납니다."],
      ["어긋남", "발단부터 미드포인트까지 칠해진 틈을 보세요. 혼자 해내려 할수록 욕망은 오르고 필요는 오히려 내려갑니다. <b>욕망을 좇을수록 필요에서 멀어지는</b> 구조가 이 인물의 긴장을 만듭니다. 고객이 요청한 기능과 실제로 필요한 것이 다른 경우와 비슷합니다."],
      ["미드포인트: 처음 엿본다", "미드포인트에서 동생이 몰래 맛을 봐 준 덕에 본선에 오릅니다. 점선이 처음으로 꺾여 오릅니다. 준은 <b>필요를 처음 엿보지만</b> 아직 받아들이지 않아서, 위기에서 혼자 맛을 보다 실패합니다."],
      ["클라이맥스의 선택", "클라이맥스는 결승 블라인드 시식입니다. 숨기고 혼자 이기면 욕망을, 미각 상실을 밝히고 동생에게 맛을 맡기면(실격) 필요를 얻습니다. <b>둘 다 가질 수 없게</b> 만들어야 선택이 무겁습니다. 지금 그래프는 필요를 택한 쪽입니다."],
      ["아크의 세 유형", "'직접 해보기'에서 아크를 바꿔 보세요. <b>긍정 아크</b>는 필요를 택하고, <b>부정 아크</b>는 욕망을 택하며 필요를 버립니다(트로피를 얻고 동생은 떠남). <b>평면 아크</b>는 주인공이 처음부터 진실을 알아 흔들리지 않고, 대신 주변 인물(동생)이 변합니다."],
    ],
    terms: [
      ["욕망", "Want", "인물이 의식적으로 원하고 쫓는 바깥 목표. 이뤘는지 판정할 수 있어야 하고, 플롯을 움직입니다."],
      ["필요", "Need", "인물이 대개 모르지만 온전해지려면 얻어야 하는 내면의 변화. 주제를 드러냅니다."],
      ["캐릭터 아크", "Character arc", "이야기 동안 인물의 내면이 변하는 궤적. 긍정·부정·평면 세 가지로 나눕니다."],
      ["평면 아크", "Flat arc", "주인공은 처음부터 진실을 알고 버티며, 그 버팀이 주변 인물과 세계를 바꾸는 아크. 아크가 없다는 뜻이 아닙니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill"); tall(cv, 560);
      const EVX = [[0.1, "발단"], [0.25, "1막 전환점"], [0.5, "미드포인트"], [0.75, "위기"], [0.88, "클라이맥스"], [0.97, "결말"]];
      const BASEW = [[0, 0.08], [0.1, 0.16], [0.25, 0.3], [0.38, 0.42], [0.5, 0.56], [0.62, 0.62], [0.75, 0.38], [0.84, 0.72]];
      const BASEN = [[0, 0.2], [0.1, 0.17], [0.25, 0.12], [0.38, 0.08], [0.5, 0.1], [0.58, 0.3], [0.68, 0.36], [0.75, 0.3], [0.84, 0.48]];
      const ARC = {
        pos: { name: "긍정 아크", w: [...BASEW, [0.9, 0.5], [1, 0.45]], n: [...BASEN, [0.9, 0.95], [1, 1]], end: ["클라이맥스: 심사위원 앞에서 미각 상실을 밝히고 동생에게 맛을 맡긴다. 실격이다.", "결말: 우승은 놓쳤지만 둘이 가게를 다시 연다."] },
        neg: { name: "부정 아크", w: [...BASEW, [0.9, 0.95], [1, 1]], n: [...BASEN, [0.9, 0.12], [1, 0.04]], end: ["클라이맥스: 끝까지 숨긴 채 동생의 시식 메모를 몰래 써서 우승한다.", "결말: 트로피는 얻었지만 동생은 가게를 떠난다."] },
        flat: { name: "평면 아크", w: [...BASEW, [0.9, 0.86], [1, 0.9]], n: [[0, 0.9], [1, 0.9]], o: [[0, 0.08], [0.25, 0.12], [0.5, 0.3], [0.75, 0.55], [0.9, 0.85], [1, 0.92]], end: ["클라이맥스: 처음부터 동생을 믿던 준이 흔들리지 않고, 함께 맛을 보자고 한다.", "결말: 가게를 팔자던 동생이 남기로 한다."] },
      };
      const MID = [
        [0.1, "일상: 준은 할머니의 가게를 혼자 꾸린다."],
        [0.25, "발단: 사고로 미각을 잃는다. 가게를 지킬 길은 대회 우승뿐이다."],
        [0.5, "1막 전환점 뒤: 동생의 도움을 거절하고 혼자 출전한다."],
        [0.75, "미드포인트 뒤: 동생이 몰래 맛을 봐 준 덕에 본선에 오른다."],
        [0.88, "위기: 혼자 맛을 보다 빵을 망치고, 동생과 크게 다툰다."],
      ];
      const at = mono;
      const FOCUS = [0.3, 0.35, 0.42, 0.6, 0.95, 1];
      let step = 0, arc = "pos", now = 0.3, nowT = 0.3, user = false, revealW = 1, revealN = 1, t0 = 0;
      const cur = { gap: 0, need: 0, fork: 0, mid: 0, other: 0, k: { pos: 1, neg: 0, flat: 0 } };
      const arcChips = M.chips(api.controls, { title: "아크 유형", items: ["긍정", "부정", "평면"], value: 0, onPick: (i) => { arc = ["pos", "neg", "flat"][i]; nowT = Math.max(nowT, 0.95); scrub.set(Math.round(nowT * 100)); } });
      const scrub = M.slider(api.controls, { id: "wnNow", label: "이야기 진행", min: 0, max: 100, step: 1, value: 30, fmt: (v) => v + "%", onInput: (v) => { nowT = v / 100; user = true; } });
      api.controls.append(M.el("p", { class: "hint" }, "진행 막대를 끌면 그 시점의 준이 무엇을 하고 있는지 그래프 아래에 나옵니다."));

      const wantAt = (t) => ARC.pos.w && (cur.k.pos * at(ARC.pos.w, t) + cur.k.neg * at(ARC.neg.w, t) + cur.k.flat * at(ARC.flat.w, t));
      const needAt = (t) => cur.k.pos * at(ARC.pos.n, t) + cur.k.neg * at(ARC.neg.n, t) + cur.k.flat * at(ARC.flat.n, t);
      const otherAt = (t) => at(ARC.flat.o, t);
      const MID_FLAT = [
        [0.1, "일상: 준은 동생을 믿지만, 동생은 가게를 팔자고 한다."],
        [0.25, "발단: 사고로 미각을 잃는다. 준은 동생에게 맛을 맡기자고 한다."],
        [0.5, "1막 전환점 뒤: 동생은 마지못해 함께 대회 준비를 시작한다."],
        [0.75, "미드포인트 뒤: 둘이 본선에 오르고, 동생이 처음으로 가게 일을 즐긴다."],
        [0.88, "위기: 프랜차이즈가 동생에게 큰돈을 제안한다. 준은 흔들리지 않는다."],
      ];
      const stateAt = (t) => {
        for (const [e, s] of (arc === "flat" ? MID_FLAT : MID)) if (t < e) return s;
        return t < 0.95 ? ARC[arc].end[0] : ARC[arc].end[1];
      };

      return {
        setStep(s) {
          step = s; arc = s === 5 ? arc : "pos"; arcChips.set(["pos", "neg", "flat"].indexOf(arc));
          nowT = FOCUS[s]; user = false; scrub.set(Math.round(nowT * 100));
          revealW = s === 0 ? 0 : 1; revealN = s === 1 ? 0 : 1; t0 = 0;
        },
        frame(t, dt) {
          const { x, w, h } = M.fit(cv), c = M.col();
          const narrow = isNarrow(w);
          if (step === 0) revealW = M.clamp(t / 4200, 0, 1);
          if (step === 1) revealN = M.clamp(t / 4200, 0, 1);
          for (const k of ["pos", "neg", "flat"]) cur.k[k] = follow(cur.k[k], arc === k ? 1 : 0, dt, 420);
          cur.gap = follow(cur.gap, step >= 2 ? 1 : 0, dt, 400);
          cur.need = follow(cur.need, step >= 1 ? 1 : 0, dt, 300);
          cur.mid = follow(cur.mid, step === 3 ? 1 : 0, dt, 300);
          cur.fork = follow(cur.fork, step >= 4 ? 1 : 0, dt, 300);
          cur.other = follow(cur.other, arc === "flat" ? 1 : 0, dt, 400);
          if (!user && step <= 1) { now = step === 0 ? revealW : revealN; scrub.set(Math.round(now * 100)); } else now = follow(now, nowT, dt, user ? 120 : 600);
          const WCOL = V("--ch3"), NCOL = V("--ch7"), OCOL = V("--ch6");

          /* 레이아웃 */
          const pad = 12, top = narrow ? 52 : 34, foot = narrow ? 92 : 74;
          const G = { x: pad + (narrow ? 26 : 56), y: top + 26, w: w - pad * 2 - (narrow ? 30 : 62), h: h - top - 26 - foot - (narrow ? 30 : 44) };
          const X = (t) => G.x + t * G.w, Y = (v) => G.y + G.h - v * G.h;

          /* 머리줄: 범례 + 아크 이름 */
          const lg = (lx, col, dash, label) => { x.save(); x.setLineDash(dash); M.line(x, lx, 14, lx + 26, 14, col, 3); x.restore(); M.text(x, label, lx + 32, 18.5, { size: 12.5, weight: 700, color: c.ink }); x.font = M.font(12.5, "ui", 700); return lx + 32 + x.measureText(label).width + 18; };
          let lx = lg(pad + 4, WCOL, [], "욕망 · 대회 우승");
          x.save(); x.globalAlpha = cur.need; if (narrow) x.translate(0, 20); lx = lg(narrow ? pad + 4 : lx, NCOL, [7, 5], arc === "flat" ? "필요 · 준은 이미 안다" : "필요 · 동생에게 맛을 맡긴다"); x.restore();
          if (cur.other > 0.02 && !narrow) { x.save(); x.globalAlpha = cur.other; lg(lx, OCOL, [2, 4], "동생의 변화"); x.restore(); }
          M.tag(x, ARC[arc].name, w - pad, narrow ? 34 : 14, { align: "right", fill: M.alpha(V("--ch1"), 0.35) });

          /* 그래프 틀 */
          card(x, G.x, G.y, G.w, G.h, { shadow: false, stroke: c.line });
          M.text(x, "이룸", G.x - 8, Y(1) + 4, { size: 12, align: "right" });
          M.text(x, "멀다", G.x - 8, Y(0) + 4, { size: 12, align: "right" });
          EVX.forEach(([ex, name], i) => {
            const hot = (step === 3 && i === 2) || (step === 4 && i === 4);
            M.line(x, X(ex), G.y, X(ex), G.y + G.h, hot ? c.key : c.line, hot ? 2 : 1, hot ? null : [3, 4]);
            const lbl = narrow ? String(i + 1) : name;
            const lyy = G.y + G.h + 17 + (narrow ? 0 : (i % 2) * 15);
            M.text(x, lbl, X(ex), lyy, { size: 12, weight: hot ? 700 : 500, align: i === 5 ? "right" : "center", color: hot ? c.ink : c.muted });
          });
          /* 1막·2막·3막 바닥 띠 */
          [[0, 0.25], [0.25, 0.75], [0.75, 1]].forEach(([a, b], i) => { x.fillStyle = M.alpha(V("--ch2"), i === 1 ? 0.07 : 0.03); x.fillRect(X(a), G.y + 1, X(b) - X(a), G.h - 2); });

          /* 어긋남 틈 */
          const N = 120;
          if (cur.gap > 0.01 && arc !== "flat") {
            x.save(); x.globalAlpha = cur.gap * (1 - cur.other);
            x.beginPath();
            for (let i = 0; i <= N; i++) { const tt = M.lerp(0.1, 0.5, i / N); i ? x.lineTo(X(tt), Y(wantAt(tt))) : x.moveTo(X(tt), Y(wantAt(tt))); }
            for (let i = N; i >= 0; i--) { const tt = M.lerp(0.1, 0.5, i / N); x.lineTo(X(tt), Y(needAt(tt))); }
            x.closePath(); x.fillStyle = M.alpha(c.b, 0.13); x.fill();
            x.restore();
            if (step === 2) M.callout(x, "어긋남: 욕망↑ 필요↓", X(0.44), Y((wantAt(0.44) + needAt(0.44)) / 2), X(0.3), Y(0.78), { line: c.b });
          }
          /* 곡선 */
          const curve = (f, col, dash, upto, lw = 3) => {
            x.save(); x.strokeStyle = col; x.lineWidth = lw; x.lineJoin = "round"; x.lineCap = "round"; x.setLineDash(dash);
            x.beginPath();
            const n = Math.max(2, Math.round(N * upto));
            for (let i = 0; i <= n; i++) { const tt = (i / N); i ? x.lineTo(X(tt), Y(f(tt))) : x.moveTo(X(tt), Y(f(tt))); }
            x.stroke(); x.restore();
          };
          if (cur.other > 0.01) { x.save(); x.globalAlpha = cur.other; curve(otherAt, OCOL, [2, 5], 1, 3); x.restore(); }
          x.save(); x.globalAlpha = cur.need; curve(needAt, NCOL, [8, 6], revealN); x.restore();
          curve(wantAt, WCOL, [], revealW);

          /* 미드포인트 강조 */
          if (cur.mid > 0.02) {
            x.save(); x.globalAlpha = cur.mid;
            M.dot(x, X(0.5), Y(needAt(0.5)), 9, M.alpha(c.key, 0.35));
            M.callout(x, "처음 엿본다", X(0.53), Y(needAt(0.53)), X(0.58), Y(needAt(0.53)) - 34, {});
            x.restore();
          }
          /* 클라이맥스 선택 상자 */
          if (cur.fork > 0.02) {
            const bx = X(0.88) - (narrow ? 150 : 226), by = G.y + 10, bw = narrow ? 140 : 214, bh = narrow ? 56 : 58;
            x.save(); x.globalAlpha = cur.fork;
            card(x, bx, by, bw, bh, {});
            const pickNeed = arc === "pos" || arc === "flat";
            const row = (yy, label, on2, col) => {
              M.rrect(x, bx + 10, yy - 9, 14, 14, 3); x.fillStyle = on2 ? col : c.surface; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
              if (on2) { x.save(); x.strokeStyle = c.surface; x.lineWidth = 2; x.beginPath(); x.moveTo(bx + 13, yy - 2); x.lineTo(bx + 16.5, yy + 1.5); x.lineTo(bx + 21, yy - 5); x.stroke(); x.restore(); }
              M.text(x, label, bx + 31, yy + 3, { size: 12, weight: on2 ? 700 : 500, color: on2 ? c.ink : c.muted });
            };
            row(by + 20, narrow ? "숨기고 우승" : "욕망: 숨기고 혼자 우승", !pickNeed, WCOL);
            row(by + 42, narrow ? "밝히고 맡김" : "필요: 밝히고 동생에게 맡김", pickNeed, NCOL);
            x.restore();
          }
          /* 지금 선 + 점 + 인물 */
          const nx = X(now);
          M.line(x, nx, G.y - 4, nx, G.y + G.h, c.key, 1.5);
          M.dot(x, nx, Y(wantAt(now)), 5.5, WCOL, c.surface);
          if (cur.need > 0.5) M.dot(x, nx, Y(needAt(now)), 5.5, NCOL, c.surface);
          if (cur.other > 0.5) M.dot(x, nx, Y(otherAt(now)), 5, OCOL, c.surface);

          /* 아래: 지금 준은 */
          const fy = G.y + G.h + (narrow ? 30 : 44), fh = h - fy - 4;
          card(x, pad, fy, w - pad * 2 - 2, fh, {});
          const hr = Math.min(18, fh * 0.3);
          const expr = now >= 0.95 ? (arc === "neg" ? "sad" : "smile") : now >= 0.75 ? "worried" : now >= 0.1 ? "neutral" : "neutral";
          x.save(); M.rrect(x, pad, fy, w - pad * 2 - 2, fh, 10); x.clip();
          M.art.head(x, { cx: pad + 30, cy: fy + fh / 2 - 4, r: hr, who: "A", expr });
          x.restore();
          M.text(x, `진행 ${Math.round(now * 100)}%`, pad + 58, fy + 20, { size: 12, weight: 700, color: c.muted });
          const wv = wantAt(now), nv = needAt(now);
          x.font = M.font(12, "ui", 700);
          M.text(x, `욕망 ${wv.toFixed(2)}`, pad + 130, fy + 20, { size: 12, weight: 700, color: c.ink });
          if (cur.need > 0.5) M.text(x, `필요 ${nv.toFixed(2)}`, pad + 210, fy + 20, { size: 12, weight: 700, color: c.ink });
          para(x, stateAt(now), pad + 58, fy + 40, w - pad * 2 - 72, { size: narrow ? 12 : 13.5, weight: 600, color: c.ink, lh: narrow ? 16 : 19 });
        },
      };
    },
  });

  /* =====================================================================
     1-2 상처와 거짓 믿음
     ===================================================================== */
  LESSONS.push({
    id: "wound-lie", ch: 1, order: 2,
    title: "상처와 거짓 믿음",
    lede: "이 레슨을 마치면 인물이 왜 필요를 모르는지(상처 → 거짓 믿음), 그 믿음이 행동을 어떻게 비트는지, 그리고 믿음이 왜 한 번에 깨지면 안 되는지 알게 됩니다.",
    key: "거짓 믿음은 상처가 남긴 방어 규칙입니다. 이야기는 그 믿음을 약한 사건부터 강한 사건까지 여러 번 시험하고, 인물이 대가를 치르며 스스로 내려놓게 합니다.",
    steps: [
      ["상처", "왼쪽 위 카드가 준의 <b>상처</b>입니다. 열두 살 때 아버지의 빵집이 기울자 동업자가 레시피를 들고 떠났습니다. 상처는 과거에 실제로 일어난 아픈 사건입니다. 아직 준과 세상 사이에는 아무것도 없습니다."],
      ["거짓 믿음이 생긴다", "그 사건에서 준은 결론 하나를 내렸습니다. <b>\"남에게 기대면 빼앗긴다.\"</b> 가운데 유리벽이 그 믿음입니다. 오른쪽에서 날아오는 작은 돌(사소한 배신과 실망)을 실제로 막아 줍니다. 완전히 틀린 말이 아니라서 위험합니다. 한때는 인물을 지켜 줬기 때문입니다."],
      ["믿음이 행동을 정한다", "믿음은 욕망도 만듭니다. 머리 위 태그처럼 준은 <b>혼자 우승해서 증명</b>하려 합니다. 아래 줄은 같은 상황에서 준이 하는 대답입니다. 동생이 맛을 봐 주겠다고 해도 거절합니다. 독자가 이 믿음을 알면 이 거절이 답답함이 아니라 <b>인물</b>로 읽힙니다."],
      ["시험 1: 약한 사건", "첫 번째 사건이 유리벽에 맞습니다. 동생이 몰래 반죽을 도와준 것을 알게 되자 준은 화를 냅니다. <b>작은 금</b>이 갔고, 아래 대답도 조금 누그러졌습니다. 거짓 믿음을 시험하는 사건은 약한 것부터 놓습니다."],
      ["시험 2·3: 대가가 커진다", "두 사건이 더 맞습니다. 사고로 미각을 잃어 혼자서는 맛을 볼 수 없게 되고, 그래도 혼자 버티다 예선 빵을 망칩니다. 금이 벽 전체로 번졌습니다. 사건마다 믿음 때문에 <b>치르는 대가</b>가 커지고, 대답은 점점 말을 잃습니다."],
      ["클라이맥스: 스스로 내려놓는다", "결승에서 준이 직접 벽을 밀어 넘어뜨립니다. 사건이 깨는 것이 아니라 <b>인물이 선택해서</b> 내려놓습니다. 벽 뒤에 있던 <b>필요</b>가 드러나고, 같은 상황의 대답이 처음과 정반대가 됩니다."],
      ["고치기 전 / 고친 후", "'직접 해보기'에서 두 판을 번갈아 보세요. <b>고치기 전</b>은 누군가의 조언 한마디에 벽이 통째로 사라집니다. 대가가 없어서 오른쪽 위 설득력이 바닥입니다. <b>고친 후</b>는 세 번 시험받고 대가를 치른 뒤 스스로 내려놓습니다. 깨달음은 대사가 아니라 누적된 사건에서 나옵니다."],
    ],
    terms: [
      ["상처", "Wound / Ghost", "인물의 과거에 있었던 아픈 사건. 현재의 선택을 비틀 때만 의미가 있습니다."],
      ["거짓 믿음", "Lie", "상처에서 자신을 지키려고 내린, 세상이나 자신에 대한 틀린 규칙. 한 문장으로 말할 수 있고 사건으로 시험할 수 있어야 합니다."],
      ["동기", "Motivation", "\"왜 이 인물이 지금 이 행동을 하나\"에 대한 답. 욕망·상처·거짓 믿음을 아는 독자가 납득하면 동기가 선 것입니다."],
      ["캐붕", "Character break", "캐릭터 붕괴의 준말. 인물이 동기 없이 작가 편의대로 움직일 때 독자가 쓰는 말입니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill"); tall(cv, 640);
      const REPLY = ["\"됐어. 내 빵은 내가 알아.\"", "\"…괜찮아. 혼자 할 수 있어.\"", "(대답 대신 주방 문을 닫는다)", "\"…잠깐만. 생각 좀 하자.\"", "\"부탁해. 네 혀를 믿을게.\""];
      const TESTS = [
        { lv: "시험 1 · 약", tx: "동생이 몰래 반죽을 도와준다", cost: "준은 화를 낸다" },
        { lv: "시험 2 · 중", tx: "사고로 미각을 잃는다", cost: "혼자서는 맛을 못 본다" },
        { lv: "시험 3 · 강", tx: "혼자 버티다 예선 빵을 망친다", cost: "탈락 직전, 동생과 다툰다" },
      ];
      const ADVICE = { lv: "조언 한마디", tx: "\"혼자가 다가 아니야.\"", cost: "대가 없음" };
      /* 결정적 난수 */
      const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      /* 금: 충격점에서 뻗는 꺾인 선들 (판 안쪽 좌표 0..1) */
      const CRACKS = [0, 1, 2].map((i) => {
        const r = rng(97 + i * 31), lines = [], n = 3 + i * 3, len = 0.12 + i * 0.16;
        for (let k = 0; k < n; k++) {
          let ang = (k / n) * Math.PI * 2 + r() * 0.6, px = 0, py = 0; const pts = [[0, 0]];
          const segs = 3 + Math.floor(r() * 3);
          for (let s = 0; s < segs; s++) { ang += (r() - 0.5) * 0.9; const l = (len / segs) * (0.7 + r() * 0.6); px += Math.cos(ang) * l * 0.5; py += Math.sin(ang) * l; pts.push([px, py]); }
          lines.push(pts);
        }
        return lines;
      });
      const SHARDS = (() => {
        const r = rng(7), rows = 6, out = [];
        const edge = [], cuts = [];
        for (let j = 0; j <= rows; j++) cuts.push(j === 0 ? 0 : j === rows ? 1 : j / rows + (r() - 0.5) * 0.06);
        for (let j = 0; j <= rows; j++) edge.push([cuts[j] + (j && j < rows ? (r() - 0.5) * 0.08 : 0), cuts[j] + (j && j < rows ? (r() - 0.5) * 0.08 : 0)]);
        for (let j = 0; j < rows; j++) {
          const mid = 0.35 + r() * 0.3;
          const a = edge[j], b = edge[j + 1];
          out.push({ pts: [[0, a[0]], [mid, (a[0] + a[1]) / 2], [mid, (b[0] + b[1]) / 2], [0, b[0]]], vx: -0.3 - r() * 0.4, rot: (r() - 0.5) * 1.6, d: r() * 120 });
          out.push({ pts: [[mid, (a[0] + a[1]) / 2], [1, a[1]], [1, b[1]], [mid, (b[0] + b[1]) / 2]], vx: 0.3 + r() * 0.4, rot: (r() - 0.5) * 1.6, d: r() * 120 });
        }
        return out;
      })();
      /* 단계별 일정: hits[i] = 충격 시작 시각(ms, -1 이면 이미 맞음), shatter, advice(고치기 전 판) */
      const FLY = 650;
      let step = 0, version = 0; /* 0 고친 후, 1 고치기 전 */
      const plan = () => {
        if (step <= 2) return { hits: [null, null, null], shatter: null, advice: null };
        if (step === 3) return { hits: [300, null, null], shatter: null, advice: null };
        if (step === 4) return { hits: [-1, 300, 1700], shatter: null, advice: null };
        if (step === 5) return { hits: [-1, -1, -1], shatter: 700, advice: null };
        return version === 0 ? { hits: [300, 1300, 2300], shatter: 3500, advice: null } : { hits: [null, null, null], shatter: null, advice: 500 };
      };
      const verChips = M.chips(api.controls, { title: "판 비교", items: ["고친 후 · 세 번 시험", "고치기 전 · 한마디로"], value: 0, onPick: (i) => { version = i; if (step !== 6) { const b = document.querySelectorAll("#steps button")[6]; if (b) b.click(); } else api.restart(); } });
      api.controls.append(M.el("p", { class: "hint" }, "판을 고르면 마지막 단계로 가서 처음부터 다시 재생합니다. 아래 대답이 어떤 속도로 바뀌는지 비교해 보세요."));
      let ui = { paneA: 0, desire: 0, dlg: 0 };

      return {
        setStep(s) { step = s; if (s !== 6) { version = 0; verChips.set(0); } },
        frame(t, dt) {
          const { x, w, h } = M.fit(cv), c = M.col();
          const narrow = isNarrow(w), P = plan();
          ui.paneA = follow(ui.paneA, step >= 1 ? 1 : 0, dt, 400);
          ui.desire = follow(ui.desire, step >= 2 ? 1 : 0, dt, 400);
          ui.dlg = follow(ui.dlg, step >= 2 ? 1 : 0, dt, 400);
          const GLASS = V("--ch7"), RED = c.b;
          const pad = 12;
          const dlgH = narrow ? 70 : 58, A = { y0: 6, y1: h - dlgH - 14 };
          /* 상처 카드 */
          const wcW = narrow ? w * 0.5 : Math.min(250, w * 0.3), wcH = narrow ? 84 : 76;
          const wcHot = step === 0;
          card(x, pad, A.y0 + 4, wcW, wcH, { fill: wcHot ? M.alpha(c.key, 0.22) : null });
          M.text(x, "상처 · 열두 살", pad + 12, A.y0 + 24, { size: 12, weight: 700, color: c.muted });
          para(x, "아버지 빵집이 기울자 동업자가 레시피를 들고 떠났다.", pad + 12, A.y0 + 44, wcW - 24, { size: narrow ? 12 : 13, weight: 600, color: c.ink, lh: narrow ? 16 : 18 });
          /* 판(거짓 믿음) */
          const PW = narrow ? 34 : 56, PX = Math.round(w * (narrow ? 0.43 : 0.5) - PW / 2);
          const plateH = 52, PY0 = A.y0 + (narrow ? wcH + 16 : 4) + plateH + 14, PH = Math.max(80, A.y1 - PY0 - 6);
          const plateW = Math.min(narrow ? w * 0.44 : 236, w - PX - pad);
          const plX = narrow ? w - pad - plateW - 2 : Math.max(PX + PW / 2 - plateW / 2, pad + wcW + 28), plY = PY0 - plateH - 12;
          const cardH = Math.min(62, (PH - 16) / 3), cgap = Math.min(14, (PH - cardH * 3) / 2);
          const c0y = PY0 + (PH - (cardH * 3 + cgap * 2)) / 2;
          const IMPY = [0, 1, 2].map((i) => (c0y + i * (cardH + cgap) + cardH / 2 - PY0) / PH);
          /* 시간 계산 */
          const hitDone = P.hits.map((s) => s != null && (s < 0 || t >= s + FLY));
          const crackP = P.hits.map((s) => (s == null ? 0 : s < 0 ? 1 : M.clamp((t - s - FLY) / 450, 0, 1)));
          const shatT = P.shatter != null ? t - P.shatter : -1;
          const advT = P.advice != null ? t - P.advice : -1;
          const gone = (shatT >= 0) || (advT >= FLY);
          const nHit = hitDone.filter(Boolean).length;
          let lvl = step < 2 ? 0 : nHit;
          if (shatT >= 0 || advT >= FLY) lvl = 4;
          /* 상처 → 믿음 화살표 */
          if (ui.paneA > 0.02) {
            x.save(); x.globalAlpha = ui.paneA;
            const ax0 = pad + wcW * 0.7, ay0 = A.y0 + 4 + wcH, ax1 = plX - 4, ay1 = plY + plateH / 2;
            if (!narrow) {
              x.strokeStyle = c.muted; x.lineWidth = 1.5; x.setLineDash([4, 4]);
              x.beginPath(); x.moveTo(pad + wcW + 2, A.y0 + 4 + wcH / 2); x.quadraticCurveTo(ax1 - 20, A.y0 + wcH / 2 + 4, ax1, ay1); x.stroke(); x.setLineDash([]);
              M.arrow(x, ax1 - 8, ay1 - 2, ax1, ay1, c.muted, 1.5);
            } else { M.arrow(x, ax0, ay0 + 2, ax0, ay0 + 10, c.muted, 1.5); void ax0; }
            x.restore();
          }
          /* 믿음 명판 */
          x.save(); x.globalAlpha = ui.paneA * (gone ? 0.35 : 1);
          card(x, plX, plY, plateW, plateH, { fill: M.alpha(GLASS, 0.18) });
          M.text(x, "거짓 믿음", plX + 12, plY + 19, { size: 12, weight: 700, color: c.muted });
          M.text(x, "\"남에게 기대면 빼앗긴다\"", plX + 12, plY + 40, { size: narrow ? 12.5 : 14, weight: 700, color: c.ink });
          if (gone) M.line(x, plX + 10, plY + 35, plX + plateW - 12, plY + 35, RED, 2);
          x.restore();

          /* 인물 */
          const hx2 = narrow ? w * 0.18 : Math.max(pad + 60, PX - Math.min(170, w * 0.2)), hy = PY0 + PH * 0.42, hr = narrow ? 20 : Math.min(30, PH * 0.12);
          const expr = lvl >= 4 ? "smile" : lvl >= 2 ? "worried" : step === 0 ? "sad" : "neutral";
          M.art.head(x, { cx: hx2, cy: hy, r: hr, who: "A", expr, view: "three-quarter-right" });
          /* 욕망 태그 */
          if (ui.desire > 0.02) {
            x.save(); x.globalAlpha = ui.desire * (lvl >= 4 ? 0.4 : 1);
            M.tag(x, narrow ? "욕망: 혼자 우승" : "욕망: 혼자 우승해서 증명", hx2, hy - hr * 2.1, { align: "center", fill: M.alpha(V("--ch3"), 0.25) });
            x.restore();
          }
          /* 판 그리기 */
          const drawPane = (alpha) => {
            x.save(); x.globalAlpha = alpha;
            M.rrect(x, PX + 2, PY0 + 3, PW, PH, 6); x.fillStyle = M.alpha(c.ink, 0.8); x.fill();
            M.rrect(x, PX, PY0, PW, PH, 6); x.fillStyle = tint(GLASS, 0.35); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.2; x.stroke();
            x.save(); M.rrect(x, PX, PY0, PW, PH, 6); x.clip();
            x.strokeStyle = M.alpha(c.surface, 0.8); x.lineWidth = 3;
            for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(PX + 6 + k * 10, PY0 + 20 + k * 30); x.lineTo(PX + PW - 8, PY0 + 4 + k * 30); x.stroke(); }
            /* 금 */
            CRACKS.forEach((lines, i) => {
              const p = crackP[i]; if (p <= 0) return;
              const ix = PX + PW, iy = PY0 + PH * IMPY[i];
              x.strokeStyle = c.ink; x.lineWidth = 1.3 - i * 0.1;
              lines.forEach((pts) => {
                x.beginPath();
                const n = Math.max(1, Math.ceil((pts.length - 1) * p));
                for (let k = 0; k <= n; k++) { const [qx, qy] = pts[k]; const X2 = ix - 4 + qx * PW * 2.2 - PW * 0.3, Y2 = iy + qy * PH; k ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2); }
                x.stroke();
              });
              M.dot(x, ix - 3, iy, 2.5 + i, c.ink);
            });
            x.restore();
            x.restore();
          };
          if (!gone) drawPane(ui.paneA);
          /* 부서지는 조각 */
          if (shatT >= 0) {
            SHARDS.forEach((s) => {
              const tt = Math.max(0, (shatT - s.d) / 1000);
              const a = M.clamp(1 - tt * 0.9, 0, 1); if (a <= 0) return;
              const dy = 0.5 * 900 * tt * tt, dx = s.vx * 140 * tt, rot = s.rot * tt;
              x.save(); x.globalAlpha = a;
              const cx2 = PX + PW * 0.5 + dx, cy2 = PY0 + PH * ((s.pts[0][1] + s.pts[3][1]) / 2) + dy;
              x.translate(cx2, cy2); x.rotate(rot); x.translate(-(PX + PW * 0.5), -(PY0 + PH * ((s.pts[0][1] + s.pts[3][1]) / 2)));
              x.beginPath(); s.pts.forEach(([u, v], k) => (k ? x.lineTo(PX + u * PW, PY0 + v * PH) : x.moveTo(PX + u * PW, PY0 + v * PH))); x.closePath();
              x.fillStyle = tint(GLASS, 0.35); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
              x.restore();
            });
            /* 준이 미는 손짓 화살표 */
            const pa = M.clamp(1 - Math.abs(shatT - 0) / 600, 0, 1);
            if (pa > 0) M.arrow(x, hx2 + hr * 1.4, hy, PX - 6, hy, M.alpha(c.ink, pa), 2.5);
          }
          if (advT >= FLY) { /* 고치기 전: 통째로 사라짐 */
            const a = M.clamp(1 - (advT - FLY) / 250, 0, 1);
            if (a > 0) drawPane(a * ui.paneA);
          }
          /* 필요 */
          const needA = shatT >= 0 ? M.clamp((shatT - 600) / 500, 0, 1) : advT >= FLY ? M.clamp((advT - FLY) / 300, 0, 1) : 0;
          if (needA > 0) {
            x.save(); x.globalAlpha = needA;
            const nw = Math.min(narrow ? 150 : 200, w * 0.36), nh = 58, nx = PX + PW / 2 - nw / 2, ny = PY0 + PH * 0.38;
            card(x, nx, ny, nw, nh, { fill: M.alpha(V("--ch1"), 0.3) });
            M.text(x, "필요", nx + 12, ny + 19, { size: 12, weight: 700, color: c.muted });
            para(x, "믿고 기대도 되는 사람이 있다", nx + 12, ny + 39, nw - 24, { size: narrow ? 12 : 13, weight: 700, color: c.ink, lh: 16 });
            x.restore();
          }
          /* 오른쪽: 시험 사건 카드 + 날아가는 돌 */
          const evX = narrow ? PX + PW + 14 : Math.max(PX + PW + 40, w * 0.66), evW = w - pad - evX - 2;
          const list = step === 6 && version === 1 ? [ADVICE, null, null] : TESTS;
          list.forEach((ev, i) => {
            const cy0 = c0y + i * (cardH + cgap);
            const shown = step >= 3 || (step === 6);
            if (!ev) { M.rrect(x, evX, cy0, evW, cardH, 10); x.setLineDash([4, 4]); x.strokeStyle = c.muted; x.lineWidth = 1; x.stroke(); x.setLineDash([]); M.text(x, "시험 없음", evX + 12, cy0 + cardH / 2 + 4, { size: 12, color: c.muted }); return; }
            const isAdv = ev === ADVICE;
            const start = isAdv ? P.advice : P.hits[i];
            const active = start != null;
            x.save(); x.globalAlpha = shown ? (active ? 1 : 0.45) : 0.18;
            card(x, evX, cy0, evW, cardH, { fill: active && (isAdv ? advT >= FLY : hitDone[i]) ? M.alpha(RED, 0.12) : null });
            M.text(x, ev.lv, evX + 12, cy0 + 17, { size: 12, weight: 700, color: c.muted });
            const lines = para(x, ev.tx, evX + 12, cy0 + 35, evW - 22, { size: narrow ? 12 : 12.5, weight: 600, color: c.ink, lh: 15 });
            if (cardH >= 56 && lines === 1 && (isAdv ? advT >= FLY : hitDone[i])) M.text(x, "→ " + ev.cost, evX + 12, cy0 + 52, { size: 12, weight: 700, color: RED });
            x.restore();
            /* 돌 */
            if (active) {
              const s0 = start < 0 ? -1 : t - start;
              if (s0 >= 0 && s0 < FLY) {
                const p = M.ease.in(s0 / FLY), sx = evX - 6, sy = cy0 + cardH / 2, ex = PX + PW + 4, ey = PY0 + PH * IMPY[i];
                const bx = M.lerp(sx, ex, p), by = M.lerp(sy, ey, p) - Math.sin(p * Math.PI) * 18;
                M.dot(x, bx, by, 5 + i * 1.5, RED, c.ink);
              }
            }
          });
          /* 작은 돌이 튕겨 나감 (믿음이 지켜 줌) */
          if (step === 1 || step === 2) {
            for (let k = 0; k < 4; k++) {
              const T0 = 300 + k * 700, tt = (t - T0) / 900;
              if (tt < 0 || tt > 1) continue;
              const iy = PY0 + PH * (0.2 + 0.18 * k);
              const sx = PX + PW + Math.min(160, w * 0.18), ex = PX + PW + 3;
              let bx, by;
              if (tt < 0.5) { const p = tt / 0.5; bx = M.lerp(sx, ex, p); by = iy; }
              else { const p = (tt - 0.5) / 0.5; bx = ex + p * 60; by = iy + p * p * 70; }
              x.save(); x.globalAlpha = Math.min(1, (1 - tt) * 3) * ui.paneA; M.dot(x, bx, by, 3.5, c.muted, c.ink); x.restore();
            }
            if (step === 1 && !narrow) M.callout(x, "작은 상처는 막아 준다", PX + PW + 4, PY0 + PH * 0.2, PX + PW + 70, PY0 - 2, {});
          }
          /* 설득력 (고치기 전/후) */
          if (step === 6) {
            const conv = version === 0 ? M.clamp(nHit / 3, 0, 1) * 0.6 + (lvl >= 4 ? 0.3 : 0) : (lvl >= 4 ? 0.12 : 0);
            const gw = narrow ? 90 : 130, gx = w - pad - gw - 2, gy = A.y0 + 14;
            M.text(x, "설득력", gx - 8, gy + 9, { size: 12, weight: 700, color: c.ink, align: "right" });
            M.rrect(x, gx, gy, gw, 12, 6); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
            if (conv > 0.01) { M.rrect(x, gx, gy, Math.max(12, gw * conv), 12, 6); x.fillStyle = M.alpha(conv < 0.3 ? RED : V("--c"), 0.6); x.fill(); }
            M.text(x, version === 0 ? "시험 " + nHit + "번 · 대가 누적" : "시험 0번 · 대가 없음", w - pad - 2, gy + 30, { size: 12, color: c.muted, align: "right" });
          }
          /* 아래: 같은 상황, 다른 대답 */
          const dy0 = h - dlgH - 6;
          x.save(); x.globalAlpha = Math.max(0.25, ui.dlg);
          card(x, pad, dy0, w - pad * 2 - 2, dlgH, {});
          M.text(x, "같은 상황", pad + 14, dy0 + 22, { size: 12, weight: 700, color: c.muted });
          M.text(x, "동생: \"형, 내가 맛봐 줄까?\"", pad + 14, dy0 + 43, { size: narrow ? 12 : 13, weight: 600, color: c.ink });
          const rx = narrow ? pad + 14 : Math.max(pad + 230, w * 0.42);
          const ry = narrow ? dy0 + 62 : dy0 + 43;
          M.text(x, "준:", rx, ry, { size: 13, weight: 700, color: c.ink });
          M.text(x, ui.dlg > 0.5 ? REPLY[lvl] : "…", rx + 26, ry, { size: narrow ? 12.5 : 14, weight: 700, color: lvl >= 4 ? V("--c") : c.ink });
          if (!narrow) {
            for (let k = 0; k <= 4; k++) M.dot(x, rx + 28 + k * 14, dy0 + 20, 4, k <= lvl ? (k === 4 ? V("--c") : c.ink) : c.sunk, c.ink);
            M.text(x, "믿음의 금", rx + 28 + 5 * 14 + 4, dy0 + 24, { size: 12, color: c.muted });
          }
          x.restore();
        },
      };
    },
  });

  /* =====================================================================
     2-1 3막 구조와 긴장 곡선
     ===================================================================== */
  LESSONS.push({
    id: "three-act", ch: 2, order: 1,
    title: "3막 구조와 긴장 곡선",
    lede: "이 레슨을 마치면 발단 사건·1막 전환점·미드포인트·위기·클라이맥스·결말 여섯 지점이 긴장 곡선을 어떻게 끌어올리는지, 그리고 지점이 빠지거나 늦으면 왜 이야기가 처지는지 알게 됩니다.",
    key: "구조는 채울 양식이 아니라 독자가 '이쯤 뭔가 바뀌겠지' 하고 기대하는 지점의 지도입니다. 사건 사이가 너무 멀면 긴장이 식고, 그래서 긴 2막을 미드포인트로 가릅니다.",
    steps: [
      ["처음·중간·끝", "이야기를 <b>설정–대립–해결</b> 세 덩어리로 나눈 것이 3막 구조입니다. 평균 비율은 1막 25%, 2막 50%, 3막 25%입니다. 아직 사건이 없어서 긴장 곡선이 바닥에 깔려 있습니다."],
      ["발단 사건", "1번 점, <b>발단 사건</b>이 일상을 깹니다. 곡선이 뛰어오르지만, 뒤따르는 사건이 없으니 금세 식습니다. 빨간 띠가 긴장이 식어 가는 <b>처짐</b> 구간입니다. 사건 하나로는 이야기를 오래 끌 수 없습니다."],
      ["1막 전환점", "2번 점에서 주인공이 <b>스스로 선택해</b> 되돌릴 수 없는 새 상황에 들어섭니다. 이 문을 지나면 1막이 끝납니다. 우연히 휩쓸려 들어가는 것은 전환점이 아닙니다. 선택과 되돌릴 수 없음이 핵심입니다."],
      ["위기와 클라이맥스, 그리고 구멍", "4·5·6번 점(위기·클라이맥스·결말)을 넣었습니다. 그런데 2막 한가운데가 텅 비어 빨간 <b>중반 처짐</b>이 생겼습니다. 2막은 가장 길어서 한 덩어리로 쓰면 같은 종류의 사건이 반복되며 늘어집니다."],
      ["미드포인트", "3번 점, <b>미드포인트</b>에서 판이 뒤집힙니다(거짓 승리, 거짓 패배, 큰 진실). 처짐이 사라지고 2막이 전반(반응·탐색)과 후반(능동·압박)으로 갈렸습니다. '직접 해보기'에서 미드포인트를 빼고 다시 넣어 보세요."],
      ["긴장과 형편은 다르다", "점선은 주인공의 <b>형편</b>(일이 잘 풀리는 정도)입니다. 미드포인트에서 잠깐 좋아졌다가 <b>위기</b>에서 바닥을 칩니다. 형편이 최저일 때 긴장은 오히려 높습니다. 클라이맥스에서 둘이 함께 결판나고, 결말에서 긴장이 풀립니다."],
      ["직접 옮겨 보기", "번호 점을 좌우로 끌어 보세요. 발단을 20% 가까이 뒤로 밀면 '발단이 늦다' 경고와 함께 앞부분이 처지고, 미드포인트를 위기 쪽으로 붙이면 2막 전반이 처집니다. 위쪽 숫자가 지금의 막 비율입니다. 웹소설은 1막을 1~3화에 압축하는 경우가 많습니다."],
    ],
    terms: [
      ["3막 구조", "Three-act structure", "이야기를 설정·대립·해결로 나누는 틀. 아리스토텔레스의 '처음·중간·끝'에서 출발해 시나리오 작법에서 다듬어졌습니다."],
      ["발단 사건", "Inciting incident", "일상을 깨고 주인공의 욕망을 깨우는 사건. 늦으면 독자가 \"언제 시작해?\"라고 느낍니다."],
      ["전환점", "Plot point", "이야기를 다음 국면으로 넘기는 사건. 1막 전환점은 주인공의 되돌릴 수 없는 선택입니다."],
      ["미드포인트", "Midpoint", "2막 한가운데에서 판이 뒤집히는 지점. 거짓 승리·거짓 패배·큰 진실 공개가 흔합니다."],
      ["클라이맥스", "Climax", "중심 갈등이 가장 높은 긴장 속에서 결판나는 장면. 주인공의 선택으로 풀려야 납득됩니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      const EV0 = [
        { k: "inc", name: "발단 사건", short: "발단", p: 0.1, s: 0.32 },
        { k: "pp1", name: "1막 전환점", short: "전환", p: 0.25, s: 0.24 },
        { k: "mid", name: "미드포인트", short: "미드", p: 0.5, s: 0.26 },
        { k: "cri", name: "위기", short: "위기", p: 0.75, s: 0.24 },
        { k: "cli", name: "클라이맥스", short: "클라", p: 0.88, s: 0.42 },
        { k: "res", name: "결말", short: "결말", p: 0.96, s: -0.7 },
      ];
      const ev = EV0.map((e) => ({ ...e, x: e.p, show: 0 }));
      const VIS = [[], ["inc"], ["inc", "pp1"], ["inc", "pp1", "cri", "cli", "res"], ["inc", "pp1", "mid", "cri", "cli", "res"], ["inc", "pp1", "mid", "cri", "cli", "res"], ["inc", "pp1", "mid", "cri", "cli", "res"]];
      let step = 0, noMid = false, fortune = false, drag = null, hover = -1;
      const midChk = M.check(api.controls, { id: "taNoMid", label: "미드포인트 빼기", onChange: (v) => (noMid = v) });
      const forChk = M.check(api.controls, { id: "taFor", label: "주인공의 형편 겹쳐 보기", onChange: (v) => (fortune = v) });
      api.controls.append(M.el("p", { class: "hint" }, "무대의 번호 점을 좌우로 끌면 사건 위치가 바뀌고, 긴장 곡선과 막 비율, 처짐 구간이 함께 다시 계산됩니다."));
      const rd = M.readout(api.controls);
      let fOn = 0;

      const visible = () => ev.filter((e) => VIS[step].includes(e.k) && !(noMid && e.k === "mid"));
      /* 긴장 시뮬레이션: 사건마다 뛰어오르고, 다음 사건까지 바닥값으로 식음 */
      const N = 240;
      function simulate(list) {
        const T = new Float32Array(N + 1), F = new Float32Array(N + 1);
        const sorted = list.slice().sort((a, b) => a.x - b.x);
        let v = 0.06, floor = 0.06, j = 0, fort = 0.5;
        const tau = 0.085;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          while (j < sorted.length && sorted[j].x <= t) {
            const e = sorted[j];
            if (e.s < 0) { floor = 0.05; v = Math.max(0.12, v + e.s * 0.5); }
            else { v = Math.min(0.98, v + e.s * (1 - v * 0.35)); floor = Math.max(floor, v * 0.6); }
            j++;
          }
          v += (floor - v) * (1 - Math.exp(-(1 / N) / tau));
          T[i] = v;
        }
        const T2 = new Float32Array(N + 1);
        for (let i = 0; i <= N; i++) { let a = 0, n = 0; for (let k = -2; k <= 2; k++) { const q = i + k; if (q >= 0 && q <= N) { a += T[q]; n++; } } T2[i] = a / n; }
        T.set(T2);
        /* 형편: 미드포인트에서 오르고 위기에서 바닥, 클라이맥스 뒤 회복 */
        const at = (k) => (sorted.find((e) => e.k === k) || {}).x;
        const keys = [[0, 0.55]];
        const inc = at("inc"), mid = at("mid"), cri = at("cri"), cli = at("cli");
        if (inc != null) keys.push([inc, 0.4]);
        if (mid != null) keys.push([mid, 0.72]);
        if (cri != null) keys.push([cri, 0.08]);
        if (cli != null) keys.push([cli, 0.85]);
        keys.push([1, cli != null ? 0.9 : keys[keys.length - 1][1]]);
        keys.sort((a, b) => a[0] - b[0]);
        for (let i = 0; i < keys.length - 1; i++) if (keys[i + 1][0] - keys[i][0] < 1e-3) keys[i + 1][0] = keys[i][0] + 1e-3;
        for (let i = 0; i <= N; i++) F[i] = mono(keys, i / N);
        void fort;
        return { T, F, sorted };
      }
      /* 처짐: 사건 사이 간격이 0.27 넘으면 그 뒤쪽을 표시. 발단이 0.15보다 늦으면 앞부분 */
      function sags(sorted) {
        const out = [];
        const pos = sorted.filter((e) => e.s > 0);
        const inc = pos.find((e) => e.k === "inc");
        if (inc && inc.x > 0.15) out.push({ a: 0.03, b: inc.x, label: "발단이 늦다" });
        for (let i = 0; i < pos.length; i++) {
          const a = pos[i].x, b = i + 1 < pos.length ? pos[i + 1].x : (sorted.find((e) => e.s < 0) || { x: 1 }).x;
          if (b - a > 0.27) out.push({ a: a + 0.12, b, label: i === 0 && pos.length === 1 ? "처짐" : (a < 0.5 && b > 0.5 ? "중반 처짐" : "처짐") });
        }
        return out;
      }

      let geo = null;
      const pick = (mx) => {
        if (!geo) return -1;
        let best = -1, bd = 18;
        visible().forEach((e) => { const d = Math.abs(geo.X(e.x) - mx); if (d < bd) { bd = d; best = ev.indexOf(e); } });
        return best;
      };
      const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener("pointerdown", (e) => { const [mx, my] = local(e); if (!geo || my < geo.G.y - 10 || my > geo.G.y + geo.G.h + 40) return; const i = pick(mx); if (i >= 0) { drag = i; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; } });
      cv.addEventListener("pointermove", (e) => {
        const [mx] = local(e);
        if (drag == null) { hover = pick(mx); cv.style.cursor = hover >= 0 ? "grab" : "default"; return; }
        const vis = visible().sort((a, b) => a.x - b.x), me = ev[drag], k = vis.indexOf(me);
        const lo = k > 0 ? vis[k - 1].x + 0.03 : 0.02, hi = k < vis.length - 1 ? vis[k + 1].x - 0.03 : 0.995;
        me.x = M.clamp((mx - geo.G.x) / geo.G.w, lo, hi);
      });
      const end = () => { drag = null; cv.style.cursor = "default"; };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);

      return {
        setStep(s) {
          step = s; noMid = false; midChk.set(false);
          fortune = s === 5; forChk.set(fortune);
          if (s < 6) ev.forEach((e) => (e.x = e.p));
        },
        frame(t, dt) {
          const { x, w, h } = M.fit(cv), c = M.col();
          const narrow = isNarrow(w);
          const vis = visible();
          ev.forEach((e) => (e.show = follow(e.show, vis.includes(e) ? 1 : 0, dt, 300)));
          fOn = follow(fOn, fortune ? 1 : 0, dt, 300);
          const sim = simulate(vis), sg = sags(sim.sorted);
          const pad = 12, top = 40, bottom = narrow ? 66 : 56;
          const G = { x: pad + (narrow ? 8 : 34), y: top + 22, w: w - pad * 2 - (narrow ? 12 : 40), h: h - top - 22 - bottom };
          const X = (t2) => G.x + t2 * G.w, Y = (v) => G.y + G.h - v * G.h;
          geo = { G, X };
          /* 막 경계 */
          const pp1 = vis.find((e) => e.k === "pp1"), cri = vis.find((e) => e.k === "cri");
          const b1 = pp1 ? pp1.x : 0.25, b2 = cri ? cri.x : 0.75;
          card(x, G.x, G.y, G.w, G.h, { shadow: false, stroke: c.line });
          const ACTS = [[0, b1, "1막 · 설정", "--ch0"], [b1, b2, "2막 · 대립", "--ch2"], [b2, 1, "3막 · 해결", "--ch6"]];
          ACTS.forEach(([a, b, name, col], i) => {
            x.fillStyle = M.alpha(V(col), 0.13); x.fillRect(X(a), G.y + 1, X(b) - X(a), G.h - 2);
            const pct = Math.round((b - a) * 100);
            const label = narrow ? `${i + 1}막 ${pct}%` : `${name}  ${pct}%`;
            M.text(x, label, (X(a) + X(b)) / 2, G.y - 9, { size: 12.5, weight: 700, color: c.ink, align: "center" });
            if (i) M.line(x, X(a), G.y - 4, X(a), G.y + G.h, c.ink, 1, (i === 1 && !pp1) || (i === 2 && !cri) ? [4, 4] : null);
          });
          if (!narrow) M.text(x, "긴장", G.x - 6, G.y + 12, { size: 12, align: "right", color: c.muted });
          /* 막 비율 → 머리줄 */
          const ratio = `1막 ${Math.round(b1 * 100)}% · 2막 ${Math.round((b2 - b1) * 100)}% · 3막 ${Math.round((1 - b2) * 100)}%`;
          M.text(x, "긴장 곡선", pad, 18, { size: 13, weight: 700, color: c.ink });
          if (!narrow) M.text(x, ratio, w - pad, 18, { size: 12, mono: true, weight: 600, color: c.muted, align: "right" });
          /* 처짐 구간 */
          sg.forEach((s) => {
            x.fillStyle = M.alpha(c.b, 0.14); x.fillRect(X(s.a), G.y + 1, X(s.b) - X(s.a), G.h - 2);
            x.save(); x.strokeStyle = M.alpha(c.b, 0.5); x.setLineDash([3, 3]); x.strokeRect(X(s.a) + 0.5, G.y + 1.5, X(s.b) - X(s.a) - 1, G.h - 3); x.restore();
            const lw = X(s.b) - X(s.a);
            if (lw > 54) M.tag(x, s.label, (X(s.a) + X(s.b)) / 2, G.y + 18, { align: "center", color: c.b, size: 12 });
          });
          /* 형편 곡선 */
          if (fOn > 0.02) {
            x.save(); x.globalAlpha = fOn; x.strokeStyle = V("--ch7"); x.lineWidth = 2.5; x.setLineDash([7, 5]);
            x.beginPath(); for (let i = 0; i <= N; i++) { const yy = Y(sim.F[i] * 0.92 + 0.02); i ? x.lineTo(X(i / N), yy) : x.moveTo(X(i / N), yy); } x.stroke();
            x.restore();
            if (!narrow) { x.save(); x.globalAlpha = fOn; M.text(x, "점선: 주인공의 형편", G.x + 8, G.y + G.h - 8, { size: 12, weight: 700, color: V("--ch7") }); x.restore(); }
          }
          /* 긴장 곡선 */
          x.save(); x.beginPath();
          for (let i = 0; i <= N; i++) { const yy = Y(sim.T[i]); i ? x.lineTo(X(i / N), yy) : x.moveTo(X(i / N), yy); }
          x.lineTo(X(1), Y(0)); x.lineTo(X(0), Y(0)); x.closePath(); x.fillStyle = M.alpha(c.key, 0.16); x.fill();
          x.beginPath(); for (let i = 0; i <= N; i++) { const yy = Y(sim.T[i]); i ? x.lineTo(X(i / N), yy) : x.moveTo(X(i / N), yy); }
          x.strokeStyle = c.ink; x.lineWidth = 2.6; x.lineJoin = "round"; x.stroke(); x.restore();
          /* 사건 점 + 이름 */
          const sorted = ev.filter((e) => e.show > 0.02).sort((a, b) => a.x - b.x);
          sorted.forEach((e, k) => {
            const i = EV0.findIndex((q) => q.k === e.k);
            const vi = Math.round(e.x * N), yy = Y(sim.T[Math.min(N, vi + 2)]);
            x.save(); x.globalAlpha = e.show;
            M.line(x, X(e.x), yy, X(e.x), G.y + G.h, M.alpha(c.ink, 0.35), 1, [2, 3]);
            const hot = drag === i || hover === i;
            M.dot(x, X(e.x), yy, hot ? 12 : 10.5, hot ? c.key : c.surface, c.ink);
            M.text(x, String(i + 1), X(e.x), yy + 4.5, { size: 12, weight: 800, align: "center", mono: true, color: c.ink });
            const row = k % 2, ly = G.y + G.h + 18 + row * 17;
            const lbl = narrow ? e.short : e.name;
            M.text(x, lbl, M.clamp(X(e.x), G.x + 24, G.x + G.w - 24), ly, { size: 12, weight: 700, align: "center", color: c.ink });
            x.restore();
          });
          rd.innerHTML = `<b>막 비율</b>  ${ratio}\n<b>처짐 구간</b>  ${sg.length ? sg.map((s) => `${s.label} ${Math.round(s.a * 100)}–${Math.round(s.b * 100)}%`).join(", ") : "없음"}`;
        },
      };
    },
  });

  /* =====================================================================
     2-2 기승전결과 3막
     ===================================================================== */
  LESSONS.push({
    id: "kishotenketsu", ch: 2, order: 2,
    title: "기승전결과 3막",
    lede: "이 레슨을 마치면 기승전결 네 칸이 각각 무슨 일을 하는지, 3막 구조와 무게중심이 어떻게 다른지, 그리고 한 작품 안에서 두 틀을 어느 크기에 쓰는지 알게 됩니다.",
    key: "3막은 대결과 상승에, 기승전결은 전(轉)의 뒤집기에 무게를 둡니다. 둘은 경쟁하는 이론이 아니라 해상도가 다른 렌즈이고, 구조는 작품·아크·회차·장면으로 크기를 바꿔 반복됩니다.",
    steps: [
      ["기(起): 일으킨다", "네 칸짜리 짧은 이야기를 한 칸씩 봅니다. 첫 칸 <b>기</b>는 인물과 상황을 세웁니다. 비 오는 정류장, 어제 우산을 잃어버린 지우에게 오늘도 우산이 없습니다. 아래 막대는 칸마다 <b>의미가 얼마나 뒤집히는지</b>입니다."],
      ["승(承): 이어받는다", "<b>승</b>은 상황을 이어받아 키웁니다. 낯선 아저씨가 다가와 우산을 씌워 줍니다. 이야기가 한 걸음 나아갔지만 아직 예상 안쪽이라, 의미 막대는 조금만 오릅니다."],
      ["전(轉): 뒤집는다", "<b>전</b>에서 방향이 꺾입니다. 우산 손잡이에 붙은 이름표에 '지우'라고 적혀 있습니다. 아저씨가 쓰던 우산이 어제 지우가 잃어버린 그 우산이었습니다. 싸움이나 대결은 없는데도 <b>같은 장면의 의미가 뒤집혀</b> 막대가 치솟습니다."],
      ["결(結): 맺는다", "<b>결</b>은 뒤집힌 의미를 정리하고 여운을 남깁니다. 지우는 웃으며 \"오늘은 빌려 드릴게요\" 하고 버스로 뜁니다. '직접 해보기'에서 <b>전 빼고 보기</b>를 켜면 3칸이 밋밋한 이어짐으로 바뀌고, 4칸까지 의미 막대가 바닥에 머뭅니다."],
      ["3막과 나란히", "아래 띠는 네 칸을 3막에 맞춘 것입니다. 기는 1막, 승은 2막 전반, 전은 2막 후반에서 위기, 결은 3막에 대응합니다. 곡선 둘을 비교하면 <b>3막</b>은 대결로 치닫는 클라이맥스에, <b>기승전결</b>은 전의 뒤집기에 꼭짓점이 있습니다."],
      ["구조는 크기를 바꿔 반복된다", "같은 모양이 크기를 바꿔 반복됩니다. 작품 전체에 3막이 있고, 그 안의 아크(부)에도 3막이 있고, 한 회차는 끝에 훅을 단 작은 기승전결, 한 장면은 목표·갈등·결과로 움직입니다. 장편의 큰 뼈대는 3막으로, 회차처럼 짧은 단위는 기승전결로 짜기 편합니다."],
    ],
    terms: [
      ["기승전결", "Kishōtenketsu", "한시 절구의 구성법에서 온 4단 구성. 기(일으킴)·승(이어받음)·전(뒤집음)·결(맺음)로, 전에서 관점이나 의미가 바뀝니다."],
      ["전(轉)", "Twist / Turn", "기승전결의 셋째 칸. 대결 없이도 예상 밖의 방향으로 틀어 앞 장면의 의미를 바꿉니다."],
      ["훅", "Hook", "회차 끝에 걸어 다음 회를 읽게 만드는 질문이나 사건. 연재에서는 회차 기승전결의 '결' 자리에 자주 놓입니다."],
      ["아크", "Arc", "연재에서 하나의 목표와 결말을 갖는 큰 구간(부·편). 작품 전체의 3막 안에 아크마다 작은 3막이 들어갑니다."],
    ],
    mount(api) {
      const cv = api.canvas("fill"); tall(cv, 640);
      const PAN = [
        { k: "기", cap: "어제 우산을 잃어버린 지우. 오늘도 비가 온다." },
        { k: "승", cap: "낯선 아저씨가 다가와 우산을 씌워 준다." },
        { k: "전", cap: "손잡이 이름표에 '지우'라고 적혀 있다.", alt: "비가 조금 잦아든다." },
        { k: "결", cap: "\"그 우산, 오늘은 빌려 드릴게요!\"", alt: "버스가 와서 둘 다 탄다." },
      ];
      const MEAN = [0.1, 0.25, 0.92, 0.55], MEAN_ALT = [0.1, 0.25, 0.18, 0.12];
      let step = 0, noTen = false;
      const cur = { pan: [0, 0, 0, 0], alt: 0, low: 0, fr: 0, mean: [0, 0, 0, 0] };
      const chk = M.check(api.controls, { id: "ktNoTen", label: "전(轉) 빼고 보기", onChange: (v) => (noTen = v) });
      api.controls.append(M.el("p", { class: "hint" }, "켜면 셋째·넷째 칸이 뒤집기 없는 이어짐으로 바뀝니다. 사건은 그대로 흘러가는데 의미 막대가 오르지 않는 것을 보세요."));
      const UMB = "#e0b154", UMB2 = "#c8953c", WOOD = "#8e6441", TAG = "#efe6d6";

      /* 우산: 위에서 본 반원 덮개 + 손잡이 */
      const umbrella = (x, cx, cy, R, handleY) => {
        const c = M.col();
        x.save();
        x.strokeStyle = "#3b2f29"; x.lineWidth = Math.max(1.5, R * 0.05);
        x.beginPath(); x.moveTo(cx, cy - R * 0.1); x.lineTo(cx, handleY); x.stroke();
        x.beginPath(); x.arc(cx - R * 0.09, handleY, R * 0.09, 0, Math.PI); x.stroke();
        x.beginPath();
        x.moveTo(cx - R, cy);
        x.quadraticCurveTo(cx - R, cy - R * 0.72, cx, cy - R * 0.75);
        x.quadraticCurveTo(cx + R, cy - R * 0.72, cx + R, cy);
        const n = 4;
        for (let i = n; i > 0; i--) { const a = cx - R + (2 * R * i) / n, b = cx - R + (2 * R * (i - 1)) / n; x.quadraticCurveTo((a + b) / 2, cy - R * 0.14, b, cy); }
        x.closePath(); x.fillStyle = UMB; x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.2; x.stroke();
        x.beginPath(); x.moveTo(cx, cy - R * 0.75); x.lineTo(cx - R * 0.5, cy); x.moveTo(cx, cy - R * 0.75); x.lineTo(cx + R * 0.5, cy); x.strokeStyle = UMB2; x.lineWidth = 1; x.stroke();
        x.restore();
      };
      const rain = (x, r, t, amt) => {
        x.save(); x.strokeStyle = M.alpha(V("--ch7"), 0.65); x.lineWidth = 1.2;
        const n = Math.round((r.w * r.h) / 1400 * amt);
        for (let i = 0; i < n; i++) {
          const sx = ((i * 73.13) % 1) * (r.w + 40) - 20, sp = 0.9 + ((i * 37.7) % 1) * 0.6;
          const y = (((t / 900) * sp + (i * 0.618)) % 1) * (r.h + 30) - 15;
          x.beginPath(); x.moveTo(r.x + sx, r.y + y); x.lineTo(r.x + sx - 4, r.y + y + 11); x.stroke();
        }
        x.restore();
      };
      function drawPanel(x, r, i, t, alt) {
        const c = M.col();
        x.save(); M.rrect(x, r.x, r.y, r.w, r.h, 8); x.clip();
        x.fillStyle = tint(V("--ch7"), alt && i >= 2 ? 0.1 : 0.2); x.fillRect(r.x, r.y, r.w, r.h);
        const capH = Math.min(52, r.h * 0.3), gy = r.y + r.h - capH - 8;
        x.fillStyle = tint(c.muted, 0.22); x.fillRect(r.x, gy, r.w, r.h - (gy - r.y));
        const H = Math.min(r.h * 0.7, (gy - r.y) * 0.8);
        const pole = (px) => { M.line(x, px, gy, px, gy - H * 0.95, "#5b5f66", 3); M.dot(x, px, gy - H * 0.95, H * 0.1, V("--ch7"), c.ink); };
        if (i === 2 && !alt) {
          /* 손잡이 클로즈업 */
          rain(x, r, t, 0.5);
          const hx2 = r.x + r.w * 0.62, hy2 = r.y + (gy - r.y) * 0.32, s = Math.min(r.w, gy - r.y) * 0.5;
          x.save(); x.strokeStyle = WOOD; x.lineWidth = s * 0.14; x.lineCap = "round";
          x.beginPath(); x.moveTo(hx2, r.y - 4); x.lineTo(hx2, hy2 + s * 0.35); x.arc(hx2 - s * 0.22, hy2 + s * 0.35, s * 0.22, 0, Math.PI); x.stroke();
          x.strokeStyle = c.ink; x.lineWidth = 1; x.restore();
          /* 이름표 */
          const tw = s * 0.62, th = s * 0.34, tx = hx2 - s * 0.55 - tw / 2, ty = hy2 + s * 0.05;
          M.line(x, hx2 - 2, hy2 - s * 0.05, tx + tw * 0.8, ty + 3, "#3b2f29", 1.2);
          x.save(); x.translate(tx + tw / 2, ty + th / 2); x.rotate(-0.12);
          M.rrect(x, -tw / 2, -th / 2, tw, th, 4); x.fillStyle = TAG; x.fill(); x.strokeStyle = "#3b2f29"; x.lineWidth = 1.2; x.stroke();
          x.font = M.font(Math.max(12, th * 0.5), "ui", 800); x.fillStyle = "#2a1d18"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("지우", 0, 1);
          x.restore();
          const pop = M.clamp((t - 300) / 500, 0, 1);
          if (pop > 0) { x.save(); x.globalAlpha = pop; M.text(x, "!", tx + tw * 0.15, ty - 10, { size: Math.max(16, s * 0.2), weight: 800, color: c.b, align: "center" }); x.restore(); }
          M.art.head(x, { cx: r.x + r.w * 0.22, cy: gy - (gy - r.y) * 0.22, r: Math.min(r.w * 0.13, (gy - r.y) * 0.17), who: "B", expr: "surprised", view: "three-quarter-right" });
        } else {
          rain(x, r, t, i === 3 ? (alt ? 0.25 : 0.45) : alt && i === 2 ? 0.45 : 1);
          pole(r.x + r.w * 0.1);
          const gx = r.x + r.w * (i === 0 ? 0.45 : i === 3 && !alt ? 0.72 : 0.4);
          const gH = H * 0.66;
          const gExpr = i === 0 ? "worried" : i === 1 ? "surprised" : i === 3 && !alt ? "smile" : "neutral";
          if (i >= 1) {
            const fin = i === 3 && !alt;
            const mx = r.x + r.w * (fin ? 0.3 : 0.68), mH = H * 0.92;
            const hx3 = fin ? mx + 0.1 * mH : mx - 0.085 * mH, hy3 = gy - 0.47 * mH;
            const R = Math.min(r.w * (fin ? 0.22 : 0.36), mH * 0.48), cy = gy - mH * 1.02;
            M.art.person(x, { cx: mx, cy: gy, h: mH, who: "A", view: fin ? "front" : "three-quarter-left", expr: fin ? "smile" : "neutral" });
            umbrella(x, hx3, cy, R, hy3);
          }
          M.art.person(x, { cx: gx, cy: gy, h: gH, who: "B", view: i === 3 && !alt ? "profile-right" : "three-quarter-right", expr: gExpr, pose: i === 3 && !alt ? "walk" : "stand", phase: i === 3 && !alt ? (t / 900) % 1 : 0 });
          if (i === 3 && alt) { x.fillStyle = tint(V("--ch6"), 0.55); M.rrect(x, r.x + r.w * 0.82, gy - H * 0.75, r.w * 0.3, H * 0.75, 6); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke(); }
        }
        x.restore();
        /* 테두리 + 칸 이름 + 설명 */
        M.rrect(x, r.x, r.y, r.w, r.h, 8); x.strokeStyle = c.ink; x.lineWidth = 1.4; x.stroke();
        const p = PAN[i], txt = alt && p.alt ? p.alt : p.cap;
        x.fillStyle = c.surface; x.fillRect(r.x + 1, gy, r.w - 2, r.y + r.h - gy - 1);
        M.line(x, r.x, gy, r.x + r.w, gy, c.ink, 1);
        M.dot(x, r.x + 18, gy + 18, 12, alt && i >= 2 ? c.sunk : V("--ch2"), c.ink);
        M.text(x, p.k, r.x + 18, gy + 23, { size: 13, weight: 800, align: "center", color: c.ink });
        para(x, txt, r.x + 36, gy + 16, r.w - 44, { size: r.w < 150 ? 12 : 12.5, weight: 600, color: c.ink, lh: 15 });
      }

      return {
        setStep(s) { step = s; },
        frame(t, dt) {
          const { x, w, h } = M.fit(cv), c = M.col();
          const narrow = isNarrow(w);
          for (let i = 0; i < 4; i++) {
            cur.pan[i] = follow(cur.pan[i], step >= i ? 1 : 0, dt, 300);
            cur.mean[i] = follow(cur.mean[i], step >= i ? (noTen ? MEAN_ALT : MEAN)[i] : 0, dt, 400);
          }
          cur.alt = noTen ? 1 : 0;
          cur.low = follow(cur.low, step === 4 ? 1 : 0, dt, 300);
          cur.fr = follow(cur.fr, step === 5 ? 1 : 0, dt, 350);
          const pad = 10;

          /* 네 칸 */
          if (cur.fr < 0.99) {
            x.save(); x.globalAlpha = 1 - cur.fr;
            const cols = narrow ? 2 : 4, gap = 10;
            const pw = (w - pad * 2 - gap * (cols - 1)) / cols;
            const stripH = narrow ? Math.min(h * 0.62, (pw * 1.15) * 2 + gap) : Math.min(h * 0.66, pw * 1.5);
            const ph = narrow ? (stripH - gap) / 2 : stripH;
            for (let i = 0; i < 4; i++) {
              const r = { x: pad + (i % cols) * (pw + gap), y: 6 + Math.floor(i / cols) * (ph + gap), w: pw, h: ph };
              if (cur.pan[i] < 0.02) { M.rrect(x, r.x, r.y, r.w, r.h, 8); x.setLineDash([5, 5]); x.strokeStyle = c.muted; x.lineWidth = 1; x.stroke(); x.setLineDash([]); M.text(x, PAN[i].k, r.x + r.w / 2, r.y + r.h / 2 + 8, { size: 24, weight: 800, align: "center", color: M.alpha(c.muted, 0.6) }); continue; }
              x.save(); x.globalAlpha = (1 - cur.fr) * cur.pan[i];
              x.translate(0, (1 - cur.pan[i]) * 10);
              drawPanel(x, r, i, t, noTen);
              if (step === i) { M.rrect(x, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 11); x.strokeStyle = c.key; x.lineWidth = 2.5; x.stroke(); }
              x.restore();
            }
            /* 아래 영역 */
            const ly = 6 + stripH + 16, lh = h - ly - 8;
            const colW = pw + gap;
            if (cur.low < 0.99) {
              x.save(); x.globalAlpha = (1 - cur.fr) * (1 - cur.low);
              M.text(x, "의미가 뒤집히는 정도", pad, ly + 4, { size: 12.5, weight: 700, color: c.ink });
              const bh = Math.min(lh - (narrow ? 42 : 26), 120);
              for (let i = 0; i < 4; i++) {
                const cx = narrow ? pad + i * ((w - pad * 2) / 4) + (w - pad * 2) / 8 : pad + i * colW + pw / 2;
                const bw = narrow ? (w - pad * 2) / 4 - 14 : Math.min(pw * 0.5, 90);
                const v = cur.mean[i], y0 = ly + 14 + bh;
                M.rrect(x, cx - bw / 2, ly + 14, bw, bh, 6); x.fillStyle = c.sunk; x.fill(); x.strokeStyle = c.line; x.lineWidth = 1; x.stroke();
                if (v > 0.005) { M.rrect(x, cx - bw / 2, y0 - bh * v, bw, bh * v, 6); x.fillStyle = i === 2 && !noTen ? M.alpha(c.b, 0.6) : M.alpha(V("--ch2"), 0.6); x.fill(); x.strokeStyle = c.ink; x.stroke(); }
                if (narrow) M.text(x, PAN[i].k, cx, y0 + 16, { size: 12, weight: 700, align: "center", color: c.ink });
              }
              x.restore();
            }
            if (cur.low > 0.01) {
              x.save(); x.globalAlpha = (1 - cur.fr) * cur.low;
              const G = { x: pad, y: ly + 22, w: w - pad * 2, h: lh - 50 };
              const ACT = [["1막", "--ch0"], ["2막 전반", "--ch2"], ["2막 후반·위기", "--ch3"], ["3막", "--ch6"]];
              ACT.forEach(([name, col], i) => {
                const ax = G.x + (G.w / 4) * i, aw = G.w / 4 - 4;
                x.fillStyle = M.alpha(V(col), 0.18); M.rrect(x, ax, G.y + G.h + 6, aw, 22, 6); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
                M.text(x, (narrow ? "" : PAN[i].k + " → ") + name, ax + aw / 2, G.y + G.h + 21, { size: 12, weight: 700, align: "center", color: c.ink });
              });
              const K3 = [[0, 0.1], [0.12, 0.25], [0.25, 0.35], [0.5, 0.5], [0.75, 0.68], [0.88, 0.95], [0.96, 0.4], [1, 0.3]];
              const KK = [[0, 0.1], [0.25, 0.2], [0.5, 0.3], [0.62, 0.95], [0.75, 0.75], [0.9, 0.5], [1, 0.45]];
              const draw = (keys, col, dash, label, lx2) => {
                x.save(); x.strokeStyle = col; x.lineWidth = 3; x.setLineDash(dash); x.beginPath();
                for (let i = 0; i <= 160; i++) { const tt = i / 160, yy = G.y + G.h - mono(keys, tt) * (G.h - 8); i ? x.lineTo(G.x + tt * G.w, yy) : x.moveTo(G.x + tt * G.w, yy); }
                x.stroke(); x.restore();
                const pk = keys.reduce((a, b) => (b[1] > a[1] ? b : a));
                M.callout(x, label, G.x + pk[0] * G.w, G.y + G.h - pk[1] * (G.h - 8), G.x + lx2 * G.w, G.y + 4, { line: col });
              };
              M.text(x, "꼭짓점이 어디에 있나", pad, ly + 4, { size: 12.5, weight: 700, color: c.ink });
              draw(K3, c.ink, [], narrow ? "3막: 대결" : "3막: 클라이맥스의 대결", narrow ? 0.7 : 0.8);
              draw(KK, c.b, [7, 5], narrow ? "전: 뒤집기" : "기승전결: 전의 뒤집기", narrow ? 0.3 : 0.4);
              x.restore();
            }
            x.restore();
          }

          /* 프랙털 */
          if (cur.fr > 0.01) {
            x.save(); x.globalAlpha = cur.fr;
            const rows = [
              { name: "작품", sub: "전체", segs: [["1막", 0.25], ["2막", 0.5], ["3막", 0.25]], hi: [0.3, 0.43], col: "--ch0" },
              { name: "아크", sub: "한 부·편", segs: [["1막", 0.25], ["2막", 0.5], ["3막", 0.25]], hi: [0.55, 0.65], col: "--ch2" },
              { name: "회차", sub: "한 화", segs: [["기", 0.22], ["승", 0.28], ["전", 0.25], ["결·훅", 0.25]], hi: [0.22, 0.5], col: "--ch3" },
              { name: "장면", sub: "한 장면", segs: [["목표", 0.3], ["갈등", 0.45], ["결과", 0.25]], hi: null, col: "--ch6" },
            ];
            const labW = narrow ? 58 : 84, bx = pad + labW, bw = w - pad * 2 - labW - 4;
            const rh = Math.min(46, (h - 30) / 4 * 0.46), gapY = ((h - 24) - rh * 4) / 3;
            rows.forEach((r, i) => {
              const a = M.clamp((t - i * 450) / 450, 0, 1); if (a <= 0) return;
              const y = 14 + i * (rh + gapY);
              x.save(); x.globalAlpha = cur.fr * a;
              M.text(x, r.name, pad, y + rh / 2 - 2, { size: 13, weight: 800, color: c.ink });
              M.text(x, r.sub, pad, y + rh / 2 + 15, { size: 12, color: c.muted });
              let sx = bx;
              r.segs.forEach(([nm, f], k) => {
                const sw = bw * f;
                M.rrect(x, sx, y, sw - 3, rh, 7); x.fillStyle = tint(V(r.col), 0.2 + 0.12 * (k % 2)); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1.2; x.stroke();
                M.text(x, nm, sx + (sw - 3) / 2, y + rh / 2 + 5, { size: 12.5, weight: 700, align: "center", color: c.ink });
                sx += sw;
              });
              if (r.hi && i < 3) {
                const n = M.clamp((t - i * 450 - 300) / 400, 0, 1);
                if (n > 0) {
                  const h0 = bx + bw * r.hi[0], h1 = bx + bw * r.hi[1], ny = y + rh + gapY;
                  x.save(); x.globalAlpha = cur.fr * n;
                  M.rrect(x, h0 - 1, y - 3, h1 - h0, rh + 6, 8); x.strokeStyle = c.key; x.lineWidth = 2.5; x.stroke();
                  x.beginPath(); x.moveTo(h0, y + rh + 3); x.lineTo(bx, ny - 2); x.lineTo(bx + bw - 3, ny - 2); x.lineTo(h1 - 1, y + rh + 3); x.closePath();
                  x.fillStyle = M.alpha(c.key, 0.12); x.fill(); x.strokeStyle = M.alpha(c.key, 0.7); x.lineWidth = 1; x.stroke();
                  x.restore();
                }
              }
              x.restore();
            });
            x.restore();
          }
        },
      };
    },
  });

  /* =====================================================================
     2-3 비트시트 15비트
     ===================================================================== */
  LESSONS.push({
    id: "beat-sheet", ch: 2, order: 3,
    title: "비트시트 15비트",
    lede: "이 레슨을 마치면 『Save the Cat!』의 15비트를 분량 비율로 늘어놓고, 각 비트가 묻는 질문과 '여기까지 이게 없으면 처진다'는 경보로 쓰는 법을 알게 됩니다. 영웅의 여정과 겹쳐 보는 법도 다룹니다.",
    key: "비트시트는 '몇 % 지점에서 무슨 일이 일어나야 하나'를 묻는 타이밍 도구입니다. 칸 채우기가 아니라 경보 장치로 씁니다. 비트는 특정 사건이 아니라 기능입니다.",
    steps: [
      ["15비트를 한 줄에", "블레이크 스나이더가 『Save the Cat!』(2005)에서 정리한 15비트입니다. 원래 110쪽 영화 대본 기준이라 쪽수로 적혀 있는데, 여기서는 <b>전체 분량 대비 %</b>로 바꿔 놓았습니다. 동그라미는 한 순간, 아래 띠는 구간입니다. 아래 표의 오른쪽 칸은 제빵사 준의 이야기를 이 틀에 앉힌 예입니다."],
      ["1막: 오프닝에서 2막 진입까지", "1막 비트 여섯 개가 켜졌습니다. <b>오프닝 이미지</b>로 변하기 전 세계를 보여 주고, 누군가 아직 못 알아들을 <b>주제</b>를 말하고, 약 11%의 <b>촉매</b>가 일상을 깹니다. 갈까 말까 <b>고민</b>하다가 약 23%에서 스스로 선택해 2막에 들어섭니다."],
      ["2막 전반: B 스토리와 미드포인트", "2막에 들어서면 <b>B 스토리</b>(대개 관계)가 열립니다. 주인공이 필요를 배우는 줄기입니다. 이어지는 <b>재미와 놀이</b>는 장르가 약속한 재미를 보여 주는 구간이고, 50%의 <b>미드포인트</b>에서 가짜 승리나 가짜 패배로 스테이크가 오릅니다."],
      ["2막 후반: 다가오는 압박", "<b>악당이 다가온다</b> 구간에서 안팎의 압박이 조여 오고, 약 68%에서 <b>모든 것을 잃습니다</b>. 무언가(누군가)의 '죽음'이 흔합니다. 이어지는 <b>영혼의 어두운 밤</b>에 주인공은 바닥에서 깨닫습니다. 비트는 '누가 죽어야 한다'는 규칙이 아니라 '소중한 것을 잃는다'는 기능입니다."],
      ["3막: 합류와 거울", "약 77%의 <b>3막 진입</b>에서 A 스토리와 B 스토리가 만나 해법이 나옵니다. 준의 경우 동생에게 도움을 청하는 순간입니다. <b>피날레</b>에서 배운 것을 행동으로 증명하고, <b>마지막 이미지</b>는 위 곡선 화살표처럼 오프닝 이미지의 거울상이 됩니다."],
      ["경보 장치로 쓰기", "'직접 해보기'의 <b>지금까지 쓴 분량</b>을 움직여 보세요. 세로선을 지난 비트는 이미 나왔어야 합니다. 원고 상태가 '미드포인트 없음'이라 50%를 넘긴 지금 빨간 경보가 떴습니다. 연재라면 반응이 꺾이기 전에 중반 처짐을 미리 알 수 있습니다."],
      ["영웅의 여정과 겹쳐 보기", "아래 둘째 띠는 보글러가 정리한 <b>영웅의 여정</b> 12단계를 같은 막에 대략 얹은 것입니다. 비트시트가 '<b>언제</b>'를 묻는다면 영웅의 여정은 이 단계가 주인공에게 '<b>무슨 의미</b>'인지를 묻습니다. 미드포인트 근처에 '시련(죽음과 재생)'이 놓이는 것처럼 두 틀은 서로 겹칩니다."],
    ],
    terms: [
      ["비트시트", "Beat sheet", "이야기에서 일어나야 할 핵심 순간(비트)을 위치와 함께 나열한 표. 『Save the Cat!』의 15비트가 대표적입니다."],
      ["촉매", "Catalyst", "일상을 깨는 사건. 3막 구조의 발단 사건과 같은 기능입니다."],
      ["B 스토리", "B story", "주인공이 필요를 배우는 보조 줄기. 대개 관계가 실어 나르고, 3막 진입에서 메인 줄기(A 스토리)와 만납니다."],
      ["영혼의 어두운 밤", "Dark night of the soul", "모든 것을 잃은 직후, 주인공이 바닥에서 무엇이 잘못됐는지 깨닫는 구간."],
      ["영웅의 여정", "Hero's journey", "조지프 캠벨이 신화에서 찾은 모험 구조를 크리스토퍼 보글러가 작가용 12단계로 정리한 모델."],
    ],
    mount(api) {
      const cv = api.canvas("fill");
      /* [이름, 시작 쪽, 끝 쪽(구간이면), 묻는 것, 준의 이야기] — 110쪽 대본 기준 */
      const B = [
        ["오프닝 이미지", 1, 0, "변하기 전 주인공의 세계", "새벽, 혼자 빵을 굽는 준"],
        ["주제 제시", 5, 0, "누가 (아직 못 알아들을) 교훈을 말하나", "할머니: \"빵은 같이 먹으려고 굽는 거다\""],
        ["설정", 1, 10, "주인공의 결핍과 일상", "기울어 가는 가게, 멀어진 동생"],
        ["촉매", 12, 0, "일상을 깨는 사건", "사고로 미각을 잃는다"],
        ["고민", 12, 25, "갈까 말까", "대회에 나갈까, 가게를 팔까"],
        ["2막 진입", 25, 0, "스스로 선택해 새 세계로", "혼자 출전 신청서를 낸다"],
        ["B 스토리", 30, 0, "주제를 비추는 관계가 시작", "동생과 한 주방에 다시 선다"],
        ["재미와 놀이", 30, 55, "장르의 약속을 보여 준다", "미각 없이 숫자로 빵을 재는 훈련, 예선"],
        ["미드포인트", 55, 0, "가짜 승리나 가짜 패배", "동생의 몰래 시식 덕에 본선 진출"],
        ["악당이 다가온다", 55, 75, "안팎의 압박이 조여 온다", "프랜차이즈의 압박, 커지는 거짓말"],
        ["모든 것을 잃다", 75, 0, "최저점, 무언가의 '죽음'", "빵을 망치고 동생이 떠난다"],
        ["영혼의 어두운 밤|어두운 밤", 75, 85, "바닥에서 깨닫는다", "빈 가게에서 할머니의 노트를 펼친다"],
        ["3막 진입", 85, 0, "A와 B가 합쳐져 해법이 나온다", "동생을 찾아가 도움을 청한다"],
        ["피날레", 85, 110, "배운 것을 행동으로 증명", "결승에서 밝히고, 동생에게 맡긴다"],
        ["마지막 이미지", 110, 0, "오프닝 이미지의 거울상", "새벽, 둘이 함께 빵을 굽는다"],
      ].map(([nm, a, b, q, ex], i) => ({ i, name: nm.split("|")[0], short: nm.split("|")[1] || nm, a: a / 110, b: b ? b / 110 : null, q, ex, span: !!b }));
      const HJ = [
        [0, "일상 세계"], [0, "모험에의 소명"], [0, "소명 거부"], [0, "멘토와의 만남"], [0, "첫 관문 통과"],
        [1, "시험·동료·적"], [1, "동굴 접근"], [1, "시련"], [1, "보상"],
        [2, "귀환의 길"], [2, "부활"], [2, "영약을 가지고 귀환"],
      ];
      const ACT = [[0, 25 / 110, "1막", "--ch0"], [25 / 110, 85 / 110, "2막", "--ch2"], [85 / 110, 1, "3막", "--ch6"]];
      const FOCUS = [null, [0, 1, 2, 3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], null, null];
      let step = 0, unit = 0, prog = 0.6, draft = 0;
      const cur = { f: B.map(() => 1), hj: 0, prog: 0, mirror: 0 };
      M.chips(api.controls, { title: "위치 단위", items: ["%", "대본 110쪽", "연재 아크 50화"], value: 0, onPick: (i) => (unit = i) });
      const pr = M.slider(api.controls, { id: "bsProg", label: "지금까지 쓴 분량", min: 0, max: 100, step: 1, value: 60, fmt: (v) => v + "%", onInput: (v) => { prog = v / 100; if (step !== 5) jump(5); } });
      const dr = M.chips(api.controls, { title: "원고 상태", items: ["비트 다 있음", "미드포인트 없음"], value: 0, onPick: (i) => { draft = i; if (step !== 5) jump(5); } });
      const jump = (s) => { const b = document.querySelectorAll("#steps button")[s]; if (b) b.click(); };
      const fmt = (v) => (unit === 0 ? Math.round(v * 100) + "%" : unit === 1 ? Math.max(1, Math.round(v * 110)) + "쪽" : Math.max(1, Math.ceil(v * 50)) + "화");
      const pos = (b) => (b.span ? `${fmt(b.a)}–${fmt(b.b)}` : fmt(b.a));

      return {
        setStep(s) { step = s; if (s === 5) { prog = 0.6; pr.set(60); draft = 1; dr.set(1); } else { draft = 0; dr.set(0); } },
        frame(t, dt) {
          const { x, w, h } = M.fit(cv), c = M.col();
          const narrow = isNarrow(w);
          const F = FOCUS[step];
          B.forEach((b, i) => (cur.f[i] = follow(cur.f[i], !F || F.includes(i) ? 1 : 0.28, dt, 300)));
          cur.hj = follow(cur.hj, step === 6 ? 1 : 0, dt, 350);
          cur.prog = follow(cur.prog, step === 5 ? 1 : 0, dt, 300);
          cur.mirror = follow(cur.mirror, step === 4 ? 1 : 0, dt, 300);
          const pad = 14;
          const R = { x: pad + 6, w: w - pad * 2 - 12, y: narrow ? 92 : 108, h: 24 };
          const X = (v) => R.x + v * R.w;
          /* 막 띠 */
          ACT.forEach(([a, b, name, col]) => {
            x.fillStyle = M.alpha(V(col), 0.35); M.rrect(x, X(a), R.y, X(b) - X(a), R.h, 0); x.fill();
          });
          M.rrect(x, R.x, R.y, R.w, R.h, 6); x.strokeStyle = c.ink; x.lineWidth = 1.2; x.stroke();
          /* 막 이름 띠 */
          const AY = R.y + R.h + 6;
          ACT.forEach(([a, b, name, col]) => {
            x.font = M.font(12, "ui", 800); const tw = x.measureText(name).width + 12, mx = (X(a) + X(b)) / 2;
            M.line(x, X(a) + 2, AY + 3, mx - tw / 2, AY + 3, V(col), 3);
            M.line(x, mx + tw / 2, AY + 3, X(b) - 2, AY + 3, V(col), 3);
            M.text(x, name, (X(a) + X(b)) / 2, AY + 7, { size: 12, weight: 800, align: "center", color: c.ink });
          });
          /* 구간 비트: 아래 한 줄 */
          const SY = AY + 18, SH = 24;
          B.filter((b) => b.span).forEach((b) => {
            const a = cur.f[b.i];
            x.save(); x.globalAlpha = a;
            const x0 = X(b.a) + 1, x1 = X(b.b) - 1;
            M.rrect(x, x0, SY, x1 - x0, SH, 6); x.fillStyle = c.surface; x.fill(); x.fillStyle = M.alpha(V("--ch3"), 0.18); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
            x.font = M.font(12, "ui", 700);
            const full = `${b.i + 1} ${b.short}`, fits = x.measureText(full).width < x1 - x0 - 8;
            const lbl = fits ? full : x.measureText(String(b.i + 1)).width < x1 - x0 - 4 ? String(b.i + 1) : "";
            M.text(x, lbl, (x0 + x1) / 2, SY + 16, { size: 12, weight: 700, align: "center", color: c.ink });
            x.restore();
          });
          /* 영웅의 여정 띠 */
          const HY = SY + SH + 8;
          if (cur.hj > 0.01) {
            x.save(); x.globalAlpha = cur.hj;
            const per = [5, 4, 3]; let k = 0;
            ACT.forEach(([a, b], ai) => {
              for (let j = 0; j < per[ai]; j++, k++) {
                const x0 = X(a + ((b - a) * j) / per[ai]) + 1, x1 = X(a + ((b - a) * (j + 1)) / per[ai]) - 1;
                M.rrect(x, x0, HY, x1 - x0, SH, 6); x.fillStyle = c.surface; x.fill(); x.fillStyle = M.alpha(V("--ch5"), 0.2); x.fill(); x.strokeStyle = c.ink; x.lineWidth = 1; x.stroke();
                M.text(x, String(k + 1), (x0 + x1) / 2, HY + 16, { size: 12, weight: 700, align: "center", color: c.ink });
              }
            });
            M.text(x, "영웅의 여정 (대략)", R.x, HY + SH + 16, { size: 12, weight: 700, color: c.muted });
            x.restore();
          }
          /* 점 비트 + 위쪽 이름(겹치지 않게 줄 배정) */
          const pts = B.filter((b) => !b.span);
          const rows = [];
          x.font = M.font(12, "ui", 700);
          const place = pts.map((b) => {
            const label = narrow ? String(b.i + 1) : b.name;
            const tw = x.measureText(label).width + 6, cx = M.clamp(X(b.a), R.x + tw / 2, R.x + R.w - tw / 2);
            let r = 0; while (rows[r] && rows[r] > cx - tw / 2) r++;
            rows[r] = cx + tw / 2 + 6;
            return { b, label, cx, r };
          });
          const nRows = rows.length, rowH = 17, labTop = R.y - 14 - (nRows - 1) * rowH;
          place.forEach(({ b, label, cx, r }) => {
            const a = cur.f[b.i];
            const ly = R.y - 14 - r * rowH;
            x.save(); x.globalAlpha = a;
            M.line(x, X(b.a), ly + 4, X(b.a), R.y + R.h / 2, M.alpha(c.ink, 0.4), 1);
            if (!narrow || true) M.text(x, label, cx, ly, { size: 12, weight: 700, align: "center", color: c.ink });
            const missing = draft === 1 && b.i === 8;
            M.dot(x, X(b.a), R.y + R.h / 2, 9.5, missing ? c.surface : V("--key"), c.ink);
            if (missing) { x.save(); x.setLineDash([2, 2]); M.dot(x, X(b.a), R.y + R.h / 2, 9.5, null, c.b); x.restore(); }
            M.text(x, String(b.i + 1), X(b.a), R.y + R.h / 2 + 4, { size: 11.5, weight: 800, align: "center", mono: true, color: missing ? c.b : "#1d1b18" });
            x.restore();
          });
          void labTop;
          /* 거울 화살표 */
          if (cur.mirror > 0.02) {
            x.save(); x.globalAlpha = cur.mirror;
            const ty = Math.max(14, R.y - 14 - nRows * rowH - 8);
            x.strokeStyle = c.b; x.lineWidth = 2; x.setLineDash([6, 4]);
            x.beginPath(); x.moveTo(X(B[0].a), R.y - 2); x.bezierCurveTo(X(0.2), ty - 10, X(0.8), ty - 10, X(1), R.y - 2); x.stroke(); x.setLineDash([]);
            M.tag(x, "거울상", X(0.5), ty + 2, { align: "center", color: c.b });
            x.restore();
          }
          /* 진행 세로선 */
          if (cur.prog > 0.02) {
            x.save(); x.globalAlpha = cur.prog;
            const px = X(prog);
            x.fillStyle = M.alpha(c.ink, 0.06); x.fillRect(R.x, R.y - 4, px - R.x, SY + SH - R.y + 8);
            M.line(x, px, R.y - 10, px, SY + SH + 6, c.b, 2.5);
            M.tag(x, "지금 " + fmt(prog), M.clamp(px, R.x + 40, R.x + R.w - 40), SY + SH + 18, { align: "center", color: c.b });
            x.restore();
          }

          /* 아래 표 */
          const TY = (cur.hj > 0.5 ? HY + SH + 30 : SY + SH + (cur.prog > 0.5 ? 38 : 20));
          const TH = h - TY - 6;
          card(x, pad, TY, w - pad * 2 - 2, TH, {});
          const inner = { x: pad + 14, y: TY + 12, w: w - pad * 2 - 30 };
          let list;
          if (step === 5) {
            const due = B.filter((b) => (b.span ? b.a : b.a) <= prog);
            const miss = due.filter((b) => draft === 1 && b.i === 8);
            M.text(x, `지금 ${fmt(prog)} · 이미 나왔어야 할 비트 ${due.length}개`, inner.x, inner.y + 10, { size: 13, weight: 700, color: c.ink });
            if (miss.length) {
              M.text(x, "경보: 미드포인트가 없다 → 2막이 처질 위험. 판을 뒤집는 진실, 시간 제한, 적의 능동적 공격을 넣을 때.", inner.x, inner.y + 32, { size: 12.5, weight: 700, color: c.b });
            } else M.text(x, prog < 0.5 ? "아직 미드포인트 전입니다. 재미와 놀이 구간에서 장르의 약속을 보여 주는 중." : "지나온 비트가 모두 있습니다.", inner.x, inner.y + 32, { size: 12.5, color: c.muted });
            list = due.slice(-Math.max(1, Math.floor((TH - 56) / 20)));
            list.forEach((b, k) => {
              const yy = inner.y + 58 + k * 20, m = draft === 1 && b.i === 8;
              M.text(x, m ? "✕" : "✓", inner.x, yy, { size: 12.5, weight: 800, color: m ? c.b : V("--c") });
              M.text(x, `${b.i + 1}. ${b.name}`, inner.x + 18, yy, { size: 12.5, weight: 700, color: m ? c.b : c.ink });
              if (!narrow) M.text(x, m ? "없음" : b.ex, inner.x + 150, yy, { size: 12.5, color: m ? c.b : c.muted });
            });
            return;
          }
          if (step === 6) {
            M.text(x, "영웅의 여정 12단계 (보글러)", inner.x, inner.y + 10, { size: 13, weight: 700, color: c.ink });
            const cols = narrow ? 1 : 3, cw = inner.w / cols;
            HJ.forEach(([ai, nm], k) => {
              const col = narrow ? 0 : ai, rowI = HJ.filter((q, j) => j < k && q[0] === ai).length;
              const yy = inner.y + (narrow ? 34 : 58) + (narrow ? k : rowI) * 20;
              if (yy > TY + TH - 6) return;
              M.text(x, `${k + 1}. ${nm}`, inner.x + col * cw, yy, { size: 12.5, weight: k === 7 ? 700 : 500, color: k === 7 ? c.b : c.ink });
            });
            if (!narrow) ["1막 · 출발", "2막 · 시련", "3막 · 귀환"].forEach((s2, i) => M.text(x, s2, inner.x + i * cw, inner.y + 34, { size: 12, weight: 700, color: c.muted }));
            if (!narrow && TH > 200) M.text(x, "비트시트는 '언제', 영웅의 여정은 '무슨 의미'를 묻습니다. 빨간 8번 '시련'이 미드포인트 근처에 놓입니다.", inner.x, TY + TH - 16, { size: 12, color: c.muted });
            return;
          }
          list = F ? F.map((i) => B[i]) : B;
          x.font = M.font(12.5, "ui", 500);
          const qW = Math.max(...list.map((b) => x.measureText(b.q).width)) + 22, eW = Math.max(...list.map((b) => x.measureText(b.ex).width));
          const cName = inner.x, cPos = inner.x + 132, cQ = inner.x + 226;
          const showQ = cQ + qW + eW <= inner.x + inner.w;
          const cEx = showQ ? cQ + qW : cQ;
          if (!narrow) {
            M.text(x, "비트", cName, inner.y + 8, { size: 12, weight: 700, color: c.muted });
            M.text(x, "위치", cPos, inner.y + 8, { size: 12, weight: 700, color: c.muted });
            if (showQ) M.text(x, "묻는 것", cQ, inner.y + 8, { size: 12, weight: 700, color: c.muted });
            M.text(x, "준의 이야기", cEx, inner.y + 8, { size: 12, weight: 700, color: c.muted });
          }
          const avail = TH - 34, rh = Math.min(30, avail / list.length);
          if (rh < 15) {
            /* 15개 전부: 두 단으로 이름과 위치만 */
            const half = Math.ceil(list.length / 2), cw = inner.w / 2, rr = Math.min(22, (TH - 34) / half);
            list.forEach((b, k) => {
              const col = Math.floor(k / half), yy = inner.y + 28 + (k % half) * rr;
              M.text(x, `${b.i + 1}. ${b.name}`, inner.x + col * cw, yy, { size: 12, weight: 700, color: c.ink });
              M.text(x, pos(b), inner.x + col * cw + cw - 16, yy, { size: 12, mono: true, color: c.muted, align: "right" });
            });
            return;
          }
          list.forEach((b, k) => {
            const yy = inner.y + 30 + k * rh;
            M.text(x, `${b.i + 1}. ${b.name}`, cName, yy, { size: 13, weight: 700, color: c.ink });
            if (!narrow) {
              M.text(x, pos(b), cPos, yy, { size: 12, mono: true, color: c.muted });
              if (showQ) M.text(x, b.q, cQ, yy, { size: 12.5, color: c.ink });
              M.text(x, b.ex, cEx, yy, { size: 12.5, color: c.muted });
            } else M.text(x, pos(b), inner.x + inner.w, yy, { size: 12, mono: true, color: c.muted, align: "right" });
          });
        },
      };
    },
  });
})();
