import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  type RestartableGamePlay,
  startPlaySession,
  useSessionElapsedMs,
} from "@/games/play";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import type { SlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem/problem-pool";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import {
  getSlidePuzzleKeyboardSlide,
  getSlidePuzzleSlide,
  type SlidePuzzleDirection,
  type SlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import type {
  SlidePuzzleBoard,
  SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";
import {
  calculateSlidePuzzleMoveDelta,
  calculateSlidePuzzlePlayScore,
  calculateSlidePuzzleSpeedScoreRule,
  type SlidePuzzlePlayScore,
} from "@/games/slide-puzzle/score";
import {
  canRestartSlidePuzzleSession,
  createSlidePuzzleSession,
  getSlidePuzzleSessionResult,
  restartSlidePuzzleSession,
  type SlidePuzzleSession,
  type SlidePuzzleSessionResult,
  slideSlidePuzzleSessionTile,
} from "@/games/slide-puzzle/session/session";

export type SlidePuzzleOperation =
  | {
      id: number;
      type: "slid";
      slide: SlidePuzzleSlide;
      boardBefore: SlidePuzzleBoard;
      boardAfter: SlidePuzzleBoard;
      isClearingMove: boolean;
    }
  | { id: number; type: "invalid"; tileIndex: number };

export type SlidePuzzleResult = SlidePuzzleSessionResult & {
  boardSize: SlidePuzzleBoardSize;
  optimalMoveCount: number;
  moveDelta: number;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: SlidePuzzlePlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createSlidePuzzleResult(
  sessionResult: SlidePuzzleSessionResult,
  boardSize: SlidePuzzleBoardSize,
  optimalMoveCount: number,
): SlidePuzzleResult {
  const speedRule = calculateSlidePuzzleSpeedScoreRule({
    boardSize,
    optimalMoveCount,
  });

  return {
    ...sessionResult,
    boardSize,
    optimalMoveCount,
    moveDelta: calculateSlidePuzzleMoveDelta({
      moveCount: sessionResult.moveCount,
      optimalMoveCount,
    }),
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateSlidePuzzlePlayScore({
      elapsedMs: sessionResult.elapsedMs,
      moveCount: sessionResult.moveCount,
      boardSize,
      optimalMoveCount,
    }),
  };
}

export type SlidePuzzlePlay = GamePlay<
  SlidePuzzleDifficulty,
  SlidePuzzleProblemIdentity,
  SlidePuzzleSession,
  SlidePuzzleResult
> &
  RestartableGamePlay & {
    board: SlidePuzzleBoard;
    moveCount: number;
    restartCount: number;
    optimalMoveCount: number;
    operation: SlidePuzzleOperation | null;
    slideTile: (tileIndex: number) => void;
    slideInDirection: (direction: SlidePuzzleDirection) => void;
  };

type SlidePuzzlePlayState = {
  session: SlidePuzzleSession;
  problemIdentity: SlidePuzzleProblemIdentity;
  optimalMoveCount: number;
  progress: GameProgress;
  operation: SlidePuzzleOperation | null;
};

function createPlayState(
  { problem, identity, optimalMoveCount }: SlidePuzzlePooledProblem,
  startedAt: number,
): SlidePuzzlePlayState {
  return {
    session: createSlidePuzzleSession(problem, startedAt),
    problemIdentity: identity,
    optimalMoveCount,
    progress: "playing",
    operation: null,
  };
}

function selectProblem(
  difficulty: SlidePuzzleDifficulty,
  avoidedProblemId: ProblemId | undefined,
): SlidePuzzlePooledProblem {
  return selectProblemAvoiding(
    (seed) => selectSlidePuzzleProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

function slideTileInPlay(
  current: SlidePuzzlePlayState,
  tileIndex: number,
  slide: SlidePuzzleSlide | null,
  movedAt: number,
  operationId: number,
): SlidePuzzlePlayState {
  if (current.progress !== "playing") {
    return current;
  }

  const { session } = current;
  const nextSession = slide
    ? slideSlidePuzzleSessionTile(session, tileIndex, movedAt)
    : session;
  if (!slide || nextSession === session) {
    return {
      ...current,
      operation: { id: operationId, type: "invalid", tileIndex },
    };
  }

  return {
    ...applyPlaySession(current, nextSession),
    operation: {
      id: operationId,
      type: "slid",
      slide,
      boardBefore: session.puzzleState,
      boardAfter: nextSession.puzzleState,
      isClearingMove: nextSession.status === "cleared",
    },
  };
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useSlidePuzzlePlay(
  difficulty: SlidePuzzleDifficulty,
  initialProblem?: SlidePuzzlePooledProblem,
  avoidedProblemId?: ProblemId,
): SlidePuzzlePlay {
  const [play, setPlay] = useState<SlidePuzzlePlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity, optimalMoveCount } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const slideTile = useCallback((tileIndex: number) => {
    const movedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      slideTileInPlay(
        current,
        tileIndex,
        getSlidePuzzleSlide(current.session.puzzleState, tileIndex),
        movedAt,
        operationId,
      ),
    );
  }, []);

  const slideInDirection = useCallback((direction: SlidePuzzleDirection) => {
    const movedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) => {
      const slide = getSlidePuzzleKeyboardSlide(
        current.session.puzzleState,
        direction,
      );
      const tileIndex = slide?.movedTileIndices[0];
      if (!slide || tileIndex === undefined) {
        return current;
      }

      return slideTileInPlay(current, tileIndex, slide, movedAt, operationId);
    });
  }, []);

  const restart = useCallback(() => {
    setPlay((current) => {
      const next = applyPlaySession(
        current,
        restartSlidePuzzleSession(current.session),
      );
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createSlidePuzzleSession(current.session.problem, startedAt),
      ),
      operation: null,
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) => {
      const next = completePlayClearAnimation(current);
      return next === current ? current : { ...next, operation: null };
    });
  }, []);

  const boardSize = problemIdentity.conditions.size;
  const result = useMemo(() => {
    const sessionResult = getSlidePuzzleSessionResult(session);
    return sessionResult
      ? createSlidePuzzleResult(sessionResult, boardSize, optimalMoveCount)
      : null;
  }, [boardSize, optimalMoveCount, session]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    board: session.puzzleState,
    moveCount: session.moveCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    operation: play.operation,
    canRestart: canRestartSlidePuzzleSession(session),
    slideTile,
    slideInDirection,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
