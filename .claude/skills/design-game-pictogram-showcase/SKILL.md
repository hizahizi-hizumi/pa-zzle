---
name: design-game-pictogram-showcase
description: >
  pa-zzle のホーム（パズル選択画面）で、選んでいるパズルをゲーム固有色と動きで見せる showcase ピクトグラム
  （pictogram-showcase.svg）を作る・磨く・レビューする。白黒版の pictogram.svg を土台に候補を広げて試作し、
  自己チェックとレビュー役のレビューを通した候補を人間に選んでもらい、選ばれた方向を仕上げてカタログに登録する。
  「showcase ピクトグラムを作って」「選択中パズルの姿を作って」「色付きピクトグラムを作って」「動くピクトグラムを作って」
  「ピクトグラムのアニメーションを直して」「pictogram-showcase.svg をレビューして」
  「design a showcase pictogram」「make a colored pictogram」「animate the pictogram」「hero pictogram」
  「review pictogramShowcaseSvg」と頼まれたときに使う。白黒の pictogram.svg には使わず、design-game-pictogram を使う。
argument-hint: <game-id>
allowed-tools: Read, Glob, Grep, Bash(python3 *.claude/skills/design-game-pictogram-showcase/scripts/check_animation.py *), Bash(python3 *.claude/skills/design-game-pictogram-showcase/scripts/check_self_review.py *), Bash(python3 *.claude/skills/design-game-pictogram-showcase/scripts/make_review_gallery.py *), Bash(python3 *.claude/skills/design-game-pictogram-showcase/scripts/resolve_color.py *), Bash(node *.claude/skills/design-game-pictogram-showcase/scripts/observe_animation.cjs *), Bash(node *.claude/skills/design-game-pictogram-showcase/scripts/check_gallery.cjs *), Bash(node *.claude/skills/design-game-pictogram-showcase/scripts/capture_frames.cjs *), Bash(bun run --cwd frontend check), Bash(bun run --cwd frontend typecheck), Bash(bun run --cwd frontend test)
---

# design-game-pictogram-showcase

引数の game id は `frontend/src/games/<game>/` のディレクトリ名。作るのは、ホーム（SCR-001）の下部一覧の選択中に静止状態を見せ、上部のヒーローで動く `pictogram-showcase.svg` で、人間が方向を選び、選ばれた方向を仕上げてカタログへ登録するまでを扱う。

## 依頼別の入口

- 新規: 動作フローの 1 から始める
- 既存 SVG の改善: 既存の SVG を manifest に入れて動作フロー 4 の自己チェックで診断し、6 から続ける
- レビューだけ: 対象を変えずに動作フロー 4 の自己チェックを行い、A → B → C → D の順に指摘を返す

## 体験の狙い

全段の判断軸にする。評価は A → B → C → D の順に行う。

- 目的 A: 選んだパズルで何を考え何をする遊びかが、動きで分かる（`docs/プロダクト/要件/FR-001.md`）
- 目的 B: 解けた・揃った瞬間の気持ちよさが見え、遊びたくなる（`docs/プロダクト/要求/RQ-002.md`）
- 合格条件 C: 選んだ手応えが即座に返る。A と B ができていれば自然に生まれる。弱ければ A と B の作り方を直し、C のためだけの演出は足さない（`DESIGN.md` の「ゲームピクトグラム」）
- 制約 D: 画面の落ち着きを不必要に崩さない（`DESIGN.md` の「ゲームピクトグラム」）

## 作るもの

- 白黒版（`pictogram.svg`）を土台にした SVG を1つ作る。一覧の選択中はこの SVG の静止状態を見せ、ヒーローもこの静止状態から再生を始める
- 静止状態と白黒版の関係は `DESIGN.md` の「ゲームピクトグラム」に従う。図形の写し方と、色の変化に含めるものは `references/contract.md` の 2 節に従う
- 色の範囲と、ゲーム固有色の無いゲームの扱いは `references/contract.md` の 3 節に従う
- 静止状態は、見せ場の後の姿（解けた・揃った状態）にするのが望ましい。白黒版が途中の姿を描いていて、そのままでは見せ場の後で止まれないときや動きの余地が無いときは、白黒版の修正案（`base_revision`）を添えた案と今の白黒版に寄せる案を並べて人間に選んでもらう（`references/exploration.md` の 3 節「白黒版が途中の姿を描くゲーム」）
- 動きは切り替えループ（`cut`）を基本にする。`rest-cut`・`seam` を使う場面は `references/exploration.md` の 3 節「再生形式を選ぶ」に、各形式の定義は `references/contract.md` の 2 節に従う
- SVG の書き方は `references/contract.md` に従う。違反は `check_animation.py` が報告する
- 白黒版の修正案の SVG は候補として作るが、`pictogram.svg` は変えない。修正案が採用されたら、白黒版の変更は `design-game-pictogram` スキルを起動して行う。白黒版が無ければ、先に `design-game-pictogram` スキルを起動して作る
- アプリ側の受け口と `DESIGN.md` は変えない。アプリ側の受け口と `references/contract.md` が食い違ったら、止めて人間に伝える

