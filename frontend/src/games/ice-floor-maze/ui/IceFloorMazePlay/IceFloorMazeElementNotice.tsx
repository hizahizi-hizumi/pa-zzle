import type { IceFloorMazeElementIntroduction } from "@/games/ice-floor-maze/tutorial/tutorial";

type IceFloorMazeElementNoticeProps = {
  introductions: readonly IceFloorMazeElementIntroduction[];
};

/**
 * 盤面の上端に重ねる一言。盤面の位置と大きさを変えず、スワイプは下の盤面へ通す。
 */
export function IceFloorMazeElementNotice({
  introductions,
}: IceFloorMazeElementNoticeProps) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-3 top-2 z-20 flex justify-center sm:inset-x-6"
    >
      <div className="max-w-md animate-in rounded-lg border bg-background/95 px-4 py-2 text-center shadow-raised fade-in-0 slide-in-from-top-2 duration-(--duration-slow) motion-reduce:animate-none">
        {introductions.map(({ ruleId, headline }) => (
          <p
            key={ruleId}
            className="whitespace-pre-line text-play-context font-medium"
          >
            {headline}
          </p>
        ))}
      </div>
    </div>
  );
}
