import { useState } from "react";

import { isMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { isNanpurePlayRecord } from "@/games/nanpure/play-record";
import { isWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { readPlayRecords } from "@/records/storage";
import { Link, useParams } from "@/router";
import { PlayableMinesweeper } from "@/views/MinesweeperPlayView/PlayableMinesweeper";
import { PlayableNanpure } from "@/views/NanpurePlayView/PlayableNanpure";
import { PlayableWaterSort } from "@/views/WaterSortPlayView/PlayableWaterSort";

export function RecordedProblemReplayView() {
  const { recordId } = useParams("/records/replay/:recordId");
  const [record] = useState(() =>
    readPlayRecords().find((candidate) => candidate.id === recordId),
  );

  if (!record) {
    return (
      <section className="mx-auto w-full max-w-3xl py-8 text-center">
        <h1 className="text-heading">記録が見つかりません</h1>
        <p className="mt-2 text-supporting text-muted-foreground">
          元の記録が削除されたか、この端末に保存されていません。
        </p>
        <Link
          to="/records"
          className="mt-6 inline-block text-supporting font-medium underline underline-offset-4"
        >
          記録へ戻る
        </Link>
      </section>
    );
  }

  if (isWaterSortPlayRecord(record)) {
    return (
      <PlayableWaterSort
        difficulty={record.payload.difficulty}
        initialProblemIdentity={record.payload.problemIdentity}
      />
    );
  }

  if (isNanpurePlayRecord(record)) {
    return (
      <PlayableNanpure
        difficulty={record.payload.difficulty}
        initialProblemIdentity={record.payload.problemIdentity}
      />
    );
  }

  if (isMinesweeperPlayRecord(record)) {
    return (
      <PlayableMinesweeper
        difficulty={record.payload.difficulty}
        initialProblemIdentity={record.payload.problemIdentity}
      />
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl py-8 text-center">
      <h1 className="text-heading">この記録は再プレイできません</h1>
      <p className="mt-2 text-supporting text-muted-foreground">
        現在のバージョンでは、このゲームの問題復元に対応していません。
      </p>
      <Link
        to="/records"
        className="mt-6 inline-block text-supporting font-medium underline underline-offset-4"
      >
        記録へ戻る
      </Link>
    </section>
  );
}
