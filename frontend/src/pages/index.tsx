import { Droplets, Grid3X3 } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/router";

export default function HomePage() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          ゲームを選ぶ
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          今日はどのパズルで遊びますか？
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/games/water-sort" className="group">
          <Card className="h-full transition-colors group-hover:border-foreground/30">
            <CardHeader>
              <Droplets className="size-8" aria-hidden="true" />
              <CardTitle>カラーウォーターソート</CardTitle>
              <CardDescription>
                同じ色の水を1本のボトルにまとめるパズルです。
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/games/sudoku" className="group">
          <Card className="h-full transition-colors group-hover:border-foreground/30">
            <CardHeader>
              <Grid3X3 className="size-8" aria-hidden="true" />
              <CardTitle>ナンプレ</CardTitle>
              <CardDescription>
                1から9までの数字を規則に沿って埋めるパズルです。
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </section>
  );
}
