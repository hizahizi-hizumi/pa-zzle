/**
 * ピースの1辺にある凸凹。長さはすべて辺の長さを1とした比率で表す。
 * `direction` が 1 のとき、辺を描くピースから外向きに頭が出る。
 */
export type JigsawSeam = {
  center: number;
  depth: number;
  direction: 1 | -1;
};

/**
 * 横に連続したセルを1枚のピースとして囲む辺の凸凹。
 * `top` と `bottom` は左のセルから順に並べる。`null` は平らな辺を表す。
 */
export type JigsawOutlineSeams = {
  top: readonly (JigsawSeam | null)[];
  right: JigsawSeam | null;
  bottom: readonly (JigsawSeam | null)[];
  left: JigsawSeam | null;
};

export type JigsawCellSeams = {
  top: JigsawSeam | null;
  right: JigsawSeam | null;
  bottom: JigsawSeam | null;
  left: JigsawSeam | null;
};

type Side = "top" | "right" | "bottom" | "left";

type Point = {
  x: number;
  y: number;
};

type LocalPoint = {
  u: number;
  v: number;
};

type CellSide = {
  side: Side;
  x: number;
  y: number;
  size: number;
};

const degreesToRadians = Math.PI / 180;
const headRadiusPerDepth = 0.48;
const neckHalfWidthPerHeadRadius = 0.5;
const headAttachDegrees = { start: 222, end: -42 } as const;

export function createJigsawCellPath(
  x: number,
  y: number,
  size: number,
  seams: JigsawCellSeams,
): string {
  return createJigsawOutlinePath(x, y, size, 1, {
    top: [seams.top],
    right: seams.right,
    bottom: [seams.bottom],
    left: seams.left,
  });
}

/** 横に `cellCount` 個並んだセルの外周だけを辿る閉じたパスを作る。 */
export function createJigsawOutlinePath(
  x: number,
  y: number,
  size: number,
  cellCount: number,
  seams: JigsawOutlineSeams,
): string {
  const path = [`M ${format(x)} ${format(y)}`];
  const lastCellX = x + (cellCount - 1) * size;

  for (let index = 0; index < cellCount; index += 1) {
    drawSide(
      path,
      { side: "top", x: x + index * size, y, size },
      seams.top[index] ?? null,
    );
  }
  drawSide(path, { side: "right", x: lastCellX, y, size }, seams.right);
  for (let index = cellCount - 1; index >= 0; index -= 1) {
    drawSide(
      path,
      { side: "bottom", x: x + index * size, y, size },
      seams.bottom[index] ?? null,
    );
  }
  drawSide(path, { side: "left", x, y, size }, seams.left);
  path.push("Z");

  return path.join(" ");
}

/** 凸凹が辺に沿って占める幅の半分。頭の円の半径で、首はこれより細い。 */
export function jigsawSeamHalfWidth(seam: JigsawSeam): number {
  return seam.depth * headRadiusPerDepth;
}

/** 隣接ピースから同じ辺を逆向きに辿るときの凸凹を返す。 */
export function reverseJigsawSeam(seam: JigsawSeam): JigsawSeam {
  return {
    center: 1 - seam.center,
    depth: seam.depth,
    direction: seam.direction === 1 ? -1 : 1,
  };
}

