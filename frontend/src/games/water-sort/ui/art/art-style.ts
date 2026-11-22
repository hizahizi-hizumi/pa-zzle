import { getDefaultStorage } from "@/lib/browser-storage";

/**
 * 理科室の絵の方向を見比べるための試作。PO が方向を選ぶまでの間だけ置く。
 * `lab` は今の絵、`flat` はフラットに振り切った絵、`real` はリアルに振り切った絵。
 */
export const WATER_SORT_ART_STYLES = [
  { id: "lab", label: "今の絵" },
  { id: "flat", label: "A フラット" },
  { id: "real", label: "B リアル" },
] as const;

export type WaterSortArtStyle = (typeof WATER_SORT_ART_STYLES)[number]["id"];

const STORAGE_KEY = "pa-zzle:water-sort-art";
const QUERY_KEY = "art";
const listeners = new Set<() => void>();
let current: WaterSortArtStyle | null = null;

function isWaterSortArtStyle(value: unknown): value is WaterSortArtStyle {
  return WATER_SORT_ART_STYLES.some(({ id }) => id === value);
}

function save(style: WaterSortArtStyle) {
  try {
    getDefaultStorage()?.setItem(STORAGE_KEY, style);
  } catch {
    // 保存できなくても、この画面の中では切り替わる。
  }
}

function readInitial(): WaterSortArtStyle {
  if (typeof window === "undefined") return "lab";
  const fromQuery = new URLSearchParams(window.location.search).get(QUERY_KEY);
  if (isWaterSortArtStyle(fromQuery)) {
    save(fromQuery);
    return fromQuery;
  }
  try {
    const stored = getDefaultStorage()?.getItem(STORAGE_KEY);
    return isWaterSortArtStyle(stored) ? stored : "lab";
  } catch {
    return "lab";
  }
}

export function getWaterSortArtStyle(): WaterSortArtStyle {
  current ??= readInitial();
  return current;
}

export function setWaterSortArtStyle(style: WaterSortArtStyle) {
  current = style;
  save(style);
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.has(QUERY_KEY)) {
      url.searchParams.set(QUERY_KEY, style);
      window.history.replaceState(window.history.state, "", url);
    }
  }
  for (const listener of listeners) listener();
}

export function subscribeWaterSortArtStyle(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
