import { fukumenzanAnalysisScope } from "@/games/fukumenzan/difficulty";
import {
  _private,
  analyzeFukumenzanDifficulty,
  countFukumenzanOpeningLetters,
} from "@/games/fukumenzan/problem/difficulty-analysis";
import {
  createFukumenzanColumnModel,
  createInitialDomains,
} from "@/games/fukumenzan/problem/generation/column-model";
import {
  closeFukumenzanDomains,
  createFukumenzanReader,
} from "@/games/fukumenzan/problem/generation/column-readers";
import researchCases from "@/games/fukumenzan/problem/generation/research-difficulty-cases.json";
import { parseFukumenzanEquation } from "@/games/fukumenzan/problem/problem";

const { readerSettings } = _private;

describe("analyzeFukumenzanDifficulty", () => {
  describe.each(researchCases.classification)(
    "研究用の期待値の $equation の場合",
    ({ equation, scale, readingClass, readers }) => {
      const problem = parseFukumenzanEquation(equation)!;

      test("同じ読み手を同じ順に当て、同じ結果・規模・読みの組を返すこと", () => {
        const analysis = analyzeFukumenzanDifficulty(
          problem,
          fukumenzanAnalysisScope,
        );

        expect(analysis.status).not.toBe("invalid");
        expect(analysis).toMatchObject({
          scale: { scale },
          readers,
          ...(analysis.status === "analyzed" ? { readingClass } : {}),
        });
      });
    },
  );

  describe("解が2つある式の場合", () => {
    const problem = parseFukumenzanEquation("AB+BA=CC")!;

    test("成り立たない問題として返すこと", () => {
      const analysis = analyzeFukumenzanDifficulty(
        problem,
        fukumenzanAnalysisScope,
      );

      expect(analysis).toEqual({ status: "invalid" });
    });
  });
});

describe("読み手の閉包", () => {
  const solvedCases = researchCases.classification.flatMap(
    ({ equation, solution }) =>
      solution === undefined ? [] : [[equation, solution] as const],
  );

  describe.each(Object.entries(readerSettings))("%s の場合", (_, settings) => {
    test.each(solvedCases)(
      "%s の解の数字を候補から消さないこと",
      (equation, solution) => {
        const model = createFukumenzanColumnModel(
          parseFukumenzanEquation(equation)!,
        );
        const { status, domains } = closeFukumenzanDomains(
          createFukumenzanReader(model, settings),
          createInitialDomains(model),
        );
        const lost = [...solution].filter(
          (digit, letter) => !((domains[letter]! >> Number(digit)) & 1),
        );

        expect({ status, lost }).toEqual({ status: "stuck", lost: [] });
      },
    );
  });
});

describe("countFukumenzanOpeningLetters", () => {
  // 千の位の T は繰り上がりの1に、百の位の B＋K＋繰り上がり＝K＋10 から B は9に決まる。
  const problem = parseFukumenzanEquation("BYK+KTK=TKHH")!;

  test("解き始めに各桁を1回ずつ読んで決まる文字を数えること", () => {
    const count = countFukumenzanOpeningLetters(problem);

    expect(count).toBe(2);
  });
});
