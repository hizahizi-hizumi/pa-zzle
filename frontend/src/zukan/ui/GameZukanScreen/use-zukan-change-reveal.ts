import { type RefObject, useEffect, useRef, useState } from "react";

import type { DifficultyLevel } from "@/games/difficulty";
import {
  findZukanFollowScrollTop,
  findZukanRevealScrollTop,
  findZukanStampParts,
  groupZukanStampSlots,
  isZukanSpanInView,
  isZukanStampTargetVisible,
  joinZukanVerticalSpans,
  planZukanStamps,
  playZukanStamp,
  type ZukanChangeAppearance,
  type ZukanVerticalSpan,
} from "@/zukan/ui/GameZukanScreen/zukan-change-reveal";

/** 変化したマスを押していく演出の進み。押す回の数で表す。 */
export type ZukanStampProgress = {
  /** 押し始めた回の数。 */
  startedSlotCount: number;
  /** マスに着いた回の数。 */
  landedSlotCount: number;
};

type ProgressState = ZukanStampProgress & { difficulty: DifficultyLevel };

const notStarted: ZukanStampProgress = {
  startedSlotCount: 0,
  landedSlotCount: 0,
};

/** なめらかなスクロールの終わりを待つ上限。終わりを知らせない環境や、動かずに終わったときに先へ進む。 */
const SCROLL_SETTLE_MAX_MS = 600;
/** 押してから離すまでに動いた距離がこれ未満なら、スクロールではなくタップとみなす。 */
const TAP_SLOP_PX = 10;
/** 演出を飛ばしたタップに続くクリックを待つ上限。 */
const SKIP_TAP_CLICK_WAIT_MS = 600;

function cancelNothing() {}

/**
 * 次のクリックを1回だけ、どこにも届かせない。演出を飛ばしたタップで、マスを選んだりリンクを開いたりしないようにする。
 * 次に押し始めたときと、待つ上限を過ぎたときには、何もせずにやめる。戻り値はやめる関数。
 */
function suppressNextClick(): () => void {
  function swallow(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    stop();
  }
  function stop() {
    document.removeEventListener("click", swallow, true);
    document.removeEventListener("pointerdown", stop, true);
    window.clearTimeout(timer);
  }
  document.addEventListener("click", swallow, true);
  document.addEventListener("pointerdown", stop, true);
  const timer = window.setTimeout(stop, SKIP_TAP_CLICK_WAIT_MS);
  return stop;
}

function readSpan(element: Element): ZukanVerticalSpan {
  const { top, bottom } = element.getBoundingClientRect();
  return { top, bottom };
}

/**
 * 台紙を `top` へなめらかにスクロールし、スクロールが終わるか、途中で `isReached` が成り立ったら `onSettled` を呼ぶ。
 * 動かす必要が無ければすぐ呼ぶ。戻り値は待つのをやめる関数。
 */
function scrollSmoothly(
  scroller: HTMLElement,
  top: number | null,
  onSettled: () => void,
  isReached: () => boolean = () => false,
): () => void {
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const clampedTop = top === null ? null : Math.min(top, maxTop);
  if (
    clampedTop === null ||
    Math.abs(clampedTop - scroller.scrollTop) < 1 ||
    typeof scroller.scrollTo !== "function"
  ) {
    onSettled();
    return cancelNothing;
  }

  function settle() {
    stop();
    onSettled();
  }
  function settleIfReached() {
    if (isReached()) {
      settle();
    }
  }
  function stop() {
    scroller.removeEventListener("scrollend", settle);
    scroller.removeEventListener("scroll", settleIfReached);
    window.clearTimeout(timer);
  }
  scroller.addEventListener("scrollend", settle);
  scroller.addEventListener("scroll", settleIfReached);
  const timer = window.setTimeout(settle, SCROLL_SETTLE_MAX_MS);
  scroller.scrollTo({ top: clampedTop, behavior: "smooth" });
  return stop;
}

function findSquare(scroller: HTMLElement, index: number): Element | null {
  return scroller.querySelector(`[data-index="${index}"]`);
}

function findSquaresSpan(
  scroller: HTMLElement,
  indices: readonly number[],
): ZukanVerticalSpan | null {
  return joinZukanVerticalSpans(
    indices.flatMap((index) => {
      const square = findSquare(scroller, index);
      return square ? [readSpan(square)] : [];
    }),
  );
}

/** 変化したマス全体の範囲を見せる台紙のスクロール位置。見えていれば `null`。 */
function findChangesScrollTop(
  scroller: HTMLElement,
  indices: readonly number[],
): number | null {
  const span = findSquaresSpan(scroller, [
    indices[0] ?? 0,
    indices.at(-1) ?? 0,
  ]);
  return span === null
    ? null
    : findZukanRevealScrollTop(readSpan(scroller), scroller.scrollTop, span);
}

