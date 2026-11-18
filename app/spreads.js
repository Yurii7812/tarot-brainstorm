// スプレッドのテンプレート: 座標（盤面の中、カードの中心）＋位置名＋意味。
// pos の並びが入力時の移動順（Enter で次へ）・山札から配る順になる。
(function () {
  const R = 330, cx = 500, cy = 500, dx = Math.round(R * Math.cos(Math.PI / 6));
  const SPREADS = [
    {
      id: "hexagram", name: "ヘキサグラム（7枚）", w: 1000, h: 1050, cw: 130,
      pos: [
        { id: "past", name: "過去", x: cx, y: cy - R, hint: "今の状況に至った背景・型" },
        { id: "present", name: "現在", x: cx + dx, y: cy + R / 2, hint: "今の状態" },
        { id: "near", name: "近い未来", x: cx - dx, y: cy + R / 2, hint: "すぐ先に起こること" },
        { id: "self", name: "自分の気持ち", x: cx + dx, y: cy - R / 2, hint: "自分は何を望んでいるか" },
        { id: "other", name: "相手の気持ち", x: cx - dx, y: cy - R / 2, hint: "相手の状態・姿勢" },
        { id: "advice", name: "アドバイス", x: cx, y: cy + R, hint: "どう動くとよいか" },
        { id: "result", name: "結論", x: cx, y: cy, hint: "全体の行き着く先" },
      ],
    },
    {
      id: "three", name: "3枚（過去・現在・未来）", w: 900, h: 470, cw: 150,
      pos: [
        { id: "past", name: "過去", x: 170, y: 200, hint: "ここに至った流れ・原因" },
        { id: "present", name: "現在", x: 450, y: 200, hint: "今の状態・課題" },
        { id: "future", name: "未来", x: 730, y: 200, hint: "このまま進んだ先" },
      ],
    },
    {
      id: "one", name: "1枚", w: 420, h: 460, cw: 180,
      pos: [{ id: "card", name: "カード", x: 210, y: 200, hint: "今いちばん必要な視点" }],
    },
    { id: "free", name: "自由（＋カードで足す）", w: 900, h: 560, cw: 150, pos: [] },
  ];
  window.Spreads = { ALL: SPREADS, BY_ID: Object.fromEntries(SPREADS.map((s) => [s.id, s])) };
})();
