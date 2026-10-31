# 実装フェーズ（implement）

段01の本実装スタック表に沿って、段ごとに PR を積む。人間の判断は求めず、論点は仮決定で進めて仮決定一覧へ追記する。

## ブランチと PR

- ブランチ: `claude/<prefix>-NN-<topic>`（`NN` は2桁、`<topic>` は段01のスタック表の英語名）。
- base: 前段のブランチ。段01の base は調査 PR のブランチ `claude/<prefix>-00-feasibility`。
- 土台の `main` はスタックを作り始めた時点のもの。作業中に `main` を取り込まない。
- PR は段ごとに1本、オープンで作る。作成は SKILL.md の「GitHub の操作」に従い、`/pr` は使わない。
- 各段の先端で `./scripts/verify.sh` が通るようにする。大きすぎるコミット（数十ファイル）は責務ごとに分ける。

## 標準スタック

段の範囲は今の main の契約に合わせてある。`src/games/` に置いたゲームはすべて `gameCatalog` に載っていること（`frontend/src/game-catalog/game-catalog.test.ts`）、`frontend/biome.json` の依存規則が全ゲームから生成した規則と一致すること（`frontend/scripts/dependency-rules.test.ts`）、`GameCatalogEntry` と `usePlayableGame` が記録の表示定義を要ることが前提になる。

| 段 | topic | 範囲 | 完成条件 | 人間レビュー領域 |
|---|---|---|---|---|
| 01 | research | 実装前提調査（識別表・仮決定一覧・スタック表） | 文書のみ。`references/research.md` §5 | ― |
| 02 | rules | `puzzle/`・`problem/problem.ts`・`problem/generator.ts`・一意性ソルバー（UI なし）。`generate:dependency-rules` による `frontend/biome.json` の再生成と、カタログ未掲載の除外（下記） | ルール・生成・一意性・identity のテスト。研究用 Python がある場合は TS へ移植し、固定盤面で出力の一致をテストする | ゲーム体験 |
| 03 | playable | `session/`・`play/`・最小の `ui/`・View・pages・`router.ts`。固定問題または仮の出題。`game-catalog/<game>/` に入口とプレイ画面のパスだけのエントリと `Playable<Game>`（下記） | URL 直打ちでクリアまで遊べる。`?problem=<問題ID>` で問題を指定して開ける | ゲーム体験 |
| 04 | play-ui | 盤面の仕上げ、操作、状態の知らせ、待った・リセット、遊び方（SPEC-016）、クリア演出 | 画面確認（下記）でエラー 0・横スクロール無し・レイアウトシフト無し。320px でマスを正確に押せる | ゲーム体験 |
| 05 | difficulty | 人間向け解法器、`problem/difficulty-analysis.ts`、`difficulty.ts`、分析スクリプト、`<パズル名>難易度.md` | 帯ごとの分布、最難の帯が自明でない、評価不能の扱い、「仮の決まり」の盤面の逆転なし | 難易度の体感 |
| 06 | problem-pool | `problem/problem-pool.json`・`problem-pool.ts`・生成スクリプト `--verify`、`problem-selection.ts` | 全問を identity から作り直して一致する。各レベルの問題数、バンドル増分を PR に書く | 難易度の体感 |
| 07 | pictogram | `assets/pictogram.svg`（`/design-game-pictogram`）と `<パズル名>ピクトグラム検討.md`・代替案の SVG | AI が候補から仮採用し、代替案と検討記録を残す。`/design-game-pictogram` の `check_svg.py` PASS。カタログには載せない | ピクトグラム |
| 08 | difficulty-select | `ui/<Game>DifficultyPreview.tsx`、難易度選択の View | 「仮の決まり」のプレビューの決まりを満たす。上のレベルが下のレベルの構成を含む入れ子・単調性のテスト | 難易度プレビュー |
| 09 | score | `score.ts`・`play-record.ts`・`play-attempt.ts`・`diagnostics.ts`、`<パズル名>成績評価.md` | 生の事実を保存し評価は読み出し時に計算。配点・基準時間は仮置きと PR と成績評価文書に書く | スコアの納得感 |
| 10 | result-records | 結果画面・記録・再プレイ・検証情報の接続（`usePlayableGame`、`Recorded<Game>Result`）、完全な `GameCatalogEntry` と `gameCatalog` への登録、ゲーム選択への掲載、カタログ未掲載の除外を外す | 下の「触る場所チェックリスト」がすべて済む。記録から結果画面と遊び直しが開ける | ゲーム体験・スコアの納得感 |
| 11 | spec | `SPEC-0NN.md`、台帳、実装前提調査の識別表と「実装で確定した差分」表 | SPEC に画面・演出・アルゴリズム・係数・仮であることを書かない | ― |

