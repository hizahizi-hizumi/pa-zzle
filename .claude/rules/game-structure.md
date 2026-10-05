---
paths:
  - "frontend/src/games/**/*.{ts,tsx}"
  - "frontend/src/game-catalog/**/*.{ts,tsx}"
---

# ゲーム実装の標準構造

## 標準配置

同じ責務はゲームが違っても同じ名前・同じ位置に置く。責務が存在しない要素を形だけ揃えるために作らない。

```text
frontend/src/games/
├── difficulty.ts
├── result.ts
├── score.ts
├── play-vocabulary.ts
└── <game>/
    ├── puzzle/
    ├── problem/
    │   ├── problem.ts
    │   ├── generator.ts
    │   ├── difficulty-analysis.ts
    │   └── generation/
    ├── session/
    │   └── session.ts
    ├── play/
    │   └── use-<game>-play.ts
    ├── ui/
    │   └── result/
    │       └── <Game>ResultScreen.tsx
    ├── assets/
    ├── display-name.ts
    ├── difficulty.ts
    ├── score.ts
    ├── problem-selection.ts
    ├── play-record.ts
    ├── play-attempt.ts
    └── diagnostics.ts
```

## 原則必須の責務

- `puzzle/`: パズルの状態、ルール、合法手、状態遷移を置く。
- `problem/problem.ts`: 1問を実際に遊ぶためのデータ契約を置く。
- `session/session.ts`: 1問に対する1回のプレイ状態、操作、経過事実を置く。
- `play/`: 問題供給、session、評価を組み合わせ、UIへプレイ状態と操作を提供する。
- `ui/`: ゲーム固有の表示とユーザー操作を扱う。結果画面はプレイ画面と記録の結果画面の両方から使うので、プレイ画面の内部実装ではなく `ui/result/` に置く。
- `display-name.ts`: 利用者に見せるゲーム名 `<GAME>_DISPLAY_NAME` を置く。カタログ・難易度選択・プレイ画面・盤面の読み上げ名・結果画面はこれを参照し、ゲーム名を直書きしない。
- `difficulty.ts`: ゲームとしての難易度ラベルと分類方針を置く。
- `score.ts`: 完了したプレイの事実をゲーム固有の評価へ変換する。
- `problem-selection.ts`: 開始条件に合う問題を問題供給元と難易度方針から選ぶ。
- `play-record.ts`: ゲーム固有の完了事実を共通記録機能へ接続する。今の版の記録から結果画面に出す内容を作り直す `restore<Game>RecordedResult` も置き、結果の計算は `play/` の `create<Game>Result` をプレイ中と共用する。
- `play-attempt.ts`: 完了せずに離れたプレイの進み具合として記録する実測値を、`session/` から選ぶ。

これらを省略するのは、`APP.md` / `GAME.md` 上、そのゲームだけ当該体験を持たないと説明できる場合に限る。

## 記録

- 記録の identity は `<Game>RecordedProblemIdentity`（`games/problem-id.ts` の `RecordedProblemIdentity`）として生成器の版を問わず読み込み、記録一覧と自己ベストに残す。採点に identity の生成条件を使うゲームは、その条件を `RecordedProblemIdentity` の型引数に書き、読めることを確かめる。
- 結果画面の作り直し（`restore<Game>RecordedResult`）は、今の版の記録で、今の生成器の identity のときだけ行う。
- 記録の payload の項目を足す・消す・意味を変えるときは `payloadVersion` を上げ、前の版の記録も読み続ける。
- 記録・試行・診断・location state など外部から読み戻した値は、`@/lib/type-guards` の型ガードと `isRecordObject` による絞り込みで確かめる。型ガードを各モジュールに書き写さない。

## 条件付きの責務

- `problem/generator.ts`: 実行時に問題を生成するゲームに置く。固定問題集や外部問題を選ぶだけなら置かない。
- `problem/difficulty-analysis.ts`: 問題から難易度判定用の特徴を導出するゲームに置く。難易度が問題データの既知情報なら置かない。
- `problem/generation/`: 問題生成・検証の内部でだけ使う解探索、手筋解析などを置く。通常プレイから直接参照しない。
- `diagnostics.ts`: ゲーム固有の内部診断を提供する場合に置く。`games/diagnostics.ts` の `InternalDiagnosticFormat` を定義し、snapshot の作成と読み戻しは共通の `createInternalDiagnosticSnapshot` / `parseInternalDiagnosticSnapshot` を使う。公開するのは `<Game>DiagnosticSnapshot` と `create<Game>DiagnosticSnapshot` だけで、読み戻しと問題の復元はテスト用に `_private` で公開する。
- `assets/`: ゲーム固有の静的資産がある場合に置く。

