---
name: design-game-pictogram-showcase
description: >
  This skill should be used when designing, prototyping, refining, or reviewing a showcase pictogram for the
  pa-zzle game selection screen: the colored and animated pictogram (hero pictogram) of the selected puzzle,
  stored as pictogram-showcase.svg. Triggers include "showcase pictogram", "colored pictogram",
  "animated pictogram", "hero pictogram", "game selection animation", "pictogram-showcase.svg",
  "選択中パズルの姿", "色付きピクトグラム". It explores color and motion from the puzzle's central action and
  solved moment, checks the receiving contract, and refines the human-selected direction into a cataloged SVG.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# design-game-pictogram-showcase

ゲーム選択画面で「選ばれたパズルの姿（色＋動き）」を見せる `pictogram-showcase.svg` を、狙いに沿って探索し、人間が選んだ方向を完成品質まで育てて配置・登録する Skill。

## 起動

`/design-game-pictogram-showcase`

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

暫定契約。ウォーターソートでの試作後に見直す前提で置く。変える場合は、アプリ側の受け口・`DESIGN.md`・この節・`scripts/check_animation.py` を同じ変更で揃える。

- **置き場所**: `frontend/src/games/<game>/assets/pictogram-showcase.svg`。ゲームごとに任意。無いゲームは白黒 `pictogram.svg` で代替表示される。
- **1 ファイル 2 役**: 1 ファイルで「色付き静止画」と「アニメ」を兼ねる。
- **座標系と土台**: `viewBox="0 0 120 120"`。白黒版を土台にし、同じパズルだと分かること。構図の調整は可、別物にしない。
- **色**: 輪郭など前景の線は `var(--game-pictogram-strong)`、補助は `var(--game-pictogram-soft)`。ライト/ダークは利用側がこの 2 変数で切り替える。ゲーム固有の色は、そのゲームのプレイ画面で実際に使っている色の値をそのまま使う（例: ウォーターソートは `frontend/src/games/water-sort/ui/board/water-bottle/get-water-color-view.ts` の水の色）。色数は制限しない。
- **静止状態**: SVG 内の基本スタイル（アニメーション指定なし）で描かれた姿が色付き静止画。下部一覧の選択中、OS の動きを減らす設定、再生しない場面ではこれが表示される。
- **再生**: アニメーションは SVG 内 `<style>` の CSS animation で書く。アニメーションを付けるセレクタは必ず祖先の `[data-pictogram-motion="play"]` を条件にし、さらに `@media (prefers-reduced-motion: no-preference)` の内側に置く。
- **継ぎ目**: 静止状態とアニメの始点・終点（ループならその継ぎ目）を同じ姿にし、再生開始・停止・ループで絵が跳ばないこと。ループか 1 回再生かは探索で比べてよい。
- **同時 2 表示**: SVG はページへインライン展開され、下部一覧の選択中とヒーローで同時に 2 つ表示されうる。`<style>` はページ全体に効くため、クラス名・keyframes 名はすべて `pz-<game-id>-` 接頭辞にし、セレクタの対象は必ず接頭辞付きクラスにする。id 参照（gradient、clipPath 等）は原則使わず、使うなら同時 2 表示で壊れないこと。
- **禁止**: script、イベント属性、外部参照、SMIL（`<animate>` など）。
- **実表示サイズの目安**: ヒーロー描画域 約 138px（スマホ）/ 約 177px（PC）、下部一覧の選択中 約 50px（スマホ）/ 約 60px（PC）。

## 入力

開始時に次を確認する。不足は推測で埋めず、ファイルから特定するか人間へ確認する。

- 対象 game id と白黒版 `frontend/src/games/<game>/assets/pictogram.svg`
- 該当パズル仕様（`docs/プロダクト/仕様/パズル/README.md` から辿る）: 中心の操作、解けた条件
- プレイ画面で使う色の定義元（`frontend/src/games/<game>/ui/` 配下を Grep で特定する）
- `DESIGN.md` の「表現の強さ」「ゲーム固有色」「ゲームを表す視覚表現」「動き」「避ける表現」
- アプリ側の受け口の現状（`frontend/src/components/GamePictogram.tsx`、`frontend/src/components/GameSelectionGallery.tsx`）

## 成果物

探索中は一時ディレクトリ（例: `/tmp/pictogram-showcase-<game>/`）に置く。

- アイデアカード群と系統の整理
- 試作候補の SVG 群と `manifest.json`（`references/review.md`）
- `scripts/check_animation.py` の検査結果
- `self-review.json`（`references/self-review.md`）
- セルフレビュー用 / 人間レビュー用ギャラリー
- 人間の方向指定の短い記録（残す A/B、使う部分、捨てる部分）

完成時はリポジトリに次を置く。

- `frontend/src/games/<game>/assets/pictogram-showcase.svg`
- `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx` への登録

候補数は成果指標にしない。

## 動作フロー

### 1. 材料を抽出する

ゲームから、色と動きの材料だけを短く列挙する。次の 2 つは必須とし、欠けたまま発散へ進まない。

- **中心の操作**（A）: プレイヤーが何を見て、何を考え、何をするか
- **解けた瞬間**（B）: 何が揃い、どう終わるか。プレイ画面で実際に起きる完了の見え方

加えて、動かせる対象、題材の物理、プレイ画面の色とその役割、白黒版が何を描いているかを拾う。詳細は `references/exploration.md`。

### 2. 静止状態と動きの仮説を広く発散する

