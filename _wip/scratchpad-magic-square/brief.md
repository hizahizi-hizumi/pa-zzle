# brief: 魔方陣（/add-puzzle）

## 識別表

`/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/識別表.md`（パズル名 魔方陣、ゲーム ID `magic-square`、ブランチ接頭辞 `magic-square`、候補 ID PUZZLE-011、PZL 番号 PZL-014、導入調査 Issue #986）

## 合意節の写し

`/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/合意.md`

人間の判断のうち「列の『あといくつ』を出すかは要検討」「盤面の上限を 5×5 に固定しない」は、調査で決めた（実装前提調査の D-04・D-05）。

## 実装前提調査（仮決定一覧・作る順番・PR の切り方）

`<worktree>/docs/パズル/導入調査/魔方陣/魔方陣実装前提調査.md`。§4 の仮決定（D-01〜）を守る前提として実装する。難易度・問題供給・図鑑の仮決定は、調査の残りが終わり次第ここに足す。観点ごとの資料は同じディレクトリにある。

## 作業ディレクトリ

`/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/`（作業カード・作り方の Skill の報告・一時ファイルの置き場所）

## 作業ブランチの worktree

`/tmp/claude-0/-home-user-pa-zzle/eceb8996-2d4e-58b4-89df-882aca916ab9/scratchpad/magic-square/work`（ブランチ `magic-square/work`、origin/main `4b9cf7ee` から作った）

## 手本にする直近のパズル

アイスフロア迷路（`frontend/src/games/ice-floor-maze/`、PZL-011）。数を置くゲームの前例としてナンプレ（`frontend/src/games/nanpure/`）も読んでよいが、盤面・操作・見た目をそのまま当てはめない（`GAME.md`「やらないこと」、失敗パターン集の「そろえる所と当てはめる所の取り違え」）。

## Skill の場所

- この作業の Skill: `/home/user/pa-zzle/.claude/skills/add-puzzle`（作る順番は `references/build-order.md`、失敗パターン集は `references/pitfalls.md`）
- 作り方の Skill と agent 定義・ルール: `/home/user/pa-zzle/.claude/` の下（`skills/design-game-difficulty`、`skills/design-game-pictogram`、`skills/design-game-pictogram-showcase`、`skills/design-puzzle-how-to-play`、`skills/design-puzzle-tutorial`、`skills/share/`、`rules/`、`agents/`）。相対パスで書かれた参照はここから読む。

## 失敗パターン集

- `/home/user/pa-zzle/.claude/skills/add-puzzle/references/pitfalls.md`
- `/home/user/pa-zzle/.claude/skills/design-game-difficulty/references/pitfalls.md`（difficulty・problem-pool の項目で全行）
