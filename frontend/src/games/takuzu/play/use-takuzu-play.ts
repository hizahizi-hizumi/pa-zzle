import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed } from "@/games/problem-seed";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type {
  TakuzuIdentifiedProblem,
  TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  canUndoTakuzuSession,
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionCorrectionCount,
  getTakuzuSessionElapsedMs,
  getTakuzuSessionLineViolations,
  getTakuzuSessionResult,
  placeTakuzuSessionCell,
  replayTakuzuSession,
  restartTakuzuSession,
  type TakuzuSession,
  undoTakuzuSession,
} from "@/games/takuzu/session/session";

/**
 * 画面の進行。`clearing` は盤面が完成してから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type TakuzuProgress = "playing" | "clearing" | "result";

type TakuzuPlayState = {
  problemIdentity: TakuzuProblemIdentity;
  session: TakuzuSession;
  progress: TakuzuProgress;
};

const elapsedTimeTickMs = 1_000;

// 問題集が小さい場合でも「別の問題」で同じ問題に戻らないよう、選び直す回数の上限。
const maximumNewProblemSelectionAttempts = 8;

function createPlayState(
  { problem, identity }: TakuzuIdentifiedProblem,
  startedAt: number,
): TakuzuPlayState {
  return {
    problemIdentity: identity,
    session: createTakuzuSession(problem, startedAt),
    progress: "playing",
  };
}

function createInitialPlayState(
  difficulty: TakuzuDifficulty,
  startedAt: number,
): TakuzuPlayState {
  return createPlayState(
    selectTakuzuProblemForDifficulty(difficulty, createProblemSeed()),
    startedAt,
  );
}

function createNewProblemPlayState(
  difficulty: TakuzuDifficulty,
  currentProblemIdentity: TakuzuProblemIdentity,
  startedAt: number,
): TakuzuPlayState {
  let selected = selectTakuzuProblemForDifficulty(
    difficulty,
    createProblemSeed(),
  );
  for (
    let attempt = 1;
    attempt < maximumNewProblemSelectionAttempts &&
    selected.identity.seed === currentProblemIdentity.seed;
    attempt += 1
  ) {
    selected = selectTakuzuProblemForDifficulty(
      difficulty,
      createProblemSeed(),
    );
  }
  return createPlayState(selected, startedAt);
}

function applySession(
  current: TakuzuPlayState,
  session: TakuzuSession,
): TakuzuPlayState {
  if (session === current.session) {
    return current;
  }

  return {
    ...current,
    session,
    progress: session.status === "cleared" ? "clearing" : current.progress,
  };
}

/**
 * 難易度の問題集から選んだ問題を遊ぶ。
 * `undo` は直前の盤面操作を1つ取り消し（待った）、`restart` は同じプレイのまま盤面を戻し、`replay` は同じ問題を新しいプレイとして始める（リセット）。
 * `startNewProblem` は問題集から別の問題を選び直す。
 */
export function useTakuzuPlay(difficulty: TakuzuDifficulty) {
  const [play, setPlay] = useState(() =>
    createInitialPlayState(difficulty, Date.now()),
  );
  const [now, setNow] = useState(() => Date.now());
  const { session, progress } = play;

  useEffect(() => {
    if (session.status !== "playing") {
      return;
    }

    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      elapsedTimeTickMs,
    );

    return () => window.clearInterval(timer);
  }, [session.status]);

  const cycleCell = useCallback(
    (cellIndex: number, direction: TakuzuCycleDirection) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
      setPlay((current) =>
        applySession(
          current,
          cycleTakuzuSessionCell(
            current.session,
            cellIndex,
            direction,
            operatedAt,
          ),
        ),
      );
    },
    [],
  );

  const placeCell = useCallback((cellIndex: number, cell: TakuzuCell) => {
    const operatedAt = Date.now();
    setNow(operatedAt);
    setPlay((current) =>
      applySession(
        current,
        placeTakuzuSessionCell(current.session, cellIndex, cell, operatedAt),
      ),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      applySession(current, undoTakuzuSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applySession(current, restartTakuzuSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: replayTakuzuSession(current.session, startedAt),
      progress: "playing",
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) =>
      createNewProblemPlayState(difficulty, current.problemIdentity, startedAt),
    );
  }, [difficulty]);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const cells = useMemo(() => getTakuzuSessionCellViews(session), [session]);
  const lineViolations = useMemo(
    () => getTakuzuSessionLineViolations(session),
    [session],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    size: session.board.size,
    cells,
    lineViolations,
    progress,
    correctionCount: getTakuzuSessionCorrectionCount(session),
    undoCount: session.undoCount,
    canUndo: canUndoTakuzuSession(session),
    elapsedMs: getTakuzuSessionElapsedMs(session, now),
    sessionResult: getTakuzuSessionResult(session),
    cycleCell,
    placeCell,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
