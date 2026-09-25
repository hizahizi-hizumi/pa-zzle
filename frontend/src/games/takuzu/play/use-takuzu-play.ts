import { useCallback, useEffect, useState } from "react";

import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionElapsedMs,
  getTakuzuSessionResult,
  restartTakuzuSession,
} from "@/games/takuzu/session/session";

const elapsedTimeTickMs = 1_000;

/**
 * 難易度のプレイを始める。
 * 問題集から出題できるようになるまでは、どの難易度でも固定問題を出題する。
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

  const restart = useCallback(() => {
    setSession(restartTakuzuSession);
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setSession((current) => createTakuzuSession(current.problem, startedAt));
  }, []);

  return {
    difficulty,
    size: session.board.size,
    cells: getTakuzuSessionCellViews(session),
    status: session.status,
    elapsedMs: getTakuzuSessionElapsedMs(session, now),
    sessionResult: getTakuzuSessionResult(session),
    cycleCell,
    restart,
    replay,
  };
}
