import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";

import type { PlayRecordDisplayDefinition } from "./play-record-display";

export const playRecordDisplays = [
  waterSortPlayRecordDisplay,
  nanpurePlayRecordDisplay,
] as const satisfies readonly PlayRecordDisplayDefinition[];
