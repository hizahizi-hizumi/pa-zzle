# 人間提示前のセルフレビュー

`/design-game-pictogram-showcase` の候補を人間へ見せる前に通す品質ゲート。役割は次の 2 つに限る。

- 候補が manifest で宣言した狙い（`aim_play` / `aim_payoff`）を実表示サイズで実現しているか、C が生まれているか、D を侵していないかを確かめる
- 受け口の契約違反、実装破綻、未完成状態を人間レビューへ持ち込まない

候補同士の A/B の優劣は比べない。どの方向が良いかは人間が決める。

## 1. レビュー方法

`DESIGN.md` を確認し、次の 2 段で観察する。

### 1.1 観察スクリプトで描画した姿を測る

```sh
node .claude/skills/design-game-pictogram-showcase/scripts/observe_animation.cjs \
  --manifest path/to/manifest.json --out /tmp/pictogram-showcase-<game>/observe --pixels
```

各候補を単独のページにヒーロー 177px / 138px（再生）と一覧 50px で描画し、次を報告する（`observe-report.json` と、開始・終点・静止状態のスクリーンショットを `--out` に書く）。違反があれば `FAIL` と終了コード 1。

| 項目 | 内容 |
|---|---|
| 静止状態との一致 | 再生属性なしの姿（静止状態）と、`once` は終点、`cut` は 100% 直前、`seam` は 0% と 100% 直前を、全要素の computed style（transform、opacity、fill、stroke、d など）で比べる。祖先を含めて見えない要素（opacity 0、`display: none` 等）は両方で見えなければ比べない |
| `cut` の止まりと間 | 時刻を止めて測った止まり（`hold`）と開始の間（`start beat`）、1 周の静止割合（`still ratio`）。0% が静止状態と同じなら `FAIL` |
| `cut` の切り替え | requestAnimationFrame で `--cycles`（既定 3.3）周ぶん毎フレームの姿を記録し、各周の境界で直前フレームが静止状態（S）、直後が 0% の姿（P0）か、その間に途中のフレームが何枚あるかを報告する。直前が S でない、途中のフレームがある、初回の最初のフレームが S なら `FAIL`。直後が P0 でなければ開始の間が無いと `NOTE` |
| 動きを減らす設定 | `reducedMotion: 'reduce'` でアニメーションが 0 件、姿が静止状態と一致するか |
| viewBox | 1 周を 20ms ごとに止め、見えている図形（線幅込み）と viewBox の端の最小余白（`min viewBox margin`、負ならはみ出し） |
| エラー | `pageerror` / `console.error` |

`--pixels` を付けると終点（100% 直前）と静止状態のスクリーンショットの画素差も出す。アニメーション対象の要素は合成レイヤーでラスタライズされるため、computed style が一致していても輪郭の縁に画素差が出る（177px の 1 候補で全体の 2〜3%、チャンネル差の最大 70 前後）。判定は computed style の一致で行い、画素差は縁以外（面の色、図形の位置）に出ていないかをスクリーンショットで見るために使う。

### 1.2 ギャラリーで狙いと見た目を見る

`scripts/make_review_gallery.py --audience self` で作ったギャラリーを実ブラウザで開く。ギャラリーは候補ごとに隔離した iframe の中で次を並べる。

- ヒーロー 177px / 138px: 祖先に `data-pictogram-motion="play"` を付けて再生
- 一覧選択中 60px / 50px: 属性なしで静止
- 一覧選択中サイズで他ゲームの白黒ピクトグラムと並べた比較列
- 上記をライト/ダーク両方で表示（`--game-pictogram-strong` / `--game-pictogram-soft` と背景はアプリの値。ダーク側は祖先に `.dark` クラスを付ける）

同じ SVG が 1 文書に複数インライン展開されるため、同時 2 表示の干渉もこの状態で確認できる。

実ブラウザは次の手段で開く。

- Claude Code 環境: 一時ディレクトリに Node スクリプト（例: `/tmp/pictogram-showcase-<game>/check-gallery.cjs`）を書き、`node /tmp/pictogram-showcase-<game>/check-gallery.cjs` で実行する。スクリプトでは `require('playwright')` の `chromium.launch()` でギャラリーの HTML を開き、`page.on('pageerror')` / `page.on('console')` を記録し、スクリーンショットを撮る。
  - ギャラリーの `srcdoc` iframe の中では、`frame.evaluate()` に渡した Promise（requestAnimationFrame の待機など）が解決しないことがある。iframe 内で待つ処理は、親ページの `page.evaluate()` から `iframe.contentDocument` / `contentWindow` を操作して書くか、候補を単独ページに描画する（`observe_animation.cjs` と同じ方法）。
