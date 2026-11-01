import { PuzzleBackIcon } from "@/components/PuzzleBackIcon";
import { Link, type Path } from "@/router";

/** ゲームの入口（難易度選択）のパス。 */
export type ZukanGameEntryPath = Exclude<
  Extract<Path, `/puzzles/${string}`>,
  `${string}/:${string}`
>;

type ZukanBackLinkProps = {
  to: ZukanGameEntryPath;
};

/** 図鑑からゲームの入口へ戻る導線。ホームへ戻る導線と同じ見た目にする。 */
export function ZukanBackLink({ to }: ZukanBackLinkProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-supporting text-muted-foreground hover:text-foreground [&>svg]:size-4"
    >
      <PuzzleBackIcon />
      戻る
    </Link>
  );
}
