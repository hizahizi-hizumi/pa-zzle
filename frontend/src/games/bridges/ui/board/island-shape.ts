import type { BridgesIsland } from "@/games/bridges/puzzle/board";
import type { BoardPoint } from "@/games/bridges/ui/board/board-geometry";

/** 輪郭を決める点の数。少ないと角張り、多いと円に戻る。 */
const OUTLINE_POINT_COUNT = 9;
/**
 * 半径を揺らす幅の割合。数字を収める陸の広さ（最も狭い所で半径の 92%）を保ちつつ、10×10 のスマホでも輪郭の出入りが 2〜3px 見え、
 * 円盤や駒に見えない程度に崩す。中心は重心で戻すので、島の並びは縦横にそろって読める。
 */
export const ISLAND_OUTLINE_WOBBLE = 0.08;

/**
 * 島の位置から決まる 0 以上 1 未満の値の列。同じ島はいつも同じ輪郭になり、隣の島とは形がそろわない。
 * 盤面ごとの乱数ではなく行と列だけから決めるので、待った・盤面を戻すで形が変わらない。
 */
function createPositionNoise({ row, column }: BridgesIsland): () => number {
  let state = (row * 73_856_093) ^ (column * 19_349_663) ^ 0x5bd1e995;
  return function next() {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d);
    state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
    state ^= state >>> 15;
    return (state >>> 0) / 2 ** 32;
  };
}

/** 島の輪郭の点の、中心からの半径の倍率。`1 ± ISLAND_OUTLINE_WOBBLE` に収まる。 */
export function listIslandOutlineScales(island: BridgesIsland): number[] {
  const next = createPositionNoise(island);
  return Array.from(
    { length: OUTLINE_POINT_COUNT },
    () => 1 + (next() * 2 - 1) * ISLAND_OUTLINE_WOBBLE,
  );
}

/**
 * 島の陸の輪郭を決める点。中心 `center` から半径 `radius` を位置で決まる倍率で揺らした点を、点の囲む形の重心が
 * `center` に重なるようにずらす。輪郭が揺れても島の中心はマスの中心から動かず、縦横の並びがそろって見える。
 */
export function listIslandOutlinePoints(
  island: BridgesIsland,
  center: BoardPoint,
  radius: number,
): BoardPoint[] {
  const scales = listIslandOutlineScales(island);
  const rotation = ((island.row * 7 + island.column * 3) % 10) / 10;
  const offsets = scales.map((scale, index) => {
    const angle = ((index + rotation) / scales.length) * 2 * Math.PI;
    return {
      x: Math.cos(angle) * radius * scale,
      y: Math.sin(angle) * radius * scale,
    };
  });
  let area = 0;
  let sumX = 0;
  let sumY = 0;
  for (const [index, point] of offsets.entries()) {
    const next = offsets[(index + 1) % offsets.length]!;
    const cross = point.x * next.y - next.x * point.y;
    area += cross / 2;
    sumX += (point.x + next.x) * cross;
    sumY += (point.y + next.y) * cross;
  }
  const centroid = { x: sumX / (6 * area), y: sumY / (6 * area) };
  return offsets.map(({ x, y }) => ({
    x: center.x + x - centroid.x,
    y: center.y + y - centroid.y,
  }));
}

/**
 * 島の陸の輪郭の、SVG の path の `d`。`listIslandOutlinePoints` の点を、滑らかな閉じた曲線（Catmull-Rom を3次ベジェにしたもの）で
 * 結ぶ。陸・浅瀬・草地は同じ島で同じ倍率を使い、相似な形にする。
 */
export function getIslandOutlinePath(
  island: BridgesIsland,
  center: BoardPoint,
  radius: number,
): string {
  const points = listIslandOutlinePoints(island, center, radius);
  const at = (index: number) =>
    points[(index + points.length) % points.length]!;
  const format = (value: number) => Number(value.toFixed(4));
  const segments = points.map((point, index) => {
    const previous = at(index - 1);
    const next = at(index + 1);
    const afterNext = at(index + 2);
    const control1 = {
      x: point.x + (next.x - previous.x) / 6,
      y: point.y + (next.y - previous.y) / 6,
    };
    const control2 = {
      x: next.x - (afterNext.x - point.x) / 6,
      y: next.y - (afterNext.y - point.y) / 6,
    };
    return `C${format(control1.x)} ${format(control1.y)} ${format(control2.x)} ${format(control2.y)} ${format(next.x)} ${format(next.y)}`;
  });
  return `M${format(points[0]!.x)} ${format(points[0]!.y)}${segments.join("")}Z`;
}
