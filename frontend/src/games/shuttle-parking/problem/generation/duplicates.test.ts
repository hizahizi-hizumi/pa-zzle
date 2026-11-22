import {
  countSharedShuttleParkingCars,
  createShuttleParkingPlayKey,
  createShuttleParkingVisualKey,
  isShuttleParkingTrivial,
} from "@/games/shuttle-parking/problem/generation/duplicates";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";

// 4×4・上だけが開いている。赤の車0が青の車1を塞ぐ。
const problem: ShuttleParkingProblem = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
      { row: 2, column: 0, orientation: "vertical", capacity: 2, color: "b" },
      { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "b" },
    ],
  },
  passengers: ["a", "a", "b", "b", "b", "b"],
  bayCount: 1,
};

// 左右を反転し、色の名前を入れ替え、車の並びを替えた同じ問題。
const mirrored: ShuttleParkingProblem = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 1, orientation: "vertical", capacity: 2, color: "a" },
      { row: 0, column: 3, orientation: "vertical", capacity: 2, color: "c" },
      { row: 2, column: 3, orientation: "vertical", capacity: 2, color: "a" },
    ],
  },
  passengers: ["c", "c", "a", "a", "a", "a"],
  bayCount: 1,
};

// 左へ90度回した同じ問題（上の出口は左の出口になり、縦の車は横になる）。
const rotated: ShuttleParkingProblem = {
  lot: {
    size: 4,
    openSides: ["left"],
    cars: [
      { row: 3, column: 0, orientation: "horizontal", capacity: 2, color: "a" },
      { row: 3, column: 2, orientation: "horizontal", capacity: 2, color: "b" },
      { row: 1, column: 0, orientation: "horizontal", capacity: 2, color: "b" },
    ],
  },
  passengers: ["a", "a", "b", "b", "b", "b"],
  bayCount: 1,
};

describe("createShuttleParkingVisualKey", () => {
  test("反転・回転・色の名前の付け替えでは同じキーになること", () => {
    const keys = [problem, mirrored, rotated].map(
      createShuttleParkingVisualKey,
    );

    expect(new Set(keys).size).toBe(1);
  });

  test("列が違えば違うキーになること", () => {
    const other = {
      ...problem,
      passengers: ["b", "a", "a", "b", "b", "b"] as const,
    };

    const key = createShuttleParkingVisualKey({
      ...other,
      passengers: [...other.passengers],
    });

    expect(key).not.toBe(createShuttleParkingVisualKey(problem));
  });
});

describe("createShuttleParkingPlayKey", () => {
  test("車の並びと位置が違っても塞ぎの関係が同じなら同じキーになること", () => {
    const shifted: ShuttleParkingProblem = {
      ...problem,
      lot: {
        ...problem.lot,
        cars: [
          {
            row: 0,
            column: 3,
            orientation: "vertical",
            capacity: 2,
            color: "b",
          },
          {
            row: 0,
            column: 1,
            orientation: "vertical",
            capacity: 2,
            color: "a",
          },
          {
            row: 2,
            column: 1,
            orientation: "vertical",
            capacity: 2,
            color: "b",
          },
        ],
      },
    };

    const keys = [problem, shifted].map(createShuttleParkingPlayKey);

    expect(keys[0]).toBe(keys[1]);
  });

  test("塞ぎの関係が違えば違うキーになること", () => {
    const unblocked: ShuttleParkingProblem = {
      ...problem,
      lot: {
        ...problem.lot,
        cars: [
          {
            row: 0,
            column: 0,
            orientation: "vertical",
            capacity: 2,
            color: "a",
          },
          {
            row: 2,
            column: 1,
            orientation: "vertical",
            capacity: 2,
            color: "b",
          },
          {
            row: 0,
            column: 2,
            orientation: "vertical",
            capacity: 2,
            color: "b",
          },
        ],
      },
    };

    const key = createShuttleParkingPlayKey(unblocked);

    expect(key).not.toBe(createShuttleParkingPlayKey(problem));
  });
});

describe("countSharedShuttleParkingCars", () => {
  test("同じ位置・向き・定員の車を色によらず数えること", () => {
    const shared = countSharedShuttleParkingCars(problem, {
      ...problem,
      lot: {
        ...problem.lot,
        cars: problem.lot.cars.map((car) => ({ ...car, color: "c" as const })),
      },
    });

    expect(shared).toBe(3);
  });
});

describe("isShuttleParkingTrivial", () => {
  test("先に青を出すと詰む問題は、無作為に出すと負けうるので自明ではないこと", () => {
    expect(isShuttleParkingTrivial(problem)).toBe(false);
  });

  test("待機枠が十分にあれば、どう出しても勝つので自明であること", () => {
    expect(isShuttleParkingTrivial({ ...problem, bayCount: 3 })).toBe(true);
  });
});
