---
paths:
  - "frontend/src/game-catalog/**/*.{ts,tsx}"
  - "!**/*.test.{ts,tsx}"
---

# ゲームカタログ

## 共通のファイル

- ゲームの一覧、ゲームの画面への遷移、ゲームの画面と記録・離脱したプレイ・検証情報の接続は `frontend/src/game-catalog/` 直下に置く
- 記録や離脱したプレイの問題を遊び直すプレイ画面と、記録から描く結果画面の契約は `game-catalog-entry.ts` の `RecordResultContext` に置く
- ゲームのホームとプレイ画面のパスは、カタログ項目の `homePath`・`playPath` を正とする
- プレイからゲームのホームへ戻るときは `replacesHistory` で履歴を置き換える
- アプリのホームのゲームの続きは、図鑑と同じ導出（`zukan/zukan-collection.ts`）から、アプリのホームで続きを見せるゲームの分だけ求める
- 記録の結果画面の次の問題は、記録と同じ難易度で、記録の問題を避けて選ぶ
- 診断スナップショットは、検証情報のダイアログを開いたときだけ作る
- 検証情報を開く操作は、内部診断を使えるビルドでだけ出す
- 検証情報のダイアログは、スナップショットがあるときだけ描く
- `usePlayableGame` は、記録を保存できたクリアを記録の結果画面へ移す
- `usePlayableGame` のその場の結果画面は、記録の保存に失敗したプレイでだけ出す
- 評価段階に応じた報酬の音は、プレイを終えて結果を受け取る瞬間にだけ鳴らし、記録から開いた結果画面では鳴らさない

## ゲームごとのファイル

- ゲームごとのファイルは `frontend/src/game-catalog/<game>/` に次の名前で置く

  ```text
  OK:
  frontend/src/game-catalog/<game>/
  ├── <game>-catalog-entry.tsx
  ├── Playable<Game>.tsx
  └── Recorded<Game>Result.tsx
  ```

- `<game>-catalog-entry.tsx` の表示名は `games/<game>/display-name.ts` の `<GAME>_DISPLAY_NAME` を使う
- ホームで選んでいるときに見せる色と動きのあるピクトグラムは、持つゲームだけ `games/<game>/assets/pictogram-showcase.svg` から読む
- 問題集を持つゲームの遊び直す問題は、問題を復元せず、問題集の索引で引けるかだけを確かめる
- 記録から描く結果画面は、`restore<Game>RecordedResult` が結果を作り直せない記録には `null` を返す
- `Playable<Game>.tsx` は、URL の問題 ID で最初の問題を引いて `play/` を始める
- `Playable<Game>.tsx` は、`usePlayableGame` に完了記録・離脱の進み具合・診断スナップショットの作り方を渡す
- `Playable<Game>.tsx` は、`usePlayableGame` が返す `screenProps` を `ui/<Game>Play.tsx` へそのまま渡し、診断ダイアログと一緒に描く
- `Recorded<Game>Result.tsx` は、`useRecordedGameResult` に診断スナップショットの作り方を渡し、記録から作り直した結果を `ui/result/<Game>ResultScreen.tsx` と診断ダイアログで描く

## ゲームを追加する手順

1. `.claude/rules/game-structure.md` を読み、`frontend/src/games/<game>/` をその標準配置で作る
2. `frontend/src/game-catalog/<game>/` にゲームごとのファイルを置き、`game-catalog.ts` の `gameCatalog` の並びへ加える
3. `.claude/rules/pages.md` と `.claude/rules/views.md` を読み、ゲームのホームとプレイのルートと View を置く
4. `bun run --cwd frontend generate:dependency-rules` で `frontend/biome.json` の依存規則を生成し直し、`bun run --cwd frontend test` で生成結果と一致することを確かめる
5. 問題集を持つゲームは、次を置く
   - 生成スクリプト `frontend/scripts/generate-<game>-problem-pool.ts`（`--verify` で全問を再検証できるようにする）
   - `frontend/package.json` の scripts の生成コマンド
   - `frontend/biome.json` の `files.includes` の `problem-pool.json` の除外
6. 一覧の並びを確かめるテスト `frontend/src/views/PuzzleSelectionView.test.tsx` にゲームを加える
