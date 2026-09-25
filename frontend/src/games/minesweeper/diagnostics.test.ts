import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  createMinesweeperDiagnosticSnapshot,
  parseMinesweeperDiagnosticSnapshot,
  resolveMinesweeperDiagnosticProblemIdentity,
  restoreMinesweeperProblemFromDiagnosticSnapshot,
} from "./diagnostics";
import { restoreMinesweeperProblemWithoutAnalysis } from "./problem/generator";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "./problem/problem-pool";
import { selectMinesweeperProblemForDifficulty } from "./problem-selection";

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

describe("resolveMinesweeperDiagnosticProblemIdentity", () => {
  const poolIdentity = toMinesweeperPoolIdentity(
    "2",
    listMinesweeperPoolEntries("2")[10]!,
  );
  const selectedIdentity = selectMinesweeperProblemForDifficulty(
    "2",
    "any-seed",
  ).identity;

  test("問題集のseedからその問題の再現用情報を返すこと", () => {
    const resolved = resolveMinesweeperDiagnosticProblemIdentity(
      "2",
      poolIdentity.seed,
    );

    expect(resolved).toEqual(poolIdentity);
  });

  test("問題集にないseedでは選択用のseedとして問題集から選ぶこと", () => {
    const resolved = resolveMinesweeperDiagnosticProblemIdentity(
      "2",
      "any-seed",
    );

    expect(resolved).toEqual(selectedIdentity);
  });
});
