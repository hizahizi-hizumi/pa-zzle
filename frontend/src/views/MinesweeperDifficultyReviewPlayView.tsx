import { useSearchParams } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { restoreMinesweeperProblemFromSearch } from "@/games/minesweeper/difficulty-review";
import { Link } from "@/router";
import { ReviewProblemPlay } from "@/views/MinesweeperDifficultyReviewPlayView/ReviewProblemPlay";

// 難易度確認画面から選んだ問題を遊ぶための一時的な画面。
export function MinesweeperDifficultyReviewPlayView() {
  const [searchParams] = useSearchParams();
  const problem = restoreMinesweeperProblemFromSearch(searchParams);

  if (!problem) {
    return (
      <div className="mx-auto max-w-xl">
        <Alert>
          <AlertTitle>この問題は復元できません</AlertTitle>
          <AlertDescription>
            <Button asChild>
              <Link to="/puzzles/minesweeper/difficulty-review">
                難易度の確認へ戻る
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <ReviewProblemPlay key={searchParams.toString()} problem={problem} />;
}
