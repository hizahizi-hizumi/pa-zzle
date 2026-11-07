# 評価担当者専用: 正解候補

レビュー役に渡さない。独立レビューの結果を凍結してから開く。以下は修正 PR と対象コードから確認できる既知の不具合候補であり、追加検証により確定させる。

## WATER-BEFORE

- `Water.tsx:21` に `h-1/4` を用い、各層を `bottom: slotIndex * 25%` で並べるため、サブピクセルの丸め方によって隣接層の境界に微小な隙間ができる可能性がある。
- 調査上の根拠: [PR #655](https://github.com/hizahizi-hizumi/pa-zzle/pull/655) の不具合報告、実際の修正と座標・スクリーンショットによる検証。
- 合格基準: 表示上の隙間という現象と相互に独立なレイヤーの高さ・配置の関係を特定する。発生を見ていない場合はブラウザ条件付きの疑義にする。

## VIEWPORT-BEFORE

- `AppShell.tsx:35` と `index.css:14` が `min-h-screen`（`100vh`）である一方、シェル内の `viewport` レイアウトは `100dvh` 基準。Safari の可視領域と最小高さが一致しない場合、選択画面がわずかに縦スクロールする可能性がある。
- 調査上の根拠: [PR #654](https://github.com/hizahizi-hizumi/pa-zzle/pull/654) の不具合報告と修正、Chromium でのサイズ検証。ただし iPhone Safari 実機固有の挙動は同 PR でも未検証。
- 合格基準: `100vh` と `100dvh` の不一致を根拠に説明し、Safari 実機での発生は未再現と記す。

## WATER-AFTER / VIEWPORT-AFTER

- 既知の修正対象はそれぞれ PR #655 と PR #654 で変更済み。対応する BEFORE の所見をコードを確認せず再提出したら誤検出候補とする。
- AFTER 版に他の問題が無いとは断定しない。新規の指摘は独立に検証してから採点する。

## TRACE-BEFORE

- `traceHitofudePuzzle` で `state.path.at(-2)` に戻るケースは扱うが、先端から L 字の2つ前（例: path `[0,1,4]`, `from=4`, `to=0`）へ斜めに戻すと `state.path.includes(to)` で `unchanged` になる。
- 操作としては角のマスを通ってなぞり戻した扱いで `[0]` に縮むことが期待される。根拠は [修正コミット 3ff2eaba](https://github.com/hizahizi-hizumi/pa-zzle/commit/3ff2eaba83066ab5436e9ab8af0fcb1287769523) とその追加テスト。
- 合格基準: 具体的な `path` と `from/to` で `unchanged` になる実行経路を指摘し、期待される巻き戻しとの違いを説明する。

## TRACE-AFTER

- `traceHitofudePuzzle` に先端から2つ前へ戻す分岐と対応するテストが追加された。これを見落として TRACE-BEFORE の所見を出したら誤検出候補。
- 別の動作経路の新規問題が見つかった場合は独立に検証する。

## 留意

- PR 説明にある検証結果をそのまま正解と扱うのではなく、必要な条件を再現する。再現できない場合、確定正解としての Recall 集計からは一旦除く。
- 視覚的な問題の検証が環境制約でできない場合、推測を欠陥確定として扱わない。

## QUALITY-CLAMP-BEFORE / QUALITY-CLAMP-AFTER

- `QUALITY-CLAMP-BEFORE`: `Math.max(1, ...)` が入力0を1に変えてしまう。提供契約に反する具体的な入力 `0` で確認できる。
- `QUALITY-CLAMP-AFTER`: 0を含む有効範囲に収める。上記の不具合はない。ただし別の仕様（NaN等）を想像して必須要件として指摘しない。

両ケースは人工的なコード断片であり、本番の欠陥ではない。

## 採点上の位置づけ（2026-11-07 再評価）

- `QUALITY-CLAMP-*`: 入出力契約が提示され、実行で期待値と実装の差を確定できるので primary（確定評価対象）。
- `WATER-*`、`VIEWPORT-*`: 調査時点では対象環境での再現が不十分なため exploratory。CSS の構造上の疑義を欠陥確定と混同しない。対象 ref・表示環境をそろえて再現できた時点で primary へ昇格する。
- `TRACE-*`: 旧版のテストとコメントだけでは斜め方向の巻き戻しが期待動作であると確定できない。後続修正コミットは当時の契約の独立した根拠ではないので exploratory とする。独立した仕様または受け入れ条件が確認できた時点で primary にできる。現状の見逃しを無条件に「重大欠陥の検出失敗」と集計しない。
- exploratory ケースの所見は、確定 Findings と未確定の疑義を別々に記録し、発見能力と確信度の付け方を分けて評価する。

## QUALITY-IMMUTABLE-BEFORE / QUALITY-IMMUTABLE-AFTER

- 同一の入力 `[2,5,7]` に `9` を追加した戻り値は `[5,7,9]`。元の入力は `[2,5,7]` のままでなければならない。BEFORE は `push` と `shift` で引数を破壊し、AFTER は新配列を作る。戻り値だけを照合すると欠陥を見逃す。

## QUALITY-STALE-BEFORE / QUALITY-STALE-AFTER

- `state={requestId:8,puzzle:"new"}` に古い `responseId=7` の `"old"` が到着した場合、盤面は `"new"` のまま。BEFORE は古い応答を採用し、AFTER は無視する。同じIDの応答は両者とも適用する。

上記2組は契約と入力を明示した合成の評価ケースであり、実製品の欠陥とは区別する。`oracle-cases.json` は評価者専用。レビュー担当者に提供しない。
