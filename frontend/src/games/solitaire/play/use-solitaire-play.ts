import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  restorePlayState,
  savePlayState,
} from "@/games/play-state-persistence";
import { createProblemId, type ProblemId } from "@/games/problem-id";
import { selectProblemAvoiding } from "@/games/problem-selection";
import type { SpeedScoreRule } from "@/games/score";
import type { SolitaireDifficulty } from "@/games/solitaire/difficulty";
import type { SolitaireProblemIdentity } from "@/games/solitaire/problem/problem";
import type { SolitairePooledProblem } from "@/games/solitaire/problem/problem-pool";
import { selectSolitaireProblemForDifficulty } from "@/games/solitaire/problem-selection";
import {
  findSolitaireFoundationProgress,
  type SolitaireFoundationProgress,
} from "@/games/solitaire/puzzle/foundation-progress";
import {
  type SolitairePile,
  selectSolitairePile,
} from "@/games/solitaire/puzzle/pile-selection";
import type {
  SolitaireMove,
  SolitaireSource,
} from "@/games/solitaire/puzzle/rules";
import type {
  SolitaireColumn,
  SolitaireFoundations,
  SolitaireState,
} from "@/games/solitaire/puzzle/state";
import {
  calculateSolitairePlayScore,
  calculateSolitaireSpeedScoreRule,
  calculateSolitaireTimeDeltaMs,
  type SolitairePlayScore,
} from "@/games/solitaire/score";
import {
  applySolitaireSessionMove,
  canRestartSolitaireSession,
  canUndoSolitaireSession,
  createSolitaireSession,
  getSolitaireSessionResult,
  restartSolitaireSession,
  type SolitaireSession,
  type SolitaireSessionResult,
  undoSolitaireSession,
} from "@/games/solitaire/session/session";

/**
 * 直前の、山を押した操作の知らせ。`id` は押すたびに変わり、同じ山を続けて押しても別の操作として見分けられる。
 * - `source-selected` / `source-deselected`: 置き元を選んだ・選ぶのをやめた。
 * - `invalid`: 押した山を置き元に選べないか、選んだ置き元から押した山へ置けない。盤面は変わらない。
 * - `moved`: 手を打った。`stateBefore` は打つ前の盤面。
 */
export type SolitaireOperation =
  | {
      id: number;
      type: "source-selected" | "source-deselected";
      source: SolitaireSource;
    }
  | { id: number; type: "invalid"; pile: SolitairePile }
  | {
      id: number;
      type: "moved";
      move: SolitaireMove;
      stateBefore: SolitaireState;
      isClearingMove: boolean;
    };

export type SolitaireResult = SolitaireSessionResult & {
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: SolitairePlayScore;
};

export function createSolitaireResult(
  sessionResult: SolitaireSessionResult,
): SolitaireResult {
  return {
    ...sessionResult,
    speedRule: calculateSolitaireSpeedScoreRule(),
    timeDeltaMs: calculateSolitaireTimeDeltaMs(sessionResult.elapsedMs),
    score: calculateSolitairePlayScore(sessionResult),
  };
}

export type SolitairePlay = GamePlay<
  SolitaireDifficulty,
  SolitaireProblemIdentity,
  SolitaireSession,
  SolitaireResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    state: SolitaireState;
    moveCount: number;
    undoCount: number;
    /** 選んでいる置き元の山。選んでいなければ `null`。 */
    selectedSource: SolitaireSource | null;
    operation: SolitaireOperation | null;
    /** どの手順でも今より多くの札を組札に置けないことを知らせる、プレイ中だけ `true`。 */
    isStuck: boolean;
    selectPile: (pile: SolitairePile) => void;
  };

type SolitairePlayState = {
  session: SolitaireSession;
  problemIdentity: SolitaireProblemIdentity;
  progress: GameProgress;
  selectedSource: SolitaireSource | null;
  operation: SolitaireOperation | null;
};

function createPlayState(
  { problem, identity }: SolitairePooledProblem,
  startedAt: number,
): SolitairePlayState {
  return {
    session: createSolitaireSession(problem, startedAt),
    problemIdentity: identity,
    progress: "playing",
    selectedSource: null,
    operation: null,
  };
}

