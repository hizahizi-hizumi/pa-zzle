// 試作 bench の盤面と地をつなぐ。盤面が立ての置き場所と場面の様子を知らせ、地がそれに合わせて台と光を描く。
import { useSyncExternalStore } from "react";

export type BenchScene = {
  /** 台の天板の奥の縁（壁との境）の y（画面の座標）。null は未計測。 */
  horizonY: number | null;
  /** 窓の下端を隠せる高さ（上の段の下の板の天面、画面の座標）。null は未計測。 */
  windowBottomY: number | null;
  /** 立ての左右（画面の座標）。 */
  rackLeft: number;
  rackRight: number;
  rackBottom: number;
  /** 手詰まりで光が陰っている。 */
  dimmed: boolean;
  /** 完成して光が満ちている。 */
  cleared: boolean;
};

let scene: BenchScene = {
  horizonY: null,
  windowBottomY: null,
  rackLeft: 0,
  rackRight: 0,
  rackBottom: 0,
  dimmed: false,
  cleared: false,
};
const listeners = new Set<() => void>();

export function updateBenchScene(patch: Partial<BenchScene>) {
  const next = { ...scene, ...patch };
  const changed = (Object.keys(patch) as (keyof BenchScene)[]).some(
    (key) => next[key] !== scene[key],
  );
  if (!changed) return;
  scene = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBenchScene(): BenchScene {
  return useSyncExternalStore(
    subscribe,
    () => scene,
    () => scene,
  );
}
