import {
  countShuttleParkingBacktracks,
  measureShuttleParkingRuleBestWinProbability,
  measureShuttleParkingRuleWinProbability,
} from "@/games/shuttle-parking/problem/generation/naive-rules";
import { AnalysisGame } from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import { restoreShuttleParkingPoolEntry } from "@/games/shuttle-parking/problem/problem-pool";

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

// 奥の先頭の色の車を掘ると、掘った車と最初から出せた先頭の色の車が同点になる問題。
const deepTieProblem = restoreShuttleParkingPoolEntry(
  "7tr3-04v2b53h2c46v2b26v2a06v2c51v2a02v3d11v2d-bccdbdaacdaabcdbd",
).problem;
// 進路をふさぐ車から順に出していけば解ける問題。
const untangleProblem = restoreShuttleParkingPoolEntry(
  "6tr3-04v2b31h2a35v3b05v3c23v3d03v2a10v3c12v2d-dcccadbbacdaabbcbcdd",
).problem;

describe("measureShuttleParkingRuleWinProbability", () => {
  test("深く掘る規則は、同点を一様に選ぶと半分しか勝てないこと", () => {
    const game = new AnalysisGame(deepTieProblem);

    const probability = measureShuttleParkingRuleWinProbability(
      game,
      "deepDig",
    );

    expect(probability).toBe(0.5);
  });

  test("掘った車を使い切る規則は、掘った車をそのまま出して必ず勝つこと", () => {
    const game = new AnalysisGame(deepTieProblem);

    const probability = measureShuttleParkingRuleWinProbability(
      game,
      "deepCommit",
    );

    expect(probability).toBe(1);
  });

  test("渋滞をほどく規則は、ふさいでいる車の多い車から出して勝つこと", () => {
    const game = new AnalysisGame(untangleProblem);

    const probability = measureShuttleParkingRuleWinProbability(
      game,
      "untangle",
    );

    expect(probability).toBe(1);
  });
});

describe("measureShuttleParkingRuleBestWinProbability", () => {
  test("同点の選び方のうち、最も勝つ選び方の勝率を返すこと", () => {
    const game = new AnalysisGame(deepTieProblem);

    const probability = measureShuttleParkingRuleBestWinProbability(
      game,
      "deepDig",
    );

    expect(probability).toBe(1);
  });
});
