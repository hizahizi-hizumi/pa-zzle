import { useTouchTap } from "@/components/touch-tap";
import {
  type TsumeShogiHand as TsumeShogiHandCounts,
  type TsumeShogiHandPieceType,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiHandPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 持駒を押せるか。
 * - `available`: 押して選べる。
 * - `waiting`: 玉方の応手を待つ短い間だけ押せない。見た目は変えず、フォーカスも残す。
 * - `unavailable`: この筋が尽きた・詰んだなどで、戻すまで押せない。押せそうに見えないよう薄くする。
 */
export type TsumeShogiHandAvailability =
  | "available"
  | "waiting"
  | "unavailable";

type TsumeShogiHandProps = {
  hand: TsumeShogiHandCounts;
  selectedPieceType: TsumeShogiHandPieceType | null;
  availability: TsumeShogiHandAvailability;
  onTapHand: (pieceType: TsumeShogiHandPieceType) => void;
};

/** 攻方の持駒。盤の下に並べ、押して選んでから空いた升を押して打つ。2枚以上は枚数を添える。 */
export function TsumeShogiHand({
  hand,
  selectedPieceType,
  availability,
  onTapHand,
}: TsumeShogiHandProps) {
  const { getTapHandlers } = useTouchTap();
  const pieceTypes = tsumeShogiHandPieceTypes.filter((type) => hand[type] > 0);

  return (
    <div className="flex min-h-12 items-center gap-2">
      <span className="shrink-0 text-play-meta text-muted-foreground">
        持駒
      </span>
      <div
        role="group"
        aria-label="攻方の持駒"
        className={cn(
          "flex flex-wrap gap-1 transition-opacity duration-(--duration-fast)",
          availability === "unavailable" && "opacity-40",
        )}
      >
        {pieceTypes.length === 0 && (
          <span className="text-play-meta text-muted-foreground">なし</span>
        )}
        {pieceTypes.map((type) => {
          const selected = selectedPieceType === type;
          const tapHandlers = getTapHandlers(() => onTapHand(type));
          return (
            <button
              key={type}
              type="button"
              aria-label={`${tsumeShogiHandPieceNames[type]} ${hand[type]}枚`}
              aria-pressed={selected}
              aria-disabled={availability !== "available" || undefined}
              onPointerUp={tapHandlers.onPointerUp}
              onClick={tapHandlers.onClick}
              className={cn(
                "relative flex h-12 min-w-11 touch-manipulation select-none items-center justify-center rounded-md px-1 outline-none transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70 aria-disabled:cursor-default not-aria-disabled:hover:bg-accent",
                selected && tsumeShogiToneClassNames.handSelected,
              )}
            >
              <span
                className={cn(
                  "flex transition-transform duration-(--duration-fast)",
                  selected && "-translate-y-0.5",
                )}
              >
                <TsumeShogiPieceGlyph type={type} side="attacker" size="hand" />
              </span>
              {hand[type] > 1 && (
                <span className="absolute right-0 bottom-0 text-play-meta tabular-nums">
                  {hand[type]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
