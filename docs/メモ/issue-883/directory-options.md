# #883 M1 — ディレクトリ構成案2の詳細化

**状態：案2をベース案として深掘りした設計案。配置・契約変更は未採用。M1の具体判断は [ownership-decision.md](./ownership-decision.md)。** 設計確定・製品コード変更・正本規約変更を意味しない。

- 根拠：`main@2c470846ba31447b5f498bd2646e3121eba439a5`、同HEADのRepository Snapshot Artifact `14046136249`（ZIP SHA-256照合済み）。
- PO確認済みのA：`games/<game>/`、`games/`直下、`pages/`、`views/`、`components/ui/` の責務と物理境界を維持。既存ファイルの全配置を固定する意味ではない。
- 比較対象の旧案1と初期案2は以前の検討に基づくもの。**本書が現在の案2の具体化**であり、旧案2の機械的移動リストより優先する。
- **この案を検証する責務定義と継続検査を移動前に完成させる。** 開始ゲートは [ownership-governance.md](./ownership-governance.md)。42件の論理責務の一覧は [decomposition.md](./decomposition.md)。全2,099ファイルの移動先一覧と照合結果は [placement-audit.md](./placement-audit.md) と [file-placement-map.csv](./file-placement-map.csv)。本書は物理構造、依存契約、意図的に残す例外を説明する。

## 結論と前案からの修正

現行の一部を引き継ぎ、**`app/`を「他の責務を接続する側」／`features/`を「各機能の規則・情報を所有する側」／`components/`を「ゲーム横断の共通UI」／`lib/`を「共有される低レベルの実行・技術基盤」**に区別する。Aの境界は変更しない。

旧案から次を修正する。

1. `game-catalog/`の存在理由である「具体ゲームをアプリへ接続する仕組み」は`app/game-integration/`として残す。ただし他機能の共通処理を取り込まない。
2. `GameSelectionGallery`・`AppTitleScreen`・`app-home.ts`はPuzzleSelectionView専用なのでAの`views/PuzzleSelectionView/`へ吸収する。ゲームホーム共通の`GameHomeScreen`は図鑑専用ではなく、11ゲームの共通ホーム。**親と私有子コンポーネントは一組で**`app/game-home/`へ。子の名前だけで`features/zukan/`へ分割しない。
3. `collection/`と`zukan/`は独立した機能として保持。新たな`progress/`は作らない。`records/cleared-problem.ts`の共通変換を活用し、独立した達成ドメイン層を作るだけの根拠がない。**ただし記録画面専用のUIである`CollectionScreen`と`PlayRecordsScreen`はAの`views/PlayRecordsView/`へまとめる。** UIを機能フォルダに機械的に残さず、画面固有の合成をViewへ戻す。
4. 設定を機械的に全部`features/settings/`へ移さない。音量設定は`lib/sound-effects.ts`・`lib/background-music.ts`が直接利用する音声基盤の設定なので`lib/`に残す。出題条件は`features/random-play/`へ。ゲーム並び順と設定UIは`features/settings/`へ。
5. `BrandIdentityHeader`と`BrowserBottomSurface`は、`GamePlayFrame`・`GameResultScreen`などAのゲームが使う共通UIから参照されるので`components/`に残す。アプリシェルにまとめて移さない。
6. 画面固有のURL状態は`views/`へ。複数ルートで使う遷移とゲーム識別は`app/navigation/`へ。ルートのUI合成を`app/`に再実装しない。
7. `components/app-background-music.ts`および`lib/app-launch.ts`は現時点の共通UI・実行基盤の接続として維持。名前だけで`app/`に移すと`components→app`の逆依存が発生するため、実際の変更利益が出るまで分割しない。

## 提案するディレクトリツリー

※ PuzzleSelectionView専用の3種類の実装は既存Aに吸収し、ゲームホーム共通の実装だけをapp/game-homeに配置する。[M1の判断表](./ownership-decision.md)も参照。

