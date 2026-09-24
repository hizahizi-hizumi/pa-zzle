export function Digit404({
  colorClassName,
  fontSize,
  x,
  y,
}: {
  colorClassName: string;
  fontSize: number;
  x: number;
  y: number;
}) {
  return (
    <g
      className={colorClassName}
      fontFamily='"Zen Kaku Gothic New", "Hiragino Sans", ui-sans-serif, system-ui, sans-serif'
      fontWeight="700"
      letterSpacing="-0.06em"
    >
      <text x={x} y={y} fontSize={fontSize} textAnchor="start">
        4
      </text>
      <text
        x={x + fontSize * 0.72}
        y={y}
        fontSize={fontSize}
        textAnchor="start"
      >
        0
      </text>
      <text
        x={x + fontSize * 1.46}
        y={y}
        fontSize={fontSize}
        textAnchor="start"
      >
        4
      </text>
    </g>
  );
}
