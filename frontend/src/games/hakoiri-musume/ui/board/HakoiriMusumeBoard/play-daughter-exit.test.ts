import { DAUGHTER_EXIT_MS } from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import { playDaughterExit } from "@/games/hakoiri-musume/ui/board/HakoiriMusumeBoard/play-daughter-exit";

/** 演出とその後の間を十分に超える時間。 */
const longEnoughMs = 10_000;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("playDaughterExit", () => {
  const onFinished = vi.fn();
  let daughter: HTMLElement;
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
  });

  describe("動きを減らさない設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: false }) as MediaQueryList),
      );
    });

    test("娘を下へ抜けさせ、抜け切った姿を書き残してから完了を知らせること", async () => {
      playDaughterExit(daughter, onFinished);
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      const [keyframes, options] = animate.mock.calls[0]!;

      expect(keyframes.at(-1)).toEqual({ transform: "translateY(115%)" });
      expect(options).toMatchObject({ duration: DAUGHTER_EXIT_MS });
      expect(commitStyles).toHaveBeenCalledBefore(onFinished);
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
    });

    test("娘を動かさずに見せてから完了を知らせること", async () => {
      playDaughterExit(daughter, onFinished);
      await vi.advanceTimersByTimeAsync(longEnoughMs);

      expect(animate).not.toHaveBeenCalled();
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
  });
});
