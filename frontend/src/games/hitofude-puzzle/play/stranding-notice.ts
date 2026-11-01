import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import {
  createHitofudePuzzleAdjacency,
  type HitofudePuzzleBoard,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import {
  findHitofudePuzzleStranding,
  isHitofudePuzzleDeadEnd,
} from "@/games/hitofude-puzzle/puzzle/rules";

/**
 * 取り残しを盤面で知らせるレベル（仮決定）。取り残しはこの先の手詰まりを示す補助（SPEC-019）。
 * レベル1〜2 は角・通路・袋小路から道が決まり、先読みは1か所だけなので、失敗が確定した道を長く引き続けないよう知らせる。
 * レベル3 以上は数手先の取り残しを読むことが挑戦なので、知らせると先読みの答えになる。
 */
const strandingNoticeDifficulties: ReadonlySet<HitofudePuzzleDifficulty> =
  new Set(["1", "2"]);

export function showsHitofudePuzzleStranding(
  difficulty: HitofudePuzzleDifficulty,
): boolean {
  return strandingNoticeDifficulties.has(difficulty);
}

type Adjacency = readonly (readonly number[])[];

/**
 * 盤面の形から決まる道の終点。始点のほかに、通れる隣が1つだけのマス。
 * 解がただ1つの問題では、終点の通れる隣は道の直前のマスだけになるので、このマスがちょうど1つある。
 * そうでない盤面（遊び方の図など）では `null`。
 */
function findBoardEndCell(
  board: HitofudePuzzleBoard,
  adjacency: Adjacency,
): number | null {
  const candidates = listHitofudePuzzleOpenCells(board).filter(
    (cell) => cell !== board.start && adjacency[cell]!.length === 1,
  );
  return candidates.length === 1 ? candidates[0]! : null;
}

/** `cells` を、`cells` の中だけをたどってつながるまとまりに分ける。 */
function listComponents(
  adjacency: Adjacency,
  cells: ReadonlySet<number>,
): Set<number>[] {
  const assigned = new Set<number>();
  const components: Set<number>[] = [];
  for (const origin of cells) {
    if (assigned.has(origin)) {
      continue;
    }
    const component = new Set([origin]);
    assigned.add(origin);
    const pending = [origin];
    for (let cell = pending.pop(); cell !== undefined; cell = pending.pop()) {
      for (const neighbor of adjacency[cell]!) {
        if (cells.has(neighbor) && !assigned.has(neighbor)) {
          assigned.add(neighbor);
          component.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

/** 先端から、未通過マスだけをたどって届くマス。先端を含む。 */
function listReachableCells(
  adjacency: Adjacency,
  head: number,
  unvisited: ReadonlySet<number>,
): Set<number> {
  return (
    listComponents(adjacency, new Set([head, ...unvisited])).find((component) =>
      component.has(head),
    ) ?? new Set([head])
  );
}

/**
 * 終点が決まっていて、先端から届くときの取り残し。残りの道は、先端から終点までの1本になる。
 * - 先端から届かないマス。
 * - 先端から届く部分で、あるマスを除くと分かれる部分のうち、先端も終点も含まない部分:
 *   出入り口がそのマス1つしか無いので、入ると出られない。道が作った袋小路や、道に囲まれて口が1つになった領域がこれに当たる。
 * どちらも、道が残した出入り口の形として盤面から読め、終点になるマスには付かない。
 */
function listStrandedCellsTowardEnd(
  adjacency: Adjacency,
  head: number,
  end: number,
  unvisited: ReadonlySet<number>,
  reachable: ReadonlySet<number>,
): Set<number> {
  const stranded = new Set(
    [...unvisited].filter((cell) => !reachable.has(cell)),
  );
  for (const gateway of reachable) {
    const rest = new Set(reachable);
    rest.delete(gateway);
    for (const component of listComponents(adjacency, rest)) {
      if (!component.has(head) && !component.has(end)) {
        for (const cell of component) {
          stranded.add(cell);
        }
      }
    }
  }
  return stranded;
}

/** 終点が盤面から決まらない、または終点にもう届かないときは、孤立マス・2つ以上の袋小路・届かないマスを挙げる。 */
function listLocallyStrandedCells(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): Set<number> {
  const stranding = findHitofudePuzzleStranding(board, path);
  return new Set(
    stranding === null
      ? []
      : [
          ...stranding.isolatedCells,
          ...stranding.deadEndCells,
          ...stranding.separatedCells,
        ],
  );
}

/**
 * 今の道のままではもう通れないマス（取り残し）を、盤面の番号順に並べる。
 * - 先端が行き止まりなら、残りのマスすべて。
 * - 盤面の形から終点が決まり、先端から届くなら、先端から届かない部分と、入ると出られない部分（`listStrandedCellsTowardEnd`）。
 *   終点の候補になる袋小路には付けず、道が新しく作った袋小路や口の1つしか無い領域だけに付ける。
 * - そうでなければ、孤立マス・2つ以上の袋小路・先端から届かないマス（`findHitofudePuzzleStranding`）。
 */
export function listHitofudePuzzleStrandedCells(
  board: HitofudePuzzleBoard,
  path: readonly number[],
): number[] {
  const head = path.at(-1);
  if (head === undefined) {
    return [];
  }
  const visited = new Set(path);
  const unvisited = new Set(
    listHitofudePuzzleOpenCells(board).filter((cell) => !visited.has(cell)),
  );
  if (isHitofudePuzzleDeadEnd(board, path)) {
    return [...unvisited];
  }
  const adjacency = createHitofudePuzzleAdjacency(board);
  const end = findBoardEndCell(board, adjacency);
  const reachable = listReachableCells(adjacency, head, unvisited);
  const stranded =
    end !== null && reachable.has(end)
      ? listStrandedCellsTowardEnd(adjacency, head, end, unvisited, reachable)
      : listLocallyStrandedCells(board, path);
  return [...stranded].sort((left, right) => left - right);
}

export const _private = { findBoardEndCell };
