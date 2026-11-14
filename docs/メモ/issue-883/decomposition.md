# Issue #883 M1 — 残余責務の総覧と統廃合の候補

**状態：検討用の全体一覧。責務の統合・分離・新ディレクトリの確定ではない。**

- 判断基準：`main@2c470846ba31447b5f498bd2646e3121eba439a5`（対象HEADを検証したRepository Snapshot Artifact 14046136249）。対象は主としてAを除く `frontend/src` の本番実装。リポジトリのCIや資料・停止済みツールは別の棚卸し結果 `inventory.md` を参照。
- AとしてPOが維持を確認したのは `games/<game>/`、`games/`直下、`pages/`、`views/`、`components/ui/` の5境界。
- **現行ディレクトリ名から責務を定義しない**。各行は小さめの「何を決めるか」という機能単位であり、ファイル分割やフォルダ数には対応しない。
- 表の例は根拠となる実装の一部。機械的な全件ファイル分類とは区別する。個々のファイルの最終的な所有者は、M1で責務定義・M2でBiome/CI検査を確定した後、M3で決定する。

## 1. 残っている責務（42件）

| ID | 責務 | 実在する実装の例 | 統廃合時の論点 |
| --- | --- | --- | --- |
| G01 | ゲーム一覧・検索 | game-catalog/game-catalog.ts | 登録・接続 |
| G02 | アプリがゲームから使う能力の契約 | game-catalog/game-catalog-entry.ts | 登録・接続 |
| G03 | 11ゲームごとの接続アダプター | game-catalog/<game>/{*catalog-entry,Playable*,Recorded*Result} | 登録・接続 |
| G04 | プレイ中の共通進行・記録との接続 | game-catalog/playable-game.tsx、records/hooks/ | プレイ接続 |
| G05 | 記録からの結果復元・結果画面への接続 | game-catalog/recorded-game-result.ts | プレイ接続 |
| G06 | URL・問題指定・再プレイ・画面間遷移 | game-catalog/*navigation*、*location-state*、problem-id-query.ts、records/play-records-location-state.ts | 画面合成とナビゲーション |
| G07 | アプリホームのゲーム選択・再開情報 | game-catalog/app-home.ts | アプリホーム |
| G08 | ゲームホームの情報・状態・画面合成 | game-catalog/game-home.tsx、zukan/ui/GameHomeScreen* | ゲームホーム |
| R09 | 完了したプレイの記録・識別・保存 | records/{play-record,save-play-record,storage}.ts | プレイ記録 |
| R10 | 途中経過・離脱したプレイの記録・保存 | records/{play-attempt,play-attempt-storage}.ts | プレイ記録 |
| R11 | 記録の評価指標・比較・自己ベスト | records/{play-record-definition,personal-best}.ts | プレイ記録 |
| R12 | 日別履歴・カレンダー・記録の説明 | records/play-timeline.ts、game-catalog/play-timeline.ts | プレイ記録＋画面接続 |
| R13 | 記録一覧画面の機能固有表示 | records/ui/PlayRecordsScreen* | プレイ記録の表示 |
| R14 | ゲームホームの成績・推移表示 | records/ui/PlayRecordsPerformance*、zukan/ui/.../GameHomePerformance.tsx | 成績表示 |
| R15 | 記録更新のフィードバック・記録の書き出し | records/ui/result-record-feedback.ts、records/play-record-copy.ts | プレイ記録（別用途として保持） |
| R16 | クリア記録を問題単位の事実に変換 | records/cleared-problem.ts | 記録と進捗の接続 |
| P17 | 問題単位の図鑑進捗を導出 | zukan/zukan-collection.ts | 図鑑 |
| P18 | 図鑑の難易度・成績・問題特徴による絞り込み | zukan/zukan-filter.ts | 図鑑 |
| P19 | 前回閲覧状態・図鑑の変化検出 | zukan/zukan-last-viewed*.ts | 図鑑 |
| P20 | 前回の続き・図鑑からのプレイ導線 | zukan/zukan-continuation.ts、zukan/ui/.../zukan-play-entry.ts | 図鑑＋プレイ接続 |
| P21 | 図鑑の一覧・詳細・絞り込みのUI | zukan/ui/GameHomeScreen/Zukan*、GameLevelCards* | 図鑑表示 |
| P22 | 図鑑の発見演出・スタンプ・効果音 | zukan/ui/GameHomeScreen/*change-reveal*、*stamp* | 図鑑体験 |
| P23 | 図鑑内の問題番号・番号表示契約 | zukan/zukan-number.ts、zukan/ui/zukan-number-format.ts | 図鑑と記録の表示契約 |
| P24 | ゲーム横断の収集・成績の集計 | collection/collection.ts | 横断進捗 |
| P25 | 横断コレクション画面の機能固有UI | collection/ui/CollectionScreen* | 横断進捗の表示 |
| S26 | ランダム出題の候補抽出・選択 | game-catalog/random-problem-selection.ts | 出題 |
| S27 | ランダム出題の開始・選択不能時の案内 | game-catalog/use-random-play-entry.ts、lib/random-problem-unavailable.ts、components/RandomProblemUnavailableDialog.tsx | 出題と画面接続 |
| S28 | ランダム出題条件の選択値・保存 | lib/random-problem-settings.ts | 出題条件／設定 |
| S29 | 音量・再生可否・ゲーム並び順等の設定値保存 | lib/*-setting.ts、lib/stored-volume-setting.ts | 利用者設定 |
| S30 | 設定画面と各設定項目のUI | components/SettingsDialog*、components/SettingsButton.tsx | 利用者設定 |
| U31 | ゲーム選択のギャラリー・カルーセル | components/GameSelectionGallery* | アプリホームの表示 |
| U32 | 共通プレイ画面の外枠・ヘッダー・操作 | components/GamePlayFrame.tsx、PlayHeader*、UndoButton.tsx等 | 共通ゲームUI |
| U33 | 共通結果画面・結果指標・採点基準の表現 | components/GameResultScreen*、game-result-*.ts | 共通ゲームUI |
| U34 | 共通チュートリアル・遊び方の表示 | components/Tutorial*、HowToPlay* | 共通ゲームUI |
| U35 | アプリ外枠・ブランド・戻る導線 | components/{AppShell,AppTitleScreen,Brand*,HomeBackLink,BrowserBottomSurface}* | アプリ共通UI |
| U36 | ゲームの図像・難易度・問題特徴の共通表現 | components/{GamePictogram,DifficultyLevelPieces,problem-features}* | 共通表示契約 |
| T37 | 効果音・BGMの再生エンジン | lib/{audio-context,sound-effects,background-music}* | 音声技術 |
| T38 | 画面・選択・結果ごとの音楽・効果音ポリシー | components/{app-background-music,app-decision-sound,game-result-sound}.ts、game-catalog/result-reward-sound.ts | アプリ体験の音 |
| T39 | 動き・ブラウザの可視状態・タップ入力補助 | lib/{motion,document-visibility}.ts、components/touch-tap.ts等 | 技術共通処理 |
| T40 | 日時・数値の整形、型ガード等の小さな共通処理 | lib/format-*.ts、lib/type-guards.ts、lib/utils.ts | 技術共通処理 |
| T41 | アプリ起動・ルーター・全体コンテキスト | frontend.tsx、router.ts、lib/app-launch.ts、components/GameCatalogContext.tsx | アプリ起動 |
| T42 | 開発者向け内部診断と診断UI | lib/internal-diagnostics.ts、game-catalog/internal-diagnostics-dialog.ts、components/InternalDiagnosticsDialog* | 開発支援 |

## 2. 上位への集約（あくまで比較用の6つの束）

| 論点をまとめる単位 | 該当ID | 共有する目的 | この段階で避ける誤解 |
| --- | --- | --- | --- |
| ゲーム提供・接続 | G01–G08 | 登録と能力契約／ゲーム別アダプター、プレイ・結果接続、ナビゲーション、ホーム | 登録が画面・出題・記録を所有する構造は採らない |
| プレイ記録 | R09–R16 | 完了・未完了の事実、比較、時系列、表示、結果通知、進捗用の変換 | 記録の正本と進捗の派生データを区別 |
| 問題の進捗・収集 | P17–P25 | 図鑑の集計・絞り込み・閲覧差分・表示・演出、横断コレクション | 図鑑とコレクションの物理統合は未決定 |
| 出題・設定 | S26–S30 | ランダム出題と選択条件、利用者設定値と編集UI | 設定値の保存と出題方針の適用を混同しない |
| 共通の画面体験 | U31–U36 | ゲーム選択、プレイ、結果、チュートリアル、ブランド、図像 | 機能固有UIを何でも共通部品に移さない |
| 基盤・開発支援 | T37–T42 | 音声エンジン、場面別の音、ブラウザ補助、整形、起動、診断 | 場面別の判断と低レベル技術実装を分ける |

6つの束を6ディレクトリへ変換するわけではない。例えば、`G06` の画面固有URL状態は既存Aの `views/` に吸収できる一方、複数ルートで使う共通遷移契約には独立した所有者が要る場合がある。

## 3. 統合・分離・吸収の仮説

| 方向 | 対象ID | 評価の理由 |
| --- | --- | --- |
| 統合候補 | G01+G02+G03 | ゲームの登録、能力契約、11ゲームのアダプターを「アプリとゲームの接続」という一つの目的で評価。物理配置は未決定。 |
| 既存Aへ吸収候補 | G06、G07、G08の画面固有の合成 | URL状態と画面固有の接続は既存の`views/`に属し得る。全ゲーム共有の実装までViewへ11重複させない。 |
| 機能の所有範囲へまとめる候補 | R09–R15 | 完了記録・途中記録・評価比較・履歴・表示は「記録」へ帰属し得る。保存と表示を無条件に物理分割しない。 |
| 接続処理として残す候補 | G04+G05、R16 | プレイ・結果・記録・図鑑をつなぐ処理。単純な中継は所有側へ吸収し、契約が必要なものだけ独立させる。 |
| 上位概念で統合、下位は分離を検討 | P17–P25 | 共通の「問題ごとの進捗」という言葉で図鑑と横断集計を束ねられるが、表示単位や変更理由が違うため、物理統合は別判定。 |
| 境界を整理する候補 | S26+S27+S28、S29+S30 | 出題条件の意味は出題側、選択値の保存と編集は設定側。共通の設定機構は活かす。 |
| 意味で統合・整理する候補 | U31–U36 | 共有するUI契約を維持し、アプリ固有のホーム・選択・ブランド表現を何でも汎用コンポーネント扱いしない。 |
| 境界を維持し、所属を見直す候補 | T37–T42 | 技術的再利用（音声エンジン・ブラウザ・型ガード）と、画面ごとの音の判断・起動・開発診断を区別する。 |

## 4. 独立した責務としては廃止を検討するもの

以下は機能を削除するという意味ではない。

- **何でも置ける `game-catalog/`**：登録・接続の目的は有効だが、記録履歴・出題・画面固有状態・音声の判断までカタログが所有する必然性はない。
- **何でも置ける `lib/`**：型ガードや音声再生などの共通技術処理は必要。ただし、図鑑の問題状態・出題条件・画面の音楽選択を「libだから」で置かない。
- **何でも置ける `components/`**：共通プレイ/結果/チュートリアルUIは有効。ただし、アプリホーム・設定・ゲームホームの体験全体を汎用UIとして扱う必要はない。
- **図鑑＝ゲームホーム全体**：図鑑固有の情報と、成績・メニュー・ナビゲーションを持つゲームホーム全体は、同じ理由で変更されるとは限らない。
- **使われる画面が違うから、共通の記録UIをすべて`views/`へ移す**：これは「廃止する設計判断」の候補。機能のUIは機能が所有してよい。

上記は「独立境界の存在理由を再評価する」候補であり、`game-catalog/` 等のディレクトリ削除は**未決定**。

## 5. 評価順序：ディレクトリ単位ではなく全42件を同じ基準で比較

1. 似た仕事をする行を仮に統合し、**同じ不変条件・同じ変更理由か**を検証する。
2. 同じデータを使うだけで意味が違う行（記録された事実と図鑑の導出値、音声エンジンと再生タイミングなど）は分離する。
3. 既存Aへ吸収すべき画面合成・ゲーム共通契約を先に除く。
4. 実際に独立させる価値のあるものにだけ、物理モジュールの境界と公開契約を与える。
5. 統合で循環や巨大な契約ができる場合は再分割し、分割が中継・重複を増やすだけなら再統合する。
6. M1で論理責務と統廃合・配置の基準を確定し、M2で新境界のBiome/CI検査を移動前に実証する。M3で全ファイルの所有者・移行計画を決定し、M4で初めて移動する。

### 次に確認すること

この42件について、`統合する`、`分ける`、`既存Aへ吸収する`、`独立させる` の仕分けと境界を先に確定する。**最初の議題をgame-catalogに限定しない**。既存規約が判断と矛盾すれば正本規約を見直すが、確定前に規約へ反映しない。

関連： [維持する設計](./retention.md) ／ [現状棚卸し](./inventory.md) ／ [Issue #883](https://github.com/hizahizi-hizumi/pa-zzle/issues/883)。
