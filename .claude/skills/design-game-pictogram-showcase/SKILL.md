---
name: design-game-pictogram-showcase
description: >
  This skill should be used when designing, refining, or reviewing the showcase pictogram of the pa-zzle game
  selection screen: the colored, animated pictogram of the selected puzzle. Triggers include
  "showcase pictogram", "hero pictogram", "colored pictogram", "animated pictogram", "pictogram animation",
  "pictogramShowcaseSvg", "pictogram-showcase.svg", "選択中パズルの姿", "色付きピクトグラム",
  "動くピクトグラム". Not for the monochrome pictogram.svg (use design-game-pictogram).
argument-hint: <game-id>
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(python3 .claude/skills/design-game-pictogram-showcase/scripts/check_animation.py *), Bash(python3 .claude/skills/design-game-pictogram-showcase/scripts/check_self_review.py *), Bash(python3 .claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py *), Bash(python3 .claude/skills/design-game-pictogram-showcase/scripts/resolve_color.py *), Bash(node .claude/skills/design-game-pictogram-showcase/scripts/observe_animation.cjs *), Bash(node .claude/skills/design-game-pictogram-showcase/scripts/check_gallery.cjs *), Bash(node .claude/skills/design-game-pictogram-showcase/scripts/capture_frames.cjs *), Bash(python3 /tmp/pictogram-showcase-*), Bash(node /tmp/pictogram-showcase-*), Bash(bun run --cwd frontend *)
---

# design-game-pictogram-showcase

パズル選択画面で、選ばれたパズルを色と動きで見せる `pictogram-showcase.svg` を作る Skill。下部一覧の選択中は色付きで静止し、上部のヒーローでは動く。人間が方向を選び、選ばれた方向を仕上げてカタログへ登録するまでを扱う。

## 起動

`/design-game-pictogram-showcase <game-id>`

game id は `frontend/src/games/<game>/` のディレクトリ名。

## 依頼別の入口

- **新規**: 動作フローの 1 から始める。
- **既存 SVG の改善**: 既存の SVG を manifest に入れて 4 の自己チェックで診断し、6 から続ける。
- **レビューのみ**: 対象を変更せず 4 の自己チェックを行い、A → B → C → D の順に findings を返す。

## 体験の狙い

全段の判断軸にする。評価は A → B → C → D の順に行う。

- **目的 A**: 選んだパズルで何を考え何をする遊びかが、動きで分かる（`docs/プロダクト/要件/FR-001.md`）。
- **目的 B**: 解けた・揃った瞬間の気持ちよさが見え、遊びたくなる（`docs/プロダクト/要求/RQ-002.md`）。
- **合格条件 C**: 選んだ手応えが即座に返る。A と B ができていれば自然に生まれる。弱ければ A/B の作り方を直し、C のためだけの演出は足さない。
- **制約 D**: 画面の落ち着きを不必要に崩さない。

## 作るもの

- 白黒版 `pictogram.svg` を土台にした SVG を 1 つ作る。白黒版と同じパズルだと一覧で分かること。
- 静止状態は、見せ場の後の姿（解けた・揃った状態）にする。白黒版が途中の姿なら、それは開始の姿の候補になる。
- 動きは切り替えループ（`cut`）を基本にする。開始の姿から見せ場まで動き、静止状態で止まり、周の境界で開始の姿へ瞬時に戻る。継ぎ目ループ（`seam`）は継ぎ目が意味として自然に成り立つ場合だけにする。1 回だけ再生して止まる形式は使わない。
- 色はプレイ画面の色をそのまま使う。
- 書き方の規則は `references/contract.md`。違反は `scripts/check_animation.py` が報告する。

白黒版の作成・変更、アプリ側の受け口と `DESIGN.md` の変更はこの Skill では行わない。白黒版が無ければ先に `/design-game-pictogram` を使う。アプリ側の受け口と `references/contract.md` が食い違ったら、止めて人間へ報告する。

## 動作フロー

作業物は `/tmp/pictogram-showcase-<game>/` に置く。

### 1. 材料を抽出する

パズル仕様（`docs/プロダクト/仕様/パズル/`）、プレイ画面（`frontend/src/games/<game>/ui/`）、白黒版から次を拾う。

- 中心の操作（A）: 何を見て、何を考え、何をするか
- 解けた瞬間（B）: 何が揃い、プレイ画面でどう終わるか
- プレイ画面の色の定義元と、ライト/ダークの実値
- 白黒版が描いている状態（解く前・途中・解けた後）と字形

A と B の材料が欠けたまま次へ進まない。詳しくは `references/exploration.md` の 1 節。

### 2. 発散する

コードを書く前に、何が起こるかが異なるアイデアカードを、刺激を変えた複数回の発散で作る。各カードに、A の見せ方・B の見せ場・静止状態・再生形式を書く。速度や量だけが違う案は別案に数えない（`references/exploration.md` の 2〜6 節）。

### 3. 束ねて試作する

A の見せ方 × B の見せ場で束ね、系統ごとに代表を選ぶ。代表の組は、人間がヒーローで見て違いが分かる幅を優先し、見せ場と終わり方が同じ代表で埋めない。成立しなさそうという予測だけで系統を落とさない。代表を、A と B の核が伝わるところまで試作する。静止状態を先に描いて白黒版と並べ、同じパズルに見えることを確かめてから動きを足す。束ね方は `references/exploration.md` の 7 節、試作の削り方は 8 節、緩急は `references/motion.md` の 3 節。候補は `manifest.json` にまとめる（`references/review.md` の 1 節）。

