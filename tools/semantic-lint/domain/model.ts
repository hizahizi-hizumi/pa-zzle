export const DECISIONS = [
  "violation",
  "compliant",
  "not_applicable",
  "insufficient_context",
] as const;

export const RULE_STATUSES = ["draft", "active", "disabled"] as const;
export const SEVERITIES = ["warning", "error"] as const;

export type Decision = (typeof DECISIONS)[number];
export type RuleStatus = (typeof RULE_STATUSES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type ScopeId = string;

export type SourceRange = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

export type SourceDocument = {
  path: string;
  source: string;
};

export type Predicate = {
  instruction: string;
  outcomes: Record<Decision, string>;
};

export type Rule = {
  id: string;
  rulesetId: string;
  title: string;
  status: RuleStatus;
  severity: Severity;
  violationThreshold: number;
  scope: ScopeId;
  paths: string[];
  source: {
    path: string;
    section: string;
  };
  predicate: Predicate;
};

export type Subject = {
  id: string;
  scope: ScopeId;
  path: string;
  range: SourceRange;
  symbol?: string;
  source: string;
};

export type EvaluationTask = {
  id: string;
  ruleId: string;
  subjectId: string;
};

export type PlannedFile = {
  path: string;
  source: string;
  subjects: Subject[];
  tasks: EvaluationTask[];
};

export type EvaluationPlan = {
  files: PlannedFile[];
};

export type DecisionRequest = {
  taskId: string;
  ruleId: string;
  subjectId: string;
  predicate: Predicate;
};

export type DecisionBatch = {
  id: string;
  file: SourceDocument;
  subjects: Subject[];
  requests: DecisionRequest[];
};

export type DecisionResult = {
  decision: Decision;
  confidence: number;
  probabilities: Record<Decision, number>;
};

export type ProviderIdentity = {
  kind: string;
  model: string;
};

/**
 * providerへ送るrequestを決める識別情報。requestより前に確定している値だけを持つ。
 * requestFormatはprovider側のprompt / request組み立てを変えたときに更新する。
 */
export type ProviderRequestIdentity = {
  kind: string;
  model: string;
  requestFormat: string;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type DecisionBatchResult = {
  provider: ProviderIdentity;
  decisions: Record<string, DecisionResult>;
  usage: ProviderUsage;
};

export interface SemanticDecisionProvider {
  readonly requestIdentity: ProviderRequestIdentity;
  evaluate(batch: DecisionBatch): Promise<DecisionBatchResult>;
}

export type Evaluation = {
  taskId: string;
  ruleId: string;
  subject: Subject;
  result: DecisionResult;
  provider: ProviderIdentity;
};

export type Diagnostic = {
  ruleId: string;
  severity: Severity;
  message: string;
  path: string;
  range: SourceRange;
  symbol?: string;
  probability: number;
  confidence: number;
  source: {
    path: string;
    section: string;
  };
};

export type RunMetrics = {
  scannedFiles: number;
  subjects: number;
  plannedEvaluations: number;
  providerRequests: number;
  providerDecisions: number;
  diagnostics: number;
  unknowns: number;
  inputTokens: number;
  outputTokens: number;
  totalDurationMs: number;
  providerLatencyMs: number[];
};

export type RunResult = {
  schemaVersion: 1;
  diagnostics: Diagnostic[];
  unknowns: Evaluation[];
  evaluations: Evaluation[];
  metrics: RunMetrics;
};
