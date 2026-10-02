import { PuzzleBackIcon } from "@/components/PuzzleBackIcon";
import { Link } from "@/router";

export function HomeBackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-supporting text-muted-foreground hover:text-foreground [&>svg]:size-4"
    >
      <PuzzleBackIcon />
      戻る
    </Link>
  );
}
