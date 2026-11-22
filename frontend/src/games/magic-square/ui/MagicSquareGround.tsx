import { magicSquareTone } from "@/games/magic-square/ui/magic-square-tone";

/** 粒の色を 0〜1 の RGB で返す。`feColorMatrix` に渡す。 */
function toUnitRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map(
    (channel) => Number((channel / 255).toFixed(3)),
  ) as [number, number, number];
}

/**
 * 地の石の模様。ゆるやかなむらを全体に薄く敷き、その上に雑音の濃い所だけを残した細かい粒を重ねる。どちらも盤面より前へ出ない薄さにする。
 * 繰り返しの継ぎ目が出ないよう、雑音はタイルの端でつなぐ。
 */
function createGrainImage(): string {
  const [red, green, blue] = toUnitRgb(magicSquareTone.groundGrain);
  const color = `0 0 0 0 ${red} 0 0 0 0 ${green} 0 0 0 0 ${blue}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
<filter id="fine" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix values="${color} 0 0 0 2.4 -1.35"/></filter>
<filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="3" stitchTiles="stitch"/><feColorMatrix values="${color} 0 0 0 0.6 -0.15"/></filter>
<rect width="100%" height="100%" filter="url(#mottle)" opacity="0.35"/>
<rect width="100%" height="100%" filter="url(#fine)" opacity="0.5"/>
</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const grainImage = createGrainImage();

export function MagicSquareGround() {
  return (
    <div
      className="size-full"
      style={{
        backgroundColor: magicSquareTone.ground,
        backgroundImage: grainImage,
      }}
    />
  );
}
