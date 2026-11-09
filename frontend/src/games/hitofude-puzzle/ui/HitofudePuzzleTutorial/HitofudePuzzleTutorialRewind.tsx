import { type ReactNode, useEffect, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

type HitofudePuzzleTutorialRewindProps = {
  /** 巻き戻すゴールの道。始点から始まる。 */
  path: readonly number[];
  /** `true` の間、ゴールの道を終点から1マスずつ縮めて、始点だけの道まで巻き戻す。`false` に戻ると巻き戻しを外す。 */
  active: boolean;
  onComplete: () => void;
  /** 巻き戻している間はその途中の道を、それ以外は `null` を受け取って盤面を描く。 */
  children: (path: readonly number[] | null) => ReactNode;
};

/** 1マス縮めるごとの間隔。全体が名前を上部へ移す動きより短い間に収まるようにする。 */
const REWIND_STEP_MS = 45;
/** 縮め始めるまでと、始点だけの道になってから終えるまでの間。 */
const REWIND_SETTLE_MS = 200;

/**
 * 導入で、ゴールの道を終点から始点まで1マスずつ巻き戻し、始めの盤面へ移す。
 * 動きを減らす設定では、巻き戻さずにすぐ終える。
 */
export function HitofudePuzzleTutorialRewind({
  path,
  active,
  onComplete,
  children,
}: HitofudePuzzleTutorialRewindProps) {
  const [length, setLength] = useState(path.length);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (prefersReducedMotion()) {
      onComplete();
      return;
    }

    const shortenings = Array.from(
      { length: path.length - 1 },
      (_, index) => path.length - 1 - index,
    );
    const timers = [
      ...shortenings.map((nextLength, index) =>
        window.setTimeout(
          () => setLength(nextLength),
          REWIND_SETTLE_MS + index * REWIND_STEP_MS,
        ),
      ),
      window.setTimeout(
        onComplete,
        REWIND_SETTLE_MS * 2 + (shortenings.length - 1) * REWIND_STEP_MS,
      ),
    ];
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      setLength(path.length);
    };
  }, [active, onComplete, path.length]);

  return children(active ? path.slice(0, length) : null);
}
