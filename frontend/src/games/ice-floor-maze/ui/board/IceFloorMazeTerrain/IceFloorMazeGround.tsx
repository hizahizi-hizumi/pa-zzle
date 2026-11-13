import { useId } from "react";

import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { ICE_FLOOR_MAZE_WALL_THICKNESS } from "@/games/ice-floor-maze/ui/board/board-geometry";
import {
  createIceFloorMazeBoundaryPath,
  createIceFloorMazeDrawnCellPath,
  createIceFloorMazeEnclosedOutsidePath,
  createIceFloorMazeJointPath,
  listIceFloorMazeEnclosedOutsideCells,
} from "@/games/ice-floor-maze/ui/board/terrain-paths";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeGroundProps = {
  board: IceFloorMazeBoard;
};

/** 外壁の縁の明暗の幅。真上から見て、外側の上と左の縁が明るく、下と右の縁が暗い。 */
const WALL_BEVEL = 0.04;
/** 外壁が氷へ落とす影の幅。光が左上から当たるので、上と左の外壁の影だけが氷に載る。 */
const WALL_CAST_SHADOW_WIDTH = 0.16;
/** 目地は、氷の継ぎ目のごく薄い線にする。氷は1枚の面に見え、何マス滑るかは線で数えられる。 */
const JOINT_WIDTH = 0.02;

/**
 * 氷の奥行き。厚い氷の下に湖の水があり、岸の近くは浅く明るく、真ん中へ向かって青が深くなる。
 * 中心を少し右下へ寄せ、光の当たる左上を明るく見せる。位置と半径は盤面の大きさに対する割合。
 */
const ICE_DEPTH = {
  center: { x: 0.52, y: 0.54 },
  radius: 0.74,
  deepOpacity: 0.24,
  midOpacity: 0.1,
  shallowOpacity: 0.17,
} as const;
/**
 * 磨かれた氷の面に渡る光の帯。太い帯の脇に細い帯を添える。マスごとの模様ではなく、湖全体を左上から右下へ渡る。
 * `at` は位置、`band` は太さ（どちらも盤面の幅と高さの和に対する割合）。
 */
const iceSheenBands = [
  { at: 0.3, band: 0.07, opacity: 0.16 },
  { at: 0.37, band: 0.012, opacity: 0.13 },
  { at: 0.72, band: 0.1, opacity: 0.12 },
] as const;

/**
 * 雪原に開いた湖として、氷の面と、湖を囲む外壁（雪の土手）を描く。
 * 氷は、真ん中へ向かって深くなる青の上に、磨かれた面の淡い光が渡る。どちらも、マス目の線と要素の邪魔をしない薄さに留める。
 */
export function IceFloorMazeGround({ board }: IceFloorMazeGroundProps) {
  const idPrefix = `ifm${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const iceDepthId = `${idPrefix}-ice-depth`;
  const iceClipId = `${idPrefix}-ice-clip`;
  const palette = iceFloorMazeTone;
  const { width, height } = board;
  const span = width + height;
  const drawnCellPath = createIceFloorMazeDrawnCellPath(board);
  // 盤面に囲まれた盤面の外には岩場が載るので、その下も氷の面にする。
  const enclosed = listIceFloorMazeEnclosedOutsideCells(board);
  const icePath =
    drawnCellPath + createIceFloorMazeEnclosedOutsidePath(board, enclosed);
  const wallStroke = {
    d: drawnCellPath,
    strokeWidth: ICE_FLOOR_MAZE_WALL_THICKNESS * 2,
    strokeLinejoin: "round",
  } as const;

  return (
    <>
      <defs>
        <radialGradient
          id={iceDepthId}
          gradientUnits="userSpaceOnUse"
          cx={width * ICE_DEPTH.center.x}
          cy={height * ICE_DEPTH.center.y}
          r={Math.max(width, height) * ICE_DEPTH.radius}
        >
          <stop
            offset="0"
            stopColor={palette.iceDeep}
            stopOpacity={ICE_DEPTH.deepOpacity}
          />
          <stop
            offset="0.62"
            stopColor={palette.iceDeep}
            stopOpacity={ICE_DEPTH.midOpacity}
          />
          <stop
            offset="1"
            stopColor={palette.iceShallow}
            stopOpacity={ICE_DEPTH.shallowOpacity}
          />
        </radialGradient>
        <clipPath id={iceClipId}>
          <path d={icePath} />
        </clipPath>
      </defs>
      <path
        {...wallStroke}
        transform={`translate(${WALL_BEVEL} ${WALL_BEVEL})`}
        fill={palette.wallShade}
        stroke={palette.wallShade}
      />
      <path
        {...wallStroke}
        transform={`translate(${-WALL_BEVEL} ${-WALL_BEVEL})`}
        fill={palette.wallLit}
        stroke={palette.wallLit}
      />
      <path
        data-wall=""
        {...wallStroke}
        fill={palette.wall}
        stroke={palette.wall}
      />
      <path d={icePath} fill={palette.ice} />
      <g clipPath={`url(#${iceClipId})`}>
        <rect width={width} height={height} fill={`url(#${iceDepthId})`} />
        {iceSheenBands.map(({ at, band, opacity }) => (
          <line
            key={at}
            x1={span * at}
            y1={-1}
            x2={span * at - height - 2}
            y2={height + 1}
            stroke={palette.iceSheen}
            strokeOpacity={opacity}
            strokeWidth={span * band}
          />
        ))}
        <path
          d={createIceFloorMazeJointPath(board)}
          fill="none"
          stroke={palette.iceJoint}
          strokeWidth={JOINT_WIDTH}
        />
        <path
          d={createIceFloorMazeBoundaryPath(board, enclosed)}
          fill="none"
          stroke={palette.wallCastShadow}
          strokeWidth={WALL_CAST_SHADOW_WIDTH}
          strokeLinecap="square"
          transform={`translate(${WALL_CAST_SHADOW_WIDTH / 2} ${WALL_CAST_SHADOW_WIDTH / 2})`}
        />
      </g>
    </>
  );
}
