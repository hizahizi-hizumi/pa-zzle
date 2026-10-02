import { minesweeperPlayAttemptDefinition } from "@/games/minesweeper/play-attempt";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayAttemptDisplay } from "@/records/ui/play-attempt-display";

export const minesweeperPlayAttemptDisplay = createPlayAttemptDisplay({
  definition: minesweeperPlayAttemptDefinition,
  progress: {
    "elapsed-ms": {
      label: "経過",
      formatValue: formatElapsedTime,
    },
    "mistake-count": {
      label: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
    },
  },
});
