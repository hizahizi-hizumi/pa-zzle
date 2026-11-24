import {
  type RefObject,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  rasterizeZukanSheet,
  type ZukanSheetArea,
  type ZukanSheetPicture,
} from "@/features/zukan/ui/zukan-sheet-preview";
import { orderFromSelected } from "@/views/PuzzleSelectionView/carousel-order";
import type { GameSelectionSheetPreview } from "@/views/PuzzleSelectionView/GameSelectionGallery/game-selection-sheet-preview";

/** 額に初めに見せる所の、台紙の絵と、ピクトグラムの上に重ねる溝の絵。 */
export type FramedSheetPictures = {
  sheetUrl: string;
  groovesUrl: string;
};

/**
 * 額の中のピクトグラムの置き場所。額の中の幅と高さに対する比。`.game-selection__picture` の位置と大きさに合わせる。
 * 溝の絵は、ピクトグラムの上にだけ重ねるので、この範囲だけを描く。
 */
const FRAMED_PICTURE_INSET = 0.16;
const FRAMED_PICTURE_SIZE = 1 - FRAMED_PICTURE_INSET * 2;

/** 額の中の大きさ（CSS px）と、画素の細かさ。 */
type PaperSize = { width: number; height: number; pixelRatio: number };

/** 画素の細かさの上限。これより細かい画面でも、絵はこの細かさで描く。 */
const MAX_PIXEL_RATIO = 3;

/** 額の中の台紙で初めに見せる所の上端の、台紙の上端からの距離（CSS px）。台紙を額の中で縦に送れる所までに収める。 */
export function findFramedSheetOffsetPx(
  preview: Pick<
    GameSelectionSheetPreview,
    "columnCount" | "rowCount" | "firstRow"
  >,
  width: number,
  height: number,
): number {
  const squareSize = width / preview.columnCount;
  const sheetHeight = Math.max(squareSize * preview.rowCount, height);
  return Math.max(
    0,
    Math.min(preview.firstRow * squareSize, sheetHeight - height),
  );
}

/** 額の中の範囲を、台紙の中の範囲にする。台紙が額より低いときは、台紙を額の高さまで伸ばして敷くので、行の高さも伸ばす。 */
function toSheetArea(
  preview: GameSelectionSheetPreview,
  { width, height }: PaperSize,
  left: number,
  top: number,
  areaWidth: number,
  areaHeight: number,
): ZukanSheetArea {
  const columnWidth = width / preview.columnCount;
  const rowHeight = Math.max(columnWidth, height / preview.rowCount);
  const offset = findFramedSheetOffsetPx(preview, width, height);
  return {
    left: left / columnWidth,
    top: (offset + top) / rowHeight,
    width: areaWidth / columnWidth,
    height: areaHeight / rowHeight,
  };
}

type CachedPictures = {
  key: string;
  pictures: FramedSheetPictures;
  release: () => void;
};

// パズル選択へ戻るたびに描き直さないよう、ゲームごとに最後に描いた絵をアプリが開いている間持っておく。
let cachedPictures: ReadonlyMap<string, CachedPictures> = new Map();
const cacheListeners = new Set<() => void>();

function storePictures(gameId: string, drawn: CachedPictures): void {
  cachedPictures.get(gameId)?.release();
  cachedPictures = new Map(cachedPictures).set(gameId, drawn);
  for (const listener of cacheListeners) listener();
}

function subscribeCachedPictures(onChange: () => void): () => void {
  cacheListeners.add(onChange);
  return () => cacheListeners.delete(onChange);
}

function getCachedPictures(): ReadonlyMap<string, CachedPictures> {
  return cachedPictures;
}

function findPicturesKey(
  preview: GameSelectionSheetPreview,
  size: PaperSize,
): string {
  return `${size.width}x${size.height}@${size.pixelRatio}:${preview.difficulty}:${preview.appearanceKey}`;
}

