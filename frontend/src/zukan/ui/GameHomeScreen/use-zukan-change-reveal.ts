import { type RefObject, useEffect, useRef, useState } from "react";
import type { DifficultyLevel } from "@/games/difficulty";
import { afterScreenTransition } from "@/lib/screen-transition";
import { prepareSoundEffects } from "@/lib/sound-effects";
import {
  findZukanFollowScrollTop,
  findZukanHeaviestStamp,
  findZukanRevealScrollTop,
  groupZukanStampSlots,
  isZukanSpanInView,
  isZukanStampTargetVisible,
  joinZukanVerticalSpans,
  planZukanStamps,
  readZukanStamp,
  type ZukanChangeAppearance,
  type ZukanVerticalSpan,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import { readZukanSheetView } from "@/zukan/ui/GameHomeScreen/zukan-sheet-view";
import {
  createZukanStampEffectLayer,
  findZukanStampParts,
  playZukanStamp,
  type ZukanStampTarget,
} from "@/zukan/ui/GameHomeScreen/zukan-stamp-effects";
import { zukanStampSounds } from "@/zukan/ui/GameHomeScreen/zukan-stamp-sound";

export type ZukanStampProgress = {
  startedSlotCount: number;
  landedSlotCount: number;
};

type ProgressState = ZukanStampProgress & { difficulty: DifficultyLevel };

const notStarted: ZukanStampProgress = {
  startedSlotCount: 0,
  landedSlotCount: 0,
};

/** 台紙を寄せるスクロールの長さ。ブラウザのなめらかなスクロールより短く決まった長さにし、押す間を空けすぎない。 */
const SHEET_SCROLL_DURATION_MS = 220;
/** 押してから離すまでに動いた距離がこれ未満なら、スクロールではなくタップとみなす。 */
const TAP_SLOP_PX = 10;
const SKIP_TAP_CLICK_WAIT_MS = 600;

function cancelNothing() {}

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

/** `MOTION_EASING.standard` と同じ向きの形を、スクロール位置の計算に使う。 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

type SheetScrollConditions = {
  /** 寄せている途中でも、これが成り立ったら寄せ終えたものとする。 */
  isReached: () => boolean;
  /** 利用者が台紙を触ったなど、寄せるのをやめて先へ進むか。 */
  isInterrupted: () => boolean;
};

/**
 * 台紙を `top` へ `SHEET_SCROLL_DURATION_MS` で寄せ、寄せ終えるか、途中で `isReached` か `isInterrupted` が成り立ったら `onSettled` を呼ぶ。
 * 動かす必要が無ければすぐ呼ぶ。戻り値は寄せるのをやめる関数で、やめたあとは呼ばない。
 */
function scrollSheet(
  scroller: HTMLElement,
  top: number | null,
  onSettled: () => void,
  { isReached, isInterrupted }: SheetScrollConditions,
): () => void {
  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const from = scroller.scrollTop;
  const to = top === null ? from : Math.min(top, maxTop);
  if (Math.abs(to - from) < 1) {
    onSettled();
    return cancelNothing;
  }
  let frame = 0;
  let startedAt: number | null = null;
  function step(now: number) {
    if (isInterrupted()) {
      onSettled();
      return;
    }
    startedAt ??= now;
    const progress = Math.min(1, (now - startedAt) / SHEET_SCROLL_DURATION_MS);
    scroller.scrollTop = from + (to - from) * easeInOutCubic(progress);
    if (progress >= 1 || isReached()) {
      onSettled();
      return;
    }
    frame = window.requestAnimationFrame(step);
  }
  frame = window.requestAnimationFrame(step);
  return function cancel() {
    window.cancelAnimationFrame(frame);
  };
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
    : findZukanRevealScrollTop(
        readZukanSheetView(scroller),
        scroller.scrollTop,
        span,
      );
}

type StampRunCallbacks = {
  onProgress: (progress: ZukanStampProgress) => void;
  /** 最後のマスの動きが終わったか、飛ばしたとき。 */
  onEnd: () => void;
  /** タップで飛ばしたとき。`target` はタップした要素。`onEnd` より先に呼ぶ。 */
  onSkippedByTap: (target: EventTarget | null) => void;
};

