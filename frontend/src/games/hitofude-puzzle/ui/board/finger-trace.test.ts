import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  type BoardPoint,
  findCellAt,
  listFingerSteps,
} from "@/games/hitofude-puzzle/ui/board/finger-trace";

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

/** 指を `points` の順に動かしたときの、マスが移った順の一覧と、最後に指がいるマス。 */
function traceFinger(points: readonly BoardPoint[], current: number) {
  const steps: HitofudePuzzleTraceStep[] = [];
  let cell = current;
  for (const [index, to] of points.slice(1).entries()) {
    const moved = listFingerSteps(size, points[index]!, to, cell);
    steps.push(...moved.steps);
    cell = moved.cell;
  }
  return { steps, cell };
}

/** `from` から `to` まで、指を `stride` ずつ動かした位置の一覧。 */
function listPointsAlong(from: BoardPoint, to: BoardPoint, stride: number) {
  const count = Math.round(Math.hypot(to.x - from.x, to.y - from.y) / stride);
  return Array.from({ length: count + 1 }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / count,
    y: from.y + ((to.y - from.y) * index) / count,
  }));
}

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

  describe("行の境目沿いを少しずつなぞった場合", () => {
    const cases = [0.9, 1.1].map(
      (y) => [y, listPointsAlong({ x: 0.5, y }, { x: 3.5, y }, 0.1)] as const,
    );

    test.each(cases)(
      "高さ %s でも、なぞる向きの隣のマスへ1マスずつ移ること",
      (_, points) => {
        const { steps, cell } = traceFinger(points, 0);

        expect(steps.map(({ from, to }) => [from, to])).toEqual([
          [0, 1],
          [1, 2],
          [2, 3],
        ]);
        expect(cell).toBe(3);
      },
    );
  });

  describe("行の境目沿いをなぞった後に下の行へ入った場合", () => {
    const points = [
      ...listPointsAlong({ x: 0.5, y: 0.9 }, { x: 2.5, y: 0.9 }, 0.1),
      { x: 2.5, y: 1.5 },
    ];

    test("下に隣のマスへ移ること", () => {
      const { steps } = traceFinger(points, 0);

      expect(steps.at(-1)).toEqual({ from: 2, to: 6, horizontalFirst: false });
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
      const { steps, cell } = traceFinger(points, 0);

      expect(steps).toEqual([]);
      expect(cell).toBe(0);
    });
  });

  describe("隣のマスへ移った後に、手ぶれで境目の手前まで戻った場合", () => {
    const points = [
      { x: 0.5, y: 0.5 },
      { x: 1.3, y: 0.5 },
      { x: 0.9, y: 0.55 },
      { x: 1.1, y: 0.45 },
      { x: 0.88, y: 0.5 },
    ];

    test("元のマスへ戻らないこと", () => {
      const { steps, cell } = traceFinger(points, 0);

      expect(steps).toEqual([{ from: 0, to: 1, horizontalFirst: true }]);
      expect(cell).toBe(1);
    });
  });

  describe("マスの角を真っすぐ斜めに横切った場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: 1.5, y: 1.5 };

    test("斜め隣のマスへ1度に移り、どちらの角を通るかを道を引く側に任せること", () => {
      const { steps } = listFingerSteps(size, from, to, 0);

      expect(steps).toEqual([{ from: 0, to: 5, horizontalFirst: true }]);
    });
  });

  describe("マスの角の近くを、縦へは浅く斜めに抜けた場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: 1.5, y: 1.1 };

    test("縦の縁から幅の15%入るまでは同じ行の隣のマスへ移ること", () => {
      const { steps, cell } = listFingerSteps(size, from, to, 0);

      expect(steps).toEqual([{ from: 0, to: 1, horizontalFirst: true }]);
      expect(cell).toBe(1);
    });
  });

  describe("縦の動きの方が大きい場合", () => {
    const from = { x: 0.5, y: 0.5 };
    const to = { x: 1.4, y: 1.6 };

    test("先に深く入った縦の隣のマスを通ってから移ること", () => {
      const { steps } = listFingerSteps(size, from, to, 0);

      expect(steps).toEqual([
        { from: 0, to: 4, horizontalFirst: false },
        { from: 4, to: 5, horizontalFirst: false },
      ]);
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

  describe("盤面の上の外を横へ滑らせて、同じ行の離れたマスへ戻った場合", () => {
    const points = [
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: -0.5 },
      { x: 3.5, y: -0.5 },
      { x: 3.5, y: 0.5 },
    ];

    test("縁のマスを1マスずつ移ること", () => {
      const { steps, cell } = traceFinger(points, 0);

      expect(steps.map(({ from, to }) => [from, to])).toEqual([
        [0, 1],
        [1, 2],
        [2, 3],
      ]);
      expect(cell).toBe(3);
    });
  });
});
