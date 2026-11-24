import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createSolitaireDiagnosticSnapshot,
} from "@/games/solitaire/diagnostics";
import { selectSolitaireProblemForDifficulty } from "@/games/solitaire/problem-selection";

const {
  parseSolitaireDiagnosticSnapshot,
  restoreSolitaireProblemFromDiagnosticSnapshot,
} = _private;

const selected = selectSolitaireProblemForDifficulty(
  "3",
  "solitaire-diagnostics",
);

describe("createSolitaireDiagnosticSnapshot", () => {
  const snapshot = createSolitaireDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });

  test("問題の identity と難易度とビルドの版を保持すること", () => {
    const { game, difficulty, problemIdentity, buildRevision } = snapshot;

    expect({ game, difficulty, problemIdentity, buildRevision }).toEqual({
      game: "solitaire",
      difficulty: "3",
      problemIdentity: selected.identity,
      buildRevision: "test-revision",
    });
  });
});

describe("parseSolitaireDiagnosticSnapshot", () => {
  const snapshot = createSolitaireDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "water-sort" }],
    ["未知の難易度", { ...snapshot, difficulty: "6" }],
    [
      "別の生成器の identity",
      {
        ...snapshot,
        problemIdentity: { ...snapshot.problemIdentity, generatorVersion: "0" },
      },
    ],
    [
      "52枚を配っていない seed",
      {
        ...snapshot,
        problemIdentity: {
          ...snapshot.problemIdentity,
          seed: snapshot.problemIdentity.seed.slice(1),
        },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseSolitaireDiagnosticSnapshot(serialized);
    const restored = restoreSolitaireProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem).toEqual(selected.problem);
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseSolitaireDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid solitaire diagnostic snapshot");
  });
});
