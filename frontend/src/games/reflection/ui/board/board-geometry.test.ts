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

  test("入った外周の端・曲がるマスの中心・出た外周の端を結び、端は外周ヒントの縁から盤面との隙間へ寄せること", () => {
    const points = getReflectionLaserPoints(board.size, entry, trace);

    expect(
      points.map(({ x, y }) => ({
        x: Number(x.toFixed(6)),
        y: Number(y.toFixed(6)),
      })),
    ).toEqual([
      { x: 0.85, y: 2.5 },
      { x: 2.5, y: 2.5 },
      { x: 2.5, y: 0.85 },
    ]);
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
