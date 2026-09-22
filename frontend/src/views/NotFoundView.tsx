import { useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { Link } from "@/router";
import {
  MissingPageJigsaw,
  type MissingPageJigsawVariant,
} from "@/views/NotFoundView/MissingPageJigsaw";

function resolveJigsawVariant(search: string): MissingPageJigsawVariant {
  return new URLSearchParams(search).get("variant") === "board"
    ? "board"
    : "classic";
}

export function NotFoundView() {
  const location = useLocation();
  const jigsawVariant = resolveJigsawVariant(location.search);

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-8 py-8 text-center sm:gap-10 sm:py-12">
      <MissingPageJigsaw variant={jigsawVariant} />

      <h1 className="text-screen-title">ページが見つかりません</h1>

      <Button asChild size="lg">
        <Link to="/">パズル一覧へ戻る</Link>
      </Button>
    </section>
  );
}
