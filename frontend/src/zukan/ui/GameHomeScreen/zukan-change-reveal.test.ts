import {
  countZukanStampSlots,
  findZukanFollowScrollTop,
  findZukanHeaviestStamp,
  findZukanRevealScrollTop,
  getZukanStamp,
  getZukanStampSlot,
  groupZukanStampSlots,
  planZukanStamps,
  readZukanStamp,
  type ZukanStamp,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import type { ZukanProblem } from "@/zukan/zukan-collection";

const clearStamp: ZukanStamp = { level: "clear", isRaised: false };
const perfectStamp: ZukanStamp = { level: "perfect", isRaised: false };

describe("getZukanStampSlot", () => {
  const cases = [
    [0, 0],
    [11, 11],
    [12, 12],
    [40, 12],
  ] as const;

  test.each(cases)(
    "押す順 %i 番目のマスを %i 回目に押すこと",
    (order, expected) => {
      const slot = getZukanStampSlot(order);

      expect(slot).toBe(expected);
    },
  );
});

describe("countZukanStampSlots", () => {
  const cases = [
    [0, 0],
    [3, 3],
    [13, 13],
    [100, 13],
  ] as const;

  test.each(cases)(
    "変化したマスが %i 個なら %i 回に分けて押すこと",
    (changeCount, expected) => {
      const slotCount = countZukanStampSlots(changeCount);

      expect(slotCount).toBe(expected);
    },
  );
});

describe("groupZukanStampSlots", () => {
  describe("変化したマスが13個以上の場合", () => {
    const indices = Array.from({ length: 15 }, (_, order) => order * 10);

    test("12個目までを1つずつ押し、残りを最後の1回にまとめること", () => {
      const slots = groupZukanStampSlots(indices);

      expect(slots).toHaveLength(13);
      expect(slots.slice(0, 12).every((slot) => slot.length === 1)).toBe(true);
      expect(slots[12]).toEqual([120, 130, 140]);
    });
  });
});

describe("getZukanStamp", () => {
  const problem: ZukanProblem = {
    kind: "solved",
    number: 1,
    difficulty: "1",
    problemId: "p-1",
    bestScore: 92,
    fastestElapsedMs: 60_000,
    fewestMoves: null,
    fewestMistakes: null,
    firstCompletedAt: 0,
    bestScoreCompletedAt: 0,
  };

  const cases = [
    [
      "新しく解いたマスを、今の段階で上がっていないものとすること",
      { kind: "newly-solved", previousStatus: "untouched" },
      false,
    ],
    [
      "段階が上がったマスを、今の段階で上がったものとすること",
      { kind: "raised", previousStatus: "good" },
      true,
    ],
  ] as const;

  test.each(cases)("%s", (_, change, expectedRaised) => {
    const stamp = getZukanStamp(problem, change);

    expect(stamp).toEqual({ level: "great", isRaised: expectedRaised });
  });
});

describe("readZukanStamp", () => {
  function createSquare(attributes: Record<string, string>): Element {
    const square = document.createElement("button");
    for (const [name, value] of Object.entries(attributes)) {
      square.setAttribute(name, value);
    }
    return square;
  }

  describe("今の段階と段階が上がったことを載せたマスの場合", () => {
    const square = createSquare({
      "data-change-level": "perfect",
      "data-change-raised": "",
    });

    test("載せた変化を読むこと", () => {
      const stamp = readZukanStamp(square);

      expect(stamp).toEqual({ level: "perfect", isRaised: true });
    });
  });

  describe("段階を載せていないマスの場合", () => {
    const square = createSquare({});

    test("読まないこと", () => {
      const stamp = readZukanStamp(square);

      expect(stamp).toBeNull();
    });
  });
});

describe("findZukanHeaviestStamp", () => {
  const cases: [string, ZukanStamp[], number | null][] = [
    ["押すマスが無い", [], null],
    [
      "新しく解いた段階が違う",
      [
        clearStamp,
        { level: "great", isRaised: false },
        { level: "good", isRaised: false },
      ],
      1,
    ],
    [
      "新しく great で解いたマスと、good へ上がったマスがある",
      [
        { level: "great", isRaised: false },
        { level: "good", isRaised: true },
      ],
      1,
    ],
    [
      "段階が上がったマスと、新しく perfect で解いたマスがある",
      [{ level: "great", isRaised: true }, perfectStamp],
      1,
    ],
  ];

  test.each(cases)(
    "最も重い変化のマスを選ぶこと: %s",
    (_, stamps, expected) => {
      const heaviest = findZukanHeaviestStamp(stamps);

      expect(heaviest).toBe(expected);
    },
  );
});

describe("planZukanStamps", () => {
  describe("押す回が少ない場合", () => {
    const slots = [[clearStamp], [clearStamp], [clearStamp]];

    test("前回の姿を少し見せてから、一定の間隔で押し始めること", () => {
      const plan = planZukanStamps(slots);

      expect(plan.slotStartMs).toEqual([300, 460, 620]);
    });
  });

  describe("perfect を含む回がある場合", () => {
    const slots = [[clearStamp], [perfectStamp], [clearStamp]];

    test("perfect を押す前に間を置き、後の回もその分だけ後ろへずらすこと", () => {
      const plan = planZukanStamps(slots);

      expect(plan.slotStartMs).toEqual([300, 640, 800]);
    });

    test("後の回より perfect の余韻が長く続けば、その終わりを全体の終わりにすること", () => {
      const plan = planZukanStamps(slots);

      expect(plan.endMs).toBe(1460);
    });
  });

  describe("最初の回が perfect の場合", () => {
    test("前回の姿を見せる間より長く待たないこと", () => {
      const plan = planZukanStamps([[perfectStamp], [clearStamp]]);

      expect(plan.slotStartMs[0]).toBe(300);
    });
  });

  describe("perfect を含む回が多い場合", () => {
    const slots = Array.from({ length: 6 }, () => [perfectStamp]);

    test("間を置くのは2回までにすること", () => {
      const plan = planZukanStamps(slots);
      const gaps = plan.slotStartMs
        .slice(1)
        .map((startMs, slot) => startMs - (plan.slotStartMs[slot] ?? 0));
      const longGaps = gaps.filter((gap) => gap > Math.min(...gaps));

      expect(longGaps).toHaveLength(2);
    });
  });

  describe("押す回が多い場合", () => {
    const slots = Array.from({ length: 13 }, () => [clearStamp]);

    test("全体を1.7秒以内に収めること", () => {
      const plan = planZukanStamps(slots);

      expect(plan.endMs).toBeLessThanOrEqual(1700);
    });

    test("押す間隔を詰めても、回の順に押し始めること", () => {
      const plan = planZukanStamps(slots);
      const isAscending = plan.slotStartMs.every(
        (startMs, slot) =>
          slot === 0 || startMs > (plan.slotStartMs[slot - 1] ?? 0),
      );

      expect(isAscending).toBe(true);
    });
  });
});

describe("findZukanRevealScrollTop", () => {
  const view = { top: 100, bottom: 500 };
  const scrollTop = 200;

  describe("押すマスの範囲が端から余白を空けて見えている場合", () => {
    const target = { top: 140, bottom: 460 };

    test("動かさないこと", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBeNull();
    });
  });

  describe("見える範囲に入る範囲が下にはみ出している場合", () => {
    const target = { top: 400, bottom: 600 };

    test("範囲の下端が余白を空けて見える所まで、最小の量だけ下へスクロールすること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 600 - (500 - 32));
    });
  });

  describe("見える範囲に入る範囲が上にはみ出している場合", () => {
    const target = { top: 50, bottom: 150 };

    test("範囲の上端が余白を空けて見える所まで、最小の量だけ上へスクロールすること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 50 - (100 + 32));
    });
  });

  describe("範囲が見える範囲より大きい場合", () => {
    const target = { top: 300, bottom: 1300 };

    test("範囲の上端を見える範囲の上端へ余白を空けて寄せること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 300 - (100 + 32));
    });
  });

  describe("台紙の先頭より上へ寄せることになる場合", () => {
    const target = { top: -200, bottom: 0 };

    test("台紙の先頭で止めること", () => {
      const top = findZukanRevealScrollTop(view, 100, target);

      expect(top).toBe(0);
    });
  });
});

