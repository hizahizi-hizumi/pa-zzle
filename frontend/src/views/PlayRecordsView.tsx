import { useState } from "react";

import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { readPlayRecords } from "@/records/storage";
import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import type { PlayRecordDisplayCatalog } from "@/records/ui/play-record-display";
import { Link } from "@/router";

const playRecordDisplays = [
  waterSortPlayRecordDisplay,
  nanpurePlayRecordDisplay,
] as const satisfies PlayRecordDisplayCatalog;

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());

  return (
    <section className="mx-auto w-full max-w-3xl">
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← パズル選択
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">記録</h1>
      <PlayRecordsScreen
        records={records}
        displays={playRecordDisplays}
        emptyAction={<Link to="/">パズルを選ぶ</Link>}
      />
    </section>
  );
}
