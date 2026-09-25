import { useCallback, useState } from "react";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import {
  type MinesweeperRestoredProblem,
  restoreMinesweeperProblemWithoutAnalysis,
} from "@/games/minesweeper/problem/generator";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import { selectMinesweeperProblemForDifficulty } from "@/games/minesweeper/problem-selection";
import {
  chordMinesweeperSessionCell,
  createMinesweeperSession,
  getMinesweeperSessionVisibleCells,
  type MinesweeperSession,
  replayMinesweeperSession,
  revealMinesweeperSessionCell,
  toggleMinesweeperSessionFlag,
} from "@/games/minesweeper/session/session";
import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";

type MinesweeperPlayState = {
  seed: ProblemSeed;
  problemIdentity: MinesweeperProblemIdentity;
  session: MinesweeperSession;
};

// 問題集が小さい場合でも「別の問題」で同じ問題に戻らないよう、選び直す回数の上限。
const maximumNewProblemSelectionAttempts = 8;

function createPlayState(
  seed: ProblemSeed,
  { problem, identity }: MinesweeperRestoredProblem,
  startedAt: number,
): MinesweeperPlayState {
  return {
    seed,
    problemIdentity: identity,
    session: createMinesweeperSession(problem, startedAt),
  };
}

function createInitialPlayState(
  difficulty: MinesweeperDifficulty,
  initialProblemIdentity: MinesweeperProblemIdentity | undefined,
  startedAt: number,
): MinesweeperPlayState {
  if (initialProblemIdentity) {
    return createPlayState(
      initialProblemIdentity.seed,
      restoreMinesweeperProblemWithoutAnalysis(initialProblemIdentity),
      startedAt,
    );
  }

  const seed = createProblemSeed();
  return createPlayState(
    seed,
    selectMinesweeperProblemForDifficulty(difficulty, seed),
    startedAt,
  );
}

function createNewProblemPlayState(
  difficulty: MinesweeperDifficulty,
  currentProblemIdentity: MinesweeperProblemIdentity,
  startedAt: number,
): MinesweeperPlayState {
  let seed = createProblemSeed();
  let selected = selectMinesweeperProblemForDifficulty(difficulty, seed);
  for (
    let attempt = 1;
    attempt < maximumNewProblemSelectionAttempts &&
    selected.identity.seed === currentProblemIdentity.seed;
    attempt += 1
  ) {
    seed = createProblemSeed();
    selected = selectMinesweeperProblemForDifficulty(difficulty, seed);
  }
  return createPlayState(seed, selected, startedAt);
}

/**
 * 難易度の問題集から seed で選んだ問題を遊ぶ。
 * `initialProblemIdentity` を渡すと、その問題を再現して始める。
 */
export function useMinesweeperPlay(
  difficulty: MinesweeperDifficulty,
  initialProblemIdentity?: MinesweeperProblemIdentity,
) {
  const [play, setPlay] = useState(() =>
    createInitialPlayState(difficulty, initialProblemIdentity, Date.now()),
  );

  const revealCell = useCallback((cellIndex: number) => {
    const revealedAt = Date.now();
    setPlay((current) => ({
      ...current,
      session: revealMinesweeperSessionCell(
        current.session,
        cellIndex,
        revealedAt,
      ),
    }));
  }, []);

  const toggleFlag = useCallback((cellIndex: number) => {
    setPlay((current) => ({
      ...current,
      session: toggleMinesweeperSessionFlag(current.session, cellIndex),
    }));
  }, []);

  const chordCell = useCallback((cellIndex: number) => {
    const chordedAt = Date.now();
    setPlay((current) => ({
      ...current,
      session: chordMinesweeperSessionCell(
        current.session,
        cellIndex,
        chordedAt,
      ),
    }));
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...current,
      session: replayMinesweeperSession(current.session, startedAt),
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) =>
      createNewProblemPlayState(difficulty, current.problemIdentity, startedAt),
    );
  }, [difficulty]);

  const { session } = play;

  return {
    difficulty,
    seed: play.seed,
    problemIdentity: play.problemIdentity,
    rows: session.problem.board.rows,
    columns: session.problem.board.columns,
    mineCount: session.problem.board.mineCellIndices.length,
    flagCount: session.puzzleState.flaggedCellIndices.length,
    visibleCells: getMinesweeperSessionVisibleCells(session),
    status: session.status,
    revealCell,
    toggleFlag,
    chordCell,
    replay,
    startNewProblem,
  };
}
