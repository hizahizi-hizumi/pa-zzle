# 遊び方の共通の部品の変更：ほかの11ゲームの見直し（作る側）

## 確かめた条件

- 変更後 http://localhost:5342（rev3 74e803b1）、変更前 http://localhost:5343（rev2 4b9cf7ee）。11ゲームのコードの差は共通の部品だけ（`git diff 4b9cf7ee 74e803b1 --stat` で確認）。
- 各ゲームのホーム →「メニュー」→「遊び方」で開き、スマートフォン（devices['iPhone 13']、390×664）と PC（1280×800）で、3つのタブを最後まで撮って見比べた。ゴールは再生の途中と終わった後を撮った。
- ルールと操作のタブの触れる例の面はすべて、例ごとに手がかりを押して（届かなければドラッグして）元に戻すボタンを出し、ボタンと例・言葉の重なり、面からのはみ出し、元に戻した後に消えるかを測って撮った。
- 追加で、ウォーターソートの注ぐ動きのコマ撮り、縦に長い面で読む人と同じ所まで送ってから触る確認、11ゲームのプレイ画面の「…」の位置、幅 320px での面の置き場所とはみ出しの測定をした。
- 置き場所: スクリプト・ログ・画像はすべて /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/ にある。
  - ゲームごとの撮影: `shots/<game>/{before|after}-{phone|pc}-*.png`（`-tab-<タブ>-full.png` はタブ全体、`-<タブ>-p<面>-f<例>-touched.png` は触った後、`-reset.png` は元に戻した後）。幅 320px は `-w320-`。
  - 見比べ: `cmp/*.png`（左が変更前、右が変更後）。

## 先に結論

- 必ず守る文書（GAME-007・game-structure.md の「遊び方」・DESIGN.md・GAME.md・AGENTS.md）の明文に新しく反する所は見つからなかった。重なり・面からのはみ出し・元に戻した後にボタンが残る所は、11ゲームのどの面でも無かった。ブラウザのエラーも無かった。
- 変更で新しく生じた問題は、主に元に戻すボタンの置き場所（例が2つある面）と、ゴールの見せ直すボタンの置き場所がゲームの作りと食い違う所。どちらも大原則 H1（一流の商用の出来）に関わる。H8 の欠け・重なりには当たらない。
- 変更の狙い（2つの例のうち片方だけを戻すボタンに見せない）は、例が2つある面を持つ9ゲーム（マインスイーパーとパーキングジャム以外）のどれでもまだ届いていない。右上の角でも例の下でも、ボタンは右の例か上の例のすぐ横に来る。

## 11ゲームに共通

### C1. ゴールの見せ直すボタンの置き場所がゲームごとにそろわない（変更で生じた・部品の説明とゲームの作りの食い違い）

- `HowToPlayGoalFrame` は「ボタンの右端を列の右端（下のチュートリアルの入口の右端）にそろえ、どのゲームでも同じ所に置く」と変わった。しかしスマートフォンでそうなったのはマインスイーパーとスライドパズルだけ（ボタン x=338〜374。チュートリアルの入口の右端 374 と一致）。
- ほかの9ゲームは、これまでどおり盤面の右端にある。例: バイナリパズル・ナンプレ・ブリッジ・パーキング・アイスフロア・一筆・リフレクションは 299〜335、ウォーターソートは 290〜326、詰将棋は 334〜370。チュートリアルの入口の右端は 374。
- 原因: 9ゲームの `GoalPlayback` は、`HowToPlayGoalFrame` を幅を決めない div（CSS 変数や `goalSizeStyle` だけを持つ）で包んでいる。この div が層の `flex justify-center` の中で中身の幅に縮むので、`w-full` が盤面の幅になる。マインスイーパーとスライドパズル（と魔方陣）は枠を直接返しているので、列いっぱいに広がる。
- PC では列の幅が盤面の幅と同じなので、どのゲームでも差は出ない。
- 再現: iPhone 13 で各ゲームの遊び方を開き、ゴールの再生が終わるのを待つ。
- 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/common-goal-after-phone.png（上の段: バイナリ・マインスイーパー・スライド・ナンプレ）、/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/minesweeper-phone-goal.png

### C2. メニューの図の一文の区切り（変更で生じた・基本の形「文」から外れる）

