import { createFukumenzanPlayAttemptProgress } from "@/games/fukumenzan/play-attempt";
import {
  createFukumenzanSession,
  placeFukumenzanSessionDigit,
  toggleFukumenzanSessionCross,
} from "@/games/fukumenzan/session/session";

const placed = toggleFukumenzanSessionCross(
  placeFukumenzanSessionDigit(
    placeFukumenzanSessionDigit(
      createFukumenzanSession(
        { addends: ["BYK", "KTK"], result: "TKHH" },
        1_000,
      ),
      0,
      9,
      1_000,
    ),
    2,
    5,
    1_000,
  ),
  1,
  0,
);
const session = { ...placed, undoCount: 1, restartCount: 1, returnCount: 2 };

test("離れた時点までの実測値と、札を入れていた文字と式の文字の数を進み具合にすること", () => {
  const progress = createFukumenzanPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    placedLetterCount: 2,
    letterCount: 5,
    undoCount: 1,
    restartCount: 1,
    placeCount: 2,
    returnCount: 2,
    crossToggleCount: 1,
  });
});
