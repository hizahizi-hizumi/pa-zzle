import type {
  TsumeShogiPieceType,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

const promotedPieceTypes: Partial<
  Record<TsumeShogiPieceType, TsumeShogiPieceType>
> = {
  rook: "dragon",
  bishop: "horse",
  silver: "promSilver",
  knight: "promKnight",
  lance: "promLance",
  pawn: "promPawn",
};

type TsumeShogiPromotionPickerProps = {
  to: TsumeShogiSquare;
  pieceType: TsumeShogiPieceType;
  onChoose: (promote: boolean) => void;
};

/** 盤の幅に対する1升の割合。 */
const squareRatio = 100 / 9;

/**
 * 成・不成のどちらも王手になる移動で、移動先の升のそばに成った駒と成らない駒を並べて選ばせる。
 * 移動先が盤の上半分なら升の下、下半分なら升の上に出し、移動先と駒を隠さない。
 */
export function TsumeShogiPromotionPicker({
  to,
  pieceType,
  onChoose,
}: TsumeShogiPromotionPickerProps) {
  const column = 9 - to.file;
  const left = Math.min(Math.max(column - 0.5, 0), 7) * squareRatio;
  const placeBelow = to.rank <= 5;
  const top = (placeBelow ? to.rank : to.rank - 2) * squareRatio;
  const options = [
    {
      promote: true,
      type: promotedPieceTypes[pieceType] ?? pieceType,
      label: "成",
    },
    { promote: false, type: pieceType, label: "不成" },
  ];

  return (
    <div
      role="group"
      aria-label="成・不成"
      className="absolute z-20 flex h-[calc(100%/9)] w-[calc(200%/9)] gap-px rounded-sm bg-popover p-px shadow-raised outline outline-(length:--border-width-normal) outline-border"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {options.map(({ promote, type, label }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          className={cn(
            "relative flex min-w-0 flex-1 touch-manipulation flex-col items-center justify-center rounded-sm outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70",
            tsumeShogiToneClassNames.boardSurface,
          )}
          onClick={() => onChoose(promote)}
        >
          <TsumeShogiPieceGlyph type={type} side="attacker" size="board" />
          <span className="absolute bottom-0 rounded-sm bg-popover/90 px-0.5 text-[0.625rem] leading-none text-popover-foreground">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
