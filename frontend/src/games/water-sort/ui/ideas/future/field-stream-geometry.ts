type Point = { x: number; y: number };

export type FieldStreamRoute = {
  sourceSurface: Point;
  sourceMouth: Point;
  destinationMouth: Point;
  destinationSurface: Point;
  cellWidth: number;
  cellHeight: number;
  /** 真上・真下へ渡すとき、脇を回る向きを決める画面の中央。 */
  viewportCenterX: number;
};

export type FieldStreamShape = {
  /** 流れの外形。縁の沈んだ色で塗る。 */
  outer: string;
  /** 流れの中の、液の色そのものの帯。 */
  inner: string;
  core: string;
  head: Point & { radius: number };
} | null;

/** 流れの幅に対する、中の帯の幅。 */
const INNER_WIDTH_RATIO = 0.58;

const BEZIER_SAMPLES = 36;
const OUTLINE_SAMPLES = 40;

/** 注ぎ元の液面から口へ上がり、宙を弧で渡って、注ぎ先の口から液面へ落ちる道筋。 */
function buildRoute(route: FieldStreamRoute): Point[] {
  const { sourceSurface, sourceMouth, destinationMouth, destinationSurface } =
    route;
  const [first, second] = getArcControls(route);
  const points: Point[] = [sourceSurface, sourceMouth];
  for (let index = 1; index < BEZIER_SAMPLES; index += 1) {
    const t = index / BEZIER_SAMPLES;
    const inverse = 1 - t;
    const a = inverse ** 3;
    const b = 3 * inverse * inverse * t;
    const c = 3 * inverse * t * t;
    const d = t ** 3;
    points.push({
      x:
        a * sourceMouth.x + b * first.x + c * second.x + d * destinationMouth.x,
      y:
        a * sourceMouth.y + b * first.y + c * second.y + d * destinationMouth.y,
    });
  }
  points.push(destinationMouth, destinationSurface);
  return points;
}

/**
 * 宙の弧の制御点。同じ段どうしは両方の口の上を越える。段が違うときは、上の段の管を貫かないよう、
 * 真上・真下に近ければ管の脇を回り、下の口には上から入る。
 */
function getArcControls({
  sourceMouth,
  destinationMouth,
  cellWidth,
  cellHeight,
  viewportCenterX,
}: FieldStreamRoute): [Point, Point] {
  const dx = destinationMouth.x - sourceMouth.x;
  const dy = destinationMouth.y - sourceMouth.y;
  if (Math.abs(dy) < cellHeight * 0.5) {
    const lift =
      Math.min(
        cellHeight * 0.32,
        Math.max(cellHeight * 0.16, Math.abs(dx) * 0.3),
      ) / 0.75;
    const top = Math.min(sourceMouth.y, destinationMouth.y) - lift;
    return [
      { x: sourceMouth.x + dx * 0.2, y: top },
      { x: destinationMouth.x - dx * 0.2, y: top },
    ];
  }
  const towardCenter = sourceMouth.x > viewportCenterX ? -1 : 1;
  const direction =
    Math.abs(dx) < cellWidth * 0.3 ? towardCenter : Math.sign(dx);
  const side = Math.abs(dx) < cellWidth * 1.2 ? direction * cellWidth * 1.3 : 0;
  if (dy > 0) {
    return [
      {
        x: sourceMouth.x + dx * 0.3 + side,
        y: sourceMouth.y - cellHeight * 0.22,
      },
      {
        x: destinationMouth.x - dx * 0.1 + side * 0.7,
        y: destinationMouth.y - cellHeight * 0.3,
      },
    ];
  }
  return [
    {
      x: sourceMouth.x + dx * 0.1 + side * 0.7,
      y: sourceMouth.y - cellHeight * 0.3,
    },
    {
      x: destinationMouth.x - dx * 0.3 + side,
      y: destinationMouth.y - cellHeight * 0.22,
    },
  ];
}

function createSampler(points: readonly Point[]) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as Point;
    const current = points[index] as Point;
    lengths.push(
      (lengths[index - 1] as number) +
        Math.hypot(current.x - previous.x, current.y - previous.y),
    );
  }
  const total = lengths[lengths.length - 1] || 1;

  return function sample(position: number): Point & { angle: number } {
    const target = Math.min(1, Math.max(0, position)) * total;
    let index = 1;
    while (index < lengths.length - 1 && (lengths[index] as number) < target) {
      index += 1;
    }
    const start = points[index - 1] as Point;
    const end = points[index] as Point;
    const segmentStart = lengths[index - 1] as number;
    const segmentLength = (lengths[index] as number) - segmentStart || 1;
    const ratio = (target - segmentStart) / segmentLength;
    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
      angle: Math.atan2(end.y - start.y, end.x - start.x),
    };
  };
}

/**
 * 流れの形。末尾は細く、先端は重みで膨らむ。流れの中を脈が先へ送られていくように太さを波打たせ、
 * 宙を渡っていても液体の重さが残るようにする。
 */
export function getFieldStreamShape(
  route: FieldStreamRoute,
  tail: number,
  head: number,
  width: number,
  phase: number,
): FieldStreamShape {
  if (head - tail <= 0.001) {
    return null;
  }
  const sample = createSampler(buildRoute(route));
  const left: string[] = [];
  const right: string[] = [];
  const innerLeft: string[] = [];
  const innerRight: string[] = [];
  const core: string[] = [];
  for (let index = 0; index <= OUTLINE_SAMPLES; index += 1) {
    const u = index / OUTLINE_SAMPLES;
    const point = sample(tail + (head - tail) * u);
    const taper = 0.42 + 0.58 * Math.sin((Math.PI / 2) * Math.min(1, u * 1.6));
    const pulse = 1 + 0.14 * Math.sin(2 * Math.PI * (u * 2.6 - phase * 3.2));
    const half = (width / 2) * taper * pulse;
    const normalX = -Math.sin(point.angle);
    const normalY = Math.cos(point.angle);
    left.push(formatOffset(point, normalX, normalY, half));
    right.push(formatOffset(point, normalX, normalY, -half));
    innerLeft.push(
      formatOffset(point, normalX, normalY, half * INNER_WIDTH_RATIO),
    );
    innerRight.push(
      formatOffset(point, normalX, normalY, -half * INNER_WIDTH_RATIO),
    );
    core.push(`${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }
  const headPoint = sample(head);
  return {
    outer: `M${left.join("L")}L${right.reverse().join("L")}Z`,
    inner: `M${innerLeft.join("L")}L${innerRight.reverse().join("L")}Z`,
    core: `M${core.join("L")}`,
    head: { x: headPoint.x, y: headPoint.y, radius: width * 0.56 },
  };
}

function formatOffset(
  point: Point,
  normalX: number,
  normalY: number,
  distance: number,
): string {
  return `${(point.x + normalX * distance).toFixed(1)} ${(point.y + normalY * distance).toFixed(1)}`;
}
