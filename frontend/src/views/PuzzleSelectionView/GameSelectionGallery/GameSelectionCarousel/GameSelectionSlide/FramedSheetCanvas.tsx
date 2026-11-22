import { useLayoutEffect, useRef } from "react";
import { estimateZukanSheetWidthPx } from "@/features/zukan/ui/zukan-sheet-layout";
import {
  paintZukanSheet,
  readZukanSheetColors,
  type ZukanSheetColors,
  type ZukanSheetLayer,
} from "@/features/zukan/ui/zukan-sheet-preview";
import { scheduleIdleTask } from "@/lib/idle-task";
import { isScreenTransitionRunning } from "@/lib/screen-transition";
import type { GameSelectionSheetPreview } from "@/views/PuzzleSelectionView/GameSelectionGallery/game-selection-sheet-preview";

type FramedSheetCanvasProps = {
  preview: GameSelectionSheetPreview;
  layer: ZukanSheetLayer;
};

/** 画素の細かさの上限。 */
const MAX_PIXEL_RATIO = 3;
// 額の中に置くキャンバスが持つ画素を抑えるため、1枚の画素の数と辺の長さに上限を置く。
const MAX_CANVAS_PIXELS = 8_000_000;
const MAX_CANVAS_SIDE_PX = 8192;
/** 初めに見せる所より後に描く行を、1回の空いている時間に描く数。 */
const ROWS_PER_IDLE_PAINT = 8;

/**
 * 描く細かさ。台紙の絵は、額からゲームのホームへ寄る動きで、ゲームのホームの台紙の大きさまで引き伸ばされるので、寄り切ってもぼやけない細かさで描く。
 * 溝の絵は、寄り始めてすぐに消えるので、画面の画素の細かさで描く。
 */
function findPixelRatio(
  layer: ZukanSheetLayer,
  width: number,
  height: number,
): number {
  const deviceRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const zoom =
    layer === "sheet"
      ? Math.max(1, estimateZukanSheetWidthPx(window.innerWidth) / width)
      : 1;
  return Math.min(
    deviceRatio * zoom,
    Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    MAX_CANVAS_SIDE_PX / Math.max(width, height),
  );
}

/** 描く行の範囲を、初めに見せる所（とその上下に額の4分の1ずつ）を先に、残りを上から順に並べる。 */
function listRowBands(
  preview: Pick<
    GameSelectionSheetPreview,
    "columnCount" | "rowCount" | "firstRow"
  >,
): { start: number; end: number }[] {
  const { columnCount, rowCount, firstRow } = preview;
  const margin = Math.ceil(columnCount / 4);
  const first = {
    start: Math.max(0, firstRow - margin),
    end: Math.min(rowCount, firstRow + columnCount + margin),
  };
  const rest: { start: number; end: number }[] = [];
  for (const [start, end] of [
    [0, first.start],
    [first.end, rowCount],
  ] as const) {
    for (let row = start; row < end; row += ROWS_PER_IDLE_PAINT) {
      rest.push({ start: row, end: Math.min(end, row + ROWS_PER_IDLE_PAINT) });
    }
  }
  return [first, ...rest];
}

// ゲームのホームへ入る動きは額の中の台紙の全体を寄せるので、入る前に、まだ描いていない行を描き終える。
const unfinishedPaints = new Set<() => void>();

/** 止まった額の中の台紙の、まだ描いていない行を、今すぐ描き終える。 */
export function finishFramedSheetPaints(): void {
  for (const finish of Array.from(unfinishedPaints)) finish();
}

/**
 * 額の中の台紙の全体を、置かれた箱いっぱいに描く。描くのは、台紙の絵か溝の絵が変わったときと、画面の大きさが変わったときだけ。
 * 送り終えて止まった直後に描くのは初めに見せる所だけにし、残りの行は空いている時間に少しずつ描く。
 */
export function FramedSheetCanvas({ preview, layer }: FramedSheetCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 額の中に置いた最初の描画から絵が見えるよう、描画の前に描く。
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    let cancelWaiting = function cancelNothing() {};
    let pendingBands: { start: number; end: number }[] = [];
    let colors: ZukanSheetColors = {};
    function paintBand(
      context: CanvasRenderingContext2D,
      rows: { start: number; end: number },
    ) {
      paintZukanSheet(
        context,
        preview,
        {
          left: 0,
          top: 0,
          width: preview.columnCount,
          height: preview.rowCount,
        },
        layer,
        colors,
        rows,
      );
    }
    function finish() {
      cancelWaiting();
      unfinishedPaints.delete(finish);
      const context = canvas?.getContext("2d");
      if (context) {
        for (const rows of pendingBands) paintBand(context, rows);
      }
      pendingBands = [];
    }
    function paintNextWhenIdle() {
      cancelWaiting = scheduleIdleTask(() => {
        const rows = pendingBands.shift();
        const context = canvas?.getContext("2d");
        if (rows === undefined || !context) {
          unfinishedPaints.delete(finish);
          return;
        }
        paintBand(context, rows);
        paintNextWhenIdle();
      });
    }
    function paint() {
      cancelWaiting();
      if (canvas === null) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const ratio = findPixelRatio(layer, width, height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      if (context === null) return;
      colors = readZukanSheetColors(preview.statuses);
      const [first, ...rest] = listRowBands(preview);
      pendingBands = rest;
      if (first !== undefined) paintBand(context, first);
      // 画面の行き来の動きの中で開いたときは、動きが額の中の台紙の全体を写すので、すぐ全部を描く。
      if (isScreenTransitionRunning()) {
        finish();
        return;
      }
      unfinishedPaints.add(finish);
      paintNextWhenIdle();
    }
    paint();
    window.addEventListener("resize", paint);
    return () => {
      window.removeEventListener("resize", paint);
      cancelWaiting();
      unfinishedPaints.delete(finish);
      // 額から離れたキャンバスの画素を、すぐに手放す。
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [preview, layer]);

  return (
    <canvas
      ref={canvasRef}
      className="game-selection__canvas"
      aria-hidden="true"
    />
  );
}

export const _private = { listRowBands };
