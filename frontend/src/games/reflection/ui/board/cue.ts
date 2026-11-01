import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import {
  isSameReflectionEntry,
  type ReflectionEntry,
} from "@/games/reflection/puzzle/laser";

/**
 * 盤面とストックに一時的に重ねる合図。チュートリアルで、次に押す所と手の結果を、説明文に頼らず盤面の上で返すのに使う。
 * - `hint`: 次に押す所。出た瞬間から分かる強さで示し、`id` が変わるたびに一瞬光らせて付け直す。
 * - `reason`: 次の手を決める外周ヒント。手を決める前から示し続ける。
 * - `fitted`: 手順どおりに置いたマス。一瞬光らせる。
 * - `rejected`: 受け付けなかった手で押した所。一瞬縁取る。
 */
export type ReflectionCueKind = "hint" | "reason" | "fitted" | "rejected";

export type ReflectionCueTarget =
  | { type: "cell"; cellIndex: number }
  | { type: "clue"; entry: ReflectionEntry }
  | { type: "stock"; piece: ReflectionPiece };

/** `id` が変わると、同じ所の同じ合図でもやり直す。1つの所に種類の違う合図を重ねてよい。 */
export type ReflectionCue = {
  target: ReflectionCueTarget;
  kind: ReflectionCueKind;
  id: number;
};

export function isSameReflectionCueTarget(
  left: ReflectionCueTarget,
  right: ReflectionCueTarget,
): boolean {
  switch (left.type) {
    case "cell":
      return right.type === "cell" && left.cellIndex === right.cellIndex;
    case "clue":
      return (
        right.type === "clue" && isSameReflectionEntry(left.entry, right.entry)
      );
    case "stock":
      return right.type === "stock" && left.piece === right.piece;
  }
}

export function filterReflectionCues(
  cues: readonly ReflectionCue[],
  target: ReflectionCueTarget,
): ReflectionCue[] {
  return cues.filter((cue) => isSameReflectionCueTarget(cue.target, target));
}
