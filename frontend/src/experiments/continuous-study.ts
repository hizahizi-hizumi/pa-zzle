import {
  type CuratedStudyGameId,
  curatedStudyGames,
} from "@/experiments/curated-study";
import {
  type ContinuousStudyMethod,
  selectContinuousStudySequence,
} from "@/experiments/curated-study-selection";

type ContinuousStudyDifficulty = "3" | "4" | "5";

export function getContinuousStudyPlayUrl(
  gameId: CuratedStudyGameId,
  difficulty: ContinuousStudyDifficulty,
  method: ContinuousStudyMethod,
  episode: number,
  position: number,
  participant = false,
): string | null {
  const candidate = selectContinuousStudySequence(
    gameId,
    difficulty,
    method,
    episode,
  )?.[position];
  if (!candidate) return null;
  const query = new URLSearchParams({
    problem: candidate.problemId,
    study: `continuous.${gameId}.${difficulty}.${method}.${episode}.${position}${participant ? ".p" : ""}`,
  });
  return `${curatedStudyGames[gameId].playPath}/${difficulty}?${query}`;
}

export function getContinuousStudyContinuation(
  studyCode: string | null,
  gameId: string,
  difficulty: string,
  problemId: string,
): { destination: string; label: string } | null {
  const match =
    /^continuous\.(nanpure|parking-jam)\.([345])\.(random|diverse)\.(\d{1,2})\.(\d{1,2})(\.p)?$/.exec(
      studyCode ?? "",
    );
  if (!match || match[1] !== gameId || match[2] !== difficulty) return null;
  const [, game, level, method, rawEpisode, rawPosition] = match;
  const participant = match[6] === ".p";
  const episode = Number(rawEpisode);
  const position = Number(rawPosition);
  const sequence = selectContinuousStudySequence(
    game as CuratedStudyGameId,
    level as ContinuousStudyDifficulty,
    method as ContinuousStudyMethod,
    episode,
  );
  if (!sequence || sequence[position]?.problemId !== problemId) return null;
  if (position + 1 < sequence.length) {
    const destination = getContinuousStudyPlayUrl(
      game as CuratedStudyGameId,
      level as ContinuousStudyDifficulty,
      method as ContinuousStudyMethod,
      episode,
      position + 1,
      participant,
    );
    return destination ? { destination, label: "次の問題" } : null;
  }
  const query = new URLSearchParams({
    game,
    difficulty: level,
    method: method ?? "random",
    episode: String(episode),
    finished: "1",
  });
  if (participant) query.set("participant", "1");
  return {
    destination: `/studies/continuous?${query}`,
    label: "比較画面へ戻る",
  };
}
