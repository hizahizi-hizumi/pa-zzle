const GIVEN_CELL_SHAKE_MS = 220;

/** マスの幅に対する揺れ幅。1往復目を大きく、2往復目で収める。 */
const givenCellShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-5%)" },
  { transform: "translateX(5%)" },
  { transform: "translateX(-2%)" },
  { transform: "translateX(0)" },
];

/** 固定マスは押しても変わらないことを、そのマスだけの小さな横揺れで返す。 */
export function animateGivenCellRejection(
  element: HTMLElement | undefined,
): void {
  const tile = element?.querySelector<HTMLElement>("[data-takuzu-tile]");
  if (
    !tile?.animate ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  tile.animate(givenCellShakeKeyframes, {
    duration: GIVEN_CELL_SHAKE_MS,
    easing: "ease-out",
  });
}