- 新しい一文「画面の右上の/「…」から/選べます。」は、「の」で名詞にかかる語と名詞の間（右上の/「…」）に `/` を置いている。SKILL.md の「文」にある「「の」で名詞にかかる語と名詞の間には `/` を置かない」から外れる。基本の形なので必ず守るものではないが、共通の部品の中の文なので11ゲームすべてに出る。
- 一文の中身は正しい。11ゲームとも、プレイ画面の「…」はスマートフォン（x=330〜378, y=36〜76）でも PC（x=1220〜1268）でも右上にある。
- 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/nanpure-phone-menu.png、/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/w320-menu.png、プレイ画面は /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/shots/<game>/play-phone.png・play-pc.png、位置の値は /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/play-menu.json

### C3. 例が2つある面の元に戻すボタン（ゲームごとの節で面を挙げる）

例が2つある面では、ボタンが言葉の行の右に来なくなり、右上の角か例の下に置かれるようになった。その結果は次の4つの形で出る。

- C3-a 横に並べた対（変更前からある）: 右上の角のボタンは右の例の盤面の右 8〜21px に、例の下のボタンは右の例の真下に来る。左の例を触ると、触っていない右の例の横にボタンが出る。変更前も右の例の言葉の横だったので、場所は変わったが同じ問題が残っている。
- C3-b 縦に積んだ対で、盤面が面の右端まで届かない面（変更で生じた）: 右上の角は上の例のすぐ右横になる。下の例を触ると、触っていない上の例の横にボタンが出る。変更前は逆で、上の例を触ると下の例の言葉の横に出ていた。向きが入れ替わった。
- C3-c 縦に積んだ対で、面が画面より高い面（変更で生じた）: スライドパズルは 656px、詰将棋は 873〜937px ある。iPhone 13 で送れる高さは約 564px しかない。下の例が見える所まで送って触ると、ボタンは画面の外（上）に出て見えない。変更前は、上の例を触ったときに画面の外（下）に出ていた。
- C3-d 例の下に置く面（変更で生じた）: ボタンの分の 48px をいつも取る。触る前は、下の余白が 68px（判定のわけの行 20px と 48px）で上が 32px の、空いた帯になる。変更前に言葉の行の右だった面は、面が 36px 高くなった。SKILL.md の「盤面の大きさ」には「余りの空きを残さない」（触ると出る言葉の場所だけは例外）とある。

### C4. そのほかの共通の変更（問題なし）

- ルールの一文が 22px/700 から 16px/600 になったことを、11ゲームのルールのタブで確かめた。崩れは無い。PC ではゴールの盤面の上端（y=168）が、右の最初の例の面の上端とそろうようになった（変更前は 178〜212 でずれていた）。
- 押せない流れの図の面が、灰色の地から縁の線になった。これは8ゲームにある。灰色の地を前提にした図は無かった（一筆とスライドは自前の地を敷き、詰将棋は木の盤）。白いマスと空のボトルも、盤の線で読める。崩れは無い。ただし面の内側が縁の 2px 分狭くなった（一筆パズルの幅 320px でだけ効く。後述）。
- 採点の行の文が 14px から 16px になった。11ゲームとも、はみ出しも重なりも無い。
- 1つの例の面（言葉の行の右・右上の角）は、ボタンが 2px と 10px 動いただけ。どれも例と言葉に重ならず、元に戻すと消える。
- 例が1つで例の下に置く面（スマートフォンのナンプレと詰将棋の操作、幅 320px の数ゲーム）は、上下の余白が 46/46px から 32/48px になった。重なりもはみ出しも無い。
- 変更前からある: 押せない流れの図が inert の箱に入っていない（詰将棋を除く7ゲーム）。中にフォーカスできる物は無いので実害は無い。SKILL.md の「押せない図」（基本の形）から外れる。

## ゲームごと

### バイナリパズル（takuzu）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（335）にあり、チュートリアルの入口の右端（374）とそろわない。
- C3-d（スマートフォン）: 「どの行にも列にも四角と丸を4つずつ置きます。」と「行どうし・列どうしはどれも違う並びにします。」の面で、下の余白が 32px から 68px になった（面は 262→298px、342→378px）。触る前は例の下に空いた帯がある。
  - 再現: iPhone 13 でルールのタブを送る。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/takuzu-phone-tab-rules.png
