// 新規作成・保存した一覧・写真から読み込む
(function () {
  "use strict";
  const TB = window.TB, { h, $ } = TB;
  const dlg = $("#dlg");
  let onClose = null;
  TB.openDialog = (cls, ...kids) => {
    dlg.replaceChildren(h("div", { class: "dlg-box " + cls }, h("button", { type: "button", class: "dlg-x icon", title: "閉じる（Esc）", text: "✕", onclick: TB.closeDialog }), ...kids));
    dlg.hidden = false;
  };
  TB.closeDialog = () => { dlg.hidden = true; dlg.replaceChildren(); if (onClose) { const f = onClose; onClose = null; f(); } };
  TB.dialogOpen = () => !dlg.hidden;
  dlg.addEventListener("pointerdown", (e) => { if (e.target === dlg) TB.closeDialog(); });

  TB.switchBoard = () => { TB.clearHist(); TB.sel = []; TB.selLink = null; TB.view.auto = true; TB.renderAll(); TB.fit(); };
  TB.addBoard = (b) => { TB.store.boards[b.id] = b; TB.store.current = b.id; TB.persist(); TB.switchBoard(); };

  // ================= 新規作成（ひな形・スプレッドはここでだけ選ぶ） =================
  TB.openNew = () => {
    const title = h("input", { class: "big", placeholder: "テーマ・問い（例: 来年やりたいこと／相手との関係をどうするか）" });
    const make = async (tid) => {
      if (tid === "photo") { TB.closeDialog(); TB.openPhoto(title.value.trim()); return; }
      const b = TB.build(tid, title.value.trim()); TB.closeDialog(); TB.addBoard(b);
      if (tid === "prompts3") { const c = b.nodes.find((n) => n.center); for (let i = 0; i < 3; i++) { TB.sel = [c.id]; await TB.doDraw("prompt"); } TB.select([]); TB.fit(); }
      else if (tid === "center") { const c = b.nodes.find((n) => n.center); TB.select(c.id); if (!b.title) TB.editIdea(c.id); else TB.newIdea(c.id); }
    };
    title.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); make("center"); } });
    const groups = {};
    for (const t of TB.TEMPLATES) (groups[t.group] ||= []).push(t);
    TB.openDialog("new", h("h2", { text: "新しく作る" }), title,
      h("div", { class: "tpl-groups" }, Object.entries(groups).map(([g, list]) => h("section", {}, h("h3", { text: g }),
        h("div", { class: "tpl-list" }, list.map((t) => h("button", { type: "button", class: "tpl", onclick: () => make(t.id) }, h("b", { text: t.name }), h("small", { text: t.desc }))))))),
      h("p", { class: "muted", text: "Enter で「中心テーマから」。スプレッドやひな形は、作ったあとは変えられません" }));
    title.focus();
  };

  // ================= 保存した一覧 =================
  function preview(b) {
    const cards = b.nodes.filter((n) => n.t === "card" && n.item).slice(0, 5);
    if (cards.length) return h("div", { class: "lib-cards" }, cards.map((n, i) => {
      const it = TB.DECKS[n.deck].get(n.item), st = `--i:${i - (cards.length - 1) / 2}`;
      if (n.deck === "tarot") return h("img", { src: window.Cards.imgUrl(it), alt: "", style: st, class: n.rev ? "rev" : null });
      return h("span", { class: "mini " + n.deck, style: st + (n.deck === "prompt" ? `;--pc:${it.color}` : ""), text: n.deck === "iching" ? it.glyph : it.name });
    }));
    const ideas = b.nodes.filter((n) => n.t === "idea").slice(0, 4);
    return h("div", { class: "lib-ideas" }, ideas.map((n) => h("span", { text: n.text })));
  }
  TB.openLibrary = () => {
    const q = h("input", { class: "big", placeholder: "探す（題・アイデア・カード名）" });
    const grid = h("div", { class: "lib-grid" });
    const text = (b) => [b.title, b.summary, ...b.nodes.map((n) => n.t === "idea" ? n.text : n.item ? TB.DECKS[n.deck].label(TB.DECKS[n.deck].get(n.item), n.rev) : "")].join(" ");
    const draw = () => {
      const k = q.value.trim();
      const list = Object.values(TB.store.boards).sort((a, b) => b.updated - a.updated).filter((b) => !k || text(b).includes(k));
      grid.replaceChildren(
        h("button", { type: "button", class: "lib-tile new", onclick: () => { TB.closeDialog(); TB.openNew(); } }, h("b", { text: "＋ 新しく作る" }), h("small", { text: "Ctrl+N" })),
        ...list.map((b) => {
          const tpl = TB.TEMPLATES.find((t) => t.id === b.template);
          return h("div", { class: "lib-tile" + (b.id === TB.store.current ? " cur" : ""), tabindex: 0,
            onclick: () => { TB.store.current = b.id; TB.persist(); TB.closeDialog(); TB.switchBoard(); },
            onkeydown: (e) => { if (e.key === "Enter") e.currentTarget.click(); } },
          preview(b), h("b", { class: "lib-title", text: b.title || "（無題）" }),
          h("small", { text: `${tpl ? tpl.name : ""}　${new Date(b.updated).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}　アイデア ${b.nodes.filter((n) => n.t === "idea").length}` }),
          h("button", { type: "button", class: "lib-del icon", title: "削除", text: "消す", onclick: (e) => {
            e.stopPropagation();
            if (!confirm(`「${b.title || "（無題）"}」を削除しますか？（元に戻せません）`)) return;
            delete TB.store.boards[b.id];
            if (!Object.keys(TB.store.boards).length) { const nb = TB.build("center", ""); TB.store.boards[nb.id] = nb; }
            if (!TB.store.boards[TB.store.current]) { TB.store.current = Object.values(TB.store.boards).sort((x, y) => y.updated - x.updated)[0].id; TB.switchBoard(); }
            TB.persist(); draw();
          } }));
        }));
    };
    q.addEventListener("input", draw); draw();
    TB.openDialog("lib", h("h2", { text: "保存した一覧" }), q, grid);
    q.focus();
  };

  // ================= 写真から読み込む =================
  TB.openPhoto = (title, img) => {
    const area = h("div", { class: "ph-area" });
    const file = h("input", { type: "file", accept: "image/*", hidden: true, onchange: (e) => { const f = e.target.files[0]; if (f) fromFile(f); } });
    const start = () => area.replaceChildren(
      h("div", { class: "ph-choose" },
        h("button", { type: "button", class: "primary", text: "写真を選ぶ", onclick: () => file.click() }),
        h("button", { type: "button", text: "カメラで撮る", onclick: camera }),
        h("p", { class: "muted", text: "ここに画像をドラッグしても読み込めます。カードがはっきり写るよう、真上から明るく撮ってください。全部この端末の中で調べます（送信しません）" })), file);
    const fromFile = (f) => { const i = new Image(); i.onload = () => analyze(i); i.onerror = () => TB.toast("画像を読めませんでした"); i.src = URL.createObjectURL(f); };
    area.addEventListener("dragover", (e) => e.preventDefault());
    area.addEventListener("drop", (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (f) fromFile(f); });
    let stream = null;
    onClose = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
    async function camera() {
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } } }); }
      catch (e) { TB.toast("カメラを使えませんでした: " + e.message); return; }
      const v = h("video", { autoplay: true, playsinline: true, class: "ph-video" }); v.srcObject = stream;
      area.replaceChildren(v, h("div", { class: "ph-actions" },
        h("button", { type: "button", class: "primary", text: "撮る", onclick: () => {
          const c = h("canvas", { width: v.videoWidth, height: v.videoHeight }); c.getContext("2d").drawImage(v, 0, 0);
          stream.getTracks().forEach((t) => t.stop()); stream = null;
          const i = new Image(); i.onload = () => analyze(i); i.src = c.toDataURL("image/jpeg", 0.92);
        } }), h("button", { type: "button", text: "やめる", onclick: () => { stream.getTracks().forEach((t) => t.stop()); stream = null; start(); } })));
    }
    async function analyze(image) {
      const msg = h("p", { class: "ph-progress", text: "準備しています…" });
      area.replaceChildren(h("img", { src: image.src, class: "ph-thumb" }), msg);
      try { const res = await window.Photo.analyze(image, (t) => (msg.textContent = t)); review(image, res); }
      catch (e) { msg.textContent = "読み込めませんでした: " + e.message; }
    }
    function review(image, res) {
      const layouts = Object.entries(TB.LAYOUTS).filter(([, L]) => L.deck === "tarot");
      const guess = { 1: "tarot:one", 3: "tarot:three", 7: "tarot:hexagram" }[res.cards.length] || (res.cards.length > 5 ? "tarot:hexagram" : "free");
      let lay = guess;
      const rows = res.cards.map((c) => ({ id: c.id, rev: c.rev, quad: c.quad, layout: c.layout, sure: c.sure, cands: c.cands, pos: -1 }));
      const assign = () => { const L = TB.LAYOUTS[lay]; const a = L ? window.Photo.assign(res.cards, L.pos) : res.cards.map(() => -1); rows.forEach((r, i) => { if (i < a.length) r.pos = a[i]; }); };
      assign();
      const titleIn = h("input", { class: "big", value: title || "", placeholder: "テーマ・問い" });
      const left = h("div", { class: "ph-left" }), right = h("div", { class: "ph-right" });
      const draw = () => {
        const L = TB.LAYOUTS[lay];
        // 写真と、見つけたカードの枠
        const svg = h("svg", { viewBox: `0 0 ${res.width} ${res.height}`, class: "ph-svg" });
        rows.forEach((r, i) => { if (!r.quad) return; svg.append(h("polygon", { points: r.quad.map((p) => p.join(",")).join(" "), class: r.sure ? "ok" : "unsure" }),
          h("text", { x: r.quad[0][0] + 8, y: r.quad[0][1] + 38, class: "ph-num", text: String(i + 1) })); });
        left.replaceChildren(h("div", { class: "ph-img" }, h("img", { src: image.src }), svg));
        const D = TB.DECKS.tarot;
        right.replaceChildren(
          h("label", { text: "並べ方" }),
          (() => { const s = h("select", { onchange: (e) => { lay = e.target.value; assign(); draw(); } }, layouts.map(([id, L2]) => h("option", { value: id, text: L2.name })), h("option", { value: "free", text: "写真の並びのまま" })); s.value = lay; return s; })(),
          h("div", { class: "ph-rows" }, rows.map((r, i) => {
            const it = r.id && D.get(r.id);
            const inp = h("input", { value: it ? it.ja : "", placeholder: "カード名・略号" });
            const sug = h("div", { class: "ph-cands" });
            inp.addEventListener("input", () => { const s = D.search(inp.value); sug.replaceChildren(...s.cards.slice(0, 6).map((c) => h("button", { type: "button", class: "chip", text: c.ja, onclick: () => { r.id = c.id; if (s.rev) r.rev = true; draw(); } }))); });
            return h("div", { class: "ph-row" + (r.sure || !r.quad ? "" : " unsure") },
              h("span", { class: "ph-n", text: r.quad ? String(i + 1) : "＋" }), inp,
              h("button", { type: "button", class: r.rev ? "on" : null, text: r.rev ? "逆位置" : "正位置", onclick: () => { r.rev = !r.rev; draw(); } }),
              L ? (() => { const s = h("select", { onchange: (e) => { r.pos = +e.target.value; draw(); } }, h("option", { value: -1, text: "（位置なし）" }), L.pos.map((p, j) => h("option", { value: j, text: p.name }))); s.value = r.pos; return s; })() : null,
              h("button", { type: "button", class: "icon", title: "外す", text: "✕", onclick: () => { rows.splice(i, 1); draw(); } }),
              r.cands.length > 1 ? h("div", { class: "ph-cands" }, h("small", { text: "候補:" }), r.cands.map((c) => h("button", { type: "button", class: "chip" + (c.id === r.id ? " on" : ""), text: D.get(c.id).ja, onclick: () => { r.id = c.id; draw(); } }))) : null, sug);
          })),
          h("button", { type: "button", text: "＋ 見つからなかったカードを足す", onclick: () => { rows.push({ id: null, rev: false, quad: null, cands: [], pos: -1, sure: true }); draw(); } }),
          h("p", { class: "muted", text: `${res.cards.length}枚見つかりました。黄色の枠は自信が低いもの。名前を直すときは打つと候補が出ます` }),
          h("button", { type: "button", class: "primary", text: "この内容で作る", onclick: create }));
      };
      function create() {
        const L = TB.LAYOUTS[lay], b = TB.build(L ? lay : "free", titleIn.value.trim());
        b.template = L ? lay : "photo";
        const slots = b.nodes.filter((n) => n.t === "card");
        const loose = [];
        for (const r of rows) {
          if (!r.id) continue;
          const n = L && r.pos >= 0 ? slots.find((s) => s.slot === L.pos[r.pos].id) : null;
          if (n && !n.item) { n.item = r.id; n.rev = r.rev; } else loose.push(r);
        }
        // 位置のないカードは、写真の並びのまま置く
        if (loose.length) {
          const xs = loose.map((r) => (r.layout ? r.layout.x : 0)), ys = loose.map((r) => (r.layout ? r.layout.y : 0));
          const minx = Math.min(...xs), miny = Math.min(...ys), span = Math.max(1, Math.max(...xs) - minx, Math.max(...ys) - miny);
          const k = Math.min(2.2, (220 * Math.max(1, Math.sqrt(loose.length))) / span), ox = L ? 1100 : 0;
          loose.forEach((r, i) => b.nodes.push(TB.cardNode("tarot", { item: r.id, rev: r.rev, x: Math.round(ox + (r.layout ? (r.layout.x - minx) * k : i * 180)), y: Math.round(r.layout ? (r.layout.y - miny) * k : 0), hint: "写真から" })));
        }
        b.draws.push({ at: Date.now(), deck: "tarot", method: "photo", seed: "写真", n: rows.length });
        TB.closeDialog(); TB.addBoard(b); TB.toast("写真から読み込みました");
      }
      area.replaceChildren(titleIn, h("div", { class: "ph-review" }, left, right));
      draw();
    }
    TB.openDialog("photo", h("h2", { text: "写真から読み込む（タロット）" }), area);
    if (img) analyze(img); else start();
  };
})();
