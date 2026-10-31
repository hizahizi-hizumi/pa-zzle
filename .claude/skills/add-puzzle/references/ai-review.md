# AIレビューフェーズ（ai-review）

人間レビューの前に、AI 側で直せるものをすべて直し、人間に残す論点を絞る。段ごとのセルフレビュー（implement 中）と、全段の実装後の全体レビュー（このフェーズ）の2種類がある。全体レビューは省略しない。人間レビュー前のレビューを残したまま止まらない。

## レビュー Agent と入力契約

レビューは経緯を知らない新しいサブエージェントに行わせる。Agent ツールで起動し、`subagent_type` に Agent 名、`model` に `opus` を指定する。prompt には下表の入力だけを渡し、経緯（なぜそう作ったか、どの段で何を直したか、過去の人間の指摘）は渡さない。入力の正本は各 Agent ファイルの「責務」節で、食い違えば Agent ファイルに合わせる。

| Agent | 見るもの | メインが用意して渡す入力 |
|---|---|---|
| `puzzle-code-reviewer`（`.claude/agents/puzzle-code-reviewer.md`） | コード・テスト・構造・依存方向 | 対象ゲーム名、比較基準の範囲（例: `<BASE>..origin/claude/<game>-11-spec`）、範囲内の変更ファイル一覧のパス、差分本文を保存したファイルのパス。Agent は Bash を持たないので、差分はメインが取って渡す |
| `puzzle-experience-reviewer`（`.claude/agents/puzzle-experience-reviewer.md`） | 体験・既存ゲームとの一貫性・見た目 | 対象ゲーム名、対象パズルのスクショのパス一覧、比較用の既存ゲーム（直近の2つ程度）の同じ画面のスクショのパス一覧、ブラウザエラー・横スクロールの確認結果のパス |
| `puzzle-document-reviewer`（`.claude/agents/puzzle-document-reviewer.md`） | SPEC・導入調査・台帳 | SPEC のパス、導入調査ディレクトリ、台帳の該当行（と `PUZZLE-NNN.md` のパス）、対象ゲーム名、全リモートブランチで使用中の SPEC 番号・候補 ID の一覧のパス |

prompt の形（例）:

```text
対象ゲーム: <game>
比較基準の範囲: <BASE>..origin/claude/<game>-11-spec
変更ファイル一覧: /tmp/<game>-review/changed-files.txt
差分本文: /tmp/<game>-review/diff.patch
```

## 段ごとのセルフレビュー（implement 中）

各段の実装後、コミット前に行う。

- コードのある段: `puzzle-code-reviewer` を、範囲を「前段のブランチ..作業中の段」にして起動する（未コミットの変更は `git diff <前段>` を保存して渡す）。
- UI のある段（03・04・07・08・10）: 加えて `puzzle-experience-reviewer` を、その段で撮ったスクショと比較用スクショで起動する。
- 文書の段（01・11）: `puzzle-document-reviewer` を起動する。段01では SPEC のパスは「未作成」と渡す。
- 難易度の段（05）: 解法器が緩すぎ・深すぎないかを、別の Opus サブエージェントに代表問題で検証させる。
- critical/major は直してからコミットする。人間に残す論点は仮決定一覧の「最終レビューで判断してほしい点」へ足す。

## 全体レビューの手順

### 1. 機械検証

- 全段で `./scripts/verify.sh` を走らせる（段ごとに `git worktree add /tmp/<game>-wt/<NN> origin/claude/<game>-NN-<topic>` で並べると速い）。
- 各 PR の CI `quality-gate` が green であることを `gh pr checks <番号>` で確かめる。
- 問題集の `bun run --cwd frontend generate:<game>-pool -- --verify` が全問一致すること。時間がかかる場合は別ワークツリーで並行する。
- `TYPESAFE_API_KEY` があれば `bun run --cwd tools/semantic-lint check -- frontend/src/games/<game>` を走らせる。無ければ「意味 lint は未実施」と PR とレビュー資料に書く。

TODO(人間判断): PR 段階で意味 lint を回すか（`TYPESAFE_API_KEY` を cloud 環境に入れるか）。今の CI は main への push と手動実行だけで回している。

### 2. レビュー入力の採取

作業ディレクトリを `/tmp/<game>-review/` にする。

```sh
git fetch --all --prune
TOP=origin/claude/<game>-11-spec                 # 最上段
BASE=$(git merge-base origin/main "$TOP")       # スタックの土台
git diff --name-only "$BASE..$TOP" > /tmp/<game>-review/changed-files.txt
git diff "$BASE..$TOP" > /tmp/<game>-review/diff.patch
```

使用中の番号の一覧（`puzzle-document-reviewer` の採番衝突の確認用）:

```sh
spec() { git ls-tree -r --name-only "$1" -- docs/プロダクト/仕様/ | grep -o 'SPEC-[0-9]\+' | sort -u; }
puzzle() { git show "$1:docs/棚上げ/パズル候補.csv" 2>/dev/null | grep -o '^PUZZLE-[0-9]\+,[^,]*,[^,]*' | cut -d, -f1,3; }
for kind in spec puzzle; do
  max=$($kind origin/main | cut -d, -f1 | grep -o '[0-9]\+' | sort -n | tail -1)
  echo "## $kind: origin/main の最大 $max。これより大きい番号を使っているブランチ"
  for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do
    $kind "$ref" | awk -v max="$max" -v ref="$ref" '{ n = $0; sub(/^[A-Z]+-/, "", n); sub(/,.*/, "", n); if (n + 0 > max + 0) print $0, ref }'
  done | sort
done > /tmp/<game>-review/ids.txt
```

