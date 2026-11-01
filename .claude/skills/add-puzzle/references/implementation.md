# 実装

段01の本実装スタック表に沿って、段ごとに PR を積む。人間に聞かず、論点は仮決定で進めて各段の PR 本文に書く。

## ブランチと PR

- ブランチ: `claude/<prefix>-NN-<topic>`（`NN` は2桁、`<topic>` は段01のスタック表の英語名）。base は前段のブランチ。段01の base は調査 PR のブランチ。
- 土台の `main` はスタックを作り始めた時点のもの。作業中に `main` を取り込まない。
- PR は段ごとに1本、オープンで作る。作成は `references/github.md` に従い、`/pr` は使わない。
- 各段の先端で `./scripts/verify.sh` が通るようにする。大きすぎるコミット（数十ファイル）は責務ごとに分ける。

## 標準スタック

段の範囲は今の main の契約に合わせてある。`src/games/` に置いたゲームはすべて `gameCatalog` に載っていること（`frontend/src/game-catalog/game-catalog.test.ts`）、`frontend/biome.json` の依存規則が全ゲームから生成した規則と一致すること（`frontend/scripts/dependency-rules.test.ts`）、`GameCatalogEntry` と `usePlayableGame` が記録の表示定義を要ることが前提になる。

| 段 | topic | 範囲 | 完成条件 |
|---|---|---|---|
| 01 | research | 実装前提調査（識別表・仮決定一覧・スタック表） | 文書のみ。`references/research.md` §4 |
| 02 | rules | `puzzle/`・`problem/problem.ts`・`problem/generator.ts`・一意性ソルバー（UI なし）。`generate:dependency-rules` による `frontend/biome.json` の再生成と、カタログ未掲載の除外（下記） | ルール・生成・一意性・identity のテスト。ルール判定の不変条件の性質テスト（正解の配置で全一致、ランダムな途中盤面を完全な判定器と突き合わせる等）。研究用 Python がある場合は TS へ移植し、固定盤面で出力の一致をテストする |
| 03 | playable | `session/`・`play/`・最小の `ui/`・View・pages・`router.ts`。固定問題または仮の出題。`game-catalog/<game>/` に入口とプレイ画面のパスだけのエントリと `Playable<Game>`（下記） | URL 直打ちでクリアまで遊べる。`?problem=<問題ID>` で問題を指定して開ける |
| 04 | play-ui | 盤面の仕上げ、操作、状態の知らせ、待った・リセット、遊び方（SPEC-016）、クリア演出 | 画面確認（下記）でエラー 0・横スクロール無し・レイアウトシフト無し。320px でマスを正確に押せる |
| 05 | difficulty | 人間向け解法器、単純なプレイヤー（貪欲・1手ずつの試し置き・総当たり等）、`problem/difficulty-analysis.ts`、`difficulty.ts`、分析スクリプト、`<パズル名>難易度.md` | 分析と単純なプレイヤーがプレイ条件（補助表示・待った・盤面上限など）を引数に取り、分析スクリプトが条件ごとの分布表を固定 seed の同じ候補集合で出せる。帯ごとの分布、最上位が単純なプレイヤーに押し切られない、評価不能の扱い、盤面の逆転なし |
| 06 | problem-pool | `problem/problem-pool.json`・`problem-pool.ts`・生成スクリプト `--verify`、`problem-selection.ts` | 生成は途中結果を追記し、再実行で続きから再開できる。件数と `--verify`（全問を identity から作り直して一致）で完了を確かめる。各レベルの問題数、バンドル増分を PR に書く |
| 07 | pictogram | `assets/pictogram.svg`（`/design-game-pictogram` を add-puzzle から呼ぶときのモード）と `<パズル名>ピクトグラム検討.md`・代替案の SVG（`docs/パズル/導入調査/<パズル名>/ピクトグラム検討/`） | 人間の選択を待たず、磨いた候補を推奨付きで並べて仮採用する。`check_svg.py` PASS。カタログには載せない |
| 08 | difficulty-select | `ui/<Game>DifficultyPreview.tsx`、難易度選択の View | 「仮の決まり」を満たす。上のレベルが下のレベルの構成を含む入れ子・単調性のテスト |
| 09 | score | `score.ts`・`play-record.ts`・`play-attempt.ts`・`diagnostics.ts`、`<パズル名>成績評価.md` | 生の事実を保存し評価は読み出し時に計算。単純なプレイヤー（総当たり・試し置き）が perfect に届かない。配点・基準時間は仮置きと PR と成績評価文書に書く |
| 10 | result-records | 結果画面・記録・再プレイ・検証情報の接続（`usePlayableGame`、`Recorded<Game>Result`）、完全な `GameCatalogEntry` と `gameCatalog` への登録、ゲーム選択への掲載、カタログ未掲載の除外を外す | 下の「触る場所チェックリスト」がすべて済む。記録から結果画面と遊び直しが開ける |
| 11 | spec | `SPEC-NNN.md`、台帳、実装前提調査の識別表・「実装で確定した差分」表・各段の PR 本文の「AI が決めたこと」の反映 | SPEC に画面・演出・アルゴリズム・係数・仮であることを書かない。台帳は `references/final-review.md` の「マージと台帳」 |

