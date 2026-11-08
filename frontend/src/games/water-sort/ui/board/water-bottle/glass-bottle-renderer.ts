import type { WaterSortBottle } from "@/games/water-sort/puzzle/state";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";

const VIEW_WIDTH = 72;
const VIEW_HEIGHT = 200;
const GLASS_BODY_SCALE_X = 1.3;
const GLASS_BODY_SCALE_Y = 1.07;
const LIQUID_BOTTOM = 183;
const LIQUID_CENTER_X = 36;
const LIQUID_CENTER_Y = 102;

type GlassBottleFrame = {
  contents: WaterSortBottle;
  amount?: number;
  tiltDegrees?: number;
  selected?: boolean;
  completion?: number;
  ripples?: number;
};

const liquidSamplePoints: readonly (readonly [number, number])[] = Array.from(
  { length: 90 * 26 },
  (_, index) => {
    const x = 15.2 + ((index % 26) + 0.5) * (41.6 / 26);
    const y = 17 + (Math.floor(index / 26) + 0.5) * (167 / 90);
    return [x, y] as const;
  },
).filter(([x, y]) => {
  if (y <= 161) return true;
  const distanceToCenter = x - LIQUID_CENTER_X;
  const radius = Math.sqrt(Math.max(0, 24 * 24 - (y - 160) ** 2));
  return Math.abs(distanceToCenter) <= radius;
});

function traceInterior(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(15, 16);
  ctx.lineTo(15, 160);
  ctx.bezierCurveTo(15, 176, 23, 184, 36, 184);
  ctx.bezierCurveTo(49, 184, 57, 176, 57, 160);
  ctx.lineTo(57, 16);
  ctx.closePath();
}

function traceGlass(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(10.5, 12);
  ctx.lineTo(10.5, 161);
  ctx.bezierCurveTo(10.5, 182, 20.5, 191, 36, 191);
  ctx.bezierCurveTo(51.5, 191, 61.5, 182, 61.5, 161);
  ctx.lineTo(61.5, 12);
}

function waterThresholds(amount: number, tiltRadians: number) {
  const sin = Math.sin(tiltRadians);
  const cos = Math.cos(tiltRadians);
  const projections = liquidSamplePoints
    .map(
      ([x, y]) =>
        LIQUID_CENTER_Y +
        (x - LIQUID_CENTER_X) * sin +
        (y - LIQUID_CENTER_Y) * cos,
    )
    .sort((a, b) => a - b);

  function threshold(fraction: number) {
    const index = Math.min(
      projections.length - 1,
      Math.max(0, Math.round((1 - fraction) * (projections.length - 1))),
    );
    return projections[index] ?? LIQUID_BOTTOM;
  }

  return Array.from({ length: 4 }, (_, layer) =>
    threshold(Math.max(0, Math.min(1, Math.min(amount, layer + 1) / 4))),
  );
}

function bottleWaterGradient(ctx: CanvasRenderingContext2D, color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = [1, 3, 5].map((index) =>
    Number.parseInt(color.slice(index, index + 2), 16),
  );
  function tint(white: number, dark: number) {
    const values = rgb.map((component) =>
      Math.round(component * (1 - white - dark) + white * 255),
    );
    return `rgb(${values.join(",")})`;
  }
  const gradient = ctx.createLinearGradient(15, 0, 57, 0);
  gradient.addColorStop(0, tint(0, 0.055));
  gradient.addColorStop(0.13, tint(0.065, 0));
  gradient.addColorStop(0.38, color);
  gradient.addColorStop(0.82, color);
  gradient.addColorStop(1, tint(0, 0.08));
  return gradient;
}

