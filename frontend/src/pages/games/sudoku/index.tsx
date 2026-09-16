import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sudokuDifficulties } from "@/games/sudoku/game/difficulty";
import { Link } from "@/router";

export default function SudokuDifficultyPage() {
  return (
    <section className="space-y-section">
      <PageHeader
        context={
          <Link
            to="/"
            className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
          >
            ← ゲーム選択へ
          </Link>
        }
        title="ナンプレ"
        description="難易度を選んでプレイを始めます。"
      />

      <div className="grid gap-list sm:grid-cols-3">
        {sudokuDifficulties.map((difficulty) => (
          <Link
            key={difficulty.id}
            to="/games/sudoku/play/:difficulty"
            params={{ difficulty: difficulty.id }}
            className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Card className="h-full transition-colors group-hover:border-foreground/30 motion-reduce:transition-none">
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
