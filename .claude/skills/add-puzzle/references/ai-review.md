# 品質の作り込み（AI レビュー）

人間に見せる前に、AI 側で見つけられるものをすべて見つけて直し、人間に見てもらう点を絞る。柱は、機械検査、プレイヤー目線の試遊、経緯を渡さないレビュー Agent 3種の3つで、どれも省略しない。段ごとのセルフレビュー（実装中）と、全段の実装後と指摘の反映後に行う全体の作り込みの2種類がある。全体の作り込みは省略しない。人間に知らせず、終わるまで止まらない。

## レビュー Agent と入力

レビューは経緯を知らない新しいサブエージェントに行わせる。Agent ツールで `subagent_type` に Agent 名、`model` に `opus` を指定する。prompt には下表の入力だけを渡す。経緯（なぜそう作ったか、どの段で何を直したか、前回の findings）は渡さない。入力の正本は各 Agent ファイルの「責務」節で、食い違えば Agent ファイルに合わせる。

3つの Agent に共通して渡すもの:

| 入力 | 中身 | 作り方 |
|---|---|---|
| リポジトリのルート | レビューする版を展開したディレクトリ | 下の「レビューする版の用意」 |
| 対象ゲーム | ゲーム ID `<game>` とパズル名 | 識別表 |
| 段の範囲と完成条件 | 段01のスタック表の該当行（全体の作り込みでは全行） | `/tmp/<game>-review/scope.md` に写す |
| 認識合わせの合意内容と、最終レビューでの人間の判断 | 導入調査 Issue の合意節と、最上段 PR 本文の「最終レビュー（N回目）」節の人間の判断（AI の読み方を含む） | `/tmp/<game>-review/decisions.md` に写す。決まったこととして書き、経緯は書かない |

Agent ごとに加えて渡すもの:

| Agent | 見るもの | 加えて渡す入力（すべて必須） |
|---|---|---|
| `puzzle-code-reviewer` | コード・テスト・構造・依存方向 | 比較基準の範囲（例: `<BASE>..claude/<prefix>-<最上段>`）、変更ファイル一覧のパス、差分本文のパス。Agent は Bash を持たないので、差分はメインが取って渡す |
| `puzzle-experience-reviewer` | 体験・既存ゲームとの一貫性・見た目 | 対象パズルのスクショのパス一覧、比較用の既存ゲームのスクショのパス一覧、ブラウザ確認結果（`browser-check.txt`）のパス |
| `puzzle-document-reviewer` | SPEC・導入調査・台帳 | SPEC のパス（段01では「未作成」）、導入調査ディレクトリ、台帳の該当行と `PUZZLE-NNN.md` のパス、使用中の番号の一覧（`list-used-ids.sh` の出力ファイル）のパス |

```text
リポジトリのルート: /tmp/<game>-review/tree
対象ゲーム: <game>（<パズル名>）
段の範囲と完成条件: /tmp/<game>-review/scope.md
認識合わせの合意内容と、最終レビューでの人間の判断: /tmp/<game>-review/decisions.md
比較基準の範囲: <BASE>..claude/<prefix>-<最上段>
変更ファイル一覧: /tmp/<game>-review/changed-files.txt
差分本文: /tmp/<game>-review/diff-ui.patch（責務: ui）
```

報告は短い固定形式で返させ、詳細は `/tmp/<game>-review/<Agent 名>-<責務>.md` に書かせる。

## レビューする版の用意

段のブランチをほかの worktree で checkout すると、積み直し（`--update-refs`）がそのブランチを飛ばすので、必ず `--detach` で作る。

```sh
git fetch --all --prune
TOP=origin/claude/<prefix>-<NN>-<topic>                # 段ごとならその段、全体なら最上段
BASE=$(git merge-base origin/main "$TOP")             # スタックの土台
mkdir -p /tmp/<game>-review
git worktree add --detach /tmp/<game>-review/tree "$TOP"
git diff --name-only "$BASE" "$TOP" > /tmp/<game>-review/changed-files.txt
git diff "$BASE" "$TOP" -- . ':!*problem-pool.json' ':!docs/' ':!scripts/research/' > /tmp/<game>-review/diff.patch
```

