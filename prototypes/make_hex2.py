import os
HERE = os.path.dirname(os.path.abspath(__file__))
CARD_DIR = os.path.join(HERE, "..", "assets", "cards", "rider-waite-720px")
OUT_DIR = os.path.join(HERE, "..", "out")
from PIL import Image, ImageDraw, ImageFont
import math

W, H = 2400, 2260
REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
f_pos = ImageFont.truetype(BLD, 38, index=0)
f_head = ImageFont.truetype(BLD, 36, index=0)
f_name = ImageFont.truetype(REG, 28, index=0)
f_txt = ImageFont.truetype(REG, 29, index=0)
f_title = ImageFont.truetype(BLD, 46, index=0)
f_small = ImageFont.truetype(REG, 26, index=0)

img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

CW, CH = 230, 383
cx, cy, R = 1200, 1110, 640
dx = R * math.cos(math.radians(30))
V = {
    "top": (cx, cy - R),
    "ur": (cx + dx, cy - R / 2),
    "lr": (cx + dx, cy + R / 2),
    "bottom": (cx, cy + R),
    "ll": (cx - dx, cy + R / 2),
    "ul": (cx - dx, cy - R / 2),
    "center": (cx, cy),
}

nodes = [
    dict(v="ul", side="left", pos="相手の気持ち", name="ワンドのキング", file="Wands14.jpg",
         txt=["自信があり動じていない", "自分のペースで動く人", "※昨日の理由は不明"]),
    dict(v="top", side="left", pos="過去", name="悪魔", file="15_Devil.jpg",
         txt=["縛る・執着のパターン", "（身近な人から学んだ型）", "鎖はゆるい ＝ 外せる"]),
    dict(v="ur", side="right", pos="自分の気持ち", name="ペンタクルの10", file="Pents10.jpg",
         txt=["長期の安定・つながりを", "望んでいる"]),
    dict(v="lr", side="right", pos="現在", name="節制", file="14_Temperance.jpg",
         txt=["自制して待つ", "感情と現実のバランス", "ゆっくり整える途中"]),
    dict(v="bottom", side="bottom", pos="アドバイス", name="ワンドの8", file="Wands08.jpg",
         txt=["スピード → 急ぐ、と読むと", "節制・王と逆向き", "杖は手を離れて飛ぶ ＝", "手放して流れに任せる、とも"]),
    dict(v="ll", side="left", pos="近い未来", name="ソードの2", file="Swords02.jpg",
         txt=["決断を保留する膠着", "結果はまだ見えない", "待つ時間"]),
    dict(v="center", side="center", pos="結論", name="ワンドの10", file="Wands10.jpg",
         txt=["努力は必要だが", "背負いすぎ注意", "家（ゴール）が見える"]),
]

def tw(s, f):
    return d.textlength(s, font=f)

def white_box(x0, y0, x1, y1):
    d.rectangle([x0, y0, x1, y1], fill="white")


GREY, RED = "#7a7a7a", "#c0392b"

def edge_point(c, o, margin=10):
    dx, dy = o[0] - c[0], o[1] - c[1]
    tx = (CW / 2 + margin) / abs(dx) if dx else 1e9
    ty = (CH / 2 + margin) / abs(dy) if dy else 1e9
    t = min(tx, ty)
    return (c[0] + dx * t, c[1] + dy * t)

def arrow_head(p_from, p_to, color, size=18):
    ang = math.atan2(p_to[1] - p_from[1], p_to[0] - p_from[0])
    pts = [p_to]
    for da in (150, -150):
        a = ang + math.radians(da)
        pts.append((p_to[0] + size * math.cos(a), p_to[1] + size * math.sin(a)))
    d.polygon(pts, fill=color)

def dashed(p, q, color, width=5, dash=20, gap=13):
    L = math.hypot(q[0] - p[0], q[1] - p[1])
    ux, uy = (q[0] - p[0]) / L, (q[1] - p[1]) / L
    t = 0
    while t < L:
        e = min(t + dash, L)
        d.line([(p[0] + ux * t, p[1] + uy * t), (p[0] + ux * e, p[1] + uy * e)], fill=color, width=width)
        t += dash + gap

