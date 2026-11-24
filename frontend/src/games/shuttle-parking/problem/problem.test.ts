import {
  _private,
  assertShuttleParkingProblem,
  createShuttleParkingProblemIdentity,
  createShuttleParkingProblemSeed,
  isCurrentShuttleParkingProblemIdentity,
  isShuttleParkingRecordedProblemIdentity,
  restoreShuttleParkingProblem,
  SHUTTLE_PARKING_GENERATOR_VERSION,
  type ShuttleParkingProblem,
} from "@/games/shuttle-parking/problem/problem";

const { decodeShuttleParkingProblem } = _private;

const problem: ShuttleParkingProblem = {
  lot: {
    size: 6,
    openSides: ["top", "right"],
    cars: [
      { row: 0, column: 0, orientation: "horizontal", capacity: 2, color: "a" },
      { row: 2, column: 0, orientation: "vertical", capacity: 3, color: "b" },
    ],
  },
  passengers: ["a", "b", "b", "a", "b"],
  bayCount: 3,
};
const seed = "6tr3-00h2a20v3b-abbab";

describe("createShuttleParkingProblemSeed", () => {
  test("駐車場・開いた辺・待機枠・車・乗客の列を1つの文字列にすること", () => {
    const encoded = createShuttleParkingProblemSeed(problem);

    expect(encoded).toBe(seed);
  });
});

describe("decodeShuttleParkingProblem", () => {
  test("符号から同じ問題に戻すこと", () => {
    const decoded = decodeShuttleParkingProblem(seed);

    expect(decoded).toEqual(problem);
  });

  test.each([
    ["開いた辺の順が違う", "6rt3-00h2a20v3b-abbab"],
    ["乗客と座席が合わない", "6tr3-00h2a20v3b-abbb"],
    ["車が重なる", "6tr3-00h2a00v3b-abbab"],
    ["書き方が違う", "6tr3-00h2a20v3-abbab"],
  ])("%s 符号には null を返すこと", (_, invalid) => {
    const decoded = decodeShuttleParkingProblem(invalid);

    expect(decoded).toBeNull();
  });
});

describe("restoreShuttleParkingProblem", () => {
  const identity = createShuttleParkingProblemIdentity(problem);

  test("identity から問題を復元すること", () => {
    const restored = restoreShuttleParkingProblem(identity);

    expect(restored).toEqual({ problem, identity });
  });

  test("駐車場の大きさが符号と合わない identity を受け付けないこと", () => {
    function restore() {
      return restoreShuttleParkingProblem({
        ...identity,
        conditions: { size: 7 },
      });
    }

    expect(restore).toThrow(RangeError);
  });
});

describe("isCurrentShuttleParkingProblemIdentity", () => {
  const identity = createShuttleParkingProblemIdentity(problem);

  test.each([
    ["今の版の identity", identity, true],
    ["別の版の identity", { ...identity, generatorVersion: "0" }, false],
    ["復号できない seed", { ...identity, seed: "broken" }, false],
    ["条件が無い", { ...identity, conditions: undefined }, false],
  ] as const)("%s に %s を返すこと", (_, value, expected) => {
    const accepted = isCurrentShuttleParkingProblemIdentity(value);

    expect(accepted).toBe(expected);
  });
});

describe("isShuttleParkingRecordedProblemIdentity", () => {
  test.each([
    ["今の版の identity", createShuttleParkingProblemIdentity(problem), true],
    [
      "駐車場の大きさが読める別の版の identity",
      { generatorVersion: "0", seed: "old", conditions: { size: 7 } },
      true,
    ],
    [
      "駐車場の大きさが読めない identity",
      { generatorVersion: "0", seed: "old", conditions: {} },
      false,
    ],
  ] as const)("%s に %s を返すこと", (_, value, expected) => {
    const accepted = isShuttleParkingRecordedProblemIdentity(value);

    expect(accepted).toBe(expected);
  });

  test("今の生成器の版を記録の版として持つこと", () => {
    const { generatorVersion } = createShuttleParkingProblemIdentity(problem);

    expect(generatorVersion).toBe(SHUTTLE_PARKING_GENERATOR_VERSION);
  });
});

describe("assertShuttleParkingProblem", () => {
  const car = problem.lot.cars[1]!;
  test.each([
    [
      "確かめた範囲より大きい駐車場",
      { ...problem, lot: { ...problem.lot, size: 8 } },
    ],
    ["待機枠が5つ以上", { ...problem, bayCount: 5 }],
    [
      "車が9台以上",
      {
        lot: {
          size: 7,
          openSides: ["top"],
          cars: Array.from({ length: 9 }, (_, index) => ({
            ...car,
            row: index < 7 ? 0 : 4,
            column: index % 7,
            capacity: 2 as const,
          })),
        },
        passengers: Array.from({ length: 18 }, () => "b" as const),
        bayCount: 3,
      },
    ],
  ] as const satisfies readonly (readonly [string, ShuttleParkingProblem])[])(
    "%s問題を受け付けないこと",
    (_, target) => {
      function assertProblem() {
        assertShuttleParkingProblem(target);
      }

      expect(assertProblem).toThrow(RangeError);
    },
  );
});
