// 引く: タロット・易・発想カード。乱数の元と混ぜ方は設定で選ぶ
(function () {
  "use strict";
  const TB = window.TB, { h, $ } = TB;
  const POOLS = { all: "78枚", major: "大アルカナ", minor: "小アルカナ" };
  const METHODS = {
    crypto: ["おまかせ", "OS の暗号乱数。毎回まったく別の結果"],
    word: ["言葉から", "同じ言葉なら同じ結果（再現できる）"],
    mouse: ["かき混ぜる", "マウスの動きを乱数の元にする"],
    time: ["時刻", "押した瞬間のミリ秒を元にする"],
  };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const defaultSeed = () => `${TB.B().title.trim() || "（無題）"}｜${today()}`;
  TB.drawText = (dr) => {
    const m = METHODS[dr.method] ? METHODS[dr.method][0] : dr.method;
    const deck = TB.DECKS[dr.deck] ? TB.DECKS[dr.deck].name : "";
    const sh = dr.deck === "tarot" ? (dr.shuffle === "riffle" ? `・リフル${dr.riffles}回＋カット` : "・完全に混ぜる") + `・逆位置${dr.revOn ? dr.revProb + "%" : "なし"}` : "";
    return `${deck}・${m}${sh}（種: ${String(dr.seed).slice(0, 24)}）`;
  };

  // 引いたカードを置く先: 空いた枠 → 選んでいるノードのそば → テーマのそば → 真ん中
  function anchor() {
    const b = TB.B(), s = TB.node(TB.sel[TB.sel.length - 1]);
    return s || b.nodes.find((n) => n.center) || null;
  }
  function placeCard(deck, parent) {
    const b = TB.B(), D = TB.DECKS[deck];
    let pos;
    if (parent) pos = TB.placeNear(parent.id, { w: Math.max(D.w, 150), h: D.h + 56 }, 28);
    else { const r = $("#board").getBoundingClientRect(), c = TB.toWorld(r.left + r.width / 2, r.top + r.height / 2); pos = { x: Math.round(c.x), y: Math.round(c.y) }; }
    const n = TB.cardNode(deck, { x: pos.x, y: pos.y, hint: deck === "prompt" ? "発想のきっかけ" : "引いたカード" });
    b.nodes.push(n);
    if (parent) b.links.push({ id: TB.uid(), a: parent.id, b: n.id, kind: "line", label: "" });
    return n;
  }

  // deckId を省くと: 空いた枠があればそれを埋める。なければ盤面のデッキ（なければ発想カード）を1枚
  TB.doDraw = async (deckId) => {
    const b = TB.B(), st = TB.store.settings;
    const empties = b.nodes.filter((n) => n.t === "card" && !n.item && (!deckId || n.deck === deckId));
    if (!deckId) deckId = empties.length ? empties[0].deck : b.layout ? TB.LAYOUTS[b.layout].deck : "prompt";
    const targets = empties.filter((n) => n.deck === deckId);
    let samples = null;
    if (st.method === "mouse") { samples = await mixByMouse(); if (!samples) return; }
    const text = st.seedText.trim() || defaultSeed();
    const par = anchor();
    let placed = [];
    if (deckId === "iching") {
      const { rnd, seed } = await window.Rng.makeRnd({ method: st.method, text, samples });
      const c = window.IChing.cast(rnd);
      TB.snap();
      let base = targets.find((n) => n.slot === "base") || targets[0], after = targets.find((n) => n.slot === "after");
      if (!base) base = placeCard("iching", par);
      base.item = c.base.id; base.moving = c.moving; base.after = c.after ? c.after.id : null; placed.push(base);
      if (c.after) {
        if (!after) { after = placeCard("iching", base); const l = b.links.find((x) => x.b === after.id); if (l) { l.kind = "flow"; l.label = "変わる"; } }
        after.item = c.after.id; after.moving = null; placed.push(after);
      } else if (after) after.hint = "変わる爻がないので之卦はなし（本卦だけを読む）";
      b.draws.push({ at: Date.now(), deck: "iching", method: st.method, seed, n: 1 });
      TB.toast(c.moving.length ? `第${c.base.num}卦 ${c.base.name} → 第${c.after.num}卦 ${c.after.name}（変わる爻 ${c.moving.length}本）` : `第${c.base.num}卦 ${c.base.name}（変わる爻なし）`);
    } else {
      const D = TB.DECKS[deckId];
      let pool = D.all();
      if (deckId === "tarot") pool = pool.filter((c) => st.pool === "all" || (st.pool === "major" ? c.major : !c.major));
      if (deckId === "prompt") pool = pool.filter((c) => st.promptSets.includes(c.set));
      const used = new Set(b.nodes.filter((n) => n.deck === deckId && n.item).map((n) => n.item));
      const ids = pool.map((c) => c.id).filter((id) => !used.has(id));
      const count = targets.length || 1;
      if (ids.length < count) { TB.toast("山札が足りません"); return; }
      const res = await window.Rng.draw({ ids, count, method: st.method, text, samples, shuffle: deckId === "tarot" ? st.shuffle : "fy", riffles: st.riffles, revOn: deckId === "tarot" && st.revOn, revProb: st.revProb });
      TB.snap();
      const into = targets.length ? targets : [placeCard(deckId, par)];
      into.forEach((n, i) => { n.item = res.picks[i].id; n.rev = res.picks[i].rev; placed.push(n); });
      b.draws.push({ at: Date.now(), deck: deckId, method: st.method, seed: res.seed, shuffle: st.shuffle, riffles: st.riffles, revOn: st.revOn, revProb: st.revProb, pool: st.pool, n: count });
    }
    // 山札から配る動き
    const dk = $("#board").getBoundingClientRect(), from = TB.toWorld(dk.left + dk.width / 2, dk.top - 40);
    placed.forEach((n, i) => TB.dealing.set(n.id, { i, dx: from.x - n.x, dy: from.y - n.y }));
    TB.save(); TB.renderBoard(); if (TB.view.auto) TB.fit();
    setTimeout(() => TB.dealing.clear(), 200);
    if (placed.length === 1) { TB.select(placed[0].id); TB.reveal(placed[0]); } else TB.renderDrawer({ quiet: true });
  };

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

  // ---- 引くメニュー（デッキを選ぶ・設定） ----
  const seg = (opts, val, on) => h("div", { class: "seg" }, opts.map(([v, t]) => h("button", { type: "button", class: v === val ? "on" : null, text: t, onclick: () => on(v) })));
  TB.openDrawMenu = () => {
    const st = TB.store.settings, pop = $("#drawopt");
    const set = (k, v, re) => { st[k] = v; TB.persistSoon(); TB.renderHeader(); if (re) TB.openDrawMenu(); };
    const range = (k, min, max, unit) => h("div", { class: "row" },
      h("input", { type: "range", min, max, value: st[k], oninput: (e) => { set(k, +e.target.value); e.target.nextSibling.textContent = e.target.value + unit; } }),
      h("span", { text: st[k] + unit, style: "min-width:44px;text-align:right" }));
    const go = (d) => () => { TB.closeFloats(); TB.doDraw(d); };
    const sel = (k, opts, re) => h("select", { onchange: (e) => set(k, e.target.value, re) }, opts.map(([v, t]) => h("option", { value: v, selected: st[k] === v, text: t })));
    const field = (label, ...kids) => h("label", { class: "dm-field" }, h("span", { text: label }), ...kids);
    pop.replaceChildren(...[
      h("div", { class: "dm-decks" },
        h("button", { type: "button", onclick: go("tarot") }, h("b", { text: "タロット" }), h("small", { text: "空いた枠を埋める／選んだものにつなぐ" })),
        h("button", { type: "button", onclick: go("iching") }, h("b", { text: "易" }), h("small", { text: "コインを6回投げて卦を立てる" })),
        h("button", { type: "button", onclick: go("prompt") }, h("b", { text: "発想カード" }), h("small", { text: "選んだものにつなぐ" }))),
      h("hr"),
      h("label", { class: "dm-check" }, h("span", { text: "逆位置を出す（タロット）" }), h("input", { type: "checkbox", checked: st.revOn, onchange: (e) => set("revOn", e.target.checked, true) })),
      st.revOn ? h("div", { class: "row" }, h("span", { class: "muted", text: "出やすさ" }), range("revProb", 1, 99, "%").children[0], h("span", { class: "muted", text: st.revProb + "%", style: "min-width:34px;text-align:right" })) : null,
      field("使うカード（タロット）", sel("pool", [["all", "78枚すべて"], ["major", "大アルカナだけ"], ["minor", "小アルカナだけ"]])),
      field("混ぜ方（タロット）", sel("shuffle", [["fy", "完全に混ぜる"], ["riffle", "リフル＋カット（手で切る再現）"]], true)),
      st.shuffle === "riffle" ? h("div", { class: "row" }, h("span", { class: "muted", text: "リフルの回数" }), range("riffles", 1, 12, "回").children[0], h("span", { class: "muted", text: st.riffles + "回", style: "min-width:34px;text-align:right" })) : null,
      field("乱数の元", sel("method", Object.entries(METHODS).map(([k, [t, d]]) => [k, `${t}（${d}）`]), true)),
      st.method === "word" ? h("input", { value: st.seedText, placeholder: "空なら: " + defaultSeed(), oninput: (e) => set("seedText", e.target.value) }) : null,
      h("details", { class: "help" }, h("summary", { text: "発想カードの種類" }), h("div", { class: "checks" }, window.Prompts.SETS.map((s) => h("label", {},
        h("input", { type: "checkbox", checked: st.promptSets.includes(s.id), onchange: (e) => set("promptSets", e.target.checked ? [...st.promptSets, s.id] : st.promptSets.filter((x) => x !== s.id)) }), s.name)))),
    ].filter(Boolean));
    pop.hidden = false;
    const b = $("#btn-drawmenu").getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(b.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8)) + "px"; pop.style.top = b.bottom + 6 + "px";
  };

})();