- ChatGPT 環境: `docs/メモ/ChatGPT画面確認.md` と `scripts/chatgpt_playwright.py` に従う（`page.goto()` は使えないため、ギャラリーの HTML は `page.set_content()` で描画する）。1.1 の項目も同じ手段で確かめる。

観察の手順:

1. ヒーローサイズで再生を少なくとも 1 周観察する。`once` なら開始から終了後の静止まで、`cut` / `seam` なら周の境界を 2 回以上またいで見る。
2. 時刻スライダーで始点・見せ場・終点（スライダーの最大値 = 周期 - 1ms）を止め、拡大表示でも確認する。必要なら途中フレームを複数時点でキャプチャし、一瞬だけの破綻を見落とさない。
3. 1.1 の報告で、静止状態との一致と `cut` の切り替えを確かめる。`once` は終了して静止状態へ戻る瞬間に跳ばないことも再生で確かめる。
4. 始点が静止状態と異なり `animation-delay` を使う候補は、「最初から再生」の直後を複数フレームキャプチャし、遅延中に静止状態がちらつかないことを確かめる。
5. 動きが滑らかかを、実時間の再生で見る。区間の継ぎ目で速度が急に変わる、止まりかけて再び動くなどの「かくつき」がないか。`check_animation.py` の線形サンプリングの `WARN` が出ている候補は特に注意する（`references/motion.md`）。
6. 一覧選択中サイズの静止状態を、`base_pictogram`（白黒版）と、比較列の他ゲームのピクトグラムと並べて見る。
7. 動きを減らす設定と `pageerror` / `console.error` は 1.1 の報告で確かめる。

再生途中で止まる場面（動きを減らす設定への切り替え、ゲームの切り替え、再生属性の付け外し）で静止状態へ切り替わる跳びは、受け口の契約の対象外とし、不合格の理由にしない。

狙いの確認は A → B → C → D の順に行う。C が弱い候補に C 専用の演出を足して直さない。A/B の作り方を直して再レビューするか `reject` にする。

## 2. 必須チェックリスト

候補ごとに、共通の項目と、manifest の `playback` に応じた継ぎ目の項目をすべて確認する。他の形式の項目は書かない（`check_self_review.py` が未知の項目として `FAIL` にする）。

### 観察

- `observed_hero_play_full_cycle`: ヒーローサイズ（177px / 138px）で再生を 1 周以上観察した
- `observed_key_moments_zoomed`: 始点・見せ場・終点（継ぎ目）を拡大表示でも確認した
- `observed_list_selected_static`: 一覧選択中サイズ（60px / 50px）で静止状態を確認した
- `observed_light_and_dark`: ライト/ダーク両方で確認した
- `observed_reduced_motion_static`: 動きを減らす設定でヒーローが静止状態になることを確認した

### 狙い

- `aim_a_play_readable`: 説明文なしで、`aim_play` に書いた中心の操作（何を考え何をするか）がヒーローサイズの動きから読める
- `aim_b_payoff_visible`: `aim_payoff` に書いた解けた・揃った瞬間が、見せ場としてヒーローサイズで見える
- `aim_c_selection_response_emerges`: 再生開始直後から変化がはっきり起き、選択への応答として返る。それが A/B の動きから生まれており、C 専用の演出を足していない
- `aim_d_calm_first_impression`: 画面の第一印象・落ち着きを不必要に崩さない（常時の大振幅、強い点滅、画面の他要素より強い主張、描画域の外へ出る動きがない）

### 静止状態

- `static_is_same_puzzle_as_base`: 静止状態が白黒版と同じパズルだと分かる
- `static_colors_match_play_screen`: ゲーム固有色がプレイ画面の定義元の値と一致し、前景の線は `--game-pictogram-strong`、補助は `--game-pictogram-soft` を使っている
- `static_readable_at_list_size`: 一覧選択中サイズで色付き静止画として読め、色や線が潰れず、比較列で他のピクトグラムと並べて重量・大きさが突出せず小さすぎもしない
- `light_and_dark_both_hold`: ライト/ダークの両方で、輪郭とゲーム固有色の見分けが成立する。プレイ画面の色がテーマで変わるゲームは、ダーク側でダークのプレイ画面の色に切り替わっている

