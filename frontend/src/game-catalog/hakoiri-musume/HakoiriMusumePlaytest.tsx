import { Link } from "react-router";

import { PlayableHakoiriMusume } from "@/game-catalog/hakoiri-musume/PlayableHakoiriMusume";
import {
  findHakoiriMusumePlaytestProblem,
  hakoiriMusumePlaytestProblems,
} from "@/games/hakoiri-musume/problem/playtest-problems";

type HakoiriMusumePlaytestProps = {
  problemId: string;
};

function PlaytestProblemList() {
  const families = Map.groupBy(
    hakoiriMusumePlaytestProblems,
    (problem) => problem.familyLabel,
  );
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="font-bold text-xl">箱入り娘の試遊用の問題</h1>
      {[...families].map(([familyLabel, problems]) => (
        <section key={familyLabel} className="space-y-2">
          <h2 className="font-bold">{familyLabel}</h2>
          <ul className="flex flex-wrap gap-3">
            {problems.map((problem) => (
              <li key={problem.id}>
                <Link
                  className="underline"
                  to={`/puzzles/hakoiri-musume/playtest/${problem.id}`}
                >
                  {problem.id}（{problem.optimalMoveCount}手）
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

/**
 * 開発時だけ開ける、盤の作りを広げた箱入り娘の試遊。`problemId` の試遊用の問題を、本番と同じプレイ画面で遊ぶ。
 * 試遊用の問題に無い ID なら、問題の一覧を出す。記録はレベル1の記録として残る。
 */
export function HakoiriMusumePlaytest({
  problemId,
}: HakoiriMusumePlaytestProps) {
  const problem = findHakoiriMusumePlaytestProblem(problemId);
  if (!problem) {
    return <PlaytestProblemList />;
  }
  return (
    <PlayableHakoiriMusume
      key={problemId}
      difficulty="1"
      initialProblem={problem}
    />
  );
}
