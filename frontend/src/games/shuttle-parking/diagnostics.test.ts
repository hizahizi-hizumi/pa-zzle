import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createShuttleParkingDiagnosticSnapshot,
} from "@/games/shuttle-parking/diagnostics";
import { selectShuttleParkingProblemForDifficulty } from "@/games/shuttle-parking/problem-selection";

const {
  parseShuttleParkingDiagnosticSnapshot,
  restoreShuttleParkingProblemFromDiagnosticSnapshot,
} = _private;

const selected = selectShuttleParkingProblemForDifficulty(
  "3",
  "shuttle-parking-diagnostics",
);
const snapshot = createShuttleParkingDiagnosticSnapshot({
  difficulty: "3",
  problemIdentity: selected.identity,
  buildRevision: "test-revision",
});

describe("createShuttleParkingDiagnosticSnapshot", () => {
  test("出題した難易度と問題の identity を写すこと", () => {
    expect(snapshot).toMatchObject({
      game: "shuttle-parking",
      difficulty: "3",
      problemIdentity: selected.identity,
      buildRevision: "test-revision",
    });
  });
});

describe("parseShuttleParkingDiagnosticSnapshot", () => {
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const invalidCases = [
    ["形式の版が違う", { ...snapshot, formatVersion: 2 }],
    ["別のゲーム", { ...snapshot, game: "parking-jam" }],
    [
      "復号できない identity",
      {
        ...snapshot,
        problemIdentity: { ...snapshot.problemIdentity, seed: "broken" },
      },
    ],
  ] as const;

  test("コピー形式を復元して同じ問題を再現できること", () => {
    const parsed = parseShuttleParkingDiagnosticSnapshot(serialized);
    const restored = restoreShuttleParkingProblemFromDiagnosticSnapshot(parsed);

    expect(parsed).toEqual(snapshot);
    expect(restored.problem).toEqual(selected.problem);
  });

  test.each(invalidCases)("%s JSON を拒否すること", (_, value) => {
    function act() {
      return parseShuttleParkingDiagnosticSnapshot(JSON.stringify(value));
    }

    expect(act).toThrow("Invalid shuttle-parking diagnostic snapshot");
  });
});
