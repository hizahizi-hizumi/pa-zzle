import { renderHook } from "@testing-library/react";

import type { FukumenzanOperation } from "@/games/fukumenzan/play/use-fukumenzan-play";
import { useFukumenzanSoundEffects } from "@/games/fukumenzan/ui/use-fukumenzan-sound-effects";
import type { GameProgress } from "@/games/play";
import {
  playLayeredSound,
  playSound,
  type SoundEffect,
} from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
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

type SoundProps = {
  operation: FukumenzanOperation | null;
  progress: GameProgress;
};

function readSoundName(sound: SoundEffect): string | undefined {
  return sound.url.match(/([\w-]+)\.flac/)?.[1];
}

function listPlayedSounds(): (string | undefined)[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) => readSoundName(sound as SoundEffect));
}

describe("useFukumenzanSoundEffects", () => {
  let rerender: (props: SoundProps) => void;

  function renderSoundEffects(reduced: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: reduced }) as MediaQueryList),
    );
    ({ rerender } = renderHook<void, SoundProps>(
      ({ operation, progress }) =>
        useFukumenzanSoundEffects(operation, progress, 4),
      { initialProps: { operation: null, progress: "playing" } },
    ));
  }

  describe("動かす設定の場合", () => {
    beforeEach(() => {
      renderSoundEffects(false);
    });

    test("操作の知らせごとに、その種類の音を一度だけ鳴らすこと", () => {
      rerender({ operation: { id: 1, type: "placed" }, progress: "playing" });
      rerender({ operation: { id: 1, type: "placed" }, progress: "playing" });
      rerender({ operation: { id: 2, type: "crossed" }, progress: "playing" });
      rerender({
        operation: { id: 3, type: "uncrossed" },
        progress: "playing",
      });
      rerender({ operation: { id: 4, type: "returned" }, progress: "playing" });

      expect(listPlayedSounds()).toEqual([
        "placed",
        "crossed",
        "uncrossed",
        "returned",
      ]);
    });

    test("完成したら、答えの桁が一の位から跳ねるのに合わせて段の音を鳴らし、最後の桁で和音を鳴らすこと", () => {
      rerender({ operation: null, progress: "clearing" });

      const [layers, options] = vi.mocked(playLayeredSound).mock.calls[0]!;

      expect({
        layers: layers.map(({ sound, offsetMs }) => [
          readSoundName(sound),
          offsetMs,
        ]),
        delayMs: options?.delayMs,
      }).toEqual({
        layers: [
          ["cleared-step-1", 0],
          ["cleared-step-2", 110],
          ["cleared-step-3", 220],
          ["cleared-chord", 330],
        ],
        delayMs: 180,
      });
    });
  });

  describe("動きを減らす設定の場合", () => {
    test("完成したら、和音だけを鳴らすこと", () => {
      renderSoundEffects(true);

      rerender({ operation: null, progress: "clearing" });

      expect([
        listPlayedSounds(),
        vi.mocked(playLayeredSound).mock.calls.length,
      ]).toEqual([["cleared-chord"], 0]);
    });
  });
});
