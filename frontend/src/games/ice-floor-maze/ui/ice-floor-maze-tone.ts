/**
 * 氷の床迷路固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - 岩・もろい岩と外壁は同じ石の色で、どれも「ぶつかって止まる面」と読ませる。岩は下側に影の面を重ねた塊にする。
 *   外壁は盤面として描くマスの形に沿い、盤面の外は描かずに画面の地のままにする。
 * - 氷・薄い氷・水面は青の明るさの段階で、明るいほど滑れる。氷は明るい青の地に細い目地を引き、行と列を数えやすくする。
 *   薄い氷は氷より一段濃く（下の水が透ける）白いひびを入れ、水面は濃い青のくぼみに小さな波を描く。
 *   ダークでは水面を氷より暗い穴にし、波だけを明るく残す。グレースケールでも 氷＞薄い氷＞水面 の順に読める。
 * - 駒は白い縁取りの濃い円、ゴールは氷と別の色系統の地と輪と中心の点にする。跡やゴールの印に重なっても駒を見失わない。
 * - 跡は駒と同じ色相の半透明の帯で、ゴールの輪の下を通す。ゴールを通り過ぎた滑りは、帯がゴールの先まで続いて見える。
 */
export const iceFloorMazeToneClassNames = {
  stoneFace: "fill-stone-400 dark:fill-stone-500",
  stoneShadow: "fill-stone-500 dark:fill-stone-600",
  wall: "fill-stone-400 stroke-stone-400 dark:fill-stone-500 dark:stroke-stone-500",
  ice: "fill-sky-100 dark:fill-slate-800",
  iceJoint: "stroke-sky-200 dark:stroke-slate-700",
  thinIce: "fill-[oklch(85.5%_0.085_231)] dark:fill-[oklch(40%_0.075_240)]",
  thinIceCrack: "stroke-white dark:stroke-[oklch(90%_0.03_235/0.95)]",
  water: "fill-sky-600 dark:fill-[oklch(19%_0.055_250)]",
  waterHollow: "fill-sky-700 dark:fill-[oklch(14%_0.04_252)]",
  wave: "stroke-sky-200/90 dark:stroke-sky-400/85",
  trail: "fill-indigo-400/45 dark:fill-indigo-300/35",
  goalCell: "fill-amber-100 dark:fill-amber-950",
  goalMark: "fill-none stroke-amber-500 dark:stroke-amber-400",
  goalDot: "fill-amber-500 dark:fill-amber-400",
  piece:
    "fill-indigo-600 stroke-white dark:fill-indigo-400 dark:stroke-slate-50",
} as const;
