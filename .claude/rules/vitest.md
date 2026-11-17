---
paths:
  - "frontend/src/**/*.{test,spec}.{ts,tsx}"
  - "frontend/scripts/**/*.test.ts"
---

# Vitest のテストの書き方

## 配置

- テストは対象モジュールと同じディレクトリに `<対象モジュール>.test.ts` か `<対象モジュール>.test.tsx` として置く
- setup・helper はテストファイルの中に書き、複数のテストファイルが使うときだけ共有する
- 共有する setup・helper は、それを使うテストファイルだけが参照する場所に置く

## ケース名

- `test` のケース名は、期待する動作を具体的に書いた日本語の散文にし、`こと` で終える
- ケース名に条件を表す `〜場合` `〜時` を入れない
- 条件を示すときは `describe("<条件>の場合", ...)` でまとめ、その中のケース名には期待する動作だけを書く
- 対象コード内部の識別子や状態名でしか表せない条件は、`describe` にせず、入力データか `test.each` のケースで表す
- 同じ関数・メソッド・コンポーネントを複数のケースで検証するときは `describe("<対象名>", ...)` でまとめる
- `<対象名>` には対象の関数・メソッド・クラス・コンポーネントの名前をコード表記のまま書く
- モジュール名だけを表す `describe` は作らない
- CLI オプション・列挙値・ID・パス・コード識別子などの機械識別子やリテラルそのものを検証するときは、ケース名にも実際の表記を書く
- helper・変数など、ケース名のほかにテストコードの中で参照する識別子は、日本語の散文にせずコード表記で名付ける

## テスト対象

- 公開 API に加えて、プライベート関数もテストする

## Arrange / Act / Assert

- Arrange は対象か条件を表す `describe` の中で行い、`test` の本体には Act と Assert だけを書く

  ```ts
  OK:
  describe("getUser", () => {
    const userId = 1;

    test("ユーザーを取得できること", () => {
      const result = getUser(userId);

      expect(result.id).toBe(userId);
    });
  });

  NG:
  describe("getUser", () => {
    test("ユーザーを取得できること", () => {
      const userId = 1;

      const result = getUser(userId);

      expect(result.id).toBe(userId);
    });
  });
  ```

- 変わらない入力値・期待値・テストデータは `describe` スコープの `const` として定義する
- テストごとに作り直す状態・モック・スパイ・コンポーネントの描画は `describe` 内の `beforeEach` で準備する
- `beforeEach` では Arrange だけを行い、検証する操作は `test` の Act で行う
- 一部のケースだけ Arrange が違うときは、その条件を表す `describe` を入れ子にするか、入力の差分を `test.each` のケースにする
- Act ではテスト対象を呼び出して戻り値や観測結果を変数で受け、Assert ではその変数を `expect` に渡す
- Act と Assert の間に空行を入れる
- 例外を投げることを検証するときは、Act でテスト対象を呼び出す関数を作り、Assert でその関数を `toThrow` で検証する

  ```ts
  OK:
  describe("parseUser", () => {
    const invalidInput = "";

    test("不正な入力を拒否すること", () => {
      const act = () => parseUser(invalidInput);

      expect(act).toThrow();
    });
  });
  ```

## 入力違いのケース

- 同じ期待動作を入力違いで検証するときは `test.each` を使う
- `test.each` のケースデータは `describe` 側で定義し、コールバック引数で受け取った値を Act に渡す
- `test.each` にケース名を付けるときは、条件やケースの内容を日本語の散文で書く

## DOM の検証

- TSX のテストの描画・DOM 探索・`act` は Testing Library の API で行い、同じことをする helper を作らない
- DOM クエリは検証する契約に合わせて選ぶ
  - 要素の role と、その名前による識別が契約なら `getByRole` を使う
  - 表示文言が契約なら `getByText` を使う
  - label とフォーム部品の関連が契約なら `getByLabelText` を使う
- 画面に意味上の領域があるときは、その領域を利用者から観測できるクエリで取得し、`within` で探索範囲を絞る

  ```tsx
  OK:
  const digitInput = screen.getByRole("group", { name: "数字入力" });
  const digit = within(digitInput).getByText("5");

  NG:
  const digit = screen.getByRole("button", { name: "5" });
  ```
