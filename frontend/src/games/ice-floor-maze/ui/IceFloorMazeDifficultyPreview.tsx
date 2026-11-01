import {
  type IceFloorMazeDifficulty,
  iceFloorMazeLevelCriteria,
} from "@/games/ice-floor-maze/difficulty";
import type {
  IceFloorMazeBoard,
  IceFloorMazeCell,
  IceFloorMazeChangeableCell,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import {
  getIceFloorMazeBoardViewBox,
  getIceFloorMazeCellCenter,
  type IceFloorMazePoint,
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";

/**
 * 難易度プレビューは、そのレベルで出す最も広い盤面の上の数行を切り出した「帯」を、駒が止め役で止まりながらゴールまで滑る模式図である。実際の問題ではない。
 *
 * - 帯の幅: そのレベルで出す最も広い盤面の形（`iceFloorMazeLevelCriteria` の `largestBoardShape`）。マスの大きさはどのレベルでもそろえる。
 *   帯の下は盤面が続く切り出しとし、下の外壁は描かない。
 * - 道筋: 左上の開始位置から、止まる位置を繋いでゴールへ向かう滑りの列。上のレベルの道筋は下のレベルの道筋の続きになる。
 * - 要素: 氷と岩だけのレベル（1・2）は岩だけで、道筋の長さで違いを表す。要素のあるレベルは、そのレベルの挑戦の型が置く要素を
 *   道筋の上に置く（レベル3 はもろい岩、レベル4 は薄い氷、レベル5 は両方）。もろい岩は滑りを止めて崩れ、薄い氷は通った後に割れる。
 * - 岩は道筋の止まりに効くものだけを置く（問題集の問題も、駒が通るマスに接しない岩を持たない）。
 */
const previewStrip = {
  rowCount: 5,
  start: { x: 0, y: 0 },
  /**
   * 開始位置からの滑りの向きと、その滑りを止める岩。岩を持たない滑りは外壁で止まる。
   * 帯の幅はレベルで変わるので、右へ滑る手は最も広い盤面の最後の手を除いて岩で止め、下へ滑る手は帯の中の岩で止める。
   */
  slides: [
    { direction: "right", stopper: { x: 4, y: 0 } },
    { direction: "down", stopper: { x: 3, y: 4 } },
    { direction: "right", stopper: { x: 7, y: 3 } },
    { direction: "up" },
    { direction: "right", stopper: { x: 9, y: 0 } },
    { direction: "down", stopper: { x: 8, y: 3 } },
    { direction: "right" },
  ],
  /**
   * レベルごとに、`slides` の先頭から何手を道筋にするかと、道筋の上に置く要素。
   * もろい岩は2手目の滑りを止める岩に、薄い氷は3手目の滑りが通るマスに置く。
   */
  levels: {
    "1": { slideCount: 3, elements: [] },
    "2": { slideCount: 5, elements: [] },
    "3": {
      slideCount: 5,
      elements: [{ cell: "brittle-rock", at: { x: 3, y: 4 } }],
    },
    "4": {
      slideCount: 5,
      elements: [{ cell: "thin-ice", at: { x: 4, y: 3 } }],
    },
    "5": {
      slideCount: 6,
      elements: [
        { cell: "brittle-rock", at: { x: 3, y: 4 } },
        { cell: "thin-ice", at: { x: 4, y: 3 } },
      ],
    },
  },
} as const satisfies {
  rowCount: number;
  start: IceFloorMazePoint;
  slides: readonly {
    direction: IceFloorMazeDirection;
    stopper?: IceFloorMazePoint;
  }[];
  levels: Record<
    IceFloorMazeDifficulty,
    {
      slideCount: number;
      elements: readonly {
        cell: IceFloorMazeChangeableCell;
        at: IceFloorMazePoint;
      }[];
    }
  >;
};

/** 図の上と左右で、外壁の外に残す余白（マス単位）。 */
const STRIP_PADDING = 0.08;

type PreviewSlide = {
  direction: IceFloorMazeDirection;
  from: number;
  to: number;
};

type PreviewRoute = {
  board: IceFloorMazeBoard;
  start: number;
  goal: number;
  slides: readonly PreviewSlide[];
};

function createPreviewRoute(difficulty: IceFloorMazeDifficulty): PreviewRoute {
  const { width, height } =
    iceFloorMazeLevelCriteria[difficulty].largestBoardShape;
  const level = previewStrip.levels[difficulty];
  function toCellIndex({ x, y }: IceFloorMazePoint): number {
    return y * width + x;
  }
  const plannedSlides = previewStrip.slides.slice(0, level.slideCount);
  const cells: IceFloorMazeCell[] = Array.from(
    { length: width * height },
    () => "ice",
  );
  for (const slide of plannedSlides) {
    if ("stopper" in slide) {
      cells[toCellIndex(slide.stopper)] = "rock";
    }
  }
  for (const element of level.elements) {
    cells[toCellIndex(element.at)] = element.cell;
  }
  const board = { width, height, cells };
  const start = toCellIndex(previewStrip.start);

  const slides: PreviewSlide[] = [];
  let state = createIceFloorMazeInitialState(board, start);
  for (const { direction } of plannedSlides) {
    const slide = slideIceFloorMazePiece(board, state, direction);
    if (slide.status === "blocked") {
      throw new Error("Ice floor maze preview slides must move the piece");
    }
    slides.push({ direction, from: slide.from, to: slide.to });
    state = applyIceFloorMazeSlide(state, slide);
  }
  return { board, start, goal: state.position, slides };
}

type IceFloorMazeDifficultyPreviewProps = {
  difficulty: IceFloorMazeDifficulty;
};

export function IceFloorMazeDifficultyPreview({
  difficulty,
}: IceFloorMazeDifficultyPreviewProps) {
  const { board, start, goal, slides } = createPreviewRoute(difficulty);
  const boardViewBox = getIceFloorMazeBoardViewBox(board);
  const left = boardViewBox.minX - STRIP_PADDING;
  const top = boardViewBox.minY - STRIP_PADDING;
  const width = boardViewBox.width + STRIP_PADDING * 2;
  const height = previewStrip.rowCount - top;
  const startCenter = getIceFloorMazeCellCenter(board, start);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);

  return (
    <span
      aria-hidden="true"
      // 最も広いレベルの帯がプレビュー枠（128px）に収まるマスの大きさにする。
      className="flex h-14 w-full items-center [--preview-unit:10px] lg:h-28 lg:justify-center lg:[--preview-unit:12px]"
    >
      {/* マスの大きさをどのレベルでもそろえるため、図の幅を帯の列の数に比例させる。 */}
      <svg
        viewBox={`${left} ${top} ${width} ${height}`}
        style={{
          width: `calc(var(--preview-unit) * ${width})`,
          height: `calc(var(--preview-unit) * ${height})`,
        }}
      >
        <IceFloorMazeTerrain board={board} goal={goal} />
        {slides.map(({ direction, from, to }) => (
          <IceFloorMazeTrail
            key={from}
            board={board}
            direction={direction}
            from={from}
            to={to}
          />
        ))}
        <g transform={`translate(${goalCenter.x} ${goalCenter.y})`}>
          <IceFloorMazeGoalMark />
        </g>
        <g transform={`translate(${startCenter.x} ${startCenter.y})`}>
          <IceFloorMazePieceMark />
        </g>
      </svg>
    </span>
  );
}

export const _private = { previewStrip, createPreviewRoute };
