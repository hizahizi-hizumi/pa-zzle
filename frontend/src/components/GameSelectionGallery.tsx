import { Play } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";

import { playPlayStartSound } from "@/components/app-decision-sound";
import { GameSelectionCarousel } from "@/components/GameSelectionGallery/GameSelectionCarousel";
import { SettingsButton } from "@/components/SettingsButton";
import { Button } from "@/components/ui/button";
import type { DifficultyLevel } from "@/games/difficulty";
import type { Path } from "@/router";
import "@/components/GameSelectionGallery.css";

export type GameSelectionContinuation = {
  difficulty: DifficultyLevel;
  attemptedCount: number;
};

type GameSelectionGalleryProps = {
  games: readonly {
    name: string;
    pictogramSvg: string;
    pictogramShowcaseSvg?: string;
    to: Path;
  }[];
  recordsTo: Path;
  selectedIndex: number;
  continuation: GameSelectionContinuation | null;
  onSelect: (index: number) => void;
  isCovered?: boolean;
};

export function GameSelectionGallery({
  games,
  recordsTo,
  selectedIndex,
  continuation,
  onSelect,
  isCovered = false,
}: GameSelectionGalleryProps) {
  const continuationId = useId();
  const [colorsInGame, setColorsInGame] = useState<Path | null>(null);

  function selectGame(index: number) {
    if (index === selectedIndex || !games[index]) return;
    setColorsInGame(games[index].to);
    onSelect(index);
  }

  if (games.length === 0) return null;
  const selectedGame = games[selectedIndex];

  return (
    <section className="game-selection" data-browser-surface="self">
      <header className="game-selection__header">
        <h1 className="sr-only">パズル選択</h1>
        <div className="game-selection__actions">
          <SettingsButton />
          <Link to={recordsTo} className="game-selection__records">
            記録
          </Link>
        </div>
      </header>
      <GameSelectionCarousel
        games={games}
        selectedIndex={selectedIndex}
        continuation={continuation}
        continuationId={continuationId}
        colorsInGame={colorsInGame}
        isCovered={isCovered}
        onSelect={selectGame}
      />
      {selectedGame && (
        <div className="game-selection__play">
          <Button asChild size="lg">
            <Link
              to={selectedGame.to}
              aria-label={`${selectedGame.name}を遊ぶ`}
              onClick={playPlayStartSound}
            >
              <Play aria-hidden="true" />
              遊ぶ
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
