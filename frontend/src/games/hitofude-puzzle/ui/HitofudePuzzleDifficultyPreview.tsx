import {
  type HitofudePuzzleDifficulty,
  hitofudePuzzleLevelCombinations,
} from "@/games/hitofude-puzzle/difficulty";
import {
  type HitofudePuzzleBoard,
  listHitofudePuzzleCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

/**
 * 難易度プレビューは、盤面の上の3行を切り出した「帯」に、迷わずに引ける所まで引いた道を描く模式図である。実際の問題ではない。
 *
 * - 帯の幅: そのレベルで遊ぶ盤面サイズの上限（`hitofudePuzzleLevelCombinations`）。マスの大きさはどのレベルでもそろえる。
 * - 道: 左上の始点から列ごとに上下へ折り返して帯を埋めていく1本の道のうち、先頭から `decidedRatios` の割合のマスまでを引き、
 *   そこに先端の輪を置く。残りのマスは、先を読んで道筋を決めないと引けない所として空けておく。
 *   割合は、角・通路・袋小路の強制だけで決まる範囲（局所の推論で止まった時点で決まっていた辺の割合の中央値。
 *   `ハミルトン路難易度.md` §16.11）に合わせる。
 *   - 1: 角・通路・袋小路を見つければ、道が次々に決まる。帯の終わりまで引ける。
 *   - 2: 1か所だけ、少し先まで読んで進む向きを選ぶ。帯の半分を少し越えた所で止まる。
 *   - 3: 何か所かで、数手先の取り残しを読んで道筋を選ぶ。盤面が広がり、帯の半分に届かずに止まる。
 *   - 4: 開けた領域で、先読みを重ねて道筋を決める。帯の5分の2ほどで止まる。
 *   - 5: 広い開けた盤面で、長い先読みを何度も重ねないと道筋が決まらない。帯の3分の1ほどで止まる。
 *   上のレベルは、下のレベルの帯を同じ位置に含み、引いた道は下のレベルの道の先頭の部分になる。
 * - 帯の外の行は穴にして描かない。道の色は、帯の全マスを通り終える所を紫として、プレイ画面と同じく通った順に移す。
 * - 帯の中に穴は置かない。描くのはマス・帯の外形・道・始点・先端だけにする。
 */
const previewStrip = {
  rowCount: 3,
  /** 迷わずに引ける所まで引いたマスの、帯の全マスに対する割合。 */
  decidedRatios: { "1": 1, "2": 0.56, "3": 0.47, "4": 0.4, "5": 0.34 },
} as const satisfies {
  rowCount: number;
  decidedRatios: Record<HitofudePuzzleDifficulty, number>;
};

type PreviewStrip = {
  board: HitofudePuzzleBoard;
  /** 始点から先端までに引いた道。 */
  path: number[];
};

/** 帯を左の列から順に、偶数列は下へ・奇数列は上へ通って埋める道。 */
function listStripSnake(size: number): number[] {
  return Array.from({ length: size }, (_, column) =>
    Array.from({ length: previewStrip.rowCount }, (_, step) => {
      const row = column % 2 === 0 ? step : previewStrip.rowCount - 1 - step;
      return row * size + column;
    }),
  ).flat();
}

function createPreviewStrip(
  difficulty: HitofudePuzzleDifficulty,
): PreviewStrip {
  const size = hitofudePuzzleLevelCombinations[difficulty].boardSize.maximum;
  const stripCellCount = size * previewStrip.rowCount;
  const holes = listHitofudePuzzleCells(size).filter(
    (cell) => cell >= stripCellCount,
  );
  const snake = listStripSnake(size);
  const decidedCellCount = Math.round(
    stripCellCount * previewStrip.decidedRatios[difficulty],
  );
  return {
    board: { size, holes, start: snake[0]! },
    path: snake.slice(0, decidedCellCount),
  };
}

type HitofudePuzzleDifficultyPreviewProps = {
  difficulty: HitofudePuzzleDifficulty;
};

export function HitofudePuzzleDifficultyPreview({
  difficulty,
}: HitofudePuzzleDifficultyPreviewProps) {
  const { board, path } = createPreviewStrip(difficulty);

  return (
    <span
      aria-hidden="true"
      // 最も広いレベルの帯（8列）がプレビュー枠（128px）に収まるマスの大きさにする。
      className="flex h-14 w-full items-center [--preview-unit:15px] lg:h-28 lg:justify-center"
    >
      {/* マスの大きさをどのレベルでもそろえるため、図の幅を帯の列の数に比例させる。 */}
      <span
        className="relative"
        style={{
          width: `calc(var(--preview-unit) * ${board.size})`,
          height: `calc(var(--preview-unit) * ${previewStrip.rowCount})`,
        }}
      >
        <HitofudePuzzleFigure
          board={board}
          path={path}
          isDeadEnd={false}
          solved={false}
          visibleRowCount={previewStrip.rowCount}
        />
      </span>
    </span>
  );
}

export const _private = { previewStrip, createPreviewStrip };
