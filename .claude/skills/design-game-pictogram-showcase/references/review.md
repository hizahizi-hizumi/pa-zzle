# 候補の比較とレビュー

`/design-game-pictogram-showcase` の試作候補を同一条件で比較し、人間の方向指定を次の探索へ渡すための形式を定義する。

## 1. manifest

比較候補は JSON manifest でまとめる。

```json
{
  "title": "Water Sort showcase exploration",
  "game_id": "water-sort",
  "base_pictogram": "/abs/path/frontend/src/games/water-sort/assets/pictogram.svg",
  "candidates": [
    {
      "id": "pour-settle-01",
      "name": "注いで揃う（切り替えループ）",
      "file": "pour-settle-01.svg",
      "family": "注いで揃う",
      "hypothesis": "片方の瓶が傾き、上の色がもう片方へ移り、受け側が単色で満ちて止まる",
      "aim_play": "「同じ色の上へ注ぐ」判断と操作を 1 回で見せる",
      "aim_payoff": "受け側が単色で満ちた瞬間に動きが止まる",
      "static_pose": "揃った後の姿（各周の終わりの止まり）。0% は注ぐ前の姿",
      "playback": "cut"
    }
  ]
}
```

トップレベル:

- `game_id`（必須）: `frontend/src/games/<game>/` のディレクトリ名。接頭辞 `pz-<game_id>-` の検査に使う
- `title`（任意）: ギャラリーの見出し
- `base_pictogram`（任意、推奨）: 白黒版 SVG。ギャラリーの「基準」に同じ条件で表示する

候補の必須項目:

- `id`: manifest 内で一意な識別子
- `file`: manifest からの相対パスまたは絶対パス
- `hypothesis`: 何が起きる案か
- `aim_play`: 目的 A。中心の操作をどう見せるか
- `aim_payoff`: 目的 B。どの瞬間の気持ちよさをどう見せるか
- `static_pose`: 静止状態はどの瞬間の姿か（`once` の終点、`cut` の止まり、`seam` の継ぎ目になる）
- `playback`: `once` / `cut` / `seam`（`SKILL.md` の「再生形式」）

任意項目:

- `name`: ギャラリーに出す短い表示名（無ければ `id`）
- `family`: 同じ方向をまとめる表示名
- `notes`: 実装上の制約や比較時に残したい補足

パスは manifest からの相対パスまたは絶対パスで書く。

## 2. ギャラリーで見るもの

`make_review_gallery.py` は読み手で形を分ける。候補の SVG はクラス名・keyframes 名が候補間で衝突するため、どちらも同じ文書へインライン展開しない。

色は `frontend/styles/globals.css` から読んだ `--foreground` / `--muted-foreground` を `--game-pictogram-strong` / `--game-pictogram-soft` に、`--background` / `--muted` / `--ring` / `--border` を面・選択枠・未選択枠に使う。他ゲームの比較には `frontend/src/games/*/assets/pictogram.svg`（対象ゲームを除く）を使う（`--games-dir` で変更可）。

### セルフレビュー用（`--audience self`）

候補ごとに隔離した文書（`srcdoc` の iframe）を作り、その中に次を並べる。iframe の高さは読み込み後に中身へ合わせる。

- ライト/ダークそれぞれで、ヒーロー（既定 177px / 138px、祖先に `data-pictogram-motion="play"`）と一覧選択中（既定 56px / 46px、属性なし。周りの余白と選択枠はアプリの一覧の枠と同じ比率）。ダーク側は祖先に `.dark` クラスを付ける
- 一覧選択中サイズで、候補（選択枠）と他ゲームの白黒ピクトグラム（未選択枠）を並べた比較列

サイズは `--hero-sizes` / `--list-sizes`（カンマ区切り）で変えられる。JavaScript が有効な環境では次の操作を追加する。

- 全候補 / 候補ごとの最初からの再生、全候補の一時停止 / 再開
- 候補ごとの時刻スライダー（全アニメーションを止め、指定時刻へ移す。最大値は周期 - 1ms で、`cut` / `seam` の 100% 直前、`once` の終点を指す）
- 候補ごとの再生属性の切り替え（属性を外した静止状態と見比べる）

判定やメモの入力欄は置かない。セルフレビューの結果は `self-review.json` に記録する（`references/self-review.md`）。

### 人間レビュー用（`--audience human`）

人間がスマホを含む手元の端末で見るためのページ。外部参照のない単体 HTML で、固定ヘッダーを持たないモバイル優先の 1 カラムにする。

