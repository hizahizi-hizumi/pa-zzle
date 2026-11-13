import type { IceFloorMazeCellFaceKind } from "@/games/ice-floor-maze/ui/board/cell-face-kind";
import {
  createIceFloorMazeCrackPath,
  ICE_FLOOR_MAZE_RAISED,
  iceFloorMazeRubbleChips,
  iceFloorMazeSnowDrift,
  iceFloorMazeSnowGrains,
  iceFloorMazeWaves,
} from "@/games/ice-floor-maze/ui/board/cell-shapes";
import type { IceFloorMazeCellClipIds } from "@/games/ice-floor-maze/ui/board/IceFloorMazeCellClipPaths";
import { iceFloorMazeTone } from "@/games/ice-floor-maze/ui/ice-floor-maze-tone";

type IceFloorMazeCellFaceProps = {
  kind: IceFloorMazeCellFaceKind;
  clipIds: IceFloorMazeCellClipIds;
  /** 薄い氷のひびの向きをマスごとに変えるのに使う、マスの番号。渡さなければ向きを変えない。 */
  cellIndex?: number;
};

const crackPath = createIceFloorMazeCrackPath();
const splitPieceStyle = {
  transformBox: "fill-box",
  transformOrigin: "center",
} as const;

const { left, top, size, radius, bevel, shadow } = ICE_FLOOR_MAZE_RAISED;
const right = left + size;
const bottom = top + size;

/**
 * もろい岩を、角から角へ通るひびで分けた左右の塊。輪郭は岩と同じで、上の面の色だけが違う。
 * ひびのすき間から下の氷が見える。
 */
const brittleHalves = [
  `${left},${top} ${left + size * 0.52},${top} ${left + size * 0.4},${top + size * 0.34} ${left + size * 0.56},${top + size * 0.56} ${left + size * 0.42},${bottom} ${left},${bottom}`,
  `${left + size * 0.62},${top} ${right},${top} ${right},${bottom} ${left + size * 0.52},${bottom} ${left + size * 0.66},${top + size * 0.56} ${left + size * 0.5},${top + size * 0.34}`,
] as const;
const BRITTLE_ROUNDING = 0.06;
/** 割れ目から左右へ伸びる、細いひび。岩と同じ石が割れかけていると読ませる。 */
const brittleCrack = `M${left + size * 0.42} ${top + size * 0.3}L${left + size * 0.2} ${top + size * 0.38}M${left + size * 0.6} ${top + size * 0.52}L${left + size * 0.82} ${top + size * 0.46}M${left + size * 0.46} ${top + size * 0.76}L${left + size * 0.26} ${top + size * 0.82}`;

/**
 * 薄い氷と水面は、氷より低い面。真上から見て、立ち上がるものとは逆に、上と左の内側の縁が陰になり、
 * 下と右の内側の縁が光る。縁の幅が深さで、薄い氷は浅く、割れてできた水面は深い。どちらも氷から何も立ち上げない。
 */
const THIN_ICE_DEPTH = 0.05;
const WATER_DEPTH = 0.13;
const NEAR_EDGE = 0.04;

/** 床のざらつき。滑らない面だと読ませる、向きのそろった短い擦り傷。`[x, y, 長さ]`。 */
const floorGrit = [
  [0.18, 0.32, 0.12],
  [0.46, 0.28, 0.1],
  [0.7, 0.36, 0.12],
  [0.3, 0.56, 0.1],
  [0.56, 0.58, 0.13],
  [0.18, 0.8, 0.11],
  [0.44, 0.82, 0.1],
  [0.7, 0.78, 0.12],
] as const;
const FLOOR_INSET = 0.05;

/**
 * 雪山。押し寄せた雪が、岩や氷の塊と同じ大きさに盛り上がった止め役。角を大きく丸めて硬い塊と見分ける。
 * 押せる雪（高さの無い、粒の載った面）と一目で分かれるよう、粒は載せず、下と右に幅のある陰と影を付ける。
 */
