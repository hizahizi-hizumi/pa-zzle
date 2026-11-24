# design-game-pictogram-showcase の報告（魔方陣、/add-puzzle から・直し）

`showcase-pictogram-reviewer` の所見のうち、採った案 `last-tablet` の non-blocking 3件を直した。`row-by-row` は変えていない（`round1/row-by-row.svg` と同じ）。

## 仮採用

- `frontend/src/games/magic-square/assets/pictogram-showcase.svg`（worktree）= 候補 `last-tablet`「最後の一枚でそろう」（cut、周期 5200ms）
- 登録: `frontend/src/app/game-integration/magic-square/magic-square-catalog-entry.tsx` で `?raw` import し、`pictogramShowcaseSvg` に渡している（変更なし）
- `check_animation.py`: PASS。`verify.sh`: PASS

## 直したこと（`last-tablet`）

1. 持ち上げた札の大きさ: 1.3 倍を 1.4 倍にした。上端が y 18.55 から y 17.4 に上がり、枠の外縁（y 18）を越える。札が見えきった 1010ms 以降は、枠の太線が札の上の縁に細く残らない
2. 札の影の色: rgba(43,39,34,0.3) を、プレイ画面で置いた数の札に付く影と同じ rgba(43,39,34,0.38) にした（`tone.tabletShadow`）。`row-by-row` は今の値のまま
3. 縦の列と斜め:
   - マスを選んだ間の薄い色を、選んだマスを通る行と縦の列の両方に付けた。交わるマスを二重に塗らないよう、1つの形（`M12 20h78v26H64v52H38V46H12Z`）で塗る。行の合計の後ろの薄い色は今のまま
   - そろった後のなぞりの光を、プレイ画面のクリアと同じ3段にした。行（1450ms〜、左から右）、縦の列（1800ms〜、上から下）、斜め（2150ms〜、2本の斜めを上から下）の順で、各段の中は 90ms ずつずらす。盤全体の光は 2700ms
   - 光と薄い色は、動いている間だけ出る。止まった姿は変えていない
4. 周期: 4800ms を 5200ms にした。見せ場まで約 3.2 秒、止まり 1990ms、開始の間 300ms、静止の割合 0.44 で、どれも `references/motion.md` の目安の内

## 作業物（作業ディレクトリ）

- 探索一式: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/pictogram-showcase/`
  - `manifest.json`: `last-tablet` の hypothesis・aim_payoff・notes を直した内容に書き直した
  - 候補: `last-tablet.svg`・`row-by-row.svg`
  - 生成スクリプト: `gen.mjs`。字形が白黒版の path と一致することを照合してから書き出す
  - 1回目のもの: `round1/`
  - 観察の報告: `observe/`（ログは `observe-07.log`）
  - コマ撮り: `frames/`（ライト/ダーク）と `frames-zoom/last-tablet-light.png`。`frames-zoom` は 1400〜3300ms を 50ms ごとに撮った
  - 実時間の連続画像: `realtime/last-tablet-sheet.png`。周の境界を2回またぐ
  - セルフレビュー: `self-review.html`、`self-review.json`
  - 人間用ギャラリー: `review-human.html`
  - DPR 3 で止めて撮るスクリプト: `frame3x.cjs`
- DPR 3 の静止画と実アプリの画像: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/shots/07/`
- 導入調査へ移すもの: `/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/ピクトグラム検討/選んでいるときの姿/`（last-tablet.svg・manifest・self-review・人間用ギャラリーを新しいものに差し替えた）

## 候補

静止状態は2案とも同じ。白黒版の形のまま、角と真ん中は盤の面に刻んだ数、残りの4マスは置いた札、行の合計は緑の 15。

- `last-tablet`「最後の一枚でそろう」（推奨・仮採用）
  - 上の行だけ合計が 6 で、真ん中のマスが空いた盤から始まる
  - そのマスを選ぶと、行と縦の列と行の合計に薄い色が付く
  - 9 の札が枠より上まで持ち上がった姿から、落ちてくぼみに収まる
  - 合計が 15 の緑に変わり、3つの 15 が一緒に弾む
  - 光が行・縦の列・斜めの順になぞり、盤全体が一度光って止まる
- `row-by-row`「順に置いて行がそろう」
  - 辺の4マスが空いた盤（合計 6・5・14）から始まる
  - 上・左・右・下の順に札が落ち、置くたびに行の合計が増える（6→15、5→8→15、14→15）
  - 15 に届いた行から緑になって弾み、最後に盤全体が光る

## 推奨と理由

推奨は `last-tablet`。

- A: ほかの行はもう緑の 15 の中で、上の行だけが 6 で、空いたマスが選ばれる。「足りない数を考えて、その札を置く」が1手で読める
- B: プレイ画面のクリアの演出（行・縦の列・斜めをなぞる光、合計の弾み、盤全体の光）がそのまま見せ場になり、遊んだ人の記憶と結び付く。縦の列の薄い色となぞりの光で、行だけでなく縦と斜めもそろえる遊びだと見える
- D: 動くのは札1枚と光だけで、4枚が続けて落ちる `row-by-row` より落ち着いている

`row-by-row` の負けどころ: 合計が数え上がって 15 に届く算数の流れは最もよく伝わる。ただ、2秒あまりで札が4枚落ち、見せ場が行ごとの小さな弾み3つに分かれる。

