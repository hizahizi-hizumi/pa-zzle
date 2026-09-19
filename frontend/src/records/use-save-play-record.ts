import { useEffect, useRef, useState } from "react";

import type { PlayRecord } from "./play-record";
import type { PlayRecordAdapter, PlayRecordSaveOutcome } from "./presentation";
import { savePlayRecord } from "./save-play-record";

type SavedRecordOutcome = {
  recordId: string;
  outcome: PlayRecordSaveOutcome;
};

export function useSavePlayRecord(
  record: PlayRecord | null,
  adapter: PlayRecordAdapter,
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
      outcome: savePlayRecord(record, adapter),
    });
  }, [adapter, record]);

  return record && saved?.recordId === record.id ? saved.outcome : null;
}
