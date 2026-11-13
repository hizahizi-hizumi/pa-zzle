import { renderHook } from "@testing-library/react";

import type { HakoiriMusumeStepNotice } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import {
  DAUGHTER_EXIT_START_MS,
  DAUGHTER_LANDING_MS,
  getDaughterExitStartMs,
  getDaughterLandingMs,
  REDUCED_MOTION_DAUGHTER_EXIT_MS,
} from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
import { useHakoiriMusumeSoundEffects } from "@/games/hakoiri-musume/ui/HakoiriMusumePlay/use-hakoiri-musume-sound-effects";
import type { GameProgress } from "@/games/play";
import {
  playLayeredSound,
  playSound,
  type SoundEffect,
  type SoundLayer,
} from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  playLayeredSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: { pitchCents: 30, volumeRatio: 0.12 },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
  vi.unstubAllGlobals();
});

function nameOf(sound: SoundEffect): string | undefined {
  return sound.url.match(/([\w-]+)\.flac/)?.[1];
}

type SoundProps = {
  stepNotice: HakoiriMusumeStepNotice | null;
  progress: GameProgress;
  targetCount?: number;
};

function smallStep(id: number): HakoiriMusumeStepNotice {
  return { id, pieceIndex: 6, target: null, from: 16, to: 17, cellCount: 1 };
}

describe("useHakoiriMusumeSoundEffects", () => {
  let rerender: (props: SoundProps) => void;

  function renderSoundEffects(reduced: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced }) as MediaQueryList),
    );
    ({ rerender } = renderHook<void, SoundProps>(
      ({ stepNotice, progress, targetCount = 1 }) =>
        useHakoiriMusumeSoundEffects(stepNotice, progress, targetCount),
      { initialProps: { stepNotice: null, progress: "playing" } },
    ));
  }

  describe("動きを減らさない設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(false);
    });

    test("駒が移るたびに、直前と違うテイクを選んで揺らぎ付きですべる音を鳴らすこと", () => {
      for (let id = 1; id <= 30; id += 1) {
        rerender({ stepNotice: smallStep(id), progress: "playing" });
      }

      const played = vi.mocked(playSound).mock.calls;
      const takes = played.map(([sound]) => nameOf(sound));

      expect(new Set(takes)).toEqual(
        new Set(["piece-slid", "piece-slid-2", "piece-slid-3"]),
      );
      expect(takes.every((take, index) => take !== takes[index - 1])).toBe(
        true,
      );
      expect(played.every(([, options]) => options?.variation)).toBe(true);
    });

    describe("前の音から十分に時間がたっている場合", () => {
      beforeEach(() => {
        vi.spyOn(performance, "now").mockReturnValue(1_000_000);
      });

      test("1回の入力で続けて移ったときは、移ったマスの数だけ少しずつずらして鳴らすこと", () => {
        rerender({
          stepNotice: { ...smallStep(1), to: 19, cellCount: 3 },
          progress: "playing",
        });

        const delays = vi
          .mocked(playSound)
          .mock.calls.map(([, options]) => options?.delayMs);

        expect(delays).toEqual([0, 30, 60]);
      });
    });

    describe("続く入力で間をおかずに移った場合", () => {
      let now = 2_000_000;

      beforeEach(() => {
        vi.spyOn(performance, "now").mockImplementation(() => now);
      });

      test("前の音から決まった間をあけて鳴らすこと", () => {
        rerender({ stepNotice: smallStep(1), progress: "playing" });
        now += 10;
        rerender({ stepNotice: smallStep(2), progress: "playing" });

        const delays = vi
          .mocked(playSound)
          .mock.calls.map(([, options]) => options?.delayMs);

        expect(delays).toEqual([0, 20]);
      });
    });

    test("同じ知らせを描き直しても、もう一度は鳴らさないこと", () => {
      rerender({ stepNotice: smallStep(1), progress: "playing" });
      rerender({ stepNotice: smallStep(1), progress: "playing" });

      expect(vi.mocked(playSound)).toHaveBeenCalledTimes(1);
    });

    test("娘が移ったときは、同じすべる音を遅く低く鳴らすこと", () => {
      rerender({
        stepNotice: { ...smallStep(1), pieceIndex: 1, target: 0 },
        progress: "playing",
      });

      const [, options] = vi.mocked(playSound).mock.calls[0]!;

      expect(options?.playbackRate).toBeLessThan(1);
    });

    test("娘が出口の前に着いたら、抜け始める時刻にこすれの音と、抜け切る時刻にごとんの音を重ねて鳴らすこと", () => {
      rerender({ stepNotice: smallStep(1), progress: "clearing" });

      const [layers] = vi.mocked(playLayeredSound).mock.calls[0]!;

      expect(
        (layers as SoundLayer[]).map(({ sound, offsetMs }) => [
          nameOf(sound),
          offsetMs,
        ]),
      ).toEqual([
        ["cleared-slide", DAUGHTER_EXIT_START_MS],
        ["cleared-thud", DAUGHTER_LANDING_MS],
      ]);
    });

    test("目標が2つなら、1つずつ順に抜ける時刻に合わせて、こすれとごとんを2組鳴らすこと", () => {
      rerender({
        stepNotice: smallStep(1),
        progress: "clearing",
        targetCount: 2,
      });

      const [layers] = vi.mocked(playLayeredSound).mock.calls[0]!;

      expect(
        (layers as SoundLayer[]).map(({ sound, offsetMs }) => [
          nameOf(sound),
          offsetMs,
        ]),
      ).toEqual([
        ["cleared-slide", getDaughterExitStartMs(0)],
        ["cleared-thud", getDaughterLandingMs(0)],
        ["cleared-slide", getDaughterExitStartMs(1)],
        ["cleared-thud", getDaughterLandingMs(1)],
      ]);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(true);
    });

    test("娘は抜けていかずに箱から消えるので、こすれを鳴らさず、消える時刻にごとんだけを鳴らすこと", () => {
      rerender({ stepNotice: smallStep(1), progress: "clearing" });
      const [sound, options] = vi.mocked(playSound).mock.calls.at(-1)!;

      expect(vi.mocked(playLayeredSound)).not.toHaveBeenCalled();
      expect(nameOf(sound)).toBe("cleared-thud");
      expect(options).toEqual({ delayMs: REDUCED_MOTION_DAUGHTER_EXIT_MS });
    });
  });
});
