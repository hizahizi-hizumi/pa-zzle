/**
 * 氷の床迷路固有の色。共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * - 岩と外壁は同じ石の色で、どちらも「ぶつかって止まる面」と読ませる。岩は下側に影の面を重ねた塊にする。
 * - 氷は明るい青の地に細い目地を引き、行と列を数えやすくする。小さいマスでも雑音にならないよう模様は描かない。
 * - 駒は白い縁取りの濃い円、ゴールは氷と別の色系統の地と輪と中心の点にする。跡やゴールの印に重なっても駒を見失わない。
 * - 跡は駒と同じ色相の半透明の帯で、ゴールの輪の下を通す。ゴールを通り過ぎた滑りは、帯がゴールの先まで続いて見える。
 */
export const iceFloorMazeToneClassNames = {
  stoneFace: "fill-stone-400 dark:fill-stone-500",
  stoneShadow: "fill-stone-500 dark:fill-stone-600",
  ice: "fill-sky-100 dark:fill-slate-800",
  iceJoint: "stroke-sky-200 dark:stroke-slate-700",
  trail: "fill-indigo-400/45 dark:fill-indigo-300/35",
  goalCell: "fill-amber-100 dark:fill-amber-950",
  goalMark: "fill-none stroke-amber-500 dark:stroke-amber-400",
  goalDot: "fill-amber-500 dark:fill-amber-400",
  piece:
    "fill-indigo-600 stroke-white dark:fill-indigo-400 dark:stroke-slate-50",
} as const;
