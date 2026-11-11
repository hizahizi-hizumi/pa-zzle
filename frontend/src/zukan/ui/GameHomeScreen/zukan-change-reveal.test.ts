import {
  findZukanFeaturedLaunchPoint,
  findZukanHeaviestStamp,
  findZukanHeroLaunchPoint,
  findZukanRevealScrollTop,
  findZukanWaveLaunchPoint,
  findZukanWaveScrollTop,
  getZukanStamp,
  getZukanStampTimeline,
  isZukanStampTargetVisible,
  planZukanStamps,
  readZukanStamp,
  snapZukanScrollTopToRows,
  type ZukanStamp,
  type ZukanStampChange,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import type { ZukanProblem } from "@/zukan/zukan-collection";

const clearStamp: ZukanStamp = { level: "clear", isRaised: false };
const perfectStamp: ZukanStamp = { level: "perfect", isRaised: false };

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
    firstClearedAt: 0,
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
  const newlyGreatStamp: ZukanStamp = { level: "great", isRaised: false };
  const raisedGoodStamp: ZukanStamp = { level: "good", isRaised: true };
  const cases: [string, ZukanStamp[], ZukanStamp | null][] = [
    ["押すマスが無い", [], null],
    [
      "新しく解いた段階が違う",
      [clearStamp, newlyGreatStamp, { level: "good", isRaised: false }],
      newlyGreatStamp,
    ],
    [
      "新しく great で解いたマスと、good へ上がったマスがある",
      [newlyGreatStamp, raisedGoodStamp],
      raisedGoodStamp,
    ],
    [
      "段階が上がったマスと、新しく perfect で解いたマスがある",
      [{ level: "great", isRaised: true }, perfectStamp],
      perfectStamp,
    ],
    [
      "同じ重さの変化が並ぶ",
      [raisedGoodStamp, { level: "great", isRaised: true }],
      raisedGoodStamp,
    ],
  ];

  test.each(cases)("最も重い変化を選ぶこと: %s", (_, stamps, expected) => {
    const heaviest = findZukanHeaviestStamp(stamps);

    expect(heaviest).toBe(expected);
  });
});

/** 押していく順に、台紙の位置 `indices` に並ぶ変化。 */
function listChanges(
  indices: readonly number[],
  stamp: ZukanStamp = clearStamp,
): ZukanStampChange[] {
  return indices.map((index) => ({ index, stamp }));
}

describe("getZukanStampTimeline", () => {
  const styles = ["hero", "featured", "wave"] as const;

  test.each(styles)(
    "飛び始め、現れ終え、着き、戻り、消える順に進むこと: %s",
    (style) => {
      const { flightMs, appearedMs, landMs, settledMs, endMs } =
        getZukanStampTimeline(style);
      const marks = [flightMs, appearedMs, landMs, settledMs, endMs];

      expect(marks).toEqual(marks.toSorted((a, b) => a - b));
    },
  );

  describe("主役の1枚の場合", () => {
    test("行き先の枠を光らせてから、400〜550ms かけて飛ばすこと", () => {
      const { flightMs, landMs } = getZukanStampTimeline("hero");

      expect(flightMs).toBeGreaterThan(0);
      expect(landMs - flightMs).toBeGreaterThanOrEqual(400);
      expect(landMs - flightMs).toBeLessThanOrEqual(550);
    });
  });

  describe("波ではめる場合", () => {
    test("着くのと同時に現れ終え、1枚ずつ押すより早く着くこと", () => {
      const wave = getZukanStampTimeline("wave");
      const featured = getZukanStampTimeline("featured");

      expect(wave.appearedMs).toBe(wave.landMs);
      expect(wave.landMs).toBeLessThan(featured.landMs);
    });
  });
});