### 継ぎ目（共通）

- `delayed_start_has_no_static_flash`: 始点が静止状態と異なり `animation-delay` を使う場合、`animation-fill-mode: backwards` または `both` により遅延中に静止状態がちらつかない。遅延を使わない、または始点が静止状態と同じなら `true`

### 継ぎ目（形式ごと）

`once`:

- `once_end_matches_static`: 終点が静止状態と同じ姿で、終了後に静止状態へ戻るとき跳ばない

`cut`:

- `cut_hold_matches_static`: 各周の終わりの止まりが静止状態と同じ姿で、見せ場が終わったと読める長さ（目安 1.5〜2.5 秒）止まる
- `cut_switch_is_instant`: 切り替え直前のフレームが静止状態、直後のフレームが 0% の開始の姿と一致し、間に途中のフレームが無い（フェード・巻き戻しの途中経過を見せない）。直後に開始の姿での短い間がある。初回の最初のフレームに見せ場の姿が出ない

`seam`:

- `seam_matches_static`: 0% と 100% が同じ姿で、その継ぎ目の姿が静止状態である。周の途中で見えている要素が跳ばない

### 実装

- `motion_smooth_no_stutter`: 実時間の再生で動きが滑らかで、区間の継ぎ目で速度が急に変わる・止まりかけて再び動くなどのかくつきがない
- `parts_stay_attached`: 本来つながる容器・中身・駒などの所属関係が崩れない
- `no_unintended_overlap_or_overflow`: 意図しない重なり、viewBox からのはみ出し、分離がない
- `transform_and_clip_are_natural`: 回転中心、移動、変形、clip の挙動が自然である
- `no_broken_transient_frame`: 一瞬だけ形状や配置が壊れるフレームがない
- `dual_instance_ok`: 同じ SVG の同時表示（ヒーロー再生 + 一覧静止、ライト + ダーク）で互いに干渉しない
- `no_pageerror`: `pageerror` がない
- `no_unexpected_console_error`: 意図しない `console.error` がない
- `no_obvious_unfinished_artifact`: 人へ見せるには明らかに未完成な箇所が残っていない

`pass` にできるのは、その候補の形式で必要な全項目が `true` の候補だけとする。

## 3. self-review.json

```json
{
  "candidates": {
    "pour-settle-01": {
      "result": "pass",
      "checks": {
        "observed_hero_play_full_cycle": true,
        "observed_key_moments_zoomed": true,
        "observed_list_selected_static": true,
        "observed_light_and_dark": true,
        "observed_reduced_motion_static": true,
        "aim_a_play_readable": true,
        "aim_b_payoff_visible": true,
        "aim_c_selection_response_emerges": true,
        "aim_d_calm_first_impression": true,
        "static_is_same_puzzle_as_base": true,
        "static_colors_match_play_screen": true,
        "static_readable_at_list_size": true,
        "light_and_dark_both_hold": true,
        "delayed_start_has_no_static_flash": true,
        "cut_hold_matches_static": true,
        "cut_switch_is_instant": true,
        "motion_smooth_no_stutter": true,
        "parts_stay_attached": true,
        "no_unintended_overlap_or_overflow": true,
        "transform_and_clip_are_natural": true,
        "no_broken_transient_frame": true,
        "dual_instance_ok": true,
        "no_pageerror": true,
        "no_unexpected_console_error": true,
        "no_obvious_unfinished_artifact": true
      },
      "notes": "cut。observe: hold 2040ms、start beat 300ms、切り替え 3 回とも S→P0・途中フレーム 0、reduce 静止、余白 0.81。177/138px 再生を 3 周、60/50px 静止と比較列、ライト/ダークを確認"
    }
  }
}
```

`result` は次のどちらかにする。

- `pass`: 全チェックを満たし、人間レビューへ提示できる
- `reject`: 修正せず候補から落とす。満たせなかった項目を `false` のまま残し、`notes` に理由を書く

修正中の候補を `pass` にしない。修正後は古い記録を流用せず、観察からやり直して記録を更新する。

## 4. ゲート検査

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/check_self_review.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json
```

この検査が PASS するまで人間用ギャラリーを生成しない。人間用ギャラリーは `--self-review` を渡して生成し、`pass` 候補だけを掲載する。