段の足し引きは段01のスタック表に書いてから行う（組み替えは認識合わせで許可を得ている）。前例: ソルバー・生成器を独立段にする（詰将棋 03 solver・04 generator）、ピクトグラムをゲーム選択と同じ段にする（スライドパズル 07）。段を足しても、カタログとゲーム選択への掲載は記録・結果画面をつなぐ段に置く。最上段の名前は固定せず、段01のスタック表の最後の段とする。

TODO(人間判断): 未マージのチュートリアル Skill（`origin/docs/game-tutorial-skill`）を段として組み込むか。既定: 組み込まない。

### カタログに載せるまでの扱い

ゲームのディレクトリを作った段（02）から、記録と結果画面をつなぐ段（10）まで、次の2つで main の契約を保つ。除外の実例は `origin/claude/tsume-shogi-02-rules`〜`-11-score`（`-12-result-records` で外した）と `origin/claude/hamiltonian-02-rules`・`-03-playable`、パスだけのエントリの実例は `origin/claude/hamiltonian-03-playable`。

- `frontend/src/game-catalog/game-catalog.test.ts`: `concreteGames` から外す一覧 `gamesNotInCatalogYet = ["<game>"]` を足し、`.filter((name) => !gamesNotInCatalogYet.includes(name))` で除く。段10で一覧と filter を消す。
- `frontend/src/game-catalog/<game>/<game>-catalog-entry.ts`（段03）: `Pick<GameCatalogEntry, "entryPath" | "playPath">` を満たす入口とプレイ画面のパスだけを持ち、`gameCatalog` には入れない。`Playable<Game>` は `usePlayableGame` を使わず、`useRequestedProblem`・`useProblemIdQuerySync`・`useGameNavigation` でプレイ画面をつなぐ。段10で完全な `GameCatalogEntry`（`.tsx`）と `usePlayableGame` に置き換える。

実例のコードには「〜の段でカタログへ載せる」というコメントがあるが、写さない。予定や段の名前をコメントに書かない（`.claude/rules/self-documenting-code.md`）。一覧の名前で意図が伝わるようにする。

### 段ごとの注意

- **02 rules**: 調査の実験コードを本実装へ昇格させない。TS で書き起こし、Python との一致はテストで確かめる。`bun run --cwd frontend generate:dependency-rules` の結果をコミットに含める。
- **03 playable**: 完成後の表示や評価は仮でよい。仮であることを PR の「暫定の範囲」に書く。仮の「クリア」表示や完了パネルは置かない。
- **04 play-ui**: 待った・リセット・遊び方・ヘッダーは既存ゲームの共通部品（`frontend/src/components/` の `UndoButton`・`HowToPlayDialog` 等）と同じ形・位置にそろえる。わざと変えるなら PR 本文の「AI が決めたこと」に理由を書く。プレイ中に説明文で知らせず、盤面の形・色・動きで分からせる（`GAME.md`）。マスのタップは、iOS のダブルタップで隣のマスが押されたことにならない扱いを最初から入れる（手本: `frontend/src/games/reflection/ui/touch-tap.ts`）。
- **05 difficulty**: 解法器が緩すぎ・深すぎないかを、別のサブエージェントに代表問題で検証させる。単純なプレイヤーは合意した補助表示が出ている前提で動かす。
- **06 problem-pool**: `frontend/biome.json` の `files.includes` へ `"!src/games/<game>/problem/problem-pool.json"` を手で足す。生成は途中結果を追記して再開できる作りにし、実装担当は `timeout 590 bun run --cwd <worktree>/frontend generate:<game>-pool …` で区切って、件数がそろうまで繰り返す（Bash の前景は最長10分。実装担当は Monitor を持たない）。生成スクリプトが再開できない作りのまま長くかかるときは、実装担当はそう報告し、メインが `run_in_background` で回して Monitor で終わりを待ち、件数と `--verify` を確かめてから実装担当にコミットさせる。
- **07 pictogram**: 候補比較は `/tmp/<game>-work/` のギャラリーで行い、推奨付きで並べて仮採用する。代替案の SVG は `docs/パズル/導入調査/<パズル名>/ピクトグラム検討/` に置く。最終の選択は最終レビューで画像を並べて示す。
- **08 difficulty-select**: 既存ゲームのプレビュー（`frontend/src/games/*/ui/*DifficultyPreview.tsx`）が何を数や密度で表しているかを読んでから作る。
- **10 result-records**: カタログ未掲載の除外を消し、`frontend/src/views/PuzzleSelectionView.test.tsx` の一覧へ足す。
- **11 spec**: 予約した SPEC 番号を作成直前に調べ直す（`references/research.md` の手順1）。SPEC は今の決定として言い切る。

