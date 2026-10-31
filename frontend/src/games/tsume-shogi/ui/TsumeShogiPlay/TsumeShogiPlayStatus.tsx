import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type { TsumeShogiSessionPhase } from "@/games/tsume-shogi/session/session";
import { formatTsumeShogiMoveNotation } from "@/games/tsume-shogi/ui/move-notation";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

type TsumeShogiPlayStatusProps = {
  /** 問題の手数。誤王手の筋で手数が尽きたとき、その手数では詰まないことを示す。 */
  plies: number;
  phase: TsumeShogiSessionPhase;
  shownMoves: readonly TsumeShogiPlayedMove[];
};

/**
 * 盤の下の1行。直前の組の手を棋譜で示し、誤王手の筋では玉方の反証を反証の色で示す。行の高さは変えず、盤を動かさない。
 */
export function TsumeShogiPlayStatus({
  plies,
  phase,
  shownMoves,
}: TsumeShogiPlayStatusProps) {
  return (
    <p
      role="status"
      className="flex min-w-0 items-baseline gap-2 text-supporting"
    >
      {shownMoves.map((played) => {
        const refutation =
          played.side === "defender" && played.line === "wrong";
        return (
          <span
            key={played.side}
            className={cn(
              "shrink-0 tabular-nums",
              refutation && tsumeShogiToneClassNames.refutationText,
            )}
          >
            {formatTsumeShogiMoveNotation(played)}
            {refutation && phase === "attacker" && "で逃れる"}
          </span>
        );
      })}
      {phase === "refuted" && (
        <span
          className={cn("truncate", tsumeShogiToneClassNames.refutationText)}
        >
          {plies}手では詰みません
        </span>
      )}
    </p>
  );
}
