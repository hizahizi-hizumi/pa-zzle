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
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiIdentifiedProblem,
  TsumeShogiProblemIdentity,
} from "@/games/tsume-shogi/problem/problem";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiHand,
  listTsumeShogiBoardPieces,
  type TsumeShogiBoardPiece,
  type TsumeShogiHand,
  type TsumeShogiHandPieceType,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  cancelTsumeShogiSessionPromotion,
  canRestartTsumeShogiSession,
  canUndoTsumeShogiSession,
  chooseTsumeShogiSessionPromotion,
  clearTsumeShogiSessionSelection,
  createTsumeShogiSession,
  getTsumeShogiSessionLastMove,
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionRemainingPlies,
  getTsumeShogiSessionResult,
  isTsumeShogiSessionOnWrongLine,
  playTsumeShogiSessionDefenderReply,
  restartTsumeShogiSession,
  type TsumeShogiPromotionChoice,
  type TsumeShogiRejection,
  type TsumeShogiSelection,
  type TsumeShogiSession,
  type TsumeShogiSessionPhase,
  type TsumeShogiSessionResult,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";

/**
 * 攻方が指してから玉方の応手を盤面に指すまでの間。玉方の手を攻方の手と分けて見せ、見落とさないようにする。
 * 間の長さは経過時間に含める。
 */
export const TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS = 600;

export type TsumeShogiPlay = GamePlay<
  TsumeShogiDifficulty,
  TsumeShogiProblemIdentity,
  TsumeShogiSession,
  TsumeShogiSessionResult
> &
  RestartableGamePlay &
  UndoableGamePlay & {
    plies: number;
    phase: TsumeShogiSessionPhase;
    onWrongLine: boolean;
    remainingPlies: number;
    boardPieces: readonly TsumeShogiBoardPiece[];
    attackerHand: TsumeShogiHand;
    lastMove: TsumeShogiMove | null;
    selection: TsumeShogiSelection | null;
    promotionChoice: TsumeShogiPromotionChoice | null;
    rejection: TsumeShogiRejection | null;
    tapSquare: (square: TsumeShogiSquare) => void;
    tapHand: (pieceType: TsumeShogiHandPieceType) => void;
    choosePromotion: (promote: boolean) => void;
    cancelPromotion: () => void;
    clearSelection: () => void;
  };

type TsumeShogiPlayState = {
  session: TsumeShogiSession;
  progress: GameProgress;
  problemIdentity: TsumeShogiProblemIdentity;
};

function createPlayState(
  { problem, identity }: TsumeShogiIdentifiedProblem,
  startedAt: number,
): TsumeShogiPlayState {
  return {
    session: createTsumeShogiSession(problem, startedAt),
    progress: "playing",
    problemIdentity: identity,
  };
}

function selectProblem(
  difficulty: TsumeShogiDifficulty,
  avoidedProblemId: ProblemId | undefined,
): TsumeShogiIdentifiedProblem {
  return selectProblemAvoiding(
    (seed) => selectTsumeShogiProblemForDifficulty(difficulty, seed),
    avoidedProblemId,
  ).problem;
}

/**
 * 難易度のプレイを始める。
 * 攻方が王手を指すと、`TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS` の間を置いて玉方の応手（作意の応手、誤王手なら反証）を指す。
 * `undo`（待った）は攻方の1手を取り消し、誤王手の筋にいれば判断地点まで戻す。
 * 詰むと `progress` が `clearing` になり、クリアしたプレイの事実を `result` に返す。
 */
export function useTsumeShogiPlay(
  difficulty: TsumeShogiDifficulty,
): TsumeShogiPlay {
  const [play, setPlay] = useState<TsumeShogiPlayState>(() =>
    createPlayState(selectProblem(difficulty, undefined), Date.now()),
  );
  const { session, progress, problemIdentity } = play;
  const elapsedMs = useSessionElapsedMs(session);

  const updateSession = useCallback(
    (update: (current: TsumeShogiSession) => TsumeShogiSession) => {
      setPlay((current) => applyPlaySession(current, update(current.session)));
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
        current.session === session ? applyPlaySession(current, next) : current,
      );
    },
    [session],
  );

  // 元に戻した後に別の手を指したときも、その手の応手を待ち直すよう、応手を待つ手ごとに間を置く。
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

  const tapSquare = useCallback(
    (square: TsumeShogiSquare) => {
      const operatedAt = Date.now();
      playAttackerOperation((current) =>
        tapTsumeShogiSessionSquare(current, square, operatedAt),
      );
    },
    [playAttackerOperation],
  );

  const tapHand = useCallback(
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
    setPlay((current) =>
      startPlaySession(
        current,
        createTsumeShogiSession(current.session.problem, startedAt),
      ),
    );
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
  const result = useMemo(() => getTsumeShogiSessionResult(session), [session]);

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
    plies: session.problem.plies,
    phase: getTsumeShogiSessionPhase(session),
    onWrongLine: isTsumeShogiSessionOnWrongLine(session),
    remainingPlies: getTsumeShogiSessionRemainingPlies(session),
    boardPieces,
    attackerHand,
    lastMove: getTsumeShogiSessionLastMove(session),
    selection: session.selection,
    promotionChoice: session.promotionChoice,
    rejection: session.rejection,
    canUndo: canUndoTsumeShogiSession(session),
    canRestart: canRestartTsumeShogiSession(session),
    tapSquare,
    tapHand,
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