function drawLiquid(ctx: CanvasRenderingContext2D, frame: GlassBottleFrame) {
  const amount = Math.max(
    0,
    Math.min(frame.contents.length, frame.amount ?? frame.contents.length),
  );
  if (amount < 0.001) return;

  const tilt = ((frame.tiltDegrees ?? 0) * Math.PI) / 180;
  const thresholds = waterThresholds(amount, tilt);
  const topLayer = Math.min(3, Math.ceil(amount - 0.001) - 1);

  ctx.save();
  traceInterior(ctx);
  ctx.clip();

  // Gravity determines the liquid interfaces, while the vessel supplies the clipping shape.
  // Each successive fill paints over the lower region of the previous fill.
  for (let layer = topLayer; layer >= 0; layer--) {
    const colorIndex = frame.contents[layer];
    if (colorIndex === undefined) continue;
    const surfaceY = thresholds[layer] ?? LIQUID_BOTTOM;
    ctx.save();
    ctx.translate(LIQUID_CENTER_X, LIQUID_CENTER_Y);
    ctx.rotate(-tilt);
    ctx.translate(-LIQUID_CENTER_X, -LIQUID_CENTER_Y);
    ctx.fillStyle = bottleWaterGradient(
      ctx,
      getWaterColorView(colorIndex).color,
    );
    ctx.fillRect(-180, surfaceY, 430, 410);
    ctx.restore();
  }

  // A single exposed surface; interfaces between colors remain clean and flat.
  const topY = thresholds[topLayer] ?? LIQUID_BOTTOM;
  ctx.save();
  ctx.translate(LIQUID_CENTER_X, LIQUID_CENTER_Y);
  ctx.rotate(-tilt);
  ctx.translate(-LIQUID_CENTER_X, -LIQUID_CENTER_Y);
  ctx.beginPath();
  ctx.moveTo(12, topY);
  ctx.lineTo(60, topY);
  ctx.strokeStyle = "rgba(255,255,255,.40)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if ((frame.ripples ?? 0) > 0 && Math.abs(frame.tiltDegrees ?? 0) < 20) {
    const wave = frame.ripples ?? 0;
    ctx.beginPath();
    ctx.ellipse(36, topY, 5 + 13 * wave, 0.7 + wave, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * (1 - wave)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawVessel(ctx: CanvasRenderingContext2D, frame: GlassBottleFrame) {
  const selected = frame.selected ?? false;
  const complete = frame.completion ?? 0;

  // Subtle back wall: the water, not the glass, remains the dominant shape.
  ctx.save();
  traceGlass(ctx);
  ctx.lineTo(10.5, 12);
  ctx.fillStyle = "rgba(255,255,255,.075)";
  ctx.fill();
  ctx.restore();

  drawLiquid(ctx, frame);

  // One continuous silhouette, with only two restrained refraction edges.
  ctx.save();
  traceGlass(ctx);
  ctx.strokeStyle = selected ? "rgba(30,75,84,.84)" : "rgba(40,70,78,.68)";
  ctx.lineWidth = selected ? 2.35 : 1.9;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14, 20);
  ctx.lineTo(14, 160);
  ctx.bezierCurveTo(14, 180, 23, 187, 36, 187);
  ctx.strokeStyle = "rgba(255,255,255,.55)";
  ctx.lineWidth = 1.35;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(58, 19);
  ctx.lineTo(58, 159);
  ctx.bezierCurveTo(58, 178, 50, 186, 39, 187);
  ctx.strokeStyle = "rgba(38,74,82,.13)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // A fine rim instead of an elliptical mouth and multiple glossy borders.
  ctx.beginPath();
  ctx.moveTo(11, 12);
  ctx.lineTo(61, 12);
  ctx.strokeStyle = "rgba(49,82,91,.37)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14, 14.5);
  ctx.lineTo(58, 14.5);
  ctx.strokeStyle = "rgba(255,255,255,.75)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  if (complete > 0) {
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, complete)) * 0.65;
    ctx.strokeStyle = getWaterColorView(frame.contents[0] ?? 0).color;
    ctx.lineWidth = 2;
    traceGlass(ctx);
    ctx.stroke();
    ctx.restore();
  }
}

/** Canvas and animation overlays use the same renderer to preserve the material during a pour. */
export function paintGlassBottle(
  canvas: HTMLCanvasElement,
  frame: GlassBottleFrame,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const bounds = canvas.getBoundingClientRect();
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(width / VIEW_WIDTH, 0, 0, height / VIEW_HEIGHT, 0, 0);
  ctx.translate(LIQUID_CENTER_X, 100);
  ctx.scale(GLASS_BODY_SCALE_X, GLASS_BODY_SCALE_Y);
  ctx.translate(-LIQUID_CENTER_X, -100);
  drawVessel(ctx, frame);
}
