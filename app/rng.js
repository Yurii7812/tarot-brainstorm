// 引き方: 乱数の元（種）→ 疑似乱数 → 混ぜ方 → 上から配る。種を記録するので、同じ種なら同じ結果を再現できる。
(function () {
  const enc = new TextEncoder();
  const sha256 = async (data) => new Uint8Array(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
  const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

  // sfc32（小さく速い疑似乱数）。種の先頭16バイトで初期化
  function prng(bytes) {
    const v = new DataView(bytes.buffer, bytes.byteOffset);
    let a = v.getUint32(0), b = v.getUint32(4), c = v.getUint32(8), d = v.getUint32(12);
    const next = () => {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 15; i++) next();
    return next;
  }

  // 一度で完全に混ぜる（Fisher–Yates）
  function fisherYates(a, rnd) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const binom = (n, rnd) => { let k = 0; for (let i = 0; i < n; i++) if (rnd() < 0.5) k++; return k; };
  // 手で切る再現: リフルシャッフル（Gilbert–Shannon–Reeds モデル）＋最後にカット
  function riffle(a, rnd) {
    const k = binom(a.length, rnd), L = a.slice(0, k), R = a.slice(k), out = [];
    while (L.length || R.length) out.push(rnd() * (L.length + R.length) < L.length ? L.shift() : R.shift());
    return out;
  }
  function cut(a, rnd) {
    const k = Math.max(1, Math.min(a.length - 1, binom(a.length, rnd)));
    return a.slice(k).concat(a.slice(0, k));
  }

  // 種を作る。label は記録・表示用
  async function makeSeed(method, opt) {
    if (method === "word") return { bytes: await sha256("word:" + opt.text), label: opt.text };
    if (method === "time") { const t = `${Date.now()}.${Math.round(performance.now() * 1000)}`; return { bytes: await sha256("time:" + t), label: t }; }
    if (method === "mouse") { const b = await sha256("mouse:" + opt.samples.join(";")); return { bytes: b, label: "マウス " + opt.samples.length + "点 → " + hex(b).slice(0, 16) }; }
    const r = crypto.getRandomValues(new Uint8Array(16));
    return { bytes: await sha256(r), label: hex(r) };
  }

  // ids: 山札（新品の並び）, count: 配る枚数
  async function draw(o) {
    const seed = await makeSeed(o.method, o), rnd = prng(seed.bytes);
    let deck = o.ids.slice();
    if (o.shuffle === "riffle") { for (let i = 0; i < o.riffles; i++) deck = riffle(deck, rnd); deck = cut(deck, rnd); }
    else deck = fisherYates(deck, rnd);
    const picks = deck.slice(0, o.count).map((id) => ({ id, rev: !!o.revOn && rnd() * 100 < o.revProb }));
    return { picks, seed: seed.label };
  }

  window.Rng = { draw };
})();
