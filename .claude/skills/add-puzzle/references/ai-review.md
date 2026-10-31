# AIレビューフェーズ（ai-review）

人間レビューの前に、AI 側で直せるものをすべて直し、人間に残す論点を絞る。段ごとのセルフレビュー（implement 中）と、全段の実装後の全体レビュー（このフェーズ）の2種類がある。全体レビューは省略しない。人間レビュー前のレビューを残したまま止まらない。

## レビュー Agent と入力契約

レビューは経緯を知らない新しいサブエージェントに行わせる。Agent ツールで起動し、`subagent_type` に Agent 名、`model` に `opus` を指定する。prompt には下表の入力だけを渡す。経緯（なぜそう作ったか、どの段で何を直したか、前回の findings）は渡さない。入力の正本は各 Agent ファイルの「責務」節で、食い違えば Agent ファイルに合わせる。

3つの Agent に共通して渡すもの:

| 入力 | 中身 | 作り方 |
|---|---|---|
| リポジトリのルート | レビューする版を展開したディレクトリ | 下の「レビューする版の用意」の `/tmp/<game>-review/tree` |
| 対象ゲーム | ゲーム ID `<game>` とパズル名 | 段01の識別表 |
| 段の範囲と完成条件 | 段01のスタック表の該当行（全体レビューでは全行） | `/tmp/<game>-review/scope.md` に写す |
| 人間決定の一覧 | 調査 PR 本文の「人間決定（Hn, …）」節と、仮決定一覧の「人間判断で取り下げ / 確定」の行 | `/tmp/<game>-review/decisions.md` に写す。決定事項として書き、経緯は書かない |

Agent ごとに加えて渡すもの:

| Agent | 見るもの | 加えて渡す入力（すべて必須） |
|---|---|---|
| `puzzle-code-reviewer` | コード・テスト・構造・依存方向 | 比較基準の範囲（例: `<BASE>..claude/<prefix>-<最上段>`）、変更ファイル一覧のパス、差分本文のパス。Agent は Bash を持たないので、差分はメインが取って渡す |
| `puzzle-experience-reviewer` | 体験・既存ゲームとの一貫性・見た目 | 対象パズルのスクショのパス一覧、比較用の既存ゲームのスクショのパス一覧、ブラウザ確認結果（`browser-check.txt`）のパス |
| `puzzle-document-reviewer` | SPEC・導入調査・台帳 | SPEC のパス（段01では「未作成」）、導入調査ディレクトリ、台帳の該当行と `PUZZLE-NNN.md` のパス、使用中の番号の一覧（`list-used-ids.sh` の出力ファイル）のパス |

prompt の形（例）:

```text
リポジトリのルート: /tmp/<game>-review/tree
対象ゲーム: <game>（<パズル名>）
段の範囲と完成条件: /tmp/<game>-review/scope.md
人間決定の一覧: /tmp/<game>-review/decisions.md
比較基準の範囲: <BASE>..claude/<prefix>-<最上段>
変更ファイル一覧: /tmp/<game>-review/changed-files.txt
差分本文: /tmp/<game>-review/diff-ui.patch（責務: ui）
```

## レビューする版の用意

メインの作業ツリーは別の段を指していることがあるので、レビューする版を別のツリーに展開する。段のブランチを他のツリーで checkout すると、畳み込みの rebase（`--update-refs`）がそのブランチを書き換えずに飛ばすので、必ず `--detach` で作る。

```sh
git fetch --all --prune
TOP=origin/claude/<prefix>-<NN>-<topic>                # 段ごとのレビューではその段、全体レビューでは最上段
BASE=$(git merge-base origin/main "$TOP")             # スタックの土台
mkdir -p /tmp/<game>-review
git worktree add --detach /tmp/<game>-review/tree "$TOP"
git diff --name-only "$BASE" "$TOP" > /tmp/<game>-review/changed-files.txt
git diff "$BASE" "$TOP" -- . ':!*problem-pool.json' ':!docs/' ':!scripts/research/' > /tmp/<game>-review/diff.patch
```

- Agent は読むだけなので、ツリーに依存をインストールしなくてよい。画面の採取をこのツリーで行うときだけ `bun install --cwd /tmp/<game>-review/tree/frontend --frozen-lockfile` を行う。
- 差分が大きい（目安 3,000 行超）ときは責務ごとに分け、`puzzle-code-reviewer` を責務ごとに並行で起動する。分け方の例: `puzzle`（`games/<game>/puzzle/`・`problem/`・直下の `.ts`）、`session`（`session/`・`play/`）、`ui`（`games/<game>/ui/`）、`catalog`（`game-catalog/`・`pages/`・`views/`・`router.ts`）、`scripts`（`frontend/scripts/`・`biome.json`・`package.json`）。`git diff "$BASE" "$TOP" -- <パス…> > /tmp/<game>-review/diff-<責務>.patch` で作る。
- 使用中の番号: `.claude/skills/add-puzzle/scripts/list-used-ids.sh > /tmp/<game>-review/ids.txt`。
- レビューが終わったら `git worktree remove /tmp/<game>-review/tree` で消す。

