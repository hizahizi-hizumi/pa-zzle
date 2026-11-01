import { tsumeShogiBoardStyle } from "@/games/tsume-shogi/ui/board-style";

/**
 * 詰将棋固有の色。盤と駒は木の盤・駒を思わせる色にし、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 流用しない。駒は盤の地の色によらず淡い地に濃い文字で描き、ダークでも同じ読みやすさにする。
 * - `boardSlab`: 盤の木の縁。筋・段の表記を載せ、少し影を落として盤の厚みを見せる。
 * - `boardGrain`: 升の地に重ねる淡い木目。罫線や駒より前に出ない濃さにする。
 * - `boardEdge`: 盤の一部を切り出した図の、本当の盤の端。盤の外枠（`boardOutline`）と同じ色。
 * - `boardStar`: 星（盤の中央の3×3を囲む4点）。罫線と同じ色相で少し濃くする。
 * - `komadai`: 駒台。玉方・攻方の持駒を盤の外の台に載せて見せる。盤の縁より淡い木の色に、内側の影で窪みを付ける。
 * - `pieceFace*`: 駒の面。上を明るく下を少し濃くして、柘植の駒の面の丸みを見せる。
 * - `pieceBevel*`: 面取りした駒の縁。上の縁は光を受けて明るく、下の縁は陰になる。
 * - `pieceGrain`: 駒の面に淡く重ねる柾目の筋。筋ごとの濃さは駒の側で決め、ここでは木の色相だけを持つ。
 * - `pieceSide`: 駒の側面。面より濃い木の色で、面の下にのぞかせて駒の厚みを見せる。
 * - `pieceFill`: 塗りを重ねない駒の面。駒箱の駒の山や、駒の塗りを参照できない所に使う。
 * - `pieceShadow`: 駒の下に落とす影。駒を盤や駒台の上に置いた厚みを見せる。
 * - `square*`: 升の地。選んだ駒・最後の手・反証を地の色で示し、駒や罫線は変えない。`squareRejected` は、動きを減らす設定で
 *   着手させなかった入力を返す間だけ、選んだ駒の地を変える色。
 * - `handRejected`: 動きを減らす設定で着手させなかった入力を返す間の、選んだ持駒の地。`squareRejected` と同じ色。
 * - `handHover`: 駒台の持駒を指したときの地。駒台の木の色に合わせ、選んだ持駒の地（`handSelected`）は上書きしない。
 * - `pieceText`: 駒の文字。
 * - `promoted`: 成った駒の文字。将棋の駒の慣例どおり赤くする。
 * - `refutation`: 誤王手への玉方の反証。最後の手の地とは色相を分け、「この筋では逃れられた」ことを示す。
 */
