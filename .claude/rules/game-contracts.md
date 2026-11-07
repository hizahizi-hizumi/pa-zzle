---
paths:
  - "frontend/src/games/*/*.ts"
  - "!frontend/src/games/*/display-name.ts"
  - "!frontend/src/games/*/play-attempt.ts"
  - "frontend/src/games/*/problem/**/*.ts"
  - "frontend/src/games/*/session/**/*.ts"
  - "frontend/src/games/*/play/**/*.ts"
  - "frontend/src/games/*/ui/play-record-display.ts"
---

# ゲームの契約

## 問題

- `<Game>Problem` には、その1問を遊ぶために要る情報だけを持たせる
- seed、生成器の版、生成条件、生成試行回数などの再現用の情報は `<Game>ProblemIdentity` に分ける
- 問題に付随情報を添えた型は、役割に合わせて次の名前と置き場所にする
  - `<Game>IdentifiedProblem`（`problem/problem.ts`）: `problem` と `identity` だけを持つ
  - `<Game>GeneratedProblem`（`problem/generator.ts`）: 生成器が返す問題に、生成時の解析結果や下流で要る派生情報を添える
  - `<Game>PooledProblem`（`problem/problem-pool.ts`）: 問題集から復元した問題に、問題集が持つ派生情報（作業の量、最短手数など）を添える
  - `<Game>DecodedPoolEntry`（`problem/problem-pool.ts`）: 問題を含まない問題集項目の読み解き結果
- `problem/problem.ts` には次の3つを置く
  - 今の生成器で扱える identity かを確かめる `is<Game>ProblemIdentity`
  - 記録の identity として読めるかを確かめる `is<Game>RecordedProblemIdentity`
  - 問題の形を確かめる `assert<Game>Problem`
- 問題生成の乱数は `games/problem-seed.ts` の `ProblemRandom` で受ける
- 問題生成の並べ替えは `games/problem-seed.ts` の `shuffleProblemValues` を使う
- 生成から下流へは、解探索の手順や探索履歴ではなく、意味のある派生値（最短手数など）を渡す

## 難易度

- `<Game>Difficulty` は `games/difficulty.ts` の `DifficultyLevel` の別名にする
- `<Game>RecordedDifficulty` は `games/difficulty.ts` の `RecordedDifficulty` の別名にする
- レベルの一覧・parse・表示名は `games/difficulty.ts` のものを使う
- 分類関数は `DifficultyAssessment` を返す
- どのレベルの組にも当たらない理由は `unlisted-combination` にする
- 問題解析結果の状態名は `analyzed`・`unsupported`・`invalid` から選ぶ
- レベルごとの基準表は `as const satisfies Record<<Game>Difficulty, …>` で書く
- 基準表の範囲は `NumericRange` で表し、`isInNumericRange` で判定する

## 記録

- 記録の identity は `<Game>RecordedProblemIdentity`（`games/problem-id.ts` の `RecordedProblemIdentity`）として、生成器の版を問わず読み込む
- 生成器の版が今と違う記録も、記録一覧と自己ベストに残す
- 採点に identity の生成条件を使うゲームは、その条件を `RecordedProblemIdentity` の型引数に書く
- 型引数に書いた条件を持つ identity が `is<Game>RecordedProblemIdentity` で読めることを、テストで確かめる
- `play-record.ts` には、今の版の記録から結果画面に出す内容を作り直す `restore<Game>RecordedResult` を置く
- `restore<Game>RecordedResult` は、結果の計算に `play/` の `create<Game>Result` をプレイ中と共用する
- `restore<Game>RecordedResult` は、今の版の記録で、今の生成器の identity のときだけ結果を作り直す
- 記録の payload の項目を足す・消す・意味を変えるときは `payloadVersion` を上げる
- `payloadVersion` を上げたあとも、前の版の記録を読み続ける
- 記録定義の自己ベストの指標には、評価点を `records/play-record-definition.ts` の `PLAY_SCORE_METRIC_ID`（`play-score`）で、高いほど良い指標として含める
- 時間の自己ベストは `time-delta-ms`（基準時間との差）で比べる
- 今の採点規則で評価できない記録は記録一覧に残し、評価と自己ベストの値を `null` にする
- `ui/play-record-display.ts` は `records/ui/play-record-display.ts` の共通の指標表示を使う
- `ui/play-record-display.ts` は記録定義のすべての指標を表示する
- 自己ベストの改善量は指標表示の `formatImprovement` で書く

