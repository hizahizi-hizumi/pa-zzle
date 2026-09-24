import { afterEach, describe, expect, test } from "bun:test";

import type { DecisionBatch } from "../../domain/model.ts";
import { sampleRule } from "../../testing/fixtures.ts";
import {
  buildRequest,
  createTypeSafeChoiceProvider,
  createTypeSafeProvider,
} from "./provider.ts";

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

    expect(questionToTask.get("q0")).toBe("task-1");
    expect(body).toMatchObject({
      model: "jev-latest",
      state: {
        file: {
          path: "frontend/example.test.ts",
        },
        subjects: {
          s0: {
            id: "subject-1",
            scope: "file",
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

describe("TypeSafe choice provider", () => {
  const config = {
    kind: "typesafe" as const,
    model: "jev-latest",
    apiKeyEnv: "TYPESAFE_API_KEY",
  };

  function respondWith(answer: unknown) {
    return async () =>
      new Response(
        JSON.stringify({
          model: "jev-latest",
          answers: { q0: answer },
          usage: { input_tokens: 50, output_tokens: 2 },
        }),
        { status: 200 },
      );
  }

  test("任意の行IDを選択肢にした質問を送り、確率を選択肢ごとに返す", async () => {
    process.env.TYPESAFE_API_KEY = "secret";
    const bodies: unknown[] = [];
    const provider = createTypeSafeChoiceProvider(config, {
      fetchImpl: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return respondWith({
          type: "choice",
          choice: "L12",
          confidence: 0.7,
          probabilities: { L12: 0.7, L13: 0.3 },
        })();
      },
    });

    const response = await provider.ask({
      state: { path: "a.test.ts" },
      questions: {
        q0: { instructions: "Choose.", criteria: { L12: "a()", L13: "b()" } },
      },
    });

    expect(bodies[0]).toMatchObject({
      model: "jev-latest",
      state: { path: "a.test.ts" },
      questions: { q0: { type: "choice", criteria: { L12: "a()" } } },
    });
    expect(response.answers.q0?.probabilities).toEqual({ L12: 0.7, L13: 0.3 });
    expect(response.usage).toEqual({ inputTokens: 50, outputTokens: 2 });
  });

  test("criteriaにない選択肢の回答を拒否する", async () => {
    process.env.TYPESAFE_API_KEY = "secret";
    const provider = createTypeSafeChoiceProvider(config, {
      fetchImpl: respondWith({
        type: "choice",
        choice: "L99",
        confidence: 1,
        probabilities: { L99: 1 },
      }),
    });

    await expect(
      provider.ask({
        state: {},
        questions: { q0: { instructions: "Choose.", criteria: { L1: "a()" } } },
      }),
    ).rejects.toThrow("Choiceレスポンスが不正です");
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
    subjects: [
      {
        id: "subject-1",
        scope: "file",
        path: "frontend/example.test.ts",
        range: {
          startLine: 1,
          startColumn: 1,
          endLine: 2,
          endColumn: 1,
        },
        symbol: "frontend/example.test.ts",
        source: "const value = 1;\n",
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
