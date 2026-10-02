import { parkingJamPlayAttemptDefinition } from "@/games/parking-jam/play-attempt";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayAttemptDisplay } from "@/records/ui/play-attempt-display";

export const parkingJamPlayAttemptDisplay = createPlayAttemptDisplay({
  definition: parkingJamPlayAttemptDefinition,
  progress: {
    "elapsed-ms": {
      label: "経過",
      formatValue: formatElapsedTime,
    },
    "failed-move-count": {
      label: "ミス",
      formatValue(value: number) {
        return `${value}回`;
      },
    },
  },
});