describe("planZukanStamps", () => {
  describe.each([1, 3])("変化が%i枚の場合", (count) => {
    const changes = listChanges(
      Array.from({ length: count }, (_, order) => order * 20),
    );

    test("全部を主役として、開いてから100ms以内に枠を光らせ始め、300ms前後で飛ばし始めること", () => {
      const steps = planZukanStamps(changes);
      const heroTimeline = getZukanStampTimeline("hero");
      const firstStartMs = steps[0]?.startMs ?? 0;
      const flightStartMs = firstStartMs + heroTimeline.flightMs;

      expect(steps.every(({ style }) => style === "hero")).toBe(true);
      expect(firstStartMs).toBeLessThanOrEqual(100);
      expect(flightStartMs).toBeGreaterThanOrEqual(250);
      expect(flightStartMs).toBeLessThanOrEqual(350);
    });

    test("前の1枚が着いてから、次の1枚を着かせること", () => {
      const steps = planZukanStamps(changes);
      const gaps = steps
        .slice(1)
        .map(({ landMs }, order) => landMs - (steps[order]?.landMs ?? 0));

      expect(gaps.every((gap) => gap >= 400)).toBe(true);
    });
  });

  describe("変化が4枚の場合", () => {
    const changes = listChanges([1, 4, 9, 30]);

    test("全部を1枚ずつ、着く間隔を空けて押すこと", () => {
      const steps = planZukanStamps(changes);

      expect(steps.map(({ style }) => style)).toEqual([
        "featured",
        "featured",
        "featured",
        "featured",
      ]);
      expect(steps.map(({ landMs }) => landMs)).toEqual([560, 740, 920, 1100]);
    });
  });

  describe("perfect を含む場合", () => {
    const changes: ZukanStampChange[] = [
      { index: 0, stamp: clearStamp },
      { index: 1, stamp: clearStamp },
      { index: 2, stamp: perfectStamp },
      { index: 3, stamp: clearStamp },
    ];

    test("perfect を押す前に間を置き、後の1枚もその分だけ後ろへずらすこと", () => {
      const steps = planZukanStamps(changes);
      const gaps = steps
        .slice(1)
        .map(({ landMs }, order) => landMs - (steps[order]?.landMs ?? 0));

      expect(gaps[1]).toBe((gaps[0] ?? 0) + 150);
      expect(gaps[2]).toBe(gaps[0]);
    });
  });

  describe("perfect が多い場合", () => {
    const changes = listChanges([0, 1, 2, 3, 4, 5], perfectStamp);

    test("間を置くのは2回までにすること", () => {
      const steps = planZukanStamps(changes);
      const gaps = steps
        .slice(1)
        .map(({ landMs }, order) => landMs - (steps[order]?.landMs ?? 0));
      const longGaps = gaps.filter((gap) => gap > Math.min(...gaps));

      expect(longGaps).toHaveLength(2);
    });
  });

  describe.each([
    ["4枚から10枚", 10],
    ["十数枚", 15],
    ["百数十枚", 177],
  ])("変化が%sの場合", (_, count) => {
    const changes = listChanges(
      Array.from({ length: count }, (_, order) => order * 2),
    );

    test("開いてから1.4秒ほどで最後の1枚を着かせ、その動きを2秒以内に終えること", () => {
      const steps = planZukanStamps(changes);
      const lastLandMs = Math.max(...steps.map((step) => step.landMs));
      const endMs = Math.max(...steps.map((step) => step.endMs));

      expect(lastLandMs).toBeLessThanOrEqual(1400);
      expect(endMs).toBeLessThanOrEqual(2000);
    });

    test("押していく順に押し始め、押していく順に着くこと", () => {
      const steps = planZukanStamps(changes);
      const isStartAscending = steps.every(
        ({ startMs }, order) =>
          order === 0 || startMs >= (steps[order - 1]?.startMs ?? 0),
      );
      const isLandAscending = steps.every(
        ({ landMs }, order) =>
          order === 0 || landMs > (steps[order - 1]?.landMs ?? 0),
      );

      expect(isStartAscending).toBe(true);
      expect(isLandAscending).toBe(true);
    });
  });

  describe("変化が10枚より多い場合", () => {
    const changes = listChanges(
      Array.from({ length: 15 }, (_, order) => order * 2),
    );

    test("先頭の6枚を1枚ずつ押し、残りを波でまとめてはめること", () => {
      const steps = planZukanStamps(changes);
      const styles = steps.map(({ style }) => style);

      expect(styles.slice(0, 6).every((style) => style === "featured")).toBe(
        true,
      );
      expect(styles.slice(6).every((style) => style === "wave")).toBe(true);
    });
  });

  describe("波ではめるマスが台紙の中で偏っている場合", () => {
    const changes = listChanges([
      ...Array.from({ length: 6 }, (_, order) => order),
      10,
      11,
      12,
      200,
      201,
    ]);

    test("数え上げが目で追えるよう、台紙の位置によらず等しい間隔で着かせること", () => {
      const steps = planZukanStamps(changes);
      const wave = steps.slice(6).map(({ landMs }) => landMs);
      const gaps = wave
        .slice(1)
        .map((landMs, order) => landMs - (wave[order] ?? 0));

      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1);
    });
  });
});

describe("findZukanHeroLaunchPoint", () => {
  const view = { left: 0, top: 0, right: 300, bottom: 600 };

  describe("行き先の枠が台の上の方にある場合", () => {
    const slot = { x: 40, y: 80, size: 20 };

    test("台の下端寄りのうち枠から遠い所から、遠すぎない距離で飛ばすこと", () => {
      const launch = findZukanHeroLaunchPoint(slot, view);
      const distance = Math.hypot(launch.x - slot.x, launch.y - slot.y);

      expect(launch.y).toBeGreaterThan(slot.y);
      expect(distance).toBeCloseTo(200);
    });
  });

  describe("行き先の枠が台の下端にある場合", () => {
    const slot = { x: 150, y: 570, size: 20 };

    test("上端寄りも含めて、枠から離れた所から飛ばすこと", () => {
      const launch = findZukanHeroLaunchPoint(slot, view);
      const distance = Math.hypot(launch.x - slot.x, launch.y - slot.y);

      expect(distance).toBeGreaterThanOrEqual(80);
    });
  });
});

