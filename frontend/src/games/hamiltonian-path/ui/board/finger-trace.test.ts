import {
  findCellAt,
  listFingerSteps,
} from "@/games/hamiltonian-path/ui/board/finger-trace";

const size = 4;

describe("findCellAt", () => {
  const cases = [
    ["左上のマス", { x: 0.5, y: 0.5 }, 0],
    ["2行3列のマス", { x: 2.2, y: 1.9 }, 6],
    ["盤面の左の外", { x: -0.1, y: 1 }, null],
    ["盤面の下の外", { x: 1, y: 4 }, null],
  ] as const;

  test.each(cases)("%sを返すこと", (_, point, expected) => {
    const cell = findCellAt(size, point);

    expect(cell).toBe(expected);
  });
});

describe("listFingerSteps", () => {
  describe("1回の動きで横へ3マス先まで速く動いた場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: 3.5, y: 0.5 };

    test("通り越したマスを順に1マスずつ移ること", () => {
      const { steps, cell } = listFingerSteps(size, from, to, 0);

      expect(steps).toEqual([
        { from: 0, to: 1, horizontalFirst: true },
        { from: 1, to: 2, horizontalFirst: true },
        { from: 2, to: 3, horizontalFirst: true },
      ]);
      expect(cell).toBe(3);
    });
  });

  describe("隣のマスの縁に入った場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const cases = [
      ["縁から幅の15%より浅いと今のマスに残る", { x: 1.1, y: 0.5 }, 0],
      ["縁から幅の15%より深いと隣のマスへ移る", { x: 1.2, y: 0.5 }, 1],
    ] as const;

    test.each(cases)("%sこと", (_, to, expected) => {
      const { cell } = listFingerSteps(size, from, to, 0);

      expect(cell).toBe(expected);
    });
  });

  describe("マスの境目を手ぶれで行き来した場合", () => {
    const points = [
      { x: 0.9, y: 0.5 },
      { x: 1.1, y: 0.55 },
      { x: 0.92, y: 0.45 },
      { x: 1.08, y: 0.5 },
    ];

    test("マスを移らないこと", () => {
      const cells = points
        .slice(1)
        .map((to, index) => listFingerSteps(size, points[index]!, to, 0).cell);

      expect(cells).toEqual([0, 0, 0]);
    });
  });

  describe("マスの角を通って斜め隣のマスへ動いた場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: 1.5, y: 1.5 };

    test("斜め隣のマスへ1度に移ること", () => {
      const { steps } = listFingerSteps(size, from, to, 0);

      expect(steps).toEqual([{ from: 0, to: 5, horizontalFirst: true }]);
    });
  });

  describe("縦の動きの方が大きい場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: 1.4, y: 1.6 };

    test("縦を先に通る向きで移ること", () => {
      const { steps } = listFingerSteps(size, from, to, 0);

      expect(steps.at(-1)).toEqual({ from: 0, to: 5, horizontalFirst: false });
    });
  });

  describe("盤面の外へ指が出た場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: -1, y: 0.5 };

    test("今のマスに残ること", () => {
      const { steps, cell } = listFingerSteps(size, from, to, 0);

      expect(steps).toEqual([]);
      expect(cell).toBe(0);
    });
  });
});