```text
frontend/src/
├── frontend.tsx                       # アプリのエントリ、初期化
├── router.ts                          # ルーター契約
├── games/                             # A: 共通契約+各ゲーム
│   ├── difficulty.ts / play.ts / ...
│   └── <game>/                        # 11ゲーム（既存構造）
├── pages/                             # A: ファイルルート
├── views/                             # A: 1描画ルート1View
│   ├── PuzzleSelectionView.tsx
│   ├── PuzzleSelectionView/           # この画面専用のタイトル・選択UI
│   │   ├── app-home.ts
│   │   ├── AppTitleScreen.tsx
│   │   ├── GameSelectionGallery.tsx
│   │   ├── GameSelectionGallery.css
│   │   └── GameSelectionGallery/...
│   ├── PlayRecordsView.tsx
│   ├── PlayRecordsView/                # このView専用の2つの表示
│   │   ├── PlayRecordsScreen.tsx
│   │   ├── PlayRecordsScreen/...       # 履歴・カレンダー・日別リスト
│   │   ├── CollectionScreen.tsx
│   │   └── CollectionScreen/...        # 積み重ね・内訳・時系列
│   ├── play-records-location-state.ts # 記録一覧固有の戻り位置
│   ├── PlayResultView.tsx
│   └── <Game>{Home,Play}View.tsx / ...
├── app/                               # app→feature：複数責務の接続
│   ├── game-integration/              # カタログ登録・具体ゲームアダプター
│   │   ├── game-catalog.ts
│   │   ├── game-catalog-entry.ts
│   │   ├── playable-game.tsx
│   │   ├── recorded-game-result.ts
│   │   ├── internal-diagnostics-dialog.ts
│   │   ├── result-reward-sound.ts
│   │   ├── play-timeline.ts           # 記録を登録済みゲームの表示へ接続
│   │   ├── play-timeline-entry-description.ts # カタログ付き履歴の表示契約
│   │   ├── game-navigation.ts         # GameCatalogEntryを使う共通遷移
│   │   ├── use-random-play-entry.ts    # ゲームを指定した出題開始
│   │   └── <game>/                    # 各ゲームの3実装
│   │       ├── <game>-catalog-entry.tsx
│   │       ├── Playable<Game>.tsx
│   │       └── Recorded<Game>Result.tsx
│   ├── game-home/                     # 11ゲーム共通のホーム体験
│   │   ├── game-home.tsx
│   │   ├── GameHomeScreen.tsx
│   │   └── GameHomeScreen/...          # 元zukanの親専用子UIを一組で移動
│   ├── navigation/                    # カタログ非依存のURL・状態・遷移
│   │   ├── play-location-state.ts
│   │   ├── problem-id-query.ts
│   │   ├── record-result-location-state.ts
│   │   └── record-result-navigation.ts
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   └── AppShell/use-browser-surface.ts
│   ├── RandomProblemUnavailableDialog.tsx  # 全アプリで描く出題不能通知
│   └── random-problem-unavailable.ts       # 上の通知状態
├── features/                          # ドメイン固有の責務
│   ├── records/
│   │   ├── play-record.ts / play-attempt.ts / ...
│   │   ├── storage.ts / play-attempt-storage.ts
│   │   ├── play-record-definition.ts / personal-best.ts
│   │   ├── cleared-problem.ts
│   │   ├── hooks/
│   │   └── ui/                        # 自己ベスト/成績等の再利用UI。画面専用の履歴UIはviews側
│   ├── zukan/
│   │   ├── zukan-collection.ts
│   │   ├── zukan-filter.ts
│   │   ├── zukan-number.ts
│   │   ├── zukan-last-viewed.ts / zukan-last-viewed-storage.ts
│   │   ├── zukan-continuation.ts
│   │   └── ui/zukan-number-format.ts  # 図鑑番号の表示
│   ├── collection/
│   │   └── collection.ts               # 横断集計のみ。画面専用UIはviews側
│   ├── random-play/
│   │   ├── random-problem-selection.ts
│   │   └── random-problem-settings.ts
│   └── settings/
│       ├── game-selection-order-setting.ts
│       ├── GameCatalogContext.tsx     # 設定機能向けゲーム表示契約
│       ├── SettingsDialog.tsx / SettingsDialog/...
│       └── SettingsButton.tsx
├── components/                        # ゲーム横断の共有UI・表示契約
│   ├── ui/                            # A: shadcn/ui
│   ├── GamePlayFrame.tsx / PlayHeader.tsx / PlayHeader/...
│   ├── GameResultScreen.tsx / GameResultScreen/...
│   ├── TutorialOverlay.tsx / TutorialOverlay/...
│   ├── BrandIdentityHeader.tsx / BrandMark.tsx / ...
│   ├── BrowserBottomSurface.tsx
│   ├── GamePictogram.tsx / DifficultyLevelPieces.tsx / ...
│   ├── app-background-music.ts       # UI横断の音楽シーンの状態
│   └── app-decision-sound.ts         # 共通UI操作の音
└── lib/                               # 技術基盤、appやfeaturesへ依存しない
    ├── audio-context.ts / background-music.ts / sound-effects.ts
    ├── *music-setting.ts / sound-effects-setting.ts
    ├── stored-volume-setting.ts
    ├── app-launch.ts                 # 起動時の音の読み込み・タイトル待機
    ├── motion.ts / document-visibility.ts
    ├── internal-diagnostics.ts
    └── type-guards.ts / format-*.ts / utils.ts
```

