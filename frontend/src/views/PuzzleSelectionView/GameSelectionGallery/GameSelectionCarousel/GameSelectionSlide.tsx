import { type CSSProperties, memo } from "react";
import { Link } from "react-router";

import { playPlayStartSound } from "@/components/app-decision-sound";
import { GamePictogram } from "@/components/GamePictogram";
import { Badge } from "@/components/ui/badge";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { Path } from "@/router";
import type { GameSelectionSheetPreview } from "@/views/PuzzleSelectionView/GameSelectionGallery/game-selection-sheet-preview";
import { SelectedGamePictogram } from "@/views/PuzzleSelectionView/GameSelectionGallery/SelectedGamePictogram";

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
  sheetPreview?: GameSelectionSheetPreview;
  onChoose: (physicalIndex: number) => void;
};

/** 額の中の台紙を、初めに見せる行まで送る。絵が替わったときだけ送り直し、利用者が送った位置は保つ。 */
function scrollPaperToFirstRow(
  paper: HTMLElement | null,
  preview: GameSelectionSheetPreview | undefined,
): void {
  if (paper === null || preview === undefined) return;
  const key = `${preview.columnCount}:${preview.rowCount}:${preview.firstRow}`;
  if (paper.dataset.sheetKey === key) return;
  paper.dataset.sheetKey = key;
  paper.scrollTop =
    (preview.firstRow * paper.clientWidth) / preview.columnCount;
}

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
  sheetPreview,
  onChoose,
}: GameSelectionSlideProps) {
  return (
    <Link
      to={to}
      className="game-selection__slide"
      data-selected={selected}
      data-screen-content={active ? undefined : ""}
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
      <span
        className="game-selection__figure"
        data-screen-frame={active ? "" : undefined}
        data-screen-shared={active ? "frame" : undefined}
      >
        <span
          className="game-selection__paper"
          ref={(paper) => scrollPaperToFirstRow(paper, sheetPreview)}
          style={
            sheetPreview &&
            ({
              "--sheet-image": `url("${sheetPreview.imageUrl}")`,
              "--sheet-grooves-image": `url("${sheetPreview.groovesImageUrl}")`,
              "--sheet-columns": sheetPreview.columnCount,
              "--sheet-rows": sheetPreview.rowCount,
            } as CSSProperties)
          }
        >
          <span
            className="game-selection__sheet"
            data-screen-shared={active && sheetPreview ? "surface" : undefined}
            data-sheet-columns={sheetPreview?.columnCount}
            data-sheet-last-openable-row={sheetPreview?.lastOpenableRow}
            data-sheet-game-id={sheetPreview?.gameId}
            data-sheet-difficulty={sheetPreview?.difficulty}
            data-sheet-problem-count={sheetPreview?.problemCount}
          >
            <span
              className="game-selection__picture"
              data-screen-shared={active ? "pictogram" : undefined}
            >
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
            {sheetPreview && (
              <span
                className="game-selection__grooves"
                data-screen-shared={active ? "grooves" : undefined}
              />
            )}
          </span>
        </span>
      </span>
      <span className="game-selection__details">
        <span
          className="game-selection__position"
          aria-hidden="true"
          data-screen-content=""
        >
          <span>{String(position).padStart(2, "0")}</span>
          <span>/</span>
          <span>{String(count).padStart(2, "0")}</span>
        </span>
        <span
          className="game-selection__name"
          data-screen-shared={active ? "title" : undefined}
        >
          {name}
        </span>
        <span className="game-selection__meta" data-screen-content="">
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
