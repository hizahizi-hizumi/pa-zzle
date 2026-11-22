import { createMagicSquarePlayAttemptProgress } from "@/games/magic-square/play-attempt";
import {
  listMagicSquarePoolEntries,
  restoreMagicSquarePoolEntry,
} from "@/games/magic-square/problem/problem-pool";
import {
  createMagicSquareSession,
  enterMagicSquareSessionValue,
  selectMagicSquareSessionCell,
  undoMagicSquareSession,
} from "@/games/magic-square/session/session";

describe("createMagicSquarePlayAttemptProgress", () => {
  const { problem } = restoreMagicSquarePoolEntry(
    listMagicSquarePoolEntries("1")[0]!,
  );
  const initial = createMagicSquareSession(problem, 1_000);
  // 左上に置き、右上を選んでから待ったで左上の数を外すので、取り下げが1回になる。
  const session = undoMagicSquareSession(
    selectMagicSquareSessionCell(
      enterMagicSquareSessionValue(
        selectMagicSquareSessionCell(initial, 0),
        14,
        2_000,
      ),
      3,
    ),
  );

  test("離れた時点までの経過時間と、取り下げ・待った・盤面を戻した回数を返すこと", () => {
    const progress = createMagicSquarePlayAttemptProgress(session, 31_000);

    expect(progress).toEqual({
      elapsedMs: 30_000,
      withdrawalCount: 1,
      undoCount: 1,
      restartCount: 0,
    });
  });
});
