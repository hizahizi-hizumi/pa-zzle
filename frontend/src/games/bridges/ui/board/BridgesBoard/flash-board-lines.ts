import { bridgesFigureParts } from "@/games/bridges/ui/board/BridgesFigure";

/**
 * 盤面の線の点灯。すぐ点け、目を向けてから読める間を置いてゆっくり消す。次の操作の邪魔にならないよう、0.9秒で消し切る。
 * 動かない点灯なので、動きを減らす設定でも返す。
 */
const FLASH_MS = 900;
const flashKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.06 },
  { opacity: 1, offset: 0.6 },
  { opacity: 0 },
];

/**
 * 押した操作が盤面を変えなかった理由を、線を短く点けて返す。文字は出さない。
 * - `blockingBridges`: 交わる橋に阻まれて架けられなかった。押した所ではなく、阻んだ橋を規則に合わない色で点け、何に阻まれたかを形で知らせる。
 * - `ambiguousEdges`: 交点の真上など、どちらを狙ったか決まらない所を押した。候補の2本の線を点け、少しずらして押せばよいことを知らせる。
 */
export function flashBoardLines(
  figure: SVGSVGElement | null,
  part: "blockingBridges" | "ambiguousEdges",
): void {
  figure
    ?.querySelector(`[${bridgesFigureParts[part]}]`)
    ?.animate?.(flashKeyframes, { duration: FLASH_MS, easing: "ease-out" });
}
