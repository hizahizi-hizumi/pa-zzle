---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript のコーディング規約

## 責務と依存方向

- 型・関数・モジュールは、実装方法ではなく意味と責務で分ける。
- 名前を付けにくい場合は、包括的な名前でまとめる前に責務の混在を見直す。
- 公開APIには、その責務に必要な値だけを含める。
- 依存は、その意味を所有するモジュールへ向ける。

```ts
// NG: ゲーム結果の契約をUI実装から借りる
import type { GameResultLevel } from "@/components/GameResult";

// OK: ゲーム結果の意味を所有する場所へ契約を置く
import type { GameResultLevel } from "@/games/result";
```

## ロジックとUI

- ロジックは「何が成立するか」を判断し、意味を保った値で返す。
- UIは「どう見せるか」を決める。表示のためにロジックを再実装しない。
- JSX、React、文字列かどうかではなく、何を決めるコードかで責務を判断する。

```ts
// NG: 自己ベスト判定の結果に表示表現が混ざっている
type PersonalBestUpdate = {
  label: string;
  previousValue: string; // "92点"
  currentValue: string; // "100点"
};

// OK: ロジックは意味を保った値を返す
type PersonalBestUpdate = {
  metricId: string;
  previousValue: number;
  currentValue: number;
};

// OK: UI側で利用者向けの表現にする
const playScoreDisplay = {
  label: "最高評価",
  formatValue(value: number) {
    return `${value}点`;
  },
};
```

## 関数定義

- 関数はアロー関数で定義せず、関数宣言を使う。

## export

- default exportは使用せず、named exportを使用する。
- 外部フレームワークや生成ツールとの契約としてdefault exportが要求される境界に限り例外とする。

```ts
// NG
export default function calculateScore() {}

// OK
export function calculateScore() {}
```

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