function selectProblem(
  difficulty: SolitaireDifficulty,
  avoidedProblemId: ProblemId | undefined,
): SolitairePooledProblem {
  return selectProblemAvoiding(
    (seed) => selectSolitaireProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

function selectPileInPlay(
  current: SolitairePlayState,
  pile: SolitairePile,
  selectedAt: number,
  operationId: number,
): SolitairePlayState {
  const { session } = current;
  if (current.progress !== "playing") {
    return current;
  }

  const selection = selectSolitairePile(
    session.puzzleState,
    current.selectedSource,
    pile,
  );
  switch (selection.type) {
    case "source-selected":
      return {
        ...current,
        selectedSource: selection.source,
        operation: { id: operationId, ...selection },
      };
    case "source-deselected":
      return {
        ...current,
        selectedSource: null,
        operation: { id: operationId, ...selection },
      };
    case "invalid":
      return { ...current, operation: { id: operationId, ...selection } };
    case "move": {
      const nextSession = applySolitaireSessionMove(
        session,
        selection.move,
        selectedAt,
      );
      return {
        ...applyPlaySession(current, nextSession),
        selectedSource: null,
        operation: {
          id: operationId,
          type: "moved",
          move: selection.move,
          stateBefore: session.puzzleState,
          isClearingMove: nextSession.status === "cleared",
        },
      };
    }
  }
}

/** 待った・盤面を戻すで戻った後の状態。選んでいた置き元と直前の操作の知らせを消す。 */
function returnInPlay(
  current: SolitairePlayState,
  returned: SolitaireSession,
): SolitairePlayState {
  const next = applyPlaySession(current, returned);
  return next === current
    ? current
    : { ...next, selectedSource: null, operation: null };
}

/**
 * 列と組札ごとの、状態の知らせの判定。判定は山札と捨て札の並びに依らず、山札をめくる・捨て札を戻す手と待ったは
 * 列と組札の配列をそのまま引き継ぐので、列と組札の配列だけを鍵にして、同じ列と組札を何度も判定しない。
 */
const progressByColumns = new WeakMap<
  readonly SolitaireColumn[],
  WeakMap<SolitaireFoundations, SolitaireFoundationProgress>
>();

function findProgress(state: SolitaireState): SolitaireFoundationProgress {
  let byFoundations = progressByColumns.get(state.columns);
  if (!byFoundations) {
    byFoundations = new WeakMap();
    progressByColumns.set(state.columns, byFoundations);
  }
  const cached = byFoundations.get(state.foundations);
  if (cached !== undefined) {
    return cached;
  }
  const progress = findSolitaireFoundationProgress(state);
  byFoundations.set(state.foundations, progress);
  return progress;
}

/** `initialProblem` を渡すと、その問題で始める。渡さなければ `avoidedProblemId` の問題を避けて選ぶ。 */
export function useSolitairePlay(
  difficulty: SolitaireDifficulty,
  initialProblem?: SolitairePooledProblem,
  avoidedProblemId?: ProblemId,
  playProblemId?: ProblemId,
): SolitairePlay {
  const [play, setPlay] = useState<SolitairePlayState>(() =>
    restorePlayState("solitaire", playProblemId, () =>
      createPlayState(
        initialProblem ?? selectProblem(difficulty, avoidedProblemId),
        Date.now(),
      ),
    ),
  );
  useEffect(
    () => savePlayState("solitaire", playProblemId, play),
    [playProblemId, play],
  );
  const { session, problemIdentity } = play;
  const elapsedMs = useSessionElapsedMs(session);
  const nextOperationId = useRef(0);

  const selectPile = useCallback((pile: SolitairePile) => {
    const selectedAt = Date.now();
    const operationId = nextOperationId.current++;
    setPlay((current) =>
      selectPileInPlay(current, pile, selectedAt, operationId),
    );
  }, []);

  const undo = useCallback(() => {
    setPlay((current) =>
      returnInPlay(current, undoSolitaireSession(current.session)),
    );
  }, []);

  const restart = useCallback(() => {
    setPlay((current) =>
      returnInPlay(current, restartSolitaireSession(current.session)),
    );
  }, []);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createSolitaireSession(current.session.problem, startedAt),
      ),
      selectedSource: null,
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

  const { puzzleState } = session;
  const isStuck =
    session.status === "playing" && findProgress(puzzleState) === "unreachable";
  const result = useMemo(() => {
    const sessionResult = getSolitaireSessionResult(session);
    return sessionResult ? createSolitaireResult(sessionResult) : null;
  }, [session]);

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
    state: puzzleState,
    moveCount: session.moveCount,
    undoCount: session.undoCount,
    selectedSource: play.selectedSource,
    operation: play.operation,
    isStuck,
    canUndo: canUndoSolitaireSession(session),
    canRestart: canRestartSolitaireSession(session),
    selectPile,
    undo,
    restart,
    replay,
    startNewProblem,
    completeClearAnimation,
  };
}
