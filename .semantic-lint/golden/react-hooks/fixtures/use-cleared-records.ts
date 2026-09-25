import { useEffect, useState } from "react";

type PlayRecord = {
  id: string;
  cleared: boolean;
};

export function useClearedRecords(records: readonly PlayRecord[]) {
  const [clearedRecords, setClearedRecords] = useState<readonly PlayRecord[]>(
    [],
  );

  useEffect(() => {
    setClearedRecords(records.filter((record) => record.cleared));
  }, [records]);

  return clearedRecords;
}
