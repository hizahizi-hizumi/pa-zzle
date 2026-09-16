import { Droplets, Grid3X3 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/router";

export default function HomePage() {
  return (
    <section className="space-y-section">
      <PageHeader context="ゲームを選ぶ" title="今日はどのパズルで遊びますか？" />

      <div className="grid gap-list sm:grid-cols-2">
        <Link to="/games/water-sort" className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Card className="h-full transition-colors group-hover:border-foreground/30 motion-reduce:transition-none">
            <CardHeader>
              <Droplets className="size-8" aria-hidden="true" />
              <CardTitle>カラーウォーターソート</CardTitle>
              <CardDescription>
                同じ色の水を1本のボトルにまとめるパズルです。
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link to="/games/sudoku" className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Card className="h-full transition-colors group-hover:border-foreground/30 motion-reduce:transition-none">
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
