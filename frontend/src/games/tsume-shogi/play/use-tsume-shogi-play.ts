import { useCallback, useEffect, useMemo, useState } from "react";

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
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiProblemIdentity,
  TsumeShogiSolveWorkload,
} from "@/games/tsume-shogi/problem/problem";
import type {
  TsumeShogiPooledProblem,
  TsumeShogiProblemPoolReference,
} from "@/games/tsume-shogi/problem/problem-pool";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import {
  canTsumeShogiMovePromote,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  listTsumeShogiBoardPieces,
  type TsumeShogiBoardPiece,
  type TsumeShogiHand,
  type TsumeShogiHandPieceType,
  type TsumeShogiPieceType,
  type TsumeShogiPosition,
  type TsumeShogiSide,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  calculateTsumeShogiPlayScore,
  calculateTsumeShogiSpeedScoreRule,
  type TsumeShogiPlayScore,
} from "@/games/tsume-shogi/score";
import {
  cancelTsumeShogiSessionPromotion,
  canRestartTsumeShogiSession,
  canUndoTsumeShogiSession,
  chooseTsumeShogiSessionPromotion,
  clearTsumeShogiSessionSelection,
  createTsumeShogiSession,
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionResult,
  playTsumeShogiSessionDefenderReply,
  restartTsumeShogiSession,
  type TsumeShogiPromotionChoice,
  type TsumeShogiRejection,
  type TsumeShogiSelection,
  type TsumeShogiSession,
  type TsumeShogiSessionPhase,
  type TsumeShogiSessionResult,
  type TsumeShogiSessionTurn,
  type TsumeShogiTurnLine,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";

/**
 * 攻方が指してから玉方の応手を盤面に指すまでの間。玉方の手を攻方の手と分けて見せ、見落とさないようにする。
 * 間の長さは経過時間に含める。
 */
export const TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS = 600;

/**
 * 盤面に見せている最後の組の手。`pieceType` は指した後の駒（成った手は成った駒）、`line` はその手の筋。
 * `promotable` は成ることを選べた手か（成った手と、成れたのに成らなかった手）。
 */
export type TsumeShogiPlayedMove = {
  side: TsumeShogiSide;
  move: TsumeShogiMove;
  pieceType: TsumeShogiPieceType;
  promotable: boolean;
  line: TsumeShogiTurnLine;
};

function toPlayedMove(
  side: TsumeShogiSide,
  move: TsumeShogiMove,
  positionAfterMove: TsumeShogiPosition,
  line: TsumeShogiTurnLine,
): TsumeShogiPlayedMove {
  const pieceType = getTsumeShogiPieceAt(positionAfterMove, move.to)!.type;
  return {
    side,
    move,
    pieceType,
    promotable:
      move.kind === "board" &&
      (move.promote || canTsumeShogiMovePromote(side, pieceType, move)),
    line,
  };
}

function listShownMoves(
  turn: TsumeShogiSessionTurn | undefined,
  defenderReplyPending: boolean,
): TsumeShogiPlayedMove[] {
  if (!turn) return [];

  const attacker = toPlayedMove(
    "attacker",
    turn.attackerMove,
    turn.positionAfterAttack,
    turn.line,
  );
  if (defenderReplyPending || turn.defenderMove === null) return [attacker];

  return [
    attacker,
    toPlayedMove(
      "defender",
      turn.defenderMove,
      turn.positionAfterDefense,
      turn.line,
    ),
  ];
}

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type TsumeShogiResult = TsumeShogiSessionResult & {
  workload: TsumeShogiSolveWorkload;
  speedRule: SpeedScoreRule;
  timeDeltaMs: number;
  score: TsumeShogiPlayScore;
};

export type TsumeShogiPlay = GamePlay<
  TsumeShogiDifficulty,
  TsumeShogiProblemIdentity,
  TsumeShogiSession,
  TsumeShogiResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    workload: TsumeShogiSolveWorkload;
    poolReference: TsumeShogiProblemPoolReference;
    plies: number;
    phase: TsumeShogiSessionPhase;
    boardPieces: readonly TsumeShogiBoardPiece[];
    attackerHand: TsumeShogiHand;
    shownMoves: readonly TsumeShogiPlayedMove[];
    /** `shownMoves` の最初の手の1つ前の手（前の組の玉方の応手）の移動先。棋譜の「同」に使う。無ければ `null`。 */
    precedingMoveTo: TsumeShogiSquare | null;
    /** 待った・盤面を戻すで、最後の組として盤面に戻ってきた手を見せている。指し直したときのように動かして見せない。 */
    shownMovesRestored: boolean;
    selection: TsumeShogiSelection | null;
    promotionChoice: TsumeShogiPromotionChoice | null;
    rejection: TsumeShogiRejection | null;
    selectSquare: (square: TsumeShogiSquare) => void;
    selectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
    choosePromotion: (promote: boolean) => void;
    cancelPromotion: () => void;
    clearSelection: () => void;
  };

