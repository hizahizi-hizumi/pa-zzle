import { useLocation } from "react-router";
import { findGameCatalogEntry } from "@/app/game-integration/game-catalog";
import { toZukanGameSource } from "@/app/game-integration/game-catalog-entry";
import { findGameGuide } from "@/app/game-integration/game-guide";
import {
  readGameGuideDifficulty,
  readGameGuideReturnTo,
} from "@/app/navigation/game-guide-navigation";
import {
  selectAnyRandomProblemId,
  selectRandomProblemId,
} from "@/features/random-play/random-problem-selection";
import { parseDifficultyLevel } from "@/games/difficulty";
import { useNavigate, useParams } from "@/router";
import { NotFoundView } from "@/views/NotFoundView";

export function GameTutorialView() {
  const { game: gameId } = useParams("/puzzles/:game/tutorial");
  const game = findGameCatalogEntry(gameId);
  const guide = findGameGuide(gameId);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = readGameGuideReturnTo(location.state, gameId);
  const fromPlay = returnTo?.startsWith(`/puzzles/${gameId}/play/`) === true;
  const difficulty =
    parseDifficultyLevel(
      readGameGuideDifficulty(location.state) ?? undefined,
    ) ?? "1";

  if (!game || !guide?.Tutorial) return <NotFoundView />;
  const { Tutorial } = guide;
  const homePath = game.homePath;
  function close() {
    if (returnTo !== null) navigate(-1);
    else navigate(homePath, { replace: true });
  }
  function startPlay() {
    const currentGame = findGameCatalogEntry(gameId);
    if (!currentGame) return;
    const source = toZukanGameSource(currentGame);
    const problemId =
      selectRandomProblemId(source, difficulty) ??
      selectAnyRandomProblemId(source, difficulty);
    if (problemId === null) {
      navigate(homePath, { replace: true });
      return;
    }
    navigate(currentGame.playPath, { params: { problemId }, replace: true });
  }
  return (
    <section className="mx-auto max-w-3xl py-8 text-center">
      <h1 className="text-heading">{game.name}のチュートリアル</h1>
      <Tutorial
        open={true}
        onClose={close}
        playStart={fromPlay ? undefined : { difficulty, onStart: startPlay }}
      />
    </section>
  );
}