const currentToneClassNames = {
  boardSurface: "bg-[#f0d6a2] dark:bg-[#3a2e24]",
  boardSlab:
    "bg-[#e2bb7a] shadow-[0_2px_0_#b48546,0_6px_16px_rgb(90_55_20/0.22)] dark:bg-[#2a211a] dark:shadow-[0_2px_0_#140f0b,0_6px_16px_rgb(0_0_0/0.5)]",
  boardGrain:
    "bg-[repeating-linear-gradient(90deg,rgb(140_90_40/0)_0_5px,rgb(140_90_40/0.05)_5px_6px,rgb(140_90_40/0)_6px_13px)] dark:bg-[repeating-linear-gradient(90deg,rgb(0_0_0/0)_0_5px,rgb(0_0_0/0.1)_5px_6px,rgb(0_0_0/0)_6px_13px)]",
  boardLine: "border-[#7a5228]/50 dark:border-[#d9b98c]/30",
  boardOutline: "outline-[#6b4520]/85 dark:outline-[#d9b98c]/60",
  boardEdge: "border-[#6b4520]/85 dark:border-[#d9b98c]/60",
  boardStar: "bg-[#6b4520]/80 dark:bg-[#d9b98c]/60",
  coordinate: "text-[#5c3b1a] dark:text-[#d9b98c]/80",
  komadai:
    "bg-[#ecd4a4] shadow-[inset_0_1px_3px_rgb(90_55_20/0.28)] dark:bg-[#2a211a] dark:shadow-[inset_0_1px_3px_rgb(0_0_0/0.7)]",
  pieceFill: "fill-[#fbefd2] dark:fill-[#ecdcb8]",
  pieceFaceTop: "[stop-color:#fbecc4] dark:[stop-color:#e9d5a6]",
  pieceFaceBottom: "[stop-color:#f2d9a2] dark:[stop-color:#d8bd86]",
  pieceBevelLight: "[stop-color:#fffaea] dark:[stop-color:#f6e9c8]",
  pieceBevelDark: "[stop-color:#d9b06c] dark:[stop-color:#b8935a]",
  pieceGrain: "fill-[#8a5420] dark:fill-[#6b3f14]",
  pieceSide:
    "fill-[#c38a45] stroke-[#8a5a26] dark:fill-[#9c7140] dark:stroke-[#4a3018]",
  pieceStroke: "stroke-[#8a5a26]/80 dark:stroke-[#4a3018]/80",
  pieceShadow: "fill-[#5c3b1a]/20 dark:fill-black/45",
  pieceText: "fill-stone-900",
  promotedText: "fill-red-700",
  squareSelected: "bg-sky-200 dark:bg-sky-900",
  squareLastMove: "bg-[#dcae66] dark:bg-[#6b4a26]",
  squareLastMoveFrom: "",
  squareRefutation: "bg-rose-200 dark:bg-rose-900/80",
  squareRejected: "bg-rose-300 dark:bg-rose-800",
  squareMated: "bg-amber-400 dark:bg-amber-600",
  handSelected: "bg-sky-200 dark:bg-sky-900",
  handRejected: "bg-rose-300 dark:bg-rose-800",
  handHover:
    "not-aria-disabled:not-aria-pressed:hover:bg-[#5c3b1a]/10 dark:not-aria-disabled:not-aria-pressed:hover:bg-white/10",
  refutationText: "text-rose-700 dark:text-rose-300",
  focusRing: "focus-visible:outline-foreground/70",
  pieceLift: "-translate-y-[6%]",
  clearGlow: "bg-white/45",
} as const;

type TsumeShogiToneClassNames = Record<
  keyof typeof currentToneClassNames,
  string
>;

/**
 * 案S「静か」。木の質感を捨て、共通UIの面と罫線の言葉で盤と駒を描く。駒は平らな五角形に細い輪郭だけ。
 * 状態の地は他のゲームと同じく淡い色で示し、ダークでは共通UIの暗い面にそのまま載せる。
 */
const quietToneClassNames = {
  boardSurface: "bg-background",
  boardSlab: "",
  boardGrain: "hidden",
  boardLine: "border-foreground/15",
  boardOutline: "outline-foreground/55",
  boardEdge: "border-foreground/55",
  boardStar: "bg-foreground/50",
  coordinate: "text-muted-foreground",
  komadai: "border border-foreground/15",
  pieceFill: "fill-background",
  pieceFaceTop: "",
  pieceFaceBottom: "",
  pieceBevelLight: "",
  pieceBevelDark: "",
  pieceGrain: "",
  pieceSide: "",
  pieceStroke: "stroke-foreground/60",
  pieceShadow: "",
  pieceText: "fill-foreground",
  promotedText: "fill-red-700 dark:fill-red-400",
  squareSelected: "bg-sky-100 dark:bg-sky-900/50",
  squareLastMove: "bg-foreground/[0.08]",
  squareLastMoveFrom: "",
  squareRefutation: "bg-rose-100 dark:bg-rose-950/70",
  squareRejected: "bg-rose-200 dark:bg-rose-900/60",
  squareMated: "bg-amber-200/80 dark:bg-amber-800/50",
  handSelected: "bg-sky-100 dark:bg-sky-900/50",
  handRejected: "bg-rose-200 dark:bg-rose-900/60",
  handHover: "not-aria-disabled:not-aria-pressed:hover:bg-foreground/5",
  refutationText: "text-rose-700 dark:text-rose-300",
  focusRing: "focus-visible:outline-foreground/70",
  pieceLift: "-translate-y-[6%]",
  clearGlow: "bg-white/45",
} as const satisfies TsumeShogiToneClassNames;

