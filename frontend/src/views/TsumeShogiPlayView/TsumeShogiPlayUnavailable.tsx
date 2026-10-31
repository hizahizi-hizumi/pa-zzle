import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type TsumeShogiPlayUnavailableProps = {
  title: string;
  description?: string;
};

/** 難易度選択ができるまでの、プレイを始められないときの案内。ホームへ戻す。 */
export function TsumeShogiPlayUnavailable({
  title,
  description,
}: TsumeShogiPlayUnavailableProps) {
  return (
    <div className="mx-auto max-w-xl">
      <Alert>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {description && <p>{description}</p>}
          <Button asChild>
            <Link to="/">ホームへ戻る</Link>
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
