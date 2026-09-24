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
/** ruleの `unit` に書く語彙。unitカタログ（`catalog/units.yaml`）で定義する。 */
export type UnitName = string;

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
  unit: UnitName;
  paths: string[];
  source: {
    path: string;
    section: string;
  };
  predicate: Predicate;
};

/** 判定対象のunit。範囲とsymbolはカタログのqueryで決定論的に決め、modelには生成させない。 */
export type Subject = {
  id: string;
  unit: UnitName;
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

/** sourceの位置。JavaScript文字列のindex（UTF-16 code unit）で表す。 */
export type Span = {
  start: number;
  end: number;
};

/** planに含めたunit。file内の入れ子関係と、カタログが宣言した文脈を持つ。 */
export type PlannedUnit = Subject & {
  span: Span;
  /** このunitを囲む、同じfileのplanned unitのうち最も内側のもの。 */
  parentId?: string;
  /** カタログのcontext宣言で、このunitの判定文脈に含めるplanned unit。 */
  contextIds: string[];
};

export type PlannedFile = {
  path: string;
  source: string;
  /** 判定stateでunit本文を置き換える目印。`{ref}` に参照先が入る。 */
  marker: string;
  units: PlannedUnit[];
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
  marker: string;
  /** fileのplanned unit全体。stateに含めないunitは目印だけにする。 */
  units: PlannedUnit[];
  /** stateへ本文を含めるunit。判定対象と、その祖先・文脈のunit。 */
  subjectIds: string[];
  requests: DecisionRequest[];
};

/** providerへ送る前に見積もるrequestの大きさ（input token）。 */
export type RequestEstimate = {
  state: number;
  questions: number[];
  total: number;
};

/** 1 requestに収めるtokenの上限。 */
export type RequestTokenBudget = {
  /** state + 最も長い質問1つ。 */
  stateAndQuestion: number;
  /** request全体。 */
  total: number;
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

export interface RequestEstimator {
  estimate(batch: DecisionBatch): RequestEstimate;
}

export interface SemanticDecisionProvider extends RequestEstimator {
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
  cache: CacheMetrics;
  totalDurationMs: number;
  providerLatencyMs: number[];
};

export type CacheMetrics = {
  enabled: boolean;
  hits: number;
  misses: number;
};

export type RunResult = {
  schemaVersion: 1;
  diagnostics: Diagnostic[];
  unknowns: Evaluation[];
  evaluations: Evaluation[];
  metrics: RunMetrics;
};
