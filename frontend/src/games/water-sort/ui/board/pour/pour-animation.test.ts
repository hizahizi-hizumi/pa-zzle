import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  addPourAnimation,
  createPourAnimation,
  getPourAnimationDurationMs,
  getPourPose,
  groupPourAnimationsByDestination,
  interruptPourAnimationsForBottle,
} from "@/games/water-sort/ui/board/pour/pour-animation";

const rect = { left: 0, top: 0, width: 40, height: 120 };
const bounds = { left: 0, right: 390, top: 0 };

function pouredOperation(
  id: number,
  sourceBottleIndex: number,
  destinationBottleIndex: number,
  stateBefore: readonly (readonly number[])[],
  stateAfter: readonly (readonly number[])[],
): Extract<WaterSortOperation, { type: "poured" }> {
  return {
    id,
    type: "poured",
    sourceBottleIndex,
    destinationBottleIndex,
    stateBefore,
    stateAfter,
    isClearingMove: false,
  };
}

function animation(
  id: number,
  sourceBottleIndex: number,
  destinationBottleIndex: number,
) {
  const result = createPourAnimation(
    pouredOperation(
      id,
      sourceBottleIndex,
      destinationBottleIndex,
      Array.from({ length: 4 }, (_, index) =>
        index === sourceBottleIndex ? [0] : [],
      ),
      Array.from({ length: 4 }, (_, index) =>
        index === destinationBottleIndex ? [0] : [],
      ),
    ),
    rect,
    0,
    rect,
    bounds,
  );
  if (!result) {
    throw new Error("注水表示を作成できませんでした");
  }
  return result;
}

describe("addPourAnimation", () => {
  test("同じ注ぎ先への注水を並行して保持すること", () => {
    const first = animation(1, 0, 2);
    const second = animation(2, 1, 2);

    const result = addPourAnimation([first], second);

    expect(result.map(({ id }) => id)).toEqual([1, 2]);
  });

  test.each([
    ["同じ注ぎ元", animation(2, 0, 3)],
    ["既存の注ぎ先を次の注ぎ元にする操作", animation(2, 2, 3)],
    ["既存の注ぎ元を次の注ぎ先にする操作", animation(2, 1, 0)],
  ])("競合する先行注水を終了すること: %s", (_label, next) => {
    const first = animation(1, 0, 2);

    const result = addPourAnimation([first], next);

    expect(result.map(({ id }) => id)).toEqual([2]);
  });
});

describe("interruptPourAnimationsForBottle", () => {
  test("操作対象のボトルが関与する注水だけを終了すること", () => {
    const animations = [
      animation(1, 0, 2),
      animation(2, 1, 3),
      animation(3, 3, 2),
    ];

    const result = interruptPourAnimationsForBottle(animations, 2);

    expect(result.map(({ id }) => id)).toEqual([2]);
  });
});

describe("groupPourAnimationsByDestination", () => {
  test("同じ注ぎ先の注水を成立順のまままとめること", () => {
    const animations = [
      animation(1, 0, 2),
      animation(2, 1, 2),
      animation(3, 2, 3),
    ];

    const result = groupPourAnimationsByDestination(animations);

    expect(result.map((group) => group.map(({ id }) => id))).toEqual([
      [1, 2],
      [3],
    ]);
  });
});

describe("getPourPose", () => {
  const bottleWidth = 70;
  const bottleHeight = 190;
  const boardBounds = { left: 16, right: 374, top: 96 };
  const leftBottle = {
    left: 24,
    top: 300,
    width: bottleWidth,
    height: bottleHeight,
  };
  const rightBottle = {
    left: 296,
    top: 300,
    width: bottleWidth,
    height: bottleHeight,
  };
  const topRightBottle = { ...rightBottle, top: 110 };

  function getReachX(
    destination: typeof rightBottle,
    tiltDeg: number,
  ): { left: number; right: number } {
    const radians = (Math.abs(tiltDeg) * Math.PI) / 180;
    const mouthX = destination.left + destination.width / 2;
    const reach =
      bottleHeight * Math.sin(radians) + (bottleWidth / 2) * Math.cos(radians);
    return tiltDeg > 0
      ? { left: mouthX - reach, right: mouthX + bottleWidth / 2 }
      : { left: mouthX - bottleWidth / 2, right: mouthX + reach };
  }

  const edgeCases = [
    ["右端の注ぎ先へは、胴を左へ伸ばして傾ける", leftBottle, rightBottle],
    ["左端の注ぎ先へは、胴を右へ伸ばして傾ける", rightBottle, leftBottle],
  ] as const;

  test.each(edgeCases)(
    "%sことで、盤面の左右にはみ出さないこと",
    (_, source, destination) => {
      const pose = getPourPose(source, destination, boardBounds);

      const reachX = getReachX(destination, pose.tiltDeg);
      expect(reachX.left).toBeGreaterThanOrEqual(boardBounds.left);
      expect(reachX.right).toBeLessThanOrEqual(boardBounds.right);
    },
  );

  test("注ぎ元の口を注ぎ先の口の真上へ運ぶこと", () => {
    const pose = getPourPose(leftBottle, rightBottle, boardBounds);

    expect(leftBottle.left + bottleWidth / 2 + pose.deltaX).toBe(
      rightBottle.left + bottleWidth / 2,
    );
    expect(pose.mouthY).toBeLessThan(rightBottle.top);
  });

  test("上の段へ注ぐときも、傾けた角が盤面の上の端を越えないこと", () => {
    const pose = getPourPose(leftBottle, topRightBottle, boardBounds);

    const raisedCorner =
      (bottleWidth / 2) * Math.sin((Math.abs(pose.tiltDeg) * Math.PI) / 180);
    expect(pose.mouthY - raisedCorner).toBeGreaterThanOrEqual(boardBounds.top);
  });
});

describe("getPourAnimationDurationMs", () => {
  const unitCounts = [1, 2, 3] as const;

  test("注ぐ量が多いほど長く、満杯近くでも 1200ms に収めること", () => {
    const durations = unitCounts.map(getPourAnimationDurationMs);

    expect(durations).toEqual([...durations].sort((a, b) => a - b));
    expect(new Set(durations).size).toBe(unitCounts.length);
    expect(Math.max(...durations)).toBeLessThanOrEqual(1200);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(800);
  });
});
