import { classifyHakoiriMusumeFeatures } from "@/games/hakoiri-musume/difficulty";
import { readHakoiriMusumeDifficultyFeatures } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  analyzeHakoiriMusumePieceSet,
  createHakoiriMusumeNearProblemFilter,
  HAKOIRI_MUSUME_MERGE_SHARE,
  HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
  hakoiriMusumePieceSets,
  interleaveHakoiriMusumeProblems,
  listHakoiriMusumeCandidates,
  pickHakoiriMusumePieceSetProblems,
} from "@/games/hakoiri-musume/problem/generation/pool-selection";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";

describe("hakoiriMusumePieceSets", () => {
  test("空き2〜6の駒の組を82組持つこと", () => {
    const empties = new Set(
      hakoiriMusumePieceSets.map(
        ({ vertical, horizontal, small }) =>
          16 - 2 * (vertical + horizontal) - small,
      ),
    );

    expect(hakoiriMusumePieceSets).toHaveLength(82);
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

  function listNeighbors(from: number): number[] {
    return Array.from(
      { length: edgeStarts[from + 1]! - edgeStarts[from]! },
      (_, offset) => edges[edgeStarts[from]! + offset]!,
    );
  }

  /** `from` の最短解の上にある局面（`from` を含む）。 */
  function listShortestDescendants(from: number): Set<number> {
    const reached = new Set([from]);
    const stack = [from];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const next of listNeighbors(current)) {
        if (optimal[next] === optimal[current]! - 1 && !reached.has(next)) {
          reached.add(next);
          stack.push(next);
        }
      }
    }
    return reached;
  }

  /** `from` から近い問題とみなす手数以内で行ける局面。 */
  function listWithinNearMoves(from: number): Set<number> {
    const reached = new Set([from]);
    let frontier = [from];
    for (let step = 0; step < HAKOIRI_MUSUME_NEAR_MOVE_COUNT; step += 1) {
      frontier = frontier.flatMap((current) =>
        listNeighbors(current).filter((next) => {
          const isNew = !reached.has(next);
          reached.add(next);
          return isNew;
        }),
      );
    }
    return reached;
  }

  /** `start` と手数でも最短解の上でも離れた候補ごとの、最短解が合流してからの手数の、短い方の最短手数に対する割合。 */
  function listMergeShares(): { board: number; share: number }[] {
    const startDescendants = listShortestDescendants(start);
    const withinReach = listWithinNearMoves(start);
    return boards.flatMap((_, board) => {
      const descendants = listShortestDescendants(board);
      if (
        optimal[board]! <= 0 ||
        withinReach.has(board) ||
        startDescendants.has(board) ||
        descendants.has(start)
      ) {
        return [];
      }
      const tail = Math.max(
        ...[...descendants]
          .filter((reached) => startDescendants.has(reached))
          .map((reached) => optimal[reached]!),
      );
      return [
        {
          board,
          share: tail / Math.min(optimal[board]!, optimal[start]!),
        },
      ];
    });
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

  test("最短解が合流してからの手数が、短い方の最短手数の決まった割合以上の局面だけを近い問題とすること", () => {
    const shares = listMergeShares();
    const filter = createHakoiriMusumeNearProblemFilter(space);
    filter.take(startBoard);
    const misjudged = shares.filter(
      ({ board, share }) =>
        filter.isNear(boards[board]!) !== share >= HAKOIRI_MUSUME_MERGE_SHARE,
    );

    expect(
      shares.some(({ share }) => share >= HAKOIRI_MUSUME_MERGE_SHARE),
    ).toBe(true);
    expect(shares.some(({ share }) => share < HAKOIRI_MUSUME_MERGE_SHARE)).toBe(
      true,
    );
    expect(misjudged).toEqual([]);
  });
});

describe("pickHakoiriMusumePieceSetProblems", () => {
  // 調査コードが同じ規則と順で採った数。状態の数が少ない駒の組だけを確かめる。
  const cases = reference.pieceSets.filter(({ states }) => states <= 20_000);

  test.each(cases)(
    "近い問題を除いて採る数が、レベルごとに調査コードと一致すること: $pieceSet",
    ({ pieceSet, picked }) => {
      const space = analyzeHakoiriMusumePieceSet(pieceSet);
      const problems = pickHakoiriMusumePieceSetProblems(
        space,
        listHakoiriMusumeCandidates(space, reference.seed),
        reference.seed,
        reference.packingRule.limit,
      );
      const counts = Object.fromEntries(
        Object.entries(problems).flatMap(([level, levelProblems]) =>
          levelProblems.length > 0 ? [[level, levelProblems.length]] : [],
        ),
      );

      expect(counts).toEqual(picked);
    },
  );

  test("調査コードと同じ近さの規則であること", () => {
    expect(reference.packingRule).toMatchObject({
      nearMoveCount: HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
      mergeShare: HAKOIRI_MUSUME_MERGE_SHARE,
    });
  });
});

describe("interleaveHakoiriMusumeProblems", () => {
  const pickedBySet = [["a1", "a2", "a3"], ["b1"], ["c1", "c2"]];

  test("駒の組を1問ずつ巡回して並べ、採り尽くした組を飛ばして決まった数で止めること", () => {
    const problems = interleaveHakoiriMusumeProblems(pickedBySet, 5);

    expect(problems).toEqual(["a1", "b1", "c1", "a2", "c2"]);
  });
});

describe("listHakoiriMusumeCandidates", () => {
  const smallSets = reference.pieceSets.filter(({ states }) => states <= 5_000);

  describe.each(smallSets)(
    "駒の組 $pieceSet の場合",
    ({ pieceSet, candidates: candidateCount, status }) => {
      const fixtures = reference.fixtures.filter(({ board }) => {
        const counts = { v: 0, h: 0, s: 0 };
        for (const character of board) {
          if (character in counts)
            counts[character as keyof typeof counts] += 1;
        }
        return (
          counts.v === pieceSet.vertical &&
          counts.h === pieceSet.horizontal &&
          counts.s === pieceSet.small
        );
      });

      test("左右反転を除いた候補の数と、分類の状態ごとの数が調査コードと一致すること", () => {
        const candidates = listHakoiriMusumeCandidates(
          analyzeHakoiriMusumePieceSet(pieceSet),
          reference.seed,
        );
        const counts: Record<string, number> = {};
        for (const { assessment } of candidates) {
          const key =
            assessment.status === "classified"
              ? assessment.difficulty
              : assessment.status === "out-of-range"
                ? assessment.reason
                : assessment.status;
          counts[key] = (counts[key] ?? 0) + 1;
        }

        expect(candidates).toHaveLength(candidateCount);
        expect(counts).toEqual(status);
      });

      test("調査コードの標本の局面が、同じ特徴とレベルになること", () => {
        const space = analyzeHakoiriMusumePieceSet(pieceSet);
        const mismatches = fixtures.filter(({ board, features, level }) => {
          const actual = readHakoiriMusumeDifficultyFeatures(
            space.measures,
            space.graph.indexByBoard.get(board)!,
            space.emptyCellCount,
          );
          const assessment = classifyHakoiriMusumeFeatures(actual);
          return (
            Object.entries(features).some(
              ([key, value]) => actual[key as keyof typeof actual] !== value,
            ) ||
            assessment.status !== "classified" ||
            assessment.difficulty !== String(level)
          );
        });

        expect(mismatches).toEqual([]);
      });
    },
  );
});
