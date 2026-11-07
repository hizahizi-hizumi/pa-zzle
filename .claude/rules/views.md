---
paths:
  - "frontend/src/views/**/*.{ts,tsx}"
  - "!**/*.test.{ts,tsx}"
---

# Views

## 名前

- View は `<画面の役割>View` と名付け、URL やルートファイル名ではなく画面の役割から名前を決める

  ```text
  OK:
  pages/index.tsx → views/PuzzleSelectionView.tsx
  pages/records/index.tsx → views/PlayRecordsView.tsx
  pages/puzzles/nanpure/index.tsx → views/NanpureHomeView.tsx
  pages/puzzles/nanpure/play/[difficulty].tsx → views/NanpurePlayView.tsx
  ```

## View に置く処理

- URL パラメータやルーター状態の取得
- URL 由来の値の検証・変換の呼び出し
- 画面遷移の接続
- その画面で使う hooks・ユースケースの接続
- 複数の責務の間の値の受け渡し
- 画面固有の状態、レイアウト、UI の合成
- View の処理は View に書き、props を中継するだけのコンポーネントへ移さない

## View の外に置く処理

- URL 由来の値の検証・変換は、その値の意味を所有する処理に置く
- ゲームやドメインのロジックは View で実装しない
- 保存、評価など、独立した機能に固有の規則は View で実装しない
- 他の View でも使う処理や再利用できる UI は、View の外のその処理が属する責務に置く

- `views/common`、`views/hooks`、`views/utils` を作らない

## ゲームカタログの使い方

- パズル選択・記録・結果の画面は、ゲームを列挙せず `@/game-catalog/game-catalog` の `gameCatalog` を回す
- ゲームの画面への遷移は `@/game-catalog/game-navigation` の `createGameNavigation`・`useGameNavigation`・`openRecordProblemPlay` を使い、パスを直書きしない
- ゲームのホームの View は、`useGameHome` が返す `screenProps` をゲームのホームの画面へそのまま渡す

## 配置

- View ファイルは `views/` 直下に置き、複数の View に共通する意味上のまとまりがあるときだけ、そのまとまりのディレクトリに置く
- `views/` のディレクトリ構造を URL 階層に合わせない

  ```text
  OK:
  views/
  ├── PuzzleSelectionView.tsx
  ├── PlayRecordsView.tsx
  ├── NanpurePlayView.tsx
  └── WaterSortPlayView.tsx
  NG:
  views/
  └── puzzles/
      └── nanpure/
          └── play/
              └── NanpurePlayView.tsx
  ```
