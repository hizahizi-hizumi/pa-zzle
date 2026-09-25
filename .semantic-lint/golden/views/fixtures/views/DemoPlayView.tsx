import { useDemoPlay } from "@/games/demo/play/use-demo-play";
import { DemoPlay } from "@/games/demo/ui/DemoPlay";
import { appendPlayRecord, readPlayRecords } from "@/records/storage";
import { useParams } from "@/router";

export function DemoPlayView() {
  const { difficulty } = useParams("/puzzles/demo/play/:difficulty");
  const play = useDemoPlay(difficulty);
  const score = Math.max(
    0,
    100 - play.mistakes * 5 - Math.floor(play.elapsedMs / 60_000),
  );
  const isPersonalBest = readPlayRecords().every(
    (record) => record.payload.score < score,
  );

  function handleComplete() {
    if (isPersonalBest) {
      appendPlayRecord({ id: play.id, gameId: "demo", payload: { score } });
    }
  }

  return (
    <DemoPlay {...play} score={score} onComplete={handleComplete} />
  );
}
