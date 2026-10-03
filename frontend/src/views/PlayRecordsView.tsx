import { useState } from "react";

import {
  findRecordProblemPlayDestination,
  gameCatalog,
} from "@/game-catalog/game-catalog";
import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import type { PlayRecord } from "@/records/play-record";
import { readPlayRecords } from "@/records/storage";
import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import { Link, useNavigate } from "@/router";

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());
  const navigate = useNavigate();

  function handleReplay(record: PlayRecord) {
    const destination = findRecordProblemPlayDestination(record);
    if (!destination) {
      return;
    }
    navigate(
      {
        pathname: destination.playPath,
        search: createProblemIdSearch(destination.problemId),
      },
      { params: { difficulty: destination.difficulty } },
    );
  }

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
        games={gameCatalog}
        emptyAction={<Link to="/">パズルを選ぶ</Link>}
        isReplayable={(record) =>
          findRecordProblemPlayDestination(record) !== null
        }
        onReplay={handleReplay}
      />
    </section>
  );
}
