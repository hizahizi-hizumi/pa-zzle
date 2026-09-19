---
paths:
  - "frontend/**/*.test.{ts,tsx,mjs}"
---

# Vitest のコーディング規約

## テストAPI / 実行環境

- `describe`、`test`、`expect`、`vi`、各種hookなどのVitestテストAPIは `vitest` から明示的にimportする。
- Vitestのglobal API設定に依存せず、テストファイル単体で利用しているテストAPIが分かる状態にする。
- `bun:test`、Bun test runner固有API、Bunでしか動作しないAPIへ依存しない。
- テストはNode上のVitestで実行可能にする。

## テスト配置

- テストは対象モジュールと同じディレクトリへコロケーションする。
- TypeScript / TSXのテストは `<対象モジュール>.test.ts` / `<対象モジュール>.test.tsx` とする。
- `scripts/` のES moduleテストは `<対象モジュール>.test.mjs` とする。
- 複数テストファイルで本当に共有するsetupやhelperが必要になるまで共通化しない。共有範囲は必要最小限にする。

## テストケース命名規則

- `test` のケース名は日本語の散文で具体的な期待動作を記述し、`こと` で終える。
- ケース名は人間が条件・期待動作を理解するための散文として扱う。
- ケース名に `場合` `時` は含めない。
  - 条件を明示する必要がある場合は `describe("<条件>の場合", ...)` でまとめ、その中のケース名は期待動作だけを記述する。
  - 条件が対象コード内部の識別子や状態名でしか表現できない場合は、条件として独立させず、入力データや `test.each` のケースとして表すべきでないかを見直す。
- 同じ関数・メソッド・コンポーネントを複数ケースで検証する場合は、対象名を表す `describe("<対象名>", ...)` でまとめる。
  - 対象名は対象コードの関数・メソッド・クラス・コンポーネント名に対応するコード表記を使う。
- テストファイル自体が対象モジュールを表すため、モジュール名だけを繰り返すための `describe` は作らない。
- helper・変数など、テストコード内部で参照する識別子はコード表記を使う。
- CLIオプション・列挙値・ID・パス・コード識別子など機械識別子やリテラルそのものを検証する場合は、散文へ言い換えず実際の表記を保持する。

## テスト構造

### 基本原則

- Arrange / Act / Assertの3相を明確に分離する。
- テスト固有の準備はArrangeへ置き、複数ケースで共有する準備だけhelperやhookへ分離する。
- Actではテスト対象を明示的に実行し、戻り値や観測結果を変数へ受ける。テスト対象の呼び出しを `expect` へ直接埋め込まない。
- ActとAssertの間は空行で分離する。
- 例外送出自体が期待動作なら、テスト対象を呼び出す関数をActで作り、Assertで `toThrow` を検証する。
- DOMを検証する場合は、role・accessible name・表示内容・ユーザー操作後の観測結果など、利用者から観測できる契約を優先する。

```ts
import { expect, test } from "vitest";


test("ユーザーを取得できること", () => {
  const userId = 1;

  const result = getUser(userId);

  expect(result.id).toBe(userId);
});
```

テスト対象の実行を `expect` へ埋め込まない。

```ts
// 避ける
test("ユーザーが存在すること", () => {
  expect(userExists(1)).toBe(true);
});
```

例外送出を検証する場合もActとAssertを分離する。

```ts
import { expect, test } from "vitest";


test("不正な入力を拒否すること", () => {
  const act = () => parseUser("");

  expect(act).toThrow();
});
```

### 入力違いのケース

- 同じ期待動作を入力違いで検証する場合は `test.each` を使う。
- ケース名が必要なら条件やケース内容を説明する日本語の散文を使い、失敗時に条件を判別できるようにする。
- 機械識別子やリテラルそのものを区別する必要がある場合は実際の表記を保持してよい。

```ts
import { expect, test } from "vitest";


test.each([
  ["1", 1],
  ["2", 2],
])("文字列を数値へ変換できること: %s", (input, expected) => {
  const result = parseNumber(input);

  expect(result).toBe(expected);
});
```
