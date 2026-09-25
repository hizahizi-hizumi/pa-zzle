export const DECISIONS = [
  "violation",
  "compliant",
  "not_applicable",
  "insufficient_context",
] as const;

/**
 * 指摘の重さ。
 * - info: 出力するが、問題として数えず実行を失敗させない。
 * - warning: 問題として数えるが、実行を失敗させない。
 * - error: 問題として数え、実行を失敗させる。
 */
export const SEVERITIES = ["info", "warning", "error"] as const;

export type Decision = (typeof DECISIONS)[number];
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
  severity: Severity;
  violationThreshold: number;
  unit: UnitName;
  paths: string[];
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
  /**
   * カタログがunitの指摘位置を宣言している場合の、その範囲（変数宣言の名前など）。
   * 違反の指摘はこの範囲にし、unitの中の違反箇所は問わない。
   */
  reportRange?: SourceRange;
};

export type EvaluationTask = {
  id: string;
  ruleId: string;
  subjectId: string;
  /** 違反と判定済みのunitで、違反箇所（part）だけを問う2段目のtask。 */
  locate?: boolean;
};

/** sourceの位置。JavaScript文字列のindex（UTF-16 code unit）で表す。 */
export type Span = {
  start: number;
  end: number;
};

/**
 * unitの中で違反箇所の候補になる部分。構文だけで決め、ruleには依存しない。
 * - statement: unit直下の文（入れ子のblockの中の文は含めない）
 * - unit: unit直下の子unit（describeの中のtestなど）
 */
export type PartKind = "statement" | "unit";

export type UnitPart = {
  kind: PartKind;
  span: Span;
  range: SourceRange;
};

/** planに含めたunit。file内の入れ子関係と、カタログが宣言した文脈を持つ。 */
export type PlannedUnit = Subject & {
  span: Span;
  /** `reportRange` のsource上の位置。 */
  reportSpan?: Span;
  /** 違反箇所の候補。sourceの出現順。指摘位置を宣言したunitでは空。 */
  parts: UnitPart[];
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
  /** trueならunitの判定ではなく、unitの各partが違反箇所かを問う。 */
  locate?: boolean;
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
  /**
   * 各partが違反箇所である確率。unitの `parts` と同じ順。
   * 違反と判定したunitについて2段目で問い、問うていないunitでは省略する。
   */
  parts?: number[];
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
  /** unitの判定。`locate` でないrequestのtask idごと。 */
  decisions: Record<string, DecisionResult>;
  /** 各partが違反箇所である確率。`locate` のrequestのtask idごとに、unitの `parts` と同じ順。 */
  locations: Record<string, number[]>;
  usage: ProviderUsage;
};

export interface RequestEstimator {
  estimate(batch: DecisionBatch): RequestEstimate;
}

export interface SemanticDecisionProvider extends RequestEstimator {
  readonly requestIdentity: ProviderRequestIdentity;
  evaluate(batch: DecisionBatch): Promise<DecisionBatchResult>;
}

/** 判定したunitのpartと、そのpartが違反箇所である確率。 */
export type EvaluatedPart = {
  kind: PartKind;
  range: SourceRange;
  probability: number;
};

export type Evaluation = {
  taskId: string;
  ruleId: string;
  subject: Subject;
  result: DecisionResult;
  /** 違反箇所の候補と確率。partのないunitでは省略する。 */
  parts?: EvaluatedPart[];
  provider: ProviderIdentity;
};

/**
 * 指摘。`range` は違反箇所の範囲。指摘位置を宣言したunitではその位置（変数名など）、
 * それ以外ではunit直下の文・子unitで、違反箇所を特定できない場合はunit全体。
 * `subjectRange` / `symbol` は違反と判定したunit。
 */
export type Diagnostic = {
  ruleId: string;
  severity: Severity;
  message: string;
  path: string;
  range: SourceRange;
  subjectRange: SourceRange;
  symbol?: string;
  /** unitの違反確率。thresholdと比べる値。 */
  probability: number;
  confidence: number;
  /** 違反箇所として選んだpartの確率。unit全体を指摘する場合は省略する。 */
  partProbability?: number;
};

export type RunMetrics = {
  scannedFiles: number;
  subjects: number;
  plannedEvaluations: number;
  providerRequests: number;
  providerDecisions: number;
  /** 問題として数える指摘（warning / error）の数。infoは含めない。 */
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
