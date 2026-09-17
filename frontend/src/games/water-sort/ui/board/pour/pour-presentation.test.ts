import { describe, expect, test } from "vitest";

import type { WaterSortOperation } from "@/games/water-sort/hooks/use-water-sort-game";
import {
  addPourPresentation,
  createPourPresentation,
  groupPourPresentationsByDestination,
  interruptPourPresentationsForBottle,
} from "./pour-presentation";

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

function presentation(
  id: number,
  sourceBottleIndex: number,
  destinationBottleIndex: number,
) {
  const result = createPourPresentation(
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

describe("addPourPresentation", () => {
  test("同じ注ぎ先への注水を並行して保持すること", () => {
    const first = presentation(1, 0, 2);
    const second = presentation(2, 1, 2);

    const result = addPourPresentation([first], second);

    expect(result.map(({ id }) => id)).toEqual([1, 2]);
  });

  test.each([
    ["同じ注ぎ元", presentation(2, 0, 3)],
    ["既存の注ぎ先を次の注ぎ元にする操作", presentation(2, 2, 3)],
    ["既存の注ぎ元を次の注ぎ先にする操作", presentation(2, 1, 0)],
  ])("競合する先行注水を終了すること: %s", (_label, next) => {
    const first = presentation(1, 0, 2);

    const result = addPourPresentation([first], next);

    expect(result.map(({ id }) => id)).toEqual([2]);
  });
});

describe("interruptPourPresentationsForBottle", () => {
  test("操作対象のボトルが関与する注水だけを終了すること", () => {
    const presentations = [
      presentation(1, 0, 2),
      presentation(2, 1, 3),
      presentation(3, 3, 2),
    ];

    const result = interruptPourPresentationsForBottle(presentations, 2);

    expect(result.map(({ id }) => id)).toEqual([2]);
  });
});

describe("groupPourPresentationsByDestination", () => {
  test("同じ注ぎ先の注水を成立順のまままとめること", () => {
    const presentations = [
      presentation(1, 0, 2),
      presentation(2, 1, 2),
      presentation(3, 2, 3),
    ];

    const result = groupPourPresentationsByDestination(presentations);

    expect(result.map((group) => group.map(({ id }) => id))).toEqual([
      [1, 2],
      [3],
    ]);
  });
});
