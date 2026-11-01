/**
 * 案R の盤・駒台・駒の、木の上の色と陰影。状態表示の地など3案で共通の役割は `tsume-shogi-tone.ts` が持つ。
 * 光は左上の一つ。上辺・左辺が光を受け、右辺・下辺と影は右下に落ちる。
 * 盤と駒はダークでも木のままなので、`dark:` は周りとの境（影・外周）にだけ付ける。
 */
export const tsumeShogiRealToneClassNames = {
  /** 木目の画像が読み込まれる前に敷く、画像の平均の色。 */
  boardTopFallback: "bg-[#e3b466]",
  boardSideFallback: "bg-[#a2703a]",
  komadaiTopFallback: "bg-[#cf9850]",
  /** 盤・駒台を置いた面に落ちる、短く濃い接地影。ダークでは周りに溶けないよう外周に暗い縁も付ける。 */
  groundShadow:
    "shadow-[1px_2px_0_rgb(60_32_8/0.5),2px_4px_5px_-1px_rgb(45_22_5/0.45)] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),1px_2px_0_rgb(0_0_0/0.95),2px_5px_8px_rgb(0_0_0/0.85)]",
  /** 駒台の接地影と、天面の左上の辺の光・右下の辺の陰。 */
  komadaiShadow:
    "shadow-[1px_2px_0_rgb(60_32_8/0.5),2px_4px_5px_-1px_rgb(45_22_5/0.45),inset_1px_1px_0_rgb(255_236_200/0.5),inset_-1px_0_0_rgb(80_45_12/0.5)] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),1px_2px_0_rgb(0_0_0/0.95),2px_5px_8px_rgb(0_0_0/0.85),inset_1px_1px_0_rgb(255_236_200/0.45),inset_-1px_0_0_rgb(80_45_12/0.5)]",
  /** 天面の小さな面取り。左上の辺が光を受け、右下の辺が陰になる。 */
  topChamfer:
    "shadow-[inset_1px_1px_0_rgb(255_244_214/0.6),inset_-1px_-1px_0_rgb(95_55_18/0.5)]",
  /** 天面の絹のつや。柾目に沿った斜めの淡い光の帯と、左上から右下への緩い明暗。 */
  topSheen:
    "bg-[linear-gradient(112deg,rgb(255_250_232/0)_18%,rgb(255_250_232/0.18)_40%,rgb(255_250_232/0)_58%),linear-gradient(160deg,rgb(255_248_225/0.12),rgb(90_50_10/0.1))]",
  /** 手前の側面（木口側）。天面より一段暗い。境に明るい線を引かない。 */
  sideShade: "bg-[linear-gradient(rgb(40_20_5/0.18),rgb(40_20_5/0.42))]",
  /** 黒漆の罫線と星。外枠も内側と同じ太さ。 */
  gridLine: "border-[#1a1410]/90",
  gridOutline: "outline-[#1a1410]/90",
  star: "bg-[#1a1410]",
  /** 盤の外、画面の地の上に書く筋・段。 */
  coordinate: "text-[#6b4a2b] dark:text-[#c9ab85]",
  /** 玉方の持駒の札。駒台の外、画面の地の上に小さく出す。 */
  pieceBoxLabel: "text-muted-foreground",
  /** 持駒の枚数。駒に重ねず、駒台の木の上に墨で書く。 */
  handCount: "text-[#3b230b]",
  /** 遊び方・プレビューの小さな図の地。木目を省いた榧の平均の色。 */
  miniatureBoard: "bg-[#e3b466]",
  miniatureLine: "border-[#1a1410]/70",
  miniatureStroke: "stroke-[#1a1410]/55",
  miniatureMark: "fill-[#1a1410] stroke-[#1a1410]",
  /** 駒の面（柘植）の地、厚みの側面（木口）、面取りの光と陰。 */
  pieceFace: "fill-[#e8cc8a]",
  pieceSide: "fill-[#94632f]",
  pieceEdgeLight: "[stop-color:#fff6dc]",
  pieceEdgeDark: "[stop-color:#6e4518]",
  pieceSpecular: "[stop-color:#fffbea]",
  pieceOutline: "stroke-[#7a5224]/45",
  /** 駒の影。柔らかい影と接地の濃い影。 */
  pieceSoftShadow: "fill-[#2d1605]",
  pieceContactShadow: "fill-[#2d1605]/45",
  /** 盛上げの字。黒漆（成駒は朱漆）の濡れた黒と、左上の光る縁・右下の暗い縁・影。 */
  inkTop: "[stop-color:#3a3a3a]",
  inkMiddle: "[stop-color:#111111]",
  inkBottom: "[stop-color:#060606]",
  vermilionTop: "[stop-color:#d8603f]",
  vermilionMiddle: "[stop-color:#bd4024]",
  vermilionBottom: "[stop-color:#962d17]",
  inkFlat: "fill-[#111111]",
  vermilionFlat: "fill-[#bd4024]",
  glyphHighlight: "fill-[#fff4dc]/70",
  vermilionHighlight: "fill-[#ffd9c8]/70",
  glyphDarkEdge: "fill-black/60",
  glyphShadow: "fill-[#3a2008]/30",
} as const;
