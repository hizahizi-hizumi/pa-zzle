import { useLocation } from "react-router";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import {
  readAvoidedProblemId,
  readRandomPlaySerial,
} from "@/game-catalog/play-location-state";
import { PlayableTsumeShogi } from "@/game-catalog/tsume-shogi/PlayableTsumeShogi";
import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
import { useRandomPlayEntry } from "@/game-catalog/use-random-play-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { useParams } from "@/router";

export function TsumeShogiPlayView() {
  const { difficulty: difficultyParam } = useParams(
    tsumeShogiCatalogEntry.playPath,
  );
  const location = useLocation();
  const avoidedProblemId = readAvoidedProblemId(location.state);
  const playSerial = readRandomPlaySerial(location.state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const randomEntry = useRandomPlayEntry(
    tsumeShogiCatalogEntry,
    difficulty,
    avoidedProblemId,
  );
  const problemPoolStatus = useTsumeShogiProblemPool();

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={tsumeShogiCatalogEntry.homePath}
      />
    );
  }
  if (problemPoolStatus === "failed") {
    return (
      <PlayUnavailableNotice
        title="問題を読み込めませんでした"
        description="通信できることを確かめて、もう一度開いてください。"
        backTo={tsumeShogiCatalogEntry.homePath}
      />
    );
  }
  // 問題集を読み込むまでは何も描かない。読み込みは短く、仮の盤を出すと問題の盤に替わるときにちらつく。
  if (problemPoolStatus === "loading") {
    return null;
  }

  if (randomEntry !== "ready") {
    return randomEntry === "unavailable" ? (
      <PlayUnavailableNotice
        title="条件に合う問題がありません"
        description="設定で出題対象を変更してください。"
        backTo={tsumeShogiCatalogEntry.homePath}
      />
    ) : null;
  }

  return (
    <PlayableTsumeShogi
      key={`${difficulty}:${playSerial}`}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
