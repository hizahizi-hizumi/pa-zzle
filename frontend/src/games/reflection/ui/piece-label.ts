import type { ReflectionPiece } from "@/games/reflection/puzzle/board";

export const reflectionPieceLabels = {
  slash: "右上がりの鏡",
  backslash: "右下がりの鏡",
  "vertical-double": "縦の両面鏡",
  "horizontal-double": "横の両面鏡",
  reflector: "反射体",
  "black-hole": "ブラックホール",
} as const satisfies Record<ReflectionPiece, string>;