問題集の入力（ルール・生成器・分析・レベルの組み合わせ）を問題集の段より後で変えたら、問題集の段で再生成と `--verify` を行う。

### 仮の決まり

正本に定めは無いが、人間のレビューで繰り返し出た決まり。この Skill の中で適用する。

- 難易度プレビューは実問題の盤面そのものではなく、そのゲームの挑戦を抽象化した表現にする。ぱっと見でパズルの種別とレベル差が分かること。プレイ画面と同じ部品・表現を使う。
- 上のレベルほど盤面を小さくしない（盤面サイズと難易度を逆転させない）。

TODO(人間判断): この2つを `DESIGN.md`（§3 難易度選択）や `docs/パズル/難易度提供.md` へ移すか。既定: この Skill 内の仮の決まりとして適用し、`puzzle-experience-reviewer` は Major にせず Minor と最終レビューで見せる点（難易度プレビュー）で扱う。

## 手本の渡し方

段の実装担当には「直近パズルの同じ段の差分」を具体的に渡す。手本は Skill に固定せず、毎回探す。

```sh
git fetch --all --prune
# main にマージ済みのスタックの段（新しい順。claude/<prefix>-NN-<topic> の形のブランチのマージ）
git log origin/main --merges --first-parent --format='%h %ad %s' --date=short | grep -E 'claude/[a-z0-9-]+-[0-9]{2}-' | head -30
# 未マージのスタック（claude/<prefix>-NN-<topic> の形のブランチ）
git branch -r | grep -E 'origin/claude/[a-z0-9-]+-[0-9]{2}-' | sed -E 's/-[0-9]{2}-.*//' | sort | uniq -c
git diff <merge-sha>^1 <merge-sha>                             # マージ済みの段の差分
git diff origin/claude/<手本prefix>-<NN-1>-<topic> origin/claude/<手本prefix>-NN-<topic>   # 未マージの段の差分
```

新しいもの、main に近い（`git merge-base` が新しい）ものを優先する。

- 共通契約は main で変わり続ける。構造の手本は main 上の最新のゲームのコードを優先し、段の進め方の手本として過去のスタックを使う。
- 写させるのではなく、責務の置き方・テストの粒度・PR の書き方をそろえる目的で渡す。手本にある経緯のコメントは写さない。

## brief と段カード

`/tmp/<game>-work/` に置く一時ファイル。段を始めるたびに、PR 本文と段01の文書から作り直す。

- **brief**（`brief.md`、全段共通）: 識別表（パズル名・ゲーム ID・ブランチ接頭辞・候補 ID・SPEC 番号）、作業ディレクトリ（`/tmp/<game>-work/`。一時ファイル・撮影・Playwright のスクリプトの置き場所）、リポジトリの決まり（`AGENTS.md`・`.claude/rules/`）、bun の PATH、`bun.lock` を触らない、渡された worktree の中だけで作業してコミットまで行い push しない、担当外を触らない、コードとコミットに試行錯誤や経緯を残さない、報告ファイルのパス（`/tmp/<game>-work/stage-NN-report.md`。全文をここに書き、返答は要約とパス）、認識合わせの合意内容と最終レビューでの人間の判断（あれば）、`references/pitfalls.md` のパス。
- **段カード**（`stage-NN-card.md`、段ごと）: 段01スタック表の該当行（範囲と完成条件）、前段の PR 本文の残課題、仮決定一覧の該当行、触ってよいパス、開発サーバーのポート、`references/pitfalls.md` のうちこの段に効く領域。直しのときは、直す指摘（レビュー Agent の findings や最終レビューの指摘と読み方）と原因の段。

## 各段の進め方

