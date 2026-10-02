import {
  getTsumeShogiDifficultyLabel,
  parseTsumeShogiDifficulty,
} from "@/games/tsume-shogi/difficulty";
import { tsumeShogiPlayRecordDefinition } from "@/games/tsume-shogi/play-record";
import { formatElapsedTimeDelta } from "@/lib/format-performance-delta";
import { createPlayRecordDisplay } from "@/records/ui/play-record-display";

export const tsumeShogiPlayRecordDisplay = createPlayRecordDisplay({
  definition: tsumeShogiPlayRecordDefinition,
  getComparisonLabel(comparisonKey: string) {
    const difficulty = parseTsumeShogiDifficulty(comparisonKey);
    return difficulty ? getTsumeShogiDifficultyLabel(difficulty) : null;
  },
  metrics: {
    "play-score": {
      label: "スコア",
      historyLabel: "スコア",
      formatValue(value: number) {
        return `${value}点`;
      },
      referenceValue: 100,
      axis: { kind: "integer", minimum: 0, maximum: 100 },
    },
    "time-delta-ms": {
      label: "基準時間との差",
      historyLabel: "時間差",
      formatValue: formatElapsedTimeDelta,
      referenceValue: 0,
      axis: { kind: "duration-ms" },
    },
    "wrong-check-count": {
      label: "誤王手",
      historyLabel: "誤王手",
      formatValue(value: number) {
        return `${value}回`;
      },
      referenceValue: 0,
      axis: { kind: "integer", minimum: 0 },
    },
  },
});
