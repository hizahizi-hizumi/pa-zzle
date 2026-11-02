import type { IceFloorMazePoint } from "@/games/ice-floor-maze/ui/board/board-geometry";

/**
 * マスに載る形。どれもマスの左上を原点とする1マス=1単位の座標で表す。
 * 岩ともろい岩は同じ形の石の塊（下に影の面）で、もろい岩は上から下まで通る割れ目で2つに分かれ、角が欠ける。
 * 崩れたもろい岩の跡は、氷の上に散らばった平らな石くず（影の無い小さなかけら）。
 * 薄い氷は氷より一段濃い板に中心から3方向へ折れて伸びる白いひび、水面は上の縁に影（くぼみ）と小さな波。
 * 床は薄い氷と同じ板に、さいころの5の目に並べた点（ざらついた、滑らない面）。
 * 雪は縁が波打つ平らな白い面（影が無く、上に載っているだけ）。雪山は下に影を付けた盛り上がった白い山で、岩と同じくぶつかる物と読ませる。
 * 滑る氷の塊は岩と同じ大きさ・同じ影の塊で、角を岩より小さく丸め、上の面に光の筋と下寄りの面の線を引いて氷の塊と読ませる。
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

/** 床の板に置く点の中心と半径。320px 幅の 12×14（1マス約24px）でも点が潰れない大きさにする。 */
export const iceFloorMazeFloorDots = {
  centers: [
    { x: 0.28, y: 0.28 },
    { x: 0.72, y: 0.28 },
    { x: 0.5, y: 0.5 },
    { x: 0.28, y: 0.72 },
    { x: 0.72, y: 0.72 },
  ],
  radius: 0.075,
} as const satisfies { centers: readonly IceFloorMazePoint[]; radius: number };

/**
 * 岩の塊の外接矩形を 0〜1 とした、もろい岩の割れ目で分かれた左右の塊。割れ目の幅を広くとり、左上と右下の角を欠いて、
 * 小さなマスでも角の丸い岩の塊と輪郭で見分けられるようにする。
 */
export const iceFloorMazeBrittleHalfPolygons = [
  [
    [0, 0.26],
    [0.22, 0],
    [0.46, 0],
    [0.36, 0.36],
    [0.52, 0.6],
    [0.34, 1],
    [0, 1],
  ],
  [
    [0.64, 0],
    [1, 0],
    [1, 0.72],
    [0.76, 1],
    [0.52, 1],
    [0.7, 0.6],
    [0.54, 0.36],
  ],
] as const satisfies readonly (readonly (readonly [number, number])[])[];

/** 崩れたもろい岩の跡に散らばる石くずのかけら。マスの左上を原点とする座標。 */
export const iceFloorMazeRubbleChipPolygons = [
  [
    [0.2, 0.24],
    [0.38, 0.2],
    [0.42, 0.34],
    [0.26, 0.4],
  ],
  [
    [0.6, 0.2],
    [0.76, 0.24],
    [0.72, 0.38],
    [0.58, 0.34],
  ],
  [
    [0.4, 0.5],
    [0.58, 0.48],
    [0.6, 0.64],
    [0.42, 0.66],
  ],
  [
    [0.16, 0.66],
    [0.3, 0.62],
    [0.32, 0.78],
    [0.18, 0.8],
  ],
  [
    [0.68, 0.64],
    [0.84, 0.66],
    [0.8, 0.8],
    [0.66, 0.78],
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

/** 雪の縁の波の数と大きさ。辺ごとに `scallopsPerSide` 個の弧を外へふくらませる。 */
const snowPatch = {
  inset: 0.08,
  scallopsPerSide: 3,
  scallopRadius: 0.2,
} as const;

/** 雪の面に置く、雪の粒の影の点。 */
export const iceFloorMazeSnowDots = {
  centers: [
    { x: 0.3, y: 0.32 },
    { x: 0.68, y: 0.62 },
  ],
  radius: 0.045,
} as const satisfies { centers: readonly IceFloorMazePoint[]; radius: number };

/** 縁が波打つ平らな雪。四隅を結ぶ辺を、同じ大きさの弧でつないで描く。 */
export function createIceFloorMazeSnowPatchPath(): string {
  const { inset, scallopsPerSide, scallopRadius } = snowPatch;
  const far = 1 - inset;
  const step = (far - inset) / scallopsPerSide;
  const arcTo = (x: number, y: number) =>
    `A${scallopRadius} ${scallopRadius} 0 0 1 ${formatPoint(x, y)}`;
  const offsets = Array.from(
    { length: scallopsPerSide },
    (_, index) => step * (index + 1),
  );
  return [
    `M${formatPoint(inset, inset)}`,
    ...offsets.map((offset) => arcTo(inset + offset, inset)),
    ...offsets.map((offset) => arcTo(far, inset + offset)),
    ...offsets.map((offset) => arcTo(far - offset, far)),
    ...offsets.map((offset) => arcTo(inset, far - offset)),
    "Z",
  ].join("");
}

/** 雪山の影を落とす深さ。岩の影と同じ。 */
export const ICE_FLOOR_MAZE_SNOW_MOUND_SHADOW_DEPTH = 0.08;

/** 雪山。左の低い肩から右の高い頂へ盛り上がる、底の平らな山。 */
export const iceFloorMazeSnowMoundPath =
  "M0.1 0.84C0.08 0.52 0.3 0.36 0.44 0.44C0.52 0.22 0.84 0.24 0.86 0.52C0.95 0.6 0.94 0.8 0.9 0.84Z";

/** 滑る氷の塊。外形と影は岩と同じ大きさで、角の丸みだけを小さくする。 */
export const iceFloorMazeSlidingBlockShape = {
  ...iceFloorMazeRockShape,
  cornerRadius: 0.14,
} as const;

/** 滑る氷の塊の上の面の光の筋（左上の角に沿う線と、斜めの短い線）と、下寄りの面の線。 */
export const iceFloorMazeSlidingBlockGlintPath =
  "M0.2 0.5V0.24Q0.2 0.2 0.24 0.2H0.52M0.66 0.3L0.4 0.56";
export const iceFloorMazeSlidingBlockEdgePath = "M0.24 0.74H0.76";
