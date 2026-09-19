---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript のコーディング規約

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
