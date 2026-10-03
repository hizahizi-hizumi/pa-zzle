import { useState, useSyncExternalStore } from "react";

import { HomeBackLink } from "@/components/HomeBackLink";
import {
  findAttemptProblemPlayDestination,
  findRecordProblemPlayDestination,
  gameCatalog,
  type RecordProblemPlayDestination,
} from "@/game-catalog/game-catalog";
import { createProblemIdSearch } from "@/game-catalog/problem-id-query";
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { PlayRecordsScreen } from "@/records/ui/PlayRecordsScreen";
import { Link, useNavigate } from "@/router";

export function PlayRecordsView() {
  const [records] = useState(() => readPlayRecords());
  // 直前のプレイ画面の離脱は、この画面を描画したあとに保存されるので、保存へ追従する。
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const navigate = useNavigate();

  function openProblemPlay(destination: RecordProblemPlayDestination | null) {
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
      <HomeBackLink />
      <PlayRecordsScreen
        records={records}
        attempts={attempts}
        games={gameCatalog}
        emptyAction={<Link to="/">パズルを選ぶ</Link>}
        isReplayable={(record) =>
          findRecordProblemPlayDestination(record) !== null
        }
        onReplay={(record) =>
          openProblemPlay(findRecordProblemPlayDestination(record))
        }
        isAttemptReplayable={(attempt) =>
          findAttemptProblemPlayDestination(attempt) !== null
        }
        onReplayAttempt={(attempt) =>
          openProblemPlay(findAttemptProblemPlayDestination(attempt))
        }
      />
    </section>
  );
}
