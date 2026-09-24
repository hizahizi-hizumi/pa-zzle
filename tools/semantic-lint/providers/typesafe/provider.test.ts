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
            context: {
              enclosingCalls: ["test", "describe"],
            },
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
    expect(
      (body as { questions: { q0: { instructions: string } } }).questions.q0
        .instructions,
    ).toContain(
      "A violation elsewhere in the file does not make the current target a violation.",
    );
  });

  test("同じ局所regionをstateへ一度だけ共有する", () => {
    const rule = sampleRule();
    const batch = sampleBatch(rule.id);
    const first = batch.subjects[0];

    if (first === undefined) {
      throw new Error("sample subjectがありません。");
    }

    const sharedRegion = {
      kind: "callback-body",
      source: "{\n  const input = createInput();\n  run(input);\n}",
    };
    batch.stateMode = "subjects-only";
    batch.subjects = [
      {
        ...first,
        id: "subject-1",
        context: {
          enclosingCalls: ["test", "describe"],
          region: sharedRegion,
        },
      },
      {
        ...first,
        id: "subject-2",
        source: "run(input);",
        context: {
          enclosingCalls: ["test", "describe"],
          region: sharedRegion,
        },
      },
    ];
    batch.requests = [
      {
        taskId: "task-1",
        ruleId: rule.id,
        subjectId: "subject-1",
        predicate: rule.predicate,
      },
      {
        taskId: "task-2",
        ruleId: rule.id,
        subjectId: "subject-2",
        predicate: rule.predicate,
      },
    ];

    const { body } = buildRequest("jev-latest", batch);
    const state = (
      body as {
        state: {
          regions: Record<string, { id: string; kind: string; source: string }>;
          subjects: Record<
            string,
            { context: { enclosingCalls: string[]; regionId: string } }
          >;
        };
      }
    ).state;

    expect(state.regions).toEqual({
      r0: {
        id: "r0",
        kind: "callback-body",
        source: sharedRegion.source,
      },
    });
    expect(state.subjects.s0?.context).toEqual({
      enclosingCalls: ["test", "describe"],
      regionId: "r0",
    });
    expect(state.subjects.s1?.context).toEqual({
      enclosingCalls: ["test", "describe"],
      regionId: "r0",
    });
    expect(Object.keys(state.regions)).toHaveLength(1);
    expect(
      (
        body as {
          questions: { q0: { instructions: string } };
        }
      ).questions.q0.instructions,
    ).toContain("Use state.regions.r0 as the local surrounding region");
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
        context: {
          enclosingCalls: ["test", "describe"],
        },
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
