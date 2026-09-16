import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WaterSortPlay } from "./WaterSortPlay";

afterEach(cleanup);

const baseProps = {
  difficulty: "normal" as const,
  seed: "test-seed",
  status: "playing" as const,
  state: [[0, 1], []] as const,
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
  onBackToHome: vi.fn(),
};

describe("WaterSortPlay", () => {
  test("プレイ中は盤面を表示して計測値を常設しないこと", () => {
    const selectBottle = vi.fn();

    render(<WaterSortPlay {...baseProps} selectBottle={selectBottle} />);
    const bottle = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    fireEvent.click(bottle);

    expect(screen.queryByText("00:05")).toBeNull();
    expect(screen.queryByText("問題シード: test-seed")).toBeNull();
    expect(screen.queryByText(/最短 9手/)).toBeNull();
    expect(selectBottle).toHaveBeenCalledWith(0);
  });

  test("選択中の注ぎ元だけを選択状態として表すこと", () => {
    render(<WaterSortPlay {...baseProps} sourceBottleIndex={0} />);

    const sourceBottle = screen.getByRole("button", {
      name: "ボトル 1: 赤、青",
    });

    expect(sourceBottle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("注ぎ元")).toBeNull();
  });

  test("合法手を教えるためにボトル操作を無効化しないこと", () => {
    const selectBottle = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        selectableBottleIndexes={new Set([0])}
        selectBottle={selectBottle}
      />,
    );

    const bottle = screen.getByRole("button", { name: "ボトル 2: 空" });
    fireEvent.click(bottle);

    expect((bottle as HTMLButtonElement).disabled).toBe(false);
    expect(selectBottle).toHaveBeenCalledWith(1);
  });

  test("元に戻すをプレイ中の直接操作として通知すること", () => {
    const undo = vi.fn();
    render(<WaterSortPlay {...baseProps} undo={undo} />);

    fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));

    expect(undo).toHaveBeenCalledOnce();
  });

  test("二次操作をメニューから通知すること", () => {
    const restart = vi.fn();
    const newGame = vi.fn();
    const onChangeDifficulty = vi.fn();
    const onBackToHome = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        restart={restart}
        newGame={newGame}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "最初から" }));
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "新しい問題" }));
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "難易度を変える" }));
    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "ホームへ" }));

    expect(restart).toHaveBeenCalledOnce();
    expect(newGame).toHaveBeenCalledOnce();
    expect(onChangeDifficulty).toHaveBeenCalledOnce();
    expect(onBackToHome).toHaveBeenCalledOnce();
  });

  test("元に戻せる手がない操作を無効にすること", () => {
    render(<WaterSortPlay {...baseProps} canUndo={false} />);

    const button = screen.getByRole("button", { name: "元に戻す" });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test("クリア後は主要な成績だけを先に表示すること", () => {
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
      />,
    );

    expect(screen.getByRole("heading", { name: "クリア!" })).toBeTruthy();
    expect(screen.getByText("01:05")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("プレイ詳細")).toBeTruthy();
    expect(screen.getByText("83 / 100")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  test("クリア後に次の問題・再挑戦・難易度変更・ホーム移動を通知すること", () => {
    const restart = vi.fn();
    const newGame = vi.fn();
    const onChangeDifficulty = vi.fn();
    const onBackToHome = vi.fn();
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
        onBackToHome={onBackToHome}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "次の問題" }));
    fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
    fireEvent.click(screen.getByRole("button", { name: "難易度を変える" }));
    fireEvent.click(screen.getByRole("button", { name: "ホームへ" }));

    expect(newGame).toHaveBeenCalledOnce();
    expect(restart).toHaveBeenCalledOnce();
    expect(onChangeDifficulty).toHaveBeenCalledOnce();
    expect(onBackToHome).toHaveBeenCalledOnce();
  });
});
