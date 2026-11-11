import {
  MOTION_DURATION_MS,
  MOTION_EASING,
  prefersReducedMotion,
} from "@/lib/motion";
import { createMotionCopy } from "@/lib/motion-copy";

/** 選んだ問題の欄の中の、盤面を描いている枠と、番号と操作の欄を見分ける属性。 */
const PART_ATTRIBUTE = "data-selected-problem-part";
const BOARD_SELECTOR = `[${PART_ATTRIBUTE}="board"]`;
const INFO_SELECTOR = `[${PART_ATTRIBUTE}="info"]`;

/** 盤面が、選んだピースの位置と大きさから欄へ広がりきるまでの時間と、ピースへ戻りきるまでの時間。 */
const BOARD_REVEAL_MS = 240;
const BOARD_CONCEAL_MS = 200;
/** 広がるときは、ピースから素早く離れて欄の手前で減速する。戻るときは、ゆっくり離れてピースへ吸い込まれる。 */
const BOARD_REVEAL_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const BOARD_CONCEAL_EASING = "cubic-bezier(0.4, 0, 0.6, 1)";
/** ピースへ戻った盤面が、ピースに重なって消え始める、戻るまでの時間に対する比。 */
const BOARD_CONCEAL_FADE_FROM = 0.7;
/** 番号と操作は、欄の面と同時に、少しだけ浮かせて現す。面だけのコマを作らないよう、遅らせない。 */
const INFO_REVEAL_KEYFRAMES: Keyframe[] = [
  { opacity: 0.6, transform: "translateY(0.25rem)" },
  { opacity: 1, transform: "none" },
];

type SelectedProblemPart = "board" | "info";

/** 選んだ問題の欄の部分に付ける属性。盤面がピースから広がる・ピースへ戻るときに、部分ごとに動かすのに使う。 */
export function selectedProblemPartProps(part: SelectedProblemPart) {
  return { [PART_ATTRIBUTE]: part };
}

function canAnimate(element: Element): boolean {
  return !prefersReducedMotion() && typeof element.animate === "function";
}

/** 枠の左上を原点に、枠をピースの位置と大きさへ重ねる変形。 */
function toPieceTransform(frame: DOMRect, piece: DOMRect): string {
  const scale = piece.width / frame.width;
  const x =
    piece.left + piece.width / 2 - (frame.left + (frame.width * scale) / 2);
  const y =
    piece.top + piece.height / 2 - (frame.top + (frame.height * scale) / 2);
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

/**
 * 選んだ問題の欄を、選んだピースから現す。欄の面はすぐに出し、盤面はピースの位置と大きさから欄へ広がり、番号と操作は面と同時に素早く現れる。
 * ピースが盤面になって見えるようにし、どのピースの盤面かを分からせる。動きを減らす設定と、動かせない環境では、何もしない。
 */
export function revealSelectedProblem(
  panel: HTMLElement,
  piece: HTMLElement,
): void {
  const board = panel.querySelector(BOARD_SELECTOR);
  const info = panel.querySelector(INFO_SELECTOR);
  if (board === null || !canAnimate(board)) {
    return;
  }
  const frame = board.getBoundingClientRect();
  if (frame.width === 0) {
    return;
  }
  board.animate(
    [
      {
        transformOrigin: "top left",
        transform: toPieceTransform(frame, piece.getBoundingClientRect()),
      },
      { transformOrigin: "top left", transform: "none" },
    ],
    { duration: BOARD_REVEAL_MS, easing: BOARD_REVEAL_EASING },
  );
  info?.animate(INFO_REVEAL_KEYFRAMES, {
    duration: MOTION_DURATION_MS.fast,
    easing: MOTION_EASING.enter,
  });
}

const LEAVING_PREVIEW_SELECTOR = "[data-leaving-preview]";

/**
 * 閉じる前の選んだ問題の盤面の写しを、同じ所の手前に置く。閉じたあとの画面の上で、盤面をピースへ戻すのに使う。
 * 欄の面と番号・操作は写さない。閉じたらすぐ下のジグソーと「ランダムに遊ぶ」を見せ、面だけが残るコマを作らないため。
 * 動きを減らす設定と、動かせない環境と、盤面が無いときは `null`。
 */
export function detachSelectedProblemBoard(
  panel: HTMLElement,
): HTMLElement | null {
  const board = panel.querySelector<HTMLElement>(BOARD_SELECTOR);
  if (board === null || !canAnimate(board)) {
    return null;
  }
  const rect = board.getBoundingClientRect();
  if (rect.width === 0) {
    return null;
  }
  const copy = createMotionCopy(board, rect);
  // 選び替えた直後は、薄れていく前の盤面も枠の中に残っている。写しでは動きを止めるので、残すと2つの盤面が重なって見える。
  for (const leaving of copy.querySelectorAll(LEAVING_PREVIEW_SELECTOR)) {
    leaving.remove();
  }
  copy.style.transformOrigin = "top left";
  document.body.append(copy);
  return copy;
}

function toConcealKeyframes(frame: DOMRect, piece: DOMRect): Keyframe[] {
  const atPiece = toPieceTransform(frame, piece);
  return [
    { transform: "none", opacity: 1 },
    { transform: atPiece, opacity: 1, offset: BOARD_CONCEAL_FADE_FROM },
    { transform: atPiece, opacity: 0 },
  ];
}

/**
 * `detachSelectedProblemBoard` で置いた盤面の写しをピースへ戻して、写しを除く。
 * ピースが見つからなければ、その場で消す。
 */
export function concealSelectedProblemBoard(
  detached: HTMLElement,
  piece: HTMLElement | null,
): void {
  function remove() {
    detached.remove();
  }
  const frame = detached.getBoundingClientRect();
  const conceal =
    piece === null || !piece.isConnected
      ? detached.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: MOTION_DURATION_MS.fast,
          easing: MOTION_EASING.exit,
          fill: "forwards",
        })
      : detached.animate(
          toConcealKeyframes(frame, piece.getBoundingClientRect()),
          {
            duration: BOARD_CONCEAL_MS,
            easing: BOARD_CONCEAL_EASING,
            fill: "forwards",
          },
        );
  conceal.finished.then(remove, remove);
}
