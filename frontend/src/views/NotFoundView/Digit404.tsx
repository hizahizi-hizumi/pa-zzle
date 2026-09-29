import type { Digit404Glyphs } from "@/views/NotFoundView/jigsawLayout";

type Digit404Props = {
  glyphs: Digit404Glyphs;
};

export function Digit404({ glyphs }: Digit404Props) {
  const [firstFourX, zeroX, lastFourX] = glyphs.glyphXs;

  return (
    <g
      className="fill-muted-foreground"
      fontFamily='"Zen Kaku Gothic New", "Hiragino Sans", ui-sans-serif, system-ui, sans-serif'
      fontSize={glyphs.fontSize}
      fontWeight="700"
    >
      <text x={firstFourX} y={glyphs.baselineY}>
        4
      </text>
      <text x={zeroX} y={glyphs.baselineY}>
        0
      </text>
      <text x={lastFourX} y={glyphs.baselineY}>
        4
      </text>
    </g>
  );
}
