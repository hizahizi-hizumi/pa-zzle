import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  getGlassPourPose,
  getPourTiltDirection,
} from "@/games/water-sort/ui/board/pour/PourAnimationLayer/animation-view";
import { getPourSourceKeyframes } from "@/games/water-sort/ui/board/pour/PourAnimationLayer/pour-source-motion";
import {
  addPourAnimation,
  createPourAnimation,
  groupPourAnimationsByDestination,
  interruptPourAnimationsForBottle,
} from "@/games/water-sort/ui/board/pour/pour-animation";

const rect = { left: 0, top: 0, width: 40, height: 120 };

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
    rect,
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

describe("getPourTiltDirection", () => {
  test.each([
    [40, -1],
    [260, 1],
  ])(
    "移動先が画面端に近いときは反対側へ傾けて表示領域を守ること: %i",
    (left, expected) => {
      const direction = getPourTiltDirection({ ...rect, left }, 390);

      expect(direction).toBe(expected);
    },
  );
});

describe("getGlassPourPose", () => {
  const source = { left: 35, top: 228, width: 64, height: 180 };
  const destinations = [
    { left: 205, top: 458, width: 64, height: 180, viewportWidth: 390 },
    { left: 50, top: 318, width: 42, height: 115, viewportWidth: 320 },
  ] as const;

  test.each(destinations)(
    "注ぎ口を移動先の中央へ配置し、容器本体を注ぎ口より上へ持ち上げること: $viewportWidth",
    (destination) => {
      const result = getGlassPourPose(
        source,
        destination,
        destination.viewportWidth,
      );
      const angle = (result.tiltDegrees * Math.PI) / 180;
      const rimCenterX = source.left + source.width / 2 + result.offsetX;
      const lipX =
        rimCenterX + result.direction * (source.width / 2) * Math.cos(angle);
      const lipY =
        source.top +
        result.offsetY +
        (source.width / 2) * Math.sin(Math.abs(angle));
      const oppositeEndY =
        source.top + result.offsetY + source.height * Math.cos(angle);

      expect(lipX).toBeCloseTo(destination.left + destination.width / 2, 5);
      expect(lipY).toBeCloseTo(result.streamTop, 5);
      expect(oppositeEndY).toBeLessThan(lipY);
      expect(result.streamTop).toBeLessThan(destination.top);
    },
  );
});

describe("getPourSourceKeyframes", () => {
  const current = animation(1, 0, 2);

  test("硝子の注水元は注水終了後に目立たず戻り、最後に元の位置へ復帰すること", () => {
    const keyframes = getPourSourceKeyframes(current, "glass", 390);

    const disappearing = keyframes.find((frame) => frame.offset === 0.82);
    const returning = keyframes.at(-1);

    expect(disappearing?.opacity).toBe(0);
    expect(returning).toMatchObject({
      transform: "translate(0, 0) rotate(0deg)",
      opacity: 1,
      offset: 1,
    });
  });

  test("現行の注水元には透明化を適用しないこと", () => {
    const keyframes = getPourSourceKeyframes(current, "classic", 390);

    const includesTransparency = keyframes.some(
      (frame) => frame.opacity !== undefined,
    );

    expect(includesTransparency).toBe(false);
  });
});
