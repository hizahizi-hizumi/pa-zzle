import type { CSSProperties, ReactNode } from "react";
import { Issue690BoardPreview } from "@/components/Issue690BoardPreview";
import { Issue690Grade } from "@/components/Issue690Grade";
import type { Issue690LiveIdea } from "@/components/Issue690LiveTypes";
import type { Issue690BoardSnapshot } from "@/games/issue690-board-snapshot";
import type { GameResultLevel } from "@/games/result";

const celebrationPieces = Array.from({ length: 32 }, (_, index) => {
  const angle = (index / 32) * Math.PI * 2 - Math.PI / 2;
  const distance = 95 + (index % 5) * 22;
  return {
    id: index,
    x: `${Math.cos(angle) * distance}px`,
    y: `${Math.sin(angle) * distance * 0.7}px`,
    rotation: `${(index * 67) % 360}deg`,
  };
});

type Issue690HeroProps = {
  idea: Issue690LiveIdea;
  level: GameResultLevel;
  score: number;
  boardSnapshot?: Issue690BoardSnapshot;
  recordContent: ReactNode;
  skipReveal?: boolean;
};

export function Issue690Hero({
  idea,
  level,
  score,
  boardSnapshot,
  recordContent,
  skipReveal = false,
}: Issue690HeroProps) {
  switch (idea) {
    case "02":
      return (
        <div className="i690-theater i690-theater--type">
          <div className="i690-type-stage">
            <Issue690Grade level={level} score={score} />
          </div>
          <span className="i690-type-accent" aria-hidden="true" />
        </div>
      );
    case "03":
      return boardSnapshot ? (
        <div className="i690-theater i690-theater--board">
          <div className="i690-board-curtain">
            <Issue690BoardPreview
              snapshot={boardSnapshot}
              emphasis="complete"
            />
          </div>
          <span className="i690-board-light" aria-hidden="true" />
          <div className="i690-board-result">
            <Issue690Grade level={level} score={score} compact />
          </div>
        </div>
      ) : (
        <div className="i690-theater i690-theater--type">
          <Issue690Grade level={level} score={score} />
        </div>
      );
    case "05":
      return (
        <div className="i690-theater i690-theater--record">
          <Issue690Grade level={level} score={score} compact />
          <div className="i690-record-race">{recordContent}</div>
        </div>
      );
    case "06":
      return (
        <div className="i690-theater i690-theater--ambient">
          <div className="i690-ambient-daybreak" aria-hidden="true" />
          <div className="i690-ambient-veil" aria-hidden="true" />
          <span
            className="i690-ambient-pulse i690-ambient-pulse--first"
            aria-hidden="true"
          />
          <span
            className="i690-ambient-pulse i690-ambient-pulse--second"
            aria-hidden="true"
          />
          <Issue690Grade level={level} score={score} countUp={!skipReveal} />
        </div>
      );
    case "07":
      return (
        <div
          className="i690-theater i690-theater--celebrate"
          data-celebration-game={boardSnapshot?.gameId ?? "generic"}
        >
          <span className="i690-celebration-flash" aria-hidden="true" />
          <div className="i690-celebration-pieces" aria-hidden="true">
            {celebrationPieces.map((piece) => (
              <span
                key={piece.id}
                className="i690-celebration-piece"
                style={
                  {
                    "--piece": piece.id,
                    "--flight-x": piece.x,
                    "--flight-y": piece.y,
                    "--rotation": piece.rotation,
                    "--piece-color":
                      boardSnapshot?.gameId === "water-sort"
                        ? boardSnapshot.palette[
                            piece.id % Math.max(1, boardSnapshot.palette.length)
                          ]
                        : undefined,
                  } as CSSProperties
                }
              >
                {boardSnapshot?.gameId === "nanpure"
                  ? boardSnapshot.board[
                      (piece.id * 13) % boardSnapshot.board.length
                    ]
                  : null}
              </span>
            ))}
          </div>
          <Issue690Grade level={level} score={score} />
        </div>
      );
  }
}