## 問題契約

- `<Game>Problem` は、その1問を遊ぶために必要な情報だけを持つ。
- seed、生成器の版、生成条件、生成試行回数など再現用情報は `<Game>ProblemIdentity` として分離する。
- 問題に付随情報を添えた型は、役割で名前と置き場所を決める。
  - `<Game>IdentifiedProblem`（`problem/problem.ts`）: `problem` と `identity` だけを持つ。
  - `<Game>GeneratedProblem`（`problem/generator.ts`）: 生成器が返す問題。生成時の解析結果や下流で必要な派生情報を添える。
  - `<Game>PooledProblem`（`problem/problem-pool.ts`）: 問題集から復元した問題。問題集が持つ派生情報（作業の量、最短手数など）を添える。問題を含まない問題集項目の読み解き結果は `<Game>DecodedPoolEntry` と呼ぶ。
- `problem/problem.ts` は、今の生成器で扱える identity かを確かめる `is<Game>ProblemIdentity`、記録の identity として読めるかを確かめる `is<Game>RecordedProblemIdentity`、問題の形を確かめる `assert<Game>Problem` を置く。`session/` は問題を受け取るときに `assert<Game>Problem` で確かめる。
- 問題生成の乱数は `games/problem-seed.ts` の `ProblemRandom` で受け、並べ替えは `shuffleProblemValues` を使う。
- 解探索の手順や探索履歴は生成内部に閉じる。下流で必要なら `optimalMoveCount` のような意味のある派生値へ縮約する。
- `session/` は `<Game>Problem` に依存し、生成・診断専用情報を保持しない。

## 難易度

- 問題の特徴を求める処理と、その特徴を `1`〜`5` のレベル等へ分類するゲーム方針を分離する。
- 特徴の解析は `problem/difficulty-analysis.ts`、分類方針は `difficulty.ts` が所有する。
- `problem-selection.ts` が問題供給と `difficulty.ts` を組み合わせて、要求難易度に合う問題を選ぶ。
- 難易度の共通契約は `games/difficulty.ts` が所有する。`<Game>Difficulty` は `DifficultyLevel` の別名にし、レベルの一覧・parse・表示名、旧3段階の区分（`<Game>RecordedDifficulty` は `RecordedDifficulty` の別名）はゲームごとに定義しない。
- 分類関数は `DifficultyAssessment` を返す。状態は `classified`・`out-of-range`・`unsupported`・`invalid` だけを使い、起こらない状態は `never` にする。どのレベルの組にも当たらない理由は `unlisted-combination` とする。問題解析結果の状態名も `analyzed`・`unsupported`・`invalid` から選ぶ。
- レベルごとの基準表は `as const satisfies Record<<Game>Difficulty, …>` で書き、範囲は `NumericRange` と `isInNumericRange` で表す。

## プレイ評価

- `session/` は経過時間、手数、ミス、操作回数など評価元の事実を返す。
- `score.ts` はその事実からゲーム固有の評価を導出する。
- スコアから称賛段階などの意味的な評価段階を決める処理はゲーム層に置く。SPEC-006 の段階基準は全ゲーム共通なので `result.ts` の `getGameResultLevel` を使う。
- 色、文言、演出など評価段階の視覚表現はUIが担当する。
- 複数ゲームで同じ意味を持つ契約は `frontend/src/games/` 直下へ置く。例: `result.ts` の `GameResultLevel`。
- `score.ts` の評価関数は `games/score.ts` の `PlayScore` を返す。評価項目は `ScoreItem` の名前を使い、満点は `ScoreMaximums` で結果画面に出す順に並べる。
- 速さは `games/score.ts` の `SpeedScoreRule` と `calculateSpeedScore` で採点する。各ゲームは `calculate<Game>SpeedScoreRule` と `calculate<Game>TimeDeltaMs` を置き、結果に `speedRule` と `timeDeltaMs` を含める。
- 時間の自己ベストは `time-delta-ms`（基準時間との差）で比べる。今の採点規則で評価できない記録は記録一覧に残し、評価と自己ベストの値を `null` にする。
- 操作（待った・盤面を戻す・リセット・別の問題）と評価項目の呼び名は `games/play-vocabulary.ts` から使い、文字列で書かない。
- 結果画面の指標は `components/game-result-metrics.ts`、採点基準の文は `components/game-result-score-criteria.ts` で組み立てる。数には単位を付け、採点基準の文は常体で書く。丸めの注記は共通の結果画面が出す。
- 記録表示の指標は `records/ui/play-record-display.ts` の共通の指標表示を使う。自己ベストの改善量の書き方は指標表示の `formatImprovement` が持つ。

