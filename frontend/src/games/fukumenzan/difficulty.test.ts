import { difficultyLevels } from "@/games/difficulty";
import {
  assessFukumenzanDifficulty,
  classifyFukumenzanProblem,
  fukumenzanAnalysisScope,
  fukumenzanLevelCombinations,
} from "@/games/fukumenzan/difficulty";
import { listFukumenzanNearProblemKeys } from "@/games/fukumenzan/problem/generation/near-problem-keys";
import researchCases from "@/games/fukumenzan/problem/generation/research-difficulty-cases.json";
import {
  type FukumenzanProblem,
  getFukumenzanSameProblemKey,
  parseFukumenzanEquation,
} from "@/games/fukumenzan/problem/problem";

describe("classifyFukumenzanProblem", () => {
  test.each(researchCases.classification)(
    "期待値の $equation を $outcome（レベル $level）にすること",
    ({ equation, outcome, level }) => {
      const assessment = classifyFukumenzanProblem(
        parseFukumenzanEquation(equation)!,
      );

      expect({
        outcome:
          assessment.status === "out-of-range"
            ? assessment.reason
            : assessment.status,
        level:
          assessment.status === "classified" ? assessment.difficulty : null,
      }).toEqual({ outcome, level });
    },
  );
});

describe("assessFukumenzanDifficulty", () => {
  test("成り立たない問題の分析を、成り立たない問題にすること", () => {
    const assessment = assessFukumenzanDifficulty({ status: "invalid" });

    expect(assessment).toEqual({ status: "invalid" });
  });
});

describe("fukumenzanLevelCombinations", () => {
  const scaleOrder = { "2s": 0, "2l": 1, "3s": 1, "3l": 2 } as const;
  const combinations = difficultyLevels.map(
    ({ id }) => fukumenzanLevelCombinations[id],
  );

  test("上のレベルほど、規模と文字の数の下限が下がらないこと", () => {
    const lowered = combinations
      .slice(1)
      .filter(
        (combination, index) =>
          scaleOrder[combination.scale] <
            scaleOrder[combinations[index]!.scale] ||
          combination.letterCount.minimum <
            combinations[index]!.letterCount.minimum,
      );

    expect(lowered).toEqual([]);
  });

  test("1桁の重さは2つ足しと3つ足しの4桁まで、場合分けの回数は5桁を含む3つ足しでだけ測ること", () => {
    const { columnWeightScales, splitScales } = fukumenzanAnalysisScope;

    expect({
      columnWeightScales: [...columnWeightScales].toSorted(),
      splitScales: [...splitScales],
    }).toEqual({ columnWeightScales: ["2s", "3s"], splitScales: ["3l"] });
  });
});

/** 3桁＋3桁の全部の式から、文字の並びが同じ式の答えが1つだけの並びを、同じ問題をそろえて集める（研究用の `space2` と同じ数え方）。 */
function listThreeDigitPairProblems(): {
  equationCount: number;
  patternCount: number;
  uniquePatternCount: number;
  problems: Map<string, FukumenzanProblem>;
} {
  const patterns = new Map<string, [number, number] | null>();
  let equationCount = 0;
  for (let left = 100; left < 1000; left += 1) {
    for (let right = 100; right < 1000; right += 1) {
      const text = `${left}${right}${left + right}`;
      const letterCount = new Set(text).size;
      if (letterCount < 5 || letterCount > 7) {
        continue;
      }
      equationCount += 1;
      const labels = new Map<string, number>();
      const pattern = [...text]
        .map((digit) => {
          if (!labels.has(digit)) {
            labels.set(digit, labels.size);
          }
          return labels.get(digit);
        })
        .join("");
      const key = `${pattern}/${text.length}`;
      patterns.set(key, patterns.has(key) ? null : [left, right]);
    }
  }
  const problems = new Map<string, FukumenzanProblem>();
  const uniquePatterns = [...patterns.values()].filter((pair) => pair !== null);
  for (const [left, right] of uniquePatterns) {
    const labels = new Map<string, string>();
    const [first, second, result] = [left, right, left + right].map((number) =>
      [...String(number)]
        .map((digit) => {
          if (!labels.has(digit)) {
            labels.set(digit, String.fromCharCode(65 + labels.size));
          }
          return labels.get(digit)!;
        })
        .join(""),
    );
    const problem = { addends: [first!, second!], result: result! };
    const key = getFukumenzanSameProblemKey(problem);
    if (!problems.has(key)) {
      problems.set(key, problem);
    }
  }
  return {
    equationCount,
    patternCount: patterns.size,
    uniquePatternCount: uniquePatterns.length,
    problems,
  };
}

describe("3桁＋3桁の全部の問題の場合", () => {
  const { equationCount, patternCount, uniquePatternCount, problems } =
    listThreeDigitPairProblems();
  const expected = researchCases.threeDigitPairs;
  const ordered = [...problems].toSorted(([left], [right]) =>
    left < right ? -1 : 1,
  );

  test("式・文字の並び・一意解の問題の数が研究用の期待値と同じになり、レベルの数と近い問題を飛ばして採れる L1 の数が期待値になること", () => {
    const levels = new Map<string, number>();
    const levelOneLetterCounts = new Map<string, number>();
    const takenNearKeys = new Set<string>();
    let levelOneWithoutNearCount = 0;
    for (const [, problem] of ordered) {
      const assessment = classifyFukumenzanProblem(problem);
      const level =
        assessment.status === "classified" ? assessment.difficulty : "none";
      levels.set(level, (levels.get(level) ?? 0) + 1);
      if (level !== "1") {
        continue;
      }
      const letterCount = String(
        new Set([...problem.addends, problem.result].join("")).size,
      );
      levelOneLetterCounts.set(
        letterCount,
        (levelOneLetterCounts.get(letterCount) ?? 0) + 1,
      );
      const nearKeys = listFukumenzanNearProblemKeys(problem);
      if (![...nearKeys].some((key) => takenNearKeys.has(key))) {
        levelOneWithoutNearCount += 1;
        for (const key of nearKeys) {
          takenNearKeys.add(key);
        }
      }
    }

    expect({
      equationCount,
      patternCount,
      uniquePatternCount,
      problemCount: problems.size,
      levels: Object.fromEntries(levels),
      levelOneLetterCounts: Object.fromEntries(levelOneLetterCounts),
      levelOneWithoutNearCount,
    }).toEqual({
      equationCount: expected.equationCount,
      patternCount: expected.patternCount,
      uniquePatternCount: expected.uniquePatternCount,
      problemCount: expected.problemCount,
      levels: expected.levels,
      levelOneLetterCounts: expected.levelOneLetterCounts,
      levelOneWithoutNearCount: expected.levelOneWithoutNearCount,
    });
  }, 60_000);
});
