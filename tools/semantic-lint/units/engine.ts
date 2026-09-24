import {
  DECISIONS,
  type Decision,
  type DecisionResult,
  type Diagnostic,
  type Evaluation,
  type Rule,
  type RuleStatus,
  type RunResult,
  type SourceDocument,
  type SourceRange,
} from "../domain/model.ts";
import { mapConcurrent } from "../engine/run.ts";
import type { PathMatcher } from "../planning/planner.ts";
import type {
  ChoiceAnswer,
  ChoiceProvider,
  ChoiceQuestion,
} from "../providers/choice.ts";
import { type DecisionCache, decisionCacheKey } from "./cache.ts";
import { dedupeNestedFindings } from "./dedupe.ts";
import {
  type LocateMode,
  locateProbes,
  selectFromProbes,
} from "./locate.ts";
import {
  DEFAULT_UNIT_OPTIONS,
  type Unit,
  type UnitDocument,
  type UnitExtractionOptions,
} from "./model.ts";
import { buildUnitState, judgeQuestion, probeQuestion } from "./prompts.ts";
import type { UnitRegistry } from "./registry.ts";
import type { LineSpan } from "./syntax.ts";

export type UnitTask = {
  id: string;
  rule: Rule;
  unit: Unit;
};

export type UnitPlannedFile = {
  document: UnitDocument;
  tasks: UnitTask[];
};

export type UnitPlan = {
  files: UnitPlannedFile[];
};

export type UnitEngineOptions = {
  unitOptions: UnitExtractionOptions;
  locateMode: LocateMode;
  /** thresholdに関係なくviolation判定の単位をすべて位置特定する。threshold sweep用。 */
  locateAllViolations: boolean;
  maxQuestionsPerRequest: number;
  concurrency: number;
};

export const DEFAULT_UNIT_ENGINE_OPTIONS: UnitEngineOptions = {
  unitOptions: DEFAULT_UNIT_OPTIONS,
  locateMode: "judge",
  locateAllViolations: false,
  maxQuestionsPerRequest: 64,
  concurrency: 1,
};

export function isUnitRule(rule: Rule): boolean {
  return rule.unit !== undefined;
}

/** unit ruleを適用pathの文書ごとに単位へ展開する。単位は文書ごとに1回だけ抽出する。 */
export function buildUnitPlan(options: {
  documents: readonly SourceDocument[];
  rules: readonly Rule[];
  units: UnitRegistry;
  matchesPath: PathMatcher;
  statuses?: readonly RuleStatus[];
  unitOptions?: UnitExtractionOptions;
}): UnitPlan {
  const {
    documents,
    rules,
    units,
    matchesPath,
    statuses = ["active"],
    unitOptions = DEFAULT_UNIT_OPTIONS,
  } = options;
  const allowed = new Set(statuses);
  const executable = rules
    .filter((rule) => isUnitRule(rule) && allowed.has(rule.status))
    .sort((left, right) => left.id.localeCompare(right.id));
  const files: UnitPlannedFile[] = [];

  for (const document of [...documents].sort((a, b) =>
    a.path.localeCompare(b.path),
  )) {
    const matching = executable.filter((rule) =>
      matchesPath(rule.paths, document.path),
    );

    if (matching.length === 0) {
      continue;
    }

    const unitDocument = units.build(
      document,
      matching.map((rule) => rule.unit ?? ""),
      unitOptions,
    );
    const tasks = unitDocument.units.flatMap((unit) =>
      matching
        .filter((rule) => rule.unit === unit.kind)
        .map((rule) => ({ id: `${rule.id}::${unit.id}`, rule, unit })),
    );

    files.push({ document: unitDocument, tasks });
  }

  return { files };
}

type PendingQuestion = {
  id: string;
  unit: Unit;
  cacheKey: string;
  build: (unitKey: string) => ChoiceQuestion;
};

type AskedChunk = {
  document: UnitDocument;
  questions: PendingQuestion[];
};

type AskStats = {
  requests: number;
  questions: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  latencies: number[];
  model: string;
};

