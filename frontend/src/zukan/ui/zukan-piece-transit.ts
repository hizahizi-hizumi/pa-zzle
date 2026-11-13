import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import type { ScreenTransitionCarrier } from "@/lib/screen-transition";
import {
  findZukanPieceShape,
  getZukanPiecePath,
  ZUKAN_PIECE_VIEW_BOX,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";

/**
 * 1問は図鑑の台紙の1ピース。台紙から抜いたピースの中へ入って解き、解き終えるとそのピースに今回の評価の色が付き、台紙の元の場所へ戻る。
 * ここは、プレイから結果、結果からゲームのホーム・パズル選択・次のプレイへの行き来で、そのピースを画面をまたいで繋ぐ。
 */

/** 結果のピースを運ぶ、それぞれの動きの長さ（ms）。 */
const ZUKAN_PIECE_TRANSIT_DURATION_MS = {
  /** 台紙の元の場所へ、ピースを持ち上げて運ぶ。 */
  land: 560,
  /** 置いたピースを、台紙へ押し込む。 */
  press: 180,
  /** はめたピースを、台紙のマスへ替える。 */
  settle: 140,
} as const;

/** 台紙からピースを抜かずに始めた問題（結果から続けて始めた問題、URL を直接開いたプレイ）に使う、ピースの形。 */
export const DEFAULT_ZUKAN_PIECE_SHAPE = "1,-1,1,-1";
/** 台紙のマスは、画面の行き来の動きの後ろで描かれる。戻る先のマスが描かれるのを待つ長さの上限（ms）。 */
const SQUARE_DRAW_WAIT_MS = 900;
/** 台紙へ運ぶ動きのイージング。持ち上げてから置くように、初めと終わりをゆっくりにする。 */
const LAND_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
/** 運ぶ途中で持ち上げる高さ（px）と、持ち上げたときに大きく見せる分。 */
const LIFT_PX = 18;
const LIFT_SCALE = 0.16;
/** 置いたピースを押し込むときの倍率。 */
const PRESS_SCALE = 0.88;
/** 台紙のマスの位置が落ち着くのを待つ長さの上限（ms）。 */
const SQUARE_SETTLE_WAIT_MS = 400;
/** はめたピースを、マスに色が入るのを待って置いておく長さの上限（ms）。前回からの変化を見せる演出が始まらなかったときに、ピースを残さない。 */
const SQUARE_COLOR_WAIT_MS = 1600;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const RESULT_EMBLEM_SELECTOR = "[data-result-emblem]";
const RESULT_PIECE_SELECTOR = "[data-zukan-result-piece]";
const RETURNED_SQUARE_SELECTOR = '[data-piece-shape][aria-current="true"]';
const FRAMED_SHEET_SELECTOR = "[data-sheet-columns]";
/** パズル選択の額の台紙へ運ぶピースがあることを、画面の行き来の動きへ伝える属性。 */
const CARRIES_TO_FRAME_ATTRIBUTE = "data-screen-carries-piece";

/** ピースの、台紙の中の場所。台紙の難易度と、番号の順の位置。 */
type SheetPlace = { difficulty: string; index: number };

/** ピースを運ぶ先の、中心と1辺の長さ。 */
type Landing = { x: number; y: number; width: number };

type CarriedPiece = {
  layer: SVGSVGElement;
  /** 台紙の中の場所。分からないピースでは `null`。 */
  place: SheetPlace | null;
  centerX: number;
  centerY: number;
  size: number;
};

const framedListeners = new Set<() => void>();

/** 結果から運んだピースが、パズル選択の額の台紙にはまったら `listener` を呼ぶ。戻り値は、聞くのをやめる関数。 */
export function subscribeZukanPieceFramed(listener: () => void): () => void {
  framedListeners.add(listener);
  return () => framedListeners.delete(listener);
}

let playPiecePath: string | null = null;
let carried: CarriedPiece | null = null;

/** プレイへ入るときに抜いたピースの輪郭を覚える。解き終えたときに、同じ形のピースへ色を付けて見せる。 */
export function rememberZukanPlayPiece(piecePath: string): void {
  playPiecePath = piecePath;
}

/** プレイへ入るときに抜いたピースの輪郭。抜かずに始めた問題では `null`。 */
export function getZukanPlayPiecePath(): string | null {
  return playPiecePath;
}

function canAnimate(): boolean {
  return typeof document.body.animate === "function" && !prefersReducedMotion();
}

/** 結果に添えたピースの枠。ピースを添えない高さの画面では、枠があっても描かれないので `null`。 */
function findShownResultEmblem(): HTMLElement | null {
  const emblem = document.querySelector<HTMLElement>(RESULT_EMBLEM_SELECTOR);
  return emblem !== null && getComputedStyle(emblem).display !== "none"
    ? emblem
    : null;
}

async function settled(animation: Animation): Promise<void> {
  await animation.finished.catch(() => {});
}

function dropCarried(): void {
  carried?.layer.remove();
  carried = null;
}

/**
 * 結果に添えたピースを、画面をまたいで運べる層へ写す。写したら、結果のピースは隠す。
 * 結果にピースが無いときと、動かせないときは `null`。
 */
function liftResultPiece(): CarriedPiece | null {
  dropCarried();
  const emblem = findShownResultEmblem();
  const piece = emblem?.querySelector(RESULT_PIECE_SELECTOR);
  if (!emblem || !piece || !canAnimate()) return null;
  const { left, top, width, height } = emblem.getBoundingClientRect();
  const layer = piece.cloneNode(true) as SVGSVGElement;
  layer.removeAttribute("class");
  layer.removeAttribute("data-zukan-result-piece");
  layer.dataset.zukanCarriedPiece = "";
  const { color } = getComputedStyle(piece);
  Object.assign(layer.style, {
    position: "fixed",
    left: `${left - width / 2}px`,
    top: `${top - height / 2}px`,
    width: `${width * 2}px`,
    height: `${height * 2}px`,
    overflow: "visible",
    pointerEvents: "none",
    color,
    zIndex: "var(--layer-overlay)",
  });
  // 絵柄の色は結果画面の中でだけ決まるので、決まった値を層へ写す。
  const markColor = getComputedStyle(piece).getPropertyValue(
    "--game-pictogram-strong",
  );
  layer.style.setProperty("--game-pictogram-strong", markColor);
  layer.style.setProperty("--game-pictogram-soft", markColor);
  document.body.append(layer);
  emblem.style.visibility = "hidden";
  const { sheetDifficulty, sheetIndex } = (piece as SVGElement).dataset;
  carried = {
    layer,
    place:
      sheetDifficulty !== undefined && sheetIndex !== undefined
        ? { difficulty: sheetDifficulty, index: Number(sheetIndex) }
        : null,
    centerX: left + width / 2,
    centerY: top + height / 2,
    size: width,
  };
  return carried;
}

/** 台紙のマスが、前回からの変化を見せる演出で、これから色を入れるのを待っているか。 */
function awaitsChangeStamp(square: HTMLElement): boolean {
  const stage = square.dataset.changeStage;
  return stage === "waiting" || stage === "stamping";
}

/**
 * はめたピースを、台紙のマスへ替える。
 * マスの色は問題ごとの最高評価で、ピースの色は今回の評価。初めて解いたときと最高評価を上げたときは、
 * 前回からの変化を見せる演出がマスへ色を入れるまで、マスは前の姿のままなので、色が入るまでピースを置いておく。
 * 最高評価を上げなかったときは、マスの色は変わらないので、はめたらすぐマスへ替える。
 */
async function releaseOntoSquare(
  layer: SVGSVGElement,
  square: HTMLElement,
): Promise<void> {
  const deadline = performance.now() + SQUARE_COLOR_WAIT_MS;
  while (
    square.isConnected &&
    awaitsChangeStamp(square) &&
    performance.now() < deadline
  ) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  await settled(
    layer.animate([{ opacity: 0 }], {
      duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.settle,
      easing: MOTION_EASING.exit,
      fill: "forwards",
    }),
  );
  layer.remove();
  if (carried?.layer === layer) carried = null;
}

async function findReturnedSquare(): Promise<HTMLElement | null> {
  const deadline = performance.now() + SQUARE_DRAW_WAIT_MS;
  for (;;) {
    const square = document.querySelector<HTMLElement>(
      RETURNED_SQUARE_SELECTOR,
    );
    if (square !== null || performance.now() >= deadline) return square;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function readSquareCenter(square: HTMLElement): Landing {
  const { left, top, width, height } = square.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2, width };
}

/**
 * 台紙は、開いた直後に列の数を決め直し、選んだマスが見えるよう自分でスクロールする。
 * マスの位置が続けて2回同じになるまで待ち、動いている途中のマスへ向けて運び始めない。
 */
async function landingSettled(readLanding: () => Landing): Promise<void> {
  const deadline = performance.now() + SQUARE_SETTLE_WAIT_MS;
  let previous = readLanding();
  while (performance.now() < deadline) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const current = readLanding();
    if (current.x === previous.x && current.y === previous.y) return;
    previous = current;
  }
}

function flightTo(
  { x, y, width }: Landing,
  fromX: number,
  fromY: number,
  size: number,
) {
  return { dx: x - fromX, dy: y - fromY, scale: width / size };
}

/**
 * ピースを、台紙の中の場所へ運ぶ。持ち上げて、運んで、置く。運んでいる間に台紙が描き直されても止まらないよう、描画と別に進む動きで運ぶ。
 */
async function flyToLanding(
  layer: SVGSVGElement,
  readLanding: () => Landing,
  fromX: number,
  fromY: number,
  size: number,
): Promise<void> {
  await landingSettled(readLanding);
  const { dx, dy, scale } = flightTo(readLanding(), fromX, fromY, size);
  const lifted = (1 + scale) / 2 + LIFT_SCALE;
  const flight = layer.animate(
    [
      {
        transform: "translate(0, 0) scale(1)",
        filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.16))",
      },
      {
        transform: `translate(${dx / 2}px, ${dy / 2 - LIFT_PX}px) scale(${lifted})`,
        filter: "drop-shadow(0 16px 14px rgb(0 0 0 / 0.22))",
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        filter: "drop-shadow(0 0 0 rgb(0 0 0 / 0))",
      },
    ],
    {
      duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.land,
      easing: LAND_EASING,
      fill: "forwards",
    },
  );
  await settled(flight);
  // 運んでいる間にマスが動いていたら、着いた所をマスへ合わせる。
  const landed = flightTo(readLanding(), fromX, fromY, size);
  const landedTransform = `translate(${landed.dx}px, ${landed.dy}px)`;
  layer.style.transform = `${landedTransform} scale(${landed.scale})`;
  flight.cancel();
  // 置いたピースを、台紙へ押し込む。
  await settled(
    layer.animate(
      [
        { transform: `${landedTransform} scale(${landed.scale})` },
        {
          transform: `${landedTransform} scale(${landed.scale * PRESS_SCALE})`,
        },
        { transform: `${landedTransform} scale(${landed.scale})` },
      ],
      {
        duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.press,
        easing: MOTION_EASING.standard,
      },
    ),
  );
}

