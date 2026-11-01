import type { IceFloorMazeStateCell } from "@/games/ice-floor-maze/puzzle/state";
import {
  createIceFloorMazeCrackPath,
  createIceFloorMazeWaterHollowPath,
  createIceFloorMazeWavePath,
  iceFloorMazePaneShape,
  iceFloorMazeRockShape,
} from "@/games/ice-floor-maze/ui/board/cell-shapes";
import type { IceFloorMazeCellClipIds } from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import { iceFloorMazeToneClassNames } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

/** 氷の地の上に載せて描くマス。氷と盤面の外は地形の地で描く。 */
export type IceFloorMazeCellFaceKind = Exclude<
  IceFloorMazeStateCell,
  "ice" | "outside"
>;

type IceFloorMazeCellFaceProps = {
  kind: IceFloorMazeCellFaceKind;
  clipIds: IceFloorMazeCellClipIds;
};

const crackPath = createIceFloorMazeCrackPath();
const waterHollowPath = createIceFloorMazeWaterHollowPath();
const wavePath = createIceFloorMazeWavePath();
const CRACK_WIDTH = 0.055;
const WAVE_WIDTH = 0.06;

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
      return renderRockBlock();
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
              {renderRockBlock()}
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
  }
}

function renderRockBlock() {
  const { inset, width, height, shadowDepth, cornerRadius } =
    iceFloorMazeRockShape;
  return (
    <>
      <rect
        x={inset}
        y={inset + shadowDepth}
        width={width}
        height={height}
        rx={cornerRadius}
        className={iceFloorMazeToneClassNames.stoneShadow}
      />
      <rect
        x={inset}
        y={inset}
        width={width}
        height={height}
        rx={cornerRadius}
        className={iceFloorMazeToneClassNames.stoneFace}
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
