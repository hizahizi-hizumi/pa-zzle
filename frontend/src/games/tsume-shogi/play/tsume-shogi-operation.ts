import type { TsumeShogiSession } from "@/games/tsume-shogi/session/session";

/**
 * 盤面の操作の知らせの種類。
 * - `moved`: 攻方が王手を指した・打った。詰めた手も含む。
 * - `replied`: 玉方の応手（作意・詰み筋の応手）を盤面に指した。
 * - `refuted`: 誤王手の筋で、玉方の反証の応手を盤面に指した。
 * - `rejected`: 入力を着手させなかった（王手にならない手・ルールで指せない手）。
 */
export type TsumeShogiOperationType =
  | "moved"
  | "replied"
  | "refuted"
  | "rejected";

/** 盤面の操作の知らせ。効果音のため、操作ごとに増える `id` を付ける。 */
export type TsumeShogiOperation = {
  id: number;
  type: TsumeShogiOperationType;
};

/**
 * session の変化が、知らせる盤面の操作だったか。駒の選択・成 / 不成を選ぶ途中・待った・盤面を戻すは知らせない。
 */
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
