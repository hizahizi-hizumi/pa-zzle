import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import { readMagicSquare } from "@/games/magic-square/problem/generation/read-model";
import { magicSquareReadingParts } from "@/games/magic-square/problem/generation/reading-parts";
import { hashProblemSeed } from "@/games/problem-seed";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py（版 8）の read_solve の記録。
// difficulty-reference.json は、同じ場所の magic_square_difficulty.expected.json（88 候補）から、突き合わせる項目だけを残したもの。
// 部品で読んだ記録は、[状態, [[段, 巡, 見つかったマスの数, 決まったマス], …]] の JSON の FNV-1a の上位 6 桁で持つ。

/** [段, 巡, 決まったマス, 見つかったマスの数, 使った読み, 組の数を他で使ったか, 1巡目の組の数, 1巡目の鎖の列の数の最大] */
type ReferenceStep = [
  number,
  number,
  number[],
  number,
  string[],
  boolean,
  number[],
  number,
];

const STEP_DIGEST_LENGTH = 6;

function digestPartSteps(
  status: string,
  steps: readonly {
    tier: number;
    sweeps: number;
    found: number;
    cells: readonly number[];
  }[],
): string {
  const record = [
    status,
    steps.map(({ tier, sweeps, found, cells }) => [tier, sweeps, found, cells]),
  ];
  return hashProblemSeed(JSON.stringify(record))
    .toString(16)
    .padStart(8, "0")
    .slice(0, STEP_DIGEST_LENGTH);
}

describe("readMagicSquare", () => {
  const cases = reference.cases.map((entry) => [entry.id, entry] as const);

  describe("基準の読み方の場合", () => {
    test.each(cases)(
      "%s の所ごとの段・巡・決まったマス・使った読みが調査コードと同じこと",
      (_, entry) => {
        const result = readMagicSquare(entry.size, entry.givens);

        expect({
          status: result.status,
          steps: result.steps.map(
            (step): ReferenceStep => [
              step.tier,
              step.sweeps,
              [...step.cells],
              step.found,
              [...step.kinds],
              step.lock,
              [...step.combos],
              step.chain,
            ],
          ),
        }).toEqual({
          status: entry.read.status,
          steps: entry.read.steps as unknown as ReferenceStep[],
        });
      },
    );

    test.each(cases)(
      "%s を読み切った盤面が答えの魔方陣で、単位の読みを打ち切らないこと",
      (_, entry) => {
        const result = readMagicSquare(entry.size, entry.givens);

        expect({ grid: result.grid, cappedReads: result.cappedReads }).toEqual({
          grid: entry.solution,
          cappedReads: 0,
        });
      },
    );
  });

  describe("読み方の部品の場合", () => {
    test.each(cases)(
      "%s を34の部品で読んだ所ごとの記録が調査コードと同じこと",
      (_, entry) => {
        const digests = magicSquareReadingParts
          .map(({ options }) => {
            const result = readMagicSquare(entry.size, entry.givens, options);
            return digestPartSteps(result.status, result.steps);
          })
          .join("");

        expect(digests).toBe(entry.partStepDigests);
      },
    );
  });

  describe("同じ盤面を2回読む場合", () => {
    const [, entry] = cases[0]!;

    test("同じ記録を返すこと", () => {
      const first = readMagicSquare(entry.size, entry.givens);
      const second = readMagicSquare(entry.size, entry.givens);

      expect(second).toEqual(first);
    });
  });

  describe("与える数が答えに合わない場合", () => {
    // 1行目の残りが 34 − (1 + 2 + 3) = 28 で、16 を超える。
    const givens = [1, 2, 3, 0, ...Array(12).fill(0)];

    test("矛盾として止まること", () => {
      const result = readMagicSquare(4, givens);

      expect({ status: result.status, grid: result.grid }).toEqual({
        status: "contradiction",
        grid: null,
      });
    });
  });
});
