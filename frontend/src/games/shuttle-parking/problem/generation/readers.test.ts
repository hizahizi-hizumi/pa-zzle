import { measureShuttleParkingNaiveReaderWinProbability } from "@/games/shuttle-parking/problem/generation/readers";
import { AnalysisGame } from "@/games/shuttle-parking/problem/generation/state-game";
import { restoreShuttleParkingSeed } from "@/games/shuttle-parking/problem/problem-pool";

// 先頭に合わせる人の広げた候補にだけ重い罠があり、素朴な解き方の候補には重さ4までの罠しか無い問題。
const shallowNaiveTrapProblem = restoreShuttleParkingSeed(
  "6t3-05v2a10v3a34v2d14v2c31v2b01v3d23v2c22v3b-bddacbadccdbaaabdbc",
).problem;

describe("measureShuttleParkingNaiveReaderWinProbability", () => {
  test("素朴な解き方の候補から4人先まで読めば必ず勝ち、3人先までなら負けること", () => {
    const game = new AnalysisGame(shallowNaiveTrapProblem);

    const probabilities = [3, 4].map((visibleWeight) =>
      measureShuttleParkingNaiveReaderWinProbability(game, visibleWeight),
    );

    expect(probabilities).toEqual([0, 1]);
  });
});