export async function runUnitPlan(options: {
  plan: UnitPlan;
  units: UnitRegistry;
  provider: ChoiceProvider;
  cache?: DecisionCache;
  engine?: Partial<UnitEngineOptions>;
}): Promise<RunResult> {
  const { plan, units, provider, cache } = options;
  const engine = { ...DEFAULT_UNIT_ENGINE_OPTIONS, ...options.engine };
  const startedAt = performance.now();
  const contextMode = engine.unitOptions.contextMode;

  const judgeStats = emptyStats(provider.model);
  const judged = await askAll({
    chunks: plan.files.flatMap((file) =>
      chunk(
        file.tasks.map((task) => ({
          id: task.id,
          unit: task.unit,
          cacheKey: decisionCacheKey({
            stage: "judge",
            model: provider.model,
            rule: task.rule.predicate,
            unit: task.unit.kind,
            contextMode,
            target: cacheTarget(task.unit),
            context: contextTexts(file.document, task.unit),
          }),
          build: (unitKey: string) =>
            judgeQuestion({
              unit: task.unit,
              unitKey,
              unitDescription: units.description(task.unit.kind),
              predicate: task.rule.predicate,
            }),
        })),
        engine.maxQuestionsPerRequest,
      ).map((questions) => ({ document: file.document, questions })),
    ),
    provider,
    cache,
    concurrency: engine.concurrency,
    stats: judgeStats,
  });

  const decisions = new Map<string, DecisionResult>();

  for (const file of plan.files) {
    for (const task of file.tasks) {
      const answer = judged.get(task.id);

      if (!answer) {
        throw new Error(`provider responseに判定がありません: ${task.id}`);
      }

      decisions.set(task.id, toDecisionResult(task.id, answer));
    }
  }

  const locateTargets = plan.files.map((file) => ({
    document: file.document,
    targets: file.tasks
      .filter((task) => {
        const result = decisions.get(task.id);

        return (
          result !== undefined &&
          result.decision === "violation" &&
          (engine.locateAllViolations ||
            result.probabilities.violation >= task.rule.violationThreshold)
        );
      })
      .map((task) => ({
        task,
        probes: locateProbes(
          task.unit,
          file.document.source.split("\n"),
          engine.locateMode,
        ),
      })),
  }));
  const locateStats = emptyStats(provider.model);
  const located = await askAll({
    chunks: locateTargets.flatMap(({ document, targets }) =>
      chunk(
        targets.flatMap(({ task, probes }) =>
          probes.map((probe, index) => ({
            id: locateQuestionId(task.id, index),
            unit: task.unit,
            cacheKey: decisionCacheKey({
              stage: "locate",
              model: provider.model,
              rule: task.rule.predicate,
              unit: task.unit.kind,
              contextMode,
              target: cacheTarget(task.unit),
              context: contextTexts(document, task.unit),
              criteria: probeQuestion({
                unit: task.unit,
                unitKey: "",
                predicate: task.rule.predicate,
                probe,
              }).criteria,
              ...(probe.kind === "statement"
                ? { probe: `${probe.target.startLine}-${probe.target.endLine}` }
                : {}),
            }),
            build: (unitKey: string) =>
              probeQuestion({
                unit: task.unit,
                unitKey,
                predicate: task.rule.predicate,
                probe,
              }),
          })),
        ),
        engine.maxQuestionsPerRequest,
      ).map((questions) => ({ document, questions })),
    ),
    provider,
    cache,
    concurrency: engine.concurrency,
    stats: locateStats,
  });

  const locations = new Map<string, LineSpan[]>();

  for (const { targets } of locateTargets) {
    for (const { task, probes } of targets) {
      if (probes.length === 0) {
        continue;
      }

      locations.set(
        task.id,
        selectFromProbes(
          task.unit,
          probes,
          probes.map((_, index) =>
            located.get(locateQuestionId(task.id, index)),
          ),
        ),
      );
    }
  }

  const providerIdentity = {
    kind: provider.kind,
    model: judgeStats.model,
  };
  const evaluations: Evaluation[] = plan.files.flatMap((file) =>
    file.tasks.map((task) => {
      const result = decisions.get(task.id);

      if (!result) {
        throw new Error(`判定結果がありません: ${task.id}`);
      }

      const taskLocations = locations.get(task.id);
      const lines = file.document.source.split("\n");

      return {
        taskId: task.id,
        ruleId: task.rule.id,
        subject: {
          id: task.unit.id,
          scope: `unit:${task.unit.kind}`,
          path: task.unit.path,
          range: toSourceRange(task.unit.span, lines),
          symbol: task.unit.symbol,
          source: task.unit.source,
        },
        result,
        provider: providerIdentity,
        ...(taskLocations === undefined
          ? {}
          : {
              locations: taskLocations.map((span) =>
                toSourceRange(span, lines),
              ),
            }),
      };
    }),
  );
  const rules = uniqueRules(plan);
  const diagnostics = buildUnitDiagnostics(evaluations, rules);
  const unknowns = evaluations.filter(
    (evaluation) => evaluation.result.decision === "insufficient_context",
  );

  await cache?.flush();

  return {
    schemaVersion: 1,
    diagnostics,
    unknowns,
    evaluations,
    metrics: {
      scannedFiles: plan.files.length,
      subjects: plan.files.reduce(
        (sum, file) => sum + file.document.units.length,
        0,
      ),
      plannedEvaluations: plan.files.reduce(
        (sum, file) => sum + file.tasks.length,
        0,
      ),
      providerRequests: judgeStats.requests + locateStats.requests,
      providerDecisions: judgeStats.questions + locateStats.questions,
      diagnostics: diagnostics.length,
      unknowns: unknowns.length,
      inputTokens: judgeStats.inputTokens + locateStats.inputTokens,
      outputTokens: judgeStats.outputTokens + locateStats.outputTokens,
      totalDurationMs: performance.now() - startedAt,
      providerLatencyMs: [...judgeStats.latencies, ...locateStats.latencies],
      judgeRequests: judgeStats.requests,
      locateRequests: locateStats.requests,
      cacheHits: judgeStats.cacheHits + locateStats.cacheHits,
    },
  };
}

