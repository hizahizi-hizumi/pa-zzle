# 魔方陣の遊び方 採点（grader）

確かめた範囲: http://localhost:5342/puzzles/magic-square の「メニュー」→「遊び方」を、iPhone 13（390×664）と PC 1280×800 で開いた。3つのタブを最後まで送り、ルールの例3つと操作の例4つを手がかりどおりと手がかり以外の押し方（使った数・最初からの数・5つ目のメモ・誤った数・クリア後・元に戻す）で押した。冒頭の盤面は再生の途中で押して飛ばし、見せ直すボタンでも再生した。スマホではタブを上に留めたまま 18px ずつ送って、ルール・操作・採点の全区間を撮った（236コマ）。ブラウザのエラー・警告は0件。

画像はすべて /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/ にある（スマホの全画面画像は3倍、fine/ 以下は2倍）。

## 1. 点数: 84 / 120

- 本番の盤面部品と本番の判定で動く触れる例、押す順に進む手がかり、再生と飛ばしのできるゴールの盤面、タブの固定と重なり順は、一流の商用アプリを上回る出来で、仕組みの完成度は高い。
- 一方、ルールと操作の説明が3〜5行の太字の塊になっていて、例の判定（✓ そろう／✕ そろわない）が画面でいちばん弱い文字になっている。文字の強弱が逆転していて、ひと目で「読ませる説明書」に見える。
- 余白の不ぞろい（16/12/48px、面の上下が32/17と32/48）、灰色の面に置いた盤のくすみ、採点の図の分かりにくさ、印と数字の重なりなど仕上げの粗さが複数残り、商用の水準（100点）には届かない。

## 2. 点数を下げている所（重い順）

### 1) ルール・操作の説明文が、長い太字の段落になっている
- どこ: ルールタブの3つの文、操作タブの「置き方」「メモ」の文（スマホ・PCとも）。とくにルール1（5行）とメモ1（5行）。
- 何が商用品質に見えないか: 見出し（h3/h4、16px・600）として組んだ文に「完成の条件」「緑になる条件」「赤になる2つの条件」まで続けて詰めていて、見出しと本文の区別がない。16px の太字が5行続くと黒い塊に見え、読み始めの手がかりがない。採点タブの本文は400で組んでいて、タブの間でも本文の太さがそろっていない。
- どう直すか: 1つの決まりにつき、1行に収まる見出し（`text-heading` 太字）と、2行までの本文（`text-body` 400）に分ける。色の条件は例の判定に任せて本文から抜く。例: 見出し「縦・横・斜めのどの列も、左上の合計にそろえる」、本文「列の端の合計は、そろうと緑、もうそろわないと赤になります。」。メモは見出し「鉛筆のボタンでメモ（1マス4つまで）」とし、本文で書き方と消し方だけを言う。
- 遊び方の中だけで直せるか: 直せる。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p1.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab1-p3.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/pc-12-tab1-p2.png

### 2) 例の判定が画面でいちばん弱い文字で、判定とわけに強弱がない
- どこ: ルール1の例の下の「✓ そろう」「✕ そろわない」と2行目のわけ（「埋まって合計が合わない」「空きがあるのに合計に届いた」）。ルール3の「✕ 最初から置いてある数」とメモの「✕ メモは4つまで」も同じ。
- 何が商用品質に見えないか: 例で伝えたい結論（✓/✕）が 14px・400 で、真上の数の札（20px 太字）や盤の数字より弱い。判定とわけが同じ大きさ・太さ・色なので、どちらが結論か分からない。そのうえ上の本文は太字なので、強弱が逆になっている。
- どう直すか: 判定の行（印と「そろう／そろわない」）を `text-body` の太字・`foreground` にし、印も一回り大きくする。わけは `text-supporting`・`muted-foreground` に下げる。色は増やさない（DESIGN の「不成立をエラーとして表さない」に沿って白黒のまま）。
- 遊び方の中だけで直せるか: 直せる（遊び方の共通部品の判定の段を変える）。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-20-03-line-press12.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p2.png

