import { act, cleanup, renderHook } from "@testing-library/react";
import * as problemSeed from "@/games/problem-seed";
import { useShuttleParkingPlay } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingIdentifiedProblem } from "@/games/shuttle-parking/problem/problem";
import { createShuttleParkingProblemIdentity } from "@/games/shuttle-parking/problem/problem";
import { selectShuttleParkingProblemForDifficulty } from "@/games/shuttle-parking/problem-selection";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

type HookResult = ReturnType<typeof useShuttleParkingPlay>;

// 4×4・上だけが開いている。赤の車0が青の車1を塞ぐ。待機枠は1つなので、先に青の車2を出すと詰む。
const problem = {
  lot: {
    size: 4,
    openSides: ["top"],
    cars: [
      { row: 0, column: 0, orientation: "vertical", capacity: 2, color: "a" },
      { row: 2, column: 0, orientation: "vertical", capacity: 2, color: "b" },
      { row: 0, column: 2, orientation: "vertical", capacity: 2, color: "b" },
    ],
  },
  passengers: ["a", "a", "b", "b", "b", "b"],
  bayCount: 1,
} as const satisfies ShuttleParkingIdentifiedProblem["problem"];
const given: ShuttleParkingIdentifiedProblem = {
  problem,
  identity: createShuttleParkingProblemIdentity(problem),
};

describe("useShuttleParkingPlay", () => {
  describe.each(["1", "5"] as const)("レベル %s の場合", (difficulty) => {
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue("selection");
      ({ result } = renderHook(() => useShuttleParkingPlay(difficulty)));
    });

    test("そのレベルの問題集の問題でプレイを始めること", () => {
      const selected = selectShuttleParkingProblemForDifficulty(
        difficulty,
        "selection",
      );

      expect(result.current.problemIdentity).toEqual(selected.identity);
      expect(result.current.problem).toEqual(selected.problem);
    });
  });

  describe("開始時に問題を渡す場合", () => {
    let result: { current: HookResult };

    beforeEach(() => {
      ({ result } = renderHook(() => useShuttleParkingPlay("2", given)));
    });

    test("進路を塞がれた車を押すと、盤面を変えずに出られなかったことを知らせること", () => {
      act(() => result.current.exitCar(1));

      expect(result.current.operation).toMatchObject({
        type: "blocked",
        carId: 1,
        reason: "path-blocked",
      });
      expect(result.current.state.parkedCarIds).toEqual([0, 1, 2]);
    });

    test("車を出すと、乗った乗客と出発を知らせること", () => {
      act(() => result.current.exitCar(0));

      expect(result.current.operation).toMatchObject({
        type: "exited",
        carId: 0,
        events: [
          { type: "boarded", passengerIndex: 0, carId: 0 },
          { type: "boarded", passengerIndex: 1, carId: 0 },
          { type: "departed", carId: 0 },
        ],
      });
      expect(result.current.canUndo).toBe(true);
    });

    test("待機枠が埋まり出せる車が無くなると詰みを返すこと", () => {
      act(() => result.current.exitCar(2));

      expect(result.current.isStuck).toBe(true);
    });

    describe("全員を送り出した場合", () => {
      beforeEach(() => {
        act(() => result.current.exitCar(2));
        act(() => result.current.undo());
        for (const carId of [0, 2, 1]) {
          act(() => result.current.exitCar(carId));
        }
      });

      test("クリア演出へ進み、罠に入った回数を含む結果を返すこと", () => {
        expect(result.current.status).toBe("cleared");
        expect(result.current.progress).toBe("clearing");
        expect(result.current.result).toMatchObject({
          exitCount: 4,
          trapCount: 1,
          undoCount: 1,
          speedReference: { carCount: 3, passengerCount: 6 },
        });
      });

      test("演出を終えると結果へ進むこと", () => {
        act(() => result.current.completeClearAnimation());

        expect(result.current.progress).toBe("result");
      });
    });

    test("盤面を戻すと最初の盤面に戻し、回数を数えること", () => {
      act(() => result.current.exitCar(0));
      act(() => result.current.restart());

      expect(result.current.state.parkedCarIds).toEqual([0, 1, 2]);
      expect(result.current.session.restartCount).toBe(1);
      expect(result.current.operation).toBeNull();
    });

    test("新しい問題は始めたレベルの問題集から選ぶこと", () => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue("next");

      act(() => result.current.startNewProblem());

      expect(result.current.problemIdentity).toEqual(
        selectShuttleParkingProblemForDifficulty("2", "next").identity,
      );
    });
  });
});
