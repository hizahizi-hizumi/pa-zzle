# 作業カード 05: pictogram（新規）

difficulty・problem-pool は、難易度の調査（反例探しへの直し）と問題供給の調査が終わってから渡す。それまでに、難易度に依らない pictogram を作る。

## 項目と範囲・完成条件

`/home/user/pa-zzle/.claude/skills/add-puzzle/references/build-order.md` の pictogram の行。

- ゲーム一覧のピクトグラム `frontend/src/games/magic-square/assets/pictogram.svg` を `/design-game-pictogram` で作り直す（今は playable の最初の版）。
- 続けて、選んでいるときの色と動きのある姿 `assets/pictogram-showcase.svg` を `/design-game-pictogram-showcase` で作る（白黒版を土台にする）。
- どちらの Skill にも、`/add-puzzle` から呼ばれたこと、作業カードの種類（新規。出発点は playable の最初の版）、報告の書き先（作業ディレクトリの `design-game-pictogram-report.md`・`design-game-pictogram-showcase-report.md`）を伝える。Skill が示す置き場所は worktree に、`/tmp` の出力先は作業ディレクトリに読み替える。
- 山場1 の試遊で「一覧で、斜線と点のアイコンからは数のパズルに見えなかった」という所見があった（ピクトグラムは後で作るものとして振り分けた）。魔方陣だと一目で分かること（マスに数が並び、どの列も同じ合計）を伝わり方の基準に入れる。
- 色と動きのある姿は、プレイ画面と同じ石の題材と色（`ui/magic-square-tone.ts`）にそろえる。

完成条件: 各 Skill の完成条件。`verify.sh` が通る。

## worktree とポート

カード 02 と同じ（開発サーバー 5330、driver iphone 9331・pc 9332、画像は `shots/05/`）。

## 注意

カード 01 と同じ（`docs/パズル/導入調査/魔方陣/` は触らない。ピクトグラムの検討資料を導入調査に置く Skill の手順があれば、置き場所を作業ディレクトリに読み替えて残し、報告にパスを書く。メインが導入調査へ移す）。

## この項目に効く失敗パターン

`pitfalls.md` の「全項目」の行と「そろえる所と当てはめる所の取り違え」（ほかのゲームのピクトグラムの形をそのまま当てはめない）。
