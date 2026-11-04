import type { ProblemId } from "@/games/problem-id";
import { type GameResultLevel, gameResultLevels } from "@/games/result";
import {
  getZukanProblemStatus,
  type ZukanProblem,
  type ZukanProblemStatus,
} from "@/zukan/zukan-collection";
import type { ZukanProblemChange } from "@/zukan/zukan-last-viewed";

/**
 * 前回図鑑を見たときからの変化を、台紙のマスでどう見せるか。
 * - `animated`: 前回の姿から、変化したマスを1つずつ押していく演出で見せる。
 * - `marked`: 動きを減らす設定で、動かさずに今の姿に印を載せて見せる。
 */
export type ZukanChangeAppearance = "animated" | "marked";

/**
 * 変化したマスの、今見せている段階。
 * - `waiting`: まだ押していない。前回の姿で描く。
 * - `stamping`: 押している途中で、まだマスに着いていない。下には前回の姿を残す。
 * - `landed`: マスに着いた。今の姿で描き、押した動きの残りを見せる。
 * - `marked`: 動きを減らす設定で、今の姿に印を載せる。
 */
export type ZukanChangeStage = "waiting" | "stamping" | "landed" | "marked";

/** 押す1マスの、押し方の強さを決める変化。 */
export type ZukanStamp = {
  /** 今の評価段階。 */
  level: GameResultLevel;
  /** 前回解いていて、評価段階が上がったか。 */
  isRaised: boolean;
};

/** 変化したマスの、今の評価段階と前回の状態。押していく演出は、マスに載せたこれを読んで押し方を決める。 */
export function getZukanStamp(
  problem: ZukanProblem,
  change: ZukanProblemChange,
): ZukanStamp | null {
  const status = getZukanProblemStatus(problem);
  return status === "attempted" || status === "untouched"
    ? null
    : { level: status, isRaised: change.kind === "raised" };
}

/** マスの `data-change-level` と `data-change-raised` から、押す変化を読む。 */
export function readZukanStamp(square: Element): ZukanStamp | null {
  const level = square.getAttribute("data-change-level");
  const solvedLevel = gameResultLevels.find((value) => value === level);
  return solvedLevel === undefined
    ? null
    : {
        level: solvedLevel,
        isRaised: square.hasAttribute("data-change-raised"),
      };
}

/**
 * 押す変化の重さ。perfect、段階の上がり、great、good、clear の順に重い。
 * まとめて押す回で音を代表して鳴らすマスを選ぶのに使う。
 */
export function getZukanStampWeight({ level, isRaised }: ZukanStamp): number {
  const levelWeight = gameResultLevels.indexOf(level);
  return level === "perfect"
    ? gameResultLevels.length + 1
    : isRaised
      ? gameResultLevels.length
      : levelWeight;
}

/** `stamps` のうち最も重い変化の位置。空なら `null`。 */
export function findZukanHeaviestStamp(
  stamps: readonly ZukanStamp[],
): number | null {
  let heaviest: number | null = null;
  stamps.forEach((stamp, index) => {
    const current = heaviest === null ? undefined : stamps[heaviest];
    if (
      current === undefined ||
      getZukanStampWeight(stamp) > getZukanStampWeight(current)
    ) {
      heaviest = index;
    }
  });
  return heaviest;
}

/** 押す1マスの動きの長さ。perfect は落とす間とその後の余韻を長く取る。 */
export const ZUKAN_STAMP_DURATION_MS = {
  /** 浮いた姿から縮んでマスに着くまで。 */
  drop: 200,
  perfectDrop: 300,
  /** マスに着いてから、少し膨らんで戻るまで。 */
  settle: 200,
  /** マスに着いてから、衝撃波と粒が消えるまで。 */
  impactTail: 380,
  perfectImpactTail: 520,
} as const;

/** 1マスを押し始めてから、その動きが終わるまで。 */
export function getZukanStampTailMs({ level }: ZukanStamp): number {
  return level === "perfect"
    ? ZUKAN_STAMP_DURATION_MS.perfectDrop +
        ZUKAN_STAMP_DURATION_MS.perfectImpactTail
    : ZUKAN_STAMP_DURATION_MS.drop + ZUKAN_STAMP_DURATION_MS.impactTail;
}

