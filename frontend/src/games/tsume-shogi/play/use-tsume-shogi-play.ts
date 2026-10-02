import { useCallback, useEffect, useMemo, useState } from "react";

import { createProblemSeed, type ProblemSeed } from "@/games/problem-seed";
import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiIdentifiedProblem,
  TsumeShogiProblemIdentity,
  TsumeShogiSolveWorkload,
} from "@/games/tsume-shogi/problem/problem";
import type {
  TsumeShogiPooledProblem,
  TsumeShogiProblemPoolReference,
} from "@/games/tsume-shogi/problem/problem-pool";
import {
  restoreTsumeShogiProblem,
  selectTsumeShogiProblemForDifficulty,
} from "@/games/tsume-shogi/problem-selection";
import type { TsumeShogiMove } from "@/games/tsume-shogi/puzzle/moves";
import {
  getTsumeShogiHand,
  getTsumeShogiPieceAt,
  listTsumeShogiBoardPieces,
  type TsumeShogiHandPieceType,
  type TsumeShogiPieceType,
  type TsumeShogiSide,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  calculateTsumeShogiPlayScore,
  calculateTsumeShogiSpeedFullScoreMs,
  calculateTsumeShogiSpeedZeroScoreMs,
  calculateTsumeShogiTimeDeltaMs,
  type TsumeShogiPlayScore,
} from "@/games/tsume-shogi/score";
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
  getTsumeShogiSessionRemainingPlies,
  getTsumeShogiSessionResult,
  isTsumeShogiSessionOnWrongLine,
  playTsumeShogiSessionDefenderReply,
  replayTsumeShogiSession,
  restartTsumeShogiSession,
  returnTsumeShogiSessionToDecision,
  type TsumeShogiSession,
  type TsumeShogiSessionResult,
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
 */
export type TsumeShogiPlayedMove = {
  side: TsumeShogiSide;
  move: TsumeShogiMove;
  pieceType: TsumeShogiPieceType;
  line: TsumeShogiTurnLine;
};

function listShownMoves(
  turn: TsumeShogiSessionTurn | undefined,
  defenderReplyPending: boolean,
): TsumeShogiPlayedMove[] {
  if (!turn) return [];

  const attacker: TsumeShogiPlayedMove = {
    side: "attacker",
    move: turn.attackerMove,
    pieceType: getTsumeShogiPieceAt(
      turn.positionAfterAttack,
      turn.attackerMove.to,
    )!.type,
    line: turn.line,
  };
  if (defenderReplyPending || turn.defenderMove === null) return [attacker];

  return [
    attacker,
    {
      side: "defender",
      move: turn.defenderMove,
      pieceType: getTsumeShogiPieceAt(
        turn.positionAfterDefense,
        turn.defenderMove.to,
      )!.type,
      line: turn.line,
    },
  ];
}

/** 遊んでいる問題の出どころ。`given` は開始時に指定された問題。 */
export type TsumeShogiProblemSource = "selected" | "given";

/**
 * 画面の進行。`clearing` は詰んでから完成演出を終えるまで。
 * 完成演出の間も session はクリア済みで、経過時間は止まっている。
 */
export type TsumeShogiProgress = "playing" | "clearing" | "result";

/** クリアしたプレイの事実と、それを遊んだ問題の作業の量から導いた評価。 */
export type TsumeShogiResult = TsumeShogiSessionResult & {
  workload: TsumeShogiSolveWorkload;
  speedFullScoreMs: number;
  speedZeroScoreMs: number;
  timeDeltaMs: number;
  score: TsumeShogiPlayScore;
};

/**
 * - `workload` / `poolReference`: 問題集から出した問題の作業の量と、問題集の中の位置。
 *   問題集に無い identity を指定して生成した問題（内部診断）では `null` で、評価できない。
 */
type TsumeShogiPlayState = {
  session: TsumeShogiSession;
  progress: TsumeShogiProgress;
  problemIdentity: TsumeShogiProblemIdentity;
  problemSource: TsumeShogiProblemSource;
  workload: TsumeShogiSolveWorkload | null;
  poolReference: TsumeShogiProblemPoolReference | null;
};

function createPooledPlayState(
  { problem, identity, workload, poolReference }: TsumeShogiPooledProblem,
  problemSource: TsumeShogiProblemSource,
  startedAt: number,
): TsumeShogiPlayState {
  return {
    session: createTsumeShogiSession(problem, startedAt),
    progress: "playing",
    problemIdentity: identity,
    problemSource,
    workload,
    poolReference,
  };
}

