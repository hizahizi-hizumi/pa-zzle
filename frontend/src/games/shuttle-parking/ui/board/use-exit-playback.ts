import { useEffect, useState } from "react";
import type {
  ShuttleParkingExitFrame,
  ShuttleParkingExitTimeline,
} from "@/games/shuttle-parking/play/exit-timeline";
import { prefersReducedMotion } from "@/lib/motion";

export type ShuttleParkingExitPlayback = {
  /** 今見せる時点。動きが無いか終えたら `null` で、盤面の今の状態を見せる。 */
  frame: ShuttleParkingExitFrame | null;
};

type PlaybackSource = {
  /** 出庫ごとに変わる値。 */
  id: number;
  timeline: ShuttleParkingExitTimeline;
  /** 出庫した時刻（`Date.now()`）。描き直しや置き場所の替わりで部品を作り直しても、動きをやり直さずに続きから見せる。 */
  startedAt: number;
} | null;

function findFrameIndex(
  timeline: ShuttleParkingExitTimeline,
  elapsedMs: number,
): number | null {
  if (elapsedMs >= timeline.durationMs) return null;
  return Math.max(
    0,
    timeline.frames.findLastIndex((frame) => frame.atMs <= elapsedMs),
  );
}

/**
 * 1回の出庫の動きを、時刻どおりに1つずつ進める。次の車を押したら、今の動きを飛ばして新しい出庫の動きを始める。
 * 動きを減らす設定では、動かさずにすぐ結果を見せる。
 */
export function useShuttleParkingExitPlayback(
  source: PlaybackSource,
): ShuttleParkingExitPlayback {
  const [, setTick] = useState(0);
  const id = source?.id ?? null;
  const timeline = source?.timeline ?? null;
  const startedAt = source?.startedAt ?? 0;

  useEffect(() => {
    if (id === null || timeline === null || prefersReducedMotion()) return;
    const elapsedMs = Date.now() - startedAt;
    const timers = [
      ...timeline.frames.map((frame) => frame.atMs),
      timeline.durationMs,
    ]
      .filter((atMs) => atMs > elapsedMs)
      .map((atMs) =>
        window.setTimeout(() => setTick((tick) => tick + 1), atMs - elapsedMs),
      );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [id, timeline, startedAt]);

  if (id === null || timeline === null || prefersReducedMotion()) {
    return { frame: null };
  }
  const index = findFrameIndex(timeline, Date.now() - startedAt);
  return { frame: index === null ? null : (timeline.frames[index] ?? null) };
}
