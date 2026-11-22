import { useId } from "react";

import {
  FLASK_CENTER_X,
  FLASK_VIEW_BOX,
  type FlaskShape,
} from "@/games/water-sort/ui/ideas/alchemy/flask-shapes";

type FlaskGlassFrontProps = {
  shape: FlaskShape;
  selected: boolean;
};

const SELECTED_RIM_COLOR = "#ffd89a";

/** 液の手前のガラス。左の縁の白い照りと、右手の蝋燭が右の縁に落とす暖かい光。 */
export function FlaskGlassFront({ shape, selected }: FlaskGlassFrontProps) {
  const specularId = useId();
  const { mouth, neckHalfWidth } = shape;
  const neckLeft = FLASK_CENTER_X - neckHalfWidth;

  return (
    <svg
      className="absolute inset-0 size-full overflow-visible"
      viewBox={FLASK_VIEW_BOX}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={specularId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.12" stopColor="#fff" stopOpacity="0.62" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* ガラスの厚み */}
      <path
        d={shape.outline}
        fill="none"
        stroke={shape.tint}
        strokeOpacity="0.12"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d={shape.outline}
        fill="none"
        stroke={selected ? SELECTED_RIM_COLOR : shape.tint}
        strokeOpacity={selected ? 1 : 0.68}
        strokeWidth={selected ? 1.35 : 1.05}
        strokeLinejoin="round"
      />
      {/* 厚い底 */}
      <rect
        x="4.6"
        y="94.4"
        width="26.8"
        height="1.7"
        rx="0.85"
        fill={shape.tint}
        fillOpacity="0.28"
      />
      <path
        d="M 7.5 97.1 Q 18 98 28.5 97.1"
        fill="none"
        stroke="#ffdcae"
        strokeOpacity="0.32"
        strokeWidth="0.5"
      />
      {/* 照り */}
      <rect
        x="5.1"
        y="30"
        width="1.5"
        height="58"
        rx="0.75"
        fill={`url(#${specularId})`}
      />
      <rect
        x="7.4"
        y="34"
        width="0.45"
        height="40"
        rx="0.22"
        fill="#fff"
        fillOpacity="0.2"
      />
      <rect
        x={neckLeft + 0.9}
        y={mouth.y + 3}
        width="0.65"
        height={Math.max(0, shape.sealY - mouth.y - 5)}
        rx="0.32"
        fill="#fff"
        fillOpacity="0.4"
      />
      <rect
        x="30.3"
        y="33"
        width="0.8"
        height="54"
        rx="0.4"
        fill="#ffc47e"
        fillOpacity="0.42"
      />
      {/* 口 */}
      <ellipse
        cx={FLASK_CENTER_X}
        cy={mouth.y + 0.4}
        rx={Math.max(1, mouth.halfWidth - 0.6)}
        ry="0.75"
        fill="#050302"
        fillOpacity="0.55"
        stroke={selected ? SELECTED_RIM_COLOR : shape.tint}
        strokeOpacity={selected ? 0.95 : 0.7}
        strokeWidth="0.6"
      />
      {/* ガラスに閉じ込められた気泡 */}
      {shape.seeds.map(([dx, y]) => (
        <circle
          key={`${dx}-${y}`}
          cx={FLASK_CENTER_X + dx}
          cy={y}
          r="0.55"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.38"
          strokeWidth="0.3"
        />
      ))}
    </svg>
  );
}
