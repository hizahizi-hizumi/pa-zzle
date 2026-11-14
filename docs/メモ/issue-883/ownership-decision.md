# #883 M1 — 案2の責務・配置を確定するための判定資料

**状態：B/Cを決めるための具体案。Aの5境界は確認済み、B/Cと新ルールはまだ採用確定ではない。** 2026-11-14の`main@2c470846ba31447b5f498bd2646e3121eba439a5`とHEAD一致のSnapshot `14046136249`を基準とする。

## 1. 具体的な配置

```text
frontend/src/
├── games/                           # A：共通契約・各ゲーム（既存のまま）
├── pages/                           # A：ルート（既存のまま）
├── views/                           # A：画面合成
│   ├── PuzzleSelectionView.tsx
│   ├── PuzzleSelectionView/         # そのViewだけの部品
│   │   ├── app-home.ts
│   │   ├── AppTitleScreen.tsx
│   │   ├── GameSelectionGallery.tsx
│   │   ├── GameSelectionGallery/
│   │   └── GameSelectionGallery.css
│   ├── PlayRecordsView.tsx
│   └── PlayRecordsView/             # PlayRecordsScreen・CollectionScreen一式
├── app/                             # 他責務をアプリへ接続
│   ├── game-integration/            # 11ゲームの登録・アダプター・開始/結果
│   ├── game-home/                   # 11ゲーム共通のホームUIとその合成
│   ├── navigation/                  # カタログを知らないURL・共通遷移
│   ├── shell/                       # アプリ全体の外枠
│   └── RandomProblemUnavailableDialog.tsx
├── features/
│   ├── records/                     # 記録の正本・試行・自己ベスト・共通成績UI
│   ├── zukan/                       # ゲーム別の問題進捗・閲覧差分
│   ├── collection/                  # ゲーム横断の集計（画面はView）
│   ├── random-play/                 # 問題の候補選択・条件
│   └── settings/                    # 設定画面・並び順・選択用ゲーム情報
│       └── GameCatalogContext.tsx   # frontend.tsxが具体ゲームの一覧を渡す
├── components/
│   ├── ui/                          # A：shadcn/ui
│   └── ...                          # ゲーム共通UI、利用箇所に付随するUI動作
└── lib/                             # 型ガード・音声等の共通技術・ランタイム
```

`frontend.tsx`・`router.ts`・`assets/`・`testing/`はそれぞれ既存の意味を維持する。新しいFSDの定型階層（`model/ui/api/shared`）を無条件に作らない。

## 2. 所有境界を確定する候補

| 領域 | 所有するもの | ここに置かないもの |
|---|---|---|
| `app/game-integration/` | ゲームの登録・検索、具体ゲームのアダプター、カタログ情報を使うプレイ・結果・履歴・遷移の接続 | 図鑑計算、記録保存、ランダム選択のアルゴリズム |
| `app/game-home/` | 11ゲームが共通して利用するゲームホームの合成、図鑑と記録の画面への接続、そのホーム専用の表示・動き | 図鑑の進捗と記録データの正本、アプリホーム（パズル選択） |
| `app/navigation/` | ゲームの登録情報を要求しないルート共通のURL・location stateの契約と遷移 | `GameCatalogEntry`に依存するゲーム開始・登録済みゲームの遷移 |
| `app/shell/`と`app/`直下 | アプリ全体の外枠・アプリ全域の通知・起動時の画面接続 | 1つのViewの私有UI、機能の規則、共通プレイUI内部 |
| `features/records/` | 完了・離脱したプレイの事実、永続化、履歴・自己ベストの共通計算、複数画面で使う成績UI | ゲーム固有の採点、画面の履歴・コレクションの合成 |
| `features/zukan/` | 問題の一覧・進捗・絞り込み・閲覧差分・問題番号 | ゲームホーム全体のUI、横断コレクション |
| `features/collection/` | ゲーム横断の集計・推移の計算 | 記録の正本、図鑑の型、PlayRecordsView専用のコレクション画面 |
| `features/random-play/` | 出題条件・状態保存、候補の抽出・ランダム選択 | ゲーム固有の問題生成、アプリのルート・具体ゲーム登録 |
| `features/settings/` | 設定画面・ゲームの並び順設定、設定画面に渡す表示用ゲーム一覧の契約 | 各設定が影響する別機能の規則、音声エンジンの設定保持 |
| `components/`（`ui/`以外） | ゲーム横断のプレイ・結果・チュートリアル等の共通UIと、その利用に不可欠なUI動作 | 画面固有のUI・機能の正本・具体ゲームの登録 |
| `lib/` | 機能固有ではない型ガード・整形・音声エンジン・ブラウザ技術と、共有される小さな実行基盤 | 進捗・記録・出題等の意味判断 |
| `views/<View>/`（Aの内側） | 1つのルートでだけ必要なUIと状態・複数機能の表示用の合成 | 複数画面に公開する機能固有の計算 |

