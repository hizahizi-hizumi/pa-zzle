import {
  findZukanPieceShape,
  getZukanPiecePath,
  ZUKAN_PIECE_GROOVE_WIDTH,
  type ZukanPieceShape,
} from "@/features/zukan/ui/zukan-piece-shape";
import {
  countZukanSheetColumns,
  estimateZukanSheetMaxVisibleHeightPx,
  estimateZukanSheetWidthPx,
} from "@/features/zukan/ui/zukan-sheet-layout";

import type { ZukanProblemStatus } from "@/features/zukan/zukan-collection";
import { scheduleIdleTask } from "@/lib/idle-task";

/** ゲームのホームを開く前に見せる、台紙の絵の元。台紙と同じ列の数・同じピースの形・同じ状態の色で描く。 */
export type ZukanSheetPreview = {
  /** 台紙の全問の状態。番号の順。 */
  statuses: readonly ZukanProblemStatus[];
  columnCount: number;
  rowCount: number;
  /** 初めに見せる行。最後に解いた問題のあたりが見える所。台紙の上から数えた 0 始まりの位置。 */
  firstRow: number;
  /** ゲームのホームが台紙を見せ始められる、最後の行。台紙は、末尾の行を見せる範囲の下端より上へは送れない。 */
  lastOpenableRow: number;
  /** 描く姿が同じかを見分ける値。並び・初めに見せる行・全問の状態が同じなら同じ値になる。 */
  appearanceKey: string;
};

/** 台紙の中の範囲。列と行を単位にした、左上の位置と幅・高さ。 */
export type ZukanSheetArea = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** 台紙のピースの塗りまで描くか、ピースの間の溝だけを描くか。 */
export type ZukanSheetLayer = "sheet" | "grooves";

// 台紙のピースの間の溝の色と、解いていないピースの色。台紙の背景の色と、`untouched`・`attempted` の塗りに合わせる。
const GROOVE_COLOR = "oklch(1 0 0)";
const UNSOLVED_COLORS = {
  untouched: "oklch(0.95 0 0)",
  attempted: "oklch(0.86 0 0)",
} as const;

/** 台紙に出てくる状態ごとの色。 */
export type ZukanSheetColors = Readonly<
  Partial<Record<ZukanProblemStatus, string>>
>;

/** 状態ごとの色。解いた問題の色は評価段階のトークンで、キャンバスには値を渡すので、今の値を読む。 */
export function readZukanSheetColors(
  statuses: readonly ZukanProblemStatus[],
): ZukanSheetColors {
  const colors: Partial<Record<ZukanProblemStatus, string>> = {
    ...UNSOLVED_COLORS,
  };
  const style = getComputedStyle(document.documentElement);
  for (const status of new Set(statuses)) {
    colors[status] ??= style.getPropertyValue(`--grade-${status}`).trim();
  }
  return colors;
}

// 形は辺の組み合わせの数しかないので、同じ形には作り置いた図形を返す。
const piecePaths = new Map<ZukanPieceShape, Path2D>();

function findPiecePath(shape: ZukanPieceShape): Path2D {
  const cached = piecePaths.get(shape);
  if (cached !== undefined) {
    return cached;
  }
  const path = new Path2D(getZukanPiecePath(shape));
  piecePaths.set(shape, path);
  return path;
}

/** 範囲に掛かるピースの番号。タブは隣のマスへはみ出すので、範囲の外の1マスまで含める。番号の順。 */
function listPiecesInArea(
  problemCount: number,
  columnCount: number,
  area: ZukanSheetArea,
): number[] {
  const rowCount = Math.ceil(problemCount / columnCount);
  const firstRow = Math.max(0, Math.floor(area.top) - 1);
  const lastRow = Math.min(rowCount - 1, Math.ceil(area.top + area.height));
  const firstColumn = Math.max(0, Math.floor(area.left) - 1);
  const lastColumn = Math.min(
    columnCount - 1,
    Math.ceil(area.left + area.width),
  );
  const positions: number[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const position = row * columnCount + column;
      if (position < problemCount) {
        positions.push(position);
      }
    }
  }
  return positions;
}

/**
 * 台紙の `area` を、`context` のキャンバスいっぱいに描く。範囲の縦と横の比がキャンバスと違えば、絵を縦か横に伸ばす。
 * `rows` を渡すと、その行（0 始まり、`end` は含まない）のピースだけを描く。キャンバスは空けずに重ねて描くので、行を分けて何回かで描ける。
 * 隣り合うピースは同じ線で接するので、ピースを1枚ずつ塗って溝を引いても、全部を塗ってから全部の溝を引いても、行を分けて描いても同じ絵になる。描く回数を減らすため、同じ色のピースをまとめて塗り、溝はまとめて引く。
 */