## 決めたこと

- 持ち上げた札の大きさ:
  - 決めた内容: 1.4 倍にし、上端を枠の外縁より上に出した
  - 理由: 枠の内に収まる大きさに抑えると、持ち上げた札がマスの大きさに近づき、置く前と置いた後の違いが読みにくくなる
  - 覆すと: `gen.mjs` の `lift` を変え、DPR 3 の静止画を撮り直す
- なぞりの光の段の間隔:
  - 決めた内容: 350ms
  - 理由: 3段を目安の周期に収めながら、各段が前の段と重なりすぎない間隔にした
  - 覆すと: `SWEEPS` を変え、`observe`・コマ撮りを撮り直す
- 縦の列の薄い色:
  - 決めた内容: 行と合わせた1つの形で塗る
  - 理由: 交わるマスを二重に塗ると、そのマスだけ濃くなる
  - 覆すと: 帯の path を変える
- そのほか（静止状態の面と数の色、字形、ダークの合計の色、持ち上げた札が線と枠に重なること、合計の弾み方）は、前の報告から変えていない
  - 盤の面（`slab`）を盤全体に、置いた札（`tablet`）を辺の4マスに、線の下へ線まで敷いた
  - 数は、刻んだ数を `givenInk`、札の数を `placedInk` にした
  - ダークでは、盤の外の合計だけを明るい段に代えた（そろった合計 #2f7a4b→#4f9e6b、そろっていない合計 #5a544b→#a39b8c）

## 確かめたこと

- `check_animation.py --playback cut`: 2案とも PASS
- `observe_animation.cjs`（`--pixels --filmstrip --webkit`、clearance 付き）: 2案とも PASS
  - ライト/ダークとも、周の終わりが静止状態と一致した
  - 動きを減らす設定では、アニメーション 0 件で差分 0
  - `cut` の切り替え3回とも、途中のフレームは 0
  - `last-tablet` の数値: 止まり 1990ms、開始の間 300ms、静止の割合 0.44、アプリの再生の入口 4600ms、viewBox の余白は最小 4.55、合計と枠の間は最小 1.08
  - 1720ms の速度の急変の WARN は、合計が弾み始める動き（プレイ画面のクリアと同じ弾み方）
- `check_self_review.py`: PASS（2 pass）
- `check_gallery.cjs --device "iPhone 13"`（`review-human.html`）: PASS。2候補のヒーローが動く
- `capture_frames.cjs` の `frames-zoom/last-tablet-light.png`（1400〜3300ms、50ms ごと）を見た [確認済み]
  - 光が行を左から右へなぞる
  - 続いて縦の列を上から下へなぞる
  - 続いて2本の斜めを上から下へなぞる（四隅の2マス → 真ん中 → 下の2マス）
  - 2700ms から盤全体が光る
  - 3300ms は静止状態と同じ姿
- DPR 3・177px の静止画（`shots/07/`）[確認済み]
  - 1030・1050・1150ms（`lift-hover-light-3x.png`）と 1100・1200ms（`lift-light-3x.png`、ダークは `lift-dark-3x.png`）: 札の上端が枠の外縁を越えるか外縁にそろい、札の上の縁に枠の線が残らない。1100ms で札の列の色を縦に拾うと、上端から下まで札の面の色 (244,240,232) だけだった（`lift-app-svg-1100.png`）
  - 1.3 倍との比較: `lift-round1-light-3x.png`
  - 950〜1010ms: 札が 60ms かけて現れる間は半透明で、枠がうっすら透ける（`lift-light-3x.png` の 1000ms）
  - 1250〜1300ms: 落ちる途中で、札の上端が枠の線を横切る。どちらも一瞬で、札が盤に収まっていく途中の姿
- 実アプリ（開発サーバー、iPhone 13 の大きさ、ライト）[確認済み]
  - 画像は `shots/07/app-light/` と、その抜粋 `shots/07/app-light-select-sheet.png`
  - ホームで魔方陣を選ぶと、上の行と真ん中の縦の列に薄い色が付き、9 の札が枠の上まで持ち上がってから落ちる。光は行・縦の列・斜めの順に走る
  - 最後に遊んだゲームとしてタイトルを閉じた直後も動く
  - 動きを減らす設定（`shots/07/app-reduce/`、抜粋 `shots/07/app-reduce-sheet.png`）では、アニメーション 0 件で静止状態のまま
  - `pageerror`・`console.error` はなし

## 確かめていないこと

- WebKit（Safari、iOS の Claude アプリ）: この環境では WebKit を起動できず、未確認
- ダークの見え方（明るい石の盤が暗い地で浮く）: アプリが今ダーク表示に切り替えないので、確かめる範囲から外し、`notes` に残した。ダークのコマ撮りと DPR 3 の静止画では、合計・札・光とも読めている

## 人間に残す候補

- 方向の選択（`last-tablet` / `row-by-row`、または組み合わせ）。人間用ギャラリーは `pictogram-showcase/review-human.html`
- `row-by-row` を選んだときは、レビューの所見（下の札の影のはみ出し、枠の覆い、等間隔で考える拍が無い、影の色、行だけ）を直す
- アプリがダーク表示に切り替わるようになったら、明るい石の盤が浮く重さを見直す
- 白黒版の方向が変わったら、静止状態の図形を写し直し、自己チェックからやり直す