- Agent は読むだけなので、依存のインストールは要らない。画面をこのツリーで撮るときだけ `bun install --cwd /tmp/<game>-review/tree/frontend --frozen-lockfile` を行う。
- 差分が大きい（目安 3,000 行超）ときは責務ごとに分け、`puzzle-code-reviewer` を責務ごとに並行で起動する。分け方の例: `puzzle`（`games/<game>/puzzle/`・`problem/`・直下の `.ts`）、`session`（`session/`・`play/`）、`ui`（`games/<game>/ui/`）、`catalog`（`game-catalog/`・`pages/`・`views/`・`router.ts`）、`scripts`（`frontend/scripts/`・`biome.json`・`package.json`）。
- 使用中の番号: `.claude/skills/add-puzzle/scripts/list-used-ids.sh > /tmp/<game>-review/ids.txt`。
- 終わったら `git worktree remove /tmp/<game>-review/tree`。

## 段ごとのセルフレビュー（実装中）

段の実装担当がコミットした後、push の前に行う。範囲はその段だけ。

- リポジトリのルートは段の worktree、比較基準の範囲は `<前段>..HEAD`。`scope.md` にはその段の行だけを書く。Agent は範囲外の未実装を findings にしない。
- コードのある段: `puzzle-code-reviewer`。UI のある段（03・04・08・10 など）: 加えて `puzzle-experience-reviewer`。ピクトグラムの段は `/design-game-pictogram` の検査とメインの目視で足りる。文書の段（01・SPEC の段）: `puzzle-document-reviewer`。
- 遊べる段（03 playable・04 play-ui・08 difficulty-select 以降）: 加えて `puzzle-playtester` を軽く1回。入力は手順4と同じ6つで、遊ぶのは L1 を1問、端末は iPhone 相当だけ、比較用の既存ゲームは「無し」、アプリの URL は段の worktree で起動した開発サーバーにする。難易度選択が無い段では、入口パスにプレイ画面の URL（`?problem=<問題ID>`）を渡す。
- 難易度の段: 解法器が緩すぎ・深すぎないかを、別の Opus サブエージェントに代表問題で検証させる。
- critical / major と、試遊で見つかった不具合・決まりへの違反は、指摘を段カードに足して実装担当に直させてから push する。

## 全体の作り込みの手順

### 1. 機械検査

- 各段の CI `quality-gate` が success であること（SKILL.md の「GitHub の操作」）。
- 問題集: `bun run --cwd frontend generate:<game>-pool -- --verify` が全問一致する。あわせて監査として、レベルごとの件数・評価不能の数・完全一致と回転反転を正規化した重複・主要特徴のレベル内の幅・規模（盤面・要素数・手数）とレベルの相関・盤面の逆転を出す。
- ルール判定: 性質テスト（正解の配置で全一致、ランダムな途中盤面を完全な判定器と突き合わせる、補助表示が判定と矛盾しない）が段02・04 にあるか。無ければ足させる。
- 画面: 下の「2. 画面の採取と計測」。
- `TYPESAFE_API_KEY` があれば `bun run --cwd tools/semantic-lint check -- frontend/src/games/<game>` を走らせる。無ければ「意味 lint は未実施」と資料に書く。

TODO(人間判断): PR 段階で意味 lint を回すか（`TYPESAFE_API_KEY` を cloud 環境に入れるか）。既定: キーがあるときだけローカルで回し、無ければ未実施と書く。

### 2. 画面の採取と計測

最上段の worktree（`--detach`）で開発サーバーを起動し、`scripts/capture-screens.mjs` で撮る（`references/implementation.md` の「画面確認」）。撮影と操作のスクリプトはサブエージェントに任せてよい。メインはコンタクトシートを見て、個々の画像は `puzzle-experience-reviewer` に見させる。

