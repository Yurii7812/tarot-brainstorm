import os
HERE = os.path.dirname(os.path.abspath(__file__))
CARD_DIR = os.path.join(HERE, "..", "assets", "cards", "rider-waite-720px")
OUT_DIR = os.path.join(HERE, "..", "out")
from PIL import Image, ImageDraw, ImageFont
import math

W, H = 2400, 2270
REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
f_head = ImageFont.truetype(BLD, 36, index=0)
f_txt = ImageFont.truetype(REG, 29, index=0)
f_lab = ImageFont.truetype(REG, 26, index=0)
f_title = ImageFont.truetype(BLD, 46, index=0)
f_small = ImageFont.truetype(REG, 26, index=0)

img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

CW, CH = 230, 383
cols = {0: 450, 1: 1200, 2: 1950}
rows = {0: 250, 1: 950, 2: 1650}

cards = {
    "king": dict(pos=(0, 0), file="Wands14.jpg", head="相手の気持ち ・ ワンドのキング",
                 txt=["自信があり動じていない", "自分のペースで動く人", "※昨日の理由まではカードから不明"]),
    "devil": dict(pos=(1, 0), file="15_Devil.jpg", head="過去 ・ 悪魔",
                  txt=["縛る・執着のパターン", "（身近な人から学んだ型）", "鎖はゆるい ＝ 外せる"]),
    "pent": dict(pos=(2, 0), file="Pents10.jpg", head="自分の気持ち ・ ペンタクルの10",
                 txt=["長期の安定・つながりを", "望んでいる"]),
    "swords": dict(pos=(0, 1), file="Swords02.jpg", head="近い未来 ・ ソードの2",
                   txt=["決断を保留する膠着", "結果はまだ見えない", "待つ時間"]),
    "wands10": dict(pos=(1, 1), file="Wands10.jpg", head="結論 ・ ワンドの10",
                    txt=["努力は必要だが背負いすぎ注意", "家（ゴール）は見えている"]),
    "temp": dict(pos=(2, 1), file="14_Temperance.jpg", head="現在 ・ 節制",
                 txt=["自制して待つ", "感情と現実のバランス", "ゆっくり整える途中"]),
    "wands8": dict(pos=(1, 2), file="Wands08.jpg", head="アドバイス ・ ワンドの8",
                   txt=["スピード → 急ぐ、と読むと", "節制・王と逆向き", "杖は手を離れて飛ぶ ＝", "手放して流れに任せる、とも"]),
}

def center_text(cx, y, s, font, fill="#222"):
    w = d.textlength(s, font=font)
    d.text((cx - w / 2, y), s, font=font, fill=fill)

box = {}
for k, c in cards.items():
    cx = cols[c["pos"][0]]
    top = rows[c["pos"][1]]
    im = Image.open(os.path.join(CARD_DIR, c["file"])).convert("RGB").resize((CW, CH), Image.LANCZOS)
    x0 = cx - CW // 2
    img.paste(im, (x0, top))
    d.rectangle([x0 - 1, top - 1, x0 + CW, top + CH], outline="#999", width=2)
    center_text(cx, top - 58, c["head"], f_head, "#111")
    y = top + CH + 18
    for line in c["txt"]:
        center_text(cx, y, line, f_txt)
        y += 40
    box[k] = (x0, top, x0 + CW, top + CH)

GREY, RED = "#7a7a7a", "#c0392b"

def arrow_head(p_from, p_to, color, size=16):
    ang = math.atan2(p_to[1] - p_from[1], p_to[0] - p_from[0])
    a1 = ang + math.radians(150)
    a2 = ang - math.radians(150)
    pts = [p_to,
           (p_to[0] + size * math.cos(a1), p_to[1] + size * math.sin(a1)),
           (p_to[0] + size * math.cos(a2), p_to[1] + size * math.sin(a2))]
    d.polygon(pts, fill=color)

def dashed(p, q, color, width=4, dash=18, gap=12):
    L = math.hypot(q[0] - p[0], q[1] - p[1])
    if L == 0:
        return
    ux, uy = (q[0] - p[0]) / L, (q[1] - p[1]) / L
    t = 0
    while t < L:
        e = min(t + dash, L)
        d.line([(p[0] + ux * t, p[1] + uy * t), (p[0] + ux * e, p[1] + uy * e)], fill=color, width=width)
        t += dash + gap

def path(pts, color, dash=False, head_end=True, head_start=False):
    for a, b in zip(pts, pts[1:]):
        if dash:
            dashed(a, b, color)
        else:
            d.line([a, b], fill=color, width=4)
    if head_end:
        arrow_head(pts[-2], pts[-1], color)
    if head_start:
        arrow_head(pts[1], pts[0], color)

def label(cx, cy, lines, color):
    h = len(lines) * 32 + 8
    w = max(d.textlength(s, font=f_lab) for s in lines) + 16
    d.rectangle([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill="white")
    y = cy - h / 2 + 4
    for s in lines:
        center_text(cx, y, s, f_lab, color)
        y += 32

kb, db, pb, sb, w10, tb, w8 = (box[k] for k in ["king", "devil", "pent", "swords", "wands10", "temp", "wands8"])

# L1 悪魔 -> 節制
path([(db[2], 370), (1540, 370), (1540, 1070), (tb[0], 1070)], GREY)
label(1540, 720, ["外せる", "→ 自制へ"], GREY)

# L2 節制 -> ワンドの10
path([(tb[0], 1200), (w10[2], 1200)], GREY)
label(1575, 1165, ["労力は自制に使う"], GREY)

# L3 ソードの2 -> ワンドの10
path([(sb[2], 1200), (w10[0], 1200)], GREY)
label(825, 1165, ["膠着 → 抱え込みに注意"], GREY)

# L5 節制 <-> ワンドの8 (ズレ)
path([(tb[0], 1330), (1640, 1330), (1640, 1860), (w8[2], 1860)], RED, dash=True, head_start=True)
label(1640, 1610, ["ゆっくり", "↔ 急ぐ"], RED)

# L6 王 <-> ワンドの8 (ズレ)
path([(kb[0], 420), (100, 420), (100, 1860), (w8[0], 1860)], RED, dash=True, head_start=True)
label(620, 1860, ["相手は自分のペース ↔ 急かさない"], RED)

center_text(W / 2, 40, "例：相手との関係をどうするか ー ウェイト版 7枚", f_title, "#111")
center_text(W / 2, 115, "灰色の実線＝流れ　／　赤の点線＝読みがぶつかるところ", f_small, "#555")

# まとめ
sx, sy = 1790, 1670
lines = ["まとめ", "彼の気持ちは悪くなさそう。",
         "ただし自分のペースの人。",
         "今は自制して待つ時期。",
         "会う提案は、連絡が来て",
         "反応を見てから軽く。"]
d.rectangle([sx, sy, sx + 520, sy + 330], outline="#999", width=2)
y = sy + 18
for i, s in enumerate(lines):
    d.text((sx + 24, y), s, font=f_head if i == 0 else f_txt, fill="#111")
    y += 48 if i == 0 else 42

img.save(os.path.join(OUT_DIR, "spread_map.png"))
print("ok")
