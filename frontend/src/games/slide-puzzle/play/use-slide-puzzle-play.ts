import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { SlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import type {
  SlidePuzzleGeneratedProblem,
  SlidePuzzleProblemIdentity,
} from "@/games/slide-puzzle/problem/problem";
import { selectSlidePuzzleProblemForDifficulty } from "@/games/slide-puzzle/problem-selection";
import {
  getSlidePuzzleKeyboardSlide,
  getSlidePuzzleSlide,
  type SlidePuzzleDirection,
  type SlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import {
  calculateSlidePuzzlePerformanceComparison,
  calculateSlidePuzzlePlayScore,
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
  optimalMoveCount: number;
  moveDelta: number;
  timeDeltaMs: number;
  speedFullScoreMs: number;
  score: SlidePuzzlePlayScore;
};

type SlidePuzzlePlayState = {
  session: SlidePuzzleSession;
  problemIdentity: SlidePuzzleProblemIdentity;
  optimalMoveCount: number;
  progress: SlidePuzzleProgress;
  operation: SlidePuzzleOperation | null;
};

function createPlayState(
  difficulty: SlidePuzzleDifficulty,
  seed: ProblemSeed,
  startedAt: number,
  initialProblem?: SlidePuzzleGeneratedProblem,
): SlidePuzzlePlayState {
  const generatedProblem =
    initialProblem ?? selectSlidePuzzleProblemForDifficulty(difficulty, seed);

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

/** `initialProblem` は、記録からの再プレイで最初に遊ぶ問題。 */
export function useSlidePuzzlePlay(
  difficulty: SlidePuzzleDifficulty,
  initialProblem?: SlidePuzzleGeneratedProblem,
) {
  const [play, setPlay] = useState<SlidePuzzlePlayState>(() =>
    createPlayState(
      difficulty,
      initialProblem?.identity.seed ?? createProblemSeed(),
      Date.now(),
      initialProblem,
    ),
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
    const next = createPlayState(difficulty, createProblemSeed(), startedAt);
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
  const result = useMemo<SlidePuzzleResult | null>(() => {
    if (!sessionResult) {
      return null;
    }

    const comparison = calculateSlidePuzzlePerformanceComparison({
      elapsedMs: sessionResult.elapsedMs,
      moveCount: sessionResult.moveCount,
      optimalMoveCount,
    });

    return {
      ...sessionResult,
      optimalMoveCount,
      moveDelta: comparison.moveDelta,
      timeDeltaMs: comparison.timeDeltaMs,
      speedFullScoreMs: comparison.speedFullScoreMs,
      score: calculateSlidePuzzlePlayScore({
        elapsedMs: sessionResult.elapsedMs,
        moveCount: sessionResult.moveCount,
        optimalMoveCount,
      }),
    };
  }, [optimalMoveCount, sessionResult]);

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    status: session.status,
    progress: play.progress,
    board: session.board,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
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