### 3. 画面の採取

最上段のブランチで開発サーバーを起動し、`references/implementation.md` の「画面確認」の方法で撮る。メインが自分で撮り、全画像を自分でも見る。

- 幅 390 / 1280 × ライト / ダーク。ファイル名は `<game>__<画面>__<幅>__<テーマ>.png`。
- 対象パズルの画面: ゲーム一覧、難易度選択（全レベルのプレビューが写る状態）、プレイ開始直後、操作の途中、状態の知らせが出た状態（誤り・一致など）、クリア直前とクリア演出、遊び方、結果画面、記録一覧、記録から開いた結果画面。レベルで盤面の大きさが変わる場合は最小・最大の両方。
- 比較用: `frontend/src/game-catalog/game-catalog.ts` の並びと `git log` から直近に追加された既存ゲームを2つ選び、同じ画面を同じ条件で撮って `/tmp/<game>-review/compare/<既存game>/` に置く。
- ブラウザの確認結果（pageerror・console.error の件数と内容、横スクロールの有無、画面ごと）を `/tmp/<game>-review/browser-check.txt` に書く。

### 4. 観点別レビュー（並行）

3つの Agent を1回のメッセージで並行に起動する。入力は上表のとおり。

### 5. 指摘の仕分け

| 区分 | 扱い |
|---|---|
| critical / major | 直す。`[推測]` の指摘はメインが根拠を読んで確かめてから直す |
| minor | 原則直す。直さないものは理由を最上段 PR の「AIレビュー」節に書く |
| 規約で確定できる論点 | AI が確定し、仮決定一覧の該当行を「AI確定（正本: <ファイル § 見出し>）」に更新する |
| 人間に残す論点 | レビュー資料へ回す。人間レビュー領域は **ピクトグラム / 難易度プレビュー / ゲーム体験 / 難易度の体感 / スコアの納得感** の5つに限る |

- 人間レビュー領域に入らない論点は、規約（`AGENTS.md`・`APP.md`・`GAME.md`・`DESIGN.md`・ゲーム共通仕様）と既存ゲームの前例で AI が確定する。決めきれないときだけ、理由を添えて人間に残す。
- 見た目の好みに関わる点（字形、小さい表示での見え方など）は直さずに人間に残し、レビュー資料で画像を添える。
- 複数の Agent が同じ問題を指摘したら1件にまとめる。

### 6. 修正と各段への畳み込み

- 修正は、原因を持つ段のブランチでサブエージェントに行わせる。修正内容は、その内容が入った段の元のコミットへ畳み込む。経緯（「レビューで直した」等）をコード・コミットメッセージ・PR 本文の What に残さない。
- 手順（メインが行う）:
  1. 書き換え前の全段を `backup/<game>-<YYYYMMDD>/<NN>` としてローカルに残す。
  2. 修正を `git commit --fixup=<元のコミット>` で最上段の上に積む。
  3. 最上段で `git -c sequence.editor=: rebase -i --autosquash --update-refs "$BASE"` を実行し、全段のブランチをまとめて書き換える（対話エディタは開かない）。
  4. 全段で `./scripts/verify.sh` を走らせ直す。
  5. H1 で許可された範囲の各段のブランチを `git push --force-with-lease` する。許可が無ければ push せずに人間へ許可を求める。
- 大きすぎるコミットは、この機会に責務ごとに分ける。
- 最上段だけに修正を積み続けない（後で main へ追従するときに重くなる）。

### 7. 再レビュー

修正の影響範囲の Agent を、新しいサブエージェントとして起動し直す。前回の findings や修正の経緯は渡さない。critical / major が 0 になるまで 5〜7 を繰り返す。

### 8. main とのコンフリクト確認

`git merge-tree --write-tree origin/main "$TOP"` でコンフリクトの有無を確かめる。

- コンフリクトしていなければ何もしない（取り込まない）。
- コンフリクトしていれば、最新 `origin/main` へ全段を rebase し（`--update-refs`）、全段を verify し直して `--force-with-lease` で push する。merge commit で追従しない。
- main で共通契約が変わっていてコンフリクトしない場合（共通部品・記録の形など）は、追従するかを人間に残す論点にする。

### 9. 記録

- 各段の PR 本文の Validation を最新にする。
- 最上段 PR 本文に「AIレビュー」節を置く: 日付、起動した Agent、critical/major/minor の件数と対応、AI が確定した論点（正本つき）、人間に残した論点、未実施の検証（意味 lint、iOS 実機など）。
- 仮決定一覧を更新する。

## 人間へ渡す条件

次をすべて満たしたら human-review へ進み、レビュー資料を作る。満たすまで止まらずに続ける。

- critical / major が 0
- 全段で `./scripts/verify.sh` PASS、各 PR の CI green
- 問題集の `--verify` PASS
- 画面の採取が済み、メインが全画像を見ている
- 人間に残す論点が5領域に整理され、各論点に画像と根拠がある
