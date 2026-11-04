import { useCallback, useMemo, useState } from "react";

import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import type { HakoiriMusumeProblemIdentity } from "@/games/hakoiri-musume/problem/problem";
import type { HakoiriMusumePooledProblem } from "@/games/hakoiri-musume/problem/problem-pool";
import { selectHakoiriMusumeProblemForDifficulty } from "@/games/hakoiri-musume/problem-selection";
import type { HakoiriMusumePiece } from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumeDirection } from "@/games/hakoiri-musume/puzzle/rules";
import {
  calculateHakoiriMusumeMoveDelta,
  calculateHakoiriMusumePlayScore,
  calculateHakoiriMusumeSpeedScoreRule,
  type HakoiriMusumePlayScore,
} from "@/games/hakoiri-musume/score";
import {
  canRestartHakoiriMusumeSession,
  canUndoHakoiriMusumeSession,
  createHakoiriMusumeSession,
  getHakoiriMusumeSessionResult,
  type HakoiriMusumeSession,
  type HakoiriMusumeSessionResult,
  moveHakoiriMusumeSessionPiece,
  restartHakoiriMusumeSession,
  undoHakoiriMusumeSession,
} from "@/games/hakoiri-musume/session/session";
import {
  applyPlaySession,
  completePlayClearAnimation,
  type GamePlay,
  type GameProgress,
  type RestartableGamePlay,
  startPlaySession,
  type UndoableGamePlay,
  useSessionElapsedMs,
} from "@/games/play";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import { calculateTimeDeltaMs, type SpeedScoreRule } from "@/games/score";

export type HakoiriMusumeResult = HakoiriMusumeSessionResult & {
  optimalMoveCount: number;
  moveDelta: number;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: HakoiriMusumePlayScore;
};

/** 完了したプレイの事実と問題の最短手数から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createHakoiriMusumeResult(
  sessionResult: HakoiriMusumeSessionResult,
  optimalMoveCount: number,
): HakoiriMusumeResult {
  const speedRule = calculateHakoiriMusumeSpeedScoreRule({ optimalMoveCount });

  return {
    ...sessionResult,
    optimalMoveCount,
    moveDelta: calculateHakoiriMusumeMoveDelta({
      moveCount: sessionResult.moveCount,
      optimalMoveCount,
    }),
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateHakoiriMusumePlayScore({
      elapsedMs: sessionResult.elapsedMs,
      moveCount: sessionResult.moveCount,
      optimalMoveCount,
    }),
  };
}

export type HakoiriMusumePlay = GamePlay<
  HakoiriMusumeDifficulty,
  HakoiriMusumeProblemIdentity,
  HakoiriMusumeSession,
  HakoiriMusumeResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    /** 今の駒の並び。何番目の駒かは問題の駒の順のまま変わらない。 */
    pieces: readonly HakoiriMusumePiece[];
    moveCount: number;
    undoCount: number;
    restartCount: number;
    optimalMoveCount: number;
    /** 駒を1マス動かす。動けない向きなら何もしない。 */
    movePiece: (pieceIndex: number, direction: HakoiriMusumeDirection) => void;
  };

type HakoiriMusumePlayState = {
  session: HakoiriMusumeSession;
  problemIdentity: HakoiriMusumeProblemIdentity;
  optimalMoveCount: number;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity, optimalMoveCount }: HakoiriMusumePooledProblem,
  startedAt: number,
): HakoiriMusumePlayState {
  return {
    session: createHakoiriMusumeSession(problem, startedAt),
    problemIdentity: identity,
    optimalMoveCount,
    progress: "playing",
  };
}

function selectProblem(
  difficulty: HakoiriMusumeDifficulty,
  avoidedProblemId: ProblemId | undefined,
): HakoiriMusumePooledProblem {
  return selectProblemAvoiding(
    (seed) => selectHakoiriMusumeProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

function moveInPlay(
  current: HakoiriMusumePlayState,
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
  movedAt: number,
): HakoiriMusumePlayState {
  if (current.progress !== "playing") {
    return current;
  }
  const step = moveHakoiriMusumeSessionPiece(
    current.session,
    pieceIndex,
    direction,
    movedAt,
  );
  return step.outcome === "moved"
    ? applyPlaySession(current, step.session)
    : current;
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useHakoiriMusumePlay(
  difficulty: HakoiriMusumeDifficulty,
  initialProblem?: HakoiriMusumePooledProblem,
  avoidedProblemId?: ProblemId,
): HakoiriMusumePlay {
  const [play, setPlay] = useState<HakoiriMusumePlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, problemIdentity, optimalMoveCount } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const movePiece = useCallback(
    (pieceIndex: number, direction: HakoiriMusumeDirection) => {
      const movedAt = Date.now();
      setPlay((current) => moveInPlay(current, pieceIndex, direction, movedAt));
    },
    [],
  );

  const undo = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, undoHakoiriMusumeSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, restartHakoiriMusumeSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createHakoiriMusumeSession(current.session.problem, startedAt),
      ),
    );
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const completeClearAnimation = useCallback(() => {
    setPlay(completePlayClearAnimation);
  }, []);

  const result = useMemo(() => {
    const sessionResult = getHakoiriMusumeSessionResult(session);
    return sessionResult
      ? createHakoiriMusumeResult(sessionResult, optimalMoveCount)
      : null;
  }, [optimalMoveCount, session]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    pieces: session.puzzleState.pieces,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount,
    canUndo: canUndoHakoiriMusumeSession(session),
    canRestart: canRestartHakoiriMusumeSession(session),
    movePiece,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
