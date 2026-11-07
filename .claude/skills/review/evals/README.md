# レビュースキル群の評価手順

## 目的と対象

専門3スキルの発見能力と誤検出、統括 `review` の呼び分け・重複統合・検証状態の保持を別々に評価する。構造検査だけでレビュー品質が上がったとは主張しない。

## 専門スキルの比較

1. `review-rules/evals/cases.json`、`review-docs/evals/cases.json`、`review-quality/evals/cases.json` をそれぞれ固定入力とする。
2. 各ケースを独立した新規コンテキストで、同じモデル・同じ対象 ref・同じツール利用条件・同じ資料量でスキルなし／ありを1回ずつ実行する。スキルあり群にだけ評価対象の SKILL.md と参照文書を渡す。
3. 修正PR・コミットメッセージの不具合説明、`ground-truth.md`、他ケースの回答をレビュー担当に見せない。修正前／修正後のどちらかも教えない。
4. 生のレビュー結果と実行時間・トークン使用量・テスト／ブラウザ実行の有無を記録してから、各スキルの `ground-truth.md` を開いて採点する。
5. 指摘を実コード・規約・再現で確認する。確定した採点対象だけを使って真陽性（TP）、偽陽性（FP）、偽陰性（FN）を算出する。重大問題の見逃しを別に記録し、未再現の UI 事象や独立の要求根拠がないケースを確定欠陥の分母に混ぜない。
6. 適合率＝TP/(TP+FP)、再現率＝TP/(TP+FN)、F1＝2PR/(P+R)。分母が0、または未裁定の指摘によって値を確定できないときは未定義とし、理由を残す。最小のケース集合を全体品質の一般的な精度だと外挿しない。

## 統括スキルの評価

1. `orchestration-cases.json` の専門スキル出力を固定し、統括 `review` に「ここから結果を統合する」と指示する。専門レビューを再実行させない。
2. 統合出力を保存した後に `orchestration-ground-truth.md` を読み、重複の扱い、証拠が衝突する指摘、未実施の専門スキルの扱いを判定する。
3. 固定入力で合格した後に、3スキルの実出力を使った統合レビューを実施する。専門スキルの誤検出と、統合で生まれた誤りを分けて測る。

## 再実行・結果の記録

- リポジトリの版を固定する。リポジトリ全体を扱うときは対象 ref と同 SHA の Repository Snapshot Artifact を使い、HEAD を照合する。
- 人工的なケースは本番コードの欠陥ではない。断片だけから成立しない推測を真陽性としない。
- 構造検査は `python3 .claude/skills/review/evals/validate-fixtures.py` で行う。これは AI レビューの精度評価ではない。
- 結果には `ケースID / 群 / 確定Finding / 疑義 / TP / FP / FN / 未裁定 / 重大問題の見逃し / 検証済み件数 / 実行時間 / トークン / 未確認事項` を残す。
- 専門スキルの検出能力と確信度の扱いを別に見る。候補として発見しただけの問題を確定FindingのTPへ数えず、反対に候補を発見した事実を無かったことにしない。
- 採点対象は実行前に固定する。明確な契約違反・軽微な保守問題・環境依存の疑義を同じRecallに混ぜない。想定外の所見は監査してから両群へ同一の基準を適用し、探索的な追加評価として別に記録する。
- 評価ケースを変更した場合、それ以前の比較値を新ケースの実測値として引き継がない。旧版と新版の対象コミットを併記する。
- 独立実行環境がない場合は未測定とし、手作業で同一コンテキストの2条件を擬似比較した数値を掲載しない。

## 背景資料

