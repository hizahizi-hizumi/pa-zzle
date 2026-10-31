# 実装フェーズ（implement）

段01の本実装スタック計画に沿って、段ごとに PR を積む。人間の判断は求めず、論点は仮決定で進めて仮決定一覧へ追記する。

## ブランチと PR

- ブランチ: `claude/<game>-NN-<topic>`（`NN` は2桁、`<topic>` は下表の英語名）。
- base: 前段のブランチ。段01の base は調査 PR のブランチ。
- 土台の `main` はスタックを作り始めた時点のもの。作業中に `main` を取り込まない。
- PR は段ごとに1本、オープンで作る（`/pr baseBranch=<前段のブランチ>`）。
- 各段のコミットは単独で `./scripts/verify.sh` が通る粒度にする。大きすぎるコミット（数十ファイル）は責務ごとに分ける。

## 標準スタック

| 段 | topic | 範囲 | 完成条件 | 人間レビューの観点 |
|---|---|---|---|---|
| 01 | research | 実装前提調査（仮決定一覧・スタック計画） | 文書のみ。`references/research.md` §5 | ― |
| 02 | rules | `puzzle/`・`problem/problem.ts`・`problem/generator.ts`・一意性ソルバー（UI なし） | ルール・生成・一意性・identity のテスト。研究用 Python がある場合は TS へ移植し、固定盤面で出力の一致をテストする | ゲーム体験 |
| 03 | playable | `session/`・`play/`・最小の `ui/`・View・pages。固定問題または仮の出題 | URL 直打ちでクリアまで遊べる。開発サーバーで問題 ID を URL 指定して開ける | ゲーム体験 |
| 04 | play-ui | 盤面の仕上げ、操作、状態の知らせ、待った・リセット、遊び方（SPEC-016）、クリア演出 | 画面確認（下記）でエラー 0・横スクロール無し・レイアウトシフト無し。320px でマスを正確に押せる | ゲーム体験・フィードバック |
| 05 | difficulty | 人間向け解法器、`problem/difficulty-analysis.ts`、`difficulty.ts`、分析スクリプト、`<名前>難易度.md` | 帯ごとの分布、盤面サイズが上のレベルで逆転しない、最難の帯が自明でない、評価不能の扱い | 難易度 |
| 06 | problem-pool | `problem/problem-pool.json`・`problem-pool.ts`・生成スクリプト `--verify`、`problem-selection.ts` | 全問を identity から作り直して一致する。各レベルの問題数、バンドル増分を PR に書く | 難易度 |
| 07 | pictogram | `assets/pictogram.svg`（`/design-game-pictogram`）、カタログへの登録、ゲーム選択 | AI が候補から仮採用し、代替案と `<名前>ピクトグラム検討.md` を残す。`check_svg.py` PASS | ピクトグラム |
| 08 | difficulty-select | `ui/<Game>DifficultyPreview.tsx`、難易度選択の View | プレビューの決まり（下記）を満たす。上のレベルが下のレベルの構成を含む入れ子・単調性のテスト | 難易度プレビュー |
| 09 | score | `score.ts`・`play-record.ts`・`play-attempt.ts`・`diagnostics.ts`、`<名前>成績評価.md` | 生の事実を保存し評価は読み出し時に計算。配点・基準時間は仮置きと明記 | スコア |
| 10 | catalog | `game-catalog/<game>/`、結果画面・記録・再プレイ・検証情報の接続 | 下の「触る場所チェックリスト」がすべて済む。記録から結果画面と遊び直しが開ける | ゲーム体験・スコア |
| 11 | spec | `SPEC-0NN.md`、台帳、実装前提調査の「実装で確定した差分」表 | SPEC に画面・演出・アルゴリズム・係数を書かない。仮決定の値は「実プレイで検証する仮決定」と書く | ― |

段の足し引きは段01の計画に書いてから行う。前例: ソルバーを独立段にする（スライドパズル 05、詰将棋 03・04）、外部ライブラリの境界を独立段にする（詰将棋 02）、ピクトグラムをゲーム選択と同じ段にする（スライドパズル 07）、段数を圧縮する（氷の床迷路は7段）。

TODO(人間判断): 未マージのチュートリアル Skill（`origin/docs/game-tutorial-skill`）を段として組み込むか。叩き台では組み込まない。

### 段ごとの注意

