import { useState } from "react";

import { readPlayRecords } from "@/records/storage";
import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());

  return <PlayRecordsScreen records={records} />;
}
