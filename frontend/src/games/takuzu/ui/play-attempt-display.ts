import { takuzuPlayAttemptDefinition } from "@/games/takuzu/play-attempt";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayAttemptDisplay } from "@/records/ui/play-attempt-display";

export const takuzuPlayAttemptDisplay = createPlayAttemptDisplay({
  definition: takuzuPlayAttemptDefinition,
  progress: {
    "elapsed-ms": {
      label: "経過",
      formatValue: formatElapsedTime,
    },
    "correction-count": {
      label: "置き直し",
      formatValue(value: number) {
        return `${value}回`;
      },
    },
  },
});
