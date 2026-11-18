// 写真からカードを見つける（端末の中だけで動く。OpenCV.js の AKAZE 特徴量＋射影変換）
// 写真全体の特徴を、78枚の参照画像それぞれと照合し、射影変換が成り立つものをカードとして採る。
// こうすると「どのカードか」「どこにあるか」「上下の向き（逆位置）」が一度に分かる。
(function () {
  const WORKER_URL = new URL("photo-worker.js", document.currentScript.src).href; // photo.js の場所から
  const RW = 240, RH = 400; // 参照画像を縮める大きさ（カードは 3:5）
  let worker = null, refsReady = null, onMsg = null;
  const loadImg = (src) => new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ng(new Error("画像を読めません: " + src)); i.src = src; });
  function grayOf(img, w, hh) { // 灰色の画素（1画素1バイト）
    const c = document.createElement("canvas"); c.width = w; c.height = hh;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, w, hh);
    const d = g.getImageData(0, 0, w, hh).data, out = new Uint8Array(w * hh);
    for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return out;
  }
  function getWorker() {
    if (!worker) { worker = new Worker(WORKER_URL); worker.onmessage = (e) => onMsg && onMsg(e.data); }
    return worker;
  }
  const ask = (msg, doneType, progress) => new Promise((ok, ng) => {
    onMsg = (m) => { if (m.type === "progress") progress && progress(m.text); else if (m.type === "error") ng(new Error(m.text)); else if (m.type === doneType) ok(m); };
    getWorker().postMessage(msg);
  });
  async function prepareRefs(progress) {
    if (refsReady) return refsReady;
    refsReady = (async () => {
      const list = [];
      for (const [i, c] of window.Cards.ALL.entries()) { if (i % 10 === 0) progress && progress(`参照画像を読み込み中 ${i + 1}/78`); list.push({ id: c.id, data: grayOf(await loadImg(window.Cards.imgUrl(c)), RW, RH) }); }
      await ask({ type: "refs", list }, "refs-done", progress);
    })();
    refsReady.catch(() => { refsReady = null; });
    return refsReady;
  }

  // 多角形の面積（符号つき）・凸かどうか
  const area = (q) => q.reduce((s, p, i) => { const n = q[(i + 1) % q.length]; return s + p[0] * n[1] - n[0] * p[1]; }, 0) / 2;
  function convex(q) {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(z) < 1e-6) return false;
      if (!sign) sign = Math.sign(z); else if (Math.sign(z) !== sign) return false;
    }
    return true;
  }
  const centerOf = (q) => [q.reduce((s, p) => s + p[0], 0) / 4, q.reduce((s, p) => s + p[1], 0) / 4];
  function overlap(a, b) { // 中心が相手の中に入っていれば重なりとみなす（簡易）
    const inside = (p, q) => { let s = 0; for (let i = 0; i < 4; i++) { const u = q[i], v = q[(i + 1) % 4]; const z = (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]); if (!s) s = Math.sign(z); else if (Math.sign(z) !== s) return false; } return true; };
    return inside(centerOf(a), b) || inside(centerOf(b), a);
  }

  // 写真を調べる。img は HTMLImageElement など
  async function analyze(img, progress) {
    await prepareRefs(progress);
    const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
    const k = Math.min(1, 1600 / Math.max(W0, H0)), W = Math.round(W0 * k), H = Math.round(H0 * k);
    const res = await ask({ type: "photo", w: W, h: H, data: grayOf(img, W, H) }, "photo-done", progress);
    const found = [];
    for (const f of res.found) {
      const quad = f.quad, a = Math.abs(area(quad));
      const sides = quad.map((p, j) => Math.hypot(quad[(j + 1) % 4][0] - p[0], quad[(j + 1) % 4][1] - p[1]));
      const ratio = (sides[0] + sides[2]) / (sides[1] + sides[3]);
      if (!(convex(quad) && a > W * H * 0.002 && a < W * H * 0.6 && ratio > 0.35 && ratio < 1.0)) continue; // 形が崩れたものは捨てる
      const top = [(quad[0][0] + quad[1][0]) / 2, (quad[0][1] + quad[1][1]) / 2], bot = [(quad[2][0] + quad[3][0]) / 2, (quad[2][1] + quad[3][1]) / 2];
      found.push({ id: f.id, score: f.score, quad, center: centerOf(quad), up: [top[0] - bot[0], top[1] - bot[1]] });
    }

    // 重なったものは点の高い方を残し、残りは候補にする
    found.sort((a, b) => b.score - a.score);
    const cards = [];
    for (const f of found) {
      const hit = cards.find((c) => overlap(c.quad, f.quad));
      if (hit) { if (hit.cands.length < 4) hit.cands.push({ id: f.id, score: f.score }); }
      else cards.push({ ...f, cands: [{ id: f.id, score: f.score }] });
    }
    // 向き: 多数派の「上」を基準にし、それと逆を向くカードを逆位置とする
    const ang = cards.map((c) => Math.atan2(c.up[1], c.up[0]));
    let sx = 0, sy = 0; ang.forEach((a) => { sx += Math.cos(2 * a); sy += Math.sin(2 * a); });
    let axis = cards.length ? Math.atan2(sy, sx) / 2 : -Math.PI / 2; // 縦軸の向き（±）
    const votes = cards.reduce((s, c, i) => s + Math.sign(Math.cos(ang[i] - axis)), 0);
    if (votes < 0) axis += Math.PI;
    // 写真が横向きでも、カードの向きが上になるよう回した座標（レイアウト用）
    const rot = -Math.PI / 2 - axis, cs = Math.cos(rot), sn = Math.sin(rot);
    for (const [i, c] of cards.entries()) {
      c.rev = Math.cos(ang[i] - axis) < 0;
      c.layout = { x: c.center[0] * cs - c.center[1] * sn, y: c.center[0] * sn + c.center[1] * cs };
      c.size = Math.sqrt(Math.abs(area(c.quad)));
      c.sure = c.cands.length < 2 || c.cands[0].score >= c.cands[1].score * 2;
    }
    return { width: W, height: H, scale: k, cards };
  }

  // 検出したカードをスプレッドの位置へ割り当てる（形を合わせて、距離の合計が最小になる組み合わせ）
  function hungarian(cost) {
    const n = cost.length, m = cost[0].length, INF = 1e18, u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0; const minv = Array(m + 1).fill(INF), used = Array(m + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const res = Array(n).fill(-1); for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
    return res;
  }
  const norm = (pts) => {
    const n = pts.length, cx = pts.reduce((s, p) => s + p.x, 0) / n, cy = pts.reduce((s, p) => s + p.y, 0) / n;
    const s = Math.sqrt(pts.reduce((a, p) => a + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / n) || 1;
    return pts.map((p) => ({ x: (p.x - cx) / s, y: (p.y - cy) / s }));
  };
  // cards: analyze の結果, pos: スプレッドの位置。返り値: cards と同じ長さの位置番号（割り当てなしは -1）
  function assign(cards, pos) {
    if (!cards.length || !pos.length) return cards.map(() => -1);
    const A = norm(cards.map((c) => c.layout)), B = norm(pos);
    const cost = A.map((a) => B.map((b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2));
    if (A.length <= B.length) return hungarian(cost);
    // カードの方が多いときは、位置の側から割り当てて、余りは -1
    const t = hungarian(B.map((_, j) => A.map((__, i) => cost[i][j]))), res = cards.map(() => -1);
    t.forEach((i, j) => { if (i >= 0) res[i] = j; });
    return res;
  }

  window.Photo = { analyze, assign, prepareRefs };
})();
