---
paths:
  - "frontend/src/**/*.{ts,tsx}"
  - "!frontend/src/components/ui/**/*"
  - "!frontend/src/router.ts"
---

# TypeScript の設計

## 責務

- 型・関数・モジュールは、実装方法ではなく意味と責務で分ける
- 名前を付けにくい型・関数・モジュールは、包括的な名前でまとめる前に責務が混ざっていないかを見直す
- 公開 API には、その責務に必要な値だけを含める
- React の state は、その値を表示する場所ではなく、その意味を所有する責務で管理する

## 依存の向き

- 依存は、その意味を所有するモジュールへ向ける

  ```ts
  OK:
  import type { GameResultLevel } from "@/games/result";

  NG:
  import type { GameResultLevel } from "@/components/GameResult";
  ```

## 外部から読み戻した値

- 記録・試行・診断・location state など外部から読み戻した値は、`@/lib/type-guards` の型ガードと `isRecordObject` を使って絞り込む
- `@/lib/type-guards` にある型ガードは、各モジュールに書き写さずに import して使う

## ロジックと UI

- ロジックは何が成立するかを判断し、表示の表現を含めず、意味を保った値で返す

  ```ts
  OK:
  type PersonalBestUpdate = {
    metricId: string;
    previousValue: number;
    currentValue: number;
  };

  NG:
  type PersonalBestUpdate = {
    label: string;
    previousValue: string;
    currentValue: string;
  };
  ```

- 表示の言葉・単位・書式は UI で決める
- UI はロジックが返した値を使い、表示のためにロジックを再実装しない
- ロジックか UI かは、JSX・React・文字列を使うかではなく、成立を判断するコードか見せ方を決めるコードかで分ける
