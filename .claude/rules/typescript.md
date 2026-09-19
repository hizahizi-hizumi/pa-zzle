---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript のコーディング規約

## 責務と依存方向

- 型・関数・モジュールは、現在の実装方法ではなく、システム上の意味と責務を基準に分ける。
- 独立した複数の判断を1つの責務としてまとめない。適切な名前を付けにくい場合や包括的な名前が必要に見える場合は、語彙を探す前に責務の混在を見直す。
- 公開する型やAPIには、その責務を果たすために必要な情報だけを含める。利用側の都合や別責務の表現を契約へ持ち込まない。
- 依存先は、その型や契約の意味を所有するモジュールとする。複数箇所から利用されることだけを理由に、特定の利用側や汎用的な共通モジュールへ置かない。
- 名前は意味上の責務を表す。処理形態や現在の実装方法だけを表す名前で複数の責務を包まない。
- `Adapter`、`Manager`、`Presentation` などの名前は、それ自体を禁止しない。その語が単一の責務を正確に表す場合だけ用いる。

```ts
// NG: ゲームロジックがUI実装のモジュールから意味上の契約を借りる
import type { GameResultLevel } from "@/components/GameResult";

// OK: 契約の意味を所有するモジュールへ依存する
import type { GameResultLevel } from "@/games/result";
```

## ロジックとUI

- ロジックは、何が成立しているか、どの値になるか、何と比較するかを判断し、その意味を保った値を返す。
- 利用者向けのラベル、文言、単位を含む文字列化、日時・数値の表示形式、色、アイコン、アニメーションなど、どう見せるかはUIの責務とする。
- UIは、ロジック上の判断を表示のために再実装しない。ロジックが返した意味を利用者向けの表現へ変換する。
- JSXやReactを使用しているか、値が文字列かどうかではなく、利用者への表現を決めているかでUI責務を判断する。
- Reactのライフサイクルや状態管理へ処理を接続するだけで、その処理自体を表示責務とはみなさない。

```ts
// NG: 自己ベスト判定の結果に表示表現が混ざっている
type PersonalBestUpdate = {
  label: string;
  previousValue: string;
  currentValue: string;
};

// OK: ロジックは意味を保った値を返し、表示側でラベル付け・整形する
type PersonalBestUpdate = {
  metricId: string;
  previousValue: number;
  currentValue: number;
};
```

## 関数定義

- 関数はアロー関数で定義せず、関数宣言を使う。

## テスト専用公開

- テストから直接参照する内部要素は `_private` で公開し、`_private` はテストからのみ参照する。

```ts
// NG: テストのためだけに直接 export する
export function helper() {}
```

```ts
// OK: _private で公開する
function helper() {}

export const _private = { helper };
```

```ts
// OK: テストから _private 経由で参照する
import { _private } from "./implementation";

const { helper } = _private;
```
