import { act, cleanup, renderHook } from "@testing-library/react";
import {
  createShuttleParkingExitTimeline,
  SHUTTLE_PARKING_EXIT_MS,
} from "@/games/shuttle-parking/play/exit-timeline";
import { useShuttleParkingExitPlayback } from "@/games/shuttle-parking/ui/board/use-exit-playback";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const timeline = createShuttleParkingExitTimeline(
  { parkedCarIds: [0], waitingCars: [], boardedCount: 0 },
  0,
  [
    { type: "boarded", passengerIndex: 0, carId: 0 },
    { type: "boarded", passengerIndex: 1, carId: 0 },
    { type: "departed", carId: 0 },
  ],
);

describe("useShuttleParkingExitPlayback", () => {
  describe("動かせる環境の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: 10_000 });
    });

    test("出す前の姿から始め、時刻どおりに進み、終えたら今の状態に戻すこと", () => {
      const { result } = renderHook(() =>
        useShuttleParkingExitPlayback({ id: 1, timeline, startedAt: 10_000 }),
      );
      const first = result.current.frame;
      act(() => {
        vi.advanceTimersByTime(SHUTTLE_PARKING_EXIT_MS);
      });
      const arrived = result.current.frame;
      act(() => {
        vi.advanceTimersByTime(timeline.durationMs);
      });

      expect(first).toBe(timeline.frames[0]);
      expect(arrived).toBe(timeline.frames[1]);
      expect(result.current.frame).toBeNull();
    });

    test("作り直しても、出庫した時刻からの続きを見せること", () => {
      const { result } = renderHook(() =>
        useShuttleParkingExitPlayback({
          id: 1,
          timeline,
          startedAt: 10_000 - timeline.durationMs,
        }),
      );

      expect(result.current.frame).toBeNull();
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("動かさずに今の状態を見せること", () => {
      const { result } = renderHook(() =>
        useShuttleParkingExitPlayback({
          id: 1,
          timeline,
          startedAt: Date.now(),
        }),
      );

      expect(result.current.frame).toBeNull();
    });
  });
});
