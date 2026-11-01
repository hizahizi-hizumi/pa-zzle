import {
  listIceFloorMazePoolEntries,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";
import { findIceFloorMazePoolProblemFeatures } from "@/games/ice-floor-maze/problem-features";
import { createProblemId } from "@/games/problem-id";

describe("findIceFloorMazePoolProblemFeatures", () => {
  const entry = listIceFloorMazePoolEntries("5")[0]!;
  const { problem, identity } = restoreIceFloorMazePoolEntry(entry);
  const problemId = createProblemId(identity);

  test("問題集の1問の特徴を、盤面の行と列の数と、もろい岩と薄い氷の数で返すこと", () => {
    const features = findIceFloorMazePoolProblemFeatures("5", problemId);

    expect(features).toEqual({
      rows: problem.board.height,
      columns: problem.board.width,
      brittleRockCount: problem.board.cells.filter(
        (cell) => cell === "brittle-rock",
      ).length,
      thinIceCount: problem.board.cells.filter((cell) => cell === "thin-ice")
        .length,
    });
  });

  test("問題集に無い ID と、別の難易度の ID には null を返すこと", () => {
    const unknown = findIceFloorMazePoolProblemFeatures("5", "unknown");
    const otherDifficulty = findIceFloorMazePoolProblemFeatures("1", problemId);

    expect(unknown).toBeNull();
    expect(otherDifficulty).toBeNull();
  });
});