async function drawPictures(
  preview: GameSelectionSheetPreview,
  size: PaperSize,
): Promise<CachedPictures | null> {
  const { width, height, pixelRatio } = size;
  const pictureLeft = width * FRAMED_PICTURE_INSET;
  const pictureTop = height * FRAMED_PICTURE_INSET;
  const pictureWidth = width * FRAMED_PICTURE_SIZE;
  const pictureHeight = height * FRAMED_PICTURE_SIZE;
  const pictures = await Promise.all([
    rasterizeZukanSheet(
      preview,
      toSheetArea(preview, size, 0, 0, width, height),
      Math.round(width * pixelRatio),
      Math.round(height * pixelRatio),
      "sheet",
    ),
    rasterizeZukanSheet(
      preview,
      toSheetArea(
        preview,
        size,
        pictureLeft,
        pictureTop,
        pictureWidth,
        pictureHeight,
      ),
      Math.round(pictureWidth * pixelRatio),
      Math.round(pictureHeight * pixelRatio),
      "grooves",
    ),
  ]);
  const [sheet, grooves] = pictures;
  if (sheet === null || grooves === null) {
    for (const picture of pictures) picture?.release();
    return null;
  }
  return {
    key: findPicturesKey(preview, size),
    pictures: { sheetUrl: sheet.url, groovesUrl: grooves.url },
    release() {
      for (const picture of [sheet, grooves] as ZukanSheetPicture[]) {
        picture.release();
      }
    },
  };
}

// ゲームごとに、最後に描き始めた絵。描き終えた絵が、それより前に描き始めたものなら捨てる。
const latestRequestedKeys = new Map<string, string>();

/** 描いていない絵を描き始める。描き終えたら、同じゲームの額のすべての複製へ知らせる。 */
function requestPictures(
  preview: GameSelectionSheetPreview,
  size: PaperSize,
): void {
  const key = findPicturesKey(preview, size);
  if (latestRequestedKeys.get(preview.gameId) === key) return;
  // 持っている絵へ戻ったときも最後に求めたものとして覚え、それより前に描き始めた途中の絵を捨てる。
  latestRequestedKeys.set(preview.gameId, key);
  if (cachedPictures.get(preview.gameId)?.key === key) return;
  void drawPictures(preview, size).then((drawn) => {
    const isLatest = latestRequestedKeys.get(preview.gameId) === key;
    if (drawn === null) {
      if (isLatest) latestRequestedKeys.delete(preview.gameId);
      return;
    }
    if (!isLatest) {
      drawn.release();
      return;
    }
    storePictures(preview.gameId, drawn);
  });
}

function readPaperSize(scroller: HTMLElement | null): PaperSize | null {
  const paper = scroller?.querySelector(".game-selection__paper");
  if (!paper) return null;
  const { width, height } = paper.getBoundingClientRect();
  if (width === 0 || height === 0) return null;
  return {
    width,
    height,
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
  };
}

function readCurrentPictures(
  cache: ReadonlyMap<string, CachedPictures>,
  previews: readonly (GameSelectionSheetPreview | undefined)[],
  size: PaperSize | null,
): ReadonlyMap<string, FramedSheetPictures> {
  const current = new Map<string, FramedSheetPictures>();
  if (size === null) return current;
  for (const preview of previews) {
    if (preview === undefined) continue;
    const cached = cache.get(preview.gameId);
    if (cached?.key === findPicturesKey(preview, size)) {
      current.set(preview.gameId, cached.pictures);
    }
  }
  return current;
}

/**
 * 額ごとの、初めに見せる所の絵。送っている間に通り過ぎる額にも中身を見せるため、全ゲームの分を、選んでいるゲームから近い順に描いておく。
 * 描き終えた絵は、同じゲームの額のすべての複製が使い回す。
 */
export function useFramedSheetPictures(
  scrollerRef: RefObject<HTMLDivElement | null>,
  previews: readonly (GameSelectionSheetPreview | undefined)[],
  selectedIndex: number,
): ReadonlyMap<string, FramedSheetPictures> {
  const [size, setSize] = useState<PaperSize | null>(null);
  const cache = useSyncExternalStore(
    subscribeCachedPictures,
    getCachedPictures,
  );

  useEffect(() => {
    function measure() {
      const next = readPaperSize(scrollerRef.current);
      setSize((current) =>
        current !== null &&
        next !== null &&
        current.width === next.width &&
        current.height === next.height &&
        current.pixelRatio === next.pixelRatio
          ? current
          : next,
      );
    }
    measure();
    window.addEventListener("resize", measure);
    const scroller = scrollerRef.current;
    const observer =
      typeof ResizeObserver === "function" && scroller !== null
        ? new ResizeObserver(measure)
        : null;
    if (scroller !== null) observer?.observe(scroller);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [scrollerRef]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 選んでいるゲームが変わっても、描き直しはしない。描き始める順だけに使う。
  useEffect(() => {
    if (size === null) return;
    for (const preview of orderFromSelected(previews, selectedIndex)) {
      if (preview !== undefined) requestPictures(preview, size);
    }
  }, [previews, size]);

  return useMemo(
    () => readCurrentPictures(cache, previews, size),
    [cache, previews, size],
  );
}

export const _private = { requestPictures, getCachedPictures };
