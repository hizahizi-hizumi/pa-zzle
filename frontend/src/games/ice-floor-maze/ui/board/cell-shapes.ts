import type { IceFloorMazePoint } from "@/games/ice-floor-maze/ui/board/board-geometry";
import { roundIceFloorMazeCoordinate } from "@/games/ice-floor-maze/ui/board/path-coordinate";

/**
 * マスに載る形。どれもマスの左上を原点とする1マス=1単位の座標で表す。
 * 盤面は真上から見た絵で、光は左上から当たる。形ごとの高さの読ませ方は `IceFloorMazeCellFace` に書く。
 */

/** 崩れるときに、左右の塊がそれぞれ傾く向き。 */
export const iceFloorMazeBrittleHalfSides = [-1, 1] as const;

const crackCenter = [0.44, 0.54] as const;

/** ひびの3本。中心から折れ目 `knee` へ進み、板の縁 `edge` へ向かって `reach` の割合だけ伸びる。 */
const crackBranches = [
  { knee: [0.6, 0.3], edge: [0.76, 0], reach: 0.6 },
  { knee: [0.7, 0.72], edge: [1, 0.84], reach: 0.35 },
  { knee: [0.22, 0.44], edge: [0, 0.3], reach: 0.45 },
] as const;

/** ひびとひびの間にある板の角。破片の外形に含める。 */
const cornersBetweenBranches = [
  [[1, 0]],
  [
    [1, 1],
    [0, 1],
  ],
  [[0, 0]],
] as const;

/** 板の外接矩形を 0〜1 とした、ひびの線で分かれた3つの破片。 */
export const iceFloorMazeThinIceShardPolygons = crackBranches.map(
  (branch, index) => {
    const next = crackBranches[(index + 1) % crackBranches.length]!;
    return [
      crackCenter,
      branch.knee,
      branch.edge,
      ...cornersBetweenBranches[index]!,
      next.edge,
      next.knee,
    ];
  },
);

/** 割れるときに、各破片が沈みながら離れる向き。 */
export const iceFloorMazeThinIceShardDirections = [
  { x: 0.8, y: -0.4 },
  { x: 0, y: 1 },
  { x: -0.6, y: -0.6 },
] as const satisfies readonly IceFloorMazePoint[];

function formatPoint(x: number, y: number): string {
  return `${Math.round(x * 1000) / 1000} ${Math.round(y * 1000) / 1000}`;
}

export function createIceFloorMazeCrackPath(): string {
  return crackBranches
    .map(({ knee, edge, reach }) => {
      const endX = knee[0] + reach * (edge[0] - knee[0]);
      const endY = knee[1] + reach * (edge[1] - knee[1]);
      return `M${formatPoint(crackCenter[0], crackCenter[1])}L${formatPoint(knee[0], knee[1])}L${formatPoint(endX, endY)}`;
    })
    .join("");
}

export function formatIceFloorMazePolygon(
  points: readonly (readonly [number, number])[],
): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

type Point = readonly [number, number];

function mid(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** 点を順に丸くつないだ閉じた形。各点を制御点に、辺の中点を通る。 */
function createIceFloorMazeBlobPath(points: readonly Point[]): string {
  const last = points[points.length - 1]!;
  const start = mid(last, points[0]!);
  const segments = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!;
    const end = mid(point, next);
    return `Q${roundIceFloorMazeCoordinate(point[0])} ${roundIceFloorMazeCoordinate(point[1])} ${roundIceFloorMazeCoordinate(end[0])} ${roundIceFloorMazeCoordinate(end[1])}`;
  });
  return `M${roundIceFloorMazeCoordinate(start[0])} ${roundIceFloorMazeCoordinate(start[1])}${segments.join("")}Z`;
}

/** 崩れた跡の石くず。影を落とさない低いかけら。 */
export const iceFloorMazeRubbleChips: readonly string[] = [
  createIceFloorMazeBlobPath([
    [0.18, 0.24],
    [0.38, 0.18],
    [0.44, 0.34],
    [0.24, 0.42],
  ]),
  createIceFloorMazeBlobPath([
    [0.58, 0.2],
    [0.78, 0.22],
    [0.76, 0.4],
    [0.58, 0.36],
  ]),
  createIceFloorMazeBlobPath([
    [0.4, 0.5],
    [0.6, 0.46],
    [0.64, 0.64],
    [0.42, 0.68],
  ]),
  createIceFloorMazeBlobPath([
    [0.14, 0.64],
    [0.3, 0.6],
    [0.34, 0.78],
    [0.16, 0.82],
  ]),
  createIceFloorMazeBlobPath([
    [0.68, 0.64],
    [0.86, 0.66],
    [0.82, 0.82],
    [0.66, 0.8],
  ]),
];

/** 押し出せる雪。高さの無い、ふちの柔らかい吹きだまり。 */
export const iceFloorMazeSnowDrift = createIceFloorMazeBlobPath([
  [0.14, 0.2],
  [0.5, 0.08],
  [0.86, 0.18],
  [0.94, 0.5],
  [0.84, 0.84],
  [0.5, 0.94],
  [0.16, 0.86],
  [0.06, 0.52],
]);
/** 雪の粒。高さの無いざらついた面だと読ませる、小さな点。`[x, y]`。 */
export const iceFloorMazeSnowGrains = [
  [0.3, 0.28],
  [0.52, 0.22],
  [0.72, 0.34],
  [0.22, 0.5],
  [0.44, 0.46],
  [0.64, 0.54],
  [0.8, 0.6],
  [0.3, 0.7],
  [0.52, 0.76],
  [0.7, 0.8],
] as const;

/**
 * 氷から立ち上がるものの、真上から見た形の約束。1マスの塊（もろい岩・滑る氷の塊）の位置と大きさ・角の丸みと、
 * 岩場と共通の、縁の明暗の幅（`bevel`）・右下へ落とす影のずれ（`shadow`）。
 * 光は左上から当たり、上と左の縁が明るく、下と右の縁が暗い。手前の側面は描かない。
 */
export const ICE_FLOOR_MAZE_RAISED = {
  left: 0.06,
  top: 0.06,
  size: 0.88,
  radius: 0.1,
  bevel: 0.07,
  shadow: 0.09,
} as const;

/** 水面のさざ波。氷ではなく水だと読ませる、2本の短い波。沈んだ面の中に収める。 */
export const iceFloorMazeWaves =
  "M0.3 0.46q0.07 -0.07 0.14 0t0.14 0M0.48 0.7q0.07 -0.07 0.14 0t0.14 0";
