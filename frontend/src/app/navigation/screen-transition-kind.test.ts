import { describe, expect, test } from "vitest";
import { screenTransitionKind } from "@/app/navigation/screen-transition-kind";

describe("screenTransitionKind", () => {
  const home = "/";
  const gameHome = "/puzzles/water-sort";
  const play = "/puzzles/water-sort/play/1";
  const result = "/puzzles/water-sort/result/water-sort%3A1%3A2";
  const crossingCases = [
    [home, gameHome, "enter-game"],
    [gameHome, home, "leave-game"],
    [gameHome, play, "enter-piece"],
    [play, result, "settle"],
    [result, play, "open"],
    [result, gameHome, "return"],
    [result, home, "close"],
    [play, home, "close"],
  ] as const;
  const nonCrossingCases = [
    [play, gameHome],
    [play, play],
    [home, "/records"],
    ["/records", result],
  ] as const;

  test.each(crossingCases)(
    "額の外と内をまたぐ行き来 %s → %s に、動きの種類 %s を返すこと",
    (from, to, expectedKind) => {
      const kind = screenTransitionKind(from, to);

      expect(kind).toBe(expectedKind);
    },
  );

  test.each(nonCrossingCases)(
    "額の外と内をまたがない行き来 %s → %s に、null を返すこと",
    (from, to) => {
      const kind = screenTransitionKind(from, to);

      expect(kind).toBeNull();
    },
  );
});
