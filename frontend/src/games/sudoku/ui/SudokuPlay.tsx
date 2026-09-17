import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Seed } from "@/games/core/seed";
import {
  getSudokuDifficultyLabel,
  type SudokuDifficulty,
} from "@/games/sudoku/game/difficulty";

type SudokuPlayProps = {
  difficulty: SudokuDifficulty;
  seed: Seed;
  status: "playing" | "cleared";
  clear: () => void;
  retry: () => void;
  onChangeDifficulty: () => void;
};

export function SudokuPlay({
  difficulty,
  seed,
  status,
  clear,
  retry,
  onChangeDifficulty,
}: SudokuPlayProps) {
  if (status === "cleared") {
    return (
      <Card className="mx-auto max-w-form">
        <CardHeader>
          <CardTitle className="text-section-title">クリア</CardTitle>
          <CardDescription>
            {getSudokuDifficultyLabel(difficulty)}のナンプレをクリアしました。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="break-all font-mono text-meta text-muted-foreground">
            問題シード: {seed}
          </p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-control-group">
          <Button onClick={retry}>もう一度</Button>
          <Button variant="outline" onClick={onChangeDifficulty}>
            難易度を変える
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-form">
      <CardHeader>
        <CardTitle>ナンプレ</CardTitle>
        <CardDescription>
          難易度: {getSudokuDifficultyLabel(difficulty)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center text-supporting text-muted-foreground">
          プレイ領域
        </div>
        <p className="break-all font-mono text-meta text-muted-foreground">
          問題シード: {seed}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-control-group">
        <Button onClick={clear}>クリア確認</Button>
        <Button variant="outline" onClick={onChangeDifficulty}>
          難易度を変える
        </Button>
      </CardFooter>
    </Card>
  );
}