- 各 SVG は `<img src="data:image/svg+xml;base64,…">` で表示する。候補の SVG を外側の `<svg viewBox="0 0 120 120">` で包み、外側に `style="--game-pictogram-strong:…;--game-pictogram-soft:…"`、ダークなら `class="dark"`、ヒーローなら `data-pictogram-motion="play"` を付けて、アプリと同じく祖先条件として当てる。iframe を使わないため、端末で高さが合わず見切れることがない
- 各 `<img>` に `data-view`（`hero` = ヒーロー再生、`list` = 一覧の選択中の静止、`other` = 他ゲーム、`base` = 白黒版）と `data-theme`（`light` / `dark`）を付ける。ブラウザで確かめるスクリプトはこれで対象を選ぶ
- 候補ごとに「ヒーロー（再生）」と「一覧の選択中（静止）」を、端末の画面幅に応じてアプリと同じ大きさ（幅 640px 未満はヒーロー 138px、以上は 177px。一覧の選択中もアプリと同じ枠・余白）で並べる。その下に一覧の選択中を他ゲームの白黒ピクトグラムと並べた比較列を置く
- ライト/ダーク切り替え、全候補 / 候補ごとの最初からの再生（`<img>` の SVG は読み込み直しでしか最初に戻らないため、画像を読み込み直す）
- 判定 4 種（候補 / 掘る / 一部 / 除外）と候補ごとのメモ、最下部に全体メモ。入力は端末の localStorage に自動保存する
- 「レビューJSON」でレビュー結果を表示してクリップボードへコピーする
- `--db-doc <id>` を付けると、artifact の DB の `reviews/<id>` にも `{ review, updatedAt }` で保存する。`window.claude` が無い、または DB を使えない環境では「DB 未接続」と出して端末保存だけにする。端末に記録が無ければ DB の内容を読み込んで表示する
- `<img>` の SVG には OS の動きを減らす設定が届かない場合がある。動きを減らす設定の確認はセルフレビュー（`observe_animation.cjs`）で行う

レビュー結果の形式:

```json
{
  "title": "Water Sort showcase exploration",
  "game_id": "water-sort",
  "candidates": {
    "pour-settle-01": { "decision": "candidate", "note": "止まりがもう少し短くてよい" }
  },
  "overall": "切り替えループの方が自然"
}
```

方向指定は採点ではない。次だけを扱う。

- `candidate`: ベース候補として残す
- `explore`: この系統をさらに掘る
- `part`: 一部の発想や表現だけ使う
- `reject`: この方向は捨てる

## 3. 人間提示前の品質ゲート

`check_animation.py` の PASS は契約と構造の検査結果であり、提示できる品質を保証しない。`references/self-review.md` のチェックを候補ごとに実施して `self-review.json` を作り、`check_self_review.py` が PASS した後、`--audience human --self-review ...` で生成したギャラリーの候補だけを人間へ提示する。

## 4. 人間レビューの受け渡し

人間は手元の端末（スマホ含む）でギャラリーを見る。Claude 側のブラウザでの確認や、デスクトップ前提の画面で済ませない。

Claude アプリ環境（artifact を公開できる）:

1. `--db-doc <game>-round<N>` 付きで人間用ギャラリーを生成する。
2. artifact として公開し、db capability（`{ "db": {} }`）を宣言する。新しいページは公開してから宣言、既存ページに DB を足すときは宣言してから公開する（手順は artifact ツールの `describe_capabilities` の `db` を正とする）。DB を宣言していないページでは保存できない。
3. 人間へリンクを渡し、見終わったら知らせてもらう。
4. artifact の DB から `reviews/<id>` を読み取る（`db_get`）。

それ以外の環境:

1. `--db-doc` なしで生成した HTML ファイルを人間へ渡す。
2. 人間はギャラリー最下部の「レビューJSON」で結果をコピーし、会話へ貼る。

どちらでも、受け取ったレビュー結果（判定・メモ・全体メモ）を一時ディレクトリへ `review-<N>.json` などとして保存し、方向指定の記録と合わせて次の回の入力にする。

## 5. 人間レビューで問うこと

点数化せず、A → B → C → D の順に会話の材料として問う。

1. **A**: 説明なしで、このパズルで何を考え何をするかが動きから分かるか
2. **B**: 解けた・揃った瞬間が見え、遊びたくなるか
3. **C**: 選んだときに、選択がはっきり返ってくる手応えがあるか。弱ければ、A/B のどこが弱いせいか
4. **D**: 画面全体の第一印象や落ち着きを崩していないか
5. 静止状態（一覧選択中）は、白黒版と同じパズルの色付き版として自然か
6. 候補全体ではなく、一部分だけ残したいものがあるか

「A は良いが B が弱い」「静止状態だけ良い」のような混ざった評価をそのまま残してよい。C が弱いという指摘は、C 専用の演出を足す指示ではなく、A/B の見直し指示として扱う。

## 6. レビュー結果の使い方

人間の発言やレビュー結果 JSON を、次の探索への指示として扱う。

```text
pour-settle-01 を掘る
last-drop-02 の最後の間を混ぜたい
hesitate-01 は静止状態だけ使いたい
その他は除外
```

候補の順位としてではなく、残す A/B の核と変えてよい部分として解釈する。

## 7. 仕上げ後の再レビューと完成判断

最終候補を仕上げた後も、`references/self-review.md` のチェックを新しい記録でやり直し、全項目が `true` の候補だけを提示する。採用は人間が判断する。自動検査やエージェントの実描画レビューを狙いの達成の承認として扱わない。

採用したい方向がなければ再発散する。