/** 台紙を開いてから、最初のマスを押し始めるまでの最短の時間。台紙のスクロールが長ければ、その終わりまで待つ。 */
const PREVIOUS_STATE_HOLD_MS = 300;
/** 変化が少ないときの、隣り合う順のマスを押し始める間隔。 */
const STAMP_INTERVAL_MAX_MS = 160;
/** 変化が多いときにも空ける、押し始める間隔の下限。 */
const STAMP_INTERVAL_MIN_MS = 50;
/** 開いてから、最後のマスの動きが消えるまでの目安の上限。変化が多ければ押す間隔を詰める。台紙のスクロールを待つ分は含めない。 */
const REVEAL_DURATION_MAX_MS = 1700;
/** perfect を含む回の前に置く間。直前で溜めて、perfect を特別に見せる。 */
const PERFECT_PAUSE_MS = 180;
/** perfect の前に間を置く回の数の上限。perfect が多くても全体の長さを保つ。 */
const PAUSED_SLOT_LIMIT = 2;
/** 1つずつ押すマスの数。これより後に変化したマスは、最後にまとめて押す。 */
const INDIVIDUAL_STAMP_LIMIT = 12;
/** 押すマスを見えているものとする、台紙の見える範囲の端からの距離。浮いた姿と衝撃波が端で切れない幅。 */
const REVEAL_SCROLL_MARGIN_PX = 32;

/** 変化したマスを押す順のうち `order` 番目のマスを押す回。1つずつ押す数より後のマスは、最後の1回にまとめる。 */
export function getZukanStampSlot(order: number): number {
  return Math.min(order, INDIVIDUAL_STAMP_LIMIT);
}

/** 変化したマスが `changeCount` 個のときに、押す回の数。 */
export function countZukanStampSlots(changeCount: number): number {
  return changeCount === 0 ? 0 : getZukanStampSlot(changeCount - 1) + 1;
}

/** 押す順に並べたものを、押す回ごとに分ける。 */
export function groupZukanStampSlots<Item>(items: readonly Item[]): Item[][] {
  const slots: Item[][] = [];
  items.forEach((item, order) => {
    const slot = getZukanStampSlot(order);
    slots[slot] = [...(slots[slot] ?? []), item];
  });
  return slots;
}

/** マスを押す回ごとの時刻。台紙を開いてからの経過で表す。 */
export type ZukanStampPlan = {
  /** 回ごとの、押し始める時刻。スクロールを待つ間は後へずれる。 */
  slotStartMs: readonly number[];
  /** 最後のマスの動きが終わる時刻の見込み。 */
  endMs: number;
};

const typicalStampTailMs = getZukanStampTailMs({
  level: "clear",
  isRaised: false,
});

/**
 * 回ごとに押すマスの変化 `slots` から、押し始める時刻を決める。
 * 少ないうちは一定の間隔で押し、多ければ全体が上限に収まるよう間隔を詰める。
 * perfect を含む回の前には間を置き、その分だけ後の回を後ろへずらす。間を置くのは最初の回を除いて上限の数まで。
 */
export function planZukanStamps(
  slots: readonly (readonly ZukanStamp[])[],
): ZukanStampPlan {
  let pausedSlotCount = 0;
  const pauses = slots.map((stamps, slot): number => {
    const hasPerfect = stamps.some(({ level }) => level === "perfect");
    if (!hasPerfect || slot === 0 || pausedSlotCount >= PAUSED_SLOT_LIMIT) {
      return 0;
    }
    pausedSlotCount += 1;
    return PERFECT_PAUSE_MS;
  });
  const totalPauseMs = pauses.reduce((total, pause) => total + pause, 0);
  const intervalMs =
    slots.length > 1
      ? Math.max(
          STAMP_INTERVAL_MIN_MS,
          Math.min(
            STAMP_INTERVAL_MAX_MS,
            (REVEAL_DURATION_MAX_MS -
              typicalStampTailMs -
              PREVIOUS_STATE_HOLD_MS -
              totalPauseMs) /
              (slots.length - 1),
          ),
        )
      : 0;
  let pausedMs = 0;
  const slotStartMs = slots.map((_, slot) => {
    pausedMs += pauses[slot] ?? 0;
    return Math.round(PREVIOUS_STATE_HOLD_MS + slot * intervalMs + pausedMs);
  });
  const endMs = Math.max(
    0,
    ...slots.flatMap((stamps, slot) =>
      stamps.map(
        (stamp) => (slotStartMs[slot] ?? 0) + getZukanStampTailMs(stamp),
      ),
    ),
  );
  return { slotStartMs, endMs };
}

