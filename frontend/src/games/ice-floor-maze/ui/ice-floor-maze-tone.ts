/**
 * アイスフロア迷路固有の色。雪原に開いた凍った湖を真上から見た絵の色で、共通UIの意味色（`primary`・`ring`・`success` など）は流用しない。
 * 光は左上から当たる。氷から立ち上がるものは、上と左の縁（`…Lit`）が明るく、下と右の縁（`…Shade`）が暗い。
 * 明るさは、水面がいちばん暗く、駒、岩、氷、雪の順に明るい。白は、雪と、氷に付いた跡にだけ使う。
 */
export const iceFloorMazeTone = {
  /** 盤の周囲の雪原。 */
  snowfield: "#dfe8f1",
  /** 氷の面。 */
  ice: "#b9e0f4",
  /** 厚い氷の下の、湖の真ん中の深い水の色と、岸の近くの浅い明るさ。 */
  iceDeep: "#3f8fc8",
  iceShallow: "#ffffff",
  /** 磨かれた氷の面に渡る光。 */
  iceSheen: "#ffffff",
  /** マスの境目の、氷の継ぎ目のごく薄い線。 */
  iceJoint: "rgba(52,120,172,0.2)",
  /** 氷より低い面の、光る縁と陰になる縁。 */
  iceEdgeLit: "#e8f7fd",
  iceEdgeShade: "#74aed6",
  /** 氷から立ち上がるものが氷へ落とす影。 */
  shadow: "rgba(28,72,124,0.19)",
  /** 外壁（雪の土手）。 */
  wall: "#edf2f7",
  wallLit: "#ffffff",
  wallShade: "#9fb4ca",
  /** 外壁が氷に落とす影。 */
  wallCastShadow: "rgba(36,88,140,0.2)",
  rock: "#97a6b8",
  rockLit: "#c2ccd8",
  rockShade: "#5f7088",
  brittleRock: "#bdb4a8",
  brittleRockLit: "#e8e2d9",
  brittleRockShade: "#8c8379",
  rubble: "#a39a8e",
  thinIce: "#9ccdea",
  thinIceCrack: "#ffffff",
  water: "#2b6a9c",
  waterEdgeShade: "#1f4f78",
  wave: "rgba(214,238,250,0.9)",
  floor: "#a9cbb0",
  floorGrit: "#5d8a6b",
  snow: "#ffffff",
  snowShade: "#b7cbe0",
  snowGrain: "#cfdded",
  iceBlock: "#cfeaf8",
  iceBlockLit: "#ffffff",
  iceBlockShade: "#4a8bbd",
  piece: "#4338ca",
  pieceShade: "#241f73",
  pieceLight: "#a5b4fc",
  goal: "#f59e0b",
  goalSparkle: "#fbbf24",
  /** ゴールで止まった瞬間に、氷の面へ広がる明かり。 */
  goalGlow: "#ffffff",
  /** 駒が氷に付けた2本の擦り傷。 */
  trail: "rgba(255,255,255,0.95)",
  /** 止め役にぶつかって散る氷のかけらと、その縁。 */
  chip: "#ffffff",
  chipEdge: "rgba(56,122,180,0.8)",
} as const;
