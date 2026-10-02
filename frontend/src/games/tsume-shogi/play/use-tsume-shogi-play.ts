import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiIdentifiedProblem,
  TsumeShogiProblemIdentity,
} from "@/games/tsume-shogi/problem/problem";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import {
  getTsumeShogiHand,
  listTsumeShogiBoardPieces,
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
  getTsumeShogiSessionElapsedMs,
  getTsumeShogiSessionLastMove,
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionPosition,
  getTsumeShogiSessionRemainingPlies,
  getTsumeShogiSessionResult,
  isTsumeShogiSessionOnWrongLine,
  playTsumeShogiSessionDefenderReply,
  replayTsumeShogiSession,
  restartTsumeShogiSession,
  returnTsumeShogiSessionToDecision,
  type TsumeShogiSession,
  tapTsumeShogiSessionHand,
  tapTsumeShogiSessionSquare,
  undoTsumeShogiSession,
} from "@/games/tsume-shogi/session/session";

const elapsedTimeTickMs = 1_000;

/**
 * 攻方が指してから玉方の応手を盤面に指すまでの間。玉方の手を攻方の手と分けて見せ、見落とさないようにする。
 * 間の長さは経過時間に含める。
 */
export const TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS = 600;

/** 遊んでいる問題の出どころ。`given` は開始時に指定された問題。 */
export type TsumeShogiProblemSource = "selected" | "given";

type TsumeShogiPlayState = {
  session: TsumeShogiSession;
  problemIdentity: TsumeShogiProblemIdentity;
  problemSource: TsumeShogiProblemSource;
};

function createPlayState(
  { problem, identity }: TsumeShogiIdentifiedProblem,
  problemSource: TsumeShogiProblemSource,
  startedAt: number,
): TsumeShogiPlayState {
  return {
    session: createTsumeShogiSession(problem, startedAt),
    problemIdentity: identity,
    problemSource,
  };
}

function createSelectedPlayState(
  difficulty: TsumeShogiDifficulty,
  seed: ProblemSeed,
  startedAt: number,
): TsumeShogiPlayState {
  return createPlayState(
    selectTsumeShogiProblemForDifficulty(difficulty, seed),
    "selected",
    startedAt,
  );
}

/**
 * 難易度のプレイを始める。`initialProblem` を渡すと、最初の1問だけその問題を出す。
 * 攻方が王手を指すと、`TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS` の間を置いて玉方の応手（作意の応手、誤王手なら反証）を指す。
 * `returnToDecision` は誤王手の筋から判断地点へ戻り、`undo` は攻方の1手を取り消す。
 * `restart` は同じプレイのまま初期局面へ戻し、`replay` は同じ問題を新しいプレイとして始め、
 * `startNewProblem` は同じ難易度の別の問題を始める。
 */
export function useTsumeShogiPlay(
  difficulty: TsumeShogiDifficulty,
  initialProblem?: TsumeShogiIdentifiedProblem,
) {
  const [play, setPlay] = useState<TsumeShogiPlayState>(() =>
    initialProblem
      ? createPlayState(initialProblem, "given", Date.now())
      : createSelectedPlayState(difficulty, createProblemSeed(), Date.now()),
  );
  const [now, setNow] = useState(() => Date.now());
  const { session } = play;

  useEffect(() => {
    if (session.status !== "playing") return;

    setNow(Date.now());
    const timer = window.setInterval(
      () => setNow(Date.now()),
      elapsedTimeTickMs,
    );

    return () => window.clearInterval(timer);
  }, [session.status]);

  const updateSession = useCallback(
    (update: (current: TsumeShogiSession) => TsumeShogiSession) => {
      setPlay((current) => {
        const next = update(current.session);
        if (next === current.session) return current;

        return { ...current, session: next };
      });
    },
    [],
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
      setNow(operatedAt);
      updateSession((current) =>
        tapTsumeShogiSessionSquare(current, square, operatedAt),
      );
    },
    [updateSession],
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
      setNow(operatedAt);
      updateSession((current) =>
        chooseTsumeShogiSessionPromotion(current, promote, operatedAt),
      );
    },
    [updateSession],
  );

  const cancelPromotion = useCallback(() => {
    updateSession(cancelTsumeShogiSessionPromotion);
  }, [updateSession]);

  const clearSelection = useCallback(() => {
    updateSession(clearTsumeShogiSessionSelection);
  }, [updateSession]);

  const returnToDecision = useCallback(() => {
    updateSession(returnTsumeShogiSessionToDecision);
  }, [updateSession]);

  const undo = useCallback(() => {
    updateSession(undoTsumeShogiSession);
  }, [updateSession]);

  const restart = useCallback(() => {
    updateSession(restartTsumeShogiSession);
  }, [updateSession]);

  const replay = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: replayTsumeShogiSession(current.session, startedAt),
    }));
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(
      createSelectedPlayState(difficulty, createProblemSeed(), startedAt),
    );
  }, [difficulty]);

  const position = getTsumeShogiSessionPosition(session);
  const boardPieces = useMemo(
    () => listTsumeShogiBoardPieces(position),
    [position],
  );
  const attackerHand = useMemo(
    () => getTsumeShogiHand(position, "attacker"),
    [position],
  );
  const pieceBox = useMemo(
    () => getTsumeShogiHand(position, "defender"),
    [position],
  );
  const sessionResult = useMemo(
    () => getTsumeShogiSessionResult(session),
    [session],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    problemSource: play.problemSource,
    plies: session.problem.plies,
    status: session.status,
    phase: getTsumeShogiSessionPhase(session),
    onWrongLine: isTsumeShogiSessionOnWrongLine(session),
    remainingPlies: getTsumeShogiSessionRemainingPlies(session),
    boardPieces,
    attackerHand,
    pieceBox,
    lastMove: getTsumeShogiSessionLastMove(session),
    selection: session.selection,
    promotionChoice: session.promotionChoice,
    rejection: session.rejection,
    elapsedMs: getTsumeShogiSessionElapsedMs(session, now),
    canUndo: canUndoTsumeShogiSession(session),
    canRestart: canRestartTsumeShogiSession(session),
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    sessionResult,
    tapSquare,
    tapHand,
    choosePromotion,
    cancelPromotion,
    clearSelection,
    returnToDecision,
    undo,
    restart,
    replay,
    startNewProblem,
  };
}
