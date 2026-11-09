import type { Issue690BoardSnapshot } from "@/games/issue690-board-snapshot";
import { isNanpurePlayRecord } from "@/games/nanpure/play-record";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";
import { isWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { WATER_SORT_BOTTLE_CAPACITY } from "@/games/water-sort/puzzle/state";
import { getWaterColorView } from "@/games/water-sort/ui/board/water-bottle/get-water-color-view";
import type { PlayRecord } from "@/records/play-record";

export function createIssue690RestoredBoardSnapshot(
  record: PlayRecord,
): Issue690BoardSnapshot | undefined {
  if (isNanpurePlayRecord(record)) {
    const restored = restoreNanpureProblem(record.payload.problemIdentity);
    return restored
      ? {
          gameId: "nanpure",
          board: restored.problem.solution,
          clues: restored.problem.clues,
          lastCellIndex: null,
          reconstructed: true,
        }
      : undefined;
  }

  if (isWaterSortPlayRecord(record)) {
    const identity = record.payload.problemIdentity;
    const colorCount = identity.conditions.colorCount;
    if (colorCount > 18 || !Number.isSafeInteger(colorCount)) return undefined;
    return {
      gameId: "water-sort",
      palette: Array.from(
        { length: colorCount },
        (_, color) => getWaterColorView(color).color,
      ),
      bottles: [
        ...Array.from({ length: colorCount }, (_, color) =>
          Array.from({ length: WATER_SORT_BOTTLE_CAPACITY }, () => color),
        ),
        [],
        [],
      ],
      lastMove: null,
      reconstructed: true,
    };
  }

  return undefined;
}