## session と play の共通契約

- `<Game>Session` は `games/session.ts` の `GameSession<Problem, PuzzleState>` にプレイの事実を足して作る。今の盤面は `puzzleState`、状態は `GameSessionStatus` で表す。
- 経過時間は `games/session.ts` の `getSessionElapsedMs`・`getClearedSessionElapsedMs` で求め、ゲームごとに作らない。
- session の操作は `<動詞><Game>Session<対象>` と名付け、新しい session を返す。受け付けない操作（プレイ中でない・成立しない）は受け取った session をそのまま返し、`null` を返さない。操作の結果を併せて返す操作も、受け付けないときは session を変えない結果を返す。
- 盤面を戻す `restart<Game>Session` は、`canRestart<Game>Session` が偽（盤面が初期状態、またはクリア後）なら何もせず、回数も数えない。
- 同じ問題の新しいプレイ（リセット）は `create<Game>Session(session.problem, startedAt)` で作る。
- 結果の事実は `get<Game>SessionResult(session)` がクリア時刻までで返す。評価に使う問題の事実は session の結果に含めず、`create<Game>Result` の引数として問題側から渡す。
- `use<Game>Play` は `games/play.ts` の `GamePlay` に、盤面を戻せるなら `RestartableGamePlay`、待ったがあるなら `UndoableGamePlay` とゲーム固有の値を足した `<Game>Play` を返り値型として注釈する。
- 進行は `GameProgress`、state の更新は `applyPlaySession`・`startPlaySession`・`completePlayClearAnimation`、表示する経過時間は `useSessionElapsedMs` を使う。
- 最初の問題と「別の問題」は `games/problem-selection.ts` の `selectProblemAvoiding` で選ぶ。「別の問題」は今の問題の ID（`createProblemId(problemIdentity)`）を避ける。
- リセットはプレイ中もクリア後も使える。`canUndo`・`canRestart` はプレイフックが返し、UI は合成せずそのまま使う。

## プレイ画面と結果画面の共通契約

- `ui/<Game>Play.tsx` の props は `games/play.ts` の `GamePlayScreenProps<Difficulty, Result>` に、盤面を戻せるなら `RestartableGamePlayScreenProps`、待ったがあるなら `UndoableGamePlayScreenProps` と、ゲーム固有の値・操作を足して作る。`ui/result/<Game>ResultScreen.tsx` の props は `GamePlayResultScreenProps<Difficulty, Result>` で作る。難易度は値で受け取り、表示名は UI が決める。
- プレイ画面は `components/GamePlayFrame.tsx` に盤面（`main`）とゲーム固有の操作（`footer`）を渡して作り、外枠・ブランドの帯・見出し・遊び方の開閉・結果画面への切り替えを各ゲームで書かない。結果画面は `progress` が `result` で評価があるときだけ出る。
- 見出しの計測値は `PlayHeaderMetric` の回数（`count`）と経過時間（`elapsed-time`）で渡し、書式・桁の確保・行の分け方は共通部品に任せる。
- 盤面は `progress` が `playing` の間だけ操作を受け付け、受け付けないことを `interactionDisabled` で受け取る。
- 操作の callback props は、タップ・キーボードなどの入力手段ではなく操作の意味で名付ける。

## 依存方向

- `frontend/src/games/` 直下のゲーム共通契約は React に依存しない。プレイフックの共通部分を置く `games/play.ts` だけは React に依存できる。

- `puzzle/` は `problem/`、`session/`、`play/`、`ui/` を知らない。
- `problem/` は `puzzle/` とゲーム共通契約へ依存できるが、`session/`、`play/`、`ui/` を知らない。
- `problem/generation/` は問題生成・検証から使われ、通常プレイから直接参照されない。
- `session/` は `problem/` と `puzzle/` へ依存できるが、難易度分類、採点、保存、React、UIを知らない。
- `difficulty.ts` は問題解析結果へ依存できる。
- `problem-selection.ts` は問題供給と `difficulty.ts` へ依存できる。
- `score.ts` は評価に必要な事実の契約とゲーム共通契約へ依存できるが、`play/`、`ui/` を知らない。
- `play/` は下位のゲーム責務を調停するが、`ui/` を import しない。
- `ui/` は `play/` と表示に必要な読み取り専用の契約へ依存できる。問題生成、session更新、採点規則を実装しない。
- `play-record.ts`、`play-attempt.ts`、`diagnostics.ts` は接続先と必要なゲーム内部契約へ依存できるが、通常プレイから逆依存させない。
- `ui/play-record-display.ts` は記録 UI の表示契約（`@/records/ui/play-record-display`）へ接続できる。記録表示は記録定義の全指標を網羅する。
- ゲームカタログ（`frontend/src/game-catalog/`）へ依存しない。
- 別ゲームの実装を直接 import しない。
- 循環依存を作らない。例外を追加する前に責務の配置を見直す。