`GameCatalogContext.tsx`は現在、`SettingsDialog`とその子がゲーム表示データを取得するためだけに使い、`frontend.tsx`がその値を供給している。型を`GameCatalogEntry`に結合させず、設定機能の小さな入力契約として持つ。`app-home.ts`、`GameSelectionGallery*`、`AppTitleScreen*`は`PuzzleSelectionView`のみが所有する表示であるため、`app/game-home/`へは入れない。

`lib/app-launch.ts`は共有起動ランタイムの限定例外として維持する。許容する契約は`startAppLaunch`・`enterApp`・`getAppLaunchTitle`・`subscribeAppLaunchTitle`によるタイトルの読み込み進捗・開始・終了・購読だけで、ほかのアプリ固有機能を`lib/`へ置く先例としない。音声の取得・再生は`lib/audio/`に委ね、画面に応じた選曲は`app/shell/`が所有する。

## 3. 依存方向の候補

```text
pages  → views
views  → app / features / components / lib / games
app    → features / components / lib / games
features/settings    → features/random-play / lib / components
features/random-play → features/zukan / features/records / lib / games共通契約
features/zukan       → features/records / lib / games共通契約
features/collection  → features/records / lib / games共通契約
features/records     → lib / games共通契約 / components共通UI（UI層のみ）
components           → lib / games共通契約 / components/ui
lib                  → 同一の技術基盤・外部ライブラリのみ
games/<game>         → 自ゲーム/共通ゲーム契約/既存の記録共通契約/共通UI
```

- `features/`から`app/`・`views/`・`pages/`、別の具体ゲームの内部を参照しない。
- `features/collection/`から`features/zukan/`を参照しない。両者は`features/records/cleared-problem`の共通契約を利用する。
- `app/navigation/`から`app/game-integration/`を参照しない。必要なときは`app/game-integration/`がナビゲーションの契約を利用する。
- `components/`から`app/`・`features/`を参照しない。設定UIのような機能固有の表示はアプリが描画関数等を渡す。
- `lib/`から`app/`・`features/`・`components/`等の機能・UIを参照しない。
- 全ゲーム共通の型と具体ゲーム内部は分け、`games/<game>/play-record.ts`等が`features/records/`の共通契約を利用する既存の例外を維持する。
- `components/ui/`は上流形状を保つ既存のBiome対象外例外。**Biomeで検査済みという誤認をしない**。

## 4. 未知の責務も判定できる構造の決め方

**現在あるフォルダ名を分類の正解としない。** まず何が一つの責務かを決め、適切な所有者を探し、その後に必要な物理境界を選ぶ。どこにも該当しない場合に`app/`、`features/`、`lib/`へ強制的に収容しない。

### 4.1 先に責務を言語化する

新しい処理が現れたとき、以下を一組で判断する。

| 問い | 判断対象 |
|---|---|
| 何を決めるか | どんな規則・状態・結果・不変条件を所有するか |
| 何を決めないか | 画面、個別ゲーム、再生技術、利用元などのどこまでを含めないか |
| なぜ独立するか | 既存の責務と異なる理由で変更され、分離すると変更を局所化できるか |
| どのAPIを公開するか | 利用者が必要とする最小の契約を定義できるか |
| 依存方向は成立するか | 自分が参照する先と、自分を参照する側が相互依存にならないか |

`music`や`settings`のような**名詞だけでは責務の定義にならない**。例えば「どの場面でどのBGMを流すか」と「音声を読み込み途切れずに再生するか」は別の変更理由・規則を持つ。

### 4.2 所有者を決めてから階層を選ぶ

- 特定のゲームの遊びを成り立たせる規則・表現なら`games/<game>/`。全ゲームに同じ意味で共通する**ゲームの契約**なら`games/`直下。ただゲームから使うだけで共通ゲーム契約にはしない。
- 1画面の合成・私有UIなら`views/<View>/`。ルート定義は`pages/`。
- 複数のゲーム・機能をアプリに接続する判断なら`app/`。独立した機能の規則・状態なら`features/<name>/`。アプリ全体に見えるという理由だけで`app/`へ入れない。
- 意味と操作が共通のUIは`components/`、機能を知らない技術処理は`lib/`。利用先の多さだけでいずれかへ移さない。
- **いずれにも所属せず、独立した一級の責務が成立するなら`frontend/src/<name>/`を新設する。** 禁止でも最後の妥協先でもない。既存の抽象階層に押し込むと契約や依存方向が歪む場合に選ぶ。

新設する高さは、ファイル数や利用画面数ではなく**責務の所有範囲と依存する相手**で決める。同じ新責務でも、1ゲームに閉じるならゲーム内、アプリの機能として閉じるなら`features/`、複数の既存の上位領域から使われる独立した基盤・領域ならトップレベルを検討する。利用者が複数いることは必要十分条件ではない。

### 4.3 トップレベル新設の条件

`frontend/src/music/`のように`games/`と並列のディレクトリを作る場合、次を説明できること。

