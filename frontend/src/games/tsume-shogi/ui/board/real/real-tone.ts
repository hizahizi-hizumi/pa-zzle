/**
 * 案R の盤・駒台・駒の、木の上の色と陰影。状態表示の地など3案で共通の役割は `tsume-shogi-tone.ts` が持つ。
 * 光は左上の一つ。上辺・左辺が光を受け、右辺・下辺と影は右下に落ちる。
 * 盤と駒はダークでも木のままなので、`dark:` は周りとの境（影・外周）と画面の地にだけ付ける。
 */
export const tsumeShogiRealToneClassNames = {
  /** 木目の画像が読み込まれる前に敷く、画像の平均の色。 */
  boardTopFallback: "bg-[#e5b86a]",
  komadaiTopFallback: "bg-[#e5b86a]",
  /**
   * 盤を置いた面に落ちる影。縁の直下の濃い接地影と、下へ厚く広がる大きく柔らかい落ち影で、盤が画面から切り抜かれて見えないようにする。
   * ダークでは周りに溶けないよう外周に暗い縁も付ける。
   */
  boardShadow:
    "shadow-[1px_2px_0_rgb(60_32_8/0.45),0_6px_10px_-2px_rgb(45_22_5/0.35),0_22px_40px_-6px_rgb(45_22_5/0.4),0_0_18px_rgb(45_22_5/0.12)] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),1px_2px_0_rgb(0_0_0/0.95),0_8px_14px_rgb(0_0_0/0.75),0_26px_48px_rgb(0_0_0/0.85)]",
  /** 天面の小さな面取り。左上の辺が光を受け、右下の辺が陰になる。 */
  topChamfer:
    "shadow-[inset_1px_1px_0_rgb(255_244_214/0.6),inset_-1px_-1px_0_rgb(95_55_18/0.5)]",
  /** 天面の緩い明暗（左上から右下へ）。 */
  topShade:
    "bg-[linear-gradient(160deg,rgb(255_248_225/0.1),rgb(90_50_10/0.08))]",
  /** 手前の側面。天面と同じ材・同じ色相で、明度だけ下げる。 */
  sideShade: "bg-black/30",
  /** 駒台。盤と同じ材で一段暗く、縁を一段高い枠にして台に見せる。木口を手前にのぞかせ、盤の落ち影を受ける。 */
  komadaiShadow:
    "shadow-[1px_2px_0_rgb(60_32_8/0.45),0_6px_10px_-2px_rgb(45_22_5/0.35),inset_0_0_0_1px_rgb(70_40_10/0.35),inset_3px_3px_0_0_rgb(255_240_205/0.35),inset_-3px_-3px_0_0_rgb(90_50_12/0.3)] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),1px_2px_0_rgb(0_0_0/0.95),0_8px_14px_rgb(0_0_0/0.75),inset_0_0_0_1px_rgb(70_40_10/0.35),inset_3px_3px_0_0_rgb(255_240_205/0.3),inset_-3px_-3px_0_0_rgb(90_50_12/0.3)]",
  /** 玉方の持駒の札。駒台の外、画面の地の上に小さく出す。 */
  pieceBoxLabel: "text-muted-foreground",
  /** 持駒の枚数。駒に重ねず、駒台の木の上に墨で書く。 */
  handCount: "text-[#3b230b]",
  /** 座卓の面にした版のプレイ領域の地。低彩度で、ライトとダークで明度だけ変える。 */
  tableSurface: "bg-[#ddd6cb] dark:bg-[#2b2723]",
  /** 遊び方・プレビューの小さな図の地と線。木目を省いた榧の平均の色。 */
  miniatureBoard: "bg-[#e5b86a]",
  miniatureStroke: "stroke-[#2a1b10]/55",
  miniatureMark: "fill-[#2a1b10] stroke-[#2a1b10]",
  /** 駒の面（柘植）、厚みの側面（同じ色相で暗く）、面取りのにじみ、つや。 */
  pieceFace: "fill-[#f0d68e]",
  pieceSide: "fill-[#b98e45]",
  pieceEdgeLight: "[stop-color:#fffaea]",
  pieceEdgeDark: "[stop-color:#7a5218]",
  pieceSpecular: "[stop-color:#fffdf2]",
  /** 小さな図の駒の輪郭。小さいと面取りが見えないので、細い線で地から分ける。 */
  miniaturePieceOutline: "stroke-[#7a5224]/45",
  /** 駒の影。置いた駒すべてに落とす。 */
  pieceShadow: "fill-[#2d1605]",
  /** 盛上げの字。漆の暗い茶黒（成駒は朱漆）。上辺に細い艶を入れる。 */
  inkTop: "[stop-color:#3d2c20]",
  inkMiddle: "[stop-color:#20150d]",
  inkBottom: "[stop-color:#120b06]",
  vermilionTop: "[stop-color:#d8603f]",
  vermilionMiddle: "[stop-color:#bd4024]",
  vermilionBottom: "[stop-color:#962d17]",
  inkFlat: "fill-[#20150d]",
  vermilionFlat: "fill-[#bd4024]",
  glyphGloss: "fill-[#fff2dc]/45",
} as const;
