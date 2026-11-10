---
paths:
  - "frontend/src/game-catalog/**/*.{ts,tsx}"
  - "!**/*.test.{ts,tsx}"
---

# ゲームカタログ

## ゲームカタログ

- ゲームの一覧、ゲームの画面への遷移、ゲームの画面と記録・離脱したプレイ・検証情報の接続は `frontend/src/game-catalog/` 直下に置く
- 記録や離脱したプレイの問題を遊び直すプレイ画面の行き先は、`game-catalog-entry.ts` の `RecordProblemPlayTarget`・`RecordProblemPlayDestination` で表す
- 記録から描く結果画面へゲームの外側が渡す告知と操作は、`game-catalog-entry.ts` の `RecordResultContext` に置く
- ゲームのホームとプレイ画面のパスは、カタログ項目の `homePath`・`playPath` から得る

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

## ゲームを追加するとき

1. `.claude/rules/game-structure.md` を読み、`frontend/src/games/<game>/` をその標準配置で作る
2. `frontend/src/game-catalog/<game>/` にゲームごとのファイルを置き、`game-catalog.ts` の `gameCatalog` の並びへ加える
3. `.claude/rules/pages.md` と `.claude/rules/views.md` を読み、ゲームのホームとプレイのルートと View を置く
4. `bun run --cwd frontend generate:dependency-rules` で `frontend/biome.json` の依存規則を生成し直す
5. 問題集を持つゲームは、次を置く
   - 生成スクリプト `frontend/scripts/generate-<game>-problem-pool.ts`
   - `frontend/package.json` の scripts の生成コマンド
   - `frontend/biome.json` の `files.includes` の `problem-pool.json` の除外
6. 問題集の生成スクリプトは、`--verify` で全問を再検証できるようにする
7. 一覧の並びを確かめるテスト `frontend/src/views/PuzzleSelectionView.test.tsx` にゲームを加える
