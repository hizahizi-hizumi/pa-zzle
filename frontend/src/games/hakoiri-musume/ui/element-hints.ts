import {
  countHakoiriMusumeCells,
  type HakoiriMusumeLayout,
  type HakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 要素が初めて出るレベルの順（壁は L1、横の出口・L字は L2、目標2つ・1マスの出口は L3、大きい盤は L4）に並べる。
 */
export type HakoiriMusumeElementHintId =
  | "wall"
  | "side-exit"
  | "bend"
  | "two-targets"
  | "narrow-exit"
  | "large-board";

export type HakoiriMusumeElementHint = {
  id: HakoiriMusumeElementHintId;
  message: string;
};

/** 基準の盤（4 × 5）より大きいとみなすマスの数。 */
const BASE_CELL_COUNT = 20;

const elementHints: readonly (HakoiriMusumeElementHint & {
  applies: (
    layout: HakoiriMusumeLayout,
    pieces: readonly HakoiriMusumePiece[],
  ) => boolean;
})[] = [
  {
    id: "wall",
    message: "明るい木のマスは壁です。駒は壁を通れません。",
    applies: (layout) => layout.walls.length > 0,
  },
  {
    id: "side-exit",
    message: "出口が横の辺にあります。娘をその出口の前へ運びましょう。",
    applies: (layout) =>
      layout.goals.length === 1 &&
      (layout.goals[0]!.exitSide === "left" ||
        layout.goals[0]!.exitSide === "right"),
  },
  {
    id: "bend",
    message: "L字の駒も、空いたマスへすべらせて動かせます。",
    applies: (_, pieces) =>
      pieces.some((piece) => piece.kind.startsWith("bend-")),
  },
  {
    id: "two-targets",
    message: "娘が2人います。姉と妹を、それぞれ同じ色の出口へ運びましょう。",
    applies: (layout) => layout.goals.length > 1,
  },
  {
    id: "narrow-exit",
    message: "出口が1マスの幅です。幅の合う娘を通しましょう。",
    applies: (layout) =>
      layout.goals.length === 1 && layout.goals[0]!.exitCells.length === 1,
  },
  {
    id: "large-board",
    message: "箱が大きくなりました。駒も空きも増えます。",
    applies: (layout) => countHakoiriMusumeCells(layout) > BASE_CELL_COUNT,
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
