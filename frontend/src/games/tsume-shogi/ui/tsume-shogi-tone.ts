/**
 * 詰将棋固有の色と陰影。盤は榧、駒は柘植の盛上駒を真上から見た姿で描き、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 木の上に乗せない。状態は木の焼け色（木の色相で暗い、低い濃さの重ね）と、駒の高さ・傾き・照りで示す。
 * 光は左上の一つで、照りは左上から差し、影は右下に落ちる。盤と駒はダークでも木のままにし、`dark:` は周りとの境（影）と
 * 画面の地、木の外に書く文字にだけ付ける。
 */
export const tsumeShogiToneClassNames = {
  /** 盤の天面の、木目の画像の平均の色。画像が読み込まれる前の盤と、木目を省く小さな図の盤に使う。 */
  boardSurface: "bg-[#e5b86a]",
  /**
   * 盤を置いた面に落ちる影。縁の直下の濃い接地影と、下へ厚く広がる大きく柔らかい落ち影で、盤を卓に置いて見せる。
   * 真上から見るので、手前の厚みの帯は描かず、厚みはこの影だけで表す。
   */
  boardShadow:
    "shadow-[0_1px_1px_rgb(50_28_8/0.4),0_6px_10px_-2px_rgb(45_22_5/0.35),0_22px_40px_-6px_rgb(45_22_5/0.45)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.8),0_8px_14px_rgb(0_0_0/0.7),0_26px_48px_rgb(0_0_0/0.8)]",
  /** 盤の天面の、左上からのごく弱い照りと、四辺へ向かうわずかな暗がり。 */
  boardSheen:
    "bg-[radial-gradient(ellipse_at_28%_18%,rgb(255_247_222/0.18),rgb(255_247_222/0)_55%),radial-gradient(ellipse_at_50%_50%,rgb(0_0_0/0)_62%,rgb(70_38_8/0.12)_100%)]",
  /** 天面の小さな面取り。左上の辺が光を受け、右下の辺が陰になる。 */
  boardChamfer:
    "shadow-[inset_1px_1px_0_rgb(255_244_214/0.5),inset_-1px_-1px_0_rgb(95_55_18/0.45)]",
  /** 黒漆の罫線と星。茶を含んだ黒で、罫線は木目を消さない濃さに抑える。外枠も内側と同じ太さ。 */
  boardLine: "border-[#2a1b10]/70",
  boardOutline: "outline-[#2a1b10]/80",
  boardStar: "bg-[#2a1b10]",
  /** 筋・段は盤の木の縁に墨で書く。 */
  coordinate: "text-[#4a3220]",
  /** プレイ領域の地。座卓の面のような低彩度の色で、ライトとダークで明度だけ変える。盤が白い地から切り抜かれて見えないようにする。 */
  tableSurface: "bg-[#ddd6cb] dark:bg-[#2b2723]",
  /** 駒台の天面の、木目の画像の平均の色。 */
  komadaiSurface: "bg-[#d4a65c]",
  /** 駒台。盤と同じ材で一段暗い、四角い天板。盤から離して置き、自分の落ち影を落とす。 */
  komadaiShadow:
    "shadow-[0_1px_1px_rgb(50_28_8/0.4),0_5px_9px_-2px_rgb(45_22_5/0.4),0_14px_24px_-6px_rgb(45_22_5/0.35),inset_1px_1px_0_rgb(255_240_205/0.4),inset_-1px_-1px_0_rgb(90_50_12/0.4)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.8),0_6px_12px_rgb(0_0_0/0.7),0_16px_28px_rgb(0_0_0/0.7),inset_1px_1px_0_rgb(255_240_205/0.35),inset_-1px_-1px_0_rgb(90_50_12/0.4)]",
  /** 持駒の枚数。駒に重ねず、駒台の木の上に墨で書く。 */
  handCount: "text-[#3b230b]",
  /** 玉方の持駒の札。木の外の地に、盤の筋・段と同じ書体と墨の濃さで小さく出す。 */
  pieceBoxLabel: "text-[#5a4632] dark:text-[#cbb79c]",
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
  /** 選んだ駒の升に付ける木の焼け色の軽い印。駒は持ち上げて（`pieceLift`）示す。 */
  squareSelected: "bg-[#8a5a24]/14",
  /** 直前の手の移動先。低い濃さの暖色の焼け色。 */
  squareLastMove: "bg-[#c8742a]/22",
  /** 誤王手への玉方の反証。直前の手より濃い焦げ茶の焼け色を升の縁へ向けて濃くし、直前の手と見分ける。 */
  squareRefutation:
    "bg-[radial-gradient(circle_at_50%_50%,rgb(110_60_20/0.18),rgb(80_40_10/0.42)_95%)]",
  /** 動きを減らす設定で、着手させなかった入力を返す間だけ、選んだ駒の地を変える色。 */
  squareRejected: "bg-[#8a3a18]/25",
  handSelected: "bg-[#8a5a24]/14",
  /** 動きを減らす設定で着手させなかった入力を返す間の、選んだ持駒の地。`squareRejected` と同じ色。 */
  handRejected: "bg-[#8a3a18]/25",
  /** 駒台の持駒を指したときの地。選んだ持駒の地（`handSelected`）は上書きしない。 */
  handHover: "not-aria-disabled:not-aria-pressed:hover:bg-[#3b230b]/10",
  /** 棋譜の行は木の外の地に書く。反証は赤字にせず、墨の淡い色で示す。 */
  refutationText: "text-[#6b5a48] dark:text-[#b8a690]",
  /** キーボード操作の枠。暗い線と明るい線の二重線にし、どの木目の上でも見えるようにする。升の地は上書きしない。 */
  focusRing:
    "focus-visible:outline-[#1a1410] focus-visible:shadow-[0_0_0_2px_rgb(255_248_232)]",
  /**
   * 成・不成の選択肢。白い札を出さず、2枚の駒を浮かせて影で盤から離し、駒の下に墨の小さな字を添える。
   * 覆った升の駒が透けて紛れないよう、盤と同じ木の色の地を敷く。
   */
  promotionPicker:
    "bg-[#e5b86a] shadow-[0_6px_14px_-4px_rgb(45_22_5/0.45),0_1px_2px_rgb(45_22_5/0.3)]",
  promotionLabel:
    "font-medium text-[#2a1b10] [text-shadow:0_0_2px_rgb(255_240_210),0_0_2px_rgb(255_240_210)]",
  /** 選んだ駒を升の約 18% 持ち上げる（390px の画面で 6px ほど）。 */
  pieceLift: "-translate-y-[18%]",
  /** 詰んだ玉は傾いたまま残す。 */
  matedPieceTilt: "-rotate-[9deg]",
} as const;
