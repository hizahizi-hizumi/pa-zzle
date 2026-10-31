/**
 * 詰将棋固有の色。駒は木の駒を思わせる色にし、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 流用しない。駒は盤の地の色によらず淡い地に濃い文字で描き、ダークでも同じ読みやすさにする。
 * - `pieceFace*`: 駒の面。上を明るく下を少し濃くして、柘植の駒の面の丸みを見せる。
 * - `pieceBevel*`: 面取りした駒の縁。上の縁は光を受けて明るく、下の縁は陰になる。
 * - `pieceGrain`: 駒の面に淡く重ねる柾目の筋。筋ごとの濃さは駒の側で決め、ここでは木の色相だけを持つ。
 * - `pieceSide`: 駒の側面。面より濃い木の色で、面の下にのぞかせて駒の厚みを見せる。
 * - `pieceFill`: 塗りを重ねない駒の面。駒箱の駒の山や、駒の塗りを参照できない所に使う。
 * - `pieceShadow`: 駒の下に落とす影。駒を盤や駒台の上に置いた厚みを見せる。
 * - `pieceText`: 駒の文字。
 * - `promoted`: 成った駒の文字。将棋の駒の慣例どおり赤くする。
 */
export const tsumeShogiToneClassNames = {
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
} as const;
