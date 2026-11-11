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
    const [board, optimalMoveCount, preparationLength] =
      listHakoiriMusumePoolEntries("2")[0]!;
    const problemIdentity = createHakoiriMusumeProblemIdentity(board);

    test("全局面をたどらずに、問題集の分類と値で作ること", () => {
      const snapshot = createHakoiriMusumeDiagnosticSnapshot({
        difficulty: "2",
        problemIdentity,
        buildRevision: null,
      });

      expect(snapshot.difficultyAssessment).toEqual({
        status: "classified",
        difficulty: "2",
      });
      expect(snapshot.difficultyAnalysis).toMatchObject({
        status: "pooled",
        features: { optimalMoveCount, preparationLength },
      });
    });
  });

  describe("問題集に無い問題を、記録した作業の量を添えて開いた場合", () => {
    const problemIdentity = createHakoiriMusumeProblemIdentity(
      "vAAvwAAwv..vwhiws..s",
    );

    test("分析し直さずに、記録した値で作ること", () => {
      const snapshot = createHakoiriMusumeDiagnosticSnapshot({
        difficulty: "1",
        problemIdentity,
        buildRevision: null,
        recordedWorkload: { optimalMoveCount: 13, preparationLength: 6 },
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

  describe("問題集に無い問題の場合", () => {
    /** 合意の易しい例。問題集には入っていない。 */
    // 全局面をたどる分析は数秒かかるので、試験の時間の上限に掛からないよう、準備の段で済ませる。
    const snapshot = createHakoiriMusumeDiagnosticSnapshot({
      difficulty: "1",
      problemIdentity: createHakoiriMusumeProblemIdentity(
        "vAAvwAAwv..vwhiws..s",
      ),
      buildRevision: null,
    });

    test("始めの盤面から分析し直して作ること", () => {
      expect(snapshot.difficultyAnalysis).toMatchObject({
        status: "analyzed",
        features: { optimalMoveCount: 13, preparationLength: 6 },
      });
    });
  });
});
