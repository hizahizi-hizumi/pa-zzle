import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import {
  type BridgesHowToPlayExample,
  type BridgesHowToPlayHint,
  backwardCycleOperationExample,
  crossingOperationExample,
  crossingRuleExample,
  cycleOperationExample,
  dragOperationExample,
  pairOperationExample,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import { getBridgesHintPlacement } from "@/games/bridges/ui/BridgesHowToPlayDialog/TouchableExample/hint-placement";
import {
  type BoardTarget,
  createBoardView,
  findBoardTarget,
} from "@/games/bridges/ui/board/board-geometry";

/** 本番の盤面で、その手を打つために押す所が指す物。 */
function getExpectedTarget(hint: BridgesHowToPlayHint): BoardTarget | null {
  switch (hint.kind) {
    case "edge":
      return { kind: "edge", edge: hint.edge };
    case "select":
    case "pair":
      return { kind: "island", island: hint.island };
    case "crossing": {
      const [first, second] = [...hint.edges].sort((a, b) => a - b);
      return { kind: "ambiguous", ascendingEdges: [first!, second!] };
    }
    case "drag":
    case "backward":
      return null;
  }
}

function expectedDragStart(hint: BridgesHowToPlayHint): number {
  return hint.kind === "drag" ? hint.island : -1;
}

/** なぞり始める島の側の角。横の線は左右、縦の線は上下で、なぞり始める島に近い側にする。 */
function expectedDragCorner(
  example: BridgesHowToPlayExample,
  hint: BridgesHowToPlayHint,
): string {
  if (hint.kind !== "drag") {
    return "";
  }
  const edge = getBridgesNetwork(example.board).edges[hint.edge]!;
  const startsAtFrom = edge.from === hint.island;
  if (edge.orientation === "horizontal") {
    return startsAtFrom ? "bottom-left" : "bottom-right";
  }
  return startsAtFrom ? "top-right" : "bottom-right";
}

describe("getBridgesHintPlacement", () => {
  const examples = [
    ["交差のルール", crossingRuleExample],
    ["島の間を押す操作", cycleOperationExample],
    ["右クリックの操作", backwardCycleOperationExample],
    ["なぞる操作", dragOperationExample],
    ["島を選んでから押す操作", pairOperationExample],
    ["交差する所を押す操作", crossingOperationExample],
  ] as const satisfies readonly (readonly [string, BridgesHowToPlayExample])[];
  const hints = examples.flatMap(([name, example]) =>
    example.hints.map(
      (hint, index) => [`${name}の${index + 1}手目`, example, hint] as const,
    ),
  );
  const fingertipCases = hints.filter(
    ([, , hint]) => getExpectedTarget(hint) !== null,
  );
  const dragCases = hints.filter(([, , hint]) => hint.kind === "drag");

  test.each(fingertipCases)(
    "%sは、指先を本番の盤面で押すと例が見せる手の所を指す所に置くこと",
    (_, example, hint) => {
      const view = createBoardView(example.board);
      const { pointer, fingertip } = getBridgesHintPlacement(view, hint);
      const target = findBoardTarget(example.board, {
        x: fingertip!.x - view.margin,
        y: fingertip!.y - view.margin,
      });

      expect(pointer).toBe("fingertip-on-center");
      expect(target).toEqual(getExpectedTarget(hint));
    },
  );

  test.each(dragCases)(
    "%sは、なぞり始める島を箱に含め、指をその島の側の角に置くこと",
    (_, example, hint) => {
      const view = createBoardView(example.board);
      const { rect, pointer, corner } = getBridgesHintPlacement(view, hint);
      const { row, column } = example.board.islands[expectedDragStart(hint)]!;
      const center = {
        x: column + 0.5 + view.margin,
        y: row + 0.5 + view.margin,
      };

      expect(center.x).toBeGreaterThan(rect.x);
      expect(center.x).toBeLessThan(rect.x + rect.width);
      expect(center.y).toBeGreaterThan(rect.y);
      expect(center.y).toBeLessThan(rect.y + rect.height);
      expect(pointer).toBe("inside-corner");
      expect(corner).toBe(expectedDragCorner(example, hint));
    },
  );

  test("右クリックの手は、右のボタンを示したマウスで示すこと", () => {
    const view = createBoardView(backwardCycleOperationExample.board);
    const { gesture } = getBridgesHintPlacement(
      view,
      backwardCycleOperationExample.hints[0]!,
    );

    expect(gesture).toBe("secondary-press");
  });
});
