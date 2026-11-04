import {
  analyzeHakoiriMusumePieceSet,
  createHakoiriMusumeNearProblemFilter,
  HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
  hakoiriMusumePieceSets,
  interleaveHakoiriMusumeProblems,
} from "@/games/hakoiri-musume/problem/generation/pool-selection";

describe("hakoiriMusumePieceSets", () => {
  test("空き2〜6の駒の組を66組持つこと", () => {
    const empties = new Set(
      hakoiriMusumePieceSets.map(
        ({ vertical, horizontal, small }) =>
          16 - 2 * (vertical + horizontal) - small,
      ),
    );

    expect(hakoiriMusumePieceSets).toHaveLength(66);
    expect([...empties].sort()).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("createHakoiriMusumeNearProblemFilter", () => {
  // 横長6本だけの駒の組（全396局面）
  const space = analyzeHakoiriMusumePieceSet({
    vertical: 0,
    horizontal: 6,
    small: 0,
  });
  const { boards, edgeStarts, edges } = space.graph;
  const { optimal } = space.measures;
  const start = boards.findIndex((_, index) => optimal[index]! >= 8);

  /** `from` から `steps` 手で行ける局面のうち、ちょうど `steps` 手かかる1つ。 */
  function findAtDistance(from: number, steps: number): number {
    let frontier = [from];
    const seen = new Set(frontier);
    for (let step = 0; step < steps; step += 1) {
      const next: number[] = [];
      for (const current of frontier) {
        for (
          let edge = edgeStarts[current]!;
          edge < edgeStarts[current + 1]!;
          edge += 1
        ) {
          if (!seen.has(edges[edge]!)) {
            seen.add(edges[edge]!);
            next.push(edges[edge]!);
          }
        }
      }
      frontier = next;
    }
    return frontier[0]!;
  }

  /** `from` から最短手数が1つずつ減る向きへ `steps` 手進んだ局面（最短解の途中）。 */
  function findOnShortestPath(from: number, steps: number): number {
    let current = from;
    for (let step = 0; step < steps; step += 1) {
      for (
        let edge = edgeStarts[current]!;
        edge < edgeStarts[current + 1]!;
        edge += 1
      ) {
        if (optimal[edges[edge]!] === optimal[current]! - 1) {
          current = edges[edge]!;
          break;
        }
      }
    }
    return current;
  }

  const startBoard = boards[start]!;
  const withinReach =
    boards[findAtDistance(start, HAKOIRI_MUSUME_NEAR_MOVE_COUNT)]!;
  const onShortestPath = boards[findOnShortestPath(start, 7)]!;

  test("採った問題から決まった手数以内の局面と、最短解の途中の局面を近い問題とすること", () => {
    const filter = createHakoiriMusumeNearProblemFilter(space);
    filter.take(startBoard);

    expect(filter.isNear(startBoard)).toBe(true);
    expect(filter.isNear(withinReach)).toBe(true);
    expect(filter.isNear(onShortestPath)).toBe(true);
  });

  test("最短解の途中の局面を採ると、それを最短解の途中に持つ局面も近い問題とすること", () => {
    const filter = createHakoiriMusumeNearProblemFilter(space);
    filter.take(onShortestPath);

    expect(filter.isNear(startBoard)).toBe(true);
  });
});

describe("interleaveHakoiriMusumeProblems", () => {
  const pickedBySet = [["a1", "a2", "a3"], ["b1"], ["c1", "c2"]];

  test("駒の組を1問ずつ巡回して並べ、採り尽くした組を飛ばして決まった数で止めること", () => {
    const problems = interleaveHakoiriMusumeProblems(pickedBySet, 5);

    expect(problems).toEqual(["a1", "b1", "c1", "a2", "c2"]);
  });
});
