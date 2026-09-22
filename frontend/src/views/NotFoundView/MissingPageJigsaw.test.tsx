import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { MissingPageJigsaw } from "@/views/NotFoundView/MissingPageJigsaw";

afterEach(cleanup);

describe("MissingPageJigsaw", () => {
  describe("classic の場合", () => {
    beforeEach(() => {
      render(<MissingPageJigsaw variant="classic" />);
    });

    test("中央のピースを正しい位置へ戻せること", () => {
      const piece = screen.getByRole("button", {
        name: "0のピースをドラッグして戻す",
      });

      fireEvent.pointerDown(piece, {
        clientX: 160,
        clientY: 240,
        pointerId: 1,
      });
      fireEvent.pointerMove(piece, {
        clientX: 160,
        clientY: 94,
        pointerId: 1,
      });
      fireEvent.pointerUp(piece, {
        clientX: 160,
        clientY: 94,
        pointerId: 1,
      });
      const placedPiece = screen.getByRole("button", {
        name: "0のピースがはまりました",
      });

      expect(placedPiece.getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("board の場合", () => {
    beforeEach(() => {
      render(<MissingPageJigsaw variant="board" />);
    });

    test("0にかかる2つのピースをそれぞれ正しい位置へ戻せること", () => {
      const firstPiece = screen.getByRole("button", {
        name: "1つ目の0のピースをドラッグして戻す",
      });
      const secondPiece = screen.getByRole("button", {
        name: "2つ目の0のピースをドラッグして戻す",
      });

      fireEvent.pointerDown(firstPiece, {
        clientX: 120,
        clientY: 360,
        pointerId: 1,
      });
      fireEvent.pointerMove(firstPiece, {
        clientX: 152,
        clientY: 106,
        pointerId: 1,
      });
      fireEvent.pointerUp(firstPiece, {
        clientX: 152,
        clientY: 106,
        pointerId: 1,
      });
      fireEvent.pointerDown(secondPiece, {
        clientX: 200,
        clientY: 360,
        pointerId: 2,
      });
      fireEvent.pointerMove(secondPiece, {
        clientX: 154,
        clientY: 210,
        pointerId: 2,
      });
      fireEvent.pointerUp(secondPiece, {
        clientX: 154,
        clientY: 210,
        pointerId: 2,
      });
      const placedPieces = [
        screen.getByRole("button", {
          name: "1つ目の0のピースがはまりました",
        }),
        screen.getByRole("button", {
          name: "2つ目の0のピースがはまりました",
        }),
      ];

      expect(placedPieces[0]?.getAttribute("aria-pressed")).toBe("true");
      expect(placedPieces[1]?.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
