/**
 * 吹きガラスのフラスコの形。座標は幅 36・高さ 100 の枠（ボトルの縦横比 0.36）で、線はガラスの厚みの中ほどを通る。
 * 4段の液が同じ高さに見えるよう、液の入る胴はどの形も同じ真っすぐな円筒にし、形の違いは肩・首・口で出す。
 */
export const FLASK_VIEW_BOX = "0 0 36 100";

const CENTER_X = 18;
const BODY_HALF_WIDTH = 15;
const BODY_BOTTOM_Y = 96.5;
const BODY_CORNER = 4.5;

/** 液の入る胴の内側（枠に対する割合）。どの形も同じ。 */
export const FLASK_LIQUID_INSET = {
  leftPercent: (3.5 / 36) * 100,
  rightPercent: (3.5 / 36) * 100,
  topPercent: 27,
  bottomPercent: 4.6,
} as const;

type ProfilePoint = readonly [dx: number, y: number];

/** 胴の右の縁（y=90）から口の上の端まで、右半分の輪郭をたどる区間。`c` は3次ベジェの2つの制御点。 */
type ProfileSegment =
  | { to: ProfilePoint }
  | { c: readonly [ProfilePoint, ProfilePoint]; to: ProfilePoint };

type FlaskShapeDefinition = {
  profile: readonly ProfileSegment[];
  /** 首の細いところの半幅。蝋の垂れを首に沿わせる。 */
  neckHalfWidth: number;
  /** 印を下げる高さ。 */
  sealY: number;
  /** ガラスの色味。古いガラスは一本ずつ緑や琥珀に寄る。 */
  tint: string;
  /** ガラスに閉じ込められた小さな気泡。 */
  seeds: readonly ProfilePoint[];
};

export type FlaskShape = {
  outline: string;
  mouth: { y: number; halfWidth: number };
  neckHalfWidth: number;
  sealY: number;
  tint: string;
  seeds: readonly ProfilePoint[];
};

const shapeDefinitions: readonly FlaskShapeDefinition[] = [
  // なで肩に、口が開いた首
  {
    profile: [
      { to: [15, 26] },
      {
        c: [
          [15, 19.5],
          [4.6, 18.5],
        ],
        to: [4.6, 13],
      },
      { to: [4.6, 5] },
      {
        c: [
          [4.6, 3.2],
          [6.4, 2.6],
        ],
        to: [7.2, 2.2],
      },
      { to: [7.2, 0.9] },
    ],
    neckHalfWidth: 4.6,
    sealY: 17,
    tint: "#d6e6cf",
    seeds: [
      [-9, 52],
      [7, 71],
    ],
  },
  // 薬種の壺のような角肩と、巻いた厚い口
  {
    profile: [
      { to: [15, 23.5] },
      {
        c: [
          [15, 17.5],
          [12.5, 16.2],
        ],
        to: [7.8, 15.6],
      },
      { to: [7.6, 9] },
      {
        c: [
          [9.8, 8.8],
          [9.9, 5.2],
        ],
        to: [8.6, 4.6],
      },
      { to: [8.6, 4.2] },
    ],
    neckHalfWidth: 7.6,
    sealY: 19.5,
    tint: "#e8dcbf",
    seeds: [
      [10, 44],
      [-6, 83],
      [-11, 31],
    ],
  },
  // 丸い肩から伸びる、細く長い首
  {
    profile: [
      { to: [15, 27] },
      {
        c: [
          [15, 18.5],
          [3.8, 21.5],
        ],
        to: [3.6, 16],
      },
      { to: [3.6, 3] },
      {
        c: [
          [3.6, 1.9],
          [4.4, 1.6],
        ],
        to: [5.2, 1.5],
      },
      { to: [5.2, 0.6] },
    ],
    neckHalfWidth: 3.6,
    sealY: 20,
    tint: "#d2e1e6",
    seeds: [[-8, 64]],
  },
  // 首の中ほどに輪の飾り
  {
    profile: [
      { to: [15, 25] },
      {
        c: [
          [15, 18.5],
          [5, 18],
        ],
        to: [4.6, 14],
      },
      { to: [4.6, 10.6] },
      {
        c: [
          [6.4, 10.6],
          [6.4, 7.6],
        ],
        to: [4.6, 7.6],
      },
      { to: [4.6, 3.6] },
      {
        c: [
          [4.6, 2.4],
          [5.8, 2],
        ],
        to: [6.6, 1.9],
      },
      { to: [6.6, 0.8] },
    ],
    neckHalfWidth: 4.6,
    sealY: 18,
    tint: "#e2e3d7",
    seeds: [
      [6, 38],
      [-10, 77],
    ],
  },
  // 首に玉をひとつ吹いた、蒸留器のような首
  {
    profile: [
      { to: [15, 25] },
      {
        c: [
          [15, 19.5],
          [4, 19.8],
        ],
        to: [3.8, 16.2],
      },
      {
        c: [
          [3.6, 13.6],
          [7.2, 12.8],
        ],
        to: [7.2, 9.8],
      },
      {
        c: [
          [7.2, 6.8],
          [3.8, 7],
        ],
        to: [3.8, 5],
      },
      { to: [3.8, 2.9] },
      {
        c: [
          [3.8, 1.9],
          [4.8, 1.6],
        ],
        to: [5.6, 1.5],
      },
      { to: [5.6, 0.6] },
    ],
    neckHalfWidth: 3.8,
    sealY: 19.8,
    tint: "#dde6c9",
    seeds: [
      [-7, 46],
      [9, 59],
    ],
  },
  // 面を取った角ばった肩
  {
    profile: [
      { to: [15, 26] },
      { to: [11.2, 20.6] },
      { to: [5.6, 17.2] },
      { to: [5.6, 6.2] },
      { to: [7.4, 5.6] },
      { to: [7.4, 2.4] },
    ],
    neckHalfWidth: 5.6,
    sealY: 20.5,
    tint: "#e6d9c4",
    seeds: [
      [8, 49],
      [-9, 69],
    ],
  },
];

