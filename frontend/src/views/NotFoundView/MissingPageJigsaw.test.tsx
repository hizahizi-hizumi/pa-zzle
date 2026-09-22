import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MissingPageJigsaw } from "@/views/NotFoundView/MissingPageJigsaw";

afterEach(cleanup);

test("0のピースを押すと404が完成すること", () => {
  render(<MissingPageJigsaw />);

  const piece = screen.getByRole("button", { name: "0のピースをはめる" });

  fireEvent.click(piece);

  expect(
    screen
      .getByRole("button", { name: "0のピースがはまりました" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.getByText("404が完成しました")).toBeTruthy();
});
