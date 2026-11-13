import { handOpeningZukanSheetRow } from "@/features/zukan/zukan-sheet-opening";
import {
  afterScreenTransition,
  type ScreenTransitionCarrier,
} from "@/lib/screen-transition";

const SHARED_PICTOGRAM_SELECTOR = '[data-screen-shared="pictogram"]';

function listPictogramAnimations(): Animation[] {
  const pictogram = document.querySelector(SHARED_PICTOGRAM_SELECTOR);
  return typeof pictogram?.getAnimations === "function"
    ? pictogram.getAnimations({ subtree: true })
    : [];
}

let heldPictogramTimes: (number | null)[] = [];

/**
 * 運ぶピクトグラムを、今の姿で止める。運ぶ間は止めた姿の絵を運ぶので、止めた時点を覚えておく。
 * 静止した姿へ戻してから運ぶと、押した瞬間にピクトグラムの姿が跳ぶ。
 */
function holdSharedPictogram(): void {
  const animations = listPictogramAnimations();
  for (const animation of animations) animation.pause();
  heldPictogramTimes = animations.map(({ currentTime }) =>
    currentTime === null ? null : Number(currentTime),
  );
}

/**
 * 遷移先のピクトグラムを、運んできた姿と同じ時点で止めておき、行き来の動きが終わったら続きから動かす。
 * 遷移先のピクトグラムは、描いたあとに自分で動きの始まりを決め直すので、決め直された後にも同じ時点へ合わせ直す。
 * 遷移元と遷移先で動きの数が違うとき（色と動きの無い絵へ替わるとき）は、何もしない。
 */
function resumeSharedPictogram(): void {
  const times = heldPictogramTimes;
  function hold(): Animation[] {
    const animations = listPictogramAnimations();
    if (animations.length === 0 || animations.length !== times.length) {
      return [];
    }
    for (const [index, animation] of animations.entries()) {
      animation.currentTime = times[index] ?? null;
      animation.pause();
    }
    return animations;
  }
  hold();
  let frame = requestAnimationFrame(() => {
    hold();
    frame = requestAnimationFrame(hold);
  });
  afterScreenTransition(() => {
    cancelAnimationFrame(frame);
    for (const animation of hold()) animation.play();
  });
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

/** 額の中の台紙の絵の位置と、額の上端より上に隠れている絵の高さ、額の中に見えている高さ。 */
type FramedSheet = {
  rect: DOMRect;
  hiddenTop: number;
  shownHeight: number;
  /** ゲームのホームが台紙を見せ始める行。額で見ている行か、台紙をそこまで送れないときは送れる最後の行。小数を含む。 */
  openingRow: number;
};

function readFramedSheet(): FramedSheet | null {
  const sheet = document.querySelector<HTMLElement>(FRAMED_SHEET_SELECTOR);
  const paper = sheet?.parentElement;
  if (!sheet || !paper) return null;
  const rect = sheet.getBoundingClientRect();
  const shown = paper.getBoundingClientRect();
  const { sheetColumns, sheetLastOpenableRow } = sheet.dataset;
  const hiddenTop = shown.top - rect.top;
  const squareSize = rect.width / Number(sheetColumns ?? 1);
  return {
    rect,
    hiddenTop,
    shownHeight: shown.height,
    openingRow: Math.min(
      squareSize > 0 ? hiddenTop / squareSize : 0,
      Number(sheetLastOpenableRow ?? 0),
    ),
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
 * 額の中の台紙の絵の上端（台紙の1行目）が、ゲームのホームの台紙で重なる所の上端。
 * ゲームのホームへ入るときは、台紙が見せ始める行まで送って開くので、今の台紙の上端からその分だけ上に重ねる。
 * ゲームのホームから出るときは、台紙の今の送り方で1行目がある所に重ねる。
 */
function findOverlapTop(
  framed: FramedSheet,
  open: OpenSheet,
  opensAtOpeningRow: boolean,
): number {
  return opensAtOpeningRow
    ? open.top - (framed.openingRow * open.width) / open.columnCount
    : open.top;
}

/**
 * 額に寄る・額から引く動きの、寄り方を渡す。額の中の台紙のピースが、ゲームのホームの台紙のピースにぴったり重なる所まで、額と壁を一緒に大きくする。
 * 額の中の台紙の絵は額の上下へ続いていて、額の中では正方形に、寄り切った所ではゲームのホームの台紙が見せている範囲に切る。
 */
function pointZoomAtSheet(
  framed: FramedSheet | null,
  open: OpenSheet | null,
  opensAtOpeningRow: boolean,
) {
  if (framed === null || open === null || framed.rect.width === 0) return;
  const { rect } = framed;
  const top = findOverlapTop(framed, open, opensAtOpeningRow);
  const scale = open.width / rect.width;
  const style = document.documentElement.style;
  style.setProperty("--screen-zoom-scale", String(scale));
  style.setProperty("--screen-zoom-dx", `${open.left - rect.left * scale}px`);
  style.setProperty("--screen-zoom-dy", `${top - rect.top * scale}px`);
  style.setProperty("--screen-sheet-left", `${rect.left}px`);
  style.setProperty("--screen-sheet-top", `${rect.top}px`);
  // ゲームのホームの台紙が見せている範囲の上端。入るときは、台紙がまだ送られていないので、台紙の上端がそのまま見せる範囲の上端になる。
  const shownTop = opensAtOpeningRow
    ? open.top
    : Math.max(open.top, open.visibleTop);
  // 台紙を見せる範囲。額の中では正方形、寄り切った所ではゲームのホームの台紙が見せている範囲。
  // 絵は大きさを変えながら動くので、範囲は絵ではなく、動かない箱（絵の元の位置）からの距離で渡す。
  const insets = {
    "top-framed": framed.hiddenTop,
    "bottom-framed": rect.height - framed.hiddenTop - framed.shownHeight,
    "top-open": shownTop - rect.top,
    "right-open": rect.right - (open.left + open.width),
    "bottom-open": rect.bottom - open.visibleBottom,
    "left-open": open.left - rect.left,
  };
  for (const [name, inset] of Object.entries(insets)) {
    style.setProperty(`--screen-sheet-clip-${name}`, `${inset}px`);
  }
}

let framedSheetBefore: FramedSheet | null = null;
let openSheetBefore: OpenSheet | null = null;

/** パズル選択の額からゲームのホームへ入る行き来。額の中の台紙を、ゲームのホームの台紙に重なるまで寄せる。 */
export const gameFrameEnterCarrier: ScreenTransitionCarrier = {
  before() {
    holdSharedPictogram();
    framedSheetBefore = readFramedSheet();
    handOpeningZukanSheetRow(framedSheetBefore?.openingRow ?? 0);
  },
  after() {
    resumeSharedPictogram();
    pointZoomAtSheet(framedSheetBefore, readOpenSheet(), true);
  },
};

/** ゲームのホームからパズル選択へ戻る行き来。ゲームのホームの台紙から、パズル選択の額の中の台紙へ引く。 */
export const gameFrameLeaveCarrier: ScreenTransitionCarrier = {
  before() {
    holdSharedPictogram();
    openSheetBefore = readOpenSheet();
  },
  after() {
    resumeSharedPictogram();
    pointZoomAtSheet(readFramedSheet(), openSheetBefore, false);
  },
};
