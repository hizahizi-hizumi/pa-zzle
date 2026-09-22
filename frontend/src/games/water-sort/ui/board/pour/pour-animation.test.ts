import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
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
