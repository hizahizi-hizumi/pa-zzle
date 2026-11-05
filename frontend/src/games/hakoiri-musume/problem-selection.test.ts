import { difficultyLevels } from "@/games/difficulty";
import {
  listHakoiriMusumePoolEntries,
  listHakoiriMusumePoolProblemIds,
} from "@/games/hakoiri-musume/problem/problem-pool";
import {
  canSelectHakoiriMusumeProblemById,
  selectHakoiriMusumeProblemById,
  selectHakoiriMusumeProblemForDifficulty,
} from "@/games/hakoiri-musume/problem-selection";
import { createProblemId } from "@/games/problem-id";

describe("selectHakoiriMusumeProblemForDifficulty", () => {
  const cases = difficultyLevels.map(({ id }) => id);

  test.each(cases)("レベル %s の問題集から1問を選ぶこと", (difficulty) => {
    const selected = selectHakoiriMusumeProblemForDifficulty(
      difficulty,
      "hakoiri-selection",
    );

    expect(listHakoiriMusumePoolProblemIds(difficulty)).toContain(
      createProblemId(selected.identity),
    );
  });
});

describe("selectHakoiriMusumeProblemById", () => {
  const [problemId] = listHakoiriMusumePoolProblemIds("1");
  const [board, optimalMoveCount, preparationLength] =
    listHakoiriMusumePoolEntries("1")[0]!;

  test("問題 ID で引いた問題を作業の量とともに復元すること", () => {
    const selected = selectHakoiriMusumeProblemById("1", problemId!);

    expect(selected?.identity.seed).toBe(board);
    expect(selected?.workload).toEqual({ optimalMoveCount, preparationLength });
  });

  test("別の難易度の問題 ID は引けないこと", () => {
    const selected = selectHakoiriMusumeProblemById("2", problemId!);
    const selectable = canSelectHakoiriMusumeProblemById("2", problemId!);

    expect(selected).toBeNull();
    expect(selectable).toBe(false);
  });
});