function drawSide(path: string[], cellSide: CellSide, seam: JigsawSeam | null) {
  if (!seam) {
    lineTo(path, cellSide, { u: 1, v: 0 });
    return;
  }

  // 頭の円が辺の基線をまたがないよう、円の中心を基線から半径以上離し、首は頭より細く絞る。
  const headRadius = jigsawSeamHalfWidth(seam);
  const headCenter = { u: seam.center, v: seam.depth - headRadius };
  const neckHalfWidth = headRadius * neckHalfWidthPerHeadRadius;
  const direction = seam.direction;
  const neckStart = seam.center - neckHalfWidth;
  const neckEnd = seam.center + neckHalfWidth;
  const headStart = circlePoint(
    headCenter,
    headRadius,
    headAttachDegrees.start,
  );
  const headEnd = circlePoint(headCenter, headRadius, headAttachDegrees.end);
  const neckFlare = seam.depth * 0.05;

  lineTo(path, cellSide, { u: neckStart - neckFlare, v: 0 });
  curveTo(path, cellSide, direction, [
    { u: neckStart + neckFlare * 0.4, v: 0 },
    { u: headStart.u + headRadius * 0.34, v: headStart.v - headRadius * 0.34 },
    headStart,
  ]);
  arcTo(
    path,
    cellSide,
    direction,
    headCenter,
    headRadius,
    headAttachDegrees.start,
    90,
  );
  arcTo(path, cellSide, direction, headCenter, headRadius, 90, -42);
  curveTo(path, cellSide, direction, [
    { u: headEnd.u - headRadius * 0.34, v: headEnd.v - headRadius * 0.34 },
    { u: neckEnd - neckFlare * 0.4, v: 0 },
    { u: neckEnd + neckFlare, v: 0 },
  ]);
  lineTo(path, cellSide, { u: 1, v: 0 });
}

function circlePoint(
  center: LocalPoint,
  radius: number,
  angleDegrees: number,
): LocalPoint {
  const angle = angleDegrees * degreesToRadians;
  return {
    u: center.u + Math.cos(angle) * radius,
    v: center.v + Math.sin(angle) * radius,
  };
}

function arcTo(
  path: string[],
  cellSide: CellSide,
  direction: 1 | -1,
  center: LocalPoint,
  radius: number,
  startDegrees: number,
  endDegrees: number,
) {
  // 90度以下の円弧は3次ベジェで十分近似できるため、角度を分割して描く。
  const segmentCount = Math.ceil(Math.abs(endDegrees - startDegrees) / 90);
  const stepDegrees = (endDegrees - startDegrees) / segmentCount;

  for (let index = 0; index < segmentCount; index += 1) {
    const fromDegrees = startDegrees + stepDegrees * index;
    const toDegrees = fromDegrees + stepDegrees;
    const fromAngle = fromDegrees * degreesToRadians;
    const toAngle = toDegrees * degreesToRadians;
    const handleLength = (4 / 3) * Math.tan((toAngle - fromAngle) / 4) * radius;

    curveTo(path, cellSide, direction, [
      {
        u:
          center.u +
          Math.cos(fromAngle) * radius -
          Math.sin(fromAngle) * handleLength,
        v:
          center.v +
          Math.sin(fromAngle) * radius +
          Math.cos(fromAngle) * handleLength,
      },
      {
        u:
          center.u +
          Math.cos(toAngle) * radius +
          Math.sin(toAngle) * handleLength,
        v:
          center.v +
          Math.sin(toAngle) * radius -
          Math.cos(toAngle) * handleLength,
      },
      circlePoint(center, radius, toDegrees),
    ]);
  }
}

function lineTo(path: string[], cellSide: CellSide, point: LocalPoint) {
  const end = toBoardPoint(cellSide, point);
  path.push(`L ${format(end.x)} ${format(end.y)}`);
}

function curveTo(
  path: string[],
  cellSide: CellSide,
  direction: 1 | -1,
  points: readonly [LocalPoint, LocalPoint, LocalPoint],
) {
  const [control1, control2, end] = points.map((point) =>
    toBoardPoint(cellSide, { u: point.u, v: point.v * direction }),
  ) as [Point, Point, Point];

  path.push(
    `C ${format(control1.x)} ${format(control1.y)} ${format(control2.x)} ${format(control2.y)} ${format(end.x)} ${format(end.y)}`,
  );
}

function toBoardPoint(
  { side, x, y, size }: CellSide,
  { u, v }: LocalPoint,
): Point {
  // u は辺を時計回りに辿る向き、v は全辺でピースの外向きを正にする。
  // 隣接ピースは反転した seam で同じ曲線を逆向きに描く。
  if (side === "top") {
    return { x: x + u * size, y: y - v * size };
  }
  if (side === "right") {
    return { x: x + size + v * size, y: y + u * size };
  }
  if (side === "bottom") {
    return { x: x + size - u * size, y: y + size + v * size };
  }
  return { x: x - v * size, y: y + size - u * size };
}

function format(value: number): string {
  return value.toFixed(2);
}
