import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { sudokuDifficulties } from "@/games/sudoku/game/difficulty";
import { Link } from "@/router";

export default function SudokuDifficultyPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← ゲーム選択へ
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">ナンプレ</h1>
        <p className="text-muted-foreground">
          難易度を選んでプレイを始めます。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {sudokuDifficulties.map((difficulty) => (
          <Link
            key={difficulty.id}
            to="/games/sudoku/play/:difficulty"
            params={{ difficulty: difficulty.id }}
            className="group"
          >
            <Card className="h-full transition-colors group-hover:border-foreground/30">
              <CardHeader>
                <CardTitle>{difficulty.label}</CardTitle>
                <CardDescription>{difficulty.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
