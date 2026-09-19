---
paths:
  - "frontend/src/**/*.tsx"
---

# TypeScript React

## 1ファイル1コンポーネント

- 1つの `.tsx` ファイルには、Reactコンポーネントを1つだけ定義する。
- 型、定数、Reactコンポーネントではない関数は同居させてよい。
- 外部ライブラリや生成ツール由来の複合UI部品は、上流の配布単位を維持して管理する場合に限り例外とする。

```tsx
// NG: Hoge.tsx に Hoge と Fuga の2コンポーネントを定義している
export function Hoge() {
  return <Fuga />;
}

function Fuga() {
  return <div />;
}
```

```tsx
// OK: JSXを直接記述しており、別コンポーネントを定義していない
export function Hoge() {
  return <div />;
}

function getLabel(): string {
  return "hoge";
}
```

## props

- propsを受け取るコンポーネントは、`<ComponentName>Props` 型を明示する。
- propsの型を関数引数へインラインで記述しない。
- props全体の契約をhookの戻り値や別責務の型そのものに委ねず、コンポーネントが必要とする値を明示する。
- コールバックpropsは `onXxx` と命名し、子コンポーネントで発生した操作・事象の意味を表す。
- Reactのstate setterをpropsの公開契約にしない。値の変更を要求する場合は `onChange: (value: T) => void` のように必要な操作だけを公開する。

```tsx
type DifficultySelectorProps = {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
};

export function DifficultySelector({
  value,
  onChange,
}: DifficultySelectorProps) {
  // ...
}
```

## 子コンポーネントの配置

- 親の内部実装としてのみ利用する子コンポーネントは、親と同名のディレクトリ配下へ配置する。
- 親コンポーネント名のディレクトリ配下は、その親の責務に閉じた内部実装として扱い、責務外から直接参照しない。
- コンポーネント名とファイル名を一致させる。
- コンポーネントの配置目的で `index.tsx` を使用しない。

```text
# OK: Fuga は Hoge の内部実装、Piyo は Fuga の内部実装
Hoge.tsx
Hoge/
├── Fuga.tsx
└── Fuga/
    └── Piyo.tsx
```

```text
# NG: Hoge の内部実装である Fuga が Hoge と同じ階層に露出している
Hoge.tsx
Fuga.tsx
```

## 利用範囲が広がった場合

- 親の内部実装を責務外から利用したくなった場合は、配置だけを変更して共有しない。
- コンポーネントの責務と所有関係を見直し、独立した共通責務がある場合だけ、その責務に名前を付けて適切な場所へ移動する。
- 共通責務を定義できない場合は、見た目や実装の類似だけを理由に共有しない。

```text
# NG: 利用箇所が増えたことだけを理由に上位へ移動する
Hoge/Fuga.tsx
↓
Fuga.tsx
```
