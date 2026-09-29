import type { ReflectionLaserView } from "@/games/reflection/play/use-reflection-play";
import { ReflectionOutcomeMark } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import { formatReflectionEntry } from "@/games/reflection/ui/format-entry";
import { reflectionOutcomeLabels } from "@/games/reflection/ui/outcome-label";
import { reflectionToneClassNames } from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionLaserStatusProps = {
  laser: ReflectionLaserView | null;
};

/**
 * 表示中の光路が今の盤面でどうなったか。外周ヒントの目標と照らし合わせた結果は出さない。
 * 光路を表示していない間も高さを取り、盤面の位置を動かさない。
 */
export function ReflectionLaserStatus({ laser }: ReflectionLaserStatusProps) {
  return (
    <p
      aria-live="polite"
      className="flex h-5 items-center justify-center gap-1.5 whitespace-nowrap text-play-meta text-muted-foreground"
    >
      {laser ? (
        <>
          <span>{formatReflectionEntry(laser.entry)}の光</span>
          <span className={cn("flex", reflectionToneClassNames.laserText)}>
            <ReflectionOutcomeMark
              outcome={laser.trace.outcome}
              size="inline"
            />
          </span>
          <span className="text-foreground/80">
            {reflectionOutcomeLabels[laser.trace.outcome]}
            {laser.trace.outcome === "exit" && laser.trace.exit
              ? `（${formatReflectionEntry(laser.trace.exit)}）`
              : ""}
          </span>
          <span className="font-mono font-medium tabular-nums text-foreground/80">
            {laser.trace.distance}マス
          </span>
        </>
      ) : null}
    </p>
  );
}
