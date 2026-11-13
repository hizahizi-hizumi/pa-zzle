import { useCallback, useMemo, useRef, useState } from "react";

import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import type { HakoiriMusumeProblemIdentity } from "@/games/hakoiri-musume/problem/problem";
import type {
  HakoiriMusumePooledProblem,
  HakoiriMusumeWorkload,
} from "@/games/hakoiri-musume/problem/problem-pool";
import { selectHakoiriMusumeProblemForDifficulty } from "@/games/hakoiri-musume/problem-selection";
import type {
  HakoiriMusumeLayout,
  HakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/board";
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

/**
 * 完了したプレイの事実。`completionMoveCount` は、それを残す前の記録から作り直した結果では `null`。
 */
type HakoiriMusumeCompletedPlay = Omit<
  HakoiriMusumeSessionResult,
  "completionMoveCount"
> & { completionMoveCount: number | null };

export type HakoiriMusumeResult = HakoiriMusumeCompletedPlay &
  HakoiriMusumeWorkload & {
    moveDelta: number;
    speedRule: SpeedScoreRule;
    timeDeltaMs: number;
    score: HakoiriMusumePlayScore;
  };

/** プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createHakoiriMusumeResult(
  sessionResult: HakoiriMusumeCompletedPlay,
  workload: HakoiriMusumeWorkload,
): HakoiriMusumeResult {
  const { optimalMoveCount } = workload;
  const speedRule = calculateHakoiriMusumeSpeedScoreRule(workload);

  return {
    ...sessionResult,
    ...workload,
    moveDelta: calculateHakoiriMusumeMoveDelta({
      moveCount: sessionResult.moveCount,
      optimalMoveCount,
    }),
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateHakoiriMusumePlayScore({
      elapsedMs: sessionResult.elapsedMs,
      moveCount: sessionResult.moveCount,
      ...workload,
    }),
  };
}

/**
 * 駒が新しいマスへ移った知らせ。なぞりの途中でも、駒が移るたびに出す。`id` は移るたびに変わる。`target` は動いた駒の
 * `HakoiriMusumePiece.target`。
 * 1回の入力で続けて移ったときは1つにまとめ、`from` は移る前、`to` は移り終えたマス、`cellCount` は移ったマスの数にする。
 * 動けない向きの入力では変わらず、待った・盤面を戻す・リセット・別の問題で消える。
 */
export type HakoiriMusumeStepNotice = {
  id: number;
  pieceIndex: number;
  target: number | null;
  from: number;
  to: number;
  cellCount: number;
};

export type HakoiriMusumePlay = GamePlay<
  HakoiriMusumeDifficulty,
  HakoiriMusumeProblemIdentity,
  HakoiriMusumeSession,
  HakoiriMusumeResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    layout: HakoiriMusumeLayout;
    /** 何番目の駒かは問題の駒の順のまま変わらない。 */
    pieces: readonly HakoiriMusumePiece[];
    moveCount: number;
    undoCount: number;
    restartCount: number;
    optimalMoveCount: number;
    stepNotice: HakoiriMusumeStepNotice | null;
    /** 動けない向きに当たったら、そこで止める。 */
    movePiece: (
      pieceIndex: number,
      directions: readonly HakoiriMusumeDirection[],
    ) => void;
  };

type HakoiriMusumePlayState = {
  session: HakoiriMusumeSession;
  problemIdentity: HakoiriMusumeProblemIdentity;
  workload: HakoiriMusumeWorkload;
  progress: GameProgress;
  stepNotice: HakoiriMusumeStepNotice | null;
};

function createPlayState(
  { problem, identity, workload }: HakoiriMusumePooledProblem,
  startedAt: number,
): HakoiriMusumePlayState {
  return {
    session: createHakoiriMusumeSession(problem, startedAt),
    problemIdentity: identity,
    workload,
    progress: "playing",
    stepNotice: null,
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
  directions: readonly HakoiriMusumeDirection[],
  movedAt: number,
  noticeId: number,
): HakoiriMusumePlayState {
  let next = current;
  const cells: number[] = [];
  for (const direction of directions) {
    if (next.progress !== "playing") {
      break;
    }
    const step = moveHakoiriMusumeSessionPiece(
      next.session,
      pieceIndex,
      direction,
      movedAt,
    );
    if (step.outcome !== "moved") {
      break;
    }
    next = applyPlaySession(next, step.session);
    if (cells.length === 0) {
      cells.push(step.from);
    }
    cells.push(step.to);
  }
  if (cells.length === 0) {
    return current;
  }
  return {
    ...next,
    stepNotice: {
      id: noticeId,
      pieceIndex,
      target: next.session.puzzleState.pieces[pieceIndex]!.target,
      from: cells[0]!,
      to: cells.at(-1)!,
      cellCount: cells.length - 1,
    },
  };
}

/** 駒が移った知らせは消す。 */
function returnInPlay(
  current: HakoiriMusumePlayState,
  returned: HakoiriMusumeSession,
): HakoiriMusumePlayState {
  const next = applyPlaySession(current, returned);
  return next === current ? current : { ...next, stepNotice: null };
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
  const { session, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextNoticeId = useRef(0);

  const movePiece = useCallback(
    (pieceIndex: number, directions: readonly HakoiriMusumeDirection[]) => {
      const movedAt = Date.now();
      const noticeId = nextNoticeId.current++;
      setPlay((current) =>
        moveInPlay(current, pieceIndex, directions, movedAt, noticeId),
      );
    },
    [],
  );

  const undo = useCallback(() => {
    setPlay((current) =>
      returnInPlay(current, undoHakoiriMusumeSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      returnInPlay(current, restartHakoiriMusumeSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createHakoiriMusumeSession(current.session.problem, startedAt),
      ),
      stepNotice: null,
    }));
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
      ? createHakoiriMusumeResult(sessionResult, workload)
      : null;
  }, [workload, session]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress: play.progress,
    startedAt: session.startedAt,
    completedAt: session.clearedAt,
    elapsedMs,
    result,
    layout: session.problem.layout,
    pieces: session.puzzleState.pieces,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    restartCount: session.restartCount,
    optimalMoveCount: workload.optimalMoveCount,
    stepNotice: play.stepNotice,
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
