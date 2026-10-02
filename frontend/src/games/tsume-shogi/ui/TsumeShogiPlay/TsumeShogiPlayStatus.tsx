import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type {
  TsumeShogiRejection,
  TsumeShogiSessionPhase,
} from "@/games/tsume-shogi/session/session";
import { formatTsumeShogiMoveNotation } from "@/games/tsume-shogi/ui/move-notation";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

const rejectionMessages = {
  "not-check": "王手になりません",
  "double-pawn": "二歩です",
  "pawn-drop-mate": "打歩詰です",
  "dead-piece": "行き所のない駒になります",
  unreachable: "そこへは指せません",
} as const satisfies Record<TsumeShogiRejection["reason"], string>;

type TsumeShogiPlayStatusProps = {
  phase: TsumeShogiSessionPhase;
  shownMoves: readonly TsumeShogiPlayedMove[];
  rejection: TsumeShogiRejection | null;
};

/**
 * 盤の下の1行。直前の組の手を棋譜で示し、誤王手の筋では玉方の反証を反証の色で示す。
 * 着手させなかった入力の理由はその入力の直後だけ示す。行の高さは変えず、盤を動かさない。
 */
export function TsumeShogiPlayStatus({
  phase,
  shownMoves,
  rejection,
}: TsumeShogiPlayStatusProps) {
  if (rejection) {
    return (
      <p
        role="status"
        className={cn(
          "truncate text-supporting",
          tsumeShogiToneClassNames.refutationText,
        )}
      >
        {rejectionMessages[rejection.reason]}
      </p>
    );
  }

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
          この筋では詰みません
        </span>
      )}
    </p>
  );
}
