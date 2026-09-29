import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link, type Path } from "@/router";

type DifficultySelectionPath = Exclude<
  Extract<Path, `/puzzles/${string}`>,
  `${string}/play/${string}`
>;

type PlayUnavailableNoticeProps = {
  title: string;
  description?: string;
  backTo: DifficultySelectionPath;
};

/** URLで指定されたプレイを始められないことを示し、難易度選択へ戻す。 */
export function PlayUnavailableNotice({
  title,
  description,
  backTo,
}: PlayUnavailableNoticeProps) {
  return (
    <div className="mx-auto max-w-xl">
      <Alert>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {description && <p>{description}</p>}
          <Button asChild>
            <Link to={backTo}>難易度選択へ戻る</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
