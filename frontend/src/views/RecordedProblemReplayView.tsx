import { useState } from "react";
import { PlayableMinesweeper } from "@/game-catalog/minesweeper/PlayableMinesweeper";
import { PlayableNanpure } from "@/game-catalog/nanpure/PlayableNanpure";
import { PlayableParkingJam } from "@/game-catalog/parking-jam/PlayableParkingJam";
import { PlayableSlidePuzzle } from "@/game-catalog/slide-puzzle/PlayableSlidePuzzle";
import { PlayableTakuzu } from "@/game-catalog/takuzu/PlayableTakuzu";
import { PlayableWaterSort } from "@/game-catalog/water-sort/PlayableWaterSort";
import { isMinesweeperPlayRecord } from "@/games/minesweeper/play-record";
import { parseNanpureDifficulty } from "@/games/nanpure/difficulty";
import { isNanpurePlayRecord } from "@/games/nanpure/play-record";
import { restoreNanpureProblem } from "@/games/nanpure/problem-selection";
import { parseParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { isParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { parseSlidePuzzleDifficulty } from "@/games/slide-puzzle/difficulty";
import { isSlidePuzzlePlayRecord } from "@/games/slide-puzzle/play-record";
import { restoreSlidePuzzlePooledProblem } from "@/games/slide-puzzle/problem-selection";
import { isTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { restoreTakuzuProblem } from "@/games/takuzu/problem-selection";
import { parseWaterSortDifficulty } from "@/games/water-sort/difficulty";
import { isWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { readPlayRecords } from "@/records/storage";
import { Link, useParams } from "@/router";

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

  const parkingJamDifficulty = isParkingJamPlayRecord(record)
    ? parseParkingJamDifficulty(record.payload.difficulty)
    : undefined;
  if (isParkingJamPlayRecord(record) && parkingJamDifficulty) {
    return (
      <PlayableParkingJam
        difficulty={parkingJamDifficulty}
        initialProblem={{
          identity: record.payload.problemIdentity,
          purpose: "replay",
        }}
      />
    );
  }

  // 3段階の難易度で遊んだ記録の問題は問題集に無く、レベルへ読み替えもしないので再プレイできない。
  const nanpureDifficulty = isNanpurePlayRecord(record)
    ? parseNanpureDifficulty(record.payload.difficulty)
    : undefined;
  const nanpureInitialProblem = isNanpurePlayRecord(record)
    ? restoreNanpureProblem(record.payload.problemIdentity)
    : null;
  if (nanpureDifficulty && nanpureInitialProblem) {
    return (
      <PlayableNanpure
        difficulty={nanpureDifficulty}
        initialProblem={nanpureInitialProblem}
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

  const takuzuInitialProblem = isTakuzuPlayRecord(record)
    ? restoreTakuzuProblem(record.payload.problemIdentity)
    : null;
  if (isTakuzuPlayRecord(record) && takuzuInitialProblem) {
    return (
      <PlayableTakuzu
        difficulty={record.payload.difficulty}
        initialProblem={takuzuInitialProblem}
      />
    );
  }

  // バイナリパズルとナンプレは問題を問題集にしか持たないので、問題集から引けない記録は再プレイできない。
  const unavailableReason =
    isTakuzuPlayRecord(record) || isNanpurePlayRecord(record)
      ? "この記録の問題は、現在の問題集にありません。"
      : "現在のバージョンでは、このゲームの問題復元に対応していません。";

  return (
    <section className="mx-auto w-full max-w-3xl py-8 text-center">
      <h1 className="text-heading">この記録は再プレイできません</h1>
      <p className="mt-2 text-supporting text-muted-foreground">
        {unavailableReason}
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
