import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { MissingPageJigsaw } from "@/views/NotFoundView/MissingPageJigsaw";

describe("MissingPageJigsaw", () => {
  beforeEach(() => {
    render(<MissingPageJigsaw />);
  });

  afterEach(cleanup);

  test("空いた場所までドラッグするとピースがはまること", () => {
    const piece = screen.getByRole("button", {
      name: "0のピースを空いた場所へドラッグして戻す",
    });

    fireEvent.pointerDown(piece, { clientX: 150, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(piece, { clientX: 150, clientY: 68, pointerId: 1 });
    fireEvent.pointerUp(piece, { clientX: 150, clientY: 68, pointerId: 1 });

    const placedPiece = screen.getByRole("button", {
      name: "0のピースがはまりました",
    });
    expect(placedPiece.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("ぴったり。")).toBeTruthy();
  });

  test("空いた場所から離してドラッグを終えると元の位置へ戻ること", () => {
    const piece = screen.getByRole("button", {
      name: "0のピースを空いた場所へドラッグして戻す",
    });

    fireEvent.pointerDown(piece, { clientX: 150, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(piece, { clientX: 210, clientY: 170, pointerId: 1 });
    fireEvent.pointerUp(piece, { clientX: 210, clientY: 170, pointerId: 1 });

    expect(piece.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("ピースをドラッグして戻す")).toBeTruthy();
  });
});
