---
paths:
  - "frontend/src/**/*.tsx"
  - "!frontend/src/components/ui/**/*"
  - "!frontend/src/pages/**/*"
  - "!**/*.test.tsx"
---

# React コンポーネントのファイル

## 1ファイル1コンポーネント

- 1つの `.tsx` ファイルには、React コンポーネントを1つだけ定義する
- コンポーネントは、コンポーネント名と同じ `<ComponentName>.tsx` というファイルに定義する
- 型・定数・React コンポーネントでない関数は、コンポーネントと同じファイルに置いてよい

## props

- props を受け取るコンポーネントは、`<ComponentName>Props` 型を定義して引数の型にする

  ```tsx
  OK:
  type DifficultyDialogProps = {
    value: Difficulty;
    onChange: (value: Difficulty) => void;
  };

  export function DifficultyDialog({ value, onChange }: DifficultyDialogProps) {
    // ...
  }

  NG:
  export function DifficultyDialog({
    value,
    onChange,
  }: {
    value: Difficulty;
    onChange: (value: Difficulty) => void;
  }) {
    // ...
  }
  ```

- props 全体の契約は、hook の戻り値や別の責務の型そのものに委ねず、コンポーネントが必要とする値を並べて明示する
- 値の変更を求める props の型は、`onChange: (value: T) => void` のように子が行う操作で書き、React の state setter の型や親の汎用的な状態更新手段の型にしない

## 子コンポーネントの配置

- 親の内部実装としてだけ使う子コンポーネントは、親と同名のディレクトリの下に置く

  ```text
  OK:
  Hoge.tsx
  Hoge/
  ├── Fuga.tsx
  └── Fuga/
      └── Piyo.tsx

  NG:
  Hoge.tsx
  Fuga.tsx
  ```

- `Hoge/` の下のファイルは、`Hoge.tsx` と `Hoge/` の下のファイルからだけ参照する
- 親と同名のディレクトリの下のコンポーネントを親の責務の外から使うときは、共通の責務に名前を付け、その名前でその責務の置き場所へ移す
- 共通の責務に名前を付けられないコンポーネントは、見た目や実装が似ていても共有しない
