// 上のバー・キー・起動
(function () {
  "use strict";
  const TB = window.TB, { h, $ } = TB;

  TB.renderHeader = () => {
    const b = TB.B(), tpl = TB.TEMPLATES.find((t) => t.id === b.template);
    if (document.activeElement !== $("#title")) $("#title").value = b.title;
    $("#layout-chip").textContent = tpl ? tpl.name : "自由";
    $("#layout-chip").title = (tpl ? tpl.group + ": " + tpl.desc : "") + "（作ったあとは変えられません）";
  };
  TB.renderAll = () => { TB.renderHeader(); TB.renderBoard(); TB.renderDrawer({ quiet: true }); };

  // 題（テーマ）。中心のテーマが同じ文なら一緒に変える
  { let armed = true;
    $("#title").addEventListener("focus", () => { armed = true; });
    $("#title").addEventListener("input", (e) => {
      if (armed) { TB.snap(); armed = false; }
      const b = TB.B(), c = b.nodes.find((n) => n.center);
      if (c && (c.text === b.title || c.text === "テーマ")) { c.text = e.target.value || "テーマ"; TB.renderBoard(); }
      b.title = e.target.value; TB.save();
    }); }
  $("#title").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) e.target.blur(); });

  const on = (id, f) => $(id).addEventListener("click", f);
  on("#btn-draw", () => TB.doDraw());
  on("#btn-drawmenu", () => { if ($("#drawopt").hidden) TB.openDrawMenu(); else TB.closeFloats(); });
  on("#btn-undo", () => TB.undo());
  on("#btn-redo", () => TB.redo());
  on("#btn-lib", () => TB.openLibrary());
  on("#btn-new", () => TB.openNew());
  on("#btn-export", () => TB.exportAll());

  // 選んでいるものを消す（スプレッドの枠のカードは中身だけ外す）
  function deleteSelected() {
    const b = TB.B(); if (!TB.sel.length) return;
    TB.snap();
    for (const id of TB.sel) {
      const n = TB.node(id);
      if (n && n.t === "card" && n.slot) { n.item = null; n.rev = false; delete n.moving; continue; }
      if (n && n.center) continue;
      if (n) { b.nodes = b.nodes.filter((m) => m.id !== id); b.links = b.links.filter((l) => l.a !== id && l.b !== id); }
      else b.frames = b.frames.filter((f) => f.id !== id);
    }
    TB.sel = []; TB.save(); TB.renderAll();
  }

  document.addEventListener("keydown", (e) => {
    const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
    if (TB.dialogOpen()) { if (e.key === "Escape") { e.preventDefault(); TB.closeDialog(); } return; }
    if (e.ctrlKey && !e.altKey) {
      const k = e.key.toLowerCase(), run = (f) => { e.preventDefault(); f(); };
      if (k === "z" && !typing) return run(e.shiftKey ? TB.redo : TB.undo);
      if (k === "y" && !typing) return run(TB.redo);
      if (k === "d") return run(() => TB.doDraw());
      if (k === "o") return run(TB.openLibrary);
      if (k === "n") return run(TB.openNew);
      if (k === "s") return run(TB.exportAll);
      if (k === "0") return run(TB.fit);
      return;
    }
    if (e.key === "Escape") {
      if (!$("#pop").hidden || !$("#menu").hidden || !$("#drawopt").hidden) { TB.closeFloats(); return; }
      if (typing) { e.target.blur(); return; }
      if (TB.sel.length || TB.selLink) TB.select([]);
      return;
    }
    if (typing || TB.editing) return;
    const cur = TB.node(TB.sel[TB.sel.length - 1]);
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (TB.selLink) TB.removeLink(TB.selLink); else deleteSelected(); return; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) { e.preventDefault(); TB.moveSel(...dir); return; }
    if (!cur) return;
    if (e.key === "Tab") { e.preventDefault(); if (cur.t === "idea" || cur.item) TB.newIdea(cur.id); return; }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (cur.t === "idea") { if (e.key === "Enter" && TB.parentOf(cur.id)) TB.newIdea(TB.parentOf(cur.id).id); else TB.editIdea(cur.id); }
      else if (cur.item) TB.newIdea(cur.id); else { const i = $("#card-input"); if (i) i.focus(); }
      return;
    }
    // 文字を打ち始めたら: アイデアなら書き直し、空のカード枠ならカード名の入力
    if (e.key.length === 1 && !e.metaKey) {
      if (cur.t === "idea") TB.editIdea(cur.id);
      else if (!cur.item) { const i = $("#card-input"); if (i) i.focus(); }
    }
  });

  // 画像をドラッグすると写真から読み込む
  window.addEventListener("dragover", (e) => { if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    if (TB.dialogOpen()) return;
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/")); if (!f) return;
    e.preventDefault(); const i = new Image(); i.onload = () => TB.openPhoto("", i); i.src = URL.createObjectURL(f);
  });

  window.TarotApp = TB; // 試験用
  TB.init();
  TB.renderAll();
  requestAnimationFrame(() => TB.fit());
})();
