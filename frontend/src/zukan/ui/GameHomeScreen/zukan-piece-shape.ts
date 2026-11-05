/** ピースの1辺の形。`1` は外へ出る凸、`-1` は内へ入る凹、`0` は平ら。 */
type ZukanPieceEdge = -1 | 0 | 1;

/**
 * ピースの上・右・下・左の辺の形を `,` でつないだもの。
 * マスの再描画を避けられるよう、比べやすい文字列で持つ。
 */
export type ZukanPieceShape = string;

function hashToUnit(values: readonly number[]): number {
  let hash = 0x9e3779b9;
  for (const value of values) {
    hash = Math.imul(hash ^ value, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
  }
  return (hash >>> 0) / 2 ** 32;
}

const HORIZONTAL_EDGE = 0;
const VERTICAL_EDGE = 1;

/** 区切りの中で隣り合う2つのピースの間の辺を、上または左のピースから見た形。凸か凹を位置から決める。 */
function findInnerEdge(
  direction: typeof HORIZONTAL_EDGE | typeof VERTICAL_EDGE,
  section: number,
  row: number,
  column: number,
): ZukanPieceEdge {
  return hashToUnit([direction, section, row, column]) < 0.5 ? 1 : -1;
}

/**
 * 台紙に並べた位置のピースの形。絞り込みで分けた区切り（当たった問題と当たらなかった問題）を、それぞれ1枚のジグソーとして組む。
 * 区切りの外周だけを平らにし、ピースの間の辺は位置から凸か凹に決める。隣り合うピースは同じ辺を引くので、必ず噛み合う。
 */
export function findZukanPieceShape(
  position: number,
  matchedCount: number,
  problemCount: number,
  columnCount: number,
): ZukanPieceShape {
  const section = position < matchedCount ? 0 : 1;
  const start = section === 0 ? 0 : matchedCount;
  const sectionLength = (section === 0 ? matchedCount : problemCount) - start;
  const local = position - start;
  const row = Math.floor(local / columnCount);
  const column = local % columnCount;
  function exists(otherRow: number, otherColumn: number): boolean {
    return (
      otherRow >= 0 &&
      otherColumn >= 0 &&
      otherColumn < columnCount &&
      otherRow * columnCount + otherColumn < sectionLength
    );
  }
  return [
    exists(row - 1, column)
      ? -findInnerEdge(HORIZONTAL_EDGE, section, row - 1, column)
      : 0,
    exists(row, column + 1)
      ? findInnerEdge(VERTICAL_EDGE, section, row, column)
      : 0,
    exists(row + 1, column)
      ? findInnerEdge(HORIZONTAL_EDGE, section, row, column)
      : 0,
    exists(row, column - 1)
      ? -findInnerEdge(VERTICAL_EDGE, section, row, column - 1)
      : 0,
  ].join(",");
}

/**
 * 首のあるタブの輪郭。`u` は辺に沿った位置、`v` は外へ出る量（どちらもピースの1辺に対する比）。
 * タブが目立ちすぎないよう、外へ出る量を辺の 2 割強に抑える。
 */
const TAB_POINTS = [
  [0.372, 0.0],
  [0.42, 0.0],
  [0.436, 0.045],
  [0.408, 0.09],
  [0.364, 0.165],
  [0.42, 0.225],
  [0.5, 0.225],
  [0.58, 0.225],
  [0.636, 0.165],
  [0.592, 0.09],
  [0.564, 0.045],
  [0.58, 0.0],
  [0.628, 0.0],
] as const;

function formatPoint(x: number, y: number): string {
  return `${Number(x.toFixed(3))},${Number(y.toFixed(3))}`;
}

function edgePath(
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
  [nx, ny]: readonly [number, number],
  edge: ZukanPieceEdge,
): string {
  if (edge === 0) {
    return ` L${formatPoint(bx, by)}`;
  }
  const points = TAB_POINTS.map(([u, v]) =>
    formatPoint(
      ax + (bx - ax) * u + nx * v * edge,
      ay + (by - ay) * u + ny * v * edge,
    ),
  );
  let path = ` L${points[0]}`;
  for (let i = 1; i + 2 < points.length; i += 3) {
    path += ` C${points[i]} ${points[i + 1]} ${points[i + 2]}`;
  }
  return `${path} L${formatPoint(bx, by)}`;
}

const piecePaths = new Map<ZukanPieceShape, string>();

/**
 * ピースの輪郭の SVG パス。マスの左上を原点、1辺を 1 とする座標で描く。
 * 形は辺の組み合わせの数しかないので、同じ形には作り置いたパスを返す。
 */
export function getZukanPiecePath(shape: ZukanPieceShape): string {
  const cached = piecePaths.get(shape);
  if (cached !== undefined) {
    return cached;
  }
  const [top = 0, right = 0, bottom = 0, left = 0] = shape
    .split(",")
    .map((edge) => Number(edge) as ZukanPieceEdge);
  const path = `M0,0${edgePath([0, 0], [1, 0], [0, -1], top)}${edgePath([1, 0], [1, 1], [1, 0], right)}${edgePath([1, 1], [0, 1], [0, 1], bottom)}${edgePath([0, 1], [0, 0], [-1, 0], left)} Z`;
  piecePaths.set(shape, path);
  return path;
}

/**
 * ピースを描く SVG の `viewBox`。タブと選んだピースの囲みが収まるよう、マスの周りに半マスずつ取る。
 * この SVG は、マスの2倍の大きさでマスと中心を揃えて置く。
 */
export const ZUKAN_PIECE_VIEW_BOX = "-0.5 -0.5 2 2";

/** ピースの間の溝の太さ（ピースの1辺に対する比）。ピースの面を背景の色の線で縁取って溝にする。 */
export const ZUKAN_PIECE_GROOVE_WIDTH = 0.078;
