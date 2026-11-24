import { createMagicSquarePlayAttemptProgress } from "@/games/magic-square/play-attempt";
import { restoreMagicSquarePoolEntry } from "@/games/magic-square/problem/problem-pool";
import {
  createMagicSquareSession,
  enterMagicSquareSessionValue,
  selectMagicSquareSessionCell,
  undoMagicSquareSession,
} from "@/games/magic-square/session/session";

describe("createMagicSquarePlayAttemptProgress", () => {
  // 左上が空きで、答えが14の問題（答えはチュートリアルと遊び方の例の魔方陣）。
  const { problem } = restoreMagicSquarePoolEntry([
    "0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.6",
    0,
    0,
    0,
  ]);
  const initial = createMagicSquareSession(problem, 1_000);
  // 左上に置き、右上を選んでから待ったで左上の数を外すので、置き直しが1回になる。
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

  test("離れた時点までの経過時間と、置き直し・待った・盤面を戻した回数を返すこと", () => {
    const progress = createMagicSquarePlayAttemptProgress(session, 31_000);

    expect(progress).toEqual({
      elapsedMs: 30_000,
      correctionCount: 1,
      undoCount: 1,
      restartCount: 0,
    });
  });
});