- **02 rules**: 調査の実験コードを本実装へ昇格させない。TS で書き起こし、Python との一致はテストで確かめる。
- **03 playable**: 完成後の表示や評価は仮でよい。仮であることを PR に書く。
- **04 play-ui**: 待った・リセット・遊び方・ヘッダーは既存ゲームの共通部品（`frontend/src/components/` の `PlayHeader`・`UndoButton`・`HowToPlayDialog` 等）と同じ形・位置にそろえる。わざと変えるなら仮決定一覧に理由を書く。プレイ中に説明文で知らせず、盤面の形・色・動きで分からせる（`GAME.md`）。
- **05 difficulty**: 解法器が緩すぎ・深すぎないかを、別のサブエージェントに代表問題で検証させる（リフレクション段05では最難の判定が 753 問から 138 問に変わった）。
- **06 problem-pool**: `frontend/biome.json` の `files.includes` へ `"!src/games/<game>/problem/problem-pool.json"` を手で足す。`--verify` が長時間かかる場合は別のワークツリーで回し、他の作業と並行する。
- **07 pictogram**: 候補比較は `/tmp` のギャラリーで行い、人間の選択は待たずに仮採用で進める。最終の選択は人間レビュー領域。
- **08 difficulty-select**: プレビューは盤面そのものではなく抽象化する。ぱっと見でパズルの種別とレベル差が分かること。プレイ画面と同じ部品・表現を使う。実問題をそのままプレビューにしない。既存ゲームのプレビュー（`frontend/src/games/*/ui/*DifficultyPreview.tsx`）が何を数や密度で表しているかを読んでから作る。
- **11 spec**: SPEC 番号は作成直前に全ブランチで確認する（下記「採番」）。

## 手本の渡し方

サブエージェントには「直近パズルの同じ段の差分」を具体的に渡す。特定 sha を Skill に固定せず、毎回探す。

```sh
git fetch --all --prune
git log --all --oneline | grep -E '<手本game>-NN'          # 例: reflection-04、tsume-shogi-06
git branch -r | grep 'claude/<手本game>-'                    # 未マージの手本はブランチから
git show <merge-sha> --stat                                  # マージ済みなら merge commit の差分
git diff <merge-sha>^1 <merge-sha>                           # その段の差分全体
git show origin/claude/<手本game>-NN-<topic>:<path>          # 未マージのブランチ上のファイル
```

現時点の代表例: リフレクション（main にマージ済み、#412〜#422）、詰将棋（未マージ、`origin/claude/tsume-shogi-NN-*`、#460〜#483）。手本を選ぶ基準は次のとおり。

- 共通契約は main で変わり続ける（共通の結果画面、問題 ID の URL、プレイ試行の記録、遊び方など）。構造の手本は main 上の最新のゲームのコードを優先し、段の進め方の手本として過去のスタックを使う。
- 手本のコードを写すのではなく、責務の置き方・テストの粒度・PR の書き方をそろえる目的で渡す。

## brief と handoff

メインは作業開始時に scratchpad へ2種類のファイルを置き、サブエージェントには最初に両方を読ませる。

- **brief**（全段共通）: リポジトリのパス、bun の PATH、`bun.lock` を触らない、コミット・push しない、担当外を触らない、コードとコミットに試行錯誤のコメントや経緯を残さない、`AGENTS.md` と `.claude/rules/` を読む、報告の形（変更ファイル・検証結果・残った論点・仮決定）。
- **handoff**（段ごと）: 段の範囲と完成条件、手本（上の探し方で見つけた sha とパス）、前段からの申し送り、仮決定一覧の該当行、触ってよいパス。

## 各段の進め方

1. 段のブランチを前段から作る。
2. handoff を書き、Opus サブエージェントに実装させる。
3. メインが差分を読む。触る場所チェックリストと段の完成条件を照らす。
4. `./scripts/verify.sh` を走らせる。UI のある段は下の画面確認を行い、スクショを自分で見る。
5. 段ごとのセルフレビュー（`references/ai-review.md` の「段ごとのセルフレビュー」）を別のサブエージェントで行い、指摘を直させる。
6. メインがコミット（`/commit`）し、push し、PR を作る（`/pr`）。
7. 新しく決めた論点を仮決定一覧に追記し、次の段の handoff に申し送りを書く。

## 画面確認

```sh
bun install --cwd frontend
bun run --cwd frontend dev    # 背景で起動。既定は http://localhost:5173
```

- 開発サーバーでは内部診断（検証情報ダイアログ・問題 ID 指定）が使える。ビルドやプレビューで内部診断が要る場合は `PA_ZZLE_INTERNAL_DIAGNOSTICS=true` を付けてビルドする。
- Playwright は環境に導入済みの Node 版（Chromium 同梱）を使う。`mkdir -p /tmp/<game>-shots` の後、`NODE_PATH="$(npm root -g)" node /tmp/<game>-shots.js` で実行する。

