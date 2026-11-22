/**
 * 縁側に集めた空き瓶の形。座標はボトルの枠（幅36・高さ100）の中の値。
 * どの瓶も胴は同じ太さのまっすぐな筒で、色水の入る所（`SUMMER_LIQUID_BOX`）は同じ位置と高さにそろえ、4段が同じ高さに見えるようにする。
 * 形の違いは、色水より上の肩・首・口と、ガラスの色味で出す。
 */
export type SummerBottleShapeId = "ramune" | "milk" | "cider" | "jam" | "vial";

export type SummerBottleShape = {
  id: SummerBottleShapeId;
  /** 瓶の外形（閉じた輪郭）。 */
  outline: string;
  /** ガラスの色味。 */
  glass: string;
  /** ガラスの縁の色。 */
  edge: string;
  /** 肩に入れる光の筋。 */
  shoulderGlint: string;
};

export const SUMMER_BOTTLE_VIEW_BOX = { width: 36, height: 100 } as const;

/** 色水の入る所。上端は胴の始まり（肩の下）、下端は厚い底ガラスの上。 */
export const SUMMER_LIQUID_BOX = {
  left: 3.6,
  right: 32.4,
  top: 27,
  bottom: 96.4,
  cornerRadius: 3.8,
} as const;

type Point = readonly [number, number];
type Segment =
  | { type: "L"; to: Point }
  | { type: "C"; c1: Point; c2: Point; to: Point };

const CENTER_X = SUMMER_BOTTLE_VIEW_BOX.width / 2;

function line(x: number, y: number): Segment {
  return { type: "L", to: [x, y] };
}

function curve(
  c1x: number,
  c1y: number,
  c2x: number,
  c2y: number,
  x: number,
  y: number,
): Segment {
  return { type: "C", c1: [c1x, c1y], c2: [c2x, c2y], to: [x, y] };
}

// 胴は肩の下（y=27）から底まで、どの瓶も同じ。
const bodySegments: readonly Segment[] = [
  line(34, 94.4),
  curve(34, 97.6, 32.6, 99.4, 29.4, 99.4),
  line(CENTER_X, 99.4),
];

function mirror([x, y]: Point): Point {
  return [SUMMER_BOTTLE_VIEW_BOX.width - x, y];
}

function format([x, y]: Point): string {
  return `${Number(x.toFixed(2))} ${Number(y.toFixed(2))}`;
}

/** 右半分の輪郭（上の中心から下の中心まで）を左右に写して、閉じた外形にする。 */
function symmetricOutline(topY: number, rightSide: readonly Segment[]): string {
  const segments = [...rightSide, ...bodySegments];
  const right = segments
    .map((segment) =>
      segment.type === "L"
        ? `L ${format(segment.to)}`
        : `C ${format(segment.c1)} ${format(segment.c2)} ${format(segment.to)}`,
    )
    .join(" ");

  const starts: Point[] = [
    [CENTER_X, topY],
    ...segments.slice(0, -1).map((segment) => segment.to),
  ];
  const left = segments
    .map((segment, index) => ({ segment, start: starts[index] ?? segment.to }))
    .reverse()
    .map(({ segment, start }) =>
      segment.type === "L"
        ? `L ${format(mirror(start))}`
        : `C ${format(mirror(segment.c2))} ${format(mirror(segment.c1))} ${format(mirror(start))}`,
    )
    .join(" ");

  return `M ${format([CENTER_X, topY])} ${right} ${left} Z`;
}

const shapes: Record<SummerBottleShapeId, SummerBottleShape> = {
  // ラムネ瓶: くびれた首にビー玉を抱える。
  ramune: {
    id: "ramune",
    outline: symmetricOutline(0.8, [
      line(22.6, 0.8),
      curve(24, 0.8, 24, 4.2, 22.6, 4.2),
      line(21.6, 4.8),
      curve(20.9, 5.6, 21, 6.4, 22.2, 7.3),
      curve(25.6, 9.3, 25.6, 13.6, 22.4, 15.4),
      curve(21.4, 16.1, 21.3, 17.2, 22.2, 18.2),
      curve(26.5, 20.4, 34, 21.2, 34, 27),
    ]),
    glass: "#8fd6d0",
    edge: "#4f9e9a",
    shoulderGlint: "M 25.6 20.6 C 29.4 21.8 31.6 23.4 32 26",
  },
  // 牛乳瓶: 口が広く、ふちが厚い。
  milk: {
    id: "milk",
    outline: symmetricOutline(0.6, [
      line(30.2, 0.6),
      curve(32, 0.6, 32, 6.2, 30.2, 6.2),
      line(29.3, 6.8),
      curve(29.3, 13, 34, 16, 34, 27),
    ]),
    glass: "#dce9ee",
    edge: "#8aa3ad",
    shoulderGlint: "M 30.2 9.6 C 31.8 13 32.8 17 32.8 23",
  },
  // サイダーの緑の瓶: 細く長い首。
  cider: {
    id: "cider",
    outline: symmetricOutline(0.8, [
      line(22.4, 0.8),
      curve(23.6, 0.8, 23.6, 4.6, 22.4, 4.6),
      line(21.4, 5.1),
      line(21.4, 11.6),
      curve(21.4, 17.4, 34, 18.6, 34, 27),
    ]),
    glass: "#a6d99a",
    edge: "#5f9a58",
    shoulderGlint: "M 24.6 16.4 C 29 17.6 31.8 20 32.4 24.6",
  },
  // ジャムの空き瓶: 短い肩と、ふたのねじ山。
  jam: {
    id: "jam",
    outline: symmetricOutline(2, [
      line(29.4, 2),
      line(29.4, 9.4),
      curve(29.4, 10.8, 30.4, 11.2, 31.8, 11.6),
      curve(33.4, 12.1, 34, 13.6, 34, 16),
      line(34, 27),
    ]),
    glass: "#efe5d2",
    edge: "#a8977a",
    shoulderGlint: "M 31.4 12.8 C 32.4 13.4 32.8 14.6 32.8 17",
  },
  // 薬の小瓶: とがった肩と短い首、琥珀がかったガラス。
  vial: {
    id: "vial",
    outline: symmetricOutline(0.6, [
      line(23.6, 0.6),
      curve(25, 0.6, 25, 3.8, 23.6, 3.8),
      line(22.2, 4.3),
      line(22.2, 8.8),
      line(34, 21.6),
      line(34, 27),
    ]),
    glass: "#f0cf8e",
    edge: "#b2843a",
    shoulderGlint: "M 24.4 11.6 L 31.6 19.4",
  },
};

// 隣どうし、上下の段どうし（1段の本数が3〜7本のどれでも）で同じ形が並ばない並び。
const shapeOrder: readonly SummerBottleShapeId[] = [
  "ramune",
  "cider",
  "vial",
  "milk",
  "vial",
  "jam",
  "milk",
  "jam",
  "ramune",
  "cider",
  "jam",
  "ramune",
  "cider",
  "jam",
];

const shapeCycle: readonly SummerBottleShapeId[] = [
  "ramune",
  "milk",
  "cider",
  "jam",
  "vial",
];

export function getSummerBottleShape(bottleIndex: number): SummerBottleShape {
  const id =
    shapeOrder[bottleIndex] ??
    shapeCycle[bottleIndex % shapeCycle.length] ??
    "ramune";
  return shapes[id];
}
