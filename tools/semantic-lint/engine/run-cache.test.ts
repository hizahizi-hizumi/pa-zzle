import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileDecisionCache } from "../cache/decision-cache.ts";
import type {
  EvaluationPlan,
  Rule,
  SourceDocument,
} from "../domain/model.ts";
import { buildEvaluationPlan } from "../planning/planner.ts";
import {
  FakeDecisionProvider,
  type FakeDecision,
} from "../testing/fake-provider.ts";
import {
  decisionResult,
  sampleRule,
  testExtractor,
} from "../testing/fixtures.ts";
import { runEvaluationPlan } from "./run.ts";

const TWO_TESTS = `test("1つ目こと", () => {
  expect(one()).toBe(1);
});

test("2つ目こと", () => {
  expect(two()).toBe(2);
});
`;

const extractor = await testExtractor();

let directory: string;
let cachePath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "semantic-lint-cache-"));
  cachePath = join(directory, "decisions.jsonl");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("runEvaluationPlanの判定cache", () => {
  test("同じ入力の2回目はproviderを呼ばずに同じ結果を返す", async () => {
    const rule = testRule();
    const plan = planFor([document("a.test.ts", TWO_TESTS)], [rule]);

    const first = await run(plan, [rule]);
    const second = await run(plan, [rule]);

    expect(first.provider.requests).toHaveLength(1);
    expect(first.result.metrics.cache).toEqual({
      enabled: true,
      hits: 0,
      misses: 2,
    });
    expect(second.provider.requests).toHaveLength(0);
    expect(second.result.metrics).toMatchObject({
      providerRequests: 0,
      providerDecisions: 0,
      inputTokens: 0,
      cache: { enabled: true, hits: 2, misses: 0 },
    });
    expect(second.result.evaluations).toEqual(first.result.evaluations);
    expect(second.result.diagnostics).toEqual(first.result.diagnostics);
  });

  test("変更のないfileはhitし、変更したfileのtaskだけproviderへ送る", async () => {
    const rule = testRule();
    await run(
      planFor(
        [document("a.test.ts", TWO_TESTS), document("b.test.ts", TWO_TESTS)],
        [rule],
      ),
      [rule],
    );

    const changed = TWO_TESTS.replace("toBe(2)", "toBe(3)");
    const second = await run(
      planFor(
        [document("a.test.ts", TWO_TESTS), document("b.test.ts", changed)],
        [rule],
      ),
      [rule],
    );

    expect(second.result.metrics.cache).toMatchObject({ hits: 2, misses: 2 });
    expect(requestedTaskIds(second.provider)).toEqual([
      "vitest/sample::test:b.test.ts:0",
      "vitest/sample::test:b.test.ts:1",
    ]);
  });

  test("subjectの一部だけ変えても文脈のfile全体が変わるため同じfileの全subjectがmissになる", async () => {
    const rule = testRule();
    await run(planFor([document("a.test.ts", TWO_TESTS)], [rule]), [rule]);

    const second = await run(
      planFor(
        [document("a.test.ts", TWO_TESTS.replace("toBe(2)", "toBe(3)"))],
        [rule],
      ),
      [rule],
    );

    expect(second.result.metrics.cache).toMatchObject({ hits: 0, misses: 2 });
  });

  test("rule文面を変えたruleのtaskだけmissし、同じbatchにはmiss分だけ入る", async () => {
    const stable = testRule({ id: "vitest/stable" });
    const edited = testRule({ id: "vitest/edited" });
    await run(
      planFor([document("a.test.ts", TWO_TESTS)], [stable, edited]),
      [stable, edited],
    );

    const reworded = testRule({
      id: "vitest/edited",
      predicate: {
        ...edited.predicate,
        instruction: "Classify the subject strictly.",
      },
    });
    const second = await run(
      planFor([document("a.test.ts", TWO_TESTS)], [stable, reworded]),
      [stable, reworded],
    );

    expect(second.provider.requests).toHaveLength(1);
    expect(requestedTaskIds(second.provider)).toEqual([
      "vitest/edited::test:a.test.ts:0",
      "vitest/edited::test:a.test.ts:1",
    ]);
    expect(second.provider.requests[0]?.subjectIds).toHaveLength(2);
    expect(second.result.metrics.cache).toMatchObject({ hits: 2, misses: 2 });
    expect(second.result.evaluations.map((evaluation) => evaluation.taskId))
      .toEqual([
        "vitest/edited::test:a.test.ts:0",
        "vitest/edited::test:a.test.ts:1",
        "vitest/stable::test:a.test.ts:0",
        "vitest/stable::test:a.test.ts:1",
      ]);
  });

  test("outcome文面を変えるとmissする", async () => {
    const rule = testRule();
    const plan = planFor([document("a.test.ts", TWO_TESTS)], [rule]);
    await run(plan, [rule]);

    const edited = testRule({
      predicate: {
        ...rule.predicate,
        outcomes: { ...rule.predicate.outcomes, violation: "clearly violates" },
      },
    });
    const second = await run(plan, [edited]);

    expect(second.result.metrics.cache).toMatchObject({ hits: 0, misses: 2 });
  });

  test("modelが変わるとmissする", async () => {
    const rule = testRule();
    const plan = planFor([document("a.test.ts", TWO_TESTS)], [rule]);
    await run(plan, [rule]);

    const second = await run(plan, [rule], { model: "another-model" });

    expect(second.provider.requests).toHaveLength(1);
    expect(second.result.metrics.cache).toMatchObject({ hits: 0, misses: 2 });
  });

  test("threshold / severityの変更ではhitしたまま違反判定だけが変わる", async () => {
    const rule = testRule({ violationThreshold: 0.9 });
    const plan = planFor([document("a.test.ts", TWO_TESTS)], [rule]);
    const first = await run(plan, [rule], {
      decision: decisionResult("violation", 0.95),
    });

    const stricter = testRule({ violationThreshold: 0.99, severity: "error" });
    const second = await run(plan, [stricter], {
      decision: decisionResult("compliant", 0),
    });

    expect(first.result.diagnostics).toHaveLength(2);
    expect(second.provider.requests).toHaveLength(0);
    expect(second.result.metrics.cache).toMatchObject({ hits: 2, misses: 0 });
    expect(second.result.evaluations.map((evaluation) => evaluation.result))
      .toEqual(first.result.evaluations.map((evaluation) => evaluation.result));
    expect(second.result.diagnostics).toEqual([]);
  });

  test("壊れたcache entryはmissとして扱い、compactで取り除く", async () => {
    const rule = testRule();
    const plan = planFor([document("a.test.ts", TWO_TESTS)], [rule]);
    await run(plan, [rule]);

    const lines = (await Bun.file(cachePath).text()).trimEnd().split("\n");
    const [firstLine = "", secondLine = ""] = lines;
    const invalidProbability = secondLine.replace(
      /"violation":[0-9.]+/,
      '"violation":1.5',
    );
    await Bun.write(
      cachePath,
      [
        firstLine.slice(0, firstLine.length / 2),
        "not json",
        invalidProbability,
        "",
      ].join("\n"),
    );

    const second = await run(plan, [rule]);
    const third = await run(plan, [rule]);

    expect(second.result.metrics.cache).toMatchObject({ hits: 0, misses: 2 });
    expect(third.result.metrics.cache).toMatchObject({ hits: 2, misses: 0 });
    expect((await Bun.file(cachePath).text()).trimEnd().split("\n"))
      .toHaveLength(2);
  });

  test("provider失敗で中断しても、それまでに得た判定は保存される", async () => {
    const rule = testRule();
    const plan = planFor(
      [document("a.test.ts", TWO_TESTS), document("b.test.ts", TWO_TESTS)],
      [rule],
    );
    const cache = await FileDecisionCache.open(cachePath);
    const failing = fakeProvider(plan, (taskId) =>
      taskId.includes("b.test.ts")
        ? () => {
            throw new Error("provider unavailable");
          }
        : decisionResult("compliant", 0),
    );

    await expect(
      runEvaluationPlan({ plan, rules: [rule], provider: failing, cache }),
    ).rejects.toThrow("provider unavailable");

    const retry = await run(plan, [rule]);

    expect(retry.result.metrics.cache).toMatchObject({ hits: 2, misses: 2 });
  });

  test("cacheを渡さない場合は毎回providerへ送り、cacheを作らない", async () => {
    const rule = testRule();
    const plan = planFor([document("a.test.ts", TWO_TESTS)], [rule]);

    for (let index = 0; index < 2; index += 1) {
      const provider = fakeProvider(plan, () => decisionResult("compliant", 0));
      const result = await runEvaluationPlan({ plan, rules: [rule], provider });

      expect(provider.requests).toHaveLength(1);
      expect(result.metrics.cache).toEqual({
        enabled: false,
        hits: 0,
        misses: 0,
      });
    }

    expect(await Bun.file(cachePath).exists()).toBe(false);
  });
});