1. 既存の`app/`や`features/`の下位機能ではなく、それらと独立して責務・規則・状態・公開APIを持つ。
2. 既存のいずれかへ押し込むと、別のトップレベル領域からの逆依存、機能規則と技術基盤の混在、所有者不明の公開契約が生じる。
3. トップレベルを独立させると、**利用側→新領域**という安定した依存方向になる。新領域はアプリや各ゲームの内部を知らない。
4. 新領域が所有しないものを明記でき、似たコードを何でも集める`music/`・`common/`にならない。
5. 追加する公開契約・Biomeの依存制約・実効テスト・新設の理由を、同じ変更で管理する。全体構造を変える判断はADRに記録する。

該当先が見つからない場合は**配置を未判断として扱い、責務の定義を見直す**。暫定的に`lib/`や`app/`へ入れて負債化しない。まず単なる処理の混合ではないかを分け、それでも新責務が残るなら適切な高さで新設する。

### 4.4 musicを仮に追加する場合

現行の音声実装を使った比較例。**この表は今すぐ音声コードを移動する決定ではない。**

| 新しい要求・責務 | 所有者の候補 | 理由 |
|---|---|---|
| 音声の取得・復号・ループ・フェード・出力の仕組み | 既存`lib/`の音声モジュール | Web Audioと再生の技術規則。音楽機能の画面やルートを知らない |
| 選ぶ・解く・結果、チュートリアルに応じたBGM選択 | `app/`のアプリ全体の音の接続 | URL・プレイ状態・場面を結ぶアプリの判断。音声エンジンと別の所有者 |
| あるゲーム独自の操作音・演出音 | `games/<game>/` | ゲーム固有の操作と題材が音の意味を決める |
| BGMの設定画面 | `features/settings/` | UIと利用者操作。音量の保持・再生自体はエンジンの責務に残り得る |
| 音楽ライブラリ、曲の選択、再生リスト、解放条件など独立した製品上の音楽体験 | `features/music/` | アプリの新しい独立機能ならfeatureになる |
| アプリとゲームの双方から利用する、独立した音響領域の規則・状態・API | **`music/`または`audio/`をトップレベルで検討** | app・gamesを利用者として持ち、どちらにも所有されない独立領域なら昇格する。効果音も含むなら`audio/`等、実際の責務に合う名前にする |

例えば、仮にトップレベルの音響領域を作っても、`music/`に画面ルートやゲーム固有の効果音まで入れるわけではない。

```text
frontend/src/
├── music/                # 独立した再生・曲選択契約（新設が妥当な場合のみ）
├── app/                  # 画面・進行状態から音楽への要求を決める
└── games/<game>/         # ゲーム固有の音の意味・タイミング
```

依存は`app → music`、必要な場合`games/<game> → music`であり、`music → app`や`music → games/<game>`にはしない。もし音楽のAPIがルート・具体ゲームの実装を要求するなら、まだ責務を分離できていないので、そのままトップレベルへ昇格させない。

音声の再生技術は`lib/audio/background-music.ts`、画面に応じたBGM選択は`app/shell/app-background-music.ts`、各ゲームの操作音は`games/play-sound-effects.ts`等が所有する。**「musicのコードが複数にある」ことは、トップレベル統合の根拠ではない。** 新しい製品上の不変条件と公開契約ができたときに判断する。

### 4.5 新しい領域の導入手順

配置が決まったら、その領域の所有/非所有・利用者・公開契約・依存方向・既存領域では不適切な理由を一組として決め、正本の配置ルールに反映する。Biomeは既存の生成元`frontend/scripts/dependency-rules.ts`へ登録し、実際の許可/禁止importテストで動くことを確認する。**既存または新しいディレクトリへ製品コードを移す前に検査を有効にする。**

## 5. M1で確定させるルール本文（短い規範候補）

`.claude/rules/source-ownership.md`は未知の責務を判断する原則と、今回採用する既存領域の所有・非所有を一緒に正本として持つ。機械的に検査する依存方向と公開モジュールの許可範囲は`frontend/scripts/dependency-rules.ts`を正とし、Aのゲーム構造・View・Page・React私有子の細則は既存ルールを参照する。

```md
# 正本の責務配置ルール
- 既存領域の所有・非所有を単一のルールに定める。
- 未知の責務は独立した規則・契約・依存方向から判定する。
- 許可する依存方向と公開モジュールは生成されたBiomeで検査する。
```

設計資料は判断経緯と比較案に使い、採用した境界は正本で再現できるようにする。

## 6. M1の受入条件

- [x] Aの5境界はPO確認済み。
- [x] B/Cについて所有する／しない、依存・例外、新設時の判断例を案にした。
- [x] 表示を1Viewに置く基準を実際の利用箇所に適用し、`PuzzleSelectionView`専用UIを修正した。
- [x] 11ゲームの共通ホームと、設定UI専用のゲーム一覧契約の所有先を提案した。
- [ ] B/Cの境界・例外・新設判断をレビューして採否を確定する。
- [ ] 採用した内容を現在の`.claude/rules/`・既存の正本と整合させ、M2で旧/新境界を両方適用する方法を確定する。

**M1の採用判断とM2の実効検査の両方が完了するまで製品コードを移動しない。** 完了を理由に未確定の移動先を承認済みとみなさない。
