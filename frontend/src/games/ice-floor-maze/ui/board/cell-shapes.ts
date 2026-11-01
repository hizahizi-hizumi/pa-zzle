import type { IceFloorMazePoint } from "@/games/ice-floor-maze/ui/board/board-geometry";

/**
 * マスに載る形。どれもマスの左上を原点とする1マス=1単位の座標で表す。
 * 岩ともろい岩は同じ石の塊（下に影の面）で、もろい岩は上から下まで通る割れ目で2つに分かれる。
 * 薄い氷は氷より一段濃い板に中心から3方向へ折れて伸びる白いひび、水面は上の縁に影（くぼみ）と小さな波。
 */
export const iceFloorMazeRockShape = {
  inset: 0.06,
  width: 0.88,
  height: 0.8,
  shadowDepth: 0.08,
  cornerRadius: 0.18,
} as const;

/** 薄い氷と水面の板。 */
export const iceFloorMazePaneShape = {
  inset: 0.02,
  size: 0.96,
  cornerRadius: 0.06,
} as const;

/** 岩の塊の外接矩形を 0〜1 とした、もろい岩の割れ目で分かれた左右の塊。 */
export const iceFloorMazeBrittleHalfPolygons = [
  [
    [0, 0],
    [0.5, 0],
    [0.4, 0.36],
    [0.56, 0.6],
    [0.38, 1],
    [0, 1],
  ],
  [
    [0.6, 0],
    [1, 0],
    [1, 1],
    [0.48, 1],
    [0.66, 0.6],
    [0.5, 0.36],
  ],
] as const satisfies readonly (readonly (readonly [number, number])[])[];

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

/** 水面の上の縁の影。岩は下に影を付けて出っ張りに、水面は上に影を付けてくぼみに見せる。 */
export function createIceFloorMazeWaterHollowPath(): string {
  const { inset, size } = iceFloorMazePaneShape;
  const right = inset + size;
  return `M${inset} 0.16V0.08q0 -0.06 0.06 -0.06H${right - 0.06}q0.06 0 0.06 0.06V0.16Z`;
}

function createWavePath(x: number, y: number): string {
  return `M${formatPoint(x, y)}q0.075 -0.08 0.15 0t0.15 0`;
}

export function createIceFloorMazeWavePath(): string {
  return createWavePath(0.2, 0.5) + createWavePath(0.5, 0.74);
}

export function formatIceFloorMazePolygon(
  points: readonly (readonly [number, number])[],
): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}
