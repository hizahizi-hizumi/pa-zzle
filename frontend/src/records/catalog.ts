import { nanpurePlayRecordDefinition } from "@/games/nanpure/play-record";
import { waterSortPlayRecordDefinition } from "@/games/water-sort/play-record";

import type { PlayRecord } from "./play-record";
import type { PlayRecordDefinition } from "./play-record-definition";

export const playRecordDefinitions = [
  waterSortPlayRecordDefinition,
  nanpurePlayRecordDefinition,
] as const satisfies readonly PlayRecordDefinition[];

export function getPlayRecordDefinition(
  record: PlayRecord,
): PlayRecordDefinition | undefined {
  return playRecordDefinitions.find((definition) =>
    definition.isRecord(record),
  );
}
