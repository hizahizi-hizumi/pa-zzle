import { useState } from "react";
import { GameResultActions } from "@/components/GameResultScreen/GameResultActions";
import { GameResultDetails } from "@/components/GameResultScreen/GameResultDetails";
import { Issue690Hero } from "@/components/Issue690Hero";
import type {
  Issue690LiveIdea,
  Issue690ResultData,
} from "@/components/Issue690LiveTypes";
import { Issue690Metrics } from "@/components/Issue690Metrics";
import { getGameResultLevel } from "@/games/result";

type Issue690LiveResultProps = {
  idea: Issue690LiveIdea;
  data: Issue690ResultData;
};

export function Issue690LiveResult({ idea, data }: Issue690LiveResultProps) {
  const level = getGameResultLevel(data.score);
  const recordContent = data.issue690RecordSummary ?? data.recordOutcomeNotice;
  const [skipReveal, setSkipReveal] = useState(false);

  function finishReveal(element: HTMLDivElement) {
    for (const animation of element.getAnimations?.({ subtree: true }) ?? []) {
      if (animation.playState === "running") animation.finish();
    }
    setSkipReveal(true);
  }

  if (idea === "06") {
    return (
      <div
        className="i690-screen i690-screen--06"
        data-level={level}
        onPointerDown={(event) => finishReveal(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            finishReveal(event.currentTarget);
          }
        }}
        data-game={data.issue690BoardSnapshot?.gameId ?? "unknown"}
      >
        <header className="i690-quiet-heading">
          <div className="i690-quiet-context">
            <span className="i690-quiet-game">{data.gameName}</span>
            <span>{data.difficultyLabel}</span>
          </div>
          <GameResultDetails
            variant="quiet"
            breakdown={data.scoreBreakdown}
            criteria={data.scoreCriteria}
          />
        </header>
        <div className="i690-quiet-metrics">
          <Issue690Metrics metrics={data.metrics} variant="quiet" />
        </div>
        <main className="i690-quiet-moment">
          <Issue690Hero
            idea={idea}
            level={level}
            score={data.score}
            boardSnapshot={data.issue690BoardSnapshot}
            recordContent={recordContent}
            skipReveal={skipReveal}
          />
        </main>
        <div className="i690-quiet-feedback">{recordContent}</div>
        <footer className="i690-quiet-footer">
          <GameResultActions
            variant="quiet"
            onStartNewProblem={data.onStartNewProblem}
            onOpenGameHome={data.onOpenGameHome}
            onReplay={data.onReplay}
          />
        </footer>
      </div>
    );
  }

  return (
    <div
      className={`i690-screen i690-screen--${idea}`}
      data-level={level}
      data-game={data.issue690BoardSnapshot?.gameId ?? "unknown"}
    >
      <header className="i690-context">
        <span className="i690-context-game">{data.gameName}</span>
        <span className="i690-context-divider" aria-hidden="true" />
        <span className="i690-context-difficulty">{data.difficultyLabel}</span>
      </header>
      <main className="i690-moment">
        <Issue690Hero
          idea={idea}
          level={level}
          score={data.score}
          boardSnapshot={data.issue690BoardSnapshot}
          recordContent={recordContent}
        />
      </main>
      <div className="i690-reading">
        <Issue690Metrics metrics={data.metrics} />
        {idea !== "05" && <div className="i690-record">{recordContent}</div>}
      </div>
      <footer className="i690-bottom">
        <GameResultActions
          onStartNewProblem={data.onStartNewProblem}
          onOpenGameHome={data.onOpenGameHome}
          onReplay={data.onReplay}
        />
        <GameResultDetails
          breakdown={data.scoreBreakdown}
          criteria={data.scoreCriteria}
        />
      </footer>
    </div>
  );
}