このツリーは親と私有子の配置規則を守るための例示。`<game>`の3ファイルは変更範囲の代表名で、個々のゲーム名・実際のファイルの拡張子は現行のものに従う。

## 境界ごとの所有・非所有・依存

| 領域 | 所有する | 所有しない | 依存 |
|---|---|---|---|
| `games/`（A） | ゲーム規則、共通ゲーム契約、ゲーム固有UI | アプリ全体の機能合成・遷移 | 既存A規約、具体ゲームはrecordsの共通契約を利用可 |
| `views/`（A） | ルート1件のUI合成、URL値と画面固有状態、当該View専用の表示UI（記録一覧とコレクション等） | 共有機能の計算・保存 | app、features、components、games |
| `app/game-integration/` | 登録・ゲーム別アダプター・ゲーム能力と記録/図鑑/結果の接続 | 記録保存・図鑑進捗・出題条件の規則 | games、features、components |
| `app/game-home/` | アプリホームと11ゲームで共有するホーム画面の状態・組立・体験 | 図鑑/記録の正本 | game-integration、features、components |
| `app/navigation/` | カタログを知らなくても使えるURL状態・問題ID検索文字列・結果画面遷移 | GameCatalogEntryを使うゲーム固有の遷移・出題導線 | features、games共通契約、router |
| `app/shell/` とappルート | アプリ全体の外枠・全体通知・実行時の接続 | 機能固有規則、共通ゲームUI内部 | features、components、lib |
| `features/records/` | 完了/離脱の事実、保存、共通比較、画面横断で使う成績UI・表示契約 | 具体ゲームの採点、記録画面専用の合成 | games共通契約、lib、components/ui |
| `features/zukan/` | 問題別進捗、絞り込み、閲覧差分、番号 | ゲームホーム全体の画面合成 | records、games共通契約、lib |
| `features/collection/` | ゲーム横断の積み重ね・推移の導出 | 具体ゲームの表示・画面専用UI・記録の正本 | records、games共通契約、lib |
| `features/random-play/` | 出題条件と候補選択 | ルーター・具体ゲーム登録・設定画面 | zukan、records、games共通契約、lib |
| `features/settings/` | アプリ設定画面、並び順の選択値 | 音声再生エンジンの実装、出題条件の評価 | random-play、lib、components |
| `components/` | 全ゲームで共有するUI契約、表示とそれに不可欠なUI動作 | 具体ゲーム実装・機能の正本・appの合成 | games共通契約、lib、components/ui |
| `lib/` | ブラウザ・音声・起動時の低レベル処理、型検査等 | ゲーム/記録/図鑑固有規則 | 外部ライブラリ、汎用関数のみ |

