import {
  createReflectionPlayAttempt,
  createReflectionPlayAttemptProgress,
} from "@/games/reflection/play-attempt";
import { createReflectionPlayRecord } from "@/games/reflection/play-record";
import {
  createReflectionProblemIdentity,
  type ReflectionProblem,
} from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import { createReflectionSession } from "@/games/reflection/session/session";
import { getPlayAttemptStatus } from "@/records/play-attempt";

const problemIdentity = createReflectionProblemIdentity(6, 11, 3);

const attempt = createReflectionPlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const solution = parseReflectionBoard(["/..", "...", "..@"]);
const problem: ReflectionProblem = {
  size: solution.size,
  inventory: countReflectionBoardPieces(solution),
  clues: computeReflectionClues(solution),
  solution,
};
const session = {
  ...createReflectionSession(problem, 1_000),
  relocationCount: 2,
  restartCount: 1,
  laserCheckCount: 4,
  inputCount: 9,
};

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "reflection:1000",
    gameId: "reflection",
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
  const record = createReflectionPlayRecord({
    difficulty: "3",
    problemIdentity,
    startedAt: 1_000,
    completedAt: 200_000,
    workload: {
      pieceCount: 11,
      clueCount: 24,
      propagationRoundCount: 15,
      assumptionTestCount: 8,
      trialMoveCount: null,
    },
    result: {
      elapsedMs: 119_000,
      relocationCount: 2,
      restartCount: 0,
      laserCheckCount: 12,
      inputCount: 30,
    },
  });

  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createReflectionPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    relocationCount: 2,
    restartCount: 1,
    laserCheckCount: 4,
    inputCount: 9,
  });
});