### 4. 自己チェックとレビューで、人間へ見せる品質へ引き上げる

この段は、候補を人間へ見せる品質へ引き上げる段とする。違和感や `WARN` は、説明を付けて通す前に、直せるなら直す。

1. `scripts/check_animation.py --manifest <manifest>` で契約違反を検査する。
2. `scripts/observe_animation.cjs` で、実ブラウザでの静止状態との一致、切り替え、かくつき、はみ出し、大きさとインク量を測る（コマンドと報告の読み方は `references/self-review.md` の 1.1 節）。
3. `scripts/make_review_gallery.py --audience self` でセルフレビュー用ギャラリーを作り、`scripts/check_gallery.cjs` で崩れを確かめてから、A → B → C → D と見た目を実表示サイズで確かめる（1.2 節）。
4. 結果を `self-review.json` に記録し、`scripts/check_self_review.py` を通す（2〜4 節）。
5. `scripts/capture_frames.cjs --manifest <manifest> --out <dir>` でコマ撮り画像を作り、作り手とは別のコンテキストで `showcase-pictogram-reviewer` エージェントにレビューさせる。渡すのは manifest・コマ撮り画像・観察スクリプトの報告のパスで、`self-review.json` は渡さない。サブエージェントはさらにサブエージェントを起動できないことがあるため、作り手もサブエージェントのときは、レビュー役の起動はメインが行う。
6. レビューの blocking を直し、2〜5 をやり直す。blocking が無くなった候補だけを人間へ見せる。

### 5. 人間に方向を選んでもらう

```sh
python3 .claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py --manifest <manifest> \
  --self-review <self-review.json> --audience human [--db-doc <game>-round<N>] --output <html>
node .claude/skills/design-game-pictogram-showcase/scripts/check_gallery.cjs <html> --device "iPhone 13"
```

人間はスマホでも見る。Claude アプリ環境では artifact として公開し、判定とメモを artifact の DB から読み取る（`references/review.md` の 4 節）。点数は求めず、候補ごとに「候補 / 掘る / 一部 / 除外」とメモを受け取り、次の回の入力として記録する。

### 6. 選ばれた方向を掘る

選ばれた A と B を保ったまま、間・誇張・終わり方など良くなりうる差分だけを少数案に分岐し、4〜5 を繰り返す。案数は人間の指定を優先する。各候補の manifest に `based_on` で元の案を書く（`references/review.md` の 1 節）。レビュー結果の読み方は `references/review.md` の 6 節、分岐の幅と発散へ戻る条件は `references/exploration.md` の 9〜10 節。

### 7. 仕上げて登録する

人間が採用を決めたら、次を行う。

1. 実表示サイズで詰め、4 の自己チェックをやり直す。
2. `frontend/src/games/<game>/assets/pictogram-showcase.svg` に置く。
3. `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx` で `?raw` import し、`pictogramShowcaseSvg` に渡す。
4. `bun run --cwd frontend check` / `typecheck` / `test` を通す。
5. `bun run --cwd frontend dev` をバックグラウンドで起動し、実アプリのパズル選択画面で、ヒーロー・一覧の選択中・ライト/ダーク・動きを減らす設定を確かめる（Playwright のスクリプトは `/tmp/pictogram-showcase-<game>/` に置き、`scripts/playwright_resolve.cjs` で読み込む）。

## 出力先

- 探索中の候補・記録・ギャラリー: `/tmp/pictogram-showcase-<game>/`
- 完成 SVG: `frontend/src/games/<game>/assets/pictogram-showcase.svg`
- 登録: `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx`

Skill 配下には特定ゲームの生成物を置かない。

## 参照する正本

- `references/contract.md` — SVG の書き方の規則（受け口の契約）
- `references/exploration.md` — 材料抽出、色の定義元の調べ方、発散、再生形式の選び方、束ね方
- `references/motion.md` — 再生形式の作り方、周期と止まりの目安、イージング、構図の範囲、動きの量、WebKit で崩れない書き方
- `references/review.md` — manifest、ギャラリー、人間レビューの受け渡しと問い方、これまでの人間レビューの傾向
- `.claude/agents/showcase-pictogram-reviewer.md` — 人間へ見せる前のレビュー役
- `references/self-review.md` — 観察方法、必須チェックリスト、`self-review.json`
- `scripts/` — 検査（`check_animation.py`、`check_self_review.py`）、観察（`observe_animation.cjs`、`capture_frames.cjs`）、ギャラリー（`make_review_gallery.py`、`check_gallery.cjs`）、色の実値（`resolve_color.py`）。オプションは各スクリプトの `--help`
- `DESIGN.md` の「ゲームピクトグラム」、`docs/adr/ADR-0004-selected-pictogram-color-motion.md`

## 制約

- C のためだけの演出を足さない
- プレイ画面の色を別の値へ作り替えない
- 微差を別案として数えない。自動検査だけで採用・不採用を決めない
- 自己チェックを通っていない候補を人間へ見せない
- 人間が選んだ方向から、理由なく外れない
- SVG 内に探索の経緯をコメントとして残さない