- 対象の画面: ゲーム一覧、難易度選択（全レベルのプレビュー）、プレイ開始直後、操作の途中、状態の知らせが出た状態、遊び方、クリア演出、結果画面、記録一覧、記録から開いた結果画面。レベルで盤面の大きさが変わるなら最小・最大の両方。出力先は `/tmp/<game>-review/shots/`。
- 比較用: `frontend/src/game-catalog/game-catalog.ts` の並びと `git log` から直近に追加された既存ゲームを2つ選び、同じ画面を同じ条件で `/tmp/<game>-review/compare/<既存game>/` に撮る。
- 計測（Playwright。観点の詳細は `references/pitfalls.md` の「プレイUI・プレビュー・見た目」）: 横スクロール、ブラウザエラー、操作中のレイアウトシフト、色のちらつき、タップ領域、重なり順、プレイ中の説明文、390×844 で盤面と操作が一つの視野に収まるか、ダブルタップの再現。

### 3. 単純なプレイヤーのシミュレーション（下限の検査）

段05で作った単純なプレイヤー（貪欲・1手ずつの試し置き・総当たりやランダムな自然手など、パズルに合うもの）を、合意したプレイ条件（補助表示・待った）で問題集の各レベルに当てる。サブエージェントに `/tmp/<game>-review/simple-players.md` へ表を書かせる。

| 見るもの | 見つかったときの意味 |
|---|---|
| 最上位のレベルを、単純なプレイヤーが高い割合で解く | 最上位が簡単すぎる |
| 補助表示ありのときだけ解ける割合が大きく上がる | 補助表示で試行錯誤に落ちる |
| 単純なプレイヤーのプレイが perfect や great を取る | 採点の抜け道 |
| 補助表示を使うプレイヤーが、ありえない一致に着く | 補助表示の判定の誤り |
| 同じレベルの中で、広い盤面ほど少ない手数で解ける | 帯の中の逆転 |

- 下限の検査として使い、難易度の順位づけの主根拠にしない。合否の目安と結果の数値は最上位 PR 本文に書く。
- 人間の速さの絶対値、見渡しの負荷、絶対的な難しさの好み、面白さはここでは分からない。最終レビュー資料の「見てほしい点」か「未検証」に回す。

TODO(人間判断): 単純なプレイヤーで落とす基準（例: 最上位で試し置き型が解ける割合の上限）を `docs/パズル/難易度開発手順.md` に置くか。既定: ゲームごとに目安を決めて PR 本文と最終レビュー資料に書く。

### 4. プレイヤー目線の試遊

遊ぶ側の目線で、初めて触ったときに分かるか、手応えがあるか、理不尽でないかを見る。`puzzle-playtester` を、経緯・コード・仕様・設計の文書を渡さずに起動する（Agent ツール、`model: opus`）。

1. **アプリを起動する**: メインが最上段の worktree（`--detach`）で開発サーバー（`bun run --cwd frontend dev -- --port <ポート>`）を背景で起動する。本番に近い形で見るときは `bun run --cwd frontend build` の後に `(cd frontend && bunx vite preview --port <ポート>)`。
2. **起動する**: prompt に渡すのは次の6つだけ。

   ```text
   アプリの URL: http://localhost:<ポート>
   対象ゲームの入口パス: /puzzles/<game>
   端末プロファイル: iPhone 相当の縦画面（390×844、タッチ）と PC 1つ（1280×800）
   遊ぶレベルと各レベルの問題数: L1・L3・L5 を各2問
   比較用に遊ぶ既存ゲーム: <直近に追加された既存ゲームの入口パス>
   出力先: /tmp/<game>-review/playtest/
   ```

   既定から変えるのは、論点に合わせるときだけ（例: 盤面の大きさが論点なら最小と最大の盤面のレベルを足す）。