export function paintZukanSheet(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  preview: Pick<ZukanSheetPreview, "statuses" | "columnCount">,
  area: ZukanSheetArea,
  layer: ZukanSheetLayer,
  colors: ZukanSheetColors = readZukanSheetColors(preview.statuses),
  rows?: { start: number; end: number },
): void {
  const { statuses, columnCount } = preview;
  const { width, height } = context.canvas;
  const problemCount = statuses.length;
  const fills = new Map<string, Path2D>();
  const grooves = new Path2D();
  for (const position of listPiecesInArea(problemCount, columnCount, area)) {
    const row = Math.floor(position / columnCount);
    if (rows !== undefined && (row < rows.start || row >= rows.end)) {
      continue;
    }
    const path = findPiecePath(
      findZukanPieceShape(position, problemCount, problemCount, columnCount),
    );
    const place = {
      e: (position % columnCount) - area.left,
      f: row - area.top,
    };
    grooves.addPath(path, place);
    if (layer === "sheet") {
      const color =
        colors[statuses[position] ?? "untouched"] ?? UNSOLVED_COLORS.untouched;
      let fill = fills.get(color);
      if (fill === undefined) {
        fill = new Path2D();
        fills.set(color, fill);
      }
      fill.addPath(path, place);
    }
  }
  context.setTransform(width / area.width, 0, 0, height / area.height, 0, 0);
  for (const [color, fill] of fills) {
    context.fillStyle = color;
    context.fill(fill);
  }
  context.lineWidth = ZUKAN_PIECE_GROOVE_WIDTH;
  context.lineJoin = "round";
  context.strokeStyle = GROOVE_COLOR;
  context.stroke(grooves);
  context.setTransform(1, 0, 0, 1, 0, 0);
}

/** 絵を描いて画像のデータにするのに要るもの。別のスレッドへ渡せる値だけで持つ。 */
export type ZukanSheetRasterRequest = {
  statuses: readonly ZukanProblemStatus[];
  columnCount: number;
  area: ZukanSheetArea;
  widthPx: number;
  heightPx: number;
  layer: ZukanSheetLayer;
  colors: ZukanSheetColors;
};

/** 絵を描いて、PNG の画像のデータにする。描けなければ `null`。 */
export async function encodeZukanSheet(
  request: ZukanSheetRasterRequest,
): Promise<Blob | null> {
  const { widthPx, heightPx } = request;
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(widthPx, heightPx);
    const context = canvas.getContext("2d");
    if (context === null) return null;
    paintZukanSheet(
      context,
      request,
      request.area,
      request.layer,
      request.colors,
    );
    return canvas.convertToBlob({ type: "image/png" });
  }
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  paintZukanSheet(
    context,
    request,
    request.area,
    request.layer,
    request.colors,
  );
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

type RasterReply = { id: number; blob: Blob | null };

/** 絵を描くスレッドの数の上限。全ゲームの絵を手分けして描き、早く揃える。 */
const MAX_RASTER_WORKER_COUNT = 3;

let rasterWorkers: Worker[] | null | undefined;
let nextRequestId = 0;
const pendingReplies = new Map<number, (blob: Blob | null) => void>();

function startRasterWorker(): Worker {
  const worker = new Worker(
    new URL("./zukan-sheet-raster-worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.addEventListener("message", (event: MessageEvent<RasterReply>) => {
    const { id, blob } = event.data;
    pendingReplies.get(id)?.(blob);
    pendingReplies.delete(id);
  });
  worker.addEventListener("error", () => {
    stopRasterWorkers();
  });
  return worker;
}

/** 別のスレッドで描けなくなったら、それからは画面を動かすスレッドで描く。 */
function stopRasterWorkers(): void {
  for (const worker of rasterWorkers ?? []) worker.terminate();
  rasterWorkers = null;
  for (const reply of pendingReplies.values()) reply(null);
  pendingReplies.clear();
}

/** 絵を描くスレッド。作れない環境では `null`。 */
function findRasterWorkers(): Worker[] | null {
  if (rasterWorkers !== undefined) return rasterWorkers;
  rasterWorkers = null;
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function") {
    return null;
  }
  const count = Math.max(
    1,
    Math.min(MAX_RASTER_WORKER_COUNT, (navigator.hardwareConcurrency || 2) - 1),
  );
  try {
    rasterWorkers = Array.from({ length: count }, startRasterWorker);
  } catch {
    stopRasterWorkers();
  }
  return rasterWorkers;
}

