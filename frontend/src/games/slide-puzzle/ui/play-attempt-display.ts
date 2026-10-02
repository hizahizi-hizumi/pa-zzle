import { slidePuzzlePlayAttemptDefinition } from "@/games/slide-puzzle/play-attempt";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayAttemptDisplay } from "@/records/ui/play-attempt-display";

export const slidePuzzlePlayAttemptDisplay = createPlayAttemptDisplay({
  definition: slidePuzzlePlayAttemptDefinition,
  progress: {
    "elapsed-ms": {
      label: "経過",
      formatValue: formatElapsedTime,
    },
    "move-count": {
      label: "手数",
      formatValue(value: number) {
        return `${value}手`;
      },
    },
  },
});
