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
    selectedVehicleId: null,
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
  let props: ComponentProps<typeof ParkingJamPlay>;

  beforeEach(() => {
    props = createProps();
    render(<ParkingJamPlay {...props} />);
  });

  test("プレイ中に難易度を表示しないこと", () => {
    expect(screen.queryByText("ふつう")).toBeNull();
  });

  test("車をタップすると選択を通知すること", () => {
    const vehicle = screen.getByRole("button", { name: "横向きの車 行2 列1" });

    fireEvent.pointerDown(vehicle, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(vehicle, { pointerId: 1, clientX: 20, clientY: 20 });

    expect(props.onSelectVehicle).toHaveBeenCalledWith("a");
  });

  test("車を進行軸へスワイプすると車と方向を通知すること", () => {
    const vehicle = screen.getByRole("button", { name: "横向きの車 行2 列1" });

    fireEvent.pointerDown(vehicle, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(vehicle, { pointerId: 1, clientX: 70, clientY: 22 });

    expect(props.onMove).toHaveBeenCalledWith("a", "right");
  });

  test("共通プレイヘッダーから盤面を戻せること", () => {
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("button", { name: "盤面を戻す" }));

    expect(props.onRestart).toHaveBeenCalledOnce();
  });
});

describe("クリア演出中の場合", () => {
  test("結果操作を先に表示しないこと", () => {
    render(
      <ParkingJamPlay
        {...createProps()}
        status="cleared"
        progress="clearing"
        state={{ remainingVehicleIds: [] }}
      />,
    );

    expect(screen.queryByRole("button", { name: "同じ問題" })).toBeNull();
  });
});
