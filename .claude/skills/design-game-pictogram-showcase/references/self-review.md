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
  --manifest path/to/manifest.json --out /tmp/pictogram-showcase-<game>/observe --pixels \
  [--overlap '<動く対象のセレクタ>|<他の対象のセレクタ>' ...]
```

各候補を単独のページにヒーロー 177px / 138px（再生）と一覧 46px で描画し、次を報告する（`observe-report.json` と、開始・終点・静止状態のスクリーンショットを `--out` に書く。ダーク側は `-dark-` 付きの名前）。違反があれば `FAIL` と終了コード 1、人間の判断が要るものは `WARN`。テーマの色は `frontend/styles/globals.css` の `:root` / `.dark` から読み、ダークはアプリと同じく `<html class="dark">` で描く。

| 項目 | テーマ | 内容 |
|---|---|---|
| 静止状態との一致 | ライト/ダーク | 再生属性なしの姿（静止状態）と、`once` は各 animation をそれぞれの終点直前へ、`cut` / `seam` は各 animation を 1 周目の 100% 直前へ移した姿を、全要素の computed style（transform、opacity、fill、stroke、d など）で比べる。`seam` は 0%（各 animation の遅延の終わり）も比べる。祖先を含めて見えない要素（opacity 0、`display: none` 等）は両方で見えなければ比べない |
| 動きを減らす設定 | ライト/ダーク | `reducedMotion: 'reduce'` でアニメーションが 0 件、姿が静止状態と一致するか |
| `cut` の止まりと間 | ライト | 1 周目（遅延の後）を時刻を止めて測った止まり（`hold`）と開始の間（`start beat`）、1 周の静止割合（`still ratio`、周期は `animation-duration`）。0% が静止状態と同じなら `FAIL` |
| 実フレーム | ライト | SVG を挿入した瞬間から requestAnimationFrame で毎フレームの姿を記録する（`cut` は `--cycles`（既定 3.3）周ぶん）。遅延中の要素が、開始の姿（0%）と違うのに静止状態を見せていれば `FAIL`（`backwards` / `both` の付け忘れ）。`once` / `cut` で開始の姿が静止状態と違うのに最初のフレームが静止状態なら `FAIL` |
| `cut` の切り替え | ライト | 周の境界（基準 animation の `currentIteration` が増えたフレーム。遅延があってもずれない）ごとに、直前フレームが静止状態（S）、直後が 0% の姿（P0）か、その間に途中のフレームが何枚あるかを報告する。直前が S でない、途中のフレームがあるなら `FAIL`。直後が P0 でなければ開始の間が無いと `NOTE` |
| viewBox | ライト | 1 周を 20ms ごとに止め、見えている図形（線幅込み）と viewBox の端の最小余白（`min viewBox margin`、負ならはみ出し） |
| 速度の連続性 | ライト | 動く図形ごとに外接矩形の四隅と中心の画面座標（`getScreenCTM`、CSS の transform を含む）を 2ms ごとに時刻を止めて読み、隣り合う速度の差をその図形のピーク速度で割った値（`worst jump`）を出す。`--smooth-threshold`（既定 0.15）を超えた図形を `WARN` にする。`once` / `cut` は 1 周（`cut` の切り替えは除く）、`seam` は継ぎ目をまたいで走査する |
| 重なり（任意） | ライト | `--overlap 'A|B'` を渡したとき、1 周を 20ms ごとに止め、A と B の見えている図形の外接矩形が交わる範囲を 1px 格子で図形の内側判定（`isPointInFill` / `isPointInStroke`）し、重なりの面積（viewBox 単位²）の最大と時刻を出す。0.25 以上なら `WARN` とその時刻のスクリーンショット（`<id>-overlap-<n>.png`） |
| 大きさと位置 | ライト | 静止状態の見えている図形の外接矩形（線幅込み、viewBox 単位）と中心。`base_pictogram` との中心のずれと大きさの比、他ゲームの `pictogram.svg` の中央値との大きさの比を出す（判定はしない。目安は `references/motion.md`） |
| エラー | 全ページ | `pageerror` / `console.error` |

`--pixels` を付けると、終点（100% 直前）と静止状態のスクリーンショットの画素差もテーマごとに出す。アニメーション対象の要素は合成レイヤーでラスタライズされるため、computed style が一致していても輪郭の縁に画素差が出る（177px の 1 候補で全体の 1〜3%、チャンネル差の最大 70〜85 前後）。判定は computed style の一致で行い、画素差は縁以外（面の色、図形の位置）に出ていないかをスクリーンショットで見るために使う。

報告の読み方:

- 実フレームの `hold` / `start beat` は、時刻を止めて測った値より最大 2 フレーム（約 33ms）短く出る。境界の直後のフレームは境界から 0〜1 フレーム遅れて描かれ、間の最後のフレームも次の変化の手前のフレームになるため。例: 開始の間 300ms が実フレームでは 283ms。目安との比較は時刻を止めて測った値で行う。
- 速度の急変の `WARN` は、衝突（滴が着水して止まる）、出現・消失、意図して速度を上げて始まる動きでも出る。報告の時刻をギャラリーの時刻スライダーで止め、意図した不連続か区間の継ぎ目のかくつきかを判断し、`notes` に書く。区間ごとのイージングで書いた滑らかな動きは 0.05 未満に収まる（ウォーターソートの試作で 0.02〜0.04）。
- `--overlap` のセレクタは SVG 内のクラスや構造で書く（例: `'.pz-<game>-src|.pz-<game>-fill ~ g'`）。注ぎ口と筋の接触など意図した重なりも出るため、スクリーンショットで判断する。

### 1.2 ギャラリーで狙いと見た目を見る

`scripts/make_review_gallery.py --audience self` で作ったギャラリーを実ブラウザで開く。ギャラリーは候補ごとに隔離した iframe の中で次を並べる。

- ヒーロー 177px / 138px: 祖先に `data-pictogram-motion="play"` を付けて再生
- 一覧選択中 56px / 46px: 属性なしで静止
- 一覧選択中サイズで他ゲームの白黒ピクトグラムと並べた比較列
- 上記をライト/ダーク両方で表示（`--game-pictogram-strong` / `--game-pictogram-soft` と背景はアプリの値。ダーク側は祖先に `.dark` クラスを付ける）

同じ SVG が 1 文書に複数インライン展開されるため、同時 2 表示の干渉もこの状態で確認できる。

実ブラウザは次の手段で開く。

- Claude Code 環境: 一時ディレクトリに Node スクリプト（例: `/tmp/pictogram-showcase-<game>/check-gallery.cjs`）を書き、`node /tmp/pictogram-showcase-<game>/check-gallery.cjs` で実行する。スクリプトでは `require('playwright')` の `chromium.launch()` でギャラリーの HTML を開き、`page.on('pageerror')` / `page.on('console')` を記録し、スクリーンショットを撮る。動きを減らす設定は `page.emulateMedia({ reducedMotion: 'reduce' })` で再現する。`require('playwright')` が解決しなければ `NODE_PATH=<playwright を含む node_modules>` を付けて実行する。
  - ギャラリーの `srcdoc` iframe の中では、`frame.evaluate()` に渡した Promise（requestAnimationFrame の待機など）が解決しないことがある。iframe 内で待つ処理は、親ページの `page.evaluate()` から `iframe.contentDocument` / `contentWindow` を操作して書くか、候補を単独ページに描画する（`observe_animation.cjs` と同じ方法）。
- ChatGPT 環境: `docs/メモ/ChatGPT画面確認.md` と `scripts/chatgpt_playwright.py` に従う（`page.goto()` は使えないため、ギャラリーの HTML は `page.set_content()` で描画する）。1.1 の項目も同じ手段で確かめる。

観察の手順:

1. ヒーローサイズで再生を観察する。`once` なら開始から終了後の静止まで、`cut` / `seam` なら周の境界を 2 回以上またいで見る。
2. 時刻スライダーで始点・見せ場・終点（スライダーの最大値 = 周期 - 1ms）を止め、拡大表示でも確認する。必要なら途中フレームを複数時点でキャプチャし、一瞬だけの破綻を見落とさない。
3. 1.1 の報告で、静止状態との一致と `cut` の切り替えを確かめる。`once` は終了して静止状態へ戻る瞬間に跳ばないことも再生で確かめる。
4. 始点が静止状態と異なり `animation-delay` を使う候補は、遅延中のちらつきを 1.1 の実フレームの報告で確かめる。
5. 動きが滑らかかを、1.1 の速度の連続性の報告と実時間の再生で見る。区間の継ぎ目で速度が急に変わる、止まりかけて再び動くなどの「かくつき」がないか。`WARN` の時刻は時刻スライダーで止めて、意図した不連続かを判断する。`check_animation.py` の線形サンプリングの `WARN` が出ている候補は特に注意する（`references/motion.md`）。
6. 動く対象が他の対象（もう一方の容器や駒など）と重ならないかを見る。1.1 の `--overlap` に動く対象と他の対象のセレクタを渡して時刻走査で重なりの最大と時刻を出し、その時刻のスクリーンショットを見る。セレクタで分けにくい構造なら、時刻スライダーで動きの全期間を細かく止め、外接矩形が交わる時刻を拡大表示で確かめる。
7. 一覧選択中サイズの静止状態を、`base_pictogram`（白黒版）と、比較列の他ゲームのピクトグラムと並べて見る。1.1 の大きさと位置の数値と合わせて判断する（`references/motion.md`）。
8. ライト/ダークの静止状態との一致、動きを減らす設定、`pageerror` / `console.error` は 1.1 の報告で確かめる。

再生途中で止まる場面（動きを減らす設定への切り替え、ゲームの切り替え、再生属性の付け外し）で静止状態へ切り替わる跳びは、受け口の契約の対象外とし、不合格の理由にしない。

狙いの確認は A → B → C → D の順に行う。C が弱い候補に C 専用の演出を足して直さない。A/B の作り方を直して再レビューするか `reject` にする。

## 2. 必須チェックリスト

候補ごとに、共通の項目と、manifest の `playback` に応じた継ぎ目の項目をすべて確認する。他の形式の項目は書かない（`check_self_review.py` が未知の項目として `FAIL` にする）。

### 観察

- `observed_hero_play_full_cycle`: ヒーローサイズ（177px / 138px）で、`once` は開始から終了後の静止まで、`cut` / `seam` は周の境界を 2 回以上またいで再生を観察した
- `observed_key_moments_zoomed`: 始点・見せ場・終点（継ぎ目）を拡大表示でも確認した
- `observed_list_selected_static`: 一覧選択中サイズ（56px / 46px）で静止状態を確認した
- `observed_light_and_dark`: ライト/ダーク両方で、ギャラリーの見た目と 1.1 の静止状態との一致を確認した
- `observed_reduced_motion_static`: 動きを減らす設定でヒーローが静止状態になることを、ライト/ダーク両方で確認した

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

- `cut_hold_matches_static`: 各周の終わりの止まりが静止状態と同じ姿で、見せ場が終わったと読める長さ止まる（目安 1.5〜2.5 秒。目安から外す場合は `notes` に理由を書く）
- `cut_switch_is_instant`: 切り替え直前のフレームが静止状態、直後のフレームが 0% の開始の姿と一致し、間に途中のフレームが無い（フェード・巻き戻しの途中経過を見せない）。直後に開始の姿での短い間がある。初回の最初のフレームに見せ場の姿が出ない

`seam`:

- `seam_matches_static`: 0% と 100% が同じ姿で、その継ぎ目の姿が静止状態である。周の途中で見えている要素が跳ばない

### 実装

- `motion_smooth_no_stutter`: 実時間の再生で動きが滑らかで、区間の継ぎ目で速度が急に変わる・止まりかけて再び動くなどのかくつきがない。1.1 の速度の急変の `WARN` は意図した衝突・出現だけである
- `parts_stay_attached`: 本来つながる容器・中身・駒などの所属関係が崩れない
- `moving_parts_clear_of_others`: 動く対象が、動きの全期間で他の対象（もう一方の容器や駒など）と重ならない。意図した接触（注ぎ口と筋など）は `notes` に書く
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
        "moving_parts_clear_of_others": true,
        "no_unintended_overlap_or_overflow": true,
        "transform_and_clip_are_natural": true,
        "no_broken_transient_frame": true,
        "dual_instance_ok": true,
        "no_pageerror": true,
        "no_unexpected_console_error": true,
        "no_obvious_unfinished_artifact": true
      },
      "notes": "cut。observe: ライト/ダークとも止まり = 静止状態、reduce 静止。hold 2040ms、start beat 300ms、切り替え 3 回とも S→P0・途中フレーム 0、余白 0.81、速度の急変 WARN なし、重なりなし。177/138px 再生を 3 周、56/46px 静止と比較列、ライト/ダークを確認"
    }
  }
}
```

`result` は次のどちらかにする。

- `pass`: 全チェックを満たし、人間レビューへ提示できる
- `reject`: 修正せず候補から落とす。満たせなかった項目（1 つ以上）を `false` のまま残し、`notes` に理由を書く。`check_self_review.py` は、`false` が 1 つも無い、または `notes` が空の `reject` を `FAIL` にする

修正中の候補を `pass` にしない。修正後は古い記録を流用せず、観察からやり直して記録を更新する。

## 4. ゲート検査

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/check_self_review.py \
  --manifest path/to/manifest.json \
  --self-review path/to/self-review.json
```

この検査が PASS するまで人間用ギャラリーを生成しない。人間用ギャラリーは `--self-review` を渡して生成し、`pass` 候補だけを掲載する。
