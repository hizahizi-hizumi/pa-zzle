import { parseBridgesBoard } from "@/games/bridges/puzzle/board";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { createClearedSoundLayers } from "@/games/bridges/ui/BridgesPlay/use-bridges-sound-effects";

function readSoundName(url: string): string {
  return url.split("/").at(-1) ?? "";
}

describe("createClearedSoundLayers", () => {
  test("段の少ない盤面では、島が灯る段ごとに五音音階を下から鳴らし、灯り切ったときに海の音を鳴らすこと", () => {
    // 島0 から2段で全島に届く。
    const square = parseBridgesBoard([
      "3...3",
      ".....",
      ".....",
      ".....",
      "2...2",
    ]);

    const layers = createClearedSoundLayers(square, [2, 1, 1, 0]);

    expect(
      layers.map(({ sound, offsetMs }) => [readSoundName(sound.url), offsetMs]),
    ).toEqual([
      ["cleared-light-1.flac", 160],
      ["cleared-light-2.flac", 260],
      ["cleared-light-3.flac", 360],
      ["cleared-sea.flac", 504],
    ]);
  });

  test("段の多い盤面では、最初と最後の段を含めて音の数まで間引いて鳴らすこと", () => {
    const chain = parseBridgesBoard(["1.2.2.2.2.2.2.2.2.2.1"]);
    const bridges = Array.from({ length: 10 }, (): BridgeCount => 1);

    const layers = createClearedSoundLayers(chain, bridges);

    expect(layers).toHaveLength(8);
    expect(layers[0]?.offsetMs).toBe(160);
    expect(layers[6]?.offsetMs).toBe(860);
    expect(readSoundName(layers[7]!.sound.url)).toBe("cleared-sea.flac");
  });
});
