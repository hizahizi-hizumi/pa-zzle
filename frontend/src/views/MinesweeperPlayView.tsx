import { useSearchParams } from "react-router";

import { resolveMinesweeperDiagnosticProblemIdentity } from "@/games/minesweeper/diagnostics";
import { parseMinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { internalDiagnosticsAvailable } from "@/lib/internal-diagnostics";
import { useParams } from "@/router";
import { InvalidDifficulty } from "@/views/MinesweeperPlayView/InvalidDifficulty";
import { PlayableMinesweeper } from "@/views/MinesweeperPlayView/PlayableMinesweeper";

// 内部診断を使える環境でだけ、検証情報の seed から特定の問題を再現して始める。
const diagnosticSeedSearchKey = "seed";

export function MinesweeperPlayView() {
  const { difficulty: difficultyParam } = useParams(
    "/puzzles/minesweeper/play/:difficulty",
  );
  const [searchParams] = useSearchParams();
  const difficulty = parseMinesweeperDifficulty(difficultyParam);

  if (!difficulty) {
    return <InvalidDifficulty />;
  }

  const diagnosticSeed = internalDiagnosticsAvailable
    ? searchParams.get(diagnosticSeedSearchKey)
    : null;
  const initialProblemIdentity = diagnosticSeed
    ? resolveMinesweeperDiagnosticProblemIdentity(difficulty, diagnosticSeed)
    : undefined;

  return (
    <PlayableMinesweeper
      key={`${difficulty}:${diagnosticSeed ?? ""}`}
      difficulty={difficulty}
      initialProblemIdentity={initialProblemIdentity}
    />
  );
}
