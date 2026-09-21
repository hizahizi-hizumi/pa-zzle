import type { FileEvaluation, RuleEvaluation, Severity } from "./types.ts";

export type ReportOptions = {
  verbose: boolean;
  totalDurationMs: number;
  concurrency: number;
};

export type ReportSummary = {
  files: number;
  decisions: number;
  warnings: number;
  errors: number;
  insufficientContext: number;
  inputTokens: number;
  evaluationRequests: number;
  totalDurationMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  filesPerSecond: number;
  decisionsPerSecond: number;
};

export function printReport(
  results: FileEvaluation[],
  options: ReportOptions,
): ReportSummary {
  let warnings = 0;
  let errors = 0;
  let insufficientContext = 0;
  let inputTokens = 0;

  for (const result of results) {
    inputTokens += result.usage.inputTokens;

    const visible = result.evaluations.filter(
      (evaluation) =>
        options.verbose ||
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

  const decisions = results.reduce(
    (sum, result) => sum + result.evaluations.length,
    0,
  );
  const latencies = results.map((result) => result.durationMs);
  const elapsedSeconds = options.totalDurationMs / 1_000;

  const summary: ReportSummary = {
    files: results.length,
    decisions,
    warnings,
    errors,
    insufficientContext,
    inputTokens,
    evaluationRequests: results.length,
    totalDurationMs: options.totalDurationMs,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    maxLatencyMs: Math.max(...latencies),
    filesPerSecond: elapsedSeconds > 0 ? results.length / elapsedSeconds : 0,
    decisionsPerSecond: elapsedSeconds > 0 ? decisions / elapsedSeconds : 0,
  };

  printSummary(summary, options.concurrency);
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

function printSummary(summary: ReportSummary, concurrency: number): void {
  console.log("集計");
  console.log(`  ファイル: ${summary.files}`);
  console.log(`  判定数: ${summary.decisions}`);
  console.log(`  警告: ${summary.warnings}`);
  console.log(`  エラー: ${summary.errors}`);
  console.log(`  文脈不足: ${summary.insufficientContext}`);
  console.log(`  入力トークン: ${summary.inputTokens}`);

  console.log("\nパフォーマンス");
  console.log(`  並列数: ${concurrency}`);
  console.log(`  評価リクエスト: ${summary.evaluationRequests}`);
  console.log(`  総実行時間: ${duration(summary.totalDurationMs)}`);
  console.log(`  レイテンシ p50: ${duration(summary.p50LatencyMs)}`);
  console.log(`  レイテンシ p95: ${duration(summary.p95LatencyMs)}`);
  console.log(`  レイテンシ max: ${duration(summary.maxLatencyMs)}`);
  console.log(
    `  スループット: ${summary.filesPerSecond.toFixed(1)}ファイル/秒`,
  );
  console.log(
    `  判定スループット: ${summary.decisionsPerSecond.toFixed(1)}判定/秒`,
  );

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

function duration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${Math.round(milliseconds)}ms`;
  }

  return `${(milliseconds / 1_000).toFixed(2)}秒`;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)] ?? 0;
}
