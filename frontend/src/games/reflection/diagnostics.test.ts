import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createReflectionDiagnosticSnapshot,
  formatReflectionPoolProblemQuery,
  formatReflectionProblemQuery,
  hasReflectionProblemQuery,
  parseReflectionDiagnosticSnapshot,
  parseReflectionProblemQuery,
  restoreReflectionProblemFromDiagnosticSnapshot,
} from "@/games/reflection/diagnostics";
import { createReflectionProblemIdentity } from "@/games/reflection/problem/problem";
import { toReflectionPooledProblem } from "@/games/reflection/problem/problem-pool";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";

describe("parseReflectionProblemQuery", () => {
  const identity = createReflectionProblemIdentity(6, 6, 2);
  const formattedParams = new URLSearchParams(
    formatReflectionProblemQuery(identity),
  );
  const paramsWithoutGenerator = new URLSearchParams(
    "seed=rf-5-3-0&size=5&pieces=3",
  );
  const invalidCases = [
    ["seed の欠けたクエリ", "size=5&pieces=3"],
    ["扱わない盤面サイズ", "seed=a&size=12&pieces=3"],
    ["盤面に収まらないピース数", "seed=a&size=5&pieces=25"],
    ["数でないピース数", "seed=a&size=5&pieces=three"],
    ["今と違う生成器の版", "generator=0&seed=a&size=5&pieces=3"],
    ["今と違う問題集の版", "pool=0&problem=1-1"],
    ["問題集に無い問題番号", "problem=1-100000"],
    ["問題番号の無い問題集の版", "pool=1"],
    [
      "問題集の番号と identity の両方",
      "problem=1-1&seed=rf-5-3-0&size=5&pieces=3",
    ],
  ] as const;

  test("formatReflectionProblemQuery で書き出したクエリから同じ identity を読み戻すこと", () => {
    const result = parseReflectionProblemQuery(formattedParams);

    expect(result).toEqual(identity);
  });

  test("生成器の版を省略したクエリは今の版として読むこと", () => {
    const result = parseReflectionProblemQuery(paramsWithoutGenerator);

    expect(result).toEqual(createReflectionProblemIdentity(5, 3, 0));
  });

  const pooled = toReflectionPooledProblem("3", 1);
  const poolParams = new URLSearchParams(
    formatReflectionPoolProblemQuery(pooled.poolReference),
  );
  const poolParamsWithoutVersion = new URLSearchParams("problem=3-2");

  test("問題集の番号で指定したクエリから、その問題の identity を読むこと", () => {
    const result = parseReflectionProblemQuery(poolParams);

    expect(result).toEqual(pooled.identity);
  });

  test("問題集の版を省略したクエリは今の版として読むこと", () => {
    const result = parseReflectionProblemQuery(poolParamsWithoutVersion);

    expect(result).toEqual(pooled.identity);
  });

  test.each([
    [9, 12, 3],
    [11, 24, 8],
  ] as const)(
    "5段階の出題に無い盤面サイズ %i のサンプルも identity で開けること",
    (size, pieces, index) => {
      const result = parseReflectionProblemQuery(
        new URLSearchParams(
          `seed=rf-${size}-${pieces}-${index}&size=${size}&pieces=${pieces}`,
        ),
      );

      expect(result).toEqual(
        createReflectionProblemIdentity(size, pieces, index),
      );
    },
  );

  test.each(invalidCases)(
    "読めないクエリに null を返すこと: %s",
    (_, query) => {
      const result = parseReflectionProblemQuery(new URLSearchParams(query));

      expect(result).toBeNull();
    },
  );
});

describe("hasReflectionProblemQuery", () => {
  const cases = [
    ["seed=a", true],
    ["size=5", true],
    ["problem=1-1", true],
    ["from=home", false],
  ] as const;

  test.each(cases)(
    "問題指定のキーを含むかを返すこと: %s",
    (query, expected) => {
      const result = hasReflectionProblemQuery(new URLSearchParams(query));

      expect(result).toBe(expected);
    },
  );
});

describe("ReflectionDiagnosticSnapshot", () => {
  const selected = selectReflectionProblemForDifficulty("4", "diagnostic-seed");
  const snapshot = createReflectionDiagnosticSnapshot({
    difficulty: "4",
    problemIdentity: selected.identity,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const missing = createReflectionDiagnosticSnapshot({
    difficulty: "1",
    problemIdentity: createReflectionProblemIdentity(5, 2, 999_999),
    buildRevision: null,
  });
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "takuzu" }],
    ["未定義の難易度", { ...snapshot, difficulty: "9" }],
    [
      "問題集の番号が欠けた",
      { ...snapshot, problemPool: { poolVersion: "1" } },
    ],
    ["分類が欠けた", { ...snapshot, difficultyAssessment: undefined }],
    [
      "扱わない盤面サイズ",
      {
        ...snapshot,
        problemIdentity: {
          ...snapshot.problemIdentity,
          conditions: { ...snapshot.problemIdentity.conditions, size: 12 },
        },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseReflectionDiagnosticSnapshot(serialized);
    const restored = restoreReflectionProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored?.problem).toEqual(selected.problem);
  });

  test("出題した問題の問題集の版と番号を持つこと", () => {
    const { problemPool } = snapshot;

    expect(problemPool).toEqual(selected.poolReference);
  });

  test("分析し直した分類と最高推論レベルが問題集のレベルと一致すること", () => {
    const { difficultyAssessment } = snapshot;

    expect(difficultyAssessment).toEqual({
      status: "classified",
      difficulty: "4",
      reasoningLevel: 4,
    });
  });

  test("5段階の出題に無い大きさのサンプルは分析せず、コピー形式から読み戻せること", () => {
    const sample = createReflectionDiagnosticSnapshot({
      difficulty: "3",
      problemIdentity: createReflectionProblemIdentity(8, 12, 6),
      buildRevision: null,
    });

    const parsed = parseReflectionDiagnosticSnapshot(
      serializeInternalDiagnosticSnapshot(sample),
    );

    expect(sample.difficultyAssessment).toEqual({
      status: "not-analyzed",
      reason: "sample-board-size",
    });
    expect(parsed).toEqual(sample);
  });

  test("問題集に無い identity では問題集の番号を持たないこと", () => {
    const { problemPool } = missing;

    expect(problemPool).toBeNull();
  });

  test("問題集に無い identity は復元できないこと", () => {
    const restored = restoreReflectionProblemFromDiagnosticSnapshot(missing);

    expect(restored).toBeNull();
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseReflectionDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid Reflection diagnostic snapshot");
  });
});
