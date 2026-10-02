import { waterSortPlayAttemptDefinition } from "@/games/water-sort/play-attempt";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayAttemptDisplay } from "@/records/ui/play-attempt-display";

export const waterSortPlayAttemptDisplay = createPlayAttemptDisplay({
  definition: waterSortPlayAttemptDefinition,
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
