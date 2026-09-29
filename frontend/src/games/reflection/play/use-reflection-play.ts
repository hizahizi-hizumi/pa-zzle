import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { ReflectionDifficulty } from "@/games/reflection/difficulty";
import { generateReflectionProblem } from "@/games/reflection/problem/generator";
import type { ReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import {
  type ReflectionEntry,
  type ReflectionLaserTrace,
  traceReflectionLaser,
} from "@/games/reflection/puzzle/laser";
import {
  canRestartReflectionSession,
  canUndoReflectionSession,
  clearReflectionSessionSelection,
  createReflectionSession,
  getReflectionSessionElapsedMs,
  getReflectionSessionResult,
  getReflectionSessionStock,
  type ReflectionSession,
  removeReflectionSessionPiece,
  replayReflectionSession,
  restartReflectionSession,
  tapReflectionSessionCell,
  tapReflectionSessionClue,
  tapReflectionSessionStock,
  undoReflectionSession,
} from "@/games/reflection/session/session";

const elapsedTimeTickMs = 1_000;

/** 表示中の光路。今の盤面で、外周の `entry` から入れた光がどう進むか。 */
export type ReflectionLaserView = {
  entry: ReflectionEntry;
  trace: ReflectionLaserTrace;
};

/** 遊んでいる問題の出どころ。`given` は開始時に identity で指定された問題。 */
export type ReflectionProblemSource = "selected" | "given";

/**
 * 画面の進行。`clearing` は盤面が揃ってから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type ReflectionProgress = "playing" | "clearing" | "result";

type ReflectionPlayState = {
  session: ReflectionSession;
  progress: ReflectionProgress;
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
    progress: "playing",
    problemIdentity: generated.identity,
    problemSource: initialProblemIdentity ? "given" : "selected",
  };
}

/**
 * 難易度のプレイを始める。`initialProblemIdentity` を渡すと、最初の1問だけその問題を出す。
 * `undo` は直前の盤面操作を1つ取り消し（待った）、`restart` は同じプレイのまま全ピースをストックへ戻し（盤面を戻す）、
 * `replay` は同じ問題を新しいプレイとして始め（やり直す）、`startNewProblem` は同じ難易度の別の問題を始める。
 * `tapClue` は外周ヒントの光路を表示し、盤面が揃うと `progress` が `clearing` になる。
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
  const { session, progress } = play;

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
        if (next === current.session) return current;

        return {
          ...current,
          session: next,
          progress: next.status === "cleared" ? "clearing" : current.progress,
        };
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

  const tapClue = useCallback(
    (entry: ReflectionEntry) => {
      updateSession((current) => tapReflectionSessionClue(current, entry));
    },
    [updateSession],
  );

  const removePiece = useCallback(
    (cellIndex: number) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      updateSession((current) =>
        removeReflectionSessionPiece(current, cellIndex, operatedAt),
      );
    },
    [updateSession],
  );

  const clearSelection = useCallback(() => {
    updateSession(clearReflectionSessionSelection);
  }, [updateSession]);

  const undo = useCallback(() => {
    updateSession(undoReflectionSession);
  }, [updateSession]);

  const restart = useCallback(() => {
    updateSession(restartReflectionSession);
  }, [updateSession]);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: replayReflectionSession(current.session, startedAt),
      progress: "playing",
    }));
  }, []);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(createPlayState(difficulty, createProblemSeed(), startedAt));
  }, [difficulty]);

  const stock = useMemo(() => getReflectionSessionStock(session), [session]);
  const laser = useMemo<ReflectionLaserView | null>(() => {
    const entry = session.laserEntry;
    return entry
      ? { entry, trace: traceReflectionLaser(session.board, entry) }
      : null;
  }, [session.laserEntry, session.board]);

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    problemSource: play.problemSource,
    status: session.status,
    progress,
    board: session.board,
    clues: session.problem.clues,
    inventory: session.problem.inventory,
    stock,
    selection: session.selection,
    laser,
    relocationCount: session.relocationCount,
    undoCount: session.undoCount,
    elapsedMs: getReflectionSessionElapsedMs(session, now),
    canUndo: canUndoReflectionSession(session),
    canRestart: canRestartReflectionSession(session),
    sessionResult: getReflectionSessionResult(session),
    tapStock,
    tapCell,
    tapClue,
    removePiece,
    clearSelection,
    undo,
    restart,
    replay,
    completeClearAnimation,
    startNewProblem,
  };
}
