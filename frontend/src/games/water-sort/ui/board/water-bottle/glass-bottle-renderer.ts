import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

const VIEW_WIDTH = 72;
const VIEW_HEIGHT = 200;
const GLASS_BODY_SCALE_X = 1.3;
const GLASS_BODY_SCALE_Y = 1.07;
const CENTER_X = 36;
const CENTER_Y = 102;
const SAMPLE_POINTS = Array.from({ length: 90 * 26 }, (_, index) => {
  const x = 15.2 + ((index % 26) + 0.5) * (41.6 / 26);
  const y = 17 + (Math.floor(index / 26) + 0.5) * (167 / 90);
  return [x, y] as const;
}).filter(
  ([x, y]) =>
    y <= 160 ||
    Math.abs(x - CENTER_X) <= Math.sqrt(Math.max(0, 24 ** 2 - (y - 160) ** 2)),
);

type GlassBottleFrame = {
  contents: WaterSortBottle;
  amount?: number;
  tiltDegrees?: number;
  selected?: boolean;
  completion?: number;
  ripples?: number;
  previewFrom?: number;
};

function traceCavity(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(15, 16);
  ctx.lineTo(15, 160);
  ctx.bezierCurveTo(15, 176, 23, 184, 36, 184);
  ctx.bezierCurveTo(49, 184, 57, 176, 57, 160);
  ctx.lineTo(57, 16);
  ctx.closePath();
}

function traceVessel(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(10.5, 12);
  ctx.lineTo(10.5, 161);
  ctx.bezierCurveTo(10.5, 182, 20.5, 191, 36, 191);
  ctx.bezierCurveTo(51.5, 191, 61.5, 182, 61.5, 161);
  ctx.lineTo(61.5, 12);
}

const projectionCache = new Map<number, readonly number[]>();

function waterLevels(amount: number, tilt: number) {
  const tiltStep = Math.round(((tilt * 180) / Math.PI) * 2);
  let projections = projectionCache.get(tiltStep);
  if (!projections) {
    const quantizedTilt = (tiltStep * Math.PI) / 360;
    const sin = Math.sin(quantizedTilt);
    const cos = Math.cos(quantizedTilt);
    projections = SAMPLE_POINTS.map(
      ([x, y]) => CENTER_Y + (x - CENTER_X) * sin + (y - CENTER_Y) * cos,
    ).sort((a, b) => a - b);
    projectionCache.set(tiltStep, projections);
  }

  return Array.from({ length: 4 }, (_, index) => {
    const fraction = Math.max(0, Math.min(1, Math.min(amount, index + 1) / 4));
    return (
      projections[Math.round((1 - fraction) * (projections.length - 1))] ?? 184
    );
  });
}

function waterGradient(ctx: CanvasRenderingContext2D, color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
  function tone(white: number, black = 0) {
    return `rgb(${rgb.map((n) => Math.round(n * (1 - white - black) + 255 * white)).join(",")})`;
  }
  const gradient = ctx.createLinearGradient(15, 0, 57, 0);
  gradient.addColorStop(0, tone(0, 0.09));
  gradient.addColorStop(0.08, tone(0.1));
  gradient.addColorStop(0.22, tone(0.16));
  gradient.addColorStop(0.38, tone(0.045));
  gradient.addColorStop(0.65, color);
  gradient.addColorStop(0.89, tone(0, 0.035));
  gradient.addColorStop(1, tone(0, 0.11));
  return gradient;
}

function traceSurface(ctx: CanvasRenderingContext2D, y: number, wave = 0) {
  ctx.beginPath();
  ctx.moveTo(-160, y - 0.65);
  ctx.lineTo(12, y - 0.65);
  ctx.bezierCurveTo(27, y + 1.4 + wave, 45, y + 1.4 + wave, 60, y - 0.65);
  ctx.lineTo(230, y - 0.65);
  ctx.lineTo(230, 410);
  ctx.lineTo(-160, 410);
  ctx.closePath();
}

