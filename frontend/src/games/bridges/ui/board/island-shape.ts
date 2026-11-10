import type { BridgesIsland } from "@/games/bridges/puzzle/board";
import type { BoardPoint } from "@/games/bridges/ui/board/board-geometry";

/** 輪郭を決める点の数。少ないと角張り、多いと円に戻る。 */
const OUTLINE_POINT_COUNT = 9;
/** 半径を揺らす幅の割合。数字を収める陸の広さを保ちつつ、円盤やボタンに見えない程度に崩す。 */
export const ISLAND_OUTLINE_WOBBLE = 0.07;

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
 * 島の陸の輪郭の、SVG の path の `d`。中心 `center` から半径 `radius` を位置で決まる倍率で揺らした点を、
 * 滑らかな閉じた曲線（Catmull-Rom を3次ベジェにしたもの）で結ぶ。陸・浅瀬・草地は同じ島で同じ倍率を使い、相似な形にする。
 */
export function getIslandOutlinePath(
  island: BridgesIsland,
  center: BoardPoint,
  radius: number,
): string {
  const scales = listIslandOutlineScales(island);
  const rotation = ((island.row * 7 + island.column * 3) % 10) / 10;
  const points = scales.map((scale, index) => {
    const angle = ((index + rotation) / scales.length) * 2 * Math.PI;
    return {
      x: center.x + Math.cos(angle) * radius * scale,
      y: center.y + Math.sin(angle) * radius * scale,
    };
  });
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
