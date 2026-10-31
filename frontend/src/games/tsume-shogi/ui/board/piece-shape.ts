import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";

/**
 * 実物の駒と盤の比率。座標はすべて 0.1mm 単位で、実物の寸法をそのまま使う。
 * - 盤の1升は横 35.2mm・縦 38.6mm（縦/横 ≒ 1.097）。駒が縦長なので升も縦長にする。
 * - 駒は駒種ごとに高さと底辺の幅が違う（玉 31.5×28mm … 歩 27×22.5mm）。成った駒は元の駒の大きさのまま。
 * - 五角形は底角 81°・肩 117°・頂点 144°。高さと底辺の幅が決まると、肩の位置は角度から決まる。
 */
export const TSUME_SHOGI_SQUARE_WIDTH = 352;
export const TSUME_SHOGI_SQUARE_HEIGHT = 386;

const BASE_ANGLE_DEGREES = 81;
const APEX_ANGLE_DEGREES = 144;
/** 面取りの幅。輪郭からこれだけ内側を平らな面にする。 */
const CHAMFER = 9;

type PieceBody = { height: number; width: number };

const kingBody = { height: 315, width: 280 };
const rookBody = { height: 305, width: 270 };
const goldBody = { height: 295, width: 260 };
const knightBody = { height: 285, width: 250 };
const lanceBody = { height: 280, width: 230 };
const pawnBody = { height: 270, width: 225 };

const pieceBodies = {
  king: kingBody,
  rook: rookBody,
  bishop: rookBody,
  dragon: rookBody,
  horse: rookBody,
  gold: goldBody,
  silver: goldBody,
  promSilver: goldBody,
  knight: knightBody,
  promKnight: knightBody,
  lance: lanceBody,
  promLance: lanceBody,
  pawn: pawnBody,
  promPawn: pawnBody,
} as const satisfies Record<TsumeShogiPieceType, PieceBody>;

/**
 * 字の外接矩形の中心の、頂点からの高さ。字は面の内側に余白を取って収まる位置に置く（字形は `piece-glyph-paths.ts`）。
 */
const glyphCenterYs = {
  king: 194.9,
  rook: 184,
  bishop: 178.2,
  gold: 180.7,
  silver: 177,
  knight: 174.6,
  lance: 178.5,
  pawn: 167.1,
  dragon: 186.8,
  horse: 179.2,
  promSilver: 180.7,
  promKnight: 169.2,
  promLance: 178.5,
  promPawn: 140.1,
} as const satisfies Record<TsumeShogiPieceType, number>;

type Point = readonly [x: number, y: number];

/** 頂点を (0, 0)、底辺を y = 高さに置き、x = 0 を中心にした五角形。時計回り（y は下向き）。 */
function createOutline({ height, width }: PieceBody): Point[] {
  const baseSlope = 1 / Math.tan((BASE_ANGLE_DEGREES * Math.PI) / 180);
  const roofSlope = Math.tan(
    ((180 - APEX_ANGLE_DEGREES) / 2) * (Math.PI / 180),
  );
  const shoulderFromBase =
    (height - (width / 2) * roofSlope) / (1 - baseSlope * roofSlope);
  const shoulderX = width / 2 - baseSlope * shoulderFromBase;
  const shoulderY = height - shoulderFromBase;
  return [
    [0, 0],
    [shoulderX, shoulderY],
    [width / 2, height],
    [-width / 2, height],
    [-shoulderX, shoulderY],
  ];
}

/** 凸多角形の各辺を `distance` だけ内側へ平行に移した多角形。 */
function insetPolygon(points: readonly Point[], distance: number): Point[] {
  const edges = points.map(([x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    return {
      x: x1 - (dy / length) * distance,
      y: y1 + (dx / length) * distance,
      dx,
      dy,
    };
  });
  return edges.map((edge, index) => {
    const previous = edges.at(index - 1)!;
    const t =
      ((edge.x - previous.x) * edge.dy - (edge.y - previous.y) * edge.dx) /
      (previous.dx * edge.dy - previous.dy * edge.dx);
    return [previous.x + previous.dx * t, previous.y + previous.dy * t];
  });
}

function toPath(points: readonly Point[]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z`;
}

/** 上下を返した形。玉方の駒は頂点を下にして置く。 */
function flip(points: readonly Point[], height: number): Point[] {
  return points.map(([x, y]) => [x, height - y]);
}

/**
 * 駒の形。`outline` は外形、`face` は面取りの内側の面、`glyphCenterY` は字の中心の高さ。
 * `defender*` は玉方の向き（頂点を下）にした形。
 */
export type TsumeShogiPieceShape = {
  height: number;
  outline: string;
  face: string;
  defenderOutline: string;
  defenderFace: string;
  glyphCenterY: number;
};

function createPieceShape(type: TsumeShogiPieceType): TsumeShogiPieceShape {
  const body = pieceBodies[type];
  const outline = createOutline(body);
  const face = insetPolygon(outline, CHAMFER);
  return {
    height: body.height,
    outline: toPath(outline),
    face: toPath(face),
    defenderOutline: toPath(flip(outline, body.height)),
    defenderFace: toPath(flip(face, body.height)),
    glyphCenterY: glyphCenterYs[type],
  };
}

export const tsumeShogiPieceShapes = Object.fromEntries(
  Object.keys(pieceBodies).map((type) => [
    type,
    createPieceShape(type as TsumeShogiPieceType),
  ]),
) as Record<TsumeShogiPieceType, TsumeShogiPieceShape>;
