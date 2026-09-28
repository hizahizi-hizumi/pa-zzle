import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import {
  canRestartReflectionSession,
  canUndoReflectionSession,
  createReflectionSession,
  getReflectionSessionElapsedMs,
  getReflectionSessionResult,
  getReflectionSessionStock,
  type ReflectionSession,
  replayReflectionSession,
  restartReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionStock,
  undoReflectionSession,
} from "@/games/reflection/session/session";

const elapsedTimeTickMs = 1_000;

/** 遊んでいる問題の出どころ。`given` は開始時に identity で指定された問題。 */
export type ReflectionProblemSource = "selected" | "given";

type ReflectionPlayState = {
  session: ReflectionSession;
  problemIdentity: ReflectionProblemIdentity;
  problemSource: ReflectionProblemSource;
};

function createPlayState(
  difficulty: ReflectionDifficulty,
  seed: ProblemSeed,
  startedAt: number,
  initialProblemIdentity?: ReflectionProblemIdentity,
): ReflectionPlayState {
  const generated = initialProblemIdentity
    ? generateReflectionProblem(initialProblemIdentity)
    : selectReflectionProblemForDifficulty(difficulty, seed);

  return {
    session: createReflectionSession(generated.problem, startedAt),
    problemIdentity: generated.identity,
    problemSource: initialProblemIdentity ? "given" : "selected",
  };
}

/**
 * 難易度のプレイを始める。`initialProblemIdentity` を渡すと、最初の1問だけその問題を出す。
 * `undo` は直前の盤面操作を1つ取り消し（待った）、`restart` は同じプレイのまま全ピースをストックへ戻し（盤面を戻す）、
 * `replay` は同じ問題を新しいプレイとして始め（やり直す）、`startNewProblem` は同じ難易度の別の問題を始める。
 */
export function useReflectionPlay(
  difficulty: ReflectionDifficulty,
  initialProblemIdentity?: ReflectionProblemIdentity,
) {
  const [play, setPlay] = useState<ReflectionPlayState>(() =>
    createPlayState(
      difficulty,
      createProblemSeed(),
      Date.now(),
      initialProblemIdentity,
    ),
  );
  const [now, setNow] = useState(() => Date.now());
  const { session } = play;

  useEffect(() => {
    if (session.status !== "playing") return;

    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      elapsedTimeTickMs,
    );

    return () => window.clearInterval(timer);
  }, [session.status]);

  const updateSession = useCallback(
    (update: (current: ReflectionSession) => ReflectionSession) => {
      setPlay((current) => {
        const next = update(current.session);
        return next === current.session
          ? current
          : { ...current, session: next };
      });
    },
    [],
  );

  const tapStock = useCallback(
    (piece: ReflectionPiece) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      updateSession((current) =>
        tapReflectionSessionStock(current, piece, operatedAt),
      );
    },
    [updateSession],
  );

  const tapCell = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      updateSession((current) =>
        tapReflectionSessionCell(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const undo = useCallback(() => {
    updateSession(undoReflectionSession);
  }, [updateSession]);

  const restart = useCallback(() => {
    updateSession(restartReflectionSession);
  }, [updateSession]);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    updateSession((current) => replayReflectionSession(current, startedAt));
  }, [updateSession]);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(createPlayState(difficulty, createProblemSeed(), startedAt));
  }, [difficulty]);

  const stock = useMemo(() => getReflectionSessionStock(session), [session]);

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    problemSource: play.problemSource,
    status: session.status,
    board: session.board,
    clues: session.problem.clues,
    inventory: session.problem.inventory,
    stock,
    selection: session.selection,
    elapsedMs: getReflectionSessionElapsedMs(session, now),
    canUndo: canUndoReflectionSession(session),
    canRestart: canRestartReflectionSession(session),
    sessionResult: getReflectionSessionResult(session),
    tapStock,
    tapCell,
    undo,
    restart,
    replay,
    startNewProblem,
  };
}
