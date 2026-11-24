import {
  isFukumenzanWorkload,
  measureFukumenzanWorkload,
} from "@/games/fukumenzan/problem/workload";

describe("measureFukumenzanWorkload", () => {
  test("文字の種類と、式に書かれた文字の数を数えること", () => {
    const workload = measureFukumenzanWorkload({
      addends: ["BYK", "KTK"],
      result: "TKHH",
    });

    expect(workload).toEqual({ letterCount: 5, letterCellCount: 10 });
  });
});

describe("isFukumenzanWorkload", () => {
  test.each([
    [{ letterCount: 5, letterCellCount: 10 }, true],
    [{ letterCount: 11, letterCellCount: 10 }, false],
    [{ letterCount: 0, letterCellCount: 10 }, false],
    [{ letterCount: 5 }, false],
  ])("%o を見分けること", (value, expected) => {
    const isWorkload = isFukumenzanWorkload(value);

    expect(isWorkload).toBe(expected);
  });
});
