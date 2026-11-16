import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiPieceNames } from "@/games/tsume-shogi/ui/piece-label";

/** 成れる駒と、成った駒。本番の成・不成の選択肢と同じ組。 */
const promotions = [
  ["rook", "dragon"],
  ["bishop", "horse"],
  ["silver", "promSilver"],
  ["knight", "promKnight"],
  ["lance", "promLance"],
  ["pawn", "promPawn"],
] as const satisfies readonly (readonly [
  TsumeShogiPieceType,
  TsumeShogiPieceType,
])[];

/**
 * 成れる駒が何に成るかの、押せない図。本番の駒台の持駒と同じ大きさの駒の絵で、元の駒から成った駒へ矢印でつなぎ、2列に並べる。
 * 金と玉は成らないので並べない。
 */
export function PromotionFigure() {
  return (
    <HowToPlayExample
      figure={
        <ul className="grid grid-cols-2 gap-x-8 gap-y-3">
          {promotions.map(([type, promotedType]) => (
            <li
              key={type}
              aria-label={`${tsumeShogiPieceNames[type]}が成ると${tsumeShogiPieceNames[promotedType]}`}
            >
              <HowToPlayTransition>
                <TsumeShogiPieceGlyph type={type} side="attacker" size="hand" />
                <TsumeShogiPieceGlyph
                  type={promotedType}
                  side="attacker"
                  size="hand"
                />
              </HowToPlayTransition>
            </li>
          ))}
        </ul>
      }
    />
  );
}

export const _private = { promotions };