### 3) 余白が不ぞろいで、文がどの例に属するか曖昧になる
- どこ:
  - 操作タブの「置き方」と「メモ」の2つ目の文。前の例の面の下から 16px（DOM 上の値。見た目は約21px）で始まり、自分の面まで 12px しかないので、前の例の説明にも次の例の見出しにも読める。ルールタブでは同じ「例の面→次の文」の間が 48px ある。
  - 例の面の内側の上下の余白。ルール1の面は上 33px・下 17px（2行目のわけが場所を取らずに下の余白へはみ出す）。操作の「置き方」「置き換え」「メモが消える」の面は上 32px・下 48px（元に戻すボタンの分を下に取っている）。上下がそろっている面は、ルール2・3とメモ1だけ。
  - PC では、左の段の説明文と盤面の間が 12px しかない（スマホは 24px）。
- 何が商用品質に見えないか: 同じ種類の間がタブや面ごとに 12・16・17・32・48px と変わり、リズムが崩れている。操作タブの例の面は下が空いて重く見える。
- どう直すか: 決まりと決まりの間はどのタブでも 48px（spacing×12）、文と自分の面の間は 12px にそろえる。面の上下は 32px にそろえる。そのために、元に戻すボタンは面の右上の角か盤の横に置き、わけの行は figcaption の中に2行分の高さで場所を取る。
- 遊び方の中だけで直せるか: 直せる。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/anno-ops-spacing.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/anno-line-top.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/anno-line-bottom.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-50-line-midway.png

### 4) 採点タブの「置き直し」の説明と流れの図が分かりにくい
- どこ: 採点タブの正確さ（「置き直し 1回 −3点」の行、流れの図、「「待った」・「盤面を戻す」」の行）と、速さの「基準時間」の行。
- 何が商用品質に見えないか:
  - 「列の端の色を変えなかった数はほかのマスを選ぶ前に直せば数えません」は抽象的。図は色の違いだけを見せていて、「ほかのマスを選ぶ前に」という条件は図に出てこない。
  - 図の注記は「16を／置く／→」と3段に折れて詰まっている。下の言葉は、左の2〜3行と右の「→ 置き直し 1回」が上ぞろえで並び、まとまりのない形になっている。
  - 図だけが白地に枠線の面で、ほかの例は灰色の面、メニューは影付きの面と、囲み方が3通りある。この図は触っても動かないのに、触れる例と同じ盤の見た目をしている。
  - 「空いたマス1つにつき10秒ずつ20秒に足します」は語順のせいで読みにくく、具体的な数も無い。
- どう直すか:
  - 文は「置いた数を外す・置き換えるたびに1回。ただし、列の合計の色が変わらなかった数を、そのマスを選んだまま直したときは数えません。」のように、操作の言葉で言い切る。
  - 図の真ん中のコマの下に「赤になった」「色は変わらない」と短く添え、矢印の言葉は1行（「16を置く」）にする。
  - 囲み方は、触れる例と見分けるのなら「触れない図」として1種類に決め、遊び方全体でそろえる。
  - 基準時間は「20秒＋空いたマス×10秒（例: 空き8マスなら100秒）」のように式と例で示す。
- 遊び方の中だけで直せるか: 文と図は直せる。数え方そのものを分かりやすくするには、本番の採点を変える必要がある。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab2-p0.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab2-p1.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab2-p2.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/pc-12-tab2-p2.png

### 5) ルールタブで、補足の表が本題のルールより強い見出しになっている
- どこ: ルールタブ末尾の「5×5と6×6の盤面」。
- 何が商用品質に見えないか: 本題のルール3つは 16px の文で、区切りの見出しを持たない。その後ろの補足の表だけが 22px・700 の区切り見出しと罫線を持つので、いちばん目立つのが補足になっている。
- どう直すか: 表の頭は、ルールの見出しと同じ段（`text-heading`）に下げて罫線を外す。または、表をルール1の下の小さな注記として置く。
- 遊び方の中だけで直せるか: 直せる。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p4.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/pc-12-tab0-p2.png

