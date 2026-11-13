import type { IceFloorMazeElementIntroduction } from "@/games/ice-floor-maze/tutorial/tutorial";
import { IceFloorMazeElementIcon } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeElementNotice/IceFloorMazeElementIcon";

type IceFloorMazeElementNoticeProps = {
  introductions: readonly IceFloorMazeElementIntroduction[];
};

/** 盤面の下の、待ったの上の空きに出す一言。スワイプは下の盤面の操作へ通す。 */
export function IceFloorMazeElementNotice({
  introductions,
}: IceFloorMazeElementNoticeProps) {
  return (
    <div role="status" className="pointer-events-none flex justify-center">
      <div className="flex max-w-md animate-in flex-col gap-1 rounded-lg border bg-background/95 px-3 py-1.5 shadow-raised fade-in-0 slide-in-from-bottom-2 duration-(--duration-slow) motion-reduce:animate-none">
        {introductions.map(({ ruleId, headline }) => (
          <p
            key={ruleId}
            className="flex items-center gap-2 text-play-context font-medium"
          >
            <IceFloorMazeElementIcon ruleId={ruleId} />
            {/* チュートリアルの見出しの改行は使わず、一言の幅で折り返す。 */}
            <span>{headline.replaceAll("\n", "")}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
