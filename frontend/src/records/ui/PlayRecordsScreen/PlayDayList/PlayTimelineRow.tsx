import { memo } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { getGameResultStyle } from "@/components/game-result-style";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { getGameResultLevel } from "@/games/result";
import { formatPlayedTime } from "@/lib/format-played-at";
import type { PlayTimelineEntry } from "@/records/play-timeline";
import { playScoreMetricPresentation } from "@/records/ui/play-record-display";
import type { PlayTimelineEntryDescription } from "@/records/ui/play-timeline-entry-description";
import {
  formatZukanNumber,
  getZukanNumberDigitCount,
} from "@/zukan/ui/zukan-number-format";

type PlayTimelineRowProps = {
  entry: PlayTimelineEntry;
  describeEntry: (entry: PlayTimelineEntry) => PlayTimelineEntryDescription;
  onOpen: (entry: PlayTimelineEntry) => void;
};

function PlayTimelineRowContent({
  entry,
  describeEntry,
  onOpen,
}: PlayTimelineRowProps) {
  const { gameName, pictogramSvg, levelLabel, zukanNumber, score } =
    describeEntry(entry);

  return (
    <Item asChild variant="outline" size="sm" className="w-full">
      <button type="button" onClick={() => onOpen(entry)}>
        <ItemMedia>
          <span className="size-8">
            <GamePictogram svg={pictogramSvg} />
          </span>
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full min-w-0">
            <span className="truncate">{gameName}</span>
            {levelLabel !== null && (
              <span className="shrink-0 font-normal text-muted-foreground">
                {levelLabel}
              </span>
            )}
          </ItemTitle>
          <ItemDescription className="flex items-baseline gap-2 tabular-nums">
            {zukanNumber !== null && (
              <span>
                {formatZukanNumber(
                  zukanNumber.number,
                  getZukanNumberDigitCount(zukanNumber.problemCount),
                )}
              </span>
            )}
            {entry.kind === "abandoned" ? (
              <span>離脱</span>
            ) : (
              score !== null && (
                <span
                  className={`font-semibold ${getGameResultStyle(getGameResultLevel(score)).scoreClassName}`}
                >
                  {playScoreMetricPresentation.formatValue(score)}
                </span>
              )
            )}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <time
            dateTime={new Date(entry.playedAt).toISOString()}
            className="text-meta text-muted-foreground tabular-nums"
          >
            {formatPlayedTime(entry.playedAt)}
          </time>
        </ItemActions>
      </button>
    </Item>
  );
}

/** 一覧を描き足しても描いた行を描き直さないよう、同じプレイと操作のあいだは描き直さない。 */
export const PlayTimelineRow = memo(PlayTimelineRowContent);
