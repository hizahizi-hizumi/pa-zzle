import { Link } from "@/router";

type GameSelectionPath = "/games/sudoku" | "/games/water-sort";

type GameSelectionCardProps<Path extends GameSelectionPath> = {
  name: string;
  pictogramSrc: string;
  to: Path;
};

export function GameSelectionCard<Path extends GameSelectionPath>({
  name,
  pictogramSrc,
  to,
}: GameSelectionCardProps<Path>) {
  return (
    <Link
      to={to}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full min-h-64 flex-col overflow-hidden rounded-xl border bg-card transition-colors group-hover:bg-accent/40 group-focus-visible:bg-accent/40">
        <div className="flex flex-1 items-center justify-center bg-muted/30 px-6 py-10">
          <img src={pictogramSrc} alt="" className="size-28" />
        </div>
        <h2 className="border-t px-5 py-4 text-base font-semibold tracking-tight">
          {name}
        </h2>
      </article>
    </Link>
  );
}
