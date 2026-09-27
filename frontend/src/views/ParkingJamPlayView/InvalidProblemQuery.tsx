import { Link } from "@/router";

export function InvalidProblemQuery() {
  return (
    <section className="mx-auto max-w-xl space-y-4 py-12 text-center">
      <h1 className="text-xl font-semibold">指定された問題を復元できません</h1>
      <p className="text-supporting text-muted-foreground">
        URL の問題指定（seed・生成条件・生成試行）を確かめてください。
      </p>
      <Link
        to="/puzzles/parking-jam"
        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-ring/30"
      >
        難易度選択へ戻る
      </Link>
    </section>
  );
}