3. **受け取る**: 試遊レポート（最初に分からなかったこと、操作のつまずき、各レベルの手応えと所要時間・手数、つまらなかった点・理不尽だった点、クリア時の気持ち、既存ゲームとの比較、根拠の画像）を `/tmp/<game>-review/playtest/` から読む。メインは根拠の画像のうち、指摘に付いたものを自分で見る。
4. **仕分ける**: 手順8に従う。機械で直せる不具合と、書かれた決まり（`GAME.md`・`DESIGN.md`・ゲーム共通仕様）への違反は直す。好みや面白さに関わるものは直さずに、最終レビュー資料の「AI の試遊レポートの要約」と「見てほしい点」に AI の所見として載せる。

試遊役は AI であり、人間の速さの絶対値や好みは代わりにならない。所要時間は人間の基準時間の校正に使わず、レベル間の差と既存ゲームとの比較だけに使う。

### 5. レビュー Agent 3種（並行）

3つの Agent を1回のメッセージで並行に起動する（`puzzle-code-reviewer` は責務ごとに複数になることがある）。`scope.md` には全段の行を書く。

### 6. 失敗パターン集での自己点検

`references/pitfalls.md` の5領域を、経緯を渡さない新しいサブエージェントに、レビューする版・PR 本文・手順3の表・試遊レポート・画面を材料に1行ずつ当てさせる。各行に「当たらない（根拠）」「当たる（どこで）」「確かめられない（なぜ）」を付けて返させる。当たるものは直し、確かめられないものは資料の「未検証」に回す。

### 7. main との使い捨てマージで verify

共通基盤の変更に取り残されていないかを、何も push しないマージで確かめる。作業中に `main` を取り込まない決まりは守ったまま、取り残しを早く知るためのもの。

```sh
git worktree add --detach /tmp/<game>-review/main-merge "$TOP"
git -C /tmp/<game>-review/main-merge merge --no-commit --no-ff origin/main
(cd /tmp/<game>-review/main-merge && bun install --cwd frontend --frozen-lockfile && bun install --cwd tools/semantic-lint --frozen-lockfile && ./scripts/verify.sh)
git worktree remove --force /tmp/<game>-review/main-merge
```

- テキストの衝突があれば、そのファイルと内容を記録する。衝突が無くても verify が落ちれば、共通契約の変化に取り残されている。
- どちらも、マージ前にスタックで追従するか（追従の段を足す）を AI が決めて資料の「AI が決めたこと」に書く。追従は `main` を取り込まずに、スタックのコードを main の新しい契約に合わせる形で行う。

### 8. 指摘の仕分け

| 区分 | 扱い |
|---|---|
| critical / major | 直す。`[推測]` の指摘はメインが根拠を読んで確かめてから直す |
| minor | 原則直す。直さないものは理由を最上段 PR 本文に書く |
| 規約で確定できる論点 | AI が確定し、PR 本文の「AI が決めたこと」に正本（ファイル § 見出し）を添えて書く |
| 試遊レポートの、機械で直せる不具合・書かれた決まりへの違反 | 直す。直した後に同じ操作で確かめる |
| 試遊レポートの、好みや面白さに関わる所見 | 直さずに、最終レビュー資料の「AI の試遊レポートの要約」と「見てほしい点」に AI の所見として載せる。根拠の画像を添える |
| 好みや遊んで決めるもので、AI が自信を持てない論点 | 最終レビュー資料の「見てほしい点」か選択肢へ回す（`references/final-review.md`）。画像を添える |

- 認識合わせの合意や人間の判断と逆の指摘、範囲外の未実装の指摘は採らない（Agent への入力が足りていたかを確かめる）。
- 複数の Agent が同じ問題を指摘したら1件にまとめる。

### 9. 直しと積み直し

直しは原因の段で行い、上の段を積み直す。最上段に直しを積み上げない。経緯（「レビューで直した」等）をコード・コミットメッセージ・PR 本文の What に残さない。