- C3-b（PC）: 同じ2つの面で、下の例を触ると、ボタンが上の例の右横（盤面から約 40px）に出る。
  - 再現: PC で下の例の手がかりのマスを押す。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/takuzu-pc-rules-touched.png（2段目と3段目）

変更前からあるもの:
- C3-a（スマートフォン）: 「同じタイルが続くのは縦も横も2つまでです。」で左の例を触ると、ボタンが右の例（縦の3マス）の右 12px・上の端に出る。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/shots/takuzu/after-phone-rules-p0-f0-touched.png（変更前は before-phone-rules-p0-f0-touched.png）
- 流れの図が inert でない。

### ウォーターソート（water-sort）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（326）にある。
- 注ぐ動きとボタン（スマートフォン、重なりは無い）: 「上から同じ色が重なっていれば入るだけまとめて注ぎます。」の右の対で注ぐと、傾いたボトルの口が、右上の角のボタンのすぐ左（20px 台）・同じ高さまで来る。重なりは無い。PC では離れている。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/water-sort-after-phone-pour-zoom.png（コマは /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/shots/water-sort/follow/after-phone-rules-p1-f1-*.png）

変更前からあるもの:
- C3-a（スマートフォン）: 対の3つの面（「上から同じ色が…」「1色でいっぱいになったボトルは…」「どこにも注げないボトルは…」）で、ボタンが右の対の右 12px・上に来る。左の対を触ると、触っていない右の対の横に出る。変更前は右の対の言葉の横だった。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/water-sort-phone-rules-touched.png
- 流れの図が inert でない。

### マインスイーパー（minesweeper）

変更で生じたもの:
- C1: スマートフォンでゴールのボタンが列の右端（338〜374）へ移り、盤面の右端から 39px 離れた。ほかの9ゲーム（盤面の右端のまま）と所がそろわない。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/minesweeper-phone-goal.png

ほかに問題なし（例の面はどれも例が1つで、置き場所は変わらない）。変更前からあるもの: 流れの図が inert でない。

### ナンプレ（nanpure）

変更で生じたもの: C1（ゴールのボタンが盤面の右端 335）だけ。

変更前からあるもの（変更前から右上の角）:
- スマートフォンの「どの列にも1〜9が1つずつ入ります。」で左の列を触ると、ボタンが右の列の右 35px に出る（C3-a）。
- PC の「どの行にも…」で下の行を触ると、ボタンが上の行の右 32px に出る（C3-b と同じ形）。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/nanpure-pc-touch.png
- 流れの図が inert でない。

### ブリッジパズル（bridges）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（335）にある。
- C3-d（スマートフォン）: 「島から出す橋は数字と同じ本数にします。」と「全部の島を1つにつなげます。」の面が、例の下の置き場所になった。面は 236→272px になり、触る前は下に 68px の空いた帯がある。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/bridges-phone-tab-rules.png

変更前からあるもの（C3-a）:
- スマートフォンでは、同じ2つの面のボタンが右の例の真下に来る。左の例を触っても右の例の下に出る。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/bridges-phone-touch.png
- PC では、同じ2つの面のボタンが右の盤面の右 20px に付く。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/bridges-pc-touch.png

### パーキングジャム（parking-jam）

ゲーム固有の問題なし（共通の C1・C2 だけ）。

### アイスフロア迷路（ice-floor-maze）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（335）にある。
- C3-b（スマートフォン、幅 320px も同じ）: 縦に積んだ5つの面で、下の例を触ると、触っていない上の例の盤面の右 31px にボタンが出る。5つの面は「ゴールで止まれば完成です。…」「もろい岩は…」「駒は雪に入ると…」「駒は氷の塊に…」「雪山が載ったゴールには…」。
  - 再現: iPhone 13 で、たとえば「もろい岩は…」の下の例をスワイプする。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/shots/ice-floor-maze/after-phone-rules-p4-f1-touched.png、/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/ice-floor-maze-phone-touch.png

変更前からあるもの:
- C3-a（PC）: 同じ5つの面（PC では横の対）で、ボタンが右の盤面の右 8px に付く。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/ice-floor-maze-pc-flow-touch.png（下の段）
- 流れの図が inert でない。

