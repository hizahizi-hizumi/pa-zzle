import { renderHook } from "@testing-library/react";

import type { IceFloorMazeLastSlide } from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import { useIceFloorMazeSoundEffects } from "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects";
import { playSound, type SoundEffect } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: { pitchCents: 30, volumeRatio: 0.12 },
}));

afterEach(() => {
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
});

// 0 から右へ3マス滑って 3 で止まる滑り。滑りは 141 ミリ秒で、最後の1マスを進み始めるのは 94 ミリ秒。
const plainSlide: IceFloorMazeLastSlide = {
  id: 1,
  direction: "right",
  from: 0,
  to: 3,
  path: [1, 2, 3],
  crumbledRock: null,
  crackedIce: [],
  pushedSnow: null,
  movedBlock: null,
  stoppedOnFloor: false,
  passedGoal: false,
  isClearingMove: false,
  entersTrap: false,
};

// 0 から右へ2マス滑って 2 で止まる、短い滑り。
const shortSlide: IceFloorMazeLastSlide = {
  ...plainSlide,
  to: 2,
  path: [1, 2],
};

// 3マス目の雪 3 を 4 へ押し出し、3 で止まった。
const snowSlide: IceFloorMazeLastSlide = {
  ...plainSlide,
  pushedSnow: { from: 3, to: 4 },
};

// 0 から右へ5マス滑る。2マス進んで塊 3 に触れ（82 ミリ秒）、塊を 6 まで押して 5 で止まる（205 ミリ秒）。
const blockSlide: IceFloorMazeLastSlide = {
  ...plainSlide,
  to: 5,
  path: [1, 2, 3, 4, 5],
  movedBlock: { from: 3, to: 6 },
};

// 0 から右へ10マス滑る。9マス進んで塊 10 に触れ（328.5 ミリ秒）、塊を 11 まで1マス押して 10 で止まる（365 ミリ秒）。
const lateBlockSlide: IceFloorMazeLastSlide = {
  ...plainSlide,
  to: 10,
  path: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  movedBlock: { from: 10, to: 11 },
};

type SlideProps = { lastSlide: IceFloorMazeLastSlide | null };

function listPlayedSounds(): {
  name: string | undefined;
  delayMs: number | undefined;
}[] {
  return vi.mocked(playSound).mock.calls.map(([sound, options]) => ({
    name: (sound as SoundEffect).url.match(/([\w-]+)\.flac/)?.[1],
    delayMs: options?.delayMs,
  }));
}

describe("useIceFloorMazeSoundEffects", () => {
  let rerender: (props: SlideProps) => void;

  function renderSoundEffects(reduced: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced }) as MediaQueryList),
    );
    ({ rerender } = renderHook<void, SlideProps>(
      ({ lastSlide }) =>
        useIceFloorMazeSoundEffects(lastSlide, null, 35, "playing"),
      { initialProps: { lastSlide: null } },
    ));
  }

  describe("動かす設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(false);
    });

    test("止め役にぶつかって止まった滑りでは、止まった時刻に止まる音を鳴らすこと", () => {
      rerender({ lastSlide: plainSlide });

      const sounds = listPlayedSounds();

      expect(sounds).toEqual([
        { name: "slid", delayMs: undefined },
        { name: "glided-short", delayMs: undefined },
        { name: "stopped", delayMs: 141 },
      ]);
    });

    test("2マスまでの短い滑りでは、滑り続ける擦れの音を重ねないこと", () => {
      rerender({ lastSlide: shortSlide });

      const sounds = listPlayedSounds();

      expect(sounds.map(({ name }) => name)).toEqual(["slid", "stopped"]);
    });

    test("長い滑りでは、長い方の擦れの音を、滑りが止まる時刻に鳴り終わる速さで鳴らすこと", () => {
      rerender({ lastSlide: lateBlockSlide });

      const glide = vi
        .mocked(playSound)
        .mock.calls.find(([sound]) =>
          (sound as SoundEffect).url.includes("glided-long"),
        );

      expect(glide?.[1]?.playbackRate).toBeCloseTo(300 / 365);
    });

    test("雪を押し出した滑りでは、止まる音の代わりに、雪を押し出し始める時刻に雪の音を鳴らすこと", () => {
      rerender({ lastSlide: snowSlide });

      const sounds = listPlayedSounds();

      expect(sounds).toEqual([
        { name: "slid", delayMs: undefined },
        { name: "glided-short", delayMs: undefined },
        { name: "snow-pushed", delayMs: 94 },
      ]);
    });

    test("滑る氷の塊を押した滑りでは、止まる音の代わりに、塊が止まる時刻に当たるよう擦れの分だけ早く塊の音を鳴らすこと", () => {
      rerender({ lastSlide: blockSlide });

      const sounds = listPlayedSounds();

      expect(sounds).toEqual([
        { name: "slid", delayMs: undefined },
        { name: "glided-short", delayMs: undefined },
        { name: "block-stopped", delayMs: 165 },
      ]);
    });

    test("長い滑りの終わりに塊を1マスだけ押した滑りでは、駒が塊に触れる前に塊の音を鳴らし始めないこと", () => {
      rerender({ lastSlide: lateBlockSlide });

      const sounds = listPlayedSounds();

      expect(sounds).toContainEqual({ name: "block-stopped", delayMs: 328.5 });
    });
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(true);
    });

    const cases = [
      ["雪を押し出した滑り", snowSlide, "snow-pushed"],
      ["滑る氷の塊を押した滑り", blockSlide, "block-stopped"],
    ] as const;

    test.each(cases)(
      "%sでは、滑る音を鳴らさず止まり方の音だけをすぐ鳴らすこと",
      (_, slide, expected) => {
        rerender({ lastSlide: slide });

        const sounds = listPlayedSounds();

        expect(sounds).toEqual([{ name: expected, delayMs: 0 }]);
      },
    );
  });
});
