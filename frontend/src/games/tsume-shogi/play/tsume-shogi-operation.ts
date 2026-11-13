import type { TsumeShogiSession } from "@/games/tsume-shogi/session/session";

export type TsumeShogiOperationType =
  | "moved"
  | "replied"
  | "refuted"
  | "rejected";

export type TsumeShogiOperation = {
  /** 効果音のため、操作ごとに増える `id` を付ける。 */
  id: number;
  type: TsumeShogiOperationType;
};

/** 駒の選択・成 / 不成を選ぶ途中・待った・盤面を戻すは知らせない。 */
export function describeTsumeShogiOperation(
  previous: TsumeShogiSession,
  next: TsumeShogiSession,
): TsumeShogiOperationType | null {
  if (next.turns.length > previous.turns.length) return "moved";

  const replied =
    previous.defenderReplyPending &&
    !next.defenderReplyPending &&
    next.turns.length === previous.turns.length;
  if (replied) {
    return next.turns.at(-1)?.line === "wrong" ? "refuted" : "replied";
  }

  if (next.rejection !== null && next.rejection !== previous.rejection) {
    return "rejected";
  }
  return null;
}
