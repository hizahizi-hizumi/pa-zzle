import {
  DAUGHTER_EXIT_MS,
  DAUGHTER_EXIT_START_MS,
  DAUGHTER_LANDING_MS,
  getDaughterExitStartMs,
  getDaughterLandingMs,
  REDUCED_MOTION_DAUGHTER_EXIT_MS,
} from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import {
  type DaughterExit,
  playDaughterExit,
} from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard/play-daughter-exit";

/** 演出とその後の間を十分に超える時間。 */
const longEnoughMs = 10_000;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("playDaughterExit", () => {
  const onFinished = vi.fn();
  let daughter: HTMLElement;
  let box: HTMLElement;
  let boxAnimate: ReturnType<typeof vi.fn>;
  let commitStyles: ReturnType<typeof vi.fn>;
  let animate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onFinished.mockClear();
    commitStyles = vi.fn();
    animate = vi.fn(
      () =>
        ({
          finished: Promise.resolve(),
          cancel: vi.fn(),
          commitStyles,
        }) as unknown as Animation,
    );
    daughter = document.createElement("button");
    daughter.animate = animate as unknown as HTMLElement["animate"];
    boxAnimate = vi.fn(
      () =>
        ({
          finished: Promise.resolve(),
          cancel: vi.fn(),
        }) as unknown as Animation,
    );
    box = document.createElement("div");
    box.animate = boxAnimate as unknown as HTMLElement["animate"];
  });

  /** 下の出口から抜ける娘。 */
  function exitOf(overrides: Partial<DaughterExit> = {}): DaughterExit {
    return {
      element: daughter,
      exitLight: null,
      side: "bottom",
      travelPercent: 115,
      heldLook: null,
      ...overrides,
    };
  }

  describe("動きを減らさない設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false }) as MediaQueryList),
      );
    });

    test("出口の前で止めてから娘を下へ抜けさせ、抜け切った姿を書き残してから完了を知らせること", async () => {
      playDaughterExit(box, [exitOf()], onFinished);
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      const [keyframes, options] = animate.mock.calls[0]!;

      expect(keyframes.at(-1)).toEqual({ transform: "translateY(115%)" });
      expect(options).toMatchObject({
        delay: DAUGHTER_EXIT_START_MS,
        duration: DAUGHTER_EXIT_MS,
      });
      expect(commitStyles).toHaveBeenCalledBefore(onFinished);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });

    test("娘が抜け切る時刻に、箱を沈めて戻すこと", async () => {
      playDaughterExit(box, [exitOf()], onFinished);
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      const [, options] = boxAnimate.mock.calls[0]!;

      expect(options).toMatchObject({ delay: DAUGHTER_LANDING_MS });
    });

    test("右の出口からは、右へ抜けさせること", async () => {
      playDaughterExit(
        box,
        [exitOf({ side: "right", travelPercent: 125 })],
        onFinished,
      );
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      const [keyframes] = animate.mock.calls[0]!;

      expect(keyframes.at(-1)).toEqual({ transform: "translateX(125%)" });
    });

    test("上の出口からは、上へ抜けさせること", async () => {
      playDaughterExit(box, [exitOf({ side: "top" })], onFinished);
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      const [keyframes] = animate.mock.calls[0]!;

      expect(keyframes.at(-1)).toEqual({ transform: "translateY(-115%)" });
    });

    describe("目標が2つの場合", () => {
      let second: HTMLElement;
      let secondAnimate: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        secondAnimate = vi.fn(
          () =>
            ({
              finished: Promise.resolve(),
              cancel: vi.fn(),
              commitStyles: vi.fn(),
            }) as unknown as Animation,
        );
        second = document.createElement("button");
        second.animate = secondAnimate as unknown as HTMLElement["animate"];
      });

      test("1つ目が抜け切ってから2つ目を抜けさせ、それぞれが抜け切る時刻に箱を沈めること", async () => {
        playDaughterExit(
          box,
          [exitOf(), exitOf({ element: second, side: "top" })],
          onFinished,
        );
        await vi.advanceTimersByTimeAsync(longEnoughMs);

        const [, firstOptions] = animate.mock.calls[0]!;
        const [, secondOptions] = secondAnimate.mock.calls[0]!;
        const sinkDelays = boxAnimate.mock.calls.map(
          ([, options]) => options.delay,
        );

        expect(firstOptions).toMatchObject({
          delay: getDaughterExitStartMs(0),
        });
        expect(secondOptions).toMatchObject({
          delay: getDaughterExitStartMs(1),
        });
        expect(getDaughterExitStartMs(1)).toBeGreaterThan(
          getDaughterLandingMs(0),
        );
        expect(sinkDelays).toEqual([
          getDaughterLandingMs(0),
          getDaughterLandingMs(1),
        ]);
        expect(onFinished).toHaveBeenCalledTimes(1);
      });
    });

    test("つかんでいた娘は、寄せと持ち上げを収める動きから始めること", async () => {
      playDaughterExit(
        box,
        [
          exitOf({
            heldLook: {
              lean: "0cqw -5cqw",
              scale: "1.04",
              boxShadow: "0 9px 16px red",
            },
          }),
        ],
        onFinished,
      );
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      const settle = animate.mock.calls.find(
        ([keyframes]) => keyframes[0].translate !== undefined,
      );

      expect(settle?.[0][0]).toMatchObject({
        translate: "0cqw -5cqw",
        scale: "1.04",
      });
      expect(settle?.[0].at(-1)).toMatchObject({ scale: "1" });
      expect(settle?.[1].delay ?? 0).toBe(0);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("娘を動かさずに見せ、箱から消してから完了を知らせること", async () => {
      playDaughterExit(box, [exitOf()], onFinished);
      await vi.advanceTimersByTimeAsync(REDUCED_MOTION_DAUGHTER_EXIT_MS - 1);
      const visibilityBefore = daughter.style.visibility;
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      expect(animate).not.toHaveBeenCalled();
      expect(boxAnimate).not.toHaveBeenCalled();
      expect(visibilityBefore).toBe("");
      expect(daughter.style.visibility).toBe("hidden");
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });
});