### 一筆パズル（hitofude-puzzle）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（335）にある。
- 幅 320px の採点の流れの図: 面の内側が縁の 2px 分狭くなった。そのため「戻して同じマスへ引く」「戻して違うマスへ引く」が「…マスへ／引く」と2行に折れ、最後の行に1文節だけが残る。面は 511→547px になる。iPhone 13 と PC では折れない。
  - 再現: 幅 320px で採点のタブの流れの図を見る。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/hitofude-w320-flow.png

変更前からあるもの:
- C3-a（スマートフォン）: 「すべてのマスを通れば完成です。」で、ボタンが右の盤面の右 21px に付く。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/hitofude-puzzle-phone-touch.png
- 流れの図が inert でない。

### スライドパズル（slide-puzzle）

変更で生じたもの:
- C1: スマートフォンでゴールのボタンが列の右端（338〜374）へ移った。ほかの9ゲームとそろわない。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/common-goal-after-phone.png（上の段の3つ目）
- C3-c（スマートフォン）: 「離れたタイルをタップすると間のタイルもスライドします。」と「左上から番号順に並んで…」の面は高さ 656px ある。下の例が見える所まで送ってタイルを押すと、ボタンは面の上端（y=44〜80）に出て、上に留めたタブの列の裏に隠れる。変更前はその例の言葉の横（y=622〜658）に見えていた。逆に上の例を触った場合は、変更前は画面の外（y=674）、変更後は見える。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/slide-puzzle-user-scroll.png（左から 変更前・上の例 / 変更後・上の例 / 変更前・下の例 / 変更後・下の例）
- C3-d（幅 320px）: 同じ2つの面が例の下の置き場所になった（656→692px、下の余白 68px）。

変更前からあるもの:
- C3-a（PC）: 同じ2つの面で、ボタンが右の盤面の右 8px に付く。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/slide-puzzle-pc-touch.png
- 流れの図が inert でない。

### 詰将棋（tsume-shogi）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（370）にある。チュートリアルの入口の右端は 374。
- C3-c（スマートフォン）: 「歩は攻方の歩が無い縦の列にだけ打てます。」「歩を打って王手をかけられるのは…」「上の2段へ動く桂馬と…」の面は 873〜937px ある。下の例が見える所まで送って持駒の歩を打つと、ボタンは y=−237 で画面の外に出る。変更前は言葉の横（y=622〜658）に見えていた。逆に上の例を触った場合は、変更前は画面の外（y=955）、変更後は見える。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/tsume-shogi-user-scroll.png（並びはスライドパズルと同じ）
- C3-d（PC、幅 320px も同じ）: 同じ3つの面が例の下の置き場所になった。面は 501→537px になり、触る前は下に 68px の空いた帯がある。ボタンは右の例の言葉の真下に来るので、左の例を触っても右の例の下に出る（C3-a も重なる）。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/tsume-shogi-pc-touch.png

変更前からあるもの: なし。流れの図は inert で、変わった所に問題は無い。

### リフレクション（reflection）

変更で生じたもの:
- C1: ゴールのボタンが盤面の右端（335）にある。
- C3-b（スマートフォン）: ルールの6つの対の面（「数字から入れた光が…」〜「ブラックホールは…」）で、下の例を触ると、触っていない上の例の右 27px にボタンが出る。
  - 再現: iPhone 13 で、たとえば最初の面の下の例の数字を押す。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/reflection-phone-touch.png
- C3-d（幅 320px）: 同じ6つの面が例の下の置き場所になった（「数字から入れた光が…」と「別の所から出る光は…」は下の余白 68px）。

変更前からあるもの:
- C3-a（PC）: 6つの面（横の対）で、ボタンが右の盤面の右 8px に付く。
  - 画像: /tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/htp-review5/others-maker/cmp/reflection-pc-touch.png

## 確かめられなかったこと

- 自動の手順で押せなかった例がある。ブリッジの左の例（手がかりが無い）、一筆の左の例、詰将棋の駒の動きの表の面、リフレクションの操作3つ目、ウォーターソートの PC の対。ボタンの置き場所は、面の大きさから面ごとに1つに決まり、どの例を触っても同じ所に出る。触れた方の例の結果と、置き場所の値から判断した。
- 詰将棋で、自動の手順（ルールの例への左右のドラッグを含む）の後に、操作のタブが押せなくなった。変更前と変更後で同じだった。同じ面を個別に触り直した手順では再現せず、原因は特定していない（変更とは関わらない）。
