import { afterEach, describe, expect, test } from "bun:test";

import type { DecisionBatch } from "../../domain/model.ts";
import { sampleRule } from "../../testing/fixtures.ts";
import { buildRequest, createTypeSafeProvider } from "./provider.ts";

const originalApiKey = process.env.TYPESAFE_API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.TYPESAFE_API_KEY;
  } else {
    process.env.TYPESAFE_API_KEY = originalApiKey;
  }
});

describe("TypeSafe provider", () => {
  test("domain batchをJev requestへ変換する", () => {
    const rule = sampleRule();
    const batch = sampleBatch(rule.id);
    const { body, questionToTask } = buildRequest("jev-latest", batch);

    expect(questionToTask.get("q0")).toEqual({ taskId: "task-1" });
    expect(body).toMatchObject({
      model: "jev-latest",
      state: {
        file: {
          path: "frontend/example.test.ts",
          source:
            "/* state.subjects.s0 begin */const value = 1;\n/* state.subjects.s0 end */",
        },
        subjects: {
          s0: {
            unit: "file",
            symbol: "frontend/example.test.ts",
          },
        },
      },
      questions: {
        q0: {
          type: "choice",
          criteria: rule.predicate.outcomes,
        },
      },
    });
  });

  test("locateのrequestでは違反箇所の候補をstateの目印で囲み、候補ごとにnoulで問う", () => {
    const rule = sampleRule();
    const batch = batchWithParts(rule.id);
    const { body, questionToTask } = buildRequest("jev-latest", batch);

    expect(body.state.file.source).toBe(
      '/* state.subjects.s0 begin */test("a", () => {\n  /* p0 */const value = 1;/* /p0 */\n  /* p1 */expect(value).toBe(1);/* /p1 */\n})/* state.subjects.s0 end */;\n',
    );
    expect(body.state.rules).toEqual({
      r0: {
        instruction: rule.predicate.instruction,
        violation: rule.predicate.outcomes.violation,
      },
    });
    expect(body.questions.q0p1).toEqual({
      type: "noul",
      instructions:
        "Assume state.subjects.s0 violates state.rules.r0. Is part p1 one of the places where it does?",
    });
    expect(questionToTask.get("q0p1")).toEqual({ taskId: "task-1", part: 1 });
    expect(body.questions.q0).toBeUndefined();
  });

  test("partの回答をtaskごとにpartの順で返す", async () => {
    process.env.TYPESAFE_API_KEY = "secret";
    const provider = createTypeSafeProvider(
      {
        kind: "typesafe",
        model: "jev-latest",
        apiKeyEnv: "TYPESAFE_API_KEY",
      },
      {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              model: "jev-2026-09",
              answers: {
                q0p1: { type: "noul", noul: 0.2 },
                q0p0: { type: "noul", noul: 0.8 },
              },
              usage: { input_tokens: 10, output_tokens: 0 },
            }),
            { status: 200 },
          ),
      },
    );

    const response = await provider.evaluate(batchWithParts("vitest/sample"));

    expect(response.locations["task-1"]).toEqual([0.8, 0.2]);
    expect(response.decisions).toEqual({});
  });

  test("Jev responseをtask idへ戻す", async () => {
    process.env.TYPESAFE_API_KEY = "secret";
    const requests: RequestInit[] = [];
    const provider = createTypeSafeProvider(
      {
        kind: "typesafe",
        model: "jev-latest",
        apiKeyEnv: "TYPESAFE_API_KEY",
      },
      {
        fetchImpl: async (_input, init) => {
          requests.push(init ?? {});

          return new Response(
            JSON.stringify({
              model: "jev-2026-09",
              answers: {
                q0: {
                  type: "choice",
                  choice: "violation",
                  confidence: 0.95,
                  probabilities: {
                    violation: 0.95,
                    compliant: 0.03,
                    not_applicable: 0.01,
                    insufficient_context: 0.01,
                  },
                },
              },
              usage: {
                input_tokens: 123,
                output_tokens: 0,
              },
            }),
            { status: 200 },
          );
        },
      },
    );

    const response = await provider.evaluate(sampleBatch("vitest/sample"));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers).toEqual({
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    });
    expect(response.provider).toEqual({
      kind: "typesafe",
      model: "jev-2026-09",
    });
    expect(response.decisions["task-1"]).toMatchObject({
      decision: "violation",
      confidence: 0.95,
    });
    expect(response.usage.inputTokens).toBe(123);
  });

  test("429をbounded retryする", async () => {
    process.env.TYPESAFE_API_KEY = "secret";
    let attempts = 0;
    const sleeps: number[] = [];
    const provider = createTypeSafeProvider(
      {
        kind: "typesafe",
        model: "jev-latest",
        apiKeyEnv: "TYPESAFE_API_KEY",
      },
      {
        fetchImpl: async () => {
          attempts += 1;

          if (attempts === 1) {
            return new Response("rate limited", { status: 429 });
          }

          return new Response(
            JSON.stringify({
              model: "jev-latest",
              answers: {
                q0: {
                  type: "choice",
                  choice: "compliant",
                  confidence: 0.99,
                  probabilities: {
                    violation: 0.01,
                    compliant: 0.99,
                    not_applicable: 0,
                    insufficient_context: 0,
                  },
                },
              },
            }),
            { status: 200 },
          );
        },
        sleep: async (milliseconds) => {
          sleeps.push(milliseconds);
        },
      },
    );

    await provider.evaluate(sampleBatch("vitest/sample"));

    expect(attempts).toBe(2);
    expect(sleeps).toEqual([250]);
  });
});

