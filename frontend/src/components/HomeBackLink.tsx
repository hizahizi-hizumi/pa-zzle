import { PuzzleBackIcon } from "@/components/PuzzleBackIcon";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type HomeBackLinkProps = {
  /** 名前を読み上げにだけ持たせ、アイコンのボタンで示す。見出しの行の頭に置くときに使う。 */
  iconOnly?: boolean;
};

export function HomeBackLink({ iconOnly = false }: HomeBackLinkProps) {
  if (iconOnly) {
    return (
      <Button asChild variant="ghost" size="icon-sm">
        <Link to="/" aria-label="戻る">
          <PuzzleBackIcon />
        </Link>
      </Button>
    );
  }
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
