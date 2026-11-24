import { readZukanSheetView } from "@/app/game-home/GameHomeScreen/zukan-sheet-view";
import { rememberZukanPlayPiece } from "@/features/zukan/ui/zukan-play-piece";
import { prefersReducedMotion } from "@/lib/motion";

const ZUKAN_PLAY_ENTRY_DURATION_MS = {
  /** 台紙を送って、入るピースを見える所へ運ぶ。 */
  spin: 360,
} as const;

/** 入るピースのマスに付ける属性。入るピースが、台紙のどれかを見せる。 */
const CHOSEN_PIECE_ATTRIBUTE = "data-zukan-play-entry-piece";
/** 画面の行き来の動きが寄っていくマスに付ける属性。動きを飛ばして始めるときは付けない。 */
const DIVED_PIECE_ATTRIBUTE = "data-zukan-play-entry-dive";

const SKIP_CLICK_SWALLOW_MS = 500;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

type ZukanPlayEntryControl = { skip: () => void; cancel: () => void };

export type ZukanPlayEntry = {
  /** 入るピースのマス。台紙のスクロール領域の中にある。 */
  square: HTMLElement;
  /** 台紙のスクロール領域。 */
  scroller: HTMLElement;
  /** 入る問題の ID。 */
  problemId: string;
  /** ピースの輪郭の SVG パス。マスの左上を原点、1辺を 1 とする。 */
  piecePath: string;
  /**
   * 入る前に、台紙を送ってピースを見えている高さの中央へ運ぶか。ゲームが選んだ問題を、台紙のどこのピースかが分かるようにする。
   * 運ばないときも、ピースが台紙の見えている範囲の外にあれば、見える所へ送ってから入る。
   */
  spinsToPiece: boolean;
  /** プレイを始めるとき。演出を飛ばしたときもすぐに呼ぶ。一度だけ呼ぶ。 */
  onEnter: () => void;
};

function canAnimate(): boolean {
  return (
    typeof document.startViewTransition === "function" &&
    !prefersReducedMotion()
  );
}

function findCenteredScrollTop(
  square: HTMLElement,
  scroller: HTMLElement,
): number {
  const squareRect = square.getBoundingClientRect();
  const view = readZukanSheetView(scroller);
  const offset =
    squareRect.top + squareRect.height / 2 - (view.top + view.bottom) / 2;
  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
  return Math.min(Math.max(scroller.scrollTop + offset, 0), maxScrollTop);
}

function isFullyVisible(square: HTMLElement, scroller: HTMLElement): boolean {
  const squareRect = square.getBoundingClientRect();
  const view = readZukanSheetView(scroller);
  return (
    squareRect.top >= view.top &&
    squareRect.top + squareRect.height <= view.bottom
  );
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/**
 * 戻り値の `skip` は演出を飛ばしてすぐ始め、`cancel` は始める前なら始めずにやめる。始めたあとの `cancel` は何もしない。
 */
export function playZukanPlayEntry({
  square,
  scroller,
  problemId,
  piecePath,
  spinsToPiece,
  onEnter,
}: ZukanPlayEntry): ZukanPlayEntryControl {
  rememberZukanPlayPiece(problemId, piecePath);
  if (!canAnimate()) {
    onEnter();
    return { skip() {}, cancel() {} };
  }

  let hasEntered = false;
  let spinFrame = 0;
  square.setAttribute(CHOSEN_PIECE_ATTRIBUTE, "");

  function stopWaiting() {
    cancelAnimationFrame(spinFrame);
    window.removeEventListener("pointerdown", skipByPointer, true);
    window.removeEventListener("keydown", skipByKey, true);
  }

  function cancel() {
    if (hasEntered) {
      return;
    }
    hasEntered = true;
    stopWaiting();
    square.removeAttribute(CHOSEN_PIECE_ATTRIBUTE);
  }

  function enter() {
    if (hasEntered) {
      return;
    }
    hasEntered = true;
    stopWaiting();
    onEnter();
  }

  function enterIntoPiece() {
    if (hasEntered) {
      return;
    }
    square.setAttribute(DIVED_PIECE_ATTRIBUTE, "");
    enter();
  }

  // 飛ばした押下の続きのクリックが、移った先のプレイ画面の盤面を操作しないよう、そのクリックを1回だけ捨てる。
  function skipByPointer(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    function swallowClick(event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
    }
    window.addEventListener("click", swallowClick, {
      capture: true,
      once: true,
    });
    setTimeout(
      () => window.removeEventListener("click", swallowClick, true),
      SKIP_CLICK_SWALLOW_MS,
    );
    enter();
  }

  function skipByKey(event: KeyboardEvent) {
    if (!event.repeat && !event.isComposing && !MODIFIER_KEYS.has(event.key)) {
      enter();
    }
  }

  function spin() {
    const from = scroller.scrollTop;
    const to =
      spinsToPiece || !isFullyVisible(square, scroller)
        ? findCenteredScrollTop(square, scroller)
        : from;
    if (Math.abs(to - from) < 1) {
      enterIntoPiece();
      return;
    }
    const startedAt = performance.now();
    function step(now: number) {
      const progress = Math.min(
        (now - startedAt) / ZUKAN_PLAY_ENTRY_DURATION_MS.spin,
        1,
      );
      scroller.scrollTop = from + (to - from) * easeOutCubic(progress);
      if (progress < 1) {
        spinFrame = requestAnimationFrame(step);
      } else {
        enterIntoPiece();
      }
    }
    spinFrame = requestAnimationFrame(step);
  }

  // 動きの間、ゲームのホームは操作を受け付けないので、飛ばす操作は画面のどこでも受けられるよう window で受ける。
  window.addEventListener("pointerdown", skipByPointer, true);
  window.addEventListener("keydown", skipByKey, true);

  spin();

  return { skip: enter, cancel };
}

export const _private = {
  findCenteredScrollTop,
  ZUKAN_PLAY_ENTRY_DURATION_MS,
};
