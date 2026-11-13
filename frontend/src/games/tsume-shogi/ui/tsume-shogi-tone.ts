/**
 * 詰将棋固有の色と陰影。盤は榧、駒は柘植の彫駒で、升を歪めない天面の手前に盤と駒の側面を見せて描き、共通UIの意味色（`primary`・`ring`・`success` など）は
 * 木の上に乗せない。状態は木の焼け色（木の色相で暗い、低い濃さの重ね）と、駒の高さ・傾き・照りで示す。
 * 光は左上の一つで、照りは左上から差し、影は右下に落ちる。盤と駒はダークでも木のままにし、`dark:` は周りとの境（影）と
 * 画面の地、木の外に書く文字にだけ付ける。
 */
export const tsumeShogiToneClassNames = {
  /** 盤の天面の、木目の画像の平均の色。画像が読み込まれる前の盤と、木目を省く小さな図の盤に使う。 */
  boardSurface: "bg-[#e5b86a]",
  /**
   * 盤を置いた面に落ちる影。縁の直下の濃い接地影と、下へ厚く広がる大きく柔らかい落ち影で、盤を卓に置いて見せる。
   */
  boardShadow:
    "shadow-[0_1px_1px_rgb(50_28_8/0.4),0_6px_10px_-2px_rgb(45_22_5/0.35),0_22px_40px_-6px_rgb(45_22_5/0.45)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.8),0_8px_14px_rgb(0_0_0/0.7),0_26px_48px_rgb(0_0_0/0.8)]",
  /** 盤の天面の、左上からのごく弱い照りと、四辺へ向かうわずかな暗がり。 */
  boardSheen:
    "bg-[radial-gradient(ellipse_at_28%_18%,rgb(255_247_222/0.18),rgb(255_247_222/0)_55%),radial-gradient(ellipse_at_50%_50%,rgb(0_0_0/0)_62%,rgb(70_38_8/0.12)_100%)]",
  /** 天面の小さな面取り。左上の辺が光を受け、右下の辺が陰になる。 */
  boardChamfer:
    "shadow-[inset_1px_1px_0_rgb(255_244_214/0.5),inset_-1px_-1px_0_rgb(95_55_18/0.45)]",
  /**
   * 盤の手前の側面。光の当たらない面なので天面より暗くし、下へ向かってさらに暗くする。
   * 天面との稜線は細く光らせ、卓に接する下の縁は締める。
   */
  boardSide:
    "bg-[linear-gradient(rgb(96_56_14/0.34),rgb(70_38_8/0.56))] shadow-[inset_0_1px_0_rgb(255_240_205/0.45),inset_0_-1px_0_rgb(50_26_6/0.55),inset_1px_0_0_rgb(255_240_205/0.2),inset_-1px_0_0_rgb(50_26_6/0.3)]",
  /** 黒漆の罫線と星。茶を含んだ黒で、罫線は木目を消さない濃さに抑える。外枠も内側と同じ線。 */
  boardLine: "border-[#2a1b10]/70",
  /** 盤の一部を切り出した図の、本当の盤の端。盤の外枠と同じ色。 */
  boardEdge: "border-[#2a1b10]/80",
  boardStar: "bg-[#2a1b10]",
  /** 筋・段は盤の木の縁に墨で書く。 */
  coordinate: "text-[#4a3220]",
  /** 遊び方の駒の動きの図の、罫線と、動ける先の印。 */
  figureLine: "stroke-[#2a1b10]/55",
  figureMark: "fill-[#2a1b10] stroke-[#2a1b10]",
  /** プレイ領域の地。座卓の面のような低彩度の色で、ライトとダークで明度だけ変える。盤が白い地から切り抜かれて見えないようにする。 */
  tableSurface: "bg-[#bbc09e] dark:bg-[#2b2b20]",
  /** 駒台の天面の、木目の画像の平均の色。 */
  komadaiSurface: "bg-[#d4a65c]",
  /** 駒台の手前の側面。天板は薄いので、盤の側面より細くする。 */
  komadaiSide: "border-b-[3px] border-b-[#8f6226]",
  /** 駒台。盤と同じ材で一段暗い、四角い天板。盤から離して置き、自分の落ち影を落とす。 */
  komadaiShadow:
    "shadow-[0_1px_1px_rgb(50_28_8/0.4),0_5px_9px_-2px_rgb(45_22_5/0.4),0_14px_24px_-6px_rgb(45_22_5/0.35),inset_1px_1px_0_rgb(255_240_205/0.4),inset_-1px_-1px_0_rgb(90_50_12/0.4)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.8),0_6px_12px_rgb(0_0_0/0.7),0_16px_28px_rgb(0_0_0/0.7),inset_1px_1px_0_rgb(255_240_205/0.35),inset_-1px_-1px_0_rgb(90_50_12/0.4)]",
  /** 持駒の枚数。駒に重ねず、駒台の木の上に墨で書く。 */
  handCount: "text-[#3b230b]",
  /** 玉方の持駒の札。木の外の地に、盤の筋・段と同じ書体と墨の濃さで小さく出す。 */
  pieceBoxLabel: "text-[#5a4632] dark:text-[#cbb79c]",
  /**
   * 駒の面。盤の榧より一段明るい淡い金色の柘植で、盤から形を浮かせる。柾目と虎斑をごく淡く重ねる。
   * 盤より暗い飴色にすると、濁った茶に見えて汚れた駒に見える。
   */
  pieceFace: "fill-[#f3d68a]",
  /** 面取りの光を受ける辺と面の明るい側、面取りの陰になる辺と面の暗い側、面の左上に乗るつや。 */
  pieceEdgeLight: "[stop-color:#fff4d8]",
  pieceShade: "[stop-color:#6e4518]",
  pieceSpecular: "[stop-color:#fff6dc]",
  /** 手前に見える側面。面より一段暗い柘植。 */
  pieceSide: "fill-[#c79a4a]",
  /** 側面の下の縁。盤に接する稜線を細く締める。 */
  pieceSideEdge: "stroke-[#7a5220]/50",
  pieceShadow: "fill-[#2d1605]",
  /** 小さな図の駒の輪郭。小さいと面取りが見えないので、細い線で地から分ける。 */
  miniaturePieceOutline: "stroke-[#7a5224]/45",
  /**
   * 彫って漆を入れた字。溝の底の漆は暗い茶黒（成駒は朱漆）で、光の差す上を明るくして漆の艶を出す。
   * 溝の左上の壁は陰（`*Groove`）、溝の右下の縁は光を受ける（`glyphRim`）。線に足す太さの分は、溝の縁を漆の色、
   * 光を受ける縁を同じ淡い色で外へ広げる。
   */
  inkTop: "[stop-color:#4a3628]",
  inkMiddle: "[stop-color:#20150d]",
  inkBottom: "[stop-color:#120b06]",
  vermilionTop: "[stop-color:#e87a55]",
  vermilionMiddle: "[stop-color:#bd4024]",
  vermilionBottom: "[stop-color:#962d17]",
  /** 艶を描かない字（小さな図と、塗りを参照できない所）。 */
  inkFlat: "fill-[#20150d]",
  vermilionFlat: "fill-[#bd4024]",
  inkGroove: "fill-[#080402] stroke-[#20150d]",
  vermilionGroove: "fill-[#6a1c0c] stroke-[#bd4024]",
  glyphRim: "fill-[#fff8e6] stroke-[#fff8e6]",
  /**
   * 選んだ駒の升。木の焼け色の濃い地と、升の内側の墨の縁で、指先の下でも選んだ升と分かるようにし、駒も持ち上げる。
   */
  squareSelected: "bg-[#6e4214]/50 shadow-[inset_0_0_0_3px_rgb(42_27_16/0.9)]",
  /** 直前の手の移動先。低い濃さの暖色の焼け色。 */
  squareLastMove: "bg-[#c8742a]/22",
  /** 誤王手への玉方の反証。直前の手より濃い焦げ茶の焼け色を升の縁へ向けて濃くし、直前の手と見分ける。 */
  squareRefutation:
    "bg-[radial-gradient(circle_at_50%_50%,rgb(110_60_20/0.18),rgb(80_40_10/0.42)_95%)]",
  /** 着手させなかった入力を返す間だけ、選んだ駒の升を変える朱の焦げ色。選んだ升の地より赤く濃くし、縁も朱にする。 */
  squareRejected: "bg-[#a8340f]/45 shadow-[inset_0_0_0_2px_rgb(150_40_10/0.9)]",
  handSelected: "bg-[#6e4214]/46 shadow-[inset_0_0_0_3px_rgb(42_27_16/0.85)]",
  /** 着手させなかった入力を返す間の、選んだ持駒の地。`squareRejected` と同じ色。 */
  handRejected: "bg-[#a8340f]/45 shadow-[inset_0_0_0_2px_rgb(150_40_10/0.9)]",
  /** 駒台の持駒を指したときの地。選んだ持駒の地（`handSelected`）は上書きしない。 */
  handHover: "not-aria-disabled:not-aria-pressed:hover:bg-[#3b230b]/10",
  /** 棋譜の行は木の外の地に書く。反証は赤字にせず、墨の淡い色で示す。 */
  refutationText: "text-[#6b5a48] dark:text-[#b8a690]",
  /**
   * この手数では詰まないことの知らせ。墨の札に淡い柘植色の字で書き、明るい卓でも暗い卓でも、木の上でも面として読める
   * ように、札の外へ淡い縁と落ち影を付ける。
   */
  refutationNotice:
    "bg-[#20150d]/92 text-[#fff4d8] shadow-[0_0_0_1.5px_rgb(255_244_216/0.55),0_6px_14px_-4px_rgb(20_10_2/0.6)]",
  /** 知らせの添え書き（待ったで戻ること）。札の上で一段淡くする。 */
  refutationNoticeHint: "text-[#e8d2a8]",
  /** この手数では詰まなくなった間に待ったを囲む、朱漆の色の太い輪。待ったから間を空けて置く。 */
  undoAttentionRing: "border-4 border-[#bd4024] dark:border-[#e87a55]",
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
  /**
   * 詰みの波で、升に一度だけ差す盤の照り。明るい照りだけでは木目の上で見分けにくいので、照りの外側に焦げ茶の縁を混ぜ、
   * 明暗の対比で波の先頭を見せる。
   */
  clearGlow:
    "bg-[radial-gradient(circle_at_50%_50%,rgb(255_250_228/0.95)_0%,rgb(255_238_186/0.75)_40%,rgb(84_42_8/0.55)_68%,rgb(84_42_8/0)_92%)]",
  /** 詰めた駒と詰んだ玉の升に一瞬出す輪。白い内輪と墨の外輪の二重にする。 */
  clearRing:
    "shadow-[0_0_0_3px_rgb(255_250_236),0_0_0_6px_rgb(32_20_10),inset_0_0_0_2px_rgb(32_20_10/0.6)]",
  /** 詰んだ瞬間に盤の上へ打ち出す「詰み」の字。淡い字に墨の太い縁を付け、木目の上でも卓の上でも読めるようにする。 */
  clearStamp:
    "text-[#fff6dc] [paint-order:stroke_fill] [-webkit-text-stroke:0.14em_#20150d] [text-shadow:0_0.06em_0.18em_rgb(20_10_2/0.6)]",
  /** 詰んだ玉は傾いたまま残す。 */
  matedPieceTilt: "-rotate-[9deg]",
} as const;
