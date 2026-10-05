import { difficultyLevels } from "@/games/difficulty";
import { _private } from "@/games/nanpure/ui/NanpureDifficultyPreview";

const { previewLayouts, PREVIEW_COLUMNS } = _private;

function getClueCellIndices(layout: readonly string[]): number[] {
  return Array.from(layout.join("")).flatMap((mark, cellIndex) =>
    mark === "#" ? [cellIndex] : [],
  );
}

describe("NanpureDifficultyPreview", () => {
  test("どのレベルの図も切り出した盤面の大きさにそろうこと", () => {
    for (const { id } of difficultyLevels) {
      for (const row of previewLayouts[id]) {
        expect(row).toHaveLength(PREVIEW_COLUMNS);
      }
    }
  });

  test("レベルが上がるほど、下のレベルのヒントを減らした図になること", () => {
    for (let index = 1; index < difficultyLevels.length; index += 1) {
      const lower = getClueCellIndices(
        previewLayouts[difficultyLevels[index - 1]!.id],
      );
      const higher = getClueCellIndices(
        previewLayouts[difficultyLevels[index]!.id],
      );

      expect(higher.length).toBeLessThan(lower.length);
      expect(higher.every((cellIndex) => lower.includes(cellIndex))).toBe(true);
    }
  });
});
