export const DECISION_CHOICES = [
  "violation",
  "compliant",
  "not_applicable",
  "insufficient_context",
] as const;

export const RULE_SCOPES = [
  "file",
  "vitest:test",
  "vitest:beforeEach",
  "vitest:describe",
] as const;

export type DecisionChoice = (typeof DECISION_CHOICES)[number];
export type RuleScope = (typeof RULE_SCOPES)[number];
export type Severity = "warning" | "error";

export type TypeSafeProviderConfig = {
  kind: "typesafe";
  model: string;
  apiKeyEnv: string;
};

export type LintConfig = {
  version: 1;
  provider: TypeSafeProviderConfig;
  rulesDir: string;
  casesDir: string;
  concurrency: number;
};

export type RuleConfig = {
  id: string;
  title: string;
  scope: RuleScope;
  severity: Severity;
  violationThreshold: number;
  paths: string[];
  excludePaths: string[];
  source: {
    path: string;
    section: string;
  };
  question: {
    instructions: string;
    criteria: Record<DecisionChoice, string>;
  };
};

export type Target = {
  absolutePath: string;
  path: string;
  rules: RuleConfig[];
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<DecisionChoice, string>;
};

export type ChoiceAnswer = {
  choice: DecisionChoice;
  confidence: number;
  probabilities: Record<DecisionChoice, number>;
};

export type ProviderRequest = {
  state: unknown;
  questions: Record<string, ChoiceQuestion>;
};

export type ProviderResponse = {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

export interface DecisionProvider {
  evaluate(request: ProviderRequest): Promise<ProviderResponse>;
}

export type SourceRange = {
  startLine: number;
  endLine: number;
};

export type SemanticUnit = {
  id: string;
  kind: RuleScope;
  symbol: string;
  range: SourceRange;
  source: string;
};

export type DiagnosticLocation = {
  kind: RuleScope;
  symbol: string;
  range: SourceRange;
  answer: ChoiceAnswer;
};

export type RuleEvaluation = {
  rule: RuleConfig;
  answer: ChoiceAnswer;
  locations: DiagnosticLocation[];
};

export type FileEvaluation = {
  path: string;
  model: string;
  durationMs: number;
  requestCount: number;
  evaluations: RuleEvaluation[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};
