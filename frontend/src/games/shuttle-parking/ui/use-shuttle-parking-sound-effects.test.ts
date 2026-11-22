import { renderHook } from "@testing-library/react";
import type { GameProgress } from "@/games/play";
import {
  createShuttleParkingExitTimeline,
  SHUTTLE_PARKING_BOARD_MS,
  SHUTTLE_PARKING_EXIT_MS,
} from "@/games/shuttle-parking/play/exit-timeline";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import { useShuttleParkingSoundEffects } from "@/games/shuttle-parking/ui/use-shuttle-parking-sound-effects";
import { playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: { pitchCents: 30, volumeRatio: 0.12 },
}));

afterEach(() => {
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function listPlayed(): string[] {
  return vi.mocked(playSound).mock.calls.map(
    ([sound]) =>
      String((sound as { url?: string }).url)
        .split("/")
        .at(-1)
        ?.replace(/\.flac.*$/, "") ?? "",
  );
}

function listDelays(): number[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([, options]) => options?.delayMs ?? 0);
}

// 青の車2を出すと、待っていた赤の車0と青の車2に2人ずつ乗り、2台とも出発する。
const timeline = createShuttleParkingExitTimeline(
  {
    parkedCarIds: [1, 2],
    waitingCars: [{ carId: 0, seatedCount: 1 }],
    boardedCount: 1,
  },
  2,
  [
    { type: "boarded", passengerIndex: 1, carId: 2 },
    { type: "boarded", passengerIndex: 2, carId: 0 },
    { type: "departed", carId: 0 },
    { type: "boarded", passengerIndex: 3, carId: 2 },
    { type: "departed", carId: 2 },
  ],
);

function createExit(id: number, startedAt: number): ShuttleParkingOperation {
  return { id, type: "exited", carId: 2, side: "top", timeline, startedAt };
}

/** 本番と同じく、操作の知らせは描いた後から届く。最初の描画で持っている知らせは鳴らさない。 */
function renderSounds(
  operation: ShuttleParkingOperation | null,
  progress: GameProgress = "playing",
) {
  const rendered = renderHook(
    ({ operation, progress }) =>
      useShuttleParkingSoundEffects(operation, progress),
    {
      initialProps: {
        operation: null as ShuttleParkingOperation | null,
        progress: "playing" as GameProgress,
      },
    },
  );
  rendered.rerender({ operation, progress });
  return rendered;
}

describe("useShuttleParkingSoundEffects", () => {
  describe("車を出した場合", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: 1_000 });
      renderSounds(createExit(1, 1_000));
    });

    test("押したときに出る音を鳴らし、乗車と出発は動きの時刻ごとに1つずつ鳴らすこと", () => {
      const atExit = listPlayed();
      vi.advanceTimersByTime(
        SHUTTLE_PARKING_EXIT_MS + SHUTTLE_PARKING_BOARD_MS,
      );
      const afterFirstBoarding = listPlayed();
      vi.advanceTimersByTime(5_000);

      expect(atExit).toEqual(["exited"]);
      expect(afterFirstBoarding).toEqual(["exited", "boarded-1"]);
      expect(listPlayed()).toEqual([
        "exited",
        "boarded-1",
        "boarded-2",
        "departed",
        "boarded-3",
        "departed",
      ]);
    });
  });

  describe("動きの途中で次の車を出した場合", () => {
    test("前の出庫のまだ鳴らしていない音は鳴らさないこと", () => {
      vi.useFakeTimers({ now: 1_000 });
      const { rerender } = renderSounds(createExit(1, 1_000));
      vi.advanceTimersByTime(
        SHUTTLE_PARKING_EXIT_MS + SHUTTLE_PARKING_BOARD_MS,
      );
      vi.mocked(playSound).mockClear();

      rerender({
        operation: { id: 2, type: "blocked", carId: 1, reason: "bays-full" },
        progress: "playing",
      });
      vi.advanceTimersByTime(5_000);

      expect(listPlayed()).toEqual(["blocked"]);
    });
  });

  describe("最後の車を出してクリアした場合", () => {
    test("最後の出発の音の代わりに、その時刻へクリアの音を合わせること", () => {
      vi.useFakeTimers({ now: 1_000 });
      const { rerender } = renderSounds(null);

      rerender({ operation: createExit(1, 1_000), progress: "clearing" });
      vi.advanceTimersByTime(5_000);

      const lastDeparture = timeline.frames.findLast(
        (frame) => frame.departingCarId !== null,
      );
      expect(listPlayed().filter((name) => name === "departed")).toHaveLength(
        1,
      );
      expect(listPlayed()).toContain("cleared");
      expect(listDelays()[listPlayed().indexOf("cleared")]).toBe(
        lastDeparture?.atMs,
      );
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      vi.useFakeTimers({ now: 1_000 });
    });

    test("乗車の音を鳴らさず、出る音と出発の音を1つずつ鳴らすこと", () => {
      renderSounds(createExit(1, 1_000));
      vi.advanceTimersByTime(5_000);

      expect(listPlayed()).toEqual(["exited", "departed"]);
    });

    test("クリアの音を鳴らさないこと", () => {
      const { rerender } = renderSounds(null);

      rerender({ operation: createExit(1, 1_000), progress: "clearing" });

      expect(listPlayed()).not.toContain("cleared");
    });
  });
});
