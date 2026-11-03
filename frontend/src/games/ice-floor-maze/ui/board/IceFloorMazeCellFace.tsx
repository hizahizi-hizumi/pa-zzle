import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import {
  createIceFloorMazeCrackPath,
  createIceFloorMazeSnowPatchPath,
  createIceFloorMazeWaterHollowPath,
  createIceFloorMazeWavePath,
  formatIceFloorMazePolygon,
  ICE_FLOOR_MAZE_SNOW_MOUND_SHADOW_DEPTH,
  iceFloorMazeFloorDots,
  iceFloorMazePaneShape,
  iceFloorMazeRockShape,
  iceFloorMazeRubbleChipPolygons,
  iceFloorMazeSlidingBlockEdgePath,
  iceFloorMazeSlidingBlockGlintPath,
  iceFloorMazeSlidingBlockShape,
  iceFloorMazeSnowDots,
  iceFloorMazeSnowMoundPath,
} from "@/games/ice-floor-maze/ui/board/cell-shapes";
import type { IceFloorMazeCellClipIds } from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/**
 * 氷の地の上に載せて描くマス。氷と盤面の外は地形の地で描く。
 * `rubble` は、もろい岩が崩れてできた氷のマスに残す石くずの跡。`sliding-block` はマスではなく、マスの上に載る滑る氷の塊。
 */
export type IceFloorMazeCellFaceKind =
  | Exclude<IceFloorMazeStateCell, "ice" | "outside">
  | "rubble"
  | "sliding-block";

const rockTones = {
  face: iceFloorMazeToneClassNames.stoneFace,
  shadow: iceFloorMazeToneClassNames.stoneShadow,
};
const brittleRockTones = {
  face: iceFloorMazeToneClassNames.brittleFace,
  shadow: iceFloorMazeToneClassNames.brittleShadow,
};

type IceFloorMazeCellFaceProps = {
  kind: IceFloorMazeCellFaceKind;
  clipIds: IceFloorMazeCellClipIds;
};

const slidingBlockTones = {
  face: iceFloorMazeToneClassNames.slidingBlock,
  shadow: iceFloorMazeToneClassNames.slidingBlockShadow,
};

const crackPath = createIceFloorMazeCrackPath();
const snowPatchPath = createIceFloorMazeSnowPatchPath();
const waterHollowPath = createIceFloorMazeWaterHollowPath();
const wavePath = createIceFloorMazeWavePath();
const CRACK_WIDTH = 0.055;
const WAVE_WIDTH = 0.06;
const SNOW_EDGE_WIDTH = 0.045;
const SLIDING_BLOCK_GLINT_WIDTH = 0.07;
const SLIDING_BLOCK_EDGE_WIDTH = 0.045;

/**
 * マスの左上を原点に、1マスの姿を描く。親がマスの位置へ置く。
 * もろい岩の左右の塊（`data-brittle-half`）と薄い氷の破片（`data-thin-ice-shard`）は、崩れる・割れる動きで1つずつ動かせる。
 */
export function IceFloorMazeCellFace({
  kind,
  clipIds,
}: IceFloorMazeCellFaceProps) {
  switch (kind) {
    case "rock":
      return renderRockBlock(rockTones, iceFloorMazeRockShape);
    case "brittle-rock":
      return (
        <>
          {clipIds.brittleHalves.map((clipId, index) => (
            <g
              key={clipId}
              data-brittle-half={index}
              clipPath={`url(#${clipId})`}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {renderRockBlock(brittleRockTones, iceFloorMazeRockShape)}
            </g>
          ))}
        </>
      );
    case "thin-ice":
      return (
        <>
          {clipIds.thinIceShards.map((clipId, index) => (
            <g
              key={clipId}
              data-thin-ice-shard={index}
              clipPath={`url(#${clipId})`}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              {renderThinIcePane()}
            </g>
          ))}
        </>
      );
    case "floor":
      return (
        <>
          {renderPane(iceFloorMazeToneClassNames.floor)}
          {iceFloorMazeFloorDots.centers.map(({ x, y }) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={iceFloorMazeFloorDots.radius}
              className={iceFloorMazeToneClassNames.floorDot}
            />
          ))}
        </>
      );
    case "rubble":
      return iceFloorMazeRubbleChipPolygons.map((polygon) => (
        <polygon
          key={formatIceFloorMazePolygon(polygon)}
          points={formatIceFloorMazePolygon(polygon)}
          strokeLinejoin="round"
          className={iceFloorMazeToneClassNames.rubble}
        />
      ));
    case "water":
      return (
        <>
          {renderPane(iceFloorMazeToneClassNames.water)}
          <path
            d={waterHollowPath}
            className={iceFloorMazeToneClassNames.waterHollow}
          />
          <path
            d={wavePath}
            fill="none"
            strokeWidth={WAVE_WIDTH}
            strokeLinecap="round"
            className={iceFloorMazeToneClassNames.wave}
          />
        </>
      );
    case "snow":
      return (
        <>
          <path
            d={snowPatchPath}
            strokeWidth={SNOW_EDGE_WIDTH}
            strokeLinejoin="round"
            className={iceFloorMazeToneClassNames.snow}
          />
          {iceFloorMazeSnowDots.centers.map(({ x, y }) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={iceFloorMazeSnowDots.radius}
              className={iceFloorMazeToneClassNames.snowDot}
            />
          ))}
        </>
      );
    case "snow-mound":
      return (
        <>
          <path
            d={iceFloorMazeSnowMoundPath}
            transform={`translate(0 ${ICE_FLOOR_MAZE_SNOW_MOUND_SHADOW_DEPTH})`}
            className={iceFloorMazeToneClassNames.snowMoundShadow}
          />
          <path
            d={iceFloorMazeSnowMoundPath}
            className={iceFloorMazeToneClassNames.snowMound}
          />
        </>
      );
    case "sliding-block":
      return (
        <>
          {renderRockBlock(slidingBlockTones, iceFloorMazeSlidingBlockShape)}
          <path
            d={iceFloorMazeSlidingBlockEdgePath}
            fill="none"
            strokeWidth={SLIDING_BLOCK_EDGE_WIDTH}
            strokeLinecap="round"
            className={iceFloorMazeToneClassNames.slidingBlockEdge}
          />
          <path
            d={iceFloorMazeSlidingBlockGlintPath}
            fill="none"
            strokeWidth={SLIDING_BLOCK_GLINT_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={iceFloorMazeToneClassNames.slidingBlockGlint}
          />
        </>
      );
  }
}

function renderRockBlock(
  tones: { face: string; shadow: string },
  {
    inset,
    width,
    height,
    shadowDepth,
    cornerRadius,
  }: typeof iceFloorMazeRockShape | typeof iceFloorMazeSlidingBlockShape,
) {
  return (
    <>
      <rect
        x={inset}
        y={inset + shadowDepth}
        width={width}
        height={height}
        rx={cornerRadius}
        className={tones.shadow}
      />
      <rect
        x={inset}
        y={inset}
        width={width}
        height={height}
        rx={cornerRadius}
        className={tones.face}
      />
    </>
  );
}

function renderThinIcePane() {
  return (
    <>
      {renderPane(iceFloorMazeToneClassNames.thinIce)}
      <path
        d={crackPath}
        fill="none"
        strokeWidth={CRACK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={iceFloorMazeToneClassNames.thinIceCrack}
      />
    </>
  );
}

function renderPane(className: string) {
  const { inset, size, cornerRadius } = iceFloorMazePaneShape;
  return (
    <rect
      x={inset}
      y={inset}
      width={size}
      height={size}
      rx={cornerRadius}
      className={className}
    />
  );
}
