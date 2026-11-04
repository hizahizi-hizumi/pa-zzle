/**
 * 箱入り娘固有の色と陰影。桐の箱の中に、欅の木の駒が並ぶ姿にする。娘だけは朱漆を塗り、金で「娘」の字を入れて、ほかの駒と見分ける。
 * 箱の底は、縁と駒より暗い影の色にし、空いたマスが一目で読めるようにする。出口は箱の縁を底の色のまま切り欠いて、底が外へ抜けて見せる。
 * 光は左上の一つで、駒の面は左上が明るく、右下に落ち影を落とす。木の色はダークでも変えず、`dark:` は箱の落ち影にだけ付ける。
 * 共通UIの意味色（`primary`・`ring` 以外の状態色）は木の上に乗せない。
 */
export const hakoiriMusumeToneClassNames = {
  /** 桐の箱の縁。淡い木の色に、縦に通る細かな柾目を重ねる。 */
  boxRim:
    "bg-[#e3d1ac] bg-[repeating-linear-gradient(90deg,rgb(120_90_50/0.07)_0_1px,transparent_1px_5px),linear-gradient(160deg,#ecdcbc,#d6c196)]",
  /** 箱を置いた面に落ちる影と、縁の天面の小さな面取り。 */
  boxShadow:
    "shadow-[0_1px_1px_rgb(60_40_15/0.35),0_8px_18px_-4px_rgb(60_40_15/0.4),inset_1px_1px_0_rgb(255_250_235/0.6),inset_-1px_-1px_0_rgb(120_90_50/0.35)] dark:shadow-[0_1px_1px_rgb(0_0_0/0.7),0_10px_22px_-4px_rgb(0_0_0/0.75),inset_1px_1px_0_rgb(255_250_235/0.6),inset_-1px_-1px_0_rgb(120_90_50/0.35)]",
  /** 箱の底。縁の内側に落ちる影で、縁より低い所に見せる。 */
  boxFloor:
    "bg-[#6f5a3f] shadow-[inset_0_3px_6px_rgb(30_18_5/0.55),inset_0_0_0_1px_rgb(30_18_5/0.35)]",
  /** 出口の切り欠き。箱の底と同じ色で、縁の外まで続ける。 */
  exitOpening: "bg-[#6f5a3f] shadow-[inset_0_3px_4px_-2px_rgb(30_18_5/0.55)]",
  /** 欅の駒の面と、面取りの照り・陰、底に落ちる影。 */
  woodPiece:
    "bg-[linear-gradient(145deg,#d9ad6c,#c08a47_55%,#a8743a)] shadow-[inset_1px_1px_0_rgb(255_235_200/0.55),inset_-1px_-1px_0_rgb(80_45_10/0.45),0_2px_3px_rgb(30_18_5/0.45)]",
  /** 娘の駒。朱漆の面と、面取りの照り・陰、底に落ちる影。 */
  daughterPiece:
    "bg-[linear-gradient(145deg,#cf4a36,#a8301f_55%,#8a2416)] shadow-[inset_1px_1px_0_rgb(255_200_180/0.5),inset_-1px_-1px_0_rgb(60_10_5/0.5),0_2px_4px_rgb(30_10_5/0.5)]",
  /** 娘の駒に入れた金の字。 */
  daughterMark: "text-[#f3d488] [text-shadow:0_1px_0_rgb(70_15_5/0.6)]",
} as const;
