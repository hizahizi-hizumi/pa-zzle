import { type RefObject, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import type { DifficultyLevel } from "@/games/difficulty";
import { prepareSoundEffects } from "@/lib/sound-effects";
import {
  findZukanFeaturedLaunchPoint,
  findZukanHeaviestStamp,
  findZukanHeroLaunchPoint,
  findZukanRevealScrollTop,
  findZukanWaveLaunchPoint,
  findZukanWaveScrollTop,
  getZukanStampTimeline,
  isZukanStampTargetVisible,
  joinZukanVerticalSpans,
  planZukanStamps,
  readZukanStamp,
  snapZukanScrollTopToRows,
  type ZukanChangeAppearance,
  type ZukanLayerView,
  type ZukanSheetRows,
  type ZukanStamp,
  type ZukanStampPoint,
  type ZukanStampStep,
  type ZukanVerticalSpan,
} from "@/zukan/ui/GameHomeScreen/zukan-change-reveal";
import {
  createZukanStampEffectLayer,
  findZukanStampParts,
  measureZukanStampSquareBox,
  playZukanNewPieceMarks,
  startZukanStamp,
  ZUKAN_NEW_PIECE_MARK_MS,
  type ZukanNewPieceMarkTarget,
  type ZukanStampEffectLayer,
  type ZukanStampMotion,
  type ZukanStampSquareBox,
} from "@/zukan/ui/GameHomeScreen/zukan-stamp-effects";
import {
  playZukanStampSound,
  zukanStampSounds,
} from "@/zukan/ui/GameHomeScreen/zukan-stamp-sound";

/** 変化したマスを押していく演出の進み。押していく順の先頭から数えたマスの数で表す。 */
export type ZukanStampProgress = {
  /** 押し始めたマスの数。 */
  startedCount: number;
  /** 押し終えてマスに着いた数。 */
  landedCount: number;
};

type ProgressState = ZukanStampProgress & { difficulty: DifficultyLevel };

const notStarted: ZukanStampProgress = {
  startedCount: 0,
  landedCount: 0,
};

/** 台紙を寄せるスクロールの長さ。遠いほど長くし、遠くへ寄せても目で追えるようにする。ブラウザのなめらかなスクロールより短くし、押す間を空けすぎない。 */
const SHEET_SCROLL_DURATION = {
  minMs: 200,
  maxMs: 400,
  msPerPx: 0.25,
} as const;
/** 波を追うスクロールが波の先頭へ寄る速さ（時定数）と、先読みする長さ。先読みで追い遅れを打ち消す。 */
const WAVE_FOLLOW_TIME_CONSTANT_MS = 90;
const WAVE_FOLLOW_LOOKAHEAD_MS = 90;
/** 波ではめている間に音を鳴らす最短の間隔。間の着いたマスのうち最も重い変化の音を鳴らす。 */
const WAVE_SOUND_INTERVAL_MS = 90;
/** 1枚ずつ押すマスは、着く時刻より半コマ早くから着いたものとし、着く時刻に最も近いコマで、押し込んだ姿と数を一緒に描く。波は1コマに何枚も着くので、数が押す姿より先に進まないよう早めない。 */
const LANDING_FRAME_LEAD_MS = 8;
/** 押していく前の台紙を寄せるスクロールで、寄せる必要が無いとみなす差。 */
const SCROLL_EPSILON_PX = 1;
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

/** 動き始めと終わりをゆるめる3次の緩急。`MOTION_EASING.standard` と同じ向きの形を、スクロール位置の計算に使う。 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function findSquare(scroller: HTMLElement, index: number): Element | null {
  return scroller.querySelector(`[data-index="${index}"]`);
}

/** 台紙のスクロール領域の、測ったときの大きさ。上下の位置は台紙の中身の上端からの距離で表す。 */
type SheetMetrics = {
  viewHeight: number;
  maxScrollTop: number;
  rows: ZukanSheetRows;
};

/** 演出を描く層の、台紙の中身の上端からの位置と幅。台の見えている範囲を、層の中の位置にするのに使う。 */
type LayerMetrics = { top: number; width: number };

/** 押す1枚の押し方と、測った位置。位置は台紙の大きさが変わったら測り直す。 */
type StampEntry = {
  step: ZukanStampStep;
  stamp: ZukanStamp | null;
  square: Element | null;
  span: ZukanVerticalSpan;
  box: ZukanStampSquareBox;
};

/**
 * 台紙の大きさと、マス `squares` の位置を測る。
 * 押していく間は動きを足していくので、コマの初めにまとめて測り、動きを足すたびにレイアウトを読み直させない。
 */
function measureSheet(
  scroller: HTMLElement,
  squares: readonly (Element | null)[],
): { metrics: SheetMetrics; spans: ZukanVerticalSpan[] } {
  const scrollerTop = scroller.getBoundingClientRect().top;
  const { scrollTop, clientHeight, scrollHeight } = scroller;
  const { paddingTop } = getComputedStyle(scroller);
  const insetTop = Number.parseFloat(paddingTop) || 0;
  const rects = squares.map((square) => square?.getBoundingClientRect());
  const spans = rects.map((rect) => {
    const top = (rect?.top ?? scrollerTop) - scrollerTop + scrollTop;
    return { top, bottom: top + (rect?.height ?? 0) };
  });
  return {
    metrics: {
      viewHeight: clientHeight,
      maxScrollTop: Math.max(0, scrollHeight - clientHeight),
      rows: {
        alignedScrollTop: (spans[0]?.top ?? insetTop) - insetTop,
        pitch: rects[0]?.height ?? 0,
      },
    },
    spans,
  };
}

/** 押す1枚ずつの押し方を、押す前にまとめて決める。位置はまだ測らない。 */
function listStampEntries(
  scroller: HTMLElement,
  indices: readonly number[],
): StampEntry[] {
  const squares = indices.map((index) => findSquare(scroller, index));
  const stamps = squares.map((square) =>
    square ? readZukanStamp(square) : null,
  );
  const steps = planZukanStamps(
    indices.map((index, order) => ({
      index,
      stamp: stamps[order] ?? { level: "clear", isRaised: false },
    })),
  );
  return steps.map((step, order) => ({
    step,
    stamp: stamps[order] ?? null,
    square: squares[order] ?? null,
    span: { top: 0, bottom: 0 },
    box: { x: 0, y: 0, size: 0 },
  }));
}

/** 押す1枚ずつのうち、最も遅く動き終える時刻。押すものが無ければ 0。 */
function findLastStampEndMs(entries: readonly StampEntry[]): number {
  return entries.reduce((latest, { step }) => Math.max(latest, step.endMs), 0);
}

/** 押す1枚ずつの位置を測り直し、台紙の大きさと層の位置を返す。 */
function measureStampEntries(
  scroller: HTMLElement,
  entries: readonly StampEntry[],
  layer: ZukanStampEffectLayer,
): { metrics: SheetMetrics; layerMetrics: LayerMetrics } {
  const { metrics, spans } = measureSheet(
    scroller,
    entries.map(({ square }) => square),
  );
  entries.forEach((entry, order) => {
    entry.span = spans[order] ?? entry.span;
    entry.box = entry.square
      ? measureZukanStampSquareBox(entry.square, layer)
      : entry.box;
  });
  const measured = entries.find(({ square }) => square !== null);
  return {
    metrics,
    layerMetrics: {
      top: measured
        ? (measured.span.top + measured.span.bottom) / 2 - measured.box.y
        : 0,
      width: layer.element.getBoundingClientRect().width,
    },
  };
}

/** 台の見えている範囲を、演出を描く層の中の位置で表す。 */
function toLayerView(
  metrics: SheetMetrics,
  layerMetrics: LayerMetrics,
  scrollTop: number,
): ZukanLayerView {
  const top = scrollTop - layerMetrics.top;
  return {
    left: 0,
    top,
    right: layerMetrics.width,
    bottom: top + metrics.viewHeight,
  };
}

/** 先に1枚ずつはめたマスの真ん中。波は、ここから外へ押し出されるようにはめる。 */
function findLeadCenter(entries: readonly StampEntry[]): ZukanStampPoint {
  const lead = entries.filter(({ step }) => step.style !== "wave");
  const count = Math.max(1, lead.length);
  return {
    x: lead.reduce((total, { box }) => total + box.x, 0) / count,
    y: lead.reduce((total, { box }) => total + box.y, 0) / count,
  };
}

/** 見せ方に応じた、1枚を飛ばし始める所。 */
function findLaunchPoint(
  entry: StampEntry,
  view: ZukanLayerView,
  leadCenter: ZukanStampPoint,
): ZukanStampPoint {
  switch (entry.step.style) {
    case "hero":
      return findZukanHeroLaunchPoint(entry.box, view);
    case "featured":
      return findZukanFeaturedLaunchPoint(entry.box, view);
    case "wave":
      return findZukanWaveLaunchPoint(entry.box, leadCenter);
  }
}

/** 変化したマス全体の範囲 `first`〜`last` を見せる台紙のスクロール位置。行の境目に揃える。見えていれば `null`。 */
function findChangesScrollTop(
  metrics: SheetMetrics,
  scrollTop: number,
  first: ZukanVerticalSpan,
  last: ZukanVerticalSpan,
): number | null {
  const span = joinZukanVerticalSpans([first, last]) ?? first;
  const top = findZukanRevealScrollTop(
    toView(metrics, scrollTop),
    scrollTop,
    span,
  );
  return top === null ? null : snapToRows(metrics, top, first);
}

function toView(
  { viewHeight }: SheetMetrics,
  scrollTop: number,
): ZukanVerticalSpan {
  return { top: scrollTop, bottom: scrollTop + viewHeight };
}

/** `top` へスクロールするとき、行の上端が見える範囲の上端に揃う位置。揃えると `keepVisible` が見えなくなるなら揃えない。 */
function snapToRows(
  metrics: SheetMetrics,
  top: number,
  keepVisible: ZukanVerticalSpan,
): number {
  const clamped = Math.min(Math.max(0, top), metrics.maxScrollTop);
  const snapped = snapZukanScrollTopToRows(
    clamped,
    metrics.rows,
    metrics.maxScrollTop,
  );
  return isZukanStampTargetVisible(toView(metrics, snapped), keepVisible)
    ? snapped
    : clamped;
}

type SheetScroll = {
  from: number;
  to: number;
  durationMs: number;
  startedAt: number | null;
  /** 寄せ終えるまで、次の1枚を押し始めず待つか。 */
  blocks: boolean;
};

type StampRunCallbacks = {
  onProgress: (progress: ZukanStampProgress) => void;
  /**
   * 最後の1枚の動きが終わったか、飛ばしたとき。
   * 最後まで見せたときは、「新しい」印を残すマスを `newPieces` に渡す。飛ばしたときは空にする。
   */
  onEnd: (newPieces: readonly ZukanNewPieceMarkTarget[]) => void;
  /** タップで飛ばしたとき。`target` はタップした要素。`onEnd` より先に呼ぶ。 */
  onSkippedByTap: (target: EventTarget | null) => void;
};

/**
 * 台紙 `scroller` の、押す順に並べた位置 `indices` のマスを押していく。
 * 1つの時計で、`planZukanStamps` の時刻に1枚ずつ押し始め、着く時刻に数を数え、台紙のスクロールを動かす。時計はコマごとに進め、数・押す姿・スクロールを同じコマで描く。
 * 押す前に、変化したマス全体が見えるよう台紙を寄せ、前回の姿を見せる最短の時間を待つ。1枚ずつ押すマスが見えていなければ、寄せ終えるまで時計を止める。
 * 波でまとめてはめる間は、時計を止めずに波の先頭をスクロールで追う。押し始めるときに見えていないマスは動かさず鳴らさず、その時刻に着いたものとする。
 * 利用者が台紙をスクロールし始めたら、追うスクロールはやめる。タップ（ほとんど動かさずに離す）かキーを押すと最後の姿まで飛ばす。
 * 波紋や粒は台紙の中に重ねた層に描き、飛ばしたときもやめたときも層ごと片付ける。
 * 戻り値は、`onEnd` を呼ばずにやめる関数。
 */
function runZukanStamps(
  scroller: HTMLElement,
  indices: readonly number[],
  { onProgress, onEnd, onSkippedByTap }: StampRunCallbacks,
): () => void {
  const grid = findSquare(scroller, indices[0] ?? 0)?.parentElement ?? scroller;
  const effectLayer = createZukanStampEffectLayer(grid);
  const entries = listStampEntries(scroller, indices);
  // 演出を終えてよい時刻。コマごとに全件を見直さないよう、1枚の時刻をずらしたときだけ求め直す。
  let lastEndMs = findLastStampEndMs(entries);
  // 台紙を開いた直後は、マスの大きさが決まる前に測ることがある。大きさが変わるたびに、次のコマの初めに測り直す。
  let { metrics, layerMetrics } = measureStampEntries(
    scroller,
    entries,
    effectLayer,
  );
  let leadCenter = findLeadCenter(entries);
  let isMeasureStale = false;
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(function markMeasureStale() {
          isMeasureStale = true;
        });
  resizeObserver?.observe(grid);
  resizeObserver?.observe(scroller);
  const motions: (ZukanStampMotion | null)[] = [];
  const animatedOrders = new Set<number>();
  const pointerStarts = new Map<number, { x: number; y: number }>();
  const lastEntry = entries.at(-1);
  let clockMs = 0;
  let previousFrameAt: number | null = null;
  let startedCount = 0;
  let landedCount = 0;
  let releasedCount = 0;
  let reportedLandedCount = 0;
  let lastWaveSoundAt = Number.NEGATIVE_INFINITY;
  // 波ではめて、まだ音を鳴らしていない変化。間を空けて鳴らすときに、最も重い変化の音で代表する。
  let pendingWaveStamps: ZukanStamp[] = [];
  let sheetScroll: SheetScroll | null = null;
  let hasRevealedChanges = false;
  let hasSettledWave = false;
  let followsScroll = true;
  let stopped = false;
  let frame = 0;

  function scrollTo(top: number | null, blocks: boolean) {
    if (top === null || !followsScroll) {
      return;
    }
    const from = scroller.scrollTop;
    if (Math.abs(top - from) >= SCROLL_EPSILON_PX) {
      sheetScroll = {
        from,
        to: top,
        durationMs: Math.min(
          SHEET_SCROLL_DURATION.maxMs,
          SHEET_SCROLL_DURATION.minMs +
            Math.abs(top - from) * SHEET_SCROLL_DURATION.msPerPx,
        ),
        startedAt: null,
        blocks,
      };
    }
  }

  function advanceScroll(now: number) {
    if (sheetScroll === null) {
      return;
    }
    if (!followsScroll) {
      sheetScroll = null;
      return;
    }
    sheetScroll.startedAt ??= now;
    const progress = Math.min(
      1,
      (now - sheetScroll.startedAt) / sheetScroll.durationMs,
    );
    scroller.scrollTop =
      sheetScroll.from +
      (sheetScroll.to - sheetScroll.from) * easeInOutCubic(progress);
    if (progress >= 1) {
      sheetScroll = null;
    }
  }

  function followWave(scrollTop: number, dtMs: number) {
    const lookaheadMs = clockMs + WAVE_FOLLOW_LOOKAHEAD_MS;
    const front = entries.findLast(
      ({ step }) => step.style === "wave" && step.startMs <= lookaheadMs,
    );
    if (
      front === undefined ||
      lastEntry === undefined ||
      sheetScroll !== null ||
      !followsScroll
    ) {
      return;
    }
    const target = Math.min(
      metrics.maxScrollTop,
      findZukanWaveScrollTop(
        toView(metrics, scrollTop),
        scrollTop,
        front.span,
        lastEntry.span,
      ),
    );
    const approach = 1 - Math.exp(-dtMs / WAVE_FOLLOW_TIME_CONSTANT_MS);
    if (target - scrollTop >= SCROLL_EPSILON_PX) {
      scroller.scrollTop = scrollTop + (target - scrollTop) * approach;
    }
  }

  /** 波を流し終えたら、止まる台紙の上端で行が切れないよう、近い行の境目へ寄せる。 */
  function settleWaveScroll(scrollTop: number) {
    if (hasSettledWave || lastEntry === undefined) {
      return;
    }
    hasSettledWave = true;
    scrollTo(snapToRows(metrics, scrollTop, lastEntry.span), false);
  }

  function report() {
    reportedLandedCount = landedCount;
    onProgress({
      startedCount,
      landedCount,
    });
  }

  /** 押す前に、変化したマス全体が見えるよう台紙を寄せる。 */
  function revealChanges(scrollTop: number) {
    const firstEntry = entries[0];
    if (firstEntry && lastEntry) {
      scrollTo(
        findChangesScrollTop(
          metrics,
          scrollTop,
          firstEntry.span,
          lastEntry.span,
        ),
        true,
      );
    }
  }

  function end() {
    if (!stopped) {
      stop();
      onEnd([]);
    }
  }

  /**
   * 最後まで見せ終える。動かして見せたマスのうち、1枚ずつ見せたマスに「新しい」印を残す。
   * 波でまとめてはめたマスには付けず、多くの要素に光を掛け続けない。
   */
  function finish() {
    if (stopped) {
      return;
    }
    const newPieces = entries.flatMap(
      ({ square, box, step }, order): ZukanNewPieceMarkTarget[] =>
        square !== null && step.style !== "wave" && animatedOrders.has(order)
          ? [{ square, box }]
          : [],
    );
    stop();
    onEnd(newPieces);
  }

  /** 次の1枚を押し始められるか。1枚ずつ押すマスが見えていなければ、見える所へ寄せて待つ。 */
  function isReadyToStart(entry: StampEntry, scrollTop: number): boolean {
    const isVisible = isZukanStampTargetVisible(
      toView(metrics, scrollTop),
      entry.span,
    );
    if (sheetScroll?.blocks && followsScroll) {
      return false;
    }
    if (isVisible || entry.step.style === "wave" || !followsScroll) {
      return true;
    }
    // 飛んでいるマスを見える範囲の外へ流さないよう、着き終えてから寄せる。
    if (landedCount < startedCount) {
      return false;
    }
    const rest =
      joinZukanVerticalSpans([entry.span, lastEntry?.span ?? entry.span]) ??
      entry.span;
    const top = findZukanRevealScrollTop(
      toView(metrics, scrollTop),
      scrollTop,
      rest,
    );
    scrollTo(top === null ? null : snapToRows(metrics, top, entry.span), true);
    return sheetScroll === null;
  }

  function startStamps(now: number, scrollTop: number) {
    while (startedCount < entries.length) {
      const entry = entries[startedCount];
      if (
        entry === undefined ||
        entry.step.startMs > clockMs ||
        !isReadyToStart(entry, scrollTop)
      ) {
        return;
      }
      // 待った分は、この1枚から後の時刻をずらし、1枚ずつ押すマスを飛ばし始めから見せる。波は遅れを詰めて、決めた時刻に着かせる。
      const delayMs = Math.max(0, clockMs - entry.step.startMs);
      if (delayMs > 0 && entry.step.style !== "wave") {
        shiftLaterSteps(startedCount, delayMs);
      }
      const parts = entry.square ? findZukanStampParts(entry.square) : null;
      const isVisible = isZukanStampTargetVisible(
        toView(metrics, scrollTop),
        entry.span,
      );
      motions[startedCount] =
        isVisible && entry.square && parts && entry.stamp
          ? startZukanStamp(
              { square: entry.square, parts, stamp: entry.stamp },
              {
                layer: effectLayer,
                box: entry.box,
                style: entry.step.style,
                from: findLaunchPoint(
                  entry,
                  toLayerView(metrics, layerMetrics, scrollTop),
                  leadCenter,
                ),
                startTime: now - (clockMs - entry.step.startMs),
              },
            )
          : null;
      if (motions[startedCount]) {
        animatedOrders.add(startedCount);
      }
      startedCount += 1;
    }
  }

  /** `from` 番目から後の1枚の時刻を `delayMs` だけ後へずらす。 */
  function shiftLaterSteps(from: number, delayMs: number) {
    for (const entry of entries.slice(from)) {
      entry.step = {
        ...entry.step,
        startMs: entry.step.startMs + delayMs,
        landMs: entry.step.landMs + delayMs,
        endMs: entry.step.endMs + delayMs,
      };
    }
    lastEndMs = findLastStampEndMs(entries);
  }

  function landStamps(now: number) {
    while (landedCount < startedCount) {
      const entry = entries[landedCount];
      if (
        entry === undefined ||
        entry.step.landMs >
          clockMs + (entry.step.style === "wave" ? 0 : LANDING_FRAME_LEAD_MS)
      ) {
        break;
      }
      const motion = motions[landedCount];
      const landTime = now - (clockMs - entry.step.landMs);
      if (motion) {
        motion.land(landTime);
        if (entry.stamp && entry.step.style !== "wave") {
          playZukanStampSound(entry.stamp);
        } else if (entry.stamp) {
          pendingWaveStamps.push(entry.stamp);
        }
      }
      landedCount += 1;
    }
    const heaviestWaveStamp = findZukanHeaviestStamp(pendingWaveStamps);
    if (
      heaviestWaveStamp !== null &&
      now - lastWaveSoundAt >= WAVE_SOUND_INTERVAL_MS
    ) {
      playZukanStampSound(heaviestWaveStamp);
      pendingWaveStamps = [];
      lastWaveSoundAt = now;
    }
    // 描き直しが重い端末では、コマの間隔が延びて描き直す回数がおのずと減る。数は押す姿と同じコマで描く。
    if (landedCount !== reportedLandedCount) {
      report();
    }
  }

  /**
   * 波ではめ終えて、普段の姿へ渡し終えたマスの押す姿を外す。押す姿はもう消えているので見た目は変わらない。
   * 押す姿を残し続けると、何百枚もの動きを描き続けることになり、波の終わりほど重くなる。
   */
  function releaseSettledWaves() {
    while (releasedCount < landedCount) {
      const entry = entries[releasedCount];
      if (
        entry === undefined ||
        clockMs <
          entry.step.startMs +
            getZukanStampTimeline(entry.step.style).handedOffMs
      ) {
        return;
      }
      if (entry.step.style === "wave") {
        motions[releasedCount]?.cancel();
        motions[releasedCount] = null;
      }
      releasedCount += 1;
    }
  }

  function tick(now: number) {
    if (stopped) {
      return;
    }
    // 読むのはコマの初めだけにし、動きを足したあとにレイアウトを読み直させない。
    if (isMeasureStale) {
      isMeasureStale = false;
      ({ metrics, layerMetrics } = measureStampEntries(
        scroller,
        entries,
        effectLayer,
      ));
      leadCenter = findLeadCenter(entries);
    }
    const scrollTop = scroller.scrollTop;
    if (!hasRevealedChanges) {
      hasRevealedChanges = true;
      revealChanges(scrollTop);
    }
    // 押す姿の動きは描く側で実時間どおりに進むので、時計もコマが空いた分をそのまま進め、数を押す姿より遅らせない。
    const dtMs = previousFrameAt === null ? 0 : now - previousFrameAt;
    previousFrameAt = now;
    const nextStart = entries[startedCount]?.step.startMs ?? clockMs;
    // 寄せ終えるのを待つ間は、次の1枚を押し始める時刻で時計を止める。飛んでいるマスがあるうちは止めず、数を押す姿より遅らせない。
    const isWaiting =
      sheetScroll?.blocks === true && landedCount === startedCount;
    clockMs = isWaiting
      ? Math.min(clockMs + dtMs, Math.max(clockMs, nextStart))
      : clockMs + dtMs;
    advanceScroll(now);
    if (startedCount > 0 && entries[startedCount - 1]?.step.style === "wave") {
      if (startedCount === entries.length) {
        settleWaveScroll(scroller.scrollTop);
      } else {
        followWave(scrollTop, dtMs);
      }
    }
    startStamps(now, scrollTop);
    landStamps(now);
    releaseSettledWaves();
    if (
      landedCount === entries.length &&
      clockMs >= lastEndMs &&
      sheetScroll === null
    ) {
      finish();
      return;
    }
    frame = window.requestAnimationFrame(tick);
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
    window.cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    for (const motion of motions) {
      motion?.cancel();
    }
    for (const [type, listener] of listeners) {
      document.removeEventListener(type, listener as EventListener, true);
    }
    effectLayer.remove();
  }

  for (const [type, listener] of listeners) {
    document.addEventListener(type, listener as EventListener, true);
  }
  frame = window.requestAnimationFrame(tick);

  return stop;
}

/**
 * 今回はめたピース `newPieces` に「新しい」印を残す。印は脈打ち終えたら消え、利用者がどこかを押すかキーを押したら、すぐ消す。
 * 印を描く層は演出の層とは別に置き、演出を片付けたあとも残す。戻り値は、印をすぐ消す関数。
 */
function markNewPieces(
  newPieces: readonly ZukanNewPieceMarkTarget[],
): () => void {
  const grid = newPieces[0]?.square.parentElement;
  if (grid === null || grid === undefined) {
    return cancelNothing;
  }
  const layer = createZukanStampEffectLayer(grid, "new-piece-marks");
  const timelineNow = document.timeline?.currentTime;
  const cancelMarks = playZukanNewPieceMarks(
    layer,
    newPieces,
    typeof timelineNow === "number" ? timelineNow : performance.now(),
  );
  const timer = window.setTimeout(stop, ZUKAN_NEW_PIECE_MARK_MS);
  function stop() {
    window.clearTimeout(timer);
    document.removeEventListener("pointerdown", stop, true);
    document.removeEventListener("keydown", stop, true);
    cancelMarks();
    layer.remove();
  }
  document.addEventListener("pointerdown", stop, true);
  document.addEventListener("keydown", stop, true);
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
  const stopNewPieceMarks = useRef(cancelNothing);

  // 押す位置と知らせる先は、押している途中で描き直されても演出をやり直さないよう、最後に描いた値を読む。
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    prepareSoundEffects(zukanStampSounds);
  }, []);

  // 飛ばしたタップに続くクリックと「新しい」印は演出を終えたあとまで残るので、演出ではなく画面を離れるまで待つ。
  useEffect(
    () =>
      function stopWaitingClick() {
        stopSuppressingClick.current();
        stopNewPieceMarks.current();
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
      const { metrics, spans } = measureSheet(scroller, [
        findSquare(scroller, indices[0] ?? 0),
        findSquare(scroller, indices.at(-1) ?? 0),
      ]);
      const [first, last] = spans;
      const top =
        first && last
          ? findChangesScrollTop(metrics, scroller.scrollTop, first, last)
          : null;
      if (top !== null) {
        scroller.scrollTo?.({ top });
      }
      notifyShown();
      return;
    }

    const stop = runZukanStamps(scroller, indices, {
      onProgress(next) {
        // 押す姿の動きと同じコマで数とマスの姿を描くよう、コマの中で描き直しを済ませる。
        flushSync(() => {
          setProgress({ ...next, difficulty: revealingDifficulty });
        });
      },
      onEnd(newPieces) {
        stopNewPieceMarks.current();
        stopNewPieceMarks.current = markNewPieces(newPieces);
        notifyShown();
      },
      onSkippedByTap(target) {
        stopSuppressingClick.current();
        stopSuppressingClick.current = latest.current.isClickThroughTarget(
          target,
        )
          ? cancelNothing
          : suppressNextClick();
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
