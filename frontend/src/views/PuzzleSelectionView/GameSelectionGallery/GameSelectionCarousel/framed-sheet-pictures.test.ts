import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ZukanSheetPicture } from "@/features/zukan/ui/zukan-sheet-preview";
import {
  _private,
  findFramedSheetOffsetPx,
} from "@/views/PuzzleSelectionView/GameSelectionGallery/GameSelectionCarousel/framed-sheet-pictures";
import type { GameSelectionSheetPreview } from "@/views/PuzzleSelectionView/GameSelectionGallery/game-selection-sheet-preview";

const { requestPictures, getCachedPictures } = _private;

type PendingDraw = {
  appearanceKey: string;
  picture: ZukanSheetPicture;
  finish: () => void;
};

const pendingDraws: PendingDraw[] = [];

vi.mock("@/features/zukan/ui/zukan-sheet-preview", () => ({
  rasterizeZukanSheet: (preview: { appearanceKey: string }) =>
    new Promise<ZukanSheetPicture>((resolve) => {
      const picture = {
        url: `blob:${preview.appearanceKey}`,
        release: vi.fn(),
      };
      pendingDraws.push({
        appearanceKey: preview.appearanceKey,
        picture,
        finish: () => resolve(picture),
      });
    }),
}));

/** 描き始めた絵のうち、`appearanceKey` の姿のものを描き終えさせ、描き終えた後の処理を待つ。 */
async function finishDraws(appearanceKey: string): Promise<void> {
  for (const draw of pendingDraws) {
    if (draw.appearanceKey === appearanceKey) draw.finish();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("findFramedSheetOffsetPx", () => {
  const width = 280;
  const height = 280;
  const cases = [
    ["初めに見せる行の上端まで送ること", 20, 3, 60],
    ["台紙の下端より先へは送らないこと", 20, 15, 280 * (20 / 14) - 280],
    ["額より低い台紙は送らないこと", 10, 3, 0],
  ] as const;

  test.each(cases)("%s", (_, rowCount, firstRow, expected) => {
    const offset = findFramedSheetOffsetPx(
      { columnCount: 14, rowCount, firstRow },
      width,
      height,
    );

    expect(offset).toBeCloseTo(expected);
  });
});

describe("requestPictures", () => {
  const size = { width: 280, height: 280, pixelRatio: 1 };
  function previewOf(appearanceKey: string): GameSelectionSheetPreview {
    return {
      gameId: "game",
      difficulty: "1",
      problemCount: 14,
      statuses: [],
      columnCount: 14,
      rowCount: 1,
      firstRow: 0,
      lastOpenableRow: 0,
      appearanceKey,
    };
  }

  describe("持っている絵から別の姿を描き始め、描き終える前に持っている絵の姿へ戻った場合", () => {
    beforeEach(async () => {
      requestPictures(previewOf("s1"), size);
      await finishDraws("s1");
      requestPictures(previewOf("s2"), size);
    });

    test("後から描き終えた途中の絵を捨て、持っている絵を残すこと", async () => {
      requestPictures(previewOf("s1"), size);
      await finishDraws("s2");
      const kept = getCachedPictures().get("game");
      const abandoned = pendingDraws.filter(
        ({ appearanceKey }) => appearanceKey === "s2",
      );

      expect(kept?.pictures.sheetUrl).toBe("blob:s1");
      for (const { picture } of abandoned) {
        expect(picture.release).toHaveBeenCalledOnce();
      }
    });
  });
});
