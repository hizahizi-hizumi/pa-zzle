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

  const halfWidth = seam.width / 2;
  const start = seam.center - halfWidth;
  const end = seam.center + halfWidth;
  const depth = seam.depth * seam.direction;
  const pStart = transform(side, x, y, size, start, 0);
  const pEnd = transform(side, x, y, size, end, 0);

  path.push(`L ${format(pStart.x)} ${format(pStart.y)}`);

  addCurve(path, side, x, y, size, [
    [start + seam.width * 0.06, 0],
    [start + seam.width * 0.08, depth * 0.2],
    [start + seam.width * 0.22, depth * 0.22],
  ]);
  addCurve(path, side, x, y, size, [
    [start + seam.width * 0.18, depth * 0.82],
    [seam.center - seam.width * 0.12, depth],
    [seam.center, depth],
  ]);
  addCurve(path, side, x, y, size, [
    [seam.center + seam.width * 0.12, depth],
    [end - seam.width * 0.18, depth * 0.82],
    [end - seam.width * 0.22, depth * 0.22],
  ]);
  addCurve(path, side, x, y, size, [
    [end - seam.width * 0.08, depth * 0.2],
    [end - seam.width * 0.06, 0],
    [end, 0],
  ]);

  path.push(`L ${format(pEnd.x)} ${format(pEnd.y)}`);
  const sideEnd = transform(side, x, y, size, 1, 0);
  path.push(`L ${format(sideEnd.x)} ${format(sideEnd.y)}`);
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
