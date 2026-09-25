import { useCallback, useEffect, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type {
  TakuzuIdentifiedProblem,
  TakuzuProblemIdentity,
} from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";
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
  seed: ProblemSeed;
  problemIdentity: TakuzuProblemIdentity;
  session: TakuzuSession;
  progress: TakuzuProgress;
};

const elapsedTimeTickMs = 1_000;

// 問題集が小さい場合でも「別の問題」で同じ問題に戻らないよう、選び直す回数の上限。
const maximumNewProblemSelectionAttempts = 8;

function createPlayState(
  seed: ProblemSeed,
  { problem, identity }: TakuzuIdentifiedProblem,
  startedAt: number,
): TakuzuPlayState {
  return {
    seed,
    problemIdentity: identity,
    session: createTakuzuSession(problem, startedAt),
    progress: "playing",
  };
}

function startTakuzuPlay(
  difficulty: TakuzuDifficulty,
  startedAt: number,
): TakuzuPlayState {
  const seed = createProblemSeed();
  return createPlayState(
    seed,
    selectTakuzuProblemForDifficulty(difficulty, seed),
    startedAt,
  );
}

function startNewTakuzuProblem(
  difficulty: TakuzuDifficulty,
  currentProblemIdentity: TakuzuProblemIdentity,
  startedAt: number,
): TakuzuPlayState {
  let seed = createProblemSeed();
  let selected = selectTakuzuProblemForDifficulty(difficulty, seed);
  for (
    let attempt = 1;
    attempt < maximumNewProblemSelectionAttempts &&
    selected.identity.seed === currentProblemIdentity.seed;
    attempt += 1
  ) {
    seed = createProblemSeed();
    selected = selectTakuzuProblemForDifficulty(difficulty, seed);
  }
  return createPlayState(seed, selected, startedAt);
}

function applySessionInput(
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
 * 難易度の問題集から seed で選んだ問題を遊ぶ。
 * リセットは同じ問題を始めから、別の問題は新しい seed で選び直す。
 */
export function useTakuzuPlay(difficulty: TakuzuDifficulty) {
  const [play, setPlay] = useState(() =>
    startTakuzuPlay(difficulty, Date.now()),
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
      ...current,
      session: createTakuzuSession(current.session.problem, startedAt),
      progress: "playing",
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) =>
      startNewTakuzuProblem(difficulty, current.problemIdentity, startedAt),
    );
  }, [difficulty]);

  const completeClearing = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  return {
    difficulty,
    seed: play.seed,
    problemIdentity: play.problemIdentity,
    size: session.board.size,
    cells: getTakuzuSessionCellViews(session),
    progress,
    elapsedMs: getTakuzuSessionElapsedMs(session, now),
    sessionResult: getTakuzuSessionResult(session),
    cycleCell,
    placeCell,
    restart,
    replay,
    startNewProblem,
    completeClearing,
  };
}
