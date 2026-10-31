/**
 * 詰将棋固有の色。盤と駒は木の盤・駒を思わせる色にし、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 流用しない。駒は盤の地の色によらず淡い地に濃い文字で描き、ダークでも同じ読みやすさにする。
 * - `boardSlab`: 盤の木の縁。筋・段の表記を載せ、少し影を落として盤の厚みを見せる。
 * - `boardGrain`: 升の地に重ねる淡い木目。罫線や駒より前に出ない濃さにする。
 * - `boardStar`: 星（盤の中央の3×3を囲む4点）。罫線と同じ色相で少し濃くする。
 * - `komadai`: 駒台。玉方・攻方の持駒を盤の外の台に載せて見せる。盤の縁より淡い木の色に、内側の影で窪みを付ける。
 * - `pieceFace*`: 駒の面。上を明るく下を少し濃くして、柘植の駒の面の丸みを見せる。
 * - `pieceBevel*`: 面取りした駒の縁。上の縁は光を受けて明るく、下の縁は陰になる。
 * - `pieceGrain`: 駒の面に淡く重ねる柾目の筋。筋ごとの濃さは駒の側で決め、ここでは木の色相だけを持つ。
 * - `pieceSide`: 駒の側面。面より濃い木の色で、面の下にのぞかせて駒の厚みを見せる。
 * - `pieceFill`: 塗りを重ねない駒の面。駒箱の駒の山や、駒の塗りを参照できない所に使う。
 * - `pieceShadow`: 駒の下に落とす影。駒を盤や駒台の上に置いた厚みを見せる。
 * - `square*`: 升の地。選んだ駒・最後の手を地の色で示し、駒や罫線は変えない。
 * - `handHover`: 駒台の持駒を指したときの地。駒台の木の色に合わせ、選んだ持駒の地（`handSelected`）は上書きしない。
 * - `pieceText`: 駒の文字。
 * - `promoted`: 成った駒の文字。将棋の駒の慣例どおり赤くする。
 */
export const tsumeShogiToneClassNames = {
  boardSurface: "bg-[#f0d6a2] dark:bg-[#3a2e24]",
  boardSlab:
    "bg-[#e2bb7a] shadow-[0_2px_0_#b48546,0_6px_16px_rgb(90_55_20/0.22)] dark:bg-[#2a211a] dark:shadow-[0_2px_0_#140f0b,0_6px_16px_rgb(0_0_0/0.5)]",
  boardGrain:
    "bg-[repeating-linear-gradient(90deg,rgb(140_90_40/0)_0_5px,rgb(140_90_40/0.05)_5px_6px,rgb(140_90_40/0)_6px_13px)] dark:bg-[repeating-linear-gradient(90deg,rgb(0_0_0/0)_0_5px,rgb(0_0_0/0.1)_5px_6px,rgb(0_0_0/0)_6px_13px)]",
  boardLine: "border-[#7a5228]/50 dark:border-[#d9b98c]/30",
  boardOutline: "outline-[#6b4520]/85 dark:outline-[#d9b98c]/60",
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
  squareMated: "bg-amber-400 dark:bg-amber-600",
  handSelected: "bg-sky-200 dark:bg-sky-900",
  handHover:
    "not-aria-disabled:not-aria-pressed:hover:bg-[#5c3b1a]/10 dark:not-aria-disabled:not-aria-pressed:hover:bg-white/10",
} as const;