/**
 * 案R「リアル」。木の質感・駒の陰影は `board/real/real-tone.ts` が持ち、ここでは黒漆の罫線と、木の上で UI に見えない状態表示を持つ。
 * ダークでも盤と駒は木のまま（周りだけ暗い）なので、筋段の色を除いて `dark:` を付けない。
 */
const realToneClassNames = {
  boardSurface: "bg-[#e5b86a]",
  boardSlab: "",
  boardGrain: "hidden",
  // 黒漆の罫線と星。茶を含んだ黒にする。外枠も内側と同じ太さ。
  boardLine: "border-[#2a1b10]/90",
  boardOutline: "outline-[#2a1b10]/90",
  boardEdge: "border-[#2a1b10]/90",
  boardStar: "bg-[#2a1b10]",
  coordinate: "text-[#6b4a2b] dark:text-[#c9ab85]",
  komadai: "",
  pieceFill: "fill-[#f0d68e]",
  pieceFaceTop: "",
  pieceFaceBottom: "",
  pieceBevelLight: "",
  pieceBevelDark: "",
  pieceGrain: "",
  pieceSide: "",
  pieceStroke: "stroke-[#7a5224]/45",
  pieceShadow: "",
  pieceText: "fill-[#20150d]",
  promotedText: "fill-[#bd4024]",
  // 選んだ駒は持ち上げて示す（`pieceLift` と `TsumeShogiPieceGlyph` の `lifted`）。升には、駒の影が落ちたような弱い地だけを付ける。
  squareSelected:
    "bg-[radial-gradient(circle_at_55%_60%,rgb(70_40_10/0.16),rgb(70_40_10/0)_70%)]",
  // 最後の手の移動先は、はっきり分かる強さの暖色を木に掛け合わせる。移動元は同じ色を弱く。
  squareLastMove: "bg-[#e0782a]/35",
  squareLastMoveFrom: "bg-[#e0782a]/15",
  // 反証は、朱が升に染みたような色。輪郭は付けない。
  squareRefutation:
    "bg-[radial-gradient(circle_at_50%_50%,rgb(200_50_25/0.5),rgb(200_50_25/0.22)_75%)]",
  squareRejected: "bg-[#bd4024]/35",
  // 詰みは、木と別の色相（藍）が升に染みたような色。
  squareMated:
    "bg-[radial-gradient(circle_at_50%_50%,rgb(48_46_150/0.5),rgb(48_46_150/0.22)_75%)]",
  handSelected:
    "bg-[radial-gradient(circle_at_55%_60%,rgb(70_40_10/0.16),rgb(70_40_10/0)_70%)]",
  handRejected: "bg-[#bd4024]/35",
  handHover: "not-aria-disabled:not-aria-pressed:hover:bg-[#3b230b]/10",
  refutationText: "text-rose-700 dark:text-rose-300",
  // キーボード操作の枠は輪郭線だけにし、升の地（反証・詰みなど）を上書きしない。明るい木の上で墨色 2px は十分に見える。
  focusRing: "focus-visible:outline-[#1a1410]",
  // 選んだ駒を升の約 15% 持ち上げる。
  pieceLift: "-translate-y-[15%]",
  // 詰みの波で升に一度だけ差す光。木の上で暖かく明るくする。
  clearGlow:
    "bg-[radial-gradient(circle_at_50%_50%,rgb(255_244_200/0.85),rgb(255_226_150/0)_75%)]",
} as const satisfies TsumeShogiToneClassNames;

export const tsumeShogiToneClassNames: TsumeShogiToneClassNames = {
  current: currentToneClassNames,
  quiet: quietToneClassNames,
  real: realToneClassNames,
}[tsumeShogiBoardStyle];
