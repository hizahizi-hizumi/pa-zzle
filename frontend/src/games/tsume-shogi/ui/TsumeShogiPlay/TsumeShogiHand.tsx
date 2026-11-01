import {
  type TsumeShogiHand as TsumeShogiHandCounts,
  type TsumeShogiHandPieceType,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceCharacters } from "@/games/tsume-shogi/ui/piece-label";
import { cn } from "@/lib/utils";

type TsumeShogiHandProps = {
  hand: TsumeShogiHandCounts;
  selectedPieceType: TsumeShogiHandPieceType | null;
  disabled: boolean;
  onTapHand: (pieceType: TsumeShogiHandPieceType) => void;
};

/** 攻方の持駒。押して選び、空いた升を押して打つ。 */
export function TsumeShogiHand({
  hand,
  selectedPieceType,
  disabled,
  onTapHand,
}: TsumeShogiHandProps) {
  const pieceTypes = tsumeShogiHandPieceTypes.filter((type) => hand[type] > 0);

  return (
    <div role="group" aria-label="攻方の持駒" className="flex min-h-10 gap-1">
      {pieceTypes.length === 0 && (
        <span className="text-supporting text-muted-foreground">なし</span>
      )}
      {pieceTypes.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={selectedPieceType === type}
          disabled={disabled}
          className={cn(
            "flex h-10 min-w-10 items-center justify-center rounded-md border border-border px-2 text-lg",
            selectedPieceType === type && "bg-primary text-primary-foreground",
          )}
          onClick={() => onTapHand(type)}
        >
          {tsumeShogiPieceCharacters[type]}
          {hand[type] > 1 && <span className="text-meta">{hand[type]}</span>}
        </button>
      ))}
    </div>
  );
}