段の足し引きは段01のスタック表に書いてから行う。前例: ソルバー・生成器を独立段にする（詰将棋 03 solver・04 generator）、ピクトグラムをゲーム選択と同じ段にする（スライドパズル 07）。段を足しても、カタログとゲーム選択への掲載は記録・結果画面をつなぐ段に置く。最上段の名前は固定せず、段01のスタック表の最後の段とする。

TODO(人間判断): 未マージのチュートリアル Skill（`origin/docs/game-tutorial-skill`）を段として組み込むか。既定: 組み込まない。

### カタログに載せるまでの扱い

ゲームのディレクトリを作った段（02）から、記録と結果画面をつなぐ段（10）まで、次の2つで main の契約を保つ。除外の実例は `origin/claude/tsume-shogi-02-rules`〜`-11-score`（`-12-result-records` で外した）と `origin/claude/hamiltonian-02-rules`・`-03-playable`、パスだけのエントリの実例は `origin/claude/hamiltonian-03-playable`。

- `frontend/src/game-catalog/game-catalog.test.ts`: `concreteGames` から外す一覧 `gamesNotInCatalogYet = ["<game>"]` を足し、`.filter((name) => !gamesNotInCatalogYet.includes(name))` で除く。段10で一覧と filter を消す。
- `frontend/src/game-catalog/<game>/<game>-catalog-entry.ts`（段03）: `Pick<GameCatalogEntry, "entryPath" | "playPath">` を満たす入口とプレイ画面のパスだけを持ち、`gameCatalog` には入れない。`Playable<Game>` は `usePlayableGame` を使わず、`useRequestedProblem`・`useProblemIdQuerySync`・`useGameNavigation` でプレイ画面をつなぐ。段10で完全な `GameCatalogEntry`（`.tsx`）と `usePlayableGame` に置き換える。

実例のコードには「〜の段でカタログへ載せる」というコメントがあるが、写さない。予定や段の名前をコメントに書かない（`.claude/rules/self-documenting-code.md`）。一覧の名前で意図が伝わるようにする。

### 段ごとの注意

- **02 rules**: 調査の実験コードを本実装へ昇格させない。TS で書き起こし、Python との一致はテストで確かめる。`bun run --cwd frontend generate:dependency-rules` の結果をコミットに含める。
- **03 playable**: 完成後の表示や評価は仮でよい。仮であることを PR の「暫定の範囲」に書く。
- **04 play-ui**: 待った・リセット・遊び方・ヘッダーは既存ゲームの共通部品（`frontend/src/components/` の `UndoButton`・`HowToPlayDialog` 等）と同じ形・位置にそろえる。わざと変えるなら仮決定一覧に理由を書く（`DESIGN.md` §14 はプレイ画面での共通部品の利用を契約にしていない）。プレイ中に説明文で知らせず、盤面の形・色・動きで分からせる（`GAME.md`）。
- **05 difficulty**: 解法器が緩すぎ・深すぎないかを、別のサブエージェントに代表問題で検証させる（リフレクション段05では最難の判定が 753 問から 138 問に変わった）。
- **06 problem-pool**: `frontend/biome.json` の `files.includes` へ `"!src/games/<game>/problem/problem-pool.json"` を手で足す。`--verify` が長時間かかる場合は別のワークツリーで回し、他の作業と並行する。
- **07 pictogram**: 候補比較は `/tmp/<game>-work/` のギャラリーで行い、人間の選択は待たずに仮採用で進める。最終の選択は人間レビュー領域。
- **08 difficulty-select**: 下の「仮の決まり」に従う。既存ゲームのプレビュー（`frontend/src/games/*/ui/*DifficultyPreview.tsx`）が何を数や密度で表しているかを読んでから作る。
- **10 result-records**: カタログ未掲載の除外を消し、`frontend/src/views/PuzzleSelectionView.test.tsx` の一覧へ足す。
- **11 spec**: SPEC 番号は作成直前に採番する（下記「採番」）。SPEC は実装した今の決定として言い切る。仮決定であること・最終レビューで判断してほしい点は SPEC に書かず、段01の仮決定一覧だけに置く（`docs/README.md`「まだ決めていないことは書かない」）。

