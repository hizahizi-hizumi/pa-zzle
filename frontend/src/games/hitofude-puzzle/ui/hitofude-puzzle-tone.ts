/** 一筆パズルでは道の色を変えず、未通過のマスと一本の線を読み分けられるようにする。 */
export const HITOFUDE_PUZZLE_PATH_WIDTH = 0.27;

export const hitofudePuzzleSceneClassName =
  "size-full bg-[#eeeae1] dark:bg-[#1b2423]";

export const hitofudePuzzleToneClassNames = {
  colors:
    "[--hitofude-puzzle-from:#285b50] [--hitofude-puzzle-cell:#f8f5ed] [--hitofude-puzzle-target:#718b7f] dark:[--hitofude-puzzle-from:#a5dcc4] dark:[--hitofude-puzzle-cell:#23312e] dark:[--hitofude-puzzle-target:#b0cbbb]",
  cell: "fill-(--hitofude-puzzle-cell)",
  grid: "stroke-[#d1d8cc] dark:stroke-[#495d52]",
  outline: "stroke-[#8da99c] dark:stroke-[#7f9b8b]",
  blockedMarkOutline: "stroke-(--hitofude-puzzle-cell)",
  startMarkOutline: "stroke-(--hitofude-puzzle-cell)",
  deadEndBar: "fill-(--hitofude-puzzle-cell)",
  clearTrace: "stroke-[#c8e8d6] dark:stroke-[#f0f9e9]",
} as const;
