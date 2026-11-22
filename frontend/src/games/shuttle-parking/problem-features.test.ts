import { listShuttleParkingPoolProblemIds } from "@/games/shuttle-parking/problem/problem-pool";
import { findShuttleParkingPoolProblemFeatures } from "@/games/shuttle-parking/problem-features";
import { selectShuttleParkingProblemById } from "@/games/shuttle-parking/problem-selection";

describe("findShuttleParkingPoolProblemFeatures", () => {
  const [problemId] = listShuttleParkingPoolProblemIds("5");

  test("問題集の問題の駐車場の大きさと待機枠の数を返すこと", () => {
    const features = findShuttleParkingPoolProblemFeatures("5", problemId!);
    const { problem } = selectShuttleParkingProblemById("5", problemId!)!;

    expect(features).toEqual({
      lotSize: problem.lot.size,
      bayCount: problem.bayCount,
    });
  });

  test("問題集に無い問題IDには null を返すこと", () => {
    const features = findShuttleParkingPoolProblemFeatures("5", "unknown");

    expect(features).toBeNull();
  });
});
