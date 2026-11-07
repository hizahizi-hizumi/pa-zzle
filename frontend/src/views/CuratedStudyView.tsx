import { useSearchParams } from "react-router";

import { HomeBackLink } from "@/components/HomeBackLink";
import { Button } from "@/components/ui/button";
import {
  type CuratedStudyGameId,
  type CuratedStudySetId,
  curatedStudyGames,
  getCuratedCandidatePlayUrl,
  getCuratedRandomPlayUrl,
} from "@/experiments/curated-study";

const gameIds = ["nanpure", "parking-jam"] as const;
const difficulties = ["3", "4", "5"] as const;

type Presentation = "list" | "sequence";

export function CuratedStudyView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const gameId: CuratedStudyGameId =
    searchParams.get("game") === "parking-jam" ? "parking-jam" : "nanpure";
  const presentation: Presentation =
    searchParams.get("presentation") === "sequence" ? "sequence" : "list";
  const game = curatedStudyGames[gameId];
  const setId: CuratedStudySetId = searchParams.get("set") === "b" ? "b" : "a";
  const candidates = game.sets[setId];
  const requestedPosition = Number(searchParams.get("position") ?? "0");
  const position =
    Number.isInteger(requestedPosition) && requestedPosition >= 0
      ? Math.min(requestedPosition, candidates.length - 1)
      : 0;

  const currentCandidate = candidates[position] ?? candidates[0];

  function updateSelection(values: {
    game?: CuratedStudyGameId;
    presentation?: Presentation;
    set?: CuratedStudySetId;
    position?: number;
  }) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (values.game) next.set("game", values.game);
        if (values.presentation) next.set("presentation", values.presentation);
        if (values.set) next.set("set", values.set);
        next.set("position", String(values.position ?? 0));
        return next;
      },
      { replace: true },
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-7">
      <header className="space-y-3">
        <HomeBackLink />
        <h1 className="text-screen-title">出題方法の比較</h1>
        <p className="text-supporting text-muted-foreground">
          試遊用の画面です。同じゲームについて、普段の出題と条件を揃えた2つの固定問題セットを比べられます。
          固定問題の選定理由は解く前には表示しません。
        </p>
      </header>

      <section aria-label="ゲームを選ぶ" className="space-y-3">
        <h2 className="text-heading">ゲーム</h2>
        <div className="flex flex-wrap gap-2">
          {gameIds.map((id) => (
            <Button
              key={id}
              type="button"
              variant={gameId === id ? "default" : "outline"}
              aria-pressed={gameId === id}
              onClick={() => updateSelection({ game: id })}
            >
              {curatedStudyGames[id].name}
            </Button>
          ))}
        </div>
      </section>

      <section aria-label="既存の出題方法" className="space-y-3">
        <h2 className="text-heading">普段の遊び方</h2>
        <p className="text-supporting text-muted-foreground">
          ランダムはレベルごとに開始します。図鑑は問題を自分で選びます。
        </p>
        <div className="flex flex-wrap gap-2">
          {difficulties.map((difficulty) => (
            <Button key={difficulty} asChild variant="outline">
              <a
                href={getCuratedRandomPlayUrl(gameId, difficulty)}
                target="_blank"
                rel="noopener noreferrer"
              >
                ランダム Lv{difficulty}
              </a>
            </Button>
          ))}
          <Button asChild variant="outline">
            <a href={game.zukanPath} target="_blank" rel="noopener noreferrer">
              図鑑で選ぶ
            </a>
          </Button>
        </div>
      </section>

      <section aria-label="固定問題の提示" className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-heading">固定した6問</h2>
          <p className="text-supporting text-muted-foreground">
            一覧から選ぶ方法と、1問ずつ順番に見る方法を比較します。
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-supporting text-muted-foreground">
            問題セットを選ぶ（同じレベルと規模で比較）
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="問題セット"
          >
            {(["a", "b"] as const).map((id) => (
              <Button
                key={id}
                type="button"
                variant={setId === id ? "default" : "outline"}
                aria-pressed={setId === id}
                onClick={() => updateSelection({ set: id })}
              >
                セット{id.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="提示方法"
        >
          <Button
            type="button"
            variant={presentation === "list" ? "default" : "outline"}
            aria-pressed={presentation === "list"}
            onClick={() => updateSelection({ presentation: "list" })}
          >
            一覧で選ぶ
          </Button>
          <Button
            type="button"
            variant={presentation === "sequence" ? "default" : "outline"}
            aria-pressed={presentation === "sequence"}
            onClick={() => updateSelection({ presentation: "sequence" })}
          >
            順番に見る
          </Button>
        </div>
        {presentation === "list" ? (
          <ol className="grid gap-2 sm:grid-cols-2">
            {candidates.map((candidate, index) => (
              <li key={candidate.problemId}>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-between"
                >
                  <a
                    href={getCuratedCandidatePlayUrl(gameId, candidate)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    候補 {index + 1}{" "}
                    <span className="text-muted-foreground">
                      Lv{candidate.difficulty}
                    </span>
                  </a>
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-lg border border-border bg-background p-4 space-y-4">
            <p
              className="text-supporting text-muted-foreground"
              aria-live="polite"
            >
              {position + 1} / {candidates.length} 問目 ・ Lv
              {currentCandidate.difficulty}
            </p>
            <Button asChild className="w-full">
              <a
                href={getCuratedCandidatePlayUrl(gameId, currentCandidate)}
                target="_blank"
                rel="noopener noreferrer"
              >
                この問題を遊ぶ
              </a>
            </Button>
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={position === 0}
                onClick={() => updateSelection({ position: position - 1 })}
              >
                前の問題
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={position === candidates.length - 1}
                onClick={() => updateSelection({ position: position + 1 })}
              >
                次の問題
              </Button>
            </div>
          </div>
        )}
        <p className="text-meta text-muted-foreground">
          問題は別タブで開きます。解いた後、この画面に戻って次を選んでください。
        </p>
      </section>
    </section>
  );
}
