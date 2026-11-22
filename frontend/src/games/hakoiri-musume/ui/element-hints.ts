import type {
  HakoiriMusumeLayout,
  HakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 盤を見るか駒を動かせば分かる要素（壁・横の出口・L字・1マスの出口・大きい盤）は案内しない。
 * 娘が2人のときのクリアの条件は、見た目だけでは分からないので案内する。
 */
export type HakoiriMusumeElementHintId = "two-targets";

export type HakoiriMusumeElementHint = {
  id: HakoiriMusumeElementHintId;
  message: string;
};

const elementHints: readonly (HakoiriMusumeElementHint & {
  applies: (
    layout: HakoiriMusumeLayout,
    pieces: readonly HakoiriMusumePiece[],
  ) => boolean;
})[] = [
  {
    id: "two-targets",
    message: "娘が2人います。それぞれ同じ色の出口へ運びましょう。",
    applies: (layout) => layout.goals.length > 1,
  },
];

/** まだ出していない最初の1つ。無ければ `null`。 */
export function findHakoiriMusumeElementHint(
  layout: HakoiriMusumeLayout,
  pieces: readonly HakoiriMusumePiece[],
  seen: ReadonlySet<HakoiriMusumeElementHintId>,
): HakoiriMusumeElementHint | null {
  const hint = elementHints.find(
    (candidate) => !seen.has(candidate.id) && candidate.applies(layout, pieces),
  );
  return hint ? { id: hint.id, message: hint.message } : null;
}

export const hakoiriMusumeElementHintIds = elementHints.map((hint) => hint.id);
