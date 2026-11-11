import { prefersReducedMotion } from "@/lib/motion";
import { createMotionCopy } from "@/lib/motion-copy";

/** プレイ画面とゲームのホームの間で重ねて動かす、1問の盤面。 */
export const PLAY_ENTRY_BOARD_SELECTOR = "[data-play-entry-board]";
/** プレイ画面の外枠（`GamePlayFrame`）の中の盤面。ゲームのホームの盤面と重ねる相手。 */
export const PLAY_FRAME_BOARD_SELECTOR = `[data-play-frame] ${PLAY_ENTRY_BOARD_SELECTOR}`;
/** プレイ画面を離れてから、ゲームのホームが盤面の位置を受け取るまでに許す時間。これを過ぎた位置は、別の行き来のものとして捨てる。 */
const HANDOFF_LIMIT_MS = 1000;
/** 盤面が、プレイ画面での位置と大きさから、ゲームのホームの盤面の所へ縮んで収まるまでの時間。 */
const SETTLE_MS = 380;
const SETTLE_EASING = "cubic-bezier(0.3, 0, 0.1, 1)";
/** 縮んでいく盤面が近づいた要素が消えきるまでの時間と、通り過ぎた要素が現れきるまでの時間。 */
const YIELD_HIDE_MS = 60;
const YIELD_REVEAL_MS = 120;
/** 縮んでいく盤面が要素と重なるかを確かめる、収まるまでの間の時点の数。 */
const PATH_SAMPLE_COUNT = 24;

type LeftPlayBoard = { from: DOMRect; leftAt: number };

let leftPlayBoard: LeftPlayBoard | null = null;

/**
 * プレイ画面を離れてゲームのホームへ移る直前に、盤面の位置と大きさを控える。
 * 盤面を描いていない画面（結果など）から移るときと、動きを減らす設定では、何も控えない。
 */
export function leavePlayBoard(): void {
  const board = document.querySelector(PLAY_FRAME_BOARD_SELECTOR);
  leftPlayBoard =
    board === null || prefersReducedMotion()
      ? null
      : { from: board.getBoundingClientRect(), leftAt: performance.now() };
}

function intersects(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

/** 縮んでいく盤面が要素と重なる間（ms）。最初に重なる時点から、最後に重なった次の時点まで。 */
type OverlapSpan = { fromMs: number; untilMs: number };

/**
 * 縮んでいく盤面と重なる要素ごとの、重なる間。重ならない要素は持たない。
 * 動きを止めて時点ごとに盤面を測る。イージングを写して計算すると、動きの定義と食い違うため。
 */
function findOverlapSpans(
  settle: Animation,
  flyingBoard: Element,
  elements: readonly Element[],
): Map<Element, OverlapSpan> {
  const spans = new Map<Element, OverlapSpan>();
  if (elements.length === 0) {
    return spans;
  }
  const rects = elements.map((element) => element.getBoundingClientRect());
  const step = SETTLE_MS / PATH_SAMPLE_COUNT;
  settle.pause();
  for (let sample = 0; sample <= PATH_SAMPLE_COUNT; sample += 1) {
    const time = step * sample;
    settle.currentTime = time;
    const board = flyingBoard.getBoundingClientRect();
    elements.forEach((element, index) => {
      const rect = rects[index];
      if (rect !== undefined && rect.width > 0 && intersects(board, rect)) {
        spans.set(element, {
          fromMs: spans.get(element)?.fromMs ?? time,
          untilMs: Math.min(SETTLE_MS, time + step),
        });
      }
    });
  }
  settle.currentTime = 0;
  settle.play();
  return spans;
}

/** 盤面が重なる間だけ要素を見せずに置く動き。重なり始める前に消しきり、通り過ぎてから現す。初めから重なる要素は、初めから見せない。 */
function toYieldKeyframes({ fromMs, untilMs }: OverlapSpan): {
  keyframes: Keyframe[];
  duration: number;
} {
  const duration = untilMs + YIELD_REVEAL_MS;
  const hidden: Keyframe[] = [
    { opacity: 0, offset: untilMs / duration },
    { opacity: 1, offset: 1 },
  ];
  if (fromMs === 0) {
    return { duration, keyframes: [{ opacity: 0, offset: 0 }, ...hidden] };
  }
  return {
    duration,
    keyframes: [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: Math.max(0, fromMs - YIELD_HIDE_MS) / duration },
      { opacity: 0, offset: fromMs / duration },
      ...hidden,
    ],
  };
}

