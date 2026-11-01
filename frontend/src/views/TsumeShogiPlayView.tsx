import { useLocation } from "react-router";

import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { readAvoidedProblemId } from "@/game-catalog/play-location-state";
import { PlayableTsumeShogi } from "@/game-catalog/tsume-shogi/PlayableTsumeShogi";
import { tsumeShogiCatalogEntry } from "@/game-catalog/tsume-shogi/tsume-shogi-catalog-entry";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { useParams } from "@/router";

export function TsumeShogiPlayView() {
  const { difficulty: difficultyParam } = useParams(
    tsumeShogiCatalogEntry.playPath,
  );
  const avoidedProblemId = readAvoidedProblemId(useLocation().state);
  const difficulty = parseDifficultyLevel(difficultyParam);
  const problemPoolStatus = useTsumeShogiProblemPool();

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この難易度は選べません"
        backTo={tsumeShogiCatalogEntry.entryPath}
      />
    );
  }
  if (problemPoolStatus === "failed") {
    return (
      <PlayUnavailableNotice
        title="問題を読み込めませんでした"
        description="通信できることを確かめて、もう一度開いてください。"
        backTo={tsumeShogiCatalogEntry.entryPath}
      />
    );
  }
  // 問題集を読み込むまでは何も描かない。読み込みは短く、仮の盤を出すと問題の盤に替わるときにちらつく。
  if (problemPoolStatus === "loading") {
    return null;
  }

  return (
    <PlayableTsumeShogi
      key={difficulty}
      difficulty={difficulty}
      avoidedProblemId={avoidedProblemId}
    />
  );
}
