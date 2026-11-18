// スプレッドのテンプレート: 座標（stage 内、カード中心）＋位置名＋意味。
// pos の並びが入力時の移動順（Enter で次へ）になる。
(function () {
  const R = 330, cx = 500, cy = 500, dx = Math.round(R * Math.cos(Math.PI / 6));
  const SPREADS = [
    {
      id: "hexagram", name: "ヘキサグラム（7枚）", w: 1000, h: 1040, cw: 130,
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
      id: "three", name: "3枚（過去・現在・未来）", w: 900, h: 430, cw: 150,
      pos: [
        { id: "past", name: "過去", x: 170, y: 210, hint: "" },
        { id: "present", name: "現在", x: 450, y: 210, hint: "" },
        { id: "future", name: "未来", x: 730, y: 210, hint: "" },
      ],
    },
    {
      id: "one", name: "1枚", w: 400, h: 440, cw: 180,
      pos: [{ id: "card", name: "カード", x: 200, y: 210, hint: "" }],
    },
  ];
  window.Spreads = { ALL: SPREADS, BY_ID: Object.fromEntries(SPREADS.map((s) => [s.id, s])) };
})();
