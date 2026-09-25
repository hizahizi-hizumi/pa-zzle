import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createMinesweeperDiagnosticSnapshot,
  parseMinesweeperDiagnosticSnapshot,
  restoreMinesweeperProblemFromDiagnosticSnapshot,
} from "./diagnostics";
import { restoreMinesweeperProblemWithoutAnalysis } from "./problem/generator";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "./problem/problem-pool";

describe("MinesweeperDiagnosticSnapshot", () => {
  const identity = toMinesweeperPoolIdentity(
    "4",
    listMinesweeperPoolEntries("4")[3]!,
  );
  const snapshot = createMinesweeperDiagnosticSnapshot({
    difficulty: "4",
    problemIdentity: identity,
    buildRevision: "abcdef1234567890",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const expectedProblem =
    restoreMinesweeperProblemWithoutAnalysis(identity).problem;
  const invalidSerialized = JSON.stringify({ ...snapshot, game: "water-sort" });

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseMinesweeperDiagnosticSnapshot(serialized);
    const restored = restoreMinesweeperProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem).toEqual(expectedProblem);
  });

  test("診断形式ではないJSONを拒否すること", () => {
    function act() {
      return parseMinesweeperDiagnosticSnapshot(invalidSerialized);
    }

    expect(act).toThrow("Invalid minesweeper diagnostic snapshot");
  });
});