コードを書く前に、何が起こるかが異なるアイデアカードを独立した複数回の発散で作る。各カードに次を付ける。

- `id` / `name` / `idea`（何が起こるか）
- `aim_play`（A: 中心の操作をどう見せるか）
- `aim_payoff`（B: どの瞬間の気持ちよさをどう見せるか）
- `static_pose`（静止状態はどの瞬間の姿か。一覧選択中の色付き静止画になる）
- `playback`（`loop` / `once` の仮置き）

静止状態は動きの始点・終点を兼ねるため、動きと一緒に考える。速度・角度・量だけが違う案を別案として数えない。

### 3. 狙いで束ねて試作候補を選ぶ

`aim_play` × `aim_payoff` の組み合わせで近い案を束ね、各系統から代表を選ぶ。見た目の動作が似ていても A の伝え方や B の見せ場が違えば残す。モデル自身の「良さそう」という予測だけで絞らず、系統の多様性を優先する。

### 4. 代表候補を低コストで試作する

各代表を、A と B の核が人間に伝わるところまで実装する。初回から細部を完成品質まで詰めない。

- 白黒版の SVG を複製して始め、受け口の契約を最初から守る
- 静止状態を先に描き、白黒版と並べて同じパズルだと分かることを確かめてから動きを足す
- ゲーム固有色はプレイ画面の定義元から値をそのまま写す
- SVG 内の transform は `transform-box: fill-box` と `transform-origin` を明示する

`manifest.json` は `references/review.md` の形式で作る。白黒版を `base_pictogram` に指定する。

### 5. 契約と技術的な破綻を自動検査する

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/check_animation.py \
  --manifest path/to/manifest.json
```

viewBox、接頭辞、セレクタの漏れ、再生条件（祖先の `[data-pictogram-motion="play"]` と reduced-motion の両方）、禁止要素、使える CSS 変数を決定論的に検査する。A/B/C/D や継ぎ目の一致は判定しない。`PASS` は人間へ提示できる品質を意味しない。

### 6. セルフレビュー用ギャラリーを作る

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py \
  --manifest path/to/manifest.json \
  --audience self \
  --output /tmp/pictogram-showcase-self-review.html
```

各候補をヒーローサイズで再生、一覧選択中サイズで静止、ライト/ダーク両方で同じ文書内に並べる。`--game-pictogram-strong` / `--game-pictogram-soft` と背景は `frontend/styles/globals.css` の値を与える。時刻スライダーと再生属性の切り替えで、始点・終点・継ぎ目を確認できる。

### 7. 人間に見せる前にセルフレビューゲートを通す

実ブラウザで全候補を `references/self-review.md` のチェックリストに沿ってレビューし、`self-review.json` に記録する。A → B → C → D → 静止状態 → 継ぎ目 → 実装の順に見る。

- C が弱い候補に C 専用の演出を足さない。A/B の作り方を直して再レビューするか `reject` にする
- 開始状態や代表フレーム数枚だけで合格にしない

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/check_self_review.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json
```

この検査が PASS するまで人間へ提示しない。人間用ギャラリーは必ずセルフレビュー結果を渡して生成する。

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json \
  --audience human \
  --output /tmp/pictogram-showcase-review.html
```

### 8. 人間の方向指定を受ける

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
- 一覧選択中サイズの静止状態が、白黒版と同じパズルの色付き版として成立する
- `check_animation.py` が PASS する

仕上げ後も Step 7 のチェックを新しい記録でやり直し、全項目が `true` になるまで人間へ提示しない。採用判断は人間が行う。良い候補がなければ無理に収束させず発散へ戻る。

### 11. 配置してカタログへ登録する

人間が採用を決めた後に行う。

1. 採用 SVG を `frontend/src/games/<game>/assets/pictogram-showcase.svg` に置き、配置先で再検査する。

   ```sh
   python3 .claude/skills/design-game-pictogram-showcase/scripts/check_animation.py \
     --game-id <game> frontend/src/games/<game>/assets/pictogram-showcase.svg
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
4. 実アプリのパズル選択画面で、ヒーロー（スマホ/PC）、下部一覧の選択中、ライト/ダーク、動きを減らす設定、ゲームの切り替えを確認する。画面の起動と確認手順は `/run` または `docs/メモ/ChatGPT画面確認.md` に従う。

## 出力先

- 探索中の候補・manifest・記録・ギャラリー: 一時ディレクトリ
- 完成 SVG: `frontend/src/games/<game>/assets/pictogram-showcase.svg`
- 登録: `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx`

Skill 配下には特定ゲームの生成物を保存しない。再利用する手順、検査、比較手段だけを置く。

## 参照する正本

- `references/exploration.md` — 材料抽出、発散、束ね方、試作の削り方、再発散の条件
- `references/review.md` — manifest 形式、ギャラリーで見るもの、人間レビューの問い方
- `references/self-review.md` — 人間提示前の必須チェックリストと `self-review.json`
- `scripts/check_animation.py` — 受け口の契約と技術的破綻の決定論的検査
- `scripts/make_review_gallery.py` — セルフレビュー / 人間レビュー用ギャラリー生成
- `scripts/check_self_review.py` — セルフレビュー記録の品質ゲート検査
- `.claude/skills/design-game-pictogram/` — 白黒ピクトグラムの設計・検証
- `DESIGN.md` — 視覚・動きの正本。色の正確な値は `frontend/styles/globals.css`
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