/**
 * threshold以上のviolationを、位置特定した範囲 (なければ単位全体) の指摘にする。
 * 入れ子の単位による重複はrule別に最も内側の指摘だけを残す。
 */
export function buildUnitDiagnostics(
  evaluations: readonly Evaluation[],
  rules: readonly Rule[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const rule of rules) {
    const candidates = evaluations
      .filter(
        (evaluation) =>
          evaluation.ruleId === rule.id &&
          evaluation.result.decision === "violation" &&
          evaluation.result.probabilities.violation >= rule.violationThreshold,
      )
      .sort(
        (left, right) =>
          right.result.probabilities.violation -
          left.result.probabilities.violation,
      )
      .flatMap((evaluation) =>
        (evaluation.locations ?? [evaluation.subject.range]).map((range) => ({
          path: evaluation.subject.path,
          startLine: range.startLine,
          endLine: range.endLine,
          range,
          evaluation,
        })),
      );

    for (const finding of dedupeNestedFindings(candidates)) {
      diagnostics.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.title,
        path: finding.path,
        range: finding.range,
        symbol: finding.evaluation.subject.symbol ?? finding.path,
        probability: finding.evaluation.result.probabilities.violation,
        confidence: finding.evaluation.result.confidence,
        source: rule.source,
      });
    }
  }

  return diagnostics.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.range.startLine - right.range.startLine ||
      left.ruleId.localeCompare(right.ruleId),
  );
}

