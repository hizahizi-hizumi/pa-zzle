import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
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
} from "@/games/ice-floor-maze/ui/board/board-geometry";
import { IceFloorMazeGoalMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazeGoalMark";
import { IceFloorMazePieceMark } from "@/games/ice-floor-maze/ui/board/IceFloorMazePieceMark";
import { IceFloorMazeTerrain } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTerrain";
import { IceFloorMazeTrail } from "@/games/ice-floor-maze/ui/board/IceFloorMazeTrail";

/**
 * 難易度プレビューは、どのレベルも同じ大きさの小さな盤面（8×4）に、開始位置からゴールまでの最短の道筋を描いた模式図である。実際の問題ではない。
 * 盤面の広さと道筋の長さは難易度にしないので、盤面の大きさはレベルで変えず、そのレベルの挑戦（何を読めば解けるか）で違いを見せる。
 * 道筋の手数は要素を使う手の分だけ上のレベルで増えるが、違いとして見せるのは下の挑戦である。
 * 盤面を3行にすると、もろい岩を崩した跡を同じ向きを続けずに通る最短の道筋が作れないので、4行にする。
 *
 * - レベル1（止め石）: ゴールへ近づく滑りを重ね、ゴールの先の岩で止まる。
 * - レベル2（通過の誘いと入り直し・回り込み）: 一度ゴールを通り過ぎ、回り込んで開始位置の側へ戻る向きで、ゴールの先の岩で止まる。
 * - レベル3（もろい岩）: 一度止めてくれたもろい岩が崩れ、その跡を通り抜ける。レベル3 はもろい岩か薄い氷の一方だけを置くが、
 *   図ではもろい岩を見せ、薄い氷はレベル4 で足す。
 * - レベル4（両方）: 滑り出した薄い氷が割れ、その水面で止まる。
 * - レベル5（両方の組み合わせ）: もろい岩と薄い氷を増やし、どれも道筋で使う。
 *
 * 開始位置とゴールはどのレベルも同じにし、レベル2 から上は下のレベルの岩・要素をすべて同じマスに残す。レベル1 の岩はレベル2 に残さない
 * （止め石だけの道筋が残ると、レベル2 の通過と回り込みが最短の道筋にならない）。道筋はどのレベルでも、図の盤面のただ1つの最短の道筋で、
 * 同じ向きへ続けて滑らない（問題集の問題と同じ）。
 *
 * 盤面は1行を1文字列で書く。`.` が氷、`#` が岩、`b` がもろい岩、`c` が薄い氷、`S` が開始位置、`G` がゴール（どちらも氷）。
 * 道筋は滑らせる向きを矢印で並べる。
 */
const previewLevelLayouts = {
  "1": {
    rows: ["S..#....", "...G#...", "..#.....", "........"],
    route: "→↓→",
  },
  "2": {
    rows: ["S..#....", "...G....", "#.......", "..#....."],
    route: "↓→↓←↑",
  },
  "3": {
    rows: ["S..#....", "...G....", "#..b....", "..#....#"],
    route: "↓→↓←↓←↑",
  },
  "4": {
    rows: ["S..#....", "...G...#", "#..b....", "..#...c#"],
    route: "↓→↓↑↓←↓←↑",
  },
  "5": {
    rows: ["S..#....", "...G.c.#", "#..b....", "..#b..c#"],
    route: "↓→↓←→↑←↓←↑",
  },
} as const satisfies Record<
  IceFloorMazeDifficulty,
  { rows: readonly string[]; route: string }
>;

const directionByArrow = {
  "↑": "up",
  "→": "right",
  "↓": "down",
  "←": "left",
} as const satisfies Record<string, IceFloorMazeDirection>;

function isDirectionArrow(
  value: string,
): value is keyof typeof directionByArrow {
  return Object.hasOwn(directionByArrow, value);
}

function parseRoute(route: string): IceFloorMazeDirection[] {
  return Array.from(route, (arrow) => {
    if (!isDirectionArrow(arrow)) {
      throw new RangeError(`Unknown ice floor maze preview arrow: ${arrow}`);
    }
    return directionByArrow[arrow];
  });
}

const START_NOTATION = "S";
const GOAL_NOTATION = "G";

/** 図の上下左右で、外壁の外に残す余白（マス単位）。 */
const FIGURE_PADDING = 0.08;

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
  const { rows, route } = previewLevelLayouts[difficulty];
  const notations = rows.join("");
  const board = parseIceFloorMazeBoard(
    rows.map((row) =>
      row.replace(START_NOTATION, ".").replace(GOAL_NOTATION, "."),
    ),
  );
  const start = notations.indexOf(START_NOTATION);
  const goal = notations.indexOf(GOAL_NOTATION);

  const slides: PreviewSlide[] = [];
  let state = createIceFloorMazeInitialState(board, start);
  for (const direction of parseRoute(route)) {
    const slide = slideIceFloorMazePiece(board, state, direction);
    if (slide.status === "blocked") {
      throw new Error("Ice floor maze preview slides must move the piece");
    }
    slides.push({ direction, from: slide.from, to: slide.to });
    state = applyIceFloorMazeSlide(state, slide);
  }
  if (state.position !== goal) {
    throw new Error("Ice floor maze preview route must stop at the goal");
  }
  return { board, start, goal, slides };
}

type IceFloorMazeDifficultyPreviewProps = {
  difficulty: IceFloorMazeDifficulty;
};

export function IceFloorMazeDifficultyPreview({
  difficulty,
}: IceFloorMazeDifficultyPreviewProps) {
  const { board, start, goal, slides } = createPreviewRoute(difficulty);
  const boardViewBox = getIceFloorMazeBoardViewBox(board);
  const left = boardViewBox.minX - FIGURE_PADDING;
  const top = boardViewBox.minY - FIGURE_PADDING;
  const width = boardViewBox.width + FIGURE_PADDING * 2;
  const height = boardViewBox.height + FIGURE_PADDING * 2;
  const startCenter = getIceFloorMazeCellCenter(board, start);
  const goalCenter = getIceFloorMazeCellCenter(board, goal);

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-full items-center lg:h-28 lg:justify-center"
    >
      <svg
        viewBox={`${left} ${top} ${width} ${height}`}
        className="h-full w-auto max-w-full"
      >
        <IceFloorMazeTerrain board={board} goal={goal} />
        {slides.map(({ direction, from, to }) => (
          <IceFloorMazeTrail
            key={`${from}-${direction}`}
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

export const _private = { previewLevelLayouts, createPreviewRoute };
