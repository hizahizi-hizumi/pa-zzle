import { cleanup, render, screen } from "@testing-library/react";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { WaterSortTransferBottle } from "@/games/water-sort/ui/WaterSortPlay/WaterSortTransferBottle";

const mergedOperation: Extract<WaterSortOperation, { type: "poured" }> = {
  id: 10,
  type: "poured",
  sourceBottleIndex: 0,
  destinationBottleIndex: 1,
  stateBefore: [[0, 1], [1]],
  stateAfter: [[0], [1, 1]],
  isClearingMove: false,
};
const emptyDestinationOperation: Extract<
  WaterSortOperation,
  { type: "poured" }
> = {
  ...mergedOperation,
  id: 11,
  stateBefore: [[0, 1], []],
  stateAfter: [[0], [1]],
};

afterEach(cleanup);

describe("WaterSortTransferBottle", () => {
  test("同じ色を注ぐと液層の接点にだけ合流する反応を出すこと", () => {
    render(
      <WaterSortTransferBottle
        bottle={[1, 1]}
        index={1}
        operation={mergedOperation}
        justFinished={false}
        justSettled={false}
        held={false}
        selected={false}
      />,
    );

    expect(screen.getByTestId("liquid-merge")).toBeTruthy();
    expect(screen.getByTestId("liquid-transfer")).toBeTruthy();
  });

  test("空の容器へ注ぐと液層の合流を表す反応を出さないこと", () => {
    render(
      <WaterSortTransferBottle
        bottle={[1]}
        index={1}
        operation={emptyDestinationOperation}
        justFinished={false}
        justSettled={false}
        held={false}
        selected={false}
      />,
    );

    expect(screen.queryByTestId("liquid-merge")).toBeNull();
    expect(screen.getByTestId("liquid-transfer")).toBeTruthy();
  });
});