/** ゲームのホームが開いたら、結果から運んだピースを台紙の元の場所へはめる。場所が見つからなければ、その場で消す。 */
async function landPiece(): Promise<void> {
  const piece = carried;
  if (piece === null) return;
  const { layer, centerX, centerY, size } = piece;
  const square = await findReturnedSquare();
  if (square === null) {
    await fadeCarried(piece);
    return;
  }
  square.scrollIntoView?.({ block: "nearest" });
  const shape = square.dataset.pieceShape;
  if (shape !== undefined) {
    layer.querySelector("path")?.setAttribute("d", getZukanPiecePath(shape));
  }
  await flyToLanding(
    layer,
    () => readSquareCenter(square),
    centerX,
    centerY,
    size,
  );
  void releaseOntoSquare(layer, square);
}

async function fadeCarried(piece: CarriedPiece): Promise<void> {
  await settled(
    piece.layer.animate([{ opacity: 0 }], {
      duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.settle,
      easing: MOTION_EASING.exit,
      fill: "forwards",
    }),
  );
  if (carried === piece) dropCarried();
}

/**
 * パズル選択の額の台紙の中の、ピースの場所。額の台紙は、ゲームのホームの台紙と同じ並びで、最後に解いた問題のあたりの、額に収まる行だけを見せる。
 * 額の台紙が別の難易度のときと、ピースの行が額に収まらないときは `null`。
 */
