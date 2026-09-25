import { useEffect, useRef, useState } from "react";

import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { savePlayRecord } from "@/records/save-play-record";

type SavedRecordOutcome = {
  recordId: string;
  outcome: PlayRecordSaveOutcome;
};

export function useSavePlayRecord(
  record: PlayRecord | null,
  definition: PlayRecordDefinition,
): PlayRecordSaveOutcome | null {
  const savedRecordId = useRef<string | null>(null);
  const [saved, setSaved] = useState<SavedRecordOutcome | null>(null);

  useEffect(() => {
    if (!record || savedRecordId.current === record.id) {
      return;
    }

    savedRecordId.current = record.id;
    setSaved({
      recordId: record.id,
      outcome: savePlayRecord(record, definition),
    });
  }, [definition, record]);

  return record && saved?.recordId === record.id ? saved.outcome : null;
}
