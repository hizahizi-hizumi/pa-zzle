import { useState } from "react";

import { minesweeperPlayRecordDisplay } from "@/games/minesweeper/ui/play-record-display";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { readPlayRecords } from "@/records/storage";
import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import type { PlayRecordDisplayCatalog } from "@/records/ui/play-record-display";
import { Link, useNavigate } from "@/router";

const playRecordDisplays = [
  waterSortPlayRecordDisplay,
  nanpurePlayRecordDisplay,
  minesweeperPlayRecordDisplay,
  takuzuPlayRecordDisplay,
] as const satisfies PlayRecordDisplayCatalog;

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());
  const navigate = useNavigate();

  return (
    <section className="mx-auto w-full max-w-3xl">
      <Link
        to="/"
        className="text-supporting text-muted-foreground hover:text-foreground"
      >
        ← パズル選択
      </Link>
      <PlayRecordsScreen
        records={records}
        displays={playRecordDisplays}
        emptyAction={<Link to="/">パズルを選ぶ</Link>}
        onReplay={(recordId) =>
          navigate("/records/replay/:recordId", { params: { recordId } })
        }
      />
    </section>
  );
}
