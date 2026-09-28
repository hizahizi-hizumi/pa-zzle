import type {
  ReflectionClue,
  ReflectionEntry,
} from "@/games/reflection/puzzle/laser";
import { getReflectionClueCenter } from "@/games/reflection/ui/board/board-geometry";
import { renderReflectionOutcomeShape } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import { reflectionOutcomeToneClassNames } from "@/games/reflection/ui/reflection-tone";

type ReflectionFigureClueProps = {
  size: number;
  entry: ReflectionEntry;
  clue: ReflectionClue;
};

const NUMBER_FONT_SIZE = 0.6;
const MARK_SIZE = 0.36;
/** 結果の形は 12×12 の座標で描かれている。 */
const MARK_SCALE = MARK_SIZE / 12;

/** 図の外周ヒント。盤面の外周ヒントと同じく、数字の下に結果の形を結果の色で置く。 */
export function ReflectionFigureClue({
  size,
  entry,
  clue,
}: ReflectionFigureClueProps) {
  const center = getReflectionClueCenter(size, entry);

  return (
    <g>
      <text
        x={center.x}
        y={center.y - 0.02}
        textAnchor="middle"
        className="fill-foreground font-semibold"
        fontSize={NUMBER_FONT_SIZE}
      >
        {clue.distance}
      </text>
      <g
        transform={`translate(${center.x - MARK_SIZE / 2} ${center.y + 0.08}) scale(${MARK_SCALE})`}
        className={reflectionOutcomeToneClassNames[clue.outcome]}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {renderReflectionOutcomeShape(clue.outcome)}
      </g>
    </g>
  );
}