// 隣どうし・上下の段どうしで同じ形が並ばない順。
const shapeOrder = [0, 3, 1, 4, 2, 5] as const;

function formatPoint([dx, y]: ProfilePoint, side: 1 | -1): string {
  return `${round(CENTER_X + side * dx)} ${round(y)}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildOutline(profile: readonly ProfileSegment[]): string {
  const start: ProfilePoint = [BODY_HALF_WIDTH, 90];
  const rightSide = profile
    .map((segment) =>
      "c" in segment
        ? `C ${formatPoint(segment.c[0], 1)} ${formatPoint(segment.c[1], 1)} ${formatPoint(segment.to, 1)}`
        : `L ${formatPoint(segment.to, 1)}`,
    )
    .join(" ");
  const points = [start, ...profile.map((segment) => segment.to)];
  const leftSide = profile
    .map((segment, index) => {
      const from = points[index] ?? start;
      return "c" in segment
        ? `C ${formatPoint(segment.c[1], -1)} ${formatPoint(segment.c[0], -1)} ${formatPoint(from, -1)}`
        : `L ${formatPoint(from, -1)}`;
    })
    .reverse()
    .join(" ");
  const left = CENTER_X - BODY_HALF_WIDTH;
  const right = CENTER_X + BODY_HALF_WIDTH;
  return [
    `M ${formatPoint(start, 1)}`,
    rightSide,
    `L ${formatPoint(points[points.length - 1] ?? start, -1)}`,
    leftSide,
    `L ${left} ${BODY_BOTTOM_Y - BODY_CORNER}`,
    `Q ${left} ${BODY_BOTTOM_Y} ${left + BODY_CORNER} ${BODY_BOTTOM_Y}`,
    `L ${right - BODY_CORNER} ${BODY_BOTTOM_Y}`,
    `Q ${right} ${BODY_BOTTOM_Y} ${right} ${BODY_BOTTOM_Y - BODY_CORNER}`,
    "Z",
  ].join(" ");
}

const flaskShapes: readonly FlaskShape[] = shapeDefinitions.map(
  (definition) => {
    const top = definition.profile[definition.profile.length - 1]?.to ?? [5, 1];
    return {
      outline: buildOutline(definition.profile),
      mouth: { y: top[1], halfWidth: top[0] },
      neckHalfWidth: definition.neckHalfWidth,
      sealY: definition.sealY,
      tint: definition.tint,
      seeds: definition.seeds,
    };
  },
);

export function getFlaskShape(bottleIndex: number): FlaskShape {
  const shapeIndex = shapeOrder[bottleIndex % shapeOrder.length] ?? 0;
  return flaskShapes[shapeIndex] ?? (flaskShapes[0] as FlaskShape);
}

export const FLASK_CENTER_X = CENTER_X;
