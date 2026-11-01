import type { HamiltonianPathBlockedMove } from "@/games/hamiltonian-path/play/use-hamiltonian-path-play";
import {
  createHamiltonianPathPartition,
  getHamiltonianPathNeighborCell,
  type HamiltonianPathDirection,
} from "@/games/hamiltonian-path/puzzle/board";
import {
  getPartitionKey,
  hamiltonianPathFigureParts,
} from "@/games/hamiltonian-path/ui/board/HamiltonianPathFigure";
import { playRejectionShake, type RejectionShakeTiming } from "@/lib/motion";

const headShakeTiming: RejectionShakeTiming = {
  durationMs: 260,
  easing: "ease-out",
};

/** 先端が進もうとした向きへ小さく突き当たって戻る揺れの、動く距離（マス幅に対する割合）。 */
const HEAD_BUMP_DISTANCE = 0.14;
/** 向きの無い（先端から離れたマスを押した）ときの、左右の揺れの幅（マス幅に対する割合）。 */
const HEAD_SHAKE_DISTANCE = 0.08;

/** 阻んだ仕切りの強調。点いてから消えるまで。動きを減らす設定でも、動かない光として返す。 */
const PARTITION_HALO_DURATION_MS = 520;
const partitionHaloKeyframes: Keyframe[] = [
  { opacity: 0 },
  { opacity: 0.85, offset: 0.2 },
  { opacity: 0 },
];

const directionVectors = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<HamiltonianPathDirection, { x: number; y: number }>;

/** SVG の中の要素の CSS の長さは、図の座標（マス幅 1）で読まれる。 */
function translate(x: number, y: number): Keyframe {
  return { transform: `translate(${x}px, ${y}px)` };
}

function createHeadShakeKeyframes(
  direction: HamiltonianPathDirection | null,
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

/** 先端と、進もうとした向きの間にある仕切り。仕切りに阻まれたのでなければ `null`。 */
function findBlockingPartitionKey(
  size: number,
  { reason, head, direction }: HamiltonianPathBlockedMove,
): string | null {
  if (reason !== "partition" || direction === null) {
    return null;
  }
  const neighbor = getHamiltonianPathNeighborCell(size, head, direction);
  return neighbor === null
    ? null
    : getPartitionKey(createHamiltonianPathPartition(head, neighbor));
}

/**
 * 道を延ばせなかったことを盤面で返す。先端を進もうとした向きへ小さく揺らし、仕切りに阻まれたときはその仕切りを短く光らせる。
 * 先端の揺れは動きを減らす設定では出さず（`playRejectionShake`）、仕切りの光だけを返す。
 */
export function animateBlockedMove(
  figure: SVGSVGElement | null,
  size: number,
  blockedMove: HamiltonianPathBlockedMove,
): void {
  playRejectionShake(
    figure?.querySelector(`[${hamiltonianPathFigureParts.head}]`),
    createHeadShakeKeyframes(blockedMove.direction),
    headShakeTiming,
  );
  const partitionKey = findBlockingPartitionKey(size, blockedMove);
  if (partitionKey === null) {
    return;
  }
  figure
    ?.querySelector(
      `[${hamiltonianPathFigureParts.partitionHalo}="${partitionKey}"]`,
    )
    ?.animate?.(partitionHaloKeyframes, {
      duration: PARTITION_HALO_DURATION_MS,
      easing: "ease-out",
    });
}
