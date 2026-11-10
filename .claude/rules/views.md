---
paths:
  - "frontend/src/views/**/*.{ts,tsx}"
  - "!**/*.test.{ts,tsx}"
---

# Views

## 名前

- View は画面の役割から `<画面の役割>View` と名付ける

  ```text
  OK:
  pages/index.tsx → views/PuzzleSelectionView.tsx
  pages/records/index.tsx → views/PlayRecordsView.tsx
  pages/puzzles/nanpure/index.tsx → views/NanpureHomeView.tsx
  pages/puzzles/nanpure/play/[difficulty].tsx → views/NanpurePlayView.tsx
  ```

## View に置く処理

- View には次の処理を置く
  - URL パラメータやルーター状態の取得
  - URL 由来の値の検証・変換の呼び出し
  - その画面で使う hooks・ユースケース・画面遷移の接続と、その間の値の受け渡し
  - 画面固有の状態
  - 画面のレイアウトと UI の合成
- View の処理は View のコンポーネントの中に直接書く

  ```tsx
  OK:
  export function NanpureHomeView() {
    const { screenProps } = useGameHome(nanpureCatalogEntry);

    return <GameHomeScreen {...screenProps} />;
  }
  NG:
  export function NanpureHomeView() {
    return <NanpureHomeContent />;
  }

  function NanpureHomeContent() {
    const { screenProps } = useGameHome(nanpureCatalogEntry);

    return <GameHomeScreen {...screenProps} />;
  }
  ```

## View の外に置く処理

- URL 由来の値の検証・変換は、その値の意味を所有する処理に置く
- ゲームやドメインのロジックは、その処理が属する責務（`games/<game>/` など）に置く
- 保存・評価など独立した機能に固有の規則は、その機能の責務（`records/` など）に置く
- 他の View でも使う処理と UI は `views/` の外に置く

## ゲームカタログの使い方

- パズル選択・記録・結果の画面は、ゲームを `@/game-catalog/` 直下のモジュール（`game-catalog`・`play-timeline` など）から引く
- ゲームのホームとプレイ画面へは `@/game-catalog/game-navigation` の `createGameNavigation`・`useGameNavigation`・`openRecordProblemPlay` で遷移する

## 配置

- View ファイルは `views/` 直下に置き、複数の View に共通する意味上のまとまりがあるときだけ、そのまとまりのディレクトリに置く

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
  NG:
  views/common/
  views/hooks/
  views/utils/
  ```
