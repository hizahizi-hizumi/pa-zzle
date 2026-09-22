import type {
  Predicate,
  SemanticDecisionProvider,
  SourceDocument,
  Subject,
} from "../../domain/model.ts";
import type { BenchmarkRule } from "./benchmark.ts";
import { evaluateSubjects, type BatchUsage } from "./evaluate.ts";
import { SELECTOR_CATALOG, type SelectorId } from "./selectors.ts";

const SELECTOR_THRESHOLD = 0.5;

export type InferredSelectors = {
  ruleId: string;
  selected: SelectorId[];
  probabilities: Record<SelectorId, number>;
  decisions: number;
  usage: BatchUsage;
};

export async function inferSelectors(options: {
  rule: BenchmarkRule;
  provider: SemanticDecisionProvider;
  maxDecisionsPerRequest: number;
}): Promise<InferredSelectors> {
  const { rule, provider, maxDecisionsPerRequest } = options;
  const document: SourceDocument = {
    path: `.semantic-lint/poc/selectors/${rule.id}`,
    source: [
      `Rule: ${rule.title}`,
      rule.predicate.instruction,
      ...Object.entries(rule.predicate.outcomes).map(
        ([outcome, description]) => `${outcome}: ${description}`,
      ),
    ].join("\n"),
  };
  const subjects = SELECTOR_CATALOG.map((selector, index) => ({
    id: `selector:${index}:${selector.id}`,
    scope: "selector-catalog",
    path: document.path,
    range: {
      startLine: index + 1,
      startColumn: 1,
      endLine: index + 1,
      endColumn: 2,
    },
    symbol: selector.id,
    source: `${selector.description}\n例: ${selector.example}`,
  })) satisfies Subject[];
  const evaluated = await evaluateSubjects({
    document,
    subjects,
    predicateForSubject: (subject) => selectorPredicate(rule, subject),
    ruleId: `poc/${rule.id}/selector`,
    provider,
    maxDecisionsPerRequest,
  });
  const probabilities = Object.fromEntries(
    SELECTOR_CATALOG.map((selector, index) => {
      const subject = subjects[index];
      const probability = subject
        ? evaluated.results.get(subject.id)?.probabilities.violation ?? 0
        : 0;
      return [selector.id, probability];
    }),
  ) as Record<SelectorId, number>;
  const selected = SELECTOR_CATALOG.filter(
    (selector) => probabilities[selector.id] >= SELECTOR_THRESHOLD,
  ).map((selector) => selector.id);

  return {
    ruleId: rule.id,
    selected,
    probabilities,
    decisions: subjects.length,
    usage: evaluated.usage,
  };
}

function selectorPredicate(rule: BenchmarkRule, subject: Subject): Predicate {
  return {
    instruction: [
      `Rule: ${rule.title}`,
      rule.predicate.instruction,
      "現在のsubjectはAST selector候補の説明である。",
      "このselectorで抽出されるnode自体が、このruleの違反を直接分類するcandidateになり得るか判定する。",
      "単に周辺contextやcontainerとして必要なだけなら選ばない。",
      "primary diagnostic locationまたはその直接の構文単位になり得るselectorは選ぶ。",
      `Selector: ${subject.symbol ?? subject.id}`,
    ].join("\n"),
    outcomes: {
      violation: "このselectorはruleの直接candidateを抽出するため必要である。",
      compliant: "このselectorはruleの直接candidateには不要である。",
      not_applicable: "このselectorのnode種別はruleと無関係である。",
      insufficient_context: "rule記述だけではこのselectorが必要か判断できない。",
    },
  };
}