/** 同じ文書の質問を束ね、キャッシュにない質問だけをproviderへ送る。 */
async function askAll(options: {
  chunks: AskedChunk[];
  provider: ChoiceProvider;
  cache: DecisionCache | undefined;
  concurrency: number;
  stats: AskStats;
}): Promise<Map<string, ChoiceAnswer>> {
  const { chunks, provider, cache, concurrency, stats } = options;
  const answers = new Map<string, ChoiceAnswer>();
  const pending: AskedChunk[] = [];

  for (const askedChunk of chunks) {
    const uncached: PendingQuestion[] = [];

    for (const question of askedChunk.questions) {
      const cached = cache?.get(question.cacheKey);

      if (cached) {
        answers.set(question.id, cached);
        stats.cacheHits += 1;
      } else {
        uncached.push(question);
      }
    }

    if (uncached.length > 0) {
      pending.push({ document: askedChunk.document, questions: uncached });
    }
  }

  const responses = await mapConcurrent(
    pending,
    concurrency,
    async (askedChunk) => {
      const unitKeys = new Map<string, string>();

      for (const question of askedChunk.questions) {
        if (!unitKeys.has(question.unit.id)) {
          unitKeys.set(question.unit.id, "u" + unitKeys.size);
        }
      }

      const questionIds = askedChunk.questions.map((_, index) => "q" + index);
      const startedAt = performance.now();
      const response = await provider.ask({
        state: buildUnitState(
          askedChunk.document,
          uniqueUnits(askedChunk.questions),
          unitKeys,
        ),
        questions: Object.fromEntries(
          askedChunk.questions.map((question, index) => [
            questionIds[index] ?? "q" + index,
            question.build(unitKeys.get(question.unit.id) ?? ""),
          ]),
        ),
      });

      return {
        askedChunk,
        questionIds,
        response,
        latency: performance.now() - startedAt,
      };
    },
  );

  for (const { askedChunk, questionIds, response, latency } of responses) {
    stats.requests += 1;
    stats.questions += askedChunk.questions.length;
    stats.inputTokens += response.usage.inputTokens;
    stats.outputTokens += response.usage.outputTokens;
    stats.latencies.push(latency);
    stats.model = response.model;

    askedChunk.questions.forEach((question, index) => {
      const answer = response.answers[questionIds[index] ?? ""];

      if (!answer) {
        throw new Error(`provider回答がありません: ${question.id}`);
      }

      answers.set(question.id, answer);
      cache?.set(question.cacheKey, answer);
    });
  }

  return answers;
}

function toDecisionResult(taskId: string, answer: ChoiceAnswer): DecisionResult {
  if (!DECISIONS.includes(answer.choice as Decision)) {
    throw new Error(`判定の選択肢が不正です: ${taskId} ${answer.choice}`);
  }

  return {
    decision: answer.choice as Decision,
    confidence: answer.confidence,
    probabilities: Object.fromEntries(
      DECISIONS.map((decision) => [decision, answer.probabilities[decision] ?? 0]),
    ) as Record<Decision, number>,
  };
}

function contextTexts(document: UnitDocument, unit: Unit): string[] {
  const byId = new Map(document.contexts.map((context) => [context.id, context]));

  return [
    document.outline,
    ...unit.contextIds.map((id) => byId.get(id)?.source ?? ""),
  ];
}

function cacheTarget(unit: Unit): string {
  return unit.position === undefined
    ? unit.source
    : `${unit.source}\n@${unit.position}`;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error("maxQuestionsPerRequestは1以上の整数で指定してください。");
  }

  const chunks: T[][] = [];

  for (let offset = 0; offset < values.length; offset += size) {
    chunks.push(values.slice(offset, offset + size));
  }

  return chunks;
}

function uniqueUnits(questions: readonly PendingQuestion[]): Unit[] {
  const byId = new Map<string, Unit>();

  for (const question of questions) {
    byId.set(question.unit.id, question.unit);
  }

  return [...byId.values()];
}

function uniqueRules(plan: UnitPlan): Rule[] {
  const byId = new Map<string, Rule>();

  for (const file of plan.files) {
    for (const task of file.tasks) {
      byId.set(task.rule.id, task.rule);
    }
  }

  return [...byId.values()];
}

function locateQuestionId(taskId: string, windowIndex: number): string {
  return `${taskId}::locate:${windowIndex}`;
}

function emptyStats(model: string): AskStats {
  return {
    requests: 0,
    questions: 0,
    cacheHits: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencies: [],
    model,
  };
}

function toSourceRange(span: LineSpan, lines: readonly string[]): SourceRange {
  return {
    startLine: span.startLine,
    startColumn: 1,
    endLine: span.endLine,
    endColumn: (lines[span.endLine - 1]?.length ?? 0) + 1,
  };
}
