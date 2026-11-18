// 写真の照合（重いので画面とは別の流れで動かす）。OpenCV.js の AKAZE 特徴量＋射影変換
/* global cv */
importScripts("../node_modules/@techstark/opencv-js/dist/opencv.js");
const RW = 240, RH = 400, REF_KP = 400, PHOTO_KP = 5000;
let ready = null, det = null, refs = [];
function init() {
  if (!ready) ready = new Promise((r) => { if (cv.Mat) r(); else cv.onRuntimeInitialized = r; }).then(() => { det = new cv.AKAZE(); });
  return ready;
}
// 強い特徴点だけ残す（机の模様などで点が増えすぎると、照合が極端に遅くなる）
function features(gray, w, h, max) {
  const g = cv.matFromArray(h, w, cv.CV_8UC1, gray), mask = new cv.Mat(), d = new cv.Mat();
  let kp = new cv.KeyPointVector();
  det.detect(g, kp, mask);
  if (kp.size() > max) {
    const all = []; for (let i = 0; i < kp.size(); i++) all.push(kp.get(i));
    all.sort((a, b) => b.response - a.response);
    const keep = new cv.KeyPointVector(); for (let i = 0; i < max; i++) keep.push_back(all[i]);
    kp.delete(); kp = keep;
  }
  det.compute(g, kp, d);
  const pts = []; for (let i = 0; i < kp.size(); i++) { const p = kp.get(i).pt; pts.push([p.x, p.y]); }
  kp.delete(); g.delete(); mask.delete();
  return { pts, d };
}
onmessage = async (e) => {
  const m = e.data;
  try {
    await init();
    if (m.type === "refs") {
      for (const r of refs) r.d.delete();
      refs = [];
      m.list.forEach((r, i) => { refs.push({ id: r.id, ...features(r.data, RW, RH, REF_KP) }); if (i % 6 === 5) postMessage({ type: "progress", text: `参照画像を準備中 ${i + 1}/${m.list.length}` }); });
      postMessage({ type: "refs-done" });
    } else if (m.type === "photo") {
      postMessage({ type: "progress", text: "写真の特徴を調べています" });
      const P = features(m.data, m.w, m.h, PHOTO_KP), found = [];
      const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
      refs.forEach((r, i) => {
        if (i % 6 === 0) postMessage({ type: "progress", text: `照合中 ${i + 1}/${refs.length}` });
        if (r.d.rows < 8 || P.d.rows < 8) return;
        const mm = new cv.DMatchVectorVector(); bf.knnMatch(r.d, P.d, mm, 2);
        const src = [], dst = [];
        for (let j = 0; j < mm.size(); j++) {
          const p = mm.get(j);
          if (p.size() === 2 && p.get(0).distance < 0.8 * p.get(1).distance) { const q = p.get(0); src.push(...r.pts[q.queryIdx]); dst.push(...P.pts[q.trainIdx]); }
        }
        mm.delete();
        if (src.length / 2 < 12) return;
        const sm = cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, src), dm = cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, dst), mask = new cv.Mat();
        const H = cv.findHomography(sm, dm, cv.RANSAC, 6, mask);
        let inl = 0; for (let j = 0; j < mask.rows; j++) if (mask.data[j]) inl++;
        if (!H.empty() && inl >= 10) {
          const h = H.data64F, tf = (x, y) => { const w = h[6] * x + h[7] * y + h[8]; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
          found.push({ id: r.id, score: inl, quad: [tf(0, 0), tf(RW, 0), tf(RW, RH), tf(0, RH)] });
        }
        sm.delete(); dm.delete(); mask.delete(); H.delete();
      });
      bf.delete(); P.d.delete();
      postMessage({ type: "photo-done", found });
    }
  } catch (err) { postMessage({ type: "error", text: String(err && err.message || err) }); }
};