/** 指定された問題で始める。問題集の問題なら作業の量と問題集の位置を引き、問題集に無い問題は評価しない。 */
function createGivenPlayState(
  given: TsumeShogiIdentifiedProblem,
  startedAt: number,
): TsumeShogiPlayState {
  const pooled = restoreTsumeShogiProblem(given.identity);
  if (pooled) {
    return createPooledPlayState(pooled, "given", startedAt);
  }

  return {
    session: createTsumeShogiSession(given.problem, startedAt),
    progress: "playing",
    problemIdentity: given.identity,
    problemSource: "given",
    workload: null,
    poolReference: null,
  };
}

function createSelectedPlayState(
  difficulty: TsumeShogiDifficulty,
  seed: ProblemSeed,
  startedAt: number,
): TsumeShogiPlayState {
  return createPooledPlayState(
    selectTsumeShogiProblemForDifficulty(difficulty, seed),
    "selected",
    startedAt,
  );
}

function createTsumeShogiResult(
  sessionResult: TsumeShogiSessionResult,
  workload: TsumeShogiSolveWorkload,
): TsumeShogiResult {
  return {
    ...sessionResult,
    workload,
    speedFullScoreMs: calculateTsumeShogiSpeedFullScoreMs(workload),
    speedZeroScoreMs: calculateTsumeShogiSpeedZeroScoreMs(workload),
    timeDeltaMs: calculateTsumeShogiTimeDeltaMs({
      elapsedMs: sessionResult.elapsedMs,
      workload,
    }),
    score: calculateTsumeShogiPlayScore({
      elapsedMs: sessionResult.elapsedMs,
      wrongCheckCount: sessionResult.wrongCheckCount,
      workload,
    }),
  };
}

/**
 * 難易度のプレイを始める。`initialProblem` を渡すと、最初の1問だけその問題を出す。
 * 攻方が王手を指すと、`TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS` の間を置いて玉方の応手（作意の応手、誤王手なら反証）を指す。
 * `returnToDecision` は誤王手の筋から判断地点へ戻り、`undo` は攻方の1手を取り消す。
 * `restart` は同じプレイのまま初期局面へ戻し、`replay` は同じ問題を新しいプレイとして始め、
 * `startNewProblem` は同じ難易度の別の問題を始める。詰むと `progress` が `clearing` になり、
 * 完成演出を終えたら `completeClearAnimation` で `result` に進める。
 * クリアすると `result` に評価を返す。問題集に無い問題を指定したときは作業の量が無いので `result` は `null` のまま。
 */
export function useTsumeShogiPlay(
  difficulty: TsumeShogiDifficulty,
  initialProblem?: TsumeShogiIdentifiedProblem,
) {
  const [play, setPlay] = useState<TsumeShogiPlayState>(() =>
    initialProblem
      ? createGivenPlayState(initialProblem, Date.now())
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

        return {
          ...current,
          session: next,
          progress: next.status === "cleared" ? "clearing" : current.progress,
        };
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
  const lastTurn = session.turns.at(-1);
  const shownMoves = useMemo(
    () => listShownMoves(lastTurn, session.defenderReplyPending),
    [lastTurn, session.defenderReplyPending],
  );
  const sessionResult = useMemo(
    () => getTsumeShogiSessionResult(session),
    [session],
  );
  const { workload } = play;
  const result = useMemo(
    () =>
      sessionResult && workload
        ? createTsumeShogiResult(sessionResult, workload)
        : null,
    [sessionResult, workload],
  );

  return {
    difficulty,
    problemIdentity: play.problemIdentity,
    problemSource: play.problemSource,
    workload,
    poolReference: play.poolReference,
    problem: session.problem,
    plies: session.problem.plies,
    status: session.status,
    progress: play.progress,
    phase: getTsumeShogiSessionPhase(session),
    onWrongLine: isTsumeShogiSessionOnWrongLine(session),
    remainingPlies: getTsumeShogiSessionRemainingPlies(session),
    boardPieces,
    attackerHand,
    pieceBox,
    shownMoves,
    selection: session.selection,
    promotionChoice: session.promotionChoice,
    rejection: session.rejection,
    elapsedMs: getTsumeShogiSessionElapsedMs(session, now),
    canUndo: canUndoTsumeShogiSession(session),
    canRestart: canRestartTsumeShogiSession(session),
    startedAt: session.startedAt,
    completedAt: session.finishedAt,
    sessionResult,
    result,
    tapSquare,
    tapHand,
    choosePromotion,
    cancelPromotion,
    clearSelection,
    returnToDecision,
    undo,
    restart,
    replay,
    completeClearAnimation,
    startNewProblem,
  };
}
