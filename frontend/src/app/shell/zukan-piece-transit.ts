import {
  findZukanPieceShape,
  getZukanPiecePath,
  ZUKAN_PIECE_VIEW_BOX,
} from "@/features/zukan/ui/zukan-piece-shape";
import { getZukanSolvedPiecePath } from "@/features/zukan/ui/zukan-play-piece";
import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import type { ScreenTransitionCarrier } from "@/lib/screen-transition";

/** 結果のピースを運ぶ、それぞれの動きの長さ（ms）。 */
const ZUKAN_PIECE_TRANSIT_DURATION_MS = {
  /** 台紙の元の場所へ、ピースを持ち上げて運ぶ。 */
  land: 560,
  /** 置いたピースを、台紙へ押し込む。 */
  press: 180,
  /** はめたピースを、台紙のマスへ替える。 */
  settle: 140,
  /** 次のプレイへ進むときに、ピースを「問題選択」へしまう。 */
  stow: 320,
} as const;

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
/** しまうときに縮める倍率。 */
const STOW_SCALE = 0.3;
/** しまう動きのうち、ピースを薄くし始めるところ。届く先が分かるまで、はっきり見せる。 */
const STOW_FADE_FROM = 0.75;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const RESULT_EMBLEM_SELECTOR = "[data-result-emblem]";
const RESULT_PIECE_SELECTOR = "[data-zukan-result-piece]";
const RESULT_COLLECTION_SELECTOR = "[data-result-collection]";
const RETURNED_SQUARE_SELECTOR = '[data-piece-shape][aria-current="true"]';
const FRAMED_SHEET_SELECTOR = "[data-sheet-columns]";
/** パズル選択の額の台紙へ運ぶピースがあることを、画面の行き来の動きへ伝える属性。 */
const CARRIES_TO_FRAME_ATTRIBUTE = "data-screen-carries-piece";

/** ピースの、台紙の中の場所。どのゲームの、どの難易度の台紙の、番号の順で何番目か。 */
type SheetPlace = { gameId: string; difficulty: string; index: number };

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

type FramedListener = (place: SheetPlace) => void;
const framedListeners = new Set<FramedListener>();

/** 結果から運んだピースが、パズル選択の額の台紙にはまったら、その場所を `listener` へ渡す。戻り値は、聞くのをやめる関数。 */
export function subscribeZukanPieceFramed(
  listener: FramedListener,
): () => void {
  framedListeners.add(listener);
  return () => framedListeners.delete(listener);
}

let carried: CarriedPiece | null = null;

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

// 運んでいる動きを止めてから外し、外したピースの動きの終わりを待たずに、運ぶ動きを終えられるようにする。
function dropCarried(): void {
  if (carried !== null) {
    for (const animation of carried.layer.getAnimations()) animation.cancel();
    carried.layer.remove();
  }
  carried = null;
  document.documentElement.removeAttribute(CARRIES_TO_FRAME_ATTRIBUTE);
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
  const { sheetGameId, sheetDifficulty, sheetIndex } = (piece as SVGElement)
    .dataset;
  carried = {
    layer,
    place:
      sheetGameId !== undefined &&
      sheetDifficulty !== undefined &&
      sheetIndex !== undefined
        ? {
            gameId: sheetGameId,
            difficulty: sheetDifficulty,
            index: Number(sheetIndex),
          }
        : null,
    centerX: left + width / 2,
    centerY: top + height / 2,
    size: width,
  };
  return carried;
}

/** 台紙のマスが、前回からの変化を見せる演出で、押されるのを待っているか。 */
function awaitsChangeStamp(square: HTMLElement): boolean {
  return square.dataset.changeStage === "waiting";
}

/**
 * はめたピースを、台紙のマスへ替える。
 * マスの色は問題ごとの最高評価で、ピースの色は今回の評価。初めて解いたときと最高評価を上げたときは、
 * 前回からの変化を見せる演出がそのマスを押し始めるまで、マスは前の姿のままなので、ピースを置いておく。
 * 押し始めたら、押す姿が同じ場所から持ち上がるので、ピースをそこで引き、置いたピースがそのまま押されるように見せる。
 * 最高評価を上げなかったときは、マスの色は変わらないので、はめたらすぐマスへ替える。
 */
async function releaseOntoSquare(
  layer: SVGSVGElement,
  square: HTMLElement,
): Promise<void> {
  const deadline = performance.now() + SQUARE_COLOR_WAIT_MS;
  while (
    layer.isConnected &&
    square.isConnected &&
    awaitsChangeStamp(square) &&
    performance.now() < deadline
  ) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  if (!layer.isConnected) return;
  await settled(
    layer.animate([{ opacity: 0 }], {
      duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.settle,
      easing: MOTION_EASING.exit,
      fill: "forwards",
    }),
  );
  if (carried?.layer === layer) {
    dropCarried();
  } else {
    layer.remove();
  }
}

