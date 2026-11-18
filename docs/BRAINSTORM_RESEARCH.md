# ブレインストーミングの研究メモ（2026-11-18）

タロットなどの「引く道具」を、普通のブレインストーミングの中でどう生かすかを調べ、設計に落とした記録。

## 1. 調べたもの

| 対象 | 分かったこと | このアプリでの使い方 |
|---|---|---|
| 自由配置のキャンバス（Scapple・Kinopio） | 書き始めの手間が少ないほど続く。つなぐのが速いと、図が考える道具になる。Kinopio は「つなぐことで新しい考えが生まれる」を設計の中心に置く | 空きをクリックで書く。ノードから別のノードへドラッグでつなぐ。空きに離すと、つながった新しいアイデアができる |
| キーボード中心のマインドマップ（Freeplane 系・Limn・h-m-m など） | Tab＝子、Enter＝兄弟 がほぼ共通の作法 | 書いている間 Enter＝次、Tab＝そこから広げる、Shift+Tab＝元へ |
| 構造の強いツール（Heptabase） | 整理には強いが、出し始めの散らかった段階には向かない | 「出す」と「まとめる」を分ける。まとめは枠（グループ）と書き出しで |
| ランダム刺激（de Bono の random entry） | 自分で選ばない偶然の言葉から、性質→たとえ→仕組み→応用 とつなぐ。すぐつながる言葉は偶然が足りない | タロットの絵・易の卦・発想カードを「偶然の刺激」として扱う。カードの「絵の中にあるもの」を押すと、それを起点に書ける |
| 6つの視点（Six Thinking Hats） | 見る角度を1つに決めると、混ざらずに出せる | アイデアを6種類に色分け: 気づき・気持ち・心配・よい面・行動・問い（Ctrl+1〜6） |
| SCAMPER・ブレインライティング・親和図（KJ法） | 変え方の型、黙って書く時間、似たものを集めて名前をつける | SCAMPER は発想カードに入れた。枠で囲んで名前をつける。書き出しで種類ごとに集め直す（次にやること・残った問い・心配なこと） |
| タロットを書く道具に使う人たち（Writer's Digest など） | 読み方を知らなくてよい。絵を見て浮かんだものを判断せずに書く。スートで見る観点を変える（カップ＝感情、ソード＝考え、ワンド＝動き、ペンタクル＝物・場所）。2枚を組み合わせる | カードごとに「絵の中にあるもの」と問いを出す。スートと数の意味を添える。カードどうしをつなぎ、ひとことを書く |
| 線の引き方（グラフ描画の研究・netgraph・yEd） | 線は他の要素を避けて曲げる。同じ2つの間の線は並べてずらす | 曲線にして、途中のカードやアイデアを避ける。同じ2つの間の線はずらす。ラベルが重ならない位置を線に沿って探す |

## 2. 決めた設計

- **盤面（ブレスト本体）とデッキを分ける。** 盤面だけでも使える。あとで YuriiNote に組み込むのは盤面の部分。
- **デッキ**（引いて使う刺激）: タロット・易（コインで6爻、変わる爻と之卦）・発想カード（ランダムな言葉・SCAMPER・6つの視点・問い・価値観・物語の型）。
- **出す**: クリックで書く、カードやアイデアをクリックすると、つながった入力欄が出る。Enter/Tab で続けて広げる。
- **まとめる**: 枠（KJ法）、一覧表示（箇条書きの木で見る・直す）、書き出し（木の形＋種類ごとのまとめ）。
- **ひな形**: 中心テーマ・自由・SWOT・2×2・良い点悪い点、タロットのスプレッド、易、発想カード3枚。作ったあとは変えない。

## 3. まだやっていないこと・候補

- タイマー（時間を区切って出す）と、しるし（星で良いものを選ぶ）。今回は見送り。
- ルーン、トランプなど他のデッキ。
- 写真認識: 見つからないカードがある（合成写真の試験で 7枚中6枚）。重なったカード（ケルト十字の交差）は未対応。

## 出典

- [Kinopio: Creating Cards and Connections](https://kinopio.club/help/posts/creating-cards-and-connections/)、[Kinopio について](https://kinopio.club/help/about/)
- [Scapple の紹介（surfaced）](https://surfaced-x.pages.dev/item/scapple-freeform-brainstorming-idea-generation)
- [Logseq の議論: ホワイトボードと速いつなぎ](https://discuss.logseq.com/t/whiteboards-moodboards-lets-discuss-and-gather-ideas/1793/2)
- [キーボード中心の SVG マインドマップ（Tab で子）](https://dev.to/sendotltd/a-keyboard-first-svg-mind-map-editor-with-tab-to-add-child-and-markdown-export-225o)、[h-m-m](https://www.github.com/nadrad/h-m-m)
- [Random Input（ランダム刺激）](https://www.webfx.com/blog/web-design/using-random-input-technique-kickstart-creativity)、[ランダムな言葉で考える](https://admiredleadership.substack.com/p/sharpen-your-creative-thinking-with)
- [SCAMPER（Conceptboard）](https://conceptboard.com/blog/scamper-technique-template)、[ブレスト手法のまとめ（Asana）](https://asana.com/resources/brainstorming-techniques)、[Brainstorming techniques（Szeged 大学）](https://okt.inf.szte.hu/projektmunka/en/background/brainstorming_techniques.html)
- [Writer's Digest: Tarot in the Writing Process](https://writersdigest.com/be-inspired/tarot-in-the-writing-process-leveraging-tarot-readings-as-a-creative-catalyst)、[Book Riot: Tarot Cards as a Writer's Tool](https://bookriot.com/tarot-cards-as-a-writers-tool/)
- [netgraph: Edge Layout / Routing](https://netgraph.readthedocs.io/en/stable/edge_layout.html)、[Edge Routing with Ordered Bundles](https://arxiv.org/pdf/1209.4227)