重要：これはFSDの層を機械的に押し付けない構成。`features/`の下へ一律の`model/ui/api`階層を作らず、UIを所有する意味上の機能に置く。単に共通利用するからといって新しい`shared/`ディレクトリを増やさない。

## 実測した参照と修正対象

HEAD一致のSnapshotから、テストを含む静的参照5,071件（本番3,595件・テスト1,476件）の参照先をすべて解決し、全ファイルの移動先へ照合した。移動先の衝突は0件。具体的な全件台帳は [placement-audit.md](./placement-audit.md) と [file-placement-map.csv](./file-placement-map.csv)。

**旧案の「逆依存2参照」は過少計上だった**。`collection/collection.ts`が図鑑の型を参照するケースを含めると、改訂案の機械的な移動後に残る禁止方向の参照は**3件**ある。また、`game-navigation.ts`と`use-random-play-entry.ts`を単に`app/navigation/`へ移す旧案では`app/navigation ⇄ app/game-integration`というモジュール単位の相互参照も生じていた。これら2ファイルを`app/game-integration/`へ置くことで相互参照を解消する。

| 現行の参照元 → 参照先 | 原因 | 修正方針 |
|---|---|---|
| `collection/collection.ts` → `zukan/zukan-collection.ts` | CollectionSourceが必要以上に広い`ZukanPlaySource`型を参照 | `records/cleared-problem.ts`の既存`ClearedProblemSource`から必要項目を得る。`features/collection → features/zukan`を解消 |
| `game-catalog/random-problem-selection.ts` → `game-catalog/game-catalog-entry.ts` | 出題規則がapp固有の`GameCatalogEntry`を要求 | `features/random-play/`では`ZukanGameSource`等、実際に利用する能力を引数で受ける。app側で既存`toZukanGameSource`を使用 |
| `components/PlayHeader/PlayMenu.tsx` → `components/SettingsDialog.tsx` | 共通UIが設定機能のUIを直接実装 | GamePlayFrameの`renderSettingsDialog`を通してappが機能UIを提供。PlayMenuは`onOpenSettings`操作のみ |

これらは**まだソースコードを書き換えていない**。対処後に初めて提案したモジュール間の依存方向が成立する。

関連する配置の整理：

- `collection/ui/CollectionScreen.tsx`と親専用子UIは`views/PlayRecordsView/`へ移動。設定されたゲーム順やカタログ情報をView固有の表示で使えるため、わざわざ中継用DTOを増やさない。
- `records/ui/PlayRecordsScreen.tsx`と親専用子UIも`views/PlayRecordsView/`へ移動。図鑑番号などの表示はこの画面が必要に応じて接続する。
- `records/ui/play-timeline-entry-description.ts`は`app/game-integration/`の表示契約へ。記録の永続化と区別する。
- `lib/random-problem-settings.ts`は`features/random-play/`へ置くことで`lib→features/zukan`相当の意味的な逆依存をなくす。
- `lib/app-launch.ts`、音量設定、`components/BrandIdentityHeader.tsx`、`BrowserBottomSurface.tsx`は、利用側に不要なpropsやグローバル状態を導入しないため引き続き残す。これらは個々の役割が説明できるランタイム・共通表現であり、何でも置く場所として`lib/`を承認する意味ではない。

**静的解析の限界**：グループ単位では既存の`games ⇄ records`や`games ⇄ components`の参照が見えるが、ゲーム共通契約とゲーム固有のUI/接続が異なるため、これだけでファイル単位の循環を意味しない。相互参照を単純に禁止するのではなく、個々の責務間の方向を検証する。テストのmock対象、CSS、動的importや資産パスの変更はM3/M4で別途検証する。

### 共通プレイUIの設定ダイアログ：新しいグローバル仕組みを作らない

現在は`components/PlayHeader/PlayMenu.tsx`が`SettingsDialog`を直接importし、表示状態も所有している。しかし`SettingsDialog`を`features/settings/`へ移すと逆依存になる。