/**
 * - `workload` / `poolReference`: 問題集から出した問題の作業の量と、問題集の中の位置。
 * - `restoredTurn`: 待った・盤面を戻すで、最後の組として盤面に戻ってきた手。指し直したときのように動かして見せない。
 */
type TsumeShogiPlayState = {
  session: TsumeShogiSession;
  restoredTurn: TsumeShogiSessionTurn | null;
  progress: GameProgress;
  problemIdentity: TsumeShogiProblemIdentity;
  workload: TsumeShogiSolveWorkload;
  poolReference: TsumeShogiProblemPoolReference;
};

function createPlayState(
  { problem, identity, workload, poolReference }: TsumeShogiPooledProblem,
  startedAt: number,
): TsumeShogiPlayState {
  return {
    session: createTsumeShogiSession(problem, startedAt),
    restoredTurn: null,
    progress: "playing",
    problemIdentity: identity,
    workload,
    poolReference,
  };
}

/** 操作で変わった session を反映し、手を戻したなら盤面に戻ってきた最後の組を覚える。 */
function applySession(
  current: TsumeShogiPlayState,
  next: TsumeShogiSession,
): TsumeShogiPlayState {
  const applied = applyPlaySession(current, next);
  if (applied === current) return current;

  const rewound = next.turns.length < current.session.turns.length;
  return rewound
    ? { ...applied, restoredTurn: next.turns.at(-1) ?? null }
    : applied;
}

function selectProblem(
  difficulty: TsumeShogiDifficulty,
  avoidedProblemId: ProblemId | undefined,
): TsumeShogiPooledProblem {
  return selectProblemAvoiding(
    (seed) => selectTsumeShogiProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/** 完了したプレイの事実から結果を作る。プレイ中の結果と、記録から作り直す結果で共用する。 */
export function createTsumeShogiResult(
  sessionResult: TsumeShogiSessionResult,
  workload: TsumeShogiSolveWorkload,
): TsumeShogiResult {
  const speedRule = calculateTsumeShogiSpeedScoreRule(workload);
  return {
    ...sessionResult,
    workload,
    speedRule,
    timeDeltaMs: calculateTimeDeltaMs(sessionResult.elapsedMs, speedRule),
    score: calculateTsumeShogiPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      wrongCheckCount: sessionResult.wrongCheckCount,
      workload,
    }),
  };
}

/**
 * 難易度のプレイを始める。`initialProblem` を渡すと、最初の1問だけその問題を出す。
 * 渡さなければ、最初の1問は `avoidedProblemId` の問題を避けて選ぶ。
 * 攻方が王手を指すと、`TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS` の間を置いて玉方の応手（作意の応手、誤王手なら反証）を指す。
 * `undo`（待った）は攻方の1手を取り消し、誤王手の筋にいれば判断地点まで戻す。
 * 詰むと `progress` が `clearing` になり、完成演出を終えたら `completeClearAnimation` で `result` に進める。
 * クリアすると `result` に評価を返す。
 */
