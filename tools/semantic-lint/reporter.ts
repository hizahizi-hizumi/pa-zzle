import type { FileEvaluation, RuleEvaluation, Severity } from "./types.ts";

export type ReportSummary = {
  files: number;
  decisions: number;
  warnings: number;
  errors: number;
  insufficientContext: number;
  inputTokens: number;
};

export function printReport(
  results: FileEvaluation[],
  verbose: boolean,
): ReportSummary {
  let warnings = 0;
  let errors = 0;
  let insufficientContext = 0;
  let inputTokens = 0;

  for (const result of results) {
    inputTokens += result.usage.inputTokens;

    const visible = result.evaluations.filter(
      (evaluation) =>
        verbose ||
        isFinding(evaluation) ||
        evaluation.answer.choice === "insufficient_context",
    );

    if (visible.length === 0) {
      continue;
    }

    console.log(result.path);

    for (const evaluation of visible) {
      if (isFinding(evaluation)) {
        if (evaluation.rule.severity === "error") {
          errors += 1;
        } else {
          warnings += 1;
        }

        printFinding(evaluation);
        continue;
      }

      if (evaluation.answer.choice === "insufficient_context") {
        insufficientContext += 1;
      }

      printEvaluation(evaluation);
    }

    console.log("");
  }

  const summary: ReportSummary = {
    files: results.length,
    decisions: results.reduce(
      (sum, result) => sum + result.evaluations.length,
      0,
    ),
    warnings,
    errors,
    insufficientContext,
    inputTokens,
  };

  printSummary(summary);
  return summary;
}

function printFinding(evaluation: RuleEvaluation): void {
  const { rule, answer } = evaluation;

  console.log(`  ${severityLabel(rule.severity)} ${rule.title}`);
  console.log(`    rule: ${rule.id}`);
  console.log(
    `    違反確率: ${percentage(answer.probabilities.violation)} ` +
      `(閾値 ${percentage(rule.violationThreshold)})`,
  );
  console.log(`    確信度: ${percentage(answer.confidence)}`);
  console.log(`    規約: ${rule.source.path} / ${rule.source.section}`);
}

function printEvaluation(evaluation: RuleEvaluation): void {
  const { rule, answer } = evaluation;

  console.log(`  ${choiceMark(answer.choice)} ${rule.title}`);
  console.log(`    rule: ${rule.id}`);
  console.log(`    判定: ${choiceLabel(answer.choice)}`);
  console.log(
    `    違反 ${percentage(answer.probabilities.violation)} / ` +
      `問題なし ${percentage(answer.probabilities.compliant)} / ` +
      `対象外 ${percentage(answer.probabilities.not_applicable)} / ` +
      `文脈不足 ${percentage(answer.probabilities.insufficient_context)}`,
  );
  console.log(`    確信度: ${percentage(answer.confidence)}`);
}

function printSummary(summary: ReportSummary): void {
  console.log("集計");
  console.log(`  ファイル: ${summary.files}`);
  console.log(`  判定数: ${summary.decisions}`);
  console.log(`  警告: ${summary.warnings}`);
  console.log(`  エラー: ${summary.errors}`);
  console.log(`  文脈不足: ${summary.insufficientContext}`);
  console.log(`  入力トークン: ${summary.inputTokens}`);

  if (summary.warnings === 0 && summary.errors === 0) {
    console.log("\n規約違反候補は検出されませんでした。");
  }
}

function isFinding(evaluation: RuleEvaluation): boolean {
  return (
    evaluation.answer.probabilities.violation >=
    evaluation.rule.violationThreshold
  );
}

function severityLabel(severity: Severity): string {
  return severity === "error" ? "エラー" : "警告";
}

function choiceLabel(choice: RuleEvaluation["answer"]["choice"]): string {
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

function choiceMark(choice: RuleEvaluation["answer"]["choice"]): string {
  switch (choice) {
    case "violation":
      return "×";
    case "compliant":
      return "✓";
    case "not_applicable":
      return "-";
    case "insufficient_context":
      return "?";
  }
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}
