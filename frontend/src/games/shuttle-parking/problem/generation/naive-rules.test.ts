import {
  countShuttleParkingBacktracks,
  measureShuttleParkingRuleBestWinProbability,
  measureShuttleParkingRuleWinProbability,
} from "@/games/shuttle-parking/problem/generation/naive-rules";
import { AnalysisGame } from "@/games/shuttle-parking/problem/generation/state-game";
import type { ShuttleParkingProblem } from "@/games/shuttle-parking/problem/problem";
import { restoreShuttleParkingSeed } from "@/games/shuttle-parking/problem/problem-pool";

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
const deepTieProblem = restoreShuttleParkingSeed(
  "7tr3-04v2b53h2c46v2b26v2a06v2c51v2a02v3d11v2d-bccdbdaacdaabcdbd",
).problem;
// 進路をふさぐ車から順に出していけば解ける問題。
const untangleProblem = restoreShuttleParkingSeed(
  "6tr3-04v2b31h2a35v3b05v3c23v3d03v2a10v3c12v2d-dcccadbbacdaabbcbcdd",
).problem;
// ふさぎを何段もたどった台数で選べば勝ち、直接ふさぐ台数で選ぶと半分しか勝てない問題。
const deepUntangleProblem = restoreShuttleParkingSeed(
  "6tr3-30v2b00v2a22v2c51h3a11h3b14v2a03h2c05v2b-bbbcbababcacabcaaa",
).problem;
// 掘る目標が並び、定員の大きい車を目標にすれば勝つ問題。
const commitTargetTieProblem = restoreShuttleParkingSeed(
  "7tr4-52h2a55v2b25v3c15h2d04v3a31v3d01v3c10v3b-cbbdabcbaadddcdaabccc",
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

describe("measureShuttleParkingRuleWinProbability の渋滞をほどく規則", () => {
  test("ふさぎを何段もたどった台数で選ぶと勝ち、直接ふさぐ台数では半分しか勝てないこと", () => {
    const game = new AnalysisGame(deepUntangleProblem);

    const probabilities = {
      untangle: measureShuttleParkingRuleWinProbability(game, "untangle"),
      untangleDeep: measureShuttleParkingRuleWinProbability(
        game,
        "untangleDeep",
      ),
    };

    expect(probabilities).toEqual({ untangle: 0.5, untangleDeep: 1 });
  });
});

describe("measureShuttleParkingRuleWinProbability の掘った車を使い切る規則", () => {
  test("並んだ目標も同点の選び方で絞り、定員の大きい車を目標にすると必ず勝つこと", () => {
    const game = new AnalysisGame(commitTargetTieProblem);

    const probabilities = {
      uniform: measureShuttleParkingRuleWinProbability(
        game,
        "deepCommit",
        "uniform",
      ),
      big: measureShuttleParkingRuleWinProbability(game, "deepCommit", "big"),
    };

    expect(probabilities).toEqual({ uniform: 0.75, big: 1 });
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
