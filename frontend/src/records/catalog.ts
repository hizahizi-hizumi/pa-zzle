import { nanpurePlayRecordAdapter } from "@/games/nanpure/play-record";
import { waterSortPlayRecordAdapter } from "@/games/water-sort/play-record";

import type { PlayRecord } from "./play-record";
import type { PlayRecordAdapter } from "./presentation";

export const playRecordAdapters = [
  waterSortPlayRecordAdapter,
  nanpurePlayRecordAdapter,
] as const satisfies readonly PlayRecordAdapter[];

export function getPlayRecordAdapter(
  record: PlayRecord,
): PlayRecordAdapter | undefined {
  return playRecordAdapters.find((adapter) => adapter.isRecord(record));
}
