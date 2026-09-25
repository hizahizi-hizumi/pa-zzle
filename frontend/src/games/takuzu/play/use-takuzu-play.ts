import { useCallback, useEffect, useState } from "react";

import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import {
  createTakuzuSession,
  cycleTakuzuSessionCell,
  getTakuzuSessionCellViews,
  getTakuzuSessionElapsedMs,
  getTakuzuSessionResult,
  placeTakuzuSessionCell,
  restartTakuzuSession,
  type TakuzuSession,
} from "@/games/takuzu/session/session";

/**
 * 画面の進行。`clearing` は盤面が完成してから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type TakuzuProgress = "playing" | "clearing" | "result";

type TakuzuPlayState = {
  session: TakuzuSession;
  progress: TakuzuProgress;
};

const elapsedTimeTickMs = 1_000;

function startTakuzuPlay(startedAt: number): TakuzuPlayState {
  return {
    session: createTakuzuSession(takuzuFixedProblem, startedAt),
    progress: "playing",
  };
}

function applySessionInput(
  current: TakuzuPlayState,
  session: TakuzuSession,
): TakuzuPlayState {
  if (session === current.session) {
    return current;
  }

  return {
    session,
    progress: session.status === "cleared" ? "clearing" : current.progress,
  };
}

/**
 * 難易度のプレイを始める。
 * 問題集から出題できるようになるまでは、どの難易度でも固定問題を出題する。
 */
export function useTakuzuPlay(difficulty: TakuzuDifficulty) {
  const [play, setPlay] = useState(() => startTakuzuPlay(Date.now()));
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
        applySessionInput(
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
      applySessionInput(
        current,
        placeTakuzuSessionCell(current.session, cellIndex, cell, operatedAt),
      ),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applySessionInput(current, restartTakuzuSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      session: createTakuzuSession(current.session.problem, startedAt),
      progress: "playing",
    }));
  }, []);

  const completeClearing = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  return {
    difficulty,
    size: session.board.size,
    cells: getTakuzuSessionCellViews(session),
    progress,
    elapsedMs: getTakuzuSessionElapsedMs(session, now),
    sessionResult: getTakuzuSessionResult(session),
    cycleCell,
    placeCell,
    restart,
    replay,
    completeClearing,
  };
}
