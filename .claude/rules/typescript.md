---
paths:
  - "**/*.{ts,tsx}"
  - "!tools/semantic-lint/**/*"
  - "!.semantic-lint/**/*"
  - "!frontend/src/components/ui/**/*"
  - "!frontend/src/router.ts"
---

# TypeScript の書き方

- モジュールのトップレベルで定義する関数は、関数宣言で書く

  ```ts
  OK:
  function formatScore(score: number): string {
    return `${score}点`;
  }

  NG:
  const formatScore = (score: number): string => `${score}点`;
  ```

- `_private` で export したものはテストからだけ参照する
