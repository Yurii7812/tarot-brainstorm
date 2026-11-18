// 右の詳細・ホバーの説明・メニュー・つながりの吹き出し・一覧表示
(function () {
  "use strict";
  const TB = window.TB, { h, $ } = TB;

  // ================= 小さな部品 =================
  TB.closeFloats = () => {
    for (const s of ["#pop", "#menu", "#drawopt"]) $(s).hidden = true;
    if (TB.selLink) { TB.selLink = null; TB.markSel(); }
  };
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#pop, #menu, #drawopt, #btn-drawmenu, #board")) TB.closeFloats(); });
  TB.menu = (items, x, y) => {
    const m = $("#menu");
    m.replaceChildren(...items.map((it) => it === "-" ? h("hr") : h("button", { type: "button", class: it[2] || null, onclick: () => { TB.closeFloats(); it[1](); } }, it[0])));
    m.hidden = false; m.style.left = Math.min(x, innerWidth - 220) + "px"; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + "px";
  };
  // 書きかけをなくさない入力欄（最初の入力のときだけ元に戻す点を作る）
  const lazy = (set) => { let armed = true; return { onfocus: () => { armed = true; }, oninput: (e) => { if (armed) { TB.snap(); armed = false; } set(e.target.value); TB.save(); } }; };
  const kidsOf = (id) => TB.B().links.filter((l) => l.a === id).map((l) => TB.node(l.b)).filter(Boolean);
  TB.parentOf = (id) => { const l = TB.B().links.find((x) => x.b === id); return l && TB.node(l.a); };
  // 編集に入らずにアイデアを足す（一覧表示・ボタンから）
  TB.addIdea = (parentId, text, kind) => {
    const b = TB.B(), pos = parentId ? TB.placeNear(parentId) : { x: 0, y: 0 };
    const n = TB.ideaNode({ x: pos.x, y: pos.y, text: text || "", kind: kind || "note" });
    b.nodes.push(n); if (parentId) b.links.push({ id: TB.uid(), a: parentId, b: n.id, kind: "line", label: "" });
    TB.save(); return n;
  };
  const nodeLabel = (n) => {
    if (n.t === "idea") return n.text || "（空）";
    const it = TB.item(n); return TB.slotName(n) + (it ? " ・ " + TB.deckOf(n).short(it, n.rev) : "");
  };

  // ================= ホバーの説明 =================
  TB.tipBody = (id) => {
    const n = TB.node(id); if (!n || n.t !== "card") return [];
    const it = TB.item(n), out = [h("div", { class: "tt-pos", text: TB.slotName(n) }), n.hint ? h("div", { class: "tt-hint", text: n.hint }) : null];
    if (!it) { out.push(h("div", { class: "tt-note", text: "クリックしてカード名を打つ／「引く」で置く" })); return out; }
    if (n.deck === "tarot") out.push(
      h("div", { class: "tt-card" }, h("b", { text: it.ja }), h("small", { text: "  " + it.en }), h("span", { class: "badge" + (n.rev ? " rev" : ""), text: n.rev ? "逆位置" : "正位置" })),
      h("div", { class: "kw" + (n.rev ? "" : " on") }, h("i", { text: "正" }), it.up), h("div", { class: "kw" + (n.rev ? " on" : "") }, h("i", { text: "逆" }), it.rv));
    else if (n.deck === "iching") out.push(h("div", { class: "tt-card" }, h("b", { text: `第${it.num}卦 ${it.name}` })), h("div", { class: "kw on", text: it.kw }),
      n.moving && n.moving.length ? h("div", { class: "tt-note", text: "変わる爻: " + n.moving.map((i) => window.IChing.LINE_POS[i].split("（")[0]).join("・") }) : null);
    else out.push(h("div", { class: "tt-card" }, h("b", { text: it.name }), h("small", { text: "  " + it.setName })), h("div", { class: "kw on", text: it.question }));
    const nk = kidsOf(id).length; if (nk) out.push(h("div", { class: "tt-note", text: `つながったアイデア ${nk}個` }));
    return out;
  };

  // ================= 右クリックのメニュー =================
  TB.nodeMenu = (id, x, y) => {
    const n = TB.node(id), b = TB.B(), it = TB.item(n), items = [];
    const del = () => { TB.snap(); b.nodes = b.nodes.filter((m) => m.id !== id); b.links = b.links.filter((l) => l.a !== id && l.b !== id); TB.sel = TB.sel.filter((s) => s !== id); TB.save(); TB.renderAll(); };
    if (n.t === "idea") {
      items.push(["書き直す", () => TB.editIdea(id)], ["ここから広げる（Tab）", () => TB.newIdea(id)], ["子を並べ直す", () => TB.arrangeKids(id)]);
      if (!n.center) items.push(["消す", del, "danger"]);
    } else {
      if (it && n.deck === "tarot") items.push([n.rev ? "正位置にする" : "逆位置にする", () => { TB.snap(); n.rev = !n.rev; TB.save(); TB.renderAll(); }]);
      if (it) items.push(["アイデアを足す", () => TB.newIdea(id)], ["子を並べ直す", () => TB.arrangeKids(id)], ["カードを外す", () => { TB.snap(); n.item = null; n.rev = false; delete n.moving; TB.save(); TB.renderAll(); }]);
      if (!n.slot) items.push(["この枠ごと消す", del, "danger"]);
    }
    const cut = b.links.filter((l) => l.a === id || l.b === id);
    if (cut.length) items.push("-", [`つながりを全部消す（${cut.length}本）`, () => { TB.snap(); b.links = b.links.filter((l) => !cut.includes(l)); TB.save(); TB.renderAll(); }]);
    TB.menu(items, x, y);
  };
  TB.linkMenu = (id, x, y) => {
    TB.menu([["ひとことを書く", () => TB.openLinkPop(id, true)], ["消す", () => TB.removeLink(id), "danger"]], x, y);
  };
  TB.frameMenu = (id, x, y) => {
    const b = TB.B();
    TB.menu([["名前を変える", () => TB.editFrameTitle(id)],
      "-", ["枠だけ消す（中身は残す）", () => { TB.snap(); b.frames = b.frames.filter((q) => q.id !== id); TB.save(); TB.renderBoard(); }, "danger"]], x, y);
  };
  TB.removeLink = (id) => { TB.snap(); TB.B().links = TB.B().links.filter((l) => l.id !== id); if (TB.selLink === id) TB.selLink = null; $("#pop").hidden = true; TB.save(); TB.renderBoard(); };

  // ================= つながりの吹き出し =================
  TB.openLinkPop = (id, focus) => {
    const b = TB.B(), l = b.links.find((x) => x.id === id); if (!l) return;
    TB.sel = []; TB.selLink = id; TB.markSel(); TB.renderDrawer({ quiet: true });
    const r = TB.routeLinks(b).find((x) => x.l.id === id); if (!r) return;
    const mid = TB.toScreen(r.g.mid.x, r.g.mid.y), br = $("#board").getBoundingClientRect();
    let armed = true;
    const input = h("input", { value: l.label, placeholder: "ひとこと（Enter で閉じる）",
      oninput: (e) => { if (armed) { TB.snap(); armed = false; } l.label = e.target.value; TB.save(); TB.renderBoard(); TB.markSel(); },
      onkeydown: (e) => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); TB.closeFloats(); } } });
    const pop = $("#pop");
    pop.replaceChildren(input, h("button", { type: "button", class: "danger", text: "線を消す", title: "Delete", onclick: () => TB.removeLink(id) }));
    pop.hidden = false;
    pop.style.left = Math.max(200, Math.min(br.width - 200, mid.x - br.left)) + "px";
    pop.style.top = Math.max(4, Math.min(br.height - 60, mid.y - br.top)) + "px";
    if (focus) input.focus();
  };

  // 子を親のまわりに並べ直す
  TB.arrangeKids = (id) => {
    const P = TB.node(id), kids = kidsOf(id).filter((k) => k.t === "idea"); if (!kids.length) return;
    TB.snap();
    const b = TB.B(); const others = new Set(kids.map((k) => k.id));
    const save = b.nodes; b.nodes = b.nodes.filter((n) => !others.has(n.id));
    for (const k of kids) { const p = TB.placeNear(id, TB.rectOf(k)); k.x = p.x; k.y = p.y; b.nodes.push(k); }
    b.nodes = save; void P; TB.save(); TB.renderBoard();
  };

  // ================= 右の詳細 =================
  TB.renderDrawer = (opt) => {
    opt = opt || {};
    const dr = $("#drawer"), ids = TB.sel.filter((id) => TB.node(id) || TB.B().frames.some((f) => f.id === id));
    let parts;
    if (ids.length > 1) parts = multi(ids);
    else if (ids.length === 1 && TB.node(ids[0])) parts = TB.node(ids[0]).t === "card" ? cardDetail(TB.node(ids[0]), opt) : ideaDetail(TB.node(ids[0]));
    else if (ids.length === 1) parts = frameDetail(TB.B().frames.find((f) => f.id === ids[0]));
    else parts = overview();
    dr.replaceChildren(...parts.flat().filter(Boolean));
    if (opt.focusCard) { const i = $("#card-input"); if (i) i.focus(); }
  };

  function bigCard(n) {
    const it = TB.item(n);
    if (!it) return h("div", { class: "d-big empty" }, h("span", { text: "?" }));
    if (n.deck === "tarot") return h("div", { class: "d-big" }, h("img", { src: window.Cards.imgUrl(it), alt: "", class: n.rev ? "rev" : null }));
    if (n.deck === "iching") return h("div", { class: "d-big hexcard" }, h("div", { class: "hc-num", text: "第" + it.num + "卦" }), TB.hexSvg(it.lines, n.moving), h("div", { class: "hc-name", text: it.name }));
    return h("div", { class: "d-big pcard", style: `--pc:${it.color}` }, h("div", { class: "pc-set", text: it.setName }), h("div", { class: "pc-name", text: it.name }));
  }
  const chip = (text, on, cls) => h("button", { type: "button", class: "chip" + (cls ? " " + cls : ""), onclick: on }, text);

  function cardDetail(n, opt) {
    const it = TB.item(n), D = TB.deckOf(n);
    const btns = [];
    if (it && n.deck === "tarot") btns.push(h("button", { type: "button", text: n.rev ? "正位置にする" : "逆位置にする", onclick: () => { TB.snap(); n.rev = !n.rev; TB.save(); TB.renderAll(); } }));
    if (it) btns.push(h("button", { type: "button", text: "＋アイデア", title: "このカードから広げる（Tab）", onclick: () => TB.newIdea(n.id) }));
    if (it) btns.push(h("button", { type: "button", text: "替える", onclick: () => { const w = $("#d-in"); w.hidden = !w.hidden; if (!w.hidden) $("#card-input").focus(); } }));
    const head = h("div", { class: "d-head" }, bigCard(n), h("div", { class: "d-meta" },
      h("input", { class: "d-pos", value: TB.slotName(n), title: "位置の名前（変えられる）", ...lazy((v) => { n.label = v; TB.renderBoard(); }) }),
      n.hint ? h("div", { class: "d-hint", text: n.hint }) : null,
      it ? h("div", { class: "d-card" }, D.short(it, false), n.deck === "tarot" ? h("small", { text: it.en }) : null,
        n.deck === "tarot" ? h("span", { class: "badge" + (n.rev ? " rev" : ""), text: n.rev ? "逆位置" : "正位置" }) : null) : h("div", { class: "d-card muted", text: D.name + "のカード未設定" }),
      h("div", { class: "d-btns" }, btns)));
    const parts = [head];
    if (it) parts.push(meaning(n, it));
    parts.push(cardInput(n, !it || opt.focusCard));
    if (it) parts.push(relations(n));
    parts.push(h("label", { text: "この位置での読み" }), h("textarea", { rows: 2, placeholder: `「${TB.slotName(n)}」${n.hint ? "（" + n.hint + "）" : ""}としてどう読むか`, value: n.pos || "", ...lazy((v) => (n.pos = v)) }),
      h("label", { text: "自分の解釈・まとめ" }), h("textarea", { class: "grow", placeholder: "このカードから見えたこと", value: n.mine || "", ...lazy((v) => (n.mine = v)) }));
    return parts;
  }
  function meaning(n, it) {
    const box = h("div", { class: "d-mean" });
    const askChip = (q) => chip(q, () => { TB.snap(); const a = TB.addIdea(n.id, q, "ask"); TB.renderBoard(); TB.select(a.id, { quiet: true }); TB.newIdea(a.id); }, "ask");
    if (n.deck === "tarot") {
      box.append(
        h("div", { class: "kw" + (n.rev ? "" : " on") }, h("i", { text: "正" }), h("b", { text: it.up }), h("div", { class: "kt", text: it.upText })),
        h("div", { class: "kw" + (n.rev ? " on" : "") }, h("i", { text: "逆" }), h("b", { text: it.rv }), h("div", { class: "kt", text: it.rvText })),
        h("div", { class: "facts", text: it.facts.join("　") }),
        h("div", { class: "chips" }, h("span", { class: "chips-h", text: "絵の中にあるもの（押すと連想を書く）" }),
          it.scene.map((s) => chip(s, () => { const a = TB.newIdea(n.id); const t = $(`.node[data-id="${a.id}"] .txt`); if (t) { t.textContent = s + "："; const rg = document.createRange(); rg.selectNodeContents(t); rg.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(rg); } }))),
        h("div", { class: "chips" }, askChip(it.question)));
    } else if (n.deck === "iching") {
      const I = window.IChing, after = n.after && I.BY_ID[n.after];
      box.append(h("div", { class: "kw on" }, h("b", { text: it.kw }), h("div", { class: "kt", text: it.text })),
        h("div", { class: "facts", text: `上卦 ${it.upper.glyph} ${it.upper.name}（${it.upper.nature}）${it.upper.kw}　／　下卦 ${it.lower.glyph} ${it.lower.name}（${it.lower.nature}）${it.lower.kw}` }));
      if (n.moving && n.moving.length) box.append(h("div", { class: "facts", text: "変わる爻: " + n.moving.map((i) => I.LINE_POS[i]).join("、") }));
      if (after) box.append(h("div", { class: "facts", text: `之卦（変わった先）: 第${after.num}卦 ${after.name} — ${after.kw}` }));
      box.append(h("div", { class: "chips" }, chip(it.upper.nature, () => TB.newIdea(n.id)), chip(it.lower.nature, () => TB.newIdea(n.id)), askChip(it.question)));
    } else {
      box.append(h("div", { class: "kw on" }, h("b", { text: it.setName }), h("div", { class: "kt", text: window.Prompts.SETS.find((s) => s.id === it.set).desc })),
        h("div", { class: "chips" }, askChip(it.question)));
    }
    return box;
  }
  function relations(n) {
    const b = TB.B(), out = h("div", { class: "d-rel" }, h("h4", { text: "つながり" }));
    const cardLinks = b.links.filter((l) => (l.a === n.id || l.b === n.id) && TB.node(l.a === n.id ? l.b : l.a)?.t === "card");
    for (const l of cardLinks) {
      const o = TB.node(l.a === n.id ? l.b : l.a);
      out.append(h("button", { type: "button", class: "rel", onclick: () => TB.select(o.id) }, h("b", { text: nodeLabel(o) }), l.label ? h("span", { class: "rl", text: "「" + l.label + "」" }) : null));
    }
    // このカードから広げたアイデア（深さ2まで）
    const kids = kidsOf(n.id).filter((k) => k.t === "idea");
    if (kids.length) {
      for (const k of kids.slice(0, 8)) out.append(h("button", { type: "button", class: "rel idea", onclick: () => { TB.select(k.id); TB.reveal(k); } },
        h("span", { text: k.text + (kidsOf(k.id).length ? `（＋${kidsOf(k.id).length}）` : "") })));
    }
    if (!cardLinks.length && !kids.length) out.append(h("div", { class: "muted", text: "まだありません。カードをクリックすると、つながった入力欄が出ます。別のカードへドラッグするとつながります" }));
    return out;
  }
  function cardInput(n, open) {
    const D = TB.deckOf(n);
    const input = h("input", { id: "card-input", autocomplete: "off", placeholder: n.deck === "tarot" ? "カード名・略号（悪魔 / ワンド10 / w10 / 14r）" : n.deck === "iching" ? "卦の番号か名前（1 / 乾 / 水雷屯）" : "カード名" });
    const list = h("ul", { class: "sugg", hidden: true });
    let items = [], idx = 0, qrev = false;
    const refresh = () => {
      const res = D.search(input.value); items = res.cards; qrev = !!res.rev; idx = 0;
      list.replaceChildren(...items.map((c, i) => h("li", { class: i === 0 ? "on" : null, onmousedown: (ev) => { ev.preventDefault(); pick(c); } },
        h("span", { text: D.label(c, false) }), h("small", { text: (c.ab || "") + (qrev ? " 逆" : "") }))));
      list.hidden = !items.length;
    };
    const pick = (c) => {
      TB.snap(); n.item = c.id; n.rev = qrev; delete n.moving; TB.save();
      const b = TB.B(), cards = b.nodes.filter((m) => m.t === "card");
      const dup = cards.find((m) => m !== n && m.deck === n.deck && m.item === c.id); if (dup) TB.toast(`同じカードが「${TB.slotName(dup)}」にもあります`);
      const nxt = cards.slice(cards.indexOf(n) + 1).find((m) => !m.item && m.deck === n.deck);
      TB.renderBoard();
      if (nxt) TB.select(nxt.id, { focusCard: true }); else TB.select(n.id);
    };
    input.addEventListener("input", refresh);
    input.addEventListener("blur", () => setTimeout(() => (list.hidden = true), 120));
    input.addEventListener("keydown", (ev) => {
      if (ev.isComposing) return;
      const mark = () => [...list.children].forEach((li, i) => li.classList.toggle("on", i === idx));
      if (ev.key === "ArrowDown" && items.length) { ev.preventDefault(); idx = (idx + 1) % items.length; mark(); }
      else if (ev.key === "ArrowUp" && items.length) { ev.preventDefault(); idx = (idx - 1 + items.length) % items.length; mark(); }
      else if (ev.key === "Enter" && items.length) { ev.preventDefault(); pick(items[idx]); }
      else if (ev.key === "Escape" && input.value) { ev.stopPropagation(); input.value = ""; refresh(); }
    });
    return h("div", { class: "d-in", id: "d-in", hidden: !open }, input, list);
  }

  function ideaDetail(n) {
    const par = TB.parentOf(n.id), kids = kidsOf(n.id);
    return [
      h("h3", { text: n.center ? "テーマ" : "アイデア" }),
      h("textarea", { class: "grow", value: n.text, ...lazy((v) => { n.text = v; TB.renderBoard(); TB.markSel(); }) }),
      par ? h("div", { class: "d-rel" }, h("h4", { text: "元" }), h("button", { type: "button", class: "rel", onclick: () => TB.select(par.id) }, h("b", { text: nodeLabel(par) }))) : null,
      kids.length ? h("div", { class: "d-rel" }, h("h4", { text: `ここから（${kids.length}）` }), kids.map((k) => h("button", { type: "button", class: "rel idea", onclick: () => TB.select(k.id) }, h("span", { text: nodeLabel(k) })))) : null,
      h("div", { class: "d-btns" },
        h("button", { type: "button", text: "＋広げる（Tab）", onclick: () => TB.newIdea(n.id) }),
        h("button", { type: "button", text: "発想カードをつなぐ", onclick: () => TB.doDraw("prompt") }),
        kids.length ? h("button", { type: "button", text: "子を並べ直す", onclick: () => TB.arrangeKids(n.id) }) : null),
    ];
  }
  function frameDetail(f) {
    if (!f) return overview();
    return [h("h3", { text: "グループ" }), h("input", { value: f.title, ...lazy((v) => { f.title = v; TB.renderBoard(); TB.markSel(); }) }),
      h("p", { class: "muted", text: "見出しをドラッグすると中身ごと動きます。右下の角で大きさを変えられます" })];
  }
  function multi(ids) {
    return [h("h3", { text: `${ids.length}個を選択中` }),
      h("div", { class: "d-btns" }, h("button", { type: "button", text: "選択を外す", onclick: () => TB.select([]) }))];
  }

  // ---- 何も選んでいないとき: 概要 ----
  function overview() {
    const b = TB.B();
    const ideas = b.nodes.filter((n) => n.t === "idea" && !n.center), cards = b.nodes.filter((n) => n.t === "card");
    const tpl = TB.TEMPLATES.find((t) => t.id === b.template);
    return [
      h("div", { class: "muted", text: `${tpl ? tpl.group + " ・ " + tpl.name : ""}　カード ${cards.length}　アイデア ${ideas.length}` }),
      cards.length ? h("div", { class: "ov-list" }, cards.map((n) => h("button", { type: "button", onclick: () => TB.select(n.id) }, h("b", { text: TB.slotName(n) }), h("span", { text: TB.item(n) ? TB.deckOf(n).short(TB.item(n), n.rev) : "未設定" })))) : null,
      h("label", { text: "まとめ" }),
      h("textarea", { class: "grow", placeholder: "全体としての結論・次にやること", value: b.summary, ...lazy((v) => (b.summary = v)) }),
      b.draws.length ? h("div", { class: "muted", text: "最後に引いた: " + TB.drawText(b.draws[b.draws.length - 1]) }) : null,
      h("details", { class: "help" }, h("summary", { text: "操作とキー" }),
        h("p", { text: "クリック＝文字 / ドラッグ＝ペン / カードや文字をクリック＝つながった入力欄 / カードや文字から別のものへドラッグ＝つなぐ（空きに離すと新しい文字）/ Ctrl+ドラッグ＝動かす（空きなら画面を動かす）/ 右クリック＝消す・メニュー / ホイール＝拡大" }),
        h("p", { text: "書いている間: Enter＝次 / Tab＝そこから広げる / Shift+Tab＝元へ / Esc＝終わる" }),
        h("p", { text: "Ctrl+D 引く / Ctrl+N 新規 / Ctrl+O 一覧 / Ctrl+S 書き出し / Ctrl+Z・Y 元に戻す・やり直す / Ctrl+0 全体 / 矢印 近くへ移る / Delete 消す" }))];
  }
})();
