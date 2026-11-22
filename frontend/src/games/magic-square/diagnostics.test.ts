import { serializeInternalDiagnosticSnapshot } from "@/games/diagnostics";
import {
  _private,
  createMagicSquareDiagnosticSnapshot,
} from "@/games/magic-square/diagnostics";
import {
  listMagicSquarePoolEntries,
  toMagicSquarePoolIdentity,
} from "@/games/magic-square/problem/problem-pool";

const {
  parseMagicSquareDiagnosticSnapshot,
  restoreMagicSquareProblemFromDiagnosticSnapshot,
} = _private;

describe("createMagicSquareDiagnosticSnapshot", () => {
  const problemIdentity = toMagicSquarePoolIdentity(
    listMagicSquarePoolEntries("3")[0]!,
  );
  const snapshot = createMagicSquareDiagnosticSnapshot({
    difficulty: "3",
    problemIdentity,
    buildRevision: "abc123",
  });
  const serialized = serializeInternalDiagnosticSnapshot(snapshot);
  const otherGameSerialized = serialized.replace('"magic-square"', '"takuzu"');

  test("難易度・問題の identity・ビルドを写すこと", () => {
    const { game, difficulty, buildRevision } = snapshot;

    expect({
      game,
      difficulty,
      buildRevision,
      problemIdentity: snapshot.problemIdentity,
    }).toEqual({
      game: "magic-square",
      difficulty: "3",
      buildRevision: "abc123",
      problemIdentity,
    });
  });

  test("コピーした JSON から同じ snapshot を読み戻すこと", () => {
    const parsed = parseMagicSquareDiagnosticSnapshot(serialized);

    expect(parsed).toEqual(snapshot);
  });

  test("読み戻した snapshot から出題した問題を復元すること", () => {
    const restored = restoreMagicSquareProblemFromDiagnosticSnapshot(
      parseMagicSquareDiagnosticSnapshot(serialized),
    );

    expect(restored.identity).toEqual(problemIdentity);
  });

  test("別のゲームの snapshot を読み戻さないこと", () => {
    const act = () => parseMagicSquareDiagnosticSnapshot(otherGameSerialized);

    expect(act).toThrow(TypeError);
  });
});
