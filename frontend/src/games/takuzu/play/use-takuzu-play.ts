import { useCallback, useEffect, useMemo, useState } from "react";

import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  canUndoTakuzuSession,
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionElapsedMs,
  getTakuzuSessionResult,
  replayTakuzuSession,
  restartTakuzuSession,
  undoTakuzuSession,
} from "@/games/takuzu/session/session";

const elapsedTimeTickMs = 1_000;

/**
 * 難易度のプレイを始める。
 * 問題集から出題できるようになるまでは、どの難易度でも固定問題を出題する。
 * `undo` は直前の盤面操作を1つ取り消し（待った）、`restart` は同じプレイのまま盤面を戻し、`replay` は同じ問題を新しいプレイとして始める（リセット）。
 */
export function useTakuzuPlay(difficulty: TakuzuDifficulty) {
  const [session, setSession] = useState(() =>
    createTakuzuSession(takuzuFixedProblem, Date.now()),
  );
  const [now, setNow] = useState(() => Date.now());

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
      setSession((current) =>
        cycleTakuzuSessionCell(current, cellIndex, direction, operatedAt),
      );
    },
    [],
  );

  const undo = useCallback(() => {
    setSession(undoTakuzuSession);
  }, []);

  const restart = useCallback(() => {
    setSession(restartTakuzuSession);
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setSession((current) => replayTakuzuSession(current, startedAt));
  }, []);

  const cells = useMemo(() => getTakuzuSessionCellViews(session), [session]);

  return {
    difficulty,
    size: session.board.size,
    cells,
    status: session.status,
    undoCount: session.undoCount,
    canUndo: canUndoTakuzuSession(session),
    elapsedMs: getTakuzuSessionElapsedMs(session, now),
    sessionResult: getTakuzuSessionResult(session),
    cycleCell,
    undo,
    restart,
    replay,
  };
}
