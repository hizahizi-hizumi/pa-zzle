import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProblemId } from "@/games/problem-id";
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
  createSlidePuzzleSession,
  getSlidePuzzleSessionElapsedMs,
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

export type SlidePuzzleProgress = "playing" | "clearing" | "result";

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

type SlidePuzzlePlayState = {
  session: SlidePuzzleSession;
  problemIdentity: SlidePuzzleProblemIdentity;
  optimalMoveCount: number;
  progress: SlidePuzzleProgress;
  operation: SlidePuzzleOperation | null;
};

function createPlayState(
  difficulty: SlidePuzzleDifficulty,
  startedAt: number,
  initialProblem?: SlidePuzzlePooledProblem,
  avoidedProblemId?: ProblemId,
): SlidePuzzlePlayState {
  const generatedProblem =
    initialProblem ??
    selectProblemAvoiding(
      (seed) => selectSlidePuzzleProblemForDifficulty(difficulty, seed),
      avoidedProblemId,
    ).problem;

  return {
    session: createSlidePuzzleSession(generatedProblem.problem, startedAt),
    problemIdentity: generatedProblem.identity,
    optimalMoveCount: generatedProblem.optimalMoveCount,
    progress: "playing",
    operation: null,
  };
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
    : null;
  if (!slide || !nextSession) {
    return {
      ...current,
      operation: { id: operationId, type: "invalid", tileIndex },
    };
  }

  const cleared = nextSession.status === "cleared";
  return {
    ...current,
    session: nextSession,
    progress: cleared ? "clearing" : "playing",
    operation: {
      id: operationId,
      type: "slid",
      slide,
      boardBefore: session.board,
      boardAfter: nextSession.board,
      isClearingMove: cleared,
    },
  };
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useSlidePuzzlePlay(
  difficulty: SlidePuzzleDifficulty,
  initialProblem?: SlidePuzzlePooledProblem,
  avoidedProblemId?: ProblemId,
) {
  const [play, setPlay] = useState<SlidePuzzlePlayState>(() =>
    createPlayState(difficulty, Date.now(), initialProblem, avoidedProblemId),
  );
  const [now, setNow] = useState(() => Date.now());
  const nextOperationId = useRef(0);

  useEffect(() => {
    if (play.session.status !== "playing") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [play.session.status]);

  const slideTile = useCallback((tileIndex: number) => {
    const movedAt = Date.now();
    const operationId = nextOperationId.current++;
    setNow(movedAt);
    setPlay((current) =>
      slideTileInPlay(
        current,
        tileIndex,
        getSlidePuzzleSlide(current.session.board, tileIndex),
        movedAt,
        operationId,
      ),
    );
  }, []);

  const slideByKeyboard = useCallback((direction: SlidePuzzleDirection) => {
    const movedAt = Date.now();
    const operationId = nextOperationId.current++;
    setNow(movedAt);
    setPlay((current) => {
      const slide = getSlidePuzzleKeyboardSlide(
        current.session.board,
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
    setNow(Date.now());
    setPlay((current) =>
      current.session.status === "playing"
        ? {
            ...current,
            session: restartSlidePuzzleSession(current.session),
            operation: null,
          }
        : current,
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: createSlidePuzzleSession(current.session.problem, startedAt),
      progress: "playing",
      operation: null,
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    const next = createPlayState(difficulty, startedAt);
    setNow(startedAt);
    setPlay(next);
  }, [difficulty]);

  const completeClearing = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result", operation: null }
        : current,
    );
  }, []);

  const { session } = play;
  const sessionResult = useMemo(
    () => getSlidePuzzleSessionResult(session, now),
    [now, session],
  );
  const optimalMoveCount = play.optimalMoveCount;
  const boardSize = play.problemIdentity.conditions.size;
  const result = useMemo<SlidePuzzleResult | null>(
    () =>
      sessionResult
        ? createSlidePuzzleResult(sessionResult, boardSize, optimalMoveCount)
        : null,
    [boardSize, optimalMoveCount, sessionResult],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    status: session.status,
    progress: play.progress,
    board: session.board,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    session,
    elapsedMs: getSlidePuzzleSessionElapsedMs(session, now),
    moveCount: session.moveCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    operation: play.operation,
    result,
    slideTile,
    slideByKeyboard,
    restart,
    replay,
    startNewProblem,
    completeClearing,
  };
}