function testRule(overrides: Partial<Rule> = {}): Rule {
  return sampleRule({
    unit: "test",
    paths: ["**/*.test.ts"],
    ...overrides,
  });
}

function document(path: string, source: string): SourceDocument {
  return { path, source };
}

function planFor(documents: SourceDocument[], rules: Rule[]): EvaluationPlan {
  return buildEvaluationPlan({
    documents,
    rules,
    extractor,
    matchesPath: () => true,
  });
}

function fakeProvider(
  plan: EvaluationPlan,
  decisionFor: (taskId: string) => FakeDecision,
  options: { model?: string } = {},
): FakeDecisionProvider {
  const decisions = Object.fromEntries(
    plan.files.flatMap((file) =>
      file.tasks.map((task) => [task.id, decisionFor(task.id)]),
    ),
  );

  return new FakeDecisionProvider(decisions, options);
}

async function run(
  plan: EvaluationPlan,
  rules: Rule[],
  options: {
    model?: string;
    decision?: FakeDecision;
  } = {},
) {
  const decision = options.decision ?? decisionResult("compliant", 0.1);
  const provider = fakeProvider(
    plan,
    () => decision,
    options.model === undefined ? {} : { model: options.model },
  );
  const cache = await FileDecisionCache.open(cachePath);
  const result = await runEvaluationPlan({ plan, rules, provider, cache });
  await cache.compact();

  return { provider, result };
}

function requestedTaskIds(provider: FakeDecisionProvider): string[] {
  return provider.requests.flatMap((batch) =>
    batch.requests.map((request) => request.taskId),
  );
}
