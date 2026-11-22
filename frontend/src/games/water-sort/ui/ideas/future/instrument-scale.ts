import type { CSSProperties } from "react";

/** 制御室の左右の壁に刻んだ目盛り。長い刻みと短い刻みを交互に置く。 */
export function getInstrumentScaleStyle(color: string): CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(180deg, ${color} 0 1px, transparent 1px 24px), repeating-linear-gradient(180deg, transparent 0 12px, ${color} 12px 13px, transparent 13px 24px)`,
    backgroundSize: "8px 100%, 4px 100%",
    backgroundRepeat: "no-repeat",
  };
}
