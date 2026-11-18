(function () {
  "use strict";
  const { ALL: CARDS, BY_ID: CARD, search, imgUrl, BACK, PROMPTS } = window.Cards;
  const { ALL: SPREADS, BY_ID: SPREAD } = window.Spreads;
  const KEY = "tarot-brainstorm/v2", OLD_KEY = "tarot-brainstorm/v1";
  const CHALK = "#e8e1cf", RED = "#e26d5a", GOLD = "#d8b46a";
  const COLORS = ["#e8e1cf", "#d8b46a", "#e26d5a", "#6fb3e0", "#8fd18a", "#c59be8"];
  const DEF = { revOn: true, revProb: 50, pool: "all", method: "crypto", seedText: "", shuffle: "fy", riffles: 7, cooldown: 30, color: COLORS[0] };
  const POOLS = { all: "78枚", major: "大アルカナ", minor: "小アルカナ" };
  const METHODS = {
    crypto: ["おまかせ", "OS の暗号乱数。毎回まったく別の結果"],
    word: ["言葉から", "同じ言葉なら同じ並びになる（再現できる）"],
    mouse: ["かき混ぜる", "マウスの動きを乱数の元にする"],
    time: ["時刻", "押した瞬間のミリ秒を元にする"],
  };
  const SANS = '"Noto Sans CJK JP","Noto Sans JP",sans-serif', SERIF = '"Noto Serif CJK JP","Noto Serif JP","Noto Serif CJK SC",serif';
  const $ = (s) => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const SVGT = new Set(["svg", "g", "line", "path", "polygon", "text"]);

  function h(tag, attrs, ...kids) {
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
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const blank = () => ({ card: null, rev: false, revealed: true, label: "", std: "", pos: "", mine: "" });

  // ================= 保存 =================
  function fix(r) {
    r.slots ||= {}; r.free ||= []; r.items ||= []; r.draws ||= []; r.links ||= []; r.summary ||= ""; r.title ||= "";
    for (const s of Object.values(r.slots)) if (s.revealed == null) s.revealed = true;
    for (const l of r.links) { if (!l.a.includes(":")) l.a = "s:" + l.a; if (!l.b.includes(":")) l.b = "s:" + l.b; }
    if (!SPREAD[r.spread]) r.spread = "hexagram";
    return r;
  }
  const newReading = (spread) => fix({ id: "r" + uid(), spread, created: Date.now(), updated: Date.now() });
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 読めなければ作り直す */ }
    if (!s) try { s = JSON.parse(localStorage.getItem(OLD_KEY)); } catch (e) { /* 同上 */ }
    if (!s || !s.readings || !Object.keys(s.readings).length) { const r = newReading("hexagram"); s = { current: r.id, readings: { [r.id]: r } }; }
    Object.values(s.readings).forEach(fix);
    if (!s.readings[s.current]) s.current = Object.keys(s.readings)[0];
    s.settings = Object.assign({}, DEF, s.settings || {});
    return s;
  }
  let store = load();
  let saveT;
  function persist() {
    clearTimeout(saveT);
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { toast("保存できませんでした: " + e.message); }
    renderHistory();
  }
  const persistSoon = () => { clearTimeout(saveT); saveT = setTimeout(persist, 300); };
  const save = () => { cur().updated = Date.now(); persistSoon(); };
  window.addEventListener("beforeunload", persist);

  const cur = () => store.readings[store.current];
  const spec = () => SPREAD[cur().spread];
  const CW = () => spec().cw, CH = () => Math.round((spec().cw * 5) / 3);

  // ---- 元に戻す ----
  const hist = { u: [], r: [] };
  function snap() { hist.u.push(JSON.stringify(cur())); if (hist.u.length > 150) hist.u.shift(); hist.r.length = 0; }
  function undo() { if (!hist.u.length) return; hist.r.push(JSON.stringify(cur())); store.readings[store.current] = JSON.parse(hist.u.pop()); save(); renderAll(false); }
  function redo() { if (!hist.r.length) return; hist.u.push(JSON.stringify(cur())); store.readings[store.current] = JSON.parse(hist.r.pop()); save(); renderAll(false); }

  // ================= 位置（スプレッドの位置＋足したカード） =================
  function ents() {
    const r = cur(), out = [];
    for (const p of spec().pos) {
      const d = r.slots[p.id];
      out.push({ id: "s:" + p.id, d, x: d && d.x != null ? d.x : p.x, y: d && d.y != null ? d.y : p.y, name: (d && d.label) || p.name, base: p.name, hint: p.hint, free: false });
    }
    r.free.forEach((f, i) => out.push({ id: "f:" + f.id, d: f, x: f.x, y: f.y, name: f.label || "追加 " + (i + 1), base: "追加 " + (i + 1), hint: "補足・深掘りのカード", free: true }));
    return out;
  }
  const ent = (id) => ents().find((e) => e.id === id);
  function dataOf(id) {
    if (id.startsWith("s:")) { const r = cur(), k = id.slice(2); return (r.slots[k] ||= blank()); }
    return cur().free.find((f) => "f:" + f.id === id);
  }
  const hasCard = (e) => !!(e && e.d && e.d.card);
  const itemOf = (id) => cur().items.find((i) => i.id === id);
  const cardLabel = (d) => (d && d.card ? (d.revealed ? CARD[d.card].ja + (d.rev ? "（逆位置）" : "") : "伏せたカード") : "未設定");

  // ================= 表示の位置・拡大 =================
  const board = $("#board"), world = $("#world");
  const view = { s: 1, tx: 0, ty: 0, auto: true };
  const applyView = () => { world.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`; };
  function toWorld(cx, cy) { const b = board.getBoundingClientRect(); return { x: (cx - b.left - view.tx) / view.s, y: (cy - b.top - view.ty) / view.s }; }
  function toScreen(x, y) { const b = board.getBoundingClientRect(); return { x: b.left + view.tx + x * view.s, y: b.top + view.ty + y * view.s }; }
  function bounds() {
    const sp = spec(), cw = CW(), ch = CH();
    let x0 = 0, y0 = 0, x1 = sp.w, y1 = sp.h;
    const add = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    for (const e of ents()) add(e.x - cw / 2 - 10, e.y - ch / 2 - 10, e.x + cw / 2 + 10, e.y + ch / 2 + 70);
    for (const it of cur().items) {
      if (it.type === "text") { const ls = it.text.split("\n"); add(it.x, it.y, it.x + Math.max(...ls.map((l) => l.length)) * 23 + 10, it.y + ls.length * 31); }
      else for (let i = 0; i < it.pts.length; i += 2) add(it.pts[i] - 4, it.pts[i + 1] - 4, it.pts[i] + 4, it.pts[i + 1] + 4);
    }
    return { x0, y0, x1, y1 };
  }
  function fit() {
    const b = bounds(), W = board.clientWidth, H = board.clientHeight, pad = 36;
    if (!W || !H) return;
    view.s = Math.min((W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0), 1.4);
    view.tx = (W - (b.x1 - b.x0) * view.s) / 2 - b.x0 * view.s;
    view.ty = (H - (b.y1 - b.y0) * view.s) / 2 - b.y0 * view.s;
    view.auto = true; applyView();
  }
  new ResizeObserver(() => { if (view.auto) fit(); }).observe(board);

  // ================= 盤面の描画 =================
  let sel = null, selLink = null, editing = null, pendingRender = false;
  const dealing = new Map();

  function thin(f) {
    const out = []; let lx = null, ly = null;
    for (let i = 0; i < f.length; i += 2) {
      const x = Math.round(f[i]), y = Math.round(f[i + 1]);
      if (lx === null || i >= f.length - 2 || Math.hypot(x - lx, y - ly) >= 3) { out.push(x, y); lx = x; ly = y; }
    }
    return out;
  }
  function smooth(f) {
    const p = []; for (let i = 0; i + 1 < f.length; i += 2) p.push([f[i], f[i + 1]]);
    if (p.length < 3) return "M" + p.map((q) => q.join(" ")).join(" L");
    let d = `M${p[0][0]} ${p[0][1]}`;
    for (let i = 1; i < p.length - 1; i++) d += ` Q${p[i][0]} ${p[i][1]} ${(p[i][0] + p[i + 1][0]) / 2} ${(p[i][1] + p[i + 1][1]) / 2}`;
    const l = p[p.length - 1]; return d + ` L${l[0]} ${l[1]}`;
  }
  function edge(c, o, cw, ch, m) {
    const dx = o.x - c.x, dy = o.y - c.y;
    const t = Math.min(dx ? (cw / 2 + m) / Math.abs(dx) : 1e9, dy ? (ch / 2 + m) / Math.abs(dy) : 1e9);
    return { x: c.x + dx * t, y: c.y + dy * t };
  }
  function linkGeom(l, E, cw, ch) {
    const a = E[l.a], b = E[l.b]; if (!a || !b) return null;
    const p = edge(a, b, cw, ch, 12), q = edge(b, a, cw, ch, 12);
    return { p, q, col: l.kind === "clash" ? RED : CHALK, ang: Math.atan2(q.y - p.y, q.x - p.x) };
  }
  function linkEl(l, E, cw, ch) {
    const g0 = linkGeom(l, E, cw, ch); if (!g0) return null;
    const { p, q, col, ang } = g0, deg = (ang * 180) / Math.PI;
    const head = (pt, a) => h("polygon", { points: "0,0 -20,-9 -20,9", fill: col, transform: `translate(${pt.x},${pt.y}) rotate(${a})` });
    return h("g", { class: "link" + (selLink === l.id ? " on" : ""), "data-link": l.id },
      h("line", { class: "link-hit", x1: p.x, y1: p.y, x2: q.x, y2: q.y }),
      h("line", { class: "link-line", x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: col, "stroke-width": 4, "stroke-linecap": "round", "stroke-dasharray": l.kind === "clash" ? "16 11" : null }),
      head(q, deg), l.kind === "clash" ? head(p, deg + 180) : null,
      l.label ? h("text", { class: "link-label", x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 7, fill: col, text: l.label }) : null);
  }
  function cardEl(e, cw, ch) {
    const d = e.d || {}, c = d.card ? CARD[d.card] : null, down = c && !d.revealed;
    const el = h("div", {
      class: "card" + (c ? "" : " empty") + (down ? " down" : "") + (sel === e.id ? " sel" : ""), "data-id": e.id,
      style: `left:${e.x - cw / 2}px;top:${e.y - ch / 2}px;width:${cw}px;height:${ch}px`,
    });
    if (c) el.append(h("div", { class: "flip" },
      h("div", { class: "face" }, h("img", { src: imgUrl(c), alt: "", draggable: "false", class: d.rev ? "rev" : null })),
      h("div", { class: "back" }, h("img", { src: BACK, alt: "", draggable: "false" }))));
    else el.append(h("div", { class: "slot-in" }, h("span", { text: "?" })));
    el.append(h("div", { class: "plaque" }, h("b", { text: e.name }), c ? h("span", { text: down ? "伏せたカード" : c.ja + (d.rev ? "（逆）" : "") }) : null));
    const k = dealing.get(e.id);
    if (k) { el.classList.add("deal"); el.style.setProperty("--dx", k.dx + "px"); el.style.setProperty("--dy", k.dy + "px"); el.style.setProperty("--dly", k.i * 150 + "ms"); }
    return el;
  }
  const linkLayer = () => world.querySelector("svg.links");
  const penLayer = () => world.querySelector("svg.pen");

  function renderBoard() {
    if (editing) { pendingRender = true; return; }
    pendingRender = false;
    const r = cur(), cw = CW(), ch = CH(), list = ents(), E = Object.fromEntries(list.map((e) => [e.id, e]));
    const links = h("svg", { class: "layer links", width: 1, height: 1 }, r.links.map((l) => linkEl(l, E, cw, ch)));
    const pen = h("svg", { class: "layer pen", width: 1, height: 1 });
    for (const it of r.items) if (it.type === "stroke") {
      const d = smooth(it.pts);
      pen.append(h("path", { class: "stroke", d, stroke: it.color, "stroke-width": it.w || 3 }), h("path", { class: "stroke-hit", d, "data-item": it.id }));
    }
    const notes = r.items.filter((it) => it.type === "text").map((it) =>
      h("div", { class: "note", "data-item": it.id, style: `left:${it.x}px;top:${it.y}px;color:${it.color}`, text: it.text }));
    world.replaceChildren(links, ...list.map((e) => cardEl(e, cw, ch)), pen, ...notes);
    applyView(); renderDeck();
  }
  function markSel() {
    world.querySelectorAll(".card.sel").forEach((x) => x.classList.remove("sel"));
    if (sel) { const el = world.querySelector(`.card[data-id="${CSS.escape(sel)}"]`); if (el) el.classList.add("sel"); }
    world.querySelectorAll(".link.on").forEach((x) => x.classList.remove("on"));
    if (selLink) { const g = world.querySelector(`.link[data-link="${CSS.escape(selLink)}"]`); if (g) g.classList.add("on"); }
  }

  // ---- 山札 ----
  const inPool = (c) => store.settings.pool === "all" || (store.settings.pool === "major" ? !!c.major : !c.major);
  function renderDeck() {
    const placed = new Set(ents().filter(hasCard).map((e) => e.d.card));
    const left = CARDS.filter((c) => inPool(c) && !placed.has(c.id)).length;
    $("#deck-count").textContent = `山札 ${left}枚（${POOLS[store.settings.pool]}）`;
  }
  $("#deck").querySelectorAll("img").forEach((i) => (i.src = BACK));
  $("#mix").querySelectorAll("img").forEach((i) => (i.src = BACK));

  // ================= 盤面の操作 =================
  function drag(e, { move, up }) {
    const sx = e.clientX, sy = e.clientY; let moved = false;
    const mv = (ev) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 4) moved = true; if (move) move(ev, moved); };
    const u = (ev) => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", u); if (up) up(ev, moved); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", u);
  }
  const cardAt = (ev) => { const el = document.elementFromPoint(ev.clientX, ev.clientY); return el && el.closest("#world .card"); };

  board.addEventListener("pointerdown", (e) => {
    hideTip(); closeFloat();
    if (e.target.closest("#deck, #pop")) return;
    if (editing) { const el = world.querySelector(".note.editing"); if (el && !el.contains(e.target)) { e.preventDefault(); el.blur(); } return; }
    if (e.button === 1) { e.preventDefault(); startPan(e); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    const card = e.target.closest(".card"), note = e.target.closest(".note"), link = e.target.closest(".link");
    if (card) { if (e.ctrlKey) startMove(e, "card", card.dataset.id); else startCard(e, card.dataset.id); return; }
    if (note) {
      const id = note.dataset.item;
      if (e.ctrlKey) startMove(e, "note", id); else drag(e, { up: (ev, moved) => { if (!moved) editNote(id, false); } });
      return;
    }
    if (link) { openLinkPop(link.dataset.link); return; }
    if (e.ctrlKey) { startPan(e); return; }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (sel || selLink) { sel = null; selLink = null; markSel(); renderDrawer(); }
    startPen(e);
  });

  function startPan(e) {
    const tx = view.tx, ty = view.ty; board.style.cursor = "grabbing";
    drag(e, { move: (ev) => { view.tx = tx + ev.clientX - e.clientX; view.ty = ty + ev.clientY - e.clientY; view.auto = false; applyView(); }, up: () => { board.style.cursor = ""; } });
  }
  board.addEventListener("wheel", (e) => {
    e.preventDefault(); hideTip();
    const b = board.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
    const s = Math.min(4, Math.max(0.15, view.s * Math.exp(-e.deltaY * 0.0015)));
    view.tx = mx - ((mx - view.tx) * s) / view.s; view.ty = my - ((my - view.ty) * s) / view.s; view.s = s; view.auto = false; applyView();
  }, { passive: false });

  // ペン（クリックだけなら文字）
  function startPen(e) {
    const pts = []; let path = null; const color = store.settings.color;
    const add = (ev) => { const p = toWorld(ev.clientX, ev.clientY); pts.push(p.x, p.y); };
    add(e);
    drag(e, {
      move: (ev, moved) => {
        if (!moved) return; add(ev);
        if (!path) { path = h("path", { class: "stroke", stroke: color, "stroke-width": 3 }); penLayer().append(path); }
        path.setAttribute("d", smooth(thin(pts)));
      },
      up: (ev, moved) => {
        if (moved && pts.length >= 4) { snap(); cur().items.push({ id: uid(), type: "stroke", pts: thin(pts), color, w: 3 }); save(); renderBoard(); }
        else { if (path) path.remove(); newNote(toWorld(ev.clientX, ev.clientY)); }
      },
    });
  }
  // カード: クリック＝選ぶ（伏せていればめくる） / 別のカードへドラッグ＝つなぐ
  function startCard(e, id) {
    const a = ent(id); let tmp = null;
    const clearT = () => world.querySelectorAll(".card.target").forEach((x) => x.classList.remove("target"));
    drag(e, {
      move: (ev, moved) => {
        if (!moved) return;
        const p = toWorld(ev.clientX, ev.clientY);
        if (!tmp) { tmp = h("line", { class: "link-tmp", x1: a.x, y1: a.y }); linkLayer().append(tmp); }
        tmp.setAttribute("x2", p.x); tmp.setAttribute("y2", p.y);
        clearT(); const t = cardAt(ev); if (t && t.dataset.id !== id) t.classList.add("target");
      },
      up: (ev, moved) => {
        if (tmp) tmp.remove(); clearT();
        if (!moved) { onCardClick(id); return; }
        const t = cardAt(ev);
        if (t && t.dataset.id !== id) {
          snap(); const l = { id: uid(), a: id, b: t.dataset.id, kind: "flow", label: "" };
          cur().links.push(l); save(); renderBoard(); openLinkPop(l.id, true);
        }
      },
    });
  }
  function onCardClick(id) {
    const e = ent(id); if (!e) return;
    if (hasCard(e) && !e.d.revealed) reveal(id);
    select(id);
  }
  // Ctrl+ドラッグ: カード・文字を動かす
  function startMove(e, kind, id) {
    const p0 = toWorld(e.clientX, e.clientY); let snapped = false;
    const e0 = kind === "card" ? ent(id) : itemOf(id); if (!e0) return;
    const ox = e0.x, oy = e0.y;
    drag(e, {
      move: (ev, moved) => {
        if (!moved) return;
        if (!snapped) { snap(); snapped = true; }
        const t = kind === "card" ? dataOf(id) : itemOf(id), p = toWorld(ev.clientX, ev.clientY);
        t.x = Math.round(ox + p.x - p0.x); t.y = Math.round(oy + p.y - p0.y); renderBoard();
      },
      up: (ev, moved) => { if (moved) save(); else if (kind === "card") onCardClick(id); else editNote(id, false); },
    });
  }

  // ---- 文字（箱なし） ----
  function newNote(pt) {
    snap();
    const it = { id: uid(), type: "text", x: Math.round(pt.x), y: Math.round(pt.y - 16), text: "", color: store.settings.color };
    cur().items.push(it); renderBoard(); editNote(it.id, true);
  }
  function editNote(id, isNew) {
    const el = world.querySelector(`.note[data-item="${CSS.escape(id)}"]`); if (!el) return;
    if (!isNew) snap();
    editing = id; el.contentEditable = "plaintext-only"; el.classList.add("editing"); el.focus();
    const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
    const key = (ev) => { if (ev.key === "Escape" || (ev.key === "Enter" && ev.ctrlKey)) { ev.preventDefault(); ev.stopPropagation(); el.blur(); } };
    const done = () => {
      el.removeEventListener("blur", done); el.removeEventListener("keydown", key);
      const t = el.innerText.replace(/\n+$/, ""), r = cur(), i = r.items.findIndex((x) => x.id === id);
      if (!t.trim()) { if (i >= 0) r.items.splice(i, 1); if (isNew) hist.u.pop(); } else if (i >= 0) r.items[i].text = t;
      editing = null; save(); renderBoard();
    };
    el.addEventListener("blur", done); el.addEventListener("keydown", key);
  }

  // ---- 右クリック: 消す（カードはメニュー） ----
  board.addEventListener("contextmenu", (e) => {
    e.preventDefault(); hideTip(); if (editing) return;
    const card = e.target.closest(".card"), note = e.target.closest(".note"), link = e.target.closest(".link"), st = e.target.closest(".stroke-hit");
    if (note || st) { snap(); const id = (note || st).dataset.item; cur().items = cur().items.filter((i) => i.id !== id); save(); renderBoard(); return; }
    if (link) { removeLink(link.dataset.link); return; }
    if (card) cardMenu(card.dataset.id, e.clientX, e.clientY);
  });
  function removeLink(id) { snap(); cur().links = cur().links.filter((l) => l.id !== id); if (selLink === id) selLink = null; closeFloat(); save(); renderBoard(); }
  function cardMenu(id, x, y) {
    const e = ent(id), d = e.d || {}, items = [];
    if (d.card) {
      items.push([d.revealed ? "伏せる" : "めくる", () => { snap(); dataOf(id).revealed = !d.revealed; save(); renderBoard(); renderDrawer(); }]);
      items.push([d.rev ? "正位置にする" : "逆位置にする", () => setRev(id, !d.rev)]);
      items.push(["カードを外す", () => { snap(); const t = dataOf(id); t.card = null; t.rev = false; t.revealed = true; save(); renderBoard(); renderDrawer(); }]);
    }
    if (e.free) items.push(["この枠を消す", () => { snap(); const r = cur(); r.free = r.free.filter((f) => "f:" + f.id !== id); r.links = r.links.filter((l) => l.a !== id && l.b !== id); if (sel === id) sel = null; save(); renderBoard(); renderDrawer(); }]);
    const cut = cur().links.filter((l) => l.a === id || l.b === id);
    if (cut.length) items.push([`つながりを消す（${cut.length}本）`, () => { snap(); cur().links = cur().links.filter((l) => !cut.includes(l)); save(); renderBoard(); }]);
    if (!items.length) items.push(["（カードを置くと操作できます）", () => {}]);
    const m = $("#menu");
    m.replaceChildren(...items.map(([t, f]) => h("button", { type: "button", text: t, onclick: () => { closeFloat(); f(); } })));
    m.hidden = false; m.style.left = Math.min(x, innerWidth - 190) + "px"; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + "px";
  }

  // ---- つながりの吹き出し（種類・ひとこと） ----
  function openLinkPop(id, focus) {
    const l = cur().links.find((x) => x.id === id); if (!l) return;
    selLink = id; sel = null; markSel(); renderDrawer();
    const E = Object.fromEntries(ents().map((e) => [e.id, e])), g = linkGeom(l, E, CW(), CH()); if (!g) return;
    const mid = toScreen((g.p.x + g.q.x) / 2, (g.p.y + g.q.y) / 2), b = board.getBoundingClientRect();
    let armed = true;
    const kindBtn = (k, t) => h("button", { type: "button", class: l.kind === k ? "on" : null, text: t, onclick: () => { snap(); l.kind = k; save(); renderBoard(); openLinkPop(id); } });
    const input = h("input", { value: l.label, placeholder: "ひとこと（Enter で閉じる）",
      oninput: (ev) => { if (armed) { snap(); armed = false; } l.label = ev.target.value; save(); renderBoard(); markSel(); },
      onkeydown: (ev) => { if (ev.key === "Enter" || ev.key === "Escape") { ev.preventDefault(); closeFloat(); } } });
    const pop = $("#pop");
    pop.replaceChildren(kindBtn("flow", "→ 流れ"), kindBtn("clash", "↔ ぶつかり"), input,
      h("button", { type: "button", class: "icon", title: "向きを逆に", text: "⇄", onclick: () => { snap(); [l.a, l.b] = [l.b, l.a]; save(); renderBoard(); openLinkPop(id); } }),
      h("button", { type: "button", class: "icon", title: "消す（Delete）", text: "🗑", onclick: () => removeLink(id) }));
    pop.hidden = false;
    pop.style.left = Math.max(260, Math.min(b.width - 260, mid.x - b.left)) + "px";
    pop.style.top = Math.max(4, Math.min(b.height - 60, mid.y - b.top)) + "px";
    if (focus) input.focus();
  }
  function closeFloat() {
    $("#pop").hidden = true; $("#menu").hidden = true; $("#drawopt").hidden = true;
    if (selLink) { selLink = null; markSel(); }
  }
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("#pop, #menu, #drawopt, #btn-drawopt, #board")) closeFloat();
  });

  // ---- ホバーの説明 ----
  const tip = $("#tip"); let tipT = null, lastMouse = { x: 0, y: 0 };
  function tipBody(id) {
    const e = ent(id); if (!e) return [];
    const d = e.d || {}, c = d.card && CARD[d.card];
    const out = [h("div", { class: "tt-pos", text: e.name }), e.hint ? h("div", { class: "tt-hint", text: e.hint }) : null];
    if (!c) out.push(h("div", { class: "tt-note", text: "クリックしてカード名を打つ／🂠 引く で山札から配る" }));
    else if (!d.revealed) out.push(h("div", { class: "tt-note", text: "伏せたカード — クリックでめくる" }));
    else out.push(
      h("div", { class: "tt-card" }, h("b", { text: c.ja }), h("small", { text: "  " + c.en }), h("span", { class: "badge" + (d.rev ? " rev" : ""), text: d.rev ? "逆位置" : "正位置" })),
      h("div", { class: "kw" + (d.rev ? "" : " on") }, h("i", { text: "正" }), c.up),
      h("div", { class: "kw" + (d.rev ? " on" : "") }, h("i", { text: "逆" }), c.rv));
    return out;
  }
  function placeTip() {
    const w = tip.offsetWidth, hh = tip.offsetHeight;
    let x = lastMouse.x + 18, y = lastMouse.y + 18;
    if (x + w > innerWidth - 8) x = lastMouse.x - w - 14;
    if (y + hh > innerHeight - 8) y = innerHeight - hh - 8;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { clearTimeout(tipT); tip.hidden = true; }
  board.addEventListener("pointermove", (e) => { lastMouse = { x: e.clientX, y: e.clientY }; if (!tip.hidden) placeTip(); });
  board.addEventListener("pointerover", (e) => {
    const c = e.target.closest(".card"); if (!c || e.buttons || editing) return;
    clearTimeout(tipT);
    tipT = setTimeout(() => { tip.replaceChildren(...tipBody(c.dataset.id)); tip.hidden = false; placeTip(); }, 220);
  });
  board.addEventListener("pointerout", (e) => { const c = e.target.closest(".card"); if (c && !c.contains(e.relatedTarget)) hideTip(); });

  // ================= 選ぶ・めくる =================
  function select(id, focusInput) {
    sel = id; selLink = null; $("#pop").hidden = true; markSel(); renderDrawer();
    const inp = $("#card-input");
    if (inp && (focusInput || !hasCard(ent(id)))) inp.focus();
  }
  function reveal(id, noSnap) {
    const d = dataOf(id); if (!d || !d.card || d.revealed) return;
    if (!noSnap) snap();
    d.revealed = true; save();
    const el = world.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (el) { el.classList.remove("down"); const sp = el.querySelector(".plaque span"); if (sp) sp.textContent = CARD[d.card].ja + (d.rev ? "（逆）" : ""); }
    if (sel === id) renderDrawer();
  }
  function revealAll() {
    const downs = ents().filter((e) => hasCard(e) && !e.d.revealed);
    if (!downs.length) { toast("伏せたカードはありません"); return; }
    snap(); downs.forEach((e, i) => setTimeout(() => reveal(e.id, true), i * 260));
  }
  function setRev(id, v) { snap(); dataOf(id).rev = v; save(); renderBoard(); renderDrawer(); }

  // ================= 引く =================
  async function doDraw() {
    const r = cur(), st = store.settings;
    let targets = ents().filter((e) => !hasCard(e)), redraw = false;
    if (!ents().length) { toast("カードを置く場所がありません。＋カードで足してください"); return; }
    if (!targets.length) {
      const last = r.draws[r.draws.length - 1], wait = st.cooldown * 60000 - (Date.now() - (last ? last.at : 0));
      if (last && st.cooldown > 0 && wait > 0) { toast(`同じ読みの引き直しは、あと ${Math.ceil(wait / 60000)} 分あけてください（⚙ で変えられます）`); return; }
      if (!confirm("並べたカードを全部山札に戻して、引き直しますか？（書いた内容は残ります）")) return;
      targets = ents(); redraw = true;
    }
    const placed = new Set(redraw ? [] : ents().filter(hasCard).map((e) => e.d.card));
    const ids = CARDS.filter((c) => inPool(c) && !placed.has(c.id)).map((c) => c.id);
    if (ids.length < targets.length) { toast("山札が足りません"); return; }
    let samples = null;
    if (st.method === "mouse") { samples = await mixByMouse(); if (!samples) return; }
    const text = st.seedText.trim() || defaultSeed();
    const res = await window.Rng.draw({ ids, count: targets.length, method: st.method, text, samples, shuffle: st.shuffle, riffles: st.riffles, revOn: st.revOn, revProb: st.revProb });
    snap();
    const dk = $("#deck").getBoundingClientRect(), from = toWorld(dk.left + dk.width / 2, dk.top + dk.height / 2);
    targets.forEach((e, i) => {
      const d = dataOf(e.id); d.card = res.picks[i].id; d.rev = res.picks[i].rev; d.revealed = false;
      dealing.set(e.id, { i, dx: from.x - e.x, dy: from.y - e.y });
    });
    r.draws.push({ at: Date.now(), method: st.method, seed: res.seed, shuffle: st.shuffle, riffles: st.riffles, revOn: st.revOn, revProb: st.revProb, pool: st.pool, n: targets.length });
    save(); renderBoard(); renderDrawer();
    setTimeout(() => dealing.clear(), 300);
  }
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const defaultSeed = () => `${cur().title.trim() || "（無題）"}｜${today()}`;
  function methodText(dr) {
    const m = METHODS[dr.method] ? METHODS[dr.method][0] : dr.method;
    const sh = dr.shuffle === "riffle" ? `リフル${dr.riffles}回＋カット` : "完全に混ぜる";
    return `${m}・${sh}・逆位置${dr.revOn ? dr.revProb + "%" : "なし"}・${POOLS[dr.pool] || ""}`;
  }

  function mixByMouse() {
    return new Promise((ok) => {
      const ov = $("#mix"), bar = ov.querySelector(".mix-bar i"), imgs = [...ov.querySelectorAll(".mix-deck img")], samples = [], N = 240;
      let lastX = null; bar.style.width = "0";
      const mv = (e) => {
        samples.push(`${e.clientX},${e.clientY},${Math.round(performance.now() * 1000)}`);
        bar.style.width = Math.min(100, (samples.length / N) * 100) + "%";
        if (lastX != null) { const dx = Math.max(-30, Math.min(30, e.clientX - lastX)); imgs.forEach((im, i) => { im.style.transform = `translateX(${dx * (i - 1) * 1.6}px) rotate(${dx * (i - 1) * 0.5}deg)`; }); }
        lastX = e.clientX;
        if (samples.length >= N) end(samples);
      };
      const key = (e) => { if (e.key === "Escape") { e.preventDefault(); end(null); } };
      function end(v) { ov.removeEventListener("pointermove", mv); document.removeEventListener("keydown", key, true); imgs.forEach((im) => (im.style.transform = "")); ov.hidden = true; ok(v); }
      ov.addEventListener("pointermove", mv); document.addEventListener("keydown", key, true);
      ov.querySelector(".cancel").onclick = () => end(null);
      ov.hidden = false;
    });
  }

  // ---- 引き方の設定 ----
  function seg(opts, val, on) {
    return h("div", { class: "seg" }, opts.map(([v, t]) => h("button", { type: "button", class: v === val ? "on" : null, text: t, onclick: () => on(v) })));
  }
  function openDrawOpt() {
    const st = store.settings, pop = $("#drawopt");
    const set = (k, v, rerender) => { st[k] = v; persistSoon(); renderHeader(); renderDeck(); if (rerender) openDrawOpt(); };
    const range = (k, min, max, unit) => h("div", { class: "row" },
      h("input", { type: "range", min, max, value: st[k], oninput: (e) => { set(k, +e.target.value); e.target.nextSibling.textContent = e.target.value + unit; } }),
      h("span", { text: st[k] + unit, style: "min-width:44px;text-align:right" }));
    pop.replaceChildren(
      h("div", {}, h("h4", { text: "逆位置" }), seg([[false, "なし"], [true, "あり"]], st.revOn, (v) => set("revOn", v, true)),
        st.revOn ? h("div", { style: "margin-top:6px" }, h("div", { class: "desc", text: "逆位置の出やすさ" }), range("revProb", 1, 99, "%")) : null),
      h("div", {}, h("h4", { text: "使うカード" }), seg(Object.entries(POOLS), st.pool, (v) => set("pool", v, true))),
      h("div", {}, h("h4", { text: "乱数の元" }),
        h("div", { class: "radio" }, Object.entries(METHODS).map(([k, [t, d]]) => h("label", {},
          h("input", { type: "radio", name: "m", checked: st.method === k, onchange: () => set("method", k, true) }), h("span", {}, t, " ", h("small", { text: d })))))),
      st.method === "word" ? h("input", { value: st.seedText, placeholder: "空なら: " + defaultSeed(), oninput: (e) => set("seedText", e.target.value) }) : null,
      h("div", {}, h("h4", { text: "混ぜ方" }), seg([["fy", "一度で完全に"], ["riffle", "手で切る再現"]], st.shuffle, (v) => set("shuffle", v, true)),
        st.shuffle === "riffle" ? h("div", { style: "margin-top:6px" },
          h("div", { class: "desc", text: "リフルシャッフルの回数（最後にカット）。7回で十分混ざると言われる。少ないと元の並びが残る" }), range("riffles", 1, 12, "回")) : null),
      h("div", {}, h("h4", { text: "引き直しの間隔" }),
        h("div", { class: "row" }, h("input", { type: "number", min: 0, max: 1440, value: st.cooldown, style: "width:90px", oninput: (e) => set("cooldown", Math.max(0, +e.target.value || 0)) }),
          h("span", { class: "desc", text: "分（0 で制限なし）。不安で何度も引き直さないため" }))),
      h("button", { type: "button", class: "primary", text: "この設定で引く", onclick: () => { closeFloat(); doDraw(); } }));
    pop.hidden = false;
    const b = $("#btn-drawopt").getBoundingClientRect();
    pop.style.left = Math.min(b.left - 150, innerWidth - 410) + "px"; pop.style.top = b.bottom + 8 + "px";
  }

  // ================= 右の詳細 =================
  let focusAfter = null;
  function lazyField(get, set) { let armed = true; return { onfocus: () => { armed = true; }, oninput: (e) => { if (armed) { snap(); armed = false; } set(e.target.value); save(); } }; }

  function renderDrawer() {
    const dr = $("#drawer"), e = sel && ent(sel);
    if (!e) { sel = null; dr.replaceChildren(...overview().filter(Boolean)); return; }
    dr.replaceChildren(...detail(e).filter(Boolean));
    if (focusAfter) { const el = $(focusAfter); focusAfter = null; if (el) el.focus(); }
  }
  function detail(e) {
    const d = dataOf(e.id), c = d.card && CARD[d.card], down = c && !d.revealed;
    const img = h("div", { class: "d-img" }, c ? h("img", { src: down ? BACK : imgUrl(c), alt: "", class: !down && d.rev ? "rev" : null }) : h("span", { text: "?" }));
    const btns = c ? [
      down ? h("button", { type: "button", text: "めくる", onclick: () => reveal(e.id) })
        : h("button", { type: "button", text: d.rev ? "↺ 正位置にする" : "↻ 逆位置にする", onclick: () => setRev(e.id, !d.rev) }),
      h("button", { type: "button", text: "外す", onclick: () => { snap(); d.card = null; d.rev = false; d.revealed = true; save(); renderBoard(); focusAfter = "#card-input"; renderDrawer(); } }),
    ] : [];
    const head = h("div", { class: "d-head" }, img, h("div", { class: "d-meta" },
      h("input", { class: "d-pos", value: e.name, title: "位置の名前（変えられる）", ...lazyField(null, (v) => { d.label = v === e.base ? "" : v; renderBoard(); }) }),
      h("div", { class: "d-hint", text: e.hint || "" }),
      h("div", { class: "d-card" }, c ? (down ? "伏せたカード" : c.ja) : "カード未設定", c && !down ? h("small", { text: c.en }) : null,
        c && !down ? h("span", { class: "badge" + (d.rev ? " rev" : ""), text: d.rev ? "逆位置" : "正位置" }) : null),
      h("div", { class: "d-btns" }, btns)));
    const kw = c && !down ? h("div", {}, h("div", { class: "kw" + (d.rev ? "" : " on") }, h("i", { text: "正" }), c.up), h("div", { class: "kw" + (d.rev ? " on" : "") }, h("i", { text: "逆" }), c.rv)) : null;

    // カード名の入力（候補から Enter で置き、次の空きへ）
    const input = h("input", { id: "card-input", autocomplete: "off", placeholder: c ? "別のカードに替える（名前・略号）" : "カード名・略号（悪魔 / ワンド10 / w10 / 14r）" });
    const list = h("ul", { class: "sugg", hidden: true });
    let items = [], idx = 0, qrev = false;
    const refresh = () => {
      const res = search(input.value); items = res.cards; qrev = res.rev; idx = 0;
      list.replaceChildren(...items.map((cc, i) => h("li", { class: i === 0 ? "on" : null, onmousedown: (ev) => { ev.preventDefault(); pick(cc); } },
        h("span", { text: cc.ja }), h("small", { text: cc.ab + (qrev ? " 逆" : "") }))));
      list.hidden = !items.length;
    };
    const pick = (cc) => {
      snap(); d.card = cc.id; d.rev = qrev; d.revealed = true; save();
      const dup = ents().find((x) => x.id !== e.id && hasCard(x) && x.d.card === cc.id);
      if (dup) toast(`同じカードが「${dup.name}」にもあります`);
      const all = ents(), nxt = all.slice(all.findIndex((x) => x.id === e.id) + 1).find((x) => !hasCard(x));
      renderBoard();
      if (nxt) select(nxt.id, true); else { focusAfter = "#f-pos"; renderDrawer(); }
    };
    input.addEventListener("input", refresh);
    input.addEventListener("blur", () => setTimeout(() => (list.hidden = true), 100));
    input.addEventListener("keydown", (ev) => {
      if (ev.isComposing) return;
      if (ev.key === "ArrowDown" && items.length) { ev.preventDefault(); idx = (idx + 1) % items.length; [...list.children].forEach((li, i) => li.classList.toggle("on", i === idx)); }
      else if (ev.key === "ArrowUp" && items.length) { ev.preventDefault(); idx = (idx - 1 + items.length) % items.length; [...list.children].forEach((li, i) => li.classList.toggle("on", i === idx)); }
      else if (ev.key === "Enter" && items.length) { ev.preventDefault(); pick(items[idx]); }
      else if (ev.key === "Escape") { if (input.value) { ev.stopPropagation(); input.value = ""; refresh(); } }
    });

    const area = (key, label, ph, cls, extra) => [
      h("label", {}, h("span", { text: label }), extra || null),
      h("textarea", { id: "f-" + key, class: cls || null, rows: key === "std" ? 2 : 3, placeholder: ph, value: d[key] || "", ...lazyField(null, (v) => { d[key] = v; }) })];
    const kwText = c ? (d.rev ? c.rv : c.up) : "";
    const copyKw = c && !down ? h("button", { type: "button", text: "キーワードを写す", onclick: () => { snap(); d.std = kwText; save(); focusAfter = "#f-std"; renderDrawer(); } }) : null;
    const pi = (d.prompt ?? (e.id + (d.card || "")).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0)) % PROMPTS.length;
    return [
      head, kw, h("div", { class: "d-in" }, input, list),
      ...area("std", "① 標準の意味", c && !down ? kwText : "このカード自体の一般的な意味", null, copyKw),
      ...area("pos", "② この位置での読み", `「${e.name}」${e.hint ? "（" + e.hint + "）" : ""}としてどう読むか`),
      ...area("mine", "③ 自分の解釈", "自分にとっての意味・気づき", "grow"),
      h("div", { class: "prompt" }, "💭", h("span", { text: PROMPTS[pi] }),
        h("button", { type: "button", title: "別の問い", text: "↻", onclick: () => { d.prompt = pi + 1; save(); renderDrawer(); } })),
    ];
  }
  function overview() {
    const r = cur(), list = ents();
    const rows = list.map((e) => h("button", { type: "button", onclick: () => select(e.id) }, h("b", { text: e.name }), h("span", { text: cardLabel(e.d) })));
    const draws = r.draws.slice(-3).reverse().map((dr) => h("div", { class: "muted", text: `${new Date(dr.at).toLocaleString("ja-JP")}　${methodText(dr)}　種: ${String(dr.seed).slice(0, 40)}` }));
    let armed = true;
    return [
      h("h3", { text: spec().name }),
      list.length ? h("div", { class: "ov-list" }, rows) : h("div", { class: "muted", text: "＋カード でカードを置く場所を足せます" }),
      h("h3", { text: "まとめ" }),
      h("textarea", { id: "summary", class: "grow", placeholder: "全体としての結論・次にやること", value: r.summary,
        onfocus: () => { armed = true; }, oninput: (ev) => { if (armed) { snap(); armed = false; } r.summary = ev.target.value; save(); } }),
      draws.length ? h("h3", { text: "引いた記録" }) : null, ...draws,
      h("details", { class: "help" }, h("summary", { text: "操作とキー" }),
        h("p", { text: "盤面: クリック＝文字を書く / ドラッグ＝ペン / カードから別のカードへドラッグ＝つなぐ（流れ・ぶつかり・ひとこと）/ Ctrl+ドラッグ＝カードや文字を動かす・空きなら画面を動かす / 右クリック＝消す（カードはメニュー）/ ホイール＝拡大縮小" }),
        h("p", { text: "カード名: 数字 0〜21＝大アルカナ、w/c/s/p＋a,2〜10,pg,kn,q,k＝小アルカナ（例 w10, ckn）。末尾 r で逆位置。日本語・英語名の一部でも可。Enter で置いて次の空きへ" }),
        h("p", { text: "Ctrl+D 引く / Ctrl+R 全部めくる / Ctrl+B カードを足す / Ctrl+N 新しい読み / Ctrl+S 書き出し / Ctrl+Z・Ctrl+Y 元に戻す・やり直す / Ctrl+0 全体を表示 / Esc 選択を外す" })),
    ];
  }

  // ================= 上のバー =================
  function renderHeader() {
    $("#title").value = cur().title;
    const sp = $("#spread"); sp.replaceChildren(...SPREADS.map((s) => h("option", { value: s.id, text: s.name }))); sp.value = cur().spread;
    const st = store.settings;
    $("#btn-rev").textContent = st.revOn ? `逆位置あり ${st.revProb}%` : "逆位置なし";
    $("#btn-rev").classList.toggle("on", st.revOn);
    $("#colors").replaceChildren(...COLORS.map((c) => h("button", { type: "button", class: "sw" + (st.color === c ? " on" : ""), style: `background:${c}`, title: "ペンと文字の色",
      onclick: () => { st.color = c; persistSoon(); renderHeader(); } })));
    renderHistory();
  }
  function renderHistory() {
    const hs = $("#history");
    const items = Object.values(store.readings).sort((a, b) => b.updated - a.updated);
    hs.replaceChildren(...items.map((r) => h("option", { value: r.id, text: (r.title || "（無題）") + "　" + new Date(r.updated).toLocaleDateString("ja-JP") })));
    hs.value = store.current;
  }
  { let armed = true;
    $("#title").addEventListener("focus", () => { armed = true; });
    $("#title").addEventListener("input", (e) => { if (armed) { snap(); armed = false; } cur().title = e.target.value; save(); }); }
  $("#title").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("#history").addEventListener("change", (e) => { store.current = e.target.value; switchReading(); });
  function switchReading() { hist.u.length = 0; hist.r.length = 0; sel = null; selLink = null; renderAll(true); }
  $("#btn-new").addEventListener("click", newOne);
  function newOne() { const r = newReading(cur().spread); store.readings[r.id] = r; store.current = r.id; persist(); switchReading(); $("#title").focus(); }
  $("#btn-del").addEventListener("click", () => {
    if (!confirm("この読みを削除しますか？（元に戻せません）")) return;
    delete store.readings[store.current];
    const rest = Object.values(store.readings).sort((a, b) => b.updated - a.updated);
    if (rest.length) store.current = rest[0].id; else { const r = newReading("hexagram"); store.readings[r.id] = r; store.current = r.id; }
    persist(); switchReading();
  });
  $("#spread").addEventListener("change", (e) => {
    const r = cur(), to = SPREAD[e.target.value], keep = new Set(to.pos.map((p) => p.id));
    const lost = Object.entries(r.slots).filter(([id, s]) => !keep.has(id) && (s.card || s.std || s.pos || s.mine));
    if (lost.length && !confirm(`${lost.length}か所の入力が新しいスプレッドに引き継がれず消えます。変更しますか？`)) { e.target.value = r.spread; return; }
    snap(); r.spread = to.id;
    for (const id of Object.keys(r.slots)) if (!keep.has(id)) delete r.slots[id];
    for (const s of Object.values(r.slots)) { delete s.x; delete s.y; }
    const ok = new Set(ents().map((x) => x.id)); r.links = r.links.filter((l) => ok.has(l.a) && ok.has(l.b));
    sel = null; save(); renderAll(true);
  });
  $("#btn-draw").addEventListener("click", doDraw);
  $("#deck").addEventListener("click", doDraw);
  $("#btn-rev").addEventListener("click", () => { store.settings.revOn = !store.settings.revOn; persistSoon(); renderHeader(); });
  $("#btn-drawopt").addEventListener("click", () => { if ($("#drawopt").hidden) openDrawOpt(); else closeFloat(); });
  $("#btn-reveal").addEventListener("click", revealAll);
  $("#btn-add").addEventListener("click", addCard);
  $("#btn-undo").addEventListener("click", undo);
  $("#btn-redo").addEventListener("click", redo);
  $("#btn-fit").addEventListener("click", fit);
  $("#btn-export").addEventListener("click", exportAll);
  function addCard() {
    snap();
    const r = cur(), sp = spec(), cw = CW(), ch = CH(), n = r.free.length;
    const x0 = sp.pos.length ? sp.w + 30 + cw / 2 : 60 + cw / 2;
    const f = Object.assign(blank(), { id: uid(), x: Math.round(x0 + (n % 3) * (cw + 50)), y: Math.round(ch / 2 + 40 + Math.floor(n / 3) * (ch + 100)) });
    r.free.push(f); save(); renderBoard(); if (view.auto) fit(); select("f:" + f.id, true);
  }

  // ================= キー =================
  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest && e.target.closest("input, textarea, [contenteditable]");
    if (e.ctrlKey && !e.altKey) {
      const k = e.key.toLowerCase();
      const run = (f) => { e.preventDefault(); f(); };
      if (k === "z" && !typing) return run(e.shiftKey ? redo : undo);
      if (k === "y" && !typing) return run(redo);
      if (k === "d") return run(doDraw);
      if (k === "r") return run(revealAll);
      if (k === "b") return run(addCard);
      if (k === "n") return run(newOne);
      if (k === "s") return run(exportAll);
      if (k === "0") return run(fit);
      return;
    }
    if (e.key === "Escape") {
      if (!$("#pop").hidden || !$("#menu").hidden || !$("#drawopt").hidden) { closeFloat(); return; }
      if (typing) { e.target.blur(); return; }
      if (sel) { sel = null; markSel(); renderDrawer(); }
      return;
    }
    if (typing) return;
    if ((e.key === "Delete" || e.key === "Backspace") && selLink) { e.preventDefault(); removeLink(selLink); return; }
    // 位置を選んだまま文字を打つと、カード名の入力欄へ
    if (sel && e.key.length === 1 && !e.metaKey) { const inp = $("#card-input"); if (inp) inp.focus(); }
  });

  // ================= 書き出し =================
  const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };
  function toMarkdown(imgRef) {
    const r = cur(), sp = spec(), list = ents(), E = Object.fromEntries(list.map((e) => [e.id, e])), L = [];
    const one = (s) => (s || "").trim().replace(/\n+/g, " ");
    L.push(`# ${r.title || "（無題）"}`, "", `- スプレッド: ${sp.name}`, `- 日付: ${new Date(r.created).toLocaleString("ja-JP")}`);
    const dr = r.draws[r.draws.length - 1];
    if (dr) L.push(`- 引き方: ${methodText(dr)}（種: ${dr.seed}）`);
    L.push("");
    if (imgRef) L.push(`![](${imgRef})`, "");
    for (const e of list) {
      const d = e.d || {}, c = d.card && CARD[d.card];
      L.push(`## ${e.name} ・ ${cardLabel(d)}`, "");
      if (e.hint) L.push(`- 位置の意味: ${e.hint}`);
      if (c && d.revealed) L.push(`- キーワード: ${d.rev ? c.rv : c.up}`);
      L.push(`- 標準の意味: ${one(d.std)}`, `- この位置での読み: ${one(d.pos)}`, `- 自分の解釈: ${one(d.mine)}`, "");
    }
    const links = r.links.filter((l) => E[l.a] && E[l.b]);
    if (links.length) {
      L.push("## つながり", "");
      for (const l of links) L.push(`- ${E[l.a].name} ${l.kind === "clash" ? "↔" : "→"} ${E[l.b].name}（${l.kind === "clash" ? "ぶつかり" : "流れ"}）${l.label ? ": " + l.label : ""}`);
      L.push("");
    }
    const notes = r.items.filter((i) => i.type === "text").sort((a, b) => a.y - b.y || a.x - b.x);
    if (notes.length) { L.push("## メモ", ""); for (const n of notes) L.push("- " + n.text.replace(/\n/g, " / ")); L.push(""); }
    if (r.summary.trim()) L.push("## まとめ", "", r.summary.trim(), "");
    return L.join("\n");
  }
  const imgCache = {};
  const loadImg = (src) => (imgCache[src] ||= new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error(src)); i.src = src; }));
  async function renderPng() {
    const r = cur(), b = bounds(), pad = 50, top = 80, S = 2, cw = CW(), ch = CH(), list = ents(), E = Object.fromEntries(list.map((e) => [e.id, e]));
    const W = Math.ceil(b.x1 - b.x0 + pad * 2), H = Math.ceil(b.y1 - b.y0 + pad * 2 + top);
    const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
    const g = cv.getContext("2d"); g.scale(S, S);
    const bg = g.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, Math.max(W, H) * 0.75);
    bg.addColorStop(0, "#22424a"); bg.addColorStop(0.5, "#15292f"); bg.addColorStop(1, "#0a1418");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.fillStyle = GOLD; g.font = `700 34px ${SERIF}`; g.fillText(r.title || "（無題）", W / 2, 56);
    g.translate(pad - b.x0, pad + top - b.y0);
    const halo = (t, x, y) => { g.lineWidth = 7; g.lineJoin = "round"; g.strokeStyle = "rgba(10,20,24,.92)"; g.strokeText(t, x, y); g.fillText(t, x, y); };
    for (const l of r.links) {
      const k = linkGeom(l, E, cw, ch); if (!k) continue;
      g.strokeStyle = k.col; g.fillStyle = k.col; g.lineWidth = 4; g.lineCap = "round"; g.setLineDash(l.kind === "clash" ? [16, 11] : []);
      g.beginPath(); g.moveTo(k.p.x, k.p.y); g.lineTo(k.q.x, k.q.y); g.stroke(); g.setLineDash([]);
      const head = (pt, a) => { g.save(); g.translate(pt.x, pt.y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.lineTo(-20, -9); g.lineTo(-20, 9); g.closePath(); g.fill(); g.restore(); };
      head(k.q, k.ang); if (l.kind === "clash") head(k.p, k.ang + Math.PI);
      if (l.label) { g.font = `600 20px ${SANS}`; g.fillStyle = k.col; halo(l.label, (k.p.x + k.q.x) / 2, (k.p.y + k.q.y) / 2 + 7); }
    }
    for (const e of list) {
      const d = e.d || {}, c = d.card && CARD[d.card], x0 = e.x - cw / 2, y0 = e.y - ch / 2;
      if (c) {
        const im = await loadImg(d.revealed ? imgUrl(c) : BACK);
        g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 20; g.shadowOffsetY = 8;
        g.beginPath(); g.roundRect(x0, y0, cw, ch, 9); g.fillStyle = "#000"; g.fill(); g.restore();
        g.save(); g.beginPath(); g.roundRect(x0, y0, cw, ch, 9); g.clip();
        if (d.revealed && d.rev) { g.translate(e.x, e.y); g.rotate(Math.PI); g.drawImage(im, -cw / 2, -ch / 2, cw, ch); } else g.drawImage(im, x0, y0, cw, ch);
        g.restore();
        g.strokeStyle = "rgba(216,180,106,.5)"; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x0, y0, cw, ch, 9); g.stroke();
      } else {
        g.setLineDash([8, 6]); g.strokeStyle = "rgba(216,180,106,.5)"; g.lineWidth = 2; g.beginPath(); g.roundRect(x0, y0, cw, ch, 9); g.stroke(); g.setLineDash([]);
        g.fillStyle = "rgba(216,180,106,.35)"; g.font = `700 48px ${SERIF}`; g.fillText("?", e.x, e.y + 16);
      }
      const sub = c ? (d.revealed ? c.ja + (d.rev ? "（逆）" : "") : "伏せたカード") : "";
      g.font = `700 17px ${SERIF}`; const w1 = g.measureText(e.name).width; g.font = `13px ${SANS}`; const w2 = sub ? g.measureText(sub).width : 0;
      const pw = Math.max(w1, w2) + 26, ph = sub ? 46 : 28, py = y0 + ch + 8;
      g.fillStyle = "rgba(8,12,16,.78)"; g.strokeStyle = "rgba(216,180,106,.45)"; g.lineWidth = 1;
      g.beginPath(); g.roundRect(e.x - pw / 2, py, pw, ph, 10); g.fill(); g.stroke();
      g.fillStyle = GOLD; g.font = `700 17px ${SERIF}`; g.fillText(e.name, e.x, py + 21);
      if (sub) { g.fillStyle = "#d9d2c0"; g.font = `13px ${SANS}`; g.fillText(sub, e.x, py + 39); }
    }
    g.lineCap = "round"; g.lineJoin = "round";
    for (const it of r.items) if (it.type === "stroke") { g.strokeStyle = it.color; g.lineWidth = it.w || 3; g.stroke(new Path2D(smooth(it.pts))); }
    g.textAlign = "left"; g.textBaseline = "top"; g.font = `22px ${SANS}`;
    for (const it of r.items) if (it.type === "text") { g.fillStyle = it.color; it.text.split("\n").forEach((ln, i) => g.fillText(ln, it.x + 3, it.y + 4 + i * 31)); }
    return new Promise((ok) => cv.toBlob(ok, "image/png"));
  }
  async function exportAll() {
    const name = "tarot-" + stamp();
    let png = null;
    try { png = await renderPng(); } catch (e) { toast("画像を作れませんでした: " + e.message); }
    const md = toMarkdown(png ? "__PNG__" : null);
    if (window.native && window.native.saveExport) {
      const p = await window.native.saveExport({ name, md, png: png ? await png.arrayBuffer() : null });
      if (p) toast("書き出しました: " + p);
      return;
    }
    const dl = (n, blob) => { const a = h("a", { href: URL.createObjectURL(blob), download: n }); document.body.append(a); a.click(); a.remove(); };
    dl(name + ".md", new Blob([md.replace("__PNG__", name + ".png")], { type: "text/markdown;charset=utf-8" }));
    if (png) dl(name + ".png", png);
  }

  // ================= その他 =================
  let toastT;
  function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 3500); }
  function renderAll(refit) {
    renderHeader(); renderBoard(); renderDrawer();
    if (refit || view.auto) fit();
  }
  window.TarotApp = { toMarkdown, renderPng, doDraw, revealAll, state: () => cur(), settings: () => store.settings }; // 試験用
  renderAll(true);
  requestAnimationFrame(() => fit());
})();