## 評価

- 評価段階は `games/result.ts` の `getGameResultLevel` で決める
- `score.ts` の評価関数は `games/score.ts` の `PlayScore` を返す
- 評価項目には `ScoreItem` の名前を使う
- 満点は `ScoreMaximums` で、結果画面に出す順に並べる
- 速さは `games/score.ts` の `SpeedScoreRule` と `calculateSpeedScore` で採点する
- 各ゲームは `calculate<Game>SpeedScoreRule` と `calculate<Game>TimeDeltaMs` を置く
- 結果には `speedRule` と `timeDeltaMs` を含める

## session

- `<Game>Session` は `games/session.ts` の `GameSession<Problem, PuzzleState>` にプレイの事実を足して作る
- 経過時間は `games/session.ts` の `getSessionElapsedMs`・`getClearedSessionElapsedMs` で求める
- `session/` は問題を受け取るときに `assert<Game>Problem` で確かめる
- `session/` は問題を `<Game>Problem` で受け取り、生成・診断専用の情報を持たない
- session の操作は `<動詞><Game>Session<対象>` と名付け、新しい session を返す
- 受け付けない操作（プレイ中でない・成立しない）は、受け取った session をそのまま返す
- 操作の結果を併せて返す操作は、受け付けないときに session を変えない結果を返す
- 盤面を戻す `restart<Game>Session` は、`canRestart<Game>Session` が偽（盤面が初期状態、またはクリア後）なら何もせず、回数も数えない
- 同じ問題の新しいプレイ（リセット）は `create<Game>Session(session.problem, startedAt)` で作る
- `get<Game>SessionResult(session)` は、経過時間・手数・ミス・操作回数など評価の元になる事実を、クリア時刻までで返す
- 評価に使う問題の事実は session の結果に含めず、`create<Game>Result` の引数として問題側から渡す

## play

- `use<Game>Play` の返り値型は `<Game>Play` と注釈する
- `<Game>Play` は `games/play.ts` の `GamePlay` に次を足して作る
  - 盤面を戻せるなら `RestartableGamePlay`
  - 待ったがあるなら `UndoableGamePlay`
  - ゲーム固有の値
- 進行は `GameProgress` で表す
- state の更新は `applyPlaySession`・`startPlaySession`・`completePlayClearAnimation` を使う
- 表示する経過時間は `useSessionElapsedMs` で求める
- 最初の問題と「別の問題」は `games/problem-selection.ts` の `selectProblemAvoiding` で選ぶ
- 「別の問題」は今の問題の ID（`createProblemId(problemIdentity)`）を避けて選ぶ
- リセットはプレイ中もクリア後も受け付ける
- `canUndo`・`canRestart` はプレイフックが返す
- プレイフックは、盤面操作を `id` 付きの操作の知らせとして返す

## 診断

- `diagnostics.ts` は、ゲームの内部診断の形式を `games/diagnostics.ts` の `InternalDiagnosticFormat` 型の値で定義する
- snapshot の作成と読み戻しは `createInternalDiagnosticSnapshot`・`parseInternalDiagnosticSnapshot` を使う
- `diagnostics.ts` が公開するのは `<Game>DiagnosticSnapshot` と `create<Game>DiagnosticSnapshot` だけにする
- 読み戻しと問題の復元は `_private` で公開する
