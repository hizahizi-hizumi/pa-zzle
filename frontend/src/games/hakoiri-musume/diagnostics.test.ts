import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createHakoiriMusumeDiagnosticSnapshot,
} from "@/games/hakoiri-musume/diagnostics";
import { createHakoiriMusumeProblemIdentity } from "@/games/hakoiri-musume/problem/problem";
import { listHakoiriMusumePoolEntries } from "@/games/hakoiri-musume/problem/problem-pool";
import { selectHakoiriMusumeProblemForDifficulty } from "@/games/hakoiri-musume/problem-selection";

const {
  parseHakoiriMusumeDiagnosticSnapshot,
  restoreHakoiriMusumeProblemFromDiagnosticSnapshot,
} = _private;

const selected = selectHakoiriMusumeProblemForDifficulty(
  "1",
  "hakoiri-musume-diagnostics",
);

describe("parseHakoiriMusumeDiagnosticSnapshot", () => {
  const snapshot = createHakoiriMusumeDiagnosticSnapshot({
    difficulty: "1",
    problemIdentity: selected.identity,
    buildRevision: "test-revision",
    workload: selected.workload,
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);

  test("書き出した snapshot を読み戻し、同じ問題を復元できること", () => {
    const parsed = parseHakoiriMusumeDiagnosticSnapshot(serialized);
    const restored = restoreHakoiriMusumeProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem).toEqual(selected.problem);
  });
});

describe("createHakoiriMusumeDiagnosticSnapshot", () => {
  describe("問題集にある問題の場合", () => {
    const [
      board,
      optimalMoveCount,
      preparationLength,
      daughterDetourCount,
      shortestPreparationLength,
    ] = listHakoiriMusumePoolEntries("2")[0]!;
    const problemIdentity = createHakoiriMusumeProblemIdentity(board);

    test("渡した作業の量ではなく、問題集の値で作ること", () => {
      const snapshot = createHakoiriMusumeDiagnosticSnapshot({
        difficulty: "2",
        problemIdentity,
        buildRevision: null,
        workload: { optimalMoveCount: 99, preparationLength: 1 },
      });

      expect(snapshot.difficultyAnalysis).toMatchObject({
        status: "pooled",
        features: {
          optimalMoveCount,
          preparationLength,
          daughterDetourCount,
          shortestPreparationLength,
        },
      });
    });
  });

  describe("問題集に無い問題の場合", () => {
    const problemIdentity = createHakoiriMusumeProblemIdentity(
      "vAAvwAAwv..vwhiws..s",
    );

    test("渡した作業の量と、盤面から数えた空きで作ること", () => {
      const snapshot = createHakoiriMusumeDiagnosticSnapshot({
        difficulty: "1",
        problemIdentity,
        buildRevision: null,
        workload: { optimalMoveCount: 13, preparationLength: 6 },
      });

      expect(snapshot.difficultyAnalysis).toEqual({
        status: "recorded",
        features: {
          optimalMoveCount: 13,
          preparationLength: 6,
          emptyCellCount: 4,
        },
      });
    });
  });
});