**提案**：既存の`renderHowToPlayDialog`・`renderTutorial`と同じ描画関数の受け渡しで解決する。

```text
app/game-integration/playable-game.tsx  # renderSettingsDialogを提供
  → games/<game>/ui/<Game>Play.tsx      # GamePlayScreenPropsを中継
  → components/GamePlayFrame.tsx       # settingsOpenを持ち、ダイアログを描く
  → components/PlayHeader.tsx
  → components/PlayHeader/PlayMenu.tsx # onOpenSettingsだけ受け取る
```

- `games/play.ts`の共通`GamePlayScreenProps`には`renderSettingsDialog(control)`を追加する。これはReactを扱える例外の`games/play.ts`内のUI契約であり、Aの物理境界は変えない。
- appの`usePlayableGame`が`features/settings/SettingsDialog`を描く関数を返す。`<Game>Play`を使う11ゲームは共通propsの中継のみ変更する。
- `GamePlayFrame`が`settingsOpen`を持ち、PlayHeaderへ`onOpenSettings`を渡す。PlayMenuはメニュー項目とクリック通知だけを持つ。
- 設定のための新しいグローバルイベントバス・React Context・app専用の設定UIラッパーは作らない。
- この設計は**実装前の推奨**。M3では既存のpropsとスコープを確認し、必要な型追加のみを確定する。

**注意**：静的な参照元と移動先を照合した設計診断であり、移動後にTypeScript・Biome・Vitestが通ったという検証ではない。生成・動的import・CSS・テストの変更はM3/M4で検証する。

## 責務42件と配置の対応

| ID範囲 | 提案所有者 | 説明 |
|---|---|---|
| G01–G05 | `app/game-integration/` | 登録、具体ゲームの接続、プレイ・結果復元 |
| G06 | `app/navigation/` + `app/game-integration/` + ルート固有は`views/` | ゲーム登録情報を要する遷移はgame-integration、URL値はnavigation |
| G07 | `views/PuzzleSelectionView/` | このView専用のゲーム選択・タイトル・ホーム合成 |
| G08 | `app/game-home/` | 11ゲーム共通ホーム。図鑑と記録はfeaturesへ委譲 |
| R09–R12、R14–R15 | `features/records/`と`app/game-integration/` | 事実・保存・比較・再利用成績UIをrecords、ゲームごとの履歴説明をappが接続 |
| R13 | `views/PlayRecordsView/` | 記録一覧専用UIと子コンポーネント |
| R16 | `features/records/cleared-problem.ts` | 記録を図鑑・コレクション向けに変換する共通契約 |
| P17–P23 | `features/zukan/` + `app/game-home/` | 図鑑の計算とゲームホーム全体のUIを分離 |
| P24 | `features/collection/` | コレクションの計算 |
| P25 | `views/PlayRecordsView/` | コレクション表示はこの画面専用UIとして合成 |
| S26–S28 | `features/random-play/` + `app/game-integration/` | 出題規則・条件と、GameCatalogEntry付き開始導線を分ける |
| S29–S30 | `features/settings/` + 音声設定は`lib/` | 設定UI、並び順、再生エンジン設定 |
| U31 | `views/PuzzleSelectionView/` | このView専用のゲーム選択体験 |
| U32–U34 | `components/` | ゲーム横断のプレイ・結果・チュートリアル共通UI |
| U35 | `app/shell/`と`components/` | シェルの合成はapp、共通の帯・面はcomponents |
| U36 | `components/` | ピクトグラム・共通表示 |
| T37・T39–T40 | `lib/` | 音声・動き・型ガード・整形 |
| T38 | `components/app-decision-sound.ts`等 + `app/game-integration/` | 音の方針を実際に使うUI・プレイ接続が持つ |
| T41 | `frontend.tsx` + `app/shell/` + `lib/app-launch.ts` | エントリ・シェル・起動ランタイム |
| T42 | `lib/internal-diagnostics.ts` + `components/InternalDiagnosticsDialog.tsx` + `app/game-integration/` | 診断の環境・UI・個別ゲーム接続 |

