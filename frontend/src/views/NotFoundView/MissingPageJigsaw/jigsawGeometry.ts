export type JigsawEdge = "flat" | "tab" | "blank";

export type JigsawEdges = {
  top: JigsawEdge;
  right: JigsawEdge;
  bottom: JigsawEdge;
  left: JigsawEdge;
};

const neckStart = 0.3;
const neckEnd = 0.7;
const lobeDepth = 0.23;

export function createJigsawPiecePath(
  x: number,
  y: number,
  size: number,
  edges: JigsawEdges,
) {
  const path = [`M ${x} ${y}`];

  drawTop(path, x, y, size, edges.top);
  drawRight(path, x + size, y, size, edges.right);
  drawBottom(path, x + size, y + size, size, edges.bottom);
  drawLeft(path, x, y + size, size, edges.left);
  path.push("Z");

  return path.join(" ");
}

export function complementaryEdge(edge: JigsawEdge): JigsawEdge {
  if (edge === "tab") return "blank";
  if (edge === "blank") return "tab";
  return "flat";
}

function drawTop(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
) {
  path.push(`L ${x + size * neckStart} ${y}`);
  drawHorizontalLobe(path, x, y, size, edge, -1);
  path.push(`L ${x + size} ${y}`);
}

function drawRight(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
) {
  path.push(`L ${x} ${y + size * neckStart}`);
  drawVerticalLobe(path, x, y, size, edge, 1);
  path.push(`L ${x} ${y + size}`);
}

function drawBottom(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
) {
  path.push(`L ${x - size * neckStart} ${y}`);
  drawHorizontalLobeReverse(path, x, y, size, edge, 1);
  path.push(`L ${x - size} ${y}`);
}

function drawLeft(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
) {
  path.push(`L ${x} ${y - size * neckStart}`);
  drawVerticalLobeReverse(path, x, y, size, edge, -1);
  path.push(`L ${x} ${y - size}`);
}

function drawHorizontalLobe(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
  outwardDirection: number,
) {
  if (edge === "flat") {
    path.push(`L ${x + size * neckEnd} ${y}`);
    return;
  }

  const direction = edge === "tab" ? outwardDirection : -outwardDirection;
  const depth = size * lobeDepth * direction;

  path.push(
    `C ${x + size * 0.36} ${y}, ${x + size * 0.37} ${y + depth * 0.18}, ${x + size * 0.4} ${y + depth * 0.2}`,
    `C ${x + size * 0.39} ${y + depth * 0.72}, ${x + size * 0.43} ${y + depth}, ${x + size * 0.5} ${y + depth}`,
    `C ${x + size * 0.57} ${y + depth}, ${x + size * 0.61} ${y + depth * 0.72}, ${x + size * 0.6} ${y + depth * 0.2}`,
    `C ${x + size * 0.63} ${y + depth * 0.18}, ${x + size * 0.64} ${y}, ${x + size * neckEnd} ${y}`,
  );
}

function drawVerticalLobe(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
  outwardDirection: number,
) {
  if (edge === "flat") {
    path.push(`L ${x} ${y + size * neckEnd}`);
    return;
  }

  const direction = edge === "tab" ? outwardDirection : -outwardDirection;
  const depth = size * lobeDepth * direction;

  path.push(
    `C ${x} ${y + size * 0.36}, ${x + depth * 0.18} ${y + size * 0.37}, ${x + depth * 0.2} ${y + size * 0.4}`,
    `C ${x + depth * 0.72} ${y + size * 0.39}, ${x + depth} ${y + size * 0.43}, ${x + depth} ${y + size * 0.5}`,
    `C ${x + depth} ${y + size * 0.57}, ${x + depth * 0.72} ${y + size * 0.61}, ${x + depth * 0.2} ${y + size * 0.6}`,
    `C ${x + depth * 0.18} ${y + size * 0.63}, ${x} ${y + size * 0.64}, ${x} ${y + size * neckEnd}`,
  );
}

function drawHorizontalLobeReverse(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
  outwardDirection: number,
) {
  if (edge === "flat") {
    path.push(`L ${x - size * neckEnd} ${y}`);
    return;
  }

  const direction = edge === "tab" ? outwardDirection : -outwardDirection;
  const depth = size * lobeDepth * direction;

  path.push(
    `C ${x - size * 0.36} ${y}, ${x - size * 0.37} ${y + depth * 0.18}, ${x - size * 0.4} ${y + depth * 0.2}`,
    `C ${x - size * 0.39} ${y + depth * 0.72}, ${x - size * 0.43} ${y + depth}, ${x - size * 0.5} ${y + depth}`,
    `C ${x - size * 0.57} ${y + depth}, ${x - size * 0.61} ${y + depth * 0.72}, ${x - size * 0.6} ${y + depth * 0.2}`,
    `C ${x - size * 0.63} ${y + depth * 0.18}, ${x - size * 0.64} ${y}, ${x - size * neckEnd} ${y}`,
  );
}

function drawVerticalLobeReverse(
  path: string[],
  x: number,
  y: number,
  size: number,
  edge: JigsawEdge,
  outwardDirection: number,
) {
  if (edge === "flat") {
    path.push(`L ${x} ${y - size * neckEnd}`);
    return;
  }

  const direction = edge === "tab" ? outwardDirection : -outwardDirection;
  const depth = size * lobeDepth * direction;

  path.push(
    `C ${x} ${y - size * 0.36}, ${x + depth * 0.18} ${y - size * 0.37}, ${x + depth * 0.2} ${y - size * 0.4}`,
    `C ${x + depth * 0.72} ${y - size * 0.39}, ${x + depth} ${y - size * 0.43}, ${x + depth} ${y - size * 0.5}`,
    `C ${x + depth} ${y - size * 0.57}, ${x + depth * 0.72} ${y - size * 0.61}, ${x + depth * 0.2} ${y - size * 0.6}`,
    `C ${x + depth * 0.18} ${y - size * 0.63}, ${x} ${y - size * 0.64}, ${x} ${y - size * neckEnd}`,
  );
}
