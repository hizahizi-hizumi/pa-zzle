import { useEffect, useRef } from "react";

import type { TestTubeSealTiming } from "@/games/water-sort/ui/board/test-tube/seal-timing";
import { prefersReducedMotion } from "@/lib/motion";

/** 液が満ちきる少し前から明るさを昇らせ始め、栓が下り始めて少し経つまでに液面へ抜けさせる。 */
const FUSE_LEAD_MS = 220;
const FUSE_TAIL_MS = 60;

type SealingFuseProps = {
  timing: TestTubeSealTiming;
};

/** 1種類で満ちた液が、継ぎ目の無いひとつの液に溶け合う光。底から液面へ明るさが昇り、液全体がいちど澄んで明るむ。 */
export function SealingFuse({ timing }: SealingFuseProps) {
  const sheenRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
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
    const sheen = sheenRef.current?.animate?.(
      [
        { transform: "translateY(110%)", opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { opacity: 1, offset: 0.75 },
        { transform: "translateY(-130%)", opacity: 0 },
      ],
      { ...options, easing: "cubic-bezier(.4,0,.3,1)" },
    );
    const glow = glowRef.current?.animate?.(
      [{ opacity: 0 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }],
      { ...options, easing: "ease-in-out" },
    );
    return () => {
      sheen?.cancel();
      glow?.cancel();
    };
  }, [filledMs, stopperStartMs]);

  return (
    <span
      data-sealing-fuse=""
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <span
        ref={glowRef}
        className="absolute inset-0 bg-white/45 opacity-0 mix-blend-soft-light"
      />
      <span
        ref={sheenRef}
        className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-b from-transparent via-white/55 to-transparent opacity-0"
      />
    </span>
  );
}
