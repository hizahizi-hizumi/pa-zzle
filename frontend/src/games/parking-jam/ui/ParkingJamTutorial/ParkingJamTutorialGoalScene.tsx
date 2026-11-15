import { type ReactNode, useEffect, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

type ParkingJamTutorialGoalSceneProps = {
  /** 盤面を描き始めてから、車をすべて出し終えるまでの間。 */
  durationMs: number;
  /** `true` の間、場面の動きを見せる。 */
  playing: boolean;
  /** 車をすべて出し終えたら呼ぶ。動きを減らす設定では、すぐ呼ぶ。 */
  onSceneEnd: () => void;
  /** 車を出していく途中は `true` を受け取って盤面を描く。`false` なら、空の駐車場を描く。 */
  children: (departing: boolean) => ReactNode;
};

/**
 * 導入のゴールの場面で、盤面を描き始めたときから車を1台ずつ出していき、空の駐車場にする。
 * 出し終えるまでを場面の動きとし、押したりキーを押したりして場面の動きを終えたら、空の駐車場をすぐ見せる。
 * 動きを減らす設定では、空の駐車場をすぐ見せる。
 */
export function ParkingJamTutorialGoalScene({
  durationMs,
  playing,
  onSceneEnd,
  children,
}: ParkingJamTutorialGoalSceneProps) {
  const [departed, setDeparted] = useState(prefersReducedMotion);
  const startedAtRef = useRef(Date.now());
  const notifiedRef = useRef(false);
  // 場面の動きを見せ始めたか。見せ始めた後に `playing` が `false` になれば、場面の動きを終えたとみる。
  const [shown, setShown] = useState(playing);
  if (playing && !shown) {
    setShown(true);
  }
  const departing = !departed && !(shown && !playing);

  useEffect(() => {
    if (!playing || notifiedRef.current) {
      return;
    }
    const elapsedMs = Date.now() - startedAtRef.current;
    const remainingMs = departed ? 0 : Math.max(0, durationMs - elapsedMs);
    const timer = window.setTimeout(() => {
      notifiedRef.current = true;
      setDeparted(true);
      onSceneEnd();
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [playing, departed, durationMs, onSceneEnd]);

  return children(departing);
}
