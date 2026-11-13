import { MOTION_EASING, prefersReducedMotion } from "@/lib/motion";
import type { ScreenTransitionCarrier } from "@/lib/screen-transition";
import {
  getZukanPiecePath,
  ZUKAN_PIECE_VIEW_BOX,
} from "@/zukan/ui/GameHomeScreen/zukan-piece-shape";

/**
 * 1問は台紙の1ピース。台紙から抜いたピースの中へ入って解き、解き終えるとそのピースに評価の色が付き、台紙の元の場所へ戻る。
 * ここは、プレイから結果、結果からゲームのホームと次のプレイへの行き来で、そのピースを画面をまたいで繋ぐ。
 */

/** 結果のピースを運ぶ、それぞれの動きの長さ（ms）。 */
const ZUKAN_PIECE_TRANSIT_DURATION_MS = {
  /** 台紙の元の場所へ、ピースを運んではめる。 */
  land: 460,
  /** はめたピースを、台紙のマスへ替える。 */
  settle: 140,
  /** 次の問題へ進むときに、ピースを「問題選択」へしまう。 */
  stow: 280,
} as const;

/** 台紙から抜いていない問題（結果から続けて始めた問題など）に使う、ピースの形。 */
export const DEFAULT_ZUKAN_PIECE_SHAPE = "1,-1,1,-1";
/** はめたピースを、マスに色が入るのを待って置いておく長さの上限（ms）。 */
const SQUARE_COLOR_WAIT_MS = 1600;
/** しまうときに縮める倍率。 */
const STOW_SCALE = 0.3;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const RESULT_EMBLEM_SELECTOR = "[data-result-emblem]";
const RESULT_PIECE_SELECTOR = "[data-zukan-result-piece]";
const RESULT_COLLECTION_SELECTOR = "[data-result-collection]";
const RETURNED_SQUARE_SELECTOR = '[data-piece-shape][aria-current="true"]';

type PlayPiece = { piecePath: string; pictogramSvg: string };
type CarriedPiece = {
  layer: SVGSVGElement;
  centerX: number;
  centerY: number;
  size: number;
};

let playPiece: PlayPiece | null = null;
let carried: CarriedPiece | null = null;

/** プレイへ入るときに抜いたピースを覚える。解き終えたときに、同じ形のピースへ色を付けて見せる。 */
export function rememberZukanPlayPiece(piece: PlayPiece): void {
  playPiece = piece;
}

/** プレイへ入るときに抜いたピースの輪郭。抜かずに始めた問題では `null`。 */
export function getZukanPlayPiecePath(): string | null {
  return playPiece?.piecePath ?? null;
}

function canAnimate(): boolean {
  return typeof document.body.animate === "function" && !prefersReducedMotion();
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
  const emblem = document.querySelector<HTMLElement>(RESULT_EMBLEM_SELECTOR);
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
    // 画面の行き来の動きの上に残るよう、画面とは別に写させる。
    viewTransitionName: "zukan-carried-piece",
  });
  layer.style.setProperty("--game-pictogram-strong", "var(--background)");
  layer.style.setProperty("--game-pictogram-soft", "var(--background)");
  document.body.append(layer);
  emblem.style.visibility = "hidden";
  carried = {
    layer,
    centerX: left + width / 2,
    centerY: top + height / 2,
    size: width,
  };
  return carried;
}

function readSquareColor(square: HTMLElement): string {
  const face = square.querySelector("svg");
  return face === null ? "" : getComputedStyle(face).color;
}

/**
 * はめたピースを、台紙のマスへ替える。マスは、前回からの変化を見せる演出が色を入れるまで前の姿のままなので、
 * はめたピースが色なしへ戻って見えないよう、マスに色が入るまでピースを置いておく。
 */
async function releaseOntoSquare(
  layer: SVGSVGElement,
  square: HTMLElement,
): Promise<void> {
  const landedColor = readSquareColor(square);
  const deadline = performance.now() + SQUARE_COLOR_WAIT_MS;
  while (
    square.isConnected &&
    readSquareColor(square) === landedColor &&
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

/** ゲームのホームが開いたら、結果から運んだピースを台紙の元の場所へはめる。場所が見つからなければ、その場で消す。 */
async function landPiece(): Promise<void> {
  const piece = carried;
  if (piece === null) return;
  const { layer, centerX, centerY, size } = piece;
  const square = document.querySelector<HTMLElement>(RETURNED_SQUARE_SELECTOR);
  if (square === null) {
    await settled(
      layer.animate([{ opacity: 0 }], {
        duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.settle,
        easing: MOTION_EASING.exit,
        fill: "forwards",
      }),
    );
    if (carried === piece) dropCarried();
    return;
  }
  square.scrollIntoView({ block: "nearest" });
  const shape = square.dataset.pieceShape;
  if (shape !== undefined) {
    layer.querySelector("path")?.setAttribute("d", getZukanPiecePath(shape));
  }
  const { left, top, width, height } = square.getBoundingClientRect();
  const dx = left + width / 2 - centerX;
  const dy = top + height / 2 - centerY;
  await settled(
    layer.animate(
      [
        { transform: "translate(0, 0) scale(1)" },
        { transform: `translate(${dx}px, ${dy}px) scale(${width / size})` },
      ],
      {
        duration: ZUKAN_PIECE_TRANSIT_DURATION_MS.land,
        easing: MOTION_EASING.standard,
        fill: "forwards",
      },
    ),
  );
  void releaseOntoSquare(layer, square);
}

/** 次の問題へ進む前に、結果のピースを「問題選択」へしまう。 */
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
 * 結果が開いたら、解き終えた画面を、結果のピースの形と位置へ絞る動き（screen-transition.css の `settle`）に、
 * ピースの形・位置・大きさを渡す。プレイへ入るときにピースの中へ入った動きの逆で、解いた画面がそのピースへ戻る。
 */
function pointSettleAtResultPiece(): void {
  const emblem = document.querySelector(RESULT_EMBLEM_SELECTOR);
  const style = document.documentElement.style;
  if (emblem === null) {
    style.removeProperty("--screen-piece-mask");
    return;
  }
  const { left, top, width, height } = emblem.getBoundingClientRect();
  style.setProperty("--screen-piece-x", `${left + width / 2}px`);
  style.setProperty("--screen-piece-y", `${top + height / 2}px`);
  style.setProperty("--screen-piece-size", `${width * 2}px`);
  style.setProperty(
    "--screen-piece-mask",
    pieceMask(
      playPiece?.piecePath ?? getZukanPiecePath(DEFAULT_ZUKAN_PIECE_SHAPE),
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
};

/** 結果から次のプレイへ進む行き来。結果のピースを「問題選択」へしまってから進む。 */
export const zukanPieceStowCarrier: ScreenTransitionCarrier = {
  before: stowPiece,
};

export const _private = { ZUKAN_PIECE_TRANSIT_DURATION_MS };
