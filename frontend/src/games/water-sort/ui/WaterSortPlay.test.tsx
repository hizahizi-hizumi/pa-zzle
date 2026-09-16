import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WaterSortPlay } from "./WaterSortPlay";

afterEach(cleanup);

const baseProps = {
  difficulty: "normal" as const,
  status: "playing" as const,
  state: [[0, 1], []] as const,
  problemDifficulty: { difficulty: "normal" as const, index: 28.2 },
  elapsedMs: 5000,
  moveCount: 7,
  undoCount: 2,
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
  test("プレイ中はゲーム名と主要な計測値をミニマルに表示すること", () => {
    const selectBottle = vi.fn();

    render(<WaterSortPlay {...baseProps} selectBottle={selectBottle} />);
    const bottle = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    fireEvent.click(bottle);

    expect(screen.getByText("パズル pa-zzle")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "カラーウォーターソート" }),
    ).toBeTruthy();
    expect(screen.getByText("手数")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("時間")).toBeTruthy();
    expect(screen.getByText("00:05")).toBeTruthy();
    expect(screen.getByText("待った")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
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
    expect(screen.getByText("スコア")).toBeTruthy();
    expect(screen.getByText("83")).toBeTruthy();
    expect(screen.getByText("ナイスプレイ！")).toBeTruthy();
    expect(screen.getByText("パズル pa-zzle")).toBeTruthy();
    expect(screen.getByText("/ 100")).toBeTruthy();
    expect(screen.getByText("プレイ詳細")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.queryByText(/seed:/)).toBeNull();
  });

  test("100点では最高評価として強く称えること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        result={{
          elapsedMs: 42000,
          moveCount: 10,
          undoCount: 0,
          restartCount: 0,
          optimalMoveCount: 10,
          moveDelta: 0,
          score: 100,
        }}
      />,
    );

    expect(screen.getByText("パーフェクト！")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
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
