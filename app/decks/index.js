// デッキ（引いて使う刺激）をそろえた形で扱う。盤面の側はこの形だけを見る
(function () {
  const TB = window.TB, C = window.Cards, I = window.IChing, P = window.Prompts, S = window.Spreads;
  const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[\s　の]/g, "");
  TB.DECKS = {
    tarot: {
      id: "tarot", name: "タロット", icon: "🂠", w: 130, h: 217, canRev: true,
      get: (id) => C.BY_ID[id], all: () => C.ALL,
      label: (it, rev) => it.ja + (rev ? "（逆位置）" : ""), short: (it, rev) => it.ja + (rev ? "（逆）" : ""),
      search: (q) => C.search(q),
    },
    iching: {
      id: "iching", name: "易", icon: "☯", w: 150, h: 217, canRev: false,
      get: (id) => I.BY_ID[id], all: () => I.ITEMS,
      label: (it) => `${it.num} ${it.name}`, short: (it) => it.name,
      search: (q) => { const n = norm(q); if (!n) return { cards: [] }; const num = +n;
        return { cards: I.ITEMS.filter((h) => (num && h.num === num) || norm(h.name).includes(n) || norm(h.kw).includes(n)).slice(0, 14) }; },
    },
    prompt: {
      id: "prompt", name: "発想カード", icon: "💡", w: 160, h: 214, canRev: false,
      get: (id) => P.BY_ID[id], all: () => P.ITEMS,
      label: (it) => it.name, short: (it) => it.name,
      search: (q) => { const n = norm(q); return { cards: n ? P.ITEMS.filter((x) => norm(x.name).includes(n) || norm(x.setName).includes(n)).slice(0, 14) : [] }; },
    },
  };
  // 並べ方（新規作成のときだけ選ぶ）
  TB.LAYOUTS = {};
  for (const s of S.ALL) TB.LAYOUTS["tarot:" + s.id] = { deck: "tarot", name: s.name, pos: s.pos };
  TB.LAYOUTS["iching:pair"] = { deck: "iching", name: "本卦と之卦", pos: [
    { id: "base", name: "本卦", x: 200, y: 200, hint: "今の状況（コインで立てた卦）" },
    { id: "after", name: "之卦", x: 520, y: 200, hint: "変わる爻が動いた先・行き着く方向" },
  ] };
})();
