import { memo } from "react";
import { Link } from "react-router";

import { playPlayStartSound } from "@/components/app-decision-sound";
import { GamePictogram } from "@/components/GamePictogram";
import { SelectedGamePictogram } from "@/components/GameSelectionGallery/SelectedGamePictogram";
import { Badge } from "@/components/ui/badge";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { Path } from "@/router";

type GameSelectionSlideProps = {
  name: string;
  pictogramSvg: string;
  pictogramShowcaseSvg?: string;
  to: Path;
  physicalIndex: number;
  position: number;
  count: number;
  active: boolean;
  selected: boolean;
  isCovered: boolean;
  colorsIn: boolean;
  continuation: { difficulty: DifficultyLevel; attemptedCount: number } | null;
  continuationId: string;
  onChoose: (physicalIndex: number) => void;
};

function GameSelectionSlideContent({
  name,
  pictogramSvg,
  pictogramShowcaseSvg,
  to,
  physicalIndex,
  position,
  count,
  active,
  selected,
  isCovered,
  colorsIn,
  continuation,
  continuationId,
  onChoose,
}: GameSelectionSlideProps) {
  return (
    <Link
      to={to}
      className="game-selection__slide"
      data-selected={selected}
      aria-label={`${name}${active ? "を開く" : "を選択"}`}
      aria-describedby={active && continuation ? continuationId : undefined}
      tabIndex={active ? 0 : -1}
      draggable={false}
      onClick={(event) => {
        // 位置を移した直後は、見えている複製がまだ中央の扱いになっていないことがあるので、選んでいる姿の複製はどれを押しても開く。
        if (selected) {
          playPlayStartSound();
          return;
        }
        event.preventDefault();
        onChoose(physicalIndex);
      }}
    >
      <span className="game-selection__figure">
        {selected ? (
          <SelectedGamePictogram
            pictogramSvg={pictogramSvg}
            pictogramShowcaseSvg={pictogramShowcaseSvg}
            size="hero"
            motion={isCovered ? "rest" : "play"}
            colorsIn={colorsIn}
          />
        ) : (
          <GamePictogram svg={pictogramSvg} />
        )}
      </span>
      <span className="game-selection__details">
        <span className="game-selection__position" aria-hidden="true">
          <span>{String(position).padStart(2, "0")}</span>
          <span>/</span>
          <span>{String(count).padStart(2, "0")}</span>
        </span>
        <span className="game-selection__name">{name}</span>
        <span className="game-selection__meta">
          {continuation && (
            <Badge id={active ? continuationId : undefined} variant="outline">
              {getDifficultyLabel(continuation.difficulty)}
              {continuation.attemptedCount > 0 &&
                ` ・ 挑戦中 ${continuation.attemptedCount}問`}
            </Badge>
          )}
        </span>
      </span>
    </Link>
  );
}

// 周の数だけ複製が並ぶので、選択が移るたびに全部を描き直さないよう、変わったスライドだけを描き直す。
export const GameSelectionSlide = memo(GameSelectionSlideContent);