def link(a, b, color, dash=False, both=False, f=0.5, lab=None):
    p = edge_point(V[a], V[b]); q = edge_point(V[b], V[a])
    if dash:
        dashed(p, q, color)
    else:
        d.line([p, q], fill=color, width=5)
    arrow_head(p, q, color)
    if both:
        arrow_head(q, p, color)
    if lab:
        cxl, cyl = p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f
        h = len(lab) * 32 + 10
        w = max(tw(s, f_small) for s in lab) + 18
        d.rectangle([cxl - w / 2, cyl - h / 2, cxl + w / 2, cyl + h / 2], fill="white")
        y = cyl - h / 2 + 5
        for s in lab:
            d.text((cxl - tw(s, f_small) / 2, y), s, font=f_small, fill=color)
            y += 32

link("top", "lr", GREY, f=0.75, lab=["外せる", "→ 自制へ"])
link("lr", "center", GREY, f=0.5, lab=["労力は", "自制に使う"])
link("ll", "center", GREY, f=0.3, lab=["膠着 →", "抱え込み注意"])
link("ur", "center", GREY, f=0.2, lab=["望み →", "労力へ"])
link("lr", "bottom", RED, dash=True, both=True, f=0.5, lab=["ゆっくり", "↔ 急ぐ"])
link("ul", "bottom", RED, dash=True, both=True, f=0.2, lab=["相手は自分のペース", "↔ 急かさない"])

for n in nodes:
    x, y = V[n["v"]]
    x0, top = int(x - CW / 2), int(y - CH / 2)
    side = n["side"]
    if side in ("top", "bottom", "center"):
        head = f"{n['pos']} ・ {n['name']}"
        hw = tw(head, f_head)
        if side == "bottom":
            d.text((x - hw / 2, top + CH + 16), head, font=f_head, fill="#111")
            yy = top + CH + 16 + 56
        else:
            white_box(x - hw / 2 - 12, top - 66, x + hw / 2 + 12, top - 12)
            d.text((x - hw / 2, top - 62), head, font=f_head, fill="#111")
            yy = top + CH + 16
        maxw = max(tw(s, f_txt) for s in n["txt"])
        white_box(x - maxw / 2 - 14, yy - 4, x + maxw / 2 + 14, yy + 40 * len(n["txt"]) + 2)
        for s in n["txt"]:
            d.text((x - tw(s, f_txt) / 2, yy), s, font=f_txt, fill="#222")
            yy += 40
    else:
        if side == "right":
            tx = x0 + CW + 36
            align = "l"
        else:
            tx = x0 - 36
            align = "r"
        yy = top
        def put(s, f, fill):
            global yy
            w = tw(s, f)
            px = tx if align == "l" else tx - w
            d.text((px, yy), s, font=f, fill=fill)
        put(n["pos"], f_pos, "#111"); yy += 54
        put(n["name"], f_name, "#777"); yy += 46
        for s in n["txt"]:
            put(s, f_txt, "#222"); yy += 40

# cards on top of lines
for n in nodes:
    x, y = V[n["v"]]
    x0, top = int(x - CW / 2), int(y - CH / 2)
    im = Image.open(os.path.join(CARD_DIR, n["file"])).convert("RGB").resize((CW, CH), Image.LANCZOS)
    img.paste(im, (x0, top))
    d.rectangle([x0 - 1, top - 1, x0 + CW, top + CH], outline="#999", width=2)

title = "例：相手との関係をどうするか ー ヘキサグラム配置"
d.text((W / 2 - tw(title, f_title) / 2, 40), title, font=f_title, fill="#111")

d.text((W / 2 - tw("灰色の実線＝流れ　／　赤の点線＝読みがぶつかるところ", f_small) / 2, 112), "灰色の実線＝流れ　／　赤の点線＝読みがぶつかるところ", font=f_small, fill="#555")

# まとめ
sx, sy = 1790, 1880
lines = ["まとめ", "彼の気持ちは悪くなさそう。",
         "ただし自分のペースの人。",
         "今は自制して待つ時期。",
         "会う提案は、連絡が来て",
         "反応を見てから軽く。"]
d.rectangle([sx, sy, sx + 520, sy + 330], outline="#999", width=2, fill="white")
y = sy + 18
for i, s in enumerate(lines):
    d.text((sx + 24, y), s, font=f_head if i == 0 else f_txt, fill="#111")
    y += 48 if i == 0 else 42

img.save(os.path.join(OUT_DIR, "spread_hexagram5.png"))
print("ok")
