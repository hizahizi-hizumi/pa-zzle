import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import { selectHitofudePuzzlePreviewProblem } from "@/games/hitofude-puzzle/problem-selection";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

type HitofudePuzzleDifficultyPreviewProps = {
  difficulty: HitofudePuzzleDifficulty;
};

/**
 * 難易度プレビューは、そのレベルの代表の問題（`selectHitofudePuzzlePreviewProblem`）の盤面を、穴と始点だけで縮めて描く。道は描かない。
 * マスの大きさをどのレベルでもそろえ、レベルが上がると盤面が広がることと、実際に遊ぶ盤面の形（穴の開いた正方形）を見せる。
 * マスの大きさは、最も広い 8×8 の盤面がスマートフォンの見本の枠（高さ 56px）と PC の見本の枠（高さ 112px）に収まる大きさにする。
 */
export function HitofudePuzzleDifficultyPreview({
  difficulty,
}: HitofudePuzzleDifficultyPreviewProps) {
  const board = selectHitofudePuzzlePreviewProblem(difficulty);

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center lg:h-28 lg:justify-center"
    >
      <span
        className="relative size-[calc(7px*var(--preview-cells))] lg:size-[calc(14px*var(--preview-cells))]"
        style={{ ["--preview-cells" as string]: board.size }}
      >
        <HitofudePuzzleFigure
          board={board}
          path={[board.start]}
          isDeadEnd={false}
          solved={false}
        />
      </span>
    </span>
  );
}
