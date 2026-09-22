import type {
  Finding,
  Evaluation,
  Rule,
} from "../domain/model.ts";

export function buildFindings(options: {
  evaluations: Evaluation[];
  rules: Rule[];
}): {
  diagnostics: Finding[];
  unknowns: Evaluation[];
} {
  const rulesById = new Map(options.rules.map((rule) => [rule.id, rule]));
  const diagnostics: Finding[] = [];
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
      source: rule.source,
    });
  }

  return {
    diagnostics: diagnostics.sort(compareDiagnostics),
    unknowns,
  };
}

function compareDiagnostics(left: Finding, right: Finding): number {
  return (
    left.path.localeCompare(right.path) ||
    left.range.startLine - right.range.startLine ||
    left.range.startColumn - right.range.startColumn ||
    left.ruleId.localeCompare(right.ruleId)
  );
}