- [Google Engineering Practices: Looking for issues](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
- [Anthropic Code Review Plugin](https://github.com/anthropics/claude-code/tree/main/plugins/code-review)
- [Claude Skill Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [OWASP Secure Code Review](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)

## 2026-11-07 の初回比較と判明した課題

- [PR #658 の検証コメント](https://github.com/hizahizi-hizumi/pa-zzle/pull/658#issuecomment-6703600633) に対象コミット `28993924efbcb9e26e19382c469b97537f129a63` で行った36回（専門15＋統合3ケースを各群1回ずつ）の測定方法・結果・未解決事項がある。
- 検証可能な既知陽性6件では、両群ともTP5・FN1。追加の探索的評価では、スキルなし8/10、スキルあり6/10。独立した単回比較であり、性能改善は実証されていない。
- 評価入力にゲーム配置規約が偶然適用された問題、機能契約が不明確な所見、実画面での再現不足が見つかった。今回のケース修正前の実測値を、修正後の評価ケースに適用しない。
- 現行の review-quality の primary 評価は CLAMP の1組のみで、一般品質の検出性能を測るには不足する。次回の精度評価に先立ち、独立した入出力契約に基づく欠陥・正常ケースを追加する。
- 将来の比較では、評価の独立性、入力の固定、反復・順序入れ替え、レビューから統合までの一連の処理を確認する。厳密なモデルID・トークン・コストが取得できない場合は未測定と記録する。

## 2026-11-07: 評価データの追加と比較再実行の条件

初回比較は検出性能の改善を確認できず、探索的評価ではスキルあり群の確定検出が少なかった。これは評価データだけでスキルの無効性を説明できないため、現行スキルの手順を変更せず、まず評価セットを補強する。

- 一般品質の確定評価を CLAMP（境界値）・IMMUTABLE（引数の非破壊性）・STALE（非同期応答の順序）の3組、計6ケースに増やした。`review-quality/evals/oracle-cases.json` は評価者専用の期待値であり、モデルへ渡さない。
- `node .claude/skills/review/evals/run-quality-oracles.mjs` を実行して、修正前の3ケースだけが契約に反し、修正後の3ケースはすべて成功することを確認する。
- `python3 .claude/skills/review/evals/validate-fixtures.py` で契約・入力・プロンプト・版が対照ケース間で一致し、全 primary にオラクルがあることを確認する。
- `python3 .claude/skills/review/evals/prepare-experiment.py --output /tmp/review-trial-001 --seed <任意の固定文字列> --domain review-quality` で、回答前に正解・群ラベルを渡さない対照入力を生成する。`reviewer-inputs/` のみを実行側へ渡し、`evaluator-only-manifest.json` と正解資料は評価側だけが保管する。
- 独立したレビュアーを各入力に割り当て、各入力の成果物を `<run>.txt` で保存する。`python3 .claude/skills/review/evals/score-runs.py --experiment /tmp/review-trial-001 --results <保存ディレクトリ> --output <未存在の出力ファイル>` で元の回答をハッシュ固定する。**このスクリプトはモデル実行・自動採点をしない。**
- 実験の際は対象コミットの検証済みファイル断面だけを渡す。正解表、前後の区分、修正コミットの説明、他の回答が見えないよう読み取り権限を制限する。指示だけのブラインドは強制隔離ではない。外部の GitHub 検索や修正履歴への参照を許せば情報漏洩となるため禁止する。
- 3対だけの検証は**最初の性能確認用**。規約・文書・統括を含む採用判定には、より広いケース、複数回の独立実行、実アプリへの副作用を検証する履歴ケースが必要となる。

## 検証する仮説と条件差

- 最初に「スキルなし」と「現在のスキル」を同じ入力・ツール・モデルで比較する（1要因）。未裁定の所見をFPやTPに数えない。候補の発見と確定Findingを別に計測する。
- その後だけ、`variants/review-quality-discover-first.md` の1文を追加する「発見先行」案を比較する。`prepare-experiment.py --domain review-quality --candidate` で3群の対照入力を作れる。独立評価前に候補を本体へ移さない。
- スキルの追加コスト（入力トークン・処理時間・実行費用）と、そのコストで減った見逃し・誤検出を同時に評価する。候補発見率が向上しても最終的な誤検出増やコストが不釣り合いなら採用しない。
- 実行可能なモデルや独立エージェントがない場合、予測値を計測値として書かず未実施とする。新しいケースの結果として初回比較の 5/6 を使い回さない。
