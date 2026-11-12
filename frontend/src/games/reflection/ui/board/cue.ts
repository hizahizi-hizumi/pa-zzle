import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import {
  isSameReflectionEntry,
  type ReflectionEntry,
} from "@/games/reflection/puzzle/laser";

export type ReflectionCueTarget =
  | { type: "cell"; cellIndex: number }
  | { type: "clue"; entry: ReflectionEntry }
  | { type: "stock"; piece: ReflectionPiece };

/**
 * 盤面とストックに重ねる、チュートリアルの印・応え・覆いから抜く所。1つの所に種類の違うものを重ねてよい。
 * - `mark`: 次に押す所の印。`recallId` は印の無い所が押されるたびに変え、押されていなければ `null`。
 *   `pointed` なら、輪郭に加えて押すしぐさをする指で指す。
 * - `acknowledgement`: 手順どおりに置いた応え。`id` が変わるとやり直す。
 * - `spotlight`: 盤面の覆いから抜いて元の明るさで見せる所。
 */
export type ReflectionCue =
  | {
      target: ReflectionCueTarget;
      kind: "mark";
      recallId: number | null;
      pointed: boolean;
    }
  | { target: ReflectionCueTarget; kind: "acknowledgement"; id: number }
  | { target: ReflectionCueTarget; kind: "spotlight" };

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
