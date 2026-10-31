/**
 * 詰将棋固有の色と陰影。盤は榧、駒は柘植の盛上駒を真上から見た姿で描き、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 木の上に乗せない。状態は木の焼け色（木の色相で暗い、低い濃さの重ね）と、駒の高さ・傾き・照りで示す。
 * 光は左上の一つで、照りは左上から差し、影は右下に落ちる。盤と駒はダークでも木のままにし、`dark:` は周りとの境（影）と
 * 画面の地、木の外に書く文字にだけ付ける。
 */
export const tsumeShogiToneClassNames = {
  /** 駒の面。盤の榧より一段明るく黄みの強い、均一に近い蜂蜜色の柘植で、盤から形を浮かせる。真上から見るので側面（木口）は見えない。 */
  pieceFace: "fill-[#fde894]",
  /** 面取りのハイライトと面の明るい側、面の暗い側、面の左上に乗るつや。 */
  pieceEdgeLight: "[stop-color:#fff4d8]",
  pieceShade: "[stop-color:#6e4518]",
  pieceSpecular: "[stop-color:#fff6dc]",
  /** 駒の接地影。置いた駒すべてに落とす。 */
  pieceShadow: "fill-[#2d1605]",
  /** 小さな図の駒の輪郭。小さいと面取りが見えないので、細い線で地から分ける。 */
  miniaturePieceOutline: "stroke-[#7a5224]/45",
  /** 盛上げの字。漆の暗い茶黒（成駒は朱漆）。上辺に細い艶を入れる。 */
  inkTop: "[stop-color:#3d2c20]",
  inkMiddle: "[stop-color:#20150d]",
  inkBottom: "[stop-color:#120b06]",
  vermilionTop: "[stop-color:#d8603f]",
  vermilionMiddle: "[stop-color:#bd4024]",
  vermilionBottom: "[stop-color:#962d17]",
  /** 艶を描かない字（小さな図と、塗りを参照できない所）。 */
  inkFlat: "fill-[#20150d]",
  vermilionFlat: "fill-[#bd4024]",
  glyphGloss: "fill-[#fff2dc]/45",
} as const;
