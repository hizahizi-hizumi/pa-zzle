import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import {
  PieceMovementFigure,
  pieceMovementFigureTypes,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PieceMovementFigure";

type TsumeShogiHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** 成る駒と、成った後の駒。 */
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

/** ルールと操作を、短い文と駒の動き・成りの図で示す。 */
export function TsumeShogiHowToPlayDialog({
  open,
  onClose,
}: TsumeShogiHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="手前の攻方を指して、玉方の玉を詰ませる。「3手詰」は攻方と玉方の手を合わせた手数で、その手数のうちに詰ませる。"
      onClose={onClose}
    >
      <li>
        <p>攻方は毎手、王手をかける。王手にならない手は指せない。</p>
      </li>
      <li>
        <p>
          玉方は自動で指し、いちばん長く逃れる手を選ぶ。盤上と攻方の持駒にない駒はすべて玉方の持駒（残り全部）で、合駒に使える。
        </p>
      </li>
      <li className="space-y-2">
        <p>駒の動き。点は1升、矢印は何升でも進める。</p>
        <ul className="grid grid-cols-5 gap-x-1 gap-y-2">
          {pieceMovementFigureTypes.map((type) => (
            <li key={type} className="flex flex-col items-center gap-0.5">
              <PieceMovementFigure type={type} />
              <span className="text-meta text-muted-foreground">
                {tsumeShogiPieceNames[type]}
              </span>
            </li>
          ))}
        </ul>
      </li>
      <li className="space-y-2">
        <p>
          上の3段（相手の陣地）に入る・そこから出る・その中で動くと成れる。飛は龍、角は馬に、銀・桂・香・歩は金と同じ動きになる。成・不成のどちらも指せるときは、どちらにするかを選ぶ。
        </p>
        <ul className="grid grid-cols-3 gap-x-2 gap-y-2">
          {promotions.map(([type, promotedType]) => (
            <li
              key={type}
              aria-label={`${tsumeShogiPieceNames[type]}が成ると${tsumeShogiPieceNames[promotedType]}`}
            >
              <HowToPlayTransition>
                <TsumeShogiPieceGlyph
                  type={type}
                  side="attacker"
                  size="figure"
                />
                <TsumeShogiPieceGlyph
                  type={promotedType}
                  side="attacker"
                  size="figure"
                />
              </HowToPlayTransition>
            </li>
          ))}
        </ul>
      </li>
      <li>
        <p>持駒は空いた升に打てる。</p>
      </li>
      <li>
        <p>
          指せない手:
          二歩（歩のある筋に歩を打つ）、打歩詰（歩を打って詰ませる）、行き所のない駒（その先へ動けない段に成らずに置く）。
        </p>
      </li>
      <li>
        <p>
          詰まない王手を指すと、玉方が逃れる手を指す。続けて王手してその筋を確かめてもよい。待ったを押すと、その王手を指す前まで一度に戻って考え直せる。
        </p>
      </li>
      <li>
        <p className="text-muted-foreground">
          駒を押して選び、行き先の升を押す。持駒は押してから打つ升を押す。
        </p>
      </li>
    </HowToPlayDialog>
  );
}
