import { renderHook } from "@testing-library/react";

import type { HakoiriMusumeStepNotice } from "@/games/hakoiri-musume/play/use-hakoiri-musume-play";
import { DAUGHTER_EXIT_MS } from "@/games/hakoiri-musume/ui/board/daughter-exit-timing";
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
};

function smallStep(id: number): HakoiriMusumeStepNotice {
  return { id, pieceIndex: 6, kind: "small", from: 16, to: 17 };
}

describe("useHakoiriMusumeSoundEffects", () => {
  let rerender: (props: SoundProps) => void;

  function renderSoundEffects(reduced: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced }) as MediaQueryList),
    );
    ({ rerender } = renderHook<void, SoundProps>(
      ({ stepNotice, progress }) =>
        useHakoiriMusumeSoundEffects(stepNotice, progress),
      { initialProps: { stepNotice: null, progress: "playing" } },
    ));
  }

  describe("動きを減らさない設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(false);
    });

    test("駒が移るたびに、テイクを順に替えて揺らぎ付きですべる音を鳴らすこと", () => {
      for (const id of [1, 2, 3]) {
        rerender({ stepNotice: smallStep(id), progress: "playing" });
      }

      const played = vi
        .mocked(playSound)
        .mock.calls.map(([sound, options]) => [
          nameOf(sound),
          options?.variation !== undefined,
          options?.playbackRate,
        ]);

      expect(played).toEqual([
        ["piece-slid-2", true, undefined],
        ["piece-slid-3", true, undefined],
        ["piece-slid", true, undefined],
      ]);
    });

    test("同じ知らせを描き直しても、もう一度は鳴らさないこと", () => {
      rerender({ stepNotice: smallStep(1), progress: "playing" });
      rerender({ stepNotice: smallStep(1), progress: "playing" });

      expect(vi.mocked(playSound)).toHaveBeenCalledTimes(1);
    });

    test("娘が移ったときは、同じすべる音を遅く低く鳴らすこと", () => {
      rerender({
        stepNotice: { ...smallStep(1), pieceIndex: 1, kind: "daughter" },
        progress: "playing",
      });

      const [, options] = vi.mocked(playSound).mock.calls[0]!;

      expect(options?.playbackRate).toBeLessThan(1);
    });

    test("娘が出口の前に着いたら、こすれの音と、抜け切る時刻にごとんの音を重ねて鳴らすこと", () => {
      rerender({ stepNotice: smallStep(1), progress: "clearing" });

      const [layers] = vi.mocked(playLayeredSound).mock.calls[0]!;

      expect(
        (layers as SoundLayer[]).map(({ sound, offsetMs }) => [
          nameOf(sound),
          offsetMs,
        ]),
      ).toEqual([
        ["cleared-slide", 0],
        ["cleared-thud", DAUGHTER_EXIT_MS],
      ]);
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(true);
    });

    test("娘を出口の前に止めたまま見せるので、抜けていく音を重ねず、箱の胴鳴りだけを鳴らすこと", () => {
      rerender({ stepNotice: smallStep(1), progress: "clearing" });
      const played = vi
        .mocked(playSound)
        .mock.calls.map(([sound]) => nameOf(sound));

      expect(vi.mocked(playLayeredSound)).not.toHaveBeenCalled();
      expect(played.at(-1)).toBe("cleared-thud");
    });
  });
});