describe("findZukanFeaturedLaunchPoint", () => {
  const view = { left: 0, top: 0, right: 300, bottom: 600 };
  const slot = { x: 30, y: 30, size: 20 };

  test("見えている範囲の真ん中の向きへ、ピース2.5枚分離れた所から飛ばすこと", () => {
    const launch = findZukanFeaturedLaunchPoint(slot, view);
    const distance = Math.hypot(launch.x - slot.x, launch.y - slot.y);

    expect(distance).toBeCloseTo(50);
    expect(launch.x).toBeGreaterThan(slot.x);
    expect(launch.y).toBeGreaterThan(slot.y);
  });
});

describe("findZukanWaveLaunchPoint", () => {
  const origin = { x: 0, y: 0 };
  const slot = { x: 100, y: 0, size: 20 };

  test("先にはめたマスの側から、外へ押し出されるように寄せること", () => {
    const launch = findZukanWaveLaunchPoint(slot, origin);

    expect(launch.x).toBeCloseTo(86);
    expect(launch.y).toBeCloseTo(0);
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

      expect(top).toBe(scrollTop + 600 - (500 - 16));
    });
  });

  describe("見える範囲に入る範囲が上にはみ出している場合", () => {
    const target = { top: 50, bottom: 150 };

    test("範囲の上端が余白を空けて見える所まで、最小の量だけ上へスクロールすること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 50 - (100 + 16));
    });
  });

  describe("範囲が見える範囲より大きい場合", () => {
    const target = { top: 300, bottom: 1300 };

    test("範囲の上端を見える範囲の上端へ余白を空けて寄せること", () => {
      const top = findZukanRevealScrollTop(view, scrollTop, target);

      expect(top).toBe(scrollTop + 300 - (100 + 16));
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

describe("isZukanStampTargetVisible", () => {
  const view = { top: 100, bottom: 500 };
  const cases = [
    ["端から余白を空けて入っている", { top: 116, bottom: 484 }, true],
    ["上の余白にかかっている", { top: 110, bottom: 140 }, false],
    ["下の余白にかかっている", { top: 460, bottom: 490 }, false],
  ] as const;

  test.each(cases)(
    "%s範囲を、見えているとするか: %s",
    (_, target, expected) => {
      const isVisible = isZukanStampTargetVisible(view, target);

      expect(isVisible).toBe(expected);
    },
  );
});

describe("findZukanWaveScrollTop", () => {
  const view = { top: 200, bottom: 600 };
  const scrollTop = 200;
  const last = { top: 1400, bottom: 1430 };

  describe("波の先頭が見える範囲の上の方にある場合", () => {
    const front = { top: 300, bottom: 330 };

    test("動かさないこと", () => {
      const top = findZukanWaveScrollTop(view, scrollTop, front, last);

      expect(top).toBe(scrollTop);
    });
  });

  describe("波の先頭が見える範囲の下の方にある場合", () => {
    const front = { top: 560, bottom: 590 };

    test("先頭を見える範囲の上から6割の所に置くこと", () => {
      const top = findZukanWaveScrollTop(view, scrollTop, front, last);

      expect(top).toBe(scrollTop + 560 - (200 + 400 * 0.6));
    });
  });

  describe("最後にはめるマスがもう見えている場合", () => {
    const front = { top: 560, bottom: 590 };
    const nearLast = { top: 570, bottom: 580 };

    test("最後のマスが見える所より先へは進めないこと", () => {
      const top = findZukanWaveScrollTop(view, scrollTop, front, nearLast);

      expect(top).toBe(scrollTop);
    });
  });
});

describe("snapZukanScrollTopToRows", () => {
  const rows = { alignedScrollTop: 4, pitch: 30 };
  const cases = [
    ["行の境目の近く", 15, 1000, 4],
    ["次の行の境目の近く", 25, 1000, 34],
    ["行の境目が最も先のスクロール位置を超える", 100, 90, 64],
  ] as const;

  test.each(cases)(
    "%sなら、行の上端が見える範囲の上端に揃う位置にすること",
    (_, scrollTop, maxScrollTop, expected) => {
      const snapped = snapZukanScrollTopToRows(scrollTop, rows, maxScrollTop);

      expect(snapped).toBe(expected);
    },
  );
});
