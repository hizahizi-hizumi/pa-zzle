import { _private } from "@/games/magic-square/ui/use-magic-square-sound-effects";

const { clearedSoundLayers } = _private;

function readSoundName(url: string): string {
  return url.split("/").at(-1) ?? "";
}

describe("clearedSoundLayers", () => {
  test("クリアの演出の行・縦の列・斜めの段が始まる時刻に段の音を、仕上げが始まる時刻に仕上げの音を鳴らすこと", () => {
    const layers = clearedSoundLayers.map(({ sound, offsetMs }) => [
      readSoundName(sound.url),
      offsetMs,
    ]);

    expect(layers).toEqual([
      ["cleared-row.flac", 0],
      ["cleared-column.flac", 300],
      ["cleared-diagonal.flac", 600],
      ["cleared-finish.flac", 1000],
    ]);
  });
});
