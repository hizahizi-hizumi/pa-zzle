import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { selectWaterSortProblemForDifficulty } from "@/games/water-sort/problem-selection";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import type { PlayRecordDisplayDefinition } from "@/records/ui/play-record-display";

export const ISSUE_690_SAMPLE_RECORD_ID = "issue690-comparison-sample";

/** Never persisted. This record passes through the real game catalog renderer. */
export function createIssue690SampleRecord(gameId: string): PlayRecord | null {
  if (gameId === "water-sort") {
    const problem = selectWaterSortProblemForDifficulty("3", "issue690-sample");
    const moves = problem.optimalMoveCount + 2;
    return createWaterSortPlayRecord({
      difficulty: "3",
      problemIdentity: problem.identity,
      startedAt: 100_000,
      completedAt: 195_000,
      result: {
        elapsedMs: 95_000,
        moveCount: moves,
        completionMoveCount: moves,
        optimalMoveCount: problem.optimalMoveCount,
        undoCount: 0,
        restartCount: 0,
      },
    });
  }
  if (gameId === "nanpure") {
    const problem = selectNanpureProblemForDifficulty("3", "issue690-sample");
    return createNanpurePlayRecord({
      difficulty: "3",
      problemIdentity: problem.identity,
      startedAt: 100_000,
      completedAt: 485_000,
      result: {
        elapsedMs: 385_000,
        mistakeCount: 1,
        undoCount: 2,
        restartCount: 0,
      },
    });
  }
  return null;
}

/** A clearly labeled comparison datum; not a claim that the user's record was updated. */
export function createIssue690SampleOutcome(
  record: PlayRecord,
  display: PlayRecordDisplayDefinition,
): PlayRecordSaveOutcome {
  const metric = display.definition.personalBestMetrics.find(
    (candidate) => candidate.id === "time-delta-ms",
  );
  const actualValue = metric?.getValue(record) ?? 0;
  return {
    status: "updated",
    updates: [
      {
        metricId: "time-delta-ms",
        previousValue: actualValue + 17_000,
        currentValue: actualValue,
      },
    ],
  };
}
