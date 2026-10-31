import { cleanup, render } from "@testing-library/react";

import { DifficultyLevelPieces } from "@/components/DifficultyLevelPieces";
import type { DifficultyLevel } from "@/games/difficulty";

afterEach(cleanup);

describe("DifficultyLevelPieces", () => {
  test.each<[DifficultyLevel, number]>([
    ["1", 1],
    ["3", 3],
    ["5", 5],
  ])(
    "レベル%sでは、どの原図でも左から%i枚が埋まっていること",
    (level, filledCount) => {
      const { container } = render(<DifficultyLevelPieces level={level} />);

      for (const artwork of container.querySelectorAll("svg")) {
        const cells = [...artwork.querySelectorAll("g[mask] > path")];
        const filled = cells.map((cell) =>
          cell.classList.contains("fill-muted-foreground"),
        );

        expect(filled).toEqual(
          Array.from({ length: 5 }, (_, index) => index < filledCount),
        );
      }
    },
  );

  test("原図ごとに別の継ぎ目のマスクを参照すること", () => {
    const { container } = render(
      <>
        <DifficultyLevelPieces level="2" />
        <DifficultyLevelPieces level="4" />
      </>,
    );

    const maskIds = [...container.querySelectorAll("mask")].map(
      (mask) => mask.id,
    );

    expect(new Set(maskIds).size).toBe(maskIds.length);
  });
});
