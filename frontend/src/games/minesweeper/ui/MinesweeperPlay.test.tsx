import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { MinesweeperVisibleCell } from "../session/session";
import { MinesweeperPlay } from "./MinesweeperPlay";

afterEach(cleanup);

describe("MinesweeperPlay", () => {
  const visibleCells: readonly MinesweeperVisibleCell[] = [
    { state: "hidden" },
    { state: "revealed", adjacentMineCount: 1 },
    { state: "hidden" },
    { state: "hidden" },
  ];
  let onChangeDifficulty: () => void;
  let onBackToHome: () => void;

  beforeEach(() => {
    onChangeDifficulty = vi.fn();
    onBackToHome = vi.fn();
    render(
      <MinesweeperPlay
        rows={2}
        columns={2}
        mineCount={1}
        flagCount={0}
        visibleCells={visibleCells}
        status="playing"
        onRevealCell={vi.fn()}
        onToggleFlag={vi.fn()}
        onChordCell={vi.fn()}
        onReplay={vi.fn()}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />,
    );
  });

  test("左上の戻る操作で難易度選択への移動を通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

    expect(onChangeDifficulty).toHaveBeenCalledOnce();
    expect(onBackToHome).not.toHaveBeenCalled();
  });

  test("メニューの難易度変更で難易度選択への移動を通知すること", () => {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

    expect(onChangeDifficulty).toHaveBeenCalledOnce();
    expect(onBackToHome).not.toHaveBeenCalled();
  });
});
