/**
 * 遊び方のまとまりや項目を見せる環境。
 * - `always`: いつも見せる。
 * - `fine-pointer`: マウスなど細かいポインターのときだけ見せる（右クリックやキーボードの操作）。
 */
export type HowToPlayAvailability = "always" | "fine-pointer";

/** まとまり（`<section>`）や項目（`<li>`）を見せる環境ごとの表示。 */
export const howToPlayAvailabilityClassNames = {
  always: null,
  "fine-pointer": "hidden pointer-fine:block",
} as const satisfies Record<HowToPlayAvailability, string | null>;
