import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { waterSortDifficulties } from "@/games/water-sort/game/difficulty";
import { Link } from "@/router";

export default function WaterSortDifficultyPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← ゲーム選択へ
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          カラーウォーターソート
        </h1>
        <p className="text-muted-foreground">
          難易度を選んでプレイを始めます。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {waterSortDifficulties.map((difficulty) => (
          <Link
            key={difficulty.id}
            to="/games/water-sort/play/:difficulty"
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
