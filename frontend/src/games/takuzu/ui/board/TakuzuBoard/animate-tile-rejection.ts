import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";

const tileRejectionShakeTiming: RejectionShakeTiming = {
  durationMs: 220,
  easing: "ease-out",
};

/** マスの幅に対する揺れ幅。1往復目を大きく、2往復目で収める。 */
const tileRejectionShakeKeyframes: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-5%)" },
  { transform: "translateX(5%)" },
  { transform: "translateX(-2%)" },
  { transform: "translateX(0)" },
];

/**
 * 押した手が通らないことを、そのマスのタイルだけの小さな横揺れで返す。
 * 固定マスを押したときと、チュートリアルでルールに合わないタイルを置いたときに使う。
 */
export function animateTakuzuTileRejection(
  element: HTMLElement | undefined,
): void {
  playRejectionShake(
    element?.querySelector<HTMLElement>("[data-takuzu-tile]"),
    tileRejectionShakeKeyframes,
    tileRejectionShakeTiming,
  );
}
