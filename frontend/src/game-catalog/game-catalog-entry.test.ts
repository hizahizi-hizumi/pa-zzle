import { resolveRecordProblemPlayTarget } from "@/game-catalog/game-catalog-entry";
import { createProblemId } from "@/games/problem-id";

describe("resolveRecordProblemPlayTarget", () => {
  const problemIdentity = { generatorVersion: "1", seed: "a" };
  const problemId = createProblemId(problemIdentity);

  describe("今の難易度の問題集で問題IDを引ける記録", () => {
    const canSelectProblemById = (difficulty: string, id: string) =>
      difficulty === "2" && id === problemId;

    test("その難易度と問題IDを返すこと", () => {
      const target = resolveRecordProblemPlayTarget(
        "2",
        problemIdentity,
        canSelectProblemById,
      );

      expect(target).toEqual({ difficulty: "2", problemId });
    });
  });

  const unavailableCases = [
    ["今の難易度区分に無い難易度", undefined, () => true],
    ["問題集で問題IDを引けない", "2", () => false],
  ] as const;

  test.each(unavailableCases)(
    "%sの記録には null を返すこと",
    (_, difficulty, canSelectProblemById) => {
      const target = resolveRecordProblemPlayTarget(
        difficulty,
        problemIdentity,
        canSelectProblemById,
      );

      expect(target).toBeNull();
    },
  );
});
