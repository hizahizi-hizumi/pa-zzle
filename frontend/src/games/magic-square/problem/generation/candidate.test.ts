import type { MagicSquareReadingFeatures } from "@/games/magic-square/problem/difficulty-analysis";
import { listAllMagicSquares4 } from "@/games/magic-square/problem/generation/answers";
import {
  generateMagicSquareCandidate,
  type MagicSquareCandidateConditions,
  reduceMagicSquareGivens,
  scoreMagicSquarePolishForLevel4,
  scoreMagicSquarePolishForLevel5,
} from "@/games/magic-square/problem/generation/candidate";
import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import { readMagicSquare } from "@/games/magic-square/problem/generation/read-model";
import { createProblemSeededRandom } from "@/games/problem-seed";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py（版 8）の reduce_givens の記録。
// 魔方陣と空ける順・戻すマス・磨きの乱数は Python の random で作ったもので製品の乱数と一致しないので、
// 記録した空ける順を与えて、戻すマスと読むモデルを呼んだ回数をなぞる。

describe("reduceMagicSquareGivens", () => {
  const cases = reference.cases.map((entry) => [entry.id, entry] as const);

  test.each(cases)(
    "%s を記録した順に空けると、戻すマスと読むモデルを呼んだ回数が調査コードと同じこと",
    (_, entry) => {
      const result = reduceMagicSquareGivens(
        entry.size,
        entry.solution,
        entry.removalOrder,
        entry.maxTier,
      );

      expect({
        keptCells: result.keptCells,
        readCount: result.readCount,
      }).toEqual({ keptCells: entry.kept, readCount: entry.reduceReadCount });
    },
  );

  // 戻さずに作った候補は、減らした盤面がそのまま問題になる。
  const unfinishedCases = cases.filter(([, entry]) => entry.addBack === 0);

  test.each(unfinishedCases)(
    "%s の減らした盤面が調査コードの問題と同じこと",
    (_, entry) => {
      const result = reduceMagicSquareGivens(
        entry.size,
        entry.solution,
        entry.removalOrder,
        entry.maxTier,
      );

      expect(result.givens).toEqual(entry.givens);
    },
  );
});

describe("generateMagicSquareCandidate", () => {
  const conditionCases = [
    [
      "4×4 を段2まで減らして2マス戻す",
      { size: 4, maxTier: 2, finish: { kind: "add-back", count: 2 } },
    ],
    [
      "5×5 を段1まで減らす",
      { size: 5, maxTier: 1, finish: { kind: "add-back", count: 0 } },
    ],
    [
      "4×4 を段2まで減らしてレベル5向けに磨く",
      { size: 4, maxTier: 2, finish: { kind: "polish", target: "5" } },
    ],
    [
      "4×4 を段3まで減らしてレベル4向けに磨く",
      { size: 4, maxTier: 3, finish: { kind: "polish", target: "4" } },
    ],
  ] as const satisfies readonly (readonly [
    string,
    MagicSquareCandidateConditions,
  ])[];

  // 4×4 の答えは、全部の魔方陣（1プロセスで1回だけ数える）から選ぶ。
  listAllMagicSquares4();

  test.each(conditionCases)(
    "%s: 答えの数だけを与え、その段までの読むモデルで解ける候補を、同じ乱数列なら同じに作ること",
    (_, conditions) => {
      const candidate = generateMagicSquareCandidate(
        conditions,
        createProblemSeededRandom("candidate-test"),
      );
      const repeated = generateMagicSquareCandidate(
        conditions,
        createProblemSeededRandom("candidate-test"),
      );
      const { status } = readMagicSquare(conditions.size, candidate.givens, {
        maxTier: conditions.maxTier,
      });

      expect({
        consistent: candidate.givens.every(
          (value, cell) => value === 0 || value === candidate.solution[cell],
        ),
        status,
        repeated,
      }).toEqual({ consistent: true, status: "solved", repeated: candidate });
    },
  );
});

const polishFeatures: MagicSquareReadingFeatures = {
  status: "solved",
  entryCellCount: 0,
  firstTier: 3,
  firstSweeps: 2,
  tierMax: 3,
  placeCount: 6,
  stuckPlaceCount: 3,
  tier3PlaceCount: 1,
  tier2SweepsMax: 1,
  tier3SweepsMax: 2,
  stuckSweepsMax: 2,
  stuckSweepTotal: 4,
  reworkedPlaceCount: 1,
  threeSweepPlaceCount: 0,
  hiddenOnlyPlaceCount: 0,
  lockPlaceCount: 1,
  chainLineCountMax: 0,
  combinationCountMedian: 2,
  combinationCountMax: 4,
};
const longLineFeatures: MagicSquareReadingFeatures = {
  ...polishFeatures,
  tierMax: 4,
};

describe("scoreMagicSquarePolishForLevel5", () => {
  test("最初の所が段3で2巡の盤面に、最初の所と深い所の点を足すこと", () => {
    // 最初の所 6 + 6 × 2、巡 4 × 2、段3の所 3 × 1、絞り直し 2 × 1、行き詰まった所 3
    const score = scoreMagicSquarePolishForLevel5(polishFeatures);

    expect(score).toBe(34);
  });

  test("段4が要る盤面には進まないこと", () => {
    const score = scoreMagicSquarePolishForLevel5(longLineFeatures);

    expect(score).toBe(-1e9);
  });
});

describe("scoreMagicSquarePolishForLevel4", () => {
  const level4Features: MagicSquareReadingFeatures = {
    ...polishFeatures,
    firstTier: 2,
    firstSweeps: 1,
    tier2SweepsMax: 4,
    stuckSweepsMax: 4,
    stuckPlaceCount: 5,
    reworkedPlaceCount: 2,
  };

  test("最初の所が段2・1巡で、途中に段2で4巡の所がある盤面を高くすること", () => {
    // 入口なし 10、最初の所が軽い 10、段3の所 5 × 1、段2で4巡 4、絞り直し 2 × 2、行き詰まった所 5、巡が3を超える分 −3
    const score = scoreMagicSquarePolishForLevel4(level4Features);

    expect(score).toBe(35);
  });

  test("段4が要る盤面には進まないこと", () => {
    const score = scoreMagicSquarePolishForLevel4(longLineFeatures);

    expect(score).toBe(-1e9);
  });
});
