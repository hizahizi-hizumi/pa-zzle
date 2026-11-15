import { useLocation } from "react-router";
import { findGameCatalogEntry } from "@/app/game-integration/game-catalog";
import { findGameGuide } from "@/app/game-integration/game-guide";
import { readGameGuideReturnTo } from "@/app/navigation/game-guide-navigation";
import { useNavigate, useParams } from "@/router";
import { NotFoundView } from "@/views/NotFoundView";

export function GameHowToView() {
  const { game: gameId } = useParams("/puzzles/:game/how-to");
  const game = findGameCatalogEntry(gameId);
  const guide = findGameGuide(gameId);
  const navigate = useNavigate();
  const returnTo = readGameGuideReturnTo(useLocation().state, gameId);

  if (!game || !guide) return <NotFoundView />;
  const homePath = game.homePath;
  function close() {
    if (returnTo !== null) navigate(-1);
    else navigate(homePath, { replace: true });
  }
  return (
    <section className="mx-auto max-w-3xl py-8 text-center">
      <h1 className="text-heading">{game.name}の遊び方</h1>
      <guide.HowToPlay open={true} onClose={close} />
    </section>
  );
}
