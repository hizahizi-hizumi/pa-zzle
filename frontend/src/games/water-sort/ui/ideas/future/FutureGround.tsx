import { useEffect, useId, useRef } from "react";

import { getInstrumentScaleStyle } from "@/games/water-sort/ui/ideas/future/instrument-scale";
import { prefersReducedMotion } from "@/lib/motion";

const STANDBY_BREATH_MS = 7200;
const scaleStyle = getInstrumentScaleStyle("rgba(159,198,214,0.12)");

/** 深い色の制御室。削り出しの金属の盤に、薄い計器の線と、待機中の小さな灯だけを置く。 */
export function FutureGround() {
  const id = useId();
  const brushedId = `${id}-brushed`;
  const standbyRef = useRef<HTMLSpanElement>(null);

  // 装置が待機していることだけを、ごく遅く小さな明滅で示す。
  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    const animation = standbyRef.current?.animate?.(
      [{ opacity: 0.3 }, { opacity: 0.75 }, { opacity: 0.3 }],
      {
        duration: STANDBY_BREATH_MS,
        iterations: Number.POSITIVE_INFINITY,
        easing: "ease-in-out",
      },
    );
    return () => animation?.cancel();
  }, []);

  return (
    <div className="relative size-full overflow-hidden bg-[#0a0f14]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% 52%, rgba(64,104,122,0.15), rgba(10,15,20,0) 62%), linear-gradient(180deg, #0b1117 0%, #0a1015 45%, #090d11 100%)",
        }}
      />
      <svg aria-hidden="true" className="absolute inset-0 size-full">
        <filter id={brushedId} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0025 0.75"
            numOctaves="2"
            seed="11"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.62  0 0 0 0 0.74  0 0 0 0 0.82  0 0 0 0.08 0"
          />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${brushedId})`} />
      </svg>

      <div className="absolute top-[20%] left-[9px] h-[60%] w-[9px] border-l border-[rgba(159,198,214,0.1)]">
        <div className="size-full" style={scaleStyle} />
      </div>
      <div className="absolute top-[20%] right-[9px] h-[60%] w-[9px] -scale-x-100 border-l border-[rgba(159,198,214,0.1)]">
        <div className="size-full" style={scaleStyle} />
      </div>

      {/* 制御盤の縁。待ったの上を横切る、削り出しの段差。 */}
      <div className="absolute inset-x-[6%] bottom-[118px] h-px bg-[rgba(159,198,214,0.1)]" />
      <div className="absolute inset-x-[6%] bottom-[116px] h-px bg-black/40" />
      <div className="absolute bottom-[117px] left-[6%] h-[3px] w-[18px] bg-[rgba(159,198,214,0.16)]" />
      <div className="absolute right-[6%] bottom-[117px] h-[3px] w-[18px] bg-[rgba(159,198,214,0.16)]" />

      <span
        ref={standbyRef}
        className="absolute top-[18%] right-[12px] size-[3px] rounded-full bg-[#7fd4ee] opacity-50 shadow-[0_0_4px_rgba(127,212,238,0.7)]"
      />
      <span className="absolute top-[calc(18%+9px)] right-[12.5px] size-[2px] rounded-full bg-[#e0a85a] opacity-30" />
      <span className="absolute top-[18%] left-[12.5px] size-[2px] rounded-full bg-[#7fd4ee] opacity-25" />
    </div>
  );
}