## 段ごとのセルフレビュー（implement 中）

各段の実装後、コミット前に行う。範囲はその段だけにする。

- 未コミットの変更は `git diff <前段のブランチ>` を保存して差分本文として渡し、リポジトリのルートは作業中のツリーにする（作業中のツリーは段のブランチを checkout していてよい。畳み込みはこの後のフェーズで行う）。
- `scope.md` には段01のスタック表のその段の行だけを書く。Agent は範囲外の未実装を findings にしない。
- コードのある段: `puzzle-code-reviewer`。
- UI のある段（03・04・08・10 など）: 加えて `puzzle-experience-reviewer` を、その段で撮ったスクショ・比較用スクショ・`browser-check.txt` で起動する。ピクトグラムの段は `/design-game-pictogram` の検査とメインの目視で足り、画面が変わらないので起動しない。
- 文書の段（01・SPEC の段）: `puzzle-document-reviewer`。段01では SPEC のパスに「未作成」と渡す。
- 難易度の段（05）: 解法器が緩すぎ・深すぎないかを、別の Opus サブエージェントに代表問題で検証させる。
- critical / major は直してからコミットする。人間に残す論点は仮決定一覧の「最終レビューで判断してほしい点」へ足す。

## 全体レビューの手順

### 1. 機械検証

- 各段の CI `quality-gate` が success であることを確かめる（SKILL.md の「GitHub の操作」）。全段でローカルの `./scripts/verify.sh` を回し直さない。
- 問題集の `bun run --cwd frontend generate:<game>-pool -- --verify` が全問一致すること。時間がかかる場合は別ワークツリーで並行する。
- `TYPESAFE_API_KEY` があれば `bun run --cwd tools/semantic-lint check -- frontend/src/games/<game>` を走らせる。無ければ「意味 lint は未実施」と最上段 PR とレビュー資料に書く。

TODO(人間判断): PR 段階で意味 lint を回すか（`TYPESAFE_API_KEY` を cloud 環境に入れるか。今の CI は main への push と手動実行だけで回している）。既定: キーがあるときだけローカルで回し、無ければ未実施と書く。

### 2. 画面の採取

最上段で開発サーバーを起動し、`scripts/capture-screens.mjs` で撮る（`references/implementation.md` の「画面確認」）。メインが自分で撮り、全画像を自分でも見る。

- 出力先: 対象パズルは `/tmp/<game>-review/shots/`、比較用は `/tmp/<game>-review/compare/<既存game>/`。ファイル名はどちらも `<ゲーム ID>__<画面名>__<幅>__<テーマ>.png`、ブラウザ確認結果はそれぞれの `browser-check.txt`。
- 対象パズルの画面: ゲーム一覧、難易度選択（全レベルのプレビューが写る状態）、プレイ開始直後、遊び方、結果画面、記録一覧、記録から開いた結果画面。レベルで盤面の大きさが変わる場合は最小・最大の両方。
- 操作が要る状態（操作の途中、状態の知らせが出た状態、クリア直前とクリア演出）は、サブエージェントに Playwright のスクリプトを書かせて同じ命名で `shots/` に撮らせる。
- 比較用: `frontend/src/game-catalog/game-catalog.ts` の並びと `git log` から直近に追加された既存ゲームを2つ選び、同じ画面を同じ条件で撮る。

### 3. 観点別レビュー（並行）

3つの Agent を1回のメッセージで並行に起動する（`puzzle-code-reviewer` は責務ごとに複数になることがある）。入力は上表のとおり。`scope.md` には全段の行を書く。

### 4. 指摘の仕分け

| 区分 | 扱い |
|---|---|
| critical / major | 直す。`[推測]` の指摘はメインが根拠を読んで確かめてから直す |
| minor | 原則直す。直さないものは理由を最上段 PR の「AIレビュー」節に書く |
| 規約で確定できる論点 | AI が確定し、仮決定一覧の該当行を「AI確定（正本: <ファイル § 見出し>）」に更新する |
| 人間に残す論点 | レビュー資料へ回す。人間レビュー領域（ピクトグラム / 難易度プレビュー / ゲーム体験（見た目を含む）/ 難易度の体感 / スコアの納得感）のどれかに入れる |

- 人間レビュー領域に入らない論点は、規約（`AGENTS.md`・`APP.md`・`GAME.md`・`DESIGN.md`・ゲーム共通仕様）と既存ゲームの前例で AI が確定する。人間に聞かない。
- 人間決定と逆の指摘、範囲外の未実装の指摘が来たら、採らずに捨てる（Agent への入力が足りていたかを確かめる）。
- 見た目の好みに関わる点（字形、小さい表示での見え方など）は直さずにゲーム体験の論点として人間に残し、レビュー資料で画像を添える。
- 複数の Agent が同じ問題を指摘したら1件にまとめる。