```js
const { chromium } = require("playwright");
const base = "http://localhost:5173";
const paths = ["/", "/puzzles/<game>", "/puzzles/<game>/play/<level>"]; // 段に応じて足す
const viewports = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const viewport of viewports) for (const colorScheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport, colorScheme, hasTouch: viewport.width < 600 });
    page.on("pageerror", (e) => errors.push(`${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) errors.push(`横スクロール: ${p} ${viewport.width} ${colorScheme}`);
      const name = `${p.replaceAll("/", "_") || "_home"}-${viewport.width}-${colorScheme}.png`;
      await page.screenshot({ path: `/tmp/<game>-shots/${name}`, fullPage: true });
    }
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? errors.join("\n") : "errors: 0");
})();
```

- 確認する幅は 390 と 1280、それぞれライト/ダーク。盤面の大きさが論点のときは 320・360・375 も足す。
- 合格条件: pageerror・console.error 0、横スクロール無し、操作してクリアまで進める、操作中に盤面が動かない（必要なら boundingBox を毎フレーム測る）。
- スクショはメインが Read で開いて自分の目で見る。見ていないものを「確認済み」と書かない。iOS Safari 固有の挙動（ダブルタップ、描画順、ピンチ拡大時のはみ出し）は確かめられないので、確かめていないと書く。

## 触る場所チェックリスト

`.claude/rules/game-structure.md` の「ゲームを追加するとき」の4手順に、規則に書かれていないが全ゲームが持つものを足したもの。段10の完成条件で全項目を確かめる。

TODO(人間判断): 規則に無い項目を `game-structure.md` 側へ足すか、この Skill のチェックリストに留めるか。

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
- [ ] `<game>/Playable<Game>.tsx`、`<game>/Recorded<Game>Result.tsx`
- [ ] `game-catalog.ts` の `gameCatalog` の並びへ追加

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

- [ ] `docs/パズル/導入調査/<パズル名>/` の実装前提調査に「実装で確定した差分」表
- [ ] `<名前>難易度.md`・`<名前>成績評価.md`・`<名前>ピクトグラム検討.md`（＋代替案の SVG）
- [ ] `docs/プロダクト/仕様/パズル/SPEC-0NN.md`（章立ては既存のパズル仕様にそろえる: ルールと問題 → 状態の知らせ・補助 → やり直し → 難易度 → 評価）
- [ ] 台帳の4ゲートの状態と `PUZZLE-NNN.md` の索引（導入判断は H2 まで変えない）
- [ ] 要求・要件、ゲーム/アプリ共通仕様、`APP.md`・`GAME.md`・`DESIGN.md`・`AGENTS.md` は通常変えない。変えるなら別の判断として人間に示す

## 採番

SPEC 番号は段11で、作成直前に全ブランチで最大値を調べて次の番号にする。過去に並行スタックと衝突して振り直した例が複数ある（詰将棋とハミルトン路がともに SPEC-019 を予定した）。

```sh
git fetch --all --prune
git grep -h -o 'SPEC-[0-9]\+' $(git for-each-ref --format='%(refname)' refs/remotes) -- docs/プロダクト/仕様/ | sort -u | tail -3
```

段01で番号を「予約」と書かない。TODO(人間判断): 採番衝突の防止方法。

## PR 本文

`/pr` の型（What / Why / Validation / Impact・Risk）に次を加える。制作経緯・テスト件数の羅列・手元画像のパスは書かない。

- **見てほしい点**: この段で最終人間レビューに判断してほしいこと（人間レビューの観点に対応づける）
- **暫定の範囲**: 仮の表示・仮置きの値
- **仮決定**: この段で追加した仮決定（仮決定一覧の行へのリンク）
- **Validation**: `./scripts/verify.sh` PASS、画面確認の条件と結果、問題集の `--verify`
- **Stack**: 全段の PR 番号と現在の段の位置
- **残課題**

## 完了条件

- 計画したすべての段の PR がオープンで、各段で `./scripts/verify.sh` が PASS
- UI のある段の画面確認が済み、メインがスクショを見ている
- 触る場所チェックリストがすべて済んでいる
- 仮決定一覧が最新で、各仮決定に「最終レビューで判断してほしい点」がある
- 次は `references/ai-review.md` に進む（人間に報告して止まらない）
