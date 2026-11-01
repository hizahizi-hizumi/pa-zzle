import { useCallback, useMemo, useState } from "react";

import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import type {
  NonogramIdentifiedProblem,
  NonogramProblemIdentity,
} from "@/games/nonogram/problem/problem";
import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";
import type { NonogramBoard } from "@/games/nonogram/puzzle/board";
import type { NonogramClues } from "@/games/nonogram/puzzle/clue";
import {
  findNonogramMatchedLines,
  type NonogramLineFlags,
} from "@/games/nonogram/puzzle/rules";
import {
  canRestartNonogramSession,
  canUndoNonogramSession,
  createNonogramSession,
  endNonogramSessionStroke,
  extendNonogramSessionStroke,
  getNonogramSessionStrokeRange,
  type NonogramMark,
  type NonogramSession,
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

/**
 * クリアしたプレイの評価。評価が無いので `result` は常に `null` になり、
 * クリア後も結果画面へは進まず、完成した図柄を盤面に見せたままにする。
 */
export type NonogramResult = never;

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
    /** マスを押して入力を始める。押したマスに `mark` があれば消し、無ければ入れる。 */
    startStroke: (cellIndex: number, mark: NonogramMark) => void;
    /** 押したまま動かしたマスまで、始点と同じ行・列に入力を広げる。 */
    extendStroke: (cellIndex: number) => void;
    /** 離して入力を終える。 */
    endStroke: () => void;
  };

type NonogramPlayState = {
  problemIdentity: NonogramProblemIdentity;
  session: NonogramSession;
  progress: GameProgress;
};

function createPlayState(
  { problem, identity }: NonogramIdentifiedProblem,
  startedAt: number,
): NonogramPlayState {
  return {
    problemIdentity: identity,
    session: createNonogramSession(problem, startedAt),
    progress: "playing",
  };
}

function selectProblem(
  difficulty: NonogramDifficulty,
  avoidedProblemId: ProblemId | undefined,
): NonogramIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectNonogramProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度の問題を選んで遊ぶ。
 * `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。
 */
export function useNonogramPlay(
  difficulty: NonogramDifficulty,
  initialProblem?: NonogramIdentifiedProblem,
  avoidedProblemId?: ProblemId,
): NonogramPlay {
  const [play, setPlay] = useState(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const startStroke = useCallback((cellIndex: number, mark: NonogramMark) => {
    const operatedAt = Date.now();
    setPlay((current) =>
      applyPlaySession(
        current,
        startNonogramSessionStroke(
          current.session,
          cellIndex,
          mark,
          operatedAt,
        ),
      ),
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
      applyPlaySession(current, undoNonogramSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      applyPlaySession(current, restartNonogramSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      startPlaySession(
        current,
        createNonogramSession(current.session.problem, startedAt),
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

  const board = session.puzzleState;
  const { clues } = session.problem;
  const matchedLines = useMemo(
    () => findNonogramMatchedLines(board, clues),
    [board, clues],
  );

  return {
    difficulty,
    problemIdentity,
    session,
    status: session.status,
    progress,
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    elapsedMs,
    result: null,
    board,
    clues,
    matchedLines,
    strokeRange: getNonogramSessionStrokeRange(session),
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