/** 台紙のスクロール領域で見えている範囲や、マスの範囲の、画面の上下の位置。 */
export type ZukanVerticalSpan = { top: number; bottom: number };

export function joinZukanVerticalSpans(
  spans: readonly ZukanVerticalSpan[],
): ZukanVerticalSpan | null {
  if (spans.length === 0) {
    return null;
  }
  return {
    top: Math.min(...spans.map(({ top }) => top)),
    bottom: Math.max(...spans.map(({ bottom }) => bottom)),
  };
}

/** 見えている範囲 `view` の中に、端から `margin` 空けて `target` が入っているか。 */
export function isZukanSpanInView(
  view: ZukanVerticalSpan,
  target: ZukanVerticalSpan,
  margin = 0,
): boolean {
  return (
    target.top >= view.top + margin && target.bottom <= view.bottom - margin
  );
}

/** 押すマスの範囲 `target` が、浮いた姿が端で切れない余白を空けて見えているか。 */
export function isZukanStampTargetVisible(
  view: ZukanVerticalSpan,
  target: ZukanVerticalSpan,
): boolean {
  return isZukanSpanInView(view, target, REVEAL_SCROLL_MARGIN_PX);
}

/**
 * 押すマスの範囲 `target` が、端から余白を空けて見えるようにする台紙のスクロール位置。既に見えていれば `null`。
 * 範囲が見える範囲に入るなら、動かす量が最も小さい位置にする。入らなければ、範囲の先頭を見える範囲の上端に寄せ、後に続くマスをなるべく多く見せる。
 */
export function findZukanRevealScrollTop(
  view: ZukanVerticalSpan,
  scrollTop: number,
  target: ZukanVerticalSpan,
): number | null {
  const margin = REVEAL_SCROLL_MARGIN_PX;
  if (isZukanStampTargetVisible(view, target)) {
    return null;
  }
  const fits =
    target.bottom - target.top + margin * 2 <= view.bottom - view.top;
  const offset =
    fits && target.bottom > view.bottom - margin
      ? target.bottom - (view.bottom - margin)
      : target.top - (view.top + margin);
  return Math.max(0, scrollTop + offset);
}

/**
 * 押す回ごとに、次に押すマスの範囲 `next` を見せるための台紙のスクロール位置。`next` が見えていれば動かさず `null`。
 * 見えていなければ、まだ押していないマスの範囲 `rest` を `findZukanRevealScrollTop` と同じく見せる。
 */
export function findZukanFollowScrollTop(
  view: ZukanVerticalSpan,
  scrollTop: number,
  next: ZukanVerticalSpan,
  rest: ZukanVerticalSpan,
): number | null {
  return isZukanStampTargetVisible(view, next)
    ? null
    : findZukanRevealScrollTop(view, scrollTop, rest);
}

/** まだ見せていない変化 `pendingChange` があれば前回の姿、無ければ今の姿。 */
export function getZukanShownProblemStatus(
  problem: ZukanProblem,
  pendingChange: ZukanProblemChange | undefined,
): ZukanProblemStatus {
  return pendingChange === undefined
    ? getZukanProblemStatus(problem)
    : pendingChange.previousStatus;
}

/** 変化のうち、新しく解いた問題の数。 */
export function countZukanNewlySolved(
  changes: ReadonlyMap<ProblemId, ZukanProblemChange> | undefined,
): number {
  let count = 0;
  for (const { kind } of changes?.values() ?? []) {
    if (kind === "newly-solved") {
      count += 1;
    }
  }
  return count;
}
