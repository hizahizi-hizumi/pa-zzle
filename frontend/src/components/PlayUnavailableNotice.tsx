import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link, type Path } from "@/router";

type GameHomePath = Exclude<
  Extract<Path, `/puzzles/${string}`>,
  `${string}/:${string}`
>;

type PlayUnavailableNoticeProps = {
  title: string;
  description?: string;
  backTo: GameHomePath;
};

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
            <Link to={backTo}>問題選択へ戻る</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
