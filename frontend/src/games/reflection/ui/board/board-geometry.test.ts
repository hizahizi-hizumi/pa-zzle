import { parseReflectionBoard } from "@/games/reflection/puzzle/board";
import { traceReflectionLaser } from "@/games/reflection/puzzle/laser";
import {
  getReflectionLaserPoints,
  listDistinctReflectionLaserTraces,
} from "@/games/reflection/ui/board/board-geometry";

// 3×3 の盤面の図は、外周ヒントの帯 0.8・隙間 0.2 を挟むので、盤面の左上の角が (1, 1) になる。
describe("getReflectionLaserPoints", () => {
  const board = parseReflectionBoard(["...", "./.", "..."]);
  const entry = { side: "left", index: 1 } as const;
  const trace = traceReflectionLaser(board, entry);

  test("入った端・曲がるマスの中心・出た端を結び、両端は盤面の縁から指定した分だけ内側に置くこと", () => {
    const points = getReflectionLaserPoints(board.size, entry, trace, {
      entry: 0.05,
      exit: 0.1,
    });

    expect(
      points.map(({ x, y }) => ({
        x: Number(x.toFixed(6)),
        y: Number(y.toFixed(6)),
      })),
    ).toEqual([
      { x: 1.05, y: 2.5 },
      { x: 2.5, y: 2.5 },
      { x: 2.5, y: 1.1 },
    ]);
  });
});

describe("getReflectionLaserPoints（反射）", () => {
  test("入った位置へ戻って出る光路は、両端とも出た端の位置に置くこと", () => {
    const board = parseReflectionBoard(["...", "..o", "..."]);
    const entry = { side: "left", index: 1 } as const;
    const trace = traceReflectionLaser(board, entry);

    const points = getReflectionLaserPoints(board.size, entry, trace, {
      entry: 0.05,
      exit: 0.1,
    });

    expect(points[0]).toEqual({ x: 1.1, y: 2.5 });
    expect(points.at(-1)).toEqual({ x: 1.1, y: 2.5 });
  });
});

describe("listDistinctReflectionLaserTraces", () => {
  const board = parseReflectionBoard(["...", "./.", "..@"]);

  test("別の位置へ出る光路を両端から1本ずつに数えないこと", () => {
    const traces = listDistinctReflectionLaserTraces(board);
    const leftMiddle = traces.filter(
      ({ entry }) =>
        (entry.side === "left" && entry.index === 1) ||
        (entry.side === "top" && entry.index === 1),
    );

    expect(leftMiddle).toHaveLength(1);
    expect(traces.length).toBeLessThan(12);
  });
});