1. **worktree を用意する**: 段の実装担当はブランチを作れないので、メインが前段から作る。前段は origin のものを指定する（ローカルブランチが無い新しいコンテナでも同じ形で作れる）。

   ```sh
   git fetch --all --prune
   git worktree add /tmp/<game>-work/stage-NN -b claude/<prefix>-NN-<topic> origin/claude/<prefix>-<前段>
   ```

   既にある段を直すときは、ローカルブランチが無ければ `git branch claude/<prefix>-NN-<topic> origin/claude/<prefix>-NN-<topic>` で作ってから `git worktree add /tmp/<game>-work/stage-NN claude/<prefix>-NN-<topic>`。

2. **実装担当を起動する**: Agent ツールで `subagent_type: puzzle-stage-implementer`、`model: opus`。prompt に渡すのは次の4つだけ（識別表・作業ディレクトリ・報告ファイルのパスは brief、ポートは段カードに書く）。

   ```text
   worktree: /tmp/<game>-work/stage-NN
   段カード: /tmp/<game>-work/stage-NN-card.md
   brief: /tmp/<game>-work/brief.md
   手本: <手本の段のブランチまたは merge sha と、見るパス>
   ```

   担当はその worktree で実装・検証し、コミットまで行う。push はしない。必要な作り方の Skill（`/design-game-pictogram` 等）や `references/pitfalls.md` は自分で読む。
3. **確かめる**: 差分の全文はメインに入れない。`git -C <worktree> log --stat origin/claude/<prefix>-<前段>..HEAD` と報告ファイルを読み、段の完成条件と照らす。verify は報告をうのみにせず、メインが worktree で `./scripts/verify.sh` を回して末尾を見る（10分を超えそうなら `run_in_background` と Monitor）。UI のある段は、担当が撮った画面をコンタクトシート（幅とテーマを1枚に並べた画像。例: `montage <画像…> -tile 4x -geometry +4+4 sheet.png`）にして、メインが自分の目で見る。
4. **段のセルフレビュー**: `references/ai-review.md` の「段ごとのセルフレビュー」。critical / major があれば、指摘を段カードに足して新しい実装担当を同じ worktree で起動し直す。
5. **push と PR**: `git push -u origin claude/<prefix>-NN-<topic>` の後、PR を作る。全段の PR 本文の Stack 表に新しい段を足す。
6. **worktree を消す**: `git worktree remove /tmp/<game>-work/stage-NN`。段のブランチを checkout した worktree が残っていると、積み直し（`--update-refs`）がその段を書き換えずに飛ばす。
7. **CI を確かめる**: `quality-gate` の結果を Validation に書く。失敗していれば直す。実行中なら次の段へ進み、人間に知らせる前にもう一度確かめる（`references/github.md`）。

段は段01のスタック表の順に1段ずつ進める。各段の worktree は前段の push 済みブランチから作るため、段を並行して起動しない。ピクトグラムの候補づくりのように段の成果物に依存しない下準備だけは、`/tmp/<game>-work/` で並行して進めてよい。

## 画面確認

段の実装担当が行い、メインは結果とコンタクトシートを見る。worktree ごとに依存を入れ、開発サーバーのポートを段カードで分ける。

```sh
bun install --cwd <worktree>/frontend --frozen-lockfile
bun install --cwd <worktree>/tools/semantic-lint --frozen-lockfile   # verify.sh が使う
bun run --cwd <worktree>/frontend dev -- --port <ポート> --strictPort   # run_in_background で起動し、終わったら TaskStop で止める
```

端末の標準は Playwright の `devices['iPhone 13']`（390×664 = iOS Safari の表示領域相当、タッチ）と PC（1280×800）。撮影・計測・試遊で同じものを使う。

- プレイ画面は `?problem=<問題ID>` で問題を指定して開ける。内部診断（開発サーバー、または `PA_ZZLE_INTERNAL_DIAGNOSTICS=true` を付けたビルド）で増えるのは検証情報のダイアログだけ。
- 撮影とブラウザの確認は `scripts/capture-screens.mjs`（開いて撮るだけで、操作しない）。

```sh
cat > /tmp/<game>-work/screens.json <<'JSON'
[{ "path": "/", "name": "home" },
 { "path": "/puzzles/<game>", "name": "difficulty" },
 { "path": "/puzzles/<game>/play/1?problem=<問題ID>", "name": "play-l1-start" }]
JSON
node .claude/skills/add-puzzle/scripts/capture-screens.mjs \
  --base-url http://localhost:<ポート> --game <game> \
  --screens /tmp/<game>-work/screens.json --out /tmp/<game>-work/shots/<NN>
```