### 6) 例の面の地が冷たい灰色で、本番の盤の見え方と違う
- どこ: すべての触れる例の面（スマホ・PC）。
- 何が商用品質に見えないか: 本番では暖かいベージュの地（RGB 215,210,201）に盤がなじんでいる。遊び方では冷たい灰色（245,245,245）の面に暖色の盤を載せていて、盤がくすんで浮き、「本番の盤を切り出して貼った」ように見える。DESIGN の「盤の周囲の地はゲームごとに選ぶ」とも合っていない。
- どう直すか: 魔方陣の例の面の地を、本番の解く場面の地の色（ゲーム固有の地）にする。面の角丸と余白はそのまま使う。
- 遊び方の中だけで直せるか: 直せる（例の面の地の指定）。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/compare-ground-play-vs-help.png

### 7) 1行の例で、数の列が盤より大きく、例が下に重い
- どこ: ルール1〜3、操作の「置き換え」と「メモ」2つの、1行の盤の例。PC で特に目立つ。
- 何が商用品質に見えないか: 1行の盤（スマホ 214px、PC 295px）の下に、その 1.5〜1.9 倍の幅（326px／560px）の16個の札が2段並ぶ。見せたいのは列の合計の色なのに、面の6割を数の札が占めている。ルール1は盤2つと数の列2つで、面の高さが 493px（スマホで1画面弱）ある。PC では札の数字（約16px）が盤の数字（約30px）の半分で、平たく見える。
- どう直すか: 1行の例では数の列の幅を盤のまとまり（合計の見出しから端の合計まで）の幅に合わせる。ルール1は、2つの盤で数の列を1つにして、選んだ盤に置くようにする。
- 遊び方の中だけで直せるか: 直せる（本番の数の列の部品はそのまま使い、遊び方での幅と並べ方を変える）。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/pc-12-tab0-p1.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p1.png

### 8) ✓／✕ の印が数字に重なり、数の札では印が多すぎる
- どこ: ルール3「最初から置いてある数は変えられません」の「14」のマスと、ルール2「盤面にまだ無い数を置けます」の数の札16個。
- 何が商用品質に見えないか:
  - 2桁の「14」で、右上の ✕ の白い丸が「4」の右上の角に重なっている。コードのコメントは「中央の数にかからず」としているが、2桁では守れていない。
  - 数の札は、出っ張り（置ける）とくぼみ（置いてある）の形で状態がすでに分かるのに、16個すべてに印が付いていてざわつく。PC では印が 12px の点になり、読めない飾りに見える。
- どう直すか:
  - マスの印は、盤の枠側の外の角（右上の外へ −6px ほど）に出して、数字に触れないようにする。
  - 数の札は ✕ の3つだけに印を付け、✓ は凡例だけで言う。PC では印を 16px 以上にする。
- 遊び方の中だけで直せるか: 直せる。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-20-22-given-reset-crop.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-20-16-given-press6-rejected.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p2.png

### 9) 見せ直すボタンが何にもそろっておらず、形も二重
- どこ: 冒頭のゴールの盤面の右下の、見せ直すボタン。
- 何が商用品質に見えないか:
  - スマホではボタンの右端が 334.7px で、盤の見える右端（右下の斜めの合計 328.7px）にも、下のチュートリアルのボタンの右端（374px）にもそろっていない。PC では盤の見える右端（547px）より 12px 外に出ている。
  - 枠付きの四角の中に丸付きの再生アイコンが入っていて、輪郭が二重になっている。
