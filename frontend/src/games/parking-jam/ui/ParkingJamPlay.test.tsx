import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { ParkingJamPlay } from "./ParkingJamPlay";

afterEach(cleanup);

function createProps(): ComponentProps<typeof ParkingJamPlay> {
  return {
    difficulty: "normal",
    status: "playing",
    progress: "playing",
    board: {
      width: 5,
      height: 5,
      vehicles: [
        { id: "a", row: 1, column: 0, orientation: "horizontal", length: 2 },
        { id: "b", row: 0, column: 3, orientation: "vertical", length: 2 },
      ],
      fixedAreas: [],
      roadOpenings: [
        { side: "right", startOffset: 1, length: 1 },
        { side: "up", startOffset: 3, length: 1 },
      ],
    },
    state: { remainingVehicleIds: ["a", "b"] },
    selectedVehicleId: "a",
    operation: null,
    elapsedMs: 65_000,
    failedMoveCount: 2,
    canUndo: true,
    canRestart: true,
    result: null,
    recordOutcomeNotice: null,
    onSelectVehicle: vi.fn(),
    onMove: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    onClearAnimationComplete: vi.fn(),
  };
}

describe("ParkingJamPlay", () => {
  describe("横向きの車を選択している場合", () => {
    let props: ComponentProps<typeof ParkingJamPlay>;

    beforeEach(() => {
      props = createProps();
      render(<ParkingJamPlay {...props} />);
    });

    test("車の近くに左右の出庫操作を提示すること", () => {
      const left = screen.getByRole("button", { name: "左へ出庫" });
      const right = screen.getByRole("button", { name: "右へ出庫" });

      expect(left).toBeTruthy();
      expect(right).toBeTruthy();
      expect(screen.queryByRole("button", { name: "上へ出庫" })).toBeNull();
      expect(screen.queryByRole("button", { name: "下へ出庫" })).toBeNull();
    });

    test("選んだ車と方向をプレイ責務へ通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "右へ出庫" }));

      expect(props.onMove).toHaveBeenCalledWith("a", "right");
    });

    test("待ったとやり直しを別の操作として通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));
      fireEvent.click(screen.getByRole("button", { name: "やり直す" }));

      expect(props.onUndo).toHaveBeenCalledOnce();
      expect(props.onRestart).toHaveBeenCalledOnce();
    });
  });

  describe("車が選択されていない場合", () => {
    beforeEach(() => {
      render(<ParkingJamPlay {...createProps()} selectedVehicleId={null} />);
    });

    test("盤面外に操作説明や方向操作を常設しないこと", () => {
      expect(screen.queryByText("車を選んでください")).toBeNull();
      expect(screen.queryByRole("button", { name: "左へ出庫" })).toBeNull();
    });
  });

  describe("クリア演出中の場合", () => {
    beforeEach(() => {
      render(
        <ParkingJamPlay
          {...createProps()}
          status="cleared"
          progress="clearing"
          state={{ remainingVehicleIds: [] }}
        />,
      );
    });

    test("結果操作を先に表示しないこと", () => {
      expect(screen.queryByRole("button", { name: "同じ問題" })).toBeNull();
    });
  });
});
