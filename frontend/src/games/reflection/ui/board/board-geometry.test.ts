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

  test("入った外周・曲がるマスの中心・出た外周を結ぶこと", () => {
    const points = getReflectionLaserPoints(board.size, entry, trace);

    expect(points).toEqual([
      { x: 0.8, y: 2.5 },
      { x: 2.5, y: 2.5 },
      { x: 2.5, y: 0.8 },
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
