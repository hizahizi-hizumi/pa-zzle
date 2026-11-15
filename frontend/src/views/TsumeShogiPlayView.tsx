import { findGameProblemDifficulty } from "@/app/game-integration/game-catalog-entry";
import { PlayableTsumeShogi } from "@/app/game-integration/tsume-shogi/PlayableTsumeShogi";
import { tsumeShogiCatalogEntry } from "@/app/game-integration/tsume-shogi/tsume-shogi-catalog-entry";
import { PlayUnavailableNotice } from "@/components/PlayUnavailableNotice";
import { useTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { useParams } from "@/router";

export function TsumeShogiPlayView() {
  const { problemId } = useParams(tsumeShogiCatalogEntry.playPath);
  const difficulty = findGameProblemDifficulty(
    tsumeShogiCatalogEntry,
    problemId,
  );
  const problemPoolStatus = useTsumeShogiProblemPool();

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

  if (!difficulty) {
    return (
      <PlayUnavailableNotice
        title="この問題は現在遊べません"
        backTo={tsumeShogiCatalogEntry.homePath}
      />
    );
  }
  return (
    <PlayableTsumeShogi
      key={problemId}
      difficulty={difficulty}
      problemId={problemId}
    />
  );
}