async function findReturnedSquare(
  piece: CarriedPiece,
): Promise<HTMLElement | null> {
  const deadline = performance.now() + SQUARE_DRAW_WAIT_MS;
  while (carried === piece) {
    const square = document.querySelector<HTMLElement>(
      RETURNED_SQUARE_SELECTOR,
    );
    if (square !== null || performance.now() >= deadline) return square;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  return null;
}

function readSquareCenter(square: HTMLElement): Landing {
  const { left, top, width, height } = square.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2, width };
}

/**
 * 台紙は、開いた直後に列の数を決め直し、選んだマスが見えるよう自分でスクロールする。
 * マスの位置が続けて2回同じになるまで待ち、動いている途中のマスへ向けて運び始めない。
 */
async function landingSettled(
  layer: SVGSVGElement,
  readLanding: () => Landing,
): Promise<void> {
  const deadline = performance.now() + SQUARE_SETTLE_WAIT_MS;
  let previous = readLanding();
  while (layer.isConnected && performance.now() < deadline) {
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
 * 運ぶ先が動いたら、動いた分だけピースをずらし続ける。ピースを消すまで続け、戻り値は追い始めたときの運ぶ先。
 * 台紙は、選んだ問題の詳細が出るときや、前回からの変化を見せるときに自分でスクロールする。運んでいる間も、置いた後も、ピースをマスから離さない。
 */
function followLanding(
  layer: SVGSVGElement,
  readLanding: () => Landing,
): Landing {
  const start = readLanding();
  function follow() {
    if (!layer.isConnected) return;
    const { x, y, width } = readLanding();
    // 描き直しで運ぶ先が外れている間は、最後の位置に置いておく。
    if (width > 0) {
      layer.style.translate = `${x - start.x}px ${y - start.y}px`;
    }
    requestAnimationFrame(follow);
  }
  requestAnimationFrame(follow);
  return start;
}

async function pressIntoSheet(
  layer: SVGSVGElement,
  landedTransform: string,
  scale: number,
): Promise<void> {
  await settled(
    layer.animate(
      [
        { transform: `${landedTransform} scale(${scale})` },
        { transform: `${landedTransform} scale(${scale * PRESS_SCALE})` },
        { transform: `${landedTransform} scale(${scale})` },
      ],
      {
        duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.press,
        easing: MOTION_EASING.standard,
      },
    ),
  );
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
  await landingSettled(layer, readLanding);
  if (!layer.isConnected) return;
  const landing = followLanding(layer, readLanding);
  const { dx, dy, scale } = flightTo(landing, fromX, fromY, size);
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
  if (!layer.isConnected) return;
  const landedTransform = `translate(${dx}px, ${dy}px)`;
  layer.style.transform = `${landedTransform} scale(${scale})`;
  flight.cancel();
  await pressIntoSheet(layer, landedTransform, scale);
}

/** ゲームのホームが開いたら、結果から運んだピースを台紙の元の場所へはめる。場所が見つからなければ、その場で消す。 */
async function landPiece(): Promise<void> {
  const piece = carried;
  if (piece === null) return;
  const { layer, centerX, centerY, size } = piece;
  const square = await findReturnedSquare(piece);
  if (carried !== piece) return;
  if (square === null) {
    await fadeCarried(piece);
    return;
  }
  square.scrollIntoView?.({ block: "nearest" });
  const shape = square.dataset.pieceShape;
  if (shape !== undefined) {
    reshapeCarried(layer, shape);
  }
  await flyToLanding(
    layer,
    () => readSquareCenter(square),
    centerX,
    centerY,
    size,
  );
  if (carried === piece) void releaseOntoSquare(layer, square);
}

/** 運ぶピースの輪郭を、はめる場所の形へ替える。 */
function reshapeCarried(layer: SVGSVGElement, shape: string): void {
  layer.querySelector("path")?.setAttribute("d", getZukanPiecePath(shape));
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
 * パズル選択の額の台紙の中の、ピースの場所。額の台紙は、ゲームのホームの台紙と同じ並びで、額の中に見えている行だけを見せる。
 * 額の台紙が別のゲーム・別の難易度のときと、ピースが額の中に見えていないときは `null`。
 */
function findFramedLanding(
  place: SheetPlace,
): { readLanding: () => Landing; shape: string } | null {
  const sheet = document.querySelector<HTMLElement>(
    `[data-screen-shared="surface"]${FRAMED_SHEET_SELECTOR}`,
  );
  const paper = sheet?.parentElement;
  if (
    !sheet ||
    !paper ||
    place.index < 0 ||
    sheet.dataset.sheetGameId !== place.gameId ||
    sheet.dataset.sheetDifficulty !== place.difficulty
  ) {
    return null;
  }
  const columnCount = Number(sheet.dataset.sheetColumns);
  const problemCount = Number(sheet.dataset.sheetProblemCount);
  const column = place.index % columnCount;
  const row = Math.floor(place.index / columnCount);
  function readLanding(): Landing {
    const { left, top, width } = (sheet as HTMLElement).getBoundingClientRect();
    const squareSize = width / columnCount;
    return {
      x: left + (column + 0.5) * squareSize,
      y: top + (row + 0.5) * squareSize,
      width: squareSize,
    };
  }
  const { y, width } = readLanding();
  const shown = paper.getBoundingClientRect();
  if (y - width / 2 < shown.top || y + width / 2 > shown.bottom) {
    return null;
  }
  return {
    readLanding,
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
  const { readLanding, shape } = landing;
  reshapeCarried(piece.layer, shape);
  await flyToLanding(
    piece.layer,
    readLanding,
    piece.centerX,
    piece.centerY,
    piece.size,
  );
  if (carried !== piece) return;
  const { place } = piece;
  if (place !== null) {
    for (const listener of Array.from(framedListeners)) listener(place);
  }
  await fadeCarried(piece);
}

/** 次のプレイへ進む前に、結果のピースを「問題選択」へしまう。 */
async function stowPiece(): Promise<void> {
  const collection = document.querySelector(RESULT_COLLECTION_SELECTOR);
  const piece = collection === null ? null : liftResultPiece();
  if (collection === null || piece === null) return;
  const { left, top, width, height } = collection.getBoundingClientRect();
  const dx = left + width / 2 - piece.centerX;
  const dy = top + height / 2 - piece.centerY;
  await settled(
    piece.layer.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { opacity: 1, offset: STOW_FADE_FROM },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${STOW_SCALE})`,
          opacity: 0,
        },
      ],
      {
        duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.stow,
        easing: MOTION_EASING.standard,
        fill: "forwards",
      },
    ),
  );
  if (carried === piece) dropCarried();
}

function pieceMask(piecePath: string): string {
  const svg = `<svg xmlns="${SVG_NAMESPACE}" viewBox="${ZUKAN_PIECE_VIEW_BOX}"><path d="${piecePath}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * 結果が開いたら、解き終えた画面を、結果のピースの形と位置へ絞る動き（screen-transitions.css の `settle`）に、
 * ピースの形・位置・大きさを渡す。
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
    pieceMask(
      getZukanSolvedPiecePath(
        emblem.querySelector<SVGElement>(RESULT_PIECE_SELECTOR)?.dataset
          .sheetProblemId,
      ),
    ),
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
  skip: dropCarried,
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
  skip: dropCarried,
};

/** 結果から次のプレイへ進む行き来。結果のピースを「問題選択」へしまってから進む。 */
export const zukanPieceStowCarrier: ScreenTransitionCarrier = {
  before: stowPiece,
  skip: dropCarried,
};

const PLAY_ENTRY_PIECE_SELECTOR = "[data-zukan-play-entry-dive]";
/** ピースへ寄り切ったときに、ピースが画面を覆う余裕。画面の長い辺に対する比。 */
const PIECE_DIVE_COVER = 1.3;

/**
 * ゲームのホームからプレイへ入る行き来。台紙の入るピースへ寄っていき、ピースが画面を覆った所でプレイになる動き（screen-transitions.css の `enter-piece`）に、
 * ピースの位置と、寄り切る倍率を渡す。
 * 入るピースの印が無ければ、動かさずに入る。
 */
export const zukanPieceEnterCarrier: ScreenTransitionCarrier = {
  before() {
    const piece = document.querySelector(PLAY_ENTRY_PIECE_SELECTOR);
    const style = document.documentElement.style;
    if (piece === null) {
      style.setProperty("--screen-piece-entering", "0");
      return;
    }
    const { left, top, width, height } = piece.getBoundingClientRect();
    style.setProperty("--screen-piece-entering", "1");
    style.setProperty("--screen-piece-x", `${left + width / 2}px`);
    style.setProperty("--screen-piece-y", `${top + height / 2}px`);
    style.setProperty(
      "--screen-piece-zoom",
      String(
        (Math.max(window.innerWidth, window.innerHeight) * PIECE_DIVE_COVER) /
          width,
      ),
    );
  },
};