- 出力は `<game>__<画面名>__<幅>__<テーマ>.png` と `browser-check.txt`（画面ごとの pageerror・console.error と横スクロールの有無）。既定は幅 390 / 1280 × ライト / ダーク。幅 600 未満は iPhone 13 の幅だけを差し替えて撮る。盤面の大きさが論点のときは `--widths 320,360,375,390,1280`。
- 操作してクリアまで進める確認、操作途中・状態の知らせが出た状態の撮影、操作中に盤面が動かないことの計測（boundingBox を毎フレーム測る等）、タップ領域・重なり順・プレイ中の文の計測は、担当が Playwright のスクリプトを `/tmp/<game>-work/` に書いて行う（計測の観点は `references/pitfalls.md` の「プレイUI・プレビュー・見た目」）。
- 計測のスクリプトも、スマホは `{ ...devices['iPhone 13'] }`（`defaultBrowserType` を除く）で開く。
- 合格条件: `browser-check.txt` の problems が 0、操作してクリアまで進める、操作中に盤面が動かない。
- 環境に WebKit が無いので、iOS Safari 固有の挙動（ダブルタップ、描画順、ピンチ拡大時のはみ出し）は確かめられない。確かめていないと書き、最終レビュー資料の「iOS 実機で見てほしい点」に回す。

## 触る場所チェックリスト

`.claude/rules/game-structure.md` の「ゲームを追加するとき」の4手順に、規則に書かれていないが全ゲームが持つものを足したもの。段10の完成条件で全項目を確かめる。

TODO(人間判断): 規則に無い項目を `game-structure.md` 側へ足すか。既定: この Skill のチェックリストに留める。

### 1. `frontend/src/games/<game>/`（標準配置）

- [ ] `puzzle/`（状態・ルール・合法手・状態遷移）
- [ ] `problem/problem.ts`・`generator.ts`・`difficulty-analysis.ts`・`generation/`（ソルバー・人間向け解法器・単純なプレイヤー）
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
- [ ] `frontend/scripts/generate-<game>-problem-pool.ts`（`--verify`・再開つき）と `analyze-<game>-corpus.ts`（プレイ条件の引数つき。規則に無い）
- [ ] `frontend/package.json` の `generate:<game>-pool`・`analyze:<game>`（規則に無い）
- [ ] backend は変更しない（ゲーム固有コードを持たない）

### 5. 文書

- [ ] `docs/パズル/導入調査/<パズル名>/` の実装前提調査の識別表と「実装で確定した差分」表
- [ ] `<パズル名>難易度.md`・`<パズル名>成績評価.md`・`<パズル名>ピクトグラム検討.md`（＋代替案の SVG を `ピクトグラム検討/` に）
- [ ] `docs/プロダクト/仕様/パズル/SPEC-NNN.md`（章立ては既存のパズル仕様にそろえる: ルールと問題 → 状態の知らせ・補助 → やり直し → 難易度 → 評価）
- [ ] 台帳の4ゲートと導入判断、`PUZZLE-NNN.md` の索引（`references/final-review.md` の「マージと台帳」）
- [ ] 要求・要件、ゲーム/アプリ共通仕様、`APP.md`・`GAME.md`・`DESIGN.md`・`AGENTS.md` は通常変えない。変えるなら最終レビュー資料の「AI が決めたこと」の上位に置く

## PR 本文

`.claude/skills/pr/references/pr.md` の型（What / Why / Validation / Impact・Risk）に次を加える。制作経緯・テスト件数の羅列・手元画像のパスは書かない。

- **AI が決めたこと**: この段で決めた論点、理由、比べた案、覆したときの費用
- **暫定の範囲**: 仮の表示・仮置きの値
- **Validation**: 段の先端での `./scripts/verify.sh` PASS、CI `quality-gate` の結果、画面確認の条件（端末・幅・テーマ）と結果、問題集の `--verify`
- **Stack**: 全段の表（段 / ブランチ / PR / 状態）と、この PR の位置
- **積み直しの記録**: 積み直したときの日付と旧コミット ID（`scripts/restack.sh` の出力）
- **残課題**
- 末尾に `Refs #<導入調査 Issue 番号>`

本文は、段を足したとき、Validation が変わったとき、積み直したときに更新する。

## 完了条件

- 段01のスタック表のすべての段の PR がオープンで、各段の CI `quality-gate` が success
- UI のある段の画面確認が済み、メインがコンタクトシートを見ている
- 触る場所チェックリストがすべて済んでいる
- 段のブランチを checkout した worktree が残っていない
- 次は `references/ai-review.md` に進む（人間に知らせない）
