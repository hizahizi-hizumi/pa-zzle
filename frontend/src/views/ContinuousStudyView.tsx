import { useSearchParams } from "react-router";
import { HomeBackLink } from "@/components/HomeBackLink";
import { Button } from "@/components/ui/button";
import { getContinuousStudyPlayUrl } from "@/experiments/continuous-study";
import {
  type CuratedStudyGameId,
  curatedStudyGames,
} from "@/experiments/curated-study";
import type { ContinuousStudyMethod } from "@/experiments/curated-study-selection";

export function ContinuousStudyView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const gameId: CuratedStudyGameId =
    searchParams.get("game") === "parking-jam" ? "parking-jam" : "nanpure";
  const level = searchParams.get("difficulty");
  const difficulty = level === "4" || level === "5" ? level : "3";
  const method: ContinuousStudyMethod =
    searchParams.get("method") === "diverse" ? "diverse" : "random";
  const requestedEpisode = Number(searchParams.get("episode") ?? "0");
  const episode =
    Number.isSafeInteger(requestedEpisode) &&
    requestedEpisode >= 0 &&
    requestedEpisode <= 99
      ? requestedEpisode
      : 0;
  const participant = searchParams.get("participant") === "1";
  const start = getContinuousStudyPlayUrl(
    gameId,
    difficulty,
    method,
    episode,
    0,
    participant,
  );

  function update(values: Record<string, string>) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) next.set(key, value);
      next.delete("finished");
      return next;
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-7">
      <header className="space-y-3">
        <HomeBackLink />
        <h1 className="text-screen-title">連続プレイの比較</h1>
        <p className="text-supporting text-muted-foreground">
          {participant
            ? "同じレベルの10問を続けて遊んでください。普段と同じように、結果画面から次の問題へ進みます。"
            : "研究用の試作です。出題順序だけを調整した場合に、同じゲーム・同じ難易度を繰り返す楽しさが変わるかを比べます。"}
        </p>
      </header>
      {!participant && (
        <section aria-label="比較条件" className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-heading">ゲーム</h2>
            <div className="flex flex-wrap gap-2">
              {(["nanpure", "parking-jam"] as const).map((id) => (
                <Button
                  key={id}
                  variant={gameId === id ? "default" : "outline"}
                  aria-pressed={gameId === id}
                  onClick={() => update({ game: id })}
                >
                  {curatedStudyGames[id].name}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-heading">難易度</h2>
            <div className="flex flex-wrap gap-2">
              {(["3", "4", "5"] as const).map((id) => (
                <Button
                  key={id}
                  variant={difficulty === id ? "default" : "outline"}
                  aria-pressed={difficulty === id}
                  onClick={() => update({ difficulty: id })}
                >
                  Lv{id}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-heading">出題方法</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={method === "random" ? "default" : "outline"}
                aria-pressed={method === "random"}
                onClick={() => update({ method: "random" })}
              >
                無作為
              </Button>
              <Button
                variant={method === "diverse" ? "default" : "outline"}
                aria-pressed={method === "diverse"}
                onClick={() => update({ method: "diverse" })}
              >
                変化を調整
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-heading">比較する問題列</h2>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((id) => (
                <Button
                  key={id}
                  variant={episode === id ? "default" : "outline"}
                  aria-pressed={episode === id}
                  onClick={() => update({ episode: String(id) })}
                >
                  列{id + 1}
                </Button>
              ))}
            </div>
          </div>
        </section>
      )}
      <section aria-label="連続プレイ" className="space-y-4">
        <h2 className="text-heading">10問続けて遊ぶ</h2>
        {searchParams.get("finished") === "1" && (
          <p role="status" className="text-supporting">
            10問のプレイが終わりました。印象や継続意向を記録してください。
          </p>
        )}
        {start ? (
          <Button asChild className="w-full">
            <a href={start}>1問目から始める</a>
          </Button>
        ) : (
          <p role="status">この条件で出題できる問題がありません。</p>
        )}
      </section>
    </section>
  );
}
