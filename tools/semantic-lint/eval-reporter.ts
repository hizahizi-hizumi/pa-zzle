import type { CalibrationResult } from "./calibration.ts";
import type { DecisionChoice } from "./types.ts";

export type CalibrationSummary = {
  cases: number;
  runs: number;
  exactMatches: number;
  thresholdMatches: number;
  inputTokens: number;
  totalDurationMs: number;
};

export function printCalibrationReport(
  results: CalibrationResult[],
  totalDurationMs: number,
  repeat: number,
): CalibrationSummary {
  let exactMatches = 0;
  let thresholdMatches = 0;
  let inputTokens = 0;

  const byRule = groupByRule(results);

  for (const [ruleId, ruleResults] of byRule) {
    const rule = ruleResults[0]?.case.rule;

    if (!rule) {
      continue;
    }

    console.log(rule.title + " [" + ruleId + "]");

    for (const result of ruleResults) {
      const violationProbabilities = result.runs.map(
        (run) => run.answer.probabilities.violation,
      );
      const caseExactMatches = result.runs.filter(
        (run) => run.answer.choice === result.case.expected,
      ).length;
      const thresholdCrossings = violationProbabilities.filter(
        (probability) => probability >= rule.violationThreshold,
      ).length;
      const caseThresholdMatches =
        result.case.expected === "violation"
          ? thresholdCrossings
          : repeat - thresholdCrossings;

      exactMatches += caseExactMatches;
      thresholdMatches += caseThresholdMatches;
      inputTokens += result.runs.reduce(
        (sum, run) => sum + run.usage.inputTokens,
        0,
      );

      console.log("  " + result.case.name);
      console.log("    期待値: " + choiceLabel(result.case.expected));
      console.log(
        "    Choice一致: " +
          caseExactMatches +
          "/" +
          repeat +
          " (" +
          percentage(caseExactMatches / repeat) +
          ")",
      );
      console.log(
        "    違反確率: min " +
          percentage(Math.min(...violationProbabilities)) +
          " / mean " +
          percentage(mean(violationProbabilities)) +
          " / max " +
          percentage(Math.max(...violationProbabilities)),
      );
      console.log(
        "    閾値超過: " +
          thresholdCrossings +
          "/" +
          repeat +
          " (閾値 " +
          percentage(rule.violationThreshold) +
          ")",
      );

      const choices = countChoices(result.runs.map((run) => run.answer.choice));

      if (choices.size > 1 || !choices.has(result.case.expected)) {
        console.log(
          "    Choice分布: " +
            [...choices.entries()]
              .map(
                ([choice, count]) =>
                  choiceLabel(choice) + " " + String(count),
              )
              .join(" / "),
        );
      }
    }

    console.log("");
  }

  const runs = results.reduce((sum, result) => sum + result.runs.length, 0);
  const summary: CalibrationSummary = {
    cases: results.length,
    runs,
    exactMatches,
    thresholdMatches,
    inputTokens,
    totalDurationMs,
  };

  console.log("集計");
  console.log("  ケース: " + summary.cases);
  console.log("  実行回数: " + summary.runs);
  console.log(
    "  Choice一致: " +
      summary.exactMatches +
      "/" +
      summary.runs +
      " (" +
      percentage(summary.exactMatches / summary.runs) +
      ")",
  );
  console.log(
    "  閾値判定一致: " +
      summary.thresholdMatches +
      "/" +
      summary.runs +
      " (" +
      percentage(summary.thresholdMatches / summary.runs) +
      ")",
  );
  console.log("  入力トークン: " + summary.inputTokens);
  console.log("  総実行時間: " + duration(summary.totalDurationMs));

  return summary;
}

function groupByRule(
  results: CalibrationResult[],
): Map<string, CalibrationResult[]> {
  const grouped = new Map<string, CalibrationResult[]>();

  for (const result of results) {
    const ruleId = result.case.rule.id;
    const ruleResults = grouped.get(ruleId) ?? [];
    ruleResults.push(result);
    grouped.set(ruleId, ruleResults);
  }

  return grouped;
}

function countChoices(
  choices: DecisionChoice[],
): Map<DecisionChoice, number> {
  const counts = new Map<DecisionChoice, number>();

  for (const choice of choices) {
    counts.set(choice, (counts.get(choice) ?? 0) + 1);
  }

  return counts;
}

function choiceLabel(choice: DecisionChoice): string {
  switch (choice) {
    case "violation":
      return "違反";
    case "compliant":
      return "問題なし";
    case "not_applicable":
      return "対象外";
    case "insufficient_context":
      return "文脈不足";
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

function duration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return String(Math.round(milliseconds)) + "ms";
  }

  return (milliseconds / 1_000).toFixed(2) + "秒";
}