1. **原因の段を決める**: `git log --oneline <前段>..<段>` と `git log <段>..<最上段> -- <ファイル>` で、直す箇所を最初に入れた段を探す。最終レビューの指摘なら `references/final-review.md` の原因表と波及表を使う。
2. **原因の段の worktree で直す**: 全段のローカルブランチを origin から作り（`git branch -f <段> origin/<段>`。どの段も他の worktree で checkout していないことを `git worktree list` で確かめる）、原因の段の worktree を作る（`git worktree add /tmp/<game>-work/fix-NN claude/<prefix>-NN-<topic>`）。段カードに直す指摘を書き、`puzzle-stage-implementer` に直させる。担当はその段の文脈でコミットする（その段の版に当てた普通のコミット）。
3. **dry-run**: 最上段で下記を実行し、載せ直すコミットと衝突する段を見る。

   ```sh
   .claude/skills/add-puzzle/scripts/restack.sh claude/<prefix>-NN-<topic> <上の段のブランチ…（下から順）>
   ```

4. **実行**: `--execute` を付けて実行する。rerere を有効にし、`--update-refs` で上の段を積み直し、各段の先端で verify（既定は依存のインストールと `./scripts/verify.sh`）してから `push --atomic --force-with-lease` する。
   - 衝突で止まったら（終了コード 3）、出力された段とファイルを、その段の文脈で解く。解くのは段の実装担当に段カード（衝突した段、ファイル、その段の範囲）を渡して行わせてよい。`git add` の後、同じ引数に `--continue` を付けて再実行する。衝突で人間に知らせない。
   - 検証で落ちたら、落ちた段の原因を直してから `--continue`。積み直しを捨てるときは `--abort`。
   - 問題集の入力（ルール・生成器・分析）を変えたら、問題集の段で再生成と `--verify` を行ってから、その段より上を積み直す。
5. **記録**: 出力された旧コミット ID を、変わった各段の PR 本文の「積み直しの記録」に書く（ローカルの tag や reflog はコンテナと一緒に消える）。push の後、各段の CI `quality-gate` を一度確かめる。
6. **片づけ**: 原因の段の worktree を消す。

直す段が複数あるときは、下の段から順に 2〜5 を繰り返す。

### 10. 再レビュー

直しの影響範囲の Agent を、新しいサブエージェントとして起動し直す。前回の findings や直しの経緯は渡さない。critical / major が 0 になり、試遊レポートの不具合・決まりへの違反が残らなくなるまで 8〜10 を繰り返す。直しが遊ぶ体験に触れたら、試遊（手順4）もやり直す。

### 11. 記録

- 各段の PR 本文の Validation と Stack 表を最新にする。
- 最上段 PR 本文に「## 品質の作り込み（N回目）」節を置く: 日付、機械検査の結果、単純なプレイヤーの表の要点、試遊レポートの要約（端末・レベル・問題数、直したもの、資料に回した所見）、起動した Agent と critical / major / minor の件数と対応、自己点検で当たった失敗パターンと対応、main との使い捨てマージの結果、未実施の検証（意味 lint、iOS 実機など）。
- `/tmp/<game>-review/tree` を消す。

## 人間に見せる条件

次をすべて満たしたら `references/final-review.md` へ進む。満たすまで止まらずに続ける。

- critical / major が 0
- 各段の CI `quality-gate` が success、最上段の先端で `./scripts/verify.sh` PASS
- 問題集の `--verify` PASS
- 単純なプレイヤーの表があり、最上位が押し切られていない（押し切られるなら直したか、理由を資料に書く）
- プレイヤー目線の試遊のレポートがあり、不具合・決まりへの違反が直っていて、好みや面白さの所見が資料に回してある
- 失敗パターン集の自己点検が済んでいる
- main との使い捨てマージの verify の結果がある
- 画面の採取が済み、メインがコンタクトシートを見ている