### 仮の決まり

正本に定めは無いが、人間レビューで繰り返し出た決まり。この Skill の中で仮の決まりとして適用する。

- 難易度プレビューは実問題の盤面そのものではなく、そのゲームの挑戦を抽象化した表現にする。ぱっと見でパズルの種別とレベル差が分かること。プレイ画面と同じ部品・表現を使う。
- 上のレベルほど盤面を小さくしない（盤面サイズと難易度を逆転させない）。

TODO(人間判断): この2つを `DESIGN.md`（§3 難易度選択）や `docs/パズル/難易度提供.md` へ移すか。既定: この Skill 内の仮の決まりとして適用し、`puzzle-experience-reviewer` は Major にせず Minor と人間に残す論点（難易度プレビュー）で扱う。

## 手本の渡し方

サブエージェントには「直近パズルの同じ段の差分」を具体的に渡す。特定 sha を Skill に固定せず、毎回探す。

```sh
git fetch --all --prune
git log --all --oneline | grep -E '<手本prefix>-NN'          # 例: reflection-04、tsume-shogi-06
git branch -r | grep 'claude/<手本prefix>-'                    # 未マージの手本はブランチから
git show <merge-sha> --stat                                    # マージ済みなら merge commit の差分
git diff <merge-sha>^1 <merge-sha>                             # その段の差分全体
git diff origin/claude/<手本prefix>-<NN-1>-<topic> origin/claude/<手本prefix>-NN-<topic>   # 未マージの段の差分
git show origin/claude/<手本prefix>-NN-<topic>:<path>          # 未マージのブランチ上のファイル
```

現時点の代表例: リフレクション（main にマージ済み、#412〜#422）、詰将棋（未マージ、`origin/claude/tsume-shogi-NN-*`、#460〜#483）。手本を選ぶ基準は次のとおり。

- 共通契約は main で変わり続ける（共通の結果画面、問題 ID の URL、プレイ試行の記録、遊び方など）。構造の手本は main 上の最新のゲームのコードを優先し、段の進め方の手本として過去のスタックを使う。
- 手本のコードを写すのではなく、責務の置き方・テストの粒度・PR の書き方をそろえる目的で渡す。手本にある経緯のコメントは写さない。

## brief と handoff

`/tmp/<game>-work/` に置く一時ファイル。段を始めるたびに、PR 本文（Stack 表・Validation・人間決定）と段01の仮決定一覧から作り直す。サブエージェントには最初に両方を読ませる。

- **brief**（全段共通）: リポジトリのパス、bun の PATH、`bun.lock` を触らない、コミット・push しない、担当外を触らない、コードとコミットに試行錯誤のコメントや経緯を残さない、`AGENTS.md` と `.claude/rules/` を読む、報告の形（変更ファイル・検証結果・残った論点・仮決定）、人間決定の一覧。
- **handoff**（段ごと）: 段01スタック表の該当行（範囲と完成条件）、手本（上の探し方で見つけた sha とパス）、前段の PR 本文の残課題、仮決定一覧の該当行、触ってよいパス。

## 各段の進め方

1. 段のブランチを前段から作る。
2. handoff を作り、Opus サブエージェントに実装させる。
3. メインが差分を読む。触る場所チェックリストと段の完成条件を照らす。
4. 段の先端で `./scripts/verify.sh` を走らせる。UI のある段は下の画面確認を行い、スクショを自分で見る。
5. 段ごとのセルフレビュー（`references/ai-review.md` の「段ごとのセルフレビュー」）を別のサブエージェントで行い、指摘を直させる。
6. メインがコミット（`/commit`）し、push し、PR を作る。全段の PR 本文の Stack 表に新しい段を足す。
7. CI `quality-gate` の結果を一度確かめ、Validation に書く。失敗していれば直す。待ち続けない。
8. 新しく決めた論点を仮決定一覧に追記する。

## 画面確認

```sh
bun install --cwd frontend --frozen-lockfile
bun install --cwd tools/semantic-lint --frozen-lockfile   # verify.sh が使う
bun run --cwd frontend dev    # 背景で起動。既定は http://localhost:5173
```

