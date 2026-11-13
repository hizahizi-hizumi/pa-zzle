import type { DataRouter, To } from "react-router";
import { startShowcaseAtRest } from "@/components/game-pictogram-motion";
import {
  runScreenTransition,
  type ScreenTransitionCarrier,
  type ScreenTransitionKind,
  screenTransitionKind,
} from "@/lib/screen-transition";

function pathnameOf(to: To | null): string | null {
  if (to === null) return null;
  if (typeof to === "string") {
    return new URL(to, window.location.href).pathname;
  }
  return to.pathname ?? window.location.pathname;
}

// 運ぶピクトグラムは、遷移元と遷移先で同じ姿でないと、着いたときに姿が跳ぶ。
// 遷移先は静止した姿から動き始めるので、遷移元も静止した姿にそろえてから運ぶ。
function restSharedPictograms(): void {
  for (const pictogram of document.querySelectorAll(
    '[data-screen-shared="pictogram"] [data-pictogram-motion="play"]',
  )) {
    startShowcaseAtRest(pictogram);
  }
}

const FRAMED_SHEET_SELECTOR = '[data-screen-shared="surface"]';
const OPEN_SHEET_SELECTOR = '[data-screen-shared="sheet"]';

/** ゲームのホームの台紙の、マスを並べている所と、見せている範囲の上端と下端、列の数。 */
type OpenSheet = {
  left: number;
  top: number;
  width: number;
  visibleTop: number;
  visibleBottom: number;
  columnCount: number;
};

/** 額の中の台紙の位置と、描いてある最初の行、ゲームのホームが台紙を見せ始める行。 */
type FramedSheet = { rect: DOMRect; firstRow: number; openingRow: number };

function readFramedSheet(): FramedSheet | null {
  const sheet = document.querySelector<HTMLElement>(FRAMED_SHEET_SELECTOR);
  return sheet === null
    ? null
    : {
        rect: sheet.getBoundingClientRect(),
        firstRow: Number(sheet.dataset.sheetFirstRow ?? 0),
        openingRow: Number(sheet.dataset.sheetOpeningRow ?? 0),
      };
}

function readOpenSheet(): OpenSheet | null {
  const sheet = document.querySelector(OPEN_SHEET_SELECTOR);
  const scroller = sheet?.parentElement;
  if (!sheet || !scroller) return null;
  const { left, top, width } = sheet.getBoundingClientRect();
  const visible = scroller.getBoundingClientRect();
  const columnCount = getComputedStyle(sheet)
    .gridTemplateColumns.split(" ")
    .filter((column) => column !== "").length;
  return {
    left,
    top,
    width,
    visibleTop: visible.top,
    visibleBottom: visible.bottom,
    columnCount: Math.max(columnCount, 1),
  };
}

/**
 * 額の中の台紙の最初の行が、ゲームのホームの台紙で重なる所の上端。
 * ゲームのホームへ入るときは、台紙が見せ始める行から開くので、今の台紙の上端からその行までの分だけ下に重ねる。
 * ゲームのホームから出るときは、台紙の今の送り方でその行がある所に重ねる。その行が見えていなければ、見せている範囲の上端に重ねる。
 */
function findOverlapTop(
  framed: FramedSheet,
  open: OpenSheet,
  opensAtFirstRow: boolean,
): number {
  const squareSize = open.width / open.columnCount;
  if (opensAtFirstRow) {
    return open.top + (framed.firstRow - framed.openingRow) * squareSize;
  }
  const rowTop = open.top + framed.firstRow * squareSize;
  return rowTop >= open.visibleTop - 1 && rowTop < open.visibleBottom
    ? rowTop
    : Math.max(open.top, open.visibleTop);
}

/**
 * 額に寄る・額から引く動きの、寄り方を渡す。額の中の台紙のピースが、ゲームのホームの台紙のピースにぴったり重なる所まで、額と壁を一緒に大きくする。
 * 額の中の台紙は額より下へ続いていて、額の中では正方形に、寄り切った所ではゲームのホームの台紙が見せている範囲に切る。
 */
function pointZoomAtSheet(
  framed: FramedSheet | null,
  open: OpenSheet | null,
  opensAtFirstRow: boolean,
) {
  if (framed === null || open === null || framed.rect.width === 0) return;
  const { rect } = framed;
  const top = findOverlapTop(framed, open, opensAtFirstRow);
  const scale = open.width / rect.width;
  const style = document.documentElement.style;
  style.setProperty("--screen-zoom-scale", String(scale));
  style.setProperty("--screen-zoom-dx", `${open.left - rect.left * scale}px`);
  style.setProperty("--screen-zoom-dy", `${top - rect.top * scale}px`);
  style.setProperty("--screen-sheet-left", `${rect.left}px`);
  style.setProperty("--screen-sheet-top", `${rect.top}px`);
  style.setProperty(
    "--screen-sheet-clip-framed",
    `${Math.max(rect.height - rect.width, 0)}px`,
  );
  style.setProperty(
    "--screen-sheet-clip-open",
    `${Math.max(rect.height - (open.visibleBottom - top) / scale, 0)}px`,
  );
}

let framedSheetBefore: FramedSheet | null = null;
let openSheetBefore: OpenSheet | null = null;

const enterGameCarrier: ScreenTransitionCarrier = {
  before() {
    restSharedPictograms();
    framedSheetBefore = readFramedSheet();
  },
  after() {
    pointZoomAtSheet(framedSheetBefore, readOpenSheet(), true);
  },
};

const leaveGameCarrier: ScreenTransitionCarrier = {
  before() {
    restSharedPictograms();
    openSheetBefore = readOpenSheet();
  },
  after() {
    pointZoomAtSheet(readFramedSheet(), openSheetBefore, false);
  },
};

/** 行き来の種類ごとの、画面とは別に運ぶもの。 */
export type ScreenTransitionCarriers = Partial<
  Record<ScreenTransitionKind, ScreenTransitionCarrier>
>;

export function installScreenTransitions(
  router: DataRouter,
  carriers: ScreenTransitionCarriers = {},
): void {
  const carrierOf: ScreenTransitionCarriers = {
    "enter-game": enterGameCarrier,
    "leave-game": leaveGameCarrier,
    ...carriers,
  };
  const navigate = router.navigate.bind(router);

  function navigateWithTransition(to: To | number | null, options?: object) {
    const toPathname = typeof to === "number" ? null : pathnameOf(to);
    const kind =
      toPathname === null
        ? null
        : screenTransitionKind(window.location.pathname, toPathname);
    if (kind === null) {
      return navigate(to as To, options);
    }
    return runScreenTransition(
      kind,
      // 遷移先を一度に描き切ってから動かすので、分けて描かせない。
      () => navigate(to as To, { ...options, flushSync: true }),
      carrierOf[kind],
    );
  }

  router.navigate = navigateWithTransition as DataRouter["navigate"];
}
