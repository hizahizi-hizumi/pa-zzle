import { renderHook } from "@testing-library/react";

import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  _private,
  useWaterSortSoundEffects,
} from "@/games/water-sort/ui/use-water-sort-sound-effects";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
  REPEATED_SOUND_VARIATION: {},
}));

const { getSealRingPlaybackRate } = _private;

afterEach(() => {
  vi.clearAllMocks();
});

function getPlayedSoundNames(): string[] {
  return vi.mocked(playSound).mock.calls.map(
    ([sound]) =>
      String((sound as { url?: string }).url)
        .split("/")
        .at(-1) ?? "",
  );
}

describe("useWaterSortSoundEffects", () => {
  function playOperations(operations: readonly WaterSortOperation[]) {
    const { rerender } = renderHook<
      void,
      { operation: WaterSortOperation | null }
    >(({ operation }) => useWaterSortSoundEffects(operation, "playing"), {
      initialProps: { operation: null },
    });
    for (const operation of operations) {
      rerender({ operation });
    }
  }

  test("注ぎ元を選ぶ手と、選ぶのをやめる手には、音を鳴らさないこと", () => {
    playOperations([
      { id: 1, type: "source-selected", bottleIndex: 0 },
      { id: 2, type: "source-deselected", bottleIndex: 0 },
    ]);

    expect(playSound).not.toHaveBeenCalled();
    expect(playLayeredSound).not.toHaveBeenCalled();
  });

  test("注げなかった手には、試験管が揺れる音を鳴らすこと", () => {
    playOperations([
      { id: 1, type: "source-selected", bottleIndex: 0 },
      { id: 2, type: "invalid", bottleIndex: 1 },
    ]);

    expect(getPlayedSoundNames()).toEqual(["tube-rattle.flac"]);
  });
});

describe("getSealRingPlaybackRate", () => {
  describe("色が音階の段より少ない盤面の場合", () => {
    const sealedOne = [[0, 0, 0, 0], [1, 2, 1], [2, 1, 2], []];
    const sealedTwo = [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [2, 2],
      [2, 2],
    ];
    const sealedAll = [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], []];

    test("そろった試験管が増えるたびに、音階を1段ずつ上がること", () => {
      const rates = [sealedOne, sealedTwo, sealedAll].map((state) =>
        getSealRingPlaybackRate(state),
      );

      expect(rates).toEqual([1, 2 ** (2 / 12), 2 ** (4 / 12)]);
    });
  });

  describe("色が音階の段より多い盤面の場合", () => {
    const colors = Array.from({ length: 12 }, (_, color) => color);
    const sealedCounts = [1, 6, 12];
    const states = sealedCounts.map((sealedCount) =>
      colors.map((color) =>
        color < sealedCount ? [color, color, color, color] : [color],
      ),
    );

    test("最初の1本を最も低い段、最後の1本を最も高い段で鳴らすこと", () => {
      const rates = states.map((state) => getSealRingPlaybackRate(state));

      expect(rates[0]).toBe(1);
      expect(rates[1]).toBeGreaterThan(1);
      expect(rates[2]).toBe(2 ** (16 / 12));
    });
  });
});