type StampRunCallbacks = {
  onProgress: (progress: ZukanStampProgress) => void;
  /** 最後のマスの動きが終わったか、飛ばしたとき。 */
  onEnd: () => void;
  /** タップで飛ばしたとき。`onEnd` より先に呼ぶ。 */
  onSkippedByTap: () => void;
};

/**
 * 台紙 `scroller` の、押す順に並べた位置 `indices` のマスを押していく。
 * 変化したマス全体が見えるよう台紙をスクロールし、スクロールの終わりと前回の姿を見せる最短の時間を待ってから押し始める。
 * 押す回ごとに、次のマスが見えていなければ追ってスクロールし、次のマスが見えたところで押す。押す前に見えていないマスは動かさず、その回にマスの姿だけを変える。
 * 利用者が台紙をスクロールし始めたら、追うスクロールはやめる。タップ（ほとんど動かさずに離す）かキーを押すと最後の姿まで飛ばす。
 * 戻り値は、`onEnd` を呼ばずにやめる関数。
 */
function runZukanStamps(
  scroller: HTMLElement,
  indices: readonly number[],
  { onProgress, onEnd, onSkippedByTap }: StampRunCallbacks,
): () => void {
  const slots = groupZukanStampSlots(indices);
  const { slotStartMs } = planZukanStamps(slots.length);
  const lastIndex = indices.at(-1) ?? 0;
  const timers = new Set<number>();
  const cancels: (() => void)[] = [];
  const pointerStarts = new Map<number, { x: number; y: number }>();
  let progress = notStarted;
  let runningStampCount = 0;
  let followsScroll = true;
  let stopped = false;

  function wait(delayMs: number, then: () => void) {
    if (stopped) {
      return;
    }
    const timer = window.setTimeout(function elapse() {
      timers.delete(timer);
      then();
    }, delayMs);
    timers.add(timer);
  }
  function scrollThen(
    top: number | null,
    then: () => void,
    isReached?: () => boolean,
  ) {
    if (!stopped) {
      cancels.push(scrollSmoothly(scroller, top, then, isReached));
    }
  }
  function report(next: ZukanStampProgress) {
    progress = next;
    onProgress(next);
  }
  function end() {
    if (!stopped) {
      stop();
      onEnd();
    }
  }
  function endIfDone() {
    if (progress.startedSlotCount === slots.length && runningStampCount === 0) {
      end();
    }
  }
  // 見えていないマスの回はすぐ着くので、前の回より先に着くことがある。前の回が着くまでは数え上げない。
  const landedSlots = new Set<number>();
  function land(slot: number) {
    if (stopped) {
      return;
    }
    landedSlots.add(slot);
    let landedSlotCount = progress.landedSlotCount;
    while (landedSlots.has(landedSlotCount)) {
      landedSlotCount += 1;
    }
    if (landedSlotCount !== progress.landedSlotCount) {
      report({ ...progress, landedSlotCount });
    }
  }

  function stampSlot(slot: number) {
    if (stopped) {
      return;
    }
    const view = readSpan(scroller);
    const stampParts = (slots[slot] ?? []).flatMap((index) => {
      const square = findSquare(scroller, index);
      const parts =
        square && isZukanSpanInView(view, readSpan(square))
          ? findZukanStampParts(square)
          : null;
      return parts ? [parts] : [];
    });
    report({ ...progress, startedSlotCount: slot + 1 });
    let landingCount = stampParts.length;
    runningStampCount += stampParts.length;
    if (landingCount === 0) {
      land(slot);
    }
    for (const parts of stampParts) {
      cancels.push(
        playZukanStamp(parts, {
          onLanded() {
            landingCount -= 1;
            if (landingCount === 0) {
              land(slot);
            }
          },
          onFinished() {
            runningStampCount -= 1;
            endIfDone();
          },
        }),
      );
    }
    const nextSlot = slot + 1;
    if (nextSlot < slots.length) {
      wait((slotStartMs[nextSlot] ?? 0) - (slotStartMs[slot] ?? 0), () =>
        followThenStamp(nextSlot),
      );
    }
    endIfDone();
  }

  function followThenStamp(slot: number) {
    const slotIndices = slots[slot] ?? [];
    const next = findSquaresSpan(scroller, slotIndices);
    const rest = findSquaresSpan(scroller, [slotIndices[0] ?? 0, lastIndex]);
    const top =
      followsScroll && next && rest
        ? findZukanFollowScrollTop(
            readSpan(scroller),
            scroller.scrollTop,
            next,
            rest,
          )
        : null;
    // 追うスクロールは、止まるのを待たずに次のマスが見えたところで押し、押す間隔を空けすぎない。
    scrollThen(
      top,
      () => stampSlot(slot),
      () => {
        const nextNow = findSquaresSpan(scroller, slotIndices);
        return (
          nextNow !== null &&
          isZukanStampTargetVisible(readSpan(scroller), nextNow)
        );
      },
    );
  }

  function handlePointerDown(event: PointerEvent) {
    followsScroll = false;
    pointerStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }
  function handlePointerUp(event: PointerEvent) {
    const start = pointerStarts.get(event.pointerId);
    pointerStarts.delete(event.pointerId);
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) < TAP_SLOP_PX
    ) {
      onSkippedByTap();
      end();
    }
  }
  function handlePointerCancel(event: PointerEvent) {
    pointerStarts.delete(event.pointerId);
  }
  function stopFollowingScroll() {
    followsScroll = false;
  }
  const listeners = [
    ["pointerdown", handlePointerDown],
    ["pointerup", handlePointerUp],
    ["pointercancel", handlePointerCancel],
    ["wheel", stopFollowingScroll],
    ["keydown", end],
  ] as const;

  function stop() {
    stopped = true;
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    for (const cancel of cancels) {
      cancel();
    }
    for (const [type, listener] of listeners) {
      document.removeEventListener(type, listener as EventListener, true);
    }
  }

  for (const [type, listener] of listeners) {
    document.addEventListener(type, listener as EventListener, true);
  }
  let isHeld = false;
  let isScrolled = false;
  function startWhenReady() {
    if (isHeld && isScrolled) {
      stampSlot(0);
    }
  }
  wait(slotStartMs[0] ?? 0, () => {
    isHeld = true;
    startWhenReady();
  });
  scrollThen(findChangesScrollTop(scroller, indices), () => {
    isScrolled = true;
    startWhenReady();
  });

  return stop;
}