function findFramedLanding(
  place: SheetPlace,
): { sheet: HTMLElement; column: number; row: number; shape: string } | null {
  const sheet = document.querySelector<HTMLElement>(
    `[data-screen-shared="surface"]${FRAMED_SHEET_SELECTOR}`,
  );
  if (sheet === null || sheet.dataset.sheetDifficulty !== place.difficulty) {
    return null;
  }
  const columnCount = Number(sheet.dataset.sheetColumns);
  const problemCount = Number(sheet.dataset.sheetProblemCount);
  const row =
    Math.floor(place.index / columnCount) - Number(sheet.dataset.sheetFirstRow);
  // 額の中は正方形なので、見える行の数は列の数と同じ。
  if (place.index < 0 || row < 0 || row >= columnCount) {
    return null;
  }
  return {
    sheet,
    column: place.index % columnCount,
    row,
    shape: findZukanPieceShape(
      place.index,
      problemCount,
      problemCount,
      columnCount,
    ),
  };
}

/** パズル選択が開いたら、結果から運んだピースを、額の台紙の元の場所へはめる。額の台紙にその場所が見えなければ、その場で消す。 */
async function landPieceInFrame(): Promise<void> {
  const piece = carried;
  if (piece === null) return;
  const landing = piece.place === null ? null : findFramedLanding(piece.place);
  if (landing === null) {
    document.documentElement.removeAttribute(CARRIES_TO_FRAME_ATTRIBUTE);
    await fadeCarried(piece);
    return;
  }
  const { sheet, column, row, shape } = landing;
  const columnCount = Number(sheet.dataset.sheetColumns);
  function readLanding(): Landing {
    const { left, top, width } = sheet.getBoundingClientRect();
    const squareSize = width / columnCount;
    return {
      x: left + (column + 0.5) * squareSize,
      y: top + (row + 0.5) * squareSize,
      width: squareSize,
    };
  }
  piece.layer
    .querySelector("path")
    ?.setAttribute("d", getZukanPiecePath(shape));
  await flyToLanding(
    piece.layer,
    readLanding,
    piece.centerX,
    piece.centerY,
    piece.size,
  );
  document.documentElement.removeAttribute(CARRIES_TO_FRAME_ATTRIBUTE);
  for (const listener of Array.from(framedListeners)) listener();
  await fadeCarried(piece);
}

