import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { WaterSortPlay } from "./WaterSortPlay";

afterEach(cleanup);

describe("WaterSortPlay", () => {
  test("プレイ中にクリア操作を通知すること", () => {
    const clear = vi.fn();
    render(
      <WaterSortPlay
        difficulty="normal"
        seed="test-seed"
        status="playing"
        clear={clear}
        retry={vi.fn()}
        onChangeDifficulty={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "クリア確認" });

    fireEvent.click(button);

    expect(clear).toHaveBeenCalledOnce();
  });

  test("クリア後に再挑戦操作を通知すること", () => {
    const retry = vi.fn();
    render(
      <WaterSortPlay
        difficulty="normal"
        seed="test-seed"
        status="cleared"
        clear={vi.fn()}
        retry={retry}
        onChangeDifficulty={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "もう一度" });

    fireEvent.click(button);

    expect(retry).toHaveBeenCalledOnce();
  });

  test("難易度変更操作を通知すること", () => {
    const onChangeDifficulty = vi.fn();
    render(
      <WaterSortPlay
        difficulty="normal"
        seed="test-seed"
        status="playing"
        clear={vi.fn()}
        retry={vi.fn()}
        onChangeDifficulty={onChangeDifficulty}
      />,
    );
    const button = screen.getByRole("button", { name: "難易度を変える" });

    fireEvent.click(button);

    expect(onChangeDifficulty).toHaveBeenCalledOnce();
  });
});
