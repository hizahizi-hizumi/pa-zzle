import {
  createNanpurePlayAttempt,
  createNanpurePlayAttemptProgress,
} from "@/games/nanpure/play-attempt";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import {
  createNanpureProblemIdentity,
  type NanpureProblem,
} from "@/games/nanpure/problem/problem";
import type { NanpureCell } from "@/games/nanpure/puzzle/board";
import { createNanpureSession } from "@/games/nanpure/session/session";
import { getPlayAttemptStatus } from "@/records/play-attempt";

const problemIdentity = createNanpureProblemIdentity("locked-candidates", 740);

const attempt = createNanpurePlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const solution = [
  "534678912",
  "672195348",
  "198342567",
  "859761423",
  "426853791",
  "713924856",
  "961537284",
  "287419635",
  "345286179",
].flatMap((row) => [...row].map((cell) => Number(cell) as NanpureCell));
const problem: NanpureProblem = {
  clues: solution.map((cell, cellIndex) => (cellIndex < 2 ? null : cell)),
  solution: solution as NanpureProblem["solution"],
};
const session = {
  ...createNanpureSession(problem, 1_000),
  mistakeCount: 1,
  undoCount: 3,
  restartCount: 2,
};

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "nanpure:1000",
    gameId: "nanpure",
    startedAt: 1_000,
    payloadVersion: 1,
    start: {
      difficulty: "3",
      problemIdentity,
    },
    abandonment: null,
  });
  expect(attempt.start.problemIdentity).not.toBe(problemIdentity);
});

test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
  const record = createNanpurePlayRecord({
    difficulty: "3",
    problemIdentity,
    startedAt: 1_000,
    completedAt: 200_000,
    result: {
      elapsedMs: 120_000,
      mistakeCount: 1,
      undoCount: 2,
      restartCount: 0,
    },
  });

  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createNanpurePlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    mistakeCount: 1,
    undoCount: 3,
    restartCount: 2,
  });
});
