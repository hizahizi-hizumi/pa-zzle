// 盤面と地で同じ光を共有するための小さな入れ物。盤面が書き、地が読む。
import { useSyncExternalStore } from "react";

export type LightMood = {
  /** normal: 午後の光。dim: 手詰まりで光が傾いて弱まる。clear: 完成して光が強まる。 */
  kind: "normal" | "dim" | "clear";
  /** 完成したときに窓を染める色 */
  colors: readonly string[];
};

const listeners = new Set<() => void>();
let current: LightMood = { kind: "normal", colors: [] };

export function setLightMood(next: LightMood) {
  if (
    next.kind === current.kind &&
    next.colors.join() === current.colors.join()
  ) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLightMood(): LightMood {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
