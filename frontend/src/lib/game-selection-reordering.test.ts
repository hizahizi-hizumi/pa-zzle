import {
  findAutoScrollStep,
  findDropIndex,
  findKeyboardDestination,
  findRowShift,
} from "@/lib/game-selection-reordering";

describe("findDropIndex", () => {
  const centers = [24, 72, 120, 168];
  const cases = [
    { source: 1, y: -30, expected: 0 },
    { source: 1, y: 23, expected: 0 },
    { source: 1, y: 24, expected: 1 },
    { source: 1, y: 71, expected: 1 },
    { source: 1, y: 72, expected: 1 },
    { source: 1, y: 120, expected: 2 },
    { source: 1, y: 168, expected: 3 },
    { source: 1, y: 999, expected: 3 },
    { source: 3, y: -5, expected: 0 },
    { source: 3, y: 119, expected: 2 },
    { source: 0, y: 999, expected: 3 },
  ];

  test.each(cases)(
    "元の位置%sからポインターの位置に対応する移動先を決めること",
    ({ source, y, expected }) => {
      const destination = findDropIndex(centers, y, source);

      expect(destination).toBe(expected);
    },
  );
});

describe("findRowShift", () => {
  const cases = [
    { sourceIndex: 1, dropIndex: 3, expected: [0, 96, -48, -48] },
    { sourceIndex: 3, dropIndex: 0, expected: [48, 48, 48, -144] },
    { sourceIndex: 2, dropIndex: 2, expected: [0, 0, 0, 0] },
  ];

  test.each(cases)(
    "項目間を移動した際、空き位置を保ったまま周囲の行を移動すること",
    ({ sourceIndex, dropIndex, expected }) => {
      const offsets = expected.map((_, index) =>
        findRowShift(index, { sourceIndex, dropIndex, height: 48 }),
      );

      expect(offsets).toEqual(expected);
    },
  );
});

describe("findAutoScrollStep", () => {
  const cases = [
    { y: 50, top: 100, bottom: 300, sign: -1 },
    { y: 100, top: 100, bottom: 300, sign: -1 },
    { y: 150, top: 100, bottom: 300, sign: 0 },
    { y: 250, top: 100, bottom: 300, sign: 0 },
    { y: 300, top: 100, bottom: 300, sign: 1 },
    { y: 350, top: 100, bottom: 300, sign: 1 },
    { y: 121, top: 100, bottom: 140, sign: 0 },
  ];

  test.each(cases)(
    "表示領域の端に近づいた方向にのみ自動スクロールすること",
    ({ y, top, bottom, sign }) => {
      const step = findAutoScrollStep(y, top, bottom);

      expect(Math.sign(step)).toBe(sign);
      expect(Math.abs(step)).toBeLessThanOrEqual(16);
    },
  );
});

describe("findKeyboardDestination", () => {
  const cases = [
    ["ArrowUp", 1, 0],
    ["ArrowUp", 0, 0],
    ["ArrowDown", 2, 3],
    ["ArrowDown", 3, 3],
    ["Home", 3, 0],
    ["End", 0, 3],
    ["Escape", 1, null],
  ] as const;

  test.each(cases)(
    "%sの操作で移動先を決め、対象外のキーは無視すること",
    (key, source, expected) => {
      const destination = findKeyboardDestination(key, source, 4);

      expect(destination).toBe(expected);
    },
  );
});
