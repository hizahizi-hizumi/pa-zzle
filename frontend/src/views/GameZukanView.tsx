import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { findGameCatalogEntry } from "@/game-catalog/game-catalog";
import { openRecordProblemPlay } from "@/game-catalog/game-navigation";
import type { DifficultyLevel } from "@/games/difficulty";
import {
  readPlayAttemptsSnapshot,
  subscribePlayAttempts,
} from "@/records/play-attempt-storage";
import { readPlayRecords } from "@/records/storage";
import { useNavigate, useParams } from "@/router";
import { GameZukanScreen } from "@/zukan/ui/GameZukanScreen";
import { ZukanNotFoundNotice } from "@/zukan/ui/ZukanNotFoundNotice";
import { deriveGameZukan, type ZukanProblem } from "@/zukan/zukan-collection";
import {
  findZukanChanges,
  listUnchangedZukanDifficulties,
  listZukanViewedStatuses,
} from "@/zukan/zukan-last-viewed";
import {
  readZukanLastViewed,
  writeZukanLastViewed,
} from "@/zukan/zukan-last-viewed-storage";

export function GameZukanView() {
  const { game: gameId } = useParams("/puzzles/:game/zukan");
  const [records] = useState(() => readPlayRecords());
  // 開いたときの変化を求めるよう、見たレベルを保存する前に前回の状態を読んでおく。別のゲームの図鑑へ移ったら読み直す。
  const [lastViewed, setLastViewed] = useState(() => ({
    gameId,
    statuses: readZukanLastViewed(gameId),
  }));
  if (lastViewed.gameId !== gameId) {
    setLastViewed({ gameId, statuses: readZukanLastViewed(gameId) });
  }
  // 直前のプレイ画面の離脱は、この画面を描画したあとに保存されるので、保存へ追従する。
  const attempts = useSyncExternalStore(
    subscribePlayAttempts,
    readPlayAttemptsSnapshot,
  );
  const navigate = useNavigate();
  const game = findGameCatalogEntry(gameId);
  const zukan = useMemo(
    () =>
      game
        ? deriveGameZukan(
            {
              id: game.id,
              listPoolProblemIds: game.listPoolProblemIds,
              recordProblemPlayTarget: game.recordProblemPlayTarget,
              attemptProblemPlayTarget: game.attemptProblemPlayTarget,
              playRecordDefinition: game.playRecordDisplay.definition,
            },
            records,
            attempts,
          )
        : null,
    [game, records, attempts],
  );
  const changes = useMemo(
    () => (zukan ? findZukanChanges(zukan, lastViewed.statuses) : null),
    [zukan, lastViewed],
  );

  // 変化の無いレベルは見せるものが無いので、開いたときに今の状態を保存する。変化のあるレベルは、見せ終えるまで前回の状態を残す。
  useEffect(() => {
    if (game && zukan && changes) {
      writeZukanLastViewed(
        game.id,
        listZukanViewedStatuses(
          zukan,
          listUnchangedZukanDifficulties(zukan, changes),
        ),
      );
    }
  }, [game, zukan, changes]);

  const handleLevelChangesShown = useCallback(
    (difficulty: DifficultyLevel) => {
      if (game && zukan) {
        writeZukanLastViewed(
          game.id,
          listZukanViewedStatuses(zukan, [difficulty]),
        );
      }
    },
    [game, zukan],
  );

  const describeProblem = useCallback(
    ({ difficulty, problemId }: ZukanProblem) =>
      game ? game.describePoolProblem(difficulty, problemId) : null,
    [game],
  );

  const findProblemFeatureValues = useCallback(
    ({ difficulty, problemId }: ZukanProblem) =>
      game
        ? game.problemFeatureFilter.findPoolProblemValues(difficulty, problemId)
        : null,
    [game],
  );

  if (!game || !zukan || !changes) {
    return <ZukanNotFoundNotice />;
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <GameZukanScreen
        key={game.id}
        gameTitle={game.name}
        zukan={zukan}
        changes={changes}
        entryPath={game.entryPath}
        onLevelChangesShown={handleLevelChangesShown}
        describeProblem={describeProblem}
        featureAxes={game.problemFeatureFilter.axes}
        findProblemFeatureValues={findProblemFeatureValues}
        onPlayProblem={({ difficulty, problemId }) =>
          openRecordProblemPlay(navigate, {
            playPath: game.playPath,
            difficulty,
            problemId,
          })
        }
      />
    </section>
  );
}
