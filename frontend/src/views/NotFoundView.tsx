import { useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import { Board404Typography } from "@/views/NotFoundView/MissingPageJigsaw/Board404Typography";
import { WholePageJigsaw404 } from "@/views/NotFoundView/MissingPageJigsaw/WholePageJigsaw404";

function resolveVariant(search: string) {
  return new URLSearchParams(search).get("variant") === "page"
    ? "page"
    : "font-color";
}

export function NotFoundView() {
  const location = useLocation();
  const variant = resolveVariant(location.search);

  if (variant === "page") {
    return <WholePageJigsaw404 />;
  }

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
