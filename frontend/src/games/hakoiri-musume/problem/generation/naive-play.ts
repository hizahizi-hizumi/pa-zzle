import {
  findHakoiriMusumeDaughterCell,
  type HakoiriMusumeStateGraph,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import {
  HAKOIRI_MUSUME_COLUMNS,
  HAKOIRI_MUSUME_GOAL_CELL,
} from "@/games/hakoiri-musume/puzzle/board";
import type { ProblemRandom } from "@/games/problem-seed";

/**
 * 素朴な解き方。見えるのは盤面だけで、正しい手も残りの手数も見えない。待ったは使わない（使っても手数は減らない）。
 * - `random`: 1手で行ける盤面を無作為に選ぶ。
 * - `greedy`: まだ見ていない盤面のうち、娘を出口へ近づける手があればそれを、無ければまだ見ていない盤面を、
 *   それも無ければ行ける盤面を無作為に選ぶ。
 * - `explore`: まだ見ていない盤面を無作為に、無ければ行ける盤面を無作為に選ぶ（試して戻る代わり）。
 */
export const hakoiriMusumeNaivePlayKinds = [
  "random",
  "greedy",
  "explore",
] as const;

export type HakoiriMusumeNaivePlayKind =
  (typeof hakoiriMusumeNaivePlayKinds)[number];

function measureDaughterDistance(board: string): number {
  const cell = findHakoiriMusumeDaughterCell(board);
  return (
    Math.abs(
      Math.floor(cell / HAKOIRI_MUSUME_COLUMNS) -
        Math.floor(HAKOIRI_MUSUME_GOAL_CELL / HAKOIRI_MUSUME_COLUMNS),
    ) +
    Math.abs(
      (cell % HAKOIRI_MUSUME_COLUMNS) -
        (HAKOIRI_MUSUME_GOAL_CELL % HAKOIRI_MUSUME_COLUMNS),
    )
  );
}

/**
 * 素朴な解き方で `start` の盤面から娘を出口の前へ運び、運べた手数を返す。`budget` 手で運べなければ `null`。
 * 解けないことは人に難しいことの根拠にならないので、最上位が押し切られていないかを確かめる向きにだけ使う。
 */
export function playHakoiriMusumeNaively(
  kind: HakoiriMusumeNaivePlayKind,
  graph: HakoiriMusumeStateGraph,
  start: number,
  random: ProblemRandom,
  budget: number,
): number | null {
  const { boards, edgeStarts, edges } = graph;
  const visited = new Set([start]);
  let current = start;
  for (let step = 1; step <= budget; step += 1) {
    const neighbors = Array.from(
      edges.subarray(edgeStarts[current]!, edgeStarts[current + 1]!),
    );
    let pool = neighbors;
    if (kind !== "random") {
      const fresh = neighbors.filter((next) => !visited.has(next));
      const forward =
        kind === "greedy"
          ? fresh.filter(
              (next) =>
                measureDaughterDistance(boards[next]!) <
                measureDaughterDistance(boards[current]!),
            )
          : [];
      pool =
        forward.length > 0 ? forward : fresh.length > 0 ? fresh : neighbors;
    }
    current = pool[Math.floor(random() * pool.length)]!;
    visited.add(current);
    if (
      findHakoiriMusumeDaughterCell(boards[current]!) ===
      HAKOIRI_MUSUME_GOAL_CELL
    ) {
      return step;
    }
  }
  return null;
}
