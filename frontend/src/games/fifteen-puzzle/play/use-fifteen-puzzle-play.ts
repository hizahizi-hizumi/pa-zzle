import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FifteenPuzzleDifficulty } from "@/games/fifteen-puzzle/difficulty";
import { restoreFifteenPuzzleProblem } from "@/games/fifteen-puzzle/problem/generator";
import type {
  FifteenPuzzleGeneratedProblem,
  FifteenPuzzleProblemIdentity,
} from "@/games/fifteen-puzzle/problem/problem";
import { selectFifteenPuzzleProblemForDifficulty } from "@/games/fifteen-puzzle/problem-selection";
import {
  type FifteenPuzzleDirection,
  type FifteenPuzzleSlide,
  getFifteenPuzzleKeyboardSlide,
  getFifteenPuzzleSlide,
} from "@/games/fifteen-puzzle/puzzle/rules";
import type { FifteenPuzzleBoard } from "@/games/fifteen-puzzle/puzzle/state";
import {
  createFifteenPuzzleSession,
  type FifteenPuzzleSession,
  getFifteenPuzzleSessionElapsedMs,
  getFifteenPuzzleSessionResult,
  restartFifteenPuzzleSession,
  slideFifteenPuzzleSessionTile,
} from "@/games/fifteen-puzzle/session/session";
import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";

export type FifteenPuzzleOperation =
  | {
      id: number;
      type: "slid";
      slide: FifteenPuzzleSlide;
      boardBefore: FifteenPuzzleBoard;
      boardAfter: FifteenPuzzleBoard;
      isClearingMove: boolean;
    }
  | { id: number; type: "invalid"; tileIndex: number };

export type FifteenPuzzleProgress = "playing" | "clearing" | "result";

type FifteenPuzzlePlayState = {
  session: FifteenPuzzleSession;
  problemIdentity: FifteenPuzzleProblemIdentity;
  optimalMoveCount: number | null;
  progress: FifteenPuzzleProgress;
  operation: FifteenPuzzleOperation | null;
};

function createPlayState(
  difficulty: FifteenPuzzleDifficulty,
  seed: ProblemSeed,
  startedAt: number,
  initialProblemIdentity?: FifteenPuzzleProblemIdentity,
): FifteenPuzzlePlayState {
  const generatedProblem: FifteenPuzzleGeneratedProblem = initialProblemIdentity
    ? {
        ...restoreFifteenPuzzleProblem(initialProblemIdentity),
        optimalMoveCount: null,
      }
    : selectFifteenPuzzleProblemForDifficulty(difficulty, seed);

  return {
    session: createFifteenPuzzleSession(generatedProblem.problem, startedAt),
    problemIdentity: generatedProblem.identity,
    optimalMoveCount: generatedProblem.optimalMoveCount,
    progress: "playing",
    operation: null,
  };
}

function slideTileInPlay(
  current: FifteenPuzzlePlayState,
  tileIndex: number,
  slide: FifteenPuzzleSlide | null,
  movedAt: number,
  operationId: number,
): FifteenPuzzlePlayState {
  if (current.progress !== "playing") {
    return current;
  }

  const { session } = current;
  const nextSession = slide
    ? slideFifteenPuzzleSessionTile(session, tileIndex, movedAt)
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

export function useFifteenPuzzlePlay(
  difficulty: FifteenPuzzleDifficulty,
  initialProblemIdentity?: FifteenPuzzleProblemIdentity,
) {
  const [play, setPlay] = useState<FifteenPuzzlePlayState>(() =>
    createPlayState(
      difficulty,
      initialProblemIdentity?.seed ?? createProblemSeed(),
      Date.now(),
      initialProblemIdentity,
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
        getFifteenPuzzleSlide(current.session.board, tileIndex),
        movedAt,
        operationId,
      ),
    );
  }, []);

  const slideByKeyboard = useCallback((direction: FifteenPuzzleDirection) => {
    const movedAt = Date.now();
    const operationId = nextOperationId.current++;
    setNow(movedAt);
    setPlay((current) => {
      const slide = getFifteenPuzzleKeyboardSlide(
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
            session: restartFifteenPuzzleSession(current.session),
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
      session: createFifteenPuzzleSession(current.session.problem, startedAt),
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
    () => getFifteenPuzzleSessionResult(session, now),
    [now, session],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    status: session.status,
    progress: play.progress,
    board: session.board,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs: getFifteenPuzzleSessionElapsedMs(session, now),
    moveCount: session.moveCount,
    restartCount: session.restartCount,
    optimalMoveCount: play.optimalMoveCount,
    operation: play.operation,
    sessionResult,
    slideTile,
    slideByKeyboard,
    restart,
    replay,
    startNewProblem,
    completeClearing,
  };
}
