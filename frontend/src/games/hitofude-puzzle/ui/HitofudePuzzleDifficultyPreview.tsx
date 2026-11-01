import { useEffect, useState } from "react";

import type { HitofudePuzzleDifficulty } from "@/games/hitofude-puzzle/difficulty";
import { selectHitofudePuzzlePreviewProblem } from "@/games/hitofude-puzzle/problem-selection";
import { getHitofudePuzzleCellPosition } from "@/games/hitofude-puzzle/puzzle/board";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { placeHitofudePuzzleThinkingMarks } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview/thinking-marks";
import { hitofudePuzzleToneClassNames } from "@/games/hitofude-puzzle/ui/hitofude-puzzle-tone";

type HitofudePuzzleDifficultyPreviewProps = {
  difficulty: HitofudePuzzleDifficulty;
};

/**
 * 考えどころの印（?）の大きさと縁取りの太さ。マス幅を 1 とした値で、スマートフォンの 7px のマスでも印として読める大きさにする。
 * 印は盤面の外へはみ出さないよう、中心を盤面の縁から `THINKING_MARK_INSET` だけ内側に収める。
 */
const THINKING_MARK_FONT_SIZE = 2.4;
const THINKING_MARK_OUTLINE_WIDTH = 0.45;
const THINKING_MARK_INSET = { x: 0.7, y: 1 };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/** 考えどころの印のマスは解法器で求めるので、レベルごとに一度だけ求めて覚えておく。 */
const thinkingMarkCache = new Map<HitofudePuzzleDifficulty, number[]>();

function useThinkingMarks(difficulty: HitofudePuzzleDifficulty): number[] {
  const [marks, setMarks] = useState(() => thinkingMarkCache.get(difficulty));
  useEffect(() => {
    if (marks !== undefined) {
      return;
    }
    // 解法器はレベルによって 100ms ほどかかるので、盤面を描いてから求め、難易度選択の表示を待たせない。
    const timer = setTimeout(() => {
      const placed = placeHitofudePuzzleThinkingMarks(
        selectHitofudePuzzlePreviewProblem(difficulty),
      );
      thinkingMarkCache.set(difficulty, placed);
      setMarks(placed);
    }, 0);
    return () => clearTimeout(timer);
  }, [difficulty, marks]);
  return marks ?? [];
}

/**
 * 難易度プレビューは、そのレベルの代表の問題（`selectHitofudePuzzlePreviewProblem`）の盤面を穴と始点だけで縮めて描き、
 * 考えどころの数だけ「?」の印を重ねる（`placeHitofudePuzzleThinkingMarks`）。道は描かない。
 * 考えどころは、角・通路・袋小路を見つけるだけでは道が決まらず、先を読んで選ぶ所で、レベルを分ける先読みの重さに当たる。
 * レベル1 は印が無く、上のレベルほど印が増える。盤面の大きさが同じレベル3〜5 も、印の数で見分けられる。
 * マスの大きさは、最も広い 8×8 の盤面がスマートフォンの見本の枠（高さ 56px）と PC の見本の枠（高さ 112px）に収まる大きさにする。
 */
export function HitofudePuzzleDifficultyPreview({
  difficulty,
}: HitofudePuzzleDifficultyPreviewProps) {
  const board = selectHitofudePuzzlePreviewProblem(difficulty);
  const thinkingMarks = useThinkingMarks(difficulty);

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
        <svg
          viewBox={`0 0 ${board.size} ${board.size}`}
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          {thinkingMarks.map((cell) => {
            const { row, column } = getHitofudePuzzleCellPosition(
              board.size,
              cell,
            );
            return (
              <text
                key={cell}
                x={clamp(
                  column + 0.5,
                  THINKING_MARK_INSET.x,
                  board.size - THINKING_MARK_INSET.x,
                )}
                y={clamp(
                  row + 0.5,
                  THINKING_MARK_INSET.y,
                  board.size - THINKING_MARK_INSET.y,
                )}
                fontSize={THINKING_MARK_FONT_SIZE}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="central"
                strokeWidth={THINKING_MARK_OUTLINE_WIDTH}
                paintOrder="stroke"
                className={hitofudePuzzleToneClassNames.thinkingMark}
              >
                ?
              </text>
            );
          })}
        </svg>
      </span>
    </span>
  );
}
