import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import { MissingPageJigsaw } from "@/views/NotFoundView/MissingPageJigsaw";

export function NotFoundView() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 py-8 text-center sm:gap-10 sm:py-12">
      <MissingPageJigsaw />

      <div className="space-y-2">
        <h1 className="text-screen-title">ページが見つかりません</h1>
        <p className="text-supporting text-muted-foreground">
          お探しのページは移動したか、なくなったようです。
        </p>
      </div>

      <Button asChild size="lg">
        <Link to="/">パズル一覧へ戻る</Link>
      </Button>
    </section>
  );
}
