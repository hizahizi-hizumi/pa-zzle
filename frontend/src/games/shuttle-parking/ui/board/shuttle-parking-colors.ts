import type { ShuttleParkingColor } from "@/games/shuttle-parking/puzzle/lot";

/**
 * 車と乗客で同じ色を使う。色相に加えて明るさも離し（黄・赤・青・紫の順に暗い）、
 * どちらの画面の明るさでも同じ値で見分けられるようにする。
 */
export const shuttleParkingColorFills = {
  a: "#e5484d",
  b: "#2f6fe4",
  c: "#f2b42a",
  d: "#7c3fd6",
} as const satisfies Record<ShuttleParkingColor, string>;

export const shuttleParkingColorNames = {
  a: "赤",
  b: "青",
  c: "黄",
  d: "紫",
} as const satisfies Record<ShuttleParkingColor, string>;
