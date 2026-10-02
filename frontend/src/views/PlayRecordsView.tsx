import { useState } from "react";

import { gameCatalog } from "@/game-catalog/game-catalog";
import { readPlayAttempts } from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import { Link, useNavigate } from "@/router";

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());
  const [attempts] = useState(() => readPlayAttempts());
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
        attempts={attempts}
        games={gameCatalog}
        emptyAction={<Link to="/">パズルを選ぶ</Link>}
        onReplay={(recordId) =>
          navigate("/records/replay/:recordId", { params: { recordId } })
        }
      />
    </section>
  );
}