function pieceMask(piecePath: string): string {
  const svg = `<svg xmlns="${SVG_NAMESPACE}" viewBox="${ZUKAN_PIECE_VIEW_BOX}"><path d="${piecePath}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * 結果が開いたら、解き終えた画面を、結果のピースの形と位置へ絞る動き（screen-transition.css の `settle`）に、
 * ピースの形・位置・大きさを渡す。プレイへ入るときにピースの中へ入った動きの逆で、解いた画面がそのピースへ戻る。
 */
function pointSettleAtResultPiece(): void {
  const emblem = findShownResultEmblem();
  const style = document.documentElement.style;
  if (emblem === null) {
    style.removeProperty("--screen-piece-mask");
    return;
  }
  const { left, top, width, height } = emblem.getBoundingClientRect();
  style.setProperty(
    "--screen-piece-dx",
    `${left + width / 2 - window.innerWidth / 2}px`,
  );
  style.setProperty(
    "--screen-piece-dy",
    `${top + height / 2 - window.innerHeight / 2}px`,
  );
  // ピースになった画面は、短い辺を1辺とする。それを、結果に添えたピースの大きさまで小さくする。
  style.setProperty(
    "--screen-piece-scale",
    String(width / Math.min(window.innerWidth, window.innerHeight)),
  );
  style.setProperty(
    "--screen-piece-mask",
    pieceMask(playPiecePath ?? getZukanPiecePath(DEFAULT_ZUKAN_PIECE_SHAPE)),
  );
}

/** 解き終えて結果になる行き来。解いた画面を、結果のピースへ絞る。 */
export const zukanPieceSettleCarrier: ScreenTransitionCarrier = {
  after: pointSettleAtResultPiece,
};

/** 結果からゲームのホームへ戻る行き来。結果のピースを、台紙の元の場所へ運んではめる。 */
export const zukanPieceReturnCarrier: ScreenTransitionCarrier = {
  before() {
    liftResultPiece();
  },
  after: landPiece,
};

/**
 * 結果・プレイからパズル選択へ戻る行き来。結果から戻るときは、結果のピースを、額の台紙の元の場所へ運んではめる。
 * 運ぶピースがある間は、額と壁を動かさずに入れ替え、ピースが動く額を追わないようにする。
 */
export const zukanPieceHomeCarrier: ScreenTransitionCarrier = {
  before() {
    if (liftResultPiece()?.place != null) {
      document.documentElement.setAttribute(CARRIES_TO_FRAME_ATTRIBUTE, "");
    }
  },
  after: landPieceInFrame,
};

/** 結果から次のプレイへ進む行き来。続けて始める問題は台紙から抜いていないので、覚えていたピースの形を忘れる。 */
export const zukanPieceNextCarrier: ScreenTransitionCarrier = {
  before() {
    playPiecePath = null;
  },
};

export const _private = { ZUKAN_PIECE_TRANSIT_DURATION_MS };
