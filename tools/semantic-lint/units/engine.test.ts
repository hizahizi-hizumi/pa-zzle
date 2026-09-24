import { describe, expect, test } from "bun:test";

import { FakeChoiceProvider, choiceAnswer } from "../testing/fake-provider.ts";
import { sampleRule } from "../testing/fixtures.ts";
import { MemoryDecisionCache } from "./cache.ts";
import { buildUnitPlan, runUnitPlan } from "./engine.ts";
import { createDefaultUnitRegistry } from "./registry.ts";

const source = `describe("対象", () => {
  test("値を返すこと", () => {
    const input = createInput();

    const result = act(input);

    expect(result).toBe(1);
  });
});
`;
const rule = sampleRule({
  id: "sample/arrange",
  scope: undefined,
  unit: "function",
  violationThreshold: 0.8,
});

function plan() {
  return buildUnitPlan({
    documents: [{ path: "a.test.ts", source }],
    rules: [rule],
    units: createDefaultUnitRegistry(),
    matchesPath: () => true,
  });
}

/** describeは違反と誤判定し、testは違反と判定して3行目を指す。 */
function fakeProvider(): FakeChoiceProvider {
  return new FakeChoiceProvider((question) => {
    if ("L3" in question.criteria) {
      return choiceAnswer(question, { L3: 0.9 });
    }

    if (question.instructions.includes("lines 2-8")) {
      return choiceAnswer(question, { violation: 0.95 });
    }

    return choiceAnswer(question, { violation: 0.85 });
  });
}

describe("runUnitPlan", () => {
  test("単位で判定してから違反単位の中で行を特定し、入れ子の重複を内側に寄せる", async () => {
    const provider = fakeProvider();
    const result = await runUnitPlan({
      plan: plan(),
      units: createDefaultUnitRegistry(),
      provider,
      engine: { locateMode: "lines" },
    });

    expect(result.metrics.judgeRequests).toBe(1);
    expect(result.metrics.locateRequests).toBe(1);
    expect(
      result.evaluations.map((evaluation) =>
        evaluation.locations?.map((range) => [range.startLine, range.endLine]),
      ),
    ).toEqual([[[2, 8]], [[3, 3]]]);
    expect(
      result.diagnostics.map((diagnostic) => [
        diagnostic.range.startLine,
        diagnostic.range.endLine,
      ]),
    ).toEqual([[3, 3]]);
  });

  test("threshold未満のviolationは位置特定しない", async () => {
    const provider = fakeProvider();
    const strictRule = { ...rule, violationThreshold: 0.9 };
    const strictPlan = buildUnitPlan({
      documents: [{ path: "a.test.ts", source }],
      rules: [strictRule],
      units: createDefaultUnitRegistry(),
      matchesPath: () => true,
    });
    const result = await runUnitPlan({
      plan: strictPlan,
      units: createDefaultUnitRegistry(),
      provider,
      engine: { locateMode: "lines" },
    });
    const locateQuestions = provider.requests
      .slice(1)
      .flatMap((request) => Object.keys(request.questions));

    expect(locateQuestions).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.range.startLine))
      .toEqual([3]);
  });

  test("同じ判定素材はキャッシュから返し、providerを呼ばない", async () => {
    const cache = new MemoryDecisionCache();
    await runUnitPlan({
      plan: plan(),
      units: createDefaultUnitRegistry(),
      provider: fakeProvider(),
      cache,
      engine: { locateMode: "lines" },
    });
    const provider = fakeProvider();
    const cached = await runUnitPlan({
      plan: plan(),
      units: createDefaultUnitRegistry(),
      provider,
      cache,
      engine: { locateMode: "lines" },
    });

    expect(provider.requests).toHaveLength(0);
    expect(cached.metrics.cacheHits).toBe(4);
    expect(cached.diagnostics).toHaveLength(1);
  });
});