function sampleBatch(ruleId: string): DecisionBatch {
  const rule = sampleRule({ id: ruleId });

  return {
    id: "batch-1",
    file: {
      path: "frontend/example.test.ts",
      source: "const value = 1;\n",
    },
    marker: "/* {ref} */",
    subjectIds: ["subject-1"],
    units: [
      {
        id: "subject-1",
        unit: "file",
        path: "frontend/example.test.ts",
        range: {
          startLine: 1,
          startColumn: 1,
          endLine: 2,
          endColumn: 1,
        },
        symbol: "frontend/example.test.ts",
        source: "const value = 1;\n",
        span: { start: 0, end: 17 },
        parts: [],
        contextIds: [],
      },
    ],
    requests: [
      {
        taskId: "task-1",
        ruleId: rule.id,
        subjectId: "subject-1",
        predicate: rule.predicate,
      },
    ],
  };
}

function batchWithParts(ruleId: string): DecisionBatch {
  const rule = sampleRule({ id: ruleId, unit: "test" });
  const source = 'test("a", () => {\n  const value = 1;\n  expect(value).toBe(1);\n});\n';
  const statement = (text: string) => {
    const start = source.indexOf(text);
    const line = source.slice(0, start).split("\n").length;

    return {
      kind: "statement" as const,
      span: { start, end: start + text.length },
      range: {
        startLine: line,
        startColumn: 3,
        endLine: line,
        endColumn: 3 + text.length,
      },
    };
  };

  return {
    id: "batch-1",
    file: { path: "frontend/example.test.ts", source },
    marker: "/* {ref} */",
    subjectIds: ["subject-1"],
    units: [
      {
        id: "subject-1",
        unit: "test",
        path: "frontend/example.test.ts",
        range: { startLine: 1, startColumn: 1, endLine: 4, endColumn: 3 },
        symbol: 'test("a")',
        source: source.slice(0, source.indexOf(";\n}") + 4),
        span: { start: 0, end: source.lastIndexOf(")") + 1 },
        parts: [
          statement("const value = 1;"),
          statement("expect(value).toBe(1);"),
        ],
        contextIds: [],
      },
    ],
    requests: [
      {
        taskId: "task-1",
        ruleId: rule.id,
        subjectId: "subject-1",
        predicate: rule.predicate,
        locate: true,
      },
    ],
  };
}
