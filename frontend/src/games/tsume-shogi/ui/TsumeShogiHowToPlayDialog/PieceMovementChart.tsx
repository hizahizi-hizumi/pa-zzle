import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import { tsumeShogiPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import {
  PieceMovementFigure,
  pieceMovementFigureTypes,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PieceMovementFigure";

/**
 * 駒ごとの動ける向きの表。駒を1つずつ、その駒の動ける升の印を付けた小さな盤の図で並べ、下に印の凡例を添える。
 * 盤の升の大きさではなく、10種の駒の動きを見比べられ、駒の字が読める大きさの図にし、面の幅に合わせて折り返して並べる。
 */
export function PieceMovementChart() {
  return (
    <HowToPlayExample
      figure={
        <ul className="flex flex-wrap justify-center gap-4">
          {pieceMovementFigureTypes.map((type) => (
            <li key={type} aria-label={`${tsumeShogiPieceNames[type]}の動き`}>
              <PieceMovementFigure type={type} />
            </li>
          ))}
        </ul>
      }
      caption={
        <span className="flex items-center gap-4">
          <HowToPlayVerdictLine
            mark={<span className="size-2 rounded-full bg-current" />}
          >
            1升
          </HowToPlayVerdictLine>
          <span className="sr-only">、</span>
          <HowToPlayVerdictLine
            mark={
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
                <line
                  x1={2}
                  y1={8}
                  x2={10}
                  y2={8}
                  className="stroke-current"
                  strokeWidth={2}
                />
                <polygon points="9,4 15,8 9,12" className="fill-current" />
              </svg>
            }
          >
            何升でも
          </HowToPlayVerdictLine>
        </span>
      }
    />
  );
}
