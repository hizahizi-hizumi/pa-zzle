import reference from "@/games/magic-square/problem/generation/difficulty-reference.json";
import {
  type MagicSquareTrialDisplay,
  type MagicSquareTrialSolveInput,
  traceMagicSquareTrialSolve,
} from "@/games/magic-square/problem/generation/trial-solver";
import { createProblemSeededRandom } from "@/games/problem-seed";

// 盤面は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py（版 8）の候補。
// 素朴な解き方は乱数列が調査コードと違うので値は突き合わせず、振る舞いを確かめる。

const UNLIMITED_MOVES = 1_000_000;

function findReferenceCase(id: string) {
  const entry = reference.cases.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Missing reference case: ${id}`);
  }
  return entry;
}

describe("traceMagicSquareTrialSolve", () => {
  describe("空きが1マスの列だけで埋まる盤面の場合", () => {
    const { solution } = findReferenceCase("ms4-T1-k0-0");
    const input: MagicSquareTrialSolveInput = {
      size: 4,
      givens: solution.map((value, cell) => (cell === 0 ? 0 : value)),
      random: createProblemSeededRandom("trial-forced"),
      display: "remain",
      pairAware: false,
      moveLimit: UNLIMITED_MOVES,
    };

    test("試し置きせずに解くこと", () => {
      const result = traceMagicSquareTrialSolve(input);

      expect(result).toEqual({
        solved: true,
        moveCount: 1,
        trialCount: 0,
        undoCount: 0,
        stopReason: null,
      });
    });
  });

  describe("与える数だけで矛盾する場合", () => {
    const input: MagicSquareTrialSolveInput = {
      size: 4,
      givens: [1, 2, 3, 0, ...Array(12).fill(0)],
      random: createProblemSeededRandom("trial-bad"),
      display: "remain",
      pairAware: false,
      moveLimit: UNLIMITED_MOVES,
    };

    test("bad-givens で止まること", () => {
      const result = traceMagicSquareTrialSolve(input);

      expect({ solved: result.solved, stopReason: result.stopReason }).toEqual({
        solved: false,
        stopReason: "bad-givens",
      });
    });
  });

  describe("試し置きが要る盤面の場合", () => {
    const { size, givens } = findReferenceCase("ms4-T2-k1-27");
    const displays: readonly MagicSquareTrialDisplay[] = [
      "remain",
      "filled",
      "none",
    ];
    const cases = displays.flatMap((display) =>
      [false, true].map((pairAware) => [display, pairAware] as const),
    );

    test.each(cases)(
      "表示 %s・慣れた試し置き %s で、置く回数の上限が無ければ解くこと",
      (display, pairAware) => {
        const result = traceMagicSquareTrialSolve({
          size,
          givens,
          random: createProblemSeededRandom(`trial-${display}-${pairAware}`),
          display,
          pairAware,
          moveLimit: UNLIMITED_MOVES,
        });

        expect({ solved: result.solved, tried: result.trialCount > 0 }).toEqual(
          { solved: true, tried: true },
        );
      },
    );

    test("同じ乱数列なら同じ記録を返すこと", () => {
      const first = traceMagicSquareTrialSolve({
        size,
        givens,
        random: createProblemSeededRandom("trial-repeat"),
        display: "remain",
        pairAware: true,
        moveLimit: UNLIMITED_MOVES,
      });
      const second = traceMagicSquareTrialSolve({
        size,
        givens,
        random: createProblemSeededRandom("trial-repeat"),
        display: "remain",
        pairAware: true,
        moveLimit: UNLIMITED_MOVES,
      });

      expect(second).toEqual(first);
    });

    test("置く回数の上限に届いたら move-limit で止まること", () => {
      const result = traceMagicSquareTrialSolve({
        size,
        givens,
        random: createProblemSeededRandom("trial-limit"),
        display: "remain",
        pairAware: false,
        moveLimit: 1,
      });

      expect({ solved: result.solved, stopReason: result.stopReason }).toEqual({
        solved: false,
        stopReason: "move-limit",
      });
    });
  });
});
