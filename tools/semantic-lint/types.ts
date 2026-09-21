export const DECISION_CHOICES = [
  "violation",
  "compliant",
  "not_applicable",
  "insufficient_context",
] as const;

export type DecisionChoice = (typeof DECISION_CHOICES)[number];
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
  version: 1;
  id: string;
  title: string;
  target: "file";
  severity: Severity;
  violationThreshold: number;
  include: string[];
  exclude: string[];
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

export type RuleEvaluation = {
  rule: RuleConfig;
  answer: ChoiceAnswer;
};

export type FileEvaluation = {
  path: string;
  model: string;
  durationMs: number;
  evaluations: RuleEvaluation[];
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};
