export type WholePageJigsawSeam = {
  center: number;
  depth: number;
  direction: 1 | -1;
  width: number;
};

type Side = "top" | "right" | "bottom" | "left";

type PieceSeams = {
  top: WholePageJigsawSeam | null;
  right: WholePageJigsawSeam | null;
  bottom: WholePageJigsawSeam | null;
  left: WholePageJigsawSeam | null;
};

type Point = {
  x: number;
  y: number;
};

type LocalPoint = {
  u: number;
  v: number;
};

const degreesToRadians = Math.PI / 180;

export function createWholePageJigsawPiecePath(
  x: number,
  y: number,
  size: number,
  seams: PieceSeams,
): string {
  const path = [`M ${format(x)} ${format(y)}`];

  drawSide(path, "top", x, y, size, seams.top);
  drawSide(path, "right", x, y, size, seams.right);
  drawSide(path, "bottom", x, y, size, seams.bottom);
  drawSide(path, "left", x, y, size, seams.left);
  path.push("Z");

  return path.join(" ");
}

export function reverseWholePageJigsawSeam(
  seam: WholePageJigsawSeam,
): WholePageJigsawSeam {
  return {
    center: 1 - seam.center,
    depth: seam.depth,
    direction: seam.direction === 1 ? -1 : 1,
    width: seam.width,
  };
}

function drawSide(
  path: string[],
  side: Side,
  x: number,
  y: number,
  size: number,
  seam: WholePageJigsawSeam | null,
) {
  if (!seam) {
    const end = transform(side, x, y, size, 1, 0);
    path.push(`L ${format(end.x)} ${format(end.y)}`);
    return;
  }

  const headRadius = Math.min(seam.depth * 0.56, seam.width * 0.47);
  const neckHalfWidth = headRadius * 0.22;
  const circleCenterV = seam.depth - headRadius;
  const neckStart = seam.center - neckHalfWidth;
  const neckEnd = seam.center + neckHalfWidth;
  const direction = seam.direction;
  const circleStart = circlePoint(
    seam.center,
    circleCenterV,
    headRadius,
    220,
    direction,
  );
  const circleEnd = circlePoint(
    seam.center,
    circleCenterV,
    headRadius,
    -40,
    direction,
  );
  const pStart = transform(side, x, y, size, neckStart, 0);

  path.push(`L ${format(pStart.x)} ${format(pStart.y)}`);

  addCurve(path, side, x, y, size, [
    [neckStart, seam.depth * 0.035 * direction],
    [
      circleStart.u + headRadius * 0.26,
      circleStart.v - headRadius * 0.08 * direction,
    ],
    [circleStart.u, circleStart.v],
  ]);

  addCircularArc(
    path,
    side,
    x,
    y,
    size,
    seam.center,
    circleCenterV,
    headRadius,
    220,
    180,
    direction,
  );
  addCircularArc(
    path,
    side,
    x,
    y,
    size,
    seam.center,
    circleCenterV,
    headRadius,
    180,
    90,
    direction,
  );
  addCircularArc(
    path,
    side,
    x,
    y,
    size,
    seam.center,
    circleCenterV,
    headRadius,
    90,
    0,
    direction,
  );
  addCircularArc(
    path,
    side,
    x,
    y,
    size,
    seam.center,
    circleCenterV,
    headRadius,
    0,
    -40,
    direction,
  );

  addCurve(path, side, x, y, size, [
    [
      circleEnd.u - headRadius * 0.26,
      circleEnd.v - headRadius * 0.08 * direction,
    ],
    [neckEnd, seam.depth * 0.035 * direction],
    [neckEnd, 0],
  ]);

  const sideEnd = transform(side, x, y, size, 1, 0);
  path.push(`L ${format(sideEnd.x)} ${format(sideEnd.y)}`);
}

function circlePoint(
  centerU: number,
  centerV: number,
  radius: number,
  angleDegrees: number,
  direction: 1 | -1,
): LocalPoint {
  const angle = angleDegrees * degreesToRadians;
  return {
    u: centerU + Math.cos(angle) * radius,
    v: (centerV + Math.sin(angle) * radius) * direction,
  };
}

function addCircularArc(
  path: string[],
  side: Side,
  x: number,
  y: number,
  size: number,
  centerU: number,
  centerV: number,
  radius: number,
  startDegrees: number,
  endDegrees: number,
  direction: 1 | -1,
) {
  const startAngle = startDegrees * degreesToRadians;
  const endAngle = endDegrees * degreesToRadians;
  const delta = endAngle - startAngle;
  const controlScale = (4 / 3) * Math.tan(delta / 4) * radius;
  const endPoint = circlePoint(centerU, centerV, radius, endDegrees, direction);
  const control1: LocalPoint = {
    u:
      centerU +
      Math.cos(startAngle) * radius -
      Math.sin(startAngle) * controlScale,
    v:
      (centerV +
        Math.sin(startAngle) * radius +
        Math.cos(startAngle) * controlScale) *
      direction,
  };
  const control2: LocalPoint = {
    u:
      centerU + Math.cos(endAngle) * radius + Math.sin(endAngle) * controlScale,
    v:
      (centerV +
        Math.sin(endAngle) * radius -
        Math.cos(endAngle) * controlScale) *
      direction,
  };

  addCurve(path, side, x, y, size, [
    [control1.u, control1.v],
    [control2.u, control2.v],
    [endPoint.u, endPoint.v],
  ]);
}

function addCurve(
  path: string[],
  side: Side,
  x: number,
  y: number,
  size: number,
  normalizedPoints: [[number, number], [number, number], [number, number]],
) {
  const [control1Normalized, control2Normalized, endNormalized] =
    normalizedPoints;
  const control1 = transform(
    side,
    x,
    y,
    size,
    control1Normalized[0],
    control1Normalized[1],
  );
  const control2 = transform(
    side,
    x,
    y,
    size,
    control2Normalized[0],
    control2Normalized[1],
  );
  const end = transform(side, x, y, size, endNormalized[0], endNormalized[1]);

  path.push(
    `C ${format(control1.x)} ${format(control1.y)} ${format(control2.x)} ${format(control2.y)} ${format(end.x)} ${format(end.y)}`,
  );
}

function transform(
  side: Side,
  x: number,
  y: number,
  size: number,
  u: number,
  v: number,
): Point {
  if (side === "top") {
    return { x: x + u * size, y: y + v * size };
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
