# 人間提示前のセルフレビュー

`/design-game-pictogram-animation` で生成した候補を人間へ見せる前に通す品質ゲート。目的は面白さを代理評価することではなく、明らかな実装破綻や未完成状態を人間レビューへ持ち込まないことにある。

## 1. レビュー方法

現在の `DESIGN.md` を確認し、実ブラウザで各候補を実表示サイズにして少なくとも 1 ループ通して観察する。開始状態や代表フレーム数枚だけでは完了としない。

実表示サイズの 1 ループに加えて、主要な動き・ギミックの見せ場・終了またはループ復帰付近は拡大表示でも確認する。必要なら途中フレームを複数時点でキャプチャし、一瞬だけの破綻を見落とさない。

## 2. 必須チェックリスト

候補ごとに次をすべて確認する。

- `observed_full_loop_at_target_size`: 実表示サイズで 1 ループ全体を観察した
- `observed_key_moments_zoomed`: 主要な途中状態を拡大表示でも確認した
- `start_state_matches_static`: 開始状態が元の静的ピクトグラムとして成立している
- `parts_stay_attached`: 本来つながる容器・液体・駒などの所属関係が崩れない
- `no_unintended_overlap_or_overflow`: 意図しない重なり、はみ出し、分離がない
- `transform_and_clip_are_natural`: 回転中心、移動、変形、clip の挙動が自然である
- `no_broken_transient_frame`: 一瞬だけ形状や配置が壊れるフレームがない
- `motion_is_readable_at_target_size`: 実表示サイズで何が起きたか追える
- `end_and_loop_return_clean`: 終了状態とループ復帰に不自然なジャンプや崩れがない
- `no_pageerror`: `pageerror` がない
- `no_unexpected_console_error`: 意図しない `console.error` がない
- `no_obvious_unfinished_artifact`: 人へ見せるには明らかに未完成な箇所が残っていない

`pass` にできるのは全項目が `true` の候補だけとする。1 項目でも満たせない候補は修正して再レビューするか `reject` にする。

## 3. self-review.json

レビュー結果は候補ごとに記録する。

```json
{
  "candidates": {
    "siphon-01": {
      "result": "pass",
      "checks": {
        "observed_full_loop_at_target_size": true,
        "observed_key_moments_zoomed": true,
        "start_state_matches_static": true,
        "parts_stay_attached": true,
        "no_unintended_overlap_or_overflow": true,
        "transform_and_clip_are_natural": true,
        "no_broken_transient_frame": true,
        "motion_is_readable_at_target_size": true,
        "end_and_loop_return_clean": true,
        "no_pageerror": true,
        "no_unexpected_console_error": true,
        "no_obvious_unfinished_artifact": true
      },
      "notes": "112px と拡大表示で 1 ループ確認"
    }
  }
}
```

`result` は次のどちらかにする。

- `pass`: 全チェックを満たし、人間レビューへ提示できる
- `reject`: 修正せず候補から落とす。満たせなかった項目を `false` のまま残す

修正中の候補を `pass` にしない。修正後は古い記録を流用せず、もう一度 1 ループ確認して記録を更新する。

## 4. ゲート検査

記録を次で検査する。

```sh
python3 .claude/skills/design-game-pictogram-animation/scripts/check_self_review.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json
```

この検査が PASS するまで人間用ギャラリーを生成しない。

人間用ギャラリーはセルフレビュー結果を必ず渡す。

```sh
python3 .claude/skills/design-game-pictogram-animation/scripts/make_review_gallery.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json \
  --audience human \
  --output /tmp/pictogram-animation-review.html \
  --size 112
```

`--audience human` は `pass` 候補だけを掲載する。`reject` やレビュー未完了の候補は人間へ提示しない。
