import { countShuttleParkingBacktracks } from "@/games/shuttle-parking/problem/generation/naive-rules";
import { AnalysisGame } from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";

// 4×4・上だけが開いている。どちらの車もすぐ出せる。
const lot: ShuttleParkingProblem["lot"] = {
  size: 4,
  openSides: ["top"],
  cars: [
    { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
    { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "b" },
  ],
};

describe("countShuttleParkingBacktracks", () => {
  test("先頭に合う車を出していけば解ける問題では、戻さずに解くこと", () => {
    const game = new AnalysisGame({
      lot,
      passengers: ["a", "a", "b", "b"],
      bayCount: 1,
    });

    const result = countShuttleParkingBacktracks(game);

    expect(result).toEqual({ solved: true, backtracks: 0 });
  });

  test("解けない問題では、出せる手を全部試して戻すこと", () => {
    const game = new AnalysisGame({
      lot,
      passengers: ["a", "b", "b", "a"],
      bayCount: 1,
    });

    const result = countShuttleParkingBacktracks(game);

    expect(result).toEqual({ solved: false, backtracks: 2 });
  });
});
