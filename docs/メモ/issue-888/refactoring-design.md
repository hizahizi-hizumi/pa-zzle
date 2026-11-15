# #888 責務再分配の再審査

対象は main@4400ac5dbc313b0c980cccb70343a6eebadc678b。Repository Snapshot（run 43616693942、artifact 14121793247）の2,116ファイルと、GitツリーSHA 34a7fde1270aba213d0b42cd71f34991fbf175ce の一致を確認。#887（PR #890）が変更中の画面・URLは混ぜない。

## 判定基準

1. 異なる変更理由や不変条件を一つの所有者が不自然に抱えているか。
2. 同じ意味の規則や定義を複数の利用元が別々に決めていないか。
3. 分割・統合後の型・引数・中継・状態複製と、変更時の追跡範囲を比較して利益があるか。
4. 使用箇所、既存テスト、挙動の不変条件を具体的に挙げられるか。

行数、ファイル数、静的import到達数は補助情報。採用とした設計でも実装・テストの同値性はまだ未検証。**以前の20作業単位案と6構造変更案は、確定実施計画として撤回する。**

## 既出案24論点の再判定

| 番号 | 以前の提案 | 判定 | 実コードによる理由 |
|---|---|---|---|
| S01 | 起動向けに11個のgame-identityと軽量カタログを追加 | 対象外 | settings/GameCatalogContextの入力は小さいが、実チャンク・起動速度の問題。責務不良の証拠ではなく、ID定義と登録順の維持範囲も増す |
| S02 | 結果UIをカタログから除き別レジストリを追加 | 比較実証（別論点） | GameCatalogEntryはゲームの接続契約。結果の計算そのものは所有しない。登録表の増加と実ビルドで比較するまでは採用しない |
| S03 | プレイ記録定義の二重指定 | **採用** | 11件のPlayableと各ui/play-record-displayを照合し同じdefinitionが2経路から渡ることを確認 |
| S04 | GameHomeの選択stateをReducerへ置換 | 維持 | selectedKeyとlevelFilterには難易度ガードがあり、同じイベント内で更新される。実際の不整合は未立証 |
| S05 | GameHomeの表示導出とDOM調停を分離 | 比較実証 | 表示状態の純粋計算とDOM処理は区別できるが、新たな巨大Hookは逆効果。既存のzukan-change-reveal.tsへ計算を寄せる案を比較 |
| S06 | zukan-filter.tsを機械的に分割 | 維持 | 特徴候補、条件照合、件数は一つの絞り込み規則。キャッシュ寿命は画面のuseMemoが所有 |
| S07 | ランダム出題の一難易度だけ図鑑を導出 | 対象外 | 余分な計算は存在するが、責務境界ではなく性能改善として別評価 |
| S08 | 記録・図鑑・コレクションを統合ストアへ | 維持 | 保存事実、問題ごとの最新評価、時系列は異なる意味。toClearedProblemはすでに共有済み |
| S09 | 記録からの問題解決を汎用ファクトリー化 | 維持 | 共通のresolveRecordProblemPlayTargetは存在。更なる薄いファクトリーは型と中継を増やす |
| S10 | 11件のRecorded結果ラッパーを統合 | 維持 | ゲーム固有の診断、詰将棋の非同期問題集読み込みがある |
| S11 | 11件のPlayable全体を統合 | 維持 | 保存・試行・結果・音・診断の接続はusePlayableGameが担当済み。S03だけ解消する |
| S12 | 11件のPlayView/HomeViewを汎用化 | 維持（#887後確認） | ルートごとの合成境界。#887が実装変更中 |
| S13 | 3問題集生成CLIのselectLevel共通化 | **採用** | 巡回、追加探索判定、重複数、採用順が一致。適格条件・重複キー・付帯値はゲーム固有 |
| S14 | 2解析CLIのAUCを共通化 | 比較実証 | 確率と加重平均の式は同じだが、共通化のための型引数・中継が増えたら維持 |
| S15 | パーキングジャムの合法退出順序と難易度を分割 | **採用（まず経路計算共有）** | analyzeLegalOrderSpaceとcalculateExitPathFeaturesが同じ盤面でcreateExitPathsByVehicleをそれぞれ呼ぶ。計算を1回にし、探索の独立分離は依存を比較 |
| S16 | 氷床迷路の静的グラフを手筋解析から分離 | **採用** | StaticBoardGraphとcreateStaticBoardGraphはdifficulty-analysisとtactic-searchが外部から直接利用する契約 |
| S17 | 氷床迷路の解手触り集計を分離 | 比較実証 | summarizeSolutionMovesは純粋だが内部型・補助関数の共有があり、依存と引数の増減を確認する |
| S18 | チュートリアル導入をフックに分離 | 比較実証 | タイマー・停止・スキップの所有を独立できるなら採用。DOM参照を大量に受け渡すなら維持 |
| S19 | BridgesBoardの入力制御を分離 | 比較実証 | 入力意図と描画は区別できるが、盤面ヒット判定・フォーカスの依存増を確認する |
| S20 | BGMの取得と再生を分離 | 比較実証 | 取得・切替・キャンセルは強く連動。再生状態の重複や通知の往復が増えるなら維持 |
| S21 | その他のゲーム盤面を更に分割 | 維持 | 現状の部品が題材固有の操作と描画を所有しており、行数だけでは根拠がない |
| S22 | 詰将棋session、一筆書きplay、Carouselの分割 | 維持 | 手番の不変条件、操作通知、周回位置の処理がそれぞれ一つの責務で成立 |
| S23 | 大型生成・展示・CIスクリプトの分割 | 維持・必要時比較 | CLIが長いだけでは不足。異なる変更履歴と独立した利用者が確認できる部分のみ対象 |
| S24 | 未使用collapsible、親専用MetricSeparatorの整理 | 清掃枠 | 参照と上流配布形状を確かめたうえで削除・親へ統合。主要成果として数えない |

