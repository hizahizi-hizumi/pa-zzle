import { useId } from "react";

type BarSpoonProps = {
  width: number;
  length: number;
  stemWidth: number;
};

/** ねじれた柄の、銀のバースプーン。上の端に重りの玉、下の端に液を受ける小さな皿。 */
export function BarSpoon({ width, length, stemWidth }: BarSpoonProps) {
  const id = useId();
  const metalId = `${id}-metal`;
  const twistId = `${id}-twist`;
  const bowlId = `${id}-bowl`;
  const center = width / 2;
  const ballRadius = Math.max(2.2, width * 0.2);
  const bowlHeight = Math.max(4, width * 0.34);
  const bowlHalfWidth = width * 0.46;
  const stemTop = ballRadius * 1.6;
  const stemBottom = length - bowlHeight * 0.7;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 overflow-visible"
      width={width}
      height={length}
      viewBox={`0 0 ${width} ${length}`}
    >
      <defs>
        <linearGradient id={metalId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5e5853" />
          <stop offset="0.38" stopColor="#f6efe4" />
          <stop offset="0.6" stopColor="#b9b1a6" />
          <stop offset="1" stopColor="#4a4540" />
        </linearGradient>
        <pattern
          id={twistId}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-38)"
        >
          <rect width="4" height="1.4" fill="#2a2420" opacity="0.5" />
        </pattern>
        <radialGradient id={bowlId} cx="0.4" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff7ea" />
          <stop offset="0.5" stopColor="#bdb4a8" />
          <stop offset="1" stopColor="#4d4741" />
        </radialGradient>
      </defs>
      <circle
        cx={center}
        cy={ballRadius}
        r={ballRadius}
        fill={`url(#${bowlId})`}
      />
      <rect
        x={center - stemWidth / 2}
        y={stemTop}
        width={stemWidth}
        height={stemBottom - stemTop}
        fill={`url(#${metalId})`}
      />
      <rect
        x={center - stemWidth / 2}
        y={stemTop}
        width={stemWidth}
        height={stemBottom - stemTop}
        fill={`url(#${twistId})`}
      />
      <path
        d={`M ${center - stemWidth / 2} ${stemBottom - 2} Q ${center - bowlHalfWidth} ${length - bowlHeight} ${center - bowlHalfWidth} ${length - bowlHeight * 0.45} Q ${center} ${length + bowlHeight * 0.2} ${center + bowlHalfWidth} ${length - bowlHeight * 0.45} Q ${center + bowlHalfWidth} ${length - bowlHeight} ${center + stemWidth / 2} ${stemBottom - 2} Z`}
        fill={`url(#${bowlId})`}
      />
    </svg>
  );
}
