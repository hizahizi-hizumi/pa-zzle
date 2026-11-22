import type { ShuttleParkingColor } from "@/games/shuttle-parking/puzzle/lot";

/** 車と乗客で同じ色を使う。どちらの画面の明るさでも同じ値で見分けられる彩度にする。 */
export const shuttleParkingColorFills = {
  a: "#e5484d",
  b: "#3b7cf0",
  c: "#f0b429",
  d: "#9b6cf0",
} as const satisfies Record<ShuttleParkingColor, string>;

export const shuttleParkingColorNames = {
  a: "赤",
  b: "青",
  c: "黄",
  d: "紫",
} as const satisfies Record<ShuttleParkingColor, string>;
