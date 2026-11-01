# 受け口の契約

`pictogram-showcase.svg` をアプリへ渡すための書き方の規則。アプリ側の受け口（`frontend/src/components/GamePictogram.tsx`、`GameSelectionGallery.tsx`）がこの形を前提に表示する。機械的に確かめられる規則は `scripts/check_animation.py` が `FAIL` / `WARN` にするので、違反の詳細はその出力で確かめる。

契約の変更は人間の判断で、この Skill の外で行う。変える場合は、アプリ側の受け口・`DESIGN.md`・`docs/adr/ADR-0004-selected-pictogram-color-motion.md`・この文書・`scripts/` の検査とギャラリーを同じ変更で揃える。

## 1. ファイルと座標系

- 置き場所は `frontend/src/games/<game>/assets/pictogram-showcase.svg`。無いゲームは白黒 `pictogram.svg` が代わりに表示される。
- 1 ファイルで「色付き静止画」と「動き」を兼ねる。ルートは `<svg>`、`viewBox="0 0 120 120"`。
- 白黒版と同じ構成要素・枠組み・視点を保つ。盤の中身はゲームで起こりうる状態なら白黒版と違ってよい。構図の調整の範囲は `references/motion.md` の 4 節。

## 2. 静止状態と再生

- アニメーション指定の無い基本スタイルで描かれた姿が静止状態。一覧の選択中と、OS の動きを減らす設定ではこれが表示される。
- animation は SVG 内 `<style>` の CSS animation で書く。animation を付けるルールは `@media (prefers-reduced-motion: no-preference)` の内側に置き、祖先の `[data-pictogram-motion="play"]` を条件にする（例: `[data-pictogram-motion="play"] .pz-<game>-x { animation: … }`）。この属性はアプリがヒーローの祖先に付ける。SVG 自身や対象には付けない。
- 全 animation を `infinite` にする。再生形式は `cut`（基本）か `seam`（例外）。`cut` は全 animation を同じ周期・同じ遅延にする。作り方は `references/motion.md` の 1 節。

## 3. 色

- 輪郭など前景の線は `var(--game-pictogram-strong)`、補助は `var(--game-pictogram-soft)`。ライト/ダークはアプリがこの 2 変数で切り替える。
- それ以外は、そのゲームのプレイ画面が使っている色をそのまま使う。
  - プレイ画面がアプリのトークン（`bg-card` など）で塗っている要素は、同じトークンを `var(--card)` のように参照する。参照できるトークンは `check_animation.py` の許可リストにある。
  - Tailwind のパレット色や TS/CSS の定数は実値を hex か `rgb()` で書く。値は `scripts/resolve_color.py` で引く。
  - テーマで値が変わる色は、祖先 `.dark` を条件にしたルール（`.dark .pz-<game>-x { fill: … }`）で色だけを切り替える。keyframes で動かす色は、`.dark` で切り替える `--pz-<game>-*` 変数を keyframes から参照する。`prefers-color-scheme` は使わない。
- プレイ画面の値のままでは実表示サイズで背景に溶ける線・面は、見えることを優先して近い役割の色（同じ要素の一段濃い段など）で代え、理由を manifest の `notes` に書く。ライト/ダークの両方で確かめる。
- 定義元の調べ方は `references/exploration.md` の 1 節。

## 4. 同時 2 表示

SVG はページへインライン展開され、一覧の選択中とヒーローで同時に 2 つ表示される。`<style>` はページ全体に効く。

- クラス名・keyframes 名・id は `pz-<game>-`、独自変数は `--pz-<game>-` 接頭辞にする。セレクタの対象は接頭辞付きクラスにする。
- id 参照（gradient、clipPath など）は避ける。使うなら同時 2 表示で壊れないことをセルフレビューで確かめる。

## 5. 文字

- 数字・記号は白黒版の字形（パス）を流用する。無い字形は `<text>` で書き、`font-family` にシステムの sans-serif 系を明示する。

## 6. 使わないもの

script・外部参照・SMIL・`transition`・`foreignObject` / `image`・`d` の CSS アニメーション。古い WebKit が解釈しない記法（`oklch()` などのリテラル色、`color-mix()`、入れ子の CSS）も避ける（`references/motion.md` の 6 節）。
