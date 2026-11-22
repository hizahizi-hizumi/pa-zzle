import { useEffect, useRef } from "react";

import type { TestTubeSealTiming } from "@/games/water-sort/ui/board/test-tube/seal-timing";
import { prefersReducedMotion } from "@/lib/motion";

/** 液が満ちきる少し前から明るさを昇らせ始め、栓が下り始めて少し経つまでに液面へ抜けさせる。今の絵と同じ時刻。 */
const FUSE_LEAD_MS = 220;
const FUSE_TAIL_MS = 60;

type FlatSealingFuseProps = {
  timing: TestTubeSealTiming;
};

/** 1種類で満ちた液が、ひとつの液に溶け合う光。平らな白い帯が底から液面へ昇り、液全体がいちど平らに明るむ。 */
export function FlatSealingFuse({ timing }: FlatSealingFuseProps) {
  const bandRef = useRef<HTMLSpanElement>(null);
  const brightenRef = useRef<HTMLSpanElement>(null);
  const { filledMs, stopperStartMs } = timing;

  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    const startMs = Math.max(0, filledMs - FUSE_LEAD_MS);
    const options: KeyframeAnimationOptions = {
      delay: startMs,
      duration: Math.max(1, stopperStartMs + FUSE_TAIL_MS - startMs),
      fill: "both",
    };
    const band = bandRef.current?.animate?.(
      [
        { transform: "translateY(110%)", opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 1, offset: 0.75 },
        { transform: "translateY(-130%)", opacity: 0 },
      ],
      { ...options, easing: "cubic-bezier(.4,0,.3,1)" },
    );
    const brighten = brightenRef.current?.animate?.(
      [{ opacity: 0 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }],
      { ...options, easing: "ease-in-out" },
    );
    return () => {
      band?.cancel();
      brighten?.cancel();
    };
  }, [filledMs, stopperStartMs]);

  return (
    <span
      data-sealing-fuse=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <span
        ref={brightenRef}
        className="absolute inset-0 bg-white/25 opacity-0"
      />
      {/* 動きの距離を今の絵と同じにするため、動かす箱は同じ高さにして、帯はその上の端に置く。 */}
      <span
        ref={bandRef}
        className="absolute inset-x-0 bottom-0 h-[45%] opacity-0"
      >
        <span className="absolute inset-x-0 top-0 h-1/3 bg-white/50" />
      </span>
    </span>
  );
}