## 動作フロー

補助ファイルの `references/` と `scripts/` は `${CLAUDE_SKILL_DIR}` の下にある。作業物は `/tmp/pictogram-showcase-<game>/` に置く。

### 1. 材料を抽出する

`references/exploration.md` の 1 節に沿って、パズル仕様（`docs/プロダクト/仕様/パズル/`）、プレイ画面（`frontend/src/games/<game>/ui/`）、白黒版から次を拾う。A と B の材料が欠けたまま次へ進まない。

- 中心の操作（A）: 何を見て、何を考え、何をするか
- 解けた瞬間（B）: 何が揃い、プレイ画面でどう終わるか
- プレイ画面のゲーム固有色（無ければ無いこと）と、その定義元とライト・ダークの実値。実値は `python3 ${CLAUDE_SKILL_DIR}/scripts/resolve_color.py` で引く
- 白黒版が描いている状態（解く前・途中・解けた後、静止か動きの途中か）と字形

### 2. 発散する

`references/exploration.md` の 2〜6 節に沿って、コードを書く前に、何が起こるかが異なるアイデアカードを、刺激を変えた複数回の発散で作る。各カードに、A の見せ方・B の見せ場・静止状態・再生形式を書く。速度や量だけが違う案は別案に数えない。

### 3. 束ねて試作する

1. `references/exploration.md` の 7 節に沿って、A の見せ方 × B の見せ場で束ね、系統ごとに代表を選ぶ。代表の組は、人間がヒーローで見て違いが分かる幅を優先し、見せ場と終わり方が同じ代表で埋めない。成立しなさそうという予測だけで系統を落とさない
2. 代表を、A と B の核が伝わるところまで試作する。試作の削り方は `references/exploration.md` の 8 節、緩急は `references/motion.md` の 3 節に従い、ほかの動きの作り方も `references/motion.md` に従う
3. 静止状態を先に、白黒版（白黒版を直す案ではその修正案）の図形を写して描き、そこから動きを足す
4. `references/review.md` の 1 節に沿って、候補を `manifest.json` にまとめる

### 4. 自己チェックとレビューで、人間へ見せる品質へ引き上げる

違和感や `WARN` は、説明を付けて通す前に、直せるなら直す。

1. `python3 ${CLAUDE_SKILL_DIR}/scripts/check_animation.py --manifest <manifest>` で契約違反を検査する
2. `references/self-review.md` の 1.1 節のコマンドで `observe_animation.cjs` を実行し、実ブラウザでの静止状態との一致、切り替え、かくつき、はみ出し、大きさとインク量を測る。報告は同じ節に沿って読む
3. `python3 ${CLAUDE_SKILL_DIR}/scripts/make_review_gallery.py --manifest <manifest> --audience self --output <html>` でセルフレビュー用ギャラリーを作り、`node ${CLAUDE_SKILL_DIR}/scripts/check_gallery.cjs <html>` で崩れを確かめてから、`references/self-review.md` の 1.2 節に沿って A → B → C → D と見た目を実表示サイズで確かめる
4. `references/self-review.md` の 2〜4 節に沿って結果を `self-review.json` に記録し、`python3 ${CLAUDE_SKILL_DIR}/scripts/check_self_review.py` を通す
5. `node ${CLAUDE_SKILL_DIR}/scripts/capture_frames.cjs --manifest <manifest> --out <dir>` でコマ撮り画像を作り、`showcase-pictogram-reviewer` エージェントを起動してレビューさせる。渡すのは manifest・コマ撮り画像のディレクトリ・観察スクリプトの報告のパスで、`self-review.json` は渡さない。作り手がサブエージェントのときは、レビュー役はメインのエージェントが起動する
6. レビューの blocking を直し、1〜5 をやり直す。直さない候補は `self-review.json` で `reject` にする。blocking が無くなった候補だけを人間に見せる

### 5. 人間に方向を選んでもらう

