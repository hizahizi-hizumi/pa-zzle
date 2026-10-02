import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed } from "@/games/problem-seed";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type { TsumeShogiProblemIdentity } from "@/games/tsume-shogi/problem/problem";
import { selectTsumeShogiProblemForDifficulty } from "@/games/tsume-shogi/problem-selection";
import {
  canTsumeShogiMovePromote,
  type TsumeShogiMove,
} from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  listTsumeShogiBoardPieces,
  type TsumeShogiHandPieceType,
  type TsumeShogiPieceType,
  type TsumeShogiPosition,
  type TsumeShogiSide,
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
  getTsumeShogiSessionPhase,
  getTsumeShogiSessionPosition,
  playTsumeShogiSessionDefenderReply,
  replayTsumeShogiSession,
  restartTsumeShogiSession,
  type TsumeShogiSession,
  type TsumeShogiSessionTurn,
  type TsumeShogiTurnLine,
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

/**
 * 画面の進行。`clearing` は詰んでから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type TsumeShogiProgress = "playing" | "clearing" | "result";

/**
 * - `restoredTurn`: 元に戻す・盤面を戻すで、最後の組として盤面に戻ってきた手。指し直したときのように動かして見せない。
 */
type TsumeShogiPlayState = {
  session: TsumeShogiSession;
  restoredTurn: TsumeShogiSessionTurn | null;
  progress: TsumeShogiProgress;
  problemIdentity: TsumeShogiProblemIdentity;
};

function createPlayState(
  difficulty: TsumeShogiDifficulty,
  startedAt: number,
): TsumeShogiPlayState {
  const { problem, identity } = selectTsumeShogiProblemForDifficulty(
    difficulty,
    createProblemSeed(),
  );

  return {
    session: createTsumeShogiSession(problem, startedAt),
    restoredTurn: null,
    progress: "playing",
    problemIdentity: identity,
  };
}

function withNextSession(
  current: TsumeShogiPlayState,
  next: TsumeShogiSession,
): TsumeShogiPlayState {
  const rewound = next.turns.length < current.session.turns.length;
  return {
    ...current,
    session: next,
    restoredTurn: rewound ? (next.turns.at(-1) ?? null) : current.restoredTurn,
    progress: next.status === "cleared" ? "clearing" : current.progress,
  };
}

/**
 * 難易度のプレイを始める。
 * 攻方が王手を指すと、`TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS` の間を置いて玉方の応手（作意の応手、誤王手なら反証）を指す。
 * `undo`（待った）は攻方の1手を取り消し、誤王手の筋にいれば判断地点まで戻す。
 * `restart` は同じプレイのまま初期局面へ戻し、`replay` は同じ問題を新しいプレイとして始め、
 * `startNewProblem` は同じ難易度の別の問題を始める。詰むと `progress` が `clearing` になり、
 * 完成演出を終えたら `completeClearAnimation` で `result` に進める。
 */
export function useTsumeShogiPlay(difficulty: TsumeShogiDifficulty) {
  const [play, setPlay] = useState<TsumeShogiPlayState>(() =>
    createPlayState(difficulty, Date.now()),
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
        return next === current.session
          ? current
          : withNextSession(current, next);
      });
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
        current.session === session ? withNextSession(current, next) : current,
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
      setNow(operatedAt);
      playAttackerOperation((current) =>
        tapTsumeShogiSessionSquare(current, square, operatedAt),
      );
    },
    [playAttackerOperation],
  );

  const tapHand = useCallback(
    (pieceType: TsumeShogiHandPieceType) => {
      setNow(Date.now());
      updateSession((current) => tapTsumeShogiSessionHand(current, pieceType));
    },
    [updateSession],
  );

  const choosePromotion = useCallback(
    (promote: boolean) => {
      const operatedAt = Date.now();
      setNow(operatedAt);
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
    setNow(startedAt);
    setPlay((current) => ({
      ...current,
      session: replayTsumeShogiSession(current.session, startedAt),
      restoredTurn: null,
      progress: "playing",
    }));
  }, []);

  const completeClearAnimation = useCallback(() => {
    setPlay((current) =>
      current.progress === "clearing"
        ? { ...current, progress: "result" }
        : current,
    );
  }, []);

  const startNewProblem = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setPlay(createPlayState(difficulty, startedAt));
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
  const lastTurn = session.turns.at(-1);
  const shownMoves = useMemo(
    () => listShownMoves(lastTurn, session.defenderReplyPending),
    [lastTurn, session.defenderReplyPending],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    plies: session.problem.plies,
    status: session.status,
    progress: play.progress,
    phase: getTsumeShogiSessionPhase(session),
    boardPieces,
    attackerHand,
    shownMoves,
    shownMovesRestored:
      lastTurn !== undefined && lastTurn === play.restoredTurn,
    selection: session.selection,
    promotionChoice: session.promotionChoice,
    rejection: session.rejection,
    elapsedMs: getTsumeShogiSessionElapsedMs(session, now),
    canUndo: canUndoTsumeShogiSession(session),
    canRestart: canRestartTsumeShogiSession(session),
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
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
