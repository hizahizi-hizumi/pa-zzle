import type {
  Diagnostic,
  Evaluation,
  Rule,
} from "../domain/model.ts";

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

    if (evaluation.result.decision === "insufficient_context") {
      unknowns.push(evaluation);
      continue;
    }

    if (
      evaluation.result.decision !== "violation" ||
      evaluation.result.probabilities.violation < rule.violationThreshold
    ) {
      continue;
    }

    diagnostics.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: rule.title,
      path: evaluation.subject.path,
      range: evaluation.subject.range,
      ...(evaluation.subject.symbol === undefined
        ? {}
        : { symbol: evaluation.subject.symbol }),
      probability: evaluation.result.probabilities.violation,
      confidence: evaluation.result.confidence,
      source: rule.source,
    });
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
