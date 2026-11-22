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
  const location = useLocation();
  const returnTo = readGameGuideReturnTo(location.state, gameId);

  if (!game || !guide) return <NotFoundView />;
  const homePath = game.homePath;
  function close() {
    if (returnTo !== null) navigate(-1);
    else navigate(homePath, { replace: true });
  }
  // 遊び方とチュートリアルは、どちらも開いた画面へ閉じて戻るので、遊び方をチュートリアルに替え、開いた画面を引き継ぐ。
  function openTutorial() {
    navigate("/puzzles/:game/tutorial", {
      params: { game: gameId },
      replace: true,
      state: location.state,
    });
  }
  return (
    <section className="mx-auto max-w-3xl py-8 text-center">
      <h1 className="text-heading">{game.name}の遊び方</h1>
      <guide.HowToPlay
        open={true}
        onClose={close}
        onOpenTutorial={openTutorial}
      />
    </section>
  );
}
