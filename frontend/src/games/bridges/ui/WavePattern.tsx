import { bridgesToneClassNames } from "@/games/bridges/ui/bridges-tone";

const WAVE_WIDTHS = { small: 12, large: 20 } as const;
const WAVE_STROKE_WIDTH = 2;

type WaveTile = {
  width: number;
  height: number;
  marks: readonly { x: number; y: number; large: boolean }[];
};

type WavePatternProps = {
  id: string;
  tile: WaveTile;
  unit: number;
};

/** 波の印を1つ置く、横に2つ山を持つ短い線。`x`・`y` は左端。 */
function wavePath(x: number, y: number, size: number): string {
  const half = size / 2;
  return `M${x} ${y}q${half / 2} ${-half / 2} ${half} 0t${half} 0`;
}

export function WavePattern({ id, tile, unit }: WavePatternProps) {
  return (
    <pattern
      id={id}
      width={tile.width * unit}
      height={tile.height * unit}
      patternUnits="userSpaceOnUse"
    >
      <g
        fill="none"
        strokeWidth={WAVE_STROKE_WIDTH * unit}
        strokeLinecap="round"
        className={bridgesToneClassNames.seaWave}
      >
        {tile.marks.map((mark) => (
          <path
            key={`${mark.x}:${mark.y}`}
            d={wavePath(
              mark.x * unit,
              mark.y * unit,
              (mark.large ? WAVE_WIDTHS.large : WAVE_WIDTHS.small) * unit,
            )}
          />
        ))}
      </g>
    </pattern>
  );
}
