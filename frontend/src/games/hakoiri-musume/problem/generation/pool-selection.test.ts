import { classifyHakoiriMusumeFeatures } from "@/games/hakoiri-musume/difficulty";
import { readHakoiriMusumeDifficultyFeatures } from "@/games/hakoiri-musume/problem/difficulty-analysis";
import {
  analyzeHakoiriMusumePieceSet,
  createHakoiriMusumeNearProblemFilter,
  HAKOIRI_MUSUME_MERGE_SHARE,
  HAKOIRI_MUSUME_NEAR_MOVE_COUNT,
  hakoiriMusumePieceSets,
  interleaveHakoiriMusumeProblems,
  isHakoiriMusumeSelectable,
  listHakoiriMusumeCandidates,
  measureHakoiriMusumeSetupRun,
  rankHakoiriMusumeCandidateTiers,
  readHakoiriMusumeStartShape,
} from "@/games/hakoiri-musume/problem/generation/pool-selection";
import reference from "@/games/hakoiri-musume/problem/generation/research-reference.json";
import { mirrorHakoiriMusumeBoard } from "@/games/hakoiri-musume/problem/generation/state-space";

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

  const startDescendants = listShortestDescendants(start);
  const startWithinReach = listWithinNearMoves(start);

  /**
   * 局面 `board` の `start` との近さ。手数でも最短解の上でも近ければ `"close"`、離れていれば最短解が合流してからの手数の、
   * 短い方の最短手数に対する割合、出口へ運べない局面は `null`。
   */
  function measureCloseness(board: number): "close" | number | null {
    if (optimal[board]! <= 0) {
      return null;
    }
    const descendants = listShortestDescendants(board);
    if (
      startWithinReach.has(board) ||
      startDescendants.has(board) ||
      descendants.has(start)
    ) {
      return "close";
    }
    const tail = Math.max(
      ...[...descendants]
        .filter((reached) => startDescendants.has(reached))
        .map((reached) => optimal[reached]!),
    );
    return tail / Math.min(optimal[board]!, optimal[start]!);
  }

  function isCloseToStart(closeness: "close" | number | null): boolean {
    return (
      closeness === "close" ||
      (typeof closeness === "number" && closeness >= HAKOIRI_MUSUME_MERGE_SHARE)
    );
  }

  function mirrorOf(board: number): number {
    return space.graph.indexByBoard.get(
      mirrorHakoiriMusumeBoard(boards[board]!),
    )!;
  }

  /**
   * `start` と手数でも最短解の上でも離れた候補ごとの、合流の割合と、近い問題とみなすべきか。候補の左右反転が `start` に近ければ、
   * 候補は `start` の左右反転に近いので、近い問題とみなす。
   */
  function listMergeShares(): {
    board: number;
    share: number;
    expectedNear: boolean;
  }[] {
    return boards.flatMap((_, board) => {
      const closeness = measureCloseness(board);
      if (typeof closeness !== "number") {
        return [];
      }
      return [
        {
          board,
          share: closeness,
          expectedNear:
            isCloseToStart(closeness) ||
            isCloseToStart(measureCloseness(mirrorOf(board))),
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

  test("採った問題の左右反転から決まった手数以内の局面と、その最短解の途中の局面も近い問題とすること", () => {
    const filter = createHakoiriMusumeNearProblemFilter(space);
    filter.take(startBoard);

    expect(filter.isNear(mirrorHakoiriMusumeBoard(withinReach))).toBe(true);
    expect(filter.isNear(mirrorHakoiriMusumeBoard(onShortestPath))).toBe(true);
  });

  /** 局面 `taken` とその左右反転のどちらとも、手数でも最短解の上でも離れた局面の1つ。 */
  function findUnrelated(taken: number): number {
    const relatedTo = (from: number) => {
      const within = listWithinNearMoves(from);
      const descendants = listShortestDescendants(from);
      return (board: number) =>
        within.has(board) ||
        descendants.has(board) ||
        listShortestDescendants(board).has(from);
    };
    const checks = [relatedTo(taken), relatedTo(mirrorOf(taken))];
    return boards.findIndex(
      (_, board) =>
        optimal[board]! > 0 && checks.every((isRelated) => !isRelated(board)),
    );
  }

  const unrelatedToOnShortestPath =
    boards[findUnrelated(findOnShortestPath(start, 7))]!;

  test("上のレベルの問題として採った問題からは、手数以内の局面と、片方の最短解の途中にもう片方がある局面を近いとすること", () => {
    const filter = createHakoiriMusumeNearProblemFilter(space);
    filter.take(onShortestPath);

    expect(filter.isNearOrOnShortestSolution(unrelatedToOnShortestPath)).toBe(
      false,
    );
    expect(
      filter.isNearOrOnShortestSolution(boards[findOnShortestPath(start, 9)]!),
    ).toBe(true);
    expect(filter.isNearOrOnShortestSolution(startBoard)).toBe(true);
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
      ({ board, expectedNear }) =>
        filter.isNear(boards[board]!) !== expectedNear,
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

describe("readHakoiriMusumeStartShape", () => {
  const cases = [
    [
      "横刀立馬（左右対称、空きが下の段で2か所、3種類の駒）",
      "vAAvwAAwvhivwssws..s",
      { daughterRow: 0, daughterColumn: 1, smallCount: 4, tidiness: 3 },
    ],
    [
      "娘が3段目の左にあり、左右対称ではない",
      "vs.vwshiAAvsAAwshihi",
      { daughterRow: 2, daughterColumn: 0, smallCount: 4, tidiness: 2 },
    ],
  ] as const;

  test.each(cases)(
    "娘の位置・小駒の数・整いを読むこと: %s",
    (_, board, expected) => {
      const shape = readHakoiriMusumeStartShape(board);

      expect(shape).toEqual(expected);
    },
  );
});

describe("isHakoiriMusumeSelectable", () => {
  const features = {
    optimalMoveCount: 40,
    preparationLength: 31,
    shortestPreparationLength: 31,
    daughterDetourCount: 2,
    emptyCellCount: 2,
    lureCount: 0,
    daughterMoveCount: 0,
    optimalFirstMoveCount: 0,
    firstMoveCount: 0,
  };
  const cases = [
    [
      "娘が上の段から始まるレベル5",
      "5",
      "vAAvwAAwvhivwssws..s",
      features,
      true,
    ],
    [
      "娘が3段目から始まるレベル5",
      "5",
      "vs.vwshiAAvsAAwshihi",
      features,
      false,
    ],
    [
      "小駒が7個以上",
      "3",
      "sAAssAAssss.hihihi..",
      { ...features, optimalMoveCount: 30 },
      false,
    ],
    [
      "最短18手を超えるレベル1",
      "1",
      "vAAvwAAwv..vwhiws..s",
      { ...features, optimalMoveCount: 19, emptyCellCount: 4 },
      false,
    ],
    [
      "最短40手を超えるレベル3",
      "3",
      "vAAvwAAwvhivwssws..s",
      { ...features, optimalMoveCount: 41 },
      false,
    ],
    [
      "レベル4 でレベル5 の最短の中央値に届く",
      "4",
      "vAAvwAAwvhivwssws..s",
      { ...features, optimalMoveCount: 55 },
      false,
    ],
    [
      "空き6で娘を進められない手が無い",
      "1",
      "vAAvwAAwv..v.hi.....",
      {
        ...features,
        optimalMoveCount: 9,
        preparationLength: 0,
        emptyCellCount: 6,
      },
      false,
    ],
  ] as const;

  test.each(cases)(
    "レベルの採り方に合うかを返すこと: %s",
    (_, difficulty, board, candidateFeatures, expected) => {
      const selectable = isHakoiriMusumeSelectable(difficulty, {
        board,
        features: candidateFeatures,
      });

      expect(selectable).toBe(expected);
    },
  );
});

describe("rankHakoiriMusumeCandidateTiers", () => {
  const base = {
    optimalMoveCount: 40,
    preparationLength: 31,
    shortestPreparationLength: 31,
    daughterDetourCount: 2,
    emptyCellCount: 2,
    lureCount: 0,
    daughterMoveCount: 0,
    optimalFirstMoveCount: 0,
    firstMoveCount: 0,
  };

  test("レベル5 では最短手数の長い問題を先に採ること", () => {
    const tiers = [72, 60, 45].map((optimalMoveCount) =>
      rankHakoiriMusumeCandidateTiers("5", {
        board: "vAAvwAAwvhivwssws..s",
        features: { ...base, optimalMoveCount },
      }),
    );

    expect(tiers.map(([lengthTier]) => lengthTier)).toEqual([0, 1, 2]);
  });

  test("娘が3段目から始まる問題を後に回すこと", () => {
    const [, lowDaughter, sideOfThirdRow] = rankHakoiriMusumeCandidateTiers(
      "3",
      { board: "vs.vwshiAAvsAAwshihi", features: base },
    );

    expect([lowDaughter, sideOfThirdRow]).toEqual([1, 1]);
  });

  const startCases = [
    ["娘が動けず、初手が2つ以上", "vAAvwAAwvhivwssws..s", 2, 0],
    ["始めから娘が動ける", "vAA.wAA.vhivwssws..s", 2, 1],
    ["始めから娘が動け、初手が1つ", "vAA.wAA.vhivwssws..s", 1, 2],
  ] as const;

  test.each(startCases)(
    "始めの盤面で手の少ない問題を後に回すこと: %s",
    (_, board, firstMoveCount, expected) => {
      const [, , , plainStart] = rankHakoiriMusumeCandidateTiers("3", {
        board,
        features: { ...base, firstMoveCount },
      });

      expect(plainStart).toBe(expected);
    },
  );

  const emptyCases = [
    ["空きが下の段", "vAAvwAAwvhivwssws..s", 0],
    ["空きが中ほど", "vAAvwAAw....vhivwssw", 1],
    ["空きが上の段", "v..vwAAwvAAvwhiwshis", 2],
  ] as const;

  test.each(emptyCases)(
    "空きが下の段の問題を先に、上の段の問題を後に採ること: %s",
    (_, board, expected) => {
      const [, , , , emptyHeight] = rankHakoiriMusumeCandidateTiers("3", {
        board,
        features: base,
      });

      expect(emptyHeight).toBe(expected);
    },
  );
});

describe("measureHakoiriMusumeSetupRun", () => {
  const space = analyzeHakoiriMusumePieceSet({
    vertical: 0,
    horizontal: 6,
    small: 0,
  });
  const { optimal } = space.measures;
  const starts = space.graph.boards.flatMap((_, index) =>
    optimal[index]! >= 8 ? [index] : [],
  );

  test("どの最短解にも、娘を動かさない手が段取りの長さより長く続かない解があり、それより短くはできないこと", () => {
    const runs = starts.map((start) => ({
      run: measureHakoiriMusumeSetupRun(space, start),
      optimal: optimal[start]!,
    }));

    expect(runs.every(({ run, optimal }) => run >= 0 && run < optimal)).toBe(
      true,
    );
  });
});
