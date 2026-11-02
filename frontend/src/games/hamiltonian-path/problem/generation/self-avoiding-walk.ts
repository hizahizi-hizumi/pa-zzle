import { listHamiltonianPathGridNeighbors } from "@/games/hamiltonian-path/puzzle/board";
import type { ProblemRandom } from "@/games/problem-seed";

/** 道を混ぜる変形の回数を、盤面のマス数の何倍にするか。 */
const MIXING_SWEEPS = 30;

/** 行ごとに向きを変えて全マスを通る蛇行の道。 */
function createSerpentinePath(size: number): number[] {
  return Array.from({ length: size }, function serpentineRow(_, row) {
    const columns = Array.from({ length: size }, (_, column) => column);
    const orderedColumns = row % 2 === 0 ? columns : columns.reverse();
    return orderedColumns.map((column) => row * size + column);
  }).flat();
}

function pickProblemValue<T>(values: readonly T[], random: ProblemRandom): T {
  return values[Math.floor(random() * values.length)]!;
}

/**
 * 道を1手だけ変形する。向きを無作為に選んだ道の末端から、無作為な隣のマスを選ぶ。
 * - 隣が道の上にあれば、末端をそのマスへつなぎ替え、その先を逆順にする（backbite）。直前のマスなら変えない。
 * - 隣が道の外にあり `allowsReptation` なら、末端をそのマスへ伸ばし、反対の端を1マス縮める（reptation）。
 *   道の長さを保ったまま道の外のマスへ動けるので、通らないマス（壁）の配置も混ざる。
 */
function mutatePath(
  path: readonly number[],
  gridNeighbors: readonly (readonly number[])[],
  random: ProblemRandom,
  allowsReptation: boolean,
): readonly number[] {
  const oriented = random() < 0.5 ? [...path].reverse() : path;
  const end = oriented.at(-1)!;
  const neighbor = pickProblemValue(gridNeighbors[end]!, random);
  const neighborPosition = oriented.indexOf(neighbor);
  if (neighborPosition < 0) {
    return allowsReptation ? [...oriented.slice(1), neighbor] : oriented;
  }
  if (neighborPosition === oriented.length - 2) {
    return oriented;
  }
  return [
    ...oriented.slice(0, neighborPosition + 1),
    ...oriented.slice(neighborPosition + 1).reverse(),
  ];
}

/**
 * 一辺 `size` の盤面で、`openCellCount` マスを1回ずつ通る無作為な自己回避路を作る。道が通らないマスは壁になる。
 * 全マスを通すなら蛇行の道から backbite だけで混ぜ、そうでなければ蛇行の道の一部から backbite と reptation で混ぜる。
 * 先頭のマスを問題の始点にする。
 */
export function createRandomSelfAvoidingWalk(
  size: number,
  openCellCount: number,
  random: ProblemRandom,
): readonly number[] {
  const cellCount = size * size;
  const gridNeighbors = Array.from({ length: cellCount }, (_, cell) =>
    listHamiltonianPathGridNeighbors(size, cell),
  );
  const serpentine = createSerpentinePath(size);
  const allowsReptation = openCellCount < cellCount;
  let path: readonly number[] = serpentine;
  if (allowsReptation) {
    const offset = Math.floor(random() * (cellCount - openCellCount + 1));
    path = serpentine.slice(offset, offset + openCellCount);
  }
  for (let step = 0; step < MIXING_SWEEPS * cellCount; step += 1) {
    path = mutatePath(path, gridNeighbors, random, allowsReptation);
  }
  return path;
}

export const _private = { createSerpentinePath, mutatePath };
