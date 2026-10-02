/**
 * 詰将棋固有の色。盤と駒は木の盤・駒を思わせる淡い色にし、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 流用しない。駒は盤の地の色によらず淡い地に濃い文字で描き、ダークでも同じ読みやすさにする。
 * - `boardEdge`: 盤の一部を切り出した図の、本当の盤の端。盤の外枠（`boardOutline`）と同じ色。
 * - `square*`: 升の地。選んだ駒・最後の手・反証・着手させなかった升を地の色で示し、駒や罫線は変えない。
 * - `promoted`: 成った駒の文字。将棋の駒の慣例どおり赤くする。
 * - `refutation`: 誤王手への玉方の反証。最後の手の地とは色相を分け、「この筋では逃れられた」ことを示す。
 */
export const tsumeShogiToneClassNames = {
  boardSurface: "bg-amber-100 dark:bg-stone-800",
  boardLine: "border-amber-900/45 dark:border-stone-500",
  boardOutline: "outline-amber-900/70 dark:outline-stone-400",
  boardEdge: "border-amber-900/70 dark:border-stone-400",
  coordinate: "text-amber-900/80 dark:text-stone-400",
  pieceFill: "fill-amber-50 dark:fill-stone-200",
  pieceStroke: "stroke-amber-900/70 dark:stroke-stone-500",
  pieceText: "fill-stone-900",
  promotedText: "fill-red-700",
  squareSelected: "bg-sky-200 dark:bg-sky-900",
  squareLastMove: "bg-amber-300/70 dark:bg-amber-900/70",
  squareRefutation: "bg-rose-200 dark:bg-rose-900/80",
  squareRejected: "bg-rose-300/80 dark:bg-rose-800/80",
  squareMated: "bg-amber-400 dark:bg-amber-600",
  handSelected: "bg-sky-200 dark:bg-sky-900",
  refutationText: "text-rose-700 dark:text-rose-300",
} as const;