/**
 * 台紙 `scroller` の、押す順に並べた位置 `indices` のマスを押していく。
 * 変化したマス全体が見えるよう台紙をスクロールし、スクロールの終わりと前回の姿を見せる最短の時間を待ってから押し始める。
 * 押す回ごとに、次のマスが見えていなければ追ってスクロールし、次のマスが見えたところで押す。押す前に見えていないマスは動かさず、その回にマスの姿だけを変える。
 * 回ごとに、押したマスのうち最も重い変化のマスだけが音を鳴らす。押す前に見えていないマスは鳴らさない。
 * 利用者が台紙をスクロールし始めたら、追うスクロールはやめる。タップ（ほとんど動かさずに離す）かキーを押すと最後の姿まで飛ばす。
 * 粒や衝撃波は台紙の外に重ねた層に描き、飛ばしたときもやめたときも層ごと片付ける。
 * 戻り値は、`onEnd` を呼ばずにやめる関数。
 */
function runZukanStamps(
  scroller: HTMLElement,
  indices: readonly number[],
  { onProgress, onEnd, onSkippedByTap }: StampRunCallbacks,
): () => void {
  const slots = groupZukanStampSlots(indices);
  const { slotStartMs } = planZukanStamps(
    slots.map((slotIndices) =>
      slotIndices.flatMap((index) => {
        const square = findSquare(scroller, index);
        const stamp = square ? readZukanStamp(square) : null;
        return stamp ? [stamp] : [];
      }),
    ),
  );
  const effectLayer = createZukanStampEffectLayer(scroller);
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
    isReached: () => boolean = () => false,
  ) {
    if (!stopped) {
      cancels.push(
        scrollSheet(scroller, top, then, {
          isReached,
          isInterrupted: () => !followsScroll,
        }),
      );
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
    const view = readZukanSheetView(scroller);
    const targets = (slots[slot] ?? []).flatMap((index): ZukanStampTarget[] => {
      const square = findSquare(scroller, index);
      if (square === null || !isZukanSpanInView(view, readSpan(square))) {
        return [];
      }
      const parts = findZukanStampParts(square);
      const stamp = readZukanStamp(square);
      return parts && stamp ? [{ square, parts, stamp }] : [];
    });
    const soundTarget = findZukanHeaviestStamp(
      targets.map(({ stamp }) => stamp),
    );
    report({ ...progress, startedSlotCount: slot + 1 });
    let landingCount = targets.length;
    runningStampCount += targets.length;
    if (landingCount === 0) {
      land(slot);
    }
    targets.forEach((target, order) => {
      cancels.push(
        playZukanStamp(target, {
          layer: effectLayer,
          playsSound: order === soundTarget,
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
    });
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
            readZukanSheetView(scroller),
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
          isZukanStampTargetVisible(readZukanSheetView(scroller), nextNow)
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
      onSkippedByTap(event.target);
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
    effectLayer.remove();
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
   * 演出を飛ばしたタップのクリックも届ける要素か。見方・絞り込みのように、押せば最後の姿まで飛ばしたうえで、そのまま開いてよい操作。
   * ほかの要素では、飛ばすためのタップでマスを選んだりリンクを開いたりしないよう、続くクリックを届けない。
   */
  isClickThroughTarget: (target: EventTarget | null) => boolean;
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
 * `difficulty` が変わったり `null` になったりしたときと、画面を離れたときは、`onShown` を呼ばずにやめ、進みを初めに戻す。
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

  useEffect(() => {
    prepareSoundEffects(zukanStampSounds);
  }, []);

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

    // 画面の行き来の動きと重ねると、どちらも読み取れなくなるので、行き来の動きが終わってから押し始める。
    let stop = cancelNothing;
    const cancelWaiting = afterScreenTransition(function startStamps() {
      stop = runStamps(scroller, indices);
    });
    return function stopStamps() {
      cancelWaiting();
      stop();
      setProgress(null);
    };

    function runStamps(
      target: HTMLElement,
      stampIndices: typeof indices,
    ): () => void {
      return runZukanStamps(target, stampIndices, {
        onProgress(next) {
          setProgress({ ...next, difficulty: revealingDifficulty });
        },
        onEnd: notifyShown,
        onSkippedByTap(target) {
          stopSuppressingClick.current();
          stopSuppressingClick.current = latest.current.isClickThroughTarget(
            target,
          )
            ? cancelNothing
            : suppressNextClick();
        },
      });
    }
  }, [difficulty, appearance, changeCount, scrollerRef]);

  return progress !== null && progress.difficulty === difficulty
    ? progress
    : notStarted;
}
