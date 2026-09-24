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
    onOpenDiagnostics: vi.fn(),
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

  test("車の向きに沿う矢印キーで出庫を試せること", () => {
    const vehicle = screen.getByRole("button", { name: "横向きの車 行2 列1" });

    fireEvent.keyDown(vehicle, { key: "ArrowRight" });

    expect(props.onMove).toHaveBeenCalledWith("a", "right");
  });

  test("共通プレイヘッダーから盤面を戻せること", () => {
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("button", { name: "盤面を戻す" }));

    expect(props.onRestart).toHaveBeenCalledOnce();
  });

  test("内部診断が有効なとき検証情報を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

    expect(props.onOpenDiagnostics).toHaveBeenCalledOnce();
  });
});

describe("横向きの車を選択している場合", () => {
  let props: ComponentProps<typeof ParkingJamPlay>;

  beforeEach(() => {
    props = { ...createProps(), selectedVehicleId: "a" };
    render(<ParkingJamPlay {...props} />);
  });

  test("車の両端に同格の方向操作を提示すること", () => {
    const left = screen.getByRole("button", { name: "左へ出庫" });
    const right = screen.getByRole("button", { name: "右へ出庫" });

    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    expect(screen.queryByRole("button", { name: "上へ出庫" })).toBeNull();
    expect(screen.queryByRole("button", { name: "下へ出庫" })).toBeNull();
  });

  test("近傍の方向操作から出庫を試せること", () => {
    fireEvent.click(screen.getByRole("button", { name: "右へ出庫" }));

    expect(props.onMove).toHaveBeenCalledWith("a", "right");
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