## ゲーム直下

- ゲーム直下には `display-name`、`difficulty`、`score`、`problem-selection`、`play-record`、`play-attempt`、`diagnostics` のようなゲーム全体の責務だけを置く。
- `hooks`、`services`、`utils`、`manager`、`game` のような実装方式・汎用箱で責務を分類しない。
- 同じ横断責務が複数ゲームに現れたら、同じ責務名と標準位置を使う。
- 1責務が複数ファイルへ成長した場合は、責務名を保った同名ディレクトリへ分割する。

## ゲームカタログ

アプリがゲームをどう提供するかは、ゲームの外側の `frontend/src/game-catalog/` が持つ。

```text
frontend/src/game-catalog/
├── game-catalog-entry.ts
├── game-catalog.ts
├── game-navigation.ts
├── problem-id-query.ts
├── play-location-state.ts
├── record-result-location-state.ts
├── record-result-navigation.ts
└── <game>/
    ├── <game>-catalog-entry.tsx
    ├── Playable<Game>.tsx
    └── Recorded<Game>Result.tsx
```

- `game-catalog-entry.ts`: 1ゲーム分のカタログ項目 `GameCatalogEntry` と、記録や離脱したプレイの問題を遊び直すプレイ画面・記録から描く結果画面（`RecordResultContext`）の契約を置く。
- `game-catalog.ts`: 全ゲームを表示順に並べた `gameCatalog` を置く。パズル選択・記録・結果の画面は、ゲームを列挙せずこれを回す。
- `game-navigation.ts`: 記録・入口（難易度選択）・ホーム・同じゲームの次の問題へ移る `GameNavigation` と、記録の問題を遊び直すプレイ画面を開く `openRecordProblemPlay` を置く。ゲームの画面からの遷移はこれを使い、パスを直書きしない。入口とプレイ画面のパスはカタログ項目の `entryPath`・`playPath` を正とする。
- `problem-id-query.ts`: プレイ画面の URL の `problem` クエリ（問題 ID）の読み書きを置く。
- `play-location-state.ts`: プレイ画面へ渡す location state（最初に避ける問題の ID）の作成と読み取りを置く。location state を読めないときは、どの読み取りも `undefined` を返す。
- `record-result-location-state.ts`: 結果画面へ渡す location state（記録の保存結果）の作成と、形を確かめた読み取りを置く。
- `record-result-navigation.ts`: クリアして記録を保存できたプレイを、記録の結果画面 `/puzzles/<game>/result/<記録ID>` へ履歴を置き換えて移す共通フックを置く。
- `<game>-catalog-entry.tsx`: ID（記録の `gameId`）、表示名、ピクトグラム、入口パス、プレイ画面のパス、記録表示、記録や離脱したプレイの問題を遊び直す難易度と問題 ID、記録から描く結果画面を持つ。遊び直し先は記録一覧の全行で求めるので、問題を復元せず問題集の索引で引けるかだけを確かめる。結果画面は今の版の記録からだけ描き、描けない記録には `null` を返す。
- `Playable<Game>.tsx`: `play/`・`ui/`・記録保存・診断・画面遷移を合成し、1問を遊べるプレイ画面にする。記録を保存できたクリアは記録の結果画面へ移し、その場の結果画面は記録の保存に失敗したプレイでだけ出す。
- `Recorded<Game>Result.tsx`: 記録から作り直した結果を `ui/result/<Game>ResultScreen.tsx` で描き、次の問題（記録と同じ難易度で記録の問題を避ける）と診断をつなぐ。

## ゲームを追加するとき

1. `games/<game>/` を標準配置で実装する。
2. `game-catalog/<game>/` に `Playable<Game>.tsx`、`Recorded<Game>Result.tsx`、`<game>-catalog-entry.tsx` を置き、`game-catalog.ts` の並びへ加える。
3. `pages/puzzles/<game>/` と、そのルートの View（難易度選択・プレイ）を置く。
4. `bun run --cwd frontend generate:dependency-rules` で `frontend/biome.json` の依存規則を生成し直す。規則は `src/games/` 直下のディレクトリから全ゲームに同じ形で作られ、生成結果との一致はテストで検査される。