- どう直すか: 盤の見える右端（右下の斜めの合計の右端）にそろえるか、盤の下の中央に置く。枠を外したゴーストのアイコンボタンにして、輪郭を一重にする。
- 遊び方の中だけで直せるか: 直せる。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-02-open-6500.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/pc-11-tab0-p0.png

### 10) 何も言っていない文・ずれた言い方・見た目の食い違い
- どこと何がまずいか:
  - 「盤面にまだ無い数を置けます。」は許可の形なので、「同じ数は1回しか使えない」という制約として読めない。
  - 「最初から置いてある数は変えられません。」はどのパズルにも当てはまる文で、魔方陣での見分け方（黒い数字が盤にじかに書かれている／置いた数は青い数字で明るい札）を言っていない。
  - 「0点より下にはなりません。」は何も言っていない。「10回置き直すと0点です」と言えば、同じ1行で情報になる。
  - 採点の「「待った」・「盤面を戻す」」では、」・「の前後が全角どうしで間延びしている。
  - 操作タブの「待った」の注記と「盤面を戻す」の4行の説明が、採点タブと同じ数え方の話を繰り返している。
  - 例ごとに数の扱いが変わる。ルール2では「4」が置いた数（明るい札・青）なのに、すぐ下のルール3では同じ並び「14 4 5 □」の「4」が最初からの数（札なし・黒）に変わる。「14」もルール1では置いた数、ゴールとルール2・3では最初からの数になっている。並べて見ると、なぜ違うのかが分からない。
- どう直すか:
  - 「同じ数は1回だけ使えます。もう置いてある数は押せません。」とする。
  - 「黒い数字は最初からある数で、変えられません。」とする。
  - 「10回置き直すと0点です。」とする。
  - 見出しは「「待った」と「盤面を戻す」」にする。
  - 操作タブからは数え方の話を外し、採点タブへの一言に寄せる。
  - ルール2と3で、同じ数の扱い（置いた数か、最初からの数か）をそろえる。
- 遊び方の中だけで直せるか: 直せる。
- 画像:
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p2.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab0-p3.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab1-p2.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/phone-11-tab2-p2.png

## 3. すでに一流の水準で、変えないほうがよい所

- 本番の盤・数の列・待った・メモの切り替えをそのまま使った触れる例。押すと本番の判定で列の合計と色、選んだ列の濃さ、受け付けない押し方の揺れとわけが返る。どの例でも、手がかり以外の押し方（使った数、最初からの数、5つ目のメモ、誤った数、クリア後）が破綻しなかった。
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/sheet-line.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/sheet-memo.png
- 押す所を1手ずつ進める手がかり（破線の輪と手）。変わった後にだけ現れる「元に戻す」ボタンは、出し入れで周りを動かさない。
- 「34 が緑の行」と「34 なのに赤の行（空きがあるのに合計に届いた）」を対で見せるルール1の例。このパズルにしかない見どころを、色だけで分からせている。
- ゴールの盤面の再生。1マスだけ空いた列から埋めていき、合計が緑に変わってクリア演出で終わる。途中で押すと最後の姿へ飛び、見せ直すボタンは落ち着いてから出る。
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/sheet-goal-phone.png
- スマホでタブを上に留めたまま送ったとき、全区間（236コマ）で手がかりの手・✓✕ の印・元に戻すボタン・メニューの面の影がタブの上に出ず、境界できれいに切れる。選んでいるタブの下線は境界線にぴったり重なる。
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/fine-t1a.png
  - /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review7/grader/fine-t0b.png
- 日本語の組版。文節単位で改行して語の途中で折らない。行頭の「「」をぶら下げて、字の黒い部分を本文の左端にそろえている。
- 本番との対応。「…」の位置、「置き直し」の呼び名、メニューの3項目のアイコンと破壊的な操作の赤、待ったのボタンが、プレイ画面と一致している。
- PC の2段組み。左にゴールとチュートリアルへの入口を残したまま、右のタブだけを送れる。左の盤とタブの中身の上端はそろっている。
