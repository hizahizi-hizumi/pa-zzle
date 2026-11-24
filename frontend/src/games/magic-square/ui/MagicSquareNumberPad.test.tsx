import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { MagicSquareValueState } from "@/games/magic-square/puzzle/rules";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";

const valueStates: MagicSquareValueState[] = Array.from(
  { length: 16 },
  (_, index): MagicSquareValueState =>
    index === 3 ? "used" : index === 13 ? "selected" : "available",
);

afterEach(cleanup);

describe("MagicSquareNumberPad", () => {
  let onEnterValue: ReturnType<typeof vi.fn<(value: number) => void>>;

  beforeEach(() => {
    onEnterValue = vi.fn();
    render(
      <MagicSquareNumberPad
        size={4}
        valueStates={valueStates}
        interactionDisabled={false}
        onEnterValue={onEnterValue}
        trailingActions={[
          <button key="undo" type="button">
            待った
          </button>,
          <button key="memo" type="button">
            メモ
          </button>,
        ]}
      />,
    );
  });

  test("1 から 16 までを小さい順に並べ、最後の数の後ろに操作を順に置くこと", () => {
    const pad = screen.getByRole("group", { name: "盤面の下に並んだ数" });

    const labels = within(pad)
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(labels).toEqual([
      ...Array.from({ length: 16 }, (_, index) => String(index + 1)),
      "待った",
      "メモ",
    ]);
  });

  test("使った数を押せなくし、選んだマスの数を押された状態にすること", () => {
    const pad = screen.getByRole("group", { name: "盤面の下に並んだ数" });

    const states = [
      within(pad).getByText("4").closest("button")?.disabled,
      within(pad)
        .getByText("14")
        .closest("button")
        ?.getAttribute("aria-pressed"),
    ];

    expect(states).toEqual([true, "true"]);
  });

  test("数を押すとその数を入れる操作を知らせること", () => {
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "盤面の下に並んだ数" }),
      ).getByText("7"),
    );

    expect(onEnterValue).toHaveBeenCalledWith(7);
  });
});
