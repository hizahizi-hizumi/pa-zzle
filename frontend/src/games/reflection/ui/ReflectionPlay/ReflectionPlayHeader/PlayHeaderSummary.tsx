import { REFLECTION_DISPLAY_NAME } from "@/games/reflection/display-name";
import { formatElapsedTime } from "@/games/reflection/ui/format-elapsed-time";
import { PlayMetric } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayHeaderSummary/PlayMetric";

type PlayHeaderSummaryProps = {
  elapsedMs: number;
};

/** 置き直しは点に入らないので、プレイ中は時間だけを示す。置き直しの回数は結果と記録に出す。 */
export function PlayHeaderSummary({ elapsedMs }: PlayHeaderSummaryProps) {
  return (
    <div className="min-w-0 text-center">
      <h1 className="truncate text-play-context">{REFLECTION_DISPLAY_NAME}</h1>
      <div className="mt-1 flex items-center justify-center text-play-meta text-muted-foreground">
        <PlayMetric label="時間" value={formatElapsedTime(elapsedMs)} />
      </div>
    </div>
  );
}
