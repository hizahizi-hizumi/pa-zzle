import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createHakoiriMusumeDiagnosticSnapshot,
} from "@/games/hakoiri-musume/diagnostics";
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
