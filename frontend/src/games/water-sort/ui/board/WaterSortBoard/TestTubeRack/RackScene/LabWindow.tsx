import { useId } from "react";

type LabWindowProps = {
  /** 窓を置ける場所の上の端と下の端。窓台の下の端を `bottom` にそろえる。 */
  top: number;
  bottom: number;
  centerX: number;
  /** 窓を置ける幅（窓台の張り出しを含む）。 */
  maxWidth: number;
  /** 窓枠と縦の桟の太さ。窓台の厚さと張り出しも、これに比べて決める。 */
  lineWidth: number;
};

/**
 * 窓として読める高さの下限（窓台を含む）。これより低いと、窓枠と窓台に挟まれたガラスが細い帯になり、窓に見えない。
 */
const MIN_WINDOW_HEIGHT_PX = 64;
/** 窓の幅の、高さに対する比の範囲。置ける場所が広くても、これを超えて横長や縦長にしない。 */
const MIN_ASPECT = 1.3;
const MAX_ASPECT = 2.4;
/** 縦の桟で仕切るガラス1枚の、幅の高さに対するおおよその比と、仕切る枚数の上限。 */
const PANE_ASPECT = 1.2;
const MAX_PANE_COUNT = 3;
/** 窓台の厚さと張り出し（窓枠の太さに対する倍数）。 */
const SILL_HEIGHT_RATIO = 2.5;
const SILL_OVERHANG_RATIO = 2;
/** 窓台の端と、置ける幅の端の間。 */
const SIDE_MARGIN_PX = 12;
/** 木立の高さ（ガラスの高さに対する割合）と、樹冠の半径（木立の高さに対する倍数）。 */
const TREE_HEIGHT_RATIO = 0.3;
const TREE_CROWN_RADII = [0.9, 0.62, 1.05, 0.58, 0.82, 0.7] as const;

/**
 * 真横から見た理科室の窓。窓枠・ガラス・校庭の木立・縦の桟・窓台の平らな面だけで、壁に近い淡い色で描く。
 * 大きさは置ける場所から決め、窓として読める高さが無ければ描かない。
 */
export function LabWindow({
  top,
  bottom,
  centerX,
  maxWidth,
  lineWidth,
}: LabWindowProps) {
  const glassClipId = useId();
  const sillHeight = lineWidth * SILL_HEIGHT_RATIO;
  const sillOverhang = lineWidth * SILL_OVERHANG_RATIO;
  const roomHeight = bottom - top;
  const width = Math.min(
    maxWidth - (SIDE_MARGIN_PX + sillOverhang) * 2,
    roomHeight * MAX_ASPECT,
  );
  const height = Math.min(roomHeight, width / MIN_ASPECT);
  if (height < MIN_WINDOW_HEIGHT_PX) {
    return null;
  }

  const left = centerX - width / 2;
  const frameTop = bottom - height;
  const frameBottom = bottom - sillHeight;
  const glassLeft = left + lineWidth;
  const glassTop = frameTop + lineWidth;
  const glassWidth = width - lineWidth * 2;
  const glassBottom = frameBottom - lineWidth / 2;
  const glassHeight = glassBottom - glassTop;
  const paneCount = Math.min(
    MAX_PANE_COUNT,
    Math.max(2, Math.round(glassWidth / (glassHeight * PANE_ASPECT))),
  );
  const treeHeight = glassHeight * TREE_HEIGHT_RATIO;
  const crownStep = treeHeight * 1.15;
  const crownCount = Math.ceil(glassWidth / crownStep) + 1;

  return (
    <g>
      <rect
        x={left}
        y={frameTop}
        width={width}
        height={frameBottom - frameTop}
        rx={lineWidth / 2}
        className="fill-(--lab-frame)"
      />
      <clipPath id={glassClipId}>
        <rect
          x={glassLeft}
          y={glassTop}
          width={glassWidth}
          height={glassHeight}
        />
      </clipPath>
      <g clipPath={`url(#${glassClipId})`}>
        <rect
          x={glassLeft}
          y={glassTop}
          width={glassWidth}
          height={glassHeight}
          className="fill-(--lab-pane)"
        />
        {/* 校庭の木立。大きさの違う丸を重ね、上の縁が波打つ1つの面にする。 */}
        <g className="fill-(--lab-tree)">
          <rect
            x={glassLeft}
            y={glassBottom - treeHeight * 0.45}
            width={glassWidth}
            height={treeHeight * 0.45}
          />
          {Array.from({ length: crownCount }, (_, index) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: 樹冠は並びの位置だけで決まる。
              key={index}
              cx={glassLeft + crownStep * index}
              cy={glassBottom - treeHeight * 0.4}
              r={
                treeHeight *
                (TREE_CROWN_RADII[index % TREE_CROWN_RADII.length] ?? 1) *
                0.6
              }
            />
          ))}
        </g>
      </g>
      {/* 縦の桟 */}
      <g className="fill-(--lab-frame)">
        {Array.from({ length: paneCount - 1 }, (_, index) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: 縦の桟は並びの位置だけで決まる。
            key={index}
            x={
              glassLeft + (glassWidth / paneCount) * (index + 1) - lineWidth / 2
            }
            y={glassTop}
            width={lineWidth}
            height={glassHeight}
          />
        ))}
      </g>
      {/* 窓台 */}
      <rect
        x={left - sillOverhang}
        y={frameBottom}
        width={width + sillOverhang * 2}
        height={sillHeight}
        rx={lineWidth / 2}
        className="fill-(--lab-frame)"
      />
    </g>
  );
}