## 実施候補の設計

### S03 — 記録の定義を1か所にする

現在、app/game-integration/playable-game.tsxのusePlayableGameはgameと別引数playRecordDefinitionを受け取る。11件のPlayableから渡すdefinitionは、各ゲームのui/play-record-display.tsのdefinitionと同じ。**別引数を削除し、game.playRecordDisplay.definitionを保存・離脱の両方で使う。** 新しい型・ファイルは不要。保存先、記録ID、payload、途中離脱と結果遷移を変えず11ゲームで検証する。

### S13 — 候補選抜の制御だけを共有

frontend/scripts/generate-{nanpure,takuzu,reflection}-problem-pool.tsのselectLevelは、ラウンドロビン・状態ごとの調査位置・候補未生成時null・選抜順・重複数・上限不足エラーの処理が同じ。共有関数がこれらを所有し、encodedProblem/canonicalKey/symmetryKeyの重複定義、適格判定、付加データ、出力形式は各ゲームが所有する。候補配列を固定した旧実装との比較で順序・examinedLengths・不足/上限時の挙動まで完全一致することを合格条件とする。

### S15 — 退出経路を一度だけ構築

frontend/src/games/parking-jam/problem/difficulty-analysis.tsのanalyzeLegalOrderSpace（306行付近）とcalculateExitPathFeatures（590行付近）は共にcreateExitPathsByVehicleを呼ぶ。入口のanalyzeParkingJamDifficultyで一度作り、両方へ渡す。16台までのbigintによる計数、17台以上のunsupported、全特徴値の一致が必須。その後、合法順序探索の独立モジュール化を検討する。**3分割自体は目標にしない。**

### S16 — 静的グラフの所有者を独立させる

frontend/src/games/ice-floor-maze/problem/generation/static-tactics.tsのStaticBoardGraph、Stopper/Floor、createStaticBoardGraph、停止表構築を同じgeneration内のstatic-board-graph.tsへ移す。static-tactics.tsはグラフを使う手筋・読みの解析を所有。difficulty-analysis.ts、tactic-search.ts、研究参照テストのimportを更新。値とseedの再現性、循環依存なしを確認。意味のない再exportは残さない。

## 比較の中止条件

GameHomeは状態を他層へ複製しない。Tutorial・Bridges・BGMはDOM参照、停止・キャンセル状態、イベント契約が新旧でどう変わるかを比較する。AUCと氷床迷路の手触り集計は、型とヘルパーの公開増が利益を上回る場合は維持する。カタログの分割と軽量登録表は、**静的import数だけを根拠に#888で実施しない**。別の性能検証が必要。

実施する場合はS03、S15、S16、S13を別々の変更理由で検証する。#887の進行中コードへ先回りしない。提案を実装しただけでは完了とせず、差分、テスト、生成結果、依存方向、必要な実ブラウザ確認を行う。

## 調査の限界

全2,116追跡ファイルを一次分類したが、全行人手レビュー済みという意味ではない。24論点は現行mainのコードと利用元から再審査した。**実装後の型検査・機能回帰・実ビルドでの性能効果は未検証**。成果の大きさや変更ファイル数の増加を点数の代替にしない。