/**
 * 盤面の写しを、プレイ画面での盤面の大きさで描いて、写しの中の盤面がプレイ画面の盤面に重なる所へ、画面の手前に置く。
 * 小さな盤面を引き伸ばすと、枠の線が太く見えるため、大きく描いて縮める。
 */
function createFlyingBoard(
  preview: HTMLElement,
  frame: DOMRect,
  homeBoard: DOMRect,
  from: DOMRect,
): HTMLElement {
  const scale = from.width / homeBoard.width;
  const box = {
    left: from.left - (homeBoard.left - frame.left) * scale,
    top: from.top - (homeBoard.top - frame.top) * scale,
    width: frame.width * scale,
    height: frame.height * scale,
  };
  const flying = createMotionCopy(preview, box);
  flying.style.transformOrigin = "top left";
  document.body.append(flying);
  // 大きく描いた盤面が、ちょうど比例して大きくならないゲームもあるので、写しの中の盤面を測って重ね直す。
  const shown = flying
    .querySelector(PLAY_ENTRY_BOARD_SELECTOR)
    ?.getBoundingClientRect();
  if (shown !== undefined && shown.width > 0) {
    flying.style.left = `${box.left + from.left - shown.left}px`;
    flying.style.top = `${box.top + from.top - shown.top}px`;
  }
  return flying;
}

/**
 * ゲームのホームの盤面を、プレイ画面で盤面があった位置と大きさから、今の所へ縮めて収める。解いていた盤面から、一歩引いて戻ってきたことを見せる。
 * ゲームのホームは初めから描いておき、盤面の写しだけを手前に重ねて縮める。元の盤面は、写しが収まるまで見せずに置く。
 * `preview` は、盤面を描いている枠。
 * `yielding` は、縮んでいく盤面と重なると読みにくくなる文字や操作。盤面と重なる間だけ見せずに置き、重なる前と通り過ぎた後は見せる。
 * 控えた位置が無いとき、ゲームのホームの盤面がまだ描かれていないとき、動かせない環境では、何もしない。
 * 戻り値は、途中でやめる関数。
 */
export function settlePlayBoard(
  preview: HTMLElement,
  yielding: Iterable<Element> = [],
): () => void {
  const left = leftPlayBoard;
  const board = preview.querySelector(PLAY_ENTRY_BOARD_SELECTOR);
  if (
    left === null ||
    board === null ||
    typeof preview.animate !== "function" ||
    performance.now() - left.leftAt > HANDOFF_LIMIT_MS
  ) {
    return function cancelNothing() {};
  }
  const { from } = left;
  const to = board.getBoundingClientRect();
  const frame = preview.getBoundingClientRect();
  if (from.width === 0 || to.width === 0) {
    return function cancelNothing() {};
  }
  const flying = createFlyingBoard(preview, frame, to, from);
  // 盤面の中に visibility を指定した要素があっても隠れるよう、不透明度で隠す。
  preview.style.opacity = "0";
  const rest = flying.getBoundingClientRect();
  const settle = flying.animate(
    [
      { transform: "none" },
      {
        transform: `translate(${frame.left - rest.left}px, ${frame.top - rest.top}px) scale(${frame.width / rest.width})`,
      },
    ],
    { duration: SETTLE_MS, easing: SETTLE_EASING, fill: "forwards" },
  );
  const reveals = [
    ...findOverlapSpans(
      settle,
      flying.querySelector(PLAY_ENTRY_BOARD_SELECTOR) ?? flying,
      [...yielding],
    ),
  ].map(([element, span]) => {
    const { keyframes, duration } = toYieldKeyframes(span);
    return element.animate(keyframes, { duration, easing: "linear" });
  });

  function removeFlyingBoard() {
    flying.remove();
    preview.style.opacity = "";
  }

  settle.finished.then(
    function landOnHomeBoard() {
      removeFlyingBoard();
      leftPlayBoard = null;
    },
    // 途中でやめたときは、控えた位置を残す。開発時の StrictMode が effect をやり直しても、もう一度収められるようにする。
    function keepLeftBoard() {},
  );

  return function cancel() {
    settle.cancel();
    for (const reveal of reveals) {
      reveal.cancel();
    }
    removeFlyingBoard();
  };
}

export const _private = {
  HANDOFF_LIMIT_MS,
  SETTLE_MS,
  YIELD_HIDE_MS,
  YIELD_REVEAL_MS,
  PATH_SAMPLE_COUNT,
  reset() {
    leftPlayBoard = null;
  },
};
