import { getGameResultSound } from "@/components/game-result-sound";

describe("getGameResultSound", () => {
  const levels = ["clear", "good", "great", "perfect"] as const;

  test("評価段階が高いほど、音を多く重ねて長く鳴らすこと", () => {
    const sounds = levels.map(getGameResultSound);

    const toneCounts = sounds.map((tones) => tones.length);
    const lengths = sounds.map((tones) =>
      Math.max(
        ...tones.map(({ offsetMs = 0, durationMs }) => offsetMs + durationMs),
      ),
    );
    expect(toneCounts).toEqual([...toneCounts].sort((a, b) => a - b));
    expect(new Set(toneCounts).size).toBe(levels.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(new Set(lengths).size).toBe(levels.length);
  });
});