## 依存の受入条件

- `app/`は`games/`・`features/`・`components/`・`lib/`を使用してよい。具体ゲームの11種類のimportは原則`app/game-integration/`（または既存Aのゲーム固有View）が所有する。
- `features/`は`app/`・`views/`・`pages/`・具体ゲームの内部をimportしない。機能間参照は一方向で、`zukan→records`、`collection→records`、`random-play→zukan/records`、`settings→random-play`を許容する。逆向きの参照は不可。
- `components/`は`app/`・`features/`をimportしない。共通の画面表現は`games/`の共通契約と`lib/`のみを用いる。
- `lib/`は`app/`・`features/`・`components/`・`games/`の内部へ依存しない。
- **具体ゲームの`play-record.ts`がrecordsの共通契約を参照する既存関係は保持してよい**。ただしrecords中核は`games/<game>/`を直接参照しない。参照の方向を「具体ゲーム→記録共通契約→games直下の共通契約」のようにファイルの層を見て定義し、トップレベルのフォルダ同士に単純な非循環を強制しない。
- 物理的なfeatureディレクトリ名を`features/`に変えるだけで完全に分離できたとみなさない。**移動前に新構造の静的検査を実装・実証**し、上の逆依存や表示契約を修正してから物理移動する。

## 移動を開始するための工程・受入条件

**M1：責務と配置の正本を確定**。この案の所有・非所有、相互依存の方向、名前、新設条件、許される例外を確認し、`.claude/rules/`等の規約として採用するか決める。Aの5境界は確定済み。

**M2：移動前にBiomeとCIで検査を実装・実証**。`frontend/scripts/dependency-rules.ts`、生成`biome.json`、既存Vitest、必要な`.claude/rules/`を揃え、現行構造を維持したまま新しい`app/`・`features/`の禁止参照が実際に失敗することを示す。**M2完了まで製品コードを移動しない**。

**M3：全件の意味的な所有者と移行順序を確定**。2,099ファイルの[仮配置台帳](./file-placement-map.csv)と移動候補191件を、M1/M2の確定済み判定で検証する。3件の依存契約修正、PR分割、コード生成・ルーター・保存データ・UIの回帰項目を設計する。

**M4：検査を有効にしたまま移動**。契約を整理してから意味単位で移動し、毎PRでBiome・型検査・Vitest・ビルド・必要なPlaywrightを実施する。最後に旧`game-catalog/`等の参照・旧境界専用の例外を撤去する。作業中にmainを取り込まない。

## 整理して不要になった抽象化

- `features/collection/ui/`を独立に保つ必要はない。コレクションのUIは現在`PlayRecordsView`以外で利用されず、画面固有の組み立てである。
- `features/records/ui/PlayRecordsScreen/`も現在は当該Viewの内部である。記録を表示するというだけで機能内に置かず、親Viewの私有UIとして扱う。
- `CollectionDisplayGame`のような中継用DTOや、表示するためだけのprops注入は追加しない。
- UIや音楽などの技術分類だけを目的に`app/audio/`等の新しい階層を追加しない。

## まだ確定していないこと

- これらの名前とディレクトリを正式に採用するか。A以外の責務・配置は、POの「案2をベースに詰める」という方向性に基づく**設計提案**であり、採用確定ではない。
- 設定ダイアログの操作は上記`renderSettingsDialog`による既存のUIスロット方式を推奨。ただし実際の共通props変更が他の機能へ波及しないか、M3の差分で検証する。
- 大きな`GameCatalogEntry`を機能ごとの能力契約へ細分化するか。移動時の必須条件ではない。実際に変更理由が独立したときのみ分ける。
- 共通の図鑑・コレクション型を置く`progress/`は現時点で**作らない**。共通の規則が新たに成立した場合のみ再評価する。

関連：[Issue #883](https://github.com/hizahizi-hizumi/pa-zzle/issues/883) ／ [retention.md](./retention.md) ／ [decomposition.md](./decomposition.md) ／ [inventory.md](./inventory.md)。