function drawWater(ctx: CanvasRenderingContext2D, frame: GlassBottleFrame) {
  const amount = Math.max(
    0,
    Math.min(frame.contents.length, frame.amount ?? frame.contents.length),
  );
  if (amount < 0.001) return;
  const tilt = ((frame.tiltDegrees ?? 0) * Math.PI) / 180;
  // 横倒しでも色の順序を読み取れるよう、液層の傾きは容器の回転へ完全には追従させない。
  const displayTilt = tilt * 0.23;
  const levels = waterLevels(amount, displayTilt);
  const topLayer = Math.min(3, Math.ceil(amount - 0.001) - 1);

  ctx.save();
  traceCavity(ctx);
  ctx.clip();

  ctx.translate(CENTER_X, CENTER_Y);
  ctx.rotate(-displayTilt);
  ctx.translate(-CENTER_X, -CENTER_Y);

  const ripples = frame.ripples ?? 0;
  const wave = Math.sin(ripples * Math.PI * 2.5) * (1 - ripples) * 3.6;
  for (let layer = topLayer; layer >= 0; layer--) {
    const colorIndex = frame.contents[layer];
    if (colorIndex === undefined) continue;
    const y = levels[layer] ?? 184;
    traceSurface(ctx, y, layer === topLayer ? wave : 0);
    ctx.fillStyle = waterGradient(ctx, getWaterColorView(colorIndex).color);
    ctx.globalAlpha =
      frame.previewFrom !== undefined && layer >= frame.previewFrom ? 0.38 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const topY = levels[topLayer] ?? 184;
  ctx.beginPath();
  ctx.moveTo(15, topY - 0.3);
  ctx.bezierCurveTo(
    27,
    topY + 1.1 + wave,
    45,
    topY + 1.1 + wave,
    57,
    topY - 0.3,
  );
  ctx.strokeStyle =
    frame.previewFrom !== undefined
      ? "rgba(70,113,133,0.48)"
      : "rgba(255,255,255,0.66)";
  ctx.lineWidth = frame.previewFrom !== undefined ? 1.3 : 0.8;
  ctx.stroke();

  ctx.restore();
}

function drawGlass(ctx: CanvasRenderingContext2D, frame: GlassBottleFrame) {
  ctx.save();
  traceVessel(ctx);
  ctx.lineTo(10.5, 12);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.restore();

  drawWater(ctx, frame);

  const completion = Math.max(0, Math.min(1, frame.completion ?? 0));
  if (completion > 0) {
    ctx.save();
    traceCavity(ctx);
    ctx.clip();
    const sweepY = 180 - completion * 175;
    const highlight = ctx.createLinearGradient(0, sweepY - 26, 0, sweepY + 26);
    highlight.addColorStop(0, "rgba(255,255,255,0)");
    highlight.addColorStop(
      0.5,
      `rgba(255,255,255,${0.28 * Math.sin(Math.PI * completion)})`,
    );
    highlight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = highlight;
    ctx.fillRect(14, 14, 44, 172);
    ctx.restore();
  }

  ctx.save();
  traceVessel(ctx);
  ctx.strokeStyle = frame.selected
    ? "rgba(97,129,148,0.88)"
    : "rgba(131,156,170,0.72)";
  ctx.lineWidth = frame.selected ? 2.35 : 2.05;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(57,91,113,0.10)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 2.5;
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // The side highlights belong to the glass wall, not to each colored layer.
  ctx.beginPath();
  ctx.moveTo(13.5, 22);
  ctx.lineTo(13.5, 159);
  ctx.bezierCurveTo(13.5, 179, 23, 188, 36, 188);
  ctx.strokeStyle = "rgba(255,255,255,0.70)";
  ctx.lineWidth = 1.35;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(59, 23);
  ctx.lineTo(59, 160);
  ctx.bezierCurveTo(59, 179, 50, 188, 41, 188);
  ctx.strokeStyle = "rgba(240,249,252,0.7)";
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(11, 12);
  ctx.lineTo(61, 12);
  ctx.strokeStyle = "rgba(140,164,178,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (completion > 0) {
    const pulse = Math.sin(Math.PI * Math.min(1, completion));
    ctx.globalAlpha = pulse * 0.8;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    traceVessel(ctx);
    ctx.stroke();
  }
  ctx.restore();
}

/** The stationary board and moving pour layer share one physical vessel renderer. */
export function paintGlassBottle(
  canvas: HTMLCanvasElement,
  frame: GlassBottleFrame,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const widthPx = canvas.clientWidth;
  const heightPx = canvas.clientHeight;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(widthPx * scale));
  const height = Math.max(1, Math.round(heightPx * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(width / VIEW_WIDTH, 0, 0, height / VIEW_HEIGHT, 0, 0);
  ctx.translate(CENTER_X, 100);
  ctx.scale(GLASS_BODY_SCALE_X, GLASS_BODY_SCALE_Y);
  ctx.translate(-CENTER_X, -100);
  drawGlass(ctx, frame);
}
