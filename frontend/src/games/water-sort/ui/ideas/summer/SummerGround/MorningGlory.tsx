import { useId } from "react";

type Point = readonly [number, number];

/** 縁の波打った花の輪郭。5つの浅い山を持つ。 */
function getFlowerOutline(center: Point, radius: number): string {
  const [cx, cy] = center;
  const lobes = 5;
  const points: string[] = [];
  function at(angle: number, r: number) {
    return `${(cx + Math.cos(angle) * r).toFixed(2)} ${(cy + Math.sin(angle) * r).toFixed(2)}`;
  }
  for (let index = 0; index < lobes; index += 1) {
    const valley = ((index - 0.5) / lobes) * Math.PI * 2 - Math.PI / 2;
    const peak = (index / lobes) * Math.PI * 2 - Math.PI / 2;
    const next = ((index + 0.5) / lobes) * Math.PI * 2 - Math.PI / 2;
    if (index === 0) {
      points.push(`M ${at(valley, radius * 0.9)}`);
    }
    points.push(`Q ${at(peak, radius * 1.12)} ${at(next, radius * 0.9)}`);
  }
  return `${points.join(" ")} Z`;
}

const flowerCenter: Point = [42, 60];
const flowerOutline = getFlowerOutline(flowerCenter, 19);
const pleats = Array.from({ length: 5 }, (_, index) => {
  const angle = ((index + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
  const [cx, cy] = flowerCenter;
  return `M ${cx} ${cy} L ${(cx + Math.cos(angle) * 17).toFixed(2)} ${(cy + Math.sin(angle) * 17).toFixed(2)}`;
});

/** 縁側の隅に伸びてきた朝顔。昼にだけ咲く。 */
export function MorningGlory() {
  const id = useId();
  const petalId = `${id}-petal`;
  const leafId = `${id}-leaf`;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="absolute right-0 bottom-[calc(env(safe-area-inset-bottom)+--spacing(3))] size-24 dark:hidden"
    >
      <defs>
        <radialGradient id={petalId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.22" stopColor="#f2f0ff" />
          <stop offset="0.5" stopColor="#8c84f0" />
          <stop offset="1" stopColor="#4b4fd4" />
        </radialGradient>
        <linearGradient id={leafId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#7fb35e" />
          <stop offset="1" stopColor="#3f7a35" />
        </linearGradient>
      </defs>
      <g opacity="0.92">
        <path
          d="M104 104 C 86 86 80 70 70 58 C 62 48 66 36 76 32 C 84 29 88 38 82 42"
          fill="none"
          stroke="#4b7d37"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M70 58 C 58 52 48 44 30 36"
          fill="none"
          stroke="#4b7d37"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        {/* 三つに裂けた朝顔の葉 */}
        <path
          d="M80 74 C 70 66 64 72 66 80 C 60 82 58 92 66 94 C 70 100 82 98 86 92 C 94 94 98 86 92 80 C 94 72 86 68 80 74 Z"
          fill={`url(#${leafId})`}
        />
        <path
          d="M80 76 L 78 92 M79 84 L 70 88 M79 84 L 89 86"
          fill="none"
          stroke="#2f5f28"
          strokeWidth="0.7"
          opacity="0.6"
        />
        <path
          d="M88 44 C 82 40 78 46 80 51 C 76 53 76 60 81 61 C 84 65 91 64 93 59 C 99 60 101 54 97 50 C 98 45 92 41 88 44 Z"
          fill={`url(#${leafId})`}
          opacity="0.9"
        />
        {/* つぼみ */}
        <path
          d="M30 36 C 26 30 24 24 26 18 C 30 22 33 28 32 35 Z"
          fill="#6a5fd8"
        />
        <path d="M28 37 C 29 33 32 33 33 36 Z" fill="#4b7d37" />
        <path
          d={flowerOutline}
          fill={`url(#${petalId})`}
          stroke="#3d41b8"
          strokeWidth="0.6"
          strokeOpacity="0.5"
        />
        <g
          stroke="#ffffff"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.75"
        >
          {pleats.map((pleat) => (
            <path key={pleat} d={pleat} />
          ))}
        </g>
        <circle
          cx={flowerCenter[0]}
          cy={flowerCenter[1]}
          r="2.6"
          fill="#f6f1c8"
        />
      </g>
    </svg>
  );
}
