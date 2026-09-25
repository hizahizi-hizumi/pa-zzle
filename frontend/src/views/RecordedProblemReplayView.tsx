import { useState } from "react";
import { isNanpurePlayRecord } from "@/games/nanpure/play-record";
import { parseSlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { isSlidePuzzlePlayRecord } from "@/games/slide-puzzle/play-record";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";
import { parseWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { isWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { readPlayRecords } from "@/records/storage";
import { Link, useParams } from "@/router";
import { PlayableNanpure } from "@/views/NanpurePlayView/PlayableNanpure";
import { PlayableSlidePuzzle } from "@/views/SlidePuzzlePlayView/PlayableSlidePuzzle";
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

  const waterSortDifficulty = isWaterSortPlayRecord(record)
    ? parseWaterSortDifficulty(record.payload.difficulty)
    : undefined;
  if (isWaterSortPlayRecord(record) && waterSortDifficulty) {
    return (
      <PlayableWaterSort
        difficulty={waterSortDifficulty}
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

  const slidePuzzleDifficulty = isSlidePuzzlePlayRecord(record)
    ? parseSlidePuzzleDifficulty(record.payload.difficulty)
    : undefined;
  // 評価の基準になる最短手数は問題集にしか無いので、問題集に無い問題は再プレイできない。
  const slidePuzzleInitialProblem = isSlidePuzzlePlayRecord(record)
    ? restoreSlidePuzzlePooledProblem(record.payload.problemIdentity)
    : null;
  if (slidePuzzleDifficulty && slidePuzzleInitialProblem) {
    return (
      <PlayableSlidePuzzle
        difficulty={slidePuzzleDifficulty}
        initialProblem={slidePuzzleInitialProblem}
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
