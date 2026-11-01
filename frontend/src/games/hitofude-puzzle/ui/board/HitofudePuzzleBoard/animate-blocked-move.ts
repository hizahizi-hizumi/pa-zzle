import type { HitofudePuzzleBlockedMove } from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type { HitofudePuzzleDirection } from "@/games/hitofude-puzzle/puzzle/board";
import { hitofudePuzzleFigureParts } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";

const headShakeTiming: RejectionShakeTiming = {
  durationMs: 260,
  easing: "ease-out",
};

/** 先端が進もうとした向きへ小さく突き当たって戻る揺れの、動く距離（マス幅に対する割合）。 */
const HEAD_BUMP_DISTANCE = 0.14;
/** 向きの無い（先端から離れたマスを押した）ときの、左右の揺れの幅（マス幅に対する割合）。 */
const HEAD_SHAKE_DISTANCE = 0.08;

/**
 * 進もうとしたマスの×。すぐ点け、目を向けてから読める間（0.7秒ほど）を置いてゆっくり消す。
 * 次の操作の邪魔にならないよう、1秒で消し切る。動きを減らす設定でも、動かない印として返す。
 */
const BLOCKED_MARK_DURATION_MS = 1_000;
const blockedMarkKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 1, offset: 0.05 },
  { opacity: 1, offset: 0.7 },
  { opacity: 0 },
];

const directionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<HitofudePuzzleDirection, { x: number; y: number }>;

/** SVG の中の要素の CSS の長さは、図の座標（マス幅 1）で読まれる。 */
function translate(x: number, y: number): Keyframe {
  return { transform: `translate(${x}px, ${y}px)` };
}

function createHeadShakeKeyframes(
  direction: HitofudePuzzleDirection | null,
): Keyframe[] {
  if (direction === null) {
    return [
      translate(0, 0),
      translate(-HEAD_SHAKE_DISTANCE, 0),
      translate(HEAD_SHAKE_DISTANCE, 0),
      translate(-HEAD_SHAKE_DISTANCE / 2, 0),
      translate(0, 0),
    ];
  }
  const { x, y } = directionVectors[direction];
  return [
    translate(0, 0),
    translate(x * HEAD_BUMP_DISTANCE, y * HEAD_BUMP_DISTANCE),
    translate(0, 0),
    translate((x * HEAD_BUMP_DISTANCE) / 3, (y * HEAD_BUMP_DISTANCE) / 3),
    translate(0, 0),
  ];
}

/**
 * 道を延ばせなかったことを盤面で返す。進もうとしたマスに×を短く点け、先端を進もうとした向きへ小さく揺らす。
 * 指で隠れやすい先端だけでなく、押した・なぞった先でも拒まれたと分かるようにする。
 * 先端の揺れは動きを減らす設定では出さず（`playRejectionShake`）、×だけを返す。
 */
export function animateBlockedMove(
  figure: SVGSVGElement | null,
  blockedMove: HitofudePuzzleBlockedMove,
): void {
  playRejectionShake(
    figure?.querySelector(`[${hitofudePuzzleFigureParts.head}]`),
    createHeadShakeKeyframes(blockedMove.direction),
    headShakeTiming,
  );
  if (blockedMove.cell !== null) {
    figure
      ?.querySelector(`[${hitofudePuzzleFigureParts.blockedMark}]`)
      ?.animate?.(blockedMarkKeyframes, {
        duration: BLOCKED_MARK_DURATION_MS,
        easing: "ease-out",
      });
  }
}
