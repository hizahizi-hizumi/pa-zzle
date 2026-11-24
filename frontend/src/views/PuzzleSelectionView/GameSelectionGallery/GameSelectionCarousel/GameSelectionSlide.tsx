import { type CSSProperties, memo } from "react";
import { Link } from "react-router";

import { playPlayStartSound } from "@/components/app-decision-sound";
import { GamePictogram } from "@/components/GamePictogram";
import { Badge } from "@/components/ui/badge";
import { type DifficultyLevel, getDifficultyLabel } from "@/games/difficulty";
import type { Path } from "@/router";
import {
  type FramedSheetPictures,
  findFramedSheetOffsetPx,
} from "@/views/PuzzleSelectionView/GameSelectionGallery/GameSelectionCarousel/framed-sheet-pictures";
import {
  FramedSheetCanvas,
  finishFramedSheetPaints,
} from "@/views/PuzzleSelectionView/GameSelectionGallery/GameSelectionCarousel/GameSelectionSlide/FramedSheetCanvas";
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
  /** 送り終えて額が止まっているか。止まっている額だけが、台紙の全体を描き、額の中で縦に送れる。 */
  resting: boolean;
  isCovered: boolean;
  colorsIn: boolean;
  continuation: { difficulty: DifficultyLevel; attemptedCount: number } | null;
  continuationId: string;
  sheetPreview?: GameSelectionSheetPreview;
  /** 額に初めに見せる所の絵。描き終えるまでは `undefined`。 */
  sheetPictures?: FramedSheetPictures;
  onChoose: (physicalIndex: number) => void;
  /** 選んでいるゲームの額を押して、ゲームのホームを開くとき。 */
  onOpen: () => void;
};

/** 止まった額の中の台紙を、初めに見せる所まで送る。絵が替わったときと止まり直したときだけ送り直し、利用者が送った位置は保つ。 */
function scrollPaperToFirstRow(
  paper: HTMLElement | null,
  preview: GameSelectionSheetPreview | undefined,
): void {
  if (paper === null) return;
  if (preview === undefined) {
    delete paper.dataset.sheetKey;
    return;
  }
  const key = `${preview.columnCount}:${preview.rowCount}:${preview.firstRow}`;
  if (paper.dataset.sheetKey === key) return;
  paper.dataset.sheetKey = key;
  const { width, height } = paper.getBoundingClientRect();
  paper.scrollTop = findFramedSheetOffsetPx(preview, width, height);
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
  resting,
  isCovered,
  colorsIn,
  continuation,
  continuationId,
  sheetPreview,
  sheetPictures,
  onChoose,
  onOpen,
}: GameSelectionSlideProps) {
  const wholeSheet = resting ? sheetPreview : undefined;
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
          onOpen();
          finishFramedSheetPaints();
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
          data-resting={wholeSheet !== undefined}
          ref={(paper) => scrollPaperToFirstRow(paper, wholeSheet)}
          style={
            sheetPreview &&
            ({
              "--sheet-columns": sheetPreview.columnCount,
              "--sheet-rows": sheetPreview.rowCount,
            } as CSSProperties)
          }
        >
          <span
            className="game-selection__sheet"
            data-pending={
              sheetPreview !== undefined && !wholeSheet && !sheetPictures
            }
            data-screen-shared={active && wholeSheet ? "surface" : undefined}
            data-sheet-columns={wholeSheet?.columnCount}
            data-sheet-last-openable-row={wholeSheet?.lastOpenableRow}
            data-sheet-game-id={wholeSheet?.gameId}
            data-sheet-difficulty={wholeSheet?.difficulty}
            data-sheet-problem-count={wholeSheet?.problemCount}
          >
            {wholeSheet ? (
              <FramedSheetCanvas preview={wholeSheet} layer="sheet" />
            ) : (
              sheetPictures && (
                <img
                  className="game-selection__view"
                  src={sheetPictures.sheetUrl}
                  alt=""
                  decoding="sync"
                  draggable={false}
                />
              )
            )}
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
              {!wholeSheet && sheetPictures && (
                <img
                  className="game-selection__view game-selection__view--grooves"
                  src={sheetPictures.groovesUrl}
                  alt=""
                  decoding="sync"
                  draggable={false}
                />
              )}
            </span>
            {wholeSheet && (
              <span
                className="game-selection__grooves"
                data-screen-shared={active ? "grooves" : undefined}
              >
                <FramedSheetCanvas preview={wholeSheet} layer="grooves" />
              </span>
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
