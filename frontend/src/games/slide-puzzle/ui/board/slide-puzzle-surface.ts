/** 通常の盤面と、#707 のプレイ画面で比べる3つの造形。 */
export const slidePuzzleSurfaces = [
  { id: "original", label: "現行" },
  { id: "crafted", label: "工房" },
  { id: "precision", label: "レール" },
  { id: "playful", label: "パレット" },
] as const;

export type SlidePuzzleSurface = (typeof slidePuzzleSurfaces)[number]["id"];
