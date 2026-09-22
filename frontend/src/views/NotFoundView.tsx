import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import { Board404Typography } from "@/views/NotFoundView/MissingPageJigsaw/Board404Typography";

export function NotFoundView() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 py-8 text-center sm:gap-10 sm:py-12">
      <Board404Typography />

      <h1 className="text-screen-title">ページが見つかりません</h1>

      <Button asChild size="lg">
        <Link to="/">パズル一覧へ戻る</Link>
      </Button>
    </section>
  );
}
