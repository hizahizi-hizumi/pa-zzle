---
name: design-game-pictogram-showcase
description: >
  This skill should be used when designing, refining, or reviewing the showcase pictogram of the pa-zzle game
  selection screen: the colored, animated pictogram of the selected puzzle. Triggers include
  "showcase pictogram", "hero pictogram", "colored pictogram", "animated pictogram", "pictogram animation",
  "pictogramShowcaseSvg", "pictogram-showcase.svg", "選択中パズルの姿", "色付きピクトグラム",
  "動くピクトグラム". Not for the monochrome pictogram.svg (use design-game-pictogram).
argument-hint: <game-id>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(python3 .claude/skills/design-game-pictogram-showcase/scripts/*), Bash(node .claude/skills/design-game-pictogram-showcase/scripts/*), Bash(python3 /tmp/pictogram-showcase-*), Bash(node /tmp/pictogram-showcase-*), Bash(bun run --cwd frontend *)
---

# design-game-pictogram-showcase

ゲーム選択画面で「選ばれたパズルの姿（色＋動き）」を見せる `pictogram-showcase.svg` を、狙いに沿って探索し、人間が選んだ方向を完成品質まで育てて配置・登録する Skill。

## 起動

`/design-game-pictogram-showcase <game-id>`

対象ゲームの game id（`frontend/src/games/<game>/` のディレクトリ名）を引数または会話 context から受け取る。

## 体験の狙い

全段の判断軸にする。評価は必ず A → B → C → D の順に行う。

- **目的 A — 遊びが分かる**: 選んだパズルで「何を考え何をする遊びか」が動きで分かる（`docs/プロダクト/要件/FR-001.md`）。
- **目的 B — 解けた気持ちよさが見える**: 解けた・揃った瞬間の気持ちよさが見え、遊びたくなる（`RQ-001`、`RQ-002` の「これからのプレイへの期待を高めたい」）。
- **合格条件 C — 選んだ手応え**: A と B を満たした演出なら、選択が即座にはっきり返る手応えは自然に生まれる。生まれていなければ A/B の作り方が誤っている合図として A/B へ戻る。C 専用の演出（選択を知らせるためだけの跳ね・光・拡縮など）を足して取り繕わない。
- **制約 D — 落ち着き**: 画面の第一印象・落ち着きを不必要に崩さない。D を狙いにはしないが、侵さない。

各段での使い方:

| 段 | A / B / C / D の扱い |
|---|---|
| 材料抽出 | A の材料「中心の操作」と B の材料「解けた瞬間」を必ず抽出する |
| 発散 | 各案に A の見せ方と B の見せ場を書く。D で発散を縛らない |
| 束ね・試作選定 | A の伝え方 × B の見せ場の組み合わせで束ね、系統の多様性を残す |
| セルフレビュー | 宣言した A/B が実表示サイズで読めるか、C が生まれているか、D を侵していないかを順に確認する |
| 人間レビュー | 人間へ A → B → C → D の順で問い、方向指定を受ける |
| 仕上げ | 微調整で A/B が消えていないか、C が保たれるか、D を侵していないかを再確認する |

## 位置づけと責務の境界

- 白黒の `pictogram.svg` は `/design-game-pictogram`（`.claude/skills/design-game-pictogram/`）の責務とし、この Skill では変更しない。未選択の一覧・結果画面は白黒のまま表示される。
- この Skill は白黒版を土台に、色付き静止画（静止状態）と再生時の動きを 1 ファイルで作る。
- 白黒版が無いゲームでは、先に `/design-game-pictogram` で白黒版を作る。
- アプリ側の受け口（`GamePictogram`、`GameSelectionGallery`、`GameCatalogEntry`）の実装と `DESIGN.md` の規則はこの Skill の成果物として変更しない。契約と食い違えば、作業を止めて人間へ報告する。

## 受け口の契約

暫定契約。ウォーターソートでの試作後に見直す前提で置く。変える場合は、アプリ側の受け口・`DESIGN.md`・`docs/adr/ADR-0004-selected-pictogram-color-motion.md`（決定そのものが変わるなら ADR を置き換える）・この節・`scripts/check_animation.py`・`scripts/observe_animation.cjs`・`scripts/check_self_review.py`・`references/motion.md`・`references/self-review.md` を同じ変更で揃える。

- **置き場所**: `frontend/src/games/<game>/assets/pictogram-showcase.svg`。ゲームごとに任意。無いゲームは白黒 `pictogram.svg` で代替表示される。
- **1 ファイル 2 役**: 1 ファイルで「色付き静止画」と「アニメ」を兼ねる。
- **座標系と土台**: ルートは `<svg>`、`viewBox="0 0 120 120"`。白黒版を土台にし、同じパズルだと分かること。別物にしない。
  - 構図を変えてよいのは、動きを描画域に収めるための縮小・配置調整と、役割の入れ替わりや比較を見せるために対象の大きさを揃えることまでとする。
  - 変えたら、白黒版と同じパズルだと分かること、一覧サイズで他ゲームのピクトグラムと並べて重量・大きさが突出せず小さすぎもしないことを確かめる（`references/motion.md`）。
- **色**: 輪郭など前景の線は `var(--game-pictogram-strong)`（必須）、補助は `var(--game-pictogram-soft)`。ライト/ダークは利用側がこの 2 変数で切り替える。ゲーム固有の色は、そのゲームのプレイ画面で実際に使っている色の値をそのまま使う（例: ウォーターソートは `frontend/src/games/water-sort/ui/board/water-bottle/get-water-color-view.ts` の水の色）。色数は制限しない。
- **テーマで変わる色**: アプリは Tailwind の `@custom-variant dark (&:is(.dark *))` により、祖先の `.dark` クラスでダークを表す（`frontend/styles/globals.css`）。プレイ画面の色がライト/ダークで変わるゲームは、SVG 内の `<style>` で祖先 `.dark` を条件にしたセレクタで色だけを切り替えてよい。
  - 書き方は、先頭の祖先 `.dark `（例: `.dark .pz-<game>-x { fill: … }`）か、`:is(.dark *)` / `:where(.dark *)`（例: `.pz-<game>-x:is(.dark *)`）に限る。再生条件と組み合わせるときは `.dark [data-pictogram-motion="play"] .pz-<game>-x` の形にする。
  - `.dark` 条件のルールに書けるのは色系プロパティ（`fill`、`stroke`、`color`、`stop-color`、`flood-color`、`lighting-color`、`opacity`、`fill-opacity`、`stroke-opacity`、`stop-opacity`、`flood-opacity`）と `--pz-<game>-` 接頭辞の変数だけとする。animation、形状、配置は切り替えない。`.dark` で切り替える変数は色系プロパティにだけ使う。
  - keyframes で色を変える要素は、keyframes の値を `var(--pz-<game>-…)` にして `.dark` 条件のルールで変数を切り替える。再生中は keyframes の値が通常のルールより優先されるため。
  - `@media (prefers-color-scheme: …)` は使わない。アプリのテーマは OS 設定ではなく `.dark` クラスで決まる。
- **静止状態**: SVG 内の基本スタイル（アニメーション指定なし）で描かれた姿が色付き静止画。下部一覧の選択中、OS の動きを減らす設定、再生しない場面ではこれが表示される。
- **再生**: アニメーションは SVG 内 `<style>` の CSS animation で書く。animation 系プロパティを書くルールは、必ず `@media (prefers-reduced-motion: no-preference)` の内側に置き、祖先の `[data-pictogram-motion="play"]` を条件にする。この `@media` 内のルールはすべてこの条件を持つ。`data-pictogram-motion` は `="play"` の祖先条件としてだけ使い、対象自身に付けず、SVG 自身にも設定しない。
- **再生形式**: 次の 3 種から選び、manifest の `playback` に書く。どれを選ぶかは探索で比べてよい（選び方と目安は `references/exploration.md` と `references/motion.md`）。
  - `once`（1 回再生）: 終点を静止状態と同じ姿にし、終了後に静止状態へ戻るとき跳ばないこと。始点は静止状態と異なってよい（ヒーローは表示と同時に再生されるため）。各 animation は 1 回だけ再生する。
  - `cut`（切り替えループ）: 100% の姿を静止状態（見せ場の姿）にし、各周の終わりにその姿で止まる区間を置く（目安 1.5〜2.5 秒）。0% は開始の姿にし、周の境界で瞬時に切り替える。CSS は周をまたいで補間しないので途中の絵は出ない。0% の後に開始の姿での短い間（目安 0.3 秒）を置く。全 animation を同じ周期・同じ遅延の `infinite` にする。
    - 切り替えを周の途中に置かない（初回の最初のフレームに見せ場の姿が出て、動き出しも遅れる）。
    - フェードや巻き戻しで開始の姿へ戻す途中経過を見せない。
  - `seam`（継ぎ目ループ）: 0% と 100% を同じ姿にし、その継ぎ目の姿を静止状態にする。全 animation を `infinite` にする。
  - 始点が静止状態と異なり `animation-delay` を使う場合は、遅延中に静止状態がちらつかないよう `animation-fill-mode: backwards` または `both` を付ける。
  - 再生途中で止まる場面（動きを減らす設定への切り替え、ゲームの切り替え、ギャラリーの再生属性の付け外し）で静止状態へ切り替わる跳びは契約の対象外とする。
- **滑らかさ**: 区間ごとの緩急は keyframe 内の `animation-timing-function` で書く。イージングを細かい線形 keyframe へサンプリングして近似しない（区間の継ぎ目で速度が不連続になり、かくついて見える）。
- **同時 2 表示**: SVG はページへインライン展開され、下部一覧の選択中とヒーローで同時に 2 つ表示されうる。`<style>` はページ全体に効くため次を守る。
  - クラス名・keyframes 名・id はすべて `pz-<game-id>-`、独自変数（カスタムプロパティ）は `--pz-<game-id>-` 接頭辞にする。`.dark` 条件を除き、セレクタに現れるクラスもすべて接頭辞付きにする。
  - セレクタの対象（最後の複合セレクタ）は必ず接頭辞付きクラスを持つ。
  - `var()` で参照できるのは `--game-pictogram-strong` / `--game-pictogram-soft` と `--pz-<game-id>-` 接頭辞の変数だけとする。
  - id 参照（gradient、clipPath 等）は原則使わない。使うなら接頭辞付き id への `#` 参照に限り、同時 2 表示で壊れないことをセルフレビューで確かめる。id の重複は不可。
- **禁止**（ここと、上の座標系・色の `--game-pictogram-strong`・テーマで変わる色・再生・再生形式の構造（回数・周期の一致）・同時 2 表示の規則は `scripts/check_animation.py` が `FAIL` にする。描画した姿の一致と見た目は検査しない）:
  - 要素: `script`、`foreignObject`、`image`、`iframe`、`video`、`audio`、SMIL（`animate`、`animateMotion`、`animateTransform`、`animateColor`、`set`、`discard`）
  - 属性: イベント属性（`on*`）、外部参照（`href` / `src` / `url()` は接頭辞付き id への `#` 参照だけ）
  - CSS: `transition`（どこでも）、`style` 属性の `animation`、keyframes 内の `animation-timing-function` 以外の animation 系（`animation` 省略形を含む）。at-rule は `@media (prefers-reduced-motion: no-preference)` 1 種と `@keyframes` だけとし、`@import`、`prefers-color-scheme` などその他の `@media`、入れ子の at-rule、ルール外の文は使わない
- **実表示サイズの目安**: ヒーロー描画域 約 138px（スマホ）/ 約 177px（PC）、下部一覧の選択中 約 50px（スマホ）/ 約 60px（PC）。

## 入力

開始時に次を確認する。不足は推測で埋めず、ファイルから特定するか人間へ確認する。

- 対象 game id と白黒版 `frontend/src/games/<game>/assets/pictogram.svg`
- 該当パズル仕様（`docs/プロダクト/仕様/パズル/README.md` から辿る）: 中心の操作、解けた条件
- プレイ画面で使う色の定義元（`frontend/src/games/<game>/ui/` 配下を Grep で特定する）。テーマで変わるか（Tailwind の `dark:` クラス等）と、ライト/ダークそれぞれの実際の値
- `DESIGN.md` の「表現の強さ」「ゲーム固有色」「ゲームを表す視覚表現」「動き」「避ける表現」
- アプリ側の受け口の現状（`frontend/src/components/GamePictogram.tsx`、`frontend/src/components/GameSelectionGallery.tsx`）

## 成果物

探索中は一時ディレクトリ（例: `/tmp/pictogram-showcase-<game>/`）に置く。

- アイデアカード群と系統の整理
- 試作候補の SVG 群と `manifest.json`（`references/review.md`）
- `scripts/check_animation.py` の検査結果
- `self-review.json`（`references/self-review.md`）
- `observe_animation.cjs` の報告（`observe-report.json`）
- セルフレビュー用 / 人間レビュー用ギャラリー
- 人間のレビュー結果（判定とメモ）と方向指定の短い記録（残す A/B、使う部分、捨てる部分）

完成時はリポジトリに次を置く。

- `frontend/src/games/<game>/assets/pictogram-showcase.svg`
- `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx` への登録

候補数は成果指標にしない。

## 動作フロー

### 1. 材料を抽出する

ゲームから、色と動きの材料だけを短く列挙する。次の 2 つは必須とし、欠けたまま発散へ進まない。

- **中心の操作**（A）: プレイヤーが何を見て、何を考え、何をするか
- **解けた瞬間**（B）: 何が揃い、どう終わるか。プレイ画面で実際に起きる完了の見え方

加えて、動かせる対象、題材の物理、プレイ画面の色とその役割、白黒版が何を描いているかを拾う。プレイ画面の色は定義元を確認し、テーマで変わるか（Tailwind の `dark:` クラス等）と実際の値を確かめる。詳細は `references/exploration.md`。

### 2. 静止状態と動きの仮説を広く発散する

コードを書く前に、何が起こるかが異なるアイデアカードを独立した複数回の発散で作る。各カードに次を付ける。

- `id` / `name` / `idea`（何が起こるか）
- `aim_play`（A: 中心の操作をどう見せるか）
- `aim_payoff`（B: どの瞬間の気持ちよさをどう見せるか）
- `static_pose`（静止状態はどの瞬間の姿か。一覧選択中の色付き静止画になる）
- `playback`（`once` / `cut` / `seam` の仮置き。まず `once` か `cut` を検討し、`seam` は継ぎ目が意味として自然に成立する場合だけにする。`references/exploration.md`）

静止状態は 1 回再生の終点・切り替えループの止まり・継ぎ目ループの継ぎ目を兼ねるため、動きと一緒に考える。速度・角度・量だけが違う案を別案として数えない。

### 3. 狙いで束ねて試作候補を選ぶ

`aim_play` × `aim_payoff` の組み合わせで近い案を束ね、各系統から代表を選ぶ。見た目の動作が似ていても A の伝え方や B の見せ場が違えば残す。モデル自身の「良さそう」という予測だけで絞らず、系統の多様性を優先する。

### 4. 代表候補を低コストで試作する

各代表を、A と B の核が人間に伝わるところまで実装する。初回から細部を完成品質まで詰めない。

- 白黒版の SVG を複製して始め、受け口の契約を最初から守る
- 静止状態を先に描き、白黒版と並べて同じパズルだと分かることを確かめてから動きを足す
- ゲーム固有色はプレイ画面の定義元から値をそのまま写す。テーマで変わる色は祖先 `.dark` 条件のルールでダーク側の値へ切り替える
- SVG 内の transform は `transform-box: fill-box` と `transform-origin` を明示する
- keyframe は姿が変わる点だけに置き、区間ごとの緩急を `animation-timing-function` で付ける。周期と静止の割合は `references/motion.md` の目安から始める

`manifest.json` は `references/review.md` の形式で作る。白黒版を `base_pictogram` に指定する。

### 5. 契約と技術的な破綻を自動検査する

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/check_animation.py \
  --manifest path/to/manifest.json
```

受け口の契約のうち、viewBox、接頭辞、セレクタの漏れ、再生条件（祖先の `[data-pictogram-motion="play"]` と reduced-motion の両方）、`.dark` 条件で色以外を切り替えていないこと、禁止要素・属性・CSS、使える CSS 変数、再生形式の構造（`once` は 1 回、`cut` / `seam` は `infinite`、`cut` は全 animation が同じ周期・遅延）を決定論的に検査し、違反を `FAIL` にする。次は `WARN` にする。

- `animation-delay` があるのに `animation-fill-mode` が `backwards` / `both` でない
- 多数の keyframe に `animation-timing-function` が無い（線形サンプリングの疑い）
- 書かれた keyframe から読める範囲で、`cut` の止まりが目安外・開始の間が無い・0% と 100% が同じ、`seam` の 0% と 100% が異なる

A/B/C/D、描画した終点・止まり・継ぎ目と静止状態の一致、遅延中のちらつきの有無は判定しない（Step 7 の `observe_animation.cjs` で測る）。`PASS` は人間へ提示できる品質を意味しない。

### 6. セルフレビュー用ギャラリーを作る

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py \
  --manifest path/to/manifest.json \
  --audience self \
  --output /tmp/pictogram-showcase-<game>/self-review.html
```

候補ごとに隔離した iframe の中で、ヒーローサイズの再生、一覧選択中サイズの静止、他ゲームの白黒ピクトグラムとの比較列を、ライト/ダーク両方で並べる。`--game-pictogram-strong` / `--game-pictogram-soft` と背景は `frontend/styles/globals.css` の値を与え、ダーク側はアプリと同じく祖先に `.dark` クラスを付ける。時刻スライダー（最大値は周期 - 1ms）で終点・止まり・継ぎ目を止め、再生属性の切り替えで静止状態と見比べられる。

### 7. 人間に見せる前にセルフレビューゲートを通す

実ブラウザで全候補を `references/self-review.md` のチェックリストに沿ってレビューし、`self-review.json` に記録する。A → B → C → D → 静止状態 → 継ぎ目 → 実装の順に見る。

- C が弱い候補に C 専用の演出を足さない。A/B の作り方を直して再レビューするか `reject` にする
- 開始状態や代表フレーム数枚だけで合格にしない

まず観察スクリプトで、描画した姿を数値で確かめる（Claude Code 環境）。

```sh
node .claude/skills/design-game-pictogram-showcase/scripts/observe_animation.cjs \
  --manifest path/to/manifest.json --out /tmp/pictogram-showcase-<game>/observe --pixels
```

候補を 1 つずつ単独ページに実表示サイズで描画し、静止状態と終点（`once`）・止まり（`cut`）・継ぎ目（`seam`）の computed style 比較、`cut` の切り替え前後の実フレームと途中フレーム数、動きを減らす設定での静止、viewBox からのはみ出し、`pageerror` / `console.error` を報告し、違反があれば終了コード 1 を返す。報告の読み方は `references/self-review.md`。

そのうえで、ギャラリーを実ブラウザで見て狙いと見た目をレビューする。

- Claude Code 環境: 追加の観察が要れば `/tmp/pictogram-showcase-<game>/` に Node スクリプトを書き、`node /tmp/pictogram-showcase-<game>/<script>.cjs` で実行する。`require('playwright')` の `chromium.launch()` でギャラリーを開き、`pageerror` / `console.error` を記録し、スクリーンショットを撮る。動きを減らす設定は `page.emulateMedia({ reducedMotion: 'reduce' })` で再現する。
- ChatGPT 環境: `docs/メモ/ChatGPT画面確認.md` と `scripts/chatgpt_playwright.py` に従い、`observe_animation.cjs` が報告する観察項目（`references/self-review.md`）も同じ手段で確かめる。

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/check_self_review.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json
```

この検査が PASS するまで人間へ提示しない。

### 8. 人間の方向指定を受ける

人間用ギャラリーは必ずセルフレビュー結果を渡して生成する。`pass` の候補だけが載る。

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json \
  --audience human \
  [--db-doc <game>-round<N>] \
  --output /tmp/pictogram-showcase-<game>/review-human.html
```

外部参照のない単体 HTML で、スマホを含む手元の端末で見られるモバイル優先の 1 カラムにする。候補ごとにヒーロー（再生）と一覧の選択中（静止）を実表示サイズで、一覧の選択中を他ゲームの白黒ピクトグラムと並べて見せ、判定（候補 / 掘る / 一部 / 除外）とメモ、最下部に全体メモを置く。

人間は手元の端末でギャラリーを見る。受け渡しは環境で分ける（詳細は `references/review.md`）。

- Claude アプリ環境（artifact を公開できる）: `--db-doc` 付きで生成し、artifact として公開して db capability を宣言する。判定とメモは artifact の DB の `reviews/<id>` に保存されるので、そこから読み取る。
- それ以外: `--db-doc` なしで生成した HTML を渡し、ギャラリーの「レビューJSON」で書き出した JSON を受け取る。

どちらでも、受け取った判定とメモを一時ディレクトリに記録し、次の回の入力にする。

人間へは点数を求めず、A → B → C → D の順に問う（問い方は `references/review.md`）。次のような判断を受け取る。

- この候補をベースにしたい / この系統をもっと掘りたい
- この候補の一部分だけ使いたい（例: 「A の静止状態 + B の最後の間」）
- この方向は捨てる

C が弱いという指摘は、A/B の見直し指示として扱う。

### 9. 選ばれた方向だけを再発散する

選択理由（残す A と B）を保ったまま、間、軌道、反応順、誇張の強さ、終わり方、静止状態の瞬間、色の置き方など、良くなる可能性がある差分だけを少数案へ分岐する。新しい方向が必要と分かった場合だけ探索を広げ直す。

### 10. 仕上げて再レビューする

最終候補を実表示サイズで詰める。

- 選ばれた A/B の核が微調整で消えていない
- C が生まれたままで、C 専用の演出を足していない
- D を侵していない（常時の大きな動き、強い点滅、画面の他要素より強い主張がない）
- 動きが滑らかでかくつかない（区間ごとのイージング。線形サンプリングで近似していない）
- 一覧選択中サイズの静止状態が、白黒版と同じパズルの色付き版として成立する
- `check_animation.py` が PASS する

仕上げ後も Step 7 のチェックを新しい記録でやり直し、全項目が `true` になるまで人間へ提示しない。採用判断は人間が行う。良い候補がなければ無理に収束させず発散へ戻る。

### 11. 配置してカタログへ登録する

人間が採用を決めた後に行う。

1. 採用 SVG を `frontend/src/games/<game>/assets/pictogram-showcase.svg` に置き、配置先で再検査する。

   ```sh
   python3 .claude/skills/design-game-pictogram-showcase/scripts/check_animation.py \
     --game-id <game> --playback <once|cut|seam> frontend/src/games/<game>/assets/pictogram-showcase.svg
   ```

2. `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx` で `?raw` import し、`pictogramShowcaseSvg` に渡す。

   ```tsx
   import pictogramShowcaseSvg from "@/games/<game>/assets/pictogram-showcase.svg?raw";
   // ...
   export const <gameCamel>CatalogEntry = {
     // ...
     pictogramSvg,
     pictogramShowcaseSvg,
     // ...
   } satisfies GameCatalogEntry;
   ```

   `GameCatalogEntry` に `pictogramShowcaseSvg` が無ければ受け口が未実装なので、登録せず人間へ報告する。
3. `bun run --cwd frontend check`、`bun run --cwd frontend typecheck`、`bun run --cwd frontend test` を実行する。
4. 実アプリのパズル選択画面で、ヒーロー（スマホ/PC）、下部一覧の選択中、ライト/ダーク、動きを減らす設定、ゲームの切り替えを確認する。画面は `bun run --cwd frontend dev` で起動し、Step 7 と同じ手段（Claude Code 環境は Node の Playwright、ChatGPT 環境は `docs/メモ/ChatGPT画面確認.md`）で確認する。

## 出力先

- 探索中の候補・manifest・記録・ギャラリー: 一時ディレクトリ
- 完成 SVG: `frontend/src/games/<game>/assets/pictogram-showcase.svg`
- 登録: `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx`

Skill 配下には特定ゲームの生成物を保存しない。再利用する手順、検査、比較手段だけを置く。

## 参照する正本

- `references/exploration.md` — 材料抽出、発散、再生形式の選び方、束ね方、試作の削り方、再発散の条件
- `references/motion.md` — 再生形式の作り方、周期と静止の割合、イージング、構図を変えてよい範囲
- `references/review.md` — manifest 形式、ギャラリーで見るもの、人間レビューの受け渡しと問い方
- `references/self-review.md` — 人間提示前の観察方法、必須チェックリストと `self-review.json`
- `scripts/check_animation.py` — 受け口の契約と技術的破綻の決定論的検査
- `scripts/observe_animation.cjs` — 実ブラウザでの静止状態・切り替え・reduced motion・はみ出しの観察
- `scripts/make_review_gallery.py` — セルフレビュー / 人間レビュー用ギャラリー生成
- `scripts/check_self_review.py` — セルフレビュー記録の品質ゲート検査
- `.claude/skills/design-game-pictogram/` — 白黒ピクトグラムの設計・検証
- `DESIGN.md` — 視覚・動きの正本。色の正確な値は `frontend/styles/globals.css`
- `docs/adr/ADR-0004-selected-pictogram-color-motion.md` — 選択中だけプレイ画面の色と動きで見せる決定と理由
- `docs/プロダクト/要件/FR-001.md`、`docs/プロダクト/要求/RQ-001.md`、`docs/プロダクト/要求/RQ-002.md` — 狙いの出所

## 制約

- 白黒 `pictogram.svg`、`DESIGN.md`、アプリ側の受け口をこの Skill の成果物として変更しない
- C を満たすためだけの演出を足さない
- ゲーム固有色をプレイ画面と異なる値へ作り替えない
- 候補数を満たすための微差量産をしない
- A/B/C/D を擬似精密な点数へ還元しない。自動検査だけで採用・不採用を決めない
- `check_self_review.py` が PASS していない候補、`reject` の候補を人間へ提示しない
- 人間が選んだ方向と異なる探索へ、明示的な理由なく戻らない
- SVG 内に実装履歴や探索経緯をコメントとして残さない
