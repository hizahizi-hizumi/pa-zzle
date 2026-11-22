import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { getDestinationFill } from "@/games/water-sort/ui/board/pour/destination-fill";
import {
  createPourAnimation,
  type PourAnimation,
} from "@/games/water-sort/ui/board/pour/pour-animation";

const rect = { left: 100, top: 300, width: 40, height: 111 };
const placement = {
  sourceRect: rect,
  sourceLiftY: 0,
  destinationRect: { ...rect, left: 160 },
  bounds: { top: 0, left: 0, right: 390 },
};

function pour(
  id: number,
  sourceBottleIndex: number,
  stateBefore: readonly (readonly number[])[],
  stateAfter: readonly (readonly number[])[],
): PourAnimation {
  const operation: Extract<WaterSortOperation, { type: "poured" }> = {
    id,
    type: "poured",
    sourceBottleIndex,
    destinationBottleIndex: 2,
    stateBefore,
    stateAfter,
    isClearingMove: false,
  };
  const animation = createPourAnimation(operation, placement, []);
  if (!animation) {
    throw new Error("注ぐ動きを作れませんでした");
  }
  return animation;
}

describe("getDestinationFill", () => {
  // 赤（0）が1段ある注ぎ先へ、2本の試験管から赤を1段ずつ続けて注ぐ。
  const first = pour(1, 0, [[3, 0], [0], [0], []], [[3], [0], [0, 0], []]);
  const second = pour(2, 1, [[3], [0], [0, 0], []], [[3], [], [0, 0, 0], []]);
  const animations = [first, second];

  describe("先の注ぎが届ききる前に後の注ぎを始めた場合", () => {
    const elapsed = new Map([
      [first.id, first.timing.landStartMs + 150],
      [second.id, 0],
    ]);

    test("先の注ぎの液を、届いた分だけ描くこと", () => {
      const fill = getDestinationFill(
        animations,
        (animationId) => elapsed.get(animationId) ?? 0,
      );

      expect(fill?.surfaceSlots).toBeGreaterThan(1);
      expect(fill?.surfaceSlots).toBeLessThan(2);
    });
  });

  describe("後の注ぎも届き始めた場合", () => {
    const elapsed = new Map([
      [first.id, first.timing.landEndMs],
      [second.id, second.timing.landStartMs + 100],
    ]);

    test("後の注ぎの液を、先の注ぎの液の上に積むこと", () => {
      const fill = getDestinationFill(
        animations,
        (animationId) => elapsed.get(animationId) ?? 0,
      );

      expect(fill?.surfaceSlots).toBeGreaterThan(2);
      expect(fill?.surfaceSlots).toBeLessThan(3);
    });

    test("同じ試薬の液を、注ぎ先にあった液とひとつの層にすること", () => {
      const fill = getDestinationFill(
        animations,
        (animationId) => elapsed.get(animationId) ?? 0,
      );

      expect(fill?.incoming).toMatchObject({ colorIndex: 0, fromSlot: 0 });
    });
  });

  describe("流れが届く前の場合", () => {
    test("注ぎ先の液を増やさないこと", () => {
      const fill = getDestinationFill(animations, () => 0);

      expect(fill).toEqual({ baseSlots: 1, incoming: null, surfaceSlots: 1 });
    });
  });
});
