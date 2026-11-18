// 書き出し: .md（木の形＋種類ごとのまとめ）と .png（盤面の絵）
(function () {
  "use strict";
  const TB = window.TB, { h } = TB;
  const SANS = '"Noto Sans CJK JP","Noto Sans JP",sans-serif';
  const INK = "#2b2d33", SUB = "#6a6f7d";
  const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };

  TB.toMarkdown = (imgRef) => {
    const b = TB.B(), L = [], seen = new Set();
    const kids = (id) => b.links.filter((l) => l.a === id).map((l) => TB.node(l.b)).filter((n) => n && n.t === "idea");
    const tag = (n) => (n.kind && n.kind !== "note" ? `【${TB.KINDS[n.kind].name}】` : "");
    const tree = (id, depth) => { for (const k of kids(id)) { if (seen.has(k.id)) continue; seen.add(k.id); L.push(`${"  ".repeat(depth)}- ${tag(k)}${k.text.replace(/\n/g, " / ")}`); tree(k.id, depth + 1); } };
    const tpl = TB.TEMPLATES.find((t) => t.id === b.template);
    L.push(`# ${b.title || "（無題）"}`, "", `- 種類: ${tpl ? tpl.group + " ・ " + tpl.name : "自由"}`, `- 日付: ${new Date(b.created).toLocaleString("ja-JP")}`);
    for (const dr of b.draws.slice(-3)) L.push(`- 引き方: ${TB.drawText(dr)}`);
    L.push("");
    if (imgRef) L.push(`![](${imgRef})`, "");
    for (const c of b.nodes.filter((n) => n.center)) { seen.add(c.id); L.push(`## ${c.text || "テーマ"}`, ""); tree(c.id, 0); L.push(""); }
    const cards = b.nodes.filter((n) => n.t === "card");
    if (cards.length) {
      L.push("## カード", "");
      for (const n of cards) {
        const it = TB.item(n), D = TB.deckOf(n);
        L.push(`### ${TB.slotName(n)} ・ ${it ? D.label(it, n.rev) : "未設定"}`, "");
        if (n.hint) L.push(`- 位置の意味: ${n.hint}`);
        if (it && n.deck === "tarot") L.push(`- キーワード: ${n.rev ? it.rv : it.up}（${n.rev ? it.rvText : it.upText}）`);
        if (it && n.deck === "iching") {
          L.push(`- 卦: ${it.kw}（${it.text}）`, `- 上卦 ${it.upper.name}（${it.upper.nature}）／下卦 ${it.lower.name}（${it.lower.nature}）`);
          if (n.moving && n.moving.length) L.push(`- 変わる爻: ${n.moving.map((i) => window.IChing.LINE_POS[i]).join("、")}`);
        }
        if (it && n.deck === "prompt") L.push(`- 問い: ${it.question}`);
        if (n.pos) L.push(`- この位置での読み: ${n.pos.trim().replace(/\n+/g, " ")}`);
        if (n.mine) L.push(`- 自分の解釈: ${n.mine.trim().replace(/\n+/g, " ")}`);
        const before = L.length; tree(n.id, 0); if (L.length > before) L.splice(before, 0, "", "アイデア:", "");
        L.push("");
      }
    }
    const cl = b.links.filter((l) => TB.node(l.a)?.t === "card" && TB.node(l.b)?.t === "card");
    if (cl.length) {
      L.push("## カードどうしのつながり", "");
      for (const l of cl) L.push(`- ${TB.slotName(TB.node(l.a))} — ${TB.slotName(TB.node(l.b))}${l.label ? ": " + l.label : ""}`);
      L.push("");
    }
    const rest = b.nodes.filter((n) => n.t === "idea" && !n.center && !seen.has(n.id));
    if (rest.length) { L.push("## そのほかのアイデア", ""); for (const n of rest) { if (seen.has(n.id)) continue; seen.add(n.id); L.push(`- ${tag(n)}${n.text.replace(/\n/g, " / ")}`); tree(n.id, 1); } L.push(""); }
    for (const f of b.frames) {
      const inF = b.nodes.filter((n) => n.x > f.x && n.x < f.x + f.w && n.y > f.y && n.y < f.y + f.h);
      if (!inF.length) continue;
      L.push(`## グループ: ${f.title}`, "", ...inF.map((n) => `- ${n.t === "idea" ? tag(n) + n.text.replace(/\n/g, " / ") : TB.slotName(n)}`), "");
    }
    for (const [k, head] of [["act", "次にやること"], ["ask", "残った問い"], ["worry", "心配なこと"]]) {
      const list = b.nodes.filter((n) => n.t === "idea" && n.kind === k);
      if (list.length) L.push(`## ${head}`, "", ...list.map((n) => `- [ ] ${n.text.replace(/\n/g, " / ")}`.replace(k === "act" ? "" : "[ ] ", "")), "");
    }
    const notes = b.items.filter((i) => i.type === "text").sort((a, c) => a.y - c.y || a.x - c.x);
    if (notes.length) L.push("## メモ", "", ...notes.map((n) => "- " + n.text.replace(/\n/g, " / ")), "");
    if (b.summary.trim()) L.push("## まとめ", "", b.summary.trim(), "");
    return L.join("\n");
  };

  // ---- 画像 ----
  const imgCache = {};
  const loadImg = (src) => (imgCache[src] ||= new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error(src)); i.src = src; }));
  function wrap(g, text, maxW) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const ch of para) { if (g.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch; }
      out.push(line);
    }
    return out;
  }
  TB.renderPng = async () => {
    const b = TB.B(), bb = TB.bounds(), pad = 50, top = 80, S = 2;
    const W = Math.ceil(bb.x1 - bb.x0 + pad * 2), H = Math.ceil(bb.y1 - bb.y0 + pad * 2 + top);
    const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
    const g = cv.getContext("2d"); g.scale(S, S);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.fillStyle = INK; g.font = `700 30px ${SANS}`; g.fillText(b.title || "（無題）", W / 2, 56);
    g.translate(pad - bb.x0, pad + top - bb.y0);
    const rr = (x, y, w, hh, r) => { g.beginPath(); g.roundRect(x, y, w, hh, r); };
    // 枠
    for (const f of b.frames) {
      g.fillStyle = "#fafbfc"; g.strokeStyle = "#e1e3e9"; g.lineWidth = 1; rr(f.x, f.y, f.w, f.h, 10); g.fill(); g.stroke();
      g.font = `700 14px ${SANS}`; g.textAlign = "left"; g.fillStyle = SUB; g.fillText(f.title, f.x + 14, f.y - 8);
    }
    // 線
    for (const { l, g: k } of TB.routeLinks(b)) {
      g.strokeStyle = "#c4c8d2"; g.lineWidth = 1.6; g.lineCap = "round"; g.stroke(new Path2D(k.d));
      if (k.lab) { g.fillStyle = "#fff"; rr(k.lab.x - k.lab.w / 2, k.lab.y - 13, k.lab.w, 26, 6); g.fill(); g.font = `13px ${SANS}`; g.textAlign = "center"; g.fillStyle = SUB; g.fillText(l.label, k.lab.x, k.lab.y + 5); }
    }
    // カードとアイデア
    for (const n of b.nodes) {
      const r = TB.rectOf(n), x0 = r.x - r.w / 2, y0 = r.y - r.h / 2;
      if (n.t === "idea") {
        g.fillStyle = "#fff"; rr(x0, y0, r.w, r.h, 6); g.fill();
        if (n.center) { g.fillStyle = INK; g.fillRect(x0, y0 + r.h - 2, r.w, 2); }
        g.font = n.center ? `700 20px ${SANS}` : `15px ${SANS}`; g.fillStyle = INK; g.textAlign = "center";
        const lines = wrap(g, n.text, r.w - 12), lh = n.center ? 28 : 22, ty = r.y - ((lines.length - 1) * lh) / 2 + (n.center ? 7 : 5);
        lines.forEach((ln, i) => g.fillText(ln, r.x, ty + i * lh));
        continue;
      }
      const it = TB.item(n);
      if (!it) { g.setLineDash([8, 6]); g.strokeStyle = "#c4c8d2"; g.lineWidth = 2; rr(x0, y0, r.w, r.h, 9); g.stroke(); g.setLineDash([]); }
      else if (n.deck === "tarot") {
        const im = await loadImg(window.Cards.imgUrl(it));
        g.save(); rr(x0, y0, r.w, r.h, 9); g.clip();
        if (n.rev) { g.translate(r.x, r.y); g.rotate(Math.PI); g.drawImage(im, -r.w / 2, -r.h / 2, r.w, r.h); } else g.drawImage(im, x0, y0, r.w, r.h);
        g.restore();
      } else if (n.deck === "iching") {
        g.fillStyle = "#fff"; rr(x0, y0, r.w, r.h, 9); g.fill();
        g.fillStyle = SUB; g.font = `13px ${SANS}`; g.textAlign = "center"; g.fillText(`第${it.num}卦`, r.x, y0 + 26);
        it.lines.forEach((v, i) => { const y = y0 + 150 - i * 17, lx = x0 + 22, lw = r.w - 44; g.fillStyle = INK; if (v) g.fillRect(lx, y, lw, 10); else { g.fillRect(lx, y, lw * 0.43, 10); g.fillRect(lx + lw * 0.57, y, lw * 0.43, 10); }
          if (n.moving && n.moving.includes(i)) { g.fillStyle = "#c0392b"; g.beginPath(); g.arc(x0 + r.w - 12, y + 5, 4, 0, 7); g.fill(); } });
        g.fillStyle = INK; g.font = `700 19px ${SANS}`; g.fillText(it.name, r.x, y0 + r.h - 28);
      } else {
        g.fillStyle = "#fff"; rr(x0, y0, r.w, r.h, 9); g.fill(); g.fillStyle = it.color; g.fillRect(x0, y0, r.w, 6);
        g.fillStyle = SUB; g.font = `12px ${SANS}`; g.textAlign = "center"; g.fillText(it.setName, r.x, y0 + 24);
        g.fillStyle = INK; g.font = `700 19px ${SANS}`; wrap(g, it.name, r.w - 20).slice(0, 3).forEach((ln, i) => g.fillText(ln, r.x, y0 + 72 + i * 26));
        g.font = `13px ${SANS}`; g.fillStyle = SUB; wrap(g, it.question, r.w - 20).slice(0, 5).forEach((ln, i) => g.fillText(ln, r.x, y0 + 140 + i * 18));
      }
      g.strokeStyle = "#e1e3e9"; g.lineWidth = 1; rr(x0, y0, r.w, r.h, 8); g.stroke();
      const name = TB.slotName(n), sub = it ? TB.deckOf(n).short(it, n.rev) : "", py = y0 + r.h + 6;
      g.textAlign = "center"; g.fillStyle = SUB; g.font = `12px ${SANS}`; g.fillText(name, r.x, py + 13);
      if (sub) { g.fillStyle = INK; g.font = `14px ${SANS}`; g.fillText(sub, r.x, py + 32); }
    }
    g.lineCap = "round"; g.lineJoin = "round";
    for (const it of b.items) if (it.type === "stroke") { g.strokeStyle = TB.ink(it.color); g.lineWidth = 2.5; g.stroke(new Path2D(TB.smooth(it.pts))); }
    g.textAlign = "left"; g.textBaseline = "top"; g.font = `20px ${SANS}`;
    for (const it of b.items) if (it.type === "text") { g.fillStyle = TB.ink(it.color); it.text.split("\n").forEach((ln, i) => g.fillText(ln, it.x + 3, it.y + 4 + i * 29)); }
    return new Promise((ok) => cv.toBlob(ok, "image/png"));
  };

  TB.exportAll = async () => {
    const b = TB.B(), name = (b.title || "brainstorm").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40) + "-" + stamp();
    let png = null;
    try { png = await TB.renderPng(); } catch (e) { TB.toast("画像を作れませんでした: " + e.message); }
    const md = TB.toMarkdown(png ? "__PNG__" : null);
    if (window.native && window.native.saveExport) {
      const p = await window.native.saveExport({ name, md, png: png ? await png.arrayBuffer() : null });
      if (p) TB.toast("書き出しました: " + p);
      return;
    }
    const dl = (n, blob) => { const a = h("a", { href: URL.createObjectURL(blob), download: n }); document.body.append(a); a.click(); a.remove(); };
    dl(name + ".md", new Blob([md.replace("__PNG__", name + ".png")], { type: "text/markdown;charset=utf-8" }));
    if (png) dl(name + ".png", png);
  };
})();
