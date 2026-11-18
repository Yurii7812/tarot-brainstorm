// 78枚のカード定義。並びは暫定: 大アルカナ 0〜21（力=8、正義=11）→ ワンド → カップ → ソード → ペンタクル
// 各スートは エース〜10、ペイジ、ナイト、クイーン、キング（コートの順は小冊子で未確認）。
// 画像ファイル名の罠: Wands11=ペイジ, 12=ナイト, 13=クイーン, 14=キング。
(function () {
  const IMG_DIR = "../assets/cards/rider-waite-720px/";
  const MAJORS = [
    ["愚者", "The Fool", "00_Fool"], ["魔術師", "The Magician", "01_Magician"],
    ["女教皇", "The High Priestess", "02_High_Priestess"], ["女帝", "The Empress", "03_Empress"],
    ["皇帝", "The Emperor", "04_Emperor"], ["教皇", "The Hierophant", "05_Hierophant"],
    ["恋人", "The Lovers", "06_Lovers"], ["戦車", "The Chariot", "07_Chariot"],
    ["力", "Strength", "08_Strength"], ["隠者", "The Hermit", "09_Hermit"],
    ["運命の輪", "Wheel of Fortune", "10_Wheel_of_Fortune"], ["正義", "Justice", "11_Justice"],
    ["吊るされた男", "The Hanged Man", "12_Hanged_Man"], ["死神", "Death", "13_Death"],
    ["節制", "Temperance", "14_Temperance"], ["悪魔", "The Devil", "15_Devil"],
    ["塔", "The Tower", "16_Tower"], ["星", "The Star", "17_Star"],
    ["月", "The Moon", "18_Moon"], ["太陽", "The Sun", "19_Sun"],
    ["審判", "Judgement", "20_Judgement"], ["世界", "The World", "21_World"],
  ];
  const SUITS = [
    { k: "w", ja: "ワンド", en: "Wands", file: "Wands" },
    { k: "c", ja: "カップ", en: "Cups", file: "Cups" },
    { k: "s", ja: "ソード", en: "Swords", file: "Swords" },
    { k: "p", ja: "ペンタクル", en: "Pentacles", file: "Pents" },
  ];
  const RANK_JA = ["", "エース", "2", "3", "4", "5", "6", "7", "8", "9", "10", "ペイジ", "ナイト", "クイーン", "キング"];
  const RANK_EN = ["", "Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];
  const RANK_AB = ["", "a", "2", "3", "4", "5", "6", "7", "8", "9", "10", "pg", "kn", "q", "k"];

  const CARDS = [];
  MAJORS.forEach(([ja, en, file], i) =>
    CARDS.push({ id: "m" + i, ja, en, file: file + ".jpg", ab: "m" + i, major: true }));
  SUITS.forEach((s) => {
    for (let r = 1; r <= 14; r++) {
      CARDS.push({
        id: s.k + r,
        ja: s.ja + "の" + RANK_JA[r],
        en: RANK_EN[r] + " of " + s.en,
        file: s.file + String(r).padStart(2, "0") + ".jpg",
        ab: s.k + RANK_AB[r],
      });
    }
  });
  const BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

  const norm = (s) => s.normalize("NFKC").toLowerCase().replace(/[\s　の]/g, "");

  // 入力文字列 → { cards: 候補（先頭が最有力）, rev: 末尾が r なら true }
  function search(raw) {
    let q = norm(raw);
    if (!q) return { cards: [], rev: false };
    let m;
    // 略号（逆位置は末尾 r）: m5 / 5 / w10 / wa / wpg / ckn / sq / pk
    if ((m = q.match(/^m?(\d{1,2})(r)?$/)) && +m[1] <= 21)
      return { cards: [BY_ID["m" + +m[1]]], rev: !!m[2] };
    if ((m = q.match(/^([wcsp])(a|\d{1,2}|pg|kn|q|k)(r)?$/))) {
      const rank = { a: 1, pg: 11, kn: 12, q: 13, k: 14 }[m[2]] || +m[2];
      const c = BY_ID[m[1] + rank];
      if (c) return { cards: [c], rev: !!m[3] };
    }
    // 名前（日本語・英語）の部分一致。「逆」「rev」を末尾に付けても逆位置扱い
    let rev = false;
    const m2 = q.match(/^(.+?)(逆位置|逆|rev)$/);
    if (m2) { q = m2[1]; rev = true; }
    const hit = CARDS.filter((c) => norm(c.ja).includes(q) || norm(c.en).includes(q));
    hit.sort((a, b) => (norm(a.ja).startsWith(q) ? 0 : 1) - (norm(b.ja).startsWith(q) ? 0 : 1));
    return { cards: hit.slice(0, 14), rev };
  }

  window.Cards = { ALL: CARDS, BY_ID, search, imgUrl: (c) => IMG_DIR + c.file };
})();
