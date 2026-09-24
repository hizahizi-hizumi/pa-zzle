// @vitest-environment node

import type { FifteenPuzzleProblem } from "@/games/fifteen-puzzle/problem/problem";
import {
  createFifteenPuzzleSession,
  type FifteenPuzzleSession,
  getFifteenPuzzleSessionElapsedMs,
  getFifteenPuzzleSessionResult,
  restartFifteenPuzzleSession,
  slideFifteenPuzzleSessionTile,
} from "@/games/fifteen-puzzle/session/session";

// 最下段だけが 1 マスずつずれた盤面。右下のタイルをタップすると 3 枚まとめて滑って完成する。
const problem: FifteenPuzzleProblem = {
  initialBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15],
};
const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

function slideOrThrow(
  session: FifteenPuzzleSession,
  tileIndex: number,
  movedAt: number,
): FifteenPuzzleSession {
  const next = slideFifteenPuzzleSessionTile(session, tileIndex, movedAt);
  if (!next) {
    throw new Error("test slide must be legal");
  }
  return next;
}

describe("slideFifteenPuzzleSessionTile", () => {
  const session = createFifteenPuzzleSession(problem, 1_000);

  test("一括スライドで動いたタイルの枚数だけ手数を増やしスライド回数を 1 増やすこと", () => {
    const result = slideFifteenPuzzleSessionTile(session, 14, 1_100);

    expect(result?.board).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15,
    ]);
    expect(result?.moveCount).toBe(2);
    expect(result?.completionMoveCount).toBe(2);
    expect(result?.slideCount).toBe(1);
    expect(result?.status).toBe("playing");
  });

  test("最後の手で完成し終了時刻を決めること", () => {
    const result = slideFifteenPuzzleSessionTile(session, 15, 1_500);

    expect(result?.board).toEqual(solvedBoard);
    expect(result?.status).toBe("cleared");
    expect(result?.finishedAt).toBe(1_500);
  });

  test("空白と同じ行・列にないタイルでは null を返すこと", () => {
    const result = slideFifteenPuzzleSessionTile(session, 1, 1_100);

    expect(result).toBeNull();
  });

  describe("完成した場合", () => {
    const cleared = slideOrThrow(session, 15, 1_500);

    test("操作を受け付けないこと", () => {
      const result = slideFifteenPuzzleSessionTile(cleared, 14, 1_600);

      expect(result).toBeNull();
    });
  });
});

describe("restartFifteenPuzzleSession", () => {
  const moved = slideOrThrow(
    createFifteenPuzzleSession(problem, 1_000),
    13,
    1_100,
  );
  const cleared = slideOrThrow(
    createFifteenPuzzleSession(problem, 1_000),
    15,
    1_100,
  );

  test("初期盤面へ戻し総手数を残して完成時手数を 0 にすること", () => {
    const result = restartFifteenPuzzleSession(moved);

    expect(result.board).toEqual(problem.initialBoard);
    expect(result.moveCount).toBe(1);
    expect(result.completionMoveCount).toBe(0);
    expect(result.restartCount).toBe(1);
    expect(result.startedAt).toBe(1_000);
  });

  test("完成後のプレイを変更しないこと", () => {
    const result = restartFifteenPuzzleSession(cleared);

    expect(result).toBe(cleared);
  });
});

describe("getFifteenPuzzleSessionElapsedMs", () => {
  const playing = createFifteenPuzzleSession(problem, 1_000);
  const cleared = slideOrThrow(playing, 15, 4_000);
  const cases = [
    ["プレイ中は現在時刻まで", playing, 2_500],
    ["完成後は完成時刻まで", cleared, 3_000],
  ] as const;

  test.each(cases)("経過時間を返すこと: %s", (_, session, expected) => {
    const result = getFifteenPuzzleSessionElapsedMs(session, 3_500);

    expect(result).toBe(expected);
  });
});

describe("getFifteenPuzzleSessionResult", () => {
  const playing = createFifteenPuzzleSession(problem, 1_000);
  const cleared = slideOrThrow(
    restartFifteenPuzzleSession(slideOrThrow(playing, 13, 1_100)),
    15,
    4_000,
  );

  test("完成したプレイの事実を返すこと", () => {
    const result = getFifteenPuzzleSessionResult(cleared, 9_000);

    expect(result).toEqual({
      elapsedMs: 3_000,
      moveCount: 4,
      completionMoveCount: 3,
      slideCount: 2,
      restartCount: 1,
    });
  });

  test("完成していないプレイでは null を返すこと", () => {
    const result = getFifteenPuzzleSessionResult(playing, 9_000);

    expect(result).toBeNull();
  });
});