- プレイ画面は `?problem=<問題ID>` で問題を指定して開ける。これはどのビルドでも使える。内部診断（開発サーバー、または `PA_ZZLE_INTERNAL_DIAGNOSTICS=true` を付けたビルド）で増えるのは検証情報のダイアログだけ。
- スクショとブラウザの確認は `scripts/capture-screens.mjs` で撮る。このスクリプトはページを開いて撮るだけで、操作しない。

```sh
cat > /tmp/<game>-work/screens.json <<'JSON'
[{ "path": "/", "name": "home" },
 { "path": "/puzzles/<game>", "name": "difficulty" },
 { "path": "/puzzles/<game>/play/1?problem=<問題ID>", "name": "play-l1-start" }]
JSON
NODE_PATH="$(npm root -g)" node .claude/skills/add-puzzle/scripts/capture-screens.mjs \
  --base-url http://localhost:5173 --game <game> \
  --screens /tmp/<game>-work/screens.json --out /tmp/<game>-work/shots/<NN>
```

- 出力は `<game>__<画面名>__<幅>__<テーマ>.png` と `browser-check.txt`（画面ごとの pageerror・console.error と横スクロールの有無）。既定は幅 390 / 1280 × ライト / ダーク。盤面の大きさが論点のときは `--widths 320,360,375,390,1280` にする。
- 操作してクリアまで進める確認、操作の途中や状態の知らせが出た状態のスクショ、操作中に盤面が動かないことの計測（boundingBox を毎フレーム測る等）は、その段のサブエージェントに Playwright のスクリプトを `/tmp/<game>-work/` に書かせて行う。
- 合格条件: `browser-check.txt` の problems が 0、操作してクリアまで進める、操作中に盤面が動かない。
- スクショはメインが Read で開いて自分の目で見る。見ていないものを「確認済み」と書かない。iOS Safari 固有の挙動（ダブルタップ、描画順、ピンチ拡大時のはみ出し）は確かめられないので、確かめていないと書く。

## 触る場所チェックリスト

`.claude/rules/game-structure.md` の「ゲームを追加するとき」の4手順に、規則に書かれていないが全ゲームが持つものを足したもの。段10の完成条件で全項目を確かめる。

TODO(人間判断): 規則に無い項目を `game-structure.md` 側へ足すか。既定: この Skill のチェックリストに留める。

### 1. `frontend/src/games/<game>/`（標準配置）

- [ ] `puzzle/`（状態・ルール・合法手・状態遷移）
- [ ] `problem/problem.ts`・`generator.ts`・`difficulty-analysis.ts`・`generation/`（ソルバー・人間向け解法器）
- [ ] `problem/problem-pool.ts`・`problem-pool.json`（規則の配置図に無い）
- [ ] `session/session.ts`、`play/use-<game>-play.ts`
- [ ] `ui/<Game>Play.tsx`、`ui/board/`（規則の配置図に無い）
- [ ] `ui/<Game>DifficultyPreview.tsx`（規則に無い）
- [ ] `ui/<Game>HowToPlayDialog.tsx`＋`ui/<Game>HowToPlayDialog/HowToPlayFigure.tsx`（規則に無い。SPEC-016）
- [ ] `ui/<Game>Diagnostics.tsx`、`ui/play-record-display.ts`（規則に無い）
- [ ] `ui/result/<Game>ResultScreen.tsx`＋`ui/result/<Game>ResultScreen/score-criteria.ts`
- [ ] `assets/pictogram.svg`
- [ ] 直下の `display-name.ts`・`difficulty.ts`・`score.ts`・`problem-selection.ts`・`play-record.ts`・`play-attempt.ts`・`diagnostics.ts`
- [ ] 各ファイルの隣の `*.test.ts(x)`（`.claude/rules/vitest.md`）

### 2. `frontend/src/game-catalog/`

- [ ] `<game>/<game>-catalog-entry.tsx`（ピクトグラムは `@/games/<game>/assets/pictogram.svg?raw` で読む）
- [ ] `<game>/Playable<Game>.tsx`（`usePlayableGame`）、`<game>/Recorded<Game>Result.tsx`
- [ ] `game-catalog.ts` の `gameCatalog` の並びへ追加
- [ ] `game-catalog.test.ts` のカタログ未掲載の除外を消した

### 3. ページと View

