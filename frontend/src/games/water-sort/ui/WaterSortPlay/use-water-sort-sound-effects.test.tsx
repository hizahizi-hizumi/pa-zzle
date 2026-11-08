import { cleanup, render } from "@testing-library/react";
import type { GameProgress } from "@/games/play";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortAppearance } from "@/games/water-sort/ui/board/water-bottle/appearance";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/WaterSortPlay/use-water-sort-sound-effects";

const soundSpies = vi.hoisted(() => ({
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
}));

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  prepareSoundEffects: vi.fn(),
  playLayeredSound: soundSpies.playLayeredSound,
  playSound: soundSpies.playSound,
  REPEATED_SOUND_VARIATION: { pitchCents: 30, volumeRatio: 0.12 },
}));

type SoundHarnessProps = {
  appearance: WaterSortAppearance;
  operation: WaterSortOperation | null;
  progress: GameProgress;
};

function SoundHarness({ appearance, operation, progress }: SoundHarnessProps) {
  useWaterSortSoundEffects(operation, progress, appearance);
  return null;
}

const pour: WaterSortOperation = {
  id: 1,
  type: "poured",
  sourceBottleIndex: 0,
  destinationBottleIndex: 1,
  stateBefore: [[0], []],
  stateAfter: [[], [0]],
  isClearingMove: false,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useWaterSortSoundEffects", () => {
  test.each([
    ["classic", 1600],
    ["glass", 1200],
  ] as const)(
    "注水と効果音を同じ演出時間へ合わせること: %s",
    (appearance, duration) => {
      const { rerender } = render(
        <SoundHarness
          appearance={appearance}
          operation={null}
          progress="playing"
        />,
      );

      rerender(
        <SoundHarness
          appearance={appearance}
          operation={pour}
          progress="playing"
        />,
      );

      expect(soundSpies.playLayeredSound).toHaveBeenCalledOnce();
      const [layers, options] = soundSpies.playLayeredSound.mock.calls[0] ?? [];
      expect(options.delayMs).toBe(duration * 0.38);
      expect(layers[5].offsetMs).toBeCloseTo(duration * (0.72 - 0.38) * 0.82);
    },
  );

  test.each([
    ["classic", 1600],
    ["glass", 1200],
  ] as const)(
    "クリア音が液体の着水完了と一致すること: %s",
    (appearance, duration) => {
      const { rerender } = render(
        <SoundHarness
          appearance={appearance}
          operation={null}
          progress="playing"
        />,
      );

      rerender(
        <SoundHarness
          appearance={appearance}
          operation={null}
          progress="clearing"
        />,
      );

      expect(soundSpies.playSound).toHaveBeenCalledOnce();
      expect(soundSpies.playSound.mock.calls[0]?.[1]?.delayMs).toBe(
        duration * 0.72,
      );
    },
  );
});
