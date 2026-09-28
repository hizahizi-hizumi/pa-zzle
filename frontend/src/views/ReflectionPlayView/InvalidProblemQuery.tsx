import { Link } from "@/router";

export function InvalidProblemQuery() {
  return (
    <section className="mx-auto max-w-xl space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold">指定された問題を復元できません</h1>
      <p className="text-supporting text-muted-foreground">
        URL の問題指定（pool・problem、または
        generator・seed・size・pieces）を確かめてください。
      </p>
      <Link
        to="/"
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/30"
      >
        ホームへ戻る
      </Link>
    </section>
  );
}