function encodeInWorker(
  workers: readonly Worker[],
  request: ZukanSheetRasterRequest,
): Promise<Blob | null> {
  const id = nextRequestId++;
  return new Promise((resolve) => {
    pendingReplies.set(id, resolve);
    workers[id % workers.length]?.postMessage({ id, request });
  });
}

/** 描き終えて、すぐに画面へ出せる絵。`release` を呼ぶと絵を手放し、`url` は使えなくなる。 */
export type ZukanSheetPicture = {
  url: string;
  release: () => void;
};

/**
 * 台紙の `area` を、幅 `widthPx`・高さ `heightPx` の画像に描く。描けなければ `null`。
 * 描いて PNG にするのは、画面を動かすスレッドを止めないよう、別のスレッドで行う。別のスレッドを使えない環境では、空いている時間に行う。
 * 同じ URL の画像は、画面のどこに何枚並べても、ここで読み解いた1枚を使い回す。読み解き終えてから返すので、並べた画像が読み解くまで空に見えることが無い。
 */
export async function rasterizeZukanSheet(
  preview: Pick<ZukanSheetPreview, "statuses" | "columnCount">,
  area: ZukanSheetArea,
  widthPx: number,
  heightPx: number,
  layer: ZukanSheetLayer,
): Promise<ZukanSheetPicture | null> {
  const request: ZukanSheetRasterRequest = {
    statuses: preview.statuses,
    columnCount: preview.columnCount,
    area,
    widthPx,
    heightPx,
    layer,
    colors: readZukanSheetColors(preview.statuses),
  };
  const workers = findRasterWorkers();
  let blob = workers === null ? null : await encodeInWorker(workers, request);
  if (blob === null) {
    stopRasterWorkers();
    blob = await new Promise<Blob | null>((resolve) =>
      scheduleIdleTask(() => {
        void encodeZukanSheet(request).then(resolve, () => resolve(null));
      }),
    );
  }
  if (blob === null) {
    return null;
  }
  const url = URL.createObjectURL(blob);
  // 読み解いた画像を手放さないよう、この Image を絵と一緒に持っておく。
  let image: HTMLImageElement | null = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
  return {
    url,
    release() {
      image = null;
      URL.revokeObjectURL(url);
    },
  };
}

/** 作り置く絵の元の数の上限。ゲームの数と、画面の向きを変えたときの分を持てる数にする。 */
const MAX_PREVIEW_COUNT = 32;
const previews = new Map<string, ZukanSheetPreview>();

/**
 * 台紙を、今の画面の大きさでゲームのホームに開いたときの並びで描くための元。`statuses` は、台紙の全問の状態を番号の順に並べたもの。
 * `focusIndex` の問題があれば、その行が、額に収まる行（列の数と同じ）の中ほどに来る所を、初めに見せる行にする。
 * 同じ姿には作り置いた元を返す。
 */
export function getZukanSheetPreview(
  statuses: readonly ZukanProblemStatus[],
  focusIndex: number | null,
  viewportWidthPx: number,
  viewportHeightPx: number,
): ZukanSheetPreview {
  const problemCount = statuses.length;
  const sheetWidthPx = estimateZukanSheetWidthPx(viewportWidthPx);
  const columnCount = countZukanSheetColumns(sheetWidthPx, problemCount);
  const squareSizePx = sheetWidthPx / columnCount;
  const rowCount = Math.max(1, Math.ceil(problemCount / columnCount));
  const firstRow =
    focusIndex === null
      ? 0
      : Math.max(
          0,
          Math.min(
            Math.floor(focusIndex / columnCount) - Math.floor(columnCount / 2),
            rowCount - columnCount,
          ),
        );
  const lastOpenableRow = Math.max(
    0,
    rowCount -
      Math.ceil(
        estimateZukanSheetMaxVisibleHeightPx(viewportHeightPx) / squareSizePx,
      ),
  );
  const appearanceKey = `${columnCount}:${firstRow}:${lastOpenableRow}:${statuses.join(",")}`;
  const cached = previews.get(appearanceKey);
  if (cached !== undefined) {
    return cached;
  }
  const preview = {
    statuses,
    columnCount,
    rowCount,
    firstRow,
    lastOpenableRow,
    appearanceKey,
  };
  // 画面の大きさや状態が変わるたびに増え続けないよう、古いものから捨てる。
  if (previews.size >= MAX_PREVIEW_COUNT) {
    const oldestKey = previews.keys().next().value;
    if (oldestKey !== undefined) previews.delete(oldestKey);
  }
  previews.set(appearanceKey, preview);
  return preview;
}

export const _private = { listPiecesInArea };
