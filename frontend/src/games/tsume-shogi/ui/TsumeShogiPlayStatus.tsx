import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiSquare } from "@/games/tsume-shogi/puzzle/position";
import type { TsumeShogiSessionPhase } from "@/games/tsume-shogi/session/session";
import { formatTsumeShogiMoveNotation } from "@/games/tsume-shogi/ui/move-notation";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

type TsumeShogiPlayStatusProps = {
  plies: number;
  phase: TsumeShogiSessionPhase;
  shownMoves: readonly TsumeShogiPlayedMove[];
  /** `shownMoves` の最初の手の1つ前の手の移動先。棋譜の「同」に使う。 */
  precedingMoveTo: TsumeShogiSquare | null;
};

/**
 * 盤の下の1行。行の高さは変えず、盤を動かさない。
 * 盤が狭くて収まらないときは、この手数では詰まないという知らせを残し、棋譜の方を省いて見せる。
 */
export function TsumeShogiPlayStatus({
  plies,
  phase,
  shownMoves,
  precedingMoveTo,
}: TsumeShogiPlayStatusProps) {
  return (
    <p
      role="status"
      className="flex min-w-0 items-baseline gap-2 text-supporting"
    >
      {shownMoves.map((played, index) => {
        const refutation =
          played.side === "defender" && played.line === "wrong";
        return (
          <span
            key={played.side}
            className={cn(
              "min-w-0 truncate tabular-nums",
              refutation && tsumeShogiToneClassNames.refutationText,
            )}
          >
            {formatTsumeShogiMoveNotation(
              played,
              index === 0 ? precedingMoveTo : shownMoves[index - 1]?.move.to,
            )}
            {refutation && phase === "attacker" && "で逃れる"}
          </span>
        );
      })}
      {phase === "refuted" && (
        <span
          className={cn("shrink-0", tsumeShogiToneClassNames.refutationText)}
        >
          {plies}手では詰みません
        </span>
      )}
    </p>
  );
}