describe("findZukanFollowScrollTop", () => {
  const view = { top: 100, bottom: 500 };
  const scrollTop = 200;
  const rest = { top: 480, bottom: 1400 };

  describe("次に押すマスが見えている場合", () => {
    const next = { top: 300, bottom: 316 };

    test("まだ押していないマスが見えていなくても動かさないこと", () => {
      const top = findZukanFollowScrollTop(view, scrollTop, next, rest);

      expect(top).toBeNull();
    });
  });

  describe("次に押すマスが見えておらず、残りのマスが見える範囲に入らない場合", () => {
    const next = { top: 480, bottom: 496 };

    test("次に押すマスを見える範囲の上端へ余白を空けて寄せること", () => {
      const top = findZukanFollowScrollTop(view, scrollTop, next, rest);

      expect(top).toBe(scrollTop + 480 - (100 + 32));
    });
  });

  describe("次に押すマスが見えておらず、残りのマスが見える範囲に入る場合", () => {
    const next = { top: 480, bottom: 496 };
    const fittingRest = { top: 480, bottom: 700 };

    test("残りのマスが全部見える所まで、最小の量だけスクロールすること", () => {
      const top = findZukanFollowScrollTop(view, scrollTop, next, fittingRest);

      expect(top).toBe(scrollTop + 700 - (500 - 32));
    });
  });
});
