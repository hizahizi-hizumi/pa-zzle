import { Link } from "@/router";

export function InvalidDifficulty() {
  return (
    <section className="mx-auto max-w-xl space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold">この難易度は選べません</h1>
      <Link
        to="/"
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/30"
      >
        ゲーム一覧へ戻る
      </Link>
    </section>
  );
}