- [ ] `frontend/src/pages/puzzles/<game>/index.tsx`、`play/[difficulty].tsx`（View を再 export する1行。`.claude/rules/pages.md`）
- [ ] `frontend/src/views/<Game>DifficultyView.tsx`・`<Game>PlayView.tsx`（＋テスト。`.claude/rules/views.md`）
- [ ] `frontend/src/router.ts`（dev/build 時に Generouted が再生成。生成結果をコミットする）
- [ ] `frontend/src/views/PuzzleSelectionView.test.tsx` のゲーム名とパスの一覧へ追加（規則に無い）

### 4. 生成物と設定

- [ ] `bun run --cwd frontend generate:dependency-rules` で `frontend/biome.json` の依存規則を再生成
- [ ] `frontend/biome.json` の `files.includes` に `"!src/games/<game>/problem/problem-pool.json"` を手で追加（規則に無い）
- [ ] `frontend/scripts/generate-<game>-problem-pool.ts`（`--verify` 付き）と `analyze-<game>-corpus.ts`（規則に無い）
- [ ] `frontend/package.json` の `generate:<game>-pool`・`analyze:<game>`（規則に無い）
- [ ] backend は変更しない（ゲーム固有コードを持たない）

### 5. 文書

- [ ] `docs/パズル/導入調査/<パズル名>/` の実装前提調査の識別表（SPEC 番号）と「実装で確定した差分」表
- [ ] `<パズル名>難易度.md`・`<パズル名>成績評価.md`・`<パズル名>ピクトグラム検討.md`（＋代替案の SVG）
- [ ] `docs/プロダクト/仕様/パズル/SPEC-0NN.md`（章立ては既存のパズル仕様にそろえる: ルールと問題 → 状態の知らせ・補助 → やり直し → 難易度 → 評価）
- [ ] 台帳の4ゲートの状態と `PUZZLE-NNN.md` の索引（導入判断は H2 まで変えない）
- [ ] 要求・要件、ゲーム/アプリ共通仕様、`APP.md`・`GAME.md`・`DESIGN.md`・`AGENTS.md` は通常変えない。変えるなら別の判断として人間に示す

## 採番

候補 ID と SPEC 番号は、使う直前に次で調べ、「全ブランチを通した次の番号」を使う。段01で番号を「予約」と書かない。過去に並行スタックと衝突して振り直した例が複数ある（詰将棋とハミルトン路がともに SPEC-019 を予定し、効果音のブランチも SPEC-019 を使っていた）。

```sh
git fetch --all --prune
.claude/skills/add-puzzle/scripts/list-used-ids.sh
```

出力は、`origin/main` の最大、全ブランチを通した次の番号、`origin/main` に無い番号を使っているブランチの一覧（候補 ID は名称つき。同じ番号で名称が違う行は衝突）。

TODO(人間判断): 採番衝突の防止方法（予約の仕組みを作るか）。既定: 使う直前に `list-used-ids.sh` で調べ、後からマージする側が衝突に気づいたら振り直す。

## PR 本文

`.claude/skills/pr/references/pr.md` の型（What / Why / Validation / Impact・Risk）に次を加える。制作経緯・テスト件数の羅列・手元画像のパスは書かない。

- **見てほしい点**: この段で最終人間レビューに判断してほしいこと（人間レビュー領域に対応づける）
- **暫定の範囲**: 仮の表示・仮置きの値
- **仮決定**: この段で追加した仮決定（仮決定一覧の行へのリンク）
- **Validation**: 段の先端での `./scripts/verify.sh` PASS、CI `quality-gate` の結果、画面確認の条件と結果、問題集の `--verify`
- **Stack**: 全段の表（段 / ブランチ / PR / 状態）と、この PR の位置
- **残課題**
- 末尾に `Refs #<導入調査 Issue 番号>`

本文の更新は、取得 → 書き換え → 更新の順に行う（SKILL.md の「GitHub の操作」）。段を足したとき、Validation が変わったとき、AIレビュー・人間レビュー対応を終えたときに更新する。

## 完了条件

- 段01のスタック表のすべての段の PR がオープンで、各段の CI `quality-gate` が success
- UI のある段の画面確認が済み、メインがスクショを見ている
- 触る場所チェックリストがすべて済んでいる
- 仮決定一覧が最新で、各仮決定に「最終レビューで判断してほしい点」がある
- 次は `references/ai-review.md` に進む（人間に報告して止まらない）