const MOUND_ROUNDING = 0.3;
const MOUND_SHADE = 0.13;
const thinIceTurns = [
  { mirrorX: false, mirrorY: false },
  { mirrorX: true, mirrorY: false },
  { mirrorX: false, mirrorY: true },
  { mirrorX: true, mirrorY: true },
] as const;

/** 滑る氷の塊の上の面は少し透かし、下のゴールが塊越しに見えるようにする。 */
const ICE_BLOCK_FACE_OPACITY = 0.9;

/**
 * マスの左上を原点に描き、親がマスの位置へ置く。
 * 盤面と同じく真上から見た絵にし、手前の側面は描かない。滑っていった先で何が起きるかを、高さで読ませる。
 * 氷から立ち上がるもの（もろい岩・雪山・滑る氷の塊）は、下と右の縁が暗く、右下へ影を落とす。硬い塊（もろい岩・滑る氷の塊）は上と左の縁も明るい。
 * 入って止まるもの（床・雪）は縁取りも影も持たない。薄い氷と水面は、縁取りの明暗が逆の、氷より低い面。
 * もろい岩の左右の塊（`data-brittle-half`）と薄い氷の破片（`data-thin-ice-shard`）は、1つずつ動かせる。
 */
export function IceFloorMazeCellFace({
  kind,
  clipIds,
  cellIndex = 0,
}: IceFloorMazeCellFaceProps) {
  const palette = iceFloorMazeTone;

  switch (kind) {
    case "brittle-rock": {
      const face = palette.brittleRock;
      return (
        <>
          {renderRaisedShadow()}
          {brittleHalves.map((points, index) => (
            <g key={points} data-brittle-half={index} style={splitPieceStyle}>
              <polygon
                points={points}
                transform={`translate(${bevel / 2} ${bevel / 2})`}
                fill={palette.brittleRockShade}
                stroke={palette.brittleRockShade}
                strokeWidth={BRITTLE_ROUNDING}
                strokeLinejoin="round"
              />
              <polygon
                points={points}
                transform={`translate(${-bevel / 2} ${-bevel / 2})`}
                fill={palette.brittleRockLit}
                stroke={palette.brittleRockLit}
                strokeWidth={BRITTLE_ROUNDING}
                strokeLinejoin="round"
              />
              <polygon
                points={points}
                fill={face}
                stroke={face}
                strokeWidth={BRITTLE_ROUNDING - bevel / 2}
                strokeLinejoin="round"
              />
            </g>
          ))}
          <path
            d={brittleCrack}
            fill="none"
            stroke={palette.brittleRockShade}
            strokeWidth={0.035}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    }
    case "thin-ice": {
      // ひびの形が並んで同じに見えないよう、マスごとに左右・上下を裏返す。縁の明暗は、裏返した後も光の向きに合うよう逆に描く。
      const turn = thinIceTurns[cellIndex % thinIceTurns.length]!;
      return (
        <g
          transform={`translate(${turn.mirrorX ? 1 : 0} ${turn.mirrorY ? 1 : 0}) scale(${turn.mirrorX ? -1 : 1} ${turn.mirrorY ? -1 : 1})`}
        >
          {clipIds.thinIceShards.map((clipId, index) => (
            <g
              key={clipId}
              data-thin-ice-shard={index}
              clipPath={`url(#${clipId})`}
              style={splitPieceStyle}
            >
              {renderSunken(
                palette.thinIce,
                palette.iceEdgeShade,
                palette.iceEdgeLit,
                THIN_ICE_DEPTH,
                turn,
              )}
              <path
                d={crackPath}
                fill="none"
                stroke={palette.thinIceCrack}
                strokeWidth={0.04}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
      );
    }
    case "floor":
      return (
        <>
          <rect
            x={FLOOR_INSET}
            y={FLOOR_INSET}
            width={1 - FLOOR_INSET * 2}
            height={1 - FLOOR_INSET * 2}
            rx={0.08}
            fill={palette.floor}
          />
          {floorGrit.map(([x, y, length]) => (
            <line
              key={`${x}-${y}`}
              x1={x}
              y1={y}
              x2={x + length}
              y2={y - length * 0.6}
              stroke={palette.floorGrit}
              strokeWidth={0.045}
              strokeLinecap="round"
            />
          ))}
        </>
      );
    case "rubble":
      return iceFloorMazeRubbleChips.map((chip) => (
        <path key={chip} d={chip} fill={palette.rubble} />
      ));
    case "water":
      return (
        <>
          {renderSunken(
            palette.water,
            palette.waterEdgeShade,
            palette.iceEdgeLit,
            WATER_DEPTH,
          )}
          <path
            d={iceFloorMazeWaves}
            fill="none"
            stroke={palette.wave}
            strokeWidth={0.05}
            strokeLinecap="round"
          />
        </>
      );
    case "snow":
      return (
        <>
          <path d={iceFloorMazeSnowDrift} fill={palette.snow} />
          {iceFloorMazeSnowGrains.map(([x, y]) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={0.02}
              fill={palette.snowGrain}
            />
          ))}
        </>
      );
    case "snow-mound":
      return (
        <>
          <rect
            x={left + shadow}
            y={top + shadow}
            width={size}
            height={size}
            rx={MOUND_ROUNDING}
            fill={palette.shadow}
          />
          <rect
            x={left}
            y={top}
            width={size}
            height={size}
            rx={MOUND_ROUNDING}
            fill={palette.snowShade}
          />
          <rect
            x={left}
            y={top}
            width={size - MOUND_SHADE}
            height={size - MOUND_SHADE}
            rx={MOUND_ROUNDING}
            fill={palette.snow}
          />
        </>
      );
    case "sliding-block":
      return (
        <>
          {renderRaisedShadow()}
          {renderRaisedBlock(
            palette.iceBlock,
            palette.iceBlockLit,
            palette.iceBlockShade,
            ICE_BLOCK_FACE_OPACITY,
          )}
        </>
      );
  }
}

function renderRaisedShadow() {
  return (
    <rect
      x={left + shadow}
      y={top + shadow}
      width={size}
      height={size}
      rx={radius}
      fill={iceFloorMazeTone.shadow}
    />
  );
}

function renderRaisedBlock(
  face: string,
  lit: string,
  shaded: string,
  faceOpacity: number,
) {
  return (
    <>
      <rect
        x={left}
        y={top}
        width={size}
        height={size}
        rx={radius}
        fill={shaded}
      />
      <rect
        x={left}
        y={top}
        width={size - bevel}
        height={size - bevel}
        rx={radius}
        fill={lit}
      />
      <rect
        x={left + bevel}
        y={top + bevel}
        width={size - bevel * 2}
        height={size - bevel * 2}
        rx={radius * 0.6}
        fill={face}
        fillOpacity={faceOpacity}
      />
    </>
  );
}

/** 親が裏返して置くときは `turn` を渡し、裏返した後に陰が上と左へ来るよう、逆の縁に描く。 */
function renderSunken(
  surface: string,
  shaded: string,
  lit: string,
  depth: number,
  turn: { mirrorX: boolean; mirrorY: boolean } = {
    mirrorX: false,
    mirrorY: false,
  },
) {
  const span = 1 - depth - NEAR_EDGE;
  return (
    <>
      <rect width={1} height={1} fill={lit} />
      <rect
        x={turn.mirrorX ? NEAR_EDGE : 0}
        y={turn.mirrorY ? NEAR_EDGE : 0}
        width={1 - NEAR_EDGE}
        height={1 - NEAR_EDGE}
        fill={shaded}
      />
      <rect
        x={turn.mirrorX ? NEAR_EDGE : depth}
        y={turn.mirrorY ? NEAR_EDGE : depth}
        width={span}
        height={span}
        fill={surface}
      />
    </>
  );
}
