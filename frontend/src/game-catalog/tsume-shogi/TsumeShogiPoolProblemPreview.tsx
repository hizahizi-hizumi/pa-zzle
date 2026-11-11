import { useMemo } from "react";
import type { ProblemId } from "@/games/problem-id";

import type { TsumeShogiDifficulty } from "@/games/tsume-shogi/difficulty";
import { useTsumeShogiProblemPool } from "@/games/tsume-shogi/play/use-tsume-shogi-problem-pool";
import { selectTsumeShogiProblemById } from "@/games/tsume-shogi/problem-selection";
import { TsumeShogiProblemPreview } from "@/games/tsume-shogi/ui/TsumeShogiProblemPreview";

type TsumeShogiPoolProblemPreviewProps = {
  difficulty: TsumeShogiDifficulty;
  problemId: ProblemId;
};

/** 問題集の1問の、始めたときの盤面。問題集の本体を読み込むまでは何も描かない。 */
export function TsumeShogiPoolProblemPreview({
  difficulty,
  problemId,
}: TsumeShogiPoolProblemPreviewProps) {
  const problemPoolStatus = useTsumeShogiProblemPool();
  const pooled = useMemo(
    () =>
      problemPoolStatus === "loaded"
        ? selectTsumeShogiProblemById(difficulty, problemId)
        : null,
    [problemPoolStatus, difficulty, problemId],
  );

  return pooled ? <TsumeShogiProblemPreview problem={pooled.problem} /> : null;
}
