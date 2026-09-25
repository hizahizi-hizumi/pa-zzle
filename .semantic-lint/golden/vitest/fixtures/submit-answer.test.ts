import { describe, expect, test } from "vitest";

import { formatElapsed, submitAnswer } from "./answer";

describe("submitAnswer", () => {
  const emptyAnswer = "";
  const correctAnswer = "42";
  const malformedAnswer = "4 2";

  test("回答が空の場合はエラーを返すこと", () => {
    const result = submitAnswer(emptyAnswer);

    expect(result.ok).toBe(false);
  });

  test("正解時は得点を加算すること", () => {
    const result = submitAnswer(correctAnswer);

    expect(result.score).toBe(10);
  });

  test("不正な形式の回答を拒否すること", () => {
    const result = submitAnswer(malformedAnswer);

    expect(result.ok).toBe(false);
  });

  test("回答を送信すると入力欄を空にすること", () => {
    const result = submitAnswer(correctAnswer);

    expect(result.nextInput).toBe("");
  });

  test("回答の送信時刻を記録すること", () => {
    const result = submitAnswer(correctAnswer);

    expect(result.submittedAt).toBeInstanceOf(Date);
  });

  test("同じ回答を2回送信しても1件だけ受け付けること", () => {
    const results = [submitAnswer(correctAnswer), submitAnswer(correctAnswer)];

    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  describe("制限時間を過ぎた場合", () => {
    test("回答を受け付けないこと", () => {
      const result = submitAnswer(correctAnswer);

      expect(result.ok).toBe(false);
    });
  });
});

describe("formatElapsed", () => {
  const cases = [
    [61_000, "1:01"],
    [0, "0:00"],
  ] as const;
  const negativeCases = [-1, -61_000] as const;

  test.each(cases)("経過時間 %i ミリ秒を分と秒で表すこと", (elapsedMs, expected) => {
    const text = formatElapsed(elapsedMs);

    expect(text).toBe(expected);
  });

  test.each(negativeCases)("経過時間が %i ミリ秒なら0:00を返すこと", (elapsedMs) => {
    const text = formatElapsed(elapsedMs);

    expect(text).toBe("0:00");
  });

  test("負の値の場合も0:00を返すこと", () => {
    const text = formatElapsed(-1);

    expect(text).toBe("0:00");
  });

  test("経過時間が1時間を超えるときも分で表すこと", () => {
    const text = formatElapsed(3_661_000);

    expect(text).toBe("61:01");
  });
});