export function useTsumeShogiPlay(
  difficulty: TsumeShogiDifficulty,
  initialProblem?: TsumeShogiPooledProblem,
  avoidedProblemId?: ProblemId,
): TsumeShogiPlay {
  const [play, setPlay] = useState<TsumeShogiPlayState>(() =>
    createPlayState(
      initialProblem ?? selectProblem(difficulty, avoidedProblemId),
      Date.now(),
    ),
  );
  const { session, progress, problemIdentity, workload } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const updateSession = useCallback(
    (update: (current: TsumeShogiSession) => TsumeShogiSession) => {
      setPlay((current) => applySession(current, update(current.session)));
    },
    [],
  );

  // 攻方の着手は玉方の応手を決める探索を伴い重いので、updater（StrictMode では2回呼ばれる）の中では求めない。
  // 操作のときに表示中の session から1回だけ求め、その間に session が変わっていなければ反映する。
  const playAttackerOperation = useCallback(
    (operate: (current: TsumeShogiSession) => TsumeShogiSession) => {
      const next = operate(session);
      if (next === session) return;

      setPlay((current) =>
        current.session === session ? applySession(current, next) : current,
      );
    },
    [session],
  );

  // 待ったで戻した後に別の手を指したときも、その手の応手を待ち直すよう、応手を待つ手ごとに間を置く。
  const turnAwaitingReply = session.defenderReplyPending
    ? session.turns.at(-1)
    : undefined;
  useEffect(() => {
    if (!turnAwaitingReply) return;

    const timer = window.setTimeout(() => {
      updateSession(playTsumeShogiSessionDefenderReply);
    }, TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [turnAwaitingReply, updateSession]);

  const selectSquare = useCallback(
    (square: TsumeShogiSquare) => {
      const operatedAt = Date.now();
      playAttackerOperation((current) =>
        tapTsumeShogiSessionSquare(current, square, operatedAt),
      );
    },
    [playAttackerOperation],
  );

  const selectHandPiece = useCallback(
    (pieceType: TsumeShogiHandPieceType) => {
      updateSession((current) => tapTsumeShogiSessionHand(current, pieceType));
    },
    [updateSession],
  );

  const choosePromotion = useCallback(
    (promote: boolean) => {
      const operatedAt = Date.now();
      playAttackerOperation((current) =>
        chooseTsumeShogiSessionPromotion(current, promote, operatedAt),
      );
    },
    [playAttackerOperation],
  );

  const cancelPromotion = useCallback(() => {
    updateSession(cancelTsumeShogiSessionPromotion);
  }, [updateSession]);

  const clearSelection = useCallback(() => {
    updateSession(clearTsumeShogiSessionSelection);
  }, [updateSession]);

  const undo = useCallback(() => {
    updateSession(undoTsumeShogiSession);
  }, [updateSession]);

  const restart = useCallback(() => {
    updateSession(restartTsumeShogiSession);
  }, [updateSession]);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setPlay((current) => ({
      ...startPlaySession(
        current,
        createTsumeShogiSession(current.session.problem, startedAt),
      ),
      restoredTurn: null,
    }));
  }, []);

  const completeClearAnimation = useCallback(() => {
    setPlay(completePlayClearAnimation);
  }, []);

  const startNewProblem = useCallback(() => {
    setPlay(
      createPlayState(
        selectProblem(difficulty, createProblemId(problemIdentity)),
        Date.now(),
      ),
    );
  }, [difficulty, problemIdentity]);

  const position = session.puzzleState;
  const boardPieces = useMemo(
    () => listTsumeShogiBoardPieces(position),
    [position],
  );
  const attackerHand = useMemo(
    () => getTsumeShogiHand(position, "attacker"),
    [position],
  );
  const lastTurn = session.turns.at(-1);
  const shownMoves = useMemo(
    () => listShownMoves(lastTurn, session.defenderReplyPending),
    [lastTurn, session.defenderReplyPending],
  );
  const result = useMemo(() => {
    const sessionResult = getTsumeShogiSessionResult(session);
    return sessionResult
      ? createTsumeShogiResult(sessionResult, workload)
      : null;
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
    workload,
    poolReference: play.poolReference,
    plies: session.problem.plies,
    phase: getTsumeShogiSessionPhase(session),
    boardPieces,
    attackerHand,
    shownMoves,
    precedingMoveTo: session.turns.at(-2)?.defenderMove?.to ?? null,
    shownMovesRestored:
      lastTurn !== undefined && lastTurn === play.restoredTurn,
    selection: session.selection,
    promotionChoice: session.promotionChoice,
    rejection: session.rejection,
    canUndo: canUndoTsumeShogiSession(session),
    canRestart: canRestartTsumeShogiSession(session),
    selectSquare,
    selectHandPiece,
    choosePromotion,
    cancelPromotion,
    clearSelection,
    undo,
    restart,
    replay,
    completeClearAnimation,
    startNewProblem,
  };
}
