// 木の試験管立て。動かない部分なので、試験管の層と分けた SVG に描き、試験管が動いても描き直させない。
import { memo } from "react";
import { LIQUID_COLOR_COUNT, liquidColor } from "./colors";
import {
  CAVITY_PATH,
  columnX,
  type RackLayout,
  tierTop,
} from "./geometry";

function holeRadius(layout: RackLayout) {
  return Math.min(29.5, layout.pitch / 2 - 5);
}

/** 盤面のすべての層が参照する定義。 */
export const RackDefs = memo(function RackDefs() {
  const liquidGradients = Array.from(
    { length: LIQUID_COLOR_COUNT + 4 },
    (_, index) => {
      const { light, deep } = liquidColor(index);
      return (
        <g key={index}>
          {/* 立てた試験管の液: 上ほど明るく、底ほど深い色 */}
          <linearGradient
            id={`tb-lq-${index}`}
            x1="0"
            x2="0"
            y1="40"
            y2="196"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={light} stopOpacity="0.96" />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
          <linearGradient id={`tb-lqb-${index}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="1" stopColor={deep} />
          </linearGradient>
        </g>
      );
    },
  );

  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute" }}
    >
      <defs>
        <clipPath id="tb-cav">
          <path d={CAVITY_PATH} />
        </clipPath>
        {liquidGradients}
        <linearGradient
          id="tb-cyl"
          x1="-22"
          x2="22"
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#000" stopOpacity=".16" />
          <stop offset=".1" stopColor="#fff" stopOpacity=".30" />
          <stop offset=".24" stopColor="#fff" stopOpacity=".10" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset=".74" stopColor="#000" stopOpacity=".07" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
        <linearGradient
          id="tb-glass"
          x1="-26"
          x2="26"
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity=".34" />
          <stop offset=".22" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset=".7" stopColor="#dfe9f2" stopOpacity=".04" />
          <stop offset="1" stopColor="#b5c6d8" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id="tb-hl" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".08" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".7" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tb-wood-top" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e3c28b" />
          <stop offset="1" stopColor="#f2dbb0" />
        </linearGradient>
        <linearGradient id="tb-wood-front" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d6a668" />
          <stop offset=".55" stopColor="#c6925a" />
          <stop offset="1" stopColor="#ad7942" />
        </linearGradient>
        <linearGradient id="tb-post-l" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#e6c08a" />
          <stop offset=".7" stopColor="#d1a265" />
          <stop offset="1" stopColor="#b2803f" />
        </linearGradient>
        <linearGradient id="tb-post-r" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#cf9f61" />
          <stop offset=".5" stopColor="#bd8a4f" />
          <stop offset="1" stopColor="#9d6c38" />
        </linearGradient>
        <linearGradient id="tb-dowel" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ecd09f" />
          <stop offset=".5" stopColor="#cfa06a" />
          <stop offset="1" stopColor="#a47442" />
        </linearGradient>
        <linearGradient id="tb-table" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#d9d4ca" />
          <stop offset="0.04" stopColor="#ece8e0" />
          <stop offset="0.5" stopColor="#e4dfd5" />
          <stop offset="1" stopColor="#d6d0c4" />
        </linearGradient>
        <radialGradient id="tb-table-light" cx=".3" cy="0" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tb-cork" cx=".32" cy=".25" r=".95">
          <stop offset="0" stopColor="#e8bf8c" />
          <stop offset=".6" stopColor="#c99660" />
          <stop offset="1" stopColor="#a06c3c" />
        </radialGradient>
        <radialGradient id="tb-sparkle" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".3" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tb-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="tb-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.45"
            numOctaves="3"
            seed="7"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.3 -0.88"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="tb-grain-v" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.5 0.008"
            numOctaves="3"
            seed="11"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 0.10  0 0 0 2.3 -0.9"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="tb-cork-tex" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed="3"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0 0.08  0 0 0 2.4 -1.2"
            result="c"
          />
          <feComposite in="c" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id="tb-blur06">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <filter id="tb-blur1">
          <feGaussianBlur stdDeviation="1" />
        </filter>
        <filter id="tb-blur3" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="tb-blur6" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
    </svg>
  );
});

function BoardTop({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={1.5}
        fill="url(#tb-wood-top)"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#000"
        filter="url(#tb-grain)"
        opacity={0.5}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={1}
        fill="#a87a45"
        opacity={0.35}
      />
    </>
  );
}

function BoardFront({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={1.5}
        fill="url(#tb-wood-front)"
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#000"
        filter="url(#tb-grain)"
        opacity={0.8}
      />
      <rect
        x={x + 1}
        y={y}
        width={width - 2}
        height={1.1}
        fill="#f8e4bd"
        opacity={0.95}
      />
      <rect
        x={x}
        y={y + height - 1}
        width={width}
        height={1}
        fill="#7f522a"
        opacity={0.6}
      />
      {/* 木口の小口を左右に */}
      <rect
        x={x}
        y={y}
        width={3}
        height={height}
        fill="#f0d3a0"
        opacity={0.35}
      />
    </>
  );
}

type TierProps = { layout: RackLayout; tier: number };

/** 段の奥: 奥の横木、上の板の天面と穴、下の板の天面とくぼみ。 */
export const RackTierBack = memo(function RackTierBack({
  layout,
  tier,
}: TierProps) {
  const y = tierTop(tier);
  const { boardX, boardWidth, columns } = layout;
  const rx = holeRadius(layout);
  const columnsXs = Array.from({ length: columns }, (_, column) =>
    columnX(layout, column),
  );
  return (
    <g>
      <rect
        x={boardX + 2}
        y={y + 104}
        width={boardWidth - 4}
        height={7}
        rx={3.5}
        fill="url(#tb-dowel)"
      />
      <rect
        x={boardX + 2}
        y={y + 112}
        width={boardWidth - 4}
        height={3}
        fill="#7a5a3a"
        opacity={0.1}
        filter="url(#tb-blur1)"
      />
      <BoardTop x={boardX + 2} y={y + 20} width={boardWidth - 4} height={10} />
      {columnsXs.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={y + 25} rx={rx} ry={4.2} fill="#7a5229" />
          <ellipse
            cx={x}
            cy={y + 25.6}
            rx={rx - 1.5}
            ry={3.4}
            fill="#40260f"
            opacity={0.8}
          />
          <path
            d={`M${x - rx},${y + 25} A${rx},4.2 0 0 0 ${x + rx},${y + 25}`}
            stroke="#f6dfb2"
            strokeWidth={0.9}
            fill="none"
            opacity={0.85}
          />
        </g>
      ))}
      <BoardTop
        x={boardX + 2}
        y={y + 188}
        width={boardWidth - 4}
        height={14}
      />
      {columnsXs.map((x) => (
        <g key={x}>
          <ellipse
            cx={x}
            cy={y + 196}
            rx={rx - 2.5}
            ry={4.4}
            fill="#b5844c"
            opacity={0.55}
          />
          <path
            d={`M${x - rx + 2.5},${y + 196} A${rx - 2.5},4.4 0 0 1 ${x + rx - 2.5},${y + 196}`}
            stroke="#8b5d31"
            strokeWidth={0.8}
            fill="none"
            opacity={0.6}
          />
          <path
            d={`M${x - rx + 2.5},${y + 196} A${rx - 2.5},4.4 0 0 0 ${x + rx - 2.5},${y + 196}`}
            stroke="#fbe8c4"
            strokeWidth={0.7}
            fill="none"
            opacity={0.6}
          />
        </g>
      ))}
    </g>
  );
});

/** 段の手前: 上の板と下の板の前面。試験管の手前に重なる。 */
export const RackTierFront = memo(function RackTierFront({
  layout,
  tier,
}: TierProps) {
  const y = tierTop(tier);
  const { boardX, boardWidth } = layout;
  return (
    <g>
      <BoardFront x={boardX} y={y + 30} width={boardWidth} height={12} />
      <rect
        x={boardX + 2}
        y={y + 42}
        width={boardWidth - 4}
        height={4}
        fill="#3a2610"
        opacity={0.13}
        filter="url(#tb-blur1)"
      />
      <BoardFront x={boardX} y={y + 202} width={boardWidth} height={14} />
    </g>
  );
});

/** 床の影。立ての後ろの最も奥。 */
export const RackFloor = memo(function RackFloor({
  layout,
}: {
  layout: RackLayout;
}) {
  const bottom = tierTop(layout.tiers - 1) + 218;
  const cx = layout.boardX + layout.boardWidth / 2;
  const tableTop = bottom - 16;
  return (
    <g>
      {/* 立てが載る実験台。奥の縁から手前へ画面の下まで続く。 */}
      <rect
        x={-800}
        y={tableTop}
        width={layout.width + 1600}
        height={700}
        fill="url(#tb-table)"
      />
      <rect
        x={-800}
        y={tableTop}
        width={layout.width + 1600}
        height={400}
        fill="url(#tb-table-light)"
      />
      <rect
        x={-800}
        y={tableTop - 1}
        width={layout.width + 1600}
        height={1.2}
        fill="#b9b2a5"
        opacity={0.7}
      />
      <ellipse
        cx={cx + 8}
        cy={bottom + 2}
        rx={layout.boardWidth / 2 + 12}
        ry={9}
        fill="#2c3a48"
        opacity={0.24}
        filter="url(#tb-blur6)"
      />
      <ellipse
        cx={cx + 4}
        cy={bottom}
        rx={layout.boardWidth / 2 + 2}
        ry={2.6}
        fill="#2c3a48"
        opacity={0.24}
        filter="url(#tb-blur1)"
      />
      {/* 柱の後ろの壁に落ちるやわらかい影（光は左上から） */}
      <rect
        x={layout.boardX + 14}
        y={tierTop(0) + 30}
        width={layout.boardWidth}
        height={bottom - tierTop(0) - 28}
        rx={10}
        fill="#2c3a48"
        opacity={0.07}
        filter="url(#tb-blur6)"
      />
    </g>
  );
});

/** 左右の柱。段の板の両端を貫いて立つ。 */
export const RackPosts = memo(function RackPosts({
  layout,
}: {
  layout: RackLayout;
}) {
  const top = tierTop(0) + 14;
  const height = tierTop(layout.tiers - 1) + 206 - tierTop(0);
  const left = layout.boardX - 8;
  const right = layout.boardX + layout.boardWidth - 4;
  return (
    <g>
      {[
        { x: left, fill: "url(#tb-post-l)", end: "#f2d8a8" },
        { x: right, fill: "url(#tb-post-r)", end: "#e3c590" },
      ].map(({ x, fill, end }) => (
        <g key={x}>
          <rect x={x} y={top} width={12} height={height} rx={2} fill={fill} />
          <rect
            x={x}
            y={top}
            width={12}
            height={height}
            fill="#000"
            filter="url(#tb-grain-v)"
            opacity={0.55}
          />
          <rect x={x} y={top - 2} width={12} height={4} rx={2} fill={end} />
          <rect
            x={x}
            y={top + height - 3}
            width={12}
            height={3}
            rx={1}
            fill="#6f4824"
            opacity={0.5}
          />
        </g>
      ))}
      <rect
        x={left + 11}
        y={top + 2}
        width={1}
        height={height - 2}
        fill="#7a5129"
        opacity={0.35}
      />
      <rect
        x={right}
        y={top + 2}
        width={1}
        height={height - 2}
        fill="#fff3d8"
        opacity={0.3}
      />
    </g>
  );
});
