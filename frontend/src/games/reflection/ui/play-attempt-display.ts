import { reflectionPlayAttemptDefinition } from "@/games/reflection/play-attempt";
import { formatElapsedTime } from "@/lib/format-elapsed-time";
import { createPlayAttemptDisplay } from "@/records/ui/play-attempt-display";

export const reflectionPlayAttemptDisplay = createPlayAttemptDisplay({
  definition: reflectionPlayAttemptDefinition,
  progress: {
    "elapsed-ms": {
      label: "経過",
      formatValue: formatElapsedTime,
    },
  },
});
