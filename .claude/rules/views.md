---
paths:
  - "frontend/src/views/**/*.tsx"
---

# Views

- Viewは、1つのUI描画ルートに対応し、その画面を成立させる責務を接続する合成境界とする。
- Viewは `<画面の役割>View` と命名し、URLやルートファイル名ではなく画面の役割から名前を決める。
- View自体を複数のルートから直接利用しない。

```text
pages/index.tsx
→ views/PuzzleSelectionView.tsx

pages/records.tsx
→ views/PlayRecordsView.tsx

pages/games/nanpure/play/[difficulty].tsx
→ views/NanpurePlayView.tsx
```

## 責務

- URLパラメータやルーター状態を取得する。
- URL由来の値の検証・変換を、意味を所有する処理へ委譲して呼び出す。
- 画面遷移を接続する。
- その画面で利用するhooks・ユースケースを接続する。
- 複数の責務間で値を受け渡す。
- 画面固有の状態、レイアウト、UIの合成を持ってよい。
- Viewを薄くすることだけを目的に、中継するだけのコンポーネントを作らない。

## 所有しないもの

- ゲームやドメインのロジックを実装しない。
- 保存、評価など、独立した機能固有の規則を実装しない。
- 他のViewでも利用する処理や再利用可能なUIをViewの責務として所有しない。
- 共有したい処理が生じても `views/common`、`views/hooks`、`views/utils` へ集約せず、その処理が属する責務を見直す。

## 配置

- `views/` のディレクトリ構造をURL階層に合わせない。
- 単一のViewを置くためだけにディレクトリを作らない。
- 複数のViewに共通する意味上のまとまりが明確になった場合だけ、そのまとまりでディレクトリを分ける。

```text
# OK: 画面の役割で配置する
views/
├── PuzzleSelectionView.tsx
├── PlayRecordsView.tsx
├── NanpurePlayView.tsx
└── WaterSortPlayView.tsx
```

```text
# NG: URL構造をそのまま複製する
views/
└── games/
    └── nanpure/
        └── play/
            └── NanpurePlayView.tsx
```
