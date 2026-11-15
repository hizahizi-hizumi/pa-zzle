import type { GameProgress } from "@/games/play";
import type { PlayStateCodec } from "@/games/play-state-persistence";
import type { TsumeShogiOperation } from "@/games/tsume-shogi/play/tsume-shogi-operation";
import type {
  TsumeShogiProblemIdentity,
  TsumeShogiSolveWorkload,
} from "@/games/tsume-shogi/problem/problem";
import type { TsumeShogiProblemPoolReference } from "@/games/tsume-shogi/problem/problem-pool";
import {
  formatTsumeShogiPosition,
  parseTsumeShogiPosition,
} from "@/games/tsume-shogi/puzzle/position";
import type {
  TsumeShogiSession,
  TsumeShogiSessionTurn,
} from "@/games/tsume-shogi/session/session";
import { isRecordObject } from "@/lib/type-guards";

export type TsumeShogiPlayState = {
  session: TsumeShogiSession;
  /** 待った・盤面を戻すで戻ってきた最後の手。指し直したときのように動かして見せない。 */
  restoredTurn: TsumeShogiSessionTurn | null;
  operation: TsumeShogiOperation | null;
  progress: GameProgress;
  problemIdentity: TsumeShogiProblemIdentity;
  workload: TsumeShogiSolveWorkload;
  poolReference: TsumeShogiProblemPoolReference;
};

function encodeTurn(turn: TsumeShogiSessionTurn) {
  return {
    ...turn,
    positionAfterAttack: formatTsumeShogiPosition(turn.positionAfterAttack),
    positionAfterDefense: formatTsumeShogiPosition(turn.positionAfterDefense),
  };
}

function decodeTurn(value: unknown): TsumeShogiSessionTurn | null {
  if (
    !isRecordObject(value) ||
    typeof value.positionAfterAttack !== "string" ||
    typeof value.positionAfterDefense !== "string"
  ) {
    return null;
  }
  return {
    ...(value as Omit<
      TsumeShogiSessionTurn,
      "positionAfterAttack" | "positionAfterDefense"
    >),
    positionAfterAttack: parseTsumeShogiPosition(value.positionAfterAttack),
    positionAfterDefense: parseTsumeShogiPosition(value.positionAfterDefense),
  };
}

/** 詰将棋の局面は Symbol に包んだ将棋エンジンなので、JSON にそのまま保存しない。 */
export const tsumeShogiPlayStateCodec: PlayStateCodec<TsumeShogiPlayState> = {
  serialize(state) {
    const { problem: _problem, ...session } = state.session;
    return {
      ...state,
      // 問題集にある初期局面を復元時の正本にする。
      session: {
        ...session,
        puzzleState: formatTsumeShogiPosition(state.session.puzzleState),
        turns: state.session.turns.map(encodeTurn),
      },
      // オブジェクト同一性を保つため、最後の手を再シリアライズしない。
      restoredTurn: state.restoredTurn !== null,
    };
  },
  deserialize(value, initial) {
    if (!isRecordObject(value) || !isRecordObject(value.session)) return null;
    const rawSession = value.session;
    if (
      typeof rawSession.puzzleState !== "string" ||
      !Array.isArray(rawSession.turns) ||
      typeof rawSession.defenderReplyPending !== "boolean" ||
      typeof value.restoredTurn !== "boolean"
    ) {
      return null;
    }
    const turns: TsumeShogiSessionTurn[] = [];
    for (const rawTurn of rawSession.turns) {
      const turn = decodeTurn(rawTurn);
      if (turn === null) return null;
      turns.push(turn);
    }
    const puzzleState = parseTsumeShogiPosition(rawSession.puzzleState);
    const last = turns.at(-1);
    const expectedPosition = last
      ? rawSession.defenderReplyPending
        ? last.positionAfterAttack
        : last.positionAfterDefense
      : initial.session.problem.initialPosition;
    if (
      formatTsumeShogiPosition(puzzleState) !==
      formatTsumeShogiPosition(expectedPosition)
    ) {
      return null;
    }
    // 同じ問題IDの最新の問題を使い、保存データの問題オブジェクトを信用しない。
    const session: TsumeShogiSession = {
      ...(rawSession as Omit<
        TsumeShogiSession,
        "problem" | "puzzleState" | "turns"
      >),
      problem: initial.session.problem,
      puzzleState,
      turns,
    };
    return {
      ...(value as Omit<TsumeShogiPlayState, "session" | "restoredTurn">),
      session,
      restoredTurn: value.restoredTurn ? (last ?? null) : null,
      operation: null,
    };
  },
};
