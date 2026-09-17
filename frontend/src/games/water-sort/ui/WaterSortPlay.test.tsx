import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WaterSortPlay } from "./WaterSortPlay";

afterEach(cleanup);

const baseProps = {
  difficulty: "normal" as const,
  seed: "test-seed",
  status: "playing" as const,
  state: [[0, 1], []] as const,
  elapsedMs: 5000,
  moveCount: 3,
  undoCount: 1,
  restartCount: 2,
  optimalMoveCount: 9,
  problemDifficulty: { difficulty: "normal" as const, index: 28.2 },
  canUndo: true,
  sourceBottleIndex: null,
  selectableBottleIndexes: new Set([0, 1]),
  result: null,
  selectBottle: vi.fn(),
  undo: vi.fn(),
  restart: vi.fn(),
  newGame: vi.fn(),
  onChangeDifficulty: vi.fn(),
};

describe("WaterSortPlay", () => {
  test("プレイ中の計測値と実盤面を表示すること", () => {
    const selectBottle = vi.fn();
    render(<WaterSortPlay {...baseProps} selectBottle={selectBottle} />);
    const bottle = screen.getByRole("button", { name: "ボトル 1: 赤、青" });

    fireEvent.click(bottle);

    expect(screen.getByText("00:05")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/最短 9手/)).toBeTruthy();
    expect(selectBottle).toHaveBeenCalledWith(0);
  });

  test("選択中の注ぎ元を色以外の表示でも識別できること", () => {
    render(<WaterSortPlay {...baseProps} sourceBottleIndex={0} />);

    expect(screen.getByText("注ぎ元")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "ボトル 1: 赤、青" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("ゲーム核から選択不可とされたボトルの操作を無効にすること", () => {
    render(
      <WaterSortPlay {...baseProps} selectableBottleIndexes={new Set([0])} />,
    );

    const bottle = screen.getByRole("button", { name: "ボトル 2: 空" });

    expect((bottle as HTMLButtonElement).disabled).toBe(true);
  });

  test("元に戻す・やり直す・新しい問題を別操作として通知すること", () => {
    const undo = vi.fn();
    const restart = vi.fn();
    const newGame = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        undo={undo}
        restart={restart}
        newGame={newGame}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    fireEvent.click(screen.getByRole("button", { name: "新しい問題" }));

    expect(undo).toHaveBeenCalledOnce();
    expect(restart).toHaveBeenCalledOnce();
    expect(newGame).toHaveBeenCalledOnce();
  });

  test("元に戻せる手がないとき操作を無効にすること", () => {
    render(<WaterSortPlay {...baseProps} canUndo={false} />);

    const button = screen.getByRole("button", { name: "元に戻す" });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test("クリア後に実績と最短手数との差を表示すること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        elapsedMs={65000}
        result={{
          elapsedMs: 65000,
          moveCount: 12,
          undoCount: 3,
          restartCount: 1,
          optimalMoveCount: 10,
          moveDelta: 2,
          score: 83,
        }}
      />,
    );

    expect(screen.getByText("クリア")).toBeTruthy();
    expect(screen.getByText("01:05")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.getByText("83 / 100")).toBeTruthy();
    expect(screen.getByText("問題難易度")).toBeTruthy();
  });

  test("最短手数でクリアした成績は差をゼロとして表示すること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        result={{
          elapsedMs: 5000,
          moveCount: 9,
          undoCount: 0,
          restartCount: 0,
          optimalMoveCount: 9,
          moveDelta: 0,
          score: 100,
        }}
      />,
    );

    expect(screen.getByText("±0")).toBeTruthy();
  });

  test("クリア後に同じ問題への再挑戦・新しい問題・難易度変更を通知すること", () => {
    const restart = vi.fn();
    const newGame = vi.fn();
    const onChangeDifficulty = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        result={{
          elapsedMs: 65000,
          moveCount: 12,
          undoCount: 3,
          restartCount: 1,
          optimalMoveCount: 10,
          moveDelta: 2,
          score: 83,
        }}
        restart={restart}
        newGame={newGame}
        onChangeDifficulty={onChangeDifficulty}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "同じ問題をもう一度" }));
    fireEvent.click(screen.getByRole("button", { name: "新しい問題" }));
    fireEvent.click(screen.getByRole("button", { name: "難易度を変える" }));

    expect(restart).toHaveBeenCalledOnce();
    expect(newGame).toHaveBeenCalledOnce();
    expect(onChangeDifficulty).toHaveBeenCalledOnce();
  });
});