type ZukanChangeRevealOptions = {
  /** 今変化を見せるレベル。見せる変化が無いときと、ページが見えていないときは `null`。 */
  difficulty: DifficultyLevel | null;
  appearance: ZukanChangeAppearance;
  /** 押す順に並べた、変化したマスの台紙の中の位置。 */
  changeIndices: readonly number[];
  /** 開いている台紙のスクロール領域。マスは `data-index` に台紙の中の位置を持つ。 */
  scrollerRef: RefObject<HTMLElement | null>;
  /**
   * レベル `difficulty` の変化を見せ終えたとき。押していく演出では、最後まで押したときか飛ばしたとき。
   * 動きを減らす設定では、印を載せた台紙を見せたとき。途中でやめたときは呼ばない。
   */
  onShown: (
    difficulty: DifficultyLevel,
    appearance: ZukanChangeAppearance,
  ) => void;
};

/**
 * 開いている台紙で、前回からの変化を見せる。変化したマスが見えるよう台紙をスクロールし、`appearance` が `animated` なら変化したマスを押していく。
 * `difficulty` が変わったり `null` になったりしたときと、画面を離れたときは、`onShown` を呼ばずにやめ、進みを初めに戻す。
 * 戻り値は押していく演出の進み。
 */
export function useZukanChangeReveal(
  options: ZukanChangeRevealOptions,
): ZukanStampProgress {
  const { difficulty, appearance, changeIndices, scrollerRef } = options;
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const latest = useRef(options);
  const stopSuppressingClick = useRef(cancelNothing);

  // 押す位置と知らせる先は、押している途中で描き直されても演出をやり直さないよう、最後に描いた値を読む。
  useEffect(() => {
    latest.current = options;
  });

  // 飛ばしたタップに続くクリックは演出を終えたあとに届くので、演出ではなく画面を離れるまで待つ。
  useEffect(
    () =>
      function stopWaitingClick() {
        stopSuppressingClick.current();
      },
    [],
  );

  const changeCount = changeIndices.length;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (difficulty === null || scroller === null || changeCount === 0) {
      return;
    }
    const revealingDifficulty = difficulty;
    const indices = latest.current.changeIndices;
    function notifyShown() {
      latest.current.onShown(revealingDifficulty, appearance);
    }

    if (appearance === "marked") {
      const top = findChangesScrollTop(scroller, indices);
      if (top !== null) {
        scroller.scrollTo?.({ top });
      }
      notifyShown();
      return;
    }

    const stop = runZukanStamps(scroller, indices, {
      onProgress(next) {
        setProgress({ ...next, difficulty: revealingDifficulty });
      },
      onEnd: notifyShown,
      onSkippedByTap() {
        stopSuppressingClick.current();
        stopSuppressingClick.current = suppressNextClick();
      },
    });
    return function stopStamps() {
      stop();
      setProgress(null);
    };
  }, [difficulty, appearance, changeCount, scrollerRef]);

  return progress !== null && progress.difficulty === difficulty
    ? progress
    : notStarted;
}
