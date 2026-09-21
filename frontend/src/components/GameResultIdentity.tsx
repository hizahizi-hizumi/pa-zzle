import { GamePictogram } from "@/components/GamePictogram";
import { GameResultMark } from "@/components/GameResultMark";
import type { GameResultLevel } from "@/games/result";

type GameResultIdentityProps = {
  gameName: string;
  difficultyLabel: string;
  pictogramSvg: string;
  level: GameResultLevel;
};

export function GameResultIdentity({
  gameName,
  difficultyLabel,
  pictogramSvg,
  level,
}: GameResultIdentityProps) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 px-1 py-1">
      <GameResultMark level={level}>
        <span className="block size-12">
          <GamePictogram svg={pictogramSvg} variant="result" />
        </span>
      </GameResultMark>
      <div className="min-w-0">
        <h1 className="sr-only">プレイ結果</h1>
        <p className="truncate text-heading">{gameName}</p>
        <p className="mt-1 text-supporting text-muted-foreground">
          難易度
          <span className="ml-2 font-medium text-foreground/75">
            {difficultyLabel}
          </span>
        </p>
      </div>
    </div>
  );
}
