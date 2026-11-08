import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ExperienceCompare } from "@/games/minesweeper/ui/MinesweeperPlay/ExperienceCompare";

describe("ExperienceCompare", () => {
  test("現行と立体化を比較できること", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ExperienceCompare value="hybrid" onChange={onChange} />,
    );

    expect(
      screen
        .getByRole("button", { name: "立体化" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "現行" }));
    expect(onChange).toHaveBeenCalledWith("classic");

    rerender(<ExperienceCompare value="classic" onChange={onChange} />);
    expect(
      screen.getByRole("button", { name: "現行" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.queryByRole("button", { name: "平面" })).toBeNull();
  });
});
