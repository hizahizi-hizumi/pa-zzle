import { useCallback, useMemo, useRef, useState } from "react";

import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import type {
  NonogramProblemIdentity,
  NonogramSolveWorkload,
} from "@/games/nonogram/problem/problem";
import type { NonogramPooledProblem } from "@/games/nonogram/problem/problem-pool";
import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";
import type { NonogramBoard } from "@/games/nonogram/puzzle/board";
import type { NonogramClues } from "@/games/nonogram/puzzle/clue";
import {
  findNonogramMatchedLines,
  type NonogramLineFlags,
} from "@/games/nonogram/puzzle/rules";
import {
  calculateNonogramPlayScore,
  calculateNonogramSpeedScoreRule,
  type NonogramPlayScore,
} from "@/games/nonogram/score";
import {
  canRestartNonogramSession,
  canUndoNonogramSession,
  createNonogramSession,
  endNonogramSessionStroke,
  extendNonogramSessionStroke,
  getNonogramSessionRepaintCount,
  getNonogramSessionResult,
  getNonogramSessionStrokeRange,
  type NonogramMark,
  type NonogramSession,
  type NonogramSessionResult,
  type NonogramStrokeRange,
  restartNonogramSession,
  startNonogramSessionStroke,
  undoNonogramSession,
} from "@/games/nonogram/session/session";
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
 * マスを押して入力を始めた操作の知らせ。効果音のため、操作ごとに増える `id` を付ける。
 * `marked` は印を入れる入力、`erased` は印を消す入力。押したまま広げた範囲は知らせない。
 */
export type NonogramOperation =
  | { id: number; type: "marked"; mark: NonogramMark }
  | { id: number; type: "erased" };

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type NonogramResult = NonogramSessionResult & {
  workload: NonogramSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: NonogramPlayScore;
};

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createNonogramResult(
  sessionResult: NonogramSessionResult,
  workload: NonogramSolveWorkload,
): NonogramResult {
  const speedRule = calculateNonogramSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateNonogramPlayScore({ ...sessionResult, workload }),
  };
}

export type NonogramPlay = GamePlay<
  NonogramDifficulty,
  NonogramProblemIdentity,
  NonogramSession,
  NonogramResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    board: NonogramBoard;
    clues: NonogramClues;
    /** 塗りがヒントにちょうど合っている行・列。今の盤面だけから決まり、解とは照らさない。 */
    matchedLines: NonogramLineFlags;
    strokeRange: NonogramStrokeRange | null;
    /** 塗りを未確定か × に変えたマスの数。待ったや盤面を戻すで消えた塗りも数え、盤面を戻しても0に戻さない。 */
    repaintCount: number;
    operation: NonogramOperation | null;
    /** マスを押して入力を始める。押したマスに `mark` があれば消し、無ければ入れる。 */
    startStroke: (cellIndex: number, mark: NonogramMark) => void;
    /** 押したまま動かしたマスまで、始点と同じ行・列に入力を広げる。 */
    extendStroke: (cellIndex: number) => void;
    /** 離して入力を終える。 */
    endStroke: () => void;
  };

type NonogramPlayState = {
  problemIdentity: NonogramProblemIdentity;
  workload: NonogramSolveWorkload;
  session: NonogramSession;
  progress: GameProgress;
  operation: NonogramOperation | null;
};

function createPlayState(
  { problem, identity, workload }: NonogramPooledProblem,
  startedAt: number,
): NonogramPlayState {
  return {
    problemIdentity: identity,
    workload,
    session: createNonogramSession(problem, startedAt),
    progress: "playing",
    operation: null,
  };
}

/**
 * マスを押して入力を始め、押したマスに入った印を知らせる。印が無くなったら消したと知らせる。
 * 入力を受け付けなければ何も知らせない。
 */
function applyStartStroke(
  state: NonogramPlayState,
  cellIndex: number,
  mark: NonogramMark,
  operationId: number,
  operatedAt: number,
): NonogramPlayState {
  const next = applyPlaySession(
    state,
    startNonogramSessionStroke(state.session, cellIndex, mark, operatedAt),
  );
  if (next === state) {
    return state;
  }
  const cell = next.session.puzzleState.cells[cellIndex] ?? "unknown";
  return {
    ...next,
    operation:
      cell === "unknown"
        ? { id: operationId, type: "erased" }
        : { id: operationId, type: "marked", mark: cell },
  };
}

/** 待ったや盤面を戻すで盤面が変わったら、前の操作の知らせを消す。 */
function clearOperationIfChanged(
  current: NonogramPlayState,
  next: NonogramPlayState,
): NonogramPlayState {
  return next === current ? current : { ...next, operation: null };
}

function selectProblem(
  difficulty: NonogramDifficulty,
  avoidedProblemId: ProblemId | undefined,
): NonogramPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectNonogramProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題集から選んだ問題を遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 * 問題集から引けない記録を再プレイできないものとして呼び出し側で扱えるよう、identity ではなく引いた問題を受け取る。
 */
export function useNonogramPlay(
  difficulty: NonogramDifficulty,
  initialProblem?: NonogramPooledProblem,
  avoidedProblemId?: ProblemId,
): NonogramPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const startStroke = useCallback((cellIndex: number, mark: NonogramMark) => {
    const operatedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      applyStartStroke(current, cellIndex, mark, operationId, operatedAt),
    );
  }, []);

  const extendStroke = useCallback((cellIndex: number) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        extendNonogramSessionStroke(current.session, cellIndex, operatedAt),
      ),
    );
  }, []);

  const endStroke = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, endNonogramSessionStroke(current.session)),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      clearOperationIfChanged(
        current,
        applyPlaySession(current, undoNonogramSession(current.session)),
      ),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      clearOperationIfChanged(
        current,
        applyPlaySession(current, restartNonogramSession(current.session)),
      ),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createNonogramSession(current.session.problem, startedAt),
      ),
      operation: null,
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

  const board = session.puzzleState;
  const { clues } = session.problem;
  const matchedLines = useMemo(
    () => findNonogramMatchedLines(board, clues),
    [board, clues],
  );

  const result = useMemo(() => {
    const sessionResult = getNonogramSessionResult(session);
    return sessionResult ? createNonogramResult(sessionResult, workload) : null;
  }, [session, workload]);

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result,
    board,
    clues,
    matchedLines,
    strokeRange: getNonogramSessionStrokeRange(session),
    repaintCount: getNonogramSessionRepaintCount(session),
    operation: play.operation,
    canUndo: canUndoNonogramSession(session),
    canRestart: canRestartNonogramSession(session),
    startStroke,
    extendStroke,
    endStroke,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
