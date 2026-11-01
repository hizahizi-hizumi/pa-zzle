# 候補の比較とレビュー

`/design-game-pictogram-showcase` の試作候補を同一条件で比較し、人間の方向指定を次の探索へ渡すための形式を定義する。

## 1. manifest

比較候補は JSON manifest でまとめる。

```json
{
  "title": "Water Sort showcase exploration",
  "game_id": "water-sort",
  "base_pictogram": "/abs/path/frontend/src/games/water-sort/assets/pictogram.svg",
  "candidates": [
    {
      "id": "pour-settle-01",
      "file": "pour-settle-01.svg",
      "family": "注いで揃う",
      "hypothesis": "片方の瓶が傾き、上の色がもう片方へ移り、受け側が単色で満ちて止まる",
      "aim_play": "「同じ色の上へ注ぐ」判断と操作を 1 回で見せる",
      "aim_payoff": "受け側が単色で満ちた瞬間に動きが止まる",
      "static_pose": "揃った後の姿（1 回再生の終点）",
      "playback": "once"
    }
  ]
}
```

トップレベル:

- `game_id`（必須）: `frontend/src/games/<game>/` のディレクトリ名。接頭辞 `pz-<game_id>-` の検査に使う
- `title`（任意）: ギャラリーの見出し
- `base_pictogram`（任意、推奨）: 白黒版 SVG。ギャラリーの「基準」に同じ条件で表示する

候補の必須項目:

- `id`: manifest 内で一意な識別子
- `file`: manifest からの相対パスまたは絶対パス
- `hypothesis`: 何が起きる案か
- `aim_play`: 目的 A。中心の操作をどう見せるか
- `aim_payoff`: 目的 B。どの瞬間の気持ちよさをどう見せるか
- `static_pose`: 静止状態はどの瞬間の姿か（1 回再生の終点、ループの継ぎ目になる）
- `playback`: `loop` または `once`

任意項目:

- `family`: 同じ方向をまとめる表示名
- `notes`: 実装上の制約や比較時に残したい補足

パスは manifest からの相対パスまたは絶対パスで書く。

## 2. ギャラリーで見るもの

`make_review_gallery.py` は候補ごとに隔離した文書（iframe）を作り、その中に次を並べる。

- ライト/ダークそれぞれで、ヒーロー（既定 177px / 138px、祖先に `data-pictogram-motion="play"`）と一覧選択中（既定 60px / 50px、属性なし）。ダーク側はアプリと同じく祖先に `.dark` クラスを付ける
- 色は `frontend/styles/globals.css` から読んだ `--foreground` / `--muted-foreground` を `--game-pictogram-strong` / `--game-pictogram-soft` に、`--background` / `--muted` / `--ring` を面と選択枠に使う

サイズは `--hero-sizes` / `--list-sizes`（カンマ区切り）で変えられる。候補の再生自体は JavaScript が無効でも表示される。JavaScript が有効な環境では次の操作を追加する。

- 全候補 / 候補ごとの最初からの再生
- 全候補の一時停止 / 再開
- 候補ごとの時刻スライダー（全アニメーションを止め、指定時刻へ移す）
- 候補ごとの再生属性の切り替え（属性を外した静止状態と、終点・継ぎ目の姿を見比べる）
- 候補ごとの方向指定とメモ、レビュー結果 JSON の表示

方向指定は採点ではない。次だけを扱う。

- `candidate`: ベース候補として残す
- `explore`: この系統をさらに掘る
- `part`: 一部の発想や表現だけ使う
- `reject`: この方向は捨てる

## 3. 人間提示前の品質ゲート

`check_animation.py` の PASS は契約と構造の検査結果であり、提示できる品質を保証しない。`references/self-review.md` のチェックを候補ごとに実施して `self-review.json` を作り、`check_self_review.py` が PASS した後、`--audience human --self-review ...` で生成したギャラリーの候補だけを人間へ提示する。

## 4. 人間レビューで問うこと

点数化せず、A → B → C → D の順に会話の材料として問う。

1. **A**: 説明なしで、このパズルで何を考え何をするかが動きから分かるか
2. **B**: 解けた・揃った瞬間が見え、遊びたくなるか
3. **C**: 選んだときに、選択がはっきり返ってくる手応えがあるか。弱ければ、A/B のどこが弱いせいか
4. **D**: 画面全体の第一印象や落ち着きを崩していないか
5. 静止状態（一覧選択中）は、白黒版と同じパズルの色付き版として自然か
6. 候補全体ではなく、一部分だけ残したいものがあるか

「A は良いが B が弱い」「静止状態だけ良い」のような混ざった評価をそのまま残してよい。C が弱いという指摘は、C 専用の演出を足す指示ではなく、A/B の見直し指示として扱う。

## 5. レビュー結果の使い方

人間の発言やギャラリー出力を、次の探索への指示として扱う。

```text
pour-settle-01 を掘る
last-drop-02 の最後の間を混ぜたい
hesitate-01 は静止状態だけ使いたい
その他は除外
```

候補の順位としてではなく、残す A/B の核と変えてよい部分として解釈する。

## 6. 仕上げ後の再レビューと完成判断

最終候補を仕上げた後も、`references/self-review.md` のチェックを新しい記録でやり直し、全項目が `true` の候補だけを提示する。採用は人間が判断する。自動検査やエージェントの実描画レビューを狙いの達成の承認として扱わない。

採用したい方向がなければ再発散する。
