import { TutorialSpotlight } from "@/components/TutorialSpotlight";
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
  /** チュートリアルで、この行と、この手数では詰まないことの知らせを覆いから抜く。 */
  spotlit?: boolean;
};

/**
 * 盤の下の1行。行の高さは変えず、盤を動かさない。
 * この手数では詰まなくなったら、そのことを駒台の欄へ重ねた大きな札で知らせ、棋譜の行は隠さない。駒台の持駒はその間指せないので隠してよく、
 * 札は行から上へはみ出させて盤と駒台の位置・大きさを変えない。
 */
export function TsumeShogiPlayStatus({
  plies,
  phase,
  shownMoves,
  precedingMoveTo,
  spotlit = false,
}: TsumeShogiPlayStatusProps) {
  return (
    <p
      role="status"
      className="flex h-full min-w-0 items-baseline gap-2 text-supporting"
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
          data-refutation-notice=""
          className={cn(
            "absolute bottom-[calc(100%+0.25rem)] left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap rounded-lg px-5 py-2 leading-tight",
            "animate-in fade-in-0 zoom-in-75 duration-200 ease-(--ease-celebrate) motion-reduce:animate-none",
            tsumeShogiToneClassNames.refutationNotice,
          )}
        >
          <span className="text-lg font-bold tracking-wide">
            {plies}手では詰みません
          </span>
          <span
            className={cn(
              "text-supporting",
              tsumeShogiToneClassNames.refutationNoticeHint,
            )}
          >
            待った（↶）で戻せます
          </span>
          <TutorialSpotlight active={spotlit} className="inset-0 rounded-lg" />
        </span>
      )}
      <TutorialSpotlight active={spotlit} className="inset-0" />
    </p>
  );
}
