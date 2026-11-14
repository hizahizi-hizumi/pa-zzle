# #883 現状棚卸し（2026-11-14の測定）

## 位置付け

Issue #883の構造再編に先立つ**現況の観測**。現在の配置や規約を正当化する資料ではない。最終的な所有権・移動先・削除対象の決定は含まない。

調査基準：`main@2c470846ba31447b5f498bd2646e3121eba439a5`、Snapshot Artifact `14046136249`、SHA-256 `2c96a4889a463d9ff55afb7f44e94fe318a28577088ce95180662f225e1a97a7`。

## 規模と調査方法

| 対象 | 測定結果 |
|---|---:|
| リポジトリのファイル | 2,099 |
| ファイルが存在するディレクトリ | 419 |
| `frontend/src` の全ファイル | 1,442 |
| `frontend/src` の TS/TSX | 1,279 |
| 同TS/TSXのテスト | 438 |
| 非テストの静的ファイル間参照（重複除外） | 3,585 |
| 実装間の循環参照（複数ファイルからなる強連結成分） | 0 |
| 異なる具体ゲーム同士の直接参照 | 0 |

静的参照の件数は、importと再exportをローカルファイルへ解決した結果。動的import、`import.meta.glob`、CSSや生成設定、音声資産の収集、スクリプトからの参照は含まない。循環0や静的検査通過は、意味上の責務分担が適切であることの証明ではない。

| 現行領域 | ファイル数 | 実際に含まれる仕事 |
|---|---:|---|
| `frontend/src/games/` | 1,026 | 11ゲームのルール・問題・状態・評価・固有UI、共通契約 |
| `frontend/src/game-catalog/` | 62 | 登録、個別ゲームのアプリ接続、開始・再開・結果・遷移 |
| `frontend/src/components/` | 109 | 共通ゲームUI、shadcn/ui、アプリシェル、選択、設定 |
| `frontend/src/views/` | 62 | URLに対応する画面合成、ゲーム・記録・図鑑の接続 |
| `frontend/src/zukan/` | 51 | 問題収集・絞り込み・前回差分、ゲームホーム全体のUI |
| `frontend/src/records/` | 41 | プレイ記録、保存、自己ベスト、履歴UI、ホーム成績UI |
| `frontend/src/lib/` | 33 | 汎用処理、音・動き、起動、アプリ設定 |
| `frontend/src/pages/` | 29 | ファイルベースルーターのルート |
| `frontend/src/collection/` | 9 | ゲーム横断の最高評価・月別推移と表示 |
| `.claude/` | 98 | agents/rules/skills、開発コンテキスト |
| `docs/` | 330 | 正本、ADR、開発・検討資料 |
| `.github/` | 19 | CI、依存・スナップショット、Dependabot |
| `scripts/` | 26 | 全体検証、画面確認、資産生成、実験 |
| `backend/` | 4 | 環境定義・ロックファイル（サービス実装なし） |
| `tools/` + `.semantic-lint/` | 127 | 運用停止したsemantic-lint一式 |

ファイル数にはテスト・資産を含む。データの粒度・根拠を判断するときは、対象refのコードを再確認する。

## 責務境界の論点（未解決の候補）

| ID | 現行の観測 | 検討が必要な判断 |
|---|---|---|
| B01 | `records/` に記録契約・保存・記録画面UI | 機能固有UIと画面合成の境界 |
| B02 | `records/ui/PlayRecordsPerformance` はゲームホームから利用 | 成績UIの所有者 |
| B03 | `zukan/ui/GameHomeScreen` が図鑑以外のゲームホームUIも保持 | ゲームホームと図鑑の所有権 |
| B04 | `game-catalog/` が登録以外にプレイ・結果・ナビゲーションを接続 | カタログより広い統合境界の範囲 |
| B05 | `components/` に再利用UIとアプリ独自UI/状態が同居 | 共通UIをどこまでとするか |
| B06 | `lib/` に汎用処理と設定・出題条件が同居 | 汎用技術と機能固有判断の境界 |
| B07 | `lib/random-problem-settings.ts` → `zukan/zukan-collection.ts` | 出題状態の型をどこが所有するか |
| B08 | 記録のUI・表示変換から図鑑番号への2参照 | 問題番号・表示形式の所有者 |
| B09 | `collection/` に集計と記録画面の表示 | 集計機能と画面合成 |
| B10 | `pages/`、`views/`、`game-catalog/` がルーティングに関与 | 各境界が必要とするURL・遷移の責務 |
| B11 | semantic-lintが停止済みだが127ファイル残存 | 削除・履歴保全を別途評価 |
| B12 | Biomeが `lib → zukan` を禁止していない | パス単位の検査と意味上の責務との乖離 |
| B13 | 小さなディレクトリに規約由来のものが多数 | ファイル数・階層深さだけで統合しない |
| B14 | `game-catalog-entry.ts` はReact・Router・図鑑・記録を接続 | ゲーム統合の契約が適切な粒度か |

**B01〜B14は「判断対象として存在する」ことを確認した論点であり、全件が実装違反だという判定ではない。**

## 確認した直接参照

- `records/ui/PlayRecordsScreen/PlayDayList/PlayTimelineRow.tsx` → `zukan/ui/zukan-number-format.ts`
- `records/ui/play-timeline-entry-description.ts` → `zukan/zukan-number.ts`
- `lib/random-problem-settings.ts` → `zukan/zukan-collection.ts`

これらはファイル単位で存在する参照。移動するだけで妥当になるとは限らず、型・契約を誰が定義するかを先に決める。

## 変えてはいけない契約・周辺の設定

- 完了/離脱したプレイ記録、問題ID、結果画面の記録ID、旧版payload、図鑑閲覧値、利用者設定。
- `pages/` のURL、`views/` の合成、`game-catalog/` の具体ゲーム接続。
- 各ゲームの問題集・生成・難易度・評価。
- `frontend/scripts/dependency-rules.ts` と `generate-dependency-rules.ts`、`frontend/biome.json`、`.claude/rules` のpaths、ファイルベースルーター・Viteの参照契約。
- `import.meta.glob`で収集する音声等は、静的importが無いという理由で未使用扱いしない。

主な経緯：PR [#149](https://github.com/hizahizi-hizumi/pa-zzle/pull/149)・[#153](https://github.com/hizahizi-hizumi/pa-zzle/pull/153)・[#171](https://github.com/hizahizi-hizumi/pa-zzle/pull/171)・[#180](https://github.com/hizahizi-hizumi/pa-zzle/pull/180)・[#185](https://github.com/hizahizi-hizumi/pa-zzle/pull/185)・[#240](https://github.com/hizahizi-hizumi/pa-zzle/pull/240)・[#424](https://github.com/hizahizi-hizumi/pa-zzle/pull/424)・[#712](https://github.com/hizahizi-hizumi/pa-zzle/pull/712)、Issue [#249](https://github.com/hizahizi-hizumi/pa-zzle/issues/249)。

## 限界と再調査

元の調査では、現行位置・名前・エクスポート・静的参照から2,099ファイルと419ディレクトリを機械分類し、重要領域を実ファイルまで追跡した。**全ファイルの意味上の所有権を人手で確定したわけではない**。過去の一時台帳の機械分類を移動根拠としてそのまま採用しない。M2では最新refを用いて全候補を確定させる。