### 5. 修正と各段への畳み込み

修正は最上段の作業ツリーで行い、原因を持つ段の元のコミットへ畳み込む。経緯（「レビューで直した」等）をコード・コミットメッセージ・PR 本文の What に残さない。`main` は取り込まない（SKILL.md の制約。force-push の許可は H1 で得たもの）。

1. **全段のローカルブランチを origin から作る**: `--update-refs` はローカルブランチだけを書き換えるので、Stack 表の全段（`-00-feasibility` を含む）について作る。どのブランチも他のツリーで checkout していないことを `git worktree list` で確かめる。

   ```sh
   git switch --detach origin/claude/<prefix>-<最上段>
   for branch in claude/<prefix>-00-feasibility claude/<prefix>-01-research …; do   # Stack 表の全段
     git branch -f "$branch" "origin/$branch"
   done
   git switch claude/<prefix>-<最上段>
   ```

2. **退避**: 書き換え前の全段を tag で残す。tag は `--update-refs` で書き換わらない（ブランチで退避すると一緒に書き換わる）。push しない。

   ```sh
   for branch in …; do                                    # 手順1と同じ全段
     stage=${branch#claude/<prefix>-}
     git tag "backup/<game>-$(date +%Y%m%d)/${stage%%-*}" "$branch"   # 例: backup/<game>-20261031/02
   done
   ```

   同じ日に2回目なら日付の後に `.2` などを付ける。
3. **修正**: サブエージェントに最上段の作業ツリーで直させる。コミットはメインが、原因を持つ段のコミットごとに `git commit --fixup=<原因段のコミット>` で積む。原因段のコミットは `git log --oneline <前段>..<原因段>` から選ぶ。
4. **畳み込み**: 最上段で次を実行する。エディタは開かない。

   ```sh
   git -c sequence.editor=: rebase -i --autosquash --update-refs "$BASE"
   ```

   衝突したら `git rebase --abort` で戻し、どの fixup がどの段で衝突したかを書いて止まり、人間へ報告する。
5. **確かめる**: 各段に `fixup!` のコミットが残っていないこと（`git log --oneline "$BASE"..claude/<prefix>-<最上段>`）、`git range-diff "$BASE" backup/<game>-<YYYYMMDD>/<最上段のNN> claude/<prefix>-<最上段>` で意図したコミットだけが変わったことを見る。最上段の先端で `./scripts/verify.sh` を走らせる。
6. **push**: H1 で許可された範囲のブランチを、まとめて `git push --atomic --force-with-lease origin <変わった段のブランチ…>` で push する。許可が無ければ push せずに人間へ許可を求める。push の後、各段の CI `quality-gate` を一度確かめる。

- 畳み込みではコミットを分けない。大きすぎるコミットは段を実装するときに分ける（`references/implementation.md`）。
- 最上段だけに修正を積み続けない。

### 6. 再レビュー

修正の影響範囲の Agent を、新しいサブエージェントとして起動し直す。前回の findings や修正の経緯は渡さない。critical / major が 0 になるまで 4〜6 を繰り返す。

### 7. main とのコンフリクトの確認

`git merge-tree --write-tree origin/main "$TOP"` でコンフリクトの有無を確かめ、結果を「AIレビュー」節に書く。ここでは rebase しない。`main` への rebase は H2 の後、人間がマージすると言った時点で一度だけ行う（`references/human-review.md` の「マージ」）。

main で共通契約が変わっている場合（共通部品・記録の形・結果画面など）は、追従するかを H2 の確認項目としてレビュー資料に書く。

### 8. 記録

- 各段の PR 本文の Validation と Stack 表を最新にする（`references/implementation.md` の「PR 本文」）。
- 最上段 PR 本文に「## AIレビュー」節を置く: 日付、起動した Agent、critical / major / minor の件数と対応、AI が確定した論点（正本つき）、人間に残した論点（領域つき）、main とのコンフリクトの有無、未実施の検証（意味 lint、iOS 実機など）。
- 仮決定一覧を更新する。
- `/tmp/<game>-review/tree` を消す。退避の tag は人間レビューが終わるまで残す。

## 人間へ渡す条件

次をすべて満たしたら human-review へ進み、レビュー資料を作る。満たすまで止まらずに続ける。

- critical / major が 0
- 各段の CI `quality-gate` が success、最上段の先端で `./scripts/verify.sh` PASS
- 問題集の `--verify` PASS
- 画面の採取が済み、メインが全画像を見ている
- 人間に残す論点が5領域に整理され、各論点に画像と根拠がある