1. 人間用のギャラリーを作り、スマホ幅で崩れを確かめる

   ```sh
   python3 ${CLAUDE_SKILL_DIR}/scripts/make_review_gallery.py --manifest <manifest> \
     --self-review <self-review.json> --audience human [--db-doc <game>-round<N>] --output <html>
   node ${CLAUDE_SKILL_DIR}/scripts/check_gallery.cjs <html> --device "iPhone 13"
   ```

2. `references/review.md` の 4 節に沿って見せる。Claude アプリ環境では artifact として公開し、判定とメモを artifact の DB から読む
3. 点数は求めず、候補ごとに「候補 / 掘る / 一部 / 除外」とメモを受け取り、次の回の入力として記録する

### 6. 選ばれた方向を掘る

選ばれた A と B を保ったまま、間・誇張・終わり方など良くなりうる差分だけを少数案に分岐し、4〜5 を繰り返す。

- 案数は人間の指定を優先する
- 各候補の manifest に `based_on` で元の案を書く（`references/review.md` の 1 節）
- レビュー結果は `references/review.md` の 6 節に沿って読む
- 分岐の幅、元の案への寄せ方、発散へ戻る条件は `references/exploration.md` の 9〜10 節に従う

### 7. 仕上げて登録する

人間が採用を決めたら、次を行う。

1. 実表示サイズで詰め、動作フロー 4 の自己チェックをやり直す
2. `frontend/src/games/<game>/assets/pictogram-showcase.svg` に置く
3. `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx` で `?raw` import し、`pictogramShowcaseSvg` に渡す
4. `bun run --cwd frontend check`・`bun run --cwd frontend typecheck`・`bun run --cwd frontend test` を通す
5. `bun run --cwd frontend dev` をバックグラウンドで起動し、実アプリのホームで次を確かめる。Playwright のスクリプトは `/tmp/pictogram-showcase-<game>/` に置き、`${CLAUDE_SKILL_DIR}/scripts/playwright_resolve.cjs` で Playwright を読み込む
   - ヒーロー、一覧の選択中、ライト・ダーク、動きを減らす設定
   - 選んだ瞬間に形が変わらず（変わるのは色だけ）、静止状態から動き始めること。タイトルを閉じた直後も含む

## 出力先

- 探索中の候補・記録・ギャラリー: `/tmp/pictogram-showcase-<game>/`
- 完成 SVG: `frontend/src/games/<game>/assets/pictogram-showcase.svg`
- 登録: `frontend/src/game-catalog/<game>/<game>-catalog-entry.tsx`
- スキルの配下には特定のゲームの生成物を置かない

## 補助ファイルと読む文書

- `references/contract.md`: SVG の書き方の規則（受け口の契約）。動作フロー 3 で試作を始める前と、契約に関わる判断をするときに読む
- `references/exploration.md`: 材料の抽出、色の定義元の調べ方、発散、再生形式の選び方、束ね方、掘り方。動作フロー 1〜3 と 6 で読む
- `references/motion.md`: 再生形式の作り方、周期と止まりの目安、イージング、構図の範囲、静止状態の大きさと重さ、動きの量、WebKit で崩れない書き方。動作フロー 3 で動きを作るときに読む
- `references/self-review.md`: 観察の方法、必須チェックリスト、`self-review.json`。動作フロー 4 で読む
- `references/review.md`: manifest、ギャラリー、人間レビューの受け渡しと問い方、これまでの人間レビューの傾向。動作フロー 3 で manifest を作るときと、動作フロー 5・6 で読む
- `scripts/`: 検査（`check_animation.py`・`check_self_review.py`）、観察（`observe_animation.cjs`・`capture_frames.cjs`）、ギャラリー（`make_review_gallery.py`・`check_gallery.cjs`）、色の実値（`resolve_color.py`）、Playwright の読み込み（`playwright_resolve.cjs`）。オプションは各スクリプトの `--help` で確かめる
- `DESIGN.md` の「コンポーネント」の「ゲームを表す表現」「ゲームピクトグラム」と「動き」、`docs/プロダクト/画面/SCR-001.md`（ホーム）、`docs/adr/ADR-0016-selected-pictogram-color-motion.md`: 動作フロー 1 の前に読む

## 守ること

- 微差を別案として数えない
- 自動検査だけで採用・不採用を決めない
- 自己チェックを通っていない候補を人間に見せない
- 人間が選んだ方向から、理由なく外れない
- SVG に探索の経緯をコメントで残さない
