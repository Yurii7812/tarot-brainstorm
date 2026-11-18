(function () {
  "use strict";
  const { ALL: CARDS, BY_ID: CARD, search, imgUrl } = window.Cards;
  const { ALL: SPREADS, BY_ID: SPREAD } = window.Spreads;
  const KEY = "tarot-brainstorm/v1";
  const KINDS = { flow: "流れ", clash: "ぶつかり" };
  const GREY = "#7a7a7a", RED = "#c0392b";
  const $ = (s) => document.querySelector(s);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SVG_TAGS = new Set(["svg", "g", "rect", "image", "text", "line", "path", "polygon", "tspan"]);

  // ---- DOM ヘルパー ----
  function h(tag, attrs, ...kids) {
    const el = SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else if (k === "value" && !SVG_TAGS.has(tag)) el.value = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }

  // ---- 状態 ----
  let store = load();
  let sel = null; // 選択中の位置 id
  let focusNext = null; // 描画後に入力欄へフォーカス

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.readings && s.readings[s.current]) return s;
    } catch (e) { /* 壊れていたら作り直す */ }
    const r = newReading("hexagram");
    return { current: r.id, readings: { [r.id]: r } };
  }
  let saveTimer;
  function save() {
    cur().updated = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 容量超過など */ }
      renderHistory();
    }, 250);
  }
  function newReading(spreadId) {
    const id = "r" + Date.now().toString(36);
    return { id, title: "", spread: spreadId, created: Date.now(), updated: Date.now(), slots: {}, links: [], summary: "" };
  }
  const cur = () => store.readings[store.current];
  const spec = () => SPREAD[cur().spread];
  const slot = (pid) => (cur().slots[pid] ||= { card: null, rev: false, label: "", std: "", pos: "", mine: "" });
  const posName = (p) => (cur().slots[p.id] && cur().slots[p.id].label) || p.name;
  const posById = (pid) => spec().pos.find((p) => p.id === pid);
  const cardName = (s) => (s && s.card ? CARD[s.card].ja + (s.rev ? "（逆位置）" : "") : "未入力");

  // ---- ヘッダー ----
  function renderHeader() {
    $("#title").value = cur().title;
    const sp = $("#spread"); sp.replaceChildren(...SPREADS.map((s) => h("option", { value: s.id, text: s.name })));
    sp.value = cur().spread;
    renderHistory();
  }
  function renderHistory() {
    const hs = $("#history");
    const items = Object.values(store.readings).sort((a, b) => b.updated - a.updated);
    hs.replaceChildren(...items.map((r) =>
      h("option", { value: r.id, text: (r.title || "（無題）") + "　" + new Date(r.updated).toLocaleDateString("ja-JP") })));
    hs.value = store.current;
  }
  $("#title").addEventListener("input", (e) => { cur().title = e.target.value; save(); });
  $("#summary").addEventListener("input", (e) => { cur().summary = e.target.value; save(); });
  $("#history").addEventListener("change", (e) => { store.current = e.target.value; sel = null; renderAll(); });
  $("#btn-new").addEventListener("click", () => {
    const r = newReading(cur().spread);
    store.readings[r.id] = r; store.current = r.id; sel = null; renderAll(); save();
    $("#title").focus();
  });
  $("#btn-del").addEventListener("click", () => {
    if (!confirm("この読みを削除しますか？（元に戻せません）")) return;
    delete store.readings[store.current];
    const rest = Object.keys(store.readings);
    if (rest.length) store.current = rest[0];
    else { const r = newReading("hexagram"); store.readings[r.id] = r; store.current = r.id; }
    sel = null; renderAll(); save();
  });
  $("#spread").addEventListener("change", (e) => {
    const r = cur(), to = SPREAD[e.target.value];
    const keep = new Set(to.pos.map((p) => p.id));
    const lost = Object.entries(r.slots).filter(([id, s]) => !keep.has(id) && (s.card || s.std || s.pos || s.mine));
    if (lost.length && !confirm(`${lost.length}か所の入力が新しいスプレッドに引き継がれず消えます。変更しますか？`)) {
      e.target.value = r.spread; return;
    }
    r.spread = to.id;
    for (const id of Object.keys(r.slots)) if (!keep.has(id)) delete r.slots[id];
    r.links = r.links.filter((l) => keep.has(l.a) && keep.has(l.b));
    sel = null; renderAll(); save();
  });

  // ---- 盤面（SVG）。画面表示と画像出力で同じ関数を使う ----
  const CH = (cw) => Math.round((cw * 1200) / 720);
  function edgePoint(c, o, cw, ch, margin) {
    const dx = o.x - c.x, dy = o.y - c.y;
    const tx = dx ? (cw / 2 + margin) / Math.abs(dx) : 1e9;
    const ty = dy ? (ch / 2 + margin) / Math.abs(dy) : 1e9;
    const t = Math.min(tx, ty);
    return { x: c.x + dx * t, y: c.y + dy * t };
  }
  function buildSvg(opt) {
    opt = opt || {};
    const sp = spec(), r = cur(), cw = sp.cw, ch = CH(cw);
    const svg = h("svg", { viewBox: `0 0 ${sp.w} ${sp.h}`, xmlns: SVG_NS, role: "group", "aria-label": "スプレッド" });
    const top = opt.title ? -70 : 0;
    if (opt.bg) svg.append(h("rect", { x: 0, y: top, width: sp.w, height: sp.h - top, fill: "#fff" }));
    if (opt.title) {
      svg.setAttribute("viewBox", `0 -70 ${sp.w} ${sp.h + 70}`);
      svg.append(h("text", { x: sp.w / 2, y: -26, "text-anchor": "middle", "font-size": 34, "font-weight": 700, fill: "#111", text: r.title || "（無題）" }));
    }

    // リンク（カードの下に描く）
    const lg = h("g"); svg.append(lg);
    const P = Object.fromEntries(sp.pos.map((p) => [p.id, p]));
    for (const l of r.links) {
      const a = P[l.a], b = P[l.b]; if (!a || !b) continue;
      const col = l.kind === "clash" ? RED : GREY;
      const p = edgePoint(a, b, cw, ch, 10), q = edgePoint(b, a, cw, ch, 10);
      lg.append(h("line", { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: col, "stroke-width": 5, "stroke-dasharray": l.kind === "clash" ? "20 13" : null }));
      const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      const head = (pt, a) => h("polygon", { points: "0,0 -22,-10 -22,10", fill: col, transform: `translate(${pt.x},${pt.y}) rotate(${a})` });
      lg.append(head(q, ang));
      if (l.kind === "clash") lg.append(head(p, ang + 180));
      if (l.label) {
        const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, w = l.label.length * 22 + 16;
        lg.append(h("rect", { x: mx - w / 2, y: my - 18, width: w, height: 32, fill: "#fff" }));
        lg.append(h("text", { x: mx, y: my + 6, "text-anchor": "middle", "font-size": 22, fill: col, text: l.label }));
      }
    }

    // カード
    for (const p of sp.pos) {
      const s = r.slots[p.id] || {}, c = s.card ? CARD[s.card] : null;
      const x0 = p.x - cw / 2, y0 = p.y - ch / 2;
      const g = h("g", opt.static ? {} : {
        class: "slot", tabindex: 0, role: "button", "aria-label": `${posName(p)}: ${cardName(s)}`,
        onclick: (e) => onSlotClick(p.id, e), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSlotClick(p.id, e); } },
      });
      if (c) {
        const href = opt.dataUris ? opt.dataUris[c.file] : imgUrl(c);
        g.append(h("image", { href, x: x0, y: y0, width: cw, height: ch, preserveAspectRatio: "xMidYMid slice",
          transform: s.rev ? `rotate(180 ${p.x} ${p.y})` : null }));
        g.append(h("rect", { x: x0, y: y0, width: cw, height: ch, fill: "none", stroke: "#999", "stroke-width": 2 }));
      } else {
        g.append(h("rect", { x: x0, y: y0, width: cw, height: ch, fill: "#fbfaf7", stroke: "#bbb", "stroke-width": 3, "stroke-dasharray": "10 8" }));
        g.append(h("text", { x: p.x, y: p.y + 14, "text-anchor": "middle", "font-size": 44, fill: "#ccc", text: "?" }));
      }
      if (!opt.static && sel === p.id) g.append(h("rect", { x: x0 - 7, y: y0 - 7, width: cw + 14, height: ch + 14, fill: "none", stroke: "#2b6cb0", "stroke-width": 5, rx: 4 }));
      const ty = y0 + ch + 28;
      g.append(h("text", { x: p.x, y: ty, "text-anchor": "middle", "font-size": 24, "font-weight": 700, fill: "#111", "paint-order": "stroke", stroke: "#fff", "stroke-width": 6, "stroke-linejoin": "round", text: posName(p) }));
      g.append(h("text", { x: p.x, y: ty + 26, "text-anchor": "middle", "font-size": 20, fill: "#666", "paint-order": "stroke", stroke: "#fff", "stroke-width": 6, "stroke-linejoin": "round", text: c ? CARD[s.card].ja + (s.rev ? "（逆）" : "") : "" }));
      svg.append(g);
    }
    return svg;
  }
  function renderBoard() { $("#board").replaceChildren(buildSvg()); }

  function onSlotClick(pid, e) {
    if (e && e.ctrlKey && sel && sel !== pid) { // Ctrl+クリック: 選択中の位置 → クリックした位置のリンクを追加
      cur().links.push({ id: "l" + Date.now().toString(36), a: sel, b: pid, kind: "flow", label: "" });
      save(); renderBoard(); renderLinks(); return;
    }
    select(pid, true);
  }
  function select(pid, focusInput) {
    sel = pid; focusNext = focusInput ? "card" : null;
    renderBoard(); renderPanel();
  }

  // ---- 右パネル（選択した位置の入力） ----
  function renderPanel() {
    const panel = $("#panel"), sp = spec();
    if (!sel || !posById(sel)) {
      panel.replaceChildren(
        h("p", { class: "muted", text: "左の盤面で位置を選ぶと、カードと3つの欄を入力できます。" }),
        h("button", { type: "button", text: "最初の空きから入力", onclick: () => { const p = sp.pos.find((p) => !(cur().slots[p.id] && cur().slots[p.id].card)) || sp.pos[0]; select(p.id, true); } }),
        cheatSheet());
      return;
    }
    const p = posById(sel), s = slot(sel);
    const input = h("input", { id: "card-input", placeholder: "例: 悪魔 / ワンド10 / w10 / 14r", autocomplete: "off", "aria-label": "カード入力" });
    const list = h("ul", { class: "sugg", hidden: true });
    let items = [], idx = 0, qrev = false;
    const refresh = () => {
      const res = search(input.value); items = res.cards; qrev = res.rev; idx = 0;
      list.replaceChildren(...items.map((c, i) => h("li", { class: i === 0 ? "on" : "", onmousedown: (e) => { e.preventDefault(); pick(c); } },
        h("span", { text: c.ja }), h("small", { text: c.ab + (qrev ? " ↺" : "") }))));
      list.hidden = !items.length;
    };
    const mark = () => [...list.children].forEach((li, i) => li.classList.toggle("on", i === idx));
    const pick = (c) => {
      s.card = c.id;
      if (qrev) s.rev = true;
      save();
      const order = sp.pos, nxt = order.slice(order.findIndex((q) => q.id === sel) + 1).find((q) => !(cur().slots[q.id] && cur().slots[q.id].card));
      if (nxt) select(nxt.id, true); else { focusNext = "std"; renderBoard(); renderPanel(); }
    };
    input.addEventListener("input", refresh);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" && items.length) { e.preventDefault(); idx = (idx + 1) % items.length; mark(); }
      else if (e.key === "ArrowUp" && items.length) { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; mark(); }
      else if (e.key === "Enter" && items.length) { e.preventDefault(); pick(items[idx]); }
      else if (e.key === "Escape") { input.value = ""; refresh(); }
    });

    const c = s.card ? CARD[s.card] : null;
    const cardRow = c ? h("div", { class: "cardrow" },
      h("img", { src: imgUrl(c), alt: c.ja, class: s.rev ? "rev" : "" }),
      h("div", {}, h("strong", { text: c.ja }), h("div", { class: "muted", text: c.en }),
        h("label", { style: "display:inline-flex;gap:4px;align-items:center;margin:4px 0" },
          h("input", { type: "checkbox", checked: s.rev, onchange: (e) => { s.rev = e.target.checked; save(); renderBoard(); renderPanel(); } }), "逆位置"),
        h("div", {}, h("button", { type: "button", text: "カードを外す", onclick: () => { s.card = null; s.rev = false; save(); renderBoard(); focusNext = "card"; renderPanel(); } }))))
      : h("p", { class: "muted", text: "カード未入力" });

    const area = (key, label, ph) => h("div", {}, h("label", { text: label }),
      h("textarea", { id: "f-" + key, rows: key === "std" ? 3 : 4, placeholder: ph, value: s[key], oninput: (e) => { s[key] = e.target.value; save(); } }));

    panel.replaceChildren(
      h("h2", {}, h("input", { value: s.label || p.name, "aria-label": "位置の名前", style: "font-size:17px;font-weight:700;width:100%", oninput: (e) => { s.label = e.target.value === p.name ? "" : e.target.value; save(); renderBoard(); } })),
      h("p", { class: "hint", text: p.hint || "" }),
      h("label", { text: "カード" }), input, list, cardRow,
      area("std", "① 標準の意味", "このカード自体の一般的な意味"),
      area("pos", "② この位置での読み", `「${posName(p)}」としてどう読むか`),
      area("mine", "③ 自分の解釈", "自分にとっての意味・気づき"),
      cheatSheet());
    if (focusNext) {
      const el = focusNext === "card" ? input : $("#f-" + focusNext);
      focusNext = null; if (el) el.focus();
    }
  }
  function cheatSheet() {
    return h("details", {}, h("summary", { text: "入力の略号" }),
      h("div", { text: "大アルカナ: 数字（0〜21）または m+数字。 小アルカナ: スート w=ワンド c=カップ s=ソード p=ペンタクル ＋ a(エース)/2〜10/pg(ペイジ)/kn(ナイト)/q(クイーン)/k(キング)。例: w10, ckn, sq。 末尾に r で逆位置（例: 14r, w8r）。日本語・英語名の一部でも検索できます。" }));
  }

  // ---- リンク ----
  function renderLinks() {
    const r = cur(), sp = spec();
    const posSel = (val, onch) => { const el = h("select", { onchange: onch }, sp.pos.map((p) => h("option", { value: p.id, text: posName(p) }))); el.value = val; return el; };
    const rows = r.links.map((l) => h("div", { class: "linkrow k-" + l.kind },
      posSel(l.a, (e) => { l.a = e.target.value; save(); renderBoard(); }),
      (() => { const k = h("select", { onchange: (e) => { l.kind = e.target.value; save(); renderBoard(); renderLinks(); } }, [["flow", "→ 流れ"], ["clash", "↔ ぶつかり"]].map(([v, t]) => h("option", { value: v, text: t }))); k.value = l.kind; return k; })(),
      posSel(l.b, (e) => { l.b = e.target.value; save(); renderBoard(); }),
      h("input", { class: "lbl", value: l.label, placeholder: "ひとこと（例: 外せる → 自制へ）", oninput: (e) => { l.label = e.target.value; save(); renderBoard(); } }),
      h("button", { type: "button", text: "×", "aria-label": "リンクを削除", onclick: () => { r.links = r.links.filter((x) => x !== l); save(); renderBoard(); renderLinks(); } })));
    const add = h("button", { type: "button", text: "＋ リンクを追加", onclick: () => {
      if (sp.pos.length < 2) return;
      const a = sel && posById(sel) ? sel : sp.pos[0].id, b = (sp.pos.find((p) => p.id !== a) || sp.pos[0]).id;
      r.links.push({ id: "l" + Date.now().toString(36), a, b, kind: "flow", label: "" });
      save(); renderBoard(); renderLinks();
    } });
    $("#links").replaceChildren(h("h3", { text: "カード間のつながり" }),
      h("p", { class: "muted", text: "灰色の実線＝流れ　／　赤の点線＝読みがぶつかるところ。盤面で位置を選んでから別の位置を Ctrl+クリックでも追加できます。" }),
      ...rows, sp.pos.length > 1 ? add : null);
  }

  // ---- 書き出し ----
  const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };
  const baseName = () => "tarot-" + stamp();
  function download(name, blob) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function toMarkdown(imgName) {
    const r = cur(), sp = spec(), L = [];
    L.push(`# ${r.title || "（無題）"}`, "", `- スプレッド: ${sp.name}`, `- 日付: ${new Date(r.created).toLocaleString("ja-JP")}`, "");
    if (imgName) L.push(`![](${imgName})`, "");
    for (const p of sp.pos) {
      const s = r.slots[p.id] || {};
      L.push(`## ${posName(p)} ・ ${cardName(s)}`, "");
      L.push(`- 標準の意味: ${(s.std || "").replace(/\n/g, " ")}`, `- この位置での読み: ${(s.pos || "").replace(/\n/g, " ")}`, `- 自分の解釈: ${(s.mine || "").replace(/\n/g, " ")}`, "");
    }
    if (r.links.length) {
      L.push("## つながり", "");
      for (const l of r.links) {
        const a = posById(l.a), b = posById(l.b); if (!a || !b) continue;
        L.push(`- ${posName(a)} ${l.kind === "clash" ? "↔" : "→"} ${posName(b)}（${KINDS[l.kind]}）${l.label ? ": " + l.label : ""}`);
      }
      L.push("");
    }
    if (r.summary.trim()) L.push("## まとめ", "", r.summary.trim(), "");
    return L.join("\n");
  }
  $("#btn-md").addEventListener("click", () => {
    const b = baseName();
    download(b + ".md", new Blob([toMarkdown(b + ".png")], { type: "text/markdown;charset=utf-8" }));
  });
  async function toDataUri(url) {
    const res = await fetch(url); if (!res.ok) throw new Error(url);
    const blob = await res.blob();
    return new Promise((ok, ng) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = ng; fr.readAsDataURL(blob); });
  }
  async function renderPng() {
    const sp = spec(), files = new Set(Object.values(cur().slots).filter((s) => s.card).map((s) => CARD[s.card].file));
    const dataUris = {};
    await Promise.all([...files].map(async (f) => { dataUris[f] = await toDataUri(imgUrl({ file: f })); }));
    const svg = buildSvg({ static: true, dataUris, bg: true, title: true });
    const W = sp.w, H = sp.h + 70, scale = 2;
    svg.setAttribute("width", W * scale); svg.setAttribute("height", H * scale);
    svg.setAttribute("font-family", '"Noto Sans CJK JP","Noto Sans JP",sans-serif');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image(); img.src = url; await img.decode();
    const cv = h("canvas", { width: W * scale, height: H * scale }); cv.getContext("2d").drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return new Promise((ok) => cv.toBlob(ok, "image/png"));
  }
  $("#btn-png").addEventListener("click", async () => {
    try { download(baseName() + ".png", await renderPng()); }
    catch (e) { alert("画像を出力できませんでした。ブラウザで index.html を直接開いた場合は、app/serve.sh で起動してください。\n" + e); }
  });
  window.TarotApp = { toMarkdown, renderPng }; // 試験用

  // ---- 全体 ----
  function renderAll() {
    renderHeader(); $("#summary").value = cur().summary;
    renderBoard(); renderPanel(); renderLinks();
  }
  renderAll();
})();
