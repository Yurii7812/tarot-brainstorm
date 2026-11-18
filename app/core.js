// 土台: 状態・保存・元に戻す・ひな形・線の経路。盤面（ブレスト本体）はデッキに依存しない
(function () {
  "use strict";
  const TB = (window.TB = window.TB || {});
  const NS = "http://www.w3.org/2000/svg";
  const SVGT = new Set(["svg", "g", "line", "path", "polygon", "text", "rect", "circle"]);
  TB.$ = (s) => document.querySelector(s);
  TB.h = function h(tag, attrs, ...kids) {
    const el = SVGT.has(tag) ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else if (k === "value" && !SVGT.has(tag)) el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  };
  TB.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // アイデアの種類（6つの視点を元にした色分け）
  TB.KINDS = {
    note: { name: "気づき", color: "#e8e1cf" }, feel: { name: "気持ち", color: "#e26d5a" }, worry: { name: "心配", color: "#a99be0" },
    good: { name: "よい面", color: "#e3c45a" }, act: { name: "行動", color: "#7cc787" }, ask: { name: "問い", color: "#6fb3e0" },
  };
  TB.KIND_KEYS = Object.keys(TB.KINDS);
  // 白い盤面の色。前の暗い盤面で付けた色は、描くときに読み替える
  TB.INK = "#2b2d33";
  const OLD_INK = { "#e8e1cf": "#2b2d33", "#d8b46a": "#8a5a20", "#e26d5a": "#c0392b", "#6fb3e0": "#3b5bdb", "#8fd18a": "#2f8a3e", "#7cc787": "#2f8a3e", "#c59be8": "#7b4fc0", "#a99be0": "#7b4fc0", "#e3c45a": "#8a5a20" };
  TB.ink = (c) => OLD_INK[String(c || "").toLowerCase()] || c || TB.INK;
  TB.PEN = [TB.INK];
  TB.FRAME_COLORS = ["#8b909c"];
  const DEF = { revOn: true, revProb: 50, pool: "all", method: "crypto", seedText: "", shuffle: "fy", riffles: 7, color: TB.INK,
    promptSets: ["word", "scamper", "hats", "ask", "values", "story"] };

  // ================= 保存 =================
  const KEY = "tarot-brainstorm/v3", OLD = ["tarot-brainstorm/v2", "tarot-brainstorm/v1"];
  TB.newBoard = (o) => Object.assign({ id: "b" + TB.uid(), title: "", template: "free", layout: null, created: Date.now(), updated: Date.now(),
    nodes: [], links: [], frames: [], items: [], summary: "", draws: [] }, o || {});
  TB.cardNode = (deck, o) => Object.assign({ id: TB.uid(), t: "card", deck, item: null, rev: false, x: 0, y: 0, slot: null, label: "", hint: "", pos: "", mine: "" }, o || {});
  TB.ideaNode = (o) => Object.assign({ id: TB.uid(), t: "idea", x: 0, y: 0, text: "", kind: "note" }, o || {});

  function fromOld(r) { // 旧形式（スプレッドの位置 slots ＋ free）から作り直す
    const sp = window.Spreads.BY_ID[r.spread];
    const b = TB.newBoard({ title: r.title || "", template: sp ? "tarot:" + sp.id : "free", layout: sp ? "tarot:" + sp.id : null,
      created: r.created || Date.now(), updated: r.updated || Date.now(), summary: r.summary || "", items: r.items || [], draws: r.draws || [] });
    const map = {}, slots = r.slots || {};
    const mk = (d, o) => TB.cardNode("tarot", Object.assign({ item: d.card || null, rev: !!d.rev, label: d.label || "", pos: [d.std, d.pos].filter(Boolean).join("\n"), mine: d.mine || "" }, o));
    for (const p of sp ? sp.pos : []) { const d = slots[p.id] || {}; const n = mk(d, { slot: p.id, x: d.x ?? p.x, y: d.y ?? p.y, hint: p.hint }); b.nodes.push(n); map["s:" + p.id] = map[p.id] = n.id; }
    for (const f of r.free || []) { const n = mk(f, { x: f.x, y: f.y, hint: "補足・深掘りのカード" }); b.nodes.push(n); map["f:" + f.id] = n.id; }
    for (const l of r.links || []) if (map[l.a] && map[l.b]) b.links.push({ id: TB.uid(), a: map[l.a], b: map[l.b], kind: l.kind === "clash" ? "clash" : "flow", label: l.label || "" });
    return b;
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 作り直す */ }
    if (!s || !s.boards) {
      s = { current: null, boards: {} };
      for (const k of OLD) {
        let o = null; try { o = JSON.parse(localStorage.getItem(k)); } catch (e) { /* なし */ }
        if (o && o.readings) { for (const r of Object.values(o.readings)) { const b = fromOld(r); s.boards[b.id] = b; } s.settings = o.settings; break; }
      }
    }
    for (const b of Object.values(s.boards)) { for (const k of ["nodes", "links", "frames", "items", "draws"]) b[k] ||= []; b.summary ||= ""; }
    if (!Object.keys(s.boards).length) { const b = TB.build("center", ""); s.boards[b.id] = b; }
    if (!s.boards[s.current]) s.current = Object.values(s.boards).sort((a, b) => b.updated - a.updated)[0].id;
    s.settings = Object.assign({}, DEF, s.settings || {});
    return s;
  }
  let saveT;
  TB.persist = () => {
    clearTimeout(saveT);
    try { localStorage.setItem(KEY, JSON.stringify(TB.store)); } catch (e) { TB.toast("保存できませんでした: " + e.message); }
  };
  TB.persistSoon = () => { clearTimeout(saveT); saveT = setTimeout(TB.persist, 300); };
  TB.save = () => { TB.B().updated = Date.now(); TB.persistSoon(); };
  window.addEventListener("beforeunload", () => TB.persist());

  TB.B = () => TB.store.boards[TB.store.current];
  TB.node = (id) => TB.B().nodes.find((n) => n.id === id);
  TB.item = (n) => (n && n.t === "card" && n.item ? TB.DECKS[n.deck].get(n.item) : null);
  TB.deckOf = (n) => TB.DECKS[n.deck];

  // ---- 元に戻す ----
  const hist = { u: [], r: [] };
  TB.snap = () => { hist.u.push(JSON.stringify(TB.B())); if (hist.u.length > 150) hist.u.shift(); hist.r.length = 0; };
  TB.unsnap = () => hist.u.pop();
  TB.clearHist = () => { hist.u.length = 0; hist.r.length = 0; };
  const swap = (from, to) => { if (!from.length) return false; to.push(JSON.stringify(TB.B())); TB.store.boards[TB.store.current] = JSON.parse(from.pop()); TB.save(); return true; };
  TB.undo = () => { if (swap(hist.u, hist.r)) TB.renderAll(); };
  TB.redo = () => { if (swap(hist.r, hist.u)) TB.renderAll(); };

  // ================= ひな形（新規作成のときだけ選ぶ） =================
  TB.TEMPLATES = [
    { id: "center", group: "ブレスト", name: "中心テーマから", desc: "テーマを真ん中に置いて、Tab と Enter で広げる" },
    { id: "free", group: "ブレスト", name: "自由", desc: "何もない盤面。クリックで書き、ドラッグでペン" },
    { id: "swot", group: "ブレスト", name: "SWOT", desc: "強み・弱み・機会・脅威の4つの枠" },
    { id: "matrix", group: "ブレスト", name: "2×2", desc: "2つの軸で4つに分ける" },
    { id: "proscons", group: "ブレスト", name: "良い点・悪い点", desc: "2つの枠に分けて出す" },
    { id: "tarot:hexagram", group: "タロット", name: "ヘキサグラム（7枚）", desc: "過去・現在・近い未来・自分・相手・アドバイス・結論" },
    { id: "tarot:three", group: "タロット", name: "3枚", desc: "過去・現在・未来" },
    { id: "tarot:one", group: "タロット", name: "1枚", desc: "今いちばん必要な視点" },
    { id: "photo", group: "タロット", name: "写真から", desc: "並べたカードの写真から読み込む" },
    { id: "iching:pair", group: "易", name: "本卦と之卦", desc: "コインを6回投げて卦を立てる" },
    { id: "prompts3", group: "発想カード", name: "3枚引いて考える", desc: "テーマのまわりに発想カードを3枚" },
  ];
  TB.build = (tid, title) => {
    const b = TB.newBoard({ title, template: tid });
    const theme = (o) => { const n = TB.ideaNode(Object.assign({ text: title || "テーマ", center: true }, o)); b.nodes.push(n); return n; };
    const frame = (x, y, w, h, t, color) => b.frames.push({ id: TB.uid(), x, y, w, h, title: t, color: color || TB.FRAME_COLORS[0] });
    if (tid === "center" || tid === "prompts3") theme({ x: 0, y: 0 });
    else if (tid === "swot") {
      theme({ x: 0, y: -400 });
      frame(-460, -330, 440, 320, "強み（内側・良い）", "#7cc787"); frame(20, -330, 440, 320, "弱み（内側・悪い）", "#e26d5a");
      frame(-460, 20, 440, 320, "機会（外側・良い）", "#6fb3e0"); frame(20, 20, 440, 320, "脅威（外側・悪い）", "#c59be8");
    } else if (tid === "matrix") {
      theme({ x: 0, y: -400 });
      frame(-460, -330, 440, 320, "軸1 低 × 軸2 高"); frame(20, -330, 440, 320, "軸1 高 × 軸2 高");
      frame(-460, 20, 440, 320, "軸1 低 × 軸2 低"); frame(20, 20, 440, 320, "軸1 高 × 軸2 低");
      b.items.push({ id: TB.uid(), type: "text", x: -120, y: 350, text: "← 軸1（名前を書き換え）→", color: "#6a6f7d" });
    } else if (tid === "proscons") {
      theme({ x: 0, y: -300 });
      frame(-460, -230, 440, 460, "良い点", "#7cc787"); frame(20, -230, 440, 460, "悪い点", "#e26d5a");
    } else if (TB.LAYOUTS[tid]) {
      const L = TB.LAYOUTS[tid]; b.layout = tid;
      for (const p of L.pos) b.nodes.push(TB.cardNode(L.deck, { slot: p.id, x: p.x, y: p.y, hint: p.hint, label: "" }));
    }
    return b;
  };
  TB.slotName = (n) => {
    if (n.label) return n.label;
    const L = TB.B().layout && TB.LAYOUTS[TB.B().layout];
    const p = L && n.slot && L.pos.find((q) => q.id === n.slot);
    if (p) return p.name;
    if (n.deck === "prompt") { const it = TB.item(n); return it ? it.setName : "発想カード"; }
    if (n.deck === "iching") return "易";
    const free = TB.B().nodes.filter((m) => m.t === "card" && !m.slot && m.deck === "tarot");
    return "カード " + (free.indexOf(n) + 1);
  };

  // ================= 形と線の経路 =================
  TB.sizes = {}; // アイデアの大きさ（描いたあとに測る）
  TB.rectOf = (n) => {
    if (n.t === "card") { const D = TB.DECKS[n.deck]; return { x: n.x, y: n.y, w: D.w, h: D.h }; }
    const s = TB.sizes[n.id] || { w: Math.min(280, 30 + (n.text || "").length * 15), h: n.center ? 60 : 42 };
    return { x: n.x, y: n.y, w: s.w, h: s.h };
  };
  // 重なりを調べるための箱（カードは下の名札の分も含める）
  TB.boxOf = (n) => { const r = TB.rectOf(n); return n.t === "card" ? { x: r.x, y: r.y + 28, w: Math.max(r.w, 150), h: r.h + 56 } : r; };
  const inside = (p, r, m) => Math.abs(p.x - r.x) < r.w / 2 + m && Math.abs(p.y - r.y) < r.h / 2 + m;
  TB.overlaps = (a, b, m) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + m && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + m;
  function edge(r, to, m) { // 四角 r の中心から to へ向かう線と、縁（＋余白 m）の交点
    const dx = to.x - r.x, dy = to.y - r.y;
    const t = Math.min(dx ? (r.w / 2 + m) / Math.abs(dx) : 1e9, dy ? (r.h / 2 + m) / Math.abs(dy) : 1e9);
    return t >= 1 ? { x: r.x + dx * 0.5, y: r.y + dy * 0.5 } : { x: r.x + dx * t, y: r.y + dy * t };
  }
  TB.bez = (g, t) => ({ x: (1 - t) ** 2 * g.p0.x + 2 * (1 - t) * t * g.c.x + t * t * g.p1.x, y: (1 - t) ** 2 * g.p0.y + 2 * (1 - t) * t * g.c.y + t * t * g.p1.y });
  // すべての線の形を決める。途中のカードやアイデアを避け、同じ2つの間の線は並べてずらす
  TB.routeLinks = (b) => {
    const R = Object.fromEntries(b.nodes.map((n) => [n.id, TB.rectOf(n)]));
    const groups = {};
    for (const l of b.links) { const k = [l.a, l.b].sort().join("|"); (groups[k] ||= []).push(l); }
    const out = [], labels = [];
    for (const l of b.links) {
      const A = R[l.a], B = R[l.b]; if (!A || !B) continue;
      const k = [l.a, l.b].sort(), G = groups[k.join("|")], gi = G.indexOf(l);
      const P = R[k[0]], Q = R[k[1]], len = Math.hypot(Q.x - P.x, Q.y - P.y) || 1;
      const nx = -(Q.y - P.y) / len, ny = (Q.x - P.x) / len; // 並びに依らない向きの法線
      const base = (gi - (G.length - 1) / 2) * 46;
      const obst = b.nodes.filter((n) => n.id !== l.a && n.id !== l.b).map(TB.boxOf);
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      let best = null;
      for (const o of [0, 60, -60, 120, -120, 190, -190, 280, -280]) {
        const off = base + o, mid = { x: mx + nx * off, y: my + ny * off };
        const p0 = edge(A, mid, 8), p1 = edge(B, mid, l.kind === "line" ? 6 : 12);
        const g = { p0, p1, c: { x: 2 * mid.x - (p0.x + p1.x) / 2, y: 2 * mid.y - (p0.y + p1.y) / 2 }, mid };
        let hits = 0;
        for (let i = 1; i < 16; i++) { const p = TB.bez(g, i / 16); for (const r of obst) if (inside(p, r, 6)) hits++; }
        const score = hits * 1000 + Math.abs(o);
        if (!best || score < best.score) best = { ...g, score };
        if (!hits) break;
      }
      const g = best;
      g.ang1 = Math.atan2(g.p1.y - g.c.y, g.p1.x - g.c.x); g.ang0 = Math.atan2(g.p0.y - g.c.y, g.p0.x - g.c.x);
      g.d = `M${g.p0.x.toFixed(1)} ${g.p0.y.toFixed(1)} Q${g.c.x.toFixed(1)} ${g.c.y.toFixed(1)} ${g.p1.x.toFixed(1)} ${g.p1.y.toFixed(1)}`;
      if (l.label) { // ラベル同士が重ならない位置を、線に沿って探す
        const w = l.label.length * 19 + 18, hh = 30;
        for (const t of [0.5, 0.36, 0.64, 0.26, 0.74]) {
          const p = TB.bez(g, t), box = { x: p.x, y: p.y, w, h: hh };
          if (!labels.some((q) => TB.overlaps(q, box, 2)) || t === 0.74) { g.lab = box; labels.push(box); break; }
        }
      }
      out.push({ l, g });
    }
    return out;
  };

  // 新しいアイデアを置く場所: 親のまわりで、他と重ならないところ。祖父母（来た方向）から遠ざかる向きを優先
  TB.placeNear = (parentId, size, dy) => { // dy: 箱の中心と置く点のずれ（カードは名札の分だけ下へ広い）
    dy = dy || 0;
    const b = TB.B(), P = TB.node(parentId), PR = TB.rectOf(P), s = size || { w: 190, h: 44 };
    const inc = b.links.find((l) => l.b === parentId), G = inc && TB.node(inc.a);
    const kids = b.links.filter((l) => l.a === parentId).length;
    let dir;
    if (G) dir = Math.atan2(P.y - G.y, P.x - G.x);
    else if (P.t === "card") { const cs = b.nodes.filter((n) => n.t === "card"); const cx = cs.reduce((a, n) => a + n.x, 0) / cs.length, cy = cs.reduce((a, n) => a + n.y, 0) / cs.length; dir = cs.length > 1 && Math.hypot(P.x - cx, P.y - cy) > 20 ? Math.atan2(P.y - cy, P.x - cx) : -Math.PI / 2 + kids * 0.9; }
    else dir = -Math.PI / 2 + kids * 1.05;
    const rects = b.nodes.map(TB.boxOf);
    const steps = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, 1.8, -1.8, 2.3, -2.3, Math.PI];
    for (let ring = 0; ring < 5; ring++) {
      const r = Math.max(PR.w, PR.h) / 2 + Math.max(s.w, s.h) / 2 + 50 + ring * 75;
      for (const st of steps) {
        const a = dir + st, c = { x: P.x + Math.cos(a) * r * (PR.w > PR.h ? 1.25 : 1), y: P.y + Math.sin(a) * r * 0.8 + dy, w: s.w, h: s.h };
        if (!rects.some((q) => TB.overlaps(q, c, 14))) return { x: Math.round(c.x), y: Math.round(c.y - dy) };
      }
    }
    return { x: Math.round(P.x + Math.cos(dir) * 260), y: Math.round(P.y + Math.sin(dir) * 200) };
  };
  // 動かしたものが他と重なっていたら、少しずつ押し出す
  TB.resolveOverlap = (ids) => {
    const b = TB.B(), moved = new Set(ids);
    for (let it = 0; it < 30; it++) {
      let any = false;
      for (const id of ids) {
        const n = TB.node(id); if (!n) continue; const a = TB.rectOf(n);
        for (const m of b.nodes) {
          if (moved.has(m.id)) continue; const o = TB.boxOf(m);
          if (!TB.overlaps(a, o, 6)) continue;
          const dx = a.x - o.x || 1, dy = a.y - o.y || 1;
          const px = (a.w + o.w) / 2 + 8 - Math.abs(dx), py = (a.h + o.h) / 2 + 8 - Math.abs(dy);
          if (px < py) n.x += Math.sign(dx) * px; else n.y += Math.sign(dy) * py;
          Object.assign(a, TB.boxOf(n)); any = true;
        }
      }
      if (!any) break;
    }
  };

  let toastT;
  TB.toast = (t) => { const el = TB.$("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3500); };
  TB.init = () => { TB.store = load(); };
})();
