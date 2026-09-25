import type {
  Diagnostic,
  Evaluation,
  Rule,
  Severity,
} from "../domain/model.ts";
import { locateViolation } from "./locate.ts";

/** 実行を失敗させる最も軽いseverity。infoは失敗させない。 */
export type FailOn = Exclude<Severity, "info">;

/** 問題として数える指摘か。infoは出力するが数えない。 */
export function isProblem(diagnostic: Pick<Diagnostic, "severity">): boolean {
  return diagnostic.severity !== "info";
}

/** `failOn` 以上のseverityの指摘があれば実行を失敗させる。 */
export function failsRun(
  diagnostics: ReadonlyArray<Pick<Diagnostic, "severity">>,
  failOn: FailOn,
): boolean {
  return diagnostics.some((diagnostic) =>
    failOn === "warning"
      ? isProblem(diagnostic)
      : diagnostic.severity === "error",
  );
}

export function buildDiagnostics(options: {
  evaluations: Evaluation[];
  rules: Rule[];
}): {
  diagnostics: Diagnostic[];
  unknowns: Evaluation[];
} {
  const rulesById = new Map(options.rules.map((rule) => [rule.id, rule]));
  const diagnostics: Diagnostic[] = [];
  const unknowns: Evaluation[] = [];

  for (const evaluation of options.evaluations) {
    const rule = rulesById.get(evaluation.ruleId);

    if (!rule) {
      throw new Error(`evaluationが未知のruleを参照しています: ${evaluation.ruleId}`);
    }

    if (evaluation.result.decision === "cannot_judge") {
      unknowns.push(evaluation);
      continue;
    }

    if (
      evaluation.result.decision !== "violation" ||
      evaluation.result.probabilities.violation < rule.violationThreshold
    ) {
      continue;
    }

    // 指摘位置を宣言したunitはその位置、それ以外は違反箇所の候補から選んだ範囲を指摘する。
    const locatedRanges =
      evaluation.subject.reportRange === undefined
        ? locateViolation(evaluation.subject.range, evaluation.parts)
        : [{ range: evaluation.subject.reportRange }];

    for (const located of locatedRanges) {
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.title,
        path: evaluation.subject.path,
        range: located.range,
        subjectRange: evaluation.subject.range,
        ...(evaluation.subject.symbol === undefined
          ? {}
          : { symbol: evaluation.subject.symbol }),
        probability: evaluation.result.probabilities.violation,
        confidence: evaluation.result.confidence,
        ...(located.probability === undefined
          ? {}
          : { partProbability: located.probability }),
      });
    }
  }

  return {
    diagnostics: diagnostics.sort(compareDiagnostics),
    unknowns,
  };
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return (
    left.path.localeCompare(right.path) ||
    left.range.startLine - right.range.startLine ||
    left.range.startColumn - right.range.startColumn ||
    left.ruleId.localeCompare(right.ruleId)
  );
}
